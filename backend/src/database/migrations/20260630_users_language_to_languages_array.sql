-- Rename language (varchar) to languages (TEXT[]) in public.users
ALTER TABLE public.users RENAME COLUMN "language" TO languages;

ALTER TABLE public.users ALTER COLUMN languages DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN languages TYPE TEXT[] USING
    CASE
      WHEN languages IS NULL OR languages = '' THEN NULL
      ELSE ARRAY[languages]
    END;