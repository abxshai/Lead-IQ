-- 0018_email_provider_bitscale.sql
-- ---------------------------------------------------------------------------
-- Two features:
--   (1) Switchable LLM provider (Groq / Together.ai) — a provider column on
--       campaigns (the model id already lives in campaigns.model).
--   (2) Bitscale integration — an email enrichment column on leads, plus a
--       staging table for the Bitscale Webhook/Export receiver. Bitscale's
--       run/enrich API is Enterprise-gated (workspace is on Booster) and has
--       no read-rows endpoint, so we ingest via a per-row webhook it pushes.
--
-- Apply via the Supabase SQL editor or MCP (project convention). 0007 stays
-- reserved for M-AG2 pgvector.
-- ---------------------------------------------------------------------------

-- (1) LLM provider per campaign. Default 'groq' so every existing campaign is
--     unchanged. The worker reads this to pick the OpenAI-compatible base URL.
alter table public.campaigns
  add column if not exists provider text not null default 'groq'
    check (provider in ('groq', 'together'));

-- (2a) Enriched email on the lead. Nullable; carried in from any import source
--      that provides it (a Bitscale grid's Email column) and surfaced in the
--      campaign table, /leads, and CSV exports.
alter table public.leads
  add column if not exists email text;

-- (2b) Recreate the /leads deduped snapshot so `l.*` picks up the new email
--      column. Body is IDENTICAL to 0017 (same dedup key, same tiebreak), so
--      /leads + filters + export stay byte-for-byte unchanged aside from the
--      added email column. refresh_distinct_leads() (0017) is unchanged and
--      keeps working (it references the MV by name).
drop materialized view if exists public.distinct_leads;

create materialized view public.distinct_leads as
select distinct on (dedupe_key)
  l.*,
  c.name as campaign_name
from public.leads l
join public.campaigns c on c.id = l.campaign_id
cross join lateral (
  select coalesce(
    nullif(
      lower(
        regexp_replace(
          regexp_replace(l.default_profile_url, '^https?://(www\.)?', ''),
          '/+$', ''
        )
      ),
      ''
    ),
    'id:' || l.id::text
  ) as dedupe_key
) k
where l.status = 'processed'
order by dedupe_key, l.processed_at desc nulls last, l.id
with data;

create unique index distinct_leads_id_uidx
  on public.distinct_leads (id);
create index distinct_leads_processed_at_idx
  on public.distinct_leads (processed_at desc);
create index distinct_leads_campaign_idx
  on public.distinct_leads (campaign_id);
create index distinct_leads_temperature_idx
  on public.distinct_leads (temperature);

grant select on public.distinct_leads to authenticated, service_role;

-- (2c) Bitscale webhook staging table. The receiver (POST /api/bitscale/webhook,
--      token-authed, runs as service_role) drops one row per Bitscale grid row
--      here, grouped by `batch` (a name the webhook payload supplies). The
--      /scrape page lists batches and pushes a batch into the campaign wizard.
create table if not exists public.bitscale_inbox (
  id                  uuid primary key default gen_random_uuid(),
  batch               text not null,
  default_profile_url text,
  full_name           text,
  first_name          text,
  last_name           text,
  company_name        text,
  title               text,
  summary             text,
  title_description   text,
  location            text,
  email               text,
  raw                 jsonb,
  received_at         timestamptz not null default now()
);

create index if not exists bitscale_inbox_batch_idx
  on public.bitscale_inbox (batch);
create index if not exists bitscale_inbox_received_at_idx
  on public.bitscale_inbox (received_at desc);

alter table public.bitscale_inbox enable row level security;

-- Single shared-workspace model: any authenticated user can read/manage the
-- inbox. The webhook writer uses the service role (bypasses RLS); the anon key
-- can't touch it.
drop policy if exists bitscale_inbox_authenticated_all on public.bitscale_inbox;
create policy bitscale_inbox_authenticated_all
  on public.bitscale_inbox
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.bitscale_inbox to authenticated;
grant all on public.bitscale_inbox to service_role;
