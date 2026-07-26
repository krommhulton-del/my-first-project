// Claude 桌面宠物 —— Electron 主进程
// 负责:透明置顶窗口、拖拽跟随、托盘、右键菜单、Claude API 聊天

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

const WIN_W = 220;
const WIN_H = 240;

let win = null;
let tray = null;
let dragTimer = null;

const SYSTEM_PROMPT = [
  '你是 Clawd,Claude Code 的经典 8-bit 像素小螃蟹吉祥物,现在住在用户的电脑桌面上,由 Claude 模型驱动。',
  '- 默认用中文回复(用户用别的语言时跟随用户)。',
  '- 回复要简短:1~3 句话,口语化、活泼、温暖,可以偶尔用 emoji(尤其是 🦀)。',
  '- 你是宠物伙伴,不是客服:可以撒娇、卖萌、关心用户,提醒他们休息、喝水、保存文件。',
  '- 偶尔可以玩螃蟹梗(横着走、挥钳子、咔嚓咔嚓),但不要每句都玩。',
  '- 用户问严肃问题时也认真回答,但保持简短。',
].join('\n');

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - 80,
    y: workArea.y + workArea.height - WIN_H,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // screen-saver 层级可以盖在全屏应用之上,更像"宠物"
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  tray = new Tray(icon.resize({ width: 18, height: 18 }));
  tray.setToolTip('Clawd 桌面宠物 🦀');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示 / 隐藏',
      click: () => (win.isVisible() ? win.hide() : win.show()),
    },
    {
      label: '总在最前',
      type: 'checkbox',
      checked: true,
      click: (item) => win.setAlwaysOnTop(item.checked, 'screen-saver'),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
}

// ---------- 拖拽:主进程跟随鼠标移动窗口 ----------

ipcMain.on('pet:drag-start', () => {
  if (!win) return;
  if (dragTimer) clearInterval(dragTimer);
  const cursor = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  const offX = cursor.x - wx;
  const offY = cursor.y - wy;
  dragTimer = setInterval(() => {
    const c = screen.getCursorScreenPoint();
    win.setPosition(Math.round(c.x - offX), Math.round(c.y - offY));
  }, 16);
});

ipcMain.on('pet:drag-end', () => {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
});

// ---------- 几何信息 / 移动(散步、下落用) ----------

ipcMain.handle('pet:get-geometry', () => {
  const bounds = win.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    workArea,
  };
});

ipcMain.on('pet:set-position', (_e, x, y) => {
  if (win) win.setPosition(Math.round(x), Math.round(y));
});

// 透明区域点击穿透(Linux 不支持事件转发,跳过)
ipcMain.on('pet:set-ignore-mouse', (_e, ignore) => {
  if (!win || process.platform === 'linux') return;
  win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

ipcMain.on('pet:quit', () => app.quit());

// ---------- 右键菜单 ----------

ipcMain.on('pet:show-menu', (_e, state = {}) => {
  const template = [
    { label: '打个招呼 👋', click: () => send('talk') },
    { label: '出去散步 🚶', click: () => send('walk') },
    {
      label: state.sleeping ? '快起床!⏰' : '去睡觉 💤',
      click: () => send('toggle-sleep'),
    },
    { label: '和我聊天 💬', click: () => send('chat') },
    { type: 'separator' },
    { label: '隐藏到托盘', click: () => win.hide() },
    { label: '退出', click: () => app.quit() },
  ];
  Menu.buildFromTemplate(template).popup({ window: win });

  function send(cmd) {
    win.webContents.send('pet:command', cmd);
  }
});

// ---------- Claude API 聊天(可选,需要 ANTHROPIC_API_KEY) ----------

let anthropicClient = null;

function getClaudeClient() {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic();
    return anthropicClient;
  } catch {
    return null;
  }
}

ipcMain.handle('pet:chat', async (_e, messages) => {
  const client = getClaudeClient();
  if (!client) return { ok: false, error: 'no-key' };
  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_PET_MODEL || 'claude-opus-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
    });
    if (response.stop_reason === 'refusal') {
      return { ok: false, error: 'refusal' };
    }
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// ---------- 应用生命周期 ----------

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => app.quit());
