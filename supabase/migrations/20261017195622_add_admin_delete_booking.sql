CREATE OR REPLACE FUNCTION public.delete_booking_admin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.bookings WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_booking_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_booking_admin(uuid) TO authenticated;
