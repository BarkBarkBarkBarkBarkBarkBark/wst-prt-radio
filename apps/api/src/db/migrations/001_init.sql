-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Station settings (single row)
CREATE TABLE IF NOT EXISTS station_settings (
  id TEXT PRIMARY KEY,
  station_name TEXT NOT NULL DEFAULT 'wstprtradio',
  azuracast_base_url TEXT NOT NULL DEFAULT '',
  azuracast_public_stream_url TEXT NOT NULL DEFAULT '',
  azuracast_public_api_url TEXT NOT NULL DEFAULT '',
  azuracast_api_key_encrypted TEXT NOT NULL DEFAULT '',
  cloudflare_account_id TEXT NOT NULL DEFAULT '',
  cloudflare_live_input_id TEXT NOT NULL DEFAULT '',
  cloudflare_api_token_encrypted TEXT NOT NULL DEFAULT '',
  default_stream_mode TEXT NOT NULL DEFAULT 'autodj',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Destinations (RTMP/SRT/Discord outputs)
CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  url TEXT NOT NULL DEFAULT '',
  stream_key_encrypted TEXT,
  srt_passphrase_encrypted TEXT,
  metadata_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Live sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  ended_at TEXT,
  initiated_by_user_id TEXT,
  cloudflare_live_input_id TEXT,
  azuracast_streamer_name TEXT,
  notes_json TEXT
);

-- Webhook events (inbound from Cloudflare / AzuraCast)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
