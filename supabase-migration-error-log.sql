-- Stillova — Migration: tabla error_log para tracking de errores 5xx en producción
-- Cualquier endpoint puede llamar al helper api/_logError.js para registrar fallos.

CREATE TABLE IF NOT EXISTS error_log (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint    TEXT NOT NULL,
  status      INT,
  message     TEXT,
  user_email  TEXT,
  meta        JSONB,
  resolved    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS error_log_created_idx
  ON error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS error_log_unresolved_idx
  ON error_log (created_at DESC) WHERE resolved = FALSE;

-- Sin RLS: acceso solo desde service_role.
