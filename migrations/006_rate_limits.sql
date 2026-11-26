create table if not exists rate_hits (
  key text not null,
  bucket bigint not null,
  n integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, bucket)
);

create index if not exists rate_hits_updated_idx on rate_hits (updated_at);
