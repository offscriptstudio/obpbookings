/*
# Tighten salon access grants

1. Security changes
- Remove anonymous execution from administrator-only helper functions.
- Remove direct table privileges that are not needed by anonymous visitors.
- Keep anonymous execution only for the two intentionally public operations: reading slot availability and creating a booking.

2. Important notes
- Row Level Security policies remain the authority for authenticated staff access.
- No appointment records or administrator profile data become publicly readable.
*/

REVOKE ALL ON TABLE admin_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE admin_profiles TO authenticated;
REVOKE ALL ON TABLE bookings FROM anon;
GRANT SELECT ON TABLE bookings TO authenticated;
GRANT INSERT, UPDATE ON TABLE bookings TO authenticated;
REVOKE ALL ON TABLE salon_settings FROM anon;
GRANT SELECT ON TABLE salon_settings TO authenticated;
GRANT UPDATE ON TABLE salon_settings TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_booking_admin(uuid,text,text,date,time,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_booking_admin(uuid,text,text,date,time,text,text,text) TO authenticated;
