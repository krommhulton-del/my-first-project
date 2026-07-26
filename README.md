# 🦀 Clawd 桌面宠物

**Clawd** —— Claude Code 的经典 8-bit 像素螃蟹吉祥物,现在住进你的桌面!基于 Electron 的透明置顶桌面宠物,会眨眼、横着散步、挥钳子、睡觉,还能(可选地)接入 Claude API 陪你真·聊天。

![截图](docs/screenshot.png)

> Clawd(Claude + Claw 的谐音梗)最早出现在 Claude Code 的欢迎界面 "Welcome, Claw'd"。这是一个粉丝自制项目,与 Anthropic 官方无关。

## ✨ 功能

- **透明无边框窗口**,始终置顶,悬浮在所有窗口之上
- **原汁原味的像素造型**:16×14 像素网格手工还原,方块眼睛、带开口的蟹钳、四只小短腿
- **自主行为**:发呆、眨眼、钳子一格一格地夹动、横着散步(小短腿快速倒腾)、随机碎碎念、久不理它会睡着 💤
- **丰富互动**
  - 🖱️ 单击 —— 开心地蹦一下,眼睛变成像素 `> <`
  - 💬 双击 —— 打开聊天输入框
  - ✋ 按住拖拽 —— 把它拎到屏幕任何地方(会瞪大眼睛张 o 嘴),松手后掉回任务栏上方,落地压扁回弹
  - 🥰 在它身上快速蹭鼠标 —— 摸头,会冒爱心
  - 📋 右键 —— 菜单(打招呼 / 散步 / 睡觉 / 聊天 / 退出)
- **点击穿透**:窗口透明区域不挡鼠标,只有螃蟹本体可以点到(Windows / macOS)
- **系统托盘**:像素蟹图标,显示 / 隐藏、置顶开关、退出
- **接入 Claude API 聊天**(可选):设置好 API Key 后,双击 Clawd 即可和真正的 Claude 对话

## 🚀 运行

需要 Node.js 18+。

```bash
git clone https://github.com/krommhulton-del/my-first-project.git
cd my-first-project
npm install
npm start
```

## 💬 开启真·聊天(可选)

不设置也能玩,Clawd 会说内置的碎碎念。想让它接入 Claude 大脑:

```bash
# macOS / Linux
export ANTHROPIC_API_KEY=sk-ant-xxxx
npm start

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-xxxx"
npm start
```

- 默认模型为 `claude-opus-5`,可用环境变量 `CLAUDE_PET_MODEL` 更换(例如 `claude-haiku-4-5` 更便宜更快)。
- 每次回复限制在 300 token 内,上下文只保留最近 12 条消息,日常闲聊花费很低。
- API Key 在 [platform.claude.com](https://platform.claude.com/) 获取。

## 🖥️ 浏览器预览

不想装 Electron?直接用浏览器打开 `renderer/index.html` 就能看到 Clawd 的预览模式(带背景色,螃蟹在页面内散步,聊天功能不可用)。

## 📁 项目结构

```
├── main.js            # Electron 主进程:窗口、拖拽、托盘、菜单、Claude API
├── preload.js         # contextBridge 安全桥接
├── renderer/
│   ├── index.html     # Clawd 本体(16x14 像素网格 SVG)
│   ├── style.css      # 全部动画:呼吸、夹钳、碎步、下落、压扁……(steps() 像素风)
│   └── pet.js         # 行为状态机:idle / walk / drag / fall / sleep / happy / chat
├── scripts/
│   └── gen-icon.js    # 零依赖生成托盘图标 PNG(与本体同一张像素图)
└── assets/icon.png    # 托盘 / 窗口图标
```

## 🛠️ 已知说明

- **Linux**:`setIgnoreMouseEvents` 的事件转发不受支持,因此 Linux 上窗口透明区域会拦截鼠标(窗口本身很小,影响不大);托盘依赖桌面环境支持。
- **macOS**:启动后会自动隐藏 Dock 图标,从托盘(菜单栏)管理。
- 想改螃蟹大小 / 颜色:改 `renderer/index.html` 里的像素 rect 和 `main.js` 里的 `WIN_W / WIN_H` 即可;托盘图标同步改 `scripts/gen-icon.js` 里的 `GRID` 后运行 `npm run icon`。

## 📜 License

MIT
