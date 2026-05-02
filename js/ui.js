import { $, $$, phaseInput, phasePoster, phaseHealing, nameInput, crimeTagsEl, generateBtn,
  tabContents, upgradePrompt, historyList, historyEmpty, historyLoading,
  authModalOverlay, authModalTitle, authModalSub, authEmail, authPassword, authPassword2,
  btnAuthSubmit, authError, btnSwitchMode, btnForgotPwd, btnShowLogin,
  canvasWrapper, posterCanvas, fireCanvas, flameBtnWrap, flameHint, shareCardCanvas, saveCardBtn,
  cardModalOverlay, cardPreviewCanvas, btnCloseCard, btnCardDownload } from './dom.js';
import { getShuffledCrimes } from './data.js';
import { isLoggedIn, escapeHTML } from './utils.js';
import { fetchBurnHistory, deleteBurnRecord } from './api.js';
import { setCurrentUser, getCurrentUser } from './auth.js';
import { stopTypewriter } from './poster.js';

// ──── 标签页切换 ────
export function switchTab(tabName) {
  Object.values(tabContents).forEach(el => el.classList.remove('active'));
  const target = tabContents[tabName];
  if (target) target.classList.add('active');

  // 更新标签按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) btn.classList.add('active');
  });

  if (tabName === 'history' && isLoggedIn()) {
    loadHistoryPanel();
  }
}

// ──── 阶段切换 ────
export function showPhase(phase) {
  [phaseInput, phasePoster, phaseHealing].forEach(p => p.classList.remove('active'));
  phase.classList.add('active');
}

// ──── 罪名标签 ────
let selectedCrime = null;
let authMode = 'login';
let recoveryToken = null;
export function getSelectedCrime() { return selectedCrime; }
export function setSelectedCrime(c) { selectedCrime = c; }

export function initCrimeTags() {
  crimeTagsEl.innerHTML = '';
  selectedCrime = null;
  const crimes = getShuffledCrimes();
  crimes.forEach(c => {
    const tag = document.createElement('span');
    tag.className = 'crime-tag';
    tag.textContent = c.name;
    if (c.hot) {
      const badge = document.createElement('span');
      badge.className = 'hot-badge'; badge.textContent = '热';
      tag.appendChild(badge);
    }
    tag.addEventListener('click', () => selectCrime(c.name, tag));
    crimeTagsEl.appendChild(tag);
  });
}

function selectCrime(crime, el) {
  $$('.crime-tag').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  selectedCrime = crime;
  updateGenerateBtn();
}

export function updateGenerateBtn() {
  generateBtn.disabled = !(nameInput.value.trim() && selectedCrime);
}

// ──── 认证弹窗 ────
export function setAuthMode(m) { authMode = m; }
export function getAuthMode() { return authMode; }
export function setRecoveryToken(t) { recoveryToken = t; }
export function getRecoveryToken() { return recoveryToken; }

export function showAuthModal(mode) {
  window._authMode = mode;
  if (mode === 'login') {
    authModalTitle.textContent = '登 录';
    authModalSub.textContent = '登录后无限体验全部功能';
    btnAuthSubmit.textContent = '登 录';
    btnSwitchMode.textContent = '还没有账号？去注册 →';
    btnForgotPwd.style.display = '';
    authEmail.style.display = '';
    authPassword.style.display = '';
    authPassword.placeholder = '密码（至少6位）';
    authPassword2.style.display = 'none';
  } else if (mode === 'reset') {
    authModalTitle.textContent = '重 置 密 码';
    authModalSub.textContent = '输入邮箱，我们将发送重置链接';
    btnAuthSubmit.textContent = '发 送 重 置 邮 件';
    btnSwitchMode.textContent = '返回登录';
    btnForgotPwd.style.display = 'none';
    authEmail.style.display = '';
    authPassword.style.display = 'none';
    authPassword2.style.display = 'none';
  } else if (mode === 'newPassword') {
    authModalTitle.textContent = '设 置 新 密 码';
    authModalSub.textContent = '请输入新密码并确认';
    btnAuthSubmit.textContent = '重 置 密 码';
    btnSwitchMode.textContent = '返回登录';
    btnForgotPwd.style.display = 'none';
    authEmail.style.display = 'none';
    authPassword.style.display = '';
    authPassword.placeholder = '新密码（至少6位）';
    authPassword2.style.display = '';
  } else {
    authModalTitle.textContent = '注 册';
    authModalSub.textContent = '注册即享无限体验';
    btnAuthSubmit.textContent = '注 册';
    btnSwitchMode.textContent = '已有账号？去登录 →';
    btnForgotPwd.style.display = 'none';
    authEmail.style.display = '';
    authPassword.style.display = '';
    authPassword.placeholder = '密码（至少6位）';
    authPassword2.style.display = 'none';
  }
  authError.textContent = '';
  authEmail.value = '';
  authPassword.value = '';
  authPassword2.value = '';
  authModalOverlay.classList.add('active');
}

export function hideAuthModal() {
  authModalOverlay.classList.remove('active');
  if (window._authMode === 'newPassword') setRecoveryToken(null);
}

// ──── 焚烧历史面板 ────
const PAGE_SIZE = 10;
let _allRecords = [];
let _shownCount = 0;

function showHistoryEmpty() {
  historyEmpty.style.display = 'block';
  const statsBar = $('#history-stats');
  if (statsBar) statsBar.style.display = 'none';
}

function updateStats(records) {
  const statsBar = $('#history-stats');
  if (!statsBar) return;
  statsBar.style.display = '';
  const countEl = $('#stats-count'), latestEl = $('#stats-latest');
  if (countEl) countEl.textContent = records.length;
  if (latestEl && records.length > 0) {
    latestEl.textContent = new Date(records[0].burned_at).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

function refreshStatsAfterDelete() {
  const remaining = historyList.querySelectorAll('.history-card');
  if (remaining.length === 0) {
    showHistoryEmpty();
    return;
  }
  const countEl = $('#stats-count');
  if (countEl) countEl.textContent = remaining.length;
}

function renderHistoryCard(rec, index) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.id = 'record-' + rec.id;
  card.style.animationDelay = (index * 40) + 'ms';

  const date = new Date(rec.burned_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  card.innerHTML =
    '<div class="hc-accent"></div>' +
    '<div class="hc-body">' +
      '<div class="hc-header">' +
        '<span class="hc-name">' + escapeHTML(rec.ex_name) + '</span>' +
        '<span class="hc-crime-tag">' + escapeHTML(rec.crime) + '</span>' +
      '</div>' +
      '<div class="hc-verdict">' + escapeHTML(rec.verdict) + '</div>' +
      '<div class="hc-footer">' +
        '<span class="hc-date">' + date + '</span>' +
        '<div class="hc-actions">' +
          '<button class="hc-btn-card">卡 片</button>' +
          '<button class="hc-btn-delete">删 除</button>' +
        '</div>' +
      '</div>' +
      '<div class="hc-confirm">' +
        '<span class="hc-confirm-text">确认将此记录化为灰烬？</span>' +
        '<button class="hc-confirm-yes">确认</button>' +
        '<button class="hc-confirm-no">取消</button>' +
      '</div>' +
    '</div>';

  card._data = {
    name: rec.ex_name,
    crime: rec.crime,
    verdict: rec.verdict,
    quote: rec.heal_quote || ''
  };
  card._recordId = rec.id;

  bindHistoryCardEvents(card);
  return card;
}

function bindHistoryCardEvents(card) {
  // 卡片预览
  card.querySelector('.hc-btn-card').addEventListener('click', async (e) => {
    e.stopPropagation();
    const { name, crime, verdict, quote } = card._data;
    cardModalOverlay.classList.add('active');
    const [{ drawCard }, { renderHistoryPoster }] = await Promise.all([
      import('./healing.js'),
      import('./poster.js')
    ]);
    const posterThumb = renderHistoryPoster(name, crime, verdict);
    await drawCard(cardPreviewCanvas, {
      name, crime, verdict,
      healQuoteText: quote,
      sourceThumb: posterThumb,
      displayMaxWidth: window.innerWidth * 0.5
    });
  });

  // 删除 → 展开确认栏
  card.querySelector('.hc-btn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    const confirmBar = card.querySelector('.hc-confirm');
    historyList.querySelectorAll('.hc-confirm').forEach(c => {
      if (c !== confirmBar) c.style.display = 'none';
    });
    confirmBar.style.display = 'flex';
  });

  // 确认删除
  card.querySelector('.hc-confirm-yes').addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = card._recordId;
    card.classList.add('burning-out');
    const { error } = await deleteBurnRecord(id);
    if (error) {
      card.classList.remove('burning-out');
      alert(error.message);
    } else {
      card.addEventListener('animationend', () => {
        card.remove();
        refreshStatsAfterDelete();
      }, { once: true });
    }
  });

  // 取消删除
  card.querySelector('.hc-confirm-no').addEventListener('click', (e) => {
    e.stopPropagation();
    card.querySelector('.hc-confirm').style.display = 'none';
  });
}

function ensureLoadMoreBtn() {
  let btn = historyList.querySelector('.load-more-btn');
  if (btn) return btn;
  btn = document.createElement('button');
  btn.className = 'load-more-btn';
  btn.textContent = '加载更多卷宗 ↓';
  btn.addEventListener('click', () => {
    btn.style.display = 'none';
    renderNextPage();
  });
  historyList.appendChild(btn);
  return btn;
}

function renderNextPage() {
  const batch = _allRecords.slice(_shownCount, _shownCount + PAGE_SIZE);
  const startIndex = _shownCount;

  batch.forEach((rec, i) => {
    const card = renderHistoryCard(rec, startIndex + i);
    historyList.appendChild(card);
  });

  _shownCount += batch.length;

  if (_shownCount < _allRecords.length) {
    const btn = ensureLoadMoreBtn();
    btn.style.display = '';
    // 移到列表末尾
    historyList.appendChild(btn);
  } else {
    const btn = historyList.querySelector('.load-more-btn');
    if (btn) btn.style.display = 'none';
  }
}

export async function loadHistoryPanel() {
  historyList.innerHTML = '';
  historyEmpty.style.display = 'none';
  const statsBar = $('#history-stats');
  if (statsBar) statsBar.style.display = 'none';
  historyLoading.style.display = 'block';

  const records = await fetchBurnHistory();
  historyLoading.style.display = 'none';

  if (!records || records.length === 0) {
    showHistoryEmpty();
    return;
  }

  _allRecords = records;
  _shownCount = 0;

  updateStats(records);
  renderNextPage();

  // 卡片弹窗关闭/下载
  btnCloseCard.onclick = () => cardModalOverlay.classList.remove('active');
  cardModalOverlay.onclick = (e) => {
    if (e.target === cardModalOverlay) cardModalOverlay.classList.remove('active');
  };
  btnCardDownload.onclick = () => {
    const link = document.createElement('a');
    link.download = '焚烧判决书.png';
    link.href = cardPreviewCanvas.toDataURL('image/png');
    link.click();
  };
}

// ──── 治愈阶段按钮刷新 ────
export function refreshHealingButtons() {
  if (!phaseHealing.classList.contains('active')) return;
  if (isLoggedIn()) {
    upgradePrompt.style.display = 'none';
  }
}

// ──── 重置焚烧炉状态 ────
export function resetIncineratorUI() {
  flameBtnWrap.style.opacity = '1'; flameBtnWrap.style.transition = 'none';
  flameHint.textContent = '长按点燃';
  shareCardCanvas.style.display = 'none';
  saveCardBtn.style.display = 'none';
  upgradePrompt.style.display = 'none';
  selectedCrime = null;
  nameInput.value = '';
  updateGenerateBtn();
  initCrimeTags();
}
