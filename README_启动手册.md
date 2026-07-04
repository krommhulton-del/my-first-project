# 工作流启动包 · 落地手册

## 今天(1小时内完成)

1. **装 Claude Code**:你的 Max 订阅直接登录就能用。
   桌面版:下载 Claude Desktop → Code 标签页;或终端安装 CLI 版。
2. **建项目**:新建文件夹 `content-pipeline/`,把本包所有文件解压进去。
3. **对 Claude Code 说第一句话**(原话照抄):
   > 读 CLAUDE.md,把 P0 任务清单里的「封面渲染器」做出来,
   > 用 templates/cover_xhs.html 渲染一张示例封面给我看。
   做完再让它做「排版机 v0.2」和「PPT 美化机」。

## 本周

- 第 1-2 天:CC 完成 P0 三个工具 → 你用测试文件各跑一遍
- 第 3 天:用封面渲染器做 3 张"改造前后"对比图 → 小红书发第一批笔记;
  同时闲鱼上架三个服务链接(报价见 prompts/谈单与需求收集.md)
- 第 4-7 天:校园群发期末周服务信息,接单。每单交付后截图存档(脱敏),
  变成下一条小红书素材

## 包内文件

- `CLAUDE.md` — 给 Claude Code 的项目说明书(核心资产,所有任务都在里面)
- `scripts/format_docx.py` — 排版机 v0.1(已测试可用)
- `templates/cover_xhs.html` — 小红书封面模板(参数化,换文字即出图)
- `prompts/谈单与需求收集.md` — 报价单 + 话术 + 需求表
- `prompts/B端内容机_主提示词.md` — 批量笔记初稿的 DeepSeek 提示词
- `input/测试论文.docx` + `output/测试论文_已排版.docx` — 排版机测试样例

## 额度分配原则(重要)

DeepSeek 干粗活(批量初稿、拆解) → Gemini 干看图和配图 →
Claude 只碰终稿把关和管线开发。任务攒批次集中做,别零散消耗 5 小时窗口。
