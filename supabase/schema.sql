-- Catplanner database schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/rkohpdpsdrvkuhmmjhmf/sql)

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE planners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  naam        text NOT NULL DEFAULT 'Mijn planning',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE planner_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id  uuid NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('eigenaar', 'editor', 'viewer')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(planner_id, user_id)
);

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id  uuid NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('editor', 'viewer')),
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  used_by     uuid REFERENCES auth.users(id),
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

-- Key-value store for planner data (mirrors IndexedDB structure)
-- Keys: 'weken', 'voortgang', 'planning', 'lesBlokken'
CREATE TABLE planner_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id  uuid NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  key         text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(planner_id, key)
);

-- Indexes
CREATE INDEX idx_planner_members_user ON planner_members(user_id);
CREATE INDEX idx_planner_data_planner ON planner_data(planner_id);
CREATE INDEX idx_invites_token ON invites(token);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE planners ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_data ENABLE ROW LEVEL SECURITY;

-- Helper: check planner access
CREATE OR REPLACE FUNCTION user_has_planner_access(p_planner_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM planner_members
    WHERE planner_id = p_planner_id
      AND user_id = auth.uid()
      AND (
        p_min_role = 'viewer'
        OR (p_min_role = 'editor' AND role IN ('editor', 'eigenaar'))
        OR (p_min_role = 'eigenaar' AND role = 'eigenaar')
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- planners
CREATE POLICY "select_planners" ON planners
  FOR SELECT USING (user_has_planner_access(id, 'viewer'));
CREATE POLICY "insert_planners" ON planners
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "update_planners" ON planners
  FOR UPDATE USING (user_has_planner_access(id, 'eigenaar'));
CREATE POLICY "delete_planners" ON planners
  FOR DELETE USING (user_has_planner_access(id, 'eigenaar'));

-- planner_members
CREATE POLICY "select_members" ON planner_members
  FOR SELECT USING (user_has_planner_access(planner_id, 'viewer'));
CREATE POLICY "insert_members" ON planner_members
  FOR INSERT WITH CHECK (user_has_planner_access(planner_id, 'eigenaar'));
CREATE POLICY "delete_members" ON planner_members
  FOR DELETE USING (user_has_planner_access(planner_id, 'eigenaar'));

-- invites
CREATE POLICY "manage_invites" ON invites
  FOR ALL USING (user_has_planner_access(planner_id, 'eigenaar'));
-- Allow anyone to read by token (for accepting)
CREATE POLICY "read_invite_by_token" ON invites
  FOR SELECT USING (true);

-- planner_data
CREATE POLICY "select_data" ON planner_data
  FOR SELECT USING (user_has_planner_access(planner_id, 'viewer'));
CREATE POLICY "insert_data" ON planner_data
  FOR INSERT WITH CHECK (user_has_planner_access(planner_id, 'editor'));
CREATE POLICY "update_data" ON planner_data
  FOR UPDATE USING (user_has_planner_access(planner_id, 'editor'));
CREATE POLICY "delete_data" ON planner_data
  FOR DELETE USING (user_has_planner_access(planner_id, 'editor'));

-- ============================================================
-- RPC: Accept invite
-- ============================================================

CREATE OR REPLACE FUNCTION accept_invite(invite_token text)
RETURNS jsonb AS $$
DECLARE
  inv invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM invites
    WHERE token = invite_token
      AND used_by IS NULL
      AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ongeldige of verlopen uitnodiging';
  END IF;

  INSERT INTO planner_members (planner_id, user_id, role)
    VALUES (inv.planner_id, auth.uid(), inv.role)
    ON CONFLICT (planner_id, user_id) DO NOTHING;

  UPDATE invites SET used_by = auth.uid() WHERE id = inv.id;

  RETURN jsonb_build_object('planner_id', inv.planner_id, 'role', inv.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Create planner (creates planner + owner member in one call)
-- ============================================================

CREATE OR REPLACE FUNCTION create_planner(p_naam text DEFAULT 'Mijn planning')
RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO planners (owner_id, naam)
    VALUES (auth.uid(), p_naam)
    RETURNING id INTO new_id;

  INSERT INTO planner_members (planner_id, user_id, role)
    VALUES (new_id, auth.uid(), 'eigenaar');

  -- Initialize empty data rows
  INSERT INTO planner_data (planner_id, key, data) VALUES
    (new_id, 'weken', '[]'::jsonb),
    (new_id, 'voortgang', '{}'::jsonb),
    (new_id, 'planning', '{}'::jsonb),
    (new_id, 'lesBlokken', '{}'::jsonb);

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Get planner members with emails
-- ============================================================

CREATE OR REPLACE FUNCTION get_planner_members(p_planner_id uuid)
RETURNS TABLE(id uuid, user_id uuid, role text, email text) AS $$
BEGIN
  -- Check access
  IF NOT user_has_planner_access(p_planner_id, 'viewer') THEN
    RAISE EXCEPTION 'Geen toegang';
  END IF;

  RETURN QUERY
    SELECT pm.id, pm.user_id, pm.role, u.email::text
    FROM planner_members pm
    JOIN auth.users u ON u.id = pm.user_id
    WHERE pm.planner_id = p_planner_id
    ORDER BY pm.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Enable Realtime on planner_data
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE planner_data;
