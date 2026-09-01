-- Demo master entity
INSERT INTO customer.entities (id, name, entity_type, abn)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Conveyancing Firm', 'master', '12345678901')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer.entity_settings (entity_id, billing_preference, billing_cycle, invoice_email)
VALUES ('11111111-1111-1111-1111-111111111111', 'invoice', 'monthly', 'accounts@demo.conveyx.local')
ON CONFLICT (entity_id) DO NOTHING;

INSERT INTO identity.user_profiles (id, entity_id, email, first_name, last_name)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin@demo.conveyx.local',
  'Demo',
  'Admin'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.role_assignments (user_id, entity_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'entity_admin')
ON CONFLICT (user_id, role, entity_id) DO NOTHING;

INSERT INTO identity.teams (id, entity_id, name, description)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Conveyancing', 'Default team')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.team_memberships (team_id, user_id)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (team_id, user_id) DO NOTHING;
