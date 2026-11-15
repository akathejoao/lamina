alter table users add column if not exists access_status text not null default 'cortesia';
alter table users add column if not exists admin_note text not null default '';
