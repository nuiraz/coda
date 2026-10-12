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
import EXTENSIONS from "../../worldcards/data/extensions.js";
import PAYS_AF from "../../worldcards/data/pays-af.js";
import PAYS_EUAS from "../../worldcards/data/pays-euas.js";
import PAYS_AMOC from "../../worldcards/data/pays-amoc.js";
import PAYS_MOYENS from "../../worldcards/data/pays-moyens.js";
import PAYS_PLUS from "../../worldcards/data/pays-plus.js";
import EVENEMENTS_DATA from "../../worldcards/data/evenements.js";

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
  `CREATE TABLE IF NOT EXISTS presence ( cle TEXT PRIMARY KEY, user_id INTEGER, pseudo TEXT, vu INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS metriques ( jour TEXT NOT NULL, cle TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, cle) )`,
  `CREATE TABLE IF NOT EXISTS securite_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, type TEXT NOT NULL, details TEXT NOT NULL, niveau TEXT NOT NULL DEFAULT 'avertissement', cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS feedback ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, pseudo TEXT NOT NULL, type TEXT NOT NULL, titre TEXT NOT NULL, texte TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouveau', reponse TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS echanges ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, pseudo TEXT NOT NULL, carte_offerte TEXT NOT NULL, nom_offerte TEXT, carte_demandee TEXT NOT NULL, nom_demandee TEXT, pieces_demandees INTEGER NOT NULL DEFAULT 0, doree INTEGER NOT NULL DEFAULT 0, statut TEXT NOT NULL DEFAULT 'ouvert', preneur_id INTEGER, preneur_pseudo TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS livraisons ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, carte TEXT, doree INTEGER NOT NULL DEFAULT 0, pieces INTEGER NOT NULL DEFAULT 0, message TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS tournoi_scores ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, pseudo TEXT NOT NULL, semaine TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, victoires INTEGER NOT NULL DEFAULT 0, jour TEXT, nb_jour INTEGER NOT NULL DEFAULT 0, maj INTEGER NOT NULL, PRIMARY KEY (user_id, semaine) )`,
  `CREATE TABLE IF NOT EXISTS hebdo ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, semaine TEXT NOT NULL, cartes_debut INTEGER NOT NULL, cartes INTEGER NOT NULL, PRIMARY KEY (user_id, semaine) )`,
  `CREATE TABLE IF NOT EXISTS amis ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ami_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, ami_id) )`,
  `CREATE TABLE IF NOT EXISTS paiements ( commande TEXT PRIMARY KEY, user_id INTEGER NOT NULL, formule TEXT NOT NULL, montant TEXT NOT NULL, statut TEXT NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS photos ( carte TEXT PRIMARY KEY, titre TEXT NOT NULL, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS chat ( id INTEGER PRIMARY KEY AUTOINCREMENT, salon TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, texte TEXT NOT NULL, carte TEXT, reponse INTEGER, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS chat_salon ON chat (salon, id)`,
  `CREATE TABLE IF NOT EXISTS mp ( id INTEGER PRIMARY KEY AUTOINCREMENT, de_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, texte TEXT NOT NULL, carte TEXT, lu INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS mp_a ON mp (a_id, lu)`,
  `CREATE INDEX IF NOT EXISTS mp_paire ON mp (de_id, a_id, id)`,
  `CREATE TABLE IF NOT EXISTS avatars ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, image TEXT NOT NULL, maj INTEGER NOT NULL, signale INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS duels ( id INTEGER PRIMARY KEY AUTOINCREMENT, a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, statut TEXT NOT NULL DEFAULT 'invite', graine INTEGER NOT NULL, deck_a TEXT NOT NULL, deck_b TEXT, paires TEXT NOT NULL DEFAULT '[]', choix_a TEXT, choix_b TEXT, limite INTEGER, gagnant INTEGER, cree_le INTEGER NOT NULL, fini_le INTEGER )`,
  `CREATE INDEX IF NOT EXISTS duels_b ON duels (b_id, statut)`,
  `CREATE TABLE IF NOT EXISTS signal_chat ( message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, cible_id INTEGER NOT NULL, texte TEXT, cree_le INTEGER NOT NULL, traite INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (message_id, user_id) )`,
  `CREATE TABLE IF NOT EXISTS moderation ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, details TEXT, par TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS moderation_user ON moderation (user_id, id)`,
  `CREATE TABLE IF NOT EXISTS guildes ( id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL UNIQUE COLLATE NOCASE, tag TEXT NOT NULL, embleme TEXT NOT NULL DEFAULT '🛡️', description TEXT NOT NULL DEFAULT '', ouverte INTEGER NOT NULL DEFAULT 1, chef_id INTEGER NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS guilde_membres ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, guilde_id INTEGER NOT NULL REFERENCES guildes(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'membre', rejoint_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS guilde_membres_g ON guilde_membres (guilde_id)`,
  `CREATE TABLE IF NOT EXISTS guilde_recompenses ( user_id INTEGER NOT NULL, semaine TEXT NOT NULL, PRIMARY KEY (user_id, semaine) )`,
  `CREATE TABLE IF NOT EXISTS passes ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, mois TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, mois) )`,
  `CREATE TABLE IF NOT EXISTS encheres ( id INTEGER PRIMARY KEY AUTOINCREMENT, vendeur_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, vendeur TEXT NOT NULL, carte TEXT NOT NULL, nom TEXT NOT NULL, doree INTEGER NOT NULL DEFAULT 0, prix_depart INTEGER NOT NULL, offre INTEGER, acheteur_id INTEGER, acheteur TEXT, nb_offres INTEGER NOT NULL DEFAULT 0, fin INTEGER NOT NULL, statut TEXT NOT NULL DEFAULT 'ouverte', cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS encheres_statut ON encheres (statut, fin)`,
  `CREATE TABLE IF NOT EXISTS bloques ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, bloque_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (user_id, bloque_id) )`,
  `CREATE TABLE IF NOT EXISTS combats ( id INTEGER PRIMARY KEY AUTOINCREMENT, attaquant INTEGER NOT NULL, defenseur INTEGER NOT NULL, graine INTEGER NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, cree_le INTEGER NOT NULL, fini INTEGER NOT NULL DEFAULT 0, gagne INTEGER )`,
];
// Colonnes ajoutées après coup aux tables existantes (l'erreur « colonne déjà présente » est ignorée)
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN premium_jusqu INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN temps_jeu INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN reset_le INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN muet_jusqu INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN titre TEXT`,
  `ALTER TABLE users ADD COLUMN cadre TEXT`,
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
const profilPublic = (u) => ({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, premiumJusqu: u.premium_jusqu || 0, tempsJeu: u.temps_jeu || 0 });
// Semaine courante (lundi), en temps universel : clé des classements hebdomadaires
function semaineCourante(decalage = 0) {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * decalage);
  return d.toISOString().slice(0, 10);
}
const PREMIUM_VIE = 4102444800000;
const estPremium = (u) => (u?.premium_jusqu || 0) > maintenant();

/* ---------- Validation ---------- */
const PSEUDO_RE = /^[A-Za-z0-9_-]{3,20}$/;
const CARTE_RE = /^[a-z]+:[A-Za-z0-9-]{1,40}$/;
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
    "DELETE FROM arene WHERE user_id = ?", "DELETE FROM demandes_premium WHERE user_id = ?",
    "DELETE FROM livraisons WHERE user_id = ?", "DELETE FROM echanges WHERE user_id = ?", "DELETE FROM tournoi_scores WHERE user_id = ?",
    "DELETE FROM hebdo WHERE user_id = ?", "DELETE FROM presence WHERE user_id = ?",
    "DELETE FROM amis WHERE user_id = ?", "DELETE FROM amis WHERE ami_id = ?", "DELETE FROM users WHERE id = ?",
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
  return json(s ? { data: JSON.parse(s.data), maj: s.maj, reset: user.reset_le || 0 } : { data: null, reset: user.reset_le || 0 });
}, { connecte: true });

route("PUT", "sauvegarde", async ({ request, env, user }) => {
  const texte = await request.text();
  if (texte.length > TAILLE_MAX_SAUVEGARDE) return erreur("Sauvegarde trop lourde : retirez quelques illustrations personnelles.", 413);
  let b; try { b = JSON.parse(texte); } catch { return erreur("Sauvegarde illisible."); }
  if (!b.data || typeof b.data !== "object") return erreur("Sauvegarde vide.");
  // Compte réinitialisé par l'admin : on refuse toute ancienne sauvegarde (appareil resté sur l'ancienne progression)
  if (user.reset_le && (Number(b.reset) || 0) < user.reset_le) return json({ erreur: "Votre compte a été réinitialisé par l'administrateur.", reinitialise: user.reset_le }, 409);
  const n = (x) => Math.max(0, Math.min(100000, Math.floor(Number(x) || 0)));
  const vitrine = (Array.isArray(b.vitrine) ? b.vitrine : []).filter((id) => typeof id === "string" && CARTE_RE.test(id)).slice(0, 5);
  await env.DB.prepare(`INSERT INTO sauvegardes (user_id, data, maj, cartes, secretes, badges, vitrine) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, maj = excluded.maj, cartes = excluded.cartes,
    secretes = excluded.secretes, badges = excluded.badges, vitrine = excluded.vitrine`)
    .bind(user.id, JSON.stringify(b.data), maintenant(), n(b.resume?.cartes), n(b.resume?.secretes), n(b.resume?.badges), JSON.stringify(vitrine)).run();
  // Classement de la semaine : nombre de cartes au début de la semaine, et maintenant
  await env.DB.prepare(`INSERT INTO hebdo (user_id, semaine, cartes_debut, cartes) VALUES (?1, ?2, ?3, ?3)
    ON CONFLICT(user_id, semaine) DO UPDATE SET cartes = excluded.cartes`).bind(user.id, semaineCourante(), n(b.resume?.cartes)).run();
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
    WHERE u.banni = 0 AND u.admin = 0 ORDER BY s.${tri} DESC, s.maj ASC LIMIT 50`).bind(maintenant()).all();
  return json({ joueurs: r.results.map((x) => ({ ...x, admin: !!x.admin, premium: !!x.premium })) });
});

route("GET", "profil/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const u = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.cree_le, u.premium_jusqu, u.temps_jeu, u.derniere_co, s.cartes, s.secretes, s.badges, s.vitrine,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS messages, (SELECT trophees FROM arene WHERE user_id = u.id) AS trophees
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0`).bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  return json({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, cartes: u.cartes || 0, secretes: u.secretes || 0, badges: u.badges || 0, messages: u.messages, trophees: u.trophees || 0, premium: estPremium(u), tempsJeu: u.temps_jeu || 0, derniereCo: u.derniere_co, vitrine: JSON.parse(u.vitrine || "[]") });
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
  await journaliser(env, Number(p[1]), b.banni ? "banni" : "réactivé", b.motif, "admin");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET banni = ? WHERE id = ?").bind(b.banni ? 1 : 0, p[1]),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(p[1]),
  ]);
  return json({ ok: true });
}, { admin: true });

// Réinitialisation complète de la progression d'un joueur (tricherie…) : il faut retaper son pseudo pour confirmer
route("POST", "admin/utilisateurs/(\\d+)/reinitialiser", async ({ request, env, user, p, ctx }) => {
  const b = await corps(request);
  const cible = await env.DB.prepare("SELECT id, pseudo, admin FROM users WHERE id = ?").bind(p[1]).first();
  if (!cible) return erreur("Joueur introuvable.", 404);
  if (cible.admin) return erreur("Impossible de réinitialiser un administrateur.", 403);
  if (String(b.confirmation || "").trim().toLowerCase() !== cible.pseudo.toLowerCase()) return erreur("Confirmation incorrecte : retapez exactement le pseudo du joueur.");
  const id = cible.id, t = maintenant();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sauvegardes WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM arene WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM tournoi_scores WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM hebdo WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM livraisons WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM echanges WHERE user_id = ? AND statut = 'ouvert'").bind(id),
    env.DB.prepare("DELETE FROM cadeaux WHERE user_id = ?").bind(id),
    env.DB.prepare("UPDATE users SET reset_le = ?, temps_jeu = 0 WHERE id = ?").bind(t, id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
    env.DB.prepare("INSERT INTO securite_logs (ip, type, details, niveau, cree_le) VALUES ('admin', 'reinitialisation', ?, 'info', ?)").bind(`${user.pseudo} a réinitialisé le compte de ${cible.pseudo}${b.motif ? " : " + String(b.motif).slice(0, 200) : ""}`, t),
  ]);
  await journaliser(env, id, "compte réinitialisé", b.motif, user.pseudo);
  enArrierePlan(ctx, envoyerPush(env, id, { titre: "⚠️ Compte réinitialisé", texte: "Votre progression a été remise à zéro par l'administrateur (non-respect des règles).", url: "./" }));
  return json({ ok: true, pseudo: cible.pseudo });
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
  await cloturerEncheres(env);
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
    env.DB.prepare("DELETE FROM presence WHERE vu < ?").bind(maintenant() - JOUR),
    env.DB.prepare("DELETE FROM securite_logs WHERE cree_le < ?").bind(maintenant() - 30 * JOUR),
    env.DB.prepare("DELETE FROM metriques WHERE jour < ?").bind(new Date(maintenant() - 60 * JOUR).toISOString().slice(0, 10)),
  ]);
  await recompenserTournoi(env);
  await finDeSaison(env);
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
  const formule = ["mois", "an", "vie", "passe"].includes(b.formule) ? b.formule : "mois";
  const attente = await env.DB.prepare("SELECT COUNT(*) AS n FROM demandes_premium WHERE user_id = ? AND traitee = 0").bind(user.id).first();
  if (attente.n >= 3) return erreur("Vous avez déjà des demandes en attente : l'administrateur va les traiter.", 429);
  await env.DB.prepare("INSERT INTO demandes_premium (user_id, formule, note, cree_le) VALUES (?, ?, ?, ?)").bind(user.id, formule, String(b.note || "").trim().slice(0, 120), maintenant()).run();
  enArrierePlan(ctx, prevenirAdmins(env, { titre: "💎 Nouvelle demande Premium", texte: `${user.pseudo} : ${{ mois: "1 mois (3,99 €)", an: "1 an (29,99 €)", vie: "à vie (89 €)", passe: `Passe de saison ${moisCourant()} (7,99 €)` }[formule]}`, url: "./#compte" }));
  return json({ ok: true }, 201);
}, { connecte: true });
route("GET", "admin/premium", async ({ env }) => {
  const [d, p] = await env.DB.batch([
    env.DB.prepare(`SELECT d.id, d.formule, d.note, d.cree_le, u.pseudo FROM demandes_premium d JOIN users u ON u.id = d.user_id WHERE d.traitee = 0 ORDER BY d.id`),
    env.DB.prepare("SELECT pseudo, premium_jusqu FROM users WHERE premium_jusqu > ? ORDER BY premium_jusqu DESC LIMIT 200").bind(maintenant()),
  ]);
  return json({ demandes: d.results, premiums: p.results });
}, { admin: true });
// Passe de saison du mois en cours (7,99 €)
const moisCourant = () => new Date().toISOString().slice(0, 7);
async function activerPasse(env, ctx, userId) {
  await env.DB.prepare("INSERT OR IGNORE INTO passes (user_id, mois, cree_le) VALUES (?, ?, ?)").bind(userId, moisCourant(), maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, userId, { titre: "🎟️ Passe de saison activé !", texte: "La piste Premium du passe est débloquée pour ce mois. Bon jeu !", url: "./#passe" }));
}
route("GET", "passe/moi", async ({ env, user }) => {
  const p = await env.DB.prepare("SELECT 1 FROM passes WHERE user_id = ? AND mois = ?").bind(user.id, moisCourant()).first();
  return json({ mois: moisCourant(), actif: !!p });
}, { connecte: true });
async function activerPremium(env, ctx, userId, formule, demande) {
  if (formule === "passe") { await activerPasse(env, ctx, userId); return null; }
  const u = await env.DB.prepare("SELECT id, premium_jusqu FROM users WHERE id = ?").bind(userId).first();
  const jusqu = formule === "vie" ? PREMIUM_VIE : Math.max(maintenant(), u.premium_jusqu || 0) + (formule === "an" ? 365 : 31) * JOUR;
  await env.DB.prepare("UPDATE users SET premium_jusqu = ? WHERE id = ?").bind(jusqu, userId).run();
  enArrierePlan(ctx, envoyerPush(env, userId, { titre: "💎 Premium activé !", texte: formule === "vie" ? "Vous êtes Premium à vie. Merci pour votre soutien !" : `Votre Premium est actif pour ${formule === "an" ? "un an" : "31 jours"}. Merci !`, url: "./#premium" }));
  return jusqu;
}
route("POST", "admin/premium", async ({ request, env, ctx }) => {
  const b = await corps(request);
  const u = await env.DB.prepare("SELECT id, premium_jusqu FROM users WHERE pseudo = ?").bind(String(b.pseudo || "").trim()).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const formule = ["mois", "an", "vie", "retirer", "passe"].includes(b.formule) ? b.formule : "mois";
  if (formule === "passe") {
    await activerPasse(env, ctx, u.id);
    if (b.demande) await env.DB.prepare("UPDATE demandes_premium SET traitee = 1 WHERE id = ? AND user_id = ?").bind(Number(b.demande), u.id).run();
    return json({ ok: true, passe: moisCourant() });
  }
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
  for (const x of EXTENSIONS.VILLES_NOUVELLES) ajouter("ville:" + x[0], { type: "ville", rarete: "peu-commun", nom: x[1] });
  for (const x of EXTENSIONS.MONUMENTS_NOUVEAUX) ajouter("monu:" + x[0], { type: "monument", rarete: x[6], nom: x[1] });
  for (const x of EXTENSIONS.NATURE_NOUVELLE) ajouter("nat:" + x[0], { type: "nature", rarete: x[6], nom: x[1] });
  for (const ev of [...Object.values(EXTENSIONS.EVENEMENTS_SAISONNIERS), ...Object.values(EVENEMENTS_DATA.EVENEMENTS_EXTRA)]) for (const x of ev.cartes || []) ajouter("event:" + x[0], { type: "monument", rarete: x[4], nom: x[1] });
  const prefixes = { ville: "ville:", monument: "monu:", nature: "nat:", animal: "ani:", plat: "plat:", culture: "cult:" };
  for (const liste of [PAYS_AF.CARTES_PAYS_AF, PAYS_EUAS.CARTES_PAYS_EUAS, PAYS_AMOC.CARTES_PAYS_AMOC, PAYS_MOYENS.CARTES_PAYS_MOYENS, PAYS_PLUS.CARTES_PAYS_PLUS])
    for (const x of liste) if (prefixes[x[0]]) ajouter(prefixes[x[0]] + x[1], { type: x[0], rarete: x[0] === "ville" ? "peu-commun" : x[7], nom: x[2] });
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
    const doree = !!(save.doree || {})[id];
    const st = COMBAT.stats(id, c.type, c.rarete, (save.qualite || {})[id], Math.min(16, save.owned[id]), !!(save.shiny || {})[id], doree);
    return { id, type: c.type, nom: c.nom, shiny: !!(save.shiny || {})[id], doree, atk: st.atk, def: st.def, pv: st.pv, niveau: st.niveau, talent: st.talent };
  });
  if (cout > COMBAT.BUDGET) throw new ErreurApi(`Deck trop coûteux (${cout}/${COMBAT.BUDGET}).`);
  return unites;
}
const puissanceDeck = (d) => d.reduce((t, u) => t + COMBAT.puissance(u), 0);

route("GET", "arene/moi", async ({ env, user }) => {
  const a = await ligneArene(env, user.id);
  const rang = await env.DB.prepare("SELECT COUNT(*) + 1 AS r FROM arene a JOIN users u ON u.id = a.user_id WHERE a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 AND a.trophees > ?").bind(a.trophees).first();
  return json({ trophees: a.trophees, palier: palierArene(a.trophees), saison: saisonCourante(), finSaison: finSaison(), victoires: a.victoires, defaites: a.defaites, deck: !!a.deck, rang: a.deck ? rang.r : null,
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
    WHERE a.user_id != ? AND a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 ORDER BY ABS(a.trophees - ?) LIMIT 12`).bind(user.id, a.trophees).all();
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
  await ajouterPointsTournoi(env, user, gagne ? 100 : 25, gagne, true);
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
    WHERE a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 ORDER BY a.trophees DESC, a.victoires DESC LIMIT 50`).all();
  return json({ saison: saisonCourante(), finSaison: finSaison(), joueurs: results.map((x) => ({ pseudo: x.pseudo, admin: !!x.admin, premium: estPremium(x), trophees: x.trophees, palier: palierArene(x.trophees), victoires: x.victoires, defaites: x.defaites })) });
});


/* =====================================================================
   Joueurs en ligne, temps de jeu, métriques et bouclier anti-bot
   ===================================================================== */
const EN_LIGNE_MS = 2 * 60000;
route("POST", "presence/ping", async ({ request, env, user }) => {
  let b = {}; try { b = await request.json(); } catch {}
  const visiteur = String(b.visiteur || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
  const cle = user ? "u" + user.id : visiteur ? "v" + visiteur : null;
  const requetes = [];
  if (cle) {
    const avant = user ? await env.DB.prepare("SELECT vu FROM presence WHERE cle = ?").bind(cle).first() : null;
    requetes.push(env.DB.prepare("INSERT INTO presence (cle, user_id, pseudo, vu) VALUES (?, ?, ?, ?) ON CONFLICT(cle) DO UPDATE SET vu = excluded.vu, user_id = excluded.user_id, pseudo = excluded.pseudo")
      .bind(cle, user?.id ?? null, user?.pseudo ?? null, maintenant()));
    // Temps de jeu : on compte le temps écoulé depuis le dernier signal (au plus 2 minutes)
    if (user && avant && maintenant() - avant.vu < EN_LIGNE_MS) requetes.push(env.DB.prepare("UPDATE users SET temps_jeu = temps_jeu + ? WHERE id = ?").bind(Math.round((maintenant() - avant.vu) / 1000), user.id));
  }
  if (requetes.length) await env.DB.batch(requetes);
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM presence WHERE vu > ?").bind(maintenant() - EN_LIGNE_MS).first();
  const alerte = user?.admin ? await lireConfig(env, "alerte") : null;
  const t = user ? await env.DB.prepare("SELECT temps_jeu FROM users WHERE id = ?").bind(user.id).first() : null;
  return json({ ok: true, actifs: Math.max(1, n.n), tempsJeu: t?.temps_jeu || 0, alerteSecurite: !!alerte, alerte });
});
route("GET", "presence/actifs", async ({ env }) => {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM presence WHERE vu > ?").bind(maintenant() - EN_LIGNE_MS).first();
  return json({ actifs: Math.max(1, n.n) });
});

async function lireConfig(env, cle) {
  const r = await env.DB.prepare("SELECT valeur FROM config WHERE cle = ?").bind(cle).first();
  try { return r ? JSON.parse(r.valeur) : null; } catch { return null; }
}
const ecrireConfig = (env, cle, valeur) => valeur === null
  ? env.DB.prepare("DELETE FROM config WHERE cle = ?").bind(cle).run()
  : env.DB.prepare("INSERT INTO config (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").bind(cle, JSON.stringify(valeur)).run();

// Requêtes par adresse IP (mémoire de l'instance du Worker) : détecte les rafales typiques des robots
const RAFALES = new Map();
const BLOQUEES = new Map(); // ip -> fin du blocage
let bouclierCache = { t: 0, actif: false };
async function bouclierActif(env) {
  if (maintenant() - bouclierCache.t > 30000) bouclierCache = { t: maintenant(), actif: !!(await lireConfig(env, "bouclier")) };
  return bouclierCache.actif;
}
async function signalerMenace(env, ip, type, details, niveau = "alerte") {
  const derniere = await lireConfig(env, "alerte");
  await env.DB.prepare("INSERT INTO securite_logs (ip, type, details, niveau, cree_le) VALUES (?, ?, ?, ?, ?)").bind(ip, type, details.slice(0, 300), niveau, maintenant()).run();
  await ecrireConfig(env, "alerte", { ip, message: details, type, date: maintenant() });
  // Une notification aux administrateurs au plus toutes les 15 minutes
  if (!derniere || maintenant() - (derniere.notifie || 0) > 15 * 60000) {
    await ecrireConfig(env, "alerte", { ip, message: details, type, date: maintenant(), notifie: maintenant() });
    await prevenirAdmins(env, { titre: "🚨 Alerte sécurité WorldCards", texte: details, url: "./#admin" });
  }
}
async function controleTrafic(request, env, ctx) {
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  const t = maintenant();
  if ((BLOQUEES.get(ip) || 0) > t) return erreur("Trop de requêtes : protection anti-robot activée. Réessayez dans quelques minutes.", 429);
  const liste = (RAFALES.get(ip) || []).filter((x) => t - x < 10000);
  liste.push(t); RAFALES.set(ip, liste);
  if (RAFALES.size > 5000) RAFALES.clear();
  const agent = (request.headers.get("user-agent") || "").toLowerCase();
  const robot = /sqlmap|nikto|masscan|nmap|zgrab|python-requests|curl\/|wget\/|scrapy|go-http-client/.test(agent);
  if (liste.length === 60 || (robot && liste.length === 1)) {
    const details = robot ? `Robot suspect (${agent.slice(0, 60)}) depuis ${ip}` : `Rafale de ${liste.length} requêtes en 10 s depuis ${ip}`;
    enArrierePlan(ctx, signalerMenace(env, ip, robot ? "robot" : "rafale", details));
  }
  if (liste.length > 60 && await bouclierActif(env)) { BLOQUEES.set(ip, t + 10 * 60000); return erreur("Trop de requêtes : protection anti-robot activée.", 429); }
  return null;
}
// Compteurs du jour (requêtes API, par statut)
function compterRequete(env, ctx, statut) {
  const jour = new Date().toISOString().slice(0, 10);
  enArrierePlan(ctx, env.DB.batch([
    env.DB.prepare("INSERT INTO metriques (jour, cle, n) VALUES (?, 'total', 1) ON CONFLICT(jour, cle) DO UPDATE SET n = n + 1").bind(jour),
    env.DB.prepare("INSERT INTO metriques (jour, cle, n) VALUES (?, ?, 1) ON CONFLICT(jour, cle) DO UPDATE SET n = n + 1").bind(jour, "s" + statut),
  ]));
}
route("GET", "admin/metrics", async ({ env }) => {
  const jour = new Date().toISOString().slice(0, 10), hier = new Date(maintenant() - JOUR).toISOString().slice(0, 10);
  const [m, h, a, u, p, c, e, f, sem] = await env.DB.batch([
    env.DB.prepare("SELECT cle, n FROM metriques WHERE jour = ?").bind(jour),
    env.DB.prepare("SELECT n FROM metriques WHERE jour = ? AND cle = 'total'").bind(hier),
    env.DB.prepare("SELECT COUNT(*) AS n FROM presence WHERE vu > ?").bind(maintenant() - EN_LIGNE_MS),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE premium_jusqu > ?").bind(maintenant()),
    env.DB.prepare("SELECT COUNT(*) AS n FROM combats WHERE cree_le > ?").bind(maintenant() - JOUR),
    env.DB.prepare("SELECT COUNT(*) AS n FROM echanges WHERE statut = 'ouvert'"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE statut = 'nouveau'"),
    env.DB.prepare("SELECT jour, n FROM metriques WHERE cle = 'total' ORDER BY jour DESC LIMIT 7"),
  ]);
  const parCle = Object.fromEntries(m.results.map((x) => [x.cle, x.n]));
  const statuts = Object.fromEntries(Object.entries(parCle).filter(([k]) => k.startsWith("s")).map(([k, n]) => [k.slice(1), n]));
  return json({ actifsDirect: a.results[0].n, totalUsers: u.results[0].n, premiums: p.results[0].n, totalCombats: c.results[0].n, totalEchanges: e.results[0].n, totalFeedbacks: f.results[0].n,
    requetesAujourdhui: parCle.total || 0, requetesHier: h.results[0]?.n || 0, semaine: sem.results.reverse(),
    metrics: { totalRequests: parCle.total || 0, requestsByStatus: statuts } });
}, { admin: true });
route("GET", "admin/securite", async ({ env }) => {
  const alerte = await lireConfig(env, "alerte");
  const { results } = await env.DB.prepare("SELECT * FROM securite_logs ORDER BY id DESC LIMIT 40").all();
  return json({ alerteActive: !!alerte, details: alerte, bouclierActif: !!(await lireConfig(env, "bouclier")), logs: results });
}, { admin: true });
route("POST", "admin/test-alerte", async ({ env }) => {
  await signalerMenace(env, "test", "simulation", "Test de l'alerte : ceci est une simulation déclenchée par l'administrateur.", "info");
  return json({ ok: true });
}, { admin: true });
route("POST", "admin/bouclier", async ({ env }) => {
  const actif = !(await lireConfig(env, "bouclier"));
  await ecrireConfig(env, "bouclier", actif ? true : null); bouclierCache.t = 0;
  return json({ ok: true, bouclierActif: actif });
}, { admin: true });
route("POST", "admin/reinitialiser-alerte", async ({ env }) => { await ecrireConfig(env, "alerte", null); return json({ ok: true }); }, { admin: true });

/* =====================================================================
   Bugs et suggestions
   ===================================================================== */
route("POST", "feedback", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const titre = String(b.titre || "").trim().slice(0, 100), texte = String(b.texte || b.message || "").trim().slice(0, 1000);
  if (!titre || !texte) return erreur("Indiquez un titre et une description.");
  const type = ["bug", "photo"].includes(b.type) ? b.type : "suggestion";
  if (user) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND cree_le > ?").bind(user.id, maintenant() - JOUR).first();
    if (r.n >= 10) return erreur("Vous avez déjà envoyé beaucoup de messages aujourd'hui. Merci !", 429);
  }
  await env.DB.prepare("INSERT INTO feedback (user_id, pseudo, type, titre, texte, cree_le) VALUES (?, ?, ?, ?, ?, ?)").bind(user?.id ?? null, user?.pseudo || "Visiteur", type, titre, texte, maintenant()).run();
  enArrierePlan(ctx, prevenirAdmins(env, { titre: type === "bug" ? "🐛 Nouveau bug signalé" : "💡 Nouvelle suggestion", texte: `${user?.pseudo || "Visiteur"} : ${titre}`, url: "./#admin" }));
  return json({ ok: true }, 201);
});
route("GET", "feedback/liste", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT * FROM feedback ORDER BY CASE statut WHEN 'nouveau' THEN 0 WHEN 'en_cours' THEN 1 ELSE 2 END, id DESC LIMIT 100").all();
  return json({ feedbacks: results });
}, { admin: true });
route("POST", "feedback/(\\d+)/statut", async ({ request, env, p, ctx }) => {
  const b = await corps(request);
  const statut = ["nouveau", "en_cours", "resolu", "rejete"].includes(b.statut) ? b.statut : "resolu";
  const reponse = b.reponse ? String(b.reponse).slice(0, 500) : null;
  await env.DB.prepare("UPDATE feedback SET statut = ?, reponse = COALESCE(?, reponse) WHERE id = ?").bind(statut, reponse, p[1]).run();
  const f = await env.DB.prepare("SELECT user_id, titre FROM feedback WHERE id = ?").bind(p[1]).first();
  if (f?.user_id && (statut === "resolu" || reponse)) enArrierePlan(ctx, envoyerPush(env, f.user_id, { titre: statut === "resolu" ? "✅ Votre retour a été traité" : "💬 Réponse de l'administrateur", texte: reponse || f.titre, url: "./" }));
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Échanges de cartes : la carte offerte est mise de côté par le serveur,
   puis livrée au joueur qui accepte (livraisons récupérées par le jeu)
   ===================================================================== */
async function saveDe(env, userId) {
  const s = await env.DB.prepare("SELECT data FROM sauvegardes WHERE user_id = ?").bind(userId).first();
  try { return s ? JSON.parse(s.data).sauvegarde || {} : {}; } catch { return {}; }
}
route("GET", "echanges", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT id, pseudo, carte_offerte, nom_offerte, carte_demandee, nom_demandee, pieces_demandees, doree, cree_le FROM echanges WHERE statut = 'ouvert' ORDER BY id DESC LIMIT 60").all();
  return json({ echanges: results });
});
route("POST", "echanges/creer", async ({ request, env, user }) => {
  const b = await corps(request);
  const offerte = String(b.carteOfferte || ""), demandee = String(b.carteDemandee || "");
  const pieces = Math.max(0, Math.min(100000, Math.floor(Number(b.piecesDemandees) || 0)));
  if (!CATALOGUE[offerte]) return erreur("Carte offerte inconnue.");
  if (demandee !== "pieces" && !CATALOGUE[demandee]) return erreur("Carte demandée inconnue.");
  if (demandee === "pieces" && pieces < 10) return erreur("Indiquez un nombre de pièces (10 au minimum).");
  const ouverts = await env.DB.prepare("SELECT COUNT(*) AS n FROM echanges WHERE user_id = ? AND statut = 'ouvert'").bind(user.id).first();
  if (ouverts.n >= 10) return erreur("Vous avez déjà 10 offres en cours : annulez-en une d'abord.", 429);
  const save = await saveDe(env, user.id);
  if (((save.owned || {})[offerte] || 0) - await enSequestre(env, user.id, offerte) < 1) return erreur("Cette carte n'est pas dans votre collection (sauvegarde du compte).");
  const doree = !!b.doree && !!(save.doree || {})[offerte];
  const r = await env.DB.prepare("INSERT INTO echanges (user_id, pseudo, carte_offerte, nom_offerte, carte_demandee, nom_demandee, pieces_demandees, doree, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.pseudo, offerte, CATALOGUE[offerte].nom, demandee, demandee === "pieces" ? `${pieces} pièces` : CATALOGUE[demandee].nom, demandee === "pieces" ? pieces : 0, doree ? 1 : 0, maintenant()).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("POST", "echanges/(\\d+)/accepter", async ({ env, user, p, ctx }) => {
  const e = await env.DB.prepare("SELECT * FROM echanges WHERE id = ? AND statut = 'ouvert'").bind(p[1]).first();
  if (!e) return erreur("Cette offre n'est plus disponible.", 404);
  if (e.user_id === user.id) return erreur("Vous ne pouvez pas accepter votre propre offre.");
  const save = await saveDe(env, user.id);
  if (e.carte_demandee !== "pieces" && !((save.owned || {})[e.carte_demandee] > 0)) return erreur(`Il vous faut la carte « ${e.nom_demandee} » (sauvegarde du compte).`);
  if (e.carte_demandee === "pieces" && (save.coins || 0) < e.pieces_demandees) return erreur("Vous n'avez pas assez de pièces.");
  // Verrou : une seule personne peut conclure l'échange
  const r = await env.DB.prepare("UPDATE echanges SET statut = 'conclu', preneur_id = ?, preneur_pseudo = ? WHERE id = ? AND statut = 'ouvert'").bind(user.id, user.pseudo, e.id).run();
  if (!r.meta.changes) return erreur("Quelqu'un vient de conclure cet échange.", 409);
  await env.DB.prepare("INSERT INTO livraisons (user_id, carte, pieces, message, cree_le) VALUES (?, ?, ?, ?, ?)")
    .bind(e.user_id, e.carte_demandee === "pieces" ? null : e.carte_demandee, e.carte_demandee === "pieces" ? e.pieces_demandees : 0, `Échange conclu avec ${user.pseudo}`, maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, e.user_id, { titre: "🤝 Échange conclu !", texte: `${user.pseudo} a accepté votre échange : vous recevez ${e.nom_demandee}.`, url: "./#hub" }));
  return json({ ok: true, message: `Échange conclu avec ${e.pseudo} : vous recevez ${e.nom_offerte} !`, recu: { id: e.carte_offerte, doree: !!e.doree }, donne: { id: e.carte_demandee === "pieces" ? null : e.carte_demandee, pieces: e.pieces_demandees } });
}, { connecte: true });
route("POST", "echanges/(\\d+)/annuler", async ({ env, user, p }) => {
  const e = await env.DB.prepare("SELECT * FROM echanges WHERE id = ? AND statut = 'ouvert'").bind(p[1]).first();
  if (!e) return erreur("Offre introuvable.", 404);
  if (e.user_id !== user.id && !user.admin) return erreur("Non autorisé.", 403);
  await env.DB.prepare("UPDATE echanges SET statut = 'annule' WHERE id = ?").bind(e.id).run();
  // La carte mise de côté revient à son propriétaire
  await env.DB.prepare("INSERT INTO livraisons (user_id, carte, doree, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(e.user_id, e.carte_offerte, e.doree, "Offre d'échange annulée : votre carte vous est rendue", maintenant()).run();
  return json({ ok: true });
}, { connecte: true });
route("GET", "livraisons", async ({ env, user }) => {
  const { results } = await env.DB.prepare("SELECT * FROM livraisons WHERE user_id = ? ORDER BY id").bind(user.id).all();
  if (results.length) await env.DB.prepare(`DELETE FROM livraisons WHERE user_id = ? AND id <= ?`).bind(user.id, results[results.length - 1].id).run();
  return json({ livraisons: results.map((l) => ({ carte: l.carte, doree: !!l.doree, pieces: l.pieces, message: l.message })) });
}, { connecte: true });

/* =====================================================================
   Tournoi de la semaine et classement hebdomadaire (remis à zéro chaque lundi)
   ===================================================================== */
const THEMES_TOURNOI = [
  { nom: "Grand Défi des Mégalopoles", regle: "Les combats d'arène rapportent 100 points, les autres 25.", emoji: "🏙️" },
  { nom: "Le Sacre des Merveilles", regle: "Chaque victoire compte : arène 100 points, autres combats 25.", emoji: "🌟" },
  { nom: "Fureur de la Nature", regle: "Arène 100 points par victoire, 25 par défaite ; Solo et combat rapide 25 points.", emoji: "🏔️" },
  { nom: "Festival des Cultures", regle: "Arène 100 points par victoire ; Solo et combat rapide 25 points (20 par jour).", emoji: "🎭" },
];
const RECOMPENSES_TOURNOI = [[2500, 3], [1200, 2], [600, 1], ...Array(7).fill([300, 1])];
async function ajouterPointsTournoi(env, user, points, victoire, arene) {
  const sem = semaineCourante(), jour = new Date().toISOString().slice(0, 10);
  const ligne = await env.DB.prepare("SELECT jour, nb_jour FROM tournoi_scores WHERE user_id = ? AND semaine = ?").bind(user.id, sem).first();
  const nbJour = ligne?.jour === jour ? ligne.nb_jour : 0;
  if (!arene && nbJour >= 20) return false;
  await env.DB.prepare(`INSERT INTO tournoi_scores (user_id, pseudo, semaine, score, victoires, jour, nb_jour, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, semaine) DO UPDATE SET score = score + excluded.score, victoires = victoires + excluded.victoires, pseudo = excluded.pseudo,
    nb_jour = CASE WHEN tournoi_scores.jour = excluded.jour THEN tournoi_scores.nb_jour + ? ELSE ? END, jour = excluded.jour, maj = excluded.maj`)
    .bind(user.id, user.pseudo, sem, points, victoire ? 1 : 0, jour, arene ? 0 : 1, maintenant(), arene ? 0 : 1, arene ? 0 : 1).run();
  return true;
}
route("GET", "tournois/actuel", async ({ env, user }) => {
  const sem = semaineCourante();
  const theme = THEMES_TOURNOI[Math.floor(new Date(sem).getTime() / (7 * JOUR)) % THEMES_TOURNOI.length];
  const { results } = await env.DB.prepare(`SELECT t.pseudo, t.score, t.victoires FROM tournoi_scores t JOIN users u ON u.id = t.user_id WHERE t.semaine = ? AND u.banni = 0 AND u.admin = 0 ORDER BY t.score DESC, t.victoires DESC LIMIT 50`).bind(sem).all();
  const moi = user ? await env.DB.prepare("SELECT score, victoires FROM tournoi_scores WHERE user_id = ? AND semaine = ?").bind(user.id, sem).first() : null;
  const fin = new Date(sem).getTime() + 7 * JOUR;
  return json({ semaine: sem, finLe: fin, theme, classement: results, monScore: moi || { score: 0, victoires: 0 }, recompenses: RECOMPENSES_TOURNOI.slice(0, 4) });
});
route("POST", "tournois/victoire", async ({ request, env, user }) => {
  let b = {}; try { b = await request.json(); } catch {}
  const ok = await ajouterPointsTournoi(env, user, b.gagne ? 25 : 5, !!b.gagne, false);
  const r = await env.DB.prepare("SELECT score, victoires FROM tournoi_scores WHERE user_id = ? AND semaine = ?").bind(user.id, semaineCourante()).first();
  return json({ ok, score: r?.score || 0, victoires: r?.victoires || 0 });
}, { connecte: true });
route("GET", "classement/semaine", async ({ env }) => {
  const sem = semaineCourante();
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu, h.cartes - h.cartes_debut AS cartes_gagnees, COALESCE(t.victoires, 0) AS victoires, COALESCE(t.score, 0) AS score
    FROM hebdo h JOIN users u ON u.id = h.user_id LEFT JOIN tournoi_scores t ON t.user_id = h.user_id AND t.semaine = h.semaine
    WHERE h.semaine = ? AND u.banni = 0 AND u.admin = 0 ORDER BY cartes_gagnees DESC, victoires DESC LIMIT 50`).bind(sem).all();
  return json({ semaine: sem, finLe: new Date(sem).getTime() + 7 * JOUR, joueurs: results.map((x) => ({ pseudo: x.pseudo, admin: !!x.admin, premium: estPremium(x), cartesGagnees: Math.max(0, x.cartes_gagnees), victoires: x.victoires, score: x.score })) });
});
// Le lundi, le cron récompense le top 10 du tournoi de la semaine précédente
async function recompenserTournoi(env) {
  const precedente = semaineCourante(1);
  if ((await lireConfig(env, "tournoi_paye")) === precedente) return;
  await ecrireConfig(env, "tournoi_paye", precedente);
  const { results } = await env.DB.prepare("SELECT t.user_id, t.score FROM tournoi_scores t JOIN users u ON u.id = t.user_id WHERE t.semaine = ? AND t.score > 0 AND u.banni = 0 AND u.admin = 0 ORDER BY t.score DESC, t.victoires DESC LIMIT 10").bind(precedente).all();
  for (const [i, x] of results.entries()) {
    const [pieces, boosters] = RECOMPENSES_TOURNOI[i];
    await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(x.user_id, pieces, boosters, `Tournoi de la semaine : ${i + 1}${i ? "e" : "er"} place !`, maintenant()).run();
    await envoyerPush(env, x.user_id, { titre: "🏆 Récompense du tournoi !", texte: `Vous terminez ${i + 1}${i ? "e" : "er"} du tournoi : ${pieces} 🪙 et ${boosters} booster${boosters > 1 ? "s" : ""} vous attendent.`, url: "./" });
  }
}

/* =====================================================================
   Événements saisonniers (activés par l'administrateur)
   ===================================================================== */
const EVENEMENTS = [...new Set([...Object.keys(EXTENSIONS.EVENEMENTS_SAISONNIERS), ...Object.keys(EVENEMENTS_DATA.EVENEMENTS_EXTRA)])];
const NOM_EVENEMENT = (cle) => EVENEMENTS_DATA.EVENEMENTS_EXTRA[cle]?.nom || EXTENSIONS.EVENEMENTS_SAISONNIERS[cle]?.nom || cle;
route("GET", "evenement", async ({ env }) => {
  const e = await lireConfig(env, "evenement");
  return json({ evenement: e && e.fin > maintenant() ? e : null });
});
route("POST", "admin/evenement", async ({ request, env, ctx }) => {
  const b = await corps(request);
  if (!b.cle) { await ecrireConfig(env, "evenement", null); return json({ ok: true, evenement: null }); }
  if (!EVENEMENTS.includes(b.cle)) return erreur("Événement inconnu.");
  const jours = Math.max(1, Math.min(60, Math.floor(Number(b.jours) || 7)));
  const ev = { cle: b.cle, debut: maintenant(), fin: maintenant() + jours * JOUR };
  await ecrireConfig(env, "evenement", ev);
  if (b.prevenir) enArrierePlan(ctx, (async () => {
    const { results } = await env.DB.prepare("SELECT DISTINCT user_id FROM abonnements LIMIT 1000").all();
    for (const { user_id } of results) await envoyerPush(env, user_id, { titre: `🎉 Événement : ${NOM_EVENEMENT(b.cle)} !`, texte: "Cartes exclusives à collectionner pendant une durée limitée.", url: "./#boosters" });
  })());
  return json({ ok: true, evenement: ev });
}, { admin: true });


/* =====================================================================
   Amis : ajouter, voir leur collection, les défier dans l'arène
   ===================================================================== */
route("GET", "amis", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu, u.titre, u.cadre, COALESCE(s.cartes, 0) AS cartes, COALESCE(a.trophees, 1000) AS trophees, a.deck IS NOT NULL AS deck,
      (SELECT MAX(vu) FROM presence p WHERE p.user_id = u.id) AS vu,
      EXISTS (SELECT 1 FROM amis r WHERE r.user_id = u.id AND r.ami_id = ?1) AS reciproque
    FROM amis f JOIN users u ON u.id = f.ami_id LEFT JOIN sauvegardes s ON s.user_id = u.id LEFT JOIN arene a ON a.user_id = u.id
    WHERE f.user_id = ?1 AND u.banni = 0 ORDER BY u.pseudo`).bind(user.id).all();
  const demandes = await env.DB.prepare(`SELECT u.pseudo FROM amis f JOIN users u ON u.id = f.user_id
    WHERE f.ami_id = ? AND NOT EXISTS (SELECT 1 FROM amis r WHERE r.user_id = ? AND r.ami_id = f.user_id) AND u.banni = 0`).bind(user.id, user.id).all();
  return json({ amis: results.map((x) => ({ pseudo: x.pseudo, titre: x.titre, cadre: x.cadre, admin: !!x.admin, premium: estPremium(x), cartes: x.cartes, trophees: x.trophees, palier: palierArene(x.trophees), deck: !!x.deck, enLigne: !!x.vu && maintenant() - x.vu < EN_LIGNE_MS, reciproque: !!x.reciproque })), demandes: demandes.results.map((x) => x.pseudo) });
}, { connecte: true });
route("POST", "amis", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const ami = await env.DB.prepare("SELECT id, pseudo FROM users WHERE pseudo = ? AND banni = 0").bind(String(b.pseudo || "").trim()).first();
  if (!ami) return erreur("Joueur introuvable.", 404);
  if (ami.id === user.id) return erreur("Vous ne pouvez pas vous ajouter vous-même.");
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM amis WHERE user_id = ?").bind(user.id).first();
  if (n.n >= 200) return erreur("Liste d'amis pleine (200).");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO amis (user_id, ami_id, cree_le) VALUES (?, ?, ?)").bind(user.id, ami.id, maintenant()).run();
  if (r.meta.changes) enArrierePlan(ctx, envoyerPush(env, ami.id, { titre: "👫 Nouvel ami", texte: `${user.pseudo} vous a ajouté en ami. Ajoutez-le aussi pour vous défier !`, url: "./#hub" }));
  return json({ ok: true, pseudo: ami.pseudo }, 201);
}, { connecte: true });
route("DELETE", "amis/([A-Za-z0-9_-]{3,20})", async ({ env, user, p }) => {
  await env.DB.prepare("DELETE FROM amis WHERE user_id = ? AND ami_id = (SELECT id FROM users WHERE pseudo = ?)").bind(user.id, p[1]).run();
  return json({ ok: true });
}, { connecte: true });
// Collection d'un joueur : visible par ses amis (ou par lui-même / l'admin)
route("GET", "collection/([A-Za-z0-9_-]{3,20})", async ({ env, user, p }) => {
  const u = await env.DB.prepare("SELECT id, pseudo FROM users WHERE pseudo = ? AND banni = 0").bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const ami = u.id === user.id || user.admin || await env.DB.prepare("SELECT 1 FROM amis WHERE user_id = ? AND ami_id = ?").bind(u.id, user.id).first();
  if (!ami) return erreur(`${u.pseudo} doit d'abord vous ajouter en ami pour que vous voyiez sa collection.`, 403);
  const save = await saveDe(env, u.id);
  const owned = Object.keys(save.owned || {}).filter((id) => save.owned[id] > 0 && CATALOGUE[id]);
  return json({ pseudo: u.pseudo, cartes: owned, shiny: Object.keys(save.shiny || {}), doree: Object.keys(save.doree || {}) });
}, { connecte: true });

/* =====================================================================
   Saisons d'arène : un mois chacune, paliers Bronze → Diamant, récompenses
   ===================================================================== */
const PALIERS = [[1700, "diamant", "💠 Diamant", 3000, 4], [1500, "platine", "🔷 Platine", 1800, 3], [1300, "or", "🥇 Or", 1000, 2], [1100, "argent", "🥈 Argent", 500, 1], [0, "bronze", "🥉 Bronze", 200, 0]];
const palierArene = (t) => { const p = PALIERS.find(([min]) => t >= min); return { cle: p[1], nom: p[2] }; };
const saisonCourante = () => new Date().toISOString().slice(0, 7);
const finSaison = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
async function finDeSaison(env) {
  const saison = saisonCourante(), derniere = await lireConfig(env, "saison");
  if (!derniere) return ecrireConfig(env, "saison", saison);
  if (derniere === saison) return;
  await ecrireConfig(env, "saison", saison);
  const { results } = await env.DB.prepare("SELECT a.user_id, a.trophees FROM arene a JOIN users u ON u.id = a.user_id WHERE a.deck IS NOT NULL AND (a.victoires + a.defaites) > 0 AND u.banni = 0 AND u.admin = 0").all();
  for (const x of results) {
    const p = PALIERS.find(([min]) => x.trophees >= min);
    await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(x.user_id, p[3], p[4], `Fin de la saison d'arène ${derniere} : palier ${p[2]} !`, maintenant()).run();
  }
  // Remise à niveau douce : on se rapproche de 1000 trophées
  await env.DB.prepare("UPDATE arene SET trophees = 1000 + (trophees - 1000) / 2, victoires = 0, defaites = 0").run();
}

/* =====================================================================
   Paiement automatique PayPal (Checkout) : activé si PAYPAL_CLIENT_ID et PAYPAL_SECRET sont configurés
   ===================================================================== */
const PRIX_FORMULES = { mois: "3.99", an: "29.99", vie: "89.00", passe: "7.99" };
const urlPaypal = (env) => (env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
async function jetonPaypal(env) {
  const r = await fetch(urlPaypal(env) + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!r.ok) throw new ErreurApi("PayPal est indisponible pour le moment.", 502);
  return (await r.json()).access_token;
}
route("GET", "premium/config", async ({ env }) => json({ paypalClientId: env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET ? env.PAYPAL_CLIENT_ID : null, prix: PRIX_FORMULES }));
route("POST", "premium/paypal/commande", async ({ request, env, user }) => {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return erreur("Paiement automatique non configuré.", 503);
  const b = await corps(request);
  const formule = PRIX_FORMULES[b.formule] ? b.formule : "mois";
  const r = await fetch(urlPaypal(env) + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + await jetonPaypal(env), "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "EUR", value: PRIX_FORMULES[formule] }, description: formule === "passe" ? `WorldCards Passe de saison (${moisCourant()})` : `WorldCards Premium (${formule})`, custom_id: `${user.id}:${formule}` }] }) });
  const j = await r.json();
  if (!r.ok || !j.id) return erreur("Impossible de créer la commande PayPal.", 502);
  await env.DB.prepare("INSERT INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'cree', ?)").bind(j.id, user.id, formule, PRIX_FORMULES[formule], maintenant()).run();
  return json({ id: j.id });
}, { connecte: true });
route("POST", "premium/paypal/valider", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const p = await env.DB.prepare("SELECT * FROM paiements WHERE commande = ? AND user_id = ?").bind(String(b.commande || ""), user.id).first();
  if (!p) return erreur("Commande inconnue.", 404);
  if (p.statut === "paye") return erreur("Ce paiement a déjà été utilisé.", 409);
  const r = await fetch(`${urlPaypal(env)}/v2/checkout/orders/${encodeURIComponent(p.commande)}/capture`, { method: "POST", headers: { Authorization: "Bearer " + await jetonPaypal(env), "Content-Type": "application/json" } });
  const j = await r.json();
  const capture = j.purchase_units?.[0]?.payments?.captures?.[0];
  // Vérifications : paiement terminé, bon montant, bonne devise, bon joueur
  if (j.status !== "COMPLETED" || capture?.status !== "COMPLETED" || capture.amount?.value !== p.montant || capture.amount?.currency_code !== "EUR" || capture.custom_id !== `${user.id}:${p.formule}`)
    return erreur("Le paiement n'a pas pu être confirmé. Aucun montant n'a été validé.", 402);
  const fait = await env.DB.prepare("UPDATE paiements SET statut = 'paye' WHERE commande = ? AND statut != 'paye'").bind(p.commande).run();
  if (!fait.meta.changes) return erreur("Ce paiement a déjà été utilisé.", 409);
  const jusqu = await activerPremium(env, ctx, user.id, p.formule);
  enArrierePlan(ctx, prevenirAdmins(env, { titre: p.formule === "passe" ? "💰 Passe de saison payé" : "💰 Paiement Premium reçu", texte: `${user.pseudo} : ${p.formule} (${p.montant} €)`, url: "./#admin" }));
  return json({ ok: true, premiumJusqu: jusqu });
}, { connecte: true });

/* =====================================================================
   Corrections de photos (l'admin choisit un autre article Wikipédia)
   ===================================================================== */
route("GET", "photos/corrections", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT carte, titre, maj FROM photos").all();
  return json({ corrections: results });
});
route("POST", "admin/photos", async ({ request, env }) => {
  const b = await corps(request);
  const carte = String(b.carte || "");
  if (!CATALOGUE[carte] && !/^pays:[A-Z]{2}$/.test(carte)) return erreur("Carte inconnue.");
  const titre = String(b.titre || "").trim().slice(0, 200);
  if (!titre) await env.DB.prepare("DELETE FROM photos WHERE carte = ?").bind(carte).run();
  else await env.DB.prepare("INSERT INTO photos (carte, titre, maj) VALUES (?, ?, ?) ON CONFLICT(carte) DO UPDATE SET titre = excluded.titre, maj = excluded.maj").bind(carte, titre, maintenant()).run();
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Discussion en direct (salons publics) et messages privés
   ===================================================================== */
const SALONS = { general: "💬 Général", echanges: "🤝 Échanges", combat: "⚔️ Combat", aide: "🆘 Entraide" };
const ANTI_FLOOD_MS = 3000;
// Mots interdits masqués (liste courte, l'admin modère le reste)
const MOTS_MASQUES = /\b(connard|connasse|encul[ée]+|salope|pute|ntm|fdp|nique ta|pd|batard|bâtard)\b/gi;
// Protection des mineurs : liens et numéros de téléphone masqués (désactivable dans l'admin)
const RE_LIEN = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|fr|net|org|be|ch|ca|io|gg|ly|me|xyz|tk|app|co|link|site|online|shop)\b\S*/gi;
const RE_TEL = /(?:\+|\b0)\d(?:[\s.-]?\d){7,12}\b/g;
const RE_RESEAUX = /\b(?:snap(?:chat)?|insta(?:gram)?|tiktok|discord|whatsapp|telegram)\s*[:@]?\s*@?[\w.]{3,}/gi;
async function filtrerContacts(env, texte) {
  if ((await lireConfig(env, "filtre_contacts")) === false) return texte;
  return texte.replace(RE_LIEN, "[lien masqué]").replace(RE_TEL, "[numéro masqué]").replace(RE_RESEAUX, "[contact masqué]");
}
async function verifierSourdine(env, user) {
  if (!user.admin && user.muet_jusqu > maintenant()) throw new ErreurApi(`Vous êtes en sourdine encore ${Math.ceil((user.muet_jusqu - maintenant()) / 60000)} min (signalements des joueurs).`, 403);
}
const journaliser = (env, userId, action, details, par = "système") =>
  env.DB.prepare("INSERT INTO moderation (user_id, action, details, par, cree_le) VALUES (?, ?, ?, ?, ?)").bind(userId, action, String(details || "").slice(0, 300), par, maintenant()).run();
const nettoyerTexte = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 400).replace(MOTS_MASQUES, (m) => "•".repeat(m.length));
async function antiFlood(env, table, colonne, userId) {
  const d = await env.DB.prepare(`SELECT cree_le FROM ${table} WHERE ${colonne} = ? ORDER BY id DESC LIMIT 1`).bind(userId).first();
  if (d && maintenant() - d.cree_le < ANTI_FLOOD_MS) throw new ErreurApi("Doucement ! Attendez quelques secondes entre deux messages.", 429);
}
route("GET", "chat/salons", async ({ env }) => {
  const depuis = maintenant() - 24 * 3600000;
  const { results } = await env.DB.prepare("SELECT salon, COUNT(*) AS n, MAX(id) AS dernier FROM chat WHERE cree_le > ? GROUP BY salon").bind(depuis).all();
  const stats = Object.fromEntries(results.map((r) => [r.salon, r]));
  return json({ salons: Object.entries(SALONS).map(([cle, nom]) => ({ cle, nom, messages24h: stats[cle]?.n || 0, dernier: stats[cle]?.dernier || 0 })) });
});
// Salon accessible ? (salons publics, ou salon privé « g<id> » réservé aux membres de la guilde)
async function salonAutorise(env, user, salon) {
  if (SALONS[salon]) return true;
  const g = /^g(\d+)$/.exec(salon);
  if (!g || !user) return false;
  return !!(await env.DB.prepare("SELECT 1 FROM guilde_membres WHERE user_id = ? AND guilde_id = ?").bind(user.id, g[1]).first()) || !!user.admin;
}
route("GET", "chat/([a-z0-9]+)", async ({ request, env, user, p }) => {
  if (!(await salonAutorise(env, user, p[1]))) return erreur("Salon inconnu.", 404);
  const apres = Number(new URL(request.url).searchParams.get("apres")) || 0;
  const bloques = user ? "AND c.user_id NOT IN (SELECT bloque_id FROM bloques WHERE user_id = ?3)" : "";
  const { results } = await env.DB.prepare(`SELECT * FROM (SELECT c.id, c.texte, c.carte, c.reponse, c.cree_le, u.pseudo, u.admin, u.premium_jusqu, u.titre, u.cadre,
      (SELECT g.tag FROM guilde_membres gm JOIN guildes g ON g.id = gm.guilde_id WHERE gm.user_id = u.id) AS tag,
      (SELECT u2.pseudo || ' : ' || substr(c2.texte, 1, 60) FROM chat c2 JOIN users u2 ON u2.id = c2.user_id WHERE c2.id = c.reponse) AS cite
    FROM chat c JOIN users u ON u.id = c.user_id WHERE c.salon = ?1 AND c.id > ?2 AND u.banni = 0 ${bloques} ORDER BY c.id DESC LIMIT 60) ORDER BY id`)
    .bind(...(user ? [p[1], apres, user.id] : [p[1], apres])).all();
  return json({ messages: results.map((m) => ({ id: m.id, texte: m.texte, carte: m.carte, cite: m.cite, cree_le: m.cree_le, pseudo: m.pseudo, admin: !!m.admin, premium: estPremium(m), titre: m.titre, cadre: m.cadre, tag: m.tag, moi: !!user && m.pseudo === user.pseudo })) });
});
route("POST", "chat/([a-z0-9]+)", async ({ request, env, user, p }) => {
  if (!(await salonAutorise(env, user, p[1]))) return erreur("Salon inconnu.", 404);
  const b = await corps(request);
  await verifierSourdine(env, user);
  const texte = await filtrerContacts(env, nettoyerTexte(b.texte)), carte = b.carte && CARTE_RE.test(b.carte) ? b.carte : null;
  if (!texte && !carte) return erreur("Message vide.");
  if (!user.admin) await antiFlood(env, "chat", "user_id", user.id);
  const r = await env.DB.prepare("INSERT INTO chat (salon, user_id, texte, carte, reponse, cree_le) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(p[1], user.id, texte, carte, Number(b.reponse) || null, maintenant()).run();
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("DELETE", "chat/message/(\\d+)", async ({ env, user, p }) => {
  const m = await env.DB.prepare("SELECT user_id FROM chat WHERE id = ?").bind(p[1]).first();
  if (!m) return erreur("Message introuvable.", 404);
  if (m.user_id !== user.id && !user.admin) return erreur("Vous ne pouvez supprimer que vos messages.", 403);
  const msg = await env.DB.prepare("SELECT texte FROM chat WHERE id = ?").bind(p[1]).first();
  await env.DB.batch([env.DB.prepare("DELETE FROM chat WHERE id = ?").bind(p[1]), env.DB.prepare("UPDATE signal_chat SET traite = 1 WHERE message_id = ?").bind(p[1])]);
  if (m.user_id !== user.id) await journaliser(env, m.user_id, "message supprimé", msg?.texte, user.pseudo);
  return json({ ok: true });
}, { connecte: true });
// Signalement d'un message : 3 joueurs différents en 1 h → sourdine automatique de 10 minutes
route("POST", "chat/message/(\\d+)/signaler", async ({ env, user, p, ctx }) => {
  const m = await env.DB.prepare("SELECT c.user_id, c.texte, u.pseudo, u.admin FROM chat c JOIN users u ON u.id = c.user_id WHERE c.id = ?").bind(p[1]).first();
  if (!m) return erreur("Message introuvable.", 404);
  if (m.user_id === user.id) return erreur("Vous ne pouvez pas signaler votre propre message.");
  await env.DB.prepare("INSERT OR IGNORE INTO signal_chat (message_id, user_id, cible_id, texte, cree_le) VALUES (?, ?, ?, ?, ?)").bind(p[1], user.id, m.user_id, m.texte, maintenant()).run();
  const n = await env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM signal_chat WHERE cible_id = ? AND cree_le > ? AND traite = 0").bind(m.user_id, maintenant() - 3600000).first();
  const cible = await env.DB.prepare("SELECT muet_jusqu FROM users WHERE id = ?").bind(m.user_id).first();
  if (n.n >= 3 && !m.admin && (cible.muet_jusqu || 0) < maintenant()) {
    await env.DB.prepare("UPDATE users SET muet_jusqu = ? WHERE id = ?").bind(maintenant() + 10 * 60000, m.user_id).run();
    await journaliser(env, m.user_id, "sourdine auto (10 min)", `${n.n} joueurs ont signalé ses messages`);
    enArrierePlan(ctx, prevenirAdmins(env, { titre: "🔇 Sourdine automatique", texte: `${m.pseudo} est en sourdine 10 min après ${n.n} signalements.`, url: "./#admin" }));
  }
  return json({ ok: true });
}, { connecte: true });
route("GET", "admin/moderation", async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT s.message_id, s.texte, u.pseudo, u.id AS user_id, u.muet_jusqu, COUNT(*) AS nombre, MAX(s.cree_le) AS dernier,
      EXISTS (SELECT 1 FROM chat c WHERE c.id = s.message_id) AS existe
    FROM signal_chat s JOIN users u ON u.id = s.cible_id WHERE s.traite = 0 GROUP BY s.message_id ORDER BY nombre DESC, dernier DESC LIMIT 100`).all();
  return json({ filtre: (await lireConfig(env, "filtre_contacts")) !== false, signalements: results.map((x) => ({ ...x, existe: !!x.existe, muet: x.muet_jusqu > maintenant() })) });
}, { admin: true });
route("POST", "admin/moderation/filtre", async ({ request, env }) => {
  const b = await corps(request);
  await ecrireConfig(env, "filtre_contacts", !!b.actif);
  return json({ ok: true, actif: !!b.actif });
}, { admin: true });
route("POST", "admin/moderation/(\\d+)/ignorer", async ({ env, p }) => {
  await env.DB.prepare("UPDATE signal_chat SET traite = 1 WHERE message_id = ?").bind(p[1]).run();
  return json({ ok: true });
}, { admin: true });
route("POST", "admin/sourdine/([A-Za-z0-9_-]{3,20})", async ({ request, env, user, p, ctx }) => {
  const b = await corps(request);
  const minutes = Math.max(0, Math.min(10080, Math.floor(Number(b.minutes) || 0)));
  const u = await env.DB.prepare("SELECT id, admin FROM users WHERE pseudo = ?").bind(p[1]).first();
  if (!u || u.admin) return erreur("Joueur introuvable.", 404);
  await env.DB.prepare("UPDATE users SET muet_jusqu = ? WHERE id = ?").bind(minutes ? maintenant() + minutes * 60000 : 0, u.id).run();
  await journaliser(env, u.id, minutes ? `sourdine ${minutes} min` : "sourdine levée", b.motif, user.pseudo);
  if (minutes) enArrierePlan(ctx, envoyerPush(env, u.id, { titre: "🔇 Sourdine", texte: `Vous ne pouvez plus écrire pendant ${minutes} min (règles du hub).`, url: "./#hub" }));
  return json({ ok: true });
}, { admin: true });
route("GET", "admin/historique/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const u = await env.DB.prepare("SELECT id, pseudo, banni, muet_jusqu, reset_le FROM users WHERE pseudo = ?").bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const { results } = await env.DB.prepare("SELECT action, details, par, cree_le FROM moderation WHERE user_id = ? ORDER BY id DESC LIMIT 100").bind(u.id).all();
  const sig = await env.DB.prepare("SELECT COUNT(*) AS n FROM signal_chat WHERE cible_id = ?").bind(u.id).first();
  return json({ pseudo: u.pseudo, banni: !!u.banni, muetJusqu: u.muet_jusqu, signalements: sig.n, historique: results });
}, { admin: true });

// Messages privés
route("GET", "mp", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.premium_jusqu, u.admin, m.texte, m.cree_le, m.de_id,
      (SELECT COUNT(*) FROM mp n WHERE n.de_id = u.id AND n.a_id = ?1 AND n.lu = 0) AS non_lus,
      (SELECT MAX(vu) FROM presence pr WHERE pr.user_id = u.id) AS vu
    FROM (SELECT CASE WHEN de_id = ?1 THEN a_id ELSE de_id END AS autre, MAX(id) AS dernier FROM mp WHERE de_id = ?1 OR a_id = ?1 GROUP BY autre) c
    JOIN mp m ON m.id = c.dernier JOIN users u ON u.id = c.autre WHERE u.banni = 0 ORDER BY m.id DESC LIMIT 100`).bind(user.id).all();
  return json({ conversations: results.map((c) => ({ pseudo: c.pseudo, premium: estPremium(c), admin: !!c.admin, dernier: c.texte, deMoi: c.de_id === user.id, cree_le: c.cree_le, nonLus: c.non_lus, enLigne: !!c.vu && maintenant() - c.vu < EN_LIGNE_MS })) });
}, { connecte: true });
route("GET", "mp/non-lus", async ({ env, user }) => {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM mp WHERE a_id = ? AND lu = 0").bind(user.id).first();
  return json({ nonLus: r.n });
}, { connecte: true });
async function autreJoueur(env, user, pseudo) {
  const u = await env.DB.prepare("SELECT id, pseudo, admin, premium_jusqu FROM users WHERE pseudo = ? AND banni = 0").bind(pseudo).first();
  if (!u) throw new ErreurApi("Joueur introuvable.", 404);
  if (u.id === user.id) throw new ErreurApi("Vous ne pouvez pas vous écrire à vous-même.");
  return u;
}
route("GET", "mp/([A-Za-z0-9_-]{3,20})", async ({ request, env, user, p }) => {
  const u = await autreJoueur(env, user, p[1]);
  const apres = Number(new URL(request.url).searchParams.get("apres")) || 0;
  const { results } = await env.DB.prepare(`SELECT * FROM (SELECT id, de_id, texte, carte, lu, cree_le FROM mp
    WHERE ((de_id = ?1 AND a_id = ?2) OR (de_id = ?2 AND a_id = ?1)) AND id > ?3 ORDER BY id DESC LIMIT 100) ORDER BY id`).bind(user.id, u.id, apres).all();
  await env.DB.prepare("UPDATE mp SET lu = 1 WHERE de_id = ? AND a_id = ? AND lu = 0").bind(u.id, user.id).run();
  const bloque = await env.DB.prepare("SELECT 1 FROM bloques WHERE user_id = ? AND bloque_id = ?").bind(user.id, u.id).first();
  const pr = await env.DB.prepare("SELECT MAX(vu) AS vu FROM presence WHERE user_id = ?").bind(u.id).first();
  return json({ pseudo: u.pseudo, premium: estPremium(u), admin: !!u.admin, bloque: !!bloque, enLigne: !!pr?.vu && maintenant() - pr.vu < EN_LIGNE_MS,
    messages: results.map((m) => ({ id: m.id, moi: m.de_id === user.id, texte: m.texte, carte: m.carte, lu: !!m.lu, cree_le: m.cree_le })) });
}, { connecte: true });
route("POST", "mp/([A-Za-z0-9_-]{3,20})", async ({ request, env, user, p, ctx }) => {
  const u = await autreJoueur(env, user, p[1]);
  const b = await corps(request);
  await verifierSourdine(env, user);
  const texte = await filtrerContacts(env, nettoyerTexte(b.texte)), carte = b.carte && CARTE_RE.test(b.carte) ? b.carte : null;
  if (!texte && !carte) return erreur("Message vide.");
  if (await env.DB.prepare("SELECT 1 FROM bloques WHERE (user_id = ?1 AND bloque_id = ?2) OR (user_id = ?2 AND bloque_id = ?1)").bind(u.id, user.id).first())
    return erreur("Vous ne pouvez pas écrire à ce joueur.", 403);
  if (!user.admin) await antiFlood(env, "mp", "de_id", user.id);
  const r = await env.DB.prepare("INSERT INTO mp (de_id, a_id, texte, carte, cree_le) VALUES (?, ?, ?, ?, ?)").bind(user.id, u.id, texte, carte, maintenant()).run();
  // Une notification seulement si la conversation était « au calme » (pas de spam de notifications)
  const avant = await env.DB.prepare("SELECT COUNT(*) AS n FROM mp WHERE de_id = ? AND a_id = ? AND lu = 0").bind(user.id, u.id).first();
  if (avant.n <= 1) enArrierePlan(ctx, envoyerPush(env, u.id, { titre: `✉️ ${user.pseudo}`, texte: texte ? texte.slice(0, 90) : "vous a envoyé une carte", url: "./#hub" }));
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("POST", "bloquer/([A-Za-z0-9_-]{3,20})", async ({ env, user, p }) => {
  const u = await autreJoueur(env, user, p[1]);
  const deja = await env.DB.prepare("DELETE FROM bloques WHERE user_id = ? AND bloque_id = ?").bind(user.id, u.id).run();
  if (!deja.meta.changes) await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO bloques (user_id, bloque_id) VALUES (?, ?)").bind(user.id, u.id),
    env.DB.prepare("DELETE FROM amis WHERE (user_id = ?1 AND ami_id = ?2) OR (user_id = ?2 AND ami_id = ?1)").bind(user.id, u.id),
  ]);
  return json({ bloque: !deja.meta.changes });
}, { connecte: true });
/* Photos de profil : petite image JPEG/WebP (redimensionnée côté client), modérée par l'admin */
const AVATAR_RE = /^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)$/;
route("POST", "avatar", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const m = AVATAR_RE.exec(String(b.image || ""));
  if (!m || m[2].length > 60000) return erreur("Image invalide ou trop lourde.");
  const avant = await env.DB.prepare("SELECT maj FROM avatars WHERE user_id = ?").bind(user.id).first();
  if (!user.admin && avant && maintenant() - avant.maj < 30000) return erreur("Attendez un peu avant de changer à nouveau de photo.", 429);
  await env.DB.prepare("INSERT INTO avatars (user_id, image, maj, signale) VALUES (?, ?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET image = excluded.image, maj = excluded.maj, signale = 0").bind(user.id, b.image, maintenant()).run();
  return json({ ok: true, v: maintenant() });
}, { connecte: true });
route("DELETE", "avatar", async ({ env, user }) => {
  await env.DB.prepare("DELETE FROM avatars WHERE user_id = ?").bind(user.id).run();
  return json({ ok: true });
}, { connecte: true });
route("GET", "avatar/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const a = await env.DB.prepare("SELECT a.image FROM avatars a JOIN users u ON u.id = a.user_id WHERE u.pseudo = ? AND u.banni = 0").bind(p[1]).first();
  const m = a && AVATAR_RE.exec(a.image);
  // Pas de photo : GIF transparent (la lettre du pseudo reste visible dessous)
  if (!m) return new Response(Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0)), { headers: { "content-type": "image/gif", "cache-control": "public, max-age=120" } });
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { "content-type": "image/" + m[1], "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
});
route("POST", "avatar/([A-Za-z0-9_-]{3,20})/signaler", async ({ env, user, p, ctx }) => {
  const r = await env.DB.prepare("UPDATE avatars SET signale = signale + 1 WHERE user_id = (SELECT id FROM users WHERE pseudo = ?)").bind(p[1]).run();
  if (r.meta.changes) enArrierePlan(ctx, prevenirAdmins(env, { titre: "🚩 Photo de profil signalée", texte: `${user.pseudo} signale la photo de ${p[1]}`, url: "./#admin" }));
  return json({ ok: true });
}, { connecte: true });
route("GET", "admin/avatars", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT u.pseudo, a.maj, a.signale FROM avatars a JOIN users u ON u.id = a.user_id ORDER BY a.signale DESC, a.maj DESC LIMIT 200").all();
  return json({ avatars: results });
}, { admin: true });
route("DELETE", "admin/avatars/([A-Za-z0-9_-]{3,20})", async ({ env, p, ctx }) => {
  const u = await env.DB.prepare("SELECT id FROM users WHERE pseudo = ?").bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  await env.DB.prepare("DELETE FROM avatars WHERE user_id = ?").bind(u.id).run();
  await journaliser(env, u.id, "photo de profil supprimée", "", "admin");
  enArrierePlan(ctx, envoyerPush(env, u.id, { titre: "🛡️ Photo de profil retirée", texte: "Votre photo de profil ne respectait pas les règles et a été supprimée par l'administrateur.", url: "./#compte" }));
  return json({ ok: true });
}, { admin: true });
/* =====================================================================
   Duels en direct entre amis : les deux joueurs choisissent leur action à chaque tour (20 s max)
   ===================================================================== */
const CHRONO_DUEL = 20000, DUELS_RECOMPENSES_JOUR = 10;
const sontAmis = async (env, x, y) => !!(await env.DB.prepare("SELECT 1 FROM amis WHERE (user_id = ?1 AND ami_id = ?2) OR (user_id = ?2 AND ami_id = ?1)").bind(x, y).first());
// Fait avancer le duel : tour résolu quand les deux ont choisi, ou à la fin du chrono (« attaque » par défaut)
async function avancerDuel(env, d) {
  if (d.statut !== "encours") return d;
  const paires = JSON.parse(d.paires);
  let { choix_a: ca, choix_b: cb, limite } = d, change = false;
  for (let i = 0; i < 40 && (ca && cb || maintenant() > limite + 1500); i++) {
    paires.push([ca || "attaque", cb || "attaque"]);
    ca = cb = null; limite = Math.max(limite + CHRONO_DUEL, maintenant() + CHRONO_DUEL); change = true;
    const etat = COMBAT.rejouerDuel(JSON.parse(d.deck_a), JSON.parse(d.deck_b), d.graine, paires);
    if (etat.fini) { d.statut = "fini"; d.gagnant = etat.gagnant === 0 ? d.a_id : d.b_id; d.fini_le = maintenant(); break; }
  }
  if (!change) return d;
  Object.assign(d, { paires: JSON.stringify(paires), choix_a: ca, choix_b: cb, limite });
  const r = await env.DB.prepare("UPDATE duels SET paires = ?, choix_a = ?, choix_b = ?, limite = ?, statut = ?, gagnant = ?, fini_le = ? WHERE id = ? AND statut = 'encours'")
    .bind(d.paires, ca, cb, limite, d.statut, d.gagnant ?? null, d.fini_le ?? null, d.id).run();
  // Victoire en duel : comptée pour le tournoi et l'objectif de guilde (une seule fois)
  if (r.meta.changes && d.statut === "fini" && d.gagnant) {
    const g = await env.DB.prepare("SELECT id, pseudo FROM users WHERE id = ?").bind(d.gagnant).first();
    if (g) await ajouterPointsTournoi(env, g, 25, true, true);
  }
  return d;
}
async function vueDuel(env, d, user) {
  const moiA = d.a_id === user.id;
  const pseudos = await env.DB.prepare("SELECT id, pseudo FROM users WHERE id IN (?, ?)").bind(d.a_id, d.b_id).all();
  const nom = (id) => pseudos.results.find((x) => x.id === id)?.pseudo || "?";
  let pieces = 0;
  if (d.statut === "fini" && d.gagnant) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM duels WHERE statut = 'fini' AND (a_id = ?1 OR b_id = ?1) AND fini_le > ? AND id <= ?").bind(user.id, maintenant() - 86400000, d.id).first();
    if (n.n <= DUELS_RECOMPENSES_JOUR && JSON.parse(d.paires).length >= 3) pieces = d.gagnant === user.id ? 50 : 15;
  }
  return { id: d.id, statut: d.statut, cote: moiA ? 0 : 1, adversaire: nom(moiA ? d.b_id : d.a_id), graine: d.graine,
    deckA: JSON.parse(d.deck_a), deckB: d.deck_b ? JSON.parse(d.deck_b) : null, paires: JSON.parse(d.paires),
    jaiChoisi: !!(moiA ? d.choix_a : d.choix_b), luiAChoisi: !!(moiA ? d.choix_b : d.choix_a), resteMs: d.limite ? Math.max(0, d.limite - maintenant()) : null,
    gagne: d.statut === "fini" ? d.gagnant === user.id : null, pieces };
}
const lireDuel = async (env, id, user) => {
  const d = await env.DB.prepare("SELECT * FROM duels WHERE id = ? AND (a_id = ?2 OR b_id = ?2)").bind(id, user.id).first();
  if (!d) throw new ErreurApi("Duel introuvable.", 404);
  return d;
};
route("POST", "duels/inviter", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const ami = await autreJoueur(env, user, String(b.pseudo || ""));
  if (!(await sontAmis(env, user.id, ami.id))) return erreur("Vous ne pouvez défier en direct que vos amis.");
  const moi = await ligneArene(env, user.id);
  if (!moi.deck) return erreur("Enregistrez d'abord votre deck.");
  await env.DB.prepare("UPDATE duels SET statut = 'annule' WHERE a_id = ? AND statut = 'invite'").bind(user.id).run();
  const r = await env.DB.prepare("INSERT INTO duels (a_id, b_id, graine, deck_a, cree_le) VALUES (?, ?, ?, ?, ?)")
    .bind(user.id, ami.id, crypto.getRandomValues(new Uint32Array(1))[0], moi.deck, maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, ami.id, { titre: "⚔️ Duel en direct !", texte: `${user.pseudo} vous défie en direct. Acceptez vite !`, url: "./#combat" }));
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("GET", "duels/invitations", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT d.id, u.pseudo, d.cree_le FROM duels d JOIN users u ON u.id = d.a_id
    WHERE d.b_id = ? AND d.statut = 'invite' AND d.cree_le > ? ORDER BY d.id DESC LIMIT 5`).bind(user.id, maintenant() - 5 * 60000).all();
  const enCours = await env.DB.prepare("SELECT id FROM duels WHERE (a_id = ?1 OR b_id = ?1) AND statut = 'encours' ORDER BY id DESC LIMIT 1").bind(user.id).first();
  return json({ invitations: results, enCours: enCours?.id || null });
}, { connecte: true });
route("POST", "duels/(\\d+)/accepter", async ({ env, user, p }) => {
  const d = await lireDuel(env, p[1], user);
  if (d.b_id !== user.id || d.statut !== "invite") return erreur("Cette invitation n'est plus valable.");
  if (maintenant() - d.cree_le > 5 * 60000) return erreur("Invitation expirée.");
  const moi = await ligneArene(env, user.id);
  if (!moi.deck) return erreur("Enregistrez d'abord votre deck (onglet Combat).");
  await env.DB.prepare("UPDATE duels SET statut = 'encours', deck_b = ?, limite = ? WHERE id = ?").bind(moi.deck, maintenant() + CHRONO_DUEL + 3000, d.id).run();
  return json({ ok: true, id: d.id });
}, { connecte: true });
route("POST", "duels/(\\d+)/refuser", async ({ env, user, p }) => {
  await env.DB.prepare("UPDATE duels SET statut = 'refuse' WHERE id = ? AND statut = 'invite' AND (a_id = ?2 OR b_id = ?2)").bind(p[1], user.id).run();
  return json({ ok: true });
}, { connecte: true });
route("GET", "duels/(\\d+)", async ({ env, user, p }) => {
  const d = await avancerDuel(env, await lireDuel(env, p[1], user));
  return json(await vueDuel(env, d, user));
}, { connecte: true });
route("POST", "duels/(\\d+)/action", async ({ request, env, user, p }) => {
  const b = await corps(request);
  let d = await avancerDuel(env, await lireDuel(env, p[1], user));
  if (d.statut !== "encours") return json(await vueDuel(env, d, user));
  if (Number(b.tour) !== JSON.parse(d.paires).length + 1) return erreur("Ce tour est déjà passé.", 409);
  const action = String(b.action || "attaque").slice(0, 12);
  const col = d.a_id === user.id ? "choix_a" : "choix_b";
  await env.DB.prepare(`UPDATE duels SET ${col} = ? WHERE id = ? AND ${col} IS NULL`).bind(action, d.id).run();
  d = await avancerDuel(env, await lireDuel(env, p[1], user));
  return json(await vueDuel(env, d, user));
}, { connecte: true });
route("POST", "duels/(\\d+)/abandon", async ({ env, user, p }) => {
  const d = await lireDuel(env, p[1], user);
  if (d.statut === "encours" || d.statut === "invite") {
    const autre = d.a_id === user.id ? d.b_id : d.a_id;
    await env.DB.prepare("UPDATE duels SET statut = ?, gagnant = ?, fini_le = ? WHERE id = ?").bind(d.statut === "invite" ? "annule" : "fini", d.statut === "invite" ? null : autre, maintenant(), d.id).run();
  }
  return json({ ok: true });
}, { connecte: true });

/* =====================================================================
   Guildes : 20 joueurs max, salon privé, classement, objectif commun chaque semaine
   ===================================================================== */
const GUILDE_MAX = 20, VICTOIRES_PAR_MEMBRE = 25;
const objectifGuilde = (n) => Math.max(100, n * VICTOIRES_PAR_MEMBRE); // 20 membres → 500 victoires
const maGuilde = (env, userId) => env.DB.prepare("SELECT g.*, m.role FROM guilde_membres m JOIN guildes g ON g.id = m.guilde_id WHERE m.user_id = ?").bind(userId).first();
const SQL_SCORE_GUILDE = `(SELECT COALESCE(SUM(t.score), 0) FROM tournoi_scores t JOIN guilde_membres m2 ON m2.user_id = t.user_id WHERE m2.guilde_id = g.id AND t.semaine = ?1)`;
route("GET", "guildes", async ({ request, env, user }) => {
  const q = String(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 24);
  const { results } = await env.DB.prepare(`SELECT g.id, g.nom, g.tag, g.embleme, g.description, g.ouverte,
      (SELECT COUNT(*) FROM guilde_membres m WHERE m.guilde_id = g.id) AS membres, ${SQL_SCORE_GUILDE} AS score
    FROM guildes g WHERE (?2 = '' OR g.nom LIKE '%' || ?2 || '%' OR g.tag LIKE ?2 || '%') ORDER BY score DESC, membres DESC LIMIT 50`).bind(semaineCourante(), q).all();
  const moi = user ? await maGuilde(env, user.id) : null;
  return json({ guildes: results.map((g) => ({ ...g, ouverte: !!g.ouverte, pleine: g.membres >= GUILDE_MAX })), maGuilde: moi?.id || null });
});
route("POST", "guildes", async ({ request, env, user }) => {
  const b = await corps(request);
  if (await maGuilde(env, user.id)) return erreur("Quittez d'abord votre guilde actuelle.");
  const nom = nettoyerTexte(b.nom).slice(0, 24), tag = String(b.tag || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (nom.length < 3 || nom.includes("•")) return erreur("Nom de guilde invalide (3 à 24 caractères, sans gros mots).");
  if (tag.length < 2) return erreur("Le tag doit faire 2 à 4 lettres ou chiffres.");
  const embleme = [...String(b.embleme || "🛡️")].slice(0, 2).join("") || "🛡️";
  try {
    const r = await env.DB.prepare("INSERT INTO guildes (nom, tag, embleme, description, chef_id, cree_le) VALUES (?, ?, ?, ?, ?, ?)").bind(nom, tag, embleme, nettoyerTexte(b.description).slice(0, 200), user.id, maintenant()).run();
    await env.DB.prepare("INSERT INTO guilde_membres (user_id, guilde_id, role, rejoint_le) VALUES (?, ?, 'chef', ?)").bind(user.id, r.meta.last_row_id, maintenant()).run();
    return json({ id: r.meta.last_row_id }, 201);
  } catch { return erreur("Ce nom de guilde est déjà pris."); }
}, { connecte: true });
route("GET", "guilde/moi", async ({ env, user }) => {
  const g = await maGuilde(env, user.id);
  if (!g) return json({ guilde: null });
  const sem = semaineCourante();
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.titre, u.cadre, m.role, m.rejoint_le, COALESCE(t.victoires, 0) AS victoires, COALESCE(t.score, 0) AS score, COALESCE(a.trophees, 1000) AS trophees,
      (SELECT MAX(vu) FROM presence pr WHERE pr.user_id = u.id) AS vu
    FROM guilde_membres m JOIN users u ON u.id = m.user_id LEFT JOIN tournoi_scores t ON t.user_id = u.id AND t.semaine = ? LEFT JOIN arene a ON a.user_id = u.id
    WHERE m.guilde_id = ? ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, score DESC`).bind(sem, g.id).all();
  const victoires = results.reduce((s, m) => s + m.victoires, 0), objectif = objectifGuilde(results.length);
  const recu = await env.DB.prepare("SELECT 1 FROM guilde_recompenses WHERE user_id = ? AND semaine = ?").bind(user.id, sem).first();
  const rang = await env.DB.prepare(`SELECT COUNT(*) + 1 AS r FROM guildes g WHERE ${SQL_SCORE_GUILDE} > ?2`).bind(sem, results.reduce((s, m) => s + m.score, 0)).first();
  return json({ guilde: { id: g.id, nom: g.nom, tag: g.tag, embleme: g.embleme, description: g.description, ouverte: !!g.ouverte, monRole: g.role, rang: rang.r,
    semaine: sem, finLe: new Date(sem).getTime() + 7 * JOUR, victoires, objectif, recompenseRecue: !!recu, score: results.reduce((s, m) => s + m.score, 0),
    membres: results.map((m) => ({ pseudo: m.pseudo, titre: m.titre, cadre: m.cadre, role: m.role, victoires: m.victoires, score: m.score, trophees: m.trophees, enLigne: !!m.vu && maintenant() - m.vu < EN_LIGNE_MS })) } });
}, { connecte: true });
route("POST", "guildes/(\\d+)/rejoindre", async ({ env, user, p, ctx }) => {
  if (await maGuilde(env, user.id)) return erreur("Vous êtes déjà dans une guilde.");
  const g = await env.DB.prepare("SELECT id, nom, ouverte, chef_id, (SELECT COUNT(*) FROM guilde_membres WHERE guilde_id = guildes.id) AS n FROM guildes WHERE id = ?").bind(p[1]).first();
  if (!g) return erreur("Guilde introuvable.", 404);
  if (!g.ouverte) return erreur("Cette guilde est fermée aux nouveaux membres.");
  if (g.n >= GUILDE_MAX) return erreur(`Cette guilde est pleine (${GUILDE_MAX} joueurs).`);
  await env.DB.prepare("INSERT INTO guilde_membres (user_id, guilde_id, role, rejoint_le) VALUES (?, ?, 'membre', ?)").bind(user.id, g.id, maintenant()).run();
  await env.DB.prepare("INSERT INTO chat (salon, user_id, texte, cree_le) VALUES (?, ?, ?, ?)").bind("g" + g.id, user.id, "👋 a rejoint la guilde !", maintenant() - ANTI_FLOOD_MS).run(); // ne bloque pas son 1er message
  enArrierePlan(ctx, envoyerPush(env, g.chef_id, { titre: "🛡️ Nouveau membre", texte: `${user.pseudo} a rejoint ${g.nom}.`, url: "./#guilde" }));
  return json({ ok: true });
}, { connecte: true });
async function retirerMembre(env, guildeId, userId) {
  await env.DB.prepare("DELETE FROM guilde_membres WHERE user_id = ?").bind(userId).run();
  const reste = await env.DB.prepare("SELECT user_id, role FROM guilde_membres WHERE guilde_id = ? ORDER BY CASE role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, rejoint_le").bind(guildeId).all();
  if (!reste.results.length) return env.DB.batch([env.DB.prepare("DELETE FROM chat WHERE salon = ?").bind("g" + guildeId), env.DB.prepare("DELETE FROM guildes WHERE id = ?").bind(guildeId)]);
  if (!reste.results.some((m) => m.role === "chef")) {
    // Le plus ancien officier (ou membre) devient chef
    const n = reste.results[0].user_id;
    await env.DB.batch([env.DB.prepare("UPDATE guilde_membres SET role = 'chef' WHERE user_id = ?").bind(n), env.DB.prepare("UPDATE guildes SET chef_id = ? WHERE id = ?").bind(n, guildeId)]);
  }
}
route("POST", "guilde/quitter", async ({ env, user }) => {
  const g = await maGuilde(env, user.id);
  if (!g) return erreur("Vous n'êtes dans aucune guilde.");
  await retirerMembre(env, g.id, user.id);
  return json({ ok: true });
}, { connecte: true });
route("POST", "guilde/membre/([A-Za-z0-9_-]{3,20})", async ({ request, env, user, p }) => {
  const b = await corps(request);
  const g = await maGuilde(env, user.id);
  if (!g || !["chef", "officier"].includes(g.role)) return erreur("Réservé au chef et aux officiers.", 403);
  const cible = await env.DB.prepare("SELECT u.id, m.role FROM users u JOIN guilde_membres m ON m.user_id = u.id WHERE u.pseudo = ? AND m.guilde_id = ?").bind(p[1], g.id).first();
  if (!cible || cible.id === user.id) return erreur("Membre introuvable.", 404);
  if (g.role === "officier" && cible.role !== "membre") return erreur("Un officier ne peut gérer que les membres.", 403);
  if (b.action === "exclure") await retirerMembre(env, g.id, cible.id);
  else if (b.action === "officier" || b.action === "membre") {
    if (g.role !== "chef") return erreur("Seul le chef peut nommer les officiers.", 403);
    await env.DB.prepare("UPDATE guilde_membres SET role = ? WHERE user_id = ?").bind(b.action, cible.id).run();
  } else if (b.action === "chef") {
    if (g.role !== "chef") return erreur("Seul le chef peut passer la main.", 403);
    await env.DB.batch([
      env.DB.prepare("UPDATE guilde_membres SET role = 'officier' WHERE user_id = ?").bind(user.id),
      env.DB.prepare("UPDATE guilde_membres SET role = 'chef' WHERE user_id = ?").bind(cible.id),
      env.DB.prepare("UPDATE guildes SET chef_id = ? WHERE id = ?").bind(cible.id, g.id),
    ]);
  } else return erreur("Action inconnue.");
  return json({ ok: true });
}, { connecte: true });
route("POST", "guilde/modifier", async ({ request, env, user }) => {
  const b = await corps(request);
  const g = await maGuilde(env, user.id);
  if (!g || g.role !== "chef") return erreur("Réservé au chef de guilde.", 403);
  await env.DB.prepare("UPDATE guildes SET description = ?, ouverte = ?, embleme = ? WHERE id = ?")
    .bind(nettoyerTexte(b.description ?? g.description).slice(0, 200), b.ouverte === undefined ? g.ouverte : b.ouverte ? 1 : 0, [...String(b.embleme || g.embleme)].slice(0, 2).join(""), g.id).run();
  return json({ ok: true });
}, { connecte: true });
// Objectif de la semaine atteint : chaque membre récupère sa récompense une fois
route("POST", "guilde/recompense", async ({ env, user }) => {
  const g = await maGuilde(env, user.id);
  if (!g) return erreur("Vous n'êtes dans aucune guilde.");
  const sem = semaineCourante();
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(t.victoires), 0) AS v FROM guilde_membres m LEFT JOIN tournoi_scores t ON t.user_id = m.user_id AND t.semaine = ? WHERE m.guilde_id = ?`).bind(sem, g.id).first();
  if (r.v < objectifGuilde(r.n)) return erreur(`Objectif pas encore atteint : ${r.v}/${objectifGuilde(r.n)} victoires.`);
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO guilde_recompenses (user_id, semaine) VALUES (?, ?)").bind(user.id, sem).run();
  if (!ins.meta.changes) return erreur("Récompense déjà récupérée cette semaine.");
  return json({ ok: true, booster: "or", pieces: 300 });
}, { connecte: true });
route("DELETE", "admin/guildes/(\\d+)", async ({ env, p }) => {
  await env.DB.batch([env.DB.prepare("DELETE FROM guilde_membres WHERE guilde_id = ?").bind(p[1]), env.DB.prepare("DELETE FROM chat WHERE salon = ?").bind("g" + p[1]), env.DB.prepare("DELETE FROM guildes WHERE id = ?").bind(p[1])]);
  return json({ ok: true });
}, { admin: true });

// Apparence choisie par le joueur (titre sous le pseudo, cadre autour de la photo) : débloquée dans le jeu
route("POST", "profil/apparence", async ({ request, env, user }) => {
  const b = await corps(request);
  const ok = (x) => (typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x) ? x : null);
  await env.DB.prepare("UPDATE users SET titre = ?, cadre = ? WHERE id = ?").bind(ok(b.titre), ok(b.cadre), user.id).run();
  return json({ ok: true });
}, { connecte: true });
/* =====================================================================
   Enchères : une carte mise en vente 24 h, les joueurs enchérissent en pièces, taxe de 10 % pour le vendeur
   ===================================================================== */
const DUREE_ENCHERE = 24 * 3600000, TAXE_ENCHERE = 0.1, ENCHERES_MAX = 5;
// Exemplaires d'une carte déjà mis de côté (échanges ouverts + enchères en cours)
async function enSequestre(env, userId, carte) {
  const r = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM echanges WHERE user_id = ?1 AND statut = 'ouvert' AND carte_offerte = ?2)
    + (SELECT COUNT(*) FROM encheres WHERE vendeur_id = ?1 AND statut = 'ouverte' AND carte = ?2) AS n`).bind(userId, carte).first();
  return r.n;
}
async function cloturerEncheres(env) {
  const { results } = await env.DB.prepare("SELECT * FROM encheres WHERE statut = 'ouverte' AND fin <= ? LIMIT 50").bind(maintenant()).all();
  for (const e of results) {
    const r = await env.DB.prepare("UPDATE encheres SET statut = ? WHERE id = ? AND statut = 'ouverte'").bind(e.acheteur_id ? "vendue" : "invendue", e.id).run();
    if (!r.meta.changes) continue;
    if (e.acheteur_id) {
      const net = Math.floor(e.offre * (1 - TAXE_ENCHERE));
      await env.DB.batch([
        env.DB.prepare("INSERT INTO livraisons (user_id, carte, doree, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(e.acheteur_id, e.carte, e.doree, `Enchère remportée (${e.offre} pièces)`, maintenant()),
        env.DB.prepare("INSERT INTO livraisons (user_id, pieces, message, cree_le) VALUES (?, ?, ?, ?)").bind(e.vendeur_id, net, `Vente aux enchères de ${e.nom} à ${e.acheteur} (taxe 10 % déduite)`, maintenant()),
      ]);
      await envoyerPush(env, e.acheteur_id, { titre: "🔨 Enchère remportée !", texte: `${e.nom} est à vous pour ${e.offre} 🪙.`, url: "./#encheres" });
      await envoyerPush(env, e.vendeur_id, { titre: "🔨 Carte vendue !", texte: `${e.nom} vendue ${e.offre} 🪙 à ${e.acheteur} (+${net} 🪙 après taxe).`, url: "./#encheres" });
    } else {
      await env.DB.prepare("INSERT INTO livraisons (user_id, carte, doree, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(e.vendeur_id, e.carte, e.doree, "Enchère sans offre : votre carte vous est rendue", maintenant()).run();
    }
  }
}
route("GET", "encheres", async ({ request, env, user }) => {
  await cloturerEncheres(env);
  const vue = new URL(request.url).searchParams.get("vue");
  const filtre = vue === "miennes" && user ? "AND (e.vendeur_id = ?1 OR e.acheteur_id = ?1)" : "AND e.statut = 'ouverte'";
  const { results } = await env.DB.prepare(`SELECT e.* FROM encheres e JOIN users u ON u.id = e.vendeur_id WHERE u.banni = 0 ${filtre}
    ORDER BY ${vue === "miennes" ? "e.id DESC" : "e.fin ASC"} LIMIT 100`).bind(...(vue === "miennes" && user ? [user.id] : [])).all();
  return json({ taxe: TAXE_ENCHERE, encheres: results.map((e) => ({ id: e.id, vendeur: e.vendeur, carte: e.carte, nom: e.nom, doree: !!e.doree, prixDepart: e.prix_depart, offre: e.offre, acheteur: e.acheteur,
    nbOffres: e.nb_offres, fin: e.fin, statut: e.statut, moi: !!user && e.vendeur_id === user.id, enTete: !!user && e.acheteur_id === user.id,
    minimum: e.offre ? Math.max(e.offre + 5, Math.ceil(e.offre * 1.05)) : e.prix_depart })) });
});
route("POST", "encheres", async ({ request, env, user }) => {
  const b = await corps(request);
  const carte = String(b.carte || ""), prix = Math.floor(Number(b.prix) || 0);
  if (!CATALOGUE[carte]) return erreur("Carte inconnue.");
  if (prix < 10 || prix > 100000) return erreur("Prix de départ entre 10 et 100 000 pièces.");
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM encheres WHERE vendeur_id = ? AND statut = 'ouverte'").bind(user.id).first();
  if (n.n >= ENCHERES_MAX) return erreur(`Maximum ${ENCHERES_MAX} enchères en cours.`, 429);
  const save = await saveDe(env, user.id);
  if (((save.owned || {})[carte] || 0) - await enSequestre(env, user.id, carte) < 1) return erreur("Cette carte n'est pas dans votre collection (sauvegarde du compte).");
  const doree = !!b.doree && !!(save.doree || {})[carte];
  const r = await env.DB.prepare("INSERT INTO encheres (vendeur_id, vendeur, carte, nom, doree, prix_depart, fin, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.pseudo, carte, CATALOGUE[carte].nom, doree ? 1 : 0, prix, maintenant() + DUREE_ENCHERE, maintenant()).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("POST", "encheres/(\\d+)/offre", async ({ request, env, user, p, ctx }) => {
  const b = await corps(request);
  await cloturerEncheres(env);
  const e = await env.DB.prepare("SELECT * FROM encheres WHERE id = ? AND statut = 'ouverte'").bind(p[1]).first();
  if (!e) return erreur("Cette enchère est terminée.", 404);
  if (e.vendeur_id === user.id) return erreur("Vous ne pouvez pas enchérir sur votre propre carte.");
  if (e.acheteur_id === user.id) return erreur("Vous êtes déjà en tête de cette enchère.");
  const montant = Math.floor(Number(b.montant) || 0), minimum = e.offre ? Math.max(e.offre + 5, Math.ceil(e.offre * 1.05)) : e.prix_depart;
  if (montant < minimum) return erreur(`L'offre minimum est de ${minimum} pièces.`);
  const save = await saveDe(env, user.id);
  if ((save.coins || 0) < montant) return erreur("Vous n'avez pas assez de pièces (sauvegarde du compte).");
  // Anti-dernière seconde : une offre dans les 2 dernières minutes prolonge l'enchère de 2 minutes
  const fin = e.fin - maintenant() < 120000 ? maintenant() + 120000 : e.fin;
  const r = await env.DB.prepare("UPDATE encheres SET offre = ?, acheteur_id = ?, acheteur = ?, nb_offres = nb_offres + 1, fin = ? WHERE id = ? AND statut = 'ouverte' AND COALESCE(offre, 0) = ?")
    .bind(montant, user.id, user.pseudo, fin, e.id, e.offre || 0).run();
  if (!r.meta.changes) return erreur("Quelqu'un vient d'enchérir : réessayez.", 409);
  // L'ancien meilleur enchérisseur récupère ses pièces
  if (e.acheteur_id) {
    await env.DB.prepare("INSERT INTO livraisons (user_id, pieces, message, cree_le) VALUES (?, ?, ?, ?)").bind(e.acheteur_id, e.offre, `Surenchère sur ${e.nom} : vos pièces vous sont rendues`, maintenant()).run();
    enArrierePlan(ctx, envoyerPush(env, e.acheteur_id, { titre: "🔨 Vous avez été surenchéri", texte: `${user.pseudo} offre ${montant} 🪙 pour ${e.nom}.`, url: "./#encheres" }));
  }
  enArrierePlan(ctx, envoyerPush(env, e.vendeur_id, { titre: "🔨 Nouvelle offre", texte: `${user.pseudo} offre ${montant} 🪙 pour ${e.nom}.`, url: "./#encheres" }));
  return json({ ok: true, montant, fin });
}, { connecte: true });
route("POST", "encheres/(\\d+)/annuler", async ({ env, user, p }) => {
  const e = await env.DB.prepare("SELECT * FROM encheres WHERE id = ? AND statut = 'ouverte'").bind(p[1]).first();
  if (!e) return erreur("Enchère introuvable.", 404);
  if (e.vendeur_id !== user.id && !user.admin) return erreur("Non autorisé.", 403);
  if (e.acheteur_id && !user.admin) return erreur("Impossible d'annuler : il y a déjà une offre.");
  const r = await env.DB.prepare("UPDATE encheres SET statut = 'annulee' WHERE id = ? AND statut = 'ouverte'").bind(e.id).run();
  if (r.meta.changes) {
    await env.DB.prepare("INSERT INTO livraisons (user_id, carte, doree, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(e.vendeur_id, e.carte, e.doree, "Enchère annulée : votre carte vous est rendue", maintenant()).run();
    if (e.acheteur_id) await env.DB.prepare("INSERT INTO livraisons (user_id, pieces, message, cree_le) VALUES (?, ?, ?, ?)").bind(e.acheteur_id, e.offre, `Enchère annulée par l'admin : vos pièces vous sont rendues`, maintenant()).run();
  }
  return json({ ok: true });
}, { connecte: true });

// Recherche de joueurs (pour ajouter des amis ou écrire)
route("GET", "joueurs/recherche", async ({ request, env, user }) => {
  const q = String(new URL(request.url).searchParams.get("q") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu, COALESCE(s.cartes, 0) AS cartes, (SELECT MAX(vu) FROM presence pr WHERE pr.user_id = u.id) AS vu
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.banni = 0 AND u.id != ? AND (? = '' OR u.pseudo LIKE ? || '%')
    ORDER BY vu DESC NULLS LAST, cartes DESC LIMIT 20`).bind(user.id, q, q).all();
  return json({ joueurs: results.map((j) => ({ pseudo: j.pseudo, admin: !!j.admin, premium: estPremium(j), cartes: j.cartes, enLigne: !!j.vu && maintenant() - j.vu < EN_LIGNE_MS })) });
}, { connecte: true });

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
  let reponse;
  try {
    await preparerSchema(env);
    reponse = await controleTrafic(request, env, ctx);
    if (!reponse) {
      const user = await utilisateurCourant(request, env);
      if ((r.connecte || r.admin) && !user) reponse = erreur("Connectez-vous pour continuer.", 401);
      else if (r.admin && !user.admin) reponse = erreur("Réservé à l'administrateur.", 403);
      else reponse = await r.gestion({ request, env, ctx, user, p: chemin.match(r.motif) });
    }
  } catch (e) {
    if (e instanceof ErreurApi) reponse = erreur(e.message, e.status);
    else { console.error(e); reponse = erreur("Erreur du serveur. Réessayez dans un instant.", 500); }
  }
  if (chemin !== "presence/ping") compterRequete(env, ctx, reponse.status);
  return reponse;
}
