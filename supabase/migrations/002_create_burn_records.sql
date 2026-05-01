-- 焚烧记录表
CREATE TABLE IF NOT EXISTS public.burn_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ex_name text NOT NULL,
  crime text NOT NULL,
  verdict text NOT NULL,
  heal_quote text,
  burned_at timestamptz DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.burn_records ENABLE ROW LEVEL SECURITY;

-- RLS 策略：仅本人可读写
CREATE POLICY "Users can read own records" ON public.burn_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records" ON public.burn_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own records" ON public.burn_records
  FOR DELETE USING (auth.uid() = user_id);
