# Organic by Pooja

A mobile-first salon booking and management app for Organic by Pooja.

## Included

- Public booking flow with Indian phone validation, date selection, live slot capacity, and confirmation.
- Atomic Supabase booking creation with two appointments per hour by default.
- WhatsApp sharing and copy-to-clipboard confirmation actions.
- Private Supabase-authenticated admin workspace with overview, appointment search, status changes, calendar, QR code, and salon settings.
- Demo mode using browser storage when the public Supabase values are not available.

## Supabase setup

Apply the SQL files in `supabase/migrations/` in timestamp order to a new Supabase project. To enable staff access:

1. Create an email/password user in Supabase Authentication with email confirmation disabled. Use `salon-admin@organicbypooja.invalid` or set `VITE_STAFF_AUTH_EMAIL` to the internal account email.
2. Add that user's UUID to `admin_profiles` with the `admin` role using the Supabase SQL editor.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and, if changed, `VITE_STAFF_AUTH_EMAIL` in the Vite environment.

The staff page asks only for a password. Supabase Auth still uses the internal account email behind the scenes; the password is never embedded in the browser application. Use a strong, private password and rotate any password that has been shared.

## Deployment

Build the app with the existing Vite build script and deploy the generated `dist` folder to Vercel or another static host. Set the public Supabase variables and `VITE_STAFF_AUTH_EMAIL` there, and optionally set `VITE_PUBLIC_SITE_URL` to the deployed booking URL so the admin QR preview always points to production.
