// API de WorldCards : comptes, sauvegarde dans le cloud, hub communautaire et administration.
// Fonction Cloudflare Pages ; base de données D1 liée sous le nom « DB ».
// Variables d'environnement : ADMIN_CODE (secret, obligatoire pour créer le compte administrateur)
// et ADMIN_PSEUDO (facultatif, « nuiraz » par défaut).

const JOUR = 864e5;
const SESSION_JOURS = 30;
const ITERATIONS = 10000; // limité par le temps de calcul des Workers gratuits
const TAILLE_MAX_SAUVEGARDE = 1_500_000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const erreur = (message, status = 400) => json({ erreur: message }, status);
const maintenant = () => Date.now();

// Tables créées automatiquement au premier appel (voir aussi db/schema.sql)
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, sel TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, banni INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL, derniere_co INTEGER, echecs INTEGER NOT NULL DEFAULT 0, bloque_jusqu INTEGER NOT NULL DEFAULT 0, cgu_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS sessions ( token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expire INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS sauvegardes ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, maj INTEGER NOT NULL, cartes INTEGER NOT NULL DEFAULT 0, secretes INTEGER NOT NULL DEFAULT 0, badges INTEGER NOT NULL DEFAULT 0, vitrine TEXT NOT NULL DEFAULT '[]' )`,
  `CREATE INDEX IF NOT EXISTS sauvegardes_cartes ON sauvegardes(cartes DESC)`,
  `CREATE TABLE IF NOT EXISTS posts ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, texte TEXT NOT NULL, carte TEXT, epingle INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS posts_date ON posts(epingle DESC, cree_le DESC)`,
  `CREATE TABLE IF NOT EXISTS likes ( post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id) )`,
  `CREATE TABLE IF NOT EXISTS signalements ( id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, motif TEXT, cree_le INTEGER NOT NULL, UNIQUE (post_id, user_id) )`,
  `CREATE TABLE IF NOT EXISTS cadeaux ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, pieces INTEGER NOT NULL DEFAULT 0, boosters INTEGER NOT NULL DEFAULT 0, message TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS cadeaux_recus ( cadeau_id INTEGER NOT NULL REFERENCES cadeaux(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (cadeau_id, user_id) )`,
];
let schemaPret = false;
async function preparerSchema(env) {
  if (schemaPret) return;
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  schemaPret = true;
}

/* ---------- Cryptographie ---------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const aleatoire = (n) => crypto.getRandomValues(new Uint8Array(n));
async function hacherMotDePasse(motdepasse, sel, iterations = ITERATIONS) {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(motdepasse), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(atob(sel), (c) => c.charCodeAt(0)), iterations }, cle, 256);
  return `v1$${iterations}$${b64(bits)}`;
}
async function verifierMotDePasse(motdepasse, sel, attendu) {
  const iterations = Number(attendu.split("$")[1]) || ITERATIONS;
  return egal(await hacherMotDePasse(motdepasse, sel, iterations), attendu);
}
function egal(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sha256(texte) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function motDePasseTemporaire() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return [...aleatoire(12)].map((x) => alphabet[x % alphabet.length]).join("");
}

/* ---------- Sessions ---------- */
function lireCookie(request, nom) {
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + nom + "=([^;]+)"));
  return m ? m[1] : null;
}
const cookieSession = (token, maxAge) => `wc_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
async function ouvrirSession(env, userId) {
  const token = b64(aleatoire(32)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expire) VALUES (?, ?, ?)").bind(await sha256(token), userId, maintenant() + SESSION_JOURS * JOUR).run();
  return cookieSession(token, SESSION_JOURS * 86400);
}
async function utilisateurCourant(request, env) {
  const token = lireCookie(request, "wc_session");
  if (!token) return null;
  return env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expire > ? AND u.banni = 0`).bind(await sha256(token), maintenant()).first();
}
const profilPublic = (u) => ({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le });

/* ---------- Validation ---------- */
const PSEUDO_RE = /^[A-Za-z0-9_-]{3,20}$/;
const CARTE_RE = /^[a-z]+:[a-z0-9-]{1,40}$/;
const pseudoAdmin = (env) => (env.ADMIN_PSEUDO || "nuiraz").toLowerCase();
// Empêche les imitations du pseudo de l'administrateur (« Nuiraz_ », « nu1raz »…)
const squelette = (p) => p.toLowerCase().replace(/[0]/g, "o").replace(/[1l]/g, "i").replace(/[3]/g, "e").replace(/[^a-z]/g, "");

async function corps(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new ErreurApi("Format de requête invalide.", 415);
  try { return await request.json(); } catch { throw new ErreurApi("Requête illisible."); }
}
class ErreurApi extends Error { constructor(m, s = 400) { super(m); this.status = s; } }

/* =====================================================================
   Routes
   ===================================================================== */
const routes = [];
const route = (methode, motif, gestion, options = {}) => routes.push({ methode, motif: new RegExp("^" + motif + "$"), gestion, ...options });

// ----- Comptes -----
route("POST", "inscription", async ({ request, env }) => {
  const b = await corps(request);
  const pseudo = String(b.pseudo || "").trim();
  const motdepasse = String(b.motdepasse || "");
  if (!PSEUDO_RE.test(pseudo)) return erreur("Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, - ou _.");
  if (motdepasse.length < 8 || motdepasse.length > 200) return erreur("Le mot de passe doit faire au moins 8 caractères.");
  if (b.cgu !== true) return erreur("Vous devez accepter les conditions d'utilisation et la politique de confidentialité.");
  if (b.age !== true) return erreur("Vous devez avoir 15 ans ou plus, ou l'accord d'un parent.");
  const admin = pseudo.toLowerCase() === pseudoAdmin(env);
  if (squelette(pseudo) === squelette(pseudoAdmin(env))) {
    if (!admin || !env.ADMIN_CODE || !egal(String(b.codeAdmin || ""), env.ADMIN_CODE)) return erreur("Ce pseudo est réservé.", 403);
  }
  const sel = b64(aleatoire(16));
  const hash = await hacherMotDePasse(motdepasse, sel);
  try {
    const r = await env.DB.prepare("INSERT INTO users (pseudo, hash, sel, admin, cree_le, derniere_co, cgu_le) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(pseudo, hash, sel, admin ? 1 : 0, maintenant(), maintenant(), maintenant()).run();
    const cookie = await ouvrirSession(env, r.meta.last_row_id);
    return json({ pseudo, admin, creeLe: maintenant() }, 201, { "set-cookie": cookie });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return erreur("Ce pseudo est déjà pris.", 409);
    throw e;
  }
});

route("POST", "connexion", async ({ request, env }) => {
  const b = await corps(request);
  const u = await env.DB.prepare("SELECT * FROM users WHERE pseudo = ?").bind(String(b.pseudo || "").trim()).first();
  if (!u) return erreur("Pseudo ou mot de passe incorrect.", 401);
  if (u.bloque_jusqu > maintenant()) return erreur(`Trop d'essais. Réessayez dans ${Math.ceil((u.bloque_jusqu - maintenant()) / 60000)} min.`, 429);
  if (!(await verifierMotDePasse(String(b.motdepasse || ""), u.sel, u.hash))) {
    const echecs = u.echecs + 1;
    await env.DB.prepare("UPDATE users SET echecs = ?, bloque_jusqu = ? WHERE id = ?")
      .bind(echecs >= 8 ? 0 : echecs, echecs >= 8 ? maintenant() + 15 * 60000 : 0, u.id).run();
    return erreur("Pseudo ou mot de passe incorrect.", 401);
  }
  if (u.banni) return erreur("Ce compte a été suspendu par l'administrateur.", 403);
  await env.DB.prepare("UPDATE users SET echecs = 0, derniere_co = ? WHERE id = ?").bind(maintenant(), u.id).run();
  return json(profilPublic(u), 200, { "set-cookie": await ouvrirSession(env, u.id) });
});

route("POST", "deconnexion", async ({ request, env }) => {
  const token = lireCookie(request, "wc_session");
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookieSession("", 0) });
});

route("GET", "moi", async ({ user }) => json(user ? { connecte: true, ...profilPublic(user) } : { connecte: false }));

route("POST", "motdepasse", async ({ request, env, user }) => {
  const b = await corps(request);
  if (!(await verifierMotDePasse(String(b.ancien || ""), user.sel, user.hash))) return erreur("Mot de passe actuel incorrect.", 401);
  const nouveau = String(b.nouveau || "");
  if (nouveau.length < 8 || nouveau.length > 200) return erreur("Le nouveau mot de passe doit faire au moins 8 caractères.");
  const sel = b64(aleatoire(16));
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET hash = ?, sel = ? WHERE id = ?").bind(await hacherMotDePasse(nouveau, sel), sel, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
  ]);
  return json({ ok: true }, 200, { "set-cookie": await ouvrirSession(env, user.id) });
}, { connecte: true });

async function supprimerUtilisateur(env, id) {
  await env.DB.batch([
    "DELETE FROM sessions WHERE user_id = ?", "DELETE FROM sauvegardes WHERE user_id = ?", "DELETE FROM likes WHERE user_id = ?",
    "DELETE FROM signalements WHERE user_id = ?", "DELETE FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)",
    "DELETE FROM signalements WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)", "DELETE FROM posts WHERE user_id = ?",
    "DELETE FROM cadeaux_recus WHERE user_id = ?", "DELETE FROM cadeaux WHERE user_id = ?", "DELETE FROM users WHERE id = ?",
  ].map((sql) => env.DB.prepare(sql).bind(id)));
}
route("DELETE", "compte", async ({ request, env, user }) => {
  const b = await corps(request);
  if (!(await verifierMotDePasse(String(b.motdepasse || ""), user.sel, user.hash))) return erreur("Mot de passe incorrect.", 401);
  if (user.admin) return erreur("Le compte administrateur ne peut pas être supprimé d'ici.", 403);
  await supprimerUtilisateur(env, user.id);
  return json({ ok: true }, 200, { "set-cookie": cookieSession("", 0) });
}, { connecte: true });

// Droit d'accès et de portabilité (RGPD) : toutes les données du compte
route("GET", "compte/export", async ({ env, user }) => {
  const sauvegarde = await env.DB.prepare("SELECT data, maj FROM sauvegardes WHERE user_id = ?").bind(user.id).first();
  const posts = await env.DB.prepare("SELECT texte, carte, cree_le FROM posts WHERE user_id = ? ORDER BY id").bind(user.id).all();
  return json({
    compte: { pseudo: user.pseudo, creeLe: user.cree_le, derniereConnexion: user.derniere_co, conditionsAccepteesLe: user.cgu_le },
    sauvegarde: sauvegarde ? { maj: sauvegarde.maj, data: JSON.parse(sauvegarde.data) } : null,
    messages: posts.results,
  });
}, { connecte: true });

// ----- Sauvegarde -----
route("GET", "sauvegarde", async ({ env, user }) => {
  const s = await env.DB.prepare("SELECT data, maj FROM sauvegardes WHERE user_id = ?").bind(user.id).first();
  return json(s ? { data: JSON.parse(s.data), maj: s.maj } : { data: null });
}, { connecte: true });

route("PUT", "sauvegarde", async ({ request, env, user }) => {
  const texte = await request.text();
  if (texte.length > TAILLE_MAX_SAUVEGARDE) return erreur("Sauvegarde trop lourde : retirez quelques illustrations personnelles.", 413);
  let b; try { b = JSON.parse(texte); } catch { return erreur("Sauvegarde illisible."); }
  if (!b.data || typeof b.data !== "object") return erreur("Sauvegarde vide.");
  const n = (x) => Math.max(0, Math.min(100000, Math.floor(Number(x) || 0)));
  const vitrine = (Array.isArray(b.vitrine) ? b.vitrine : []).filter((id) => typeof id === "string" && CARTE_RE.test(id)).slice(0, 5);
  await env.DB.prepare(`INSERT INTO sauvegardes (user_id, data, maj, cartes, secretes, badges, vitrine) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, maj = excluded.maj, cartes = excluded.cartes,
    secretes = excluded.secretes, badges = excluded.badges, vitrine = excluded.vitrine`)
    .bind(user.id, JSON.stringify(b.data), maintenant(), n(b.resume?.cartes), n(b.resume?.secretes), n(b.resume?.badges), JSON.stringify(vitrine)).run();
  return json({ ok: true, maj: maintenant() });
}, { connecte: true });

// ----- Hub communautaire -----
route("GET", "posts", async ({ request, env, user }) => {
  const avant = Number(new URL(request.url).searchParams.get("avant")) || null;
  const r = await env.DB.prepare(`SELECT p.id, p.texte, p.carte, p.epingle, p.cree_le, u.pseudo, u.admin, p.user_id,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?1) AS aime
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE u.banni = 0 AND (?2 IS NULL OR (p.epingle = 0 AND p.id < ?2))
    ORDER BY CASE WHEN ?2 IS NULL THEN p.epingle ELSE 0 END DESC, p.id DESC LIMIT 30`).bind(user?.id ?? 0, avant).all();
  return json({ posts: r.results.map(({ user_id, ...p }) => ({ ...p, admin: !!p.admin, aime: !!p.aime, epingle: !!p.epingle, moi: !!user && user_id === user.id })) });
});

route("POST", "posts", async ({ request, env, user }) => {
  const b = await corps(request);
  const texte = String(b.texte || "").trim().slice(0, 500);
  const carte = b.carte && CARTE_RE.test(b.carte) ? b.carte : null;
  if (!texte && !carte) return erreur("Écrivez un message ou joignez une carte.");
  const dernier = await env.DB.prepare("SELECT cree_le FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(user.id).first();
  if (!user.admin && dernier && maintenant() - dernier.cree_le < 20000) return erreur("Attendez quelques secondes avant de publier à nouveau.", 429);
  const r = await env.DB.prepare("INSERT INTO posts (user_id, texte, carte, epingle, cree_le) VALUES (?, ?, ?, ?, ?)")
    .bind(user.id, texte, carte, user.admin && b.epingle ? 1 : 0, maintenant()).run();
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });

route("DELETE", "posts/(\\d+)", async ({ env, user, p }) => {
  const post = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(p[1]).first();
  if (!post) return erreur("Message introuvable.", 404);
  if (post.user_id !== user.id && !user.admin) return erreur("Vous ne pouvez supprimer que vos messages.", 403);
  await env.DB.batch(["DELETE FROM likes WHERE post_id = ?", "DELETE FROM signalements WHERE post_id = ?", "DELETE FROM posts WHERE id = ?"].map((s) => env.DB.prepare(s).bind(p[1])));
  return json({ ok: true });
}, { connecte: true });

route("POST", "posts/(\\d+)/like", async ({ env, user, p }) => {
  const r = await env.DB.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").bind(p[1], user.id).run();
  if (!r.meta.changes) await env.DB.prepare("INSERT OR IGNORE INTO likes (post_id, user_id) SELECT id, ? FROM posts WHERE id = ?").bind(user.id, p[1]).run();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM likes WHERE post_id = ?").bind(p[1]).first();
  return json({ aime: !r.meta.changes, likes: n.n });
}, { connecte: true });

route("POST", "posts/(\\d+)/signaler", async ({ request, env, user, p }) => {
  const b = await corps(request);
  await env.DB.prepare("INSERT OR IGNORE INTO signalements (post_id, user_id, motif, cree_le) SELECT id, ?, ?, ? FROM posts WHERE id = ?")
    .bind(user.id, String(b.motif || "").slice(0, 200), maintenant(), p[1]).run();
  return json({ ok: true });
}, { connecte: true });

route("GET", "classement", async ({ request, env }) => {
  const tri = { cartes: "cartes", secretes: "secretes", badges: "badges" }[new URL(request.url).searchParams.get("tri")] || "cartes";
  const r = await env.DB.prepare(`SELECT u.pseudo, u.admin, s.cartes, s.secretes, s.badges FROM sauvegardes s JOIN users u ON u.id = s.user_id
    WHERE u.banni = 0 ORDER BY s.${tri} DESC, s.maj ASC LIMIT 50`).all();
  return json({ joueurs: r.results.map((x) => ({ ...x, admin: !!x.admin })) });
});

route("GET", "profil/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const u = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.cree_le, s.cartes, s.secretes, s.badges, s.vitrine,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS messages
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0`).bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  return json({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, cartes: u.cartes || 0, secretes: u.secretes || 0, badges: u.badges || 0, messages: u.messages, vitrine: JSON.parse(u.vitrine || "[]") });
});

// ----- Cadeaux -----
route("GET", "cadeaux", async ({ env, user }) => {
  const r = await env.DB.prepare(`SELECT c.id, c.pieces, c.boosters, c.message FROM cadeaux c
    WHERE (c.user_id = ?1 OR c.user_id IS NULL) AND NOT EXISTS (SELECT 1 FROM cadeaux_recus r WHERE r.cadeau_id = c.id AND r.user_id = ?1)
    ORDER BY c.id`).bind(user.id).all();
  return json({ cadeaux: r.results });
}, { connecte: true });

route("POST", "cadeaux/(\\d+)/recevoir", async ({ env, user, p }) => {
  const c = await env.DB.prepare("SELECT * FROM cadeaux WHERE id = ? AND (user_id = ? OR user_id IS NULL)").bind(p[1], user.id).first();
  if (!c) return erreur("Cadeau introuvable.", 404);
  const r = await env.DB.prepare("INSERT OR IGNORE INTO cadeaux_recus (cadeau_id, user_id) VALUES (?, ?)").bind(c.id, user.id).run();
  if (!r.meta.changes) return erreur("Cadeau déjà reçu.", 409);
  return json({ pieces: c.pieces, boosters: c.boosters, message: c.message });
}, { connecte: true });

// ----- Administration -----
route("GET", "admin/stats", async ({ env }) => {
  const semaine = maintenant() - 7 * JOUR;
  const [a, b, c, d, e, f] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM users"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE cree_le > ?").bind(semaine),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE derniere_co > ?").bind(semaine),
    env.DB.prepare("SELECT COUNT(*) AS n FROM posts"),
    env.DB.prepare("SELECT COUNT(DISTINCT post_id) AS n FROM signalements"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE banni = 1"),
  ]);
  return json({ joueurs: a.results[0].n, nouveaux7j: b.results[0].n, actifs7j: c.results[0].n, messages: d.results[0].n, signales: e.results[0].n, bannis: f.results[0].n });
}, { admin: true });

route("GET", "admin/utilisateurs", async ({ request, env }) => {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  const r = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.banni, u.cree_le, u.derniere_co, COALESCE(s.cartes, 0) AS cartes,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS messages
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.pseudo LIKE ? ORDER BY u.id DESC LIMIT 100`).bind(`%${q.replace(/[%_]/g, "")}%`).all();
  return json({ utilisateurs: r.results });
}, { admin: true });

route("POST", "admin/utilisateurs/(\\d+)/bannir", async ({ request, env, p }) => {
  const b = await corps(request);
  const cible = await env.DB.prepare("SELECT admin FROM users WHERE id = ?").bind(p[1]).first();
  if (!cible) return erreur("Joueur introuvable.", 404);
  if (cible.admin) return erreur("Impossible de bannir un administrateur.", 403);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET banni = ? WHERE id = ?").bind(b.banni ? 1 : 0, p[1]),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(p[1]),
  ]);
  return json({ ok: true });
}, { admin: true });

route("POST", "admin/utilisateurs/(\\d+)/motdepasse", async ({ env, p }) => {
  const cible = await env.DB.prepare("SELECT admin FROM users WHERE id = ?").bind(p[1]).first();
  if (!cible) return erreur("Joueur introuvable.", 404);
  if (cible.admin) return erreur("Changez votre propre mot de passe depuis « Mon compte ».", 403);
  const temporaire = motDePasseTemporaire(), sel = b64(aleatoire(16));
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET hash = ?, sel = ?, echecs = 0, bloque_jusqu = 0 WHERE id = ?").bind(await hacherMotDePasse(temporaire, sel), sel, p[1]),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(p[1]),
  ]);
  return json({ motdepasse: temporaire });
}, { admin: true });

route("DELETE", "admin/utilisateurs/(\\d+)", async ({ env, p }) => {
  const cible = await env.DB.prepare("SELECT admin FROM users WHERE id = ?").bind(p[1]).first();
  if (!cible) return erreur("Joueur introuvable.", 404);
  if (cible.admin) return erreur("Impossible de supprimer un administrateur.", 403);
  await supprimerUtilisateur(env, Number(p[1]));
  return json({ ok: true });
}, { admin: true });

route("GET", "admin/signalements", async ({ env }) => {
  const r = await env.DB.prepare(`SELECT p.id, p.texte, p.carte, p.cree_le, u.pseudo, u.id AS user_id, COUNT(s.id) AS nombre, GROUP_CONCAT(s.motif, ' · ') AS motifs
    FROM signalements s JOIN posts p ON p.id = s.post_id JOIN users u ON u.id = p.user_id
    GROUP BY p.id ORDER BY nombre DESC, p.id DESC LIMIT 100`).all();
  return json({ signalements: r.results });
}, { admin: true });

route("DELETE", "admin/signalements/(\\d+)", async ({ env, p }) => {
  await env.DB.prepare("DELETE FROM signalements WHERE post_id = ?").bind(p[1]).run();
  return json({ ok: true });
}, { admin: true });

route("POST", "admin/posts/(\\d+)/epingle", async ({ env, p }) => {
  await env.DB.prepare("UPDATE posts SET epingle = 1 - epingle WHERE id = ?").bind(p[1]).run();
  return json({ ok: true });
}, { admin: true });

route("POST", "admin/cadeaux", async ({ request, env }) => {
  const b = await corps(request);
  const pieces = Math.max(0, Math.min(100000, Math.floor(Number(b.pieces) || 0)));
  const boosters = Math.max(0, Math.min(50, Math.floor(Number(b.boosters) || 0)));
  if (!pieces && !boosters) return erreur("Indiquez des pièces ou des boosters.");
  let userId = null;
  if (b.pseudo) {
    const u = await env.DB.prepare("SELECT id FROM users WHERE pseudo = ?").bind(String(b.pseudo).trim()).first();
    if (!u) return erreur("Joueur introuvable.", 404);
    userId = u.id;
  }
  await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, pieces, boosters, String(b.message || "").slice(0, 200), maintenant()).run();
  return json({ ok: true }, 201);
}, { admin: true });

/* =====================================================================
   Point d'entrée
   ===================================================================== */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DB) return erreur("Les comptes ne sont pas encore activés sur ce site (base de données D1 non reliée).", 503);
  // Les requêtes qui modifient des données doivent venir de ce site
  if (request.method !== "GET") {
    const origine = request.headers.get("origin");
    if (origine && new URL(origine).host !== url.host) return erreur("Origine refusée.", 403);
  }
  const chemin = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const r = routes.find((x) => x.methode === request.method && x.motif.test(chemin));
  if (!r) return erreur("Adresse inconnue.", 404);
  try {
    await preparerSchema(env);
    const user = await utilisateurCourant(request, env);
    if ((r.connecte || r.admin) && !user) return erreur("Connectez-vous pour continuer.", 401);
    if (r.admin && !user.admin) return erreur("Réservé à l'administrateur.", 403);
    return await r.gestion({ request, env, user, p: chemin.match(r.motif) });
  } catch (e) {
    if (e instanceof ErreurApi) return erreur(e.message, e.status);
    console.error(e);
    return erreur("Erreur du serveur. Réessayez dans un instant.", 500);
  }
}
