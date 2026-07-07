-- Migration 003: answer-edit session log + admin demo mode
-- Run in Supabase SQL editor after 002_add_username_to_profiles.sql

alter table public.ideas
  add column answer_edit_log jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column demo_mode boolean not null default false;
