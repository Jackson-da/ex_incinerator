-- 确保 burn_type 列存在且接受所有 5 种焚烧类型
-- 该列在早期开发中通过 Supabase 控制台手动添加，现补迁移文件

-- 1. 添加列（如果不存在）
ALTER TABLE public.burn_records ADD COLUMN IF NOT EXISTS burn_type text;

-- 2. 填充已有 NULL 值
UPDATE public.burn_records SET burn_type = 'ex' WHERE burn_type IS NULL;

-- 3. 删除可能存在的错误 CHECK 约束（通过 DO 块动态处理）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.burn_records'::regclass
      AND contype = 'c'
      AND conname LIKE '%burn_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.burn_records DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
