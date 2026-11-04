# 媒体查询性能记录

记录日期：2026-11-04。本文件中的数字来自实际运行的 `npm run bench:media`，不是估算。

## 测试环境

| 项目 | 值 |
| --- | --- |
| 机器 | Intel Core 5 220H，Windows 11 |
| Node.js | v24.22.1 |
| 数据库 | SQLite（Prisma 6.19.3），本地磁盘 |
| 每项查询 | 预热 2 次后连续 15 次，取中位数与 P95 |
| 合成数据 | 单家庭；5% 媒体 `takenAt` 为 NULL；5% 视频；10% 收藏；约 14% 属于另一成员；每 13 条一条 PRIVATE |

相册数据分两种：一个相册包含全部媒体（最坏情况），另一个包含 10%。

## 结果

### 照片列表（每页 30 条）

| 数据规模 | 首页 P95 | 第二页 keyset P95 | 收藏 P95 | 视频 P95 |
| --- | --- | --- | --- | --- |
| 1,000 | 1.57 ms | 2.39 ms | 1.11 ms | 0.86 ms |
| 10,000 | 1.89 ms | 2.41 ms | 0.95 ms | 1.41 ms |
| 50,000 | 1.26 ms | 1.75 ms | 1.67 ms | 1.47 ms |
| 100,000 | 2.68 ms | 4.01 ms | 3.02 ms | 2.76 ms |

### 相册与选择器

| 数据规模 | 相册首页 P95 | 相册第二页 P95 | 相册数量（上限 1000）P95 | 选择器（相册占 10%）P95 | 选择器（相册占 100%）P95 |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 0.89 ms | 0.94 ms | 4.31 ms | 1.78 ms | 2.19 ms |
| 10,000 | 1.87 ms | 1.78 ms | 3.76 ms | 1.06 ms | 18.97 ms |
| 50,000 | 1.86 ms | 1.88 ms | 5.28 ms | 4.82 ms | 362.13 ms |
| 100,000 | 6.11 ms | 7.32 ms | 13.06 ms | 3.58 ms | 640.34 ms |

### 执行计划（100,000 条）

```text
photos page1:
  SEARCH Media USING INDEX Media_householdId_status_takenAt_createdAt_id_idx (householdId=? AND status=?)
photos favorites:
  SEARCH Media USING INDEX Media_householdId_status_favorite_takenAt_createdAt_id_idx (householdId=? AND status=? AND favorite=?)
photos videos:
  SEARCH Media USING INDEX Media_householdId_status_mediaType_takenAt_createdAt_id_idx (householdId=? AND status=? AND mediaType=?)
album page1:
  SEARCH AlbumMedia USING COVERING INDEX AlbumMedia_albumId_sortOrder_mediaId_idx (albumId=?)
  LIST SUBQUERY 1
  SEARCH Media USING INDEX Media_householdId_status_favorite_takenAt_createdAt_id_idx (householdId=? AND status=?)
picker page1:
  SEARCH Media USING INDEX Media_householdId_status_takenAt_createdAt_id_idx (householdId=? AND status=?)
  CORRELATED SCALAR SUBQUERY 1
  SEARCH AlbumMedia USING COVERING INDEX sqlite_autoindex_AlbumMedia_1 (albumId=? AND mediaId=?)
```

## 本轮改动

1. 列表与相册改用 keyset 游标。Prisma 自带的 `cursor` 在复合排序上会生成多重 OR 子查询；实测 100k 时照片第二页约 190 ms、相册第二页约 2.4 s。手工 keyset 后分别降到约 3 ms 和 4 ms。
2. 索引与排序键对齐：
   - `Media(householdId, status, takenAt, createdAt, id)`
   - `Media(householdId, status, createdAt, id)`
   - `Media(householdId, status, mediaType, takenAt, createdAt, id)`
   - `Media(householdId, status, favorite, takenAt, createdAt, id)`
   - `AlbumMedia(albumId, sortOrder, mediaId)`
   - `AlbumMedia(mediaId, albumId)`
3. 试行过的成员维度索引会诱导列表查询选择错误索引并产生 `TEMP B-TREE`，已删除。
4. 去重查询由 `(householdId, checksum, dedupeScope)` 唯一索引直接覆盖，没有额外的 checksum 索引。
5. 照片总数不再每次做全量 `COUNT`；相册数量最多统计 1000 条，超过后显示 `1000+`。首页相册轮播不再聚合每个相册的数量。

## 限制

- 数据是单机合成数据，未测试并发上传、冷缓存或 NAS 机械盘；生产环境耗时会更高。
- 选择器在“相册已包含全部媒体”时仍需扫描完整索引才能证明没有可添加项，100k 时 P95 约 640 ms。相册只包含一小部分媒体时约 4 ms。
- 上述数字只覆盖本文件列出的查询路径；其他页面（搜索、首页、时间线）未纳入本轮十万级结论。
- 未验证 100k 数据下的缩略图生成、备份恢复或 OSS 读取耗时。

## 复现

```bash
npm run bench:media            # 1k / 10k / 50k / 100k
npm run bench:media -- 100000  # 只跑指定规模
```

脚本会复制 `data/homehi.db` 到临时文件、写入合成数据、完成后删除，不会修改真实家庭数据。
