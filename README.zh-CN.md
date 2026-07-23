# My Wiki

安装一次 Agent Skill，知识库可以放在电脑的任何位置。

[English](README.md)

My Wiki 是由 Codex 或 OpenCode 维护的本地 Markdown 知识系统。工具和知识库完全分开：

- My Wiki Skill 只需安装一次；
- 可以在任意路径创建一个或多个知识库；
- 用自然语言让 Agent 入库、维护、检索、回答问题和查看图谱；
- 私有的 `raw/` 和 `wiki/` 不进入工具源码仓库。

默认不需要云端数据库、向量数据库、Obsidian 或付费 API。

## 架构

```text
Codex / OpenCode
       |
       v
自包含 My Wiki Skill
       |
       +---- personal -> D:\Knowledge\Personal
       +---- work     -> E:\Knowledge\Work
       +---- project  -> /Users/me/Projects/acme-vault
```

每个知识库拥有自己的数据：

```text
my-vault/
  .my-wiki.json       知识库标记
  .my-wiki/           本地缓存和运行状态
  raw/                原始证据、快照和图片
  wiki/               可复用的知识页面
  templates/          当前知识库的 Markdown 模板
```

安装后的 Skill 同时包含 Agent 工作流、CLI 引擎、模板和 Dashboard，可以独立于源码仓库运行。

## 安装 Skill

需要 Node.js 18+ 和 Git。

```bash
git clone https://github.com/NimaChu/my-wiki.git
cd my-wiki
npm run skill:install
```

安装器会把完整的 `my-wiki/` 目录复制到：

- Codex：`~/.codex/skills/my-wiki`
- OpenCode：`~/.config/opencode/skills/my-wiki`

也可以只安装一个：

```bash
npm run skill:install -- --codex-only
npm run skill:install -- --opencode-only
```

安装后重启 Codex 或 OpenCode，让 Agent 发现新 Skill。

仓库开发者可以使用 `npm run skill:install -- --link` 安装目录链接，便于源码修改立即生效。

## 在任意路径创建知识库

```bash
node my-wiki/scripts/my-wiki.mjs init "D:\Knowledge\Personal" --name personal --use
```

这条命令会创建 Markdown 目录结构，注册名为 `personal` 的知识库，并将它设为默认库。以后 Agent 不需要在 My Wiki 源码仓库中工作。

直接对 Agent 说：

```text
把这篇网页入库到 personal 知识库。
维护知识库。
查询 FlexSim Process Flow 的相关知识。
打开知识图谱。
```

短指令就够了，Skill 会找到知识库并执行完整流程。

## 多知识库

注册已有知识库，不需要移动文件：

```bash
node my-wiki/scripts/my-wiki.mjs vault add work "E:\Knowledge\Work"
node my-wiki/scripts/my-wiki.mjs vault use work
node my-wiki/scripts/my-wiki.mjs vault list
node my-wiki/scripts/my-wiki.mjs where
```

只为某条命令指定知识库：

```bash
node my-wiki/scripts/my-wiki.mjs --vault personal status
node my-wiki/scripts/my-wiki.mjs --vault "E:\Knowledge\Work" search "simulation"
```

知识库查找顺序：

1. `--vault <名称或路径>`
2. `MY_WIKI_VAULT` 或兼容的旧环境变量
3. 当前目录向上最近的 `.my-wiki.json`
4. `~/.my-wiki/config.json` 中的默认知识库
5. 为兼容旧版本，最后才使用附近同时包含 `raw/` 和 `wiki/` 的旧知识库

## 现有用户迁移

已有 `raw/` 和 `wiki/` 的工作区可以直接注册为默认知识库，不移动任何文件：

```bash
node my-wiki/scripts/my-wiki.mjs vault add current "E:\agent-wiki\knowledge-base" --use
```

以后可以再移动知识库并更新注册路径。公开 Git 仓库不再跟踪任何 `raw/` 或 `wiki/` 内容。

## 工作机制

1. 把网页、PDF、笔记等保存到目标知识库的 `raw/`。
2. 保留来源信息、快照、图片顺序和必要的视觉证据。
3. 把可复用知识蒸馏成 `wiki/` 下的原子页面。
4. Wiki 中的事实链接回 raw，raw 也链接到主要 Wiki 页面。
5. 使用 status、lint、garden、universes 和 repair-links 检查健康度。
6. 只有用户要求可视化时才启动 Dashboard。

`processed` 不是简单的进度标签：主要 Wiki 目标可解析、Wiki 已回链证据、后续事项关闭后，raw 才能标记为 processed。

## 常用命令

```bash
node my-wiki/scripts/my-wiki.mjs init /path/to/vault --name personal --use
node my-wiki/scripts/my-wiki.mjs vault list
node my-wiki/scripts/my-wiki.mjs vault add NAME /path/to/vault
node my-wiki/scripts/my-wiki.mjs vault use NAME
node my-wiki/scripts/my-wiki.mjs where

node my-wiki/scripts/my-wiki.mjs --vault NAME status
node my-wiki/scripts/my-wiki.mjs --vault NAME lint
node my-wiki/scripts/my-wiki.mjs --vault NAME garden
node my-wiki/scripts/my-wiki.mjs --vault NAME universes
node my-wiki/scripts/my-wiki.mjs --vault NAME repair-links
node my-wiki/scripts/my-wiki.mjs --vault NAME search "关键词"
node my-wiki/scripts/my-wiki.mjs --vault NAME capture --title "标题" --url "https://example.com"
node my-wiki/scripts/my-wiki.mjs --vault NAME images --source raw/source-note.md
node my-wiki/scripts/my-wiki.mjs --vault NAME open-dashboard
```

根目录 npm 命令继续保留，用于源码开发和旧版本兼容。

## 知识图谱

Dashboard 可以显示当前知识库的宇宙、Wiki 关系和 raw 证据。它只在需要时启动：

```bash
node my-wiki/scripts/my-wiki.mjs --vault personal open-dashboard
```

使用 `dashboard` 可以只在后台静默启动服务而不打开浏览器。后台 Vite 服务和 watcher 都不会弹出终端窗口。

运行期间 watcher 会跟踪当前知识库的 Markdown。打开另一个知识库时，图谱和 watcher 会切换到新库。

## 图片和网页抓取

My Wiki 会保留图片引用，也可以把有用的远程图片下载到目标知识库。Firecrawl MCP 是可选的网页抓取辅助工具，不是知识库的数据源。

无论使用什么外部抓取工具，最终证据都要写入 `raw/`，再经过正常维护流程。

## 源码仓库结构

```text
my-wiki/              完整的可安装 Skill
  scripts/core/       CLI 引擎
  assets/templates/   init 时复制的模板
  assets/dashboard/   可选的本地前端
  tests/              仅用于源码回归测试，安装时不会复制
knowledge-base/       本地忽略的知识库数据
paper/                本地忽略的论文和数据材料
backup/               本地忽略的旧文件
```

源码仓库不会跟踪用户的 `raw/`、`wiki/`、快照和图片资源。

## 开源许可证

My Wiki 使用 [MIT License](LICENSE.txt) 开源。
