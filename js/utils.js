import { getCurrentUser } from './auth.js';

// 每日免费判断
export function canFreeUseToday() {
  const lastUse = localStorage.getItem('last_free_use_date');
  const today = new Date().toISOString().slice(0, 10);
  return lastUse !== today;
}

export function markFreeUsed() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem('last_free_use_date', today);
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// FBM 噪声
export function hash(x,y) { let h=x*374761393+y*668265263+1274126177; h=(h^(h>>>13))*1274126177; return (h^(h>>>16))/4294967296; }
export function smoothNoise(x,y) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const n00=hash(ix,iy),n10=hash(ix+1,iy),n01=hash(ix,iy+1),n11=hash(ix+1,iy+1);
  return n00+(n10-n00)*sx+(n01-n00)*sy+((n11-n01)-(n10-n00))*sx*sy;
}
export function fbm(x,y,o=3) { let v=0,a=1,f=1,m=0; for(let i=0;i<o;i++){v+=a*smoothNoise(x*f,y*f);m+=a;a*=0.5;f*=2;} return v/m; }

// 文本折行
export function wrapText(ctx, text, maxWidth) {
  const lines = []; let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
