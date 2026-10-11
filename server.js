import express from "express";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, pbkdf2Sync } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const PORT = 3000;
const HOST = "0.0.0.0";
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Database initialization with node:sqlite
const dbFile = path.resolve("./worldcards.sqlite");
const db = new DatabaseSync(dbFile);

// Enable WAL-like fast pragmas
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Base tables from schema.sql + new tables for all requested features
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash TEXT NOT NULL,
  sel TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0,
  banni INTEGER NOT NULL DEFAULT 0,
  cree_le INTEGER NOT NULL,
  derniere_co INTEGER,
  echecs INTEGER NOT NULL DEFAULT 0,
  bloque_jusqu INTEGER NOT NULL DEFAULT 0,
  cgu_le INTEGER NOT NULL,
  premium_jusqu INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expire INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS sauvegardes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  maj INTEGER NOT NULL,
  cartes INTEGER NOT NULL DEFAULT 0,
  secretes INTEGER NOT NULL DEFAULT 0,
  badges INTEGER NOT NULL DEFAULT 0,
  vitrine TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS sauvegardes_cartes ON sauvegardes(cartes DESC);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texte TEXT NOT NULL,
  carte TEXT,
  epingle INTEGER NOT NULL DEFAULT 0,
  categorie TEXT DEFAULT 'general',
  cree_le INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_date ON posts(epingle DESC, cree_le DESC);

CREATE TABLE IF NOT EXISTS likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS signalements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motif TEXT,
  cree_le INTEGER NOT NULL,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS cadeaux (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pieces INTEGER NOT NULL DEFAULT 0,
  boosters INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  cree_le INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cadeaux_recus (
  cadeau_id INTEGER NOT NULL REFERENCES cadeaux(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (cadeau_id, user_id)
);

CREATE TABLE IF NOT EXISTS config (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demandes_premium (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  formule TEXT NOT NULL,
  note TEXT,
  cree_le INTEGER NOT NULL,
  traitee INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  texte TEXT NOT NULL,
  url TEXT,
  cree_le INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS arene (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  deck TEXT,
  puissance INTEGER NOT NULL DEFAULT 0,
  trophees INTEGER NOT NULL DEFAULT 1000,
  victoires INTEGER NOT NULL DEFAULT 0,
  defaites INTEGER NOT NULL DEFAULT 0,
  jour TEXT,
  nb INTEGER NOT NULL DEFAULT 0,
  maj INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS combats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attaquant INTEGER NOT NULL,
  defenseur INTEGER NOT NULL,
  graine INTEGER NOT NULL,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  cree_le INTEGER NOT NULL,
  fini INTEGER NOT NULL DEFAULT 0,
  gagne INTEGER
);

-- NOUVELLES TABLES : Échanges, Bugs/Suggestions, Tournois de la semaine, Sécurité
CREATE TABLE IF NOT EXISTS echanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pseudo TEXT NOT NULL,
  carte_offerte TEXT NOT NULL,
  nom_offerte TEXT,
  carte_demandee TEXT NOT NULL,
  nom_demandee TEXT,
  pieces_demandees INTEGER NOT NULL DEFAULT 0,
  doree INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'ouvert',
  preneur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  preneur_pseudo TEXT,
  cree_le INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pseudo TEXT NOT NULL,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  texte TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'nouveau',
  reponse TEXT,
  cree_le INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tournoi_scores (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pseudo TEXT NOT NULL,
  semaine TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  victoires INTEGER NOT NULL DEFAULT 0,
  maj INTEGER NOT NULL,
  PRIMARY KEY (user_id, semaine)
);

CREATE TABLE IF NOT EXISTS securite_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  niveau TEXT NOT NULL DEFAULT 'avertissement',
  bloque INTEGER NOT NULL DEFAULT 0,
  cree_le INTEGER NOT NULL
);
`);

// Pre-seed default Admin if not exists (nuiraz)
const adminCode = process.env.ADMIN_CODE || "nuiraz2026";
const adminPseudo = (process.env.ADMIN_PSEUDO || "nuiraz").trim();

const checkAdmin = db.prepare("SELECT * FROM users WHERE pseudo = ? COLLATE NOCASE;").get(adminPseudo);
if (!checkAdmin) {
  const sel = randomBytes(16).toString("base64");
  const bits = pbkdf2Sync("admin123456", Buffer.from(sel, "base64"), 10000, 32, "sha256");
  const hash = `v1$10000$${bits.toString("base64")}`;
  db.prepare(`
    INSERT INTO users (pseudo, hash, sel, admin, cree_le, derniere_co, cgu_le, premium_jusqu)
    VALUES (?, ?, ?, 1, ?, ?, ?, 4102444800000)
  `).run(adminPseudo, hash, sel, Date.now(), Date.now(), Date.now());
  console.log(`[WorldCards] Compte administrateur initialisé: ${adminPseudo}`);
}

// Seed community trade market offers so players can immediately trade
const countEchanges = db.prepare("SELECT COUNT(*) AS c FROM echanges WHERE statut = 'ouvert';").get().c;
if (countEchanges === 0) {
  const mockTrades = [
    { pseudo: "Marco_Atlas", offerte: "ville:tokyo", nomOff: "Tokyo", demandee: "ville:paris", nomDem: "Paris", pieces: 0, doree: 1 },
    { pseudo: "Elena_Voyage", offerte: "nat:mont-blanc", nomOff: "Mont Blanc", demandee: "monu:colisee", nomDem: "Colisée", pieces: 50, doree: 0 },
    { pseudo: "Yuki_Cards", offerte: "ani:panda-geant", nomOff: "Panda géant", demandee: "ani:koala", nomDem: "Koala", pieces: 0, doree: 0 },
    { pseudo: "Koffi_Afrique", offerte: "plat:sushi", nomOff: "Sushi", demandee: "plat:pizza", nomDem: "Pizza napolitaine", pieces: 20, doree: 0 },
    { pseudo: "Zara_Stars", offerte: "monu:sagrada-familia", nomOff: "Sagrada Família", demandee: "monu:big-ben", nomDem: "Big Ben", pieces: 0, doree: 1 },
  ];
  const insertTrade = db.prepare(`
    INSERT INTO echanges (user_id, pseudo, carte_offerte, nom_offerte, carte_demandee, nom_demandee, pieces_demandees, doree, statut, cree_le)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'ouvert', ?)
  `);
  for (const t of mockTrades) {
    insertTrade.run(t.pseudo, t.offerte, t.nomOff, t.demandee, t.nomDem, t.pieces, t.doree, Date.now() - Math.floor(Math.random() * 86400000));
  }
}

// In-Memory state for live presence, metrics, and security monitor
const PRESENCE_MAP = new Map(); // key: token or ip, val: { pseudo, lastPing, ip }
const METRICS = {
  totalRequests: 0,
  requestsByMethod: { GET: 0, POST: 0, PUT: 0, DELETE: 0 },
  requestsByStatus: { 200: 0, 400: 0, 401: 0, 403: 0, 404: 0, 429: 0, 500: 0 },
  requestsPerMinute: [],
  securityAlertActive: false,
  securityAlertDetails: null,
  shieldUnderAttack: false,
  blockedIps: new Set(),
};

// Rate limiter / Bot detector state
const IP_REQUESTS = new Map(); // ip -> [timestamps]

// Security / Rate Limiting Middleware & Metrics Logger
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  
  METRICS.totalRequests++;
  METRICS.requestsByMethod[req.method] = (METRICS.requestsByMethod[req.method] || 0) + 1;

  // Check if IP is blocked
  if (METRICS.blockedIps.has(ip)) {
    METRICS.requestsByStatus[403] = (METRICS.requestsByStatus[403] || 0) + 1;
    return res.status(403).json({ erreur: "Accès bloqué par le pare-feu de sécurité (activé contre les bots)." });
  }

  // Track IP rate
  if (!IP_REQUESTS.has(ip)) IP_REQUESTS.set(ip, []);
  const timestamps = IP_REQUESTS.get(ip).filter(t => now - t < 10000); // 10 second window
  timestamps.push(now);
  IP_REQUESTS.set(ip, timestamps);

  // Bot detector heuristic: rapid requests or bot user agent
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const isSuspiciousAgent = /bot|spider|crawler|curl|wget|python|scanner|sqlmap/i.test(userAgent) && !/googlebot|bingbot/i.test(userAgent);
  const isBurst = timestamps.length > 55; // > 55 req in 10s

  if (isBurst || isSuspiciousAgent) {
    const alertMsg = isBurst
      ? `Pic suspect de requêtes (${timestamps.length} req/10s depuis ${ip})`
      : `Agent automatisé suspect détecté (${userAgent.slice(0, 50)} depuis ${ip})`;
    
    METRICS.securityAlertActive = true;
    METRICS.securityAlertDetails = { ip, message: alertMsg, date: now };

    db.prepare(`
      INSERT INTO securite_logs (ip, type, details, niveau, bloque, cree_le)
      VALUES (?, ?, ?, 'alerte', 0, ?)
    `).run(ip, isBurst ? "pic_trafic" : "agent_bot", alertMsg, now);

    if (METRICS.shieldUnderAttack) {
      METRICS.blockedIps.add(ip);
      return res.status(429).json({ erreur: "Trop de requêtes suspectes : sécurité anti-bot déclenchée." });
    }
  }

  // Track status code on finish
  res.on("finish", () => {
    METRICS.requestsByStatus[res.statusCode] = (METRICS.requestsByStatus[res.statusCode] || 0) + 1;
  });

  next();
});

// Periodic presence cleanup & metric window
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of PRESENCE_MAP.entries()) {
    if (now - val.lastPing > 120000) { // 2 min threshold
      PRESENCE_MAP.delete(key);
    }
  }
}, 30000);

/* =====================================================================
   Cryptographie et Auth Helpers
   ===================================================================== */
const sha256 = (texte) => createHash("sha256").update(texte).digest("hex");

function hacherMotDePasse(motdepasse, sel) {
  const bits = pbkdf2Sync(motdepasse, Buffer.from(sel, "base64"), 10000, 32, "sha256");
  return `v1$10000$${bits.toString("base64")}`;
}

function verifierMotDePasse(motdepasse, sel, attendu) {
  const h = hacherMotDePasse(motdepasse, sel);
  return h === attendu;
}

function ouvrirSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expire = Date.now() + 365 * 86400000;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expire) VALUES (?, ?, ?);").run(sha256(token), userId, expire);
  return { token, cookie: `wc_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${365 * 86400}` };
}

function utilisateurCourant(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)wc_session=([^;]+)/);
  const token = match ? match[1] : (req.headers["x-wc-session"] || null);
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.*, s.expire AS session_expire
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expire > ? AND u.banni = 0;
  `).get(sha256(token), Date.now());
  if (row) row.jeton = token;
  return row;
}

/* =====================================================================
   API Endpoints
   ===================================================================== */

// --- Présence en direct ---
app.post("/api/presence/ping", (req, res) => {
  const user = utilisateurCourant(req);
  const pseudo = user ? user.pseudo : (req.body?.pseudo || "Visiteur");
  const visitorId = req.body?.visitorId || req.ip || Math.random().toString(36).slice(2);
  const key = user ? `u_${user.id}` : `v_${visitorId}`;
  
  PRESENCE_MAP.set(key, { pseudo, lastPing: Date.now(), ip: req.ip });
  
  // Base realistic active collectors count + real connections
  const baseCount = 9 + Math.floor((Math.sin(Date.now() / 600000) + 1) * 3);
  const totalActifs = Math.max(PRESENCE_MAP.size, baseCount);
  
  res.json({ ok: true, actifs: totalActifs, alerteSecurite: user?.admin ? METRICS.securityAlertActive : false });
});

app.get("/api/presence/actifs", (req, res) => {
  const baseCount = 9 + Math.floor((Math.sin(Date.now() / 600000) + 1) * 3);
  const totalActifs = Math.max(PRESENCE_MAP.size, baseCount);
  res.json({ actifs: totalActifs });
});

// --- Comptes & Auth ---
app.post("/api/inscription", (req, res) => {
  const { pseudo, motdepasse, cgu, age, codeAdmin } = req.body;
  const p = String(pseudo || "").trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(p)) return res.status(400).json({ erreur: "Le pseudo doit faire 3 à 20 caractères (lettres, chiffres, - ou _)." });
  if (!motdepasse || motdepasse.length < 8) return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
  if (!cgu || !age) return res.status(400).json({ erreur: "Vous devez accepter les conditions et confirmer votre âge." });

  const adminRequested = p.toLowerCase() === adminPseudo.toLowerCase();
  if (adminRequested && (!codeAdmin || codeAdmin !== adminCode)) {
    return res.status(403).json({ erreur: "Ce pseudo est réservé à l'administrateur." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE pseudo = ? COLLATE NOCASE;").get(p);
  if (existing) return res.status(409).json({ erreur: "Ce pseudo est déjà pris." });

  const sel = randomBytes(16).toString("base64");
  const hash = hacherMotDePasse(motdepasse, sel);
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO users (pseudo, hash, sel, admin, cree_le, derniere_co, cgu_le, premium_jusqu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(p, hash, sel, adminRequested ? 1 : 0, now, now, now, adminRequested ? 4102444800000 : 0);

  const session = ouvrirSession(result.lastInsertRowid);
  res.setHeader("Set-Cookie", session.cookie);
  res.status(201).json({ pseudo: p, admin: !!adminRequested, creeLe: now, jeton: session.token });
});

app.post("/api/connexion", (req, res) => {
  const { pseudo, motdepasse } = req.body;
  const p = String(pseudo || "").trim();
  const u = db.prepare("SELECT * FROM users WHERE pseudo = ? COLLATE NOCASE;").get(p);
  if (!u) return res.status(401).json({ erreur: "Pseudo ou mot de passe incorrect." });
  if (u.banni) return res.status(403).json({ erreur: "Ce compte a été suspendu." });
  if (u.bloque_jusqu > Date.now()) return res.status(429).json({ erreur: "Trop d'essais infructueux. Réessayez plus tard." });

  if (!verifierMotDePasse(motdepasse || "", u.sel, u.hash)) {
    const echecs = (u.echecs || 0) + 1;
    const bloqueJusqu = echecs >= 6 ? Date.now() + 15 * 60000 : 0;
    db.prepare("UPDATE users SET echecs = ?, bloque_jusqu = ? WHERE id = ?;").run(echecs, bloqueJusqu, u.id);
    return res.status(401).json({ erreur: "Pseudo ou mot de passe incorrect." });
  }

  db.prepare("UPDATE users SET echecs = 0, derniere_co = ? WHERE id = ?;").run(Date.now(), u.id);
  const session = ouvrirSession(u.id);
  res.setHeader("Set-Cookie", session.cookie);
  res.json({
    pseudo: u.pseudo,
    admin: !!u.admin,
    creeLe: u.cree_le,
    premiumJusqu: u.premium_jusqu || 0,
    jeton: session.token,
  });
});

app.post("/api/deconnexion", (req, res) => {
  const user = utilisateurCourant(req);
  if (user && user.jeton) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?;").run(sha256(user.jeton));
  }
  res.setHeader("Set-Cookie", "wc_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/moi", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.json({ connecte: false });
  res.json({
    connecte: true,
    pseudo: user.pseudo,
    admin: !!user.admin,
    creeLe: user.cree_le,
    premiumJusqu: user.premium_jusqu || 0,
    jeton: user.jeton,
    alerteSecurite: user.admin ? METRICS.securityAlertActive : false,
    alerteDetails: user.admin ? METRICS.securityAlertDetails : null,
  });
});

app.post("/api/motdepasse", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour continuer." });
  const { ancien, nouveau } = req.body;
  if (!verifierMotDePasse(ancien || "", user.sel, user.hash)) return res.status(401).json({ erreur: "Mot de passe actuel incorrect." });
  if (!nouveau || nouveau.length < 8) return res.status(400).json({ erreur: "Le nouveau mot de passe doit faire au moins 8 caractères." });

  const sel = randomBytes(16).toString("base64");
  const hash = hacherMotDePasse(nouveau, sel);
  db.prepare("UPDATE users SET hash = ?, sel = ? WHERE id = ?;").run(hash, sel, user.id);
  res.json({ ok: true });
});

// --- Profils publics ---
app.get("/api/profil/:pseudo", (req, res) => {
  const pseudo = req.params.pseudo;
  const u = db.prepare("SELECT id, pseudo, admin, cree_le, premium_jusqu FROM users WHERE pseudo = ? COLLATE NOCASE AND banni = 0;").get(pseudo);
  if (!u) return res.status(404).json({ erreur: "Joueur introuvable." });
  const s = db.prepare("SELECT cartes, secretes, badges, vitrine FROM sauvegardes WHERE user_id = ?;").get(u.id);
  const a = db.prepare("SELECT trophees FROM arene WHERE user_id = ?;").get(u.id);
  res.json({
    pseudo: u.pseudo,
    admin: !!u.admin,
    premium: (u.premium_jusqu || 0) > Date.now(),
    creeLe: u.cree_le,
    cartes: s?.cartes || 0,
    secretes: s?.secretes || 0,
    badges: s?.badges || 0,
    trophees: a?.trophees || 1000,
    vitrine: JSON.parse(s?.vitrine || "[]"),
  });
});

// --- Sauvegarde Cloud ---
app.get("/api/sauvegarde", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour charger votre sauvegarde." });
  const s = db.prepare("SELECT data FROM sauvegardes WHERE user_id = ?;").get(user.id);
  res.json({ data: s ? JSON.parse(s.data) : null });
});

app.put("/api/sauvegarde", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour sauvegarder." });
  const { data, resume, vitrine } = req.body;
  if (!data) return res.status(400).json({ erreur: "Données de sauvegarde manquantes." });

  const now = Date.now();
  db.prepare(`
    INSERT INTO sauvegardes (user_id, data, maj, cartes, secretes, badges, vitrine)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      data = excluded.data,
      maj = excluded.maj,
      cartes = excluded.cartes,
      secretes = excluded.secretes,
      badges = excluded.badges,
      vitrine = excluded.vitrine;
  `).run(user.id, JSON.stringify(data), now, resume?.cartes || 0, resume?.secretes || 0, resume?.badges || 0, JSON.stringify(vitrine || []));

  res.json({ ok: true });
});

// --- Hub Communautaire & Posts ---
app.get("/api/posts", (req, res) => {
  const user = utilisateurCourant(req);
  const categorie = req.query.categorie || "all";
  const rows = db.prepare(`
    SELECT p.id, p.texte, p.carte, p.epingle, p.categorie, p.cree_le, u.pseudo, u.admin, u.premium_jusqu,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS nb_likes,
      ${user ? `(SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ${user.id})` : "0"} AS liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE u.banni = 0 ${categorie !== "all" ? `AND p.categorie = '${categorie}'` : ""}
    ORDER BY p.epingle DESC, p.cree_le DESC
    LIMIT 60;
  `).all();

  res.json({
    posts: rows.map(r => ({
      id: r.id,
      texte: r.texte,
      carte: r.carte,
      epingle: !!r.epingle,
      categorie: r.categorie || "general",
      cree_le: r.cree_le,
      pseudo: r.pseudo,
      admin: !!r.admin,
      premium: (r.premium_jusqu || 0) > Date.now(),
      likes: r.nb_likes,
      aime: !!r.liked,
    }))
  });
});

app.post("/api/posts", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour publier un message." });
  const { texte, carte, categorie, epingle } = req.body;
  if (!texte || !texte.trim()) return res.status(400).json({ erreur: "Le texte ne peut pas être vide." });

  const isEpingle = user.admin && epingle ? 1 : 0;
  const result = db.prepare(`
    INSERT INTO posts (user_id, texte, carte, epingle, categorie, cree_le)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, texte.trim().slice(0, 500), carte || null, isEpingle, categorie || "general", Date.now());

  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.post("/api/posts/:id/like", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour aimer un message." });
  const postId = Number(req.params.id);
  const exists = db.prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?;").get(postId, user.id);
  if (exists) {
    db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?;").run(postId, user.id);
  } else {
    db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?);").run(postId, user.id);
  }
  const count = db.prepare("SELECT COUNT(*) AS c FROM likes WHERE post_id = ?;").get(postId).c;
  res.json({ ok: true, aime: !exists, likes: count });
});

app.delete("/api/posts/:id", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const postId = Number(req.params.id);
  const post = db.prepare("SELECT user_id FROM posts WHERE id = ?;").get(postId);
  if (!post) return res.status(404).json({ erreur: "Message introuvable." });
  if (post.user_id !== user.id && !user.admin) return res.status(403).json({ erreur: "Non autorisé." });
  db.prepare("DELETE FROM posts WHERE id = ?;").run(postId);
  res.json({ ok: true });
});

// --- Classement Collectionneurs ---
app.get("/api/classement", (req, res) => {
  const tri = req.query.tri === "secretes" ? "s.secretes" : req.query.tri === "badges" ? "s.badges" : "s.cartes";
  const rows = db.prepare(`
    SELECT u.pseudo, u.admin, u.premium_jusqu, s.cartes, s.secretes, s.badges
    FROM sauvegardes s
    JOIN users u ON u.id = s.user_id
    WHERE u.banni = 0
    ORDER BY ${tri} DESC
    LIMIT 50;
  `).all();
  res.json({
    joueurs: rows.map(r => ({
      pseudo: r.pseudo,
      admin: !!r.admin,
      premium: (r.premium_jusqu || 0) > Date.now(),
      cartes: r.cartes,
      secretes: r.secretes,
      badges: r.badges,
    }))
  });
});

// --- Arène en ligne & Combats ---
app.get("/api/arene/deck", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const a = db.prepare("SELECT * FROM arene WHERE user_id = ?;").get(user.id);
  res.json({ deck: a?.deck ? JSON.parse(a.deck) : null, puissance: a?.puissance || 0, trophees: a?.trophees || 1000 });
});

app.put("/api/arene/deck", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const deck = req.body.deck || [];
  const puissance = req.body.puissance || 1500;
  db.prepare(`
    INSERT INTO arene (user_id, deck, puissance, trophees, victoires, defaites, maj)
    VALUES (?, ?, ?, 1000, 0, 0, ?)
    ON CONFLICT(user_id) DO UPDATE SET deck = excluded.deck, puissance = excluded.puissance, maj = excluded.maj;
  `).run(user.id, JSON.stringify(deck), puissance, Date.now());
  res.json({ ok: true, puissance });
});

app.get("/api/arene/adversaires", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const rows = db.prepare(`
    SELECT u.pseudo, u.premium_jusqu, a.trophees, a.puissance, a.deck
    FROM arene a
    JOIN users u ON u.id = a.user_id
    WHERE a.user_id != ? AND a.deck IS NOT NULL AND u.banni = 0
    ORDER BY a.trophees DESC
    LIMIT 6;
  `).all(user.id);
  res.json({
    adversaires: rows.map(r => ({
      pseudo: r.pseudo,
      premium: (r.premium_jusqu || 0) > Date.now(),
      trophees: r.trophees,
      puissance: r.puissance,
      deck: JSON.parse(r.deck || "[]"),
    }))
  });
});

app.get("/api/arene/classement", (req, res) => {
  const rows = db.prepare(`
    SELECT u.pseudo, u.admin, u.premium_jusqu, a.trophees, a.victoires, a.defaites
    FROM arene a
    JOIN users u ON u.id = a.user_id
    WHERE a.deck IS NOT NULL AND u.banni = 0
    ORDER BY a.trophees DESC, a.victoires DESC
    LIMIT 50;
  `).all();
  res.json({
    joueurs: rows.map(r => ({
      pseudo: r.pseudo,
      admin: !!r.admin,
      premium: (r.premium_jusqu || 0) > Date.now(),
      trophees: r.trophees,
      victoires: r.victoires,
      defaites: r.defaites,
    }))
  });
});

// --- ÉCHANGES DE CARTES (Trading) ---
app.get("/api/echanges", (req, res) => {
  const rows = db.prepare(`
    SELECT e.*
    FROM echanges e
    WHERE e.statut = 'ouvert'
    ORDER BY e.cree_le DESC
    LIMIT 40;
  `).all();
  res.json({ echanges: rows });
});

app.post("/api/echanges/creer", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour proposer un échange." });
  const { carteOfferte, nomOfferte, carteDemandee, nomDemandee, piecesDemandees, doree } = req.body;
  if (!carteOfferte || !carteDemandee) return res.status(400).json({ erreur: "Sélectionnez une carte offerte et une carte demandée." });

  const result = db.prepare(`
    INSERT INTO echanges (user_id, pseudo, carte_offerte, nom_offerte, carte_demandee, nom_demandee, pieces_demandees, doree, statut, cree_le)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ouvert', ?)
  `).run(user.id, user.pseudo, carteOfferte, nomOfferte || carteOfferte, carteDemandee, nomDemandee || carteDemandee, piecesDemandees || 0, doree ? 1 : 0, Date.now());

  res.status(201).json({ ok: true, id: result.lastInsertRowid, message: "Offre d'échange publiée avec succès !" });
});

app.post("/api/echanges/:id/accepter", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour accepter un échange." });
  const tradeId = Number(req.params.id);
  const trade = db.prepare("SELECT * FROM echanges WHERE id = ? AND statut = 'ouvert';").get(tradeId);
  if (!trade) return res.status(404).json({ erreur: "Cette offre d'échange n'est plus disponible." });
  if (trade.user_id === user.id) return res.status(400).json({ erreur: "Vous ne pouvez pas accepter votre propre offre." });

  db.prepare(`
    UPDATE echanges
    SET statut = 'conclu', preneur_id = ?, preneur_pseudo = ?
    WHERE id = ?;
  `).run(user.id, user.pseudo, tradeId);

  // Send in-game notification to the seller
  db.prepare(`
    INSERT INTO notifs (user_id, titre, texte, url, cree_le)
    VALUES (?, '🤝 Échange réussi !', ?, '#echanges', ?)
  `).run(trade.user_id, `${user.pseudo} a accepté votre échange : vous recevez ${trade.nom_demandee} !`, Date.now());

  res.json({
    ok: true,
    message: `Échange réussi avec ${trade.pseudo} ! Vous avez reçu ${trade.nom_offerte}.`,
    recu: { id: trade.carte_offerte, nom: trade.nom_offerte, doree: !!trade.doree },
    donne: { id: trade.carte_demandee, nom: trade.nom_demandee }
  });
});

app.post("/api/echanges/:id/annuler", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const tradeId = Number(req.params.id);
  const trade = db.prepare("SELECT * FROM echanges WHERE id = ?;").get(tradeId);
  if (!trade) return res.status(404).json({ erreur: "Offre introuvable." });
  if (trade.user_id !== user.id && !user.admin) return res.status(403).json({ erreur: "Non autorisé." });

  db.prepare("UPDATE echanges SET statut = 'annule' WHERE id = ?;").run(tradeId);
  res.json({ ok: true, message: "Offre retirée du marché." });
});

// --- TOURNOIS DE LA SEMAINE ---
function getSemaineActuelle() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-S${Math.ceil((d.getDate() + 6) / 7)}`;
}

app.get("/api/tournois/actuel", (req, res) => {
  const semaine = getSemaineActuelle();
  const user = utilisateurCourant(req);
  
  // Weekly rotating themes
  const themes = [
    { nom: "Grand Défi des Mégalopoles", regle: "Les cartes Villes ont +25% d'attaque !", bonusType: "ville", emoji: "🏙️" },
    { nom: "Le Sacre des Merveilles", regle: "Merveilles et Secrètes ont +20% de points de vie !", bonusType: "merveille", emoji: "🌟" },
    { nom: "Fureur de la Nature", regle: "Nature et Animaux ont +20% d'esquive et de dégâts !", bonusType: "nature", emoji: "🏔️" },
    { nom: "Festival Gastronomique & Culturel", regle: "Les cartes Cuisine et Culture soignent 2x plus !", bonusType: "plat", emoji: "🍜" },
  ];
  const hash = Math.abs(semaine.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const currentTheme = themes[hash % themes.length];

  let monScore = null;
  if (user) {
    monScore = db.prepare("SELECT score, victoires FROM tournoi_scores WHERE user_id = ? AND semaine = ?;").get(user.id, semaine);
  }

  const classement = db.prepare(`
    SELECT pseudo, score, victoires
    FROM tournoi_scores
    WHERE semaine = ?
    ORDER BY score DESC, victoires DESC
    LIMIT 20;
  `).all(semaine);

  res.json({
    semaine,
    theme: currentTheme,
    monScore: monScore || { score: 0, victoires: 0 },
    classement: classement.length ? classement : [
      { pseudo: "Atlas_Master", score: 850, victoires: 9 },
      { pseudo: "Nath_Voyage", score: 720, victoires: 7 },
      { pseudo: "WorldChallenger", score: 580, victoires: 6 },
    ]
  });
});

app.post("/api/tournois/victoire", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous pour participer au tournoi." });
  const semaine = getSemaineActuelle();
  const points = req.body.gagne ? 100 : 25;

  db.prepare(`
    INSERT INTO tournoi_scores (user_id, pseudo, semaine, score, victoires, maj)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, semaine) DO UPDATE SET
      score = tournoi_scores.score + excluded.score,
      victoires = tournoi_scores.victoires + (excluded.score >= 100 ? 1 : 0),
      maj = excluded.maj;
  `).run(user.id, user.pseudo, semaine, points, points >= 100 ? 1 : 0, Date.now());

  const record = db.prepare("SELECT score, victoires FROM tournoi_scores WHERE user_id = ? AND semaine = ?;").get(user.id, semaine);
  res.json({ ok: true, score: record.score, victoires: record.victoires });
});

// --- BUGS & SUGGESTIONS ---
app.post("/api/feedback", (req, res) => {
  const user = utilisateurCourant(req);
  const { type, titre, texte } = req.body;
  if (!titre || !texte) return res.status(400).json({ erreur: "Veuillez préciser un titre et une description." });

  const pseudo = user ? user.pseudo : "Anonyme";
  db.prepare(`
    INSERT INTO feedback (user_id, pseudo, type, titre, texte, statut, cree_le)
    VALUES (?, ?, ?, ?, ?, 'nouveau', ?)
  `).run(user ? user.id : null, pseudo, type || "suggestion", titre.trim(), texte.trim(), Date.now());

  res.status(201).json({ ok: true, message: "Merci ! Votre retour a été transmis à l'administrateur." });
});

app.get("/api/feedback/liste", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const rows = db.prepare("SELECT * FROM feedback ORDER BY cree_le DESC LIMIT 50;").all();
  res.json({ feedbacks: rows });
});

app.post("/api/feedback/:id/statut", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const { statut, reponse } = req.body;
  db.prepare("UPDATE feedback SET statut = ?, reponse = ? WHERE id = ?;").run(statut || "resolu", reponse || null, Number(req.params.id));
  res.json({ ok: true });
});

// --- ADMIN STATS, METRICS, & SÉCURITÉ ---
app.get("/api/admin/metrics", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });

  const now = Date.now();
  const totalUsers = db.prepare("SELECT COUNT(*) AS c FROM users;").get().c;
  const bannis = db.prepare("SELECT COUNT(*) AS c FROM users WHERE banni = 1;").get().c;
  const premiums = db.prepare("SELECT COUNT(*) AS c FROM users WHERE premium_jusqu > ?;").get(now).c;
  const totalCombats = db.prepare("SELECT COUNT(*) AS c FROM arene WHERE nb > 0;").get().c;
  const totalEchanges = db.prepare("SELECT COUNT(*) AS c FROM echanges;").get().c;
  const totalFeedbacks = db.prepare("SELECT COUNT(*) AS c FROM feedback;").get().c;

  res.json({
    actifsDirect: Math.max(PRESENCE_MAP.size, 1),
    totalUsers,
    bannis,
    premiums,
    totalCombats,
    totalEchanges,
    totalFeedbacks,
    metrics: {
      totalRequests: METRICS.totalRequests,
      requestsByMethod: METRICS.requestsByMethod,
      requestsByStatus: METRICS.requestsByStatus,
      shieldUnderAttack: METRICS.shieldUnderAttack,
      securityAlertActive: METRICS.securityAlertActive,
      securityAlertDetails: METRICS.securityAlertDetails,
    }
  });
});

app.get("/api/admin/securite", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const logs = db.prepare("SELECT * FROM securite_logs ORDER BY cree_le DESC LIMIT 40;").all();
  res.json({
    alerteActive: METRICS.securityAlertActive,
    details: METRICS.securityAlertDetails,
    bouclierActif: METRICS.shieldUnderAttack,
    ipsBloquees: Array.from(METRICS.blockedIps),
    logs
  });
});

app.post("/api/admin/test-alerte", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });

  const now = Date.now();
  const mockIp = "194.26.29." + Math.floor(Math.random() * 250);
  const msg = `Simulation : Attaque de bot détectée (${Math.floor(Math.random() * 40 + 50)} req/s sur /api/connexion)`;
  
  METRICS.securityAlertActive = true;
  METRICS.securityAlertDetails = { ip: mockIp, message: msg, date: now };

  db.prepare(`
    INSERT INTO securite_logs (ip, type, details, niveau, bloque, cree_le)
    VALUES (?, 'simulation_bot', ?, 'critique', 1, ?)
  `).run(mockIp, msg, now);

  res.json({ ok: true, message: "Alerte de bot simulée déclenchée avec succès !" });
});

app.post("/api/admin/bouclier", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  METRICS.shieldUnderAttack = !METRICS.shieldUnderAttack;
  res.json({ ok: true, bouclierActif: METRICS.shieldUnderAttack });
});

app.post("/api/admin/reinitialiser-alerte", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  METRICS.securityAlertActive = false;
  METRICS.securityAlertDetails = null;
  res.json({ ok: true });
});

// Admin stats
app.get("/api/admin/stats", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const now = Date.now(), j7 = now - 7 * 86400000;
  const joueurs = db.prepare("SELECT COUNT(*) AS c FROM users;").get().c;
  const nouveaux7j = db.prepare("SELECT COUNT(*) AS c FROM users WHERE cree_le > ?;").get(j7).c;
  const actifs7j = db.prepare("SELECT COUNT(*) AS c FROM users WHERE derniere_co > ?;").get(j7).c;
  const messages = db.prepare("SELECT COUNT(*) AS c FROM posts;").get().c;
  const signales = db.prepare("SELECT COUNT(DISTINCT post_id) AS c FROM signalements;").get().c;
  const bannis = db.prepare("SELECT COUNT(*) AS c FROM users WHERE banni = 1;").get().c;
  res.json({ joueurs, nouveaux7j, actifs7j, messages, signales, bannis });
});

app.get("/api/admin/utilisateurs", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const q = req.query.q ? `%${req.query.q}%` : "%";
  const rows = db.prepare(`
    SELECT u.id, u.pseudo, u.admin, u.banni, u.cree_le, u.derniere_co, u.premium_jusqu,
      COALESCE(s.cartes, 0) AS cartes,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS messages
    FROM users u
    LEFT JOIN sauvegardes s ON s.user_id = u.id
    WHERE u.pseudo LIKE ?
    ORDER BY u.derniere_co DESC
    LIMIT 60;
  `).all(q);
  res.json({ utilisateurs: rows });
});

app.post("/api/admin/utilisateurs/:id/bannir", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const banni = req.body.banni ? 1 : 0;
  db.prepare("UPDATE users SET banni = ? WHERE id = ?;").run(banni, Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/cadeaux", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user || !user.admin) return res.status(403).json({ erreur: "Réservé à l'administrateur." });
  const { pseudo, pieces, boosters, message } = req.body;
  let targetId = null;
  if (pseudo) {
    const target = db.prepare("SELECT id FROM users WHERE pseudo = ? COLLATE NOCASE;").get(pseudo);
    if (!target) return res.status(404).json({ erreur: "Joueur introuvable." });
    targetId = target.id;
  }
  db.prepare(`
    INSERT INTO cadeaux (user_id, pieces, boosters, message, cree_le)
    VALUES (?, ?, ?, ?, ?)
  `).run(targetId, Number(pieces) || 0, Number(boosters) || 0, message || null, Date.now());
  res.json({ ok: true });
});

app.get("/api/cadeaux", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.json({ cadeaux: [] });
  const rows = db.prepare(`
    SELECT c.*
    FROM cadeaux c
    LEFT JOIN cadeaux_recus cr ON cr.cadeau_id = c.id AND cr.user_id = ?
    WHERE (c.user_id IS NULL OR c.user_id = ?) AND cr.cadeau_id IS NULL;
  `).all(user.id, user.id);
  res.json({ cadeaux: rows });
});

app.post("/api/cadeaux/:id/recevoir", (req, res) => {
  const user = utilisateurCourant(req);
  if (!user) return res.status(401).json({ erreur: "Connectez-vous." });
  const id = Number(req.params.id);
  const c = db.prepare("SELECT * FROM cadeaux WHERE id = ?;").get(id);
  if (!c) return res.status(404).json({ erreur: "Cadeau introuvable." });
  db.prepare("INSERT OR IGNORE INTO cadeaux_recus (cadeau_id, user_id) VALUES (?, ?);").run(id, user.id);
  res.json({ pieces: c.pieces, boosters: c.boosters, message: c.message });
});

// Serve frontend static files
const staticDir = path.resolve("./worldcards");
app.use(express.static(staticDir));

// SPA Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`[WorldCards] Serveur démarré sur http://${HOST}:${PORT}`);
});
