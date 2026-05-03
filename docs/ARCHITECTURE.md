# 前任焚烧炉 — 技术文档

## 项目概览

「前任焚烧炉」是一个情感宣泄向 Web 应用。用户选择焚烧类型（前任/朋友/上司/情绪/自定义），输入名字和罪名，生成复古通缉令风格海报，长按按钮将海报烧毁，最后获得治愈语录和分享卡片。

**设计方向**: Dark Editorial Premium（暗黑编辑风奢华）— 深色底板 + 金铜点缀 + 暗红砖墙 + 玻璃拟态弹窗。

---

## 文件结构

```
前任焚烧炉/
├── index.html                  # HTML 骨架（182行），标签页 + 弹窗 + Canvas
├── css/
│   └── style.css               # 全部样式（774行），CSS 变量 + 动效 + 响应式
├── js/
│   ├── config.js               # Supabase 配置 + 动画常量 + 分享链接
│   ├── data.js                 # 罪名库、判决文案、治愈语录、焚烧类型定义
│   ├── dom.js                  # $/$$ 快捷函数 + 全部 DOM 元素引用
│   ├── utils.js                # 每日免费判断、FBM 噪声、文本折行
│   ├── audio.js                # Web Audio API 全合成音频引擎
│   ├── auth.js                 # Supabase Auth + 昵称系统 + 顶栏状态
│   ├── api.js                  # Supabase REST：焚烧记录 CRUD + 动态 API
│   ├── poster.js               # 通缉令绘制 + 打字机状态机 + 印章动画
│   ├── burn.js                 # 粒子系统 + 燃烧控制 + FBM 渐显/擦除
│   ├── healing.js              # 治愈阶段 + 判决书分享卡片生成
│   ├── ui.js                   # 标签页切换 + 类型选择 + 罪名标签 + 弹窗 + 历史面板
│   ├── leaderboard.js          # 排行榜：RPC 调用 + 领奖台 + 排行列表渲染
│   ├── feed.js                 # 动态流：滚动分页 + 点赞 + 内嵌评论
│   └── app.js                  # 编排层：流程状态、动画循环、事件绑定
└── supabase/
    ├── migrations/
    │   ├── 001_create_profiles.sql
    │   ├── 002_create_burn_records.sql
    │   ├── 003_leaderboard_function.sql
    │   ├── 004_feed_public_flag.sql
    │   └── 005_feed_tables.sql
    └── functions/check-email/index.ts   # Edge Function：邮箱查重
```

---

## 模块依赖

```
config.js  ← 无依赖
data.js    ← 无依赖
dom.js     ← 无依赖
utils.js   ← auth.js (getCurrentUser)
api.js     ← config.js, auth.js
auth.js    ← config.js, dom.js
audio.js   ← 无依赖
poster.js  ← dom.js, data.js, utils.js, config.js
burn.js    ← dom.js, poster.js, utils.js
healing.js      ← dom.js, poster.js, data.js, utils.js, config.js
ui.js           ← dom.js, data.js, utils.js, api.js, auth.js, poster.js, healing.js
leaderboard.js  ← dom.js, auth.js, config.js, utils.js
feed.js         ← dom.js, auth.js, config.js, utils.js
app.js          ← 全部模块（编排层）
```

---

## 技术栈

- **前端**：原生 JS + Canvas 2D + Web Audio API，零框架
- **模块**：ES modules，Vite dev/build
- **认证**：Supabase Auth REST API，纯 fetch，无 SDK。SMTP 走 Resend
- **数据库**：Supabase PostgREST，RLS 行级安全

---

## 色彩系统

采用 Dark Editorial Premium 配色 — 深暗底 + 暖白文字 + 火焰橙品牌色 + 金铜奢华点缀：

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-deep` | `#050505` | 最深底板 |
| `--bg-surface` | `#0D0C0A` | 卡片/面板 |
| `--bg-raised` | `#141210` | 输入框/悬浮层 |
| `--flame` | `#FF5E13` | 核心品牌色（选中态/按钮） |
| `--flame-glow` | `#FF8C42` | 辉光 |
| `--blaze` | `#FFB000` | 火焰高亮 |
| `--gold` | `#C8A44E` | 金属光泽（CTA/强调） |
| `--gold-dim` | `#8B7840` | 暗金（副标题/装饰线） |
| `--bronze` | `#6B4E2E` | 古铜 |
| `--parchment` | `#F4E1B3` | 羊皮纸（海报底色） |
| `--ink` | `#1A0F0A` | 墨水文字 |
| `--blood` | `#C0392B` | 印章/删除按钮 |
| `--success` | `#22C55E` | 治愈文字 |
| `--text` | `#E8E0D5` | 暖白正文 |
| `--text-dim` | `#9A9288` | 次要文字（WCAG AA 6.0:1） |
| `--text-muted` | `#6E6860` | 禁用/极弱（WCAG AA 4.5:1） |

---

## 背景设计

CSS-only 暗红砖墙 + 径向聚光灯：

- `body::before`：三层 `repeating-linear-gradient` 叠加，120×40px 砖块 + 2px 砖缝（60%不透明度），跑步式错缝（奇数行偏移半砖）。底色 `#1a0804`
- `body::after`：`radial-gradient(ellipse)` 从屏幕中心暖色渐变到边缘近黑，模拟聚光灯效果

---

## 字体系统

- **Heading**：Inter 600–800 weight
- **Body**：Inter 400，中文回退 PingFang SC / Microsoft YaHei
- **Accent**：Noto Serif SC 衬线体（治愈语录、判决书）
- 字号阶梯：Hero 48–72px → 区块标题 32px → 卡片标题 22px → 正文 16px → 辅助 13px

---

## 渲染架构

```
z-index:  砖墙背景 → vignette → #app → poster-canvas → fire-canvas → DOM
```

- `poster-canvas`：通缉令展示 + FBM 噪声逐块擦除（燃烧）/ 逐块显露（渐显）
- `fire-canvas`：粒子渲染，`globalCompositeOperation: 'lighter'` 叠加发光
- `sourceCanvas`（OffscreenCanvas）：完整原图，打字机逐字填充，最终含印章
- 缩放防溢出：名字过长自动缩小字号，dpr 上限 2x

---

## 交互流程

```
[选择焚烧类型（前任/朋友/上司/情绪/自定义）]
  → 类型切换联动：副标题、输入框 label、罪名库、按钮文案
  → [输入名字 + 选择罪名] → 生成按钮可用
  → 界面淡出(350ms)
  → 通缉令渐显(1.5s, FBM 噪声块从四周→中心)
  → 打字机动画：
      mood：3阶段（name→verdict→footer, 60ms/tick）
      其他：4阶段（name→crime→verdict→footer, 60ms/tick）
  → 印章砸下（500ms, 3.0x→1.0x 缩放 + 回弹 + 旋转）
  → 长按 600ms 触发燃烧
  → 5s 燃烧 + 暗化过渡 + 灰烬飘散
  → 治愈语录 + 分享卡片
     ├─ 未登录 → 标记今日已用 → 升级引导
     └─ 已登录 → 自动保存到 Supabase
```

---

## 焚烧类型系统

5 种焚烧类型，每种有独立的罪名库、判词、治愈语录、海报样式：

| 类型 ID | 标签 | 海报标题 | 罪名标签 | 特殊处理 |
|---------|------|----------|----------|----------|
| `ex` | 前任 | 情感通缉令 | 有"罪"标签 | 默认类型 |
| `friend` | 朋友 | 情感通缉令 | 有"罪"标签 | 8 种朋友罪名 |
| `boss` | 上司 | 情感通缉令 | 有"罪"标签 | 8 种职场罪名 |
| `mood` | 情绪 | 情绪焚烧令 | 无"罪"标签 | 3 阶段打字机，火焰符号替代肖像区 |
| `custom` | 自定义 | 情感通缉令 | 自定义输入 | 通用判词模板 |

### mood 类型的特殊处理

- 海报标题："情绪焚烧令"（非"情感通缉令"）
- 无嫌疑人肖像区，改为火焰/太阳符号
- 无"罪"标签，标签区显示"【 焚 烧 对 象 】"
- 打字机 3 阶段（跳过罪名阶段），长按判断 `typePhase >= 3`
- 分享卡片显示"焚烧对象"而非"被告人/罪名"
- 印章文字"已焚"而非"已判"

---

## 核心模块

### 通缉令渲染（poster.js）

模块级状态变量：`selectedCrime`、`burnType`（通过 `setSelectedCrime()` / `setBurnType()` 设置）。

`drawPosterStatic` 绘制静态元素（羊皮纸做旧、三层边框、十字装饰、标题、WANTED/INCINERATE），mood 类型走独立布局（火焰符号 + 焚烧对象）。文字部分由打字机状态机渐进填充到 `sourceCanvas`，最终 `drawStamp` 加盖印章。

**罪名标签**：`drawCrimeLabel` 在黑色矩形底上绘"罪"和罪名，mood 类型跳过。

**renderHistoryPoster**：为历史记录渲染完整通缉令（800×1111），临时切换模块级 `burnType` 后恢复，确保 mood 类型正确渲染。

### 燃烧系统（burn.js）

FBM 噪声（3 层叠加）控制 blockSize 块遮罩，从罪名标签向四周扩散，产生不规则锯齿边缘。5 秒完成。

渐显动画为燃烧的镜像：全黑遮罩 → 从四周向中心逐块显露。

粒子系统：250 粒子池，`alive` 标记回收复用。用预渲染的 OffscreenCanvas 发光纹理替代 shadowBlur，性能更优。

### 分享卡片（healing.js）

判决书卷轴风，2000×1250 高分辨率：
- 左侧：通缉令缩略图（500px 宽，含投影+红框）
- 右侧："情感国际法庭 判决书" + 条件渲染（mood:"焚烧对象"，其他:"被告人/罪名"）+ 判词摘要 + 治愈语录
- 右下：二维码（api.qrserver.com）+ "扫码体验"
- 羊皮纸做旧斑点 + 边缘暗化 + 三层装饰边框

### 音频（audio.js）

Web Audio API 全合成，无外部音频文件：

| 音效 | 合成方式 |
|------|----------|
| 渐显涌动 | 低频噪声 + 3.5kHz 高频闪烁 |
| 打字机 | 白噪声 25ms → bandpass+lowpass |
| 印章砸击 | 白噪声 → 180Hz 低通 + 900Hz 带通 |
| 火柴划燃 | 白噪声 400ms → bandpass 3.5kHz |
| 火焰噼啪 | 脉冲噪声 → bandpass 2.2kHz |
| 治愈钟声 | 振荡器 C5/E5/G5 + C3 低音 |

### 排行榜（leaderboard.js）

通过 Postgres 函数 `get_leaderboard`（SECURITY DEFINER）绕过 RLS 实现跨用户聚合统计。ES module 懒加载：`switchTab('leaderboard')` 时 `import('./leaderboard.js').then(m => m.loadLeaderboard())`。

**数据库函数**（[003_leaderboard_function.sql](supabase/migrations/003_leaderboard_function.sql)）：

```sql
get_leaderboard(filter_type text DEFAULT NULL)
RETURNS TABLE(
  rank bigint, user_id uuid, nickname text, total_burns bigint,
  top_crime text, burn_types jsonb, latest_burn timestamptz
)
SECURITY DEFINER SET search_path = public
```

- 聚合：`ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MAX(br.burned_at) DESC)`
- 最高频罪名：`MODE() WITHIN GROUP (ORDER BY br.crime)`
- 各类型计数：`jsonb_build_object('ex', COUNT FILTER(...), 'friend', ...)`
- 昵称回退：`COALESCE(p.nickname, '匿名焚烧者#' || left(br.user_id::text, 4))`
- 调用方式：`POST /rest/v1/rpc/get_leaderboard`，body `'{}'`，匿名可访问（anon key）
- 不设类型筛选（排行榜展示全局排名，不在榜单内做分类切换）

**前端渲染**（[leaderboard.js](js/leaderboard.js)，139 行）：

- **统计数据栏**：焚烧者总数 + 累计焚烧次数，仅在数据加载成功后显示
- **Top 3 领奖台**：`renderPodium(top3)` → #1 独占首行，#2/#3 并排
  - 金/银/铜三色卡片（`MEDAL_COLORS = { 1:'gold', 2:'silver', 3:'bronze' }`）
  - 独立 SVG 图标（#1 皇冠，#2/#3 奖章）
  - 显示：昵称 + 焚烧次数 + 最高频罪名 + 最近焚烧日期
  - 当前用户卡片添加 `.is-you` + 火焰色「你」标签
- **#4+ 排行列表**：`renderRankList(rest)` → 四列简洁行（排名 #N / 昵称 / 罪名 / 次数）
  - 当前用户行火焰色高亮 + 「你」标签
  - 底部尾注「仅显示已上榜用户」
- **空态**：无数据时显示引导空态 + 「前往焚烧炉」按钮
- **加载态**：居中 loading 文字，数据返回后切换

### 动态（feed.js）

社区公开焚烧流。用户焚烧时可选择发布到动态（输入区开关，默认开启），所有用户可见。支持点赞和评论互动。

**数据库表**：
- `feed_likes (id, record_id FK, user_id FK, created_at)` — UNIQUE(record_id, user_id)
- `feed_comments (id, record_id FK, user_id FK, content ≤200字, created_at)`
- 额外 RLS 策略允许匿名查看点赞和评论

**RPC 函数**（SECURITY DEFINER）：
- `get_public_feed(p_page, p_page_size, p_current_user_id)` — 分页拉取公开动态，JOIN profiles + 聚合 like/comment count + 当前用户点赞状态
- `get_feed_comments(p_record_id, p_page, p_page_size)` — 评论分页
- `toggle_feed_like(p_record_id)` — 点赞/取消，返回 `{liked, like_count}`
- `add_feed_comment(p_record_id, p_content)` — 添加评论，返回新评论行

**前端架构**（[feed.js](js/feed.js)，230 行）：
- 懒加载：`switchTab('feed')` → `import('./feed.js').then(m => m.loadFeed())`
- 滚动分页：IntersectionObserver 监听底部哨兵，触底自动加载下一页（10 条/页）
- 点赞：乐观更新（即时切换爱心 + 数字 + scale 弹跳 140ms），API 失败回滚
- 评论：点击 💬 展开内嵌评论（收起其他已展开评论），输入框 + 发送按钮，支持 Enter 提交
- 骨架屏：首次加载 3 张 shimmer 占位卡片
- 空态：引导跳转焚烧炉

**发布流程**：
```
输入区 [✓ 发布到动态] 开关（默认开）
  → 燃烧 → 治愈阶段：
    开关开 → 自动 PATCH is_public=true → "已发布到社区动态 ✓"
    开关关 → "发布到社区动态" 按钮 → 补发
```

---

## 焚烧历史面板

### 布局

Timeline 时间线布局：
- 左侧竖线：`::before` 伪元素，linear-gradient 从透明→金色→透明
- 每条记录：`::before` 圆点（9px），hover 时变为金色实心
- 卡片：暗底 + 左侧火焰色 accent bar + 判决引文 3 行截断

### 筛选

客户端筛选，5 个 filter tab（全部/前任/朋友/上司/情绪），通过 `burn_type` 字段过滤。分页加载（每页 10 条），"加载更多卷宗"按钮。

### 删除

内联确认栏：点击删除 → 展开确认区 → 确认后卡片 burning-out 动画 + API 删除。

---

## 认证系统

Supabase Auth REST API，Token 持久化 localStorage：

| 操作 | 端点 |
|------|------|
| 注册 | `POST /auth/v1/signup` |
| 登录 | `POST /auth/v1/token?grant_type=password` |
| 登出 | `POST /auth/v1/logout` |
| 获取用户 | `GET /auth/v1/user` |
| 刷新 Token | `POST /auth/v1/token?grant_type=refresh_token` |
| 密码重置 | `POST /auth/v1/recover` |
| 更新密码 | `PUT /auth/v1/user` |

- 邮件确认回调：URL hash `type=signup` → 自动提取 token 登录
- 密码重置回调：URL hash `type=recovery` → 弹窗设新密码
- 重复注册检查：Edge Function `check-email`

### 昵称系统

`public.profiles (id uuid PK, nickname text)`，RLS 仅本人读写。首次登录弹窗设置，点击顶栏昵称可修改。保存策略：先 PATCH 更新，失败则 POST 创建。

---

## 动效系统

| 场景 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 页面载入 | 标题从下浮上 + 淡入 | 600ms | ease-out |
| 罪名标签选中 | 背景色过渡 + scale 0.97 | 200ms | ease-out |
| 生成按钮 hover | 金色边框过渡 | 300ms | ease-out |
| 弹窗打开 | scale(0.92)→1 + fade | 300ms | ease-out |
| 火焰按钮光环 | goldenHalo 缩放脉冲 | 3-4s 循环 | ease-in-out |
| 火星粒子 | sparkleDrift 旋转 | 2.5-3.2s 循环 | linear |
| 治愈语录 | fadeInUp 从下浮上 | 1s | ease-out |
| 历史卡片入场 | cardSlideIn 从下浮上 | 0.5s | ease-out |
| 删除记录 | cardBurnOut 上飘+模糊 | 0.35s | ease-in |

全局 `prefers-reduced-motion: reduce` 关闭所有动画。

---

## 数据库

### profiles
```sql
id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
nickname text NOT NULL
created_at timestamptz DEFAULT now()
```

### burn_records
```sql
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
ex_name text NOT NULL
crime text NOT NULL
verdict text NOT NULL
heal_quote text
burn_type text NOT NULL DEFAULT 'ex'    -- 后加列，用于类型筛选
burned_at timestamptz DEFAULT now()
```
RLS：SELECT/INSERT/DELETE 仅限 `auth.uid() = user_id`。

### 排行榜函数

```sql
-- 003_leaderboard_function.sql
CREATE OR REPLACE FUNCTION get_leaderboard(filter_type text DEFAULT NULL)
RETURNS TABLE(rank bigint, user_id uuid, nickname text, total_burns bigint,
              top_crime text, burn_types jsonb, latest_burn timestamptz)
SECURITY DEFINER  -- 绕过 RLS，以函数创建者权限执行
SET search_path = public
```

通过 `LEFT JOIN profiles` 获取昵称，无 profiles 记录的用户回退为「匿名焚烧者#」+ user_id 前 4 位。聚合使用 `MODE() WITHIN GROUP (ORDER BY crime)` 取最高频罪名。

---

## ES Module 跨模块赋值约束

Vite 生产构建（Rollup）禁止直接给 import 的变量赋值。规则：被其他模块赋值的变量，setter 必须定义在变量所在的模块内部。

| 位置 | 问题 | 解决 |
|------|------|------|
| `app.js` → `burn.js` | `burnMod.isBurning = true` | `burn.js` 提供 `beginBurn()` |
| `ui.js` → `auth.js` | `recoveryToken = t` | `auth.js` 提供 setter，`ui.js` re-export |

---

## 构建与部署

- 开发：`npm run dev`（Vite dev server，ES module 原生加载）
- 生产构建：`npm run build`（Rollup 打包到 `dist/`）
- `dist/` 已加入 `.gitignore`

---

## 移动端适配

- `@media (max-width:600px)` 断点，`min-height:44px` 触摸区
- Canvas CSS 尺寸响应式，dpr 上限 2x
- 顶栏标签横向滚动（`overflow-x:auto` + 隐藏滚动条）
- `touch-action: none` + Pointer Events 统一输入
- 标题 `clamp(48px, 8vw, 72px)`

---

## 开发进度

### 已完成

- [x] 暗黑编辑风奢华色彩系统（Step 1）
- [x] Inter + Noto Serif SC 字体系统（Step 2）
- [x] 布局重构：顶栏 glassmorphism + 960px 宽度 + 0 圆角 + 留白（Step 3）
- [x] 标题区 + 输入区 + 生成按钮重设计（Step 4）
- [x] 火焰按钮金色粒子光环（Step 5）
- [x] 焚烧历史 timeline + 类型筛选 tab（Step 6）
- [x] 弹窗玻璃拟态 + 动效系统（Step 7）
- [x] CSS-only 暗红砖墙背景 + 聚光灯 vignette
- [x] 5 种焚烧类型（ex/friend/boss/mood/custom）
- [x] mood 类型全链路适配（海报/打字机/卡片/印章）
- [x] Supabase burn_type 列 + 历史类型筛选
- [x] 文字对比度修复（WCAG AA 4.5:1）

- [x] 排行榜标签页 — 领奖台（金/银/铜）+ 排行列表 + 当前用户高亮
- [x] 排行榜 Postgres SECURITY DEFINER 函数（跨用户聚合 + MODE 最高频罪名 + 昵称回退）
- [x] 动态/社区标签页 — 发布开关 + 动态流（滚动分页）+ 点赞（乐观更新）+ 内嵌评论

### 待完成

- [ ] 赞赏链接替换为真实地址
- [ ] 分享卡片二维码替换为部署后真实 URL
