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
  btnGoIncinerator, btnLbGoIncinerator, customCrimeInput, customCrimeGroup,
  feedPublishToggle, feedPublishStatus, feedPublishBtn,
  aiInput, aiInputGroup, aiReviewPanel, aiReviewName, aiReviewCrime, aiReviewVerdict,
  aiConfirmBtn, aiRetryBtn,
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
let aiHealQuote = '';
let pressTimer = null, isPressing = false;
let lastTime = 0, animFrameId = null;
let audioInited = false;
let feedPublishEnabled = true;

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
  if (wasFreeUse) { markFreeUsed(); console.log('[save] 未登录，跳过保存'); }

  setTimeout(() => {
    for (const p of burnMod.particlePool) p.alive = false;
    ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
    ctxFire.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
    uiMod.showPhase(phaseHealing);
    if (uiMod.getSelectedBurnType() === 'ai' && aiHealQuote) {
      healQuote.textContent = aiHealQuote;
      healQuote.style.animation = 'none'; healQuote.offsetHeight;
      healQuote.style.animation = 'fadeInUp 1s ease-out';
    } else {
      setHealQuote(uiMod.getSelectedBurnType());
    }
    if (!wasFreeUse) {
      console.log('[save] 已登录，准备保存记录, burnType:', uiMod.getSelectedBurnType());
      (async () => {
        const { saveBurnRecord } = await import('./api.js');
        const burnType = uiMod.getSelectedBurnType();
        let crime;
        if (burnType === 'mood') {
          crime = currentName;
        } else if (burnType === 'custom') {
          crime = customCrimeInput.value.trim();
        } else {
          crime = uiMod.getSelectedCrime();
        }
        const { getCurrentUser } = await import('./auth.js');
        const user = getCurrentUser();
        const { data: savedRecord, error } = await saveBurnRecord({
          user_id: user?.id,
          ex_name: currentName,
          crime,
          verdict: currentVerdict,
          heal_quote: healQuote.textContent,
          burn_type: burnType
        });
        if (error) {
          console.error('保存焚烧记录失败:', error.message);
          return;
        }

        // 发布到动态
        if (savedRecord) {
          window._lastSavedRecordId = savedRecord.id;
          if (feedPublishEnabled) {
            const { publishToFeed } = await import('./api.js');
            const pubResult = await publishToFeed(savedRecord.id);
            if (pubResult.error) {
              console.error('发布到动态失败:', pubResult.error.message);
              feedPublishStatus.style.display = '';
              feedPublishStatus.querySelector('.feed-publish-confirmed').style.display = 'none';
              feedPublishBtn.style.display = '';
              feedPublishBtn.textContent = '发布失败，点此重试';
              return;
            }
          }
        }

        // 显示发布状态
        feedPublishStatus.style.display = '';
        if (feedPublishEnabled) {
          feedPublishStatus.querySelector('.feed-publish-confirmed').style.display = '';
          feedPublishBtn.style.display = 'none';
        } else {
          feedPublishStatus.querySelector('.feed-publish-confirmed').style.display = 'none';
          feedPublishBtn.style.display = '';
        }
      })();
    }
    if (wasFreeUse) {
      upgradePrompt.style.display = 'block';
    } else {
      upgradePrompt.style.display = 'none';
    }
    setTimeout(() => {
      const bt = uiMod.getSelectedBurnType();
      const crime = bt === 'mood' ? currentName
        : bt === 'custom' ? customCrimeInput.value.trim()
        : uiMod.getSelectedCrime();
      generateShareCard(currentName, crime, currentVerdict, bt);
    }, 500);
  }, 600);
}

// ──── 长按逻辑 ────
function onPointerDown(e) {
  const typewriterDone = uiMod.getSelectedBurnType() === 'mood' ? posterMod.typePhase >= 3 : posterMod.typePhase >= 4;
  if (burnMod.isBurning || burnMod.isRevealing || posterMod.isStampAnimating || !typewriterDone || burnMod.burnProgress >= 1) return;
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
generateBtn.addEventListener('click', async () => {
  const burnType = uiMod.getSelectedBurnType();
  let selectedCrime;
  let aiVerdict;

  if (burnType === 'ai') {
    const aiInputVal = aiInput.value.trim();
    if (!aiInputVal) return;

    if (!isLoggedIn() && !canFreeUseToday()) {
      uiMod.showAuthModal('login');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'AI 正在审理案件...';
    const { aiJudge } = await import('./api.js');
    const { data, error } = await aiJudge(aiInputVal);
    generateBtn.disabled = false;
    generateBtn.textContent = 'AI 智 能 审 判';
    if (error) {
      alert(error.message);
      return;
    }

    // 显示审查面板
    aiReviewName.value = data.ex_name;
    aiReviewCrime.value = data.crime;
    aiReviewVerdict.value = data.verdict;
    aiHealQuote = data.heal_quote || '';
    aiInputGroup.style.display = 'none';
    generateBtn.style.display = 'none';
    aiReviewPanel.style.display = '';
    return; // 等待用户确认
  } else {
    currentName = nameInput.value.trim();
    selectedCrime = burnType === 'mood' ? currentName
      : burnType === 'custom' ? customCrimeInput.value.trim()
      : uiMod.getSelectedCrime();
    if (!currentName || !selectedCrime) return;

    if (!isLoggedIn() && !canFreeUseToday()) {
      uiMod.showAuthModal('login');
      return;
    }
  }

  startPosterPhase(burnType, selectedCrime, currentName, aiVerdict);
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
  aiHealQuote = '';
  feedPublishStatus.style.display = 'none';
  audioEngine.stopFire();
});

function getResolvedCrime() {
  const bt = uiMod.getSelectedBurnType();
  if (bt === 'mood') return currentName;
  if (bt === 'custom') return customCrimeInput.value.trim();
  return uiMod.getSelectedCrime();
}

// ──── 分享卡片保存 ────
saveCardBtn.addEventListener('click', () => {
  const crime = getResolvedCrime();
  const link = document.createElement('a');
  link.download = `前任焚烧炉_${currentName}_${crime}.png`;
  link.href = shareCardCanvas.toDataURL('image/png');
  link.click();
});

// ──── 点击分享卡片预览 ────
shareCardCanvas.addEventListener('click', async () => {
  const crime = getResolvedCrime();
  cardModalOverlay.classList.add('active');
  const { drawCard } = await import('./healing.js');
  await drawCard(cardPreviewCanvas, {
    name: currentName,
    crime,
    verdict: currentVerdict,
    healQuoteText: healQuote.textContent,
    sourceThumb: posterMod.sourceCanvas,
    displayMaxWidth: window.innerWidth * 0.5,
    burnType: uiMod.getSelectedBurnType()
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
btnLbGoIncinerator.addEventListener('click', () => uiMod.switchTab('incinerator'));


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

// AI 审查确认 → 生成通缉令
aiConfirmBtn.addEventListener('click', () => {
  const burnType = uiMod.getSelectedBurnType();
  currentName = aiReviewName.value.trim();
  const crime = aiReviewCrime.value.trim();
  const verdict = aiReviewVerdict.value.trim();
  if (!currentName || !crime || !verdict) return;

  uiMod.setSelectedCrime(crime);
  startPosterPhase(burnType, crime, currentName, verdict);
});

// AI 返回修改描述
aiRetryBtn.addEventListener('click', () => {
  aiReviewPanel.style.display = 'none';
  generateBtn.style.display = '';
  aiInputGroup.style.display = '';
});

function startPosterPhase(burnType, selectedCrime, currentName, aiVerdict) {
  burnMod.resetBurnState(); burnMod.resetRevealState();
  posterMod.resetPosterState();
  posterMod.setSelectedCrime(selectedCrime);
  posterMod.setBurnType(burnType);
  flameBtnWrap.style.opacity = '1'; flameBtnWrap.style.transition = 'none';
  flameHint.textContent = '长按点燃';
  ctxFire.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
  ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
  for (const p of burnMod.particlePool) p.alive = false;
  aiReviewPanel.style.display = 'none';
  generateBtn.style.display = '';
  phaseInput.classList.add('leaving');
  setTimeout(() => {
    phaseInput.classList.remove('leaving');
    uiMod.showPhase(phasePoster);
    currentVerdict = posterMod.renderPosterToSource(selectedCrime, currentName, aiVerdict);
    ctxPoster.fillStyle = '#0a0a0a';
    ctxPoster.fillRect(0, 0, posterCanvas.width, posterCanvas.height);
    audioEngine.playReveal();
    burnMod.startReveal();
    ensureAnimLoop();
  }, 350);
}

// 补发到动态
feedPublishBtn.addEventListener('click', async () => {
  feedPublishBtn.disabled = true;
  feedPublishBtn.textContent = '发布中...';
  const { publishToFeed } = await import('./api.js');
  const { error } = await publishToFeed(window._lastSavedRecordId);
  if (error) {
    feedPublishBtn.disabled = false;
    feedPublishBtn.textContent = '发布到社区动态';
    return;
  }
  feedPublishBtn.style.display = 'none';
  feedPublishStatus.querySelector('.feed-publish-confirmed').style.display = '';
});

// feed 空态跳转
const btnFeedGo = document.getElementById('btn-feed-go-incinerator');
if (btnFeedGo) btnFeedGo.addEventListener('click', () => uiMod.switchTab('incinerator'));

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
customCrimeInput.addEventListener('input', uiMod.updateGenerateBtn);
aiInput.addEventListener('input', uiMod.updateGenerateBtn);

// 发布开关
feedPublishToggle.addEventListener('change', () => {
  feedPublishEnabled = feedPublishToggle.checked;
});

// ──── 启动 ────
async function init() {
  uiMod.initBurnTypePills();
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
