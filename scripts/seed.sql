INSERT OR REPLACE INTO workspaces
  (id, name, plan, seats, restricted_use_acknowledged_at, billing_customer_reference, created_at, updated_at)
VALUES
  ('workspace_northstar', 'Northstar Strategy', 'team', 5, '2026-07-01T14:00:00Z', 'local_simulator_northstar', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO workspace_records
  (id, workspace_id, user_email, record_type, title, payload, status, created_at, updated_at)
VALUES
  ('saved_001', 'workspace_northstar', 'customer@liquidityradar.local', 'saved_search', 'Southeast healthcare exits', '{"industry":"Healthcare","region":"Southeast","minimum_confidence":65}', 'active', datetime('now'), datetime('now')),
  ('saved_002', 'workspace_northstar', 'customer@liquidityradar.local', 'saved_search', 'New England founders · $25M+', '{"region":"New England","minimum_remaining":25000000}', 'active', datetime('now'), datetime('now')),
  ('alert_001', 'workspace_northstar', 'customer@liquidityradar.local', 'alert', 'New $25M+ event in Raleigh–Durham', '{"frequency":"immediate","channel":"in_app"}', 'active', datetime('now'), datetime('now')),
  ('report_001', 'workspace_northstar', 'customer@liquidityradar.local', 'report', 'Boston capital report', '{"type":"regional","status":"ready"}', 'active', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO api_keys
  (id, workspace_id, name, key_prefix, key_hash, created_at, updated_at)
VALUES
  ('key_demo', 'workspace_northstar', 'Local demonstration key', 'lr_demo_', 'local-development-only', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO audit_logs
  (id, workspace_id, actor_email, action, entity_type, entity_id, reason, request_id, metadata, created_at)
VALUES
  ('audit_001', 'workspace_northstar', 'admin@liquidityradar.local', 'workspace.seeded', 'workspace', 'workspace_northstar', 'Local demonstration environment initialized', 'setup', '{"fictional_data":true}', datetime('now'));

