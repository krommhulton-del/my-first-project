---
name: dx-release
description: 东玄卜卦发版全流程——改三处版本号、构建单文件、跑全量测试与端到端、提交推送、把成品发给用户。当用户说「发版」「推一版」「更新一下」「把新文件发我」,或一轮改动做完准备交付时使用。
---

# 东玄卜卦 · 发版 SOP

一步都不许省。任何一步不绿就停下来修,**不许带着红灯发版**。

## 0. 先读宪法

读仓库根目录 `CLAUDE.md`,确认这轮改动没有违反铁律、没有破坏「一个口径一处算」。

## 1. 改版本号(三处,缺一处就会出现版本不一致)

```
index.html   →  <span class="seal">内测 vX.XX</span>   与   footer 里的「东玄卜卦 vX.XX 内测版」
yunshi.html  →  <span class="seal">内测 vX.XX</span>
sw.js        →  const CACHE = 'dongxuan-vX.XX.0';
```

`sw.js` 的 CACHE **必须**动。Service Worker 是 network-first,但缓存版本不变会让离线回退取到旧资源。
历史教训:曾用 stale-while-revalidate,用户连着几版都看到旧界面,以为改动没生效。

## 2. 新增了 .js 模块?三处登记

新模块要在**三个地方**登记,漏一处就会在某个版本里失效:

1. `index.html` 或 `yunshi.html` 里的 `<script src="...">`
2. `sw.js` 的 `ASSETS` 数组
3. `build-single.mjs` 的内联替换(主文件与运势页各有一份清单)

## 3. 构建

```bash
node build-single.mjs
```

会把运势整页内联进 `dist/dongxuan.html` 并注入应用内浮层。构建脚本自带断言:
残留 `script src` 或 `serviceWorker` 会直接抛错。

## 4. 全量测试

```bash
npm test        # 17 套单元/断法套件
npm run e2e     # 主 e2e + 运势 e2e + 重新构建 + 单文件 e2e
```

**两条都必须零失败**。e2e 曾经替我们挡下一次整页白屏(常量重名),不要跳过。

## 5. 提交

提交信息写三件事:**发现了什么问题、怎么改的、验了什么**。不要只写「优化」「更新」。
自己的测试抓到自己的错,在提交信息里照实写——这是这个项目的习惯。

结尾固定两行:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: <本次会话链接>
```

**不许**把模型标识写进提交、PR、代码注释或任何入库产物。

## 6. 推送(只推这一个分支)

```bash
git push -q -u origin claude/divination-chinese-books-6nk58q
```

网络失败时重试至多 4 次,间隔 2s/4s/8s/16s。**不许推别的分支**,不许自作主张开 PR。

## 7. 交付

用 `SendUserFile` 把 `dist/dongxuan.html` 发给用户,caption 一句话说清这版改了什么。

## 8. 汇报

对用户说清:改了什么、为什么改(最好带数据)、验了什么、**哪些没验或没做**。
准确率相关的话必须守 `CLAUDE.md` 第三节的三层分级——排盘层可以说准,事件层什么都不许承诺。
