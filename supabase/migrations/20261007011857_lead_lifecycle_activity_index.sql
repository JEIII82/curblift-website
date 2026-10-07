create index if not exists idx_activity_events_lead_lifecycle on public.activity_events (entity_id, created_at desc) where entity_type='lead';
