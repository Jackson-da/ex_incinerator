export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

// 标签页
export const tabContents = {
  incinerator: $('#tab-incinerator'),
  history: $('#tab-history'),
  leaderboard: $('#tab-leaderboard'),
  feed: $('#tab-feed')
};

// 焚烧炉主流程
export const phaseInput = $('#phase-input'), phasePoster = $('#phase-poster'), phaseHealing = $('#phase-healing');
export const nameInput = $('#name-input'), crimeTagsEl = $('#crime-tags'), generateBtn = $('#generate-btn');
export const canvasWrapper = $('#canvas-wrapper');
export const posterCanvas = $('#poster-canvas'), fireCanvas = $('#fire-canvas');
export const flameBtn = $('#flame-btn'), flameBtnWrap = $('#flame-btn-wrap'), flameHint = $('.flame-hint');
export const healQuote = $('#heal-quote'), restartBtn = $('#restart-btn');
export const shareCardCanvas = $('#share-card-canvas'), saveCardBtn = $('#save-card-btn');

// 认证
export const authUserLabel = $('#auth-user-label');
export const btnShowLogin = $('#btn-show-login'), btnLogout = $('#btn-logout');
export const authModalOverlay = $('#auth-modal-overlay'), authModalTitle = $('#auth-modal-title');
export const authModalSub = $('#auth-modal-sub'), authEmail = $('#auth-email'), authPassword = $('#auth-password'), authPassword2 = $('#auth-password2');
export const btnAuthSubmit = $('#btn-auth-submit'), authError = $('#auth-error');
export const btnSwitchMode = $('#btn-switch-mode'), btnCloseModal = $('#btn-close-modal');
export const btnForgotPwd = $('#btn-forgot-pwd');

// 升级引导
export const upgradePrompt = $('#upgrade-prompt'), btnUpgradeLogin = $('#btn-upgrade-login');
export const btnSkipUpgrade = $('#btn-skip-upgrade');

// 焚烧历史
export const historyList = $('#history-list'), historyEmpty = $('#history-empty'), historyLoading = $('#history-loading');
export const cardModalOverlay = $('#card-modal-overlay'), cardPreviewCanvas = $('#card-preview-canvas');
export const btnCloseCard = $('#btn-close-card'), btnCardDownload = $('#btn-card-download');

// Canvas 2D 上下文
export const ctxPoster = posterCanvas.getContext('2d'), ctxFire = fireCanvas.getContext('2d');

// 昵称
export const nicknameOverlay = $('#nickname-overlay'), nicknameInput = $('#nickname-input');
export const btnNicknameSubmit = $('#btn-nickname-submit');
