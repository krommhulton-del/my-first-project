#!/usr/bin/env python3
"""排版机 v0.1 — 论文/报告 docx 基础格式规范化

用法:
    python scripts/format_docx.py input/论文.docx -o output/

做什么:
    - 正文: 宋体/Times New Roman 小四(12pt), 1.5倍行距, 首行缩进2字符
    - 标题: 识别 Heading 1-3 样式, 统一为黑体加粗 (H1 16pt / H2 14pt / H3 13pt)
    - 页边距: 上下 2.54cm, 左右 3.18cm (Word 默认标准)
    - 段落间距归零(靠行距控制), 清除多余空段落

不做什么(v0.2 计划):
    - GB/T 7714 参考文献格式 (先人工核对)
    - 目录自动生成 (在 Word 里"引用→目录"一键插入即可)
"""
import argparse
import sys
from pathlib import Path

from docx import Document
from docx.shared import Pt, Cm
from docx.oxml.ns import qn

BODY_CN, BODY_EN, BODY_SIZE = "宋体", "Times New Roman", Pt(12)
HEAD_CN = "黑体"
HEAD_SIZES = {1: Pt(16), 2: Pt(14), 3: Pt(13)}


def set_fonts(run, cn: str, en: str, size):
    run.font.name = en
    run.font.size = size
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), cn)


def heading_level(paragraph) -> int | None:
    name = (paragraph.style.name or "").lower()
    if name.startswith("heading"):
        try:
            return int(name.split()[-1])
        except ValueError:
            return None
    return None


def format_document(src: Path, out_dir: Path) -> Path:
    doc = Document(src)

    for section in doc.sections:
        section.top_margin = section.bottom_margin = Cm(2.54)
        section.left_margin = section.right_margin = Cm(3.18)

    empty_streak = 0
    for para in list(doc.paragraphs):
        if not para.text.strip():
            empty_streak += 1
            if empty_streak > 1:  # 连续空段只留一个
                para._element.getparent().remove(para._element)
            continue
        empty_streak = 0

        level = heading_level(para)
        pf = para.paragraph_format
        pf.space_before = pf.space_after = Pt(6 if level else 0)
        pf.line_spacing = 1.5

        if level and level in HEAD_SIZES:
            pf.first_line_indent = None
            for run in para.runs:
                set_fonts(run, HEAD_CN, HEAD_CN, HEAD_SIZES[level])
                run.font.bold = True
        else:
            pf.first_line_indent = Pt(24)  # 约2个中文字符
            for run in para.runs:
                set_fonts(run, BODY_CN, BODY_EN, BODY_SIZE)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{src.stem}_已排版{src.suffix}"
    doc.save(out_path)
    return out_path


def main():
    ap = argparse.ArgumentParser(description="docx 基础格式规范化")
    ap.add_argument("input", type=Path, help="输入 .docx 文件")
    ap.add_argument("-o", "--out", type=Path, default=Path("output"), help="输出目录")
    args = ap.parse_args()

    if not args.input.exists() or args.input.suffix.lower() != ".docx":
        sys.exit(f"错误: 找不到 docx 文件 {args.input}")

    result = format_document(args.input, args.out)
    print(f"完成 → {result}")


if __name__ == "__main__":
    main()
