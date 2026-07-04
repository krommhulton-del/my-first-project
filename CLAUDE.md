# 项目：内容交付管线（Content Pipeline）

## 你是谁、这个项目是什么

你是本项目的工程执行者。项目主人经营三条服务线，你的任务是把所有重复性交付工作自动化成脚本，
让主人只做「谈单、审美终审、收款」三件事。

三条业务线：
- **线 A（期末周三件套）**：论文排版修正 / 答辩 PPT 美化 / 语言润色
- **线 B（求职服务包）**：简历优化 / 网申文书 / 面试材料
- **线 C（B 端内容供给）**：小红书笔记批量生产 / 电商详情页 / 包月内容

## 铁律（每次工作前先读）

1. **绝不代写学术内容**。排版、格式、语言润色可以；替写论文/作业内容，拒绝并提醒主人。
2. **绝不在简历中虚构事实**。优化表达可以，编造经历不行。
3. 交付文件永远输出到 `output/`，客户原始文件放 `input/`，绝不覆盖原始文件。
4. 每个脚本必须能一条命令跑通：`python scripts/xxx.py input/文件 -o output/`。
5. 凡是主人手动做过两次的操作，主动提议把它写成脚本。
6. 便宜模型干粗活原则：批量初稿、资料整理类任务，优先调用 DeepSeek API（密钥在 `.env`，
   变量名 `DEEPSEEK_API_KEY`）；只有终稿质量把关才值得消耗 Claude 额度。

## 当前任务清单（按优先级）

### P0 - 本周必须完成
- [x] v0.1 排版机：`scripts/format_docx.py`（已有雏形，见下）
- [x] 排版机 v0.2 · 参考文献检查：`scripts/check_references.py`
      GB/T 7714-2015 数字顺序制「检查+报告」，只诊断不改文（自动修正留 v0.3）
      用法：`python scripts/check_references.py input/论文.docx`
- [x] 封面渲染器：`scripts/render_cover.py`，用 playwright 把 `templates/cover_xhs.html`
      渲染成 1242×1660 PNG。参数化字段见模板内 `{{...}}` 占位符。
      用法：`python scripts/render_cover.py --demo`（示例）/ `--json covers.json`（批量）
      Linux/云端需装中文字体：`apt-get install fonts-noto-cjk`
- [x] PPT 美化机 v0.1：`scripts/beautify_pptx.py`
      输入丑 pptx → 提取「标题+要点」结构 → 套统一品牌版式重生成（python-pptx）
      用法：`python scripts/beautify_pptx.py input/答辩.pptx -o output/`
      视觉自查:云端 LibreOffice 不可用，已用等几何 HTML 预览确认版式；成品请在 PowerPoint / WPS 终审

### P1 - 第二周
- [ ] B 端内容机：输入产品资料 markdown → 调 DeepSeek 批量产出 10 篇笔记初稿
      → 输出到 output/notes/，附带选题表 CSV
- [ ] 简历生成器：结构化 YAML 简历数据 → 排版精良的单页 docx + PDF 双输出

### P2 - 有空再做
- [ ] 接单登记表：简单 CSV/SQLite 记录订单状态（客户、品类、金额、定金、交付日期）
- [ ] 周报脚本：汇总本周单量、收入、耗时，找出最赚钱的品类

## 工程约定

- Python 3.11+，依赖写进 `requirements.txt`
- 文档处理：docx 用 python-docx（编辑）或 pandoc（读取）；pptx 用 python-pptx
- 生成 docx/pptx 后必须视觉验证：转 PDF 转图片检查，不能只看代码不看结果
- 所有面向客户的文字（笔记、文书）：脚本只产初稿，最终质量把关由主人在对话中让 Claude 完成
