# Organic by Pooja

A mobile-first salon booking and management app for Organic by Pooja.

## Included

- Public booking flow with Indian phone validation, date selection, live slot capacity, and confirmation.
- Atomic Supabase booking creation with two appointments per hour by default.
- WhatsApp sharing and copy-to-clipboard confirmation actions.
- Private Supabase-authenticated admin workspace with overview, appointment search, status changes, calendar, QR code, and salon settings.
- The parlor is open every day by default. Admins can add specific dates as holiday closures in Salon settings.
- Demo mode using browser storage when the public Supabase values are not available.

## Supabase setup

Apply the SQL files in `supabase/migrations/` in timestamp order to a new Supabase project. To enable staff access:

1. Create an email/password user in Supabase Authentication with email confirmation disabled. Use `salon-admin@organicbypooja.invalid` or set `VITE_STAFF_AUTH_EMAIL` to the internal account email.
2. Add that user's UUID to `admin_profiles` with the `admin` role using the Supabase SQL editor.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and, if changed, `VITE_STAFF_AUTH_EMAIL` in the Vite environment.

The staff page asks only for a password. Supabase Auth still uses the internal account email behind the scenes; the password is never embedded in the browser application. Use a strong, private password and rotate any password that has been shared.

## Vercel deployment

1. Import `offscriptstudio/obpbookings` from GitHub in Vercel and select the `main` branch.
2. Use the repository root (`./`), the Vite preset, `npm run build`, and `dist` as the output directory.
3. Add these environment variables for Production (and Preview if needed):
   - `VITE_SUPABASE_URL`: the Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: the Supabase publishable/anon key only. Never use a secret or service-role key in a Vite variable.
   - `VITE_STAFF_AUTH_EMAIL`: the internal Auth account email, normally `salon-admin@organicbypooja.invalid`.
   - `VITE_PUBLIC_SITE_URL`: optional; set this to the deployed Vercel URL so the admin QR preview points to the live booking page.
4. Deploy. The included Vercel rewrite supports refreshing app routes such as `/admin/login`.
5. In Supabase Authentication URL Configuration, add the deployed domain (and Vercel Preview domains if needed) to the allowed redirect URLs. The staff login currently uses password authentication and does not send email redirects.

Apply new Supabase SQL migrations from `supabase/migrations/` in timestamp order before deploying updates that depend on them. The latest migration sets every weekday, including Sunday, as a working day; use Salon settings in the admin workspace to schedule and remove individual holiday closures.
