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
