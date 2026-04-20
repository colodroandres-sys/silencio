-- Stillova — Migration: crear tabla guest_usage
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS guest_usage (
  id        BIGSERIAL PRIMARY KEY,
  ip        TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultar por IP rápido (límite por usuario)
CREATE INDEX IF NOT EXISTS guest_usage_ip_idx ON guest_usage (ip, timestamp DESC);

-- Sin RLS — solo acceso desde service_role (backend)
-- No exponer este endpoint en cliente
