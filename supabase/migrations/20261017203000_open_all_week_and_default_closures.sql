ALTER TABLE public.salon_settings
  ALTER COLUMN working_days SET DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7];

UPDATE public.salon_settings
SET working_days = ARRAY[1, 2, 3, 4, 5, 6, 7]
WHERE id = true;
