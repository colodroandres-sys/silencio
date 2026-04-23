-- Stillova — Migration: índices de rendimiento para escala
-- Ejecutar en Supabase SQL Editor
-- Estimado para 10K usuarios activos con múltiples meditaciones cada uno

-- meditations: query principal de biblioteca
-- SELECT * FROM meditations WHERE clerk_id = ? AND is_saved = TRUE ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS idx_meditations_clerk_saved
  ON meditations (clerk_id, is_saved, created_at DESC);

-- meditations: query de stats/recents (sin filtro is_saved)
-- SELECT duration, created_at FROM meditations WHERE clerk_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_meditations_clerk_created
  ON meditations (clerk_id, created_at DESC);

-- users: la columna clerk_id es la clave de todas las búsquedas
-- Si no tiene ya un UNIQUE INDEX (a veces Supabase lo crea, a veces no)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id
  ON users (clerk_id);

-- monthly_usage: el upsert usa onConflict: 'clerk_id,month'
-- Esto requiere un UNIQUE constraint, que en Supabase implica un índice.
-- Si falla con "already exists", es porque ya estaba creado — ignorar el error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_usage_clerk_month
  ON monthly_usage (clerk_id, month);
