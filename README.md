# Organic by Pooja

A mobile-first salon booking and management app for Organic by Pooja.

## Included

- Public booking flow with Indian phone validation, date selection, live slot capacity, and confirmation.
- Atomic Supabase booking creation with two appointments per hour by default.
- WhatsApp sharing and copy-to-clipboard confirmation actions.
- Private Supabase-authenticated admin workspace with overview, appointment search, status changes, calendar, QR code, and salon settings.
- Demo mode using browser storage when the public Supabase values are not available.

## Supabase setup

The database migration has already been applied to the connected Supabase project. To enable staff access:

1. Create an email/password user in Supabase Authentication with email confirmation disabled for the initial setup.
2. Copy that user's UUID from the Authentication users list.
3. Insert the UUID into `admin_profiles` with the `admin` role using the Supabase SQL editor.
4. Add the public Supabase URL and anon key to the Vite environment as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The initial password requested for the prototype should be used only while creating the first Auth user, then changed before production. It is intentionally not embedded in the browser application.

## Deployment

Build the app with the existing Vite build script and deploy the generated `dist` folder to Vercel or another static host. Set the two public Supabase variables there, and optionally set `VITE_PUBLIC_SITE_URL` to the deployed booking URL so the admin QR preview always points to production.
