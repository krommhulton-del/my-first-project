// sanmei.js — 算命学(高尾義政《原典算命学大系》体系):陰占三柱 + 陽占人体星図
// 出典口径:
//  · 陽占十大主星:北(頭)=日干×年干,南(腹)=日干×月干,東(左手)=日干×年支蔵干,
//    中央(胸)=日干×月支蔵干,西(右手)=日干×日支蔵干。
//  · 十二大従星:左肩(初年期)=日干×年支,左足(中年期)=日干×月支,右足(晩年期)=日干×日支,
//    以十二運(陽干順行、陰干逆行)转星,能量点数:将12禄11南10贵9堂8恍7印6库5胡4报3极2驰1。
//  · 蔵干:按节入后经过日数取初元/中元/本元(月律分野蔵干表)。
//  · 天中殺:依日柱旬空二支,分六种(子丑/寅卯/辰巳/午未/申酉/戌亥)。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'));
  } else { root.Sanmei = factory(root.Najia); }
}(typeof self !== 'undefined' ? self : this, function (Najia) {
  const GAN = Najia.GAN, ZHI = Najia.ZHI;
  const GAN_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  // ——— 十大主星(由日干与彼干的十神关系转星) ———
  const MAIN_STARS = {
    比肩: { name: '貫索星', gist: '独立守成之星:主见硬、自成一格,守得住阵地,不爱受摆布' },
    劫财: { name: '石門星', gist: '和合纵横之星:人缘广、善结盟,集体里最能施展,有政治手腕' },
    食神: { name: '鳳閣星', gist: '自然表现之星:天真会享受,衣食有福,松弛里出灵气,主寿' },
    伤官: { name: '調舒星', gist: '锐感孤高之星:感受极细、艺气重,认死理也认真情,一对一最深' },
    偏财: { name: '禄存星', gist: '魅力周济之星:钱财走得动、人情投得出,靠付出聚人聚财' },
    正财: { name: '司禄星', gist: '积蓄家庭之星:一点一滴攒,踏实持家,日久见功' },
    七杀: { name: '車騎星', gist: '行动冲锋之星:干脆利落、敢打敢拼,劳碌也是它,战斗也是它' },
    正官: { name: '牽牛星', gist: '名誉责任之星:重体面、守规矩,组织里得器重,担子越重越亮' },
    偏印: { name: '龍高星', gist: '改革历险之星:不安于常规,要亲身闯、四方学,变动中开新局' },
    正印: { name: '玉堂星', gist: '学问传承之星:好读书、重传统,理气足,一学就通' },
  };
  function shiShenOf(dayGan, gan) {
    const me = GAN_WX[GAN.indexOf(dayGan)], it = GAN_WX[GAN.indexOf(gan)];
    const same = (GAN.indexOf(dayGan) % 2) === (GAN.indexOf(gan) % 2);
    if (it === me) return same ? '比肩' : '劫财';
    if (SHENG[me] === it) return same ? '食神' : '伤官';
    if (KE[me] === it) return same ? '偏财' : '正财';
    if (KE[it] === me) return same ? '七杀' : '正官';
    return same ? '偏印' : '正印';
  }
  const mainStar = (dayGan, gan) => {
    const s = MAIN_STARS[shiShenOf(dayGan, gan)];
    return { star: s.name, gist: s.gist, from: gan };
  };

  // ——— 十二運(陽干順行、陰干逆行)与十二大従星 ———
  const STAGES = ['長生', '沐浴', '冠帯', '建禄', '帝旺', '衰', '病', '死', '墓', '絶', '胎', '養'];
  const CHANGSHENG = { 甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', 乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯' };
  function juniUn(dayGan, zhi) {
    const start = ZHI.indexOf(CHANGSHENG[dayGan]);
    const yang = GAN.indexOf(dayGan) % 2 === 0;
    const d = yang ? (ZHI.indexOf(zhi) - start + 12) % 12 : (start - ZHI.indexOf(zhi) + 12) % 12;
    return STAGES[d];
  }
  const JUSEI = {
    長生: { name: '天貴星', pts: 9, gist: '端正好学,自尊自重,长子气象' },
    沐浴: { name: '天恍星', pts: 7, gist: '华彩浪漫,早离乡关,自带光彩也自带迷惘' },
    冠帯: { name: '天南星', pts: 10, gist: '锐气逼人,敢批敢闯,永远向前' },
    建禄: { name: '天禄星', pts: 11, gist: '沉稳老练,现实里最能办事,大管家之才' },
    帝旺: { name: '天将星', pts: 12, gist: '十二星之首,天生挑大梁;能量太足,闲不得也压不得' },
    衰: { name: '天堂星', pts: 8, gist: '温和老成,退一步的智慧,晚景安详' },
    病: { name: '天胡星', pts: 4, gist: '感性如梦,艺心与直觉强,身子要多将养' },
    死: { name: '天極星', pts: 2, gist: '静水深流,精神世界深,无欲则刚' },
    墓: { name: '天庫星', pts: 5, gist: '钻研执着,认准就挖到底,承家守业' },
    絶: { name: '天馳星', pts: 1, gist: '来去如风,反应最快,忙起来才有精神' },
    胎: { name: '天報星', pts: 3, gist: '多才多变,一身几样心思,变通是长处也是关口' },
    養: { name: '天印星', pts: 6, gist: '天真招人疼,得长辈缘,承接现成基业' },
  };
  const jusei = (dayGan, zhi) => {
    const st = juniUn(dayGan, zhi);
    const j = JUSEI[st];
    return { star: j.name, stage: st, pts: j.pts, gist: j.gist, from: zhi };
  };

  // ——— 蔵干(月律分野:节入后经过日数取初元/中元/本元) ———
  // 表:[干, 截止日](含);末项为本元。
  const ZOKAN = {
    子: [['壬', 10], ['癸', 99]],
    丑: [['癸', 9], ['辛', 12], ['己', 99]],
    寅: [['戊', 7], ['丙', 14], ['甲', 99]],
    卯: [['甲', 10], ['乙', 99]],
    辰: [['乙', 9], ['癸', 12], ['戊', 99]],
    巳: [['戊', 5], ['庚', 14], ['丙', 99]],
    午: [['丙', 10], ['己', 19], ['丁', 99]],
    未: [['丁', 9], ['乙', 12], ['己', 99]],
    申: [['戊', 7], ['壬', 14], ['庚', 99]],
    酉: [['庚', 10], ['辛', 99]],
    戌: [['辛', 9], ['丁', 12], ['戊', 99]],
    亥: [['戊', 7], ['甲', 12], ['壬', 99]],
  };
  const zokanOf = (zhi, days) => ZOKAN[zhi].find(e => days <= e[1])[0];

  // 节入后经过日数:自出生日往前找月支变化之日(节气定月,最多回溯 32 天)
  function daysIntoJie(date) {
    const mz = Najia.ganZhi(date).monthZhi;
    for (let i = 1; i <= 32; i++) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - i, 12);
      if (Najia.ganZhi(d).monthZhi !== mz) return i; // 第 i 天前换月,则节入后第 i 天
    }
    return 32;
  }

  // ——— 天中殺(六种) ———
  const TCS_NOTE = {
    戌亥: '戌亥天中殺:精神气最重,与无形之事有缘,大器晚成——晚年主题要自己摸,别急',
    申酉: '申酉天中殺:目标要放高放远才走得顺,与子女后辈之缘是功课',
    午未: '午未天中殺:中年是主战场,家庭与事业两头兼顾是一生的课题',
    辰巳: '辰巳天中殺:面倒见好、担当重,常成一家之顶梁,晚运安定',
    寅卯: '寅卯天中殺:少年多磨是肥料,靠实打实的本事立身,中年后开花',
    子丑: '子丑天中殺:祖荫目上之力偏薄,白手起家型,一砖一瓦垒出来的运',
  };
  function kongOf(dayGZ) {
    let idx = -1;
    for (let i = 0; i < 60; i++) if (GAN[i % 10] === dayGZ[0] && ZHI[i % 12] === dayGZ[1]) { idx = i; break; }
    const xunShou = idx - (idx % 10);
    return [ZHI[(xunShou + 10) % 12], ZHI[(xunShou + 11) % 12]];
  }

  // ——— 主函数:陰占三柱 → 陽占人体星図 ———
  function chart(date) {
    const cal = Najia.ganZhi(date);
    const days = daysIntoJie(date);
    const yG = cal.year[0], yZ = cal.year[1], mG = cal.month[0], mZ = cal.month[1], dG = cal.day[0], dZ = cal.day[1];
    const zokan = { year: zokanOf(yZ, days), month: zokanOf(mZ, days), day: zokanOf(dZ, days) };
    const stars = {
      head: mainStar(dG, yG),          // 北 · 頭:目上与初年心象
      belly: mainStar(dG, mG),         // 南 · 腹:后辈与晚境心象
      leftHand: mainStar(dG, zokan.year),  // 東 · 左手:同辈朋友、社交之用
      chest: mainStar(dG, zokan.month),    // 中央 · 胸:本命中心星
      rightHand: mainStar(dG, zokan.day),  // 西 · 右手:配偶之位、看家本领
    };
    const js = {
      shoulder: jusei(dG, yZ),   // 左肩:初年期
      leftFoot: jusei(dG, mZ),   // 左足:中年期
      rightFoot: jusei(dG, dZ),  // 右足:晚年期
    };
    const energy = js.shoulder.pts + js.leftFoot.pts + js.rightFoot.pts;
    const band = energy >= 24 ? '身强(能量厚,扛得住大局,须有处使)' : energy >= 15 ? '中和(收放有度,随局伸缩)' : '身弱(质敏于量,以巧胜、以静养,不宜硬拼)';
    const kong = kongOf(cal.day);
    const tcsKey = ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'].find(k => k.includes(kong[0]));
    return {
      pillars: { year: cal.year, month: cal.month, day: cal.day },
      daysIntoJie: days, zokan,
      stars, jusei: js,
      energy: { total: energy, band },
      tenchusatsu: { kong, type: tcsKey + '天中殺', note: TCS_NOTE[tcsKey] },
    };
  }

  // 人体星図材料(给 AI 深断用的文字版)
  function material(c) {
    const s = c.stars, j = c.jusei;
    return `【算命学·陽占人体星図(三柱:${c.pillars.year} ${c.pillars.month} ${c.pillars.day},节入后第${c.daysIntoJie}天)】
中心星(胸):${s.chest.star}——${s.chest.gist}
头(目上/初年心象):${s.head.star};腹(后辈/晚境心象):${s.belly.star};左手(社交之用):${s.leftHand.star};右手(看家本领/配偶位):${s.rightHand.star}
従星三期:初年${j.shoulder.star}(${j.shoulder.stage}${j.shoulder.pts}点)、中年${j.leftFoot.star}(${j.leftFoot.stage}${j.leftFoot.pts}点)、晚年${j.rightFoot.star}(${j.rightFoot.stage}${j.rightFoot.pts}点)
能量合计:${c.energy.total}点(满36)——${c.energy.band}
${c.tenchusatsu.type}(空亡${c.tenchusatsu.kong.join('、')}):${c.tenchusatsu.note}`;
  }

  return { chart, material, mainStar, shiShenOf, juniUn, jusei, zokanOf, daysIntoJie, kongOf,
    MAIN_STARS, JUSEI, STAGES, CHANGSHENG, ZOKAN, TCS_NOTE };
}));
