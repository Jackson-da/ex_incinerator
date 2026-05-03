import { feedList, feedEmpty, feedLoading, feedSentinel } from './dom.js';
import { getCurrentUser, authHeaders } from './auth.js';
import { SUPABASE_URL } from './config.js';
import { escapeHTML, isLoggedIn } from './utils.js';

const PAGE_SIZE = 10;
let currentPage = 0;
let hasMore = true;
let loadingMore = false;
let observer = null;
let expandedCommentCard = null;

// ──── 相对时间 ────
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + '分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + '小时前';
  const day = Math.floor(hr / 24);
  if (day < 7) return day + '天前';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ──── 判决截断 ────
function truncateVerdict(text, maxLen = 80) {
  if (text.length <= maxLen) return escapeHTML(text);
  return escapeHTML(text.slice(0, maxLen)) + '...';
}

// ──── 渲染单条评论 ────
function renderComment(c) {
  return `<div class="feed-comment">
    <span class="feed-comment-nick">${escapeHTML(c.nickname)}</span>
    <span class="feed-comment-content">${escapeHTML(c.content)}</span>
  </div>`;
}

// ──── 渲染评论区 ────
function renderCommentSection(rec, comments) {
  const listHtml = comments.map(renderComment).join('');
  const currentUserId = getCurrentUser()?.id;
  const inputDisabled = !currentUserId ? 'disabled' : '';
  const inputPlaceholder = currentUserId ? '写下评论...' : '登录后才能评论';

  return `<div class="feed-comments" id="feed-comments-${rec.record_id}">
    <div class="feed-comments-list" id="feed-comments-list-${rec.record_id}">
      ${listHtml || '<p class="feed-comments-empty">暂无评论</p>'}
    </div>
    <div class="feed-comment-input-row">
      <input type="text"
        class="feed-comment-input"
        id="feed-comment-input-${rec.record_id}"
        placeholder="${inputPlaceholder}"
        maxlength="200"
        ${inputDisabled}>
      <button class="feed-comment-submit"
        id="feed-comment-submit-${rec.record_id}"
        ${inputDisabled ? 'disabled' : ''}>发送</button>
    </div>
  </div>`;
}

// ──── 渲染单张动态卡片 ────
function renderFeedCard(rec) {
  const likedClass = rec.liked_by_me ? 'liked' : '';

  return `<div class="feed-card" id="feed-card-${rec.record_id}">
    <div class="feed-card-header">
      <span class="feed-nickname">${escapeHTML(rec.nickname)}</span>
      <span class="feed-dot">·</span>
      <span class="feed-action">焚烧了「${escapeHTML(rec.ex_name)}」</span>
      <span class="feed-time">${relativeTime(rec.burned_at)}</span>
    </div>
    <div class="feed-card-body">
      <span class="feed-crime-tag">${escapeHTML(rec.crime)}</span>
      <p class="feed-verdict">${truncateVerdict(rec.verdict)}</p>
    </div>
    <div class="feed-card-footer">
      <button class="feed-btn-like ${likedClass}" data-record="${rec.record_id}" aria-label="${rec.liked_by_me ? '取消点赞' : '点赞'}">
        <svg class="feed-like-icon" viewBox="0 0 24 24" fill="${rec.liked_by_me ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>${rec.like_count || 0}</span>
      </button>
      <button class="feed-btn-comment" data-record="${rec.record_id}" aria-label="评论">
        <svg class="feed-comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${rec.comment_count || 0}</span>
      </button>
    </div>
  </div>`;
}

// ──── 绑定卡片事件 ────
function bindCardEvents(cardEl, rec) {
  // 点赞
  const likeBtn = cardEl.querySelector('.feed-btn-like');
  likeBtn.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      const { showAuthModal } = await import('./ui.js');
      showAuthModal('login');
      return;
    }
    const countEl = likeBtn.querySelector('span');
    const iconEl = likeBtn.querySelector('.feed-like-icon');
    const prevLiked = likeBtn.classList.contains('liked');
    const prevCount = parseInt(countEl.textContent, 10) || 0;

    // 乐观更新
    likeBtn.classList.toggle('liked', !prevLiked);
    countEl.textContent = prevLiked ? prevCount - 1 : prevCount + 1;
    iconEl.setAttribute('fill', prevLiked ? 'none' : 'currentColor');

    // 弹跳动画
    likeBtn.style.transition = 'transform 0.14s ease-out';
    likeBtn.style.transform = 'scale(1.3)';
    setTimeout(() => { likeBtn.style.transform = 'scale(1)'; }, 140);

    const { toggleFeedLike } = await import('./api.js');
    const { data, error } = await toggleFeedLike(rec.record_id);
    if (error) {
      likeBtn.classList.toggle('liked', prevLiked);
      countEl.textContent = prevCount;
      iconEl.setAttribute('fill', prevLiked ? 'currentColor' : 'none');
    } else if (data) {
      countEl.textContent = data.like_count || 0;
      likeBtn.classList.toggle('liked', data.liked);
      iconEl.setAttribute('fill', data.liked ? 'currentColor' : 'none');
    }
  });

  // 评论展开/收起
  const commentBtn = cardEl.querySelector('.feed-btn-comment');
  commentBtn.addEventListener('click', async () => {
    const existing = cardEl.querySelector('.feed-comments');
    if (existing) {
      existing.remove();
      if (expandedCommentCard === rec.record_id) expandedCommentCard = null;
      return;
    }

    // 收起其他已展开的评论
    if (expandedCommentCard && expandedCommentCard !== rec.record_id) {
      const other = document.querySelector(`#feed-card-${expandedCommentCard} .feed-comments`);
      if (other) other.remove();
    }
    expandedCommentCard = rec.record_id;

    // 加载评论
    const { fetchFeedComments } = await import('./api.js');
    const comments = await fetchFeedComments(rec.record_id, 1, PAGE_SIZE);
    const sectionHtml = renderCommentSection(rec, comments);
    cardEl.insertAdjacentHTML('beforeend', sectionHtml);

    // 绑定评论提交
    const submitBtn = cardEl.querySelector('.feed-comment-submit');
    const inputEl = cardEl.querySelector('.feed-comment-input');
    if (submitBtn && inputEl && !submitBtn.disabled) {
      submitBtn.addEventListener('click', async () => {
        const content = inputEl.value.trim();
        if (!content) return;
        submitBtn.disabled = true;
        submitBtn.textContent = '发送中...';

        const { addFeedComment } = await import('./api.js');
        const { data, error } = await addFeedComment(rec.record_id, content);
        if (error) {
          submitBtn.disabled = false;
          submitBtn.textContent = '发送';
          return;
        }

        const listEl = cardEl.querySelector('.feed-comments-list');
        const emptyEl = listEl.querySelector('.feed-comments-empty');
        if (emptyEl) emptyEl.remove();
        listEl.insertAdjacentHTML('beforeend', renderComment(data));

        const commentCountEl = commentBtn.querySelector('span');
        commentCountEl.textContent = (parseInt(commentCountEl.textContent, 10) || 0) + 1;

        inputEl.value = '';
        submitBtn.disabled = false;
        submitBtn.textContent = '发送';
      });

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitBtn.click();
      });
    }
  });
}

// ──── 渲染动态列表 ────
function renderFeedCards(records) {
  records.forEach(rec => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderFeedCard(rec);
    const cardEl = wrapper.firstElementChild;
    bindCardEvents(cardEl, rec);
    feedList.appendChild(cardEl);
  });
}

// ──── 滚动哨兵 ────
function setupSentinel() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && hasMore && !loadingMore) {
        loadMoreFeed();
      }
    });
  }, { rootMargin: '200px' });

  if (feedSentinel) observer.observe(feedSentinel);
}

// ──── 加载更多 ────
async function loadMoreFeed() {
  if (loadingMore || !hasMore) return;
  loadingMore = true;
  feedSentinel.style.display = 'block';
  feedSentinel.textContent = '加载中...';
  feedSentinel.style.color = '';

  const { fetchPublicFeed } = await import('./api.js');
  const rows = await fetchPublicFeed(currentPage + 1, PAGE_SIZE);

  if (!rows || rows.length === 0) {
    hasMore = false;
    feedSentinel.textContent = '— 没有更多了 —';
    feedSentinel.style.color = 'var(--text-muted)';
    loadingMore = false;
    return;
  }

  currentPage++;
  renderFeedCards(rows);
  loadingMore = false;

  if (rows.length < PAGE_SIZE) {
    hasMore = false;
    feedSentinel.textContent = '— 没有更多了 —';
    feedSentinel.style.color = 'var(--text-muted)';
  }
}

// ──── 公开入口 ────
export async function loadFeed() {
  if (observer) { observer.disconnect(); observer = null; }
  feedList.innerHTML = '';
  feedEmpty.style.display = 'none';
  feedLoading.style.display = 'block';
  feedSentinel.style.display = 'none';
  currentPage = 0;
  hasMore = true;
  loadingMore = false;
  expandedCommentCard = null;

  const { fetchPublicFeed } = await import('./api.js');
  const rows = await fetchPublicFeed(1, PAGE_SIZE);

  feedLoading.style.display = 'none';

  if (!rows || rows.length === 0) {
    feedEmpty.style.display = 'block';
    return;
  }

  currentPage = 1;
  renderFeedCards(rows);

  if (rows.length < PAGE_SIZE) {
    hasMore = false;
    if (feedSentinel) {
      feedSentinel.textContent = '— 没有更多了 —';
      feedSentinel.style.color = 'var(--text-muted)';
      feedSentinel.style.display = 'block';
    }
  } else {
    setupSentinel();
  }
}
