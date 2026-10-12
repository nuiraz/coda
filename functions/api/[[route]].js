// API de Play2F1 : comptes, sauvegarde dans le cloud, hub communautaire, Premium, arène en ligne,
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
import SAISONS_DATA from "../../worldcards/data/saisons.js";
import EVENEMENTS_DATA from "../../worldcards/data/evenements.js";
import CENTRES_DATA from "../../worldcards/data/centres.js";
import SILHOUETTES_DATA from "../../worldcards/data/silhouettes.js";

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
  `CREATE TABLE IF NOT EXISTS abonnements_stripe ( abonnement TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, formule TEXT NOT NULL, client TEXT, statut TEXT NOT NULL, fin INTEGER, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS notifs_envoyees ( user_id INTEGER NOT NULL, type TEXT NOT NULL, cle TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, type, cle) )`,
  `CREATE TABLE IF NOT EXISTS stripe_evenements ( id TEXT PRIMARY KEY, type TEXT NOT NULL, user_id INTEGER, resume TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS raid_attaques ( id INTEGER PRIMARY KEY AUTOINCREMENT, guilde_id INTEGER NOT NULL, user_id INTEGER NOT NULL, semaine TEXT NOT NULL, jour TEXT NOT NULL, graine INTEGER NOT NULL, deck TEXT NOT NULL, degats INTEGER NOT NULL DEFAULT 0, fini INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS raid_guilde ON raid_attaques (guilde_id, semaine)`,
  `CREATE TABLE IF NOT EXISTS raid_recompenses ( user_id INTEGER NOT NULL, semaine TEXT NOT NULL, PRIMARY KEY (user_id, semaine) )`,
  `CREATE TABLE IF NOT EXISTS tdirect ( semaine TEXT PRIMARY KEY, statut TEXT NOT NULL, taille INTEGER NOT NULL DEFAULT 0, tableau TEXT, tour INTEGER NOT NULL DEFAULT 0, prochain INTEGER, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS tdirect_inscrits ( semaine TEXT NOT NULL, user_id INTEGER NOT NULL, pseudo TEXT NOT NULL, deck TEXT NOT NULL, trophees INTEGER NOT NULL DEFAULT 1000, cree_le INTEGER NOT NULL, PRIMARY KEY (semaine, user_id) )`,
  `CREATE TABLE IF NOT EXISTS credits ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, pieces INTEGER NOT NULL DEFAULT 0, cartes INTEGER NOT NULL DEFAULT 0, boosters INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS credits_user ON credits (user_id, cree_le)`,
  `CREATE TABLE IF NOT EXISTS visuels ( cle TEXT PRIMARY KEY, image TEXT NOT NULL, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS photos_perso ( carte TEXT PRIMARY KEY, image TEXT NOT NULL, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS rangs ( cle TEXT PRIMARY KEY, nom TEXT NOT NULL, couleur TEXT NOT NULL DEFAULT '#888888', description TEXT NOT NULL DEFAULT '', min_pts INTEGER NOT NULL DEFAULT 0, max_pts INTEGER, ordre INTEGER NOT NULL DEFAULT 0, actif INTEGER NOT NULL DEFAULT 1, divisions INTEGER NOT NULL DEFAULT 1, montee TEXT NOT NULL DEFAULT '', descente TEXT NOT NULL DEFAULT '', recompense_pieces INTEGER NOT NULL DEFAULT 0, recompense_boosters INTEGER NOT NULL DEFAULT 0, logo TEXT, logo_maj INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS offres ( cle TEXT PRIMARY KEY, nom TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', badge TEXT NOT NULL DEFAULT '', prix_cents INTEGER NOT NULL, prix_reference_cents INTEGER, reference_note TEXT NOT NULL DEFAULT '', pieces INTEGER NOT NULL DEFAULT 0, boosters TEXT NOT NULL DEFAULT '{}', une_fois INTEGER NOT NULL DEFAULT 0, actif INTEGER NOT NULL DEFAULT 1, ordre INTEGER NOT NULL DEFAULT 0, debut INTEGER, fin INTEGER, maj INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS defi_jour ( jour TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, essais TEXT NOT NULL DEFAULT '[]', fini INTEGER NOT NULL DEFAULT 0, gagne INTEGER NOT NULL DEFAULT 0, maj INTEGER NOT NULL, PRIMARY KEY (jour, user_id) )`,
  `CREATE TABLE IF NOT EXISTS nations_points ( semaine TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, nation TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (semaine, user_id) )`,
  `CREATE TABLE IF NOT EXISTS souhaits ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, carte TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, carte) )`,
  `CREATE TABLE IF NOT EXISTS activite ( user_id INTEGER NOT NULL, jour TEXT NOT NULL, PRIMARY KEY (user_id, jour) )`,
  `CREATE TABLE IF NOT EXISTS notifs_campagnes ( id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, texte TEXT NOT NULL, url TEXT NOT NULL, cible TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, envoyes INTEGER NOT NULL DEFAULT 0, par TEXT, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS notifs_file ( campagne_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (campagne_id, user_id) )`,
  `CREATE TABLE IF NOT EXISTS ouvertures_semaine ( semaine TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, score INTEGER NOT NULL, cartes TEXT NOT NULL, pack TEXT, cree_le INTEGER NOT NULL, PRIMARY KEY (semaine, user_id) )`,
  `CREATE TABLE IF NOT EXISTS cosmetiques_achats ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cle TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, cle) )`,
  `CREATE TABLE IF NOT EXISTS createurs ( code TEXT PRIMARY KEY COLLATE NOCASE, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, part INTEGER NOT NULL DEFAULT 10, actif INTEGER NOT NULL DEFAULT 1, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS createurs_ventes ( commande TEXT PRIMARY KEY, createur_id INTEGER NOT NULL, acheteur_id INTEGER NOT NULL, montant TEXT NOT NULL, part TEXT NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS dedicaces ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, carte TEXT NOT NULL, signature TEXT NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS echanges_directs ( id INTEGER PRIMARY KEY AUTOINCREMENT, a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, statut TEXT NOT NULL DEFAULT 'ouvert', offre_a TEXT NOT NULL DEFAULT '{"cartes":[],"pieces":0}', offre_b TEXT NOT NULL DEFAULT '{"cartes":[],"pieces":0}', ok_a INTEGER NOT NULL DEFAULT 0, ok_b INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS guerres ( semaine TEXT NOT NULL, g1 INTEGER NOT NULL, g2 INTEGER, fini INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (semaine, g1) )`,
  `CREATE TABLE IF NOT EXISTS albums_termines ( cle TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, pseudo TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (cle, user_id) )`,
  `CREATE TABLE IF NOT EXISTS missions_recues ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, periode TEXT NOT NULL, cle TEXT NOT NULL, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, periode, cle) )`,
  `CREATE TABLE IF NOT EXISTS champions ( saison TEXT PRIMARY KEY, user_id INTEGER, pseudo TEXT NOT NULL, trophees INTEGER NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS file_attente ( user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, trophees INTEGER NOT NULL, classe INTEGER NOT NULL DEFAULT 1, deck TEXT NOT NULL, depuis INTEGER NOT NULL, vu INTEGER NOT NULL, duel_id INTEGER )`,
  `CREATE TABLE IF NOT EXISTS decks_publics ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, nom TEXT NOT NULL, style TEXT NOT NULL DEFAULT 'equilibre', cartes TEXT NOT NULL, cout INTEGER NOT NULL DEFAULT 0, rarete_max INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL, maj INTEGER NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS decks_favoris ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, deck_id INTEGER NOT NULL REFERENCES decks_publics(id) ON DELETE CASCADE, PRIMARY KEY (user_id, deck_id) )`,
  `CREATE TABLE IF NOT EXISTS succes_recus ( user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cle TEXT NOT NULL, pieces INTEGER NOT NULL DEFAULT 0, cree_le INTEGER NOT NULL, PRIMARY KEY (user_id, cle) )`,
  `CREATE TABLE IF NOT EXISTS rangs_historique ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ancien TEXT, nouveau TEXT NOT NULL, trophees INTEGER NOT NULL, cree_le INTEGER NOT NULL )`,
  `CREATE INDEX IF NOT EXISTS rangs_historique_u ON rangs_historique (user_id, id)`,
  `CREATE TABLE IF NOT EXISTS decouvertes ( carte TEXT PRIMARY KEY, user_id INTEGER NOT NULL, pseudo TEXT NOT NULL, cree_le INTEGER NOT NULL )`,
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
  `ALTER TABLE users ADD COLUMN stripe_client TEXT`,
  `ALTER TABLE users ADD COLUMN parrain_id INTEGER`,
  `ALTER TABLE encheres ADD COLUMN notif_fin INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN parrainage_ok INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN cadre TEXT`,
  `ALTER TABLE arene ADD COLUMN classes_jour TEXT`,
  `ALTER TABLE arene ADD COLUMN classes_nb INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE combats ADD COLUMN classe INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE combats ADD COLUMN recompense INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE combats ADD COLUMN delta INTEGER`,
  `ALTER TABLE duels ADD COLUMN classe INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE duels ADD COLUMN traite INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE duels ADD COLUMN points_a INTEGER`,
  `ALTER TABLE duels ADD COLUMN points_b INTEGER`,
  `ALTER TABLE cadeaux ADD COLUMN boosters_detail TEXT`,
  `ALTER TABLE users ADD COLUMN confidentialite TEXT`,
  `ALTER TABLE users ADD COLUMN banniere TEXT`,
  `ALTER TABLE combats ADD COLUMN actions TEXT`,
  `ALTER TABLE offres ADD COLUMN cosmetique TEXT`,
  `ALTER TABLE users ADD COLUMN code_createur TEXT`,
  `ALTER TABLE duels ADD COLUMN aleatoire INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE notifs_campagnes ADD COLUMN programme_le INTEGER`,
  `ALTER TABLE notifs_campagnes ADD COLUMN statut TEXT NOT NULL DEFAULT 'fini'`,
  `ALTER TABLE notifs_campagnes ADD COLUMN discord INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN nation TEXT`,
  `ALTER TABLE users ADD COLUMN nation_le INTEGER NOT NULL DEFAULT 0`,
];
let schemaPret = false;
// Empreinte du schéma : si la base est déjà à jour, une seule lecture suffit au démarrage d'une instance
const EMPREINTE_SCHEMA = (() => { let h = 2166136261; for (const c of SCHEMA.join("|") + "#" + MIGRATIONS.join("|")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return String(h >>> 0); })();
async function preparerSchema(env) {
  if (schemaPret) return;
  try {
    const v = await env.DB.prepare("SELECT valeur FROM config WHERE cle = 'schema'").first();
    if (v && JSON.parse(v.valeur) === EMPREINTE_SCHEMA) { schemaPret = true; return; }
  } catch {}
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  for (const sql of MIGRATIONS) { try { await env.DB.prepare(sql).run(); } catch {} }
  await env.DB.prepare("INSERT INTO config (cle, valeur) VALUES ('schema', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").bind(JSON.stringify(EMPREINTE_SCHEMA)).run();
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
const profilPublic = (u) => ({ pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, premiumJusqu: u.premium_jusqu || 0, tempsJeu: u.temps_jeu || 0, stripe: !!u.stripe_client });
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
const CARTE_RE = /^[a-z]+:[A-Za-z0-9_-]{1,40}$/;
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
    const parrain = b.parrain ? await env.DB.prepare("SELECT id FROM users WHERE pseudo = ? AND banni = 0").bind(String(b.parrain).trim()).first() : null;
    const r = await env.DB.prepare("INSERT INTO users (pseudo, hash, sel, admin, cree_le, derniere_co, cgu_le, parrain_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(pseudo, hash, sel, admin ? 1 : 0, maintenant(), maintenant(), maintenant(), parrain?.id ?? null).run();
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
  // Abonnement Stripe arrivé à échéance : on vérifie s'il a été renouvelé
  if (user.stripe_client && await env.DB.prepare("SELECT 1 FROM abonnements_stripe WHERE user_id = ? AND statut IN ('active', 'trialing', 'past_due') AND fin < ?").bind(user.id, maintenant() + 3600000).first()) {
    try { await syncStripe(env, user.id); user = { ...user, ...(await env.DB.prepare("SELECT premium_jusqu FROM users WHERE id = ?").bind(user.id).first()) }; } catch {}
  }
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

/* =====================================================================
   Anti-triche : chaque sauvegarde est comparée à la précédente. Les gains impossibles sont refusés
   (la sauvegarde du serveur est rétablie), les gains suspects sont signalés à l'admin.
   Les gains donnés par le serveur (cadeaux, ventes, échanges…) sont notés dans « credits » et autorisés.
   ===================================================================== */
const crediter = (env, userId, pieces, cartes, boosters) => (pieces || cartes || boosters)
  ? env.DB.prepare("INSERT INTO credits (user_id, pieces, cartes, boosters, cree_le) VALUES (?, ?, ?, ?, ?)").bind(userId, pieces || 0, cartes || 0, boosters || 0, maintenant()).run() : null;
const totalExemplaires = (sv) => Object.values(sv?.owned || {}).reduce((t, x) => t + Math.max(0, Number(x) || 0), 0);
const totalBoosters = (sv) => Object.values(sv?.boosters || {}).reduce((t, x) => t + Math.max(0, Number(x) || 0), 0);
async function controleTriche(env, user, data) {
  const sv = data?.sauvegarde || {}, coins = Number(sv.coins) || 0, ex = totalExemplaires(sv);
  // Plafonds absolus : impossibles à atteindre en jouant normalement
  const prec = await env.DB.prepare("SELECT data, maj FROM sauvegardes WHERE user_id = ?").bind(user.id).first();
  if (coins > 5000000 || ex > 60000 || (Number(sv.xp) || 0) > 50000000 || totalBoosters(sv) > 5000) return { statut: "refuse", raisons: [`valeurs impossibles (${coins} pièces, ${ex} cartes)`], precedent: prec?.data };
  if (!prec) return { statut: "ok" };
  let ps; try { ps = JSON.parse(prec.data)?.sauvegarde || {}; } catch { return { statut: "ok" }; }
  if (user.reset_le && prec.maj < user.reset_le) return { statut: "ok" }; // 1re sauvegarde après un reset
  const h = Math.min(168, Math.max(0.05, (maintenant() - prec.maj) / 3600000));
  const cr = await env.DB.prepare("SELECT COALESCE(SUM(pieces), 0) AS p, COALESCE(SUM(cartes), 0) AS c, COALESCE(SUM(boosters), 0) AS b FROM credits WHERE user_id = ? AND cree_le >= ?").bind(user.id, prec.maj - 600000).first();
  const ouverts = Math.max(0, (Number(sv.ouverts) || 0) - (Number(ps.ouverts) || 0));
  const gainPieces = coins - (Number(ps.coins) || 0), gainCartes = ex - totalExemplaires(ps);
  const gainBoosters = totalBoosters(sv) - totalBoosters(ps), gainXp = (Number(sv.xp) || 0) - (Number(ps.xp) || 0);
  // Marges larges : quêtes, badges, niveaux, doublons, passe… ne doivent jamais déclencher de faux positif
  // (les boosters achetés en lot avec des pièces sont couverts par les pièces dépensées)
  const maxPieces = cr.p + 12000 + 6000 * h, maxCartes = cr.c + 40 + ouverts * 12 + 25 * h, maxBoosters = cr.b + 15 + 6 * h + Math.max(0, -gainPieces) / 100, maxXp = 4000 + 2500 * h;
  const raisons = [];
  if (gainPieces > maxPieces) raisons.push(`+${gainPieces} pièces en ${h.toFixed(1)} h (max ${Math.round(maxPieces)})`);
  if (gainCartes > maxCartes) raisons.push(`+${gainCartes} cartes en ${h.toFixed(1)} h (max ${Math.round(maxCartes)})`);
  if (gainBoosters > maxBoosters) raisons.push(`+${gainBoosters} boosters en ${h.toFixed(1)} h (max ${Math.round(maxBoosters)})`);
  if (gainXp > maxXp) raisons.push(`+${gainXp} XP en ${h.toFixed(1)} h`);
  if (!raisons.length) return { statut: "ok" };
  // Plus de 3 fois la limite : refusé ; sinon simplement signalé
  const enorme = gainPieces > maxPieces * 3 || gainCartes > maxCartes * 3 || gainBoosters > maxBoosters * 3;
  return { statut: enorme ? "refuse" : "suspect", raisons, precedent: prec.data };
}

// Parrainage : quand le filleul atteint le niveau 5 (720 XP), parrain et filleul reçoivent un booster + 200 pièces
const XP_NIVEAU_5 = 720, FILLEULS_MAX = 30;
async function verifierParrainage(env, user, data, ctx) {
  if (!user.parrain_id || user.parrainage_ok || (Number(data?.sauvegarde?.xp) || 0) < XP_NIVEAU_5) return;
  const r = await env.DB.prepare("UPDATE users SET parrainage_ok = 1 WHERE id = ? AND parrainage_ok = 0").bind(user.id).run();
  if (!r.meta.changes) return;
  const nb = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE parrain_id = ? AND parrainage_ok = 1").bind(user.parrain_id).first();
  const ins = "INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)";
  await env.DB.batch([
    env.DB.prepare(ins).bind(user.id, 200, 1, "Parrainage : vous avez atteint le niveau 5 !", maintenant()),
    ...(nb.n <= FILLEULS_MAX ? [env.DB.prepare(ins).bind(user.parrain_id, 200, 1, `Parrainage : votre filleul ${user.pseudo} a atteint le niveau 5 !`, maintenant())] : []),
  ]);
  if (nb.n <= FILLEULS_MAX) enArrierePlan(ctx, envoyerPush(env, user.parrain_id, { titre: "🤝 Parrainage réussi !", texte: `${user.pseudo} a atteint le niveau 5 : un booster et 200 🪙 vous attendent.`, url: "./" }));
}
route("GET", "parrainage", async ({ env, user }) => {
  const { results } = await env.DB.prepare("SELECT pseudo, parrainage_ok, cree_le FROM users WHERE parrain_id = ? ORDER BY cree_le DESC LIMIT 100").bind(user.id).all();
  const parrain = user.parrain_id ? await env.DB.prepare("SELECT pseudo FROM users WHERE id = ?").bind(user.parrain_id).first() : null;
  return json({ code: user.pseudo, parrain: parrain?.pseudo || null, peutAjouter: !user.parrain_id && maintenant() - user.cree_le < 7 * JOUR,
    recompense: !!user.parrainage_ok, filleuls: results.map((f) => ({ pseudo: f.pseudo, valide: !!f.parrainage_ok, depuis: f.cree_le })), max: FILLEULS_MAX });
}, { connecte: true });
route("POST", "parrainage", async ({ request, env, user }) => {
  const b = await corps(request);
  if (user.parrain_id) return erreur("Vous avez déjà un parrain.");
  if (maintenant() - user.cree_le > 7 * JOUR) return erreur("Le code de parrainage s'ajoute dans les 7 jours suivant l'inscription.");
  const p = await env.DB.prepare("SELECT id, parrain_id FROM users WHERE pseudo = ? AND banni = 0").bind(String(b.code || "").trim()).first();
  if (!p || p.id === user.id) return erreur("Code de parrainage introuvable (c'est le pseudo de votre parrain).");
  if (p.parrain_id === user.id) return erreur("Vous ne pouvez pas parrainer votre propre parrain.");
  await env.DB.prepare("UPDATE users SET parrain_id = ? WHERE id = ? AND parrain_id IS NULL").bind(p.id, user.id).run();
  return json({ ok: true });
}, { connecte: true });
route("PUT", "sauvegarde", async ({ request, env, user, ctx }) => {
  const texte = await request.text();
  if (texte.length > TAILLE_MAX_SAUVEGARDE) return erreur("Sauvegarde trop lourde : retirez quelques illustrations personnelles.", 413);
  let b; try { b = JSON.parse(texte); } catch { return erreur("Sauvegarde illisible."); }
  if (!b.data || typeof b.data !== "object") return erreur("Sauvegarde vide.");
  // Compte réinitialisé par l'admin : on refuse toute ancienne sauvegarde (appareil resté sur l'ancienne progression)
  if (user.reset_le && (Number(b.reset) || 0) < user.reset_le) return json({ erreur: "Votre compte a été réinitialisé par l'administrateur.", reinitialise: user.reset_le }, 409);
  const triche = await controleTriche(env, user, b.data);
  if (triche.statut !== "refuse") {
    let avant = null;
    try { const pr = await env.DB.prepare("SELECT data FROM sauvegardes WHERE user_id = ?").bind(user.id).first(); avant = pr ? JSON.parse(pr.data)?.sauvegarde?.owned || {} : null; } catch {}
    enArrierePlan(ctx, noterDecouvertes(env, user, b.data, avant));
  }
  if (triche.statut !== "ok") {
    await journaliser(env, user.id, triche.statut === "refuse" ? "🚫 sauvegarde refusée (triche)" : "🚩 progression suspecte", triche.raisons.join(" · "), "anti-triche");
    enArrierePlan(ctx, (async () => {
      const r = await env.DB.prepare("INSERT OR IGNORE INTO notifs_envoyees (user_id, type, cle, cree_le) VALUES (?, 'triche', ?, ?)").bind(user.id, new Date().toISOString().slice(0, 10), maintenant()).run();
      if (r.meta.changes) await prevenirAdmins(env, { titre: triche.statut === "refuse" ? "🚫 Triche bloquée" : "🚩 Progression suspecte", texte: `${user.pseudo} : ${triche.raisons.join(" · ")}`, url: "./#admin" });
    })());
    if (triche.statut === "refuse") return json({ erreur: "Progression impossible détectée : votre sauvegarde a été rétablie.", triche: true, data: triche.precedent ? JSON.parse(triche.precedent) : null }, 409);
  }
  const n = (x) => Math.max(0, Math.min(100000, Math.floor(Number(x) || 0)));
  const vitrine = (Array.isArray(b.vitrine) ? b.vitrine : []).filter((id) => typeof id === "string" && CARTE_RE.test(id)).slice(0, 5);
  await env.DB.prepare(`INSERT INTO sauvegardes (user_id, data, maj, cartes, secretes, badges, vitrine) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, maj = excluded.maj, cartes = excluded.cartes,
    secretes = excluded.secretes, badges = excluded.badges, vitrine = excluded.vitrine`)
    .bind(user.id, JSON.stringify(b.data), maintenant(), n(b.resume?.cartes), n(b.resume?.secretes), n(b.resume?.badges), JSON.stringify(vitrine)).run();
  // Classement de la semaine : nombre de cartes au début de la semaine, et maintenant
  await env.DB.prepare(`INSERT INTO hebdo (user_id, semaine, cartes_debut, cartes) VALUES (?1, ?2, ?3, ?3)
    ON CONFLICT(user_id, semaine) DO UPDATE SET cartes = excluded.cartes`).bind(user.id, semaineCourante(), n(b.resume?.cartes)).run();
  await verifierParrainage(env, user, b.data, ctx);
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

route("GET", "profil/([A-Za-z0-9_-]{3,20})", async ({ env, p, user }) => {
  const u = await env.DB.prepare(`SELECT u.id, u.pseudo, u.admin, u.cree_le, u.premium_jusqu, u.temps_jeu, u.derniere_co, u.titre, u.cadre, u.confidentialite, u.banniere, s.cartes, s.secretes, s.badges, s.vitrine,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS messages, (SELECT trophees FROM arene WHERE user_id = u.id) AS trophees
    FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0`).bind(p[1]).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const moi = user?.id === u.id, conf = lireConfidentialite(u.confidentialite), voit = (k) => moi || conf[k];
  const a = await env.DB.prepare("SELECT trophees, victoires, defaites, deck FROM arene WHERE user_id = ?").bind(u.id).first();
  const rangs = await chargerRangs(env);
  const base = { pseudo: u.pseudo, admin: !!u.admin, creeLe: u.cree_le, cartes: u.cartes || 0, secretes: u.secretes || 0, badges: u.badges || 0, messages: u.messages, trophees: u.trophees || 0, premium: estPremium(u),
    tempsJeu: u.temps_jeu || 0, derniereCo: u.derniere_co, vitrine: voit("collection") ? JSON.parse(u.vitrine || "[]") : [], titre: u.titre, cadre: u.cadre, banniere: u.banniere || "corail",
    totalCartes: TOTAL_CARTES, rang: rangDe(a?.trophees ?? 1000, rangs), moi, confidentialite: moi ? conf : undefined };
  if (voit("statistiques")) Object.assign(base, { victoires: a?.victoires || 0, defaites: a?.defaites || 0 });
  if (voit("deck") && a?.deck) base.deck = JSON.parse(a.deck).map((x) => x.id);
  if (voit("historique")) {
    const [ar, du, rh] = await env.DB.batch([
      env.DB.prepare(`SELECT c.id, c.actions IS NOT NULL AS revoir, c.cree_le AS t, c.gagne, c.delta, c.classe, c.attaquant, ua.pseudo AS pa, ud.pseudo AS pd FROM combats c JOIN users ua ON ua.id = c.attaquant JOIN users ud ON ud.id = c.defenseur
        WHERE c.fini = 1 AND (c.attaquant = ?1 OR c.defenseur = ?1) ORDER BY c.id DESC LIMIT 10`).bind(u.id),
      env.DB.prepare(`SELECT d.id, d.fini_le AS t, d.gagnant, d.classe, d.points_a, d.points_b, d.a_id, ua.pseudo AS pa, ub.pseudo AS pb FROM duels d JOIN users ua ON ua.id = d.a_id JOIN users ub ON ub.id = d.b_id
        WHERE d.statut = 'fini' AND (d.a_id = ?1 OR d.b_id = ?1) ORDER BY d.id DESC LIMIT 10`).bind(u.id),
      env.DB.prepare("SELECT ancien, nouveau, trophees, cree_le FROM rangs_historique WHERE user_id = ? ORDER BY id DESC LIMIT 10").bind(u.id),
    ]);
    base.matchs = [
      ...ar.results.map((c) => { const att = c.attaquant === u.id; return { id: c.id, type: "arene", revoir: !!c.revoir, t: c.t, mode: "Arène", adversaire: att ? c.pd : c.pa, gagne: att ? !!c.gagne : !c.gagne, points: c.classe ? (att ? c.delta : -Math.round((c.delta || 0) / 2)) : null }; }),
      ...du.results.map((d) => { const estA = d.a_id === u.id; return { id: d.id, type: "duel", revoir: true, t: d.t, mode: d.classe ? "Duel classé" : "Duel amical", adversaire: estA ? d.pb : d.pa, gagne: d.gagnant === u.id, points: d.classe ? (estA ? d.points_a : d.points_b) : null }; }),
    ].sort((x, y) => y.t - x.t).slice(0, 12);
    base.historiqueRangs = rh.results;
  }
  base.champion = (await env.DB.prepare("SELECT saison FROM champions WHERE user_id = ? ORDER BY saison DESC").bind(u.id).all()).results.map((x) => x.saison);
  if (voit("succes")) base.succes = (await calculerSucces(env, u.id, rangs)).filter((x) => x.fait).map((x) => ({ cle: x.cle, nom: x.nom, icone: x.icone, desc: x.desc }));
  return json(base);
});
route("PUT", "profil/reglages", async ({ request, env, user }) => {
  const b = await corps(request);
  const conf = lireConfidentialite(null);
  for (const k of Object.keys(conf)) if (b.confidentialite && k in b.confidentialite) conf[k] = !!b.confidentialite[k];
  const banniere = BANNIERES.includes(b.banniere) ? b.banniere : "corail";
  await env.DB.prepare("UPDATE users SET confidentialite = ?, banniere = ? WHERE id = ?").bind(JSON.stringify(conf), banniere, user.id).run();
  return json({ ok: true, confidentialite: conf, banniere });
}, { connecte: true });

// ----- Cadeaux -----
route("GET", "cadeaux", async ({ env, user }) => {
  const r = await env.DB.prepare(`SELECT c.id, c.pieces, c.boosters, c.boosters_detail, c.message FROM cadeaux c
    WHERE (c.user_id = ?1 OR c.user_id IS NULL) AND NOT EXISTS (SELECT 1 FROM cadeaux_recus r WHERE r.cadeau_id = c.id AND r.user_id = ?1)
    ORDER BY c.id`).bind(user.id).all();
  return json({ cadeaux: r.results });
}, { connecte: true });

route("POST", "cadeaux/(\\d+)/recevoir", async ({ env, user, p }) => {
  const c = await env.DB.prepare("SELECT * FROM cadeaux WHERE id = ? AND (user_id = ? OR user_id IS NULL)").bind(p[1], user.id).first();
  if (!c) return erreur("Cadeau introuvable.", 404);
  const r = await env.DB.prepare("INSERT OR IGNORE INTO cadeaux_recus (cadeau_id, user_id) VALUES (?, ?)").bind(c.id, user.id).run();
  if (!r.meta.changes) return erreur("Cadeau déjà reçu.", 409);
  let detail = {}; try { detail = JSON.parse(c.boosters_detail || "{}") || {}; } catch {}
  const totalDetail = Object.values(detail).reduce((t, n) => t + (Number(n) || 0), 0);
  await crediter(env, user.id, c.pieces, 0, c.boosters + totalDetail);
  return json({ pieces: c.pieces, boosters: c.boosters, detail, message: c.message });
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
  const notif = { titre: "🎁 Un cadeau vous attend !", texte: String(b.message || "").slice(0, 120) || "Ouvrez Play2F1 pour le recevoir.", url: "./" };
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
// Notifications intelligentes (toutes les 15 minutes) : une seule fois par sujet et par jour
async function notifierUneFois(env, userId, type, cle, notif) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO notifs_envoyees (user_id, type, cle, cree_le) VALUES (?, ?, ?, ?)").bind(userId, type, cle, maintenant()).run();
  if (r.meta.changes) await envoyerPush(env, userId, notif);
}
async function notificationsIntelligentes(env) {
  const t = maintenant();
  // 1) Série de connexion qui va se casser : pas venu depuis 19 à 23 h, série d'au moins 2 jours
  const { results: series } = await env.DB.prepare(`SELECT u.id, json_extract(s.data, '$.sauvegarde.connexion.serie') AS serie
    FROM users u JOIN sauvegardes s ON s.user_id = u.id
    WHERE u.banni = 0 AND u.derniere_co BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM abonnements a WHERE a.user_id = u.id)
      AND COALESCE(json_extract(s.data, '$.sauvegarde.connexion.serie'), 0) >= 2 LIMIT 200`).bind(t - 23 * 3600000, t - 19 * 3600000).all();
  for (const x of series) await notifierUneFois(env, x.id, "serie", new Date(t).toISOString().slice(0, 10),
    { titre: `🔥 Votre série de ${x.serie} jours va se casser !`, texte: "Revenez récupérer votre récompense du jour avant qu'elle ne reparte à zéro.", url: "./" });
  // 2) Enchère qui se termine dans 5 à 25 minutes : le vendeur et le joueur en tête sont prévenus
  const { results: ench } = await env.DB.prepare("SELECT * FROM encheres WHERE statut = 'ouverte' AND notif_fin = 0 AND fin BETWEEN ? AND ? LIMIT 50").bind(t + 5 * 60000, t + 25 * 60000).all();
  for (const e of ench) {
    await env.DB.prepare("UPDATE encheres SET notif_fin = 1 WHERE id = ?").bind(e.id).run();
    const min = Math.round((e.fin - t) / 60000);
    await envoyerPush(env, e.vendeur_id, { titre: "🔨 Votre enchère se termine bientôt", texte: `${e.nom} : fin dans ${min} min${e.offre ? ` · ${e.offre} 🪙 par ${e.acheteur}` : " · aucune offre pour l'instant"}.`, url: "./#encheres" });
    if (e.acheteur_id) await envoyerPush(env, e.acheteur_id, { titre: "🔨 Enchère presque finie !", texte: `Vous êtes en tête pour ${e.nom} (${e.offre} 🪙) : fin dans ${min} min. Restez vigilant !`, url: "./#encheres" });
  }
  // 3) Passe de saison : derniers jours du mois avec des récompenses à récupérer
  const fin = new Date(); const jourMois = fin.getUTCDate(), dernier = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 0)).getUTCDate();
  if (dernier - jourMois === 2 && fin.getUTCHours() === 17) {
    const { results: passes } = await env.DB.prepare("SELECT user_id FROM passes WHERE mois = ? LIMIT 300").bind(moisCourant()).all();
    for (const x of passes) await notifierUneFois(env, x.user_id, "passe-fin", moisCourant(), { titre: "🎟️ Votre passe se termine dans 2 jours", texte: "Pensez à récupérer toutes vos récompenses avant le changement de saison !", url: "./#passe" });
  }
  // 4) À 18 h (UTC) : il reste des combats classés aujourd'hui à ceux qui jouent en classé ces derniers jours
  if (new Date(t).getUTCHours() === 18) {
    const reg = await reglagesJeu(env);
    const { results: actifs } = await env.DB.prepare(`SELECT a.user_id, CASE WHEN a.classes_jour = ? THEN a.classes_nb ELSE 0 END AS faits FROM arene a
      WHERE EXISTS (SELECT 1 FROM abonnements ab WHERE ab.user_id = a.user_id) AND (EXISTS (SELECT 1 FROM combats c WHERE c.attaquant = a.user_id AND c.cree_le > ?)
        OR EXISTS (SELECT 1 FROM duels d WHERE (d.a_id = a.user_id OR d.b_id = a.user_id) AND d.fini_le > ?)) LIMIT 300`).bind(jourUTC(), t - 3 * JOUR, t - 3 * JOUR).all();
    for (const x of actifs) {
      const reste = reg.classe.parJour - (x.faits || 0);
      if (reste > 0) await notifierUneFois(env, x.user_id, "classes-restants", jourUTC(), { titre: `⚔️ Encore ${reste} combat${reste > 1 ? "s" : ""} classé${reste > 1 ? "s" : ""} aujourd'hui`, texte: "Grimpez dans votre ligue avant minuit : trouvez un adversaire en direct !", url: "./#ligues" });
    }
  }
  await env.DB.prepare("DELETE FROM notifs_envoyees WHERE cree_le < ?").bind(t - 40 * JOUR).run();
}
export async function planifie(env) {
  await preparerSchema(env);
  await cloturerEncheres(env);
  try { await notificationsIntelligentes(env); } catch (e) { console.error(e); }
  try { await cronTournoiDirect(env); } catch (e) { console.error(e); }
  try { await cloturerGuerres(env); } catch (e) { console.error(e); }
  try { await cronNotifs(env); } catch (e) { console.error(e); }
  try { await cronEvenement(env); } catch (e) { console.error(e); }
  try { await cloturerNations(env); } catch (e) { console.error(e); }
  const jourSync = new Date().toISOString().slice(0, 10), dejaJour = (await lireConfig(env, "sync_jour")) === jourSync;
  if (!dejaJour) await ecrireConfig(env, "sync_jour", jourSync);
  try { await syncSupabase(env, !dejaJour); } catch (e) { console.error(e); }
  if (!dejaJour) { try { await syncStripe(env); } catch (e) { console.error(e); } }
  const { results } = await env.DB.prepare("SELECT r.user_id FROM rappels r WHERE r.quand <= ? AND EXISTS (SELECT 1 FROM abonnements a WHERE a.user_id = r.user_id) LIMIT 300").bind(maintenant()).all();
  for (const { user_id } of results) {
    await env.DB.prepare("DELETE FROM rappels WHERE user_id = ?").bind(user_id).run();
    await envoyerPush(env, user_id, { titre: "🎁 Booster gratuit prêt !", texte: "Votre booster gratuit vous attend dans Play2F1.", url: "./#boosters" });
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
  if (user.stripe_client) await syncStripe(env, user.id, "passe").catch(() => {});
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
  for (const sa of Object.values(SAISONS_DATA.SAISONS_CARTES)) for (const x of sa.cartes) ajouter("saison:" + x[0].replace(/_/g, "-"), { type: "monument", rarete: x[4], nom: x[1] });
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
  if (!Array.isArray(ids) || ids.length !== COMBAT.TAILLE_DECK || new Set(ids).size !== ids.length) throw new ErreurApi(`Le deck doit contenir ${COMBAT.TAILLE_DECK} cartes différentes.`);
  const reg = await reglagesJeu(env);
  const speciales = ids.filter((id) => ["legendaire", "secrete"].includes(CATALOGUE[id]?.rarete)).length;
  if (speciales > reg.deck.maxLegendaires) throw new ErreurApi(`Maximum ${reg.deck.maxLegendaires} cartes légendaires ou secrètes par deck.`);
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
  if (cout > reg.deck.budget) throw new ErreurApi(`Deck trop coûteux (${cout}/${reg.deck.budget}).`);
  return unites;
}
const puissanceDeck = (d) => d.reduce((t, u) => t + COMBAT.puissance(u), 0);

route("GET", "arene/moi", async ({ env, user }) => {
  const a = await ligneArene(env, user.id), reg = await reglagesJeu(env), rangs = await chargerRangs(env);
  const rang = await env.DB.prepare("SELECT COUNT(*) + 1 AS r FROM arene a JOIN users u ON u.id = a.user_id WHERE a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 AND a.trophees > ?").bind(a.trophees).first();
  return json({ trophees: a.trophees, palier: palierArene(a.trophees), saison: saisonCourante(), finSaison: finSaison(), victoires: a.victoires, defaites: a.defaites, deck: !!a.deck, rang: a.deck ? rang.r : null,
    limite: limiteArene(user), restants: Math.max(0, limiteArene(user) - combatsFaits(a)),
    classes: { parJour: reg.classe.parJour, restants: classesRestants(a, reg) }, rangInfo: rangDe(a.trophees, rangs), tailleDeck: a.deck ? JSON.parse(a.deck).length : 0 });
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
  if (combatsFaits(a) >= ARENE_MAX_JOUR) return erreur(`Vous avez fait ${ARENE_MAX_JOUR} combats d'arène aujourd'hui. Revenez demain !`, 429);
  const recompense = combatsFaits(a) < limiteArene(user) ? 1 : 0;
  const classe = (await compterClasse(env, user.id)) ? 1 : 0;
  const adv = await env.DB.prepare("SELECT u.id, u.pseudo, a.deck FROM users u JOIN arene a ON a.user_id = u.id WHERE u.pseudo = ? AND u.banni = 0 AND a.deck IS NOT NULL").bind(String(b.pseudo || "")).first();
  if (!adv || adv.id === user.id) return erreur("Adversaire introuvable.", 404);
  const graine = crypto.getRandomValues(new Uint32Array(1))[0];
  const r = await env.DB.batch([
    env.DB.prepare("INSERT INTO combats (attaquant, defenseur, graine, a, b, cree_le, classe, recompense) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(user.id, adv.id, graine, a.deck, adv.deck, maintenant(), classe, recompense),
    env.DB.prepare("UPDATE arene SET nb = CASE WHEN jour = ? THEN nb + 1 ELSE 1 END, jour = ? WHERE user_id = ?").bind(jourUTC(), jourUTC(), user.id),
  ]);
  return json({ combat: r[0].meta.last_row_id, graine, adversaire: adv.pseudo, moi: JSON.parse(a.deck), lui: JSON.parse(adv.deck), classe: !!classe, recompense: !!recompense });
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
  // Au-delà des combats classés du jour, le combat reste possible mais ne rapporte plus de points
  const delta = c.classe ? Math.round(32 * ((gagne ? 1 : 0) - attendu)) : 0;
  const deltaDef = -Math.round(delta / 2);
  const pieces = c.recompense ? (gagne ? 60 : 15) : 0;
  if (c.classe) await ajouterPointsTournoi(env, user, gagne ? 100 : 25, gagne, true);
  if (c.classe && gagne) enArrierePlan(ctx, pointsNations(env, user.id, 3));
  await env.DB.batch([
    env.DB.prepare("UPDATE combats SET fini = 1, gagne = ?, delta = ?, actions = ? WHERE id = ?").bind(gagne ? 1 : 0, delta, JSON.stringify(actions), c.id),
    env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?), victoires = victoires + ?, defaites = defaites + ? WHERE user_id = ?").bind(delta, gagne ? 1 : 0, gagne ? 0 : 1, user.id),
    env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?) WHERE user_id = ?").bind(deltaDef, c.defenseur),
  ]);
  if (c.classe) {
    enArrierePlan(ctx, envoyerPush(env, c.defenseur, gagne
      ? { titre: "⚔️ Votre deck a été battu", texte: `${user.pseudo} a vaincu votre défense (${deltaDef} 🏆). Prenez votre revanche !`, url: "./#combat" }
      : { titre: "🛡️ Défense réussie !", texte: `Votre deck a repoussé ${user.pseudo} (+${deltaDef} 🏆).`, url: "./#combat" }));
    const rangs = await chargerRangs(env);
    await majRang(env, ctx, user.id, moi.trophees, Math.max(0, moi.trophees + delta), rangs);
    await majRang(env, ctx, c.defenseur, lui.trophees, Math.max(0, lui.trophees + deltaDef), rangs);
  }
  const rangs = await chargerRangs(env);
  return json({ gagne, delta, classe: !!c.classe, trophees: Math.max(0, moi.trophees + delta), pieces, rang: rangDe(Math.max(0, moi.trophees + delta), rangs) });
}, { connecte: true });
route("GET", "arene/classement", async ({ env }) => {
  const rangs = await chargerRangs(env);
  const { results } = await env.DB.prepare(`SELECT u.pseudo, u.admin, u.premium_jusqu, a.trophees, a.victoires, a.defaites FROM arene a JOIN users u ON u.id = a.user_id
    WHERE a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 ORDER BY a.trophees DESC, a.victoires DESC LIMIT 50`).all();
  return json({ saison: saisonCourante(), finSaison: finSaison(), joueurs: results.map((x) => ({ pseudo: x.pseudo, admin: !!x.admin, premium: estPremium(x), trophees: x.trophees, palier: palierArene(x.trophees), rang: rangDe(x.trophees, rangs), victoires: x.victoires, defaites: x.defaites })) });
});


/* =====================================================================
   Joueurs en ligne, temps de jeu, métriques et bouclier anti-bot
   ===================================================================== */
const EN_LIGNE_MS = 2 * 60000;
const ACTIVITE_VUE = new Map(); // évite d'écrire l'activité du jour à chaque signal
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
  let nouveauJour = false;
  if (user && ACTIVITE_VUE.get(user.id) !== jourUTC()) { ACTIVITE_VUE.set(user.id, jourUTC()); nouveauJour = true; requetes.push(env.DB.prepare("INSERT OR IGNORE INTO activite (user_id, jour) VALUES (?, ?)").bind(user.id, jourUTC())); }
  if (requetes.length) await env.DB.batch(requetes);
  if (nouveauJour) { const r = await env.DB.prepare("INSERT OR IGNORE INTO notifs_envoyees (user_id, type, cle, cree_le) VALUES (?, 'nation-jour', ?, ?)").bind(user.id, jourUTC(), maintenant()).run(); if (r.meta.changes) await pointsNations(env, user.id, 1); }
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
    await prevenirAdmins(env, { titre: "🚨 Alerte sécurité Play2F1", texte: details, url: "./#admin" });
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
  if (liste.length === 120 || (robot && liste.length === 1)) {
    const details = robot ? `Robot suspect (${agent.slice(0, 60)}) depuis ${ip}` : `Rafale de ${liste.length} requêtes en 10 s depuis ${ip}`;
    enArrierePlan(ctx, signalerMenace(env, ip, robot ? "robot" : "rafale", details));
  }
  if (liste.length > 120 && await bouclierActif(env)) { BLOQUEES.set(ip, t + 10 * 60000); return erreur("Trop de requêtes : protection anti-robot activée.", 429); }
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
  if (results.length) {
    await env.DB.prepare(`DELETE FROM livraisons WHERE user_id = ? AND id <= ?`).bind(user.id, results[results.length - 1].id).run();
    await crediter(env, user.id, results.reduce((t, l) => t + (l.pieces || 0), 0), results.filter((l) => l.carte).length, 0);
  }
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
  const e = await lireConfig(env, "evenement"), t = maintenant();
  const actif = e && e.fin > t && (e.debut || 0) <= t;
  return json({ evenement: actif ? { cle: e.cle, debut: e.debut, fin: e.fin } : null, prochain: e && (e.debut || 0) > t ? { cle: e.cle, debut: e.debut, fin: e.fin } : null });
});
// Annonce (notification + Discord) au moment où un événement programmé commence
async function annoncerEvenement(env, ev) {
  await annoncerDiscord(env, "evenements", { titre: `🎉 Événement : ${NOM_EVENEMENT(ev.cle)} !`, texte: `Booster limité et cartes exclusives jusqu'au ${new Date(ev.fin).toLocaleString("fr-FR", { timeZone: "Europe/Brussels", dateStyle: "long", timeStyle: "short" })}. Ne le ratez pas !`, url: "./#boosters", couleur: 0x9b51e0 });
  if (ev.prevenir) {
    const { results } = await env.DB.prepare("SELECT DISTINCT user_id FROM abonnements LIMIT 1000").all();
    for (const { user_id } of results) await envoyerPush(env, user_id, { titre: `🎉 Événement : ${NOM_EVENEMENT(ev.cle)} !`, texte: "Booster limité et cartes exclusives : c'est parti !", url: "./#boosters" });
  }
}
async function cronEvenement(env) {
  const e = await lireConfig(env, "evenement");
  if (!e || e.annonce || (e.debut || 0) > maintenant() || e.fin <= maintenant()) return;
  await ecrireConfig(env, "evenement", { ...e, annonce: true });
  await annoncerEvenement(env, e);
}
route("POST", "admin/evenement", async ({ request, env, ctx }) => {
  const b = await corps(request);
  if (!b.cle) { await ecrireConfig(env, "evenement", null); return json({ ok: true, evenement: null }); }
  if (!EVENEMENTS.includes(b.cle)) return erreur("Événement inconnu.");
  const jours = Math.max(1, Math.min(60, Number(b.jours) || 7));
  const t = maintenant(), debut = Number(b.debut) > t + 60000 ? Math.min(Number(b.debut), t + 90 * JOUR) : t;
  const ev = { cle: b.cle, debut, fin: debut + Math.round(jours * JOUR), prevenir: !!b.prevenir, annonce: debut <= t };
  await ecrireConfig(env, "evenement", ev);
  if (ev.annonce) enArrierePlan(ctx, annoncerEvenement(env, ev));
  return json({ ok: true, evenement: debut <= t ? ev : null, prochain: debut > t ? ev : null });
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
  const rangs = await chargerRangs(env);
  // Champion de la saison : le n° 1 reçoit un titre, un booster Prestige et des boosters Or
  const top = results.slice().sort((a, b) => b.trophees - a.trophees)[0];
  if (top) {
    const u = await env.DB.prepare("SELECT pseudo FROM users WHERE id = ?").bind(top.user_id).first();
    const r = await env.DB.prepare("INSERT OR IGNORE INTO champions (saison, user_id, pseudo, trophees, cree_le) VALUES (?, ?, ?, ?, ?)").bind(derniere, top.user_id, u?.pseudo || "?", top.trophees, maintenant()).run();
    if (r.meta.changes) {
      await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, boosters_detail, message, cree_le) VALUES (?, 5000, 0, ?, ?, ?)").bind(top.user_id, JSON.stringify({ prestige: 1, or: 3 }), `🏆 Champion de la saison ${derniere} : félicitations !`, maintenant()).run();
      await envoyerPush(env, top.user_id, { titre: "🏆 Champion de la saison !", texte: `Vous terminez n° 1 de la saison ${derniere}. Votre récompense vous attend.`, url: "./#ligues" }).catch(() => {});
    }
  }
  for (const x of results) {
    // Récompense du rang atteint (réglable dans l'admin) ; à défaut, l'ancien barème des paliers
    const rg = rangDe(x.trophees, rangs), p = PALIERS.find(([min]) => x.trophees >= min);
    const pieces = rg ? rg.recompense.pieces : p[3], boosters = rg ? rg.recompense.boosters : p[4], nom = rg ? rg.nom : p[2];
    await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(x.user_id, pieces, boosters, `Fin de la saison d'arène ${derniere} : rang ${nom} !`, maintenant()).run();
  }
  // Remise à niveau douce : on se rapproche de 1000 trophées
  await env.DB.prepare("UPDATE arene SET trophees = 1000 + (trophees - 1000) / 2, victoires = 0, defaites = 0").run();
}

/* =====================================================================
   Paiement automatique PayPal (Checkout) : activé si PAYPAL_CLIENT_ID et PAYPAL_SECRET sont configurés
   ===================================================================== */
const PRIX_FORMULES = { mois: "3.99", an: "29.99", vie: "89.99", passe: "7.99" };
const urlPaypal = (env) => (env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
async function jetonPaypal(env) {
  const r = await fetch(urlPaypal(env) + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!r.ok) throw new ErreurApi("PayPal est indisponible pour le moment.", 502);
  return (await r.json()).access_token;
}
route("GET", "premium/config", async ({ env }) => json({ paypalClientId: env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET ? env.PAYPAL_CLIENT_ID : null, stripe: !!(await secret(env, "STRIPE_SECRET_KEY")), prix: PRIX_FORMULES }));
route("POST", "premium/paypal/commande", async ({ request, env, user }) => {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return erreur("Paiement automatique non configuré.", 503);
  const b = await corps(request);
  const formule = PRIX_FORMULES[b.formule] ? b.formule : "mois";
  const r = await fetch(urlPaypal(env) + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + await jetonPaypal(env), "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "EUR", value: PRIX_FORMULES[formule] }, description: formule === "passe" ? `Play2F1 Passe de saison (${moisCourant()})` : `Play2F1 Premium (${formule})`, custom_id: `${user.id}:${formule}` }] }) });
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
  // Plus personne ne joue depuis 10 minutes : le duel est annulé, sans points
  if (d.limite && maintenant() > d.limite + 10 * 60000) {
    await env.DB.prepare("UPDATE duels SET statut = 'annule', fini_le = ? WHERE id = ? AND statut = 'encours'").bind(maintenant(), d.id).run();
    console.log(JSON.stringify({ duel: d.id, evenement: "expire" }));
    return { ...d, statut: "annule" };
  }
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
    await terminerDuelClasse(env, d);
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
    gagne: d.statut === "fini" ? d.gagnant === user.id : null, pieces, classe: !!d.classe, points: moiA ? d.points_a ?? null : d.points_b ?? null };
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
  if (JSON.parse(moi.deck).length !== COMBAT.TAILLE_DECK) return erreur(`Votre deck doit contenir ${COMBAT.TAILLE_DECK} cartes.`);
  const classe = b.classe ? 1 : 0;
  await env.DB.prepare("UPDATE duels SET statut = 'annule' WHERE a_id = ? AND statut = 'invite'").bind(user.id).run();
  const r = await env.DB.prepare("INSERT INTO duels (a_id, b_id, graine, deck_a, cree_le, classe) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(user.id, ami.id, crypto.getRandomValues(new Uint32Array(1))[0], moi.deck, maintenant(), classe).run();
  enArrierePlan(ctx, envoyerPush(env, ami.id, { titre: classe ? "🏆 Duel classé en direct !" : "⚔️ Duel amical en direct !", texte: `${user.pseudo} vous défie en direct. Acceptez vite !`, url: "./#combat" }));
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("GET", "duels/invitations", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT d.id, u.pseudo, d.cree_le, d.classe FROM duels d JOIN users u ON u.id = d.a_id
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
  if (JSON.parse(moi.deck).length !== COMBAT.TAILLE_DECK) return erreur(`Votre deck doit contenir ${COMBAT.TAILLE_DECK} cartes.`);
  const r0 = await env.DB.prepare("UPDATE duels SET statut = 'encours', deck_b = ?, limite = ? WHERE id = ? AND statut = 'invite'").bind(moi.deck, maintenant() + CHRONO_DUEL + 3000, d.id).run();
  if (!r0.meta.changes) return erreur("Cette invitation n'est plus valable.");
  console.log(JSON.stringify({ duel: d.id, evenement: "debut", classe: d.classe }));
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
  const action = COMBAT.actionValide(String(b.action || "")) ? String(b.action) : "attaque";
  const col = d.a_id === user.id ? "choix_a" : "choix_b";
  await env.DB.prepare(`UPDATE duels SET ${col} = ? WHERE id = ? AND ${col} IS NULL`).bind(action, d.id).run();
  d = await avancerDuel(env, await lireDuel(env, p[1], user));
  return json(await vueDuel(env, d, user));
}, { connecte: true });
route("POST", "duels/(\\d+)/abandon", async ({ env, user, p }) => {
  const d = await lireDuel(env, p[1], user);
  if (d.statut === "encours" || d.statut === "invite") {
    const autre = d.a_id === user.id ? d.b_id : d.a_id;
    const r = await env.DB.prepare("UPDATE duels SET statut = ?, gagnant = ?, fini_le = ? WHERE id = ? AND statut = ?").bind(d.statut === "invite" ? "annule" : "fini", d.statut === "invite" ? null : autre, maintenant(), d.id, d.statut).run();
    // Un abandon en cours de duel classé compte comme une défaite
    if (r.meta.changes && d.statut === "encours") { console.log(JSON.stringify({ duel: d.id, evenement: "abandon", joueur: user.id })); await terminerDuelClasse(env, { ...d, statut: "fini", gagnant: autre }); }
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

/* =====================================================================
   Clés secrètes : variables Cloudflare (prioritaires) ou saisies par l'admin (stockées dans D1, jamais renvoyées)
   ===================================================================== */
const CLES_SECRETES = { STRIPE_SECRET_KEY: /^(sk|rk)_(live|test)_[A-Za-z0-9]{20,}$/, SUPABASE_SECRET_KEY: /^(sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_.-]{100,})$/ };
async function secret(env, nom) { return env[nom] || (await lireConfig(env, "secret:" + nom)) || null; }
const masquer = (v) => (v ? v.slice(0, 8) + "…" + v.slice(-4) : null);

/* =====================================================================
   Stripe : paiement par carte (Checkout), abonnements renouvelés automatiquement, portail client
   ===================================================================== */
const PRIX_STRIPE = { mois: "price_1UPY5eLe08eGeK8a4HklrJGs", an: "price_1UPY5eLe08eGeK8aB6MTLmrx", vie: "price_1UPY5eLe08eGeK8aBGweOgzF", passe: "price_1UPY9JLe08eGeK8avxM6LU4r" };
function formStripe(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const cle = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formStripe(v, cle, out); else out.append(cle, String(v));
  }
  return out;
}
async function stripeApi(env, methode, chemin, params) {
  const cle = await secret(env, "STRIPE_SECRET_KEY");
  if (!cle) throw new ErreurApi("Le paiement par carte n'est pas encore configuré.", 503);
  let r;
  try {
    r = await fetch("https://api.stripe.com/v1/" + chemin + (methode === "GET" && params ? "?" + formStripe(params) : ""), {
      method: methode, headers: { Authorization: "Bearer " + cle, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
      body: methode === "GET" ? undefined : formStripe(params || {}),
    });
  } catch { throw new ErreurApi("Impossible de joindre Stripe pour le moment.", 502); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErreurApi("Stripe : " + (j.error?.message || `erreur ${r.status}`), 502);
  return j;
}
const finPeriode = (sub) => 1000 * (sub.current_period_end || sub.items?.data?.[0]?.current_period_end || 0);
// Applique l'état d'un abonnement Stripe au joueur (Premium prolongé ou passe du mois activé)
async function appliquerAbonnement(env, ctx, userId, formule, sub) {
  const fin = finPeriode(sub), actif = ["active", "trialing", "past_due"].includes(sub.status);
  await env.DB.prepare(`INSERT INTO abonnements_stripe (abonnement, user_id, formule, client, statut, fin, maj) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(abonnement) DO UPDATE SET statut = excluded.statut, fin = excluded.fin, maj = excluded.maj`).bind(sub.id, userId, formule, sub.customer, sub.status, fin, maintenant()).run();
  if (!actif) return;
  if (formule === "passe") await env.DB.prepare("INSERT OR IGNORE INTO passes (user_id, mois, cree_le) VALUES (?, ?, ?)").bind(userId, moisCourant(), maintenant()).run();
  else await env.DB.prepare("UPDATE users SET premium_jusqu = MAX(COALESCE(premium_jusqu, 0), ?) WHERE id = ? AND COALESCE(premium_jusqu, 0) < ?").bind(fin + JOUR, userId, PREMIUM_VIE).run();
}
async function syncStripe(env, userId = null, formule = null) {
  const conditions = [], valeurs = [];
  if (userId) { conditions.push("AND user_id = ?"); valeurs.push(userId); }
  if (formule) { conditions.push("AND formule = ?"); valeurs.push(formule); }
  const { results } = await env.DB.prepare(`SELECT * FROM abonnements_stripe WHERE statut IN ('active', 'trialing', 'past_due', 'incomplete') ${conditions.join(" ")} LIMIT 200`).bind(...valeurs).all();
  for (const a of results) {
    try { await appliquerAbonnement(env, null, a.user_id, a.formule, await stripeApi(env, "GET", "subscriptions/" + a.abonnement)); } catch (e) { console.error(e); }
  }
  return results.length;
}
route("POST", "stripe/checkout", async ({ request, env, user }) => {
  const b = await corps(request);
  const formule = PRIX_STRIPE[b.formule] ? b.formule : null;
  if (!formule) return erreur("Formule inconnue.");
  if (formule === "passe" && await env.DB.prepare("SELECT 1 FROM passes WHERE user_id = ? AND mois = ?").bind(user.id, moisCourant()).first()) return erreur("Votre passe de saison est déjà actif ce mois-ci.");
  if (formule !== "passe" && (user.premium_jusqu || 0) >= PREMIUM_VIE) return erreur("Vous êtes déjà Premium à vie !");
  if (formule !== "passe" && await env.DB.prepare("SELECT 1 FROM abonnements_stripe WHERE user_id = ? AND formule IN ('mois', 'an') AND statut IN ('active', 'trialing')").bind(user.id).first() && formule !== "vie")
    return erreur("Vous avez déjà un abonnement Premium actif : gérez-le avec « Gérer mon abonnement ».");
  const origine = new URL(request.url).origin, meta = { user_id: String(user.id), formule, pseudo: user.pseudo, createur: user.code_createur || undefined };
  const session = await stripeApi(env, "POST", "checkout/sessions", {
    mode: formule === "vie" ? "payment" : "subscription",
    line_items: [{ price: PRIX_STRIPE[formule], quantity: 1 }],
    success_url: `${origine}/?stripe_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/?stripe=annule#${formule === "passe" ? "passe" : "premium"}`,
    client_reference_id: String(user.id), metadata: meta, locale: "fr", allow_promotion_codes: "true",
    customer: user.stripe_client || undefined,
    customer_creation: !user.stripe_client && formule === "vie" ? "always" : undefined,
    subscription_data: formule === "vie" ? undefined : { metadata: meta },
    payment_intent_data: formule === "vie" ? { metadata: meta } : undefined,
  });
  return json({ url: session.url });
}, { connecte: true });
route("POST", "stripe/valider", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const id = String(b.session || "");
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return erreur("Session de paiement invalide.");
  const s = await stripeApi(env, "GET", "checkout/sessions/" + id, { expand: ["subscription"] });
  const formule = s.metadata?.formule;
  if (s.metadata?.user_id !== String(user.id) || (!PRIX_STRIPE[formule] && formule !== "pack")) return erreur("Ce paiement ne correspond pas à votre compte.", 403);
  if (s.status !== "complete" || !["paid", "no_payment_required"].includes(s.payment_status)) return erreur("Le paiement n'est pas encore confirmé.", 402);
  await activerSessionStripe(env, ctx, s);
  const u = await env.DB.prepare("SELECT premium_jusqu FROM users WHERE id = ?").bind(user.id).first();
  return json({ ok: true, formule, pack: s.metadata?.pack || null, nomPack: s.metadata?.nom || null, premiumJusqu: u.premium_jusqu });
}, { connecte: true });
const NOMS_FORMULES = { mois: "Premium mensuel", an: "Premium annuel", vie: "Premium à vie", passe: "Passe de saison" };
// Active l'achat d'une session Checkout payée (appelé au retour sur le site ET par le webhook : sans double effet)
async function activerSessionStripe(env, ctx, s) {
  const userId = Number(s.metadata?.user_id), formule = s.metadata?.formule;
  if (userId && formule === "pack") return livrerPack(env, ctx, s, userId);
  if (!userId || !PRIX_STRIPE[formule]) return;
  const neuf = await env.DB.prepare("INSERT OR IGNORE INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'paye', ?)")
    .bind(s.id, userId, formule, ((s.amount_total || 0) / 100).toFixed(2), maintenant()).run();
  if (s.customer) await env.DB.prepare("UPDATE users SET stripe_client = ? WHERE id = ?").bind(typeof s.customer === "string" ? s.customer : s.customer.id, userId).run();
  if (formule === "vie") await env.DB.prepare("UPDATE users SET premium_jusqu = ? WHERE id = ?").bind(PREMIUM_VIE, userId).run();
  else if (s.subscription) await appliquerAbonnement(env, ctx, userId, formule, typeof s.subscription === "string" ? await stripeApi(env, "GET", "subscriptions/" + s.subscription) : s.subscription);
  if (neuf.meta.changes) {
    await enregistrerVenteCreateur(env, s, userId);
    const u = await env.DB.prepare("SELECT pseudo FROM users WHERE id = ?").bind(userId).first();
    enArrierePlan(ctx, prevenirAdmins(env, { titre: "💰 Paiement Stripe reçu", texte: `${u?.pseudo} : ${NOMS_FORMULES[formule]} (${((s.amount_total || 0) / 100).toFixed(2)} €)`, url: "./#admin" }));
    enArrierePlan(ctx, envoyerPush(env, userId, { titre: formule === "passe" ? "🎟️ Passe de saison activé !" : "💎 Premium activé !", texte: "Merci pour votre achat. Bon jeu !", url: formule === "passe" ? "./#passe" : "./#premium" }));
  }
}
/* Webhook Stripe : Stripe prévient le serveur à la seconde (résiliation, renouvellement, paiement refusé, remboursement).
   Sécurité : on ne fait jamais confiance au contenu reçu, on relit l'événement chez Stripe avec la clé secrète. */
route("POST", "stripe/webhook", async ({ request, env, ctx }) => {
  let recu; try { recu = await request.json(); } catch { return erreur("Corps invalide."); }
  if (!/^evt_[A-Za-z0-9]+$/.test(String(recu?.id || ""))) return erreur("Événement invalide.");
  if (await env.DB.prepare("SELECT 1 FROM stripe_evenements WHERE id = ?").bind(recu.id).first()) return json({ ok: true, deja: true });
  let ev; try { ev = await stripeApi(env, "GET", "events/" + recu.id); } catch { return erreur("Événement introuvable chez Stripe.", 400); }
  const o = ev.data?.object || {};
  const meta = o.metadata || {};
  let userId = Number(meta.user_id) || null, resume = ev.type;
  const pseudoDe = async (id) => (await env.DB.prepare("SELECT pseudo FROM users WHERE id = ?").bind(id).first())?.pseudo || "?";
  if (ev.type === "checkout.session.completed" && ["paid", "no_payment_required"].includes(o.payment_status)) {
    await activerSessionStripe(env, ctx, o); resume = `Achat ${NOMS_FORMULES[meta.formule] || ""}`;
  } else if (ev.type.startsWith("customer.subscription.")) {
    const a = await env.DB.prepare("SELECT user_id, formule FROM abonnements_stripe WHERE abonnement = ?").bind(o.id).first();
    userId = userId || a?.user_id; const formule = meta.formule || a?.formule;
    if (userId && formule) await appliquerAbonnement(env, ctx, userId, formule, o);
    if (userId && ev.type === "customer.subscription.deleted") {
      resume = `Abonnement terminé (${NOMS_FORMULES[formule] || formule})`;
      enArrierePlan(ctx, envoyerPush(env, userId, { titre: "Abonnement terminé", texte: `Votre ${NOMS_FORMULES[formule] || "abonnement"} a pris fin. Vous pouvez vous réabonner à tout moment.`, url: "./#premium" }));
      enArrierePlan(ctx, prevenirAdmins(env, { titre: "📉 Résiliation", texte: `${await pseudoDe(userId)} : ${NOMS_FORMULES[formule] || formule} terminé.`, url: "./#admin" }));
    } else if (userId && o.cancel_at_period_end && ev.data?.previous_attributes?.cancel_at_period_end === false) {
      resume = `Résiliation programmée (${NOMS_FORMULES[formule] || formule})`;
      enArrierePlan(ctx, prevenirAdmins(env, { titre: "📉 Résiliation programmée", texte: `${await pseudoDe(userId)} a résilié son ${NOMS_FORMULES[formule] || formule} (actif jusqu'à la fin de la période).`, url: "./#admin" }));
    }
  } else if (ev.type === "invoice.paid" || ev.type === "invoice.payment_failed") {
    const subId = typeof o.subscription === "string" ? o.subscription : o.subscription?.id || o.parent?.subscription_details?.subscription;
    const a = subId ? await env.DB.prepare("SELECT user_id, formule FROM abonnements_stripe WHERE abonnement = ?").bind(subId).first() : null;
    userId = userId || a?.user_id;
    if (a && subId) await appliquerAbonnement(env, ctx, a.user_id, a.formule, await stripeApi(env, "GET", "subscriptions/" + subId));
    if (ev.type === "invoice.paid") {
      resume = `Renouvellement payé (${((o.amount_paid || 0) / 100).toFixed(2)} €)`;
      // Les renouvellements comptent dans les ventes (la 1re facture est déjà comptée par l'achat)
      if (a && o.billing_reason !== "subscription_create" && o.amount_paid > 0) await env.DB.prepare("INSERT OR IGNORE INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'paye', ?)").bind(o.id, a.user_id, a.formule, (o.amount_paid / 100).toFixed(2), maintenant()).run();
    }
    else if (userId) {
      resume = "Paiement refusé";
      enArrierePlan(ctx, envoyerPush(env, userId, { titre: "⚠️ Paiement refusé", texte: "Le renouvellement de votre abonnement a échoué : mettez à jour votre carte depuis la page Premium.", url: "./#premium" }));
      enArrierePlan(ctx, prevenirAdmins(env, { titre: "⚠️ Paiement refusé", texte: `${await pseudoDe(userId)} : renouvellement ${NOMS_FORMULES[a?.formule] || ""} refusé.`, url: "./#admin" }));
    }
  } else if (ev.type === "charge.refunded" || ev.type === "charge.dispute.created") {
    const pi = typeof o.payment_intent === "string" ? await stripeApi(env, "GET", "payment_intents/" + o.payment_intent).catch(() => null) : o.payment_intent;
    userId = userId || Number(pi?.metadata?.user_id) || null;
    const formule = pi?.metadata?.formule;
    resume = ev.type === "charge.refunded" ? `Remboursement ${((o.amount_refunded || 0) / 100).toFixed(2)} €` : "Contestation de paiement (litige)";
    // Premium à vie remboursé en totalité (ou contesté) : il est retiré
    if (userId && formule === "vie" && (o.refunded || ev.type === "charge.dispute.created")) {
      await env.DB.prepare("UPDATE users SET premium_jusqu = ? WHERE id = ?").bind(maintenant(), userId).run();
      await journaliser(env, userId, "Premium à vie retiré", resume, "Stripe");
    }
    enArrierePlan(ctx, prevenirAdmins(env, { titre: ev.type === "charge.refunded" ? "↩️ Remboursement Stripe" : "🚨 Litige Stripe", texte: `${userId ? await pseudoDe(userId) : "Client"} : ${resume}`, url: "./#admin" }));
  }
  await env.DB.prepare("INSERT OR IGNORE INTO stripe_evenements (id, type, user_id, resume, cree_le) VALUES (?, ?, ?, ?, ?)").bind(ev.id, ev.type, userId, resume, maintenant()).run();
  return json({ ok: true });
});
// Tableau de bord des ventes (admin)
route("GET", "admin/ventes", async ({ env }) => {
  const d = new Date(), debutMois = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const debut6 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 5, 1);
  const [mois, parFormule, actifs, resil, events, historique] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(CAST(montant AS REAL)), 0) AS total FROM paiements WHERE statut = 'paye' AND cree_le >= ?").bind(debutMois),
    env.DB.prepare("SELECT formule, CASE WHEN commande LIKE 'cs_%' OR commande LIKE 'in_%' THEN 'stripe' ELSE 'paypal' END AS source, COUNT(*) AS n, COALESCE(SUM(CAST(montant AS REAL)), 0) AS total FROM paiements WHERE statut = 'paye' AND cree_le >= ? GROUP BY formule, source").bind(debutMois),
    env.DB.prepare("SELECT formule, COUNT(*) AS n FROM abonnements_stripe WHERE statut IN ('active', 'trialing', 'past_due') GROUP BY formule"),
    env.DB.prepare("SELECT type, COUNT(*) AS n FROM stripe_evenements WHERE cree_le >= ? AND type IN ('customer.subscription.deleted', 'invoice.payment_failed', 'charge.refunded', 'charge.dispute.created') GROUP BY type").bind(debutMois),
    env.DB.prepare("SELECT e.type, e.resume, e.cree_le, u.pseudo FROM stripe_evenements e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.cree_le DESC LIMIT 25"),
    env.DB.prepare("SELECT strftime('%Y-%m', cree_le / 1000, 'unixepoch') AS mois, COALESCE(SUM(CAST(montant AS REAL)), 0) AS total, COUNT(*) AS n FROM paiements WHERE statut = 'paye' AND cree_le >= ? GROUP BY mois ORDER BY mois").bind(debut6),
  ]);
  const nbActifs = Object.fromEntries(actifs.results.map((x) => [x.formule, x.n]));
  const mrr = (nbActifs.mois || 0) * 3.99 + (nbActifs.an || 0) * 29.99 / 12 + (nbActifs.passe || 0) * 7.99;
  const premiumsVie = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE premium_jusqu >= ?").bind(PREMIUM_VIE).first();
  const premiums = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE premium_jusqu > ?").bind(maintenant()).first();
  return json({ mois: { ventes: mois.results[0].n, total: Math.round(mois.results[0].total * 100) / 100 }, parFormule: parFormule.results, abonnesActifs: nbActifs,
    mrr: Math.round(mrr * 100) / 100, problemes: Object.fromEntries(resil.results.map((x) => [x.type, x.n])), evenements: events.results, historique: historique.results,
    premiumsVie: premiumsVie.n, premiumsActifs: premiums.n, supabase: await lireConfig(env, "supabase_sync") });
}, { admin: true });
// Portail Stripe : changer de carte, voir les factures, résilier
route("POST", "stripe/portail", async ({ request, env, user }) => {
  if (!user.stripe_client) return erreur("Aucun abonnement Stripe sur ce compte.");
  const p = await stripeApi(env, "POST", "billing_portal/sessions", { customer: user.stripe_client, return_url: new URL(request.url).origin + "/#premium", locale: "fr" });
  return json({ url: p.url });
}, { connecte: true });

/* =====================================================================
   Copie de sauvegarde vers Supabase (comptes, sauvegardes, Premium, passes, paiements, guildes, modération)
   ===================================================================== */
const SUPABASE_URL = "https://jkttkmuckwyfazsjxgga.supabase.co";
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
async function envoyerSupabase(env, cle, table, lignes, conflit) {
  if (!lignes.length) return 0;
  const entetes = { apikey: cle, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
  if (cle.startsWith("eyJ")) entetes.Authorization = "Bearer " + cle;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflit}`, { method: "POST", headers: entetes, body: JSON.stringify(lignes) });
  if (!r.ok) throw new Error(`Supabase ${table} : ${r.status} ${(await r.text()).slice(0, 200)}`);
  return lignes.length;
}
async function syncSupabase(env, complet = false) {
  const cle = await secret(env, "SUPABASE_SECRET_KEY");
  if (!cle) return null;
  const depuis = complet ? 0 : (await lireConfig(env, "supabase_sync"))?.t || 0, t0 = maintenant(), n = {};
  const lots = async (table, conflit, sql, binds, conv, taille) => {
    n[table] = 0;
    for (let off = 0; ; off += taille) {
      const { results } = await env.DB.prepare(`${sql} LIMIT ${taille} OFFSET ${off}`).bind(...binds).all();
      n[table] += await envoyerSupabase(env, cle, table, results.map(conv), conflit);
      if (results.length < taille) break;
    }
  };
  await lots("joueurs", "id", "SELECT * FROM users WHERE cree_le > ?1 OR COALESCE(derniere_co, 0) > ?1 OR ?1 = 0 OR id IN (SELECT user_id FROM sauvegardes WHERE maj > ?1) ORDER BY id", [depuis],
    (u) => ({ id: u.id, pseudo: u.pseudo, admin: !!u.admin, banni: !!u.banni, cree_le: iso(u.cree_le), derniere_co: iso(u.derniere_co), premium_jusqu: iso(u.premium_jusqu), temps_jeu: u.temps_jeu || 0,
      titre: u.titre, cadre: u.cadre, hash: u.hash, sel: u.sel, reset_le: iso(u.reset_le), maj: iso(t0) }), 400);
  await lots("sauvegardes", "user_id", "SELECT * FROM sauvegardes WHERE maj > ? ORDER BY user_id", [depuis],
    (x) => ({ user_id: x.user_id, data: JSON.parse(x.data), cartes: x.cartes || 0, secretes: x.secretes || 0, badges: x.badges || 0, maj: iso(x.maj) }), 20);
  await lots("paiements", "commande", "SELECT * FROM paiements WHERE cree_le > ? ORDER BY cree_le", [complet ? 0 : depuis - JOUR],
    (x) => ({ commande: x.commande, user_id: x.user_id, formule: x.formule, montant: x.montant, fournisseur: x.commande.startsWith("cs_") ? "stripe" : "paypal", statut: x.statut, cree_le: iso(x.cree_le) }), 400);
  await lots("passes", "user_id,mois", "SELECT * FROM passes WHERE cree_le > ? ORDER BY cree_le", [complet ? 0 : depuis - JOUR],
    (x) => ({ user_id: x.user_id, mois: x.mois, cree_le: iso(x.cree_le) }), 400);
  await lots("abonnements", "stripe_subscription", "SELECT * FROM abonnements_stripe WHERE maj > ? ORDER BY maj", [complet ? 0 : depuis - JOUR],
    (x) => ({ stripe_subscription: x.abonnement, user_id: x.user_id, formule: x.formule, stripe_customer: x.client, statut: x.statut, fin: iso(x.fin), maj: iso(x.maj) }), 400);
  await lots("moderation", "id", "SELECT * FROM moderation WHERE cree_le > ? ORDER BY id", [complet ? 0 : depuis - JOUR],
    (x) => ({ id: x.id, user_id: x.user_id, action: x.action, details: x.details, par: x.par, cree_le: iso(x.cree_le) }), 400);
  if (complet || !depuis) await lots("guildes", "id", `SELECT g.*, (SELECT json_group_array(json_object('user_id', m.user_id, 'role', m.role)) FROM guilde_membres m WHERE m.guilde_id = g.id) AS membres FROM guildes g ORDER BY id`, [],
    (g) => ({ id: g.id, nom: g.nom, tag: g.tag, embleme: g.embleme, description: g.description, chef_id: g.chef_id, membres: JSON.parse(g.membres || "[]"), maj: iso(t0) }), 200);
  await ecrireConfig(env, "supabase_sync", { t: t0, n, complet });
  return n;
}
// Administration : état des intégrations et saisie des clés
route("GET", "admin/integrations", async ({ env }) => {
  const st = {};
  for (const nom of Object.keys(CLES_SECRETES)) { const v = await secret(env, nom); st[nom] = { configuree: !!v, source: env[nom] ? "Cloudflare" : v ? "admin" : null, apercu: masquer(v) }; }
  const nb = await env.DB.prepare("SELECT COUNT(*) AS n FROM abonnements_stripe WHERE statut IN ('active', 'trialing')").first();
  return json({ cles: st, supabase: { url: SUPABASE_URL, derniere: await lireConfig(env, "supabase_sync") }, abonnementsActifs: nb.n, prix: PRIX_STRIPE });
}, { admin: true });
route("POST", "admin/integrations", async ({ request, env }) => {
  const b = await corps(request);
  for (const [nom, re] of Object.entries(CLES_SECRETES)) {
    if (b[nom] === undefined) continue;
    const v = String(b[nom] || "").trim();
    if (!v) { await env.DB.prepare("DELETE FROM config WHERE cle = ?").bind("secret:" + nom).run(); continue; }
    if (!re.test(v)) return erreur(`Clé ${nom === "STRIPE_SECRET_KEY" ? "Stripe (sk_live_… ou rk_live_…)" : "Supabase (sb_secret_…)"} invalide.`);
    await ecrireConfig(env, "secret:" + nom, v);
  }
  return json({ ok: true });
}, { admin: true });
route("POST", "admin/integrations/tester", async ({ env }) => {
  const res = {};
  try { const p = await stripeApi(env, "GET", "prices/" + PRIX_STRIPE.mois); res.stripe = `✅ Connecté (${p.livemode ? "mode réel" : "mode test"})`; } catch (e) { res.stripe = "❌ " + e.message; }
  try { const n = await syncSupabase(env, true); res.supabase = n ? `✅ Copie complète : ${Object.entries(n).map(([k, v]) => `${v} ${k}`).join(", ")}` : "❌ Clé Supabase absente"; } catch (e) { res.supabase = "❌ " + e.message; }
  try { res.abonnements = `${await syncStripe(env)} abonnement(s) vérifié(s)`; } catch (e) { res.abonnements = "—"; }
  return json(res);
}, { admin: true });

/* =====================================================================
   Raid de guilde : un boss par semaine, toute la guilde l'attaque (3 attaques par jour et par joueur)
   Les dégâts sont recalculés par le serveur (même graine + mêmes actions = même combat).
   ===================================================================== */
const BOSS_RAID = [
  { nom: "Kraken des Abysses", emoji: "🐙", types: ["nature", "animal", "culture"] },
  { nom: "Dragon du Désert", emoji: "🐉", types: ["monument", "pays", "animal"] },
  { nom: "Golem des Andes", emoji: "🗿", types: ["monument", "nature", "ville"] },
  { nom: "Yéti de l'Himalaya", emoji: "🦍", types: ["nature", "animal", "plat"] },
  { nom: "Titan des Mégalopoles", emoji: "🏙️", types: ["ville", "monument", "culture"] },
  { nom: "Phénix des Tropiques", emoji: "🔥", types: ["animal", "culture", "pays"] },
];
const ATTAQUES_RAID_JOUR = 3;
const pvRaid = (membres) => 15000 + 25000 * Math.max(1, membres); // ≈ 11 attaques par membre sur la semaine
function bossDeLaSemaine(sem) {
  const n = Math.floor(new Date(sem).getTime() / (7 * JOUR)), b = BOSS_RAID[n % BOSS_RAID.length];
  // Des cartes légendaires (ou les plus rares disponibles) servent d'apparence au boss
  const legendaires = Object.entries(CATALOGUE).filter(([, c]) => c.rarete === "legendaire").map(([id]) => id).sort();
  const deck = b.types.map((type, i) => {
    const id = legendaires.length ? legendaires[(n * 3 + i * 7) % legendaires.length] : Object.keys(CATALOGUE)[i];
    return { id, type, nom: `${b.nom}${i ? ` · ${["", "Gardien", "Colosse"][i]}` : ""}`, atk: 700, def: 600, pv: 6000, niveau: 10, talent: ["colosse", "vampire", "riposte"][i] };
  });
  return { ...b, deck };
}
async function etatRaid(env, user) {
  const g = await maGuilde(env, user.id);
  if (!g) return null;
  const sem = semaineCourante(), jour = new Date().toISOString().slice(0, 10);
  const membres = (await env.DB.prepare("SELECT COUNT(*) AS n FROM guilde_membres WHERE guilde_id = ?").bind(g.id).first()).n;
  const total = (await env.DB.prepare("SELECT COALESCE(SUM(degats), 0) AS d FROM raid_attaques WHERE guilde_id = ? AND semaine = ? AND fini = 1").bind(g.id, sem).first()).d;
  const faites = (await env.DB.prepare("SELECT COUNT(*) AS n FROM raid_attaques WHERE user_id = ? AND jour = ?").bind(user.id, jour).first()).n;
  return { g, sem, jour, membres, pv: pvRaid(membres), total, faites };
}
route("GET", "raid", async ({ env, user }) => {
  const e = await etatRaid(env, user);
  if (!e) return json({ guilde: null });
  const boss = bossDeLaSemaine(e.sem);
  const { results } = await env.DB.prepare(`SELECT u.pseudo, SUM(r.degats) AS degats, COUNT(*) AS attaques FROM raid_attaques r JOIN users u ON u.id = r.user_id
    WHERE r.guilde_id = ? AND r.semaine = ? AND r.fini = 1 GROUP BY r.user_id ORDER BY degats DESC`).bind(e.g.id, e.sem).all();
  const recu = await env.DB.prepare("SELECT 1 FROM raid_recompenses WHERE user_id = ? AND semaine = ?").bind(user.id, e.sem).first();
  return json({ guilde: e.g.nom, boss: { nom: boss.nom, emoji: boss.emoji, cartes: boss.deck.map((u) => u.id) }, pv: e.pv, degats: e.total, vaincu: e.total >= e.pv,
    restantes: Math.max(0, ATTAQUES_RAID_JOUR - e.faites), finLe: new Date(e.sem).getTime() + 7 * JOUR, classement: results, recompenseRecue: !!recu,
    aParticipe: results.some((x) => x.pseudo === user.pseudo) });
}, { connecte: true });
route("POST", "raid/attaque", async ({ env, user }) => {
  const e = await etatRaid(env, user);
  if (!e) return erreur("Rejoignez une guilde pour participer au raid.");
  if (e.total >= e.pv) return erreur("Le boss est déjà vaincu cette semaine : récupérez votre récompense !");
  if (e.faites >= ATTAQUES_RAID_JOUR) return erreur(`Vous avez fait vos ${ATTAQUES_RAID_JOUR} attaques du jour. Revenez demain !`, 429);
  const moi = await ligneArene(env, user.id);
  if (!moi.deck) return erreur("Enregistrez d'abord votre deck (onglet Combat).");
  const graine = crypto.getRandomValues(new Uint32Array(1))[0];
  const r = await env.DB.prepare("INSERT INTO raid_attaques (guilde_id, user_id, semaine, jour, graine, deck, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(e.g.id, user.id, e.sem, e.jour, graine, moi.deck, maintenant()).run();
  const boss = bossDeLaSemaine(e.sem);
  return json({ attaque: r.meta.last_row_id, graine, moi: JSON.parse(moi.deck), lui: boss.deck, boss: boss.nom, ia: 3 });
}, { connecte: true });
route("POST", "raid/fin", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const a = await env.DB.prepare("SELECT * FROM raid_attaques WHERE id = ? AND user_id = ? AND fini = 0").bind(Number(b.attaque) || 0, user.id).first();
  if (!a) return erreur("Attaque introuvable ou déjà comptée.", 404);
  const boss = bossDeLaSemaine(a.semaine);
  const actions = (Array.isArray(b.actions) ? b.actions : []).slice(0, COMBAT.TOURS_MAX).map(String);
  const etat = COMBAT.rejouer(JSON.parse(a.deck), boss.deck, a.graine, actions, { ia: 3 });
  const degats = etat.equipes[1].reduce((s, u) => s + (u.pvMax - Math.max(0, u.pv)), 0);
  await env.DB.prepare("UPDATE raid_attaques SET degats = ?, fini = 1 WHERE id = ?").bind(degats, a.id).run();
  const membres = (await env.DB.prepare("SELECT COUNT(*) AS n FROM guilde_membres WHERE guilde_id = ?").bind(a.guilde_id).first()).n;
  const total = (await env.DB.prepare("SELECT COALESCE(SUM(degats), 0) AS d FROM raid_attaques WHERE guilde_id = ? AND semaine = ? AND fini = 1").bind(a.guilde_id, a.semaine).first()).d;
  const pv = pvRaid(membres);
  // Le coup fatal : toute la guilde est prévenue
  if (total >= pv && total - degats < pv) {
    const { results } = await env.DB.prepare("SELECT user_id FROM guilde_membres WHERE guilde_id = ?").bind(a.guilde_id).all();
    for (const m of results) enArrierePlan(ctx, envoyerPush(env, m.user_id, { titre: `${boss.emoji} ${boss.nom} est vaincu !`, texte: `${user.pseudo} a porté le coup final. Récupérez votre récompense de raid !`, url: "./#guilde" }));
  }
  return json({ degats, total, pv, vaincu: total >= pv });
}, { connecte: true });
route("POST", "raid/recompense", async ({ env, user }) => {
  const e = await etatRaid(env, user);
  if (!e) return erreur("Vous n'êtes dans aucune guilde.");
  if (e.total < e.pv) return erreur("Le boss n'est pas encore vaincu.");
  if (!(await env.DB.prepare("SELECT 1 FROM raid_attaques WHERE user_id = ? AND semaine = ? AND fini = 1 AND degats > 0").bind(user.id, e.sem).first())) return erreur("Il faut avoir attaqué le boss au moins une fois cette semaine.");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO raid_recompenses (user_id, semaine) VALUES (?, ?)").bind(user.id, e.sem).run();
  if (!r.meta.changes) return erreur("Récompense déjà récupérée.");
  return json({ ok: true, booster: "or", pieces: 400 });
}, { connecte: true });

/* =====================================================================
   Tournoi en direct du samedi soir : inscriptions dans la semaine, départ à 20 h (heure de Bruxelles),
   tableau à élimination de 4, 8 ou 16 joueurs, une manche toutes les 15 minutes, matchs automatiques
   (decks des joueurs, rejouables à l'identique pour les regarder).
   ===================================================================== */
const RECOMPENSES_DIRECT = { 1: [3000, 3, "🏆 Champion du tournoi du samedi !"], 2: [1500, 2, "🥈 Finaliste du tournoi du samedi"], 3: [600, 1, "🥉 Demi-finaliste du tournoi du samedi"], 4: [250, 0, "Quart de finale du tournoi du samedi"], 5: [100, 0, "Huitième de finale du tournoi du samedi"] };
function heureBruxelles(t = maintenant()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { jour: p.weekday, heure: Number(p.hour) % 24, minute: Number(p.minute) };
}
// Prochain samedi 20 h à Bruxelles (en ms), cherché quart d'heure par quart d'heure
function prochainDepart(t = maintenant()) {
  let x = Math.ceil(t / 900000) * 900000;
  for (let i = 0; i < 8 * 96; i++, x += 900000) { const h = heureBruxelles(x); if (h.jour === "Sat" && h.heure === 20 && h.minute === 0) return x; }
  return t + 7 * JOUR;
}
const semaineTournoi = (t = maintenant()) => new Date(prochainDepart(t - 6 * 3600000)).toISOString().slice(0, 10); // le tournoi d'un samedi reste visible jusqu'au dimanche
async function lancerTournoiDirect(env, sem, force = false) {
  const existe = await env.DB.prepare("SELECT statut FROM tdirect WHERE semaine = ?").bind(sem).first();
  if (existe && existe.statut !== "inscriptions") return existe;
  const { results } = await env.DB.prepare("SELECT * FROM tdirect_inscrits WHERE semaine = ? ORDER BY trophees DESC, cree_le ASC").bind(sem).all();
  const taille = results.length >= 16 ? 16 : results.length >= 8 ? 8 : results.length >= 4 ? 4 : 0;
  if (!taille) {
    await env.DB.prepare("INSERT INTO tdirect (semaine, statut, cree_le) VALUES (?, 'annule', ?) ON CONFLICT(semaine) DO UPDATE SET statut = 'annule'").bind(sem, maintenant()).run();
    for (const x of results) await envoyerPush(env, x.user_id, { titre: "🏆 Tournoi du samedi annulé", texte: "Pas assez d'inscrits ce soir (4 minimum). Rendez-vous samedi prochain !", url: "./#samedi" });
    return { statut: "annule" };
  }
  // Têtes de série : le 1er affronte le dernier, etc.
  const joueurs = results.slice(0, taille).map((x) => ({ id: x.user_id, pseudo: x.pseudo, trophees: x.trophees }));
  const ordre = taille === 4 ? [0, 3, 1, 2] : taille === 8 ? [0, 7, 3, 4, 1, 6, 2, 5] : [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10];
  const tours = [[]];
  for (let i = 0; i < taille; i += 2) tours[0].push({ a: ordre[i], b: ordre[i + 1], gagnant: null });
  const tableau = { joueurs, tours };
  await env.DB.prepare("INSERT INTO tdirect (semaine, statut, taille, tableau, tour, prochain, cree_le) VALUES (?, 'encours', ?, ?, 0, ?, ?) ON CONFLICT(semaine) DO UPDATE SET statut = 'encours', taille = excluded.taille, tableau = excluded.tableau, tour = 0, prochain = excluded.prochain")
    .bind(sem, taille, JSON.stringify(tableau), maintenant() + (force ? 60000 : 5 * 60000), maintenant()).run();
  await annoncerDiscord(env, "tournois", { titre: "🏆 Le tournoi du samedi commence !", texte: `${taille} joueurs s'affrontent : ${joueurs.map((j) => j.pseudo).join(", ")}. Une manche toutes les 15 minutes.`, url: "./#samedi", couleur: 0xff6b35 });
  for (const j of joueurs) await envoyerPush(env, j.id, { titre: "🏆 Le tournoi du samedi commence !", texte: `${taille} joueurs, une manche toutes les 15 minutes. Venez suivre vos matchs en direct !`, url: "./#samedi" });
  return { statut: "encours" };
}
// Joue la manche en cours (tous les matchs), prépare la suivante, et distribue les lots à la fin
async function avancerTournoiDirect(env, sem, force = false) {
  const t = await env.DB.prepare("SELECT * FROM tdirect WHERE semaine = ? AND statut = 'encours'").bind(sem).first();
  if (!t || (!force && maintenant() < t.prochain)) return;
  const tab = JSON.parse(t.tableau), tour = tab.tours[t.tour];
  const decks = Object.fromEntries((await env.DB.prepare("SELECT user_id, deck FROM tdirect_inscrits WHERE semaine = ?").bind(sem).all()).results.map((x) => [x.user_id, JSON.parse(x.deck)]));
  for (const m of tour) {
    if (m.gagnant !== null) continue;
    m.graine = crypto.getRandomValues(new Uint32Array(1))[0];
    const r = COMBAT.simulerMatch(decks[tab.joueurs[m.a].id], decks[tab.joueurs[m.b].id], m.graine);
    m.paires = r.paires; m.gagnant = r.gagnant === 0 ? m.a : m.b;
  }
  let statut = "encours", prochain = maintenant() + 15 * 60000;
  if (tour.length === 1) {
    statut = "fini";
    // Lots : place selon la manche où le joueur a été éliminé
    const nbTours = tab.tours.length, places = {};
    places[tour[0].gagnant] = 1;
    tab.tours.forEach((tr, k) => tr.forEach((m) => { const perdant = m.gagnant === m.a ? m.b : m.a; places[perdant] = nbTours - k + 1; }));
    for (const [idx, place] of Object.entries(places)) {
      const [pieces, boosters, message] = RECOMPENSES_DIRECT[place];
      const j = tab.joueurs[idx];
      await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, ?, ?, ?)").bind(j.id, pieces, boosters, message, maintenant()).run();
      await envoyerPush(env, j.id, { titre: place === 1 ? "🏆 Vous avez gagné le tournoi !" : "🏆 Tournoi terminé", texte: `${message} : ${pieces} 🪙${boosters ? ` et ${boosters} booster(s)` : ""}.`, url: "./#samedi" });
    }
    tab.champion = tab.joueurs[tour[0].gagnant].pseudo;
    await annoncerDiscord(env, "tournois", { titre: `🏆 ${tab.champion} remporte le tournoi du samedi !`, texte: `Bravo au champion de la semaine. Inscriptions ouvertes pour samedi prochain, 20 h.`, url: "./#samedi", couleur: 0xffd34d });
  } else {
    const suivant = [];
    for (let i = 0; i < tour.length; i += 2) suivant.push({ a: tour[i].gagnant, b: tour[i + 1].gagnant, gagnant: null });
    tab.tours.push(suivant);
  }
  await env.DB.prepare("UPDATE tdirect SET tableau = ?, tour = ?, statut = ?, prochain = ? WHERE semaine = ?").bind(JSON.stringify(tab), statut === "fini" ? t.tour : t.tour + 1, statut, prochain, sem).run();
}
async function cronTournoiDirect(env) {
  const sem = semaineTournoi();
  const debut = prochainDepart(maintenant() - 6 * 3600000);
  if (maintenant() >= debut) await lancerTournoiDirect(env, sem);
  await avancerTournoiDirect(env, sem);
}
route("GET", "samedi", async ({ env, user }) => {
  const sem = semaineTournoi(), t = await env.DB.prepare("SELECT * FROM tdirect WHERE semaine = ?").bind(sem).first();
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM tdirect_inscrits WHERE semaine = ?").bind(sem).first()).n;
  const inscrit = user ? !!(await env.DB.prepare("SELECT 1 FROM tdirect_inscrits WHERE semaine = ? AND user_id = ?").bind(sem, user.id).first()) : false;
  const tab = t?.tableau ? JSON.parse(t.tableau) : null;
  return json({ semaine: sem, depart: prochainDepart(maintenant() - 6 * 3600000), statut: t?.statut || "inscriptions", inscrits: n, inscrit, prochainTour: t?.prochain || null, tourEnCours: t?.tour ?? 0,
    tableau: tab ? { joueurs: tab.joueurs.map((j) => ({ pseudo: j.pseudo, trophees: j.trophees })), tours: tab.tours.map((tr) => tr.map((m) => ({ a: m.a, b: m.b, gagnant: m.gagnant, joue: m.gagnant !== null }))), champion: tab.champion || null } : null,
    lots: RECOMPENSES_DIRECT });
});
// Regarder un match : les decks, la graine et les actions pour le rejouer à l'identique
route("GET", "samedi/match/(\\d+)/(\\d+)", async ({ env, p }) => {
  const sem = semaineTournoi(), t = await env.DB.prepare("SELECT tableau FROM tdirect WHERE semaine = ?").bind(sem).first();
  const tab = t?.tableau && JSON.parse(t.tableau), m = tab?.tours?.[Number(p[1])]?.[Number(p[2])];
  if (!m || m.gagnant === null) return erreur("Ce match n'a pas encore été joué.", 404);
  const decks = Object.fromEntries((await env.DB.prepare("SELECT user_id, deck FROM tdirect_inscrits WHERE semaine = ?").bind(sem).all()).results.map((x) => [x.user_id, JSON.parse(x.deck)]));
  return json({ a: tab.joueurs[m.a].pseudo, b: tab.joueurs[m.b].pseudo, deckA: decks[tab.joueurs[m.a].id], deckB: decks[tab.joueurs[m.b].id], graine: m.graine, paires: m.paires, gagnant: m.gagnant === m.a ? 0 : 1 });
});
route("POST", "samedi/inscription", async ({ env, user }) => {
  const sem = semaineTournoi(), t = await env.DB.prepare("SELECT statut FROM tdirect WHERE semaine = ?").bind(sem).first();
  if (t && t.statut !== "inscriptions") return erreur("Les inscriptions sont fermées : le tournoi a commencé.");
  const a = await ligneArene(env, user.id);
  if (!a.deck) return erreur("Enregistrez d'abord votre deck (onglet Combat) : c'est lui qui combattra.");
  await env.DB.prepare("INSERT INTO tdirect_inscrits (semaine, user_id, pseudo, deck, trophees, cree_le) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(semaine, user_id) DO UPDATE SET deck = excluded.deck, trophees = excluded.trophees")
    .bind(sem, user.id, user.pseudo, a.deck, a.trophees, maintenant()).run();
  return json({ ok: true });
}, { connecte: true });
route("DELETE", "samedi/inscription", async ({ env, user }) => {
  const sem = semaineTournoi(), t = await env.DB.prepare("SELECT statut FROM tdirect WHERE semaine = ?").bind(sem).first();
  if (t && t.statut !== "inscriptions") return erreur("Le tournoi a déjà commencé.");
  await env.DB.prepare("DELETE FROM tdirect_inscrits WHERE semaine = ? AND user_id = ?").bind(sem, user.id).run();
  return json({ ok: true });
}, { connecte: true });
// Admin : lancer tout de suite / jouer la manche suivante (pour tester ou relancer)
route("POST", "admin/samedi", async ({ request, env }) => {
  const b = await corps(request), sem = semaineTournoi();
  if (b.action === "lancer") return json(await lancerTournoiDirect(env, sem, true));
  if (b.action === "manche") { await avancerTournoiDirect(env, sem, true); return json({ ok: true }); }
  if (b.action === "reinitialiser") { await env.DB.prepare("DELETE FROM tdirect WHERE semaine = ?").bind(sem).run(); return json({ ok: true }); }
  return erreur("Action inconnue.");
}, { admin: true });

/* =====================================================================
   Visuels des boosters : images envoyées par l'admin (créées avec Google Flow, etc.), affichées dans la boutique
   ===================================================================== */
const VISUEL_RE = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/;
const CLE_VISUEL = /^[a-z0-9-]{2,40}$/i;
route("GET", "visuels", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT cle, maj FROM visuels").all();
  return json({ visuels: Object.fromEntries(results.map((x) => [x.cle, x.maj])) }, 200, { "cache-control": "public, max-age=60" });
});
route("GET", "visuel/([A-Za-z0-9-]{2,40})", async ({ env, p }) => {
  const v = await env.DB.prepare("SELECT image FROM visuels WHERE cle = ?").bind(p[1]).first();
  return reponseImage(env, "visuels/" + p[1], v?.image);
});
route("POST", "admin/visuels", async ({ request, env }) => {
  const b = await corps(request);
  if (!CLE_VISUEL.test(String(b.cle || ""))) return erreur("Booster inconnu.");
  const m = VISUEL_RE.exec(String(b.image || ""));
  if (!m) return erreur("Image invalide (WebP, JPEG ou PNG).");
  if (m[2].length > 1400000) return erreur("Image trop lourde : 1 Mo maximum après compression.");
  await env.DB.prepare("INSERT INTO visuels (cle, image, maj) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET image = excluded.image, maj = excluded.maj").bind(b.cle, await stockerImage(env, "visuels/" + b.cle, b.image), maintenant()).run();
  return json({ ok: true, maj: maintenant() });
}, { admin: true });
route("DELETE", "admin/visuels/([A-Za-z0-9-]{2,40})", async ({ env, p }) => {
  await env.DB.prepare("DELETE FROM visuels WHERE cle = ?").bind(p[1]).run();
  await env.IMAGES?.delete("visuels/" + p[1]).catch(() => {});
  return json({ ok: true });
}, { admin: true });


/* =====================================================================
   Réglages du jeu modifiables par l'admin : chances des boosters, règles des decks, combats classés
   ===================================================================== */
const ARENE_MAX_JOUR = 60; // garde-fou anti-spam : au-delà des combats classés, on peut encore jouer pour le plaisir
const RARETES_CLES = ["commun", "peu-commun", "rare", "epique", "ultra-rare", "legendaire"];
const REGLAGES_DEFAUT = {
  // Chances : poids par rareté pour chaque booster (vide = valeurs du jeu), garantie = rareté minimale de la dernière carte
  chances: { pityPas: 5, bonusNouvelle: 1, packs: {
    monde: { poids: { "commun": 68, "peu-commun": 22, "rare": 8, "epique": 1.5, "ultra-rare": 0.4, "legendaire": 0.1 }, garantie: 1 },
  } },
  deck: { budget: 30, maxLegendaires: 3 },
  classe: { parJour: 5, memeAdversaire: 1 },
  succes: {},
};
let reglagesCache = { t: 0, v: null };
async function reglagesJeu(env) {
  if (reglagesCache.v && maintenant() - reglagesCache.t < 20000) return reglagesCache.v;
  const lu = (await lireConfig(env, "reglages_jeu")) || {};
  const v = {
    chances: { ...REGLAGES_DEFAUT.chances, ...(lu.chances || {}), packs: { ...REGLAGES_DEFAUT.chances.packs, ...(lu.chances?.packs || {}) } },
    deck: { ...REGLAGES_DEFAUT.deck, ...(lu.deck || {}) },
    classe: { ...REGLAGES_DEFAUT.classe, ...(lu.classe || {}) },
    succes: { ...(lu.succes || {}) },
  };
  reglagesCache = { t: maintenant(), v };
  return v;
}
const nombre = (x, min, max, def) => { const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
route("GET", "reglages", async ({ env }) => {
  const r = await reglagesJeu(env);
  return json({ ...r, tailleDeck: COMBAT.TAILLE_DECK, koVictoire: COMBAT.KO_VICTOIRE, discord: (await configDiscord(env)).invitation }, 200, { "cache-control": "public, max-age=30" });
});
route("PUT", "admin/reglages", async ({ request, env, user }) => {
  const b = await corps(request), act = await reglagesJeu(env);
  const packs = {};
  for (const [k, p] of Object.entries(b.chances?.packs || {}).slice(0, 40)) {
    if (!/^[a-z0-9-]{2,30}$/.test(k)) continue;
    const poids = {};
    for (const r of RARETES_CLES) if (p?.poids?.[r] !== undefined && p.poids[r] !== "") poids[r] = nombre(p.poids[r], 0, 1000, 0);
    if (Object.values(poids).reduce((t, x) => t + x, 0) <= 0 && Object.keys(poids).length) return erreur(`Booster « ${k} » : au moins une rareté doit avoir une chance positive.`);
    // garantie absente = celle d'origine du booster ; null = aucune garantie
    packs[k] = { poids: Object.keys(poids).length ? poids : null };
    if (p?.garantie === null) packs[k].garantie = null;
    else if (p?.garantie !== undefined && p.garantie !== "") packs[k].garantie = Math.round(nombre(p.garantie, 0, 5, 0));
  }
  const v = {
    chances: { pityPas: nombre(b.chances?.pityPas, 0, 50, act.chances.pityPas), bonusNouvelle: nombre(b.chances?.bonusNouvelle, 0.2, 5, act.chances.bonusNouvelle), packs },
    deck: { budget: Math.round(nombre(b.deck?.budget, 10, 60, act.deck.budget)), maxLegendaires: Math.round(nombre(b.deck?.maxLegendaires, 0, 10, act.deck.maxLegendaires)) },
    classe: { parJour: Math.round(nombre(b.classe?.parJour, 1, 50, act.classe.parJour)), memeAdversaire: Math.round(nombre(b.classe?.memeAdversaire, 0, 10, act.classe.memeAdversaire)) },
    succes: Object.fromEntries(Object.entries(b.succes || act.succes || {}).filter(([k]) => /^[a-z0-9-]{2,30}$/.test(k)).map(([k, v]) => [k, Math.round(nombre(v, 0, 100000, 0))])),
  };
  await ecrireConfig(env, "reglages_jeu", v);
  reglagesCache = { t: 0, v: null };
  await journaliser(env, user.id, "réglages du jeu modifiés", JSON.stringify(v).slice(0, 300), "admin");
  return json({ ok: true, reglages: v });
}, { admin: true });

/* ---------- Combats classés : N par jour et par joueur (arène et duels classés confondus) ---------- */
async function compterClasse(env, userId) {
  const reg = await reglagesJeu(env);
  await ligneArene(env, userId);
  const r = await env.DB.prepare(`UPDATE arene SET classes_nb = CASE WHEN classes_jour = ?1 THEN classes_nb + 1 ELSE 1 END, classes_jour = ?1
    WHERE user_id = ?2 AND (classes_jour IS NULL OR classes_jour != ?1 OR classes_nb < ?3)`).bind(jourUTC(), userId, reg.classe.parJour).run();
  return r.meta.changes > 0;
}
const classesRestants = (a, reg) => Math.max(0, reg.classe.parJour - (a.classes_jour === jourUTC() ? a.classes_nb || 0 : 0));
route("GET", "classe/jour", async ({ env, user }) => {
  const a = await ligneArene(env, user.id), reg = await reglagesJeu(env);
  return json({ parJour: reg.classe.parJour, restants: classesRestants(a, reg), memeAdversaire: reg.classe.memeAdversaire });
}, { connecte: true });

// Fin d'un duel classé : points façon Elo pour les deux joueurs, une seule fois, avec garde-fous anti-farm
async function terminerDuelClasse(env, d) {
  const r = await env.DB.prepare("UPDATE duels SET traite = 1 WHERE id = ? AND traite = 0").bind(d.id).run();
  if (!r.meta.changes || !d.classe || !d.gagnant) return;
  const reg = await reglagesJeu(env), debutJour = Date.parse(jourUTC() + "T00:00:00Z");
  const deja = await env.DB.prepare(`SELECT COUNT(*) AS n FROM duels WHERE classe = 1 AND traite = 1 AND id != ?3 AND fini_le >= ?4 AND (COALESCE(points_a, 0) != 0 OR COALESCE(points_b, 0) != 0)
    AND ((a_id = ?1 AND b_id = ?2) OR (a_id = ?2 AND b_id = ?1))`).bind(d.a_id, d.b_id, d.id, debutJour).first();
  let pa = 0, pb = 0;
  if (deja.n < reg.classe.memeAdversaire) {
    const A = await ligneArene(env, d.a_id), B = await ligneArene(env, d.b_id);
    const okA = await compterClasse(env, d.a_id), okB = await compterClasse(env, d.b_id);
    const attenduA = 1 / (1 + 10 ** ((B.trophees - A.trophees) / 400)), sA = d.gagnant === d.a_id ? 1 : 0;
    pa = okA ? Math.round(32 * (sA - attenduA)) : 0;
    pb = okB ? Math.round(32 * ((1 - sA) - (1 - attenduA))) : 0;
    const rangs = await chargerRangs(env);
    await env.DB.batch([
      env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?), victoires = victoires + ?, defaites = defaites + ? WHERE user_id = ?").bind(pa, okA ? sA : 0, okA ? 1 - sA : 0, d.a_id),
      env.DB.prepare("UPDATE arene SET trophees = MAX(0, trophees + ?), victoires = victoires + ?, defaites = defaites + ? WHERE user_id = ?").bind(pb, okB ? 1 - sA : 0, okB ? sA : 0, d.b_id),
    ]);
    await majRang(env, null, d.a_id, A.trophees, Math.max(0, A.trophees + pa), rangs);
    await majRang(env, null, d.b_id, B.trophees, Math.max(0, B.trophees + pb), rangs);
  }
  await env.DB.prepare("UPDATE duels SET points_a = ?, points_b = ? WHERE id = ?").bind(pa, pb, d.id).run();
  if (pa || pb) await pointsNations(env, d.gagnant, 5);
  console.log(JSON.stringify({ duel: d.id, evenement: "classe", points: [pa, pb] }));
}


/* =====================================================================
   Boutique de packs payants (configurables dans l'admin), payés par Stripe et livrés une seule fois
   ===================================================================== */
const OFFRES_DEFAUT = [
  ["debutant", "Pack Débutant", "Offre de lancement", "Le meilleur départ : de quoi ouvrir une vingtaine de boosters et viser vos premières cartes Or.", 500, 3000, { monde: 10, argent: 3, or: 1 }, 1],
  ["collectionneur", "Pack Collectionneur", "", "Pour compléter vos pays et vos continents plus vite.", 999, 6000, { monde: 15, argent: 6, or: 2 }, 0],
  ["premium", "Pack Premium", "", "Beaucoup de boosters Argent et Or pour les cartes épiques et ultra rares.", 1999, 15000, { monde: 20, argent: 10, or: 5 }, 0],
  ["legendaire", "Pack Légendaire", "", "Le pack ultime pour les chasseurs de légendaires.", 4999, 40000, { monde: 30, argent: 20, or: 15 }, 0],
];
const TYPES_BOOSTERS_PACK = ["monde", "argent", "or", "prestige", "halloween", "noel"];
// Cosmétiques payants : n'apportent aucun avantage en jeu
const OFFRES_COSMETIQUES = [
  ["cosm-aurore", "Effet d'ouverture « Aurore »", "Des voiles de lumière boréale à chaque booster ouvert.", 199, "effet:aurore"],
  ["cosm-eclairs", "Effet d'ouverture « Éclairs »", "Un orage électrique quand vous déchirez un booster.", 199, "effet:eclairs"],
  ["cosm-dos-galaxie", "Dos de cartes animé « Galaxie »", "Un dos de cartes animé, visible à chaque ouverture.", 249, "dos:galaxie"],
  ["cosm-cadre-plasma", "Cadre de profil « Plasma »", "Un cadre animé autour de votre avatar, visible par tous.", 249, "cadre:plasma"],
];
async function chargerOffres(env) {
  let { results } = await env.DB.prepare("SELECT * FROM offres ORDER BY ordre, prix_cents").all();
  if (!results.some((o) => o.cle === "cosm-aurore")) {
    await env.DB.batch(OFFRES_COSMETIQUES.map(([cle, nom, desc, prix, cosm], i) => env.DB.prepare("INSERT OR IGNORE INTO offres (cle, nom, badge, description, prix_cents, pieces, boosters, une_fois, ordre, maj, cosmetique) VALUES (?, ?, 'Cosmétique', ?, ?, 0, '{}', 1, ?, ?, ?)").bind(cle, nom, desc, prix, 20 + i, maintenant(), cosm)));
    ({ results } = await env.DB.prepare("SELECT * FROM offres ORDER BY ordre, prix_cents").all());
  }
  if (!results.length || !results.some((o) => !o.cosmetique)) {
    await env.DB.batch(OFFRES_DEFAUT.map(([cle, nom, badge, description, prix, pieces, boosters, uneFois], i) =>
      env.DB.prepare("INSERT OR IGNORE INTO offres (cle, nom, badge, description, prix_cents, pieces, boosters, une_fois, ordre, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(cle, nom, badge, description, prix, pieces, JSON.stringify(boosters), uneFois, i, maintenant())));
    ({ results } = await env.DB.prepare("SELECT * FROM offres ORDER BY ordre, prix_cents").all());
  }
  return results.map((o) => ({ ...o, boosters: (() => { try { return JSON.parse(o.boosters) || {}; } catch { return {}; } })() }));
}
const offrePublique = (o, deja) => ({ cle: o.cle, nom: o.nom, description: o.description, badge: o.badge, prix: o.prix_cents / 100, cosmetique: o.cosmetique || null,
  prixReference: o.prix_reference_cents ? o.prix_reference_cents / 100 : null, referenceNote: o.reference_note, pieces: o.pieces, boosters: o.boosters,
  uneFois: !!o.une_fois, dejaAchete: !!deja, debut: o.debut, fin: o.fin });
const offreDisponible = (o) => o.actif && (!o.debut || o.debut <= maintenant()) && (!o.fin || o.fin > maintenant());
route("GET", "offres", async ({ env, user }) => {
  const offres = (await chargerOffres(env)).filter(offreDisponible);
  const achats = user ? (await env.DB.prepare("SELECT formule FROM paiements WHERE user_id = ? AND formule LIKE 'pack:%' AND statut = 'paye'").bind(user.id).all()).results.map((x) => x.formule.slice(5)) : [];
  return json({ offres: offres.map((o) => offrePublique(o, o.une_fois && achats.includes(o.cle))), stripe: !!(await secret(env, "STRIPE_SECRET_KEY")) });
});
route("POST", "stripe/pack", async ({ request, env, user }) => {
  const b = await corps(request);
  const o = (await chargerOffres(env)).find((x) => x.cle === String(b.cle || ""));
  if (!o || !offreDisponible(o)) return erreur("Cette offre n'est plus disponible.", 404);
  if (b.renonciation !== true) return erreur("Vous devez demander la livraison immédiate du contenu numérique pour continuer.");
  if (o.une_fois && await env.DB.prepare("SELECT 1 FROM paiements WHERE user_id = ? AND formule = ? AND statut = 'paye'").bind(user.id, "pack:" + o.cle).first()) return erreur("Cette offre est limitée à un achat par compte.");
  const origine = new URL(request.url).origin;
  const contenu = JSON.stringify({ p: o.pieces, b: o.boosters, c: o.cosmetique || undefined });
  const meta = { user_id: String(user.id), formule: "pack", pack: o.cle, nom: o.nom, contenu, renonciation: "oui", createur: user.code_createur || undefined };
  if (o.cosmetique && await env.DB.prepare("SELECT 1 FROM cosmetiques_achats WHERE user_id = ? AND cle = ?").bind(user.id, o.cosmetique).first()) return erreur("Vous possédez déjà cet objet.");
  const session = await stripeApi(env, "POST", "checkout/sessions", {
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.prix_cents, product_data: { name: `Play2F1 — ${o.nom}`, description: o.cosmetique && !o.pieces ? "Objet cosmétique (contenu numérique livré immédiatement)" : `${o.pieces} pièces et ${Object.values(o.boosters).reduce((t, n) => t + n, 0)} boosters (contenu numérique livré immédiatement)` } } }],
    success_url: `${origine}/?stripe_session={CHECKOUT_SESSION_ID}`, cancel_url: `${origine}/?stripe=annule#boosters`,
    client_reference_id: String(user.id), metadata: meta, payment_intent_data: { metadata: meta }, locale: "fr",
    customer: user.stripe_client || undefined, customer_creation: user.stripe_client ? undefined : "always",
  });
  return json({ url: session.url });
}, { connecte: true });
// Livraison d'un pack payé : un cadeau (pièces + boosters) récupéré automatiquement par le jeu, une seule fois par paiement
async function livrerPack(env, ctx, s, userId) {
  const cle = String(s.metadata?.pack || "");
  let contenu = {}; try { contenu = JSON.parse(s.metadata?.contenu || "{}"); } catch {}
  const neuf = await env.DB.prepare("INSERT OR IGNORE INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'paye', ?)")
    .bind(s.id, userId, "pack:" + cle, ((s.amount_total || 0) / 100).toFixed(2), maintenant()).run();
  if (s.customer) await env.DB.prepare("UPDATE users SET stripe_client = ? WHERE id = ?").bind(typeof s.customer === "string" ? s.customer : s.customer.id, userId).run();
  if (!neuf.meta.changes) return;
  await enregistrerVenteCreateur(env, s, userId);
  await donnerContenuPack(env, ctx, userId, contenu, `${s.metadata?.nom || "Pack"} : merci pour votre achat !`, s.metadata?.nom);
  const u = await env.DB.prepare("SELECT pseudo FROM users WHERE id = ?").bind(userId).first();
  enArrierePlan(ctx, prevenirAdmins(env, { titre: "💰 Pack vendu", texte: `${u?.pseudo} : ${s.metadata?.nom || cle} (${((s.amount_total || 0) / 100).toFixed(2)} €)`, url: "./#admin" }));
}
const contenuOffre = (o) => ({ p: o.pieces, b: o.boosters, c: o.cosmetique || undefined });
// Dépose le contenu d'un pack (pièces, boosters, cosmétique) dans les cadeaux du joueur
async function donnerContenuPack(env, ctx, userId, contenu, message, nom) {
  const detail = {};
  for (const [k, n] of Object.entries(contenu.b || {})) if (TYPES_BOOSTERS_PACK.includes(k) && Number(n) > 0) detail[k] = Math.min(500, Math.round(Number(n)));
  const monde = detail.monde || 0; delete detail.monde;
  if (contenu.c && /^(dos|cadre|effet|titre):[a-z0-9-]{2,30}$/.test(contenu.c)) await env.DB.prepare("INSERT OR IGNORE INTO cosmetiques_achats (user_id, cle, cree_le) VALUES (?, ?, ?)").bind(userId, contenu.c, maintenant()).run();
  await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, boosters_detail, message, cree_le) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(userId, Math.min(1000000, Math.round(Number(contenu.p) || 0)), monde, JSON.stringify(detail), message, maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, userId, { titre: "🛍️ Pack livré !", texte: `${nom || "Votre pack"} vous attend dans le jeu.`, url: "./#boosters" }));
}
// Vérifications communes avant un achat de pack
async function verifierAchatPack(env, user, b) {
  const o = (await chargerOffres(env)).find((x) => x.cle === String(b.cle || ""));
  if (!o || !offreDisponible(o)) throw new ErreurApi("Cette offre n'est plus disponible.", 404);
  if (b.renonciation !== true) throw new ErreurApi("Vous devez demander la livraison immédiate du contenu numérique pour continuer.", 400);
  if (o.une_fois && await env.DB.prepare("SELECT 1 FROM paiements WHERE user_id = ? AND formule = ? AND statut = 'paye'").bind(user.id, "pack:" + o.cle).first()) throw new ErreurApi("Cette offre est limitée à un achat par compte.", 400);
  if (o.cosmetique && await env.DB.prepare("SELECT 1 FROM cosmetiques_achats WHERE user_id = ? AND cle = ?").bind(user.id, o.cosmetique).first()) throw new ErreurApi("Vous possédez déjà cet objet.", 400);
  return o;
}
// Paiement PayPal automatique d'un pack (si PAYPAL_CLIENT_ID et PAYPAL_SECRET sont configurés)
route("POST", "paypal/pack/commande", async ({ request, env, user }) => {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return erreur("Paiement automatique non configuré.", 503);
  const o = await verifierAchatPack(env, user, await corps(request));
  const montant = (o.prix_cents / 100).toFixed(2);
  const r = await fetch(urlPaypal(env) + "/v2/checkout/orders", { method: "POST", headers: { Authorization: "Bearer " + await jetonPaypal(env), "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "EUR", value: montant }, description: `Play2F1 — ${o.nom} (contenu numérique)`.slice(0, 127), custom_id: `${user.id}:pack:${o.cle}` }] }) });
  const j = await r.json();
  if (!r.ok || !j.id) return erreur("Impossible de créer la commande PayPal.", 502);
  await env.DB.prepare("INSERT INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'cree', ?)").bind(j.id, user.id, "pack:" + o.cle, montant, maintenant()).run();
  return json({ id: j.id });
}, { connecte: true });
route("POST", "paypal/pack/valider", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const p = await env.DB.prepare("SELECT * FROM paiements WHERE commande = ? AND user_id = ? AND formule LIKE 'pack:%'").bind(String(b.commande || ""), user.id).first();
  if (!p) return erreur("Commande inconnue.", 404);
  if (p.statut === "paye") return erreur("Ce paiement a déjà été utilisé.", 409);
  const r = await fetch(`${urlPaypal(env)}/v2/checkout/orders/${encodeURIComponent(p.commande)}/capture`, { method: "POST", headers: { Authorization: "Bearer " + await jetonPaypal(env), "Content-Type": "application/json" } });
  const j = await r.json();
  const capture = j.purchase_units?.[0]?.payments?.captures?.[0];
  if (j.status !== "COMPLETED" || capture?.status !== "COMPLETED" || capture.amount?.value !== p.montant || capture.amount?.currency_code !== "EUR" || capture.custom_id !== `${user.id}:${p.formule}`)
    return erreur("Le paiement n'a pas pu être confirmé. Aucun montant n'a été validé.", 402);
  const fait = await env.DB.prepare("UPDATE paiements SET statut = 'paye' WHERE commande = ? AND statut != 'paye'").bind(p.commande).run();
  if (!fait.meta.changes) return erreur("Ce paiement a déjà été utilisé.", 409);
  const cle = p.formule.slice(5), o = (await chargerOffres(env)).find((x) => x.cle === cle);
  if (!o) return erreur("Offre introuvable : contactez l'administrateur, votre paiement est bien enregistré.", 404);
  await enregistrerVenteCreateur(env, { id: p.commande, amount_total: Math.round(Number(p.montant) * 100), metadata: { createur: user.code_createur || "" } }, user.id);
  await donnerContenuPack(env, ctx, user.id, contenuOffre(o), `${o.nom} : merci pour votre achat !`, o.nom);
  enArrierePlan(ctx, prevenirAdmins(env, { titre: "💰 Pack vendu (PayPal)", texte: `${user.pseudo} : ${o.nom} (${p.montant} €)`, url: "./#admin" }));
  return json({ ok: true });
}, { connecte: true });
// Paiement PayPal manuel (paypal.me) : le joueur prévient, l'administrateur vérifie puis livre le pack
route("POST", "pack/demande", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const o = await verifierAchatPack(env, user, b);
  const attente = await env.DB.prepare("SELECT COUNT(*) AS n FROM demandes_premium WHERE user_id = ? AND traitee = 0").bind(user.id).first();
  if (attente.n >= 3) return erreur("Vous avez déjà des demandes en attente : l'administrateur va les traiter.", 429);
  await env.DB.prepare("INSERT INTO demandes_premium (user_id, formule, note, cree_le) VALUES (?, ?, ?, ?)").bind(user.id, "pack:" + o.cle, String(b.note || "").trim().slice(0, 120), maintenant()).run();
  enArrierePlan(ctx, prevenirAdmins(env, { titre: "🛍️ Nouvelle demande de pack (PayPal)", texte: `${user.pseudo} : ${o.nom} (${(o.prix_cents / 100).toFixed(2)} €)`, url: "./#admin" }));
  return json({ ok: true }, 201);
}, { connecte: true });
// L'administrateur donne un pack : après un paiement PayPal reçu (demande) ou en cadeau
route("POST", "admin/offres/([a-z0-9-]{2,30})/donner", async ({ request, env, user, ctx, p }) => {
  const b = await corps(request);
  const o = (await chargerOffres(env)).find((x) => x.cle === p[1]);
  if (!o) return erreur("Offre introuvable.", 404);
  const u = await env.DB.prepare("SELECT id, pseudo FROM users WHERE pseudo = ?").bind(String(b.pseudo || "").trim()).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  const demande = Number(b.demande) || 0, paye = !!demande || b.paye === true;
  if (demande) {
    const r = await env.DB.prepare("UPDATE demandes_premium SET traitee = 1 WHERE id = ? AND user_id = ? AND traitee = 0").bind(demande, u.id).run();
    if (!r.meta.changes) return erreur("Cette demande a déjà été traitée.", 409);
  }
  // Un paiement reçu est enregistré (ventes, offre limitée à un achat) ; un cadeau ne l'est pas
  if (paye) await env.DB.prepare("INSERT INTO paiements (commande, user_id, formule, montant, statut, cree_le) VALUES (?, ?, ?, ?, 'paye', ?)")
    .bind(`paypal-manuel-${demande || "admin"}-${u.id}-${maintenant()}`, u.id, "pack:" + o.cle, (o.prix_cents / 100).toFixed(2), maintenant()).run();
  const message = String(b.message || "").trim().slice(0, 140) || (paye ? `${o.nom} : merci pour votre achat !` : `🎁 Cadeau de l'équipe Play2F1 : ${o.nom} !`);
  await donnerContenuPack(env, ctx, u.id, contenuOffre(o), message, o.nom);
  await journaliser(env, user.id, paye ? "pack livré (PayPal)" : "pack offert", `${o.nom} → ${u.pseudo}`, "admin");
  return json({ ok: true, pseudo: u.pseudo });
}, { admin: true });
route("GET", "admin/offres", async ({ env }) => json({ offres: (await chargerOffres(env)).map((o) => ({ ...offrePublique(o, false), actif: !!o.actif, ordre: o.ordre })) }), { admin: true });
route("PUT", "admin/offres/([a-z0-9-]{2,30})", async ({ request, env, user, p }) => {
  const b = await corps(request);
  const nom = String(b.nom || "").trim().slice(0, 60);
  if (!nom) return erreur("Le nom de l'offre est obligatoire.");
  const prix = Math.round(nombre(b.prix, 0.5, 500, NaN) * 100);
  if (!Number.isFinite(prix)) return erreur("Prix invalide (entre 0,50 € et 500 €).");
  let ref = b.prixReference === "" || b.prixReference === null || b.prixReference === undefined ? null : Math.round(nombre(b.prixReference, 0.5, 5000, NaN) * 100);
  const note = String(b.referenceNote || "").trim().slice(0, 300);
  // Pas de fausse réduction : un prix barré doit être un prix réellement pratiqué, justifié par l'admin
  if (ref !== null) {
    if (!Number.isFinite(ref) || ref <= prix) return erreur("Le prix de référence doit être supérieur au prix de vente.");
    if (note.length < 15) return erreur("Indiquez la justification du prix de référence (prix le plus bas réellement pratiqué au cours des 30 jours précédant la réduction).");
  }
  const boosters = {};
  for (const k of TYPES_BOOSTERS_PACK) { const n = Math.round(nombre(b.boosters?.[k], 0, 500, 0)); if (n) boosters[k] = n; }
  const date = (x) => (x ? Date.parse(x) || null : null);
  const cosm = /^(dos|cadre|effet|titre):[a-z0-9-]{2,30}$/.test(b.cosmetique || "") ? b.cosmetique : null;
  await env.DB.prepare(`INSERT INTO offres (cle, nom, description, badge, prix_cents, prix_reference_cents, reference_note, pieces, boosters, une_fois, actif, ordre, debut, fin, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cle) DO UPDATE SET nom = excluded.nom, description = excluded.description, badge = excluded.badge, prix_cents = excluded.prix_cents, prix_reference_cents = excluded.prix_reference_cents,
    reference_note = excluded.reference_note, pieces = excluded.pieces, boosters = excluded.boosters, une_fois = excluded.une_fois, actif = excluded.actif, ordre = excluded.ordre, debut = excluded.debut, fin = excluded.fin, maj = excluded.maj`)
    .bind(p[1], nom, String(b.description || "").slice(0, 300), String(b.badge || "").slice(0, 40), prix, ref, ref ? note : "", Math.round(nombre(b.pieces, 0, 1000000, 0)), JSON.stringify(boosters),
      b.uneFois ? 1 : 0, b.actif ? 1 : 0, Math.round(nombre(b.ordre, 0, 99, 0)), date(b.debut), date(b.fin), maintenant()).run();
  await env.DB.prepare("UPDATE offres SET cosmetique = ? WHERE cle = ?").bind(cosm, p[1]).run();
  await journaliser(env, user.id, `offre ${p[1]} enregistrée`, `${nom} · ${(prix / 100).toFixed(2)} €`, "admin");
  return json({ ok: true });
}, { admin: true });









/* =====================================================================
   Stockage des images : Cloudflare R2 si le bucket « IMAGES » est relié au Worker, sinon la base D1 (base64)
   ===================================================================== */
async function stockerImage(env, chemin, dataUrl) {
  const m = VISUEL_RE.exec(String(dataUrl || ""));
  if (!m || !env.IMAGES) return dataUrl;
  await env.IMAGES.put(chemin, Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), { httpMetadata: { contentType: "image/" + m[1] } });
  return "r2:image/" + m[1];
}
async function reponseImage(env, chemin, valeur) {
  const entetes = (type) => ({ "content-type": type, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" });
  if (typeof valeur === "string" && valeur.startsWith("r2:")) {
    const o = env.IMAGES ? await env.IMAGES.get(chemin) : null;
    return o ? new Response(o.body, { headers: entetes(valeur.slice(3)) }) : new Response(null, { status: 404 });
  }
  const m = valeur && VISUEL_RE.exec(valeur);
  if (!m) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), { headers: entetes("image/" + m[1]) });
}
route("GET", "admin/images", async ({ env }) => {
  const [v, ph, rg] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN image LIKE 'data:%' THEN LENGTH(image) ELSE 0 END), 0) AS octets, SUM(image LIKE 'r2:%') AS r2 FROM visuels"),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN image LIKE 'data:%' THEN LENGTH(image) ELSE 0 END), 0) AS octets, SUM(image LIKE 'r2:%') AS r2 FROM photos_perso"),
    env.DB.prepare("SELECT COUNT(logo) AS n, COALESCE(SUM(CASE WHEN logo LIKE 'data:%' THEN LENGTH(logo) ELSE 0 END), 0) AS octets, SUM(logo LIKE 'r2:%') AS r2 FROM rangs"),
  ]);
  const t = (r) => ({ n: r.results[0].n || 0, octets: r.results[0].octets || 0, r2: r.results[0].r2 || 0 });
  return json({ r2: !!env.IMAGES, visuels: t(v), photos: t(ph), rangs: t(rg) });
}, { admin: true });
// Déplace les images encore stockées en base64 dans D1 vers R2 (par lots de 40 pour rester sous les limites du Worker)
route("POST", "admin/images/migrer", async ({ env, user }) => {
  if (!env.IMAGES) return erreur("Aucun bucket R2 « IMAGES » n'est relié au Worker.", 400);
  let n = 0;
  for (const [table, col, cleCol, prefixe, conv] of [["visuels", "image", "cle", "visuels/", (k) => k], ["photos_perso", "image", "carte", "photos/", (k) => k.replace(":", "~")], ["rangs", "logo", "cle", "rangs/", (k) => k]]) {
    const { results } = await env.DB.prepare(`SELECT ${cleCol} AS k, ${col} AS d FROM ${table} WHERE ${col} LIKE 'data:%' LIMIT 40`).all();
    for (const r of results) { const v = await stockerImage(env, prefixe + conv(r.k), r.d); if (v.startsWith("r2:")) { await env.DB.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${cleCol} = ?`).bind(v, r.k).run(); n++; } }
  }
  await journaliser(env, user.id, "images migrées vers R2", `${n} image(s)`, "admin");
  return json({ migrees: n });
}, { admin: true });

/* ---------- Tableau de bord des combats (équilibrage) ---------- */
route("GET", "admin/combats", async ({ env }) => {
  const depuis = maintenant() - 14 * JOUR;
  const [parJourA, parJourD, decks, duelsDecks, modes] = await env.DB.batch([
    env.DB.prepare("SELECT strftime('%Y-%m-%d', cree_le / 1000, 'unixepoch') AS j, COUNT(*) AS n FROM combats WHERE fini = 1 AND cree_le >= ? GROUP BY j ORDER BY j").bind(depuis),
    env.DB.prepare("SELECT strftime('%Y-%m-%d', fini_le / 1000, 'unixepoch') AS j, COUNT(*) AS n FROM duels WHERE statut = 'fini' AND fini_le >= ? GROUP BY j ORDER BY j").bind(depuis),
    env.DB.prepare("SELECT a, gagne FROM combats WHERE fini = 1 AND cree_le >= ? ORDER BY id DESC LIMIT 600").bind(depuis),
    env.DB.prepare("SELECT deck_a, deck_b, gagnant, a_id FROM duels WHERE statut = 'fini' AND deck_b IS NOT NULL AND fini_le >= ? ORDER BY id DESC LIMIT 400").bind(depuis),
    env.DB.prepare("SELECT SUM(classe = 1) AS classes, SUM(classe = 0) AS amicaux, SUM(aleatoire = 1) AS matchmaking FROM duels WHERE statut = 'fini' AND fini_le >= ?").bind(depuis),
  ]);
  const st = {};
  const compter = (deck, gagne) => { let d; try { d = JSON.parse(deck); } catch { return; } for (const u of d) { const x = (st[u.id] ||= { id: u.id, nom: CATALOGUE[u.id]?.nom || u.id, rarete: CATALOGUE[u.id]?.rarete, joues: 0, gagnes: 0 }); x.joues++; if (gagne) x.gagnes++; } };
  for (const c of decks.results) compter(c.a, !!c.gagne);
  for (const d of duelsDecks.results) { const aGagne = d.gagnant === d.a_id; compter(d.deck_a, aGagne); compter(d.deck_b, !aGagne); }
  const cartes = Object.values(st).map((x) => ({ ...x, taux: Math.round((x.gagnes / x.joues) * 100) }));
  return json({ parJour: { arene: parJourA.results, duels: parJourD.results }, modes: modes.results[0],
    plusJouees: cartes.sort((a, b) => b.joues - a.joues).slice(0, 15), meilleures: cartes.filter((x) => x.joues >= 5).sort((a, b) => b.taux - a.taux).slice(0, 10), pires: cartes.filter((x) => x.joues >= 5).sort((a, b) => a.taux - b.taux).slice(0, 10) });
}, { admin: true });


/* =====================================================================
   Notifications de l'admin : envoyer une notification (événement, annonce…) à tous ou à un groupe de joueurs
   L'envoi se fait par lots, relancés par la page d'admin, pour rester sous les limites du Worker.
   ===================================================================== */
const CIBLES_NOTIF = {
  tous: { nom: "Tous les joueurs abonnés", sql: "SELECT DISTINCT a.user_id FROM abonnements a JOIN users u ON u.id = a.user_id WHERE u.banni = 0", args: () => [] },
  actifs: { nom: "Joueurs actifs (7 derniers jours)", sql: "SELECT DISTINCT a.user_id FROM abonnements a JOIN users u ON u.id = a.user_id WHERE u.banni = 0 AND u.derniere_co > ?", args: (t) => [t - 7 * JOUR] },
  inactifs: { nom: "Joueurs absents depuis 3 jours (pour les faire revenir)", sql: "SELECT DISTINCT a.user_id FROM abonnements a JOIN users u ON u.id = a.user_id WHERE u.banni = 0 AND COALESCE(u.derniere_co, 0) < ?", args: (t) => [t - 3 * JOUR] },
  premium: { nom: "Joueurs Premium", sql: "SELECT DISTINCT a.user_id FROM abonnements a JOIN users u ON u.id = a.user_id WHERE u.banni = 0 AND u.premium_jusqu > ?", args: (t) => [t] },
  guildes: { nom: "Membres d'une guilde", sql: "SELECT DISTINCT a.user_id FROM abonnements a JOIN users u ON u.id = a.user_id JOIN guilde_membres m ON m.user_id = u.id WHERE u.banni = 0", args: () => [] },
};
const PAGES_NOTIF = ["accueil", "boosters", "ligues", "hub", "missions", "combat", "albums", "decks", "succes", "passe", "samedi", "guilde", "premium", "defi", "nations"];
// Prépare la file d'envoi d'une campagne (les destinataires sont calculés au moment de l'envoi)
async function preparerCampagne(env, c) {
  const t = maintenant();
  let ids = [];
  if (c.cible.startsWith("@")) { const u = await env.DB.prepare("SELECT id FROM users WHERE pseudo = ?").bind(c.cible.slice(1)).first(); if (u) ids = [u.id]; }
  else if (CIBLES_NOTIF[c.cible]) ids = (await env.DB.prepare(CIBLES_NOTIF[c.cible].sql).bind(...CIBLES_NOTIF[c.cible].args(t)).all()).results.map((x) => x.user_id);
  for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map((u) => env.DB.prepare("INSERT OR IGNORE INTO notifs_file (campagne_id, user_id) VALUES (?, ?)").bind(c.id, u)));
  await env.DB.prepare("UPDATE notifs_campagnes SET statut = ?, total = ? WHERE id = ?").bind(ids.length ? "envoi" : "fini", ids.length, c.id).run();
  if (c.discord) await annoncerDiscord(env, null, { titre: c.titre, texte: c.texte, url: c.url });
  return ids.length;
}
async function envoyerLot(env, c, n) {
  const { results } = await env.DB.prepare("SELECT user_id FROM notifs_file WHERE campagne_id = ? LIMIT ?").bind(c.id, n).all();
  for (const { user_id } of results) {
    await env.DB.prepare("DELETE FROM notifs_file WHERE campagne_id = ? AND user_id = ?").bind(c.id, user_id).run();
    await envoyerPush(env, user_id, { titre: c.titre, texte: c.texte, url: c.url }).catch((e) => console.error("notif", e));
  }
  if (results.length) await env.DB.prepare("UPDATE notifs_campagnes SET envoyes = envoyes + ? WHERE id = ?").bind(results.length, c.id).run();
  const reste = (await env.DB.prepare("SELECT COUNT(*) AS n FROM notifs_file WHERE campagne_id = ?").bind(c.id).first()).n;
  if (!reste) await env.DB.prepare("UPDATE notifs_campagnes SET statut = 'fini' WHERE id = ?").bind(c.id).run();
  return { envoyes: c.envoyes + results.length, total: c.total, restants: reste, lot: results.length };
}
// Toutes les 15 minutes : lance les notifications programmées et termine les envois interrompus
async function cronNotifs(env) {
  const t = maintenant();
  const { results: dues } = await env.DB.prepare("SELECT * FROM notifs_campagnes WHERE statut = 'programmee' AND programme_le <= ? ORDER BY programme_le LIMIT 5").bind(t).all();
  for (const c of dues) await preparerCampagne(env, c);
  let budget = 40;
  const { results: enCours } = await env.DB.prepare("SELECT * FROM notifs_campagnes WHERE statut = 'envoi' AND (programme_le IS NOT NULL OR cree_le < ?) ORDER BY id LIMIT 5").bind(t - 5 * 60000).all();
  for (const c of enCours) { if (budget <= 0) break; budget -= (await envoyerLot(env, c, budget)).lot; }
}
route("GET", "admin/notifs", async ({ env }) => {
  const t = maintenant(), comptes = {};
  for (const [k, c] of Object.entries(CIBLES_NOTIF)) comptes[k] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${c.sql})`).bind(...c.args(t)).first()).n;
  const { results } = await env.DB.prepare("SELECT id, titre, texte, url, cible, total, envoyes, par, cree_le, statut, programme_le, discord FROM notifs_campagnes ORDER BY (statut = 'programmee') DESC, id DESC LIMIT 30").all();
  return json({ cibles: Object.fromEntries(Object.entries(CIBLES_NOTIF).map(([k, c]) => [k, { nom: c.nom, n: comptes[k] }])), pages: PAGES_NOTIF, historique: results, discord: !!(await configDiscord(env)).webhook });
}, { admin: true });
route("POST", "admin/notifs", async ({ request, env, user }) => {
  const b = await corps(request), t = maintenant();
  const titre = String(b.titre || "").trim().slice(0, 80), texte = String(b.texte || "").trim().slice(0, 200);
  if (titre.length < 2 || texte.length < 2) return erreur("Indiquez un titre et un message.");
  const page = PAGES_NOTIF.includes(b.page) ? b.page : "accueil", url = page === "accueil" ? "./" : "./#" + page;
  let cible;
  if (b.cible === "pseudo") {
    const u = await env.DB.prepare("SELECT pseudo FROM users WHERE pseudo = ?").bind(String(b.pseudo || "")).first();
    if (!u) return erreur("Joueur introuvable.", 404);
    cible = "@" + u.pseudo;
  } else if (CIBLES_NOTIF[b.cible]) cible = b.cible;
  else return erreur("Cible inconnue.");
  const programme = Number(b.programme) || 0;
  if (programme && (programme < t - 60000 || programme > t + 60 * JOUR)) return erreur("La date d'envoi doit être dans les 60 prochains jours.");
  const differe = programme > t + 60000;
  const r = await env.DB.prepare("INSERT INTO notifs_campagnes (titre, texte, url, cible, total, par, cree_le, statut, programme_le, discord) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)")
    .bind(titre, texte, url, cible, user.pseudo, t, differe ? "programmee" : "envoi", differe ? programme : null, b.discord ? 1 : 0).run();
  const id = r.meta.last_row_id;
  if (differe) {
    await journaliser(env, user.id, "notification programmée", `${titre} → ${new Date(programme).toISOString()}`, "admin");
    return json({ id, programme });
  }
  const total = await preparerCampagne(env, { id, titre, texte, url, cible, discord: b.discord ? 1 : 0 });
  if (!total && !b.discord) { await env.DB.prepare("DELETE FROM notifs_campagnes WHERE id = ?").bind(id).run(); return erreur("Aucun joueur abonné aux notifications dans cette cible."); }
  await journaliser(env, user.id, "notification envoyée", `${titre} → ${total} joueur(s)`, "admin");
  return json({ id, total });
}, { admin: true });
route("POST", "admin/notifs/(\\d+)/envoyer", async ({ env, p }) => {
  const c = await env.DB.prepare("SELECT * FROM notifs_campagnes WHERE id = ?").bind(p[1]).first();
  if (!c) return erreur("Envoi introuvable.", 404);
  if (c.statut === "programmee") return erreur("Cette notification est programmée : elle partira toute seule.");
  return json(await envoyerLot(env, c, 15));
}, { admin: true });
route("DELETE", "admin/notifs/(\\d+)", async ({ env, p }) => {
  const r = await env.DB.prepare("DELETE FROM notifs_campagnes WHERE id = ? AND statut = 'programmee'").bind(p[1]).run();
  if (!r.meta.changes) return erreur("Seule une notification programmée (pas encore partie) peut être annulée.");
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Discord : lien d'invitation et annonces automatiques (webhook configuré dans l'admin)
   ===================================================================== */
const INVITATION_DISCORD = "https://discord.gg/uHnvkZYB6c";
const SITE_PUBLIC = "https://play2f1.com";
let discordCache = { t: 0, v: null };
async function configDiscord(env) {
  if (discordCache.v && maintenant() - discordCache.t < 30000) return discordCache.v;
  const lu = (await lireConfig(env, "discord")) || {};
  const v = { webhook: lu.webhook || "", invitation: lu.invitation || INVITATION_DISCORD, annonces: { legendaires: true, tournois: true, evenements: true, ...(lu.annonces || {}) } };
  discordCache = { t: maintenant(), v };
  return v;
}
// type : legendaires, tournois, evenements (désactivables dans l'admin) ; null = annonce manuelle
async function annoncerDiscord(env, type, { titre, texte, url, couleur }) {
  const c = await configDiscord(env);
  if (!c.webhook || (type && !c.annonces[type])) return false;
  const lien = SITE_PUBLIC + "/" + String(url || "").replace(/^\.\//, "");
  try {
    const r = await fetch(c.webhook, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Play2F1", avatar_url: SITE_PUBLIC + "/icons/icon-192.png", allowed_mentions: { parse: [] },
        embeds: [{ title: String(titre).slice(0, 250), description: String(texte || "").slice(0, 1500), url: lien, color: couleur || 0x0a5cf7, footer: { text: "play2f1.com" } }] }) });
    return r.ok;
  } catch (e) { console.error("discord", e); return false; }
}
const WEBHOOK_DISCORD = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/;
route("GET", "admin/discord", async ({ env }) => { const c = await configDiscord(env); return json({ ...c, webhook: c.webhook ? c.webhook.replace(/\/[\w-]{20,100}$/, "/••••••") : "", configure: !!c.webhook }); }, { admin: true });
route("PUT", "admin/discord", async ({ request, env, user }) => {
  const b = await corps(request), act = (await lireConfig(env, "discord")) || {};
  const nv = { ...act };
  if (b.webhook !== undefined && !String(b.webhook).includes("••")) {
    const w = String(b.webhook || "").trim();
    if (w && !WEBHOOK_DISCORD.test(w)) return erreur("Adresse de webhook Discord invalide (Paramètres du salon → Intégrations → Webhooks → Copier l'URL).");
    nv.webhook = w;
  }
  if (b.invitation !== undefined) {
    const inv = String(b.invitation || "").trim();
    if (inv && !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]{2,40}$/.test(inv)) return erreur("Lien d'invitation invalide (https://discord.gg/…).");
    nv.invitation = inv;
  }
  if (b.annonces) nv.annonces = { legendaires: !!b.annonces.legendaires, tournois: !!b.annonces.tournois, evenements: !!b.annonces.evenements };
  await ecrireConfig(env, "discord", nv);
  discordCache = { t: 0, v: null };
  await journaliser(env, user.id, "réglages Discord modifiés", "", "admin");
  return json({ ok: true });
}, { admin: true });
route("POST", "admin/discord/tester", async ({ env }) => {
  const ok = await annoncerDiscord(env, null, { titre: "👋 Play2F1 est connecté à Discord", texte: "Les annonces automatiques (légendaires, tournois, événements) arriveront dans ce salon.", url: "./" });
  return ok ? json({ ok: true }) : erreur("Discord n'a pas accepté le message : vérifiez le webhook.", 502);
}, { admin: true });

/* =====================================================================
   Défi du jour : deviner un pays d'après sa silhouette, en 6 essais (le même pour tout le monde).
   Chaque essai donne la distance, la direction et la proximité. Ouvert à tous, récompensé pour les comptes.
   ===================================================================== */
const CENTRES = CENTRES_DATA.CENTRES_PAYS, SILS = SILHOUETTES_DATA.SILHOUETTES;
const NOMS_PAYS = Object.fromEntries(MONDE.PAYS_BRUTS.map((p) => [p[0], p[1]]));
const PAYS_DEVINABLES = Object.keys(CENTRES).filter((c) => NOMS_PAYS[c]);
// Pays tirés : assez grands pour être reconnaissables (plus de 20 000 km²)
const POOL_DEFI = PAYS_DEVINABLES.filter((c) => CENTRES[c][2] > 20000 && SILS[c]).sort();
const ESSAIS_DEFI = 6, RECOMPENSES_DEFI = [0, 400, 300, 250, 200, 150, 100];
const jourBruxelles = (t = maintenant()) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
const numeroDefi = (jour) => Math.round((Date.parse(jour + "T12:00:00Z") - Date.parse("2026-10-12T12:00:00Z")) / JOUR) + 1;
let ordreDefi = null;
async function paysDuJour(env, jour) {
  if (!ordreDefi) {
    let sel = await lireConfig(env, "defi_sel");
    if (!sel) { sel = [...aleatoire(8)].map((x) => x.toString(16).padStart(2, "0")).join(""); await ecrireConfig(env, "defi_sel", sel); }
    // Ordre secret mélangé une fois pour toutes : aucun pays ne revient avant que tous soient passés
    const rng = COMBAT.rng(COMBAT.hash("defi:" + sel)), o = POOL_DEFI.slice();
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    ordreDefi = o;
  }
  const n = numeroDefi(jour);
  return ordreDefi[((n - 1) % ordreDefi.length + ordreDefi.length) % ordreDefi.length];
}
const FLECHES = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
function comparerPays(code, cible) {
  if (code === cible) return { code, nom: NOMS_PAYS[code], distance: 0, fleche: "🎯", proximite: 100, juste: true };
  const [la1, lo1] = CENTRES[code], [la2, lo2] = CENTRES[cible], r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  const distance = Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
  const cap = (Math.atan2(Math.sin(dLo) * Math.cos(la2 * r), Math.cos(la1 * r) * Math.sin(la2 * r) - Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos(dLo)) / r + 360) % 360;
  return { code, nom: NOMS_PAYS[code], distance, fleche: FLECHES[Math.round(cap / 45) % 8], proximite: Math.max(0, Math.round((1 - distance / 20015) * 100)), juste: false };
}
async function serieDefi(env, userId, jour) {
  const { results } = await env.DB.prepare("SELECT jour FROM defi_jour WHERE user_id = ? AND gagne = 1 ORDER BY jour DESC LIMIT 400").bind(userId).all();
  let serie = 0, attendu = jour;
  if (results[0] && results[0].jour !== jour) attendu = jourBruxelles(Date.parse(jour + "T12:00:00Z") - JOUR); // la série tient jusqu'au soir
  for (const { jour: j } of results) { if (j !== attendu) break; serie++; attendu = jourBruxelles(Date.parse(j + "T12:00:00Z") - JOUR); }
  return serie;
}
route("GET", "defi", async ({ env, user }) => {
  const jour = jourBruxelles(), cible = await paysDuJour(env, jour);
  const ligne = user ? await env.DB.prepare("SELECT essais, fini, gagne FROM defi_jour WHERE jour = ? AND user_id = ?").bind(jour, user.id).first() : null;
  const { results: top } = await env.DB.prepare(`SELECT u.pseudo, json_array_length(d.essais) AS n, d.maj FROM defi_jour d JOIN users u ON u.id = d.user_id
    WHERE d.jour = ? AND d.gagne = 1 AND u.banni = 0 ORDER BY n, d.maj LIMIT 10`).bind(jour).all();
  const stats = await env.DB.prepare("SELECT COUNT(*) AS joueurs, SUM(gagne) AS gagnants FROM defi_jour WHERE jour = ? AND fini = 1").bind(jour).first();
  return json({ jour, numero: numeroDefi(jour), silhouette: SILS[cible], essaisMax: ESSAIS_DEFI, pays: PAYS_DEVINABLES.map((c) => [c, NOMS_PAYS[c]]),
    essais: ligne ? JSON.parse(ligne.essais) : null, fini: !!ligne?.fini, gagne: !!ligne?.gagne, solution: ligne?.fini ? { code: cible, nom: NOMS_PAYS[cible] } : null,
    serie: user ? await serieDefi(env, user.id, jour) : 0, top, joueurs: stats.joueurs || 0, gagnants: stats.gagnants || 0, recompenses: RECOMPENSES_DEFI });
});
route("POST", "defi/essai", async ({ request, env, user, ctx }) => {
  const b = await corps(request), jour = jourBruxelles(), cible = await paysDuJour(env, jour);
  const code = String(b.code || "").toUpperCase();
  if (!CENTRES[code] || !NOMS_PAYS[code]) return erreur("Pays inconnu : choisissez-le dans la liste.");
  if (!user) {
    // Sans compte : rien n'est enregistré (le navigateur garde les essais), la solution est donnée au 6e essai
    const n = Math.min(ESSAIS_DEFI, Math.max(1, Math.floor(Number(b.numero) || 1)));
    const res = comparerPays(code, cible), fini = res.juste || n >= ESSAIS_DEFI;
    return json({ resultat: res, fini, gagne: res.juste, solution: fini ? { code: cible, nom: NOMS_PAYS[cible] } : null });
  }
  const ligne = await env.DB.prepare("SELECT essais, fini FROM defi_jour WHERE jour = ? AND user_id = ?").bind(jour, user.id).first();
  const essais = ligne ? JSON.parse(ligne.essais) : [];
  if (ligne?.fini) return erreur("Vous avez déjà terminé le défi du jour. Revenez demain !");
  if (essais.some((e) => e.code === code)) return erreur("Vous avez déjà proposé ce pays.");
  const res = comparerPays(code, cible);
  essais.push(res);
  const fini = res.juste || essais.length >= ESSAIS_DEFI;
  await env.DB.prepare(`INSERT INTO defi_jour (jour, user_id, essais, fini, gagne, maj) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(jour, user_id) DO UPDATE SET essais = excluded.essais, fini = excluded.fini, gagne = excluded.gagne, maj = excluded.maj WHERE defi_jour.fini = 0`)
    .bind(jour, user.id, JSON.stringify(essais), fini ? 1 : 0, res.juste ? 1 : 0, maintenant()).run();
  let recompense = 0;
  if (res.juste) {
    recompense = RECOMPENSES_DEFI[essais.length];
    await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le) VALUES (?, ?, 0, ?, ?)").bind(user.id, recompense, `🌍 Défi du jour n° ${numeroDefi(jour)} trouvé en ${essais.length} essai${essais.length > 1 ? "s" : ""} !`, maintenant()).run();
    enArrierePlan(ctx, pointsNations(env, user.id, 7 - essais.length));
  }
  return json({ resultat: res, fini, gagne: res.juste, recompense, essais, solution: fini ? { code: cible, nom: NOMS_PAYS[cible] } : null, serie: fini ? await serieDefi(env, user.id, jour) : 0 });
}, {});

/* =====================================================================
   Coupe des nations : chaque joueur représente un pays ; les points de la semaine s'additionnent
   (connexion du jour +1, défi du jour +1 à +6, victoire classée en arène +3, duel classé gagné +5).
   ===================================================================== */
const LOTS_NATIONS = [[500, { or: 1 }, "🥇"], [300, { argent: 1 }, "🥈"], [150, {}, "🥉"]];
const MIN_POINTS_LOT = 5;
async function pointsNations(env, userId, points) {
  if (!userId || !points) return;
  const u = await env.DB.prepare("SELECT nation FROM users WHERE id = ?").bind(userId).first();
  if (!u?.nation) return;
  await env.DB.prepare(`INSERT INTO nations_points (semaine, user_id, nation, points) VALUES (?, ?, ?, ?)
    ON CONFLICT(semaine, user_id) DO UPDATE SET points = points + excluded.points`).bind(semaineCourante(), userId, u.nation, points).run();
}
async function classementNations(env, semaine) {
  const { results } = await env.DB.prepare(`SELECT n.nation, SUM(n.points) AS points, COUNT(*) AS joueurs,
      (SELECT u.pseudo FROM nations_points m JOIN users u ON u.id = m.user_id WHERE m.semaine = n.semaine AND m.nation = n.nation AND u.banni = 0 ORDER BY m.points DESC LIMIT 1) AS meilleur
    FROM nations_points n JOIN users u ON u.id = n.user_id WHERE n.semaine = ? AND u.banni = 0 GROUP BY n.nation ORDER BY points DESC LIMIT 100`).bind(semaine).all();
  return results.map((x) => ({ ...x, nom: NOMS_PAYS[x.nation] || x.nation }));
}
// Lundi : les membres actifs (au moins 5 points) des 3 meilleures nations de la semaine passée reçoivent un lot
async function cloturerNations(env) {
  const passee = semaineCourante(1);
  if ((await lireConfig(env, "nations_cloture")) === passee) return;
  await ecrireConfig(env, "nations_cloture", passee);
  const podium = (await classementNations(env, passee)).slice(0, 3);
  for (const [i, n] of podium.entries()) {
    const [pieces, detail, med] = LOTS_NATIONS[i];
    const { results } = await env.DB.prepare("SELECT user_id FROM nations_points WHERE semaine = ? AND nation = ? AND points >= ?").bind(passee, n.nation, MIN_POINTS_LOT).all();
    for (let k = 0; k < results.length; k += 50) await env.DB.batch(results.slice(k, k + 50).map((x) => env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, boosters_detail, message, cree_le) VALUES (?, ?, 0, ?, ?, ?)")
      .bind(x.user_id, pieces, JSON.stringify(detail), `${med} Coupe des nations : ${n.nom} termine ${i + 1}${i ? "e" : "re"} de la semaine !`, maintenant())));
  }
  if (podium.length) await annoncerDiscord(env, "tournois", { titre: `🌍 Coupe des nations : ${podium[0].nom} gagne la semaine !`, texte: podium.map((n, i) => `${LOTS_NATIONS[i][2]} **${n.nom}** — ${n.points} points (${n.joueurs} joueur${n.joueurs > 1 ? "s" : ""})`).join("\n"), url: "./#nations", couleur: 0x2fbf71 });
}
route("GET", "nations", async ({ env, user }) => {
  const semaine = semaineCourante(), [classement, precedente] = [await classementNations(env, semaine), (await classementNations(env, semaineCourante(1))).slice(0, 3)];
  let moi = null;
  if (user) {
    const u = await env.DB.prepare("SELECT nation, nation_le FROM users WHERE id = ?").bind(user.id).first();
    const p = await env.DB.prepare("SELECT points FROM nations_points WHERE semaine = ? AND user_id = ?").bind(semaine, user.id).first();
    const membres = u?.nation ? (await env.DB.prepare(`SELECT u.pseudo, n.points FROM nations_points n JOIN users u ON u.id = n.user_id WHERE n.semaine = ? AND n.nation = ? AND u.banni = 0 ORDER BY n.points DESC LIMIT 10`).bind(semaine, u.nation).all()).results : [];
    moi = { nation: u?.nation || null, nom: u?.nation ? NOMS_PAYS[u.nation] : null, points: p?.points || 0, changementLe: (u?.nation_le || 0) + 30 * JOUR, membres };
  }
  const fin = Date.parse(semaine + "T00:00:00Z") + 7 * JOUR;
  return json({ semaine, fin, classement, precedente, moi, lots: LOTS_NATIONS.map(([p, d]) => ({ pieces: p, boosters: d })), minPoints: MIN_POINTS_LOT, pays: PAYS_DEVINABLES.concat(Object.keys(NOMS_PAYS).filter((c) => !CENTRES[c])).map((c) => [c, NOMS_PAYS[c]]).sort((a, b) => a[1].localeCompare(b[1], "fr")) });
});
route("PUT", "nations/moi", async ({ request, env, user }) => {
  const b = await corps(request), code = String(b.code || "").toUpperCase();
  if (!NOMS_PAYS[code]) return erreur("Pays inconnu.");
  const u = await env.DB.prepare("SELECT nation, nation_le FROM users WHERE id = ?").bind(user.id).first();
  if (u.nation === code) return json({ ok: true });
  if (u.nation && maintenant() - (u.nation_le || 0) < 30 * JOUR) return erreur(`Vous pourrez changer de pays le ${new Date(u.nation_le + 30 * JOUR).toLocaleDateString("fr-FR")}.`);
  await env.DB.prepare("UPDATE users SET nation = ?, nation_le = ? WHERE id = ?").bind(code, maintenant(), user.id).run();
  // Les points déjà gagnés cette semaine suivent le joueur dans son nouveau pays
  await env.DB.prepare("UPDATE nations_points SET nation = ? WHERE semaine = ? AND user_id = ?").bind(code, semaineCourante(), user.id).run();
  return json({ ok: true });
}, { connecte: true });

/* =====================================================================
   Duels en spectateur : les amis et les membres de la guilde peuvent suivre un duel en direct,
   avec 2 tours de retard (on ne peut pas souffler les coups à un joueur).
   ===================================================================== */
const RETARD_SPECTATEUR = 2;
const peutRegarder = async (env, user, d) => user.admin || !!(await env.DB.prepare(`SELECT 1 WHERE
    EXISTS (SELECT 1 FROM amis f WHERE f.user_id = ?1 AND f.ami_id IN (?2, ?3) AND EXISTS (SELECT 1 FROM amis g WHERE g.user_id = f.ami_id AND g.ami_id = ?1))
    OR EXISTS (SELECT 1 FROM guilde_membres m1 JOIN guilde_membres m2 ON m2.guilde_id = m1.guilde_id WHERE m1.user_id = ?1 AND m2.user_id IN (?2, ?3))`).bind(user.id, d.a_id, d.b_id).first());
route("GET", "duels/direct", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT d.id, ua.pseudo AS a, ub.pseudo AS b, d.classe, json_array_length(d.paires) AS tours, d.cree_le
    FROM duels d JOIN users ua ON ua.id = d.a_id JOIN users ub ON ub.id = d.b_id
    WHERE d.statut = 'encours' AND d.limite > ?2 AND ?1 NOT IN (d.a_id, d.b_id) AND (
      EXISTS (SELECT 1 FROM amis f WHERE f.user_id = ?1 AND f.ami_id IN (d.a_id, d.b_id) AND EXISTS (SELECT 1 FROM amis g WHERE g.user_id = f.ami_id AND g.ami_id = ?1))
      OR EXISTS (SELECT 1 FROM guilde_membres m1 JOIN guilde_membres m2 ON m2.guilde_id = m1.guilde_id WHERE m1.user_id = ?1 AND m2.user_id IN (d.a_id, d.b_id)))
    ORDER BY d.id DESC LIMIT 20`).bind(user.id, maintenant() - 2 * 60000).all();
  return json({ duels: results });
}, { connecte: true });
route("GET", "duels/(\\d+)/regarder", async ({ env, user, p }) => {
  let d = await env.DB.prepare("SELECT d.*, ua.pseudo AS pa, ub.pseudo AS pb FROM duels d JOIN users ua ON ua.id = d.a_id JOIN users ub ON ub.id = d.b_id WHERE d.id = ?").bind(p[1]).first();
  if (!d || !d.deck_b || !["encours", "fini"].includes(d.statut)) return erreur("Ce duel n'est pas visible.", 404);
  if (!(await peutRegarder(env, user, d))) return erreur("Seuls les amis et les membres de la guilde des joueurs peuvent regarder ce duel.", 403);
  const { pa, pb } = d;
  d = { ...(await avancerDuel(env, d)), pa, pb };
  const paires = JSON.parse(d.paires);
  return json({ id: d.id, statut: d.statut, a: pa, b: pb, deckA: JSON.parse(d.deck_a), deckB: JSON.parse(d.deck_b), graine: d.graine, classe: !!d.classe,
    paires: d.statut === "encours" ? paires.slice(0, Math.max(0, paires.length - RETARD_SPECTATEUR)) : paires, retard: d.statut === "encours" ? RETARD_SPECTATEUR : 0,
    gagnant: d.statut === "fini" ? (d.gagnant === d.a_id ? 0 : 1) : null });
}, { connecte: true });

/* =====================================================================
   Cartes recherchées : chacun publie sa liste, le jeu propose les joueurs qui ont la carte en double
   ===================================================================== */
const SOUHAITS_MAX = 30;
const cheminCarte = (id) => `$.sauvegarde.owned."${id}"`; // id validé par le catalogue
route("GET", "souhaits", async ({ env, user }) => {
  const { results: miens } = await env.DB.prepare("SELECT carte FROM souhaits WHERE user_id = ? ORDER BY cree_le DESC").bind(user.id).all();
  const liste = [];
  for (const { carte } of miens.filter((x) => CATALOGUE[x.carte])) {
    const { results } = await env.DB.prepare(`SELECT u.pseudo, CAST(json_extract(s.data, ?) AS INTEGER) AS n FROM sauvegardes s JOIN users u ON u.id = s.user_id
      WHERE u.id != ? AND u.banni = 0 AND CAST(json_extract(s.data, ?) AS INTEGER) >= 2 ORDER BY COALESCE(u.derniere_co, 0) DESC LIMIT 6`).bind(cheminCarte(carte), user.id, cheminCarte(carte)).all();
    liste.push({ carte, joueurs: results });
  }
  // Dans l'autre sens : qui cherche une carte que j'ai en double ?
  const moi = await env.DB.prepare("SELECT data FROM sauvegardes WHERE user_id = ?").bind(user.id).first();
  let doubles = []; try { const o = JSON.parse(moi?.data || "{}").sauvegarde?.owned || {}; doubles = Object.keys(o).filter((id) => o[id] >= 2 && CATALOGUE[id]); } catch {}
  let demandes = [];
  if (doubles.length) {
    const { results } = await env.DB.prepare(`SELECT s.carte, u.pseudo FROM souhaits s JOIN users u ON u.id = s.user_id
      WHERE s.user_id != ? AND u.banni = 0 AND s.carte IN (SELECT value FROM json_each(?)) ORDER BY COALESCE(u.derniere_co, 0) DESC LIMIT 60`).bind(user.id, JSON.stringify(doubles)).all();
    demandes = results;
  }
  return json({ souhaits: liste, demandes, max: SOUHAITS_MAX });
}, { connecte: true });
route("PUT", "souhaits/([^/]{3,80})", async ({ env, user, p }) => {
  const carte = decodeURIComponent(p[1]);
  if (!CATALOGUE[carte]) return erreur("Carte inconnue.");
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM souhaits WHERE user_id = ?").bind(user.id).first();
  if (n.n >= SOUHAITS_MAX) return erreur(`${SOUHAITS_MAX} cartes recherchées au maximum : retirez-en une d'abord.`);
  await env.DB.prepare("INSERT OR IGNORE INTO souhaits (user_id, carte, cree_le) VALUES (?, ?, ?)").bind(user.id, carte, maintenant()).run();
  return json({ ok: true });
}, { connecte: true });
route("DELETE", "souhaits/([^/]{3,80})", async ({ env, user, p }) => {
  await env.DB.prepare("DELETE FROM souhaits WHERE user_id = ? AND carte = ?").bind(user.id, decodeURIComponent(p[1])).run();
  return json({ ok: true });
}, { connecte: true });

/* =====================================================================
   Applis Android et iPhone : lien entre l'appli Android (Trusted Web Activity) et le site
   ===================================================================== */
route("GET", "apps/assetlinks", async ({ env }) => {
  const c = (await lireConfig(env, "apps")) || {};
  const empreintes = String(c.empreintes || "").split(/[\s,]+/).filter((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(x)).map((x) => x.toUpperCase());
  const liens = c.paquet && empreintes.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: c.paquet, sha256_cert_fingerprints: empreintes } }] : [];
  return json(liens, 200, { "cache-control": "public, max-age=300" });
});
route("GET", "admin/apps", async ({ env }) => json((await lireConfig(env, "apps")) || {}), { admin: true });
route("PUT", "admin/apps", async ({ request, env }) => {
  const b = await corps(request);
  const paquet = String(b.paquet || "").trim();
  if (paquet && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(paquet)) return erreur("Nom de paquet invalide (ex. com.play2f1.app).");
  const empreintes = String(b.empreintes || "").trim();
  if (empreintes && !empreintes.split(/[\s,]+/).every((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(x))) return erreur("Empreinte SHA-256 invalide (32 octets séparés par « : »).");
  await ecrireConfig(env, "apps", { paquet, empreintes, android: String(b.android || "").trim().slice(0, 300), ios: String(b.ios || "").trim().slice(0, 300) });
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Tutoriel des nouveaux joueurs : récompense unique quand les étapes sont faites
   ===================================================================== */
route("POST", "tuto/recompense", async ({ env, user }) => {
  const s = await env.DB.prepare("SELECT data FROM sauvegardes WHERE user_id = ?").bind(user.id).first();
  let sv = {}; try { sv = JSON.parse(s?.data || "{}").sauvegarde || {}; } catch {}
  const combats = (sv.combat?.victoires || 0) + (sv.combat?.defaites || 0);
  if (!((sv.ouverts || 0) >= 1 && (sv.deck || []).length >= 1 && combats >= 1)) return erreur("Terminez d'abord toutes les étapes (la progression est enregistrée toutes les quelques secondes : réessayez dans un instant).");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO notifs_envoyees (user_id, type, cle, cree_le) VALUES (?, 'tuto', 'recompense', ?)").bind(user.id, maintenant()).run();
  if (!r.meta.changes) return erreur("Récompense déjà récupérée.", 409);
  await env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, boosters_detail, message, cree_le) VALUES (?, 500, 2, ?, ?, ?)").bind(user.id, JSON.stringify({ argent: 1 }), "🎓 Tutoriel terminé : bienvenue dans Play2F1 !", maintenant()).run();
  return json({ ok: true });
}, { connecte: true });

/* =====================================================================
   Suivi des joueurs : rétention (J1, J7, J30), joueurs actifs et entonnoir des nouveaux
   ===================================================================== */
route("GET", "admin/retention", async ({ env }) => {
  const t = maintenant(), depuis30 = t - 30 * JOUR, jour = (ms) => new Date(ms).toISOString().slice(0, 10);
  // Les jours d'inscription et de dernière connexion comptent comme jours d'activité (historique d'avant le suivi)
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO activite (user_id, jour) SELECT id, date(cree_le / 1000, 'unixepoch') FROM users"),
    env.DB.prepare("INSERT OR IGNORE INTO activite (user_id, jour) SELECT id, date(derniere_co / 1000, 'unixepoch') FROM users WHERE derniere_co IS NOT NULL"),
  ]);
  const [cohortes, parJour, actifs, entonnoir] = await env.DB.batch([
    env.DB.prepare(`SELECT date(u.cree_le / 1000, 'unixepoch') AS jour, COUNT(*) AS inscrits,
      SUM(EXISTS (SELECT 1 FROM activite a WHERE a.user_id = u.id AND a.jour = date(u.cree_le / 1000, 'unixepoch', '+1 day'))) AS j1,
      SUM(EXISTS (SELECT 1 FROM activite a WHERE a.user_id = u.id AND a.jour BETWEEN date(u.cree_le / 1000, 'unixepoch', '+6 day') AND date(u.cree_le / 1000, 'unixepoch', '+8 day'))) AS j7,
      SUM(EXISTS (SELECT 1 FROM activite a WHERE a.user_id = u.id AND a.jour BETWEEN date(u.cree_le / 1000, 'unixepoch', '+28 day') AND date(u.cree_le / 1000, 'unixepoch', '+32 day'))) AS j30,
      SUM(EXISTS (SELECT 1 FROM activite a WHERE a.user_id = u.id AND a.jour > date(u.cree_le / 1000, 'unixepoch'))) AS revenus
      FROM users u WHERE u.cree_le > ? GROUP BY jour ORDER BY jour DESC`).bind(t - 60 * JOUR),
    env.DB.prepare("SELECT jour, COUNT(*) AS n FROM activite WHERE jour >= ? GROUP BY jour ORDER BY jour").bind(jour(depuis30)),
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM activite WHERE jour = ?1) AS jour, (SELECT COUNT(DISTINCT user_id) FROM activite WHERE jour > ?2) AS semaine,
      (SELECT COUNT(DISTINCT user_id) FROM activite WHERE jour > ?3) AS mois, (SELECT COUNT(*) FROM users) AS total`).bind(jour(t), jour(t - 7 * JOUR), jour(depuis30)),
    env.DB.prepare(`SELECT COUNT(*) AS inscrits,
      SUM(COALESCE(json_extract(s.data, '$.sauvegarde.ouverts'), 0) >= 1) AS booster,
      SUM(COALESCE(json_extract(s.data, '$.sauvegarde.ouverts'), 0) >= 5) AS boosters5,
      SUM(COALESCE(json_array_length(json_extract(s.data, '$.sauvegarde.deck')), 0) >= 1) AS deck,
      SUM(COALESCE(json_extract(s.data, '$.sauvegarde.combat.victoires'), 0) + COALESCE(json_extract(s.data, '$.sauvegarde.combat.defaites'), 0) >= 1
        OR EXISTS (SELECT 1 FROM arene ar WHERE ar.user_id = u.id AND ar.victoires + ar.defaites > 0)) AS combat,
      SUM(json_extract(s.data, '$.sauvegarde.tuto.fini') IS NOT NULL) AS tuto,
      SUM(EXISTS (SELECT 1 FROM activite a WHERE a.user_id = u.id AND a.jour > date(u.cree_le / 1000, 'unixepoch'))) AS revenu,
      SUM(COALESCE(json_extract(s.data, '$.sauvegarde.xp'), 0) >= 720) AS niveau5,
      SUM(EXISTS (SELECT 1 FROM paiements p WHERE p.user_id = u.id AND p.statut = 'paye')) AS payeur
      FROM users u LEFT JOIN sauvegardes s ON s.user_id = u.id WHERE u.cree_le > ?`).bind(depuis30),
  ]);
  return json({ cohortes: cohortes.results, parJour: parJour.results, actifs: actifs.results[0], entonnoir: entonnoir.results[0] });
}, { admin: true });

/* =====================================================================
   Défi viral : les plus belles ouvertures de booster de la semaine, et les amis prévenus d'une légendaire
   ===================================================================== */
const POINTS_RARETE = { "commun": 1, "peu-commun": 2, "rare": 5, "epique": 15, "ultra-rare": 40, "legendaire": 100, "secrete": 100 };
const DERNIERE_OUVERTURE = new Map();
route("POST", "ouvertures", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  if (maintenant() - (DERNIERE_OUVERTURE.get(user.id) || 0) < 4000) return json({ ok: true, ignore: true });
  DERNIERE_OUVERTURE.set(user.id, maintenant());
  const cartes = (Array.isArray(b.cartes) ? b.cartes : []).map(String).slice(0, 6), shiny = new Set((Array.isArray(b.shiny) ? b.shiny : []).map(String));
  if (!cartes.length || cartes.some((id) => !CATALOGUE[id])) return erreur("Ouverture invalide.");
  const score = cartes.reduce((t, id) => t + (POINTS_RARETE[CATALOGUE[id].rarete] || 1) * (shiny.has(id) ? 2 : 1), 0);
  const sem = semaineCourante();
  await env.DB.prepare(`INSERT INTO ouvertures_semaine (semaine, user_id, score, cartes, pack, cree_le) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(semaine, user_id) DO UPDATE SET score = excluded.score, cartes = excluded.cartes, pack = excluded.pack, cree_le = excluded.cree_le WHERE excluded.score > ouvertures_semaine.score`)
    .bind(sem, user.id, score, JSON.stringify(cartes.map((id) => ({ id, s: shiny.has(id) }))), String(b.pack || "").slice(0, 20), maintenant()).run();
  // Une légendaire : les amis (réciproques) sont prévenus, une fois par jour au maximum
  const leg = cartes.find((id) => CATALOGUE[id].rarete === "legendaire");
  if (leg) enArrierePlan(ctx, (async () => {
    const r1 = await env.DB.prepare("INSERT OR IGNORE INTO notifs_envoyees (user_id, type, cle, cree_le) VALUES (?, 'discord-leg', ?, ?)").bind(user.id, jourUTC(), maintenant()).run();
    if (r1.meta.changes) await annoncerDiscord(env, "legendaires", { titre: `🌟 ${user.pseudo} a ouvert une carte légendaire !`, texte: `**${CATALOGUE[leg].nom}**${shiny.has(leg) ? " ✨ en version Shiny" : ""}. Qui sera le prochain ?`, url: "./#boosters", couleur: 0xf5b21b });
    const { results } = await env.DB.prepare("SELECT a.ami_id AS id FROM amis a WHERE a.user_id = ?1 AND EXISTS (SELECT 1 FROM amis b WHERE b.user_id = a.ami_id AND b.ami_id = ?1) LIMIT 50").bind(user.id).all();
    for (const x of results) await notifierUneFois(env, x.id, "ami-legendaire", `${jourUTC()}:${user.id}`, { titre: `🌟 ${user.pseudo} vient d'ouvrir une légendaire !`, texte: `${CATALOGUE[leg].nom} : à vous de tenter votre chance.`, url: "./#boosters" });
  })());
  const rang = await env.DB.prepare("SELECT COUNT(*) + 1 AS r FROM ouvertures_semaine WHERE semaine = ? AND score > ?").bind(sem, score).first();
  return json({ score, rang: rang.r });
}, { connecte: true });
route("GET", "ouvertures/semaine", async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT o.score, o.cartes, o.pack, o.cree_le, u.pseudo FROM ouvertures_semaine o JOIN users u ON u.id = o.user_id
    WHERE o.semaine = ? AND u.banni = 0 ORDER BY o.score DESC, o.cree_le ASC LIMIT 10`).bind(semaineCourante()).all();
  return json({ semaine: semaineCourante(), top: results.map((x) => ({ ...x, cartes: JSON.parse(x.cartes) })) }, 200, { "cache-control": "public, max-age=30" });
});

/* =====================================================================
   Cosmétiques achetés, code créateur (part reversée sur les achats des joueurs qui le soutiennent), cartes dédicacées
   ===================================================================== */
route("GET", "cosmetiques/achetes", async ({ env, user }) => {
  const { results } = await env.DB.prepare("SELECT cle FROM cosmetiques_achats WHERE user_id = ?").bind(user.id).all();
  return json({ cosmetiques: results.map((x) => x.cle), codeCreateur: user.code_createur || null });
}, { connecte: true });
async function enregistrerVenteCreateur(env, s, acheteurId) {
  const code = String(s.metadata?.createur || "");
  if (!code) return;
  const c = await env.DB.prepare("SELECT user_id, part FROM createurs WHERE code = ? AND actif = 1").bind(code).first();
  if (!c || c.user_id === acheteurId) return;
  const montant = (s.amount_total || 0) / 100;
  await env.DB.prepare("INSERT OR IGNORE INTO createurs_ventes (commande, createur_id, acheteur_id, montant, part, cree_le) VALUES (?, ?, ?, ?, ?, ?)").bind(s.id, c.user_id, acheteurId, montant.toFixed(2), ((montant * c.part) / 100).toFixed(2), maintenant()).run();
}
route("PUT", "createur/soutien", async ({ request, env, user }) => {
  const b = await corps(request), code = String(b.code || "").trim();
  if (!code) { await env.DB.prepare("UPDATE users SET code_createur = NULL WHERE id = ?").bind(user.id).run(); return json({ ok: true, code: null }); }
  const c = await env.DB.prepare("SELECT c.code, u.pseudo, c.user_id FROM createurs c JOIN users u ON u.id = c.user_id WHERE c.code = ? AND c.actif = 1").bind(code).first();
  if (!c) return erreur("Code créateur inconnu.");
  if (c.user_id === user.id) return erreur("Vous ne pouvez pas utiliser votre propre code.");
  await env.DB.prepare("UPDATE users SET code_createur = ? WHERE id = ?").bind(c.code, user.id).run();
  return json({ ok: true, code: c.code, createur: c.pseudo });
}, { connecte: true });
route("GET", "createur/moi", async ({ env, user }) => {
  const c = await env.DB.prepare("SELECT code, part, actif FROM createurs WHERE user_id = ?").bind(user.id).first();
  if (!c) return json({ createur: null });
  const st = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(CAST(part AS REAL)), 0) AS gains FROM createurs_ventes WHERE createur_id = ?").bind(user.id).first();
  const soutiens = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE code_createur = ?").bind(c.code).first();
  return json({ createur: { code: c.code, part: c.part, actif: !!c.actif, ventes: st.n, gains: Math.round(st.gains * 100) / 100, soutiens: soutiens.n } });
}, { connecte: true });
route("GET", "admin/createurs", async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT c.code, c.part, c.actif, u.pseudo, (SELECT COUNT(*) FROM users x WHERE x.code_createur = c.code) AS soutiens,
      (SELECT COUNT(*) FROM createurs_ventes v WHERE v.createur_id = c.user_id) AS ventes, (SELECT COALESCE(SUM(CAST(v.part AS REAL)), 0) FROM createurs_ventes v WHERE v.createur_id = c.user_id) AS du
    FROM createurs c JOIN users u ON u.id = c.user_id ORDER BY du DESC`).all();
  return json({ createurs: results.map((x) => ({ ...x, actif: !!x.actif, du: Math.round(x.du * 100) / 100 })) });
}, { admin: true });
route("PUT", "admin/createurs", async ({ request, env, user }) => {
  const b = await corps(request), code = String(b.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return erreur("Code invalide (3 à 20 lettres, chiffres, - ou _).");
  const u = await env.DB.prepare("SELECT id FROM users WHERE pseudo = ?").bind(String(b.pseudo || "")).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  try {
    await env.DB.prepare(`INSERT INTO createurs (code, user_id, part, actif, cree_le) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET code = excluded.code, part = excluded.part, actif = excluded.actif`)
      .bind(code, u.id, Math.round(nombre(b.part, 0, 50, 10)), b.actif === false ? 0 : 1, maintenant()).run();
  } catch { return erreur("Ce code est déjà utilisé par un autre créateur."); }
  await journaliser(env, user.id, `créateur ${b.pseudo}`, `${code} · ${b.part}%`, "admin");
  return json({ ok: true });
}, { admin: true });
// Cartes dédicacées : une variante signée, offerte par l'admin (concours, partenariat avec un streamer…)
route("GET", "dedicaces/moi", async ({ env, user }) => {
  const { results } = await env.DB.prepare("SELECT id, carte, signature, cree_le FROM dedicaces WHERE user_id = ? ORDER BY id DESC").bind(user.id).all();
  return json({ dedicaces: results });
}, { connecte: true });
route("POST", "admin/dedicaces", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const u = await env.DB.prepare("SELECT id FROM users WHERE pseudo = ?").bind(String(b.pseudo || "")).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  if (!CATALOGUE[b.carte]) return erreur("Carte inconnue.");
  const sig = nettoyerTexte(b.signature).slice(0, 24);
  if (sig.length < 2) return erreur("Signature invalide.");
  await env.DB.prepare("INSERT INTO dedicaces (user_id, carte, signature, cree_le) VALUES (?, ?, ?, ?)").bind(u.id, b.carte, sig, maintenant()).run();
  await env.DB.prepare("INSERT INTO livraisons (user_id, carte, pieces, message, cree_le) VALUES (?, ?, 0, ?, ?)").bind(u.id, b.carte, `✍️ Carte dédicacée par ${sig}`, maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, u.id, { titre: "✍️ Carte dédicacée !", texte: `Vous recevez ${CATALOGUE[b.carte].nom} dédicacée par ${sig}.`, url: "./#album" }));
  await journaliser(env, user.id, `dédicace pour ${b.pseudo}`, `${b.carte} · ${sig}`, "admin");
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Échange en direct entre amis : chacun compose son offre, l'échange se fait quand les deux ont validé la même version
   ===================================================================== */
const lireOffre = (t) => { try { const o = JSON.parse(t); return { cartes: Array.isArray(o.cartes) ? o.cartes : [], pieces: Number(o.pieces) || 0 }; } catch { return { cartes: [], pieces: 0 }; } };
async function vueEchangeDirect(env, e, user) {
  const moiA = e.a_id === user.id, ps = await env.DB.prepare("SELECT id, pseudo FROM users WHERE id IN (?, ?)").bind(e.a_id, e.b_id).all();
  const nom = (id) => ps.results.find((x) => x.id === id)?.pseudo || "?";
  return { id: e.id, statut: e.statut, version: e.version, ami: nom(moiA ? e.b_id : e.a_id), moi: lireOffre(moiA ? e.offre_a : e.offre_b), lui: lireOffre(moiA ? e.offre_b : e.offre_a),
    jaiValide: !!(moiA ? e.ok_a : e.ok_b), aValide: !!(moiA ? e.ok_b : e.ok_a), cote: moiA ? "a" : "b" };
}
const lireEchangeDirect = async (env, id, user) => {
  const e = await env.DB.prepare("SELECT * FROM echanges_directs WHERE id = ? AND (a_id = ?2 OR b_id = ?2)").bind(id, user.id).first();
  if (!e) throw new ErreurApi("Échange introuvable.", 404);
  return e;
};
route("POST", "direct/echange", async ({ request, env, user, ctx }) => {
  const b = await corps(request);
  const ami = await autreJoueur(env, user, String(b.pseudo || ""));
  if (!(await sontAmis(env, user.id, ami.id))) return erreur("Les échanges en direct se font entre amis.");
  await env.DB.prepare("UPDATE echanges_directs SET statut = 'annule' WHERE a_id = ? AND statut = 'ouvert'").bind(user.id).run();
  const r = await env.DB.prepare("INSERT INTO echanges_directs (a_id, b_id, cree_le, maj) VALUES (?, ?, ?, ?)").bind(user.id, ami.id, maintenant(), maintenant()).run();
  enArrierePlan(ctx, envoyerPush(env, ami.id, { titre: "🤝 Échange en direct", texte: `${user.pseudo} veut échanger des cartes avec vous.`, url: "./#hub" }));
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("GET", "direct/echanges", async ({ env, user }) => {
  const { results } = await env.DB.prepare(`SELECT e.id, u.pseudo, e.cree_le FROM echanges_directs e JOIN users u ON u.id = e.a_id WHERE e.b_id = ? AND e.statut = 'ouvert' AND e.maj > ? ORDER BY e.id DESC LIMIT 5`).bind(user.id, maintenant() - 15 * 60000).all();
  return json({ invitations: results });
}, { connecte: true });
route("GET", "direct/echange/(\\d+)", async ({ env, user, p }) => json(await vueEchangeDirect(env, await lireEchangeDirect(env, p[1], user), user)), { connecte: true });
route("PUT", "direct/echange/(\\d+)/offre", async ({ request, env, user, p }) => {
  const b = await corps(request), e = await lireEchangeDirect(env, p[1], user);
  if (e.statut !== "ouvert") return erreur("Cet échange est terminé.");
  const cartes = (Array.isArray(b.cartes) ? b.cartes : []).map(String).slice(0, 10), pieces = Math.max(0, Math.min(100000, Math.floor(Number(b.pieces) || 0)));
  const save = await saveDe(env, user.id), owned = save.owned || {}, compte = {};
  for (const id of cartes) {
    if (!CATALOGUE[id] || CATALOGUE[id].type === "secrete") return erreur("Carte inconnue ou non échangeable.");
    compte[id] = (compte[id] || 0) + 1;
    if ((owned[id] || 0) - await enSequestre(env, user.id, id) < compte[id]) return erreur(`Vous n'avez pas assez d'exemplaires de « ${CATALOGUE[id].nom} ».`);
  }
  if (pieces > (Number(save.coins) || 0)) return erreur("Vous n'avez pas assez de pièces.");
  const col = e.a_id === user.id ? "offre_a" : "offre_b";
  // Toute modification annule les deux validations
  await env.DB.prepare(`UPDATE echanges_directs SET ${col} = ?, ok_a = 0, ok_b = 0, version = version + 1, maj = ? WHERE id = ? AND statut = 'ouvert'`).bind(JSON.stringify({ cartes, pieces }), maintenant(), e.id).run();
  return json(await vueEchangeDirect(env, await lireEchangeDirect(env, p[1], user), user));
}, { connecte: true });
route("POST", "direct/echange/(\\d+)/valider", async ({ request, env, user, p, ctx }) => {
  const b = await corps(request), e = await lireEchangeDirect(env, p[1], user);
  if (e.statut !== "ouvert") return json(await vueEchangeDirect(env, e, user));
  if (Number(b.version) !== e.version) return erreur("L'offre vient de changer : vérifiez-la avant de valider.", 409);
  const oa = lireOffre(e.offre_a), ob = lireOffre(e.offre_b);
  if (!oa.cartes.length && !oa.pieces && !ob.cartes.length && !ob.pieces) return erreur("L'échange est vide.");
  const col = e.a_id === user.id ? "ok_a" : "ok_b";
  await env.DB.prepare(`UPDATE echanges_directs SET ${col} = 1, maj = ? WHERE id = ? AND version = ?`).bind(maintenant(), e.id, e.version).run();
  // Les deux ont validé la même version : on conclut une seule fois et chacun reçoit l'offre de l'autre
  const r = await env.DB.prepare("UPDATE echanges_directs SET statut = 'conclu', maj = ? WHERE id = ? AND statut = 'ouvert' AND ok_a = 1 AND ok_b = 1 AND version = ?").bind(maintenant(), e.id, e.version).run();
  if (r.meta.changes) {
    const livrer = (dest, o, de) => [...o.cartes.map((id) => env.DB.prepare("INSERT INTO livraisons (user_id, carte, pieces, message, cree_le) VALUES (?, ?, 0, ?, ?)").bind(dest, id, `Échange en direct avec ${de}`, maintenant())),
      ...(o.pieces ? [env.DB.prepare("INSERT INTO livraisons (user_id, carte, pieces, message, cree_le) VALUES (?, NULL, ?, ?, ?)").bind(dest, o.pieces, `Échange en direct avec ${de}`, maintenant())] : [])];
    const ps = await env.DB.prepare("SELECT id, pseudo FROM users WHERE id IN (?, ?)").bind(e.a_id, e.b_id).all(), nom = (id) => ps.results.find((x) => x.id === id)?.pseudo || "?";
    const req = [...livrer(e.b_id, oa, nom(e.a_id)), ...livrer(e.a_id, ob, nom(e.b_id))];
    if (req.length) await env.DB.batch(req);
    console.log(JSON.stringify({ echangeDirect: e.id, evenement: "conclu" }));
  }
  return json(await vueEchangeDirect(env, await lireEchangeDirect(env, p[1], user), user));
}, { connecte: true });
route("POST", "direct/echange/(\\d+)/annuler", async ({ env, user, p }) => {
  const e = await lireEchangeDirect(env, p[1], user);
  await env.DB.prepare("UPDATE echanges_directs SET statut = 'annule', maj = ? WHERE id = ? AND statut = 'ouvert'").bind(maintenant(), e.id).run();
  return json({ ok: true });
}, { connecte: true });

/* =====================================================================
   Guerres de guildes : chaque week-end, les guildes sont appariées ; chaque victoire classée d'un membre rapporte 1 point
   ===================================================================== */
function weekendCourant() {
  const d = new Date(), jour = d.getUTCDay(); // 6 = samedi, 0 = dimanche
  const samedi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((jour + 1) % 7)));
  const debut = samedi.getTime(), fin = debut + 2 * JOUR;
  return { cle: samedi.toISOString().slice(0, 10), debut, fin, enCours: maintenant() >= debut && maintenant() < fin };
}
async function scoreGuerre(env, guildeId, debut, fin) {
  const r = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM combats c JOIN guilde_membres m ON m.user_id = c.attaquant WHERE m.guilde_id = ?1 AND c.fini = 1 AND c.gagne = 1 AND c.classe = 1 AND c.cree_le >= ?2 AND c.cree_le < ?3)
    + (SELECT COUNT(*) FROM duels d JOIN guilde_membres m ON m.user_id = d.gagnant WHERE m.guilde_id = ?1 AND d.statut = 'fini' AND d.classe = 1 AND d.fini_le >= ?2 AND d.fini_le < ?3) AS n`).bind(guildeId, debut, fin).first();
  return r.n;
}
// Appariement des guildes (au moins 2 membres) par niveau, au premier passage du week-end
async function apparierGuerres(env, w) {
  if (await env.DB.prepare("SELECT 1 FROM guerres WHERE semaine = ? LIMIT 1").bind(w.cle).first()) return;
  const { results } = await env.DB.prepare(`SELECT g.id, (SELECT COALESCE(AVG(a.trophees), 1000) FROM guilde_membres m JOIN arene a ON a.user_id = m.user_id WHERE m.guilde_id = g.id) AS niveau
    FROM guildes g WHERE (SELECT COUNT(*) FROM guilde_membres m WHERE m.guilde_id = g.id) >= 2 ORDER BY niveau DESC`).all();
  const req = [];
  for (let i = 0; i < results.length; i += 2) {
    const a = results[i].id, b = results[i + 1]?.id ?? null;
    req.push(env.DB.prepare("INSERT OR IGNORE INTO guerres (semaine, g1, g2) VALUES (?, ?, ?)").bind(w.cle, a, b));
    if (b) req.push(env.DB.prepare("INSERT OR IGNORE INTO guerres (semaine, g1, g2) VALUES (?, ?, ?)").bind(w.cle, b, a));
  }
  if (req.length) await env.DB.batch(req);
}
route("GET", "guerre", async ({ env, user }) => {
  const w = weekendCourant(), g = await maGuilde(env, user.id);
  if (!g) return json({ weekend: w, guilde: null });
  if (w.enCours) await apparierGuerres(env, w);
  const m = await env.DB.prepare("SELECT g2 FROM guerres WHERE semaine = ? AND g1 = ?").bind(w.cle, g.id).first();
  const adv = m?.g2 ? await env.DB.prepare("SELECT id, nom, tag, embleme FROM guildes WHERE id = ?").bind(m.g2).first() : null;
  const top = (await env.DB.prepare(`SELECT u.pseudo, (SELECT COUNT(*) FROM combats c WHERE c.attaquant = u.id AND c.fini = 1 AND c.gagne = 1 AND c.classe = 1 AND c.cree_le >= ?2 AND c.cree_le < ?3)
      + (SELECT COUNT(*) FROM duels d WHERE d.gagnant = u.id AND d.statut = 'fini' AND d.classe = 1 AND d.fini_le >= ?2 AND d.fini_le < ?3) AS v
    FROM guilde_membres m JOIN users u ON u.id = m.user_id WHERE m.guilde_id = ?1 ORDER BY v DESC LIMIT 10`).bind(g.id, w.debut, w.fin).all()).results;
  return json({ weekend: w, guilde: { id: g.id, nom: g.nom, tag: g.tag, embleme: g.embleme, score: await scoreGuerre(env, g.id, w.debut, w.fin) },
    adversaire: adv ? { ...adv, score: await scoreGuerre(env, adv.id, w.debut, w.fin) } : null, membres: top });
}, { connecte: true });
// Le lundi : la guilde gagnante de chaque duel reçoit sa récompense (membres actifs pendant le week-end)
async function cloturerGuerres(env) {
  const { results } = await env.DB.prepare("SELECT * FROM guerres WHERE fini = 0 AND g2 IS NOT NULL AND g1 < g2 LIMIT 50").all();
  for (const gu of results) {
    const debut = Date.parse(gu.semaine + "T00:00:00Z"), fin = debut + 2 * JOUR;
    if (maintenant() < fin) continue;
    const r = await env.DB.prepare("UPDATE guerres SET fini = 1 WHERE semaine = ? AND (g1 = ? OR g1 = ?) AND fini = 0").bind(gu.semaine, gu.g1, gu.g2).run();
    if (!r.meta.changes) continue;
    const s1 = await scoreGuerre(env, gu.g1, debut, fin), s2 = await scoreGuerre(env, gu.g2, debut, fin);
    if (s1 === s2) continue;
    const gagnante = s1 > s2 ? gu.g1 : gu.g2;
    const { results: membres } = await env.DB.prepare("SELECT user_id FROM guilde_membres WHERE guilde_id = ?").bind(gagnante).all();
    if (membres.length) await env.DB.batch(membres.map((m) => env.DB.prepare("INSERT INTO cadeaux (user_id, pieces, boosters, boosters_detail, message, cree_le) VALUES (?, 500, 0, ?, ?, ?)").bind(m.user_id, JSON.stringify({ or: 1 }), `⚔️ Victoire de votre guilde à la guerre du week-end (${Math.max(s1, s2)} à ${Math.min(s1, s2)}) !`, maintenant())));
  }
}

/* =====================================================================
   Albums à thème : compléter un album rapporte une récompense ; classement des premiers à le terminer
   ===================================================================== */
const ALBUMS = (() => {
  const a = [{ cle: "merveilles", nom: "Les merveilles du monde", icone: "🌟", ids: MONDE.MERVEILLES_BRUTES.map((x) => "merv:" + x[0]), pieces: 3000 }];
  for (const [k, c] of Object.entries(MONDE.CONTINENTS)) a.push({ cle: "drapeaux-" + k.toLowerCase(), nom: `Drapeaux : ${c.nom}`, icone: c.emoji, ids: MONDE.PAYS_BRUTS.filter((p) => p[3] === k).map((p) => "pays:" + p[0]), pieces: 1500 });
  const villes = [...MONDE.VILLES_BRUTES, ...VILLES2.VILLES_EXTRA, ...VILLES3.VILLES_EXTRA2, ...EXTENSIONS.VILLES_NOUVELLES];
  const capitales = (cont) => MONDE.PAYS_BRUTS.filter((p) => p[3] === cont).map((p) => villes.find((v) => v[2] === p[0] && v[1] === p[2])).filter(Boolean).map((v) => "ville:" + v[0]);
  for (const [k, n] of [["EU", "Capitales d'Europe"], ["AS", "Capitales d'Asie"], ["AF", "Capitales d'Afrique"]]) { const ids = capitales(k); if (ids.length >= 8) a.push({ cle: "capitales-" + k.toLowerCase(), nom: n, icone: "🏛️", ids, pieces: 2000 }); }
  const leg = Object.entries(CATALOGUE).filter(([, c]) => c.type === "nature" && c.rarete === "legendaire").map(([id]) => id);
  if (leg.length) a.push({ cle: "nature-legendaire", nom: "Nature légendaire", icone: "🏔️", ids: leg, pieces: 4000 });
  return a.filter((x) => x.ids.length && x.ids.every((id) => CATALOGUE[id]));
})();
route("GET", "albums", async ({ env, user }) => {
  const owned = user ? (await saveDe(env, user.id)).owned || {} : {};
  const { results } = await env.DB.prepare("SELECT cle, pseudo, cree_le, user_id FROM albums_termines ORDER BY cree_le").all();
  return json({ albums: ALBUMS.map((al) => {
    const fin = results.filter((r) => r.cle === al.cle);
    return { cle: al.cle, nom: al.nom, icone: al.icone, ids: al.ids, pieces: al.pieces, possedees: al.ids.filter((id) => owned[id] > 0).length,
      premiers: fin.slice(0, 10).map((r) => ({ pseudo: r.pseudo, t: r.cree_le })), termines: fin.length, moi: user ? fin.findIndex((r) => r.user_id === user.id) + 1 || null : null };
  }) });
});
route("POST", "albums/([a-z0-9-]{2,30})/terminer", async ({ env, user, p }) => {
  const al = ALBUMS.find((x) => x.cle === p[1]);
  if (!al) return erreur("Album inconnu.", 404);
  const owned = (await saveDe(env, user.id)).owned || {};
  const manque = al.ids.filter((id) => !(owned[id] > 0));
  if (manque.length) return erreur(`Il vous manque encore ${manque.length} carte(s) (sauvegarde du compte).`);
  const r = await env.DB.prepare("INSERT OR IGNORE INTO albums_termines (cle, user_id, pseudo, cree_le) VALUES (?, ?, ?, ?)").bind(al.cle, user.id, user.pseudo, maintenant()).run();
  if (!r.meta.changes) return erreur("Album déjà validé.", 409);
  const rang = (await env.DB.prepare("SELECT COUNT(*) AS n FROM albums_termines WHERE cle = ?").bind(al.cle).first()).n;
  const pieces = al.pieces * (rang === 1 ? 3 : rang <= 10 ? 2 : 1);
  await crediter(env, user.id, pieces, 0, 0);
  return json({ pieces, rang, nom: al.nom });
}, { connecte: true });

/* =====================================================================
   Missions PvP (quotidiennes et hebdomadaires) : progression calculée par le serveur à partir des vrais combats
   ===================================================================== */
const TYPES_MISSION = ["monument", "ville", "nature", "animal", "plat", "culture", "pays"];
const NOMS_TYPES_MISSION = { monument: "Monuments", ville: "Villes", nature: "Nature", animal: "Animaux", plat: "Gastronomie", culture: "Culture", pays: "Pays" };
function missionsDe(userId, periode, hebdo) {
  const r = COMBAT.rng(COMBAT.hash(`missions:${periode}:${userId}`)), type = TYPES_MISSION[Math.floor(r() * TYPES_MISSION.length)];
  const L = hebdo ? [
    { cle: "gagner", nom: "Gagne 10 combats classés", n: 10, pieces: 800, boosters: { or: 1 } },
    { cle: "direct", nom: "Joue 5 duels en direct", n: 5, pieces: 600, boosters: { argent: 1 } },
    { cle: "points", nom: "Gagne 60 points de classement", n: 60, pieces: 1000, boosters: { or: 1 } },
  ] : [
    [{ cle: "gagner", nom: "Gagne 2 combats classés", n: 2, pieces: 150, boosters: {} }, { cle: "gagner", nom: "Gagne 3 combats classés", n: 3, pieces: 220, boosters: {} }][Math.floor(r() * 2)],
    [{ cle: "direct", nom: "Joue 1 duel en direct", n: 1, pieces: 120, boosters: {} }, { cle: "arene", nom: "Fais 3 combats d'arène", n: 3, pieces: 120, boosters: {} }][Math.floor(r() * 2)],
    { cle: "type", nom: `Gagne un combat avec au moins 3 cartes ${NOMS_TYPES_MISSION[type]} dans ton deck`, n: 1, pieces: 200, boosters: { monde: 1 }, type },
  ];
  return L;
}
const periodeMission = (hebdo) => (hebdo ? "S" + semaineCourante() : "J" + jourUTC());
async function etatMissions(env, user) {
  const jour = Date.parse(jourUTC() + "T00:00:00Z"), d = new Date(), lundi = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const stats = async (depuis) => {
    const [ar, du] = await env.DB.batch([
      env.DB.prepare("SELECT gagne, classe, delta, a FROM combats WHERE attaquant = ? AND fini = 1 AND cree_le >= ?").bind(user.id, depuis),
      env.DB.prepare("SELECT gagnant, classe, a_id, points_a, points_b, deck_a, deck_b FROM duels WHERE statut = 'fini' AND (a_id = ?1 OR b_id = ?1) AND fini_le >= ?2 AND deck_b IS NOT NULL").bind(user.id, depuis),
    ]);
    const nbType = (deck, t) => { try { return JSON.parse(deck).filter((x) => x.type === t).length; } catch { return 0; } };
    return {
      gagner: ar.results.filter((c) => c.gagne && c.classe).length + du.results.filter((x) => x.classe && x.gagnant === user.id).length,
      direct: du.results.length, arene: ar.results.length,
      points: ar.results.reduce((t, c) => t + Math.max(0, c.classe ? c.delta || 0 : 0), 0) + du.results.reduce((t, x) => t + Math.max(0, (x.a_id === user.id ? x.points_a : x.points_b) || 0), 0),
      type: (t) => ar.results.filter((c) => c.gagne && nbType(c.a, t) >= 3).length + du.results.filter((x) => x.gagnant === user.id && nbType(x.a_id === user.id ? x.deck_a : x.deck_b, t) >= 3).length,
    };
  };
  const recus = new Set((await env.DB.prepare("SELECT periode || ':' || cle AS k FROM missions_recues WHERE user_id = ? AND periode IN (?, ?)").bind(user.id, periodeMission(false), periodeMission(true)).all()).results.map((x) => x.k));
  const sortie = {};
  for (const [hebdo, depuis] of [[false, jour], [true, lundi]]) {
    const st = await stats(depuis), periode = periodeMission(hebdo);
    sortie[hebdo ? "semaine" : "jour"] = missionsDe(user.id, periode, hebdo).map((m) => {
      const v = m.cle === "type" ? st.type(m.type) : st[m.cle];
      return { ...m, periode, valeur: Math.min(v, m.n), fait: v >= m.n, recu: recus.has(periode + ":" + m.cle) };
    });
  }
  return sortie;
}
route("GET", "missions", async ({ env, user }) => json(await etatMissions(env, user)), { connecte: true });
route("POST", "missions/([JS][0-9W-]{4,12})/([a-z]{2,10})/reclamer", async ({ env, user, p }) => {
  const e = await etatMissions(env, user), m = [...e.jour, ...e.semaine].find((x) => x.periode === p[1] && x.cle === p[2]);
  if (!m) return erreur("Mission inconnue ou expirée.", 404);
  if (!m.fait) return erreur("Mission pas encore accomplie.");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO missions_recues (user_id, periode, cle, cree_le) VALUES (?, ?, ?, ?)").bind(user.id, m.periode, m.cle, maintenant()).run();
  if (!r.meta.changes) return erreur("Récompense déjà reçue.", 409);
  const nbB = Object.values(m.boosters).reduce((t, n) => t + n, 0);
  await crediter(env, user.id, m.pieces, 0, nbB);
  return json({ pieces: m.pieces, boosters: m.boosters, nom: m.nom });
}, { connecte: true });

/* ---------- Finale de saison : top 10, compte à rebours, champion de la saison précédente ---------- */
route("GET", "saison/finale", async ({ env }) => {
  const rangs = await chargerRangs(env);
  const { results } = await env.DB.prepare(`SELECT u.pseudo, a.trophees, a.victoires, a.defaites FROM arene a JOIN users u ON u.id = a.user_id
    WHERE a.deck IS NOT NULL AND u.banni = 0 AND u.admin = 0 AND (a.victoires + a.defaites) > 0 ORDER BY a.trophees DESC, a.victoires DESC LIMIT 10`).all();
  const champions = (await env.DB.prepare("SELECT saison, pseudo, trophees FROM champions ORDER BY saison DESC LIMIT 6").all()).results;
  return json({ saison: saisonCourante(), fin: finSaison(), top: results.map((x) => ({ ...x, rang: rangDe(x.trophees, rangs) })), champions }, 200, { "cache-control": "public, max-age=30" });
});
route("GET", "champions/([A-Za-z0-9_-]{3,20})", async ({ env, p }) => {
  const { results } = await env.DB.prepare("SELECT saison FROM champions WHERE pseudo = ? ORDER BY saison DESC").bind(p[1]).all();
  return json({ saisons: results.map((x) => x.saison) });
});

/* =====================================================================
   Matchmaking en direct : deux joueurs en ligne de niveau proche sont réunis dans un duel (classé ou amical)
   ===================================================================== */
route("POST", "matchmaking", async ({ request, env, user }) => {
  const b = await corps(request), classe = b.classe === false ? 0 : 1;
  const moi = await ligneArene(env, user.id);
  if (!moi.deck || JSON.parse(moi.deck).length !== COMBAT.TAILLE_DECK) return erreur(`Enregistrez d'abord un deck de ${COMBAT.TAILLE_DECK} cartes.`);
  const t = maintenant();
  // Déjà associé ? (l'autre joueur nous a trouvés)
  const deja = await env.DB.prepare("SELECT duel_id FROM file_attente WHERE user_id = ?").bind(user.id).first();
  if (deja?.duel_id) { await env.DB.prepare("DELETE FROM file_attente WHERE user_id = ?").bind(user.id).run(); return json({ duel: deja.duel_id }); }
  await env.DB.prepare(`INSERT INTO file_attente (user_id, trophees, classe, deck, depuis, vu) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET trophees = excluded.trophees, classe = excluded.classe, deck = excluded.deck, vu = excluded.vu`).bind(user.id, moi.trophees, classe, moi.deck, t, t).run();
  const ligne = await env.DB.prepare("SELECT depuis FROM file_attente WHERE user_id = ?").bind(user.id).first();
  // L'écart de niveau toléré s'élargit avec l'attente : 150 points, puis +50 toutes les 5 secondes
  const ecart = 150 + Math.floor((t - ligne.depuis) / 5000) * 50;
  const adv = await env.DB.prepare(`SELECT f.user_id, f.deck FROM file_attente f JOIN users u ON u.id = f.user_id WHERE f.user_id != ? AND f.classe = ? AND f.duel_id IS NULL AND f.vu > ? AND ABS(f.trophees - ?) <= ? AND u.banni = 0
    AND NOT EXISTS (SELECT 1 FROM bloques bl WHERE (bl.user_id = ?1 AND bl.bloque_id = f.user_id) OR (bl.user_id = f.user_id AND bl.bloque_id = ?1))
    ORDER BY ABS(f.trophees - ?) LIMIT 1`).bind(user.id, classe, t - 8000, moi.trophees, ecart, moi.trophees).first();
  if (!adv) return json({ attente: true, ecart, depuis: ligne.depuis });
  const d = await env.DB.prepare("INSERT INTO duels (a_id, b_id, graine, deck_a, deck_b, statut, limite, cree_le, classe, aleatoire) VALUES (?, ?, ?, ?, ?, 'encours', ?, ?, ?, 1)")
    .bind(adv.user_id, user.id, crypto.getRandomValues(new Uint32Array(1))[0], adv.deck, moi.deck, t + CHRONO_DUEL + 5000, t, classe).run();
  const id = d.meta.last_row_id;
  // On réserve l'adversaire ; s'il a été pris entre-temps, le duel est annulé et on réessaiera
  const pris = await env.DB.prepare("UPDATE file_attente SET duel_id = ? WHERE user_id = ? AND duel_id IS NULL").bind(id, adv.user_id).run();
  if (!pris.meta.changes) { await env.DB.prepare("UPDATE duels SET statut = 'annule' WHERE id = ?").bind(id).run(); return json({ attente: true, ecart }); }
  await env.DB.prepare("DELETE FROM file_attente WHERE user_id = ?").bind(user.id).run();
  console.log(JSON.stringify({ duel: id, evenement: "matchmaking", classe }));
  return json({ duel: id });
}, { connecte: true });
route("DELETE", "matchmaking", async ({ env, user }) => {
  await env.DB.prepare("DELETE FROM file_attente WHERE user_id = ? AND duel_id IS NULL").bind(user.id).run();
  return json({ ok: true });
}, { connecte: true });
route("GET", "matchmaking/file", async ({ env }) => {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM file_attente WHERE duel_id IS NULL AND vu > ?").bind(maintenant() - 8000).first();
  return json({ enAttente: n.n });
});

/* ---------- Revoir un combat (arène ou duel) : le moteur rejoue les mêmes actions avec la même graine ---------- */
route("GET", "revoir/(arene|duel)/(\\d+)", async ({ env, p }) => {
  if (p[1] === "arene") {
    const c = await env.DB.prepare(`SELECT c.*, ua.pseudo AS pa, ud.pseudo AS pd FROM combats c JOIN users ua ON ua.id = c.attaquant JOIN users ud ON ud.id = c.defenseur WHERE c.id = ? AND c.fini = 1`).bind(p[2]).first();
    if (!c || !c.actions) return erreur("Ce combat ne peut pas être revu.", 404);
    return json({ a: c.pa, b: c.pd, deckA: JSON.parse(c.a), deckB: JSON.parse(c.b), graine: c.graine, actions: JSON.parse(c.actions), gagnant: c.gagne ? 0 : 1, mode: "arene" });
  }
  const d = await env.DB.prepare(`SELECT d.*, ua.pseudo AS pa, ub.pseudo AS pb FROM duels d JOIN users ua ON ua.id = d.a_id JOIN users ub ON ub.id = d.b_id WHERE d.id = ? AND d.statut = 'fini'`).bind(p[2]).first();
  if (!d || !d.deck_b) return erreur("Ce duel ne peut pas être revu.", 404);
  return json({ a: d.pa, b: d.pb, deckA: JSON.parse(d.deck_a), deckB: JSON.parse(d.deck_b), graine: d.graine, paires: JSON.parse(d.paires), gagnant: d.gagnant === d.a_id ? 0 : 1, mode: "duel" });
});

/* =====================================================================
   Decks publics : partager un deck, le retrouver par nom, carte, style ou ligue, le mettre en favori
   ===================================================================== */
const STYLES_DECK = ["equilibre", "attaque", "defense", "vitesse", "types"];
const ORDRE_RARETE = { "commun": 0, "peu-commun": 1, "rare": 2, "epique": 3, "ultra-rare": 4, "legendaire": 5, "secrete": 5 };
route("POST", "decks", async ({ request, env, user }) => {
  const b = await corps(request);
  const nom = nettoyerTexte(b.nom).slice(0, 40), style = STYLES_DECK.includes(b.style) ? b.style : "equilibre";
  if (nom.length < 2 || nom.includes("•")) return erreur("Nom de deck invalide (2 à 40 caractères, sans gros mots).");
  const ids = Array.isArray(b.cartes) ? b.cartes.map(String) : [];
  if (ids.length !== COMBAT.TAILLE_DECK || new Set(ids).size !== ids.length || ids.some((id) => !CATALOGUE[id])) return erreur(`Un deck public doit contenir ${COMBAT.TAILLE_DECK} cartes différentes.`);
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM decks_publics WHERE user_id = ?").bind(user.id).first();
  if (n.n >= 20 && !b.id) return erreur("20 decks publics au maximum : supprimez-en un d'abord.");
  const cout = ids.reduce((t, id) => t + (COMBAT.COUT[CATALOGUE[id].rarete] || 1), 0), rmax = Math.max(...ids.map((id) => ORDRE_RARETE[CATALOGUE[id].rarete] || 0));
  if (b.id) {
    const r = await env.DB.prepare("UPDATE decks_publics SET nom = ?, style = ?, cartes = ?, cout = ?, rarete_max = ?, maj = ? WHERE id = ? AND user_id = ?").bind(nom, style, JSON.stringify(ids), cout, rmax, maintenant(), Number(b.id), user.id).run();
    if (!r.meta.changes) return erreur("Deck introuvable.", 404);
    return json({ id: Number(b.id) });
  }
  const r = await env.DB.prepare("INSERT INTO decks_publics (user_id, nom, style, cartes, cout, rarete_max, cree_le, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(user.id, nom, style, JSON.stringify(ids), cout, rmax, maintenant(), maintenant()).run();
  return json({ id: r.meta.last_row_id }, 201);
}, { connecte: true });
route("DELETE", "decks/(\\d+)", async ({ env, user, p }) => {
  await env.DB.prepare("DELETE FROM decks_publics WHERE id = ? AND (user_id = ? OR ? = 1)").bind(p[1], user.id, user.admin ? 1 : 0).run();
  return json({ ok: true });
}, { connecte: true });
route("POST", "decks/(\\d+)/favori", async ({ env, user, p }) => {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO decks_favoris (user_id, deck_id) SELECT ?, id FROM decks_publics WHERE id = ?").bind(user.id, p[1]).run();
  if (!r.meta.changes) await env.DB.prepare("DELETE FROM decks_favoris WHERE user_id = ? AND deck_id = ?").bind(user.id, p[1]).run();
  return json({ favori: !!r.meta.changes });
}, { connecte: true });
route("GET", "decks", async ({ request, env, user }) => {
  const q = new URL(request.url).searchParams, rangs = await chargerRangs(env);
  const texte = String(q.get("q") || "").trim().slice(0, 40), carte = String(q.get("carte") || "").slice(0, 60), style = STYLES_DECK.includes(q.get("style")) ? q.get("style") : "";
  const rarete = q.get("rarete") !== null && q.get("rarete") !== "" ? Math.round(nombre(q.get("rarete"), 0, 5, 0)) : null, ligue = String(q.get("ligue") || "").slice(0, 30);
  const tri = { popularite: "favoris DESC, d.maj DESC", date: "d.maj DESC", performances: "trophees DESC", cout: "d.cout ASC" }[q.get("tri")] || "favoris DESC, d.maj DESC";
  const mes = q.get("mes") === "1" && user, favs = q.get("favoris") === "1" && user;
  const { results } = await env.DB.prepare(`SELECT d.id, d.nom, d.style, d.cartes, d.cout, d.rarete_max, d.maj, u.pseudo, COALESCE(a.trophees, 1000) AS trophees,
      (SELECT COUNT(*) FROM decks_favoris f WHERE f.deck_id = d.id) AS favoris, EXISTS (SELECT 1 FROM decks_favoris f WHERE f.deck_id = d.id AND f.user_id = ?1) AS monFavori
    FROM decks_publics d JOIN users u ON u.id = d.user_id LEFT JOIN arene a ON a.user_id = d.user_id
    WHERE u.banni = 0 AND (?2 = '' OR d.nom LIKE '%' || ?2 || '%') AND (?3 = '' OR d.cartes LIKE '%"' || ?3 || '"%') AND (?4 = '' OR d.style = ?4)
      AND (?5 IS NULL OR d.rarete_max <= ?5) AND (?6 = 0 OR d.user_id = ?1) AND (?7 = 0 OR EXISTS (SELECT 1 FROM decks_favoris f WHERE f.deck_id = d.id AND f.user_id = ?1))
    ORDER BY ${tri} LIMIT 120`).bind(user?.id ?? 0, texte, carte, style, rarete, mes ? 1 : 0, favs ? 1 : 0).all();
  let decks = results.map((d) => ({ id: d.id, nom: d.nom, style: d.style, cartes: JSON.parse(d.cartes), cout: d.cout, auteur: d.pseudo, maj: d.maj, favoris: d.favoris, monFavori: !!d.monFavori, rang: rangDe(d.trophees, rangs), mien: !!user && d.pseudo === user.pseudo }));
  if (ligue) decks = decks.filter((d) => d.rang?.cle === ligue);
  return json({ decks: decks.slice(0, 60), styles: STYLES_DECK });
});

/* =====================================================================
   Profil public : confidentialité, bannière, succès (vérifiés et récompensés côté serveur, une seule fois)
   ===================================================================== */
const BANNIERES = ["corail", "ocean", "foret", "nuit", "or", "rubis", "lavande", "graphite"];
const lireConfidentialite = (t) => { let c = {}; try { c = JSON.parse(t || "{}") || {}; } catch {} return { statistiques: c.statistiques !== false, historique: c.historique !== false, deck: c.deck !== false, collection: c.collection !== false, succes: c.succes !== false, activite: c.activite !== false }; };
const TOTAL_CARTES = Object.values(CATALOGUE).filter((c) => c.type !== "secrete").length;
const PAYS_PAR_CONTINENT = MONDE.PAYS_BRUTS.reduce((m, p) => ((m[p[3]] ||= []).push("pays:" + p[0]), m), {});
// [clé, nom, description, icône, récompense en pièces, progression(d) → [valeur, objectif]]
const SUCCES = [
  ["premiere-carte", "Première carte", "Obtenir sa première carte", "🃏", 50, (d) => [d.cartes, 1]],
  ["premier-booster", "Premier booster", "Ouvrir son premier booster", "🎁", 50, (d) => [d.ouverts, 1]],
  ["collection-100", "Collectionneur", "Posséder 100 cartes différentes", "📚", 300, (d) => [d.cartes, 100]],
  ["collection-500", "Grand collectionneur", "Posséder 500 cartes différentes", "🏛️", 1000, (d) => [d.cartes, 500]],
  ["collection-1000", "Encyclopédiste", "Posséder 1 000 cartes différentes", "🌍", 3000, (d) => [d.cartes, 1000]],
  ["rares-10", "Chasseur de raretés", "Posséder 10 cartes épiques ou mieux", "💎", 500, (d) => [d.epiques, 10]],
  ["legendaire", "Légende vivante", "Obtenir une carte légendaire", "⭐", 300, (d) => [d.legendaires, 1]],
  ["continent", "Continent complet", "Posséder tous les pays d'un continent", "🗺️", 1500, (d) => [d.continent, 100]],
  ["shiny", "Éclat rare", "Obtenir une carte Shiny", "✨", 200, (d) => [d.shiny, 1]],
  ["evenement", "Esprit de fête", "Obtenir une carte d'événement ou de saison", "🎉", 200, (d) => [d.evenement, 1]],
  ["victoire", "Première victoire", "Gagner un combat classé (arène ou duel)", "⚔️", 100, (d) => [d.victoires, 1]],
  ["serie-5", "Série de 5", "Gagner 5 combats d'arène d'affilée", "🔥", 500, (d) => [d.serie, 5]],
  ["victoires-50", "Vétéran", "Gagner 50 combats classés", "🛡️", 1500, (d) => [d.victoires, 50]],
  ["rang-argent", "Rang ARGENT", "Atteindre le rang ARGENT", "🥈", 300, (d) => [d.rangMax >= d.seuil("argent") ? 1 : 0, 1]],
  ["rang-or", "Rang OR", "Atteindre le rang OR", "🥇", 800, (d) => [d.rangMax >= d.seuil("or") ? 1 : 0, 1]],
  ["rang-diamant", "Rang DIAMANT", "Atteindre le rang DIAMANT", "💠", 2500, (d) => [d.rangMax >= d.seuil("diamant") ? 1 : 0, 1]],
];
async function calculerSucces(env, userId, rangs) {
  const save = await saveDe(env, userId), owned = save.owned || {};
  const ids = Object.keys(owned).filter((id) => owned[id] > 0 && CATALOGUE[id]);
  const a = await env.DB.prepare("SELECT trophees, victoires FROM arene WHERE user_id = ?").bind(userId).first();
  const derniers = (await env.DB.prepare("SELECT gagne FROM combats WHERE attaquant = ? AND fini = 1 AND classe = 1 ORDER BY id DESC LIMIT 30").bind(userId).all()).results;
  let serie = 0, best = 0; for (const c of derniers.slice().reverse()) { serie = c.gagne ? serie + 1 : 0; best = Math.max(best, serie); }
  const duelsGagnes = (await env.DB.prepare("SELECT COUNT(*) AS n FROM duels WHERE statut = 'fini' AND classe = 1 AND gagnant = ?").bind(userId).first()).n;
  const hist = (await env.DB.prepare("SELECT MAX(trophees) AS m FROM rangs_historique WHERE user_id = ?").bind(userId).first())?.m || 0;
  const continent = Math.max(0, ...Object.values(PAYS_PAR_CONTINENT).map((l) => Math.floor((l.filter((id) => owned[id] > 0).length / l.length) * 100)));
  const d = { cartes: ids.length, ouverts: Number(save.ouverts) || 0, epiques: ids.filter((id) => ["epique", "ultra-rare", "legendaire"].includes(CATALOGUE[id].rarete)).length,
    legendaires: ids.filter((id) => CATALOGUE[id].rarete === "legendaire").length, continent, shiny: Object.keys(save.shiny || {}).length, evenement: ids.filter((id) => /^(event|saison):/.test(id)).length,
    victoires: (a?.victoires || 0) + duelsGagnes, serie: best, rangMax: Math.max(a?.trophees || 0, hist), seuil: (cle) => rangs.find((r) => r.cle === cle)?.min_pts ?? Infinity };
  const recus = new Set((await env.DB.prepare("SELECT cle FROM succes_recus WHERE user_id = ?").bind(userId).all()).results.map((x) => x.cle));
  const reg = await reglagesJeu(env);
  return SUCCES.map(([cle, nom, desc, icone, pieces, f]) => { const [v, obj] = f(d); return { cle, nom, desc, icone, pieces: reg.succes?.[cle] ?? pieces, valeur: Math.min(v, obj), objectif: obj, fait: v >= obj, recu: recus.has(cle) }; });
}
route("GET", "succes", async ({ env, user }) => json({ succes: await calculerSucces(env, user.id, await chargerRangs(env)) }), { connecte: true });
route("POST", "succes/([a-z0-9-]{2,30})/reclamer", async ({ env, user, p }) => {
  const s = (await calculerSucces(env, user.id, await chargerRangs(env))).find((x) => x.cle === p[1]);
  if (!s) return erreur("Succès inconnu.", 404);
  if (!s.fait) return erreur("Ce succès n'est pas encore accompli.");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO succes_recus (user_id, cle, pieces, cree_le) VALUES (?, ?, ?, ?)").bind(user.id, s.cle, s.pieces, maintenant()).run();
  if (!r.meta.changes) return erreur("Récompense déjà reçue.", 409);
  await crediter(env, user.id, s.pieces, 0, 0);
  return json({ pieces: s.pieces, nom: s.nom });
}, { connecte: true });

/* =====================================================================
   Rangs officiels 2F1 : nom, couleur, seuils, logo… tout se règle dans l'admin
   ===================================================================== */
const RANGS_DEFAUT = [["bronze", "BRONZE", "#c27a3c", 0], ["argent", "ARGENT", "#b9c3cd", 1100], ["or", "OR", "#f2b33d", 1300], ["platine", "PLATINE", "#9cc3e0", 1500],
  ["diamant", "DIAMANT", "#5fd4ff", 1700], ["twofone", "TWOFONE", "#d4a72c", 1900], ["nazio", "NAZIO", "#2fbf71", 2100], ["kilio", "KILIO", "#e0393e", 2300]];
let rangsCache = { t: 0, v: null };
async function chargerRangs(env) {
  if (rangsCache.v && maintenant() - rangsCache.t < 20000) return rangsCache.v;
  let { results } = await env.DB.prepare("SELECT cle, nom, couleur, description, min_pts, max_pts, ordre, actif, divisions, montee, descente, recompense_pieces, recompense_boosters, logo_maj FROM rangs ORDER BY ordre").all();
  if (!results.length) {
    await env.DB.batch(RANGS_DEFAUT.map(([cle, nom, couleur, min], i) => env.DB.prepare("INSERT OR IGNORE INTO rangs (cle, nom, couleur, min_pts, ordre, recompense_pieces, recompense_boosters) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(cle, nom, couleur, min, i, [200, 500, 1000, 1800, 3000, 4000, 5000, 6000][i], [0, 1, 2, 3, 4, 5, 6, 7][i])));
    ({ results } = await env.DB.prepare("SELECT cle, nom, couleur, description, min_pts, max_pts, ordre, actif, divisions, montee, descente, recompense_pieces, recompense_boosters, logo_maj FROM rangs ORDER BY ordre").all());
  }
  rangsCache = { t: maintenant(), v: results };
  return results;
}
const rangPublic = (r) => r && ({ cle: r.cle, nom: r.nom, couleur: r.couleur, description: r.description, min: r.min_pts, max: r.max_pts, ordre: r.ordre, actif: !!r.actif, divisions: r.divisions,
  montee: r.montee, descente: r.descente, recompense: { pieces: r.recompense_pieces, boosters: r.recompense_boosters }, logo: r.logo_maj ? `/api/rang-logo/${r.cle}?v=${r.logo_maj}` : null });
// Rang d'un nombre de trophées : le rang actif au seuil le plus haut atteint (et dans son maximum s'il en a un)
function rangDe(trophees, rangs) {
  const actifs = rangs.filter((r) => r.actif).sort((a, b) => a.min_pts - b.min_pts || a.ordre - b.ordre);
  if (!actifs.length) return null;
  let i = 0;
  actifs.forEach((r, k) => { if (trophees >= r.min_pts && (r.max_pts === null || r.max_pts === undefined || trophees <= r.max_pts)) i = k; });
  const r = actifs[i], suivant = actifs[i + 1] || null;
  const haut = suivant ? suivant.min_pts : (r.max_pts ?? null);
  let division = null;
  if (r.divisions > 1 && haut) {
    const pas = (haut - r.min_pts) / r.divisions;
    division = Math.max(1, r.divisions - Math.floor((trophees - r.min_pts) / pas)); // III → II → I
  }
  return { ...rangPublic(r), division, trophees, suivant: suivant ? { cle: suivant.cle, nom: suivant.nom, min: suivant.min_pts } : null,
    progression: haut ? Math.max(0, Math.min(100, Math.round(((trophees - r.min_pts) / (haut - r.min_pts)) * 100))) : 100 };
}
// Changement de rang : historique + notification
async function majRang(env, ctx, userId, avant, apres, rangs) {
  const a = rangDe(avant, rangs), n = rangDe(apres, rangs);
  if (!n || a?.cle === n.cle) return;
  await env.DB.prepare("INSERT INTO rangs_historique (user_id, ancien, nouveau, trophees, cree_le) VALUES (?, ?, ?, ?, ?)").bind(userId, a?.cle || null, n.cle, apres, maintenant()).run();
  const monte = !a || n.min >= a.min;
  const p = envoyerPush(env, userId, { titre: monte ? `🏅 Promotion : rang ${n.nom} !` : `Rang ${n.nom}`, texte: monte ? `Bravo, vous atteignez le rang ${n.nom} avec ${apres} points.` : `Vous redescendez au rang ${n.nom} (${apres} points). Reprenez votre place !`, url: "./#ligues" });
  if (ctx) enArrierePlan(ctx, p); else await p.catch(() => {});
}
route("GET", "rangs", async ({ env, user }) => {
  const rangs = await chargerRangs(env);
  let moi = null;
  if (user) { const a = await env.DB.prepare("SELECT trophees FROM arene WHERE user_id = ?").bind(user.id).first(); moi = rangDe(a?.trophees ?? 1000, rangs); }
  return json({ rangs: rangs.map(rangPublic), moi });
});
route("GET", "rang-logo/([a-z0-9-]{2,30})", async ({ env, p }) => {
  const v = await env.DB.prepare("SELECT logo FROM rangs WHERE cle = ?").bind(p[1]).first();
  return reponseImage(env, "rangs/" + p[1], v?.logo);
});
route("GET", "rangs/historique/(.{2,24})", async ({ env, p, user }) => {
  const u = await env.DB.prepare("SELECT id, confidentialite FROM users WHERE pseudo = ? AND banni = 0").bind(decodeURIComponent(p[1])).first();
  if (!u) return erreur("Joueur introuvable.", 404);
  if (user?.id !== u.id && !lireConfidentialite(u.confidentialite).historique) return json({ historique: [] });
  const { results } = await env.DB.prepare("SELECT ancien, nouveau, trophees, cree_le FROM rangs_historique WHERE user_id = ? ORDER BY id DESC LIMIT 20").bind(u.id).all();
  return json({ historique: results });
});
route("PUT", "admin/rangs/([a-z0-9-]{2,30})", async ({ request, env, user, p }) => {
  const b = await corps(request);
  const r = await env.DB.prepare("SELECT cle FROM rangs WHERE cle = ?").bind(p[1]).first();
  if (!r) return erreur("Rang introuvable.", 404);
  const nom = String(b.nom || "").trim().slice(0, 24), couleur = /^#[0-9a-f]{6}$/i.test(b.couleur || "") ? b.couleur : null;
  if (!nom) return erreur("Le nom du rang est obligatoire.");
  if (!couleur) return erreur("Couleur invalide (format #RRGGBB).");
  const min = Math.round(nombre(b.min, 0, 100000, NaN)), max = b.max === "" || b.max === null || b.max === undefined ? null : Math.round(nombre(b.max, 0, 100000, NaN));
  if (!Number.isFinite(min)) return erreur("Points minimum invalides.");
  if (max !== null && (!Number.isFinite(max) || max < min)) return erreur("Le maximum doit être supérieur ou égal au minimum.");
  await env.DB.prepare(`UPDATE rangs SET nom = ?, couleur = ?, description = ?, min_pts = ?, max_pts = ?, ordre = ?, actif = ?, divisions = ?, montee = ?, descente = ?, recompense_pieces = ?, recompense_boosters = ? WHERE cle = ?`)
    .bind(nom, couleur, String(b.description || "").slice(0, 300), min, max, Math.round(nombre(b.ordre, 0, 99, 0)), b.actif ? 1 : 0, Math.round(nombre(b.divisions, 1, 5, 1)),
      String(b.montee || "").slice(0, 200), String(b.descente || "").slice(0, 200), Math.round(nombre(b.recompensePieces, 0, 100000, 0)), Math.round(nombre(b.recompenseBoosters, 0, 50, 0)), p[1]).run();
  rangsCache = { t: 0, v: null };
  await journaliser(env, user.id, `rang ${p[1]} modifié`, `${nom} · ${min}${max !== null ? "-" + max : "+"}`, "admin");
  return json({ ok: true });
}, { admin: true });
route("POST", "admin/rangs/([a-z0-9-]{2,30})/logo", async ({ request, env, user, p }) => {
  const b = await corps(request);
  const m = VISUEL_RE.exec(String(b.image || ""));
  if (!m || !["png", "webp"].includes(m[1])) return erreur("Logo invalide : PNG ou WebP uniquement (pour garder la transparence).");
  if (m[2].length > 1400000) return erreur("Logo trop lourd : 1 Mo maximum.");
  const r = await env.DB.prepare("UPDATE rangs SET logo = ?, logo_maj = ? WHERE cle = ?").bind(await stockerImage(env, "rangs/" + p[1], b.image), maintenant(), p[1]).run();
  if (!r.meta.changes) return erreur("Rang introuvable.", 404);
  rangsCache = { t: 0, v: null };
  await journaliser(env, user.id, `logo du rang ${p[1]} importé`, "", "admin");
  return json({ ok: true });
}, { admin: true });
route("DELETE", "admin/rangs/([a-z0-9-]{2,30})/logo", async ({ env, p }) => {
  await env.DB.prepare("UPDATE rangs SET logo = NULL, logo_maj = 0 WHERE cle = ?").bind(p[1]).run();
  await env.IMAGES?.delete("rangs/" + p[1]).catch(() => {});
  rangsCache = { t: 0, v: null };
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Photos de cartes envoyées par l'admin (remplacent la photo Wikipédia)
   Dans l'URL, le « : » de l'identifiant de carte est remplacé par « ~ ».
   ===================================================================== */
route("GET", "photos/perso", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT carte, maj FROM photos_perso").all();
  return json({ perso: Object.fromEntries(results.map((x) => [x.carte, x.maj])) }, 200, { "cache-control": "public, max-age=60" });
});
route("GET", "photo-perso/([a-z]+~[A-Za-z0-9_-]{1,40})", async ({ env, p }) => {
  const v = await env.DB.prepare("SELECT image FROM photos_perso WHERE carte = ?").bind(p[1].replace("~", ":")).first();
  return reponseImage(env, "photos/" + p[1], v?.image);
});
route("POST", "admin/photo-perso", async ({ request, env }) => {
  const b = await corps(request);
  if (!CARTE_RE.test(String(b.carte || ""))) return erreur("Carte inconnue.");
  const m = VISUEL_RE.exec(String(b.image || ""));
  if (!m) return erreur("Image invalide (WebP, JPEG ou PNG).");
  if (m[2].length > 1400000) return erreur("Image trop lourde : 1 Mo maximum après compression.");
  await env.DB.prepare("INSERT INTO photos_perso (carte, image, maj) VALUES (?, ?, ?) ON CONFLICT(carte) DO UPDATE SET image = excluded.image, maj = excluded.maj").bind(b.carte, await stockerImage(env, "photos/" + b.carte.replace(":", "~"), b.image), maintenant()).run();
  return json({ ok: true, maj: maintenant() });
}, { admin: true });
route("DELETE", "admin/photo-perso/([a-z]+~[A-Za-z0-9_-]{1,40})", async ({ env, p }) => {
  await env.DB.prepare("DELETE FROM photos_perso WHERE carte = ?").bind(p[1].replace("~", ":")).run();
  await env.IMAGES?.delete("photos/" + p[1]).catch(() => {});
  return json({ ok: true });
}, { admin: true });

/* =====================================================================
   Codex : premières découvertes mondiales (qui a trouvé chaque carte en premier)
   ===================================================================== */
async function noterDecouvertes(env, user, data, avant) {
  const ids = Object.keys(data?.sauvegarde?.owned || {}).filter((id) => data.sauvegarde.owned[id] > 0 && CATALOGUE[id] && !(avant && avant[id] > 0));
  for (let i = 0; i < Math.min(ids.length, 400); i += 50) {
    const lot = ids.slice(i, i + 50);
    await env.DB.batch(lot.map((id) => env.DB.prepare("INSERT OR IGNORE INTO decouvertes (carte, user_id, pseudo, cree_le) VALUES (?, ?, ?, ?)").bind(id, user.id, user.pseudo, maintenant())));
  }
}
route("GET", "codex", async ({ env, user }) => {
  const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM decouvertes").first()).n;
  const recentes = await env.DB.prepare("SELECT carte, pseudo, cree_le FROM decouvertes ORDER BY cree_le DESC LIMIT 12").all();
  const miennes = user ? (await env.DB.prepare("SELECT COUNT(*) AS n FROM decouvertes WHERE user_id = ?").bind(user.id).first()).n : 0;
  const top = await env.DB.prepare("SELECT pseudo, COUNT(*) AS n FROM decouvertes GROUP BY user_id ORDER BY n DESC LIMIT 5").all();
  return json({ total, catalogue: Object.keys(CATALOGUE).length, miennes, recentes: recentes.results, explorateurs: top.results });
});
route("GET", "codex/carte/([a-z]+:[A-Za-z0-9_-]{1,40})", async ({ env, p }) => {
  const d = await env.DB.prepare("SELECT pseudo, cree_le FROM decouvertes WHERE carte = ?").bind(p[1]).first();
  return json({ decouverte: d || null });
});

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
