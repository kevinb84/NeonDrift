-- Drop existing table if needed (be careful in prod)
drop table if exists public.profiles;

-- Profiles table (Wallet Centric)
create table public.profiles (
  wallet_address text primary key,
  username text,
  high_score bigint default 0,
  games_played int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies (Permissive for MVP demo - in effective prod use signed messages)
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( true ); -- trusting client for MVP demo phase 1

create policy "Users can update their own profile."
  on profiles for update
  using ( true ); -- trusting client for MVP demo phase 1

-- Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table profiles;
