-- ============================================================
-- Chat table schema for global lobby and groups
-- Run this SQL in the InsForge dashboard → SQL Editor
-- ============================================================

-- Channels / Groups table
create table if not exists public.chat_channels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by_wallet text,        -- null for system channels
    created_at timestamptz default now()
);

-- Insert the default Global Lobby channel if it doesn't exist
insert into public.chat_channels (id, name, created_by_wallet)
select '00000000-0000-0000-0000-000000000000'::uuid, 'Global Lobby', null
where not exists (
    select 1 from public.chat_channels where id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- Messages table
create table if not exists public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid references public.chat_channels(id) on delete cascade not null,
    sender_wallet text not null,
    sender_username text,
    content text not null,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

-- Policies for Channels
create policy "Channels are viewable by everyone"
    on public.chat_channels for select using (true);
create policy "Anyone can create a channel"
    on public.chat_channels for insert with check (true);

-- Policies for Messages
create policy "Messages are viewable by everyone"
    on public.chat_messages for select using (true);
create policy "Anyone can insert a message"
    on public.chat_messages for insert with check (true);

-- Enable Realtime on these tables so clients get instant updates
alter publication supabase_realtime add table chat_channels;
alter publication supabase_realtime add table chat_messages;
