import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { authUserLabel, btnShowLogin, btnLogout, authModalOverlay, authModalTitle, authModalSub,
  authEmail, authPassword, authPassword2, btnAuthSubmit, authError, btnSwitchMode, btnForgotPwd,
  upgradePrompt, saveDbBtn, saveDbStatus, phaseHealing } from './dom.js';

// 用户状态
export let currentUser = null;
export let authMode = 'login';
export let recoveryToken = null;
export function setAuthMode(m) { authMode = m; }
export function getAuthMode() { return authMode; }
export function setRecoveryToken(t) { recoveryToken = t; }
export function getRecoveryToken() { return recoveryToken; }

export function getCurrentUser() { return currentUser; }
export function setCurrentUser(u) { currentUser = u; }

export function authHeaders(extra = {}) {
  const h = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('sb_access_token');
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

export async function restoreSession() {
  const token = localStorage.getItem('sb_access_token');
  if (!token) return;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: authHeaders() });
    if (!res.ok) {
      const refreshed = await refreshToken();
      if (!refreshed) { clearAuth(); return; }
      return restoreSession();
    }
    const { id, email } = await res.json();
    currentUser = { id, email };
    updateAuthUI();
    await ensureProfile(currentUser);
  } catch (e) { /* 网络不通 */ }
}

export async function refreshToken() {
  const rt = localStorage.getItem('sb_refresh_token');
  if (!rt) return false;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt })
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('sb_access_token', data.access_token);
    localStorage.setItem('sb_refresh_token', data.refresh_token);
    return true;
  } catch (e) { return false; }
}

export function clearAuth() {
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  currentUser = null;
  updateAuthUI();
}

export async function signUp(email, password) {
  try {
    const checkRes = await fetch(SUPABASE_URL + '/functions/v1/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (checkRes.ok) {
      const { exists } = await checkRes.json();
      if (exists) return { error: { message: '该邮箱已注册，请直接登录' }, needConfirmation: false };
    }

    const res = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.msg || data.message || '注册失败' }, needConfirmation: false };
    if (data.access_token) {
      localStorage.setItem('sb_access_token', data.access_token);
      localStorage.setItem('sb_refresh_token', data.refresh_token);
      currentUser = data.user;
      updateAuthUI();
      await ensureProfile(currentUser);
      return { data, error: null, needConfirmation: false };
    }
    return { data, error: null, needConfirmation: true };
  } catch (e) {
    return { error: { message: '网络错误，请检查网络连接' }, needConfirmation: false };
  }
}

export async function signIn(email, password) {
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error_description || data.msg || '登录失败' } };
    localStorage.setItem('sb_access_token', data.access_token);
    localStorage.setItem('sb_refresh_token', data.refresh_token);
    currentUser = data.user;
    updateAuthUI();
    await ensureProfile(currentUser);
    return { data, error: null };
  } catch (e) {
    return { error: { message: '网络错误，请检查网络连接' } };
  }
}

export async function signOut() {
  await fetch(SUPABASE_URL + '/auth/v1/logout', {
    method: 'POST',
    headers: authHeaders()
  }).catch(() => {});
  clearAuth();
}

export async function sendPasswordReset(email) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/recover', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const data = await res.json();
    return { error: { message: data.msg || '发送失败' } };
  }
  return { error: null };
}

export async function updatePasswordWithToken(accessToken, newPassword) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'PUT',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });
  if (!res.ok) {
    const data = await res.json();
    return { error: { message: data.msg || '重置失败' } };
  }
  return { error: null };
}

export function handlePasswordReset() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const type = params.get('type');
  if (accessToken && type === 'recovery') {
    recoveryToken = accessToken;
    window.location.hash = '';
    return true;
  }
  return false;
}

export function handleEmailConfirmation() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (accessToken && type === 'signup') {
    localStorage.setItem('sb_access_token', accessToken);
    if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
    window.location.hash = '';
    return true;
  }
  return false;
}

// ──── 昵称相关 ────
export async function fetchProfile(userId) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?select=nickname&id=eq.' + userId,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error('[fetchProfile]', res.status, err);
    return null;
  }
  const rows = await res.json();
  return rows.length > 0 ? rows[0] : null;
}

export async function createProfile(nickname) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/profiles', {
    method: 'POST',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ id: currentUser.id, nickname })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[createProfile]', res.status, err);
    return null;
  }
  const rows = await res.json();
  return rows[0];
}

export async function updateProfile(nickname) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + currentUser.id, {
    method: 'PATCH',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ nickname })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[updateProfile]', res.status, err);
    return null;
  }
  const rows = await res.json();
  return rows[0];
}

// 登录后自动检查/创建 profile
async function ensureProfile(user) {
  if (!user || !user.id) return;
  // 尝试获取 profile
  const profile = await fetchProfile(user.id);
  if (!profile) {
    // 无 profile，显示昵称设置弹窗
    showNicknameModal();
  } else {
    // 有 profile，更新顶栏
    updateAuthUI(profile.nickname);
  }
}

// ──── 昵称弹窗 ────
import { nicknameOverlay, nicknameInput, btnNicknameSubmit } from './dom.js';

function showNicknameModal() {
  nicknameOverlay.classList.add('active');
  nicknameInput.value = '';
  nicknameInput.focus();
}

function hideNicknameModal() {
  nicknameOverlay.classList.remove('active');
}

btnNicknameSubmit.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return;
  if (nickname.length > 10) return;
  btnNicknameSubmit.disabled = true;
  btnNicknameSubmit.textContent = '保存中...';

  // 先尝试更新，失败（记录不存在）则创建
  let profile = await updateProfile(nickname);
  if (!profile) {
    profile = await createProfile(nickname);
  }

  btnNicknameSubmit.disabled = false;
  btnNicknameSubmit.textContent = '确 认';
  if (profile) {
    hideNicknameModal();
    updateAuthUI(profile.nickname);
  } else {
    alert('保存失败，请确认：\n1. Supabase 中已创建 profiles 表\n2. RLS 策略允许本人写入\n3. 网络连接正常');
  }
});

nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnNicknameSubmit.click();
});

nicknameOverlay.addEventListener('click', (e) => {
  if (e.target === nicknameOverlay) hideNicknameModal();
});

// 点击顶栏昵称可修改
authUserLabel.addEventListener('click', async () => {
  if (!currentUser) return;
  const profile = await fetchProfile(currentUser.id);
  nicknameInput.value = profile ? profile.nickname : '';
  showNicknameModal();
});

export function updateAuthUI(nickname) {
  if (currentUser) {
    authUserLabel.textContent = nickname || currentUser.email;
    authUserLabel.title = '点击修改昵称';
    btnShowLogin.style.display = 'none';
    btnLogout.style.display = '';
  } else {
    authUserLabel.textContent = '未登录';
    authUserLabel.title = '';
    btnShowLogin.style.display = '';
    btnLogout.style.display = 'none';
  }
}
