create extension if not exists pgcrypto;

create table branches (
  code text primary key check (code in ('MK', 'STP', 'WS')),
  label text not null
);

create table teacher_groups (
  code text primary key,
  branch_code text not null references branches(code),
  label text not null,
  unique (code, branch_code)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text not null,
  branch_code text not null,
  group_code text not null,
  status text not null default 'active' check (status in ('active', 'stopped')),
  profile jsonb not null default '{}'::jsonb,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_code, branch_code) references teacher_groups(code, branch_code),
  unique (group_code, source_ref)
);

create table attendance_events (
  student_id uuid not null references students(id),
  attendance_date date not null,
  event_code text not null,
  is_active boolean not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, attendance_date, event_code)
);

create table student_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  message_date date not null,
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table student_activity (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  action text not null check (action in ('enrol', 'stop', 'restore', 'profile_update')),
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into branches (code, label) values
  ('MK', 'MK'),
  ('STP', 'STP'),
  ('WS', 'WS');

insert into teacher_groups (code, branch_code, label) values
  ('MK HAPPY', 'MK', 'HAPPY'),
  ('MK QIAO EN', 'MK', 'QIAO EN'),
  ('MK WEN XUAN', 'MK', 'WEN XUAN'),
  ('巧恩 STP', 'STP', '巧恩'),
  ('PS STP', 'STP', 'PS'),
  ('SY STP', 'STP', 'SY'),
  ('WS HUILING', 'WS', 'HUILING'),
  ('WS JIA WEN', 'WS', 'JIA WEN'),
  ('WS MIXIN', 'WS', 'MIXIN');

create index students_branch_group_status_name_idx
  on students (branch_code, group_code, status, name);
create index attendance_events_attendance_date_idx
  on attendance_events (attendance_date);
create index student_messages_student_date_idx
  on student_messages (student_id, message_date);
