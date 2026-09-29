create table if not exists puzzles (
  id text primary key,
  title text not null,
  image_a text not null,
  image_b text not null,
  status text not null check (status in ('DRAFT', 'READY', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  definition jsonb not null,
  constraint puzzle_has_seven_differences check (jsonb_array_length(definition->'differences') = 7)
);

create table if not exists game_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null
);

create index if not exists game_events_session_idx on game_events ((payload->>'sessionId'), occurred_at);
create unique index if not exists game_events_provider_event_idx
  on game_events ((payload->>'providerEventId'))
  where payload ? 'providerEventId';

comment on table game_events is 'Append-only audit log. Active V0 state remains in one API process.';
