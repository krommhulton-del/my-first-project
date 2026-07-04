#!/usr/bin/env python3
"""PPT 美化机 v0.1 — 丑 pptx → 提取文字结构 → 套统一版式重生成

用法:
    python scripts/beautify_pptx.py input/答辩.pptx -o output/

思路(只动版式,不改文字):
    1. 逐页读取原 pptx,提取「标题 + 要点(含层级)」纯文本结构
    2. 丢弃原有一切样式,用统一品牌版式重新生成:
       - 首页(标题页):墨蓝底 + 荧光笔强调条,大标题
       - 内容页:纸白底 + 墨蓝标题 + 荧光笔下划线 + 方块项目符号 + 右下页码
    3. 输出到 output/,绝不覆盖原文件

品牌配色(与小红书封面同一套视觉锚点):
    墨蓝 #16243D / 纸白 #F7F5F0 / 标记黄 #FFD84D / 批改红 #E4572E

视觉自查:
    本环境若装了 LibreOffice 可用 `soffice --headless --convert-to pdf` 转 PDF 抽查;
    否则请在 PowerPoint / WPS 打开 output 里的成品确认。
"""
import argparse
import copy
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# —— 品牌配色 ——
INK = RGBColor(0x16, 0x24, 0x3D)
PAPER = RGBColor(0xF7, 0xF5, 0xF0)
MARKER = RGBColor(0xFF, 0xD8, 0x4D)
STAMP = RGBColor(0xE4, 0x57, 0x2E)
MUTED = RGBColor(0x8A, 0x93, 0xA6)

# 字体:西文 + 中文(eastAsia)。微软雅黑在 Win/WPS 上通用,Mac 会回退到黑体族。
FONT_LATIN = "Segoe UI"
FONT_CJK = "微软雅黑"

# 16:9 画布
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


# ============ 结构提取 ============
class SlideContent:
    def __init__(self):
        self.title = ""
        self.subtitle = ""          # 仅标题页可能有
        self.bullets: list[tuple[int, str]] = []  # (缩进层级, 文本)


def extract(prs) -> list[SlideContent]:
    """从原 pptx 抽出每页的标题 + 要点结构。"""
    out: list[SlideContent] = []
    for idx, slide in enumerate(prs.slides):
        sc = SlideContent()
        title_shape = None

        # 找标题占位符
        for ph in slide.placeholders:
            if ph.placeholder_format.type is not None and ph.placeholder_format.idx == 0:
                title_shape = ph
                break
        if title_shape is None and slide.shapes.title is not None:
            title_shape = slide.shapes.title
        if title_shape is not None and title_shape.has_text_frame:
            sc.title = title_shape.text_frame.text.strip()

        # 其余带文字的形状 → 要点(首页的副标题单独归位)
        # 注意:slide.placeholders 与 slide.shapes 返回的是包裹同一 XML 的不同对象,
        # 不能用 `is` 比,要比底层元素。
        title_el = title_shape._element if title_shape is not None else None
        body_texts: list[tuple[int, str]] = []
        for shape in slide.shapes:
            if (title_el is not None and shape._element is title_el) or not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                text = "".join(r.text for r in para.runs).strip() or para.text.strip()
                if text:
                    body_texts.append((max(0, para.level), text))

        # 首页(第 0 页,且没有多条要点)把正文当副标题
        if idx == 0 and len(body_texts) <= 1:
            sc.subtitle = body_texts[0][1] if body_texts else ""
        else:
            sc.bullets = body_texts
        out.append(sc)
    return out


# ============ 版式重建 ============
def _blank_layout(prs):
    """取一个尽量空白的版式(通常最后一个是 Blank)。"""
    # 优先找名字含 Blank 的
    for layout in prs.slide_layouts:
        if "blank" in (layout.name or "").lower():
            return layout
    return prs.slide_layouts[-1]


def _set_run(run, size, color, bold=False, latin=FONT_LATIN, cjk=FONT_CJK):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = latin
    rpr = run._r.get_or_add_rPr()
    ea = rpr.find(qn("a:ea"))
    if ea is None:
        ea = rpr.makeelement(qn("a:ea"), {})
        rpr.append(ea)
    ea.set("typeface", cjk)


def _add_rect(slide, x, y, w, h, fill, line=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
    shp.shadow.inherit = False
    return shp


def _add_text(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Emu(0)
    tf.margin_top = tf.margin_bottom = Emu(0)
    return tf


def _set_bullet(para, char, color):
    """给段落设置方块项目符号(XML 层)。"""
    pPr = para._pPr
    if pPr is None:
        pPr = para._p.get_or_add_pPr()
    # 清掉可能存在的 buNone
    for tag in ("a:buNone", "a:buChar", "a:buAutoNum", "a:buClr", "a:buFont"):
        el = pPr.find(qn(tag))
        if el is not None:
            pPr.remove(el)
    buClr = pPr.makeelement(qn("a:buClr"), {})
    srgb = buClr.makeelement(qn("a:srgbClr"), {"val": "%02X%02X%02X" % (color[0], color[1], color[2])})
    buClr.append(srgb)
    buFont = pPr.makeelement(qn("a:buFont"), {"typeface": "Arial"})
    buChar = pPr.makeelement(qn("a:buChar"), {"char": char})
    pPr.append(buClr)
    pPr.append(buFont)
    pPr.append(buChar)


def build_title_slide(prs, sc: SlideContent):
    slide = prs.slides.add_slide(_blank_layout(prs))
    # 墨蓝满版底
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, INK)
    # 左上角标签条
    tag = _add_rect(slide, Inches(0.9), Inches(0.9), Inches(2.6), Inches(0.62), INK, line=PAPER)
    tf = tag.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    _set_run(p.add_run(), 16, PAPER, bold=True)
    p.runs[0].text = "答辩汇报"
    # 荧光笔强调条(标题左侧)
    _add_rect(slide, Inches(0.9), Inches(3.0), Inches(0.28), Inches(1.7), MARKER)
    # 大标题
    tf = _add_text(slide, Inches(1.4), Inches(2.9), Inches(11.0), Inches(2.0), MSO_ANCHOR.TOP)
    p = tf.paragraphs[0]
    _set_run(p.add_run(), 44, PAPER, bold=True)
    p.runs[0].text = sc.title or "未命名汇报"
    # 副标题
    if sc.subtitle:
        tf = _add_text(slide, Inches(1.4), Inches(5.1), Inches(11.0), Inches(1.0))
        p = tf.paragraphs[0]
        _set_run(p.add_run(), 20, PAPER, bold=False)
        p.runs[0].text = sc.subtitle
        p.runs[0].font.color.rgb = MUTED
    return slide


def build_content_slide(prs, sc: SlideContent, page_no: int):
    slide = prs.slides.add_slide(_blank_layout(prs))
    # 纸白底
    _add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, PAPER)
    # 顶部左侧墨蓝竖条
    _add_rect(slide, Inches(0.9), Inches(0.85), Inches(0.16), Inches(0.75), INK)
    # 标题
    tf = _add_text(slide, Inches(1.25), Inches(0.8), Inches(10.8), Inches(0.9))
    p = tf.paragraphs[0]
    _set_run(p.add_run(), 30, INK, bold=True)
    p.runs[0].text = sc.title or ""
    # 标题下荧光笔下划线
    _add_rect(slide, Inches(1.25), Inches(1.72), Inches(2.4), Inches(0.14), MARKER)

    # 要点区
    if sc.bullets:
        tf = _add_text(slide, Inches(1.25), Inches(2.15), Inches(10.9), Inches(4.6))
        first = True
        for level, text in sc.bullets:
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.level = min(level, 2)
            p.space_after = Pt(14)
            p.line_spacing = 1.25
            run = p.add_run()
            size = 22 if level == 0 else 18
            _set_run(run, size, INK if level == 0 else MUTED, bold=(level == 0))
            run.text = text
            char = "▍" if level == 0 else "–"
            _set_bullet(p, char, STAMP if level == 0 else MARKER)

    # 右下页码
    tf = _add_text(slide, Inches(11.6), Inches(6.85), Inches(1.4), Inches(0.4))
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    _set_run(p.add_run(), 12, MUTED, bold=False)
    p.runs[0].text = f"{page_no:02d}"
    return slide


def beautify(src: Path, out_dir: Path) -> Path:
    src_prs = Presentation(src)
    contents = extract(src_prs)

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    for idx, sc in enumerate(contents):
        if idx == 0 and not sc.bullets:
            build_title_slide(prs, sc)
        else:
            build_content_slide(prs, sc, page_no=idx + 1)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{src.stem}_已美化.pptx"
    prs.save(out_path)
    return out_path


def main():
    ap = argparse.ArgumentParser(description="PPT 美化机:丑 pptx → 统一版式重生成")
    ap.add_argument("input", type=Path, help="输入 .pptx 文件")
    ap.add_argument("-o", "--out", type=Path, default=Path("output"), help="输出目录")
    args = ap.parse_args()

    if not args.input.exists() or args.input.suffix.lower() != ".pptx":
        sys.exit(f"错误: 找不到 pptx 文件 {args.input}")

    result = beautify(args.input, args.out)
    print(f"完成 → {result}")
    print("提示:请在 PowerPoint / WPS 打开确认视觉效果(脚本不改文字,只换版式)。")


if __name__ == "__main__":
    main()
