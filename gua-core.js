// gua-core.js — 三钱法起卦与解卦核心逻辑(纯函数,可在浏览器与 Node 中运行)
// 约定:爻序一律自下而上,索引 0 = 初爻;bits 字符串同理,id[0] = 初爻。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./gua-data.js'));
  } else {
    root.GuaCore = factory(root.GuaData);
  }
}(typeof self !== 'undefined' ? self : this, function (GuaData) {
  const { TRIGRAMS, BY_ID } = GuaData;

  // ——— 随机源:密码学安全随机比特 ———
  // 每枚铜钱一比特,来自 CSPRNG 的均匀字节,0/1 概率严格各半,无模偏差。
  function cryptoBit() {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (!c || !c.getRandomValues) throw new Error('本环境不支持密码学随机数(crypto.getRandomValues)');
    const buf = new Uint8Array(1);
    c.getRandomValues(buf);
    return buf[0] & 1;
  }

  // ——— 掷一爻:三枚铜钱,字=3 背=2,求和 6/7/8/9 ———
  function tossLine(rngBit) {
    const bit = rngBit || cryptoBit;
    const coins = [bit(), bit(), bit()].map(b => (b ? '字' : '背'));
    const sum = coins.reduce((s, c) => s + (c === '字' ? 3 : 2), 0);
    return makeLine(sum, coins);
  }

  function makeLine(sum, coins) {
    if (sum < 6 || sum > 9) throw new Error('爻值必须在 6-9 之间,得到 ' + sum);
    const yang = (sum === 7 || sum === 9);   // 少阳/老阳为阳爻
    const moving = (sum === 6 || sum === 9); // 老阴/老阳为变爻
    const label = { 6: '老阴 ⚋ ×(动)', 7: '少阳 ⚊', 8: '少阴 ⚋', 9: '老阳 ⚊ ○(动)' }[sum];
    return { sum, coins: coins || null, yang, moving, label };
  }

  // ——— 六掷成卦(自下而上) ———
  function castHexagram(rngBit) {
    const lines = [];
    for (let i = 0; i < 6; i++) lines.push(tossLine(rngBit));
    return finishCast(lines);
  }

  // 由六个爻值(6/7/8/9,自下而上)直接成卦——供手工录入与测试
  function castFromSums(sums) {
    if (!Array.isArray(sums) || sums.length !== 6) throw new Error('需要 6 个爻值');
    return finishCast(sums.map(s => makeLine(Number(s))));
  }

  function finishCast(lines) {
    const benId = lines.map(l => (l.yang ? '1' : '0')).join('');
    const bianId = lines.map(l => ((l.moving ? !l.yang : l.yang) ? '1' : '0')).join('');
    const moving = lines.map((l, i) => (l.moving ? i : -1)).filter(i => i >= 0); // 0-based,自下而上
    const ben = BY_ID[benId];
    const bian = moving.length ? BY_ID[bianId] : null;
    return { lines, moving, ben, bian, benId, bianId: moving.length ? bianId : null };
  }

  function trigramsOf(gua) {
    return { lower: TRIGRAMS[gua.id.slice(0, 3)], upper: TRIGRAMS[gua.id.slice(3, 6)] };
  }

  const POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  const POS_MEANING = [
    '起始、根基,事情的起点',
    '内卦之主,得中,内部核心',
    '内外交界,多变多险之地',
    '近君之位,伴虎之地,进退当心',
    '九五尊位,全卦之主,事情的决定处',
    '终极之位,盛极将变,收尾与退场',
  ];

  // ——— 解卦优先级(用户规则)———
  // 0 变:本卦卦辞|1 变:该爻爻辞为核心|2-3 变:本变并重|4-5 变:以变卦为主|6 变:变卦卦辞(乾坤全变用用九/用六)
  function interpretationPlan(cast) {
    const n = cast.moving.length;
    const focus = []; // {kind, gua, lineIdx?, text, note}
    let mode, headline;
    const ben = cast.ben, bian = cast.bian;
    const movingNames = cast.moving.map(i => POS_NAMES[i].replace('爻', '')).join('、');
    if (n === 0) {
      mode = '静卦';
      headline = `本卦${ben.full},六爻安静,无变卦`;
      focus.push({ kind: '本卦卦辞(断卦核心)', text: ben.guaCi });
      focus.push({ kind: '本卦大象', text: ben.daXiang });
    } else if (n === 1) {
      const i = cast.moving[0];
      mode = '一爻动';
      headline = `本卦${ben.full},${POS_NAMES[i]}动,变卦${bian.full}`;
      focus.push({ kind: `动爻爻辞(断卦核心)· ${ben.name}卦${POS_NAMES[i]}`, text: ben.yaoCi[i], lineIdx: i });
      focus.push({ kind: '动爻小象', text: ben.xiaoXiang[i] });
      focus.push({ kind: '本卦卦辞(参照)', text: ben.guaCi });
      focus.push({ kind: '变卦卦辞(事态走向)', text: bian.guaCi });
    } else if (n <= 3) {
      mode = `${n}爻动`;
      headline = `本卦${ben.full},${movingNames}爻动,变卦${bian.full}`;
      cast.moving.forEach(i => focus.push({ kind: `动爻爻辞 · ${ben.name}卦${POS_NAMES[i]}`, text: ben.yaoCi[i], lineIdx: i }));
      focus.push({ kind: '本卦卦辞(现状)', text: ben.guaCi });
      focus.push({ kind: '变卦卦辞(走向,与本卦并重)', text: bian.guaCi });
    } else if (n <= 5) {
      mode = `${n}爻动`;
      headline = `本卦${ben.full},${movingNames}爻动,变卦${bian.full}`;
      focus.push({ kind: '变卦卦辞(断卦核心)', text: bian.guaCi });
      focus.push({ kind: '变卦大象', text: bian.daXiang });
      focus.push({ kind: '本卦卦辞(来路参照)', text: ben.guaCi });
    } else {
      mode = '六爻全变';
      headline = `本卦${ben.full},六爻全变,变卦${bian.full}`;
      if (ben.name === '乾') {
        focus.push({ kind: '用九(乾之全变,断卦核心)', text: ben.yaoCi[6] });
      } else if (ben.name === '坤') {
        focus.push({ kind: '用六(坤之全变,断卦核心)', text: ben.yaoCi[6] });
      } else {
        focus.push({ kind: '变卦卦辞(断卦核心)', text: bian.guaCi });
      }
      focus.push({ kind: '变卦大象', text: bian ? bian.daXiang : '' });
    }
    return { mode, headline, focus };
  }

  // ——— 组装完整解读(结构化,供 UI 渲染)———
  function interpret(cast) {
    const plan = interpretationPlan(cast);
    const ben = cast.ben, bian = cast.bian;
    const t = trigramsOf(ben);
    const judge = (bian && cast.moving.length >= 4) ? bian : ben; // 断语主取:4变以上看变卦
    const out = {
      headline: plan.headline,
      mode: plan.mode,
      level: judge.lv,
      dx: judge.dx,
      dxFrom: judge === ben ? `东玄断 · ${ben.full}` : `东玄断 · ${bian.full}(变卦为主)`,
      focus: plan.focus,
      ben: { full: ben.full, sym: ben.sym, n: ben.n, guaCi: ben.guaCi, daXiang: ben.daXiang },
      bian: bian ? { full: bian.full, sym: bian.sym, n: bian.n, guaCi: bian.guaCi, daXiang: bian.daXiang } : null,
      trigrams: {
        upper: t.upper, lower: t.lower,
        note: `上卦${t.upper.name}(${t.upper.elem}):${t.upper.imagery};方位${t.upper.dir};行业${t.upper.fields}。` +
              `下卦${t.lower.name}(${t.lower.elem}):${t.lower.imagery};方位${t.lower.dir};行业${t.lower.fields}。`,
      },
      movingDetail: cast.moving.map(i => ({ pos: POS_NAMES[i], meaning: POS_MEANING[i], yaoCi: ben.yaoCi[i], xiaoXiang: ben.xiaoXiang[i] })),
      numbers: {
        xt: [t.upper.xt, t.lower.xt], ht: [t.upper.ht, t.lower.ht],
        note: `先天数 上${t.upper.name}${t.upper.xt}/下${t.lower.name}${t.lower.xt};后天数 上${t.upper.ht}/下${t.lower.ht};` +
              `地支应期 上卦(${t.upper.branches.join('、')})、下卦(${t.lower.branches.join('、')})。`,
      },
    };
    return out;
  }

  // ——— 生成【东玄掷卦 · 卦象回报】文本 ———
  function buildReport(cast, question) {
    const t = trigramsOf(cast.ben);
    const sums = cast.lines.map(l => l.sum).join('、');
    const movingTxt = cast.moving.length
      ? cast.moving.map(i => POS_NAMES[i]).join('、') + '动'
      : '无(六爻安静)';
    const bianTxt = cast.bian
      ? (() => { const bt = trigramsOf(cast.bian); return `${cast.bian.full}(上卦${bt.upper.name} / 下卦${bt.lower.name})`; })()
      : '无';
    return [
      '【东玄掷卦 · 卦象回报】',
      `六爻(自下而上):${sums}`,
      `本卦:${cast.ben.full}(上卦${t.upper.name} / 下卦${t.lower.name})`,
      `动爻:${movingTxt}`,
      `变卦:${bianTxt}`,
      `我要问的事:${question || '(未填写)'}`,
    ].join('\n');
  }

  return { cryptoBit, tossLine, castHexagram, castFromSums, interpret, interpretationPlan, buildReport, trigramsOf, POS_NAMES, POS_MEANING };
}));
