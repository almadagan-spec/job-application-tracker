-- Run this once in your Supabase project's SQL Editor.
-- It creates the tables, security rules, and storage bucket the app needs.

-- One row per signed-up user, extending Supabase's built-in auth.users table.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  desired_role text,
  resume_file_path text,
  resume_text text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Automatically creates a profile row the moment someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One row per company the user is applying to.
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null,
  linkedin_verified boolean not null default false,
  verification_note text,
  about text,
  new_resume text,
  cover_letter text,
  status text not null default 'received'
    check (status in ('received', 'under_review', 'denied', 'interview')),
  created_at timestamptz not null default now()
);

alter table public.applications enable row level security;

create policy "Users can view own applications" on public.applications
  for select using (auth.uid() = user_id);
create policy "Users can insert own applications" on public.applications
  for insert with check (auth.uid() = user_id);
create policy "Users can update own applications" on public.applications
  for update using (auth.uid() = user_id);
create policy "Users can delete own applications" on public.applications
  for delete using (auth.uid() = user_id);

-- Storage bucket for uploaded resume files (private -- only the owner can read theirs).
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Users can upload own resume" on storage.objects
  for insert with check (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can read own resume" on storage.objects
  for select using (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can replace own resume" on storage.objects
  for update using (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
