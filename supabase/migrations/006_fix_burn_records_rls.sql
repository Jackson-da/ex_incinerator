-- 修复：burn_records 缺少 UPDATE 权限，导致 publishToFeed (PATCH) 静默失败

-- 1. 添加 UPDATE 策略（本人可更新自己的记录，用于 is_public 等字段）
CREATE POLICY "Users can update own records" ON public.burn_records
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. 添加公开 SELECT 策略（匿名用户也可以查看公开记录，用于动态流 fallback）
--    虽 get_public_feed 是 SECURITY DEFINER，但加上此策略更安全
CREATE POLICY "Anyone can read public records" ON public.burn_records
  FOR SELECT USING (is_public = true);
