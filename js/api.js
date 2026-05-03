import { SUPABASE_URL } from './config.js';
import { authHeaders } from './auth.js';

export async function saveBurnRecord(data) {
  console.log('[saveBurnRecord] 准备保存:', JSON.stringify(data));
  const res = await fetch(SUPABASE_URL + '/rest/v1/burn_records', {
    method: 'POST',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[saveBurnRecord] 失败 HTTP', res.status, errText);
    return { error: { message: '保存失败，请稍后重试 (' + res.status + ')' } };
  }
  const rows = await res.json();
  console.log('[saveBurnRecord] 成功:', rows[0]);
  return { data: rows[0], error: null };
}

export async function fetchBurnHistory() {
  console.log('[fetchBurnHistory] 开始拉取...');
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/burn_records?select=*&order=burned_at.desc',
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error('[fetchBurnHistory] 失败 HTTP', res.status, errText);
    return [];
  }
  const data = await res.json();
  console.log('[fetchBurnHistory] 拉取到', data.length, '条');
  return data;
}

export async function deleteBurnRecord(id) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/burn_records?id=eq.' + id,
    { method: 'DELETE', headers: authHeaders() }
  );
  if (!res.ok) return { error: { message: '删除失败' } };
  return { error: null };
}

// ──── 动态相关 ────

export async function publishToFeed(recordId) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/burn_records?id=eq.' + recordId,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify({ is_public: true })
    }
  );
  if (!res.ok) {
    console.error('[publishToFeed] 失败 HTTP', res.status);
    return { error: { message: '发布失败' } };
  }
  return { error: null };
}

export async function fetchPublicFeed(page = 1, pageSize = 10) {
  const { getCurrentUser } = await import('./auth.js');
  const currentUser = getCurrentUser();
  const userId = currentUser?.id || null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_feed`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      p_page: page,
      p_page_size: pageSize,
      p_current_user_id: userId
    })
  });

  if (!res.ok) {
    console.error('[fetchPublicFeed] 失败 HTTP', res.status);
    return [];
  }
  return await res.json();
}

export async function toggleFeedLike(recordId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/toggle_feed_like`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ p_record_id: recordId })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[toggleFeedLike] 失败 HTTP', res.status, err);
    return { error: { message: '操作失败' } };
  }
  const data = await res.json();
  return { data, error: null };
}

export async function addFeedComment(recordId, content) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_feed_comment`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ p_record_id: recordId, p_content: content })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[addFeedComment] 失败 HTTP', res.status, err);
    return { error: { message: '评论失败' } };
  }
  const rows = await res.json();
  return { data: rows[0], error: null };
}

export async function fetchFeedComments(recordId, page = 1, pageSize = 10) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_feed_comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      p_record_id: recordId,
      p_page: page,
      p_page_size: pageSize
    })
  });

  if (!res.ok) {
    console.error('[fetchFeedComments] 失败 HTTP', res.status);
    return [];
  }
  return await res.json();
}
