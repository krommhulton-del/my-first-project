# 内容交付管线 · Content Pipeline

把三条服务线的重复交付活儿自动化成脚本,主人只做「谈单、审美终审、收款」。
项目说明书见 [`CLAUDE.md`](./CLAUDE.md);创业落地手册见 [`README_启动手册.md`](./README_启动手册.md)。

## 环境准备

```bash
pip install -r requirements.txt
# 封面渲染在 Linux/云端还需中文字体:
apt-get install -y fonts-noto-cjk        # 或 fonts-wqy-zenhei
```

B 端内容机需要 DeepSeek 密钥,放进 `.env`(已被 .gitignore 忽略,绝不入库):

```bash
echo 'DEEPSEEK_API_KEY=sk-你的key' > .env
```

> ⚠️ 云端 Claude Code 会话默认网络策略会拦截 `api.deepseek.com`。要在云端正式跑,
> 需在环境网络策略里放行该域名;否则请在本机运行 `gen_notes.py`。先用 `--dry-run` 验证流程。

## 已完成的工具(P0)

| 脚本 | 作用 | 一句话跑通 |
|------|------|-----------|
| `scripts/format_docx.py` | 论文 docx 基础排版规范化 | `python scripts/format_docx.py input/论文.docx -o output/` |
| `scripts/check_references.py` | GB/T 7714-2015 参考文献检查+报告 | `python scripts/check_references.py input/论文.docx` |
| `scripts/render_cover.py` | 小红书封面 HTML → 1242×1660 PNG | `python scripts/render_cover.py --demo` |
| `scripts/beautify_pptx.py` | 丑 pptx → 统一品牌版式重生成 | `python scripts/beautify_pptx.py input/答辩.pptx -o output/` |
| `scripts/gen_notes.py` | 产品资料 → DeepSeek 批量 10 篇小红书初稿 | `python scripts/gen_notes.py input/产品资料.md` |
| `scripts/gen_resume.py` | YAML 简历数据 → 单页 PDF + 可编辑 docx | `python scripts/gen_resume.py input/简历.yaml -o output/` |

### 封面渲染器

参数化模板 `templates/cover_xhs.html`,支持三种用法:

```bash
python scripts/render_cover.py --demo                       # 内置示例文案出一张
python scripts/render_cover.py --tag 论文排版急救 \
    --title1 导师看了直摇头 --highlight 10分钟救回来 \
    --subtitle "目录·页码·参考文献 一次修好" \
    --stamp 今日加急 --footer 排版急救室 -o output/cover.png
python scripts/render_cover.py --json covers.json -o output/covers/   # 批量,按 tag 命名
```

示例产物见 [`examples/cover_demo.png`](./examples/cover_demo.png)。
版式建议:`title1` 控制在 7 个中文字符内(超长会自动缩小字号)。

### 参考文献检查器

只诊断、不改原文,输出每条文献的「硬性不合规 / 建议核对」报告到 `output/*.md`。
检查项:序号顺序、文献类型标识 `[J]/[M]/…`、出版年、页码、结尾标点、全角标点混用。

## 目录结构

```
scripts/     四个交付工具
templates/   封面 HTML 模板(配色集中在 :root)
prompts/     报价话术 + DeepSeek 批量提示词
input/       客户原始文件(测试样例已附)
output/      交付产物(绝不覆盖 input)
examples/    可入库的示例产物
```

## 铁律(摘自 CLAUDE.md)

1. 绝不代写学术内容;绝不在简历中虚构事实。
2. 交付永远输出到 `output/`,绝不覆盖 `input/` 原件。
3. 每个脚本都能一条命令跑通。
4. 生成 docx/pptx 后必须视觉验证,不能只看代码不看结果。
