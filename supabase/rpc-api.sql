-- ConveyX RPC API (public schema) — run in SQL Editor after cloud-setup.sql
-- Allows backend to query customer/identity schemas via Supabase REST (no DATABASE_URL needed)

CREATE OR REPLACE FUNCTION public.cx_list_entities(p_entity_type text DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, public AS $$
  SELECT coalesce(json_agg(e ORDER BY e.created_at DESC), '[]'::json)
  FROM customer.entities e
  WHERE p_entity_type IS NULL OR e.entity_type = p_entity_type;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_entity(p_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, public AS $$
  SELECT to_json(e) FROM customer.entities e WHERE e.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_entity(
  p_name text, p_entity_type text, p_parent_entity_id uuid DEFAULT NULL, p_abn text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = customer, public AS $$
DECLARE v_entity customer.entities;
BEGIN
  INSERT INTO customer.entities (name, entity_type, parent_entity_id, abn)
  VALUES (p_name, p_entity_type, p_parent_entity_id, p_abn)
  RETURNING * INTO v_entity;
  INSERT INTO customer.entity_settings (entity_id) VALUES (v_entity.id);
  RETURN to_json(v_entity);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_update_entity(
  p_id uuid, p_name text DEFAULT NULL, p_abn text DEFAULT NULL, p_status text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = customer, public AS $$
DECLARE v_entity customer.entities;
BEGIN
  UPDATE customer.entities SET
    name = coalesce(p_name, name),
    abn = coalesce(p_abn, abn),
    status = coalesce(p_status, status)
  WHERE id = p_id RETURNING * INTO v_entity;
  RETURN to_json(v_entity);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_entity_settings(p_entity_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, public AS $$
  SELECT to_json(s) FROM customer.entity_settings s WHERE s.entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_update_entity_settings(
  p_entity_id uuid,
  p_billing_preference text DEFAULT NULL,
  p_billing_cycle text DEFAULT NULL,
  p_payment_terms_days int DEFAULT NULL,
  p_invoice_email text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = customer, public AS $$
DECLARE v_settings customer.entity_settings;
BEGIN
  UPDATE customer.entity_settings SET
    billing_preference = coalesce(p_billing_preference, billing_preference),
    billing_cycle = coalesce(p_billing_cycle, billing_cycle),
    payment_terms_days = coalesce(p_payment_terms_days, payment_terms_days),
    invoice_email = coalesce(p_invoice_email, invoice_email),
    stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id)
  WHERE entity_id = p_entity_id RETURNING * INTO v_settings;
  RETURN to_json(v_settings);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_list_branches(p_parent_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, public AS $$
  SELECT coalesce(json_agg(e ORDER BY e.name), '[]'::json)
  FROM customer.entities e
  WHERE e.parent_entity_id = p_parent_id AND e.entity_type = 'branch';
$$;

CREATE OR REPLACE FUNCTION public.cx_get_user_me(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public AS $$
DECLARE v_profile identity.user_profiles;
  v_roles json;
  v_teams json;
BEGIN
  SELECT * INTO v_profile FROM identity.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(json_agg(r), '[]'::json) INTO v_roles
    FROM identity.role_assignments r WHERE r.user_id = p_user_id;
  SELECT coalesce(json_agg(tm.team_id), '[]'::json) INTO v_teams
    FROM identity.team_memberships tm WHERE tm.user_id = p_user_id;
  RETURN json_build_object('profile', to_json(v_profile), 'roles', v_roles, 'team_ids', v_teams);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_list_users(p_entity_id uuid DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = identity, public AS $$
  SELECT coalesce(json_agg(u ORDER BY u.created_at DESC), '[]'::json)
  FROM identity.user_profiles u
  WHERE p_entity_id IS NULL OR u.entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_user(p_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = identity, public AS $$
  SELECT to_json(u) FROM identity.user_profiles u WHERE u.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_user(
  p_id uuid, p_entity_id uuid, p_email text,
  p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL,
  p_roles text[] DEFAULT ARRAY['entity_user']
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public AS $$
DECLARE v_user identity.user_profiles;
  v_role text;
BEGIN
  INSERT INTO identity.user_profiles (id, entity_id, email, first_name, last_name)
  VALUES (p_id, p_entity_id, p_email, p_first_name, p_last_name)
  RETURNING * INTO v_user;
  FOREACH v_role IN ARRAY p_roles LOOP
    INSERT INTO identity.role_assignments (user_id, entity_id, role) VALUES (p_id, p_entity_id, v_role);
  END LOOP;
  RETURN to_json(v_user);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_list_teams(p_entity_id uuid DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = identity, public AS $$
  SELECT coalesce(json_agg(t ORDER BY t.name), '[]'::json)
  FROM identity.teams t
  WHERE p_entity_id IS NULL OR t.entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_team(p_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = identity, public AS $$
  SELECT to_json(t) FROM identity.teams t WHERE t.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_team(
  p_entity_id uuid, p_name text, p_description text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public AS $$
DECLARE v_team identity.teams;
BEGIN
  INSERT INTO identity.teams (entity_id, name, description)
  VALUES (p_entity_id, p_name, p_description)
  RETURNING * INTO v_team;
  RETURN to_json(v_team);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_add_team_member(p_team_id uuid, p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = identity, public AS $$
BEGIN
  INSERT INTO identity.team_memberships (team_id, user_id) VALUES (p_team_id, p_user_id);
  RETURN json_build_object('team_id', p_team_id, 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_remove_team_member(p_team_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = identity, public AS $$
  DELETE FROM identity.team_memberships WHERE team_id = p_team_id AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_health_check()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, public AS $$
  SELECT json_build_object(
    'ok', true,
    'entity_count', (SELECT count(*)::int FROM customer.entities)
  );
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
