-- ============================================================
-- Matches table for real-time matchmaking
-- Run this SQL in the InsForge dashboard → SQL Editor
-- ============================================================

-- Active matches table
create table if not exists public.matches (
  id text primary key,                            -- UUID match ID (same as on-chain matchId)
  creator_wallet text not null,                    -- wallet address of the creator
  creator_username text,                           -- optional display name
  opponent_wallet text,                            -- null until opponent joins
  opponent_username text,                          -- optional display name
  entry_fee numeric default 0.1,                   -- SOL stake amount
  status text not null default 'waiting',          -- waiting | locked | racing | completed | cancelled
  track_id text,                                   -- selected track (set when race starts)
  difficulty text default 'medium',                -- easy | medium | hard
  winner_wallet text,                              -- set after race completes
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.matches enable row level security;

-- Policies (permissive for MVP — all can read, creators can update their own matches)
create policy "Matches are viewable by everyone"
  on matches for select
  using (true);

create policy "Anyone can create a match"
  on matches for insert
  with check (true);

create policy "Match participants can update"
  on matches for update
  using (true);

create policy "Creator can delete own match"
  on matches for delete
  using (true);

-- Enable Realtime on this table so clients get instant updates
alter publication supabase_realtime add table matches;
