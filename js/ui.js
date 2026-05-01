import { $, $$, phaseInput, phasePoster, phaseHealing, nameInput, crimeTagsEl, generateBtn,
  tabContents, saveDbBtn, saveDbStatus, upgradePrompt, historyList, historyEmpty, historyLoading,
  authModalOverlay, authModalTitle, authModalSub, authEmail, authPassword, authPassword2,
  btnAuthSubmit, authError, btnSwitchMode, btnForgotPwd, btnShowLogin,
  canvasWrapper, posterCanvas, fireCanvas, flameBtnWrap, flameHint, shareCardCanvas, saveCardBtn,
  cardModalOverlay, cardPreviewCanvas, btnCloseCard, btnCardDownload } from './dom.js';
import { getShuffledCrimes } from './data.js';
import { isLoggedIn, escapeHTML } from './utils.js';
import { fetchBurnHistory, deleteBurnRecord } from './api.js';
import { authMode, recoveryToken, setCurrentUser, getCurrentUser, setAuthMode, getAuthMode, setRecoveryToken, getRecoveryToken } from './auth.js';
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
export { setAuthMode, getAuthMode, setRecoveryToken, getRecoveryToken } from './auth.js';

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
export async function loadHistoryPanel() {
  historyList.innerHTML = '';
  historyEmpty.style.display = 'none';
  historyLoading.style.display = 'block';

  const records = await fetchBurnHistory();
  historyLoading.style.display = 'none';

  if (!records || records.length === 0) {
    historyEmpty.style.display = 'block';
    return;
  }

  records.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.id = 'record-' + rec.id;
    const date = new Date(rec.burned_at).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    div.innerHTML =
      '<div class="hi-info">' +
        '<div class="hi-name">' + escapeHTML(rec.ex_name) + '</div>' +
        '<div class="hi-crime">罪名：' + escapeHTML(rec.crime) + '</div>' +
        '<div class="hi-date">' + date + '</div>' +
        '<div class="hi-verdict">' + escapeHTML(rec.verdict) + '</div>' +
      '</div>' +
      '<button class="btn-card" data-name="' + escapeHTML(rec.ex_name) + '" data-crime="' + escapeHTML(rec.crime) + '" data-verdict="' + escapeHTML(rec.verdict) + '" data-quote="' + escapeHTML(rec.heal_quote || '') + '">卡 片</button>' +
      '<button class="btn-delete" data-id="' + rec.id + '">删 除</button>';
    historyList.appendChild(div);
  });

  // 卡片预览
  historyList.querySelectorAll('.btn-card').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { name, crime, verdict, quote } = e.target.dataset;
      cardModalOverlay.classList.add('active');
      const [{ drawCard }, { renderHistoryPoster }] = await Promise.all([
        import('./healing.js'),
        import('./poster.js')
      ]);
      const posterThumb = renderHistoryPoster(name, crime, verdict);
      await drawCard(cardPreviewCanvas, {
        name, crime, verdict,
        healQuoteText: quote,
        sourceThumb: posterThumb
      });
    });
  });

  // 关闭卡片弹窗
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

  historyList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('确定要删除这条焚烧记录吗？')) return;
      const item = document.getElementById('record-' + id);
      if (item) item.classList.add('deleting');
      const { error } = await deleteBurnRecord(id);
      if (error) {
        alert(error.message);
        if (item) item.classList.remove('deleting');
      } else {
        if (item) item.remove();
        if (historyList.children.length === 0) historyEmpty.style.display = 'block';
      }
    });
  });
}

// ──── 治愈阶段按钮刷新 ────
export function refreshHealingButtons() {
  if (!phaseHealing.classList.contains('active')) return;
  if (isLoggedIn()) {
    upgradePrompt.style.display = 'none';
    saveDbBtn.style.display = 'block';
    saveDbBtn.disabled = false;
    saveDbStatus.style.display = 'none';
  }
}

// ──── 重置焚烧炉状态 ────
export function resetIncineratorUI() {
  flameBtnWrap.style.opacity = '1'; flameBtnWrap.style.transition = 'none';
  flameHint.textContent = '长按点燃';
  shareCardCanvas.style.display = 'none';
  saveCardBtn.style.display = 'none';
  saveDbBtn.style.display = 'none';
  saveDbStatus.style.display = 'none';
  upgradePrompt.style.display = 'none';
  selectedCrime = null;
  nameInput.value = '';
  updateGenerateBtn();
  initCrimeTags();
}
