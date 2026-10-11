-- Base de données WorldCards (Cloudflare D1)
-- Les tables sont créées automatiquement par functions/api au premier appel ; ce fichier sert de référence.

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
  cgu_le INTEGER NOT NULL
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

-- Cadeaux envoyés par l'administrateur (user_id NULL = tous les joueurs)
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
