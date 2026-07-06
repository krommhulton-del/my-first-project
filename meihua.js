// meihua.js — 梅花易数:报数/时间起卦,体用互变,五行生克断
// 依《梅花易数》体例:先天数配卦(乾1兑2离3震4巽5坎6艮7坤8),
// 报数法以首数为上卦、次数为下卦、两数和加时辰数除六取动爻;
// 时间法以农历年支数+月+日和除八为上卦,再加时辰数除八为下卦、除六取动爻。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./gua-data.js')); }
  else { root.Meihua = factory(root.GuaData); }
}(typeof self !== 'undefined' ? self : this, function (GuaData) {
  const { BY_ID, TRIGRAMS } = GuaData;
  // 先天数 → 经卦 bits(自下而上)
  const XT = { 1: '111', 2: '110', 3: '101', 4: '100', 5: '011', 6: '010', 7: '001', 8: '000' };
  const mod = (n, m) => { const r = n % m; return r === 0 ? m : r; };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  // 月支五行(旺衰参照:当令者旺)
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

  // 报数起卦:n1 为上卦数,n2 为下卦数,动爻 =(n1+n2+时辰数)除六取余
  function castByNumbers(n1, n2, hourNum) {
    return build(mod(n1, 8), mod(n2, 8), mod(n1 + n2 + hourNum, 6),
      `报数 ${n1}、${n2},加${'子丑寅卯辰巳午未申酉戌亥'[hourNum - 1]}时数 ${hourNum}`);
  }
  // 时间起卦:农历(年支数+月+日)除八为上卦,加时辰数除八为下卦,总数除六取动爻
  function castByTime(lunar) {
    const s1 = lunar.yearBranchNum + lunar.lMonth + lunar.lDay;
    const s2 = s1 + lunar.hourNum;
    return build(mod(s1, 8), mod(s2, 8), mod(s2, 6),
      `${lunar.yearGZ}年${lunar.monthName}${lunar.dayName}${lunar.hourBranch}时` +
      `(年${lunar.yearBranchNum}+月${lunar.lMonth}+日${lunar.lDay}=${s1},加时${lunar.hourNum}=${s2})`);
  }

  function build(upperNum, lowerNum, moving, how) {
    const up = XT[upperNum], lo = XT[lowerNum];
    const benId = lo + up;
    const ben = BY_ID[benId];
    // 互卦:二三四爻为下互,三四五爻为上互
    const huId = benId.slice(1, 4) + benId.slice(2, 5);
    const hu = BY_ID[huId];
    // 变卦:动爻阴阳互变
    const bianArr = benId.split('');
    bianArr[moving - 1] = bianArr[moving - 1] === '1' ? '0' : '1';
    const bian = BY_ID[bianArr.join('')];
    // 体用:动爻所在之卦为用,另一卦为体
    const movingInLower = moving <= 3;
    const tiTri = TRIGRAMS[movingInLower ? up : lo];
    const yongTri = TRIGRAMS[movingInLower ? lo : up];
    return { how, ben, hu, bian, moving, movingInLower, tiTri, yongTri, upperNum, lowerNum };
  }

  // 体用生克断,附互卦、变卦对体之参照与月令旺衰
  function analyze(cast, monthZhi) {
    const ti = cast.tiTri.wuxing, yong = cast.yongTri.wuxing;
    let rel, lv, txt;
    if (ti === yong) { rel = '体用比和'; lv = '吉'; txt = '体用比和,谋事顺遂,内外同心,成之不难。'; }
    else if (SHENG[yong] === ti) { rel = '用生体'; lv = '大吉'; txt = '用生体,外来生扶,有人相助、得外益之象,事成且有进项。'; }
    else if (SHENG[ti] === yong) { rel = '体生用'; lv = '不利'; txt = '体生用,泄气之象,费力耗财而利归他人,成亦无味。'; }
    else if (KE[ti] === yong) { rel = '体克用'; lv = '小吉'; txt = '体克用,事可成而迟,须自己出力去拿,拿得住。'; }
    else { rel = '用克体'; lv = '凶'; txt = '用克体,受制之象,事败伤身破财,不可强为。'; }
    // 月令旺衰
    const yueWx = ZHI_WX[monthZhi];
    let wang;
    if (yueWx === ti) wang = `体卦${ti}当令而旺,凶减吉增`;
    else if (SHENG[yueWx] === ti) wang = `月令${yueWx}生体,体旺有气`;
    else if (KE[yueWx] === ti) wang = `月令${yueWx}克体,体衰,吉缓凶速`;
    else if (SHENG[ti] === yueWx) wang = `体泄气于月令,力弱`;
    else wang = `体卦季内平气`;
    // 互卦、变卦对体
    const huUp = TRIGRAMS[cast.hu.id.slice(3, 6)], huLo = TRIGRAMS[cast.hu.id.slice(0, 3)];
    const bianTri = TRIGRAMS[cast.movingInLower ? cast.bian.id.slice(0, 3) : cast.bian.id.slice(3, 6)];
    const refOf = wx => wx === ti ? '比和' : (SHENG[wx] === ti ? '生体' : (KE[wx] === ti ? '克体' : (SHENG[ti] === wx ? '体生之' : '体克之')));
    const huNote = `互卦${cast.hu.full}(${huUp.name}${huLo.name}),中间过程:上互${huUp.wuxing}${refOf(huUp.wuxing)},下互${huLo.wuxing}${refOf(huLo.wuxing)}`;
    const bianNote = `变卦${cast.bian.full},结局之卦:用变${bianTri.wuxing},${refOf(bianTri.wuxing)}`;
    return { rel, lv, txt, wang, huNote, bianNote, ti, yong };
  }

  return { castByNumbers, castByTime, analyze, XT };
}));
