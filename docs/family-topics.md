# 家庭议题与热门内容

家庭议题是 HomeHi 内的一个轻量讨论区：家人发起议题（例如「周末去哪露营」「要不要换一套沙发」），每个人可以用「赞成 / 再看看 / 有顾虑」留下看法，同时展示 10 条高热度内容作为参考。

热门内容由 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 抓取。MediaCrawler 是 Python CLI，需要登录态和浏览器环境，本身不提供 HTTP API，因此 HomeHi 不直接内置它，而是通过一个很小的 **HTTP 适配器** 对接。没有配置适配器时，议题、看法等功能完全可用，页面只显示「未接入内容服务」。

## 1. 配置

在 `.env` 中填写：

```env
MEDIA_CRAWLER_URL="http://127.0.0.1:8848/search"
MEDIA_CRAWLER_TOKEN=""
```

- `MEDIA_CRAWLER_URL`：适配器的完整地址。HomeHi 会在后面追加 `keyword` 和 `limit` 查询参数。
- `MEDIA_CRAWLER_TOKEN`：可选。填写后 HomeHi 会发送 `Authorization: Bearer <token>`。
- 只会在服务端读取，不会暴露给浏览器。

使用 Docker Compose 时，`.env` 已通过 `env_file: .env` 注入 `web` 和 `worker`，无需在 `docker-compose.yml` 里重复声明。若适配器也在同一个 Compose 网络中，地址用服务名即可，例如 `http://mediacrawler:8848/search`。

## 2. 适配器契约

### 请求

```http
GET /search?keyword=周末去哪露营&limit=10
Accept: application/json
Authorization: Bearer <可选 token>
```

`keyword` 最长 60 字符，`limit` 范围 1–20（HomeHi 固定请求 10）。

### 响应

HTTP 200，`Content-Type: application/json`。以下结构都支持：

```jsonc
// 1. 直接数组
[ { "title": "...", "url": "https://..." } ]

// 2. items / results
{ "items": [ ... ] }
{ "results": [ ... ] }

// 3. data 包裹
{ "data": [ ... ] }
{ "data": { "items": [ ... ] } }
```

单条内容支持以下字段（中英文别名均可，未知字段会被忽略）：

| 字段 | 必填 | 说明 / 可接受的别名 |
| --- | --- | --- |
| `title` | 是 | `title`、`note_title`、`name`；缺失时取 `desc` / `content` / `text` 的前 80 字 |
| `url` | 是 | 必须是 `http(s)://` 绝对地址；`url`、`note_url`、`share_url`、`web_url`、`link`、`aweme_url` |
| `platform` | 否 | `platform`、`source`、`channel`。`xhs`/`dy`/`bili`/`wb`/`zhihu`/`ks`/`tieba` 会转成中文名 |
| `author` | 否 | `author`、`nickname`、`user_name`、`screen_name`，也支持 `user.nickname` |
| `heat` | 否 | `heat`、`hot`、`score`、`liked_count`、`like_count`、`likes`、`digg_count`、`view_count`、`play_count`；数字会格式化为 `1.2万` / `3.4亿` |
| `summary` | 否 | `summary`、`description`、`desc`、`content`、`text`，最多 240 字 |
| `coverUrl` | 否 | `cover_url`、`coverUrl`、`cover`、`image_list`、`images`；也支持 `[{ "url": "..." }]` |
| `publishedAt` | 否 | `published_at`、`publish_time`、`create_time`、`created_at`、`time`；支持 ISO 字符串、10 位或 13 位时间戳 |

小红书 / 抖音常见的嵌套结构也可直接返回，适配器会展开 `note_card` 和 `aweme_info`：

```json
[
  {
    "platform": "xhs",
    "note_card": {
      "display_title": "周末露营装备清单",
      "user": { "nickname": "山野日记" },
      "interact_info": { "liked_count": "12000" }
    },
    "note_url": "https://www.xiaohongshu.com/explore/..."
  }
]
```

> `display_title` 目前不在别名列表里，适配器最好统一成 `title`。

### 行为约定

- HomeHi 按 URL 去重，最多保存返回顺序中的前 10 条。
- 请求超时 15 秒，响应体上限 1.5 MB，超限视为失败。
- 非 2xx、JSON 解析失败、字段缺失都会显示「暂时没有拿到热门内容」，不会影响议题本身。
- 自动抓取只在议题首次打开且从未抓取过时触发一次；失败后也会记录时间，避免反复请求。用户可以点「刷新」手动重试。
- 每次刷新会整体替换该议题已保存的 10 条内容，不会累加。

## 3. 最小适配器示例

下面是一个 FastAPI 适配器骨架。它把 MediaCrawler 的抓取结果读出来后，整理成 HomeHi 需要的结构。实际抓取可以调用 MediaCrawler 的 CLI，也可以读取它导出的 JSON/数据库；生产环境建议加缓存，避免每个议题都重新登录抓取。

```python
# adapter/main.py
import json
import os
import subprocess
from pathlib import Path

from fastapi import FastAPI, Query

app = FastAPI()
MEDIA_CRAWLER_HOME = Path(os.environ["MEDIA_CRAWLER_HOME"]).resolve()
OUTPUT = MEDIA_CRAWLER_HOME / "data" / "search_contents.json"


def run_crawler(keyword: str) -> list[dict]:
    # 以 MediaCrawler 的实际命令为准；这里只是示意。
    subprocess.run(
        ["uv", "run", "main.py", "--platform", "xhs", "--type", "search",
         "--keywords", keyword],
        cwd=MEDIA_CRAWLER_HOME,
        check=True,
        timeout=120,
    )
    return json.loads(OUTPUT.read_text(encoding="utf-8"))


def normalize(row: dict) -> dict:
    return {
        "title": row.get("title") or row.get("note_title") or row.get("desc", "")[:80],
        "url": row.get("url") or row.get("note_url"),
        "platform": "xhs",
        "author": (row.get("user") or {}).get("nickname") or row.get("nickname"),
        "heat": row.get("liked_count") or row.get("likes"),
        "summary": row.get("desc") or row.get("content"),
        "coverUrl": row.get("cover_url") or row.get("image_list"),
        "publishedAt": row.get("time"),
    }


@app.get("/search")
def search(keyword: str = Query(min_length=1, max_length=60), limit: int = 10):
    rows = run_crawler(keyword)
    items = [item for item in map(normalize, rows) if item["url"] and item["title"]]
    return {"items": items[: min(max(limit, 1), 20)]}
```

构建镜像后，在同一个 Compose 网络里把 `MEDIA_CRAWLER_URL` 指过去即可：

```yaml
services:
  web:
    # ...
    environment:
      MEDIA_CRAWLER_URL: http://mediacrawler-adapter:8848/search
    depends_on:
      - mediacrawler-adapter

  mediacrawler-adapter:
    build: ./adapter
    restart: unless-stopped
    environment:
      MEDIA_CRAWLER_HOME: /opt/MediaCrawler
    volumes:
      - ./MediaCrawler:/opt/MediaCrawler
      - ./MediaCrawler/data:/opt/MediaCrawler/data
```

## 4. 注意事项

- MediaCrawler 的登录态、Cookie、反爬策略由它自己维护；适配器只负责把结果转成上面的 JSON。
- 不要把 Cookie、Token 或登录二维码放到前端。
- 抓取频率请遵守目标站点规则和当地法律法规，只用于家庭内部的参考阅读。
- 如果暂时不想部署爬虫，留空 `MEDIA_CRAWLER_URL` 即可，议题和家人的看法不受影响。
