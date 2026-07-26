// Clawd 桌面宠物 —— 行为状态机
// 状态:idle / walk / skate / code / drag / fall / sleep / happy / chat
// 没有 petAPI(直接在浏览器打开)时进入预览模式,宠物在页面内活动。

(() => {
  'use strict';

  // ---------- API(Electron 环境 or 浏览器预览兜底) ----------

  const PREVIEW = !window.petAPI;

  const api = window.petAPI || {
    platform: 'preview',
    dragStart() {},
    dragEnd() {},
    async getGeometry() {
      return {
        x: 0, y: 0, width: 220, height: 240,
        workArea: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
      };
    },
    setPosition() {},
    setIgnoreMouse() {},
    showMenu() {},
    async chat() { return { ok: false, error: 'no-key' }; },
    quit() {},
    onCommand() {},
  };

  if (PREVIEW) document.body.classList.add('preview');

  // ---------- DOM ----------

  const body = document.body;
  const stage = document.getElementById('stage');
  const petEl = document.getElementById('pet');
  const bubbleEl = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const chatboxEl = document.getElementById('chatbox');
  const chatInput = document.getElementById('chat-input');

  // ---------- 状态 ----------

  const state = {
    sleeping: false,
    dragging: false,
    walking: false,
    skating: false,
    coding: false,
    falling: false,
    chatting: false,
    lastInteraction: Date.now(),
    chatHistory: [],
    walkX: 0, // 仅预览模式使用
  };

  let moveTimer = null;
  let moveEndTimer = null;
  let fallTimer = null;
  let bubbleTimer = null;
  let zzzTimer = null;
  let codeFloatyTimer = null;
  let codeEndTimer = null;
  let clickCount = 0;
  let clickTimer = null;
  let maybeDrag = null;
  let petDistance = 0;
  let petDistanceReset = 0;
  let lastMovePos = null;

  const SLEEP_AFTER_MS = 2 * 60 * 1000;

  // ---------- 台词 ----------

  const PHRASES = [
    '咔嚓咔嚓 🦀 我是 Clawd!',
    '写代码累了吗?让眼睛休息 20 秒吧~',
    '喝水时间到!💧',
    '双击我可以聊天哦 💬',
    '今天也要加油呀!',
    '横着走才是正经走法,懂?',
    'Welcome, Claw’d ~',
    'Ctrl + S 了吗?记得保存哦',
    '你知道吗,螃蟹的牙齿长在胃里 🦀',
    '深呼吸——吸气,呼气,好啦继续~',
    '拖着我到处走也可以哦,我不晕的(大概)',
    '偷偷告诉你:右键我有惊喜',
    '陪你工作的每一天,都元气满满!',
    '出 bug 了?先别慌,console.log 走起',
    '要不要站起来伸个懒腰?🙆',
    '我的钳子除了卖萌,还会帮你夹住 bug',
  ];

  const CODE_PHRASES = [
    '咔嗒咔嗒……在写了在写了 ⌨️',
    '进入心流模式,勿扰 🧑‍💻',
    '让我修个 bug,马上好',
    'npm install ing……进度 99%(卡住了)',
  ];

  const CODE_DONE_PHRASES = [
    '搞定!git commit ✅',
    '编译通过!奖励自己发个呆',
    'bug 已夹出 🦀',
  ];

  const CODE_BITS = ['</>', '{ }', '01', 'λ', ';', '🐛'];

  const GREETING = '咔嚓!我是 Clawd 🦀\n双击和我聊天,右键有菜单哦';

  // ---------- 小工具 ----------

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function touch() {
    state.lastInteraction = Date.now();
  }

  function busy() {
    return state.dragging || state.falling || state.walking ||
           state.skating || state.coding || state.chatting;
  }

  // ---------- 气泡 ----------

  function showBubble(text, ms = 4000) {
    clearTimeout(bubbleTimer);
    bubbleText.textContent = text;
    bubbleEl.classList.remove('hidden');
    bubbleEl.scrollTop = 0;
    bubbleTimer = setTimeout(hideBubble, ms);
  }

  function hideBubble() {
    clearTimeout(bubbleTimer);
    bubbleEl.classList.add('hidden');
  }

  function sayRandom() {
    if (state.sleeping) return;
    showBubble(pick(PHRASES), 4500);
  }

  // ---------- 漂浮元素(爱心 / Zzz / 代码碎片) ----------

  function spawnFloaty(text, className = '') {
    const el = document.createElement('div');
    el.className = `floaty ${className}`;
    el.textContent = text;
    if (className.includes('code-bit')) {
      el.style.left = `${rand(50, 150)}px`;
      el.style.bottom = `${rand(60, 95)}px`;
    } else {
      el.style.left = `${rand(70, 140)}px`;
      el.style.bottom = `${rand(100, 130)}px`;
    }
    stage.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  // ---------- 眨眼 ----------

  function blinkLoop() {
    setTimeout(() => {
      if (!state.sleeping && !state.dragging) {
        body.classList.add('blink');
        setTimeout(() => body.classList.remove('blink'), 160);
        // 偶尔连眨两下
        if (Math.random() < 0.3) {
          setTimeout(() => {
            body.classList.add('blink');
            setTimeout(() => body.classList.remove('blink'), 160);
          }, 280);
        }
      }
      blinkLoop();
    }, rand(2500, 6000));
  }

  // ---------- 开心 / 摇摆 ----------

  function doHappy() {
    if (state.sleeping) {
      wake();
      return;
    }
    body.classList.remove('happy');
    void body.offsetWidth; // 重新触发动画
    body.classList.add('happy');
    setTimeout(() => body.classList.remove('happy'), 550);
    if (Math.random() < 0.45) sayRandom();
  }

  function doWiggle() {
    body.classList.remove('wiggle');
    void body.offsetWidth;
    body.classList.add('wiggle');
    setTimeout(() => body.classList.remove('wiggle'), 650);
  }

  // ---------- 睡觉 ----------

  function setSleep(on) {
    state.sleeping = on;
    body.classList.toggle('sleep', on);
    if (on) {
      stopMove();
      stopCode(true);
      hideBubble();
      closeChat();
      zzzTimer = setInterval(() => spawnFloaty('z', 'zzz'), 1600);
    } else {
      clearInterval(zzzTimer);
      zzzTimer = null;
    }
  }

  function wake() {
    touch();
    if (state.sleeping) {
      setSleep(false);
      showBubble('呼哇……我睡着了吗?😳', 3000);
    }
  }

  // ---------- 移动(散步 / 滑滑板共用) ----------

  async function startMove(kind, speed, duration) {
    if (state.walking || state.skating || state.dragging ||
        state.falling || state.sleeping || state.coding) return;
    const geo = await api.getGeometry();
    const minX = geo.workArea.x + 4;
    const maxX = geo.workArea.x + geo.workArea.width - geo.width - 4;
    if (maxX <= minX) return;

    if (kind === 'walk') state.walking = true;
    else state.skating = true;
    body.classList.add(kind);

    let dir = Math.random() < 0.5 ? -1 : 1;
    let x = PREVIEW ? state.walkX : geo.x;
    setFlip(dir);

    // 预览模式在页面内活动的范围
    const half = Math.max(0, (geo.workArea.width - geo.width) / 2 - 8);

    moveTimer = setInterval(() => {
      x += dir * speed;
      if (PREVIEW) {
        if (x <= -half) { x = -half; dir = 1; setFlip(dir); }
        if (x >= half) { x = half; dir = -1; setFlip(dir); }
        state.walkX = x;
        stage.style.setProperty('--walk-x', `${x}px`);
      } else {
        if (x <= minX) { x = minX; dir = 1; setFlip(dir); }
        if (x >= maxX) { x = maxX; dir = -1; setFlip(dir); }
        api.setPosition(Math.round(x), geo.y);
      }
    }, 16);

    moveEndTimer = setTimeout(stopMove, duration);
  }

  function stopMove() {
    if (!state.walking && !state.skating) return;
    clearInterval(moveTimer);
    clearTimeout(moveEndTimer);
    moveTimer = moveEndTimer = null;
    state.walking = false;
    state.skating = false;
    body.classList.remove('walk');
    body.classList.remove('skate');
    body.classList.remove('flip');
  }

  const startWalk = (d = rand(2500, 5000)) => startMove('walk', 2, d);
  const startSkate = (d = rand(3500, 6500)) => startMove('skate', 5, d);

  function setFlip(dir) {
    body.classList.toggle('flip', dir > 0);
  }

  // ---------- 写代码 ----------

  function startCode(duration = rand(7000, 11000)) {
    if (state.coding || state.dragging || state.falling || state.sleeping) return;
    stopMove();
    state.coding = true;
    body.classList.add('code');
    showBubble(pick(CODE_PHRASES), 3500);
    codeFloatyTimer = setInterval(
      () => spawnFloaty(pick(CODE_BITS), 'code-bit'),
      1300
    );
    codeEndTimer = setTimeout(() => stopCode(false), duration);
  }

  function stopCode(silent) {
    if (!state.coding) return;
    state.coding = false;
    body.classList.remove('code');
    clearInterval(codeFloatyTimer);
    clearTimeout(codeEndTimer);
    codeFloatyTimer = codeEndTimer = null;
    if (!silent && Math.random() < 0.7) {
      showBubble(pick(CODE_DONE_PHRASES), 3500);
      doWiggle();
    }
  }

  // ---------- 拖拽 & 下落 ----------

  function beginDrag() {
    stopMove();
    stopCode(true);
    stopFall();
    state.dragging = true;
    body.classList.add('drag');
    hideBubble();
    api.setIgnoreMouse(false);
    api.dragStart();
  }

  function endDrag() {
    state.dragging = false;
    body.classList.remove('drag');
    api.dragEnd();
    if (!PREVIEW) fallToFloor();
  }

  async function fallToFloor() {
    const geo = await api.getGeometry();
    const floorY = geo.workArea.y + geo.workArea.height - geo.height;
    const minX = geo.workArea.x + 4;
    const maxX = geo.workArea.x + geo.workArea.width - geo.width - 4;
    const x = clamp(geo.x, minX, Math.max(minX, maxX));
    let y = geo.y;

    if (y >= floorY - 2) {
      api.setPosition(x, floorY);
      landed();
      return;
    }

    state.falling = true;
    body.classList.add('fall');
    let vy = 0;
    fallTimer = setInterval(() => {
      vy = Math.min(vy + 2.4, 46);
      y += vy;
      if (y >= floorY) {
        y = floorY;
        stopFall();
        api.setPosition(x, y);
        landed();
        return;
      }
      api.setPosition(x, Math.round(y));
    }, 16);
  }

  function stopFall() {
    state.falling = false;
    body.classList.remove('fall');
    if (fallTimer) {
      clearInterval(fallTimer);
      fallTimer = null;
    }
  }

  function landed() {
    body.classList.add('land');
    setTimeout(() => body.classList.remove('land'), 500);
  }

  // ---------- 聊天 ----------

  function openChat() {
    wake();
    touch();
    stopCode(true);
    state.chatting = true;
    chatboxEl.classList.remove('hidden');
    chatInput.focus();
    if (!bubbleTimer || bubbleEl.classList.contains('hidden')) {
      showBubble('想聊点什么?我在听~ 👂', 8000);
    }
  }

  function closeChat() {
    state.chatting = false;
    chatboxEl.classList.add('hidden');
    chatInput.value = '';
  }

  async function sendChat(text) {
    touch();
    showBubble('嗯……让我想想 🤔', 60000);
    state.chatHistory.push({ role: 'user', content: text });
    // 只保留最近 12 条,控制上下文长度;并保证首条是 user 消息(API 要求)
    while (state.chatHistory.length > 12) state.chatHistory.shift();
    while (state.chatHistory.length && state.chatHistory[0].role !== 'user') {
      state.chatHistory.shift();
    }

    const res = await api.chat(state.chatHistory.slice());

    if (res.ok && res.text) {
      state.chatHistory.push({ role: 'assistant', content: res.text });
      showBubble(res.text, clamp(3000 + res.text.length * 90, 5000, 20000));
      doWiggle();
    } else if (res.error === 'no-key') {
      state.chatHistory.pop();
      showBubble(
        '想让我真的开口说话,要先设置 ANTHROPIC_API_KEY 环境变量再启动我哦~\n现在先听听我的碎碎念吧:' +
          pick(PHRASES),
        9000
      );
    } else if (res.error === 'refusal') {
      state.chatHistory.pop();
      showBubble('这个话题我有点不方便聊呢……换个话题吧 😅', 5000);
    } else {
      state.chatHistory.pop();
      showBubble(`呜,我的小脑袋连不上了……\n(${res.error || '未知错误'})`, 7000);
    }
  }

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeChat();
      hideBubble();
      return;
    }
    if (e.key === 'Enter' && !e.isComposing) {
      const text = chatInput.value.trim();
      if (text) {
        chatInput.value = '';
        sendChat(text);
      }
    }
  });

  // ---------- 鼠标交互 ----------

  petEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    touch();
    maybeDrag = { x: e.screenX, y: e.screenY };
  });

  window.addEventListener('mousemove', (e) => {
    // 按住并移动超过阈值 → 进入拖拽
    if (maybeDrag && !state.dragging) {
      if (Math.hypot(e.screenX - maybeDrag.x, e.screenY - maybeDrag.y) > 5) {
        wake();
        beginDrag();
      }
    }

    // 摸头检测:短时间内在宠物身上蹭来蹭去
    if (!state.dragging && e.target && e.target.closest && e.target.closest('#pet')) {
      const now = Date.now();
      if (now - petDistanceReset > 1500) {
        petDistanceReset = now;
        petDistance = 0;
        lastMovePos = null;
      }
      if (lastMovePos) {
        petDistance += Math.hypot(e.clientX - lastMovePos.x, e.clientY - lastMovePos.y);
      }
      lastMovePos = { x: e.clientX, y: e.clientY };
      if (petDistance > 380 && !state.sleeping) {
        petDistance = 0;
        touch();
        spawnFloaty('🧡');
        spawnFloaty('💛');
        doHappy();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (state.dragging) {
      endDrag();
    } else if (maybeDrag) {
      // 单击 / 双击判定
      clickCount += 1;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
          doHappy();
        }, 280);
      } else {
        clearTimeout(clickTimer);
        clickCount = 0;
        openChat();
      }
    }
    maybeDrag = null;
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    touch();
    api.showMenu({ sleeping: state.sleeping });
  });

  // 点击穿透:只有悬停在宠物 / 气泡 / 输入框上时窗口才接收鼠标
  if (!PREVIEW && api.platform !== 'linux') {
    document.addEventListener('mousemove', (e) => {
      if (state.dragging) {
        api.setIgnoreMouse(false);
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const interactive = el && el.closest && el.closest('.interactive');
      api.setIgnoreMouse(!interactive);
    });
  }

  // ---------- 菜单命令 ----------

  api.onCommand((cmd) => {
    touch();
    switch (cmd) {
      case 'talk':
        wake();
        sayRandom();
        break;
      case 'walk':
        wake();
        stopCode(true);
        startWalk(rand(3000, 6000));
        break;
      case 'skate':
        wake();
        stopCode(true);
        stopMove();
        startSkate(rand(4000, 7000));
        break;
      case 'code':
        wake();
        startCode();
        break;
      case 'toggle-sleep':
        if (state.sleeping) wake();
        else setSleep(true);
        break;
      case 'chat':
        openChat();
        break;
      default:
        break;
    }
  });

  // ---------- 自主行为循环 ----------

  function behaviorLoop() {
    setTimeout(() => {
      if (!busy() && !state.sleeping) {
        const r = Math.random();
        if (r < 0.18) startWalk();
        else if (r < 0.26) startSkate();
        else if (r < 0.38) startCode();
        else if (r < 0.56) sayRandom();
        else if (r < 0.64) doWiggle();
        // 其余时间安静地发呆
      }

      // 太久没人理 → 睡觉
      if (!state.sleeping && !busy() && Date.now() - state.lastInteraction > SLEEP_AFTER_MS) {
        setSleep(true);
      }

      behaviorLoop();
    }, rand(6000, 14000));
  }

  // ---------- 启动 ----------

  // 调试 / 截图用:?pose=skate 或 ?pose=code 直接摆姿势
  const forcedPose = new URLSearchParams(location.search).get('pose');
  if (forcedPose === 'skate' || forcedPose === 'code') {
    body.classList.add(forcedPose);
  } else {
    blinkLoop();
    behaviorLoop();
    setTimeout(() => showBubble(GREETING, 5000), 700);
  }
})();
