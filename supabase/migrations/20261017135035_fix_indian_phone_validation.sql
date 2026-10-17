/*
# Fix Indian phone validation

1. Data integrity
- Replace the incorrectly escaped phone validation expression on `bookings`.
- Accept exactly +91 followed by a 10-digit Indian mobile number beginning with 6, 7, 8, or 9.

2. Booking function
- Update `create_public_booking` to use the same corrected validation.
- Keep all existing capacity, date, slot, and security checks unchanged.
*/

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_phone_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_phone_check
  CHECK (customer_phone ~ ('^' || chr(92) || '+91[6-9][0-9]{9}$'));

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
  IF p_customer_phone IS NULL OR p_customer_phone !~ ('^' || chr(92) || '+91[6-9][0-9]{9}$') THEN RAISE EXCEPTION 'invalid_phone'; END IF;
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
