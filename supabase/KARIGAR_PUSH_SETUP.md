# Karigar browser push setup

1. Apply the existing karigar payout migrations, then `migration_karigar_push_reminders.sql`. The new view must be able to read the karigar, assignment, and payout tables under the caller's RLS policies.
2. Generate a VAPID key pair, for example with `npx web-push generate-vapid-keys`. Set `VITE_VAPID_PUBLIC_KEY` in the Vite build environment. Set Edge Function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` contact).
3. Set a random `CRON_SECRET` Edge Function secret. Add Vault secrets named `karigar_push_project_url` (the project URL, such as `https://PROJECT.supabase.co`) and `karigar_push_cron_secret` (the same `CRON_SECRET`).
4. Deploy `karigar-payment-reminders` with JWT verification disabled, then deploy the web app over HTTPS. The migration schedules `0 6 1 * *` UTC, which is 11:00 AM Pakistan time on the 1st.

The Edge Function checks the Pakistan date and hour again. It requires `x-cron-secret`, so public calls cannot trigger sends. Each successful push has a unique delivery record for its month, karigar, and browser subscription. If a push service rejects a subscription as expired, the sender removes it.
