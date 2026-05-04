import { $, $$, phaseInput, phasePoster, phaseHealing, nameInput, crimeTagsEl, generateBtn,
  tabContents, upgradePrompt, historyList, historyEmpty, historyLoading,
  authModalOverlay, authModalTitle, authModalSub, authEmail, authPassword, authPassword2,
  btnAuthSubmit, authError, btnSwitchMode, btnForgotPwd, btnShowLogin,
  canvasWrapper, posterCanvas, fireCanvas, flameBtnWrap, flameHint, shareCardCanvas, saveCardBtn,
  cardModalOverlay, cardPreviewCanvas, btnCloseCard, btnCardDownload,
  burnTypeRow, nameInputLabel, crimeGroup, customCrimeGroup, customCrimeInput,
  aiInputGroup, aiInput, aiReviewPanel } from './dom.js';
import { getShuffledCrimes, BURN_TYPES } from './data.js';
import { isLoggedIn, escapeHTML } from './utils.js';
import { fetchBurnHistoryPaged, fetchBurnHistoryCount, deleteBurnRecord } from './api.js';
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
  if (tabName === 'leaderboard') {
    import('./leaderboard.js').then(m => m.loadLeaderboard());
  }
  if (tabName === 'feed') {
    import('./feed.js').then(m => m.loadFeed());
  }
}

// ──── 阶段切换 ────
export function showPhase(phase) {
  [phaseInput, phasePoster, phaseHealing].forEach(p => p.classList.remove('active'));
  phase.classList.add('active');
}

// ──── 焚烧类型 + 罪名标签 ────
let selectedCrime = null;
let authMode = 'login';
let recoveryToken = null;
let selectedBurnType = 'ex';
export function getSelectedCrime() { return selectedCrime; }
export function setSelectedCrime(c) { selectedCrime = c; }
export function getSelectedBurnType() { return selectedBurnType; }

// SVG 图标
const TYPE_ICONS = {
  ex: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  friend: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M17 3.13a4 4 0 0 1 0 7.75"/></svg>',
  boss: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12h.01"/></svg>',
  mood: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M8 9s1.5 2 4 2 4-2 4-2"/><path d="M9 15c.83 1 2.5 2 3 2s2.17-1 3-2"/></svg>',
  custom: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  ai: '<svg class="type-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-3 3.87V16h4v2h-4v4h-2v-4H7v-2h4v-4.13A4 4 0 0 1 8 8V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/></svg>'
};

export function initBurnTypePills() {
  burnTypeRow.innerHTML = '';
  BURN_TYPES.forEach(t => {
    const pill = document.createElement('button');
    pill.className = 'burn-type-pill' + (t.id === selectedBurnType ? ' active' : '');
    pill.dataset.type = t.id;
    pill.innerHTML = (TYPE_ICONS[t.id] || '') + t.label;
    pill.addEventListener('click', () => selectBurnType(t.id));
    burnTypeRow.appendChild(pill);
  });
}

function selectBurnType(typeId) {
  selectedBurnType = typeId;
  // 更新 pill 选中态
  burnTypeRow.querySelectorAll('.burn-type-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.type === typeId);
  });
  // 更新副标题
  const info = BURN_TYPES.find(t => t.id === typeId);
  const subtitle = document.querySelector('.app-subtitle');
  if (subtitle && info) subtitle.textContent = info.subtitle;
  // 更新输入框 label
  if (nameInputLabel && info) nameInputLabel.textContent = info.inputLabel;
  if (nameInput && info) nameInput.placeholder = info.inputPlaceholder;
  // 罪名区 & 按钮文案
  crimeGroup.style.display = 'none';
  customCrimeGroup.style.display = 'none';
  aiInputGroup.style.display = 'none';
  aiReviewPanel.style.display = 'none';
  generateBtn.style.display = '';
  nameInput.style.display = '';
  nameInputLabel.style.display = '';
  if (typeId === 'custom') {
    customCrimeGroup.style.display = '';
    selectedCrime = customCrimeInput.value.trim() || null;
    generateBtn.textContent = '生 成 通 缉 令';
  } else if (typeId === 'mood') {
    selectedCrime = nameInput.value.trim() || null;
    generateBtn.textContent = '生 成 焚 烧 令';
  } else if (typeId === 'ai') {
    aiInputGroup.style.display = '';
    nameInput.style.display = 'none';
    nameInputLabel.style.display = 'none';
    selectedCrime = null;
    generateBtn.textContent = 'AI 智 能 审 判';
  } else {
    crimeGroup.style.display = '';
    initCrimeTags();
    generateBtn.textContent = '生 成 通 缉 令';
  }
  updateGenerateBtn();
}

export function initCrimeTags() {
  crimeTagsEl.innerHTML = '';
  selectedCrime = null;
  const crimes = getShuffledCrimes(selectedBurnType);
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
  const hasName = !!nameInput.value.trim();
  let hasCrime;
  if (selectedBurnType === 'ai') {
    generateBtn.disabled = !aiInput.value.trim();
    return;
  } else if (selectedBurnType === 'mood') {
    selectedCrime = hasName ? nameInput.value.trim() : null;
    hasCrime = hasName;
  } else if (selectedBurnType === 'custom') {
    hasCrime = !!customCrimeInput.value.trim();
  } else {
    hasCrime = !!selectedCrime;
  }
  generateBtn.disabled = !(hasName && hasCrime);
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
let _currentFilter = 'all';
let _currentPage = 1;
let _hasMore = false;
let _loadingMore = false;
let _totalCount = 0;

function showHistoryEmpty() {
  historyEmpty.style.display = 'block';
  const statsBar = $('#history-stats');
  if (statsBar) statsBar.style.display = 'none';
  const filterBar = $('#history-filter');
  if (filterBar) filterBar.style.display = 'none';
}

function updateStats(latestRecord) {
  const statsBar = $('#history-stats');
  if (!statsBar) return;
  statsBar.style.display = '';
  const countEl = $('#stats-count'), latestEl = $('#stats-latest');
  if (countEl) countEl.textContent = _totalCount;
  if (latestEl && latestRecord) {
    latestEl.textContent = new Date(latestRecord.burned_at).toLocaleDateString('zh-CN', {
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
  _totalCount = Math.max(0, _totalCount - 1);
  const countEl = $('#stats-count');
  if (countEl) countEl.textContent = _totalCount;
}

async function applyFilter(filter) {
  _currentFilter = filter;
  _currentPage = 1;
  _hasMore = false;
  historyList.innerHTML = '';
  historyEmpty.style.display = 'none';
  historyLoading.style.display = 'block';

  const filterBar = $('#history-filter');
  if (filterBar) {
    filterBar.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === filter);
    });
  }

  // 并发获取第一页和总数
  const [records, count] = await Promise.all([
    fetchBurnHistoryPaged({ filterType: filter, page: 1, pageSize: PAGE_SIZE }),
    fetchBurnHistoryCount(filter)
  ]);

  historyLoading.style.display = 'none';
  _totalCount = count;
  if (!records || records.length === 0) {
    showHistoryEmpty();
    return;
  }

  _hasMore = records.length === PAGE_SIZE;
  updateStats(records[0]);

  records.forEach((rec, i) => {
    historyList.appendChild(renderHistoryCard(rec, i));
  });

  if (_hasMore) {
    const btn = historyList.querySelector('.load-more-btn');
    if (!btn) historyList.appendChild(ensureLoadMoreBtn());
    else btn.style.display = '';
  } else {
    const end = document.createElement('p');
    end.className = 'history-end';
    end.textContent = '— 已经到底了 —';
    historyList.appendChild(end);
  }
}

async function loadMoreHistory() {
  if (_loadingMore || !_hasMore) return;
  _loadingMore = true;
  const oldEnd = historyList.querySelector('.history-end');
  if (oldEnd) oldEnd.remove();
  const btn = historyList.querySelector('.load-more-btn');
  if (btn) btn.textContent = '加载中...';

  _currentPage++;
  const records = await fetchBurnHistoryPaged({
    filterType: _currentFilter,
    page: _currentPage,
    pageSize: PAGE_SIZE
  });

  _loadingMore = false;
  if (!records || records.length === 0) {
    _hasMore = false;
    if (btn) btn.style.display = 'none';
    return;
  }

  _hasMore = records.length === PAGE_SIZE;
  const existing = historyList.querySelectorAll('.history-card').length;

  // 先移除按钮，追加卡片后再放回末尾
  let btnReplacement;
  if (btn) { btn.remove(); btnReplacement = btn; }

  records.forEach((rec, i) => {
    historyList.appendChild(renderHistoryCard(rec, existing + i));
  });

  if (_hasMore) {
    btnReplacement.textContent = '加载更多卷宗 ↓';
    historyList.appendChild(btnReplacement);
  } else {
    const end = document.createElement('p');
    end.className = 'history-end';
    end.textContent = '— 已经到底了 —';
    historyList.appendChild(end);
  }
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
    quote: rec.heal_quote || '',
    burnType: rec.burn_type || 'ex'
  };
  card._recordId = rec.id;

  bindHistoryCardEvents(card);
  return card;
}

function bindHistoryCardEvents(card) {
  // 卡片预览
  card.querySelector('.hc-btn-card').addEventListener('click', async (e) => {
    e.stopPropagation();
    const { name, crime, verdict, quote, burnType } = card._data;
    cardModalOverlay.classList.add('active');
    const [{ drawCard }, { renderHistoryPoster }] = await Promise.all([
      import('./healing.js'),
      import('./poster.js')
    ]);
    const posterThumb = renderHistoryPoster(name, crime, verdict, burnType);
    await drawCard(cardPreviewCanvas, {
      name, crime, verdict,
      healQuoteText: quote,
      sourceThumb: posterThumb,
      displayMaxWidth: window.innerWidth * 0.5,
      burnType
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
  btn.addEventListener('click', loadMoreHistory);
  historyList.appendChild(btn);
  return btn;
}

export async function loadHistoryPanel() {
  historyList.innerHTML = '';
  historyEmpty.style.display = 'none';
  const statsBar = $('#history-stats');
  if (statsBar) statsBar.style.display = 'none';
  _currentFilter = 'all';
  _currentPage = 1;
  _hasMore = false;
  _totalCount = 0;

  const filterBar = $('#history-filter');
  if (filterBar) {
    filterBar.style.display = '';
    filterBar.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => applyFilter(tab.dataset.filter);
    });
  }

  await applyFilter('all');

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
  if (customCrimeInput) customCrimeInput.value = '';
  if (aiInput) aiInput.value = '';
  updateGenerateBtn();
  if (selectedBurnType !== 'custom' && selectedBurnType !== 'mood' && selectedBurnType !== 'ai') {
    initCrimeTags();
  }
  if (selectedBurnType === 'mood') {
    generateBtn.textContent = '生 成 焚 烧 令';
  } else if (selectedBurnType === 'ai') {
    generateBtn.textContent = 'AI 智 能 审 判';
  }
  // 确保当前类型 UI 状态正确（AI 输入区可见性等）
  selectBurnType(selectedBurnType);
}
