# 回收站与照片上传：问题清单（Phase 1）

审查对象：`main` 分支 `bb78f91`（媒体生命周期引用检查与存储审计）。

审查方式：逐条走真实界面入口 → Server Action / Route Handler → Prisma / 存储驱动，并在开发模式与
standalone 生产模式下实际上传、删除、恢复。下表只列已确认的问题；未复现的猜测不写入本清单。

## 一、删除 / 回收站问题

| # | 位置 | 触发条件 | 影响 |
| --- | --- | --- | --- |
| D1 | [lib/access.ts](../lib/access.ts) `canViewEntry`；[app/actions/entries.ts](../app/actions/entries.ts) `restoreEntryAction` | 任意记录进入回收站后点击「恢复」 | `canViewEntry` 对 `status === "DELETED"` 恒为 `false`，恢复分支永远不执行。界面上有按钮，但记录永远无法恢复。 |
| D2 | [app/actions/entries.ts](../app/actions/entries.ts) `restoreEntryAction` | 恢复到一条原本是草稿或已归档的记录 | 恢复一律写成 `PUBLISHED`，丢失删除前状态；草稿会被公开到家庭时间线。 |
| D3 | [lib/media-lifecycle.ts](../lib/media-lifecycle.ts) `softDeleteMedia` | 删除任何照片 | 软删除直接 `deleteMany AlbumMedia`，并清空记录/相册/旅行封面、用户/档案头像、物品照片。恢复后这些关系无法重建，照片回到照片墙却永久离开原相册、失去封面/头像身份。违反本次 PRD「恢复必须恢复完整业务数据及原有关系」。 |
| D4 | [lib/media-lifecycle.ts](../lib/media-lifecycle.ts) `softDeleteMedia` | 删除仍被记录或旅行引用的照片 | `EntryMedia` / `TripVisitPhoto` 被保留，但恢复时没有状态保护；同时回收站把相册关联也当作阻止彻底删除的引用，导致「从相册移除后才能删照片」的语义与「删除照片应保留相册关系」冲突。 |
| D5 | [scripts/worker.ts](../scripts/worker.ts) | 任意时间 | worker 只处理提醒、图片变体和视频转码，没有任何回收站清理逻辑；记录和照片会无限期留在回收站。 |
| D6 | [lib/media-lifecycle.ts](../lib/media-lifecycle.ts) `purgeMedia` | 同时点击恢复和彻底删除，或 worker 与用户同时操作 | 没有 `PURGING` 中间态和原子认领。恢复可能在文件已删除后把媒体写回 `ACTIVE`，形成「照片存在但打不开」；两个清理任务也可能同时删除同一批文件。 |
| D7 | [app/actions/entries.ts](../app/actions/entries.ts) `purgeEntryAction` | 两个标签页同时彻底删除同一条记录 | `findUnique` 后 `delete`，并发时第二次触发 `P2025`，Server Action 抛错。没有原子条件删除。 |
| D8 | [lib/media-lifecycle.ts](../lib/media-lifecycle.ts) `purgeMedia` | 清理任务中途崩溃 | 文件可能已删、数据库行仍是 `DELETED`，没有 `purgeStartedAt` 之类的中断标记，无法区分「从未开始」和「清理到一半」，重启后也没有恢复流程。 |
| D9 | [app/actions/media.ts](../app/actions/media.ts) `removeMediaFromAlbumAction` | 移除当前封面，相册下一张恰好是已删除照片 | 选择下一张封面时没有过滤 `ACTIVE`，新封面可能指向回收站里的照片。 |
| D10 | [app/actions/media.ts](../app/actions/media.ts) `setAlbumCoverAction` | 直接调用 Action 把回收站里的照片设为封面 | 只校验 `AlbumMedia` 关联存在；关联被保留后，已删除照片可以被设为封面。 |
| D11 | [app/api/media/[id]/route.ts](../app/api/media/%5Bid%5D/route.ts) | 取消刚上传、尚未保存的照片 | 删除接口在无引用时直接彻底删除，有引用时才软删除。与「删除照片 = 移入回收站」不一致，也让「取消上传」和「删除照片」出现两套语义。 |
| D12 | 数据库 | 升级前已存在的 `status = "DELETED"` 行 | 部分历史行 `deletedAt` 为空，无法计算剩余保留期；旧软删除已经物理删除了 `AlbumMedia` 和封面/头像字段，这部分关系无法从数据库恢复。 |
| D13 | [app/(app)/trash/page.tsx](../app/(app)/trash/page.tsx) | 查看回收站 | 没有剩余保留期、过期标记、`PURGING` 状态；超过 30 天的项目仍显示「恢复」按钮；照片和记录混排且没有彻底删除的二次确认说明（记录有，照片依赖通用确认）。 |

## 二、照片上传问题

| # | 位置 | 触发条件 | 影响 |
| --- | --- | --- | --- |
| U1 | [next.config.ts](../next.config.ts) 与 standalone 构建 | 用 `output: "standalone"` 部署后上传任意图片 | Next 的文件追踪只复制了 `@img/sharp-win32-x64/lib/sharp-win32-x64-*.node`，没有复制同目录的 `libvips-42.dll` / `libvips-cpp-8.18.7.dll`。生产日志报 `ERR_DLOPEN_FAILED`，上传接口返回 500。开发模式不受影响，因此很容易被误判为代码问题。已在 `.tmp-upload/prod.log` 复现。 |
| U2 | [lib/media-dedupe.ts](../lib/media-dedupe.ts) `dedupeScopeFor`；[lib/media.ts](../lib/media.ts) `findReusableImage` | 成员 B 上传一张成员 A 已上传过的共享图片 | 共享图片按 `SHARED` 去重，B 的请求复用 A 的 `Media` 行（`uploadedBy = A`）。B 能看到上传成功，但之后无法编辑或删除这张照片（`deleteMediaAction` / `updateMediaAction` 只允许上传者或 OWNER），违反「上传者权限不能因为去重复用而发生变化」。 |
| U3 | [app/api/media/upload/route.ts](../app/api/media/upload/route.ts)；[components/photos/PhotoUploadScreen.tsx](../components/photos/PhotoUploadScreen.tsx) | 上传完成后点「完成」回到照片页 | 上传接口没有 `revalidatePath("/photos")`，页面又配置了 `staleTimes.dynamic = 30`。30 秒内返回照片页可能看到上传前的列表，用户会认为上传没有成功。 |
| U4 | [app/(app)/photos/page.tsx](../app/(app)/photos/page.tsx) 排序 | 上传没有 EXIF 拍摄时间的图片 | 代码会回退为上传时间，排序正确；此项经实测不构成问题。记录在此，避免后续误改。 |

## 三、历史数据风险

- 旧版 `softDeleteMedia` 已删除的 `AlbumMedia`、封面、头像、物品照片字段**无法自动重建**。新版只能保证从本次升级之后删除的照片可完整恢复。
- 旧版回收站里的记录没有 `deletedFromStatus`，恢复时统一回到 `PUBLISHED`；这是历史信息缺失，不是新逻辑可以推断的。
- 旧版 `deleteEntryAction` 写入的 `deletedAt` 是完整的；只有更早的数据可能为空。迁移会给 `deletedAt` 为空的历史回收站行**从升级时刻起重新计算 30 天**，避免升级后立即批量永久删除历史数据。
- 旧版共享去重行会被迁移为「上传者 + 可见性」范围。迁移不会删除或合并任何 `Media`，也不会删除文件。

## 四、修复前的备份方案

在任何迁移或清理代码上线前执行：

1. 停止 web 与 worker（Docker：`docker compose stop`）。
2. 运行 `npm run backup`。脚本用 `VACUUM INTO` 生成一致性数据库快照，并复制本地 `storage/`；使用 OSS 时数据库备份仍包含所有对象键，OSS 侧需要已有的版本控制或跨区域复制。
3. 把备份目录复制到另一块磁盘或另一台设备，确认 `homehi.db` 非空、`storage/` 文件数量与线上一致。
4. 在测试环境用 `npm run restore -- <备份目录> --force` 演练一次恢复（会先把当前数据改名为 `*.before-restore-*`）。
5. 生产升级后先运行 `npm run audit:media`，确认数据库与本地/OSS 对象一致，再让 worker 开始自动清理。

本仓库的开发验证在临时数据库上进行，没有改动用户数据。生产环境执行迁移前必须完成上述备份；迁移本身只新增列和索引，并对历史回收站行做可解释的回填，不删除行、不删除文件。

## 五、本次修复范围

- 记录与照片的软删除、恢复、彻底删除、30 天保留与自动清理、并发认领和失败重试。
- 照片上传的 standalone 运行时依赖、上传后列表刷新、去重归属权限。
- 不新增业务模块，不改变 OWNER / MEMBER、PRIVATE / HOUSEHOLD、单家庭和本地 / OSS 架构。

完整的验收执行记录见 `docs/trash-upload-test-report.md`。
