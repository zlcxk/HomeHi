# HomeHi · 把日子收好

一个自托管的私人家庭生活空间：记录瞬间、保存照片、安排重要的事，并在多年后重新遇见。

没有公开主页，没有陌生人，没有广告和分析脚本。数据默认只存在你自己的服务器上，随时可以完整导出。

---

## 现在能做什么

- **今天**：一句问候、今天的日程与待办、家人的生日、接下来几天、那年今天、最近的照片和记录。
- **时光**：按时间倒序的记录流，支持瞬间 / 手记筛选、标签与人物筛选、无限滚动。
- **照片**：全家的照片墙、月份分组、收藏、视频、相册（封面、增删照片）；大图默认加载压缩后的清晰版本，随时可以「查看原图」。
- **日历**：月视图、重复日程、当天议程、生日提醒、取消与删除。
- **待办**：快速添加、优先级、负责人、重复待办、完成记录、逾期分组。
- **家人与宠物**：人物/宠物档案、生日倒计时、相关照片、记录和日程。
- **搜索**：一次搜索记录、照片、日程、待办、家人和标签，结果遵守可见性规则。
- **提醒**：为日程和待办设置邮件提醒，后台 worker 按时发送；发送历史、失败原因、手动重试。
- **设置**：账号与密码、家庭成员、默认可见性、通知偏好、SMTP、数据导出、示例数据、外观。
- **回收站**：删除的记录先进入回收站，可恢复或彻底删除。
- **PWA**：可添加到主屏幕；离线时显示离线页（不缓存任何私人页面）。
- **数据可带走**：家庭管理员可一键导出 ZIP（结构化 JSON + 全部照片/视频文件）。没有密码哈希；界面会明确提示压缩包含私密内容，请妥善保管。

## 技术栈

Next.js 16（App Router、Server Actions）+ React 19 + TypeScript + Tailwind CSS 4，
Prisma 6 + SQLite，Luxon 处理时区，sharp 生成缩略图与展示图，ffmpeg 生成视频播放版，Nodemailer 发送提醒。

设计语言是一套「暖纸」系统：米白纸面、墨色文字、陶土色强调、衬线标题；移动端优先，桌面端展开为侧栏。

---

## 快速开始

要求 **Node.js 20+**（推荐 22）与 npm。若想让上传的视频自动压缩，还需要 ffmpeg：
Docker 镜像已内置；本地通常由可选的 `ffmpeg-static` 提供，也可以安装系统 ffmpeg 或设置 `FFMPEG_PATH`。没有 ffmpeg 时视频会保留原片，其他功能不受影响。

```bash
npm install
cp .env.example .env
# 编辑 .env：至少把 AUTH_SECRET 换成一个长随机串
#   openssl rand -base64 48

npm run dev:all
```

打开 <http://localhost:3000>，会引导你建立第一个家庭空间（`/setup`）。这个页面只会出现一次。

`dev:all` 同时启动网页和提醒 worker。只想开发页面时用 `npm run dev`。

> `npm run dev` / `npm start` 会自动创建数据目录并应用数据库迁移。

### 载入示例数据

首次进入后，在「设置 → 数据」点击「载入示例数据」，或运行：

```bash
npm run seed
```

示例数据全部本地生成，带「示例」标记，可随时在同一页面一键清空。

---

## 生产部署

### 直接运行

```bash
npm run build
npm run start        # 网页，默认 3000 端口
npm run worker:prod  # 另一个常驻进程，发送邮件提醒
```

建议用 systemd / pm2 / Docker 让两个进程常驻，并在前面放一层 Caddy 或 Nginx 做 HTTPS。

`.env` 关键项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | SQLite 路径，相对 `prisma/schema.prisma`，默认 `file:../data/homehi.db` |
| `AUTH_SECRET` | 会话签名密钥，**至少 32 位随机字符**；更换会让所有人重新登录 |
| `COOKIE_SECURE` | 可选。会话 Cookie 的 Secure 标记，留空自动判断（仅 `x-forwarded-proto: https` 时启用）。局域网 HTTP 访问时不要设为 `true`，否则会登录后立刻退出 |
| `NEXT_PUBLIC_APP_URL` | 对外访问地址，用于邮件里的链接，不要以 `/` 结尾 |
| `DEFAULT_TIMEZONE` | 初始化时的默认时区，IANA 名称，如 `Asia/Shanghai` |
| `STORAGE_DIR` | 本地存储时照片/视频的目录，默认 `./storage` |
| `STORAGE_DRIVER` | 默认存储后端：`local` 或 `oss`；界面「设置 → 存储」保存的配置优先 |
| `OSS_*` | 可选。`OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_ENDPOINT`、`OSS_PREFIX` |
| `MAX_UPLOAD_MB` | 单个文件上限，默认 100 |
| `SMTP_*` | 邮件提醒所需的 SMTP 配置；不配置时应用会明确显示「未配置」 |
| `AMAP_API_KEY` | 可选。高德「Web 服务」Key，用于瞬间/手记/待办/日程/物品/旅行的地点联想；不配置时地点仍可手动填写 |
| `AMAP_CITY` | 可选。限定地点联想城市，例如 `北京` 或 adcode；留空则全国搜索 |
| `WORKER_POLL_SECONDS` | worker 轮询间隔，默认 30 秒 |
| `WORKER_REMINDER_HORIZON_DAYS` | 提醒预生成天数，默认 180 |
| `FFMPEG_PATH` | 可选。指定 ffmpeg 可执行文件；不填时依次尝试项目内的 `ffmpeg-static` 和系统 `ffmpeg` |

### Docker Compose

```bash
cp .env.example .env
# 修改 AUTH_SECRET、NEXT_PUBLIC_APP_URL
# 如果从其他设备访问，把 NEXT_PUBLIC_APP_URL 改成实际域名

docker compose up -d --build
```

Compose 会启动 `web` 和 `worker` 两个容器，并把 `./data`、`./storage` 挂载为持久卷。
SQLite 与本地文件存储都依赖这两个目录，**升级或迁移时请一起带走**。
如果媒体改用阿里云 OSS，`./storage` 只保留历史本地文件，数据库仍必须持久化。

### 反向代理

只需要把 3000 端口暴露给代理。请设置 HTTPS，否则登录 Cookie 在公网中不安全。
应用已经设置 `X-Frame-Options`、`X-Content-Type-Options`、Referrer-Policy 等基础响应头。
如果使用 Nginx，上传大视频时记得调高 `client_max_body_size`。

---

## 照片与视频优化

参考微信的做法：**浏览时看压缩版，需要时再看原图/原视频**。原文件始终完整保留，导出和下载拿到的也是原文件。

- **照片**：上传时同步生成两张 WebP——网格/头像用的缩略图（最长边 900、质量 76）和详情页用的展示图（最长边 1920、质量 82）。
  旧照片在第一次打开详情页时按需生成展示图，不需要手动跑迁移脚本；GIF 和动态图会保留原文件，避免丢帧。
- **视频**：上传后由 worker 在后台转成 H.264/AAC 的 MP4（最长边 1280、CRF 23），播放器优先使用压缩版；
  页面会显示「原视频 36 MB · 压缩版 2.6 MB」并提供「对比原视频」。转码不阻塞上传，也不阻塞提醒邮件。
- **状态是诚实的**：视频转码状态为 `PENDING / PROCESSING / READY / SKIPPED / FAILED`。
  未装 ffmpeg、原视频已经足够小或压缩收益不明显时会标记 `SKIPPED` 并继续使用原片，不会卡住队列。
- **ffmpeg**：Docker 镜像已内置。非 Docker 部署可以安装系统 ffmpeg，或让 npm 安装可选的 `ffmpeg-static`；
  也可以设置 `FFMPEG_PATH`。没有 ffmpeg 时应用仍可正常使用，只是视频保留原片；装好 ffmpeg 后重启 worker，
  启动时会自动把此前因缺少 ffmpeg 而跳过的视频重新排队。
- **缓存**：展示图、播放版和缩略图都带 `private` 缓存头，只有已登录且有权查看的人能读取，浏览器和家庭内网可重复使用。

> 视频压缩发生在 worker 进程，请确保 `npm run worker:prod`（或 Compose 的 worker 容器）持续运行。

---

## 数据、隐私与权限

- 所有查询在服务端按 `householdId` 隔离；没有跨家庭访问路径。
- 每条记录、每张照片都有**自己的可见性**：`HOUSEHOLD`（全家可见）或 `PRIVATE`（仅创建者）。
  私有记录里的照片不会因为被放入公开相册而泄露——媒体单独判断。
- 草稿只对作者可见；删除的记录进入回收站，不出现在任何列表、搜索或提醒中。
- 搜索结果、今天页、日历、提醒收件人都会重新执行同一套可见性规则。
- 会话是 HttpOnly、SameSite=Lax 的签名 JWT，30 天有效；没有第三方登录。
- **没有开放注册**：只有家庭管理员（OWNER）能创建成员账号，并当面/私下给出初始密码。
- 不包含密码哈希的导出、可清空的示例数据、可见的存储占用，都是为了「数据属于你」这件事。
- **管理员导出是家庭级备份**：会包含成员标记为「仅自己」的内容（服务器管理员本来也能直接读取存储）；界面在下载前明确提示。成员如需只导出自己的内容，可在 P1 增加个人导出。

### 备份

```bash
npm run backup
```

会在 `backups/homehi-YYYYMMDD-HHmmss/` 下用 `VACUUM INTO` 生成 SQLite 一致性快照，并复制 `storage/`，附恢复说明。网页运行中也可以安全备份。
使用 OSS 时，媒体对象不在 `storage/`，备份只包含数据库；请另外启用 OSS 的版本控制或跨区域复制。
请把备份放到与服务器不同的磁盘或另一台机器。建议每天定时执行，并偶尔实际恢复一次。

也可以在「设置 → 数据」导出 ZIP。导出是完整的人类可读 JSON + 原始媒体文件，不依赖 HomeHi 才能打开。

---

## 重复规则与提醒语义

- 支持每天 / 每周 / 每月 / 每年，可设置间隔与结束日期。
- 按月重复从**锚点日期**计算：1 月 31 日 → 2 月 28/29 日 → 3 月 31 日，不会一路漂移。
- 时区以家庭空间为准；跨夏令时仍保持本地墙钟时间（例如每天 09:00 仍是 09:00）。
- 全天日程的提醒统一在**当天 09:00（家庭时区）**触发，避免「提前一天」在午夜打扰。
- 提醒是预生成的 `Notification` 行，带唯一幂等键，重复保存不会重复发送；worker 会定期向后延伸重复日程的提醒。
- 待办完成后，其未发送提醒自动取消；重复待办的完成记录单独保存，不会覆盖历史。
- 发送失败会按退避重试，最多 5 次；SMTP 未配置时会明确标为失败并给出原因，而不是静默丢失。
- 修改日程/待办时间会刷新尚未发送的提醒；已发送的历史保留。

---

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run dev:all` | 开发服务器 + worker |
| `npm run build` | 生产构建（含 `prisma generate`） |
| `npm run start` | 生产服务器 |
| `npm run worker` | 开发模式 worker（文件变更自动重启） |
| `npm run worker:prod` | 生产 worker |
| `npm run seed` | 载入示例数据（需要已有家庭空间） |
| `npm run backup` | 备份数据库与媒体 |
| `npm run db:migrate` | 开发新迁移 |
| `npm run db:deploy` | 应用已有迁移 |
| `npm run db:studio` | Prisma Studio |
| `npm test` | 运行单元测试（重复规则、权限、日期、提醒） |
| `npm run typecheck` | TypeScript 检查 |

---

## 目录

```
app/
  (app)/        登录后的主界面：今天、时光、照片、日历、待办、家人、搜索、设置
  (focus)/      专注流程：记录瞬间/手记、新建日程/待办、编辑
  actions/      Server Actions（写入与权限检查）
  api/          媒体上传/读取、时间线分页、导出、健康检查
components/     设计系统与交互组件
lib/            权限、重复规则、提醒、日期、存储、图片/视频压缩、演示数据
prisma/         schema 与迁移
scripts/        worker、seed、backup、目录初始化
tests/          Vitest 单元测试
docs/           PRD 评审与后续计划
```

---

## 已知边界（P0 有意不做）

- 没有 AI 自动写文案/选照片；宁可空白，也不假装懂你。
- 没有公开分享链接、点赞、评论、关注——这不是社交产品。
- 没有开放注册、忘记密码邮件、两步验证；家庭规模下由管理员当面创建账号。
- 媒体支持本地磁盘和阿里云 OSS 两种后端，可在「设置 → 存储」里切换。切换只影响之后的新文件，历史文件按记录中的后端读取；已有文件不会自动搬迁。
- PWA 离线只提供离线提示页，不缓存需要登录的页面，避免在共用设备上留下隐私数据。
- SQLite 适合家庭规模；大量并发写入或多实例部署请先评估迁移到 Postgres。

后续迭代方向见 [docs/PRD-REVIEW.md](docs/PRD-REVIEW.md)。
