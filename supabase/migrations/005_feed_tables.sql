-- ============================================================
-- 动态功能：点赞表、评论表、RPC 函数
-- ============================================================

-- 点赞表
CREATE TABLE IF NOT EXISTS public.feed_likes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id uuid REFERENCES public.burn_records(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(record_id, user_id)
);

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own likes" ON public.feed_likes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view likes" ON public.feed_likes
  FOR SELECT USING (true);

-- 评论表
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id uuid REFERENCES public.burn_records(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 200),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own comments" ON public.feed_comments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view comments" ON public.feed_comments
  FOR SELECT USING (true);


-- ============================================================
-- RPC 函数（SECURITY DEFINER 绕过 RLS，公共可调用但内部权限检查）
-- ============================================================

-- 1. 获取公开动态流（分页）
CREATE OR REPLACE FUNCTION get_public_feed(
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10,
  p_current_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  record_id uuid,
  user_id uuid,
  nickname text,
  ex_name text,
  crime text,
  verdict text,
  burn_type text,
  burned_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    br.id,
    br.user_id,
    COALESCE(p.nickname, '匿名焚烧者#' || left(br.user_id::text, 4)),
    br.ex_name,
    br.crime,
    br.verdict,
    COALESCE(br.burn_type, 'ex'),
    br.burned_at,
    COALESCE(lc.cnt, 0)::bigint,
    COALESCE(cc.cnt, 0)::bigint,
    CASE WHEN p_current_user_id IS NOT NULL AND fl.id IS NOT NULL THEN true ELSE false END
  FROM burn_records br
  LEFT JOIN profiles p ON br.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) as cnt FROM feed_likes WHERE feed_likes.record_id = br.id
  ) lc ON true
  LEFT JOIN LATERAL (
    SELECT count(*) as cnt FROM feed_comments WHERE feed_comments.record_id = br.id
  ) cc ON true
  LEFT JOIN feed_likes fl ON fl.record_id = br.id AND fl.user_id = p_current_user_id
  WHERE br.is_public = true
  ORDER BY br.burned_at DESC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;


-- 2. 获取某条动态的评论
CREATE OR REPLACE FUNCTION get_feed_comments(
  p_record_id uuid,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10
)
RETURNS TABLE(
  id bigint,
  record_id uuid,
  user_id uuid,
  nickname text,
  content text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id, fc.record_id, fc.user_id,
    COALESCE(p.nickname, '匿名焚烧者#' || left(fc.user_id::text, 4)),
    fc.content, fc.created_at
  FROM feed_comments fc
  LEFT JOIN profiles p ON fc.user_id = p.id
  WHERE fc.record_id = p_record_id
  ORDER BY fc.created_at ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;


-- 3. 点赞/取消点赞
CREATE OR REPLACE FUNCTION toggle_feed_like(p_record_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_exists boolean;
  v_count bigint;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM feed_likes WHERE record_id = p_record_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM feed_likes WHERE record_id = p_record_id AND user_id = v_user_id;
  ELSE
    INSERT INTO feed_likes (record_id, user_id) VALUES (p_record_id, v_user_id);
  END IF;

  SELECT count(*) INTO v_count FROM feed_likes WHERE record_id = p_record_id;

  RETURN jsonb_build_object('liked', NOT v_exists, 'like_count', v_count);
END;
$$;


-- 4. 添加评论
CREATE OR REPLACE FUNCTION add_feed_comment(p_record_id uuid, p_content text)
RETURNS TABLE(
  id bigint,
  record_id uuid,
  user_id uuid,
  nickname text,
  content text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH new_comment AS (
    INSERT INTO feed_comments (record_id, user_id, content)
    VALUES (p_record_id, v_user_id, p_content)
    RETURNING feed_comments.id, feed_comments.record_id, feed_comments.user_id,
              feed_comments.content, feed_comments.created_at
  )
  SELECT
    nc.id, nc.record_id, nc.user_id,
    COALESCE(p.nickname, '匿名焚烧者#' || left(nc.user_id::text, 4)),
    nc.content, nc.created_at
  FROM new_comment nc
  LEFT JOIN profiles p ON nc.user_id = p.id;
END;
$$;
