import { SUPABASE_URL } from './config.js';
import { authHeaders } from './auth.js';

export async function saveBurnRecord(data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/burn_records', {
    method: 'POST',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(data)
  });
  if (!res.ok) return { error: { message: '保存失败，请稍后重试' } };
  const rows = await res.json();
  return { data: rows[0], error: null };
}

export async function fetchBurnHistory() {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/burn_records?select=*&order=burned_at.desc',
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function deleteBurnRecord(id) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/burn_records?id=eq.' + id,
    { method: 'DELETE', headers: authHeaders() }
  );
  if (!res.ok) return { error: { message: '删除失败' } };
  return { error: null };
}
