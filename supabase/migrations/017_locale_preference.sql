ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale_preference TEXT CHECK (locale_preference IN ('de','en','fr','it'));
