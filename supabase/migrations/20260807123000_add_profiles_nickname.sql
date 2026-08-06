-- Migration: Add nickname column to profiles
-- Run this in your Supabase SQL editor or apply with your migration tooling.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text;

-- Optionally: you can set a NOT NULL constraint or default later if required.
