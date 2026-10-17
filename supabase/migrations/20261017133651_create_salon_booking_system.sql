/*
# Create Organic by Pooja booking system

1. New Tables
- `salon_settings` stores the single salon configuration, opening hours, capacity, working days, and closures.
- `admin_profiles` links approved administrators to Supabase Auth users without exposing passwords.
- `bookings` stores customer appointments, status history, booking references, and timestamps.

2. Security
- Row Level Security is enabled on every table.
- Public users can only call narrowly scoped availability and booking functions; they cannot select booking rows.
- Authenticated administrators are checked through `admin_profiles` before reading or changing appointments and settings.
- Booking creation and updates validate inputs and enforce capacity atomically with row locks.

3. Important Notes
- Configure an admin by creating a Supabase Auth email/password user, then adding that user's UUID to `admin_profiles` with role `admin`.
- The database stores dates and local salon times separately for Asia/Kolkata-safe rendering.
- Cancelled bookings do not consume capacity; completed bookings continue to consume capacity for historical integrity.
*/

CREATE TABLE IF NOT EXISTS salon_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  salon_name text NOT NULL DEFAULT 'Organic by Pooja',
  whatsapp_number text NOT NULL DEFAULT '+91 9102163439',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  opening_time time NOT NULL DEFAULT '09:00',
  closing_time time NOT NULL DEFAULT '21:00',
  slot_duration_minutes integer NOT NULL DEFAULT 60 CHECK (slot_duration_minutes > 0 AND slot_duration_minutes <= 240),
  capacity_per_slot integer NOT NULL DEFAULT 2 CHECK (capacity_per_slot > 0 AND capacity_per_slot <= 20),
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  closed_dates date[] NOT NULL DEFAULT ARRAY[]::date[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO salon_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL UNIQUE,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  customer_phone text NOT NULL CHECK (customer_phone ~ '^\\+91[6-9][0-9]{9}$'),
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 2 AND 100),
  additional_notes text CHECK (additional_notes IS NULL OR char_length(additional_notes) <= 1000),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS bookings_appointment_lookup ON bookings (appointment_date, start_time, status);
CREATE INDEX IF NOT EXISTS bookings_reference_lookup ON bookings (booking_reference);

ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND role = 'admin') $$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "admins_read_settings" ON salon_settings;
CREATE POLICY "admins_read_settings" ON salon_settings FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admins_update_settings" ON salon_settings;
CREATE POLICY "admins_update_settings" ON salon_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins_read_profiles" ON admin_profiles;
CREATE POLICY "admins_read_profiles" ON admin_profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "admins_read_bookings" ON bookings;
CREATE POLICY "admins_read_bookings" ON bookings FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admins_insert_bookings" ON bookings;
CREATE POLICY "admins_insert_bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins_update_bookings" ON bookings;
CREATE POLICY "admins_update_bookings" ON bookings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_slot_availability(p_date date)
RETURNS TABLE(start_time time, end_time time, booked_count integer, capacity integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE s salon_settings%ROWTYPE; t time;
BEGIN
  SELECT * INTO s FROM salon_settings WHERE id = true;
  IF p_date < (now() AT TIME ZONE s.timezone)::date THEN RETURN; END IF;
  IF NOT ((extract(isodow FROM p_date))::integer = ANY(s.working_days)) OR p_date = ANY(s.closed_dates) THEN RETURN; END IF;
  t := s.opening_time;
  WHILE t < s.closing_time LOOP
    start_time := t;
    end_time := t + make_interval(mins => s.slot_duration_minutes);
    capacity := s.capacity_per_slot;
    SELECT count(*)::integer INTO booked_count FROM bookings b WHERE b.appointment_date = p_date AND b.start_time = t AND b.status <> 'cancelled';
    RETURN NEXT;
    t := end_time;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.get_slot_availability(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_availability(date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_customer_name text, p_customer_phone text, p_appointment_date date, p_start_time time,
  p_purpose text, p_additional_notes text DEFAULT NULL
)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s salon_settings%ROWTYPE; v_count integer; v_end time; v_ref text; result bookings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM salon_settings WHERE id = true FOR UPDATE;
  IF p_appointment_date < (now() AT TIME ZONE s.timezone)::date THEN RAISE EXCEPTION 'invalid_date'; END IF;
  IF NOT ((extract(isodow FROM p_appointment_date))::integer = ANY(s.working_days)) OR p_appointment_date = ANY(s.closed_dates) THEN RAISE EXCEPTION 'closed_date'; END IF;
  IF p_customer_name IS NULL OR char_length(trim(p_customer_name)) < 2 OR char_length(p_customer_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF p_customer_phone IS NULL OR p_customer_phone !~ '^\\+91[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF p_purpose IS NULL OR char_length(trim(p_purpose)) < 2 OR char_length(p_purpose) > 100 THEN RAISE EXCEPTION 'invalid_purpose'; END IF;
  v_end := p_start_time + make_interval(mins => s.slot_duration_minutes);
  IF p_start_time < s.opening_time OR v_end > s.closing_time OR mod(extract(epoch FROM (p_start_time - s.opening_time))::integer, s.slot_duration_minutes * 60) <> 0 THEN RAISE EXCEPTION 'invalid_slot'; END IF;
  SELECT count(*)::integer INTO v_count FROM bookings WHERE appointment_date = p_appointment_date AND start_time = p_start_time AND status <> 'cancelled';
  IF v_count >= s.capacity_per_slot THEN RAISE EXCEPTION 'slot_full'; END IF;
  v_ref := 'OP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO bookings (booking_reference, customer_name, customer_phone, appointment_date, start_time, end_time, purpose, additional_notes)
  VALUES (v_ref, trim(p_customer_name), p_customer_phone, p_appointment_date, p_start_time, v_end, trim(p_purpose), nullif(trim(p_additional_notes), ''))
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_booking(text,text,date,time,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text,text,date,time,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_booking_admin(
  p_id uuid, p_customer_name text, p_customer_phone text, p_appointment_date date,
  p_start_time time, p_purpose text, p_additional_notes text, p_status text
)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s salon_settings%ROWTYPE; v_count integer; v_end time; result bookings%ROWTYPE; old_row bookings%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO s FROM salon_settings WHERE id = true FOR UPDATE;
  SELECT * INTO old_row FROM bookings WHERE id = p_id FOR UPDATE;
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_status NOT IN ('confirmed','completed','cancelled') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  v_end := p_start_time + make_interval(mins => s.slot_duration_minutes);
  IF p_status <> 'cancelled' THEN
    SELECT count(*)::integer INTO v_count FROM bookings WHERE appointment_date = p_appointment_date AND start_time = p_start_time AND status <> 'cancelled' AND id <> p_id;
    IF v_count >= s.capacity_per_slot THEN RAISE EXCEPTION 'slot_full'; END IF;
  END IF;
  UPDATE bookings SET customer_name = trim(p_customer_name), customer_phone = p_customer_phone, appointment_date = p_appointment_date, start_time = p_start_time, end_time = v_end, purpose = trim(p_purpose), additional_notes = nullif(trim(p_additional_notes), ''), status = p_status, cancelled_at = CASE WHEN p_status = 'cancelled' THEN coalesce(cancelled_at, now()) ELSE NULL END, updated_at = now() WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.update_booking_admin(uuid,text,text,date,time,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_admin(uuid,text,text,date,time,text,text,text) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON bookings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON salon_settings FROM anon;
