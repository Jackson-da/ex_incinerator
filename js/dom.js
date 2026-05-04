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
export const burnTypeRow = $('#burn-type-row'), nameInputLabel = $('#name-input-label');
export const crimeGroup = $('#crime-group'), customCrimeGroup = $('#custom-crime-group'), customCrimeInput = $('#custom-crime-input');
export const aiInputGroup = $('#ai-input-group'), aiInput = $('#ai-input');
export const aiReviewPanel = $('#ai-review-panel'), aiReviewName = $('#ai-review-name');
export const aiReviewCrime = $('#ai-review-crime'), aiReviewVerdict = $('#ai-review-verdict');
export const aiConfirmBtn = $('#ai-confirm-btn'), aiRetryBtn = $('#ai-retry-btn');
export const canvasWrapper = $('#canvas-wrapper');
export const posterCanvas = $('#poster-canvas'), fireCanvas = $('#fire-canvas');
export const flameBtn = $('#flame-btn'), flameBtnWrap = $('#flame-btn-wrap'), flameHint = $('.flame-hint');
export const healQuote = $('#heal-quote'), restartBtn = $('#restart-btn');
export const shareCardCanvas = $('#share-card-canvas'), saveCardBtn = $('#save-card-btn');

// 认证
export const authUserLabel = $('#auth-user-label');
export const btnShowLogin = $('#btn-show-login'), btnShowRegister = $('#btn-show-register'), btnLogout = $('#btn-logout');
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
export const btnGoIncinerator = $('#btn-go-incinerator');
export const btnCloseCard = $('#btn-close-card'), btnCardDownload = $('#btn-card-download');

// Canvas 2D 上下文
export const ctxPoster = posterCanvas.getContext('2d'), ctxFire = fireCanvas.getContext('2d');

// 昵称
export const nicknameOverlay = $('#nickname-overlay'), nicknameInput = $('#nickname-input');
export const btnNicknameSubmit = $('#btn-nickname-submit');

// 排行榜
export const lbPodium = $('#lb-podium'), lbList = $('#lb-list');
export const lbEmpty = $('#lb-empty'), lbLoading = $('#lb-loading');
export const lbStats = $('#lb-stats'), lbUserCount = $('#lb-user-count'), lbBurnCount = $('#lb-burn-count');
export const btnLbGoIncinerator = $('#btn-lb-go-incinerator');

// 动态
export const feedList = $('#feed-list'), feedEmpty = $('#feed-empty'), feedLoading = $('#feed-loading');
export const feedSentinel = $('#feed-sentinel');
export const feedPublishToggle = $('#publish-toggle-input');
export const feedPublishStatus = $('#feed-publish-status'), feedPublishBtn = $('#feed-publish-btn');
