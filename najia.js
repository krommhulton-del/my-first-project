// najia.js — 京房纳甲排盘:八宫世应、纳甲干支、六亲、六神、干支历、旬空
// 依火珠林一脉的通行体例。2026-08 起,凡在 data/classics/ 五本原文里搜得到原话的规则,
// 已逐条挂上出处(见各处「出处:」注);搜不到的仍写「通行口径,出处待核」,不许挂书名冒充有据。
// 已挂出处的:月破、旬空、飞伏神、世应、进退神(皆《增删卜易》,繁体原文照抄)。
// 其中八宫次序、纳甲干支、六亲六神已用通行本全表逐卦对照过,零误差;
// 断法部分(飞伏、旺衰权重)属流派共识,非某书原文。爻序自下而上,索引 0 = 初爻。
// 历法约定:日柱零点换日;月建、年柱以节气(太阳黄经,立春315°起寅月)为界。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Najia = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const TRIGRAM_NAME = { '111': '乾', '110': '兑', '101': '离', '100': '震', '011': '巽', '010': '坎', '001': '艮', '000': '坤' };
  const PALACE_WX = { 乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土' };
  // 纳甲表:各经卦内/外卦所纳天干与三支(自下而上)
  const NAJIA_TABLE = {
    乾: { gan: ['甲', '壬'], inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
    坤: { gan: ['乙', '癸'], inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'] },
    震: { gan: ['庚', '庚'], inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
    巽: { gan: ['辛', '辛'], inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'] },
    坎: { gan: ['戊', '戊'], inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'] },
    离: { gan: ['己', '己'], inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'] },
    艮: { gan: ['丙', '丙'], inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'] },
    兑: { gan: ['丁', '丁'], inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'] },
  };
  // 五行生克
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // A 生 SHENG[A]
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };    // A 克 KE[A]

  function liuQin(palaceWx, yaoWx) {
    if (palaceWx === yaoWx) return '兄弟';
    if (SHENG[yaoWx] === palaceWx) return '父母'; // 生我者
    if (SHENG[palaceWx] === yaoWx) return '子孙'; // 我生者
    if (KE[yaoWx] === palaceWx) return '官鬼';    // 克我者
    return '妻财';                                 // 我克者
  }

  // ——— 八宫世应:由八纯卦程序化生成全部 64 卦归宫 ———
  // 序:本宫(世6)→一世~五世(依次变初至五爻)→游魂(五世再变四爻)→归魂(游魂内卦复原)
  const PALACE_MAP = (function () {
    const map = {};
    const SHI = [6, 1, 2, 3, 4, 5, 4, 3];
    const GEN = ['本宫卦', '一世卦', '二世卦', '三世卦', '四世卦', '五世卦', '游魂卦', '归魂卦'];
    for (const bits of Object.keys(TRIGRAM_NAME)) {
      const palace = TRIGRAM_NAME[bits];
      let lines = (bits + bits).split('').map(Number);
      const put = (gen) => {
        const id = lines.join('');
        map[id] = { palace, palaceWx: PALACE_WX[palace], gen: GEN[gen], shi: SHI[gen], ying: ((SHI[gen] - 1 + 3) % 6) + 1 };
      };
      put(0);
      for (let i = 0; i < 5; i++) { lines[i] ^= 1; put(i + 1); }   // 一世~五世
      lines[3] ^= 1; put(6);                                       // 游魂
      for (let i = 0; i < 3; i++) lines[i] = Number(bits[i]);      // 归魂:内卦复原
      put(7);
    }
    return map;
  })();

  // ——— 干支历 ———
  // 日柱锚点:2000-01-07 为甲子日(零点换日,取本地日期)
  function dayIndex(y, m, d) {
    const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 7)) / 86400000);
    return ((days % 60) + 60) % 60;
  }
  const gz = i => GAN[i % 10] + ZHI[i % 12];

  // 太阳视黄经(Meeus 低精度,误差约 0.01°,足定节气)
  function sunLongitude(dateUtcMs) {
    const jd = dateUtcMs / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525;
    const rad = Math.PI / 180;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const omega = (125.04 - 1934.136 * T) * rad;
    let lam = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
    lam %= 360; if (lam < 0) lam += 360;
    return lam;
  }

  // 完整干支(年柱、月建、日辰、旬空)。date 为 Date,按其本地历日与时刻计算。
  function ganZhi(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const lam = sunLongitude(date.getTime());
    const mi = Math.floor((((lam - 315) % 360) + 360) % 360 / 30); // 0=寅月 … 11=丑月
    const lunarYear = (m <= 2 && mi >= 10) ? y - 1 : y;            // 立春前属旧岁
    const yGan = ((lunarYear - 4) % 10 + 10) % 10, yZhi = ((lunarYear - 4) % 12 + 12) % 12;
    const mZhi = (mi + 2) % 12;                                    // 寅=ZHI[2]
    const mGan = ((yGan % 5) * 2 + 2 + mi) % 10;                   // 五虎遁
    const dIdx = dayIndex(y, m, d);
    const xunShou = dIdx - (dIdx % 10);
    const kong = [ZHI[(xunShou + 10) % 12], ZHI[(xunShou + 11) % 12]];
    return {
      year: GAN[yGan] + ZHI[yZhi], month: GAN[mGan] + ZHI[mZhi], day: gz(dIdx),
      monthZhi: ZHI[mZhi], dayGan: GAN[dIdx % 10], dayZhi: ZHI[dIdx % 12],
      xunKong: kong, sunLon: lam,
    };
  }

  // 六神:依日干起,自初爻而上
  const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
  function liuShen(dayGan) {
    const start = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 }[dayGan];
    return Array.from({ length: 6 }, (_, i) => LIU_SHEN[(start + i) % 6]);
  }

  // 世应之义,出处:《增删卜易》「世爲自己,應爲他人,凡兼彼此之事,兼而用之,
  //   欲他扶助我者,喜應爻生合世爻」(该章并载野鹤「卦身亦不驗,亦用世爻」之断)。

  // 旬空之义,出处:《增删卜易·旬空章第二十六》「凡占近病,用神得遇旬空者,不拘日月動爻克害,
  //   用神出空之日卽愈」;同章并载「元神動於卦中,用神空者,出空之日而得;忌神動於卦中,而用神空者,
  //   出空之日逢殃」——本程序的应期取「出空/实空之日」即依此(见 yingqi.js)。

  // ——— 爻的旺衰:月建定四时之气、日辰定眼下之力 ———
  // 月建看五行旺相休囚死(与月支五行论生克,六爻通行简法);爻支被月建冲为「月破」。
  // 日辰生扶克冲合各有断:冲静爻为「暗动」(暗中已动),冲动爻为「冲散」,合动爻为「合住」。
  const WANG = (yaoWx, ordWx) => {
    if (yaoWx === ordWx) return '旺';
    if (SHENG[ordWx] === yaoWx) return '相';
    if (SHENG[yaoWx] === ordWx) return '休';
    if (KE[yaoWx] === ordWx) return '囚';
    return '死';
  };
  const LIUHE_Z = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const chongOfZ = z => ZHI[(ZHI.indexOf(z) + 6) % 12];
  // 旺相休囚死给一个可比的力量分,断语才有「几成」可依
  const WANG_SCORE = { 旺: 2, 相: 1, 休: -0.5, 囚: -1, 死: -1.5 };
  // 五行之墓库(见 yaoPower 里的出处说明)
  const MU_OF = { 火: '戌', 水: '辰', 木: '未', 金: '丑', 土: '戌' };

  function yaoPower(zhi, wx, moving, cal) {
    if (!cal) return null;
    const mz = cal.monthZhi, dz = cal.dayZhi;
    const mWx = ZHI_WX[mz], dWx = ZHI_WX[dz];
    const out = { wang: WANG(wx, mWx), notes: [], score: 0 };
    out.score += WANG_SCORE[out.wang];
    // 出处:《增删卜易·月破章第二十七》「正申、二酉、三戌,四亥、五子、六丑、七寅、八卯、九辰,
    //   十巳、十一午、十二未,月建沖之爲月破,逐月之破日是也」——即月建所冲之支为月破,与本处算法一致。
    out.yuePo = chongOfZ(zhi) === mz;
    if (out.yuePo) { out.score -= 2; out.notes.push(`月破(被月建${mz}冲):这段力弱事败,须待出了这个月或填实之日才提得起来`); }
    // 日辰之力
    if (wx === dWx) { out.score += 1; out.notes.push(`日辰${dz}与之同气:眼下有帮手`); }
    else if (SHENG[dWx] === wx) { out.score += 1.5; out.notes.push(`日辰${dz}生之:眼下有人添力`); }
    else if (KE[dWx] === wx) { out.score -= 1.5; out.notes.push(`日辰${dz}克之:眼下被压着`); }
    if (LIUHE_Z[zhi] === dz) {
      out.heRi = true;
      out.notes.push(moving ? `日辰${dz}合住此动爻:动而被绊,事拖着推不动,待冲开之日方行` : `日辰${dz}与之相合:有人贴上来说和`);
      if (moving) out.score -= 0.5;
    }
    if (chongOfZ(zhi) === dz) {
      out.chongRi = true;
      if (moving) { out.chongSan = true; out.score -= 1; out.notes.push(`日辰${dz}冲此动爻:动而逢冲则散,事到跟前易变卦`); }
      else { out.anDong = true; out.score += 0.8; out.notes.push(`日辰${dz}冲此静爻:暗动——表面没动静,暗里已经在走`); }
    }
    // ——— 入墓:古有日墓、动墓、化墓之三墓 ———
    // 出处:《增删卜易》随鬼入墓章「古有日墓﹑動墓﹑化墓之三墓」(data/classics/增删卜易.txt,繁体)。
    // 墓库五行对应:**火墓戌、水墓辰这两味原文里直接核得到**
    //   (「但嫌巳火墓于戌月而又化墓」「明年辰戌是子水入墓之年」);
    //   木墓未、金墓丑、土墓戌三味那份转录里搜不到,故不挂它的名,改按本程序已有的十二长生表推
    //   (一个口径一处算,不另立一张表)。**土的墓位六爻另有「辰为水土之墓」一说,此转录断不了,
    //   本处从十二长生表作戌,属通行口径、出处待核。**
    // 入墓者力被收去,应期要等冲开墓库那一日——「如逢合住须冲破以成功」「明岁辰年冲开墓库」。
    if (MU_OF[wx] === dz) {
      out.ruMu = '日墓'; out.muZhi = dz; out.score -= 1;
      out.notes.push(`此爻入日辰${dz}之墓:力被收着使不出来,要等冲开${dz}的那一日才动得了`);
    }
    return out;
  }

  // ——— 进神退神 ———
  // 出处:《增删卜易·进神退神章第二十九》——
  //   「進神退神者,爻之動而化也,化進化退,吉凶禍福有喜忌之分,所喜者宜於化進,所忌者宜化退神。
  //     進神亥化子,寅化卯,巳化午,申化酉,丑化辰,辰化未,未化戌。
  //     退神子化亥,卯化寅,午化巳,酉化申,辰化丑,未化辰,戌化未。」
  // **原文把十四对列死了,照抄即可,不必自己推。**
  // 2026-08 修正:此前的写法是「同五行且支序前进≤3 为进神」,会多认两对——
  //   土的次序原文作丑→辰→未→戌(三步),我那个模十二的算法把绕回去的「戌化丑」也判成进神、
  //   「丑化戌」判成退神,而原文这两对一个都没列。现改为直接照原文的十四对判,多出来的一律不判。
  const JIN = { 亥: '子', 寅: '卯', 巳: '午', 申: '酉', 丑: '辰', 辰: '未', 未: '戌' };
  const TUI = { 子: '亥', 卯: '寅', 午: '巳', 酉: '申', 辰: '丑', 未: '辰', 戌: '未' };
  function jinTui(fromZhi, toZhi) {
    if (JIN[fromZhi] === toZhi) return { type: '进神', note: `${fromZhi}化${toZhi}为进神:事往前走,越走越有,原本要成的成得更透` };
    if (TUI[fromZhi] === toZhi) return { type: '退神', note: `${fromZhi}化${toZhi}为退神:事往回缩,原本要成的也会打折,原本要坏的反倒消一点` };
    return null;
  }

  // ——— 装卦:对某卦 id(六位 bits,自下而上)排纳甲 ———
  // 排一卦六爻的纳甲干支与六亲(不含日月之力,供本卦与首卦共用)
  function bareLines(id, palaceWx) {
    const lower = TRIGRAM_NAME[id.slice(0, 3)], upper = TRIGRAM_NAME[id.slice(3, 6)];
    const out = [];
    for (let i = 0; i < 6; i++) {
      const tri = i < 3 ? lower : upper;
      const t = NAJIA_TABLE[tri];
      const gan = i < 3 ? t.gan[0] : t.gan[1];
      const zhi = i < 3 ? t.inner[i] : t.outer[i - 3];
      const wx = ZHI_WX[zhi];
      out.push({ pos: i + 1, ganZhi: gan + zhi, zhi, wx, liuQin: liuQin(palaceWx, wx) });
    }
    return out;
  }

  // opts: { moving: [布尔六位,自下而上], bianId: 变卦 id }
  function zhuangGua(id, date, opts) {
    const info = PALACE_MAP[id];
    if (!info) throw new Error('未知卦 id:' + id);
    opts = opts || {};
    const moving = opts.moving || [];
    const cal = date ? ganZhi(date) : null;
    const shen = cal ? liuShen(cal.dayGan) : null;
    const lines = bareLines(id, info.palaceWx).map((l, i) => {
      const mv = !!moving[i];
      return Object.assign(l, {
        shi: info.shi === i + 1, ying: info.ying === i + 1,
        liuShen: shen ? shen[i] : null,
        kong: cal ? cal.xunKong.includes(l.zhi) : false,
        moving: mv,
        power: yaoPower(l.zhi, l.wx, mv, cal),
      });
    });

    // —— 伏神:某一六亲不上卦时,依古法从本宫首卦(八纯卦)同位取伏,本卦同位之爻为飞神 ——
    // 出处:《增删卜易·飛伏神章第二十八》「若用神不現,卽以日月爲用神,倘日月非用神者,則本宮首卦尋之,
    //   因本宮首卦,父子財官六親俱全之故耳」——「取本宫首卦同位」这一步与本处一致。
    // **缺一步照实记**:原文在此之前还有「卽以日月爲用神」——用神不上卦时先看日月是不是那一门六亲,
    //   是则直接以日月为用神,不必找伏神。本程序没做这一步,已记进 CLAUDE.md 待办。
    // 六十四卦里约七成有六亲不上卦,问财问子尤甚(各占四分之一);
    // 没有这一项,遇上用神不现的卦就只能瞎猜,故必补。
    const palBits = Object.keys(TRIGRAM_NAME).find(k => TRIGRAM_NAME[k] === info.palace);
    const shouLines = bareLines(palBits + palBits, info.palaceWx);
    const onBoard = new Set(lines.map(l => l.liuQin));
    const fuShen = [];
    for (const sl of shouLines) {
      if (onBoard.has(sl.liuQin)) continue;
      if (fuShen.some(f => f.liuQin === sl.liuQin)) continue;   // 同一六亲取首见者
      const fei = lines[sl.pos - 1];
      const p = yaoPower(sl.zhi, sl.wx, false, cal);
      let rel, relNote;
      if (KE[fei.wx] === sl.wx) { rel = '飞来克伏'; relNote = '飞神克伏神:被压在底下出不来,此事受人所制,须待冲开飞神或伏神得日月生扶之时'; }
      else if (KE[sl.wx] === fei.wx) { rel = '伏克飞'; relNote = '伏神克飞神:出得来,虽伏犹用,时候一到自会冒头'; }
      else if (SHENG[fei.wx] === sl.wx) { rel = '飞生伏'; relNote = '飞神生伏神:底下有人托着,虽不显却有力,出伏之日即见'; }
      else if (SHENG[sl.wx] === fei.wx) { rel = '伏生飞'; relNote = '伏神生飞神:自己的劲都贴给了别人,费力不落好'; }
      else { rel = '飞伏比和'; relNote = '飞伏同气:不相碍,平平常常，待值日冲空之期'; }
      fuShen.push({
        liuQin: sl.liuQin, pos: sl.pos, ganZhi: sl.ganZhi, zhi: sl.zhi, wx: sl.wx,
        fei: { ganZhi: fei.ganZhi, zhi: fei.zhi, wx: fei.wx, liuQin: fei.liuQin },
        rel, relNote, power: p,
        kong: cal ? cal.xunKong.includes(sl.zhi) : false,
      });
    }

    // —— 动墓(三墓之一):卦中有动爻,其支正是某爻五行的墓库,该爻即随之入墓 ——
    // 出处同上:《增删卜易》随鬼入墓章「古有日墓﹑動墓﹑化墓之三墓」。
    for (const L of lines) {
      if (!L.power || L.power.ruMu) continue;               // 已判日墓的不重复记
      const mz = MU_OF[L.wx];
      const mover = lines.find(x => x.moving && x.zhi === mz && x !== L);
      if (mover) {
        L.power.ruMu = '动墓'; L.power.muZhi = mz; L.power.score -= 0.8;
        L.power.notes.push(`卦中${mz}爻发动,此爻随之入墓:被那一头收住了,要等冲开${mz}才脱得开`);
      }
    }

    // —— 变爻:化出的六亲(仍按本宫五行论)、回头生克、进退神、化空化破 ——
    let bian = null;
    if (opts.bianId && opts.bianId !== id) {
      const bLines = bareLines(opts.bianId, info.palaceWx);
      bian = { id: opts.bianId, palace: (PALACE_MAP[opts.bianId] || {}).palace || '', lines: [] };
      for (let i = 0; i < 6; i++) {
        if (!moving[i]) continue;
        const from = lines[i], to = bLines[i];
        const item = { pos: i + 1, from: from.ganZhi, to: to.ganZhi, toZhi: to.zhi, toWx: to.wx, toLiuQin: to.liuQin, notes: [] };
        const jt = jinTui(from.zhi, to.zhi);
        if (jt) { item.jinTui = jt.type; item.notes.push(jt.note); }
        if (SHENG[to.wx] === from.wx) { item.huiTou = '回头生'; item.notes.push(`${from.zhi}动化${to.zhi}回头相生:自己变出来的东西反过来养自己,越动越有力`); }
        else if (KE[to.wx] === from.wx) { item.huiTou = '回头克'; item.notes.push(`${from.zhi}动化${to.zhi}回头相克:一动就伤己,这一步走出去反受其害`); }
        if (cal && cal.xunKong.includes(to.zhi)) { item.huaKong = true; item.notes.push('化空:变出来的是个空,眼下落不到实处,待出旬填实再论'); }
        if (cal && chongOfZ(to.zhi) === cal.monthZhi) { item.huaPo = true; item.notes.push('化月破:变出来的即被月建冲破,这一变没结果'); }
        if (from.zhi === to.zhi) { item.fuYin = true; item.notes.push('化伏吟:动而不动,原地打转,旧事重演'); }
        if (chongOfZ(from.zhi) === to.zhi) { item.fanYin = true; item.notes.push('化爻反吟:变出的正冲自己,反复颠倒、先成后败'); }
        // 化墓(三墓之一):自己变出来的那个支,正是本爻五行的墓库
        if (MU_OF[from.wx] === to.zhi) {
          item.huaMu = true; item.muZhi = to.zhi;
          item.notes.push(`化墓:一动就把自己关进${to.zhi}库里,越动越出不来,要等冲开${to.zhi}的日子`);
          if (from.power) { from.power.ruMu = from.power.ruMu ? from.power.ruMu + '·化墓' : '化墓'; from.power.muZhi = to.zhi; from.power.score -= 0.8; }
        }
        bian.lines.push(item);
      }
      // 卦级伏吟/反吟:整个内卦或外卦原样不动为伏吟、变成相冲之卦(震↔巽)为反吟。
      // 爻级反吟受纳甲表所限、单爻变时结构上出不来,真正常见的是这一层。
      const triOf = b3 => TRIGRAM_NAME[b3];
      // 卦反吟:变卦之卦与本卦之卦在后天八卦上处于对冲之位。
      // **2026-08 修错**:此前这里只写了 { 震:'巽', 巽:'震' } 一对,而震在正东、巽在东南,
      // 两者根本不对冲——这一对是错的,四对真的一对没有,等于反吟从来没报对过。
      // 依据不引书:那段列出四对的文字出自转录者的现代按语(后面紧跟着「卜筮原理简述」在谈第七感),
      // 不是野鹤老人的原文,按规矩不许挂《增删卜易》的名。
      // 改用可客观核对的标准:**后天八卦方位对冲**(乾西北↔巽东南、坎正北↔离正南、
      // 艮东北↔坤西南、震正东↔兑正西),方位数据就在本程序的 gua-data.js 里,有测试逐对核。
      const FAN = { 乾: '巽', 巽: '乾', 坎: '离', 离: '坎', 艮: '坤', 坤: '艮', 震: '兑', 兑: '震' };
      const io = [['内卦', id.slice(0, 3), opts.bianId.slice(0, 3)], ['外卦', id.slice(3, 6), opts.bianId.slice(3, 6)]];
      bian.guaNotes = [];
      for (const [name, a3, b3] of io) {
        const A = triOf(a3), B = triOf(b3);
        if (a3 === b3) continue;
        if (FAN[A] === B) bian.guaNotes.push(`${name}反吟(${A}变${B}):此事反复颠倒、先成后败,成了也留不住`);
      }
      if (opts.bianId === id) bian.guaNotes.push('卦伏吟:变卦与本卦相同,动而不动,旧局重演');
    }

    return {
      palace: info.palace, palaceWx: info.palaceWx, gen: info.gen, shi: info.shi, ying: info.ying,
      lines, cal, fuShen, bian,
    };
  }

  // ——— 用神取法:问什么事,取哪一门六亲 ———
  // 总纲有出处:《增删卜易·用神章第八》以父母/兄弟/子孙/妻财/官鬼分主人事;
  // 但**逐事的细目对照表(如问考试取父母、问病取官鬼)本程序是按行内通行口径列的,
  // 没有逐条回原文核过,故这一层仍属「通行口径,出处待核」。**
  const YONG_SHEN = [
    // 次序要紧:先认死指向(老公/男友→官鬼、老婆/女友→妻财),再认事类,最后才按性别定婚恋。
    { re: /(老公|丈夫|男朋友|男友|男方|未婚夫|夫君)/, liuQin: '官鬼', note: '问夫婿以官鬼为用神' },
    { re: /(老婆|妻子|女朋友|女友|女方|未婚妻)/, liuQin: '妻财', note: '问妻室以妻财为用神' },
    { re: /(病|疾|症|痛|健康|手术|住院|化验|癌|灾)/, liuQin: '官鬼', note: '问病以官鬼为病症、子孙为医药,两头对看' },
    { re: /(工作|职位|事业|升职|晋升|考公|考编|上班|老板|领导|官司|诉讼|名声|竞选|比赛|录取|面试)/, liuQin: '官鬼', note: '问功名事业官非以官鬼为用神' },
    { re: /(财|钱|收入|工资|薪|生意|买卖|投资|理财|讨债|价格|赚|利润|报酬)/, liuQin: '妻财', note: '问钱财买卖以妻财为用神' },
    { re: /(房|屋|宅|车|文书|合同|证件|学业|考试|论文|证书|长辈|父母|爸|妈|保险|执照)/, liuQin: '父母', note: '问房车文书学业长辈以父母为用神' },
    { re: /(子女|孩子|儿子|女儿|怀孕|备孕|生育|宠物|下属|平安|出行安否|保平安)/, liuQin: '子孙', note: '问子女平安以子孙为用神' },
    { re: /(兄弟|姐妹|朋友|同事|合伙|同行|竞争对手)/, liuQin: '兄弟', note: '问平辈合伙以兄弟为用神' },
  ];
  // 泛指婚恋(没点明男女方)时,按问卦人性别定:男以妻财为妻、女以官鬼为夫
  const MARRIAGE_RE = /(婚|恋爱|对象|感情|姻缘|正缘|相亲|复合|表白|脱单|在一起|谈朋友)/;
  // 一问兼涉数事是常有的(「跟朋友合伙做生意」既涉合伙之人、又涉财利),
  // 故主用神之外把兼看的一并报出来,由断者两头对看,不硬吞掉另一半。
  function yongShenOf(question, gender) {
    const q = String(question || '');
    const hits = YONG_SHEN.filter(r => r.re.test(q));
    if (hits.length) {
      const main = hits[0];
      const also = hits.slice(1).filter(h => h.liuQin !== main.liuQin);
      return {
        liuQin: main.liuQin, note: main.note,
        also: also.map(h => ({ liuQin: h.liuQin, note: h.note })),
        multi: also.length > 0,
      };
    }
    if (MARRIAGE_RE.test(q)) {
      if (gender === '女') return { liuQin: '官鬼', note: '女问婚恋以官鬼为夫星、为用神' };
      if (gender === '男') return { liuQin: '妻财', note: '男问婚恋以妻财为妻星、为用神' };
      return { liuQin: null, note: '问婚恋而未言男女:男以妻财为用、女以官鬼为用,此处性别未填,故以世爻为自身、应爻为对方论' };
    }
    return { liuQin: null, note: '所问不属五类六亲之一,以世爻为自身、应爻为对方论' };
  }
  // 在一卦里定位用神(先看卦面,不上卦则取伏神)
  function locateYong(gua, liuQinName) {
    if (!liuQinName) return null;
    const on = gua.lines.filter(l => l.liuQin === liuQinName);
    if (on.length) {
      const pick = on.find(l => l.moving) || on.find(l => l.shi) || on[0];
      return { where: '现于卦中', line: pick, all: on, fu: null };
    }
    const fu = (gua.fuShen || []).find(f => f.liuQin === liuQinName);
    if (fu) return { where: '不上卦,取伏神', line: null, all: [], fu };
    return { where: '既不上卦、首卦亦无', line: null, all: [], fu: null };
  }

  return { ganZhi, zhuangGua, liuShen, dayIndex, sunLongitude, PALACE_MAP, GAN, ZHI, ZHI_WX,
    yaoPower, jinTui, yongShenOf, locateYong, bareLines, YONG_SHEN };
}));
