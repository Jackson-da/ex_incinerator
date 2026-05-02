import './auth.js'; // 侧效：昵称弹窗事件、顶栏昵称点击
import { SUPABASE_URL, BURN_DURATION, LONG_PRESS_DURATION } from './config.js';
import {
  phaseInput, phasePoster, phaseHealing, nameInput, generateBtn,
  posterCanvas, fireCanvas, ctxPoster, ctxFire,
  flameBtn, flameBtnWrap, flameHint,
  healQuote, restartBtn, shareCardCanvas, saveCardBtn,
  cardModalOverlay, cardPreviewCanvas, btnCloseCard, btnCardDownload,
  upgradePrompt, authModalOverlay, btnShowLogin, btnShowRegister, btnLogout, btnCloseModal,
  btnAuthSubmit, authEmail, authPassword, authPassword2, authError,
  btnSwitchMode, btnForgotPwd, btnUpgradeLogin, btnSkipUpgrade,
  btnGoIncinerator,
} from './dom.js';
import * as posterMod from './poster.js';
import * as burnMod from './burn.js';
import * as uiMod from './ui.js';
import { setHealQuote, generateShareCard } from './healing.js';
import { audioEngine } from './audio.js';
import {
  getCurrentUser, restoreSession, signUp, signIn, signOut,
  sendPasswordReset, updatePasswordWithToken,
  handlePasswordReset, handleEmailConfirmation,
} from './auth.js';
import { canFreeUseToday, markFreeUsed, isLoggedIn } from './utils.js';

// ──── 流程状态 ────
let currentName = '', currentVerdict = '';
let pressTimer = null, isPressing = false;
let lastTime = 0, animFrameId = null;
let audioInited = false;

// ──── 动画循环 ────
function ensureAnimLoop() {
  if (!animFrameId) {
    lastTime = 0;
    animFrameId = requestAnimationFrame(animate);
  }
}

function stopAnimLoop() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function animate(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTime = timestamp;
  let hasWork = false;

  if (burnMod.isRevealing) {
    hasWork = true;
    const done = burnMod.updateReveal();
    burnMod.renderParticles();
    if (done || (timestamp - burnMod.revealStartTime > 3000)) {
      if (!done) burnMod.forceCompleteReveal(posterCanvas, posterMod.sourceCanvas);
      const w = posterCanvas.width, h = posterCanvas.height;
      posterMod.startTypewriter(w, h, ctxPoster, currentVerdict, currentName, uiMod.getSelectedCrime(),
        () => audioEngine.playTick(),
        () => { posterMod.startStampAnimation(audioEngine); ensureAnimLoop(); }
      );
    }
  } else if (posterMod.isStampAnimating) {
    hasWork = true;
    posterMod.updateStampAnimation();
    burnMod.renderParticles();
  } else if (burnMod.isBurning) {
    hasWork = true;
    burnMod.updateBurn(dt);
    burnMod.renderParticles();
    burnMod.updateParticles(dt);
    if (burnMod.burnProgress >= 1.0) {
      burnMod.finishBurning();
      audioEngine.stopFire();
      setTimeout(showHealingPhase, 2800);
    }
  } else if (burnMod.burnedCount > 0 || (burnMod.postBurnStartTime && burnMod.hasActiveParticles())) {
    hasWork = true;
    burnMod.renderParticles();
    burnMod.renderPostBurnFrame(timestamp);
    burnMod.updateParticles(dt);
  }

  if (hasWork) {
    animFrameId = requestAnimationFrame(animate);
  } else {
    animFrameId = null;
  }
}

// ──── 治愈阶段 ────
function showHealingPhase() {
  audioEngine.playBell();
  for (const p of burnMod.particlePool) {
    if (p.alive) p.life = Math.min(p.life, 0.5);
  }
  const wasFreeUse = !isLoggedIn();
  if (wasFreeUse) markFreeUsed();

  setTimeout(() => {
    for (const p of burnMod.particlePool) p.alive = false;
    ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
    ctxFire.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
    uiMod.showPhase(phaseHealing);
    setHealQuote();
    if (!wasFreeUse) {
      // 已登录用户自动保存到历史
      (async () => {
        const { saveBurnRecord } = await import('./api.js');
        await saveBurnRecord({
          ex_name: currentName,
          crime: uiMod.getSelectedCrime(),
          verdict: currentVerdict,
          heal_quote: healQuote.textContent
        });
      })();
    }
    if (wasFreeUse) {
      upgradePrompt.style.display = 'block';
    } else {
      upgradePrompt.style.display = 'none';
    }
    setTimeout(() => generateShareCard(currentName, uiMod.getSelectedCrime(), currentVerdict), 500);
  }, 600);
}

// ──── 长按逻辑 ────
function onPointerDown(e) {
  if (burnMod.isBurning || burnMod.isRevealing || posterMod.isStampAnimating || posterMod.typePhase < 4 || burnMod.burnProgress >= 1) return;
  e.preventDefault(); isPressing = true;
  flameBtn.classList.add('pressing'); flameHint.textContent = '继续按住...';
  const circle = flameBtn.querySelector('.progress-ring circle');
  const circumference = 2 * Math.PI * 52;
  circle.setAttribute('stroke-dasharray', circumference);
  circle.setAttribute('stroke-dashoffset', circumference);
  circle.style.transition = `stroke-dashoffset ${LONG_PRESS_DURATION}ms linear`;
  requestAnimationFrame(() => circle.setAttribute('stroke-dashoffset', '0'));
  pressTimer = setTimeout(() => { if (isPressing) startBurning(); }, LONG_PRESS_DURATION);
}

function resetPress() {
  if (!isPressing) return;
  isPressing = false; flameBtn.classList.remove('pressing'); clearTimeout(pressTimer);
  const circle = flameBtn.querySelector('.progress-ring circle');
  circle.style.transition = 'none';
  circle.setAttribute('stroke-dashoffset', circle.getAttribute('stroke-dasharray'));
  if (!burnMod.isBurning && burnMod.burnProgress < 1) flameHint.textContent = '长按点燃';
}

function onPointerUp(e) { e.preventDefault(); resetPress(); }
function onPointerLeave(e) { resetPress(); }

function startBurning() {
  burnMod.beginBurn();
  flameHint.textContent = '燃烧中...'; isPressing = false;
  flameBtn.classList.remove('pressing');
  audioEngine.playMatchStrike();
  setTimeout(() => audioEngine.playFire(), 300);
  ensureAnimLoop();
}

// ──── 生成通缉令 ────
generateBtn.addEventListener('click', () => {
  currentName = nameInput.value.trim();
  const selectedCrime = uiMod.getSelectedCrime();
  if (!currentName || !selectedCrime) return;

  if (!isLoggedIn() && !canFreeUseToday()) {
    uiMod.showAuthModal('login');
    return;
  }

  // 重置状态
  burnMod.resetBurnState(); burnMod.resetRevealState();
  posterMod.resetPosterState();
  posterMod.setSelectedCrime(selectedCrime);
  flameBtnWrap.style.opacity = '1'; flameBtnWrap.style.transition = 'none';
  flameHint.textContent = '长按点燃';
  ctxFire.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
  ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
  for (const p of burnMod.particlePool) p.alive = false;
  phaseInput.classList.add('leaving');
  setTimeout(() => {
    phaseInput.classList.remove('leaving');
    uiMod.showPhase(phasePoster);
    currentVerdict = posterMod.renderPosterToSource(selectedCrime, currentName);
    ctxPoster.fillStyle = '#0a0a0a';
    ctxPoster.fillRect(0, 0, posterCanvas.width, posterCanvas.height);
    audioEngine.playReveal();
    burnMod.startReveal();
    ensureAnimLoop();
  }, 350);
});

// ──── 重新开始 ────
restartBtn.addEventListener('click', () => {
  stopAnimLoop();
  uiMod.showPhase(phaseInput);
  uiMod.switchTab('incinerator');
  burnMod.resetBurnState(); burnMod.resetRevealState();
  posterMod.resetPosterState();
  ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
  ctxFire.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
  for (const p of burnMod.particlePool) p.alive = false;
  uiMod.resetIncineratorUI();
  audioEngine.stopFire();
});

// ──── 分享卡片保存 ────
saveCardBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `前任焚烧炉_${currentName}_${uiMod.getSelectedCrime()}.png`;
  link.href = shareCardCanvas.toDataURL('image/png');
  link.click();
});

// ──── 点击分享卡片预览 ────
shareCardCanvas.addEventListener('click', async () => {
  cardModalOverlay.classList.add('active');
  const { drawCard } = await import('./healing.js');
  await drawCard(cardPreviewCanvas, {
    name: currentName,
    crime: uiMod.getSelectedCrime(),
    verdict: currentVerdict,
    healQuoteText: healQuote.textContent,
    sourceThumb: posterMod.sourceCanvas,
    displayMaxWidth: window.innerWidth * 0.5
  });
});

// ──── 卡片弹窗关闭 / 下载 ────
btnCloseCard.addEventListener('click', () => cardModalOverlay.classList.remove('active'));
cardModalOverlay.addEventListener('click', (e) => {
  if (e.target === cardModalOverlay) cardModalOverlay.classList.remove('active');
});
btnCardDownload.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `前任焚烧炉_${currentName}_${uiMod.getSelectedCrime()}.png`;
  link.href = cardPreviewCanvas.toDataURL('image/png');
  link.click();
});

// ──── 长按事件 ────
flameBtn.addEventListener('pointerdown', onPointerDown);
flameBtn.addEventListener('pointerup', onPointerUp);
flameBtn.addEventListener('pointerleave', onPointerLeave);
flameBtn.addEventListener('pointercancel', onPointerLeave);

// ──── 标签页事件 ────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => uiMod.switchTab(btn.dataset.tab));
});

// 空状态跳转按钮
btnGoIncinerator.addEventListener('click', () => uiMod.switchTab('incinerator'));

// ──── 认证弹窗事件 ────
btnShowLogin.addEventListener('click', () => uiMod.showAuthModal('login'));
btnShowRegister.addEventListener('click', () => uiMod.showAuthModal('register'));
btnCloseModal.addEventListener('click', uiMod.hideAuthModal);
authModalOverlay.addEventListener('click', (e) => {
  if (e.target === authModalOverlay) uiMod.hideAuthModal();
});

btnSwitchMode.addEventListener('click', () => {
  const mode = window._authMode;
  uiMod.showAuthModal(mode === 'login' ? 'register' : 'login');
});

btnForgotPwd.addEventListener('click', () => uiMod.showAuthModal('reset'));

btnAuthSubmit.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const password2 = authPassword2.value;
  const mode = window._authMode;

  if (mode === 'newPassword') {
    if (!password) { authError.textContent = '请填写新密码'; return; }
    if (password.length < 6) { authError.textContent = '密码至少6位'; return; }
    if (password !== password2) { authError.textContent = '两次密码不一致'; return; }
    authError.textContent = '处理中...';
    const token = uiMod.getRecoveryToken();
    const { error } = await updatePasswordWithToken(token, password);
    if (error) {
      authError.textContent = error.message || '重置失败';
    } else {
      authError.textContent = '';
      uiMod.setRecoveryToken(null);
      alert('密码重置成功！请重新登录。');
      uiMod.showAuthModal('login');
    }
    return;
  }
  if (!email) { authError.textContent = '请填写邮箱'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) { authError.textContent = '邮箱格式不正确（需要完整域名，如 @qq.com）'; return; }
  if (mode !== 'reset') {
    if (!password) { authError.textContent = '请填写邮箱和密码'; return; }
    if (password.length < 6) { authError.textContent = '密码至少6位'; return; }
  }
  authError.textContent = '处理中...';

  if (mode === 'reset') {
    const { error } = await sendPasswordReset(email);
    if (error) {
      authError.textContent = error.message || '发送失败';
    } else {
      authError.textContent = '';
      alert('重置邮件已发送，请查收邮箱点击链接。');
      uiMod.hideAuthModal();
    }
  } else if (mode === 'register') {
    const { error, needConfirmation } = await signUp(email, password);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered'))
        authError.textContent = '该邮箱已注册，请直接登录';
      else if (msg.includes('invalid format') || msg.includes('validate email'))
        authError.textContent = '邮箱格式不正确';
      else if (msg.includes('password'))
        authError.textContent = '密码不符合要求（至少6位）';
      else
        authError.textContent = msg || '注册失败';
    } else if (needConfirmation) {
      authError.textContent = '';
      alert('注册成功！请查收邮箱确认邮件，点击链接验证后即可登录。');
    } else {
      authError.textContent = '';
      uiMod.hideAuthModal();
      uiMod.refreshHealingButtons();
    }
  } else {
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Invalid login') || msg.includes('invalid_grant') || msg.includes('incorrect'))
        authError.textContent = '账号不存在或密码错误，未注册请先注册';
      else if (msg.includes('Email not confirmed'))
        authError.textContent = '邮箱尚未验证，请先点击确认邮件中的链接';
      else
        authError.textContent = msg || '登录失败';
    } else {
      authError.textContent = '';
      uiMod.hideAuthModal();
      uiMod.refreshHealingButtons();
    }
  }
});

authPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAuthSubmit.click();
});
authPassword2.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAuthSubmit.click();
});

btnLogout.addEventListener('click', async () => { await signOut(); });

btnUpgradeLogin.addEventListener('click', () => {
  upgradePrompt.style.display = 'none';
  uiMod.showAuthModal('login');
});

btnSkipUpgrade.addEventListener('click', () => {
  upgradePrompt.style.display = 'none';
});

// ──── 首次交互启动音频 ────
document.body.addEventListener('pointerdown', () => {
  if (!audioInited) { audioInited = true; audioEngine.init(); }
}, { once: true });

// ──── 窗口 resize ────
window.addEventListener('resize', () => {
  posterMod.resizeCanvases();
  if (posterMod.sourceCanvas && !burnMod.isBurning) posterMod.renderPosterToMain();
});

// ──── 初始化 ────
nameInput.addEventListener('input', uiMod.updateGenerateBtn);

// ──── 启动 ────
async function init() {
  uiMod.initCrimeTags();
  posterMod.resizeCanvases();

  const pwdReset = handlePasswordReset();
  const emailConfirmed = handleEmailConfirmation();

  uiMod.switchTab('incinerator');
  uiMod.showPhase(phaseInput);

  if (!pwdReset) {
    await restoreSession();
    if (emailConfirmed) {
      alert('邮箱验证成功！已自动登录。');
    }
  }

}
init();
