import { lbPodium, lbList, lbEmpty, lbLoading, lbStats, lbUserCount, lbBurnCount } from './dom.js';
import { getCurrentUser } from './auth.js';
import { SUPABASE_URL } from './config.js';
import { authHeaders } from './auth.js';
import { escapeHTML } from './utils.js';

const MEDAL_COLORS = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const MEDAL_SVG = {
  1: '<svg class="lb-crown" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 19h12"/><path d="M8 19V11a4 4 0 0 1 8 0v8"/><path d="M12 4l2 5h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>',
  2: '<svg class="lb-medal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M8 12v9l4-3 4 3v-9"/></svg>',
  3: '<svg class="lb-medal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M8 12v9l4-3 4 3v-9"/></svg>'
};

function renderPodium(top3) {
  lbPodium.innerHTML = '';

  if (top3.length === 0) return;

  // #1 独占首行
  const gold = renderPodiumCard(top3[0], 1);
  lbPodium.appendChild(gold);

  if (top3.length >= 2) {
    const row = document.createElement('div');
    row.className = 'lb-podium-row';
    row.appendChild(renderPodiumCard(top3[1], 2));
    if (top3.length >= 3) {
      row.appendChild(renderPodiumCard(top3[2], 3));
    }
    lbPodium.appendChild(row);
  }
}

function renderPodiumCard(row, rank) {
  const card = document.createElement('div');
  card.className = `lb-podium-card ${MEDAL_COLORS[rank] || ''}`;
  if (getCurrentUser() && row.user_id === getCurrentUser().id) {
    card.classList.add('is-you');
  }

  const date = row.latest_burn
    ? new Date(row.latest_burn).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : '';

  card.innerHTML =
    `<div class="lb-podium-badge">${MEDAL_SVG[rank] || ''}<span class="lb-podium-rank">${rank}</span></div>` +
    `<div class="lb-podium-nick">${escapeHTML(row.nickname)}${card.classList.contains('is-you') ? ' <span class="lb-you-tag">你</span>' : ''}</div>` +
    `<div class="lb-podium-stats">` +
      `<span>焚烧 <strong>${row.total_burns}</strong> 次</span>` +
      `<span class="lb-stats-sep">·</span>` +
      `<span>最多：<strong>${escapeHTML(row.top_crime)}</strong></span>` +
      (date ? `<span class="lb-stats-sep">·</span><span>最近 ${date}</span>` : '') +
    `</div>`;

  return card;
}

function renderRankList(rows) {
  lbList.innerHTML = '';
  if (rows.length === 0) {
    // 检查是否只有 top3 用户
    if (lbPodium.children.length === 0) return;
    const note = document.createElement('div');
    note.className = 'lb-end-note';
    note.textContent = '— 以上为全部上榜者 —';
    lbList.appendChild(note);
    return;
  }

  const currentUserId = getCurrentUser()?.id;

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'lb-rank-row';
    if (currentUserId && row.user_id === currentUserId) {
      item.classList.add('is-you');
    }

    item.innerHTML =
      `<span class="lb-rank-num">#${row.rank}</span>` +
      `<span class="lb-rank-nick">${escapeHTML(row.nickname)}${item.classList.contains('is-you') ? ' <span class="lb-you-tag">你</span>' : ''}</span>` +
      `<span class="lb-rank-crime">${escapeHTML(row.top_crime)}</span>` +
      `<span class="lb-rank-count">${row.total_burns} 次</span>`;

    lbList.appendChild(item);
  });

  const end = document.createElement('div');
  end.className = 'lb-end-note';
  end.textContent = '— 仅显示已上榜用户 —';
  lbList.appendChild(end);
}

export async function loadLeaderboard() {
  lbPodium.innerHTML = '';
  lbList.innerHTML = '';
  lbEmpty.style.display = 'none';
  lbLoading.style.display = 'block';
  lbStats.style.display = 'none';

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}'
    });

    if (!res.ok) {
      lbLoading.style.display = 'none';
      lbEmpty.style.display = 'block';
      return;
    }

    const rows = await res.json();
    lbLoading.style.display = 'none';

    if (!rows || rows.length === 0) {
      lbEmpty.style.display = 'block';
      return;
    }

    // 统计
    const totalBurns = rows.reduce((sum, r) => sum + parseInt(r.total_burns, 10), 0);
    lbUserCount.textContent = rows.length;
    lbBurnCount.textContent = totalBurns;
    lbStats.style.display = '';

    // 渲染
    const top3 = rows.slice(0, 3);
    const rest = rows.slice(3);
    renderPodium(top3);
    renderRankList(rest);

  } catch (e) {
    console.error('[leaderboard] 加载失败:', e);
    lbLoading.style.display = 'none';
    lbEmpty.style.display = 'block';
  }
}
