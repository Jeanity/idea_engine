-- Migration 002: add username to profiles
-- Run in Supabase SQL editor after 001_initial_schema.sql

alter table public.profiles
  add column username text
    constraint username_length check (username is null or char_length(username) between 3 and 30)
    constraint username_chars  check (username is null or username ~ '^[a-zA-Z0-9_]+$');

-- Case-insensitive unique index; nulls are excluded so multiple null rows are fine
create unique index profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;
