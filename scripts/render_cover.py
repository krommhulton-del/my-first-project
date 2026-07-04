#!/usr/bin/env python3
"""封面渲染器 v0.1 — 小红书封面 HTML → PNG

用法:
    # 1) 用内置示例文案快速出一张图(验证环境)
    python scripts/render_cover.py --demo

    # 2) 命令行传字段
    python scripts/render_cover.py \
        --tag 论文排版急救 \
        --title1 导师看了沉默的格式 \
        --highlight 10分钟救回来 \
        --subtitle "目录·页码·参考文献 一次修好" \
        --stamp 今日加急 \
        --footer 排版急救室 \
        -o output/cover.png

    # 3) 从 JSON 批量出图(一行一个封面)
    python scripts/render_cover.py --json covers.json -o output/covers/

做什么:
    - 读取 templates/cover_xhs.html,替换其中 {{...}} 占位符
    - 用 playwright + chromium 截图成 1242×1660 PNG(小红书竖版封面尺寸)
    - 支持单张 / 批量;批量时按 index 或 slug 命名

首次运行需要:
    pip install playwright && playwright install chromium
    (本仓库 requirements.txt 已含 playwright;若浏览器缺失按上一行装)
"""
import argparse
import json
import os
import sys
from html import escape
from pathlib import Path

from playwright.sync_api import sync_playwright

# 封面画布尺寸(与模板 body 的 width/height 一致)
COVER_W, COVER_H = 1242, 1660

# 模板占位符 → 字段名。字段名同时用于 CLI 参数与 JSON key。
PLACEHOLDERS = {
    "{{TAG}}": "tag",
    "{{TITLE_LINE1}}": "title1",
    "{{TITLE_HIGHLIGHT}}": "highlight",
    "{{SUBTITLE}}": "subtitle",
    "{{STAMP}}": "stamp",
    "{{FOOTER}}": "footer",
}

# 内置示例文案(--demo 用,也是缺省字段的兜底)
# 版式建议:title1 控制在 7 个中文字符内(单行更抓眼);超长会自动缩小字号但可能显挤。
DEMO = {
    "tag": "论文排版急救",
    "title1": "导师看了直摇头",
    "highlight": "10分钟救回来",
    "subtitle": "目录·页码·参考文献 一次修好",
    "stamp": "今日加急",
    "footer": "排版急救室",
}

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE = REPO_ROOT / "templates" / "cover_xhs.html"


def _chromium_executable() -> str | None:
    """找一个可用的 chromium 可执行文件。

    优先用环境预装的浏览器(常见于云端沙箱,如 PLAYWRIGHT_BROWSERS_PATH),
    避免 playwright 版本与已下载浏览器 build 号不匹配时报 "Executable doesn't exist"。
    返回 None 时交给 playwright 用默认下载路径。
    """
    # 1) 显式环境变量优先
    env_bin = os.environ.get("CHROME_EXECUTABLE") or os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    if env_bin and Path(env_bin).exists():
        return env_bin
    # 2) PLAYWRIGHT_BROWSERS_PATH 下的 chromium 符号链接 / 任意 chromium-*/chrome-linux/chrome
    browsers_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    candidates = []
    for base in filter(None, [browsers_path, "/opt/pw-browsers"]):
        base_p = Path(base)
        candidates.append(base_p / "chromium")  # 常见符号链接
        candidates.extend(sorted(base_p.glob("chromium-*/chrome-linux/chrome"), reverse=True))
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def render_html(template: str, fields: dict) -> str:
    """把占位符替换成转义后的字段值。缺失字段用 DEMO 兜底。"""
    html = template
    for token, key in PLACEHOLDERS.items():
        value = fields.get(key)
        if value is None or value == "":
            value = DEMO.get(key, "")
        html = html.replace(token, escape(str(value)))
    return html


def _slug(fields: dict, index: int) -> str:
    """给批量输出取个稳定文件名:优先用 tag,否则用序号。"""
    raw = (fields.get("tag") or fields.get("title1") or f"cover_{index+1}").strip()
    safe = "".join(c if c.isalnum() or c in "-_一二三四五六七八九十" else "_" for c in raw)
    safe = "_".join(filter(None, safe.split("_")))
    return safe or f"cover_{index+1}"


def render_covers(items: list[dict], out: Path, template_path: Path) -> list[Path]:
    """渲染一批封面。out 为文件(单张)或目录(多张)。返回生成的路径列表。"""
    if not template_path.exists():
        sys.exit(f"错误: 找不到模板 {template_path}")
    template = template_path.read_text(encoding="utf-8")

    # 判断输出是单文件还是目录
    multiple = len(items) > 1
    if multiple or out.suffix.lower() != ".png":
        out_dir = out
        out_dir.mkdir(parents=True, exist_ok=True)
        targets = [out_dir / f"{_slug(f, i)}.png" for i, f in enumerate(items)]
        # 去重同名
        seen: dict[str, int] = {}
        for i, p in enumerate(targets):
            if p.name in seen:
                seen[p.name] += 1
                targets[i] = p.with_name(f"{p.stem}_{seen[p.name]}.png")
            else:
                seen[p.name] = 0
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        targets = [out]

    results: list[Path] = []
    exe = _chromium_executable()
    launch_kwargs = {"executable_path": exe} if exe else {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            page = browser.new_page(
                viewport={"width": COVER_W, "height": COVER_H},
                device_scale_factor=1,
            )
            for fields, target in zip(items, targets):
                html = render_html(template, fields)
                page.set_content(html, wait_until="networkidle")
                _autofit_title(page)
                # 精确截取封面主体元素,避免滚动条/留白影响尺寸
                body = page.query_selector("body")
                body.screenshot(path=str(target))
                results.append(target)
                print(f"完成 → {target}")
        finally:
            browser.close()
    return results


# 标题自适应:标题过长时逐步缩小字号,避免溢出画布或与荧光笔行重叠。
# 注入到页面里执行(比逐次 evaluate 往返快)。
_AUTOFIT_JS = """
() => {
  const el = document.querySelector('.title');
  if (!el) return null;
  const base = parseFloat(getComputedStyle(el).fontSize);
  let size = base;
  const min = base * 0.5;   // 最多缩到一半,再小就该改文案了
  // scrollWidth > clientWidth 说明有横向溢出(某一行太宽)
  while (size > min && el.scrollWidth > el.clientWidth + 1) {
    size -= 4;
    el.style.fontSize = size + 'px';
  }
  return { base, final: size };
}
"""


def _autofit_title(page) -> None:
    try:
        page.evaluate(_AUTOFIT_JS)
    except Exception:
        # 自适应失败不致命,照常出图
        pass


def load_items(args) -> list[dict]:
    """根据参数决定要渲染哪些封面。"""
    if args.json:
        data = json.loads(Path(args.json).read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            sys.exit("错误: --json 文件需为对象或对象数组")
        return data
    if args.demo:
        return [dict(DEMO)]
    # 从 CLI 单张字段收集
    fields = {
        "tag": args.tag,
        "title1": args.title1,
        "highlight": args.highlight,
        "subtitle": args.subtitle,
        "stamp": args.stamp,
        "footer": args.footer,
    }
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        # 没传任何字段也没 --demo,就当 demo 处理并提示
        print("提示: 未提供任何文案,使用内置示例(等价于 --demo)")
        return [dict(DEMO)]
    return [fields]


def main():
    ap = argparse.ArgumentParser(
        description="小红书封面渲染器:HTML 模板 → 1242×1660 PNG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--demo", action="store_true", help="用内置示例文案快速出一张图")
    ap.add_argument("--json", type=str, help="从 JSON(对象或数组)批量渲染")
    ap.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE, help="模板路径")
    ap.add_argument("-o", "--out", type=Path, default=Path("output/cover.png"),
                    help="输出文件(单张)或目录(批量),默认 output/cover.png")
    # 单张字段
    ap.add_argument("--tag", help="左上角标签,如: 论文排版急救")
    ap.add_argument("--title1", help="标题第一行")
    ap.add_argument("--highlight", help="荧光笔强调行")
    ap.add_argument("--subtitle", help="副标题")
    ap.add_argument("--stamp", help="右下角红章钩子")
    ap.add_argument("--footer", help="页脚署名")
    args = ap.parse_args()

    items = load_items(args)
    render_covers(items, args.out, args.template)


if __name__ == "__main__":
    main()
