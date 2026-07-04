#!/usr/bin/env python3
"""排版机 v0.2 · 参考文献检查器 — GB/T 7714-2015(数字顺序制)

用法:
    # 检查并在终端打印报告 + 写一份 markdown 报告到 output/
    python scripts/check_references.py input/论文.docx

    # 只看终端,不写文件
    python scripts/check_references.py input/论文.docx --no-report

定位:
    这是「检查 + 报告」阶段(v0.2 计划里的第一步)。它只诊断、不改动原文,
    把每条参考文献可能不符合 GB/T 7714-2015 的地方列出来,交给主人人工核对/修改。
    自动修正留到 v0.3(风险高,先不碰)。

检查项(启发式,不是完备解析器,以提示为主):
    1. 能否定位「参考文献」区块
    2. 序号:是否用 [1][2]… 顺序编号、有无跳号/重号
    3. 文献类型标识:是否含 [J]/[M]/[D]/[C]/[R]/[S]/[P]/[N]/[EB/OL] 等
    4. 年份:是否含 4 位出版年
    5. 页码:期刊[J]/专著[M] 建议给出起止页码(: 12-18)
    6. 结尾标点:条目是否以「.」结束
    7. 标点体例:GB/T 7714 正文用半角标点,提示混入的全角 ,。:;

免责:规则覆盖常见情形,复杂条目(多卷、析出文献、译著)可能误报,
      报告里的每条都是「建议核对」,不是「一定错」。
"""
import argparse
import re
import sys
from pathlib import Path

from docx import Document

# 参考文献区块的起始标志(标题文字)
REF_HEADING_RE = re.compile(r"^\s*(参考文献|References|REFERENCES)\s*[:：]?\s*$")

# 文献类型标识符(GB/T 7714-2015 表 1 常见类型 + 载体/OL)
DOC_TYPES = ["J", "M", "D", "C", "R", "S", "P", "N", "G", "A", "Z",
             "DB", "CP", "EB",
             "DB/OL", "DB/MT", "M/CD", "J/OL", "EB/OL", "M/OL", "C/OL"]
# 匹配 [X] 或 [X/OL] 形式的类型标识
DOC_TYPE_RE = re.compile(r"\[([A-Z]{1,2}(?:/[A-Z]{2})?)\]")

# 条目序号:[1] 开头
SEQ_RE = re.compile(r"^\s*\[(\d+)\]")
YEAR_RE = re.compile(r"(1[89]\d{2}|20\d{2})")
# 全角标点(GB/T 7714 参考文献区应使用半角)
FULLWIDTH_PUNCT = "，。：；（）"


class Issue:
    """一条诊断。level: 'error' 硬性不合规 / 'warn' 建议核对。"""
    __slots__ = ("level", "msg")

    def __init__(self, level: str, msg: str):
        self.level = level
        self.msg = msg


def find_reference_block(doc) -> list[str]:
    """返回参考文献区块内的条目文本列表(已去空行)。"""
    paras = doc.paragraphs
    start = None
    for i, p in enumerate(paras):
        if REF_HEADING_RE.match(p.text):
            start = i + 1
            break
        # 有些论文标题带编号,如「参考文献」在 Heading 里
        if "参考文献" in p.text and len(p.text.strip()) <= 8:
            start = i + 1
            break
    if start is None:
        return []

    entries: list[str] = []
    for p in paras[start:]:
        text = p.text.strip()
        if not text:
            continue
        # 碰到下一个明显的一级/二级标题就停(如「附录」)
        style = (p.style.name or "").lower()
        if style.startswith("heading") and not SEQ_RE.match(text):
            break
        entries.append(text)
    return entries


def check_entry(text: str, expected_seq: int) -> tuple[int | None, list[Issue]]:
    """检查单条参考文献。返回 (解析到的序号, 问题列表)。"""
    issues: list[Issue] = []

    # 1) 序号
    m = SEQ_RE.match(text)
    seq = int(m.group(1)) if m else None
    if seq is None:
        issues.append(Issue("error", "缺少序号,应以 [n] 形式编号(如 [1])"))
    elif seq != expected_seq:
        issues.append(Issue("error", f"序号应为 [{expected_seq}],实际为 [{seq}](跳号/重号/乱序)"))

    # 2) 文献类型标识
    types = DOC_TYPE_RE.findall(text)
    if not types:
        issues.append(Issue("error", "缺少文献类型标识,应含 [J]/[M]/[D]/[C]/[EB/OL] 等"))
    else:
        unknown = [t for t in types if t not in DOC_TYPES]
        if unknown:
            issues.append(Issue("warn", f"文献类型标识 {unknown} 不在常见列表内,请核对"))

    # 3) 年份
    if not YEAR_RE.search(text):
        issues.append(Issue("error", "未找到 4 位出版年份"))

    # 4) 页码(仅对 [J]/[M] 建议)
    primary_type = types[0] if types else ""
    if primary_type in ("J", "M"):
        # 起止页码常见形态: ": 12-18" 或 ": 12" 或 全角冒号
        if not re.search(r"[:：]\s*\d+", text):
            issues.append(Issue("warn", f"[{primary_type}] 建议给出起止页码(如 : 12-18)"))

    # 5) 结尾标点
    if not text.rstrip().endswith("."):
        issues.append(Issue("warn", "条目建议以半角句点「.」结束"))

    # 6) 全角标点
    bad = sorted({c for c in text if c in FULLWIDTH_PUNCT})
    if bad:
        issues.append(Issue("warn", f"检测到全角标点 {''.join(bad)},GB/T 7714 参考文献区通常用半角 , . : ; ( )"))

    return seq, issues


def build_report(src: Path, entries: list[str]) -> tuple[str, int, int]:
    """生成 markdown 报告文本,返回 (报告, error 数, warn 数)。"""
    lines = [f"# 参考文献检查报告 · GB/T 7714-2015", "",
             f"- 源文件:`{src.name}`",
             f"- 参考文献条目数:**{len(entries)}**", ""]

    if not entries:
        lines.append("> ⚠️ 未定位到「参考文献」区块,或区块内没有条目。")
        lines.append(">")
        lines.append("> 请确认文中有独立一行的「参考文献」标题,且其后为逐条列出的文献。")
        return "\n".join(lines), 0, 0

    total_err = total_warn = 0
    for idx, text in enumerate(entries, start=1):
        seq, issues = check_entry(text, idx)
        errs = [i for i in issues if i.level == "error"]
        warns = [i for i in issues if i.level == "warn"]
        total_err += len(errs)
        total_warn += len(warns)

        status = "✅ 通过" if not issues else f"❌ {len(errs)} 项不合规 / ⚠️ {len(warns)} 项建议"
        preview = text if len(text) <= 90 else text[:90] + "…"
        lines.append(f"## 条目 {idx} — {status}")
        lines.append(f"> {preview}")
        lines.append("")
        for i in errs:
            lines.append(f"- ❌ {i.msg}")
        for i in warns:
            lines.append(f"- ⚠️ {i.msg}")
        if not issues:
            lines.append("- 未发现明显问题")
        lines.append("")

    lines.insert(4, f"- 汇总:**{total_err}** 项硬性不合规,**{total_warn}** 项建议核对\n")
    return "\n".join(lines), total_err, total_warn


def main():
    ap = argparse.ArgumentParser(description="GB/T 7714-2015 参考文献格式检查(检查+报告)")
    ap.add_argument("input", type=Path, help="输入 .docx 文件")
    ap.add_argument("-o", "--out", type=Path, default=Path("output"), help="报告输出目录")
    ap.add_argument("--no-report", action="store_true", help="只打印终端,不写报告文件")
    args = ap.parse_args()

    if not args.input.exists() or args.input.suffix.lower() != ".docx":
        sys.exit(f"错误: 找不到 docx 文件 {args.input}")

    doc = Document(args.input)
    entries = find_reference_block(doc)
    report, n_err, n_warn = build_report(args.input, entries)

    # 终端摘要
    print(report)

    if not args.no_report and entries:
        args.out.mkdir(parents=True, exist_ok=True)
        out_path = args.out / f"{args.input.stem}_参考文献检查.md"
        out_path.write_text(report, encoding="utf-8")
        print(f"\n报告已写入 → {out_path}")

    # 退出码:有硬性不合规返回 1,方便脚本串联
    sys.exit(1 if n_err else 0)


if __name__ == "__main__":
    main()
