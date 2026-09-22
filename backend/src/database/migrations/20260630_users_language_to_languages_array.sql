DO $$ 
BEGIN 
  -- Case 1: 'language' exists and 'languages' does not exist -> Rename and convert
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'language'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'languages'
  ) THEN 
    ALTER TABLE public.users RENAME COLUMN "language" TO languages;
    ALTER TABLE public.users ALTER COLUMN languages DROP DEFAULT;
    ALTER TABLE public.users
      ALTER COLUMN languages TYPE TEXT[] USING
        CASE
          WHEN languages IS NULL OR languages = '' THEN NULL
          ELSE ARRAY[languages]
        END;
  -- Case 2: Neither exists -> Just add 'languages'
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'languages'
  ) THEN
    ALTER TABLE public.users ADD COLUMN languages TEXT[];
  END IF;

  -- Ensure 'languages' is TEXT[] if it exists but is not ARRAY
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'languages' AND data_type != 'ARRAY'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN languages DROP DEFAULT;
    ALTER TABLE public.users
      ALTER COLUMN languages TYPE TEXT[] USING
        CASE
          WHEN languages IS NULL OR languages::text = '' THEN NULL
          ELSE ARRAY[languages::text]
        END;
  END IF;
END $$;