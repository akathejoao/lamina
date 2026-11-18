create table if not exists sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

create index if not exists sessions_expires_idx on sessions (expires_at);
