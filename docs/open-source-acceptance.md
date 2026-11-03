# 开源发布验收清单

记录日期：2026-11-03
代码版本：`835b4cd`（Phase 4 完成时）
本地环境：Windows 11 / Node.js v24.22.1 / npm 11.19.1

本清单记录每个阶段实际执行过的检查、结果，以及**无法在当前环境验证**的项目。未验证不等于通过；发布说明和后续维护应继续保留这些边界。

## 结论速览

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 1. 账号与认证安全 | 通过（本地实测） | 初始化并发、登录限流、会话失效、最后管理员保护等；单元测试与浏览器验证 |
| 2. 数据保护与备份 | 通过（本地实测 + 恢复演练） | 导出默认关闭并按 OWNER 鉴权；备份/恢复脚本完成两次演练 |
| 3. NAS 一键部署 | 脚本逻辑通过；实机未验证 | 用桩程序验证架构拒绝、参数、幂等；无 Docker daemon / ACR 凭证，未实际拉镜像 |
| 4. 文档与许可 | 完成；截图未验证 | 用户指南、部署指南、FAQ、NOTICE、CONTRIBUTING 已提交；原文站点不可访问 |
| 5. 最终检查 | 通过 | `typecheck`、83 个单元测试、生产构建均通过 |

## Phase 1 — 账号与认证安全

| 检查项 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 初始化并发保护 | 通过（实现审查；未做并发压测） | `lib/setup.ts` 使用唯一 `SETUP_COMPLETED_KEY` + 事务 + 并发冲突识别；`setupAction` 在哈希密码前调用 `isSetupComplete()` |
| 初始化不泄露邮箱是否存在 | 通过 | `setupAction` 不再查询已有邮箱；初始化完成后直接拒绝 |
| 登录失败提示不区分邮箱/密码 | 通过 | 统一提示；不存在的账号执行 dummy bcrypt 校验 |
| 登录限流按 IP + 规范化邮箱 | 通过 | `AuthThrottle` 表持久化，sha256 桶；邮箱 15 分钟 5 次、IP 20 次、锁定 15 分钟 |
| 限流不依赖进程内存 | 通过 | 数据写入 SQLite；多实例/重启后仍生效 |
| bcrypt 成本与 72 字节限制 | 通过 | cost 11；超过 72 字节直接拒绝；测试覆盖 |
| 密码复杂度 | 通过 | 至少 8 位、拒绝常见弱密码、拒绝超长 |
| 会话失效 | 通过 | 修改密码递增 `sessionVersion`；数据库核对两个用户均为 1；旧 Cookie 被拒绝 |
| 最后一名 OWNER 保护 | 通过 | 移除成员前服务端计数；单元测试与操作验证 |
| 敏感接口权限 | 通过 | 设置、成员管理、存储、导出、媒体均校验登录 + `householdId` + 角色/可见性 |
| 本地浏览器回归 | 通过 | 16 项检查全部通过（初始化、登录、限流、会话失效、成员权限） |
| 启动环境校验 | 通过 | 生产环境拒绝缺失、示例值、短于 32 字符的 `AUTH_SECRET`；开发环境允许短值 |

相关测试：`tests/auth-env.test.ts`、`tests/login-throttle.test.ts`、`tests/password-validation.test.ts`、`tests/session-cookie.test.ts`。

## Phase 2 — 数据保护、备份与恢复

| 检查项 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 导出默认关闭 | 通过 | `DATA_EXPORT_ENABLED` 默认 false；仅接受 `true` / `1` |
| 关闭时服务端拒绝 | 通过 | `/api/export` 返回 403，设置页入口隐藏（浏览器实测） |
| 仅 OWNER 可导出 | 通过 | MEMBER 请求返回 403；审计记录 `not-owner` |
| 导出不落静态目录 | 通过 | 实时打包 ZIP，经鉴权接口返回 |
| 导出审计 | 通过 | 成功/拒绝均写入 `AuditLog`；IP 仅存截断 sha256 |
| 备份一致性 | 通过 | `VACUUM INTO`；失败直接退出，不回退到热复制 |
| 空库保护 | 通过 | 数据库不存在时在任何 Prisma 查询前退出；确认不会自动创建空库 |
| 初始化校验 | 通过 | 检查 `_prisma_migrations`，未初始化数据库拒绝备份 |
| 保留策略 | 通过 | 默认 7 份，1–365；只清理 `homehi-YYYYMMDD-HHMMSS` |
| 文件权限 | 逻辑通过；权限位未验证 | 非 Windows 平台调用 `chmod` 收紧到私有权限；实测环境为 Windows，未核对实际权限位 |
| 恢复流程 | 通过 | 必须 `--force`；数据库先改名保留；WAL/SHM 一并处理 |
| Docker bind mount 兼容 | 通过 | storage 改为复制到 `backups/pre-restore-<时间>-storage`，避免 rename 挂载点/EXDEV |
| 恢复演练 | 通过（2 次） | 第一次发现空库问题并修复；第二次验证：`storage/` 仅剩 `photo-1.jpg`，旧 `stale.jpg` 保留在 `pre-restore-*-storage`，数据库恢复为备份前记录 |
| OSS 边界 | 通过（文档） | 备份只含数据库与本地 storage；OSS 媒体需 Bucket 版本控制/跨区域复制 |

相关测试：`tests/data-export.test.ts`。

## Phase 3 — NAS 一键部署

| 检查项 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 仅 AMD64 | 通过（脚本） | `uname -m` 检查；`aarch64` 桩程序被拒绝 |
| 镜像地址与版本 | 通过（配置） | `docker-compose.yml` 使用 ACR `opxk-public/homehi-web` / `homehi-worker` 与 `${HOMEHI_VERSION:-latest}` |
| 保留原有 compose 配置 | 通过 | env、volumes、ports、network、healthcheck、depends_on、restart 均保留 |
| 数据持久化 | 通过（配置） | `./data`、`./storage`、`./backups` 绑定挂载 |
| 不在 NAS 构建 | 通过（脚本） | 只 `pull`，不 `build` |
| 首次部署 | 通过（桩） | 生成 `.env` 与随机 `AUTH_SECRET`、创建目录、ACR 登录、pull、启动、健康检查 |
| 幂等 / 保留已有配置 | 通过（桩） | 重复执行不覆盖已有 `.env`，不重置已生成的 secret |
| `update.sh` | 通过（桩） | 复用 `deploy.sh`，版本写回 `.env` |
| 凭证不进入日志 | 通过（桩） | 使用 `--password-stdin`；日志中未出现凭证 |
| 真实 ACR 登录 / 拉取 | **未验证** | 当前环境无 Docker daemon 与 ACR 凭证 |
| 镜像构建与推送 | **未验证** | 未执行 `docker build` / `docker push` |
| NAS 实机启动、健康检查、开机自启 | **未验证** | 无 NAS 环境 |
| ARM64 实际运行 | **不适用** | 明确不支持，脚本拒绝 |

## Phase 4 — 文档、许可与截图

| 检查项 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 用户指南 | 完成 | `docs/user-guide/` 9 个文件 |
| 部署指南 | 完成 | `docs/deployment/` 7 个文件 |
| FAQ | 完成 | `docs/user-guide/faq.md` |
| README 修正 | 完成 | 移除树莓派可用表述；导出改为默认关闭；补充 AMD64 边界与文档入口 |
| README 截图 | **未完成 / 未验证** | `opxk.space` 与 `www.opxk.space` 均返回 NXDOMAIN；没有用户提供的截图。未使用本地数据伪造截图 |
| LICENSE | 完成 | MIT，仓库根目录 |
| NOTICE | 完成 | 直接依赖、字体、Docker 系统组件、可选 GPL 组件 |
| 字体许可 | 完成 | `app/fonts/OFL.txt`（Instrument Serif，OFL 1.1） |
| CONTRIBUTING | 完成 | 开发、测试、迁移、敏感信息、安全报告 |
| 文档相对链接 | 通过 | 19 个 Markdown/文本文件检查，0 个失效相对链接 |
| worker 镜像移除 ffmpeg-static | 完成（未构建验证） | Dockerfile 已删除；系统 ffmpeg 保留，动态 import 失败会回退 |

## Phase 5 — 最终检查

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | 通过，无输出错误 |
| 单元测试 | `npm test` | 13 个测试文件、83 个测试全部通过 |
| 生产构建 | `npm run build` | 通过，生成 standalone 产物 |
| 工作区 | `git status` | 临时验证目录与演练数据库已清理；仅保留本次文档变更 |

## 未验证项与发布边界

发布说明中必须保留以下限制，不能写成已验证：

1. **ACR 镜像拉取与 NAS 实机部署未验证。** 当前环境没有 Docker daemon 和 ACR 凭证；脚本只用桩程序验证了流程。
2. **Docker 镜像构建、推送、`linux/amd64` manifest 未验证。** 需要维护者在 AMD64 构建机上执行。
3. **README 截图未提供。** `opxk.space` 当前无法解析；需由项目负责人从可访问实例提供脱敏截图后再补充。
4. **非 Windows 文件权限位未实测。** 备份/恢复的 `chmod` 逻辑在 Windows 上跳过。
5. **ARM64 不支持。** 不要通过 `--platform` 或自行改标签声称支持。
6. **本地检查运行在 Node.js 24 上。** Docker 镜像和文档推荐 Node.js 22；Node 22 下的运行未在当前环境重复验证。
7. **本清单不是安全审计或渗透测试。** 它记录的是针对本次发布范围的实现检查与本地验证。

## 复验方式

```bash
npm ci
npm run typecheck
npm test
npm run build
```

部署脚本的桩验证在临时目录执行，验证后已清理，不提交；真实环境复验需要 AMD64 Linux + Docker Compose v2 + ACR 只读凭证。
