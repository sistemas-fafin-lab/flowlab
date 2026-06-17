-- Migration: Allow anonymous users to read user_whitelist for signup validation
-- Without this, the RLS policy blocks unauthenticated reads, causing a 406
-- error (PGRST116) when .single() finds 0 rows during the signup flow.

CREATE POLICY "whitelist_read_anon"
  ON user_whitelist FOR SELECT
  USING (auth.role() = 'anon');
