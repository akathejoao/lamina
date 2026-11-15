create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_salt text not null,
  password_hash text not null,
  wrap_salt text not null,
  wrapped_dek text not null,
  terms_version text not null,
  privacy_version text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists ledgers (
  user_id text primary key references users (id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
