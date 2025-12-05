@@ .. @@
   INSERT INTO user_profiles (id, email, name, role)
   VALUES (
     NEW.id,
     NEW.email,
-    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
+    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
     default_role
   );
   
   RETURN NEW;