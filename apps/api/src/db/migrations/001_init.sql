CREATE TABLE IF NOT EXISTS stream_state (
  id TEXT PRIMARY KEY,
  station_state TEXT NOT NULL CHECK (station_state IN ('closed', 'open', 'live', 'blocked', 'degraded')),
  live_session_id TEXT,
  broadcaster_peer_id TEXT,
  broadcaster_display_name TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_peers (
  peer_id TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  peer_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('broadcaster', 'listener')),
  display_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('active', 'ended')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  ended_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
