// najia.js — 京房纳甲排盘:八宫世应、纳甲干支、六亲、六神、干支历、旬空
// 依《火珠林》《卜筮正宗》通行体例。爻序自下而上,索引 0 = 初爻。
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

  // ——— 装卦:对某卦 id(六位 bits,自下而上)排纳甲 ———
  function zhuangGua(id, date) {
    const info = PALACE_MAP[id];
    if (!info) throw new Error('未知卦 id:' + id);
    const lower = TRIGRAM_NAME[id.slice(0, 3)], upper = TRIGRAM_NAME[id.slice(3, 6)];
    const cal = date ? ganZhi(date) : null;
    const shen = cal ? liuShen(cal.dayGan) : null;
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const tri = i < 3 ? lower : upper;
      const t = NAJIA_TABLE[tri];
      const gan = i < 3 ? t.gan[0] : t.gan[1];
      const zhi = i < 3 ? t.inner[i] : t.outer[i - 3];
      const wx = ZHI_WX[zhi];
      lines.push({
        pos: i + 1, ganZhi: gan + zhi, zhi, wx,
        liuQin: liuQin(info.palaceWx, wx),
        shi: info.shi === i + 1, ying: info.ying === i + 1,
        liuShen: shen ? shen[i] : null,
        kong: cal ? cal.xunKong.includes(zhi) : false,
      });
    }
    return { palace: info.palace, palaceWx: info.palaceWx, gen: info.gen, shi: info.shi, ying: info.ying, lines, cal };
  }

  return { ganZhi, zhuangGua, liuShen, dayIndex, sunLongitude, PALACE_MAP, GAN, ZHI, ZHI_WX };
}));
