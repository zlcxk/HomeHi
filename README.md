# HomeHi · 把日子收好

一个自托管的私人家庭生活空间：记录瞬间、保存照片、安排重要的事，并在多年后重新遇见。

没有公开主页，没有陌生人，没有广告和分析脚本。数据默认只存在你自己的服务器上，随时可以完整导出。

---

## 现在能做什么

- **今天**：一句问候、今天的日程与待办、家人的生日、接下来几天、那年今天、最近的照片和记录。
- **时光**：按时间倒序的记录流，支持瞬间 / 手记筛选、标签与人物筛选、无限滚动。
- **照片**：全家的照片墙、月份分组、收藏、视频、相册（封面、增删照片）。
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
Prisma 6 + SQLite，Luxon 处理时区，sharp 生成缩略图，Nodemailer 发送提醒。

设计语言是一套「暖纸」系统：米白纸面、墨色文字、陶土色强调、衬线标题；移动端优先，桌面端展开为侧栏。

---

## 快速开始

要求 **Node.js 20+**（推荐 22）与 npm。

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
| `NEXT_PUBLIC_APP_URL` | 对外访问地址，用于邮件里的链接，不要以 `/` 结尾 |
| `DEFAULT_TIMEZONE` | 初始化时的默认时区，IANA 名称，如 `Asia/Shanghai` |
| `STORAGE_DIR` | 照片/视频存储目录，默认 `./storage` |
| `MAX_UPLOAD_MB` | 单个文件上限，默认 100 |
| `SMTP_*` | 邮件提醒所需的 SMTP 配置；不配置时应用会明确显示「未配置」 |
| `WORKER_POLL_SECONDS` | worker 轮询间隔，默认 30 秒 |
| `WORKER_REMINDER_HORIZON_DAYS` | 提醒预生成天数，默认 180 |

### Docker Compose

```bash
cp .env.example .env
# 修改 AUTH_SECRET、NEXT_PUBLIC_APP_URL
# 如果从其他设备访问，把 NEXT_PUBLIC_APP_URL 改成实际域名

docker compose up -d --build
```

Compose 会启动 `web` 和 `worker` 两个容器，并把 `./data`、`./storage` 挂载为持久卷。
SQLite 与本地文件存储都依赖这两个目录，**升级或迁移时请一起带走**。

### 反向代理

只需要把 3000 端口暴露给代理。请设置 HTTPS，否则登录 Cookie 在公网中不安全。
应用已经设置 `X-Frame-Options`、`X-Content-Type-Options`、Referrer-Policy 等基础响应头。
如果使用 Nginx，上传大视频时记得调高 `client_max_body_size`。

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
lib/            权限、重复规则、提醒、日期、存储、演示数据
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
- 媒体存本地磁盘，没有对象存储适配层（接口已隔离在 `lib/storage.ts`，方便以后替换）。
- PWA 离线只提供离线提示页，不缓存需要登录的页面，避免在共用设备上留下隐私数据。
- SQLite 适合家庭规模；大量并发写入或多实例部署请先评估迁移到 Postgres。

后续迭代方向见 [docs/PRD-REVIEW.md](docs/PRD-REVIEW.md)。
