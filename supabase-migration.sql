-- Stillova — Migration: add emotion_tag and intent to meditations
-- Run this in Supabase SQL Editor

ALTER TABLE meditations
  ADD COLUMN IF NOT EXISTS emotion_tag TEXT,
  ADD COLUMN IF NOT EXISTS intent      TEXT;

-- emotion_tag: 'ansiedad' | 'sueno' | 'claridad' | 'liberacion' | 'enfoque' | null
-- intent:      'soltar'   | 'entender' | 'calmar'                            | null
