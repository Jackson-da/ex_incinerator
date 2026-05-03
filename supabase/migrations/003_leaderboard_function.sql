-- 排行榜聚合函数（SECURITY DEFINER 绕过 RLS，跨用户统计）
CREATE OR REPLACE FUNCTION get_leaderboard(filter_type text DEFAULT NULL)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  nickname text,
  total_burns bigint,
  top_crime text,
  burn_types jsonb,
  latest_burn timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MAX(br.burned_at) DESC)::bigint,
    br.user_id,
    COALESCE(p.nickname, '匿名焚烧者#' || left(br.user_id::text, 4)),
    COUNT(*)::bigint,
    MODE() WITHIN GROUP (ORDER BY br.crime) as top_crime,
    jsonb_build_object(
      'ex', COUNT(*) FILTER (WHERE br.burn_type = 'ex'),
      'friend', COUNT(*) FILTER (WHERE br.burn_type = 'friend'),
      'boss', COUNT(*) FILTER (WHERE br.burn_type = 'boss'),
      'mood', COUNT(*) FILTER (WHERE br.burn_type = 'mood'),
      'custom', COUNT(*) FILTER (WHERE br.burn_type = 'custom')
    ) as burn_types,
    MAX(br.burned_at) as latest_burn
  FROM burn_records br
  LEFT JOIN profiles p ON br.user_id = p.id
  WHERE (filter_type IS NULL OR br.burn_type = filter_type)
  GROUP BY br.user_id, p.nickname
  ORDER BY COUNT(*) DESC, MAX(br.burned_at) DESC;
END;
$$;
