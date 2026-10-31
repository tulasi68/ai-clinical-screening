-- P0 consent evidence ledger for AI Clinical Screening.
-- Apply this migration in the linked Supabase project's SQL editor before
-- deploying code that requires the ledger. Keep service-role credentials server-side.

create extension if not exists pgcrypto;

create table if not exists public.screening_consent_events (
  id uuid primary key default gen_random_uuid(),
  screening_id text not null,
  event_type text not null check (event_type in ('granted', 'withdrawn')),
  purpose text not null,
  notice_version text not null,
  occurred_at timestamptz not null default now(),
  language text not null default 'en',
  method text not null,
  channel text not null,
  actor_type text not null default 'patient',
  evidence jsonb not null default '{}'::jsonb
);

create index if not exists screening_consent_events_lookup_idx
  on public.screening_consent_events (screening_id, purpose, occurred_at desc, id desc);

alter table public.screening_consent_events enable row level security;
revoke all on public.screening_consent_events from anon, authenticated;
grant select, insert on public.screening_consent_events to service_role;

create or replace function public.prevent_screening_consent_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'screening consent evidence is append-only';
end;
$$;

drop trigger if exists screening_consent_events_no_update on public.screening_consent_events;
create trigger screening_consent_events_no_update
before update or delete on public.screening_consent_events
for each row execute function public.prevent_screening_consent_event_mutation();

-- Preserve affirmative consent already captured by the previous application
-- version. This backfill is idempotent and retains the original timestamp.
insert into public.screening_consent_events
  (screening_id, event_type, purpose, notice_version, occurred_at, language, method, channel, actor_type, evidence)
select
  s.screening_id,
  'granted',
  coalesce(s.patient #>> '{screening_consent,purpose}', 'pre_consultation_clinical_screening_and_sharing_with_treating_clinic'),
  coalesce(s.patient #>> '{screening_consent,notice_version}', 'screening-notice-2026-10-v1'),
  coalesce(nullif(s.patient #>> '{screening_consent,at}', '')::timestamptz, s.created_at, now()),
  coalesce(s.patient #>> '{screening_consent,language}', 'en'),
  coalesce(s.patient #>> '{screening_consent,method}', 'legacy_affirmative_checkbox'),
  coalesce(s.patient #>> '{screening_consent,channel}', 'patient_screening_app'),
  'patient',
  jsonb_build_object('migrated_from_session_snapshot', true)
from public.screening_sessions s
where jsonb_typeof(s.patient #> '{screening_consent}') = 'object'
  and (s.patient #>> '{screening_consent,granted}') = 'true'
  and not exists (
    select 1
    from public.screening_consent_events e
    where e.screening_id = s.screening_id
      and e.event_type = 'granted'
      and e.purpose = coalesce(s.patient #>> '{screening_consent,purpose}', 'pre_consultation_clinical_screening_and_sharing_with_treating_clinic')
      and e.notice_version = coalesce(s.patient #>> '{screening_consent,notice_version}', 'screening-notice-2026-10-v1')
  );
