-- 动态功能：burn_records 增加公开标记
ALTER TABLE public.burn_records ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 为已存在的记录设置默认值
UPDATE public.burn_records SET is_public = false WHERE is_public IS NULL;
