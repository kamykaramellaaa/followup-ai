-- ============================================================
-- FOLLOWUP AI — Security fixes migration
-- Run this in the Supabase SQL Editor AFTER supabase-setup.sql
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Signup trigger: never trust client-supplied role
--    Previously: coalesce(raw_user_meta_data->>'role', 'agent')
--    Attack: supabase.auth.signUp({ data: { role: 'admin' } })
--    Fix: always assign 'agent'; an admin must promote users manually
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utente'),
    new.email,
    'agent'  -- never trust the client-supplied role value
  );
  RETURN new;
END;
$$;

-- ----------------------------------------------------------------
-- 2. Anti-escalation trigger on profiles
--    Prevents non-admins from updating their own role or manager_id,
--    even if the RLS UPDATE policy would otherwise allow the row write.
--    Works by resetting NEW.role / NEW.manager_id to OLD values
--    before the row is written whenever the caller is not an admin.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF public.get_my_role() != 'admin' THEN
    NEW.role       := OLD.role;
    NEW.manager_id := OLD.manager_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_no_role_escalation ON public.profiles;
CREATE TRIGGER profiles_no_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ----------------------------------------------------------------
-- 3. Fix voice_notes INSERT policy
--    Previously: WITH CHECK (true) — any authenticated user could
--    insert voice notes attributed to any created_by UUID.
--    Fix: enforce created_by = the calling user.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "voice_insert" ON public.voice_notes;
CREATE POLICY "voice_insert" ON public.voice_notes FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

-- ----------------------------------------------------------------
-- 4. Fix activity_log INSERT policy
--    Previously: WITH CHECK (true) — any authenticated user could
--    forge activity entries for any user_id.
--    Fix: enforce user_id = the calling user.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "activity_insert" ON public.activity_log;
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
