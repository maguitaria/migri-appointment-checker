CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Oulu',
  flow TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_unique_active
ON subscriptions(email, location, flow);

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  username TEXT,
  location TEXT NOT NULL DEFAULT 'Oulu',
  flow TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(chat_id, location, flow)
);
