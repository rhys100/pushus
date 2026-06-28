-- Allow authenticated users to insert and delete their own notification preferences.
-- Client upsert requires INSERT when the profile trigger row is missing.

CREATE POLICY notification_preferences_insert_self
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_delete_self
  ON public.notification_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT INSERT, DELETE ON public.notification_preferences TO authenticated;
