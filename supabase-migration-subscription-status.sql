-- Stillova — Migration: add subscription_status to users
-- Run this in Supabase SQL Editor before deploying webhook changes

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- subscription_status values: 'active' | 'past_due' | 'unpaid'
-- past_due = payment failed, Stripe retrying → access suspended
-- active   = normal access
