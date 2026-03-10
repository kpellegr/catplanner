-- ============================================================
-- Migration 002: Multi-tenant MVP
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. User profiles table (student / ouder / coach)
CREATE TABLE user_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type    text NOT NULL CHECK (user_type IN ('student', 'ouder', 'coach')),
  display_name text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile_select" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_profile_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_profile_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Add student_profile to planners
ALTER TABLE planners
  ADD COLUMN student_profile jsonb;

-- student_profile example:
-- { "naam": "Daan", "richting": "WW", "route": "Z", "wiskunde": "8u" }

-- 3. Update create_planner RPC to accept profile
CREATE OR REPLACE FUNCTION create_planner(
  p_naam text DEFAULT 'Mijn planning',
  p_student_profile jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO planners (owner_id, naam, student_profile)
    VALUES (auth.uid(), p_naam, p_student_profile)
    RETURNING id INTO new_id;

  INSERT INTO planner_members (planner_id, user_id, role)
    VALUES (new_id, auth.uid(), 'eigenaar');

  INSERT INTO planner_data (planner_id, key, data) VALUES
    (new_id, 'weken', '[]'::jsonb),
    (new_id, 'voortgang', '{}'::jsonb),
    (new_id, 'planning', '{}'::jsonb),
    (new_id, 'lesBlokken', '{}'::jsonb);

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Create/update user profile
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_type text,
  p_display_name text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_profiles (user_id, user_type, display_name)
    VALUES (auth.uid(), p_user_type, p_display_name)
    ON CONFLICT (user_id) DO UPDATE
      SET user_type = p_user_type,
          display_name = COALESCE(p_display_name, user_profiles.display_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Get user profile
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'user_type', user_type,
      'display_name', display_name
    )
    FROM user_profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Get all planners I'm a member of (for dashboard)
CREATE OR REPLACE FUNCTION get_my_planners()
RETURNS TABLE(
  planner_id uuid,
  planner_naam text,
  role text,
  student_profile jsonb
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.naam,
      pm.role,
      p.student_profile
    FROM planner_members pm
    JOIN planners p ON p.id = pm.planner_id
    WHERE pm.user_id = auth.uid()
    ORDER BY pm.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
