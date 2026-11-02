-- Run once in Supabase SQL Editor, using the project owner account.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, full_name text not null default '',
 role text not null default 'viewer' check (role in ('admin','viewer')),
 active boolean not null default true, created_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create function public.is_active() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true)
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true and role='admin')
$$;
revoke all on function public.is_active() from public; grant execute on function public.is_active() to authenticated;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- No browser insert/update/delete policies for roles; only the protected server function may manage accounts.
create function public.protect_last_admin() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(72898111);
 if old.role='admin' and old.active and (new.role<>'admin' or not new.active) and not exists(select 1 from public.profiles where id<>old.id and role='admin' and active) then raise exception 'Admin aktif terakhir tidak dapat dinonaktifkan'; end if;
 return new;
end $$;
create trigger last_admin before update on public.profiles for each row execute procedure public.protect_last_admin();

create table public.datasets (
 id uuid primary key, label text not null, period date not null,
 manifest jsonb not null, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.app_state (
 id integer primary key check(id=1), active_dataset uuid references public.datasets(id),
 updated_at timestamptz not null default now()
);
insert into public.app_state(id) values(1);
alter table public.datasets enable row level security;
alter table public.app_state enable row level security;
create policy dataset_read on public.datasets for select to authenticated using(public.is_active());
create policy state_read on public.app_state for select to authenticated using(public.is_active());
-- Upload and activation are one transaction, after every object has been written.
create function public.publish_dataset(p_id uuid,p_label text,p_period date,p_manifest jsonb,p_expected uuid)
returns void language plpgsql security definer set search_path=public,storage as $$
declare current_id uuid; object_path text; paths jsonb;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
 select active_dataset into current_id from public.app_state where id=1 for update;
 if current_id is distinct from p_expected then raise exception 'Data telah diperbarui admin lain. Muat ulang sebelum menerbitkan.'; end if;
 if length(p_label)>160 or p_period is null then raise exception 'Periode atau label tidak valid'; end if;
 paths := p_manifest->'paths';
 if jsonb_typeof(paths) is distinct from 'array' or jsonb_array_length(paths)<6 then raise exception 'Manifest tidak lengkap'; end if;
 for object_path in select jsonb_array_elements_text(paths) loop
   if object_path not like p_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='sbcr-data' and name=object_path) then raise exception 'File dataset belum lengkap'; end if;
 end loop;
 insert into public.datasets(id,label,period,manifest,created_by) values(p_id,p_label,p_period,p_manifest,auth.uid());
 update public.app_state set active_dataset=p_id,updated_at=now() where id=1;
end $$;
revoke all on function public.publish_dataset(uuid,text,date,jsonb,uuid) from public;
grant execute on function public.publish_dataset(uuid,text,date,jsonb,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('sbcr-data','sbcr-data',false,52428800,array['application/json']),
 ('sbcr-raw','sbcr-raw',false,52428800,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy data_read on storage.objects for select to authenticated using(bucket_id='sbcr-data' and public.is_active());
create policy data_insert on storage.objects for insert to authenticated with check(bucket_id='sbcr-data' and public.is_admin());
create policy raw_read on storage.objects for select to authenticated using(bucket_id='sbcr-raw' and public.is_admin());
create policy raw_insert on storage.objects for insert to authenticated with check(bucket_id='sbcr-raw' and public.is_admin());
-- Published objects are immutable: no browser update/delete policies.
-- First admin: create the Auth user manually, then replace this email and run:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';
