-- Stillova — Migration sesión 13 (2026-04-24)
-- 1) Activar RLS en todas las tablas públicas (defensa en profundidad)
-- 2) Reemplazar función increment_usage huérfana por versión atómica con créditos

-- =======================================================================
-- PARTE 1 — Row Level Security
-- =======================================================================
-- Por diseño de Supabase, SUPABASE_SERVICE_ROLE_KEY bypassa RLS siempre.
-- Activar RLS sin policies = anon y authenticated quedan DENEGADOS por
-- defecto, pero el backend (que usa service_role) sigue funcionando igual.
-- Defensa en profundidad: si alguna vez filtra la anon key, nadie puede
-- leer ni escribir las tablas.

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_usage      ENABLE ROW LEVEL SECURITY;
ALTER TABLE buzon_messages   ENABLE ROW LEVEL SECURITY;

-- Nota: NO usar FORCE ROW LEVEL SECURITY — eso bloquearía también a
-- service_role. La forma correcta es ENABLE sólo.

-- =======================================================================
-- PARTE 2 — increment_usage atómico
-- =======================================================================
-- El código en api/_limits.js hace read+upsert (no atómico). Dos requests
-- concurrentes del mismo usuario pueden perder incrementos.
-- Esta RPC consolida en un único INSERT ON CONFLICT DO UPDATE atómico.

-- Drop la versión antigua huérfana (solo aceptaba p_clerk_id, p_month)
DROP FUNCTION IF EXISTS public.increment_usage(text, text);

CREATE OR REPLACE FUNCTION public.increment_usage_atomic(
  p_clerk_id TEXT,
  p_month    TEXT,
  p_credits  INT
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO monthly_usage (clerk_id, month, count)
  VALUES (p_clerk_id, p_month, p_credits)
  ON CONFLICT (clerk_id, month)
  DO UPDATE SET count = monthly_usage.count + EXCLUDED.count
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;

-- Permisos: la función por defecto hereda permisos del invoker.
-- service_role tiene bypassrls y permiso EXECUTE sobre funciones public.
-- No requerimos GRANT adicional.
