# 家庭议题

家庭议题用于把一家人要一起商量的信息留在一个地方。它不是公开论坛，也不抓取外部平台内容；所有内容只属于当前家庭。

## 一个议题里可以做什么

| 内容 | 数据表 | 说明 |
| --- | --- | --- |
| 议题与背景 | `Topic` | 标题、背景说明，创建人默认是发起人 |
| 想法记录 | `TopicNote` | 随时补充的自由文本，按时间倒序展示 |
| 家人意见 | `TopicOpinion` | 赞成 / 再看看 / 有顾虑，附一句话理由 |
| 链接 | `TopicLink` | 支持直接粘贴网址或其他 App 的分享文案 |
| 文件 | `TopicAttachment` | 合同、报价单、照片等，大小受 `MAX_UPLOAD_MB` 限制 |
| 重要日期 | `TopicDate` | 出发、截止、交房等日期，附可选备注 |
| 关联待办 | `TopicTask` | 关联家庭里已有的待办，不复制一份新的 |
| 决定与结果 | `Topic.decision` / `Topic.outcome` | 由发起人或家庭管理员记录；记录后议题标记为「已决定」 |

议题状态只有 `OPEN` 和 `CLOSED`。展示状态由以下规则推导：

- `OPEN`：讨论中；
- `CLOSED` 且已有决定：已决定；
- `CLOSED` 且没有决定：已结束。

重新打开一个已决定的议题不会清空决定，决定仍作为历史保留在议题顶部。

## 粘贴分享链接

`lib/topics.ts` 中的 `extractSharedUrl()` 会从一整段分享文案里取出第一个 `http` / `https` 链接：

- 自动停在空格、引号、中文标点、括号等位置；
- 去掉链接末尾的英文句点、逗号等；
- 只接受 `http:` 和 `https:`，长度不超过 2000 字符。

`deriveLinkTitle()` 优先使用文案中的 `【标题】`，其次使用链接前的文字，最后回退到域名。`detectLinkPlatform()` 根据域名识别小红书、抖音、B站、微博、知乎、快手、淘宝、京东、微信、YouTube。

同一议题内相同 URL 只保存一次（`TopicLink.topicId_url` 唯一约束）。

## 文件存储

文件上传走 `POST /api/topic-attachments`，而不是 Server Action：Server Action 的请求体默认只有 1 MB，而议题附件需要遵循系统的 `MAX_UPLOAD_MB`。

- 上传时校验登录状态和议题所属家庭；
- 使用系统统一的存储驱动（本地目录或阿里云 OSS），记录 `storageKey` 和 `storageDriver`；
- 下载走 `GET /api/topic-attachments/[id]`，同样校验家庭；
- 下载响应固定为 `application/octet-stream` + `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`，避免浏览器把上传的 HTML/SVG 当作页面执行；
- 删除议题或附件时，会同时清理存储里的文件；清理失败不会阻止数据库删除。

## 权限

- 议题、想法、意见、链接、文件、日期都按 `householdId` 隔离；
- 议题创建人或家庭 `OWNER` 可以记录决定、结束/重新打开、删除议题；
- 单条内容的创建人可以删除自己的内容，议题创建人和 `OWNER` 可以删除议题下的任意内容；
- 关联待办时通过 `taskWhere(viewer)` 校验，家人看不到的私有待办不会出现在选择列表里，也不会链接进议题。

## 导出

`GET /api/export` 的 ZIP 中包含：

- `homehi-data.json`：议题及其想法、意见、链接、日期、关联待办；
- `topics/<topicId>/<attachmentId>-<filename>`：议题附件的原始文件。

## 不再包含爬虫

早期版本计划通过 MediaCrawler 抓取热门内容。该能力已移除：

- 不再需要 `MEDIA_CRAWLER_URL` / `MEDIA_CRAWLER_TOKEN`；
- 不再有 `TopicContent` 表、关键词字段和热门内容列表；
- 议题页面完全基于家庭内部记录，不依赖任何外部内容服务。
