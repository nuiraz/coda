// API de WorldCards : comptes, sauvegarde dans le cloud, hub communautaire, Premium, arène en ligne,
// notifications push et administration. Base de données D1 liée sous le nom « DB ».
// Variables d'environnement : ADMIN_CODE (secret, obligatoire pour créer le compte administrateur)
// et ADMIN_PSEUDO (facultatif, « nuiraz » par défaut).
import COMBAT from "../../worldcards/combat.js";
import MONDE from "../../worldcards/data/monde.js";
import VILLES2 from "../../worldcards/data/villes2.js";
import MONUMENTS2 from "../../worldcards/data/monuments2.js";
import VILLES3 from "../../worldcards/data/villes3.js";
import MONUMENTS3 from "../../worldcards/data/monuments3.js";
import NATURE from "../../worldcards/data/nature.js";
import ANIMAUX from "../../worldcards/data/animaux.js";
import PLATS from "../../worldcards/data/plats.js";
import MONUMENTS4 from "../../worldcards/data/monuments4.js";
import NATURE2 from "../../worldcards/data/nature2.js";
import ANIMAUX2 from "../../worldcards/data/animaux2.js";
import PLATS2 from "../../worldcards/data/plats2.js";
import CULTURE from "../../worldcards/data/culture.js";

const JOUR = 864e5;
const SESSION_JOURS = 365; // on reste connecté un an (la session est prolongée à chaque visite)
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
  `CREATE TABLE IF NOT EXISTS config ( cle TEXT PRIMARY KEY, valeur TEXT NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS demandes_premium ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, formule TEXT NOT NULL, note TEXT, cree_le INTEGER NOT NULL, traitee INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS abonnements ( endpoint TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS abonnements_user ON abonnements(user_id)`,
  `CREATE TABLE IF NOT EXISTS notifs ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, titre TEXT NOT NULL, texte TEXT NOT NULL, url TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS notifs_user ON notifs(user_id, id DESC)`,
  `CREATE TABLE IF NOT EXISTS rappels ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, quand INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS arene ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, deck TEXT, puissance INTEGER NOT NULL DEFAULT 0, trophees INTEGER NOT NULL DEFAULT 1000, victoires INTEGER NOT NULL DEFAULT 0, defaites INTEGER NOT NULL DEFAULT 0, jour TEXT, nb INTEGER NOT NULL DEFAULT 0, maj INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE INDEX IF NOT EXISTS arene_trophees ON arene(trophees DESC)`,
  `CREATE TABLE IF NOT EXISTS combats ( id INTEGER PRIMARY KEY AUTOINCREMENT, attaquant INTEGER NOT NULL, defenseur INTEGER NOT NULL, graine INTEGER NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, cree_le INTEGER NOT NULL, fini INTEGER NOT NULL DEFAULT 0, gagne INTEGER )`,
];
// Colonnes ajoutées après coup aux tables existantes (l'erreur « colonne déjà présente » est ignorée)
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN premium_jusqu INTEGER NOT NULL DEFAULT 0`,
];
let schemaPret = false;
async function preparerSchema(env) {
  if (schemaPret) return;
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  for (const sql of MIGRATIONS) { try { await env.DB.prepare(sql).run(); } catch {} }
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
// La session est envoyée dans un cookie et aussi renvoyée au jeu, qui la garde en mémoire :
// l'app installée sur iPhone perd parfois ses cookies, le jeu peut alors la renvoyer dans l'en-tête X-WC-Session.
async function ouvrirSession(env, userId) {
  const token = b64(aleatoire(32)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expire) VALUES (?, ?, ?)").bind(await sha256(token), userId, maintenant() + SESSION_JOURS * JOUR).run();
  return { cookie: cookieSession(token, SESSION_JOURS * 86400), token };
}
const jetonRequete = (request) => lireCookie(request, "wc_session") || (/^[A-Za-z0-9_-]{20,64}$/.test(request.headers.get("x-wc-session") || "") ? request.headers.get("x-wc-session") : null);
async function utilisateurCourant(request, env) {
  const token = jetonRequete(request);
  if (!token) return null;
  const u = await env.DB.prepare(`SELECT u.*, s.expire AS session_expire FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expire > ? AND u.banni = 0`).bind(await sha256(token), maintenant()).first();
  if (u) u.jeton = token;
  return u;
}
const profilPublic = (u) => ({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, premiumJusqu: u.premium_jusqu || 0 });
const PREMIUM_VIE = 4102444800000;
const estPremium = (u) => (u?.premium_jusqu || 0) > maintenant();

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
    const session = await ouvrirSession(env, r.meta.last_row_id);
    return json({ pseudo, admin, creeLe: maintenant(), jeton: session.token }, 201, { "set-cookie": session.cookie });
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
  const session = await ouvrirSession(env, u.id);
  return json({ ...profilPublic(u), jeton: session.token }, 200, { "set-cookie": session.cookie });
});

route("POST", "deconnexion", async ({ request, env }) => {
  const token = jetonRequete(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookieSession("", 0) });
});

// À chaque visite, la session est prolongée d'un an et le cookie renouvelé
route("GET", "moi", async ({ env, user }) => {
  if (!user) return json({ connecte: false });
  const expire = maintenant() + SESSION_JOURS * JOUR;
  if (user.session_expire - maintenant() < (SESSION_JOURS - 1) * JOUR) {
    await env.DB.prepare("UPDATE sessions SET expire = ? WHERE token_hash = ?").bind(expire, await sha256(user.jeton)).run();
  }
  await env.DB.prepare("UPDATE users SET derniere_co = ? WHERE id = ?").bind(maintenant(), user.id).run();
  return json({ connecte: true, ...profilPublic(user) }, 200, { "set-cookie": cookieSession(user.jeton, SESSION_JOURS * 86400) });
});

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
  const session = await ouvrirSession(env, user.id);
  return json({ ok: true, jeton: session.token }, 200, { "set-cookie": session.cookie });
}, { connecte: true });

async function supprimerUtilisateur(env, id) {
  await env.DB.batch([
    "DELETE FROM sessions WHERE user_id = ?", "DELETE FROM sauvegardes WHERE user_id = ?", "DELETE FROM likes WHERE user_id = ?",
    "DELETE FROM signalements WHERE user_id = ?", "DELETE FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)",
    "DELETE FROM signalements WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)", "DELETE FROM posts WHERE user_id = ?",
    "DELETE FROM cadeaux_recus WHERE user_id = ?", "DELETE FROM cadeaux WHERE user_id = ?",
    "DELETE FROM abonnements WHERE user_id = ?", "DELETE FROM notifs WHERE user_id = ?", "DELETE FROM rappels WHERE user_id = ?",
    "DELETE FROM arene WHERE user_id = ?", "DELETE FROM demandes_premium WHERE user_id = ?", "DELETE FROM users WHERE id = ?",
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
  const r = await env.DB.prepare(`SELECT p.id, p.texte, p.carte, p.epingle, p.cree_le, u.pseudo, u.admin, p.user_id, u.premium_jusqu > ?3 AS premium,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?1) AS aime
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE u.banni = 0 AND (?2 IS NULL OR (p.epingle = 0 AND p.id < ?2))
    ORDER BY CASE WHEN ?2 IS NULL THEN p.epingle ELSE 0 END DESC, p.id DESC LIMIT 30`).bind(user?.id ?? 0, avant, maintenant()).all();
  return json({ posts: r.results.map(({ user_id, ...p }) => ({ ...p, admin: !!p.admin, premium: !!p.premium, aime: !!p.aime, epingle: !!p.epingle, moi: !!user && user_id === user.id })) });
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
  const r = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu > ? AS premium, s.cartes, s.secretes, s.badges FROM sauvegardes s JOIN users u ON u.id = s.user_id
    WHERE u.banni = 0 ORDER BY s.${tri} DESC, s.maj ASC LIMIT 50`).bind(maintenant()).all();
  return json({ joueurs: r.results.map((x) => ({ ...x, admin: !!x.admin, premium: !!x.premium })) });
});

route("GET", "profil/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const u = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.cree_le, u.premium_jusqu, s.cartes, s.secretes, s.badges, s.vitrine,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS messages, (SELECT trophees FROM arene WHERE user_id = u.id) AS trophees
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0`).bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  return json({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, cartes: u.cartes || 0, secretes: u.secretes || 0, badges: u.badges || 0, messages: u.messages, trophees: u.trophees || 0, premium: estPremium(u), vitrine: JSON.parse(u.vitrine || "[]") });
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
  const r = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.banni, u.cree_le, u.derniere_co, u.premium_jusqu, COALESCE(s.cartes, 0) AS cartes,
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

route("POST", "admin/cadeaux", async ({ request, env, ctx }) => {
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
  const notif = { titre: "🎁 Un cadeau vous attend !", texte: String(b.message || "").slice(0, 120) || "Ouvrez WorldCards pour le recevoir.", url: "./" };
  enArrierePlan(ctx, (async () => {
    const ids = userId ? [userId] : (await env.DB.prepare("SELECT DISTINCT user_id FROM abonnements LIMIT 1000").all()).results.map((x) => x.user_id);
    for (const id of ids) await envoyerPush(env, id, notif);
  })());
  return json({ ok: true }, 201);
}, { admin: true });


/* =====================================================================
   Notifications push (Web Push sans contenu, signé avec des clés VAPID)
   ===================================================================== */
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enArrierePlan = (ctx, promesse) => { const p = promesse.catch((e) => console.error(e)); if (ctx?.waitUntil) ctx.waitUntil(p); return p; };
// Services de notification des navigateurs (Apple, Google, Mozilla, Microsoft) : seuls ceux-là sont acceptés
const HOTES_PUSH = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
async function clesVapid(env) {
  const lire = async () => (await env.DB.prepare("SELECT valeur FROM config WHERE cle = 'vapid'").first())?.valeur;
  let v = await lire();
  if (!v) {
    // Première utilisation : la paire de clés est créée et gardée dans la base (la clé privée ne quitte jamais le serveur)
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const cles = { prive: await crypto.subtle.exportKey("jwk", k.privateKey), pub: b64url(await crypto.subtle.exportKey("raw", k.publicKey)) };
    await env.DB.prepare("INSERT OR IGNORE INTO config (cle, valeur) VALUES ('vapid', ?)").bind(JSON.stringify(cles)).run();
    v = await lire();
  }
  return JSON.parse(v);
}
async function jetonVapid(env, cles, endpoint) {
  const entete = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const charge = b64url(new TextEncoder().encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant() / 1000) + 12 * 3600, sub: env.VAPID_SUJET || "https://wrd.play2f1.com" })));
  const cle = await crypto.subtle.importKey("jwk", cles.prive, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, new TextEncoder().encode(`${entete}.${charge}`));
  return `${entete}.${charge}.${b64url(signature)}`;
}
// Enregistre la notification puis réveille les appareils du joueur ; le service worker vient lire le texte
async function envoyerPush(env, userId, { titre, texte, url = "./" }) {
  await env.DB.prepare("INSERT INTO notifs (user_id, titre, texte, url, cree_le) VALUES (?, ?, ?, ?, ?)").bind(userId, titre.slice(0, 80), texte.slice(0, 200), url, maintenant()).run();
  const { results } = await env.DB.prepare("SELECT endpoint FROM abonnements WHERE user_id = ?").bind(userId).all();
  if (!results.length) return;
  const cles = await clesVapid(env);
  for (const { endpoint } of results) {
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "normal", "Content-Length": "0", Authorization: `vapid t=${await jetonVapid(env, cles, endpoint)}, k=${cles.pub}` } });
      if (r.status === 404 || r.status === 410) await env.DB.prepare("DELETE FROM abonnements WHERE endpoint = ?").bind(endpoint).run();
    } catch (e) { console.error("push", e); }
  }
}
route("GET", "push/cle", async ({ env }) => json({ cle: (await clesVapid(env)).pub }));
route("POST", "push/abonner", async ({ request, env, user }) => {
  const b = await corps(request);
  const endpoint = String(b.abonnement?.endpoint || "");
  let hote;
  try { const u = new URL(endpoint); if (u.protocol !== "https:") throw 0; hote = u.hostname; } catch { return erreur("Abonnement invalide."); }
  if (!HOTES_PUSH.test(hote) || endpoint.length > 1000) return erreur("Service de notification non reconnu.");
  await env.DB.prepare("INSERT INTO abonnements (endpoint, user_id, cree_le) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id").bind(endpoint, user.id, maintenant()).run();
  return json({ ok: true });
}, { connecte: true });
route("DELETE", "push/abonner", async ({ request, env, user }) => {
  const b = await corps(request);
  await env.DB.prepare("DELETE FROM abonnements WHERE endpoint = ? AND user_id = ?").bind(String(b.endpoint || ""), user.id).run();
  return json({ ok: true });
}, { connecte: true });
route("POST", "push/rappel", async ({ request, env, user }) => {
  const b = await corps(request);
  const quand = Math.max(maintenant() + 60000, Math.min(maintenant() + 13 * 3600e3, Number(b.quand) || 0));
  await env.DB.prepare("INSERT INTO rappels (user_id, quand) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET quand = excluded.quand").bind(user.id, quand).run();
  return json({ ok: true });
}, { connecte: true });
route("GET", "notifs/derniere", async ({ env, user }) => {
  if (!user) return json({ notif: null });
  const n = await env.DB.prepare("SELECT titre, texte, url FROM notifs WHERE user_id = ? AND cree_le > ? ORDER BY id DESC LIMIT 1").bind(user.id, maintenant() - 3600e3).first();
  return json({ notif: n || null });
});
// Tâche planifiée (cron du Worker) : rappels de booster gratuit et ménage
export async function planifie(env) {
  await preparerSchema(env);
  const { results } = await env.DB.prepare("SELECT r.user_id FROM rappels r WHERE r.quand <= ? AND EXISTS (SELECT 1 FROM abonnements a WHERE a.user_id = r.user_id) LIMIT 300").bind(maintenant()).all();
  for (const { user_id } of results) {
    await env.DB.prepare("DELETE FROM rappels WHERE user_id = ?").bind(user_id).run();
    await envoyerPush(env, user_id, { titre: "🎁 Booster gratuit prêt !", texte: "Votre booster gratuit vous attend dans WorldCards.", url: "./#boosters" });
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rappels WHERE quand <= ?").bind(maintenant()),
    env.DB.prepare("DELETE FROM notifs WHERE cree_le < ?").bind(maintenant() - 30 * JOUR),
    env.DB.prepare("DELETE FROM sessions WHERE expire < ?").bind(maintenant()),
    env.DB.prepare("DELETE FROM combats WHERE cree_le < ?").bind(maintenant() - 7 * JOUR),
  ]);
}
async function prevenirAdmins(env, notif) {
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE admin = 1").all();
  for (const { id } of results) await envoyerPush(env, id, notif);
}

/* =====================================================================
   Premium : demande après paiement PayPal, activation par l'administrateur
   ===================================================================== */
route("POST", "premium/demande", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const formule = ["mois", "an", "vie"].includes(b.formule) ? b.formule : "mois";
  const attente = await env.DB.prepare("SELECT COUNT(*) AS n FROM demandes_premium WHERE user_id = ? AND traitee = 0").bind(user.id).first();
  if (attente.n >= 3) return erreur("Vous avez déjà des demandes en attente : l'administrateur va les traiter.", 429);
  await env.DB.prepare("INSERT INTO demandes_premium (user_id, formule, note, cree_le) VALUES (?, ?, ?, ?)").bind(user.id, formule, String(b.note || "").trim().slice(0, 120), maintenant()).run();
  enArrierePlan(ctx, prevenirAdmins(env, { titre: "💎 Nouvelle demande Premium", texte: `${user.pseudo} : ${{ mois: "1 mois (3,99 €)", an: "1 an (29,99 €)", vie: "à vie (89 €)" }[formule]}`, url: "./#compte" }));
  return json({ ok: true }, 201);
}, { connecte: true });
route("GET", "admin/premium", async ({ env }) => {
  const [d, p] = await env.DB.batch([
    env.DB.prepare(`SELECT d.id, d.formule, d.note, d.cree_le, u.pseudo FROM demandes_premium d JOIN users u ON u.id = d.user_id WHERE d.traitee = 0 ORDER BY d.id`),
    env.DB.prepare("SELECT pseudo, premium_jusqu FROM users WHERE premium_jusqu > ? ORDER BY premium_jusqu DESC LIMIT 200").bind(maintenant()),
  ]);
  return json({ demandes: d.results, premiums: p.results });
}, { admin: true });
route("POST", "admin/premium", async ({ request, env, ctx }) => {
  const b = await corps(request);
  const u = await env.DB.prepare("SELECT id, premium_jusqu FROM users WHERE pseudo = ?").bind(String(b.pseudo || "").trim()).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const formule = ["mois", "an", "vie", "retirer"].includes(b.formule) ? b.formule : "mois";
  const jusqu = formule === "retirer" ? 0 : formule === "vie" ? PREMIUM_VIE : Math.max(maintenant(), u.premium_jusqu || 0) + (formule === "an" ? 365 : 31) * JOUR;
  const requetes = [env.DB.prepare("UPDATE users SET premium_jusqu = ? WHERE id = ?").bind(jusqu, u.id)];
  if (b.demande) requetes.push(env.DB.prepare("UPDATE demandes_premium SET traitee = 1 WHERE id = ? AND user_id = ?").bind(Number(b.demande), u.id));
  else if (formule !== "retirer") requetes.push(env.DB.prepare("UPDATE demandes_premium SET traitee = 1 WHERE user_id = ? AND traitee = 0").bind(u.id));
  await env.DB.batch(requetes);
  if (formule !== "retirer") enArrierePlan(ctx, envoyerPush(env, u.id, { titre: "💎 Premium activé !", texte: formule === "vie" ? "Vous êtes Premium à vie. Merci pour votre soutien !" : `Votre Premium est actif pour ${formule === "an" ? "un an" : "31 jours"}. Merci !`, url: "./#premium" }));
  return json({ ok: true, premiumJusqu: jusqu });
}, { admin: true });
route("DELETE", "admin/premium/demandes/(\\d+)", async ({ env, p }) => {
  await env.DB.prepare("UPDATE demandes_premium SET traitee = 2 WHERE id = ?").bind(p[1]).run();
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Arène en ligne : le serveur calcule les statistiques à partir de la sauvegarde
   du compte et rejoue chaque combat pour en vérifier le résultat
   ===================================================================== */
const CATALOGUE = (() => {
  const m = {};
  const ajouter = (id, x) => { if (!m[id]) m[id] = x; };
  for (const p of MONDE.PAYS_BRUTS) ajouter("pays:" + p[0], { type: "pays", rarete: "commun", nom: p[1] });
  for (const v of [...MONDE.VILLES_BRUTES, ...VILLES2.VILLES_EXTRA, ...VILLES3.VILLES_EXTRA2]) ajouter("ville:" + v[0], { type: "ville", rarete: "peu-commun", nom: v[1] });
  for (const x of CULTURE.CULTURE_BRUTS) ajouter("cult:" + x[0], { type: "culture", rarete: x[4], nom: x[1] });
  for (const x of [...NATURE.NATURE_BRUTS, ...NATURE2.NATURE_BRUTS2]) ajouter("nat:" + x[0], { type: "nature", rarete: x[6], nom: x[1] });
  for (const x of [...ANIMAUX.ANIMAUX_BRUTS, ...ANIMAUX2.ANIMAUX_BRUTS2]) ajouter("ani:" + x[0], { type: "animal", rarete: x[4], nom: x[1] });
  for (const x of [...PLATS.PLATS_BRUTS, ...PLATS2.PLATS_BRUTS2]) ajouter("plat:" + x[0], { type: "plat", rarete: x[4], nom: x[1] });
  for (const x of [...MONDE.MONUMENTS_BRUTS, ...MONUMENTS2.MONUMENTS_EXTRA, ...MONUMENTS3.MONUMENTS_EXTRA2, ...MONUMENTS4.MONUMENTS_EXTRA3]) ajouter("monu:" + x[0], { type: "monument", rarete: x[6], nom: x[1] });
  for (const x of MONDE.MERVEILLES_BRUTES) ajouter("merv:" + x[0], { type: "merveille", rarete: "legendaire", nom: x[1] });
  for (const x of MONDE.SECRETES_MONDE) ajouter("secret:" + x[0], { type: "secrete", rarete: "secrete", nom: x[1] });
  return m;
})();
const jourUTC = () => new Date().toISOString().slice(0, 10);
const limiteArene = (u) => (estPremium(u) ? 20 : 10);
async function ligneArene(env, userId) {
  await env.DB.prepare("INSERT OR IGNORE INTO arene (user_id, maj) VALUES (?, ?)").bind(userId, maintenant()).run();
  return env.DB.prepare("SELECT * FROM arene WHERE user_id = ?").bind(userId).first();
}
const combatsFaits = (a) => (a.jour === jourUTC() ? a.nb : 0);
async function construireDeck(env, userId, ids) {
  if (!Array.isArray(ids) || ids.length !== COMBAT.TAILLE_DECK || new Set(ids).size !== ids.length) throw new ErreurApi("Le deck doit contenir 3 cartes différentes.");
  const s = await env.DB.prepare("SELECT data FROM sauvegardes WHERE user_id = ?").bind(userId).first();
  const save = s ? JSON.parse(s.data).sauvegarde || {} : {};
  let cout = 0;
  const unites = ids.map((id) => {
    const c = CATALOGUE[id];
    if (!c || !((save.owned || {})[id] > 0)) throw new ErreurApi("Une carte du deck ne fait pas partie de votre collection (sauvegarde du compte).");
    cout += COMBAT.COUT[c.rarete];
    const st = COMBAT.stats(id, c.type, c.rarete, (save.qualite || {})[id], Math.min(16, save.owned[id]), !!(save.shiny || {})[id]);
    return { id, type: c.type, nom: c.nom, shiny: !!(save.shiny || {})[id], atk: st.atk, def: st.def, pv: st.pv, niveau: st.niveau, talent: st.talent };
  });
  if (cout > COMBAT.BUDGET) throw new ErreurApi(`Deck trop coûteux (${cout}/${COMBAT.BUDGET}).`);
  return unites;
}
const puissanceDeck = (d) => d.reduce((t, u) => t + COMBAT.puissance(u), 0);

route("GET", "arene/moi", async ({ env, user }) => {
  const a = await ligneArene(env, user.id);
  const rang = await env.DB.prepare("SELECT COUNT(*) + 1 AS r FROM arene WHERE deck IS NOT NULL AND trophees > ?").bind(a.trophees).first();
  return json({ trophees: a.trophees, victoires: a.victoires, defaites: a.defaites, deck: !!a.deck, rang: a.deck ? rang.r : null,
    limite: limiteArene(user), restants: Math.max(0, limiteArene(user) - combatsFaits(a)) });
}, { connecte: true });
route("PUT", "arene/deck", async ({ request, env, user }) => {
  const b = await corps(request);
  const deck = await construireDeck(env, user.id, b.deck);
  await ligneArene(env, user.id);
  await env.DB.prepare("UPDATE arene SET deck = ?, puissance = ?, maj = ? WHERE user_id = ?").bind(JSON.stringify(deck), puissanceDeck(deck), maintenant(), user.id).run();
  return json({ ok: true, puissance: puissanceDeck(deck) });
}, { connecte: true });
route("GET", "arene/adversaires", async ({ env, user }) => {
  const a = await ligneArene(env, user.id);
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.premium_jusqu, a.trophees, a.puissance, a.deck FROM arene a JOIN users u ON u.id = a.user_id
    WHERE a.user_id != ? AND a.deck IS NOT NULL AND u.banni = 0 ORDER BY ABS(a.trophees - ?) LIMIT 12`).bind(user.id, a.trophees).all();
  const choix = results.sort(() => Math.random() - 0.5).slice(0, 4).sort((x, y) => y.trophees - x.trophees);
  return json({ adversaires: choix.map((x) => ({ pseudo: x.pseudo, premium: estPremium(x), trophees: x.trophees, puissance: x.puissance, cartes: JSON.parse(x.deck).map((u) => u.id) })) });
}, { connecte: true });
route("POST", "arene/defi", async ({ request, env, user }) => {
  const b = await corps(request);
  const a = await ligneArene(env, user.id);
  if (!a.deck) return erreur("Enregistrez d'abord votre deck.");
  if (combatsFaits(a) >= limiteArene(user)) return erreur(`Vous avez fait vos ${limiteArene(user)} combats d'arène du jour. Revenez demain !`, 429);
  const adv = await env.DB.prepare("SELECT u.id, u.pseudo, a.deck FROM users u JOIN arene a ON a.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0 AND a.deck IS NOT NULL").bind(String(b.pseudo || "")).first();
  if (!adv || adv.id === user.id) return erreur("Adversaire introuvable.", 404);
  const graine = crypto.getRandomValues(new Uint32Array(1))[0];
  const r = await env.DB.batch([
    env.DB.prepare("INSERT INTO combats (attaquant, defenseur, graine, a, b, cree_le) VALUES (?, ?, ?, ?, ?, ?)").bind(user.id, adv.id, graine, a.deck, adv.deck, maintenant()),
    env.DB.prepare("UPDATE arene SET nb = CASE WHEN jour = ? THEN nb + 1 ELSE 1 END, jour = ? WHERE user_id = ?").bind(jourUTC(), jourUTC(), user.id),
  ]);
  return json({ combat: r[0].meta.last_row_id, graine, adversaire: adv.pseudo, moi: JSON.parse(a.deck), lui: JSON.parse(adv.deck) });
}, { connecte: true });
route("POST", "arene/fin", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const c = await env.DB.prepare("SELECT * FROM combats WHERE id = ? AND attaquant = ? AND fini = 0").bind(Number(b.combat) || 0, user.id).first();
  if (!c) return erreur("Combat introuvable ou déjà terminé.", 404);
  const actions = (Array.isArray(b.actions) ? b.actions : []).slice(0, COMBAT.TOURS_MAX).map(String);
  const etat = COMBAT.rejouer(JSON.parse(c.a), JSON.parse(c.b), c.graine, actions);
  const gagne = etat.gagnant === 0;
  const moi = await ligneArene(env, user.id), lui = await ligneArene(env, c.defenseur);
  // Classement façon Elo : battre plus fort que soi rapporte davantage
  const attendu = 1 / (1 + 10 ** ((lui.trophees - moi.trophees) / 400));
  const delta = Math.round(32 * ((gagne ? 1 : 0) - attendu));
  const deltaDef = -Math.round(delta / 2);
  const pieces = gagne ? 60 : 15;
  await env.DB.batch([
    env.DB.prepare("UPDATE combats SET fini = 1, gagne = ? WHERE id = ?").bind(gagne ? 1 : 0, c.id),
    env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?), victoires = victoires + ?, defaites = defaites + ? WHERE user_id = ?").bind(delta, gagne ? 1 : 0, gagne ? 0 : 1, user.id),
    env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?) WHERE user_id = ?").bind(deltaDef, c.defenseur),
  ]);
  enArrierePlan(ctx, envoyerPush(env, c.defenseur, gagne
    ? { titre: "⚔️ Votre deck a été battu", texte: `${user.pseudo} a vaincu votre défense (${deltaDef} 🏆). Prenez votre revanche !`, url: "./#combat" }
    : { titre: "🛡️ Défense réussie !", texte: `Votre deck a repoussé ${user.pseudo} (+${deltaDef} 🏆).`, url: "./#combat" }));
  return json({ gagne, delta, trophees: Math.max(0, moi.trophees + delta), pieces });
}, { connecte: true });
route("GET", "arene/classement", async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu, a.trophees, a.victoires, a.defaites FROM arene a JOIN users u ON u.id = a.user_id
    WHERE a.deck IS NOT NULL AND u.banni = 0 ORDER BY a.trophees DESC, a.victoires DESC LIMIT 50`).all();
  return json({ joueurs: results.map((x) => ({ pseudo: x.pseudo, admin: !!x.admin, premium: estPremium(x), trophees: x.trophees, victoires: x.victoires, defaites: x.defaites })) });
});

/* =====================================================================
   Point d'entrée
   ===================================================================== */
export async function onRequest(context) {
  const { request, env, ctx } = context;
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
    return await r.gestion({ request, env, ctx, user, p: chemin.match(r.motif) });
  } catch (e) {
    if (e instanceof ErreurApi) return erreur(e.message, e.status);
    console.error(e);
    return erreur("Erreur du serveur. Réessayez dans un instant.", 500);
  }
}
