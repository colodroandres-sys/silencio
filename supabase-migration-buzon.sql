-- Stillova — Migration: crear tabla buzon_messages
-- Ejecutar en Supabase SQL Editor ANTES de redeploy con el fix de buzon.js
-- Contexto: la tabla nunca se creó y el endpoint /api/buzon crasheaba silenciosamente

CREATE TABLE IF NOT EXISTS buzon_messages (
  id         BIGSERIAL PRIMARY KEY,
  clerk_id   TEXT,
  email      TEXT,
  category   TEXT NOT NULL DEFAULT 'otro',
  message    TEXT NOT NULL,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS buzon_messages_created_idx
  ON buzon_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS buzon_messages_clerk_idx
  ON buzon_messages (clerk_id, created_at DESC);

-- Sin RLS: acceso solo desde service_role (backend). No exponer anon.
