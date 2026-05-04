import { canvasWrapper, posterCanvas, fireCanvas, ctxPoster } from './dom.js';
import { VERDICTS, GENERIC_VERDICTS, pick } from './data.js';
import { wrapText } from './utils.js';
import { STAMP_DURATION } from './config.js';

// ──── 模块状态 ────
export let sourceCanvas = null, posterThumb = null;
export let stampParams = { x: 0, y: 0, r: 0 };
export let isStampAnimating = false;
export let stampStartTime = 0;
export let nameY = 0, crimeLabelY = 0;
export let crimeLabelCenter = { x: 0, y: 0 };
export let verdictStartY = 0;

export function resetPosterState() {
  sourceCanvas = null; posterThumb = null;
  isStampAnimating = false; stampStartTime = 0;
  nameY = 0; crimeLabelY = 0;
  crimeLabelCenter = { x: 0, y: 0 };
  verdictStartY = 0;
  stopTypewriter();
  typePhase = 0; typewriterIndex = 0; typewriterLines = [];
}

export function resizeCanvases() {
  const rect = canvasWrapper.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const iw = Math.floor(rect.width * dpr), ih = Math.floor(rect.height * dpr);
  for (const c of [posterCanvas, fireCanvas]) {
    if (c.width !== iw || c.height !== ih) {
      c.width = iw; c.height = ih;
      c.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
    }
  }
}

export function drawPosterStatic(ctx, w, h, name, crime) {
  const pad = w * 0.06;
  ctx.fillStyle = '#f4e1b3'; ctx.fillRect(0, 0, w, h);
  // 做旧
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * w, sy = Math.random() * h, sr = Math.random() * 30 + 5;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, 'rgba(160,130,80,0.15)'); grad.addColorStop(1, 'rgba(160,130,80,0)');
    ctx.fillStyle = grad; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.38, w / 2, h / 2, w * 0.7);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)'); edgeGrad.addColorStop(1, 'rgba(80,60,30,0.25)');
  ctx.fillStyle = edgeGrad; ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 三层边框
  const b1 = pad, b2 = pad + 6, b3 = pad + 14;
  ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 5; ctx.strokeRect(b1, b1, w - b1 * 2, h - b1 * 2);
  ctx.strokeStyle = '#d4c094'; ctx.lineWidth = 1; ctx.strokeRect(b2, b2, w - b2 * 2, h - b2 * 2);
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 1.5; ctx.strokeRect(b3, b3, w - b3 * 2, h - b3 * 2);
  // 十字装饰
  const crossSize = 10;
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 1.5;
  [[b3, b3], [w - b3, b3], [b3, h - b3], [w - b3, h - b3]].forEach(([cx, cy]) => {
    ctx.beginPath(); ctx.moveTo(cx - crossSize, cy); ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize); ctx.lineTo(cx, cy + crossSize); ctx.stroke();
  });

  const cx = w / 2; let cy = b3 + 30;
  ctx.fillStyle = '#1a0f0a';
  ctx.font = `bold ${w * 0.09}px 'STKaiti','KaiTi','楷体','SimSun',serif`;
  ctx.textAlign = 'center';
  const isMood = burnType === 'mood';
  ctx.fillText(isMood ? '情绪焚烧令' : '情感通缉令', cx, cy);
  cy += h * 0.045;

  ctx.fillStyle = '#8b1a1a';
  ctx.font = `bold ${w * 0.11}px 'Times New Roman','STSong','SimSun',serif`;
  ctx.fillText(isMood ? '★ INCINERATE ★' : '★ WANTED ★', cx, cy);
  cy += h * 0.035;

  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(w * 0.2, cy); ctx.lineTo(w * 0.8, cy); ctx.stroke();
  cy += h * 0.04;

  if (isMood) {
    // ── 焚烧令专属布局：火焰符号 + 焚烧对象 ──
    const flameCY = cy + h * 0.09;
    // 中心火焰/太阳符号
    const flameR = w * 0.08;
    ctx.fillStyle = '#1a0f0a';
    ctx.beginPath(); ctx.arc(cx, flameCY, flameR, 0, Math.PI * 2); ctx.fill();
    // 散射光线
    ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 1;
    const rayCount = 12, rayInner = flameR + w * 0.015, rayOuter = flameR + w * 0.04;
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rayInner, flameCY + Math.sin(a) * rayInner);
      ctx.lineTo(cx + Math.cos(a) * rayOuter, flameCY + Math.sin(a) * rayOuter);
      ctx.stroke();
    }
    // 内部小火焰形状
    ctx.fillStyle = '#f4e1b3';
    ctx.beginPath();
    ctx.moveTo(cx, flameCY - flameR * 0.55);
    ctx.quadraticCurveTo(cx + flameR * 0.4, flameCY - flameR * 0.1, cx + flameR * 0.2, flameCY + flameR * 0.35);
    ctx.quadraticCurveTo(cx + flameR * 0.05, flameCY + flameR * 0.1, cx, flameCY + flameR * 0.45);
    ctx.quadraticCurveTo(cx - flameR * 0.05, flameCY + flameR * 0.1, cx - flameR * 0.2, flameCY + flameR * 0.35);
    ctx.quadraticCurveTo(cx - flameR * 0.4, flameCY - flameR * 0.1, cx, flameCY - flameR * 0.55);
    ctx.fill();

    cy = flameCY + flameR + w * 0.04 + h * 0.035;
    ctx.fillStyle = '#8b1a1a';
    ctx.font = `${w * 0.035}px 'STKaiti','KaiTi','楷体',serif`;
    ctx.fillText('【 焚 烧 对 象 】', cx, cy);
    cy += h * 0.06;
    nameY = cy;
    cy += h * 0.07;

    ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(w * 0.15, cy); ctx.lineTo(w * 0.85, cy); ctx.stroke();
    verdictStartY = cy + h * 0.04;
    crimeLabelY = cy; // 占位，mood 无罪名标签
    crimeLabelCenter = { x: cx, y: cy };
    return verdictStartY;
  }

  // ── 通缉令布局（原版） ──
  const portraitSize = h * 0.18, portraitY = cy;
  ctx.strokeStyle = '#8b1a1a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(cx - portraitSize * 0.55, portraitY, portraitSize * 1.1, portraitSize);
  ctx.setLineDash([]);
  const px = cx, py = portraitY + portraitSize * 0.3;
  ctx.fillStyle = '#1a0f0a'; ctx.beginPath(); ctx.arc(px, py, portraitSize * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(px, py + portraitSize * 0.13); ctx.lineTo(px, py + portraitSize * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px - portraitSize * 0.15, py + portraitSize * 0.22); ctx.lineTo(px + portraitSize * 0.15, py + portraitSize * 0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px, py + portraitSize * 0.42); ctx.lineTo(px - portraitSize * 0.12, py + portraitSize * 0.65);
  ctx.moveTo(px, py + portraitSize * 0.42); ctx.lineTo(px + portraitSize * 0.12, py + portraitSize * 0.65); ctx.stroke();

  ctx.fillStyle = '#8b1a1a'; ctx.font = `${w * 0.035}px 'STKaiti','KaiTi','楷体',serif`;
  ctx.fillText('【 嫌疑人 】', cx, portraitY + portraitSize + h * 0.03);
  cy = portraitY + portraitSize + h * 0.08;
  nameY = cy;
  cy += h * 0.05;
  crimeLabelY = cy;
  const crimeH = h * 0.04;
  crimeLabelCenter = { x: cx, y: cy + crimeH * 0.15 };
  cy += h * 0.06;

  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(w * 0.15, cy); ctx.lineTo(w * 0.85, cy); ctx.stroke();
  verdictStartY = cy + h * 0.04;
  return verdictStartY;
}

export function drawNameFit(ctx, cx, nameY, text, w) {
  const b3 = w * 0.06 + 14;
  const maxW = w - b3 * 2;
  let fs = w * 0.08;
  ctx.font = `bold ${fs}px 'STKaiti','KaiTi','楷体','SimSun',serif`;
  if (ctx.measureText(text).width > maxW) {
    fs *= maxW / ctx.measureText(text).width;
    ctx.font = `bold ${fs}px 'STKaiti','KaiTi','楷体','SimSun',serif`;
  }
  ctx.fillText(text, cx, nameY);
}

export function drawCrimeLabel(ctx, w, h, crime) {
  const cx = w / 2;
  ctx.save();
  ctx.font = `bold ${w * 0.038}px 'STKaiti','KaiTi','楷体','SimSun',serif`;
  const zuiW = Math.max(ctx.measureText('罪').width, w * 0.035);
  const crimeW = Math.max(ctx.measureText(crime).width, w * 0.06);
  const gap = w * 0.028;
  const padX = w * 0.025;
  const totalW = padX + zuiW + gap + crimeW + padX;
  const crimeH = h * 0.04;
  const left = cx - totalW / 2;

  ctx.fillStyle = '#1a0f0a';
  ctx.fillRect(left, crimeLabelY - crimeH * 0.7, totalW, crimeH);
  ctx.fillStyle = '#f4e1b3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('罪', left + padX + zuiW / 2, crimeLabelY);
  ctx.fillText(crime, left + padX + zuiW + gap + crimeW / 2, crimeLabelY);
  ctx.restore();
}

export function drawVerdictFooter(ctx, w, h, verdictText) {
  const lineHeight = h * 0.042;
  ctx.font = `${w * 0.032}px 'STSong','SimSun','宋体',serif`;
  const allLines = wrapText(ctx, verdictText, w * 0.60);
  const afterVerdict = verdictStartY + allLines.length * lineHeight + h * 0.03;
  let cy = afterVerdict;
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(w * 0.2, cy); ctx.lineTo(w * 0.8, cy); ctx.stroke();
  cy += h * 0.03;
  ctx.fillStyle = '#8b1a1a';
  ctx.font = `bold ${w * 0.033}px 'STKaiti','KaiTi','楷体',serif`;
  ctx.textAlign = 'center';
  ctx.fillText(burnType === 'mood' ? '情感国际法庭 · 焚烧仪式' : '情感国际法庭 · 终审判决', w / 2, cy);
  cy += h * 0.032;
  ctx.font = `${w * 0.026}px 'STKaiti','KaiTi','楷体',serif`;
  ctx.fillText(burnType === 'mood' ? '灰烬之中 · 轻装前行' : '不得上诉 · 立即执行', w / 2, cy);
  const b3 = w * 0.06 + 14;
  stampParams.x = w - b3 - w * 0.1;
  stampParams.y = h - b3 - h * 0.1;
  stampParams.r = w * 0.11;
}

export function finalizeToSource(w, h, phase, currentName, selectedCrime, currentVerdict, typewriterLines) {
  const sctx = sourceCanvas.getContext('2d');
  const cx = w / 2;
  sctx.fillStyle = '#1a0f0a';
  sctx.textAlign = 'center';
  drawNameFit(sctx, cx, nameY, currentName, w);
  if (burnType !== 'mood') drawCrimeLabel(sctx, w, h, selectedCrime);
  if (phase >= 2) {
    const lh = h * 0.042;
    sctx.fillStyle = '#1a0f0a';
    sctx.font = `${w * 0.032}px 'STSong','SimSun','宋体',serif`;
    sctx.textAlign = 'center';
    for (let i = 0; i < typewriterLines.length; i++) {
      sctx.fillText(typewriterLines[i], cx, verdictStartY + i * lh);
    }
  }
  if (phase >= 3) {
    drawVerdictFooter(sctx, w, h, currentVerdict);
  }
}

let selectedCrime = '';
let burnType = 'ex';
export function setSelectedCrime(c) { selectedCrime = c; }
export function setBurnType(t) { burnType = t || 'ex'; }

export function drawTypewriterFrame(ctx, w, h, lineHeight, typePhase, typewriterIndex, typewriterLines, currentName, selectedCrime) {
  const cx = w / 2;
  const isMood = burnType === 'mood';
  ctx.fillStyle = '#1a0f0a';
  ctx.textAlign = 'center';
  if (typePhase === 0) {
    drawNameFit(ctx, cx, nameY, currentName.substring(0, typewriterIndex), w);
  } else {
    drawNameFit(ctx, cx, nameY, currentName, w);
  }
  // 罪名标签阶段（mood 跳过）
  if (!isMood && typePhase >= 1) {
    if (typePhase === 1) {
      ctx.save();
      ctx.font = `bold ${w * 0.038}px 'STKaiti','KaiTi','楷体','SimSun',serif`;
      const zuiW = Math.max(ctx.measureText('罪').width, w * 0.035);
      const cw = Math.max(ctx.measureText(selectedCrime).width, w * 0.06);
      const g = w * 0.028;
      const p = w * 0.025;
      const tw = p + zuiW + g + cw + p;
      const crimeH = h * 0.04;
      const l = cx - tw / 2;
      ctx.fillStyle = '#1a0f0a';
      ctx.fillRect(l, crimeLabelY - crimeH * 0.7, tw, crimeH);
      ctx.fillStyle = '#f4e1b3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('罪', l + p + zuiW / 2, crimeLabelY);
      ctx.fillText(selectedCrime.substring(0, typewriterIndex), l + p + zuiW + g + cw / 2, crimeLabelY);
      ctx.restore();
    } else {
      drawCrimeLabel(ctx, w, h, selectedCrime);
    }
  }
  // 判词阶段
  const verdictPhase = isMood ? 1 : 2;
  if (typePhase >= verdictPhase) {
    const chars = typePhase === verdictPhase ? typewriterIndex : Infinity;
    ctx.fillStyle = '#1a0f0a';
    ctx.font = `${w * 0.032}px 'STSong','SimSun','宋体',serif`;
    ctx.textAlign = 'center';
    let remaining = chars;
    for (let i = 0; i < typewriterLines.length; i++) {
      if (remaining <= 0) break;
      const line = typewriterLines[i];
      const show = Math.min(remaining, line.length);
      ctx.fillText(line.substring(0, show), cx, verdictStartY + i * lineHeight);
      remaining -= show;
    }
  }
  // 页脚阶段
  const footerPhase = isMood ? 2 : 3;
  if (typePhase >= footerPhase) {
    const allLines = typewriterLines;
    const afterVerdict = verdictStartY + allLines.length * lineHeight + h * 0.03;
    ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(w * 0.2, afterVerdict); ctx.lineTo(w * 0.8, afterVerdict); ctx.stroke();
    const footerLines = isMood
      ? ['情感国际法庭 · 焚烧仪式', '灰烬之中 · 轻装前行']
      : ['情感国际法庭 · 终审判决', '不得上诉 · 立即执行'];
    const footerFonts = [`bold ${w * 0.033}px 'STKaiti','KaiTi','楷体',serif`, `${w * 0.026}px 'STKaiti','KaiTi','楷体',serif`];
    let fcy = afterVerdict + h * 0.03;
    let remaining = typewriterIndex;
    for (let fl = 0; fl < footerLines.length; fl++) {
      if (remaining <= 0) break;
      const txt = footerLines[fl];
      const show = Math.min(remaining, txt.length);
      ctx.fillStyle = '#8b1a1a';
      ctx.font = footerFonts[fl];
      ctx.fillText(txt.substring(0, show), cx, fcy);
      remaining -= show;
      fcy += h * 0.032;
    }
  }
}

export function renderPosterToSource(selectedCrime, currentName, aiVerdict) {
  resizeCanvases();
  const w = posterCanvas.width, h = posterCanvas.height;
  sourceCanvas = new OffscreenCanvas(w, h);
  const ctx = sourceCanvas.getContext('2d');
  const verdict = aiVerdict
    || (VERDICTS[selectedCrime] ? pick(VERDICTS[selectedCrime]) : pick(GENERIC_VERDICTS).replace(/\{crime\}/g, selectedCrime));
  drawPosterStatic(ctx, w, h, currentName, selectedCrime);
  posterThumb = sourceCanvas.convertToBlob({ type: 'image/png' }).then(b => URL.createObjectURL(b));
  return verdict;
}

export function renderPosterToMain() {
  if (!sourceCanvas) return;
  ctxPoster.clearRect(0, 0, posterCanvas.width, posterCanvas.height);
  ctxPoster.drawImage(sourceCanvas, 0, 0);
}

// 为历史记录渲染完整通缉令海报（含印章）
export function renderHistoryPoster(name, crime, verdict, recBurnType) {
  const prevBurnType = burnType;
  if (recBurnType) burnType = recBurnType;
  const w = 800, h = w / 0.72;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const cx = w / 2;

  drawPosterStatic(ctx, w, h, name, crime);

  ctx.fillStyle = '#1a0f0a';
  ctx.textAlign = 'center';
  drawNameFit(ctx, cx, nameY, name, w);
  if (burnType !== 'mood') drawCrimeLabel(ctx, w, h, crime);

  const lineHeight = h * 0.042;
  ctx.font = `${w * 0.032}px 'STSong','SimSun','宋体',serif`;
  const vLines = wrapText(ctx, verdict, w * 0.60);
  for (let i = 0; i < vLines.length; i++) {
    ctx.fillText(vLines[i], cx, verdictStartY + i * lineHeight);
  }

  drawVerdictFooter(ctx, w, h, verdict);
  drawStamp(ctx, stampParams.x, stampParams.y, stampParams.r, 1.0, -0.3, 0.8);

  burnType = prevBurnType;
  return canvas;
}

// ──── 印章 ────
export function drawStamp(ctx, x, y, r, scale, rot, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  ctx.fillStyle = `rgba(178,34,34,${alpha * 0.82})`;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.globalAlpha = alpha * 0.22;
  for (let i = 0; i < 20; i++) {
    const sx = (Math.random() - 0.5) * r * 1.5;
    const sy = (Math.random() - 0.5) * r * 1.5;
    const sr = Math.random() * r * 0.12 + r * 0.04;
    ctx.fillStyle = `rgba(120,20,20,${Math.random() * 0.4})`;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const teeth = 24;
  const outerR = r * 0.88;
  const innerR = r * 0.78;
  const toothHeight = r * 0.07;
  ctx.strokeStyle = `rgba(190,40,40,${alpha * 0.88})`;
  ctx.lineWidth = r * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const baseR = i % 2 === 0 ? outerR + toothHeight : outerR;
    const px = Math.cos(a) * baseR, py = Math.sin(a) * baseR;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();

  ctx.strokeStyle = `rgba(190,40,40,${alpha * 0.7})`;
  ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI * 2); ctx.stroke();

  const crossR = r * 0.65;
  const crossSize = r * 0.08;
  ctx.strokeStyle = `rgba(244,225,179,${alpha * 0.5})`;
  ctx.lineWidth = r * 0.022;
  ctx.lineCap = 'round';
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(angle => {
    const cx0 = Math.cos(angle) * crossR, cy0 = Math.sin(angle) * crossR;
    ctx.beginPath();
    ctx.moveTo(cx0 - crossSize, cy0); ctx.lineTo(cx0 + crossSize, cy0);
    ctx.moveTo(cx0, cy0 - crossSize); ctx.lineTo(cx0, cy0 + crossSize);
    ctx.stroke();
  });

  const fontSize = r * 0.52;
  ctx.font = `bold ${fontSize}px 'STKaiti','KaiTi','楷体','STSong','SimSun','PingFang SC',serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(244,225,179,${alpha * 0.93})`;
  ctx.fillText(burnType === 'mood' ? '已焚' : '已判', 0, r * 0.02);
  ctx.restore();
}

export function startStampAnimation(audioEngine) {
  isStampAnimating = true;
  stampStartTime = performance.now();
  audioEngine.playStamp();
}

export function updateStampAnimation() {
  const elapsed = performance.now() - stampStartTime;
  const t = Math.min(elapsed / STAMP_DURATION, 1);

  let scale, rot, alpha;
  if (t < 0.16) {
    const s = t / 0.16;
    scale = 3.0 - s * 1.92;
    rot = -0.6 * (1 - s);
    alpha = 0.3 + s * 0.7;
  } else if (t < 0.4) {
    const s = (t - 0.16) / 0.24;
    scale = 1.08 + Math.sin(s * Math.PI) * 0.12 - s * 0.13;
    rot = -0.3 + Math.sin(s * Math.PI * 2) * 0.08;
    alpha = 0.9 + Math.sin(s * Math.PI) * 0.1;
  } else if (t < 0.7) {
    const s = (t - 0.4) / 0.3;
    scale = 0.95 + Math.sin(s * Math.PI) * 0.07;
    rot = -0.3 + Math.sin(s * Math.PI) * 0.04;
    alpha = 0.78 + Math.sin(s * Math.PI) * 0.07;
  } else {
    const s = (t - 0.7) / 0.3;
    scale = 0.95 + s * 0.05;
    rot = -0.3 * s;
    alpha = 0.78 + s * 0.02;
  }

  const w = posterCanvas.width, h = posterCanvas.height;
  ctxPoster.clearRect(0, 0, w, h);
  ctxPoster.drawImage(sourceCanvas, 0, 0);
  drawStamp(ctxPoster, stampParams.x, stampParams.y, stampParams.r, scale, rot, alpha);

  if (t >= 1) {
    isStampAnimating = false;
    ctxPoster.clearRect(0, 0, w, h);
    ctxPoster.drawImage(sourceCanvas, 0, 0);
    drawStamp(ctxPoster, stampParams.x, stampParams.y, stampParams.r, 1.0, -0.3, 0.8);
    drawStamp(sourceCanvas.getContext('2d'), stampParams.x, stampParams.y, stampParams.r, 1.0, -0.3, 0.8);
  }
}

// ──── 打字机 ────
let typewriterTimer = null;
export let typePhase = 0;
export let typewriterIndex = 0;
export let typewriterLines = [];

export function stopTypewriter() {
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
}

export function startTypewriter(w, h, ctxPoster, currentVerdict, currentName, selectedCrime, onTick, onComplete) {
  typePhase = 0;
  typewriterIndex = 0;
  ctxPoster.font = `${w * 0.032}px 'STSong','SimSun','宋体',serif`;
  typewriterLines = wrapText(ctxPoster, currentVerdict, w * 0.60);
  stopTypewriter();

  const lineHeight = h * 0.042;
  const nameChars = currentName.length;
  const crimeChars = burnType === 'mood' ? 0 : selectedCrime.length;
  let verdictTotal = 0;
  for (const l of typewriterLines) verdictTotal += l.length;
  const footerTotal = (burnType === 'mood'
    ? '情感国际法庭 · 焚烧仪式灰烬之中 · 轻装前行'
    : '情感国际法庭 · 终审判决不得上诉 · 立即执行').length;
  const isMood = burnType === 'mood';
  const phaseLimits = isMood
    ? [nameChars, verdictTotal, footerTotal]
    : [nameChars, crimeChars, verdictTotal, footerTotal];
  const phaseSpeeds = isMood
    ? [
        Math.max(1, Math.ceil(nameChars / 8)),
        Math.max(1, Math.ceil(verdictTotal / 50)),
        Math.max(1, Math.ceil(footerTotal / 12))
      ]
    : [
        Math.max(1, Math.ceil(nameChars / 8)),
        Math.max(1, Math.ceil(crimeChars / 8)),
        Math.max(1, Math.ceil(verdictTotal / 50)),
        Math.max(1, Math.ceil(footerTotal / 12))
      ];
  const maxPhase = isMood ? 3 : 4;

  typewriterTimer = setInterval(() => {
    typewriterIndex += phaseSpeeds[typePhase];
    onTick();

    while (typePhase < maxPhase && typewriterIndex >= phaseLimits[typePhase]) {
      typewriterIndex = 0;
      typePhase++;
      if (!isMood && typePhase <= 1) finalizeToSource(w, h, typePhase, currentName, selectedCrime, currentVerdict, typewriterLines);
      else if (isMood && typePhase <= 0) finalizeToSource(w, h, typePhase, currentName, selectedCrime, currentVerdict, typewriterLines);
    }

    if (typePhase >= maxPhase) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      finalizeToSource(w, h, 3, currentName, selectedCrime, currentVerdict, typewriterLines);
      onComplete();
      return;
    }

    ctxPoster.clearRect(0, 0, w, h);
    ctxPoster.drawImage(sourceCanvas, 0, 0);
    drawTypewriterFrame(ctxPoster, w, h, lineHeight, typePhase, typewriterIndex, typewriterLines, currentName, selectedCrime);
  }, 60);

  return typewriterTimer;
}
