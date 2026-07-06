// xiaoliuren.js — 小六壬(诸葛马前课):月上起日、日上起时,六宫定吉凶
// 起课:自大安起正月顺数至占月;自月宫起初一顺数至占日;自日宫起子时顺数至占时。
// 报数课:三数依次落宫,法同。主断在时宫(结果),月宫为因、日宫为过程。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Xiaoliuren = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  const GONG = [
    {
      name: '大安', wx: '木', shen: '青龙', ji: '吉', dir: '东方',
      key: '身不动时,属木青龙,凡事主静,吉。',
      verse: '大安事事昌,求财在坤方。失物去不远,宅舍保安康。行人身未动,病者主无妨。将军回田野,仔细好推详。',
    },
    {
      name: '留连', wx: '土', shen: '玄武', ji: '凶(迟滞)', dir: '四隅',
      key: '人未归时,属土玄武,凡事主迟滞纠缠,阴晦不明。',
      verse: '留连事难成,求谋日未明。官事凡宜缓,去者未回程。失物南方见,急讨方称心。更须防口舌,人口且平平。',
    },
    {
      name: '速喜', wx: '火', shen: '朱雀', ji: '吉(快)', dir: '南方',
      key: '人便至时,属火朱雀,凡事主快、喜讯将至。',
      verse: '速喜喜来临,求财向南行。失物申未午,逢人路上寻。官事有福德,病者无祸侵。田宅六畜吉,行人有信音。',
    },
    {
      name: '赤口', wx: '金', shen: '白虎', ji: '凶(口舌)', dir: '西方',
      key: '官事凶时,属金白虎,主口舌是非、官非伤害。',
      verse: '赤口主口舌,官非切要防。失物急去寻,行人有惊慌。六畜多作怪,病者出西方。更须防咀咒,恐怕染瘟殃。',
    },
    {
      name: '小吉', wx: '水', shen: '六合', ji: '吉(和合)', dir: '北方',
      key: '人来喜时,属水六合,凡事和合,有人报喜。',
      verse: '小吉最吉昌,路上好商量。阴人来报喜,失物在坤方。行人立便至,交关甚是强。凡事皆和合,病者叩穷苍。',
    },
    {
      name: '空亡', wx: '土', shen: '勾陈', ji: '大凶(无果)', dir: '中央',
      key: '音信稀时,属土勾陈,凡事落空、徒劳无益。',
      verse: '空亡事不祥,阴人多乖张。求财无利益,行人有灾殃。失物寻不见,官事有刑伤。病人逢暗鬼,禳解保安康。',
    },
  ];

  // 时间起课:农历月、日、时辰数(子=1)
  function castByTime(lunar) {
    const m = (lunar.lMonth - 1) % 6;                 // 自大安起正月
    const d = (m + lunar.lDay - 1) % 6;               // 月上起日
    const h = (d + lunar.hourNum - 1) % 6;            // 日上起时
    return {
      how: `${lunar.yearGZ}年${lunar.monthName}${lunar.dayName}${lunar.hourBranch}时(月${lunar.lMonth} 日${lunar.lDay} 时${lunar.hourNum})`,
      gongs: [GONG[m], GONG[d], GONG[h]], idx: [m, d, h],
    };
  }
  // 报数起课:三数依次落宫
  function castByNumbers(a, b, c) {
    const p1 = (a - 1) % 6;
    const p2 = (p1 + b - 1) % 6;
    const p3 = (p2 + c - 1) % 6;
    return { how: `报数 ${a}、${b}、${c}`, gongs: [GONG[p1], GONG[p2], GONG[p3]], idx: [p1, p2, p3] };
  }

  return { castByTime, castByNumbers, GONG };
}));
