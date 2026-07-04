#!/usr/bin/env python3
"""B 端内容机 v0.1 — 产品资料 → DeepSeek 批量产出小红书笔记初稿

用法:
    # 正式跑(需 .env 里有 DEEPSEEK_API_KEY,且网络能访问 api.deepseek.com)
    python scripts/gen_notes.py input/产品资料.md -o output/notes/

    # 离线自测(不联网,用内置样例响应,验证解析与产出)
    python scripts/gen_notes.py input/产品资料.md --dry-run

做什么:
    1. 读入客户产品资料 markdown
    2. 把「B端内容机主提示词」的内容要求 + 资料一起发给 DeepSeek(便宜跑量)
    3. 让模型以 JSON 返回 10 篇笔记(类型/标题/正文/标签),便于脚本可靠切分
    4. 每篇写成一个 .md 到 output/notes/,并汇总一张选题表 CSV

定位(铁律 6):DeepSeek 干粗活出初稿;挑最好的 3-5 篇再用 Claude 精修终稿。
    本脚本只产初稿,不做终审。

网络说明:
    Claude Code 云端会话默认网络策略可能拦截 api.deepseek.com(表现为代理 403)。
    若在云端正式跑,需在环境网络策略里放行该域名;否则请在本机运行本脚本。
"""
import argparse
import csv
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

API_URL = "https://api.deepseek.com/v1/chat/completions"
DEFAULT_MODEL = "deepseek-chat"

# 选题配比(痛点3/场景3/对比2/清单2 = 10)
TOPIC_MIX = "痛点型 3 篇、场景型 3 篇、对比/测评型 2 篇、清单合集型 2 篇"

SYSTEM_PROMPT = f"""你是资深小红书内容策划。基于用户提供的产品资料,产出 10 篇笔记初稿。

内容要求:
1. 选题分散:{TOPIC_MIX}
2. 每篇:标题(20字内,含一个具体数字或具体场景)、正文(300-500字,口语化,
   像真人分享,禁止"家人们""绝绝子""yyds"等烂大街词)、5 个话题标签(不带#)
3. 每篇开头第一句必须是钩子:要么反常识,要么具体到能画面化
4. 正文里产品卖点最多出现 2 处,且必须包在真实使用场景里,不许干列参数
5. 结尾用提问或留白引评论,不许用"快去买"式硬广结尾
6. 不得出现最高级用语(最/第一/顶级)和医疗功效承诺等平台违禁表达

严格以 JSON 输出,不要任何多余文字,结构:
{{"notes":[{{"type":"痛点|场景|对比|清单","title":"...","body":"...","tags":["标签1","标签2","标签3","标签4","标签5"]}}]}}
notes 数组必须正好 10 个元素。"""

# 离线自测用的样例响应(结构与真实一致,内容占位)
DRY_RUN_SAMPLE = {
    "notes": [
        {"type": "痛点", "title": f"第{i+1}篇示例·痛点标题(含数字{i+1})",
         "body": ("这是离线自测用的占位正文,仅验证脚本的解析与产出流程是否正常。" * 6),
         "tags": ["示例标签A", "示例标签B", "示例标签C", "示例标签D", "示例标签E"]}
        for i in range(10)
    ]
}


def load_api_key() -> str:
    """从环境或 .env 读取 DEEPSEEK_API_KEY。"""
    key = os.environ.get("DEEPSEEK_API_KEY")
    if key:
        return key
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() == "DEEPSEEK_API_KEY":
                return v.strip().strip('"').strip("'")
    sys.exit("错误: 未找到 DEEPSEEK_API_KEY(检查 .env 或环境变量)")


def call_deepseek(material: str, model: str, api_key: str) -> dict:
    """调用 DeepSeek(OpenAI 兼容),返回解析后的 JSON dict。"""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"产品资料如下:\n\n{material}"},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 1.3,   # 内容创作,给足多样性
        "stream": False,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:300]
        sys.exit(f"错误: DeepSeek 返回 HTTP {e.code}\n{detail}")
    except urllib.error.URLError as e:
        sys.exit(f"错误: 无法连接 DeepSeek({e.reason})。\n"
                 f"若在云端会话,多半是网络策略拦截了 api.deepseek.com;请放行该域名或在本机运行。")

    content = body["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        sys.exit("错误: 模型返回的不是合法 JSON,原样内容开头:\n" + content[:300])


def slugify(text: str, idx: int) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in text)
    safe = "_".join(filter(None, safe.split("_")))[:24]
    return f"{idx:02d}_{safe or 'note'}"


def write_outputs(data: dict, out_dir: Path, material_name: str) -> tuple[int, Path]:
    notes = data.get("notes", [])
    if not notes:
        sys.exit("错误: 响应里没有 notes")
    out_dir.mkdir(parents=True, exist_ok=True)

    csv_path = out_dir / "选题表.csv"
    rows = []
    for i, note in enumerate(notes, start=1):
        ntype = note.get("type", "").strip()
        title = note.get("title", "").strip()
        body = note.get("body", "").strip()
        tags = note.get("tags", []) or []
        fname = slugify(title, i) + ".md"

        md = [f"# {title}", "", f"> 类型:{ntype} · 素材:{material_name} · 初稿(未终审)", "",
              body, "", "**话题标签**", "", "  ".join(f"#{t}" for t in tags), ""]
        (out_dir / fname).write_text("\n".join(md), encoding="utf-8")

        rows.append({
            "序号": i, "类型": ntype, "标题": title,
            "字数": len(body), "标签": " ".join(tags), "文件": fname,
        })

    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["序号", "类型", "标题", "字数", "标签", "文件"])
        w.writeheader()
        w.writerows(rows)

    return len(notes), csv_path


def main():
    ap = argparse.ArgumentParser(description="B端内容机:产品资料 → DeepSeek 批量笔记初稿")
    ap.add_argument("input", type=Path, help="产品资料 markdown 文件")
    ap.add_argument("-o", "--out", type=Path, default=Path("output/notes"), help="输出目录")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"模型(默认 {DEFAULT_MODEL})")
    ap.add_argument("--dry-run", action="store_true", help="不联网,用内置样例验证流程")
    args = ap.parse_args()

    if not args.input.exists():
        sys.exit(f"错误: 找不到产品资料 {args.input}")
    material = args.input.read_text(encoding="utf-8")

    if args.dry_run:
        print("【离线自测】使用内置样例响应,不调用 DeepSeek")
        data = DRY_RUN_SAMPLE
    else:
        api_key = load_api_key()
        print(f"调用 DeepSeek({args.model})生成 10 篇初稿中……")
        data = call_deepseek(material, args.model, api_key)

    n, csv_path = write_outputs(data, args.out, args.input.stem)
    print(f"完成 → {n} 篇初稿写入 {args.out}/,选题表 → {csv_path}")
    print("下一步:挑最好的 3-5 篇,在对话里让 Claude 精修终稿。")


if __name__ == "__main__":
    main()
