INSERT OR REPLACE INTO workspaces
  (id, name, plan, seats, home_region_id, restricted_use_acknowledged_at, billing_customer_reference, created_at, updated_at)
VALUES
  ('workspace_northstar', 'Northstar Strategy', 'team', 5, 'montgomery-county-md', '2026-07-01T14:00:00Z', 'local_simulator_northstar', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO locations
  (id, slug, name, geographic_type, parent_location_id, state_code, metro_name, county_name, city_name, longitude, latitude, normalized_lookup, metadata_source, created_at, updated_at)
VALUES
  ('region_dc_metro', 'washington-arlington-alexandria', 'Washington–Arlington–Alexandria Metro', 'metro', NULL, 'DC', 'Washington–Arlington–Alexandria', NULL, 'Washington', -77.04, 38.91, 'washington arlington alexandria dc virginia maryland', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_montgomery', 'montgomery-county-md', 'Montgomery County, Maryland', 'county', 'region_maryland', 'MD', 'Washington–Arlington–Alexandria', 'Montgomery County', 'Rockville', -77.15, 39.08, 'montgomery county maryland rockville gaithersburg washington metro', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_maryland', 'maryland', 'Maryland', 'state', NULL, 'MD', 'Baltimore–Columbia–Towson', NULL, 'Baltimore', -76.64, 39.05, 'maryland baltimore washington', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_nova', 'northern-virginia', 'Northern Virginia', 'subregion', 'region_dc_metro', 'VA', 'Washington–Arlington–Alexandria', 'Arlington County', 'Arlington', -77.11, 38.88, 'northern virginia arlington fairfax washington metro', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_new_york', 'new-york', 'New York Metro', 'metro', NULL, 'NY', 'New York–Newark–Jersey City', 'New York County', 'New York', -74.01, 40.71, 'new york newark jersey city', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_new_orleans', 'new-orleans-metairie', 'New Orleans–Metairie Metro', 'metro', NULL, 'LA', 'New Orleans–Metairie', 'Orleans Parish', 'New Orleans', -90.07, 29.95, 'new orleans metairie louisiana', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_boston', 'boston-cambridge', 'Boston–Cambridge Metro', 'metro', NULL, 'MA', 'Boston–Cambridge–Newton', 'Suffolk County', 'Boston', -71.06, 42.36, 'boston cambridge massachusetts', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_austin', 'austin-round-rock', 'Austin–Round Rock Metro', 'metro', NULL, 'TX', 'Austin–Round Rock', 'Travis County', 'Austin', -97.74, 30.27, 'austin round rock texas', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_raleigh', 'raleigh-durham', 'Raleigh–Durham', 'metro', NULL, 'NC', 'Raleigh–Cary', 'Wake County', 'Raleigh', -78.64, 35.78, 'raleigh durham north carolina', 'fictional_demo', datetime('now'), datetime('now')),
  ('region_san_diego', 'san-diego-carlsbad', 'San Diego–Carlsbad', 'metro', NULL, 'CA', 'San Diego–Chula Vista–Carlsbad', 'San Diego County', 'San Diego', -117.16, 32.72, 'san diego carlsbad california', 'fictional_demo', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO people
  (id, slug, display_name, normalized_name, primary_role, biography, profile_status, publication_status, privacy_status, primary_location_id, source_count, last_meaningful_event_at, created_at, updated_at)
VALUES
  ('person_001', 'amara-voss', 'Amara Voss', 'amara voss', 'Founder & CEO', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_dc_metro', 7, '2026-07-22', datetime('now'), datetime('now')),
  ('person_002', 'theo-navarro', 'Theo Navarro', 'theo navarro', 'Co-founder', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_montgomery', 8, '2026-07-21', datetime('now'), datetime('now')),
  ('person_003', 'mina-chen', 'Mina Chen', 'mina chen', 'Executive chair', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_maryland', 9, '2026-07-20', datetime('now'), datetime('now')),
  ('person_004', 'julian-mercer', 'Julian Mercer', 'julian mercer', 'Founder & director', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_nova', 10, '2026-07-19', datetime('now'), datetime('now')),
  ('person_005', 'sofia-okafor', 'Sofia Okafor', 'sofia okafor', 'Managing partner', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_new_york', 6, '2026-07-18', datetime('now'), datetime('now')),
  ('person_006', 'darius-reyes', 'Darius Reyes', 'darius reyes', 'Chief scientific officer', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_new_orleans', 5, '2026-07-17', datetime('now'), datetime('now')),
  ('person_007', 'elena-park', 'Elena Park', 'elena park', 'Founder & CEO', 'Fictional biotechnology demonstration profile.', 'active', 'published', 'standard', 'region_montgomery', 11, '2026-07-16', datetime('now'), datetime('now')),
  ('person_008', 'marcus-bennett', 'Marcus Bennett', 'marcus bennett', 'Co-founder', 'Fictional demonstration profile.', 'active', 'published', 'standard', 'region_austin', 7, '2026-07-15', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO person_geographic_relationships
  (id, person_id, location_id, relationship_type, evidence_claim_id, relationship_date, confidence, public_visibility, created_at, updated_at)
VALUES
  ('pgr_001', 'person_001', 'region_dc_metro', 'primary_economic_location', 'geo_primary_1', '2026-06-20', 92, 1, datetime('now'), datetime('now')),
  ('pgr_002', 'person_001', 'region_montgomery', 'investment_activity', 'geo_investment_1', '2026-06-21', 78, 1, datetime('now'), datetime('now')),
  ('pgr_003', 'person_002', 'region_montgomery', 'current_company', 'geo_company_2', '2026-06-20', 94, 1, datetime('now'), datetime('now')),
  ('pgr_004', 'person_003', 'region_maryland', 'liquidity_event', 'geo_event_3', '2026-06-19', 86, 1, datetime('now'), datetime('now')),
  ('pgr_005', 'person_004', 'region_nova', 'primary_economic_location', 'geo_primary_4', '2026-06-18', 91, 1, datetime('now'), datetime('now')),
  ('pgr_006', 'person_005', 'region_new_york', 'family_office', 'geo_family_5', '2026-06-17', 83, 1, datetime('now'), datetime('now')),
  ('pgr_007', 'person_006', 'region_new_orleans', 'philanthropic_activity', 'geo_philanthropy_6', '2026-06-16', 74, 1, datetime('now'), datetime('now')),
  ('pgr_008', 'person_007', 'region_montgomery', 'primary_economic_location', 'geo_primary_7', '2026-06-15', 97, 1, datetime('now'), datetime('now')),
  ('pgr_009', 'person_007', 'region_montgomery', 'current_company', 'geo_company_7', '2026-06-15', 95, 1, datetime('now'), datetime('now')),
  ('pgr_010', 'person_007', 'region_montgomery', 'liquidity_event', 'geo_event_7', '2026-06-15', 88, 1, datetime('now'), datetime('now')),
  ('pgr_011', 'person_007', 'region_dc_metro', 'board_affiliation', 'geo_board_7', '2026-06-14', 77, 1, datetime('now'), datetime('now')),
  ('pgr_012', 'person_008', 'region_austin', 'primary_economic_location', 'geo_primary_8', '2026-06-13', 90, 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO workspace_records
  (id, workspace_id, user_email, record_type, title, payload, region_id, status, created_at, updated_at)
VALUES
  ('saved_001', 'workspace_northstar', 'customer@liquidityradar.local', 'saved_search', 'Southeast healthcare exits', '{"industry":"Healthcare","region":"raleigh-durham","minimum_confidence":65}', 'raleigh-durham', 'active', datetime('now'), datetime('now')),
  ('saved_002', 'workspace_northstar', 'customer@liquidityradar.local', 'saved_search', 'Montgomery biotechnology · $25M+', '{"region":"montgomery-county-md","industry":"Biotechnology","minimum_remaining":25000000}', 'montgomery-county-md', 'active', datetime('now'), datetime('now')),
  ('preference_001', 'workspace_northstar', 'customer@liquidityradar.local', 'regional_preference', 'Recent affinity region', '{"region":"montgomery-county-md"}', 'montgomery-county-md', 'active', datetime('now'), datetime('now')),
  ('alert_001', 'workspace_northstar', 'customer@liquidityradar.local', 'alert', 'New $25M+ event in Raleigh–Durham', '{"frequency":"immediate","channel":"in_app"}', 'raleigh-durham', 'active', datetime('now'), datetime('now')),
  ('report_001', 'workspace_northstar', 'customer@liquidityradar.local', 'report', 'Boston capital report', '{"type":"regional","status":"ready"}', 'boston-cambridge', 'active', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO api_keys
  (id, workspace_id, name, key_prefix, key_hash, created_at, updated_at)
VALUES
  ('key_demo', 'workspace_northstar', 'Local demonstration key', 'lr_demo_', 'local-development-only', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO audit_logs
  (id, workspace_id, actor_email, action, entity_type, entity_id, reason, request_id, metadata, created_at)
VALUES
  ('audit_001', 'workspace_northstar', 'admin@liquidityradar.local', 'workspace.seeded', 'workspace', 'workspace_northstar', 'Local demonstration environment initialized', 'setup', '{"fictional_data":true}', datetime('now'));
