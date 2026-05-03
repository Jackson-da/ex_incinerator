# 前任焚烧炉 — 项目上下文

## 项目概览

「前任焚烧炉」是一个情感宣泄向 Web 应用。用户选择焚烧类型，输入名字和罪名，生成复古通缉令海报，长按燃烧，最后获得治愈语录和分享卡片。

## 技术栈

- **前端**：原生 JS + Canvas 2D + Web Audio API，零框架
- **模块**：ES modules，Vite dev/build（`npm run dev` / `npm run build`）
- **后端**：Supabase PostgREST + Auth REST API，纯 fetch，无 SDK
- **数据库**：PostgreSQL，RLS 行级安全，SECURITY DEFINER 函数绕过 RLS
- **设计**：Dark Editorial Premium — `#050505` 底板 + `#FF5E13` 火焰橙 + `#C8A44E` 金铜

## 文件职责

```
js/config.js     — SUPABASE_URL/ANON_KEY + 动画常量
js/data.js       — 罪名库、判决文案库、治愈语录库、焚烧类型定义
js/dom.js        — $/$$ 快捷函数 + 全部 DOM 元素引用（集中管理）
js/utils.js      — 每日免费判断、escapeHTML、FBM 噪声、wrapText
js/audio.js      — Web Audio API 全合成音效（无外部音频文件）
js/auth.js       — Supabase Auth（注册/登录/登出/Token刷新/昵称系统）
js/api.js        — Supabase REST CRUD：保存/读取/删除焚烧记录 + 动态 API
js/poster.js     — Canvas 通缉令绘制 + 打字机状态机 + 印章动画
js/burn.js       — 粒子系统 + FBM 燃烧 + 渐显/擦除
js/healing.js    — 治愈阶段 + 判决书分享卡片生成
js/ui.js         — 标签页切换 + 类型选择 + 罪名标签 + 认证弹窗 + 历史面板
js/leaderboard.js— 排行榜 RPC 调用 + 领奖台 + 排行列表
js/feed.js       — 动态流：滚动分页 + 点赞（乐观更新）+ 内嵌评论
js/app.js        — 编排层：流程状态机 + 动画循环 + 事件绑定
css/style.css    — 全部样式（~1000行），CSS 变量系统
index.html       — HTML 骨架（~200行），4 个标签页 + 弹窗 + Canvas
```

## 数据库表

- `profiles (id uuid PK, nickname text)` — RLS 仅本人读写
- `burn_records (id uuid PK, user_id, ex_name, crime, verdict, heal_quote, is_public, burn_type, burned_at)` — RLS: SELECT/INSERT/UPDATE/DELETE 仅本人 + 公开 SELECT（is_public=true）
- `feed_likes (id, record_id uuid FK, user_id FK, UNIQUE)` — RLS 本人管理 + 所有人可查看
- `feed_comments (id, record_id uuid FK, user_id FK, content ≤200字)` — RLS 同上
- 迁移脚本: 001_profiles → 002_burn_records → 003_leaderboard → 004_is_public → 005_feed_tables → 006_burn_records_rls_fix

## 关键代码模式

### API 调用
```js
// 所有 fetch 用 authHeaders() 自动带 token
import { authHeaders, getCurrentUser } from './auth.js';
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/function_name`, {
  method: 'POST',
  headers: authHeaders(),
  body: JSON.stringify({ param: value })
});
```

### RPC 函数模式（绕过 RLS）
```sql
CREATE OR REPLACE FUNCTION func_name(params)
RETURNS TABLE(...)  -- 或 RETURNS jsonb
SECURITY DEFINER        -- 以函数创建者权限执行，跳过 RLS
SET search_path = public
LANGUAGE plpgsql
```

### 标签页懒加载
```js
// ui.js switchTab 中
if (tabName === 'leaderboard') {
  import('./leaderboard.js').then(m => m.loadLeaderboard());
}
if (tabName === 'feed') {
  import('./feed.js').then(m => m.loadFeed());
}
```

### DOM 元素引用（集中管理）
```js
// dom.js — 所有 $() 引用集中在一个文件
export const $ = s => document.querySelector(s);
export const feedList = $('#feed-list'), feedEmpty = $('#feed-empty');
```

### CSS 变量
```css
--bg-deep: #050505; --bg-surface: #0D0C0A; --bg-raised: #141210;
--flame: #FF5E13; --flame-glow: #FF8C42; --blaze: #FFB000;
--gold: #C8A44E; --gold-dim: #8B7840; --bronze: #6B4E2E;
--text: #E8E0D5; --text-dim: #9A9288; --text-muted: #6E6860;
--blood: #C0392B; --success: #22C55E;
```

## ES Module 约束

Vite 生产构建（Rollup）禁止跨模块给 import 的变量赋值。解决方案：变量所属模块提供 setter 函数。

## 已知坑

1. **`burn_records.id` 是 uuid**，不是 bigint。所有外键（`feed_likes.record_id`、`feed_comments.record_id`）必须也是 uuid。
2. **RETURNS TABLE 列名冲突**：RPC 函数 `RETURNS TABLE(record_id uuid, ...)` 会让 `record_id` 成为函数内变量，与表中同名列冲突。子查询用表前缀消除歧义：`feed_likes.record_id = br.id`。
3. **RLS 缺 UPDATE**：002 迁移没加 UPDATE 策略 → `publishToFeed` 的 PATCH 静默失败 → `is_public` 永远是 false。006 迁移补上。

## Git 规范

- 分支：`dev` 开发，`master` 主分支
- 提交前缀：`feat:` / `fix:` / `docs:` / `perf:` / `chore:`
- `.gitignore` 包含：`dist/`、`docs/`
- 用户是 `Jackson-da`

## 详细文档

完整架构文档在 `docs/ARCHITECTURE.md`（不在 git 中，本地文件）。
