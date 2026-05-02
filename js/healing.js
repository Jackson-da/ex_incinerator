import { shareCardCanvas, healQuote, saveCardBtn } from './dom.js';
import { sourceCanvas } from './poster.js';
import { HEALING_QUOTES, HEALING_QUOTES_BY_TYPE, pick } from './data.js';
import { wrapText } from './utils.js';
import { SHARE_URL } from './config.js';

export function setHealQuote(burnType) {
  const pool = (burnType && HEALING_QUOTES_BY_TYPE[burnType]) || HEALING_QUOTES;
  healQuote.textContent = pick(pool);
  healQuote.style.animation = 'none'; healQuote.offsetHeight;
  healQuote.style.animation = 'fadeInUp 1s ease-out';
}

function drawParchmentBg(ctx, w, h) {
  ctx.fillStyle = '#f4e1b3';
  ctx.fillRect(0, 0, w, h);

  // 做旧斑点
  const rng = mulberry32(42);
  for (let i = 0; i < 70; i++) {
    const sx = rng() * w, sy = rng() * h, sr = rng() * 28 + 3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, 'rgba(160,130,80,0.12)');
    g.addColorStop(1, 'rgba(160,130,80,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  // 边缘暗化
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.33, w / 2, h / 2, w * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(80,60,30,0.22)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

function drawOrnamentBorder(ctx, w, h, pad) {
  const b1 = pad, b2 = pad + 8, b3 = pad + 20;
  ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 6;
  ctx.strokeRect(b1, b1, w - b1 * 2, h - b1 * 2);
  ctx.strokeStyle = '#d4c094'; ctx.lineWidth = 1.5;
  ctx.strokeRect(b2, b2, w - b2 * 2, h - b2 * 2);
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 2;
  ctx.strokeRect(b3, b3, w - b3 * 2, h - b3 * 2);

  const cs = 14;
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 2;
  [[b3, b3], [w - b3, b3], [b3, h - b3], [w - b3, h - b3]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy);
    ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs);
    ctx.stroke();
  });
}

function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export async function drawCard(canvas, { name, crime, verdict, healQuoteText, sourceThumb, displayMaxWidth, burnType }) {
  const w = 2000, h = 1250;
  canvas.width = w; canvas.height = h;
  const maxW = displayMaxWidth || 640;
  canvas.style.width = Math.min(maxW, window.innerWidth - 48) + 'px';
  canvas.style.height = 'auto';

  const ctx = canvas.getContext('2d');
  const pad = 60, b3 = pad + 20, contentR = w - b3;

  // ── 羊皮纸背景 + 装饰边框 ──
  drawParchmentBg(ctx, w, h);
  drawOrnamentBorder(ctx, w, h, pad);

  // ── 左侧：通缉令缩略图 ──
  const thumbW = 500, thumbH = thumbW / 0.72;
  const thumbX = b3 + 70, thumbY = (h - thumbH) / 2;

  if (sourceThumb) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 32; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 6;
    ctx.drawImage(sourceThumb, thumbX, thumbY, thumbW, thumbH);
    ctx.restore();
    ctx.strokeStyle = '#8b1a1a'; ctx.lineWidth = 2;
    ctx.strokeRect(thumbX - 4, thumbY - 4, thumbW + 8, thumbH + 8);
  }

  // ── 右侧：判决书内容 ──
  const rx = sourceThumb ? 780 : b3 + 70, maxTW = contentR - rx - 16;

  ctx.fillStyle = '#8b1a1a';
  ctx.font = 'bold 92px "STKaiti","KaiTi","楷体","SimSun",serif';
  ctx.textAlign = 'left';
  ctx.fillText('情感国际法庭', rx, 168);

  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rx, 196); ctx.lineTo(contentR - 20, 196); ctx.stroke();

  ctx.fillStyle = '#1a0f0a';
  ctx.font = 'bold 60px "STKaiti","KaiTi","楷体","SimSun",serif';
  ctx.fillText('判　决　书', rx, 272);

  ctx.font = '52px "STSong","SimSun","宋体",serif';
  if (burnType === 'mood') {
    ctx.fillText(`焚烧对象　　${name}`, rx, 372);
  } else {
    ctx.fillText(`被告人　　${name}`, rx, 372);
    ctx.fillText(`罪　名　　 ${crime}`, rx, 452);
  }

  ctx.fillStyle = '#3a2a1a';
  ctx.font = '36px "STSong","SimSun","宋体",serif';
  const shortV = verdict.length > 80 ? verdict.substring(0, 80) + '...' : verdict;
  const vLines = wrapText(ctx, shortV, maxTW);
  const verdictY = burnType === 'mood' ? 480 : 550;
  for (let i = 0; i < Math.min(vLines.length, 3); i++) {
    ctx.fillText(vLines[i], rx, verdictY + i * 56);
  }

  // 治愈语录
  ctx.fillStyle = '#7ec8a0';
  ctx.font = '34px "STKaiti","KaiTi","楷体",serif';
  const quote = healQuoteText || '';
  if (quote) ctx.fillText('「' + quote + '」', rx, 768);

  // ── 右下：二维码 ──
  const qrSize = 180, qrX = contentR - qrSize - 28, qrY = h - b3 - qrSize - 60;
  const qrCX = qrX + qrSize / 2;

  if (SHARE_URL) {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(SHARE_URL)}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = qrUrl; });
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* 加载失败则降级为占位框 */ }
  }

  // 二维码边框 + 文字（始终显示）
  ctx.strokeStyle = '#b8943e'; ctx.lineWidth = 1.5;
  ctx.strokeRect(qrX, qrY, qrSize, qrSize);
  ctx.fillStyle = '#6a6558';
  ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('扫码体验', qrCX, qrY + qrSize + 36);
}

export async function generateShareCard(currentName, selectedCrime, currentVerdict, burnType) {
  shareCardCanvas.style.display = 'block';
  saveCardBtn.style.display = 'block';
  await drawCard(shareCardCanvas, {
    name: currentName,
    crime: selectedCrime,
    verdict: currentVerdict,
    healQuoteText: healQuote.textContent,
    sourceThumb: sourceCanvas,
    burnType
  });
}
