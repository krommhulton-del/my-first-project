// jiri.js — 吉日历(择吉):建除十二神 + 黄黑道值神 + 冲煞合害 + 本命生克
// 依据:建除自月建起顺行十二辰(「建满平收黑,除危定执黄,成开皆可用,破闭不相当」);
// 值神青龙歌诀「寅申须加子,卯酉却居寅,辰戌龙位上,巳亥午中寻,子午临申地,丑未戌上行」,
// 黄道六神:青龙明堂金匮天德玉堂司命;冲煞按日支六冲生肖,煞方依三合局(申子辰煞南等)。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./lunar.js'));
  } else { root.Jiri = factory(root.Najia, root.Lunar); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Lunar) {
  const ZHI = Najia.ZHI, GAN = Najia.GAN;
  const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const zi = name => ZHI.indexOf(name);

  // ——— 建除十二神:月建地支日为「建」,顺行 ———
  const JIANCHU = [
    { name: '建', luck: 0, gist: '万物初始,旺气之日', yi: '出行、赴任、求谋、拜师', ji: '动土、开仓、安葬' },
    { name: '除', luck: 2, gist: '除旧布新', yi: '打扫除秽、治病就医、了结旧事', ji: '搬家入宅、嫁娶大事' },
    { name: '满', luck: 0, gist: '丰收圆满', yi: '祭祀祈福、开市纳财', ji: '上任、服药、安葬' },
    { name: '平', luck: 0, gist: '平平常常', yi: '修饰、涂泥、日常事务', ji: '大动作皆不显' },
    { name: '定', luck: 2, gist: '安定平顺', yi: '订盟订婚、签约宴饮、安床', ji: '就医、诉讼、出师' },
    { name: '执', luck: 2, gist: '固执其事', yi: '建屋种植、捕捉、收账', ji: '搬家、远行、开市' },
    { name: '破', luck: -4, gist: '日月相冲,大事勿用', yi: '拆除、破屋、求医治病', ji: '其余诸事不取' },
    { name: '危', luck: 2, gist: '危中藏机,宜静不宜险', yi: '安床、祭祀、谨慎小事', ji: '登高、行船、冒险' },
    { name: '成', luck: 3, gist: '万事有成', yi: '开业、嫁娶、上任、入学', ji: '诉讼' },
    { name: '收', luck: 0, gist: '收敛纳藏', yi: '收账、纳财、入仓', ji: '开张、出行、下葬' },
    { name: '开', luck: 3, gist: '开通顺遂', yi: '开业开工、嫁娶、求职、入学', ji: '动土、安葬' },
    { name: '闭', luck: -2, gist: '闭塞不通', yi: '筑堤、封仓、收尾', ji: '开市、出行、上任' },
  ];

  // ——— 黄黑道十二值神:按月支定青龙起点,顺行 ———
  // 起点 = (月支×2 + 8) % 12:寅申→子,卯酉→寅,辰戌→辰,巳亥→午,子午→申,丑未→戌
  const ZHISHEN = [
    { name: '青龙', huang: true, luck: 3, note: '天乙黄道,万事大吉' },
    { name: '明堂', huang: true, luck: 2, note: '贵人黄道,宜见贵、上书、谋事' },
    { name: '天刑', huang: false, luck: -2, note: '黑道,忌词讼动土,利武不利文' },
    { name: '朱雀', huang: false, luck: -2, note: '黑道,防口舌是非,签约谈判慎' },
    { name: '金匮', huang: true, luck: 2, note: '福德黄道,宜嫁娶、纳财' },
    { name: '天德', huang: true, luck: 3, note: '宝光黄道,宜祈福、修造、大事' },
    { name: '白虎', huang: false, luck: -2, note: '黑道,忌远行冒险,祭祀可制' },
    { name: '玉堂', huang: true, luck: 2, note: '少微黄道,宜安床入宅、文书' },
    { name: '天牢', huang: false, luck: -2, note: '黑道,忌官司囚系、强出头' },
    { name: '玄武', huang: false, luck: -2, note: '黑道,防盗防小人、暗昧不明' },
    { name: '司命', huang: true, luck: 2, note: '凤辇黄道,白日用事吉' },
    { name: '勾陈', huang: false, luck: -2, note: '黑道,忌田土纠纷,事易缠绕' },
  ];

  const jianchuOf = (monthZhi, dayZhi) => JIANCHU[(zi(dayZhi) - zi(monthZhi) + 12) % 12];
  const zhishenOf = (monthZhi, dayZhi) => {
    const start = (zi(monthZhi) * 2 + 8) % 12;
    return ZHISHEN[(zi(dayZhi) - start + 12) % 12];
  };

  // ——— 冲煞合害刑 ———
  const chongOf = z => (z + 6) % 12;
  // 煞方:申子辰日煞南,寅午戌煞北,巳酉丑煞东,亥卯未煞西
  const SHA_DIR = ['南', '东', '北', '西', '南', '东', '北', '西', '南', '东', '北', '西'];
  const LIUHE = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
  const LIUHAI = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };
  const SANHE = [[8, 0, 4], [5, 9, 1], [2, 6, 10], [11, 3, 7]];
  const sanheMates = z => { const g = SANHE.find(a => a.includes(z)); return g.filter(x => x !== z); };
  const XING_PAIRS = [[0, 3], [2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1]]; // 子卯 / 寅巳申 / 丑戌未
  const ZIXING = [4, 6, 9, 11]; // 辰午酉亥自刑
  const isXing = (a, b) => (a === b && ZIXING.includes(a)) ||
    XING_PAIRS.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));

  // ——— 五行(天干)与生克 ———
  const GAN_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  // 流日天干对本命日干:同我/生我/我克 顺,克我 逆,我生 耗
  function wxRelation(dayGan, selfGan) {
    const d = GAN_WX[GAN.indexOf(dayGan)], s = GAN_WX[GAN.indexOf(selfGan)];
    if (d === s) return { rel: '同我', score: 1, note: `流日${d}与你日主同气,做事顺手` };
    if (SHENG[d] === s) return { rel: '生我', score: 1, note: `流日${d}生你日主${s},有滋养、有人帮衬` };
    if (SHENG[s] === d) return { rel: '我生', score: 0, note: `你日主${s}生流日${d},操心出力的日子` };
    if (KE[s] === d) return { rel: '我克', score: 1, note: `你日主${s}克流日${d},主动可为、拿得住` };
    return { rel: '克我', score: -1, note: `流日${d}克你日主${s},压力大、费力气` };
  }

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const atNoon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

  // ——— 二十八宿值日(通书体系,与七曜锁定:宿名中字即星曜)———
  // 锚点:2026-07-18(星期六)= 柳土獐,与市售黄历比对确立;吉凶依通书十六吉十二凶。
  const XIU = [
    ['角木蛟', '吉', '造作嫁娶皆利,开门放水吉'], ['亢金龙', '凶', '造作婚姻忌之,诸事宜缓'], ['氐土貉', '凶', '造作下手多凶,宜守'],
    ['房日兔', '吉', '造作田蚕旺,婚丧皆吉'], ['心月狐', '凶', '造作多凶,词讼尤忌'], ['尾火虎', '吉', '造作进田,婚姻嫁娶利'],
    ['箕水豹', '吉', '造作开门放水吉,田蚕旺'], ['斗木獬', '吉', '造作兴旺,岁岁平安'], ['牛金牛', '凶', '造作婚姻皆不宜'],
    ['女土蝠', '凶', '造作多灾,宜静不宜动'], ['虚日鼠', '凶', '造作有灾殃,诸事收敛'], ['危月燕', '凶', '造作忌高险,行船登高慎'],
    ['室火猪', '吉', '造作进田牛,富贵之宿'], ['壁水㺄', '吉', '造作兴家,婚姻吉'], ['奎木狼', '吉', '造作得祯祥,出行吉'],
    ['娄金狗', '吉', '造作田蚕盛,婚姻合卺吉'], ['胃土雉', '吉', '造作事如意,仓库田蚕旺'], ['昴日鸡', '凶', '造作多灾,婚姻不宜'],
    ['毕月乌', '吉', '造作主兴隆,田蚕俱旺'], ['觜火猴', '凶', '造作多凶,葬埋尤忌'], ['参水猿', '吉', '造作旺人家,出行开门吉'],
    ['井木犴', '吉', '造作旺蚕田,求学文书吉'], ['鬼金羊', '凶', '造作卒有灾,惟葬无碍'], ['柳土獐', '凶', '造作多遭官非,宜守静'],
    ['星日马', '吉', '造作进庄田,嫁娶独忌'], ['张月鹿', '吉', '造作事亨通,百事和合'], ['翼火蛇', '凶', '造作多是非,婚姻不安'],
    ['轸水蚓', '吉', '造作得安康,诸事皆吉'],
  ];
  const XIU_ANCHOR = Math.floor(Date.UTC(2026, 6, 18) / 86400000); // 该日柳宿(序23)
  function xiuOf(date) {
    const dn = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    const idx = ((dn - XIU_ANCHOR) % 28 + 28 + 23) % 28;
    const x = XIU[idx];
    return { name: x[0], luck: x[1], note: x[2], idx };
  }

  // ——— 彭祖百忌(逐日干支各一句)———
  const PZ_GAN = { 甲: '甲不开仓,财物耗散', 乙: '乙不栽植,千株不长', 丙: '丙不修灶,必见灾殃', 丁: '丁不剃头,头必生疮', 戊: '戊不受田,田主不祥', 己: '己不破券,二比并亡', 庚: '庚不经络,织机虚张', 辛: '辛不合酱,主人不尝', 壬: '壬不泱水,更难提防', 癸: '癸不词讼,理弱敌强' };
  const PZ_ZHI = { 子: '子不问卜,自惹祸殃', 丑: '丑不冠带,主不还乡', 寅: '寅不祭祀,神鬼不尝', 卯: '卯不穿井,水泉不香', 辰: '辰不哭泣,必主重丧', 巳: '巳不远行,财物伏藏', 午: '午不苫盖,屋主更张', 未: '未不服药,毒气入肠', 申: '申不安床,鬼祟入房', 酉: '酉不会客,醉坐颠狂', 戌: '戌不吃犬,作怪上床', 亥: '亥不嫁娶,不利新郎' };
  const pengzuOf = gz => PZ_GAN[gz[0]] + ';' + PZ_ZHI[gz[1]];

  // ——— 杨公忌日(农历十三日)与月忌日(初五、十四、廿三)———
  const YANGGONG = { 1: [13], 2: [11], 3: [9], 4: [7], 5: [5], 6: [3], 7: [1, 29], 8: [27], 9: [25], 10: [23], 11: [21], 12: [19] };
  function lunarFlags(lunar) {
    if (!lunar) return { yanggong: false, yueji: false };
    return {
      yanggong: !lunar.isLeap && (YANGGONG[lunar.lMonth] || []).includes(lunar.lDay),
      yueji: [5, 14, 23].includes(lunar.lDay),
    };
  }

  // ——— 十二消息卦(卦气说:每节气月一卦,月运底色)———
  const XIAOXI = {
    寅: ['泰', '三阳开泰,天地气交——万事起头的月份,宜动宜谋'], 卯: ['大壮', '四阳壮盛,力有余而礼当守——宜进取,忌莽撞'],
    辰: ['夬', '五阳决一阴,当断则断——了结旧事的月份'], 巳: ['乾', '六阳纯盛,如日中天——大事可为,亦防亢极'],
    午: ['姤', '一阴初生,盛极有变——守成防变的月份'], 未: ['遯', '二阴渐长,君子以远小人——宜退步收敛,不宜强出头'],
    申: ['否', '天地不交,内外隔阂——沟通多梗,宜蓄力待时'], 酉: ['观', '四阴在下,静观其变——看清再动的月份'],
    戌: ['剥', '五阴剥一阳,山附于地——收尾护本,忌扩张'], 亥: ['坤', '六阴纯静,厚德载物——养精蓄锐的月份'],
    子: ['复', '一阳来复,冬至生机——转机初现,宜谋新'], 丑: ['临', '二阳浸长,大亨以正——渐入佳境,可着手布局'],
  };
  const xiaoxiOf = monthZhi => { const x = XIAOXI[monthZhi]; return { gua: x[0], note: x[1] }; };

  // ——— 单日详情。birth 可选:{date: Date}(按出生日算年支生肖与日主天干)———
  function dayInfo(date, birth) {
    const gz = Najia.ganZhi(date);
    const jc = jianchuOf(gz.monthZhi, gz.dayZhi);
    const zs = zhishenOf(gz.monthZhi, gz.dayZhi);
    const dz = zi(gz.dayZhi);
    const chongZhi = chongOf(dz);
    let lunar = null;
    try { lunar = Lunar.fromDate(date); } catch (e) { /* 历表越界时只缺农历显示 */ }

    const xiu = xiuOf(date);
    const flags = lunarFlags(lunar);
    let score = jc.luck + zs.luck + (xiu.luck === '吉' ? 1 : -1) + (flags.yanggong ? -3 : 0) + (flags.yueji ? -1 : 0);
    let personal = null;
    if (birth && birth instanceof Date && !isNaN(birth)) {
      const bgz = Najia.ganZhi(birth);
      const byZhi = ZHI.indexOf(bgz.year.charAt(1)); // 年支(生肖按立春界,与排盘一致)
      const marks = [];
      let ps = 0;
      if (chongOf(dz) === byZhi) { ps -= 5; marks.push(`日支${gz.dayZhi}冲你年支${ZHI[byZhi]}——正冲你的日子,大事勿用`); }
      if (LIUHE[dz] === byZhi) { ps += 2; marks.push(`日支${gz.dayZhi}与你年支${ZHI[byZhi]}六合,人事相协`); }
      if (sanheMates(dz).includes(byZhi)) { ps += 2; marks.push(`日支${gz.dayZhi}与你年支${ZHI[byZhi]}三合,得势顺遂`); }
      if (LIUHAI[dz] === byZhi) { ps -= 1; marks.push(`日支${gz.dayZhi}害你年支${ZHI[byZhi]},小人小阻,留个心`); }
      if (isXing(dz, byZhi)) { ps -= 1; marks.push(`日支${gz.dayZhi}刑你年支${ZHI[byZhi]},易生摩擦,忍口舌`); }
      const wx = wxRelation(gz.dayGan, bgz.dayGan);
      ps += wx.score;
      personal = {
        animal: ANIMALS[byZhi], yearZhi: ZHI[byZhi], selfGan: bgz.dayGan,
        chong: chongOf(dz) === byZhi, marks, wx, score: ps,
      };
      score += ps;
    }
    let level = score >= 5 ? '上吉' : score >= 3 ? '吉' : score >= -1 ? '平' : score >= -4 ? '慎' : '忌';
    if (jc.name === '破' && (level === '上吉' || level === '吉' || level === '平')) level = '慎'; // 破日封顶
    if (personal && personal.chong) level = '冲';
    return {
      iso: iso(date), y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(),
      week: (date.getDay() + 6) % 7, // 0=周一
      gz, lunar,
      lunarText: lunar ? (lunar.lDay === 1 ? lunar.monthName : lunar.dayName) : '',
      jianchu: jc, zhishen: zs, xiu, pengzu: pengzuOf(gz.day), flags,
      xiaoxi: xiaoxiOf(gz.monthZhi),
      chongAnimal: ANIMALS[chongZhi], chongZhi: ZHI[chongZhi], shaDir: SHA_DIR[dz],
      personal, score, level,
    };
  }

  // ——— 整月网格(month 1–12)———
  function monthGrid(year, month, birth) {
    const nDays = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= nDays; d++) days.push(dayInfo(atNoon(year, month, d), birth));
    return { year, month, firstWeek: days[0].week, days };
  }

  // ——— 按事挑日 ———
  const EVENTS = {
    jiaqu: { label: '嫁娶订婚', yi: ['定', '成', '开'], ji: ['破', '闭', '除'], bonus: ['金匮', '天德', '玉堂'], malus: [], note: '两口子的生肖都别被当日日支冲到' },
    kaiye: { label: '开业开市', yi: ['成', '开', '满'], ji: ['破', '闭', '收', '执'], bonus: ['金匮', '青龙'], malus: ['玄武'] },
    ruzhai: { label: '搬家入宅', yi: ['定', '成', '开'], ji: ['破', '危', '除', '闭'], bonus: ['玉堂', '天德', '青龙'], malus: [] },
    chuxing: { label: '出行远行', yi: ['建', '成', '开', '除'], ji: ['破', '危', '闭', '执'], bonus: ['青龙', '明堂'], malus: ['白虎'] },
    qianyue: { label: '签约谈判', yi: ['定', '成', '开', '执'], ji: ['破', '平', '闭'], bonus: ['明堂', '金匮'], malus: ['朱雀', '玄武'] },
    dongtu: { label: '动土装修', yi: ['平', '定', '执', '开'], ji: ['建', '破', '收', '闭'], bonus: ['青龙', '天德'], malus: ['勾陈', '天刑'] },
    qiuyi: { label: '求医就诊', yi: ['除', '破', '成', '开'], ji: ['定', '满'], bonus: ['天德', '司命'], malus: [], note: '破日反宜治病拆除,是十二建星里的老规矩' },
    shangren: { label: '上任面试', yi: ['建', '定', '成', '开'], ji: ['破', '闭', '收'], bonus: ['明堂', '青龙', '司命'], malus: ['天牢', '勾陈'] },
    kaoshi: { label: '考试文书', yi: ['建', '成', '开'], ji: ['破', '闭'], bonus: ['明堂', '玉堂'], malus: ['朱雀'] },
    jisi: { label: '祭祀祈福', yi: ['满', '平', '除', '成', '开'], ji: ['破'], bonus: ['天德', '明堂'], malus: [] },
    tongyong: { label: '要紧事(通用)', yi: ['定', '成', '开'], ji: ['破', '闭'], bonus: ['青龙', '天德'], malus: [] },
  };

  // ——— 心愿→事项:按关键词把一句心愿落到最贴的择日事项 ———
  const WISH_MAP = [
    { re: /(恋爱|脱单|表白|复合|相亲|结婚|订婚|求婚|领证|对象|追(他|她|人))/, key: 'jiaqu' },
    { re: /(装修|动工|动土|翻新|施工)/, key: 'dongtu' },
    { re: /(买房|搬家|入宅|搬去|租房|乔迁|新居)/, key: 'ruzhai' },
    { re: /(开店|创业|开业|摆摊|开公司|做生意|上新|发布)/, key: 'kaiye' },
    { re: /(跳槽|换工作|求职|面试|入职|升职|上任|转岗|谈加薪)/, key: 'shangren' },
    { re: /(考试|考证|考研|考公|备考|答辩|申请学校|留学)/, key: 'kaoshi' },
    { re: /(签约|签合同|谈判|合作|融资|投标)/, key: 'qianyue' },
    { re: /(旅行|旅游|出行|出国|出差|自驾|远行)/, key: 'chuxing' },
    { re: /(看病|手术|治疗|体检|就医|调理)/, key: 'qiuyi' },
    { re: /(祈福|拜佛|上香|还愿|祭祖)/, key: 'jisi' },
  ];
  function wishEvent(text) {
    const t = String(text || '');
    for (const w of WISH_MAP) if (w.re.test(t)) return { key: w.key, label: EVENTS[w.key].label };
    return { key: 'tongyong', label: EVENTS.tongyong.label };
  }

  // ——— 五行旺衰用度表(旺你/背运的颜色方位数字时段)———
  const WX_GOODS = {
    木: { colors: '绿、青、原木色', dir: '东', nums: '3、8', hours: '清晨5点到9点(寅卯时)' },
    火: { colors: '红、紫、橙', dir: '南', nums: '2、7', hours: '上午9点到午后1点(巳午时)' },
    土: { colors: '黄、咖啡、米色', dir: '西南与东北', nums: '5、10', hours: '午后1点到3点(未时)前后' },
    金: { colors: '白、银、金色', dir: '西', nums: '4、9', hours: '午后3点到7点(申酉时)' },
    水: { colors: '黑、蓝、灰', dir: '北', nums: '1、6', hours: '晚9点到凌晨1点(亥子时)' },
  };
  // 生肖贵人:与本命年支三合、六合的属相
  function zodiacAllies(yearZhiIdx) {
    const he = LIUHE[yearZhiIdx];
    return { sanhe: sanheMates(yearZhiIdx).map(z => ANIMALS[z]), liuhe: ANIMALS[he] };
  }

  function pickDays(eventKey, fromDate, nDays, birth, topN) {
    const ev = EVENTS[eventKey];
    if (!ev) return [];
    const out = [];
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12);
    for (let i = 0; i < (nDays || 30); i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const info = dayInfo(d, birth);
      if (ev.ji.includes(info.jianchu.name)) continue;       // 建星犯忌,直接排除
      if (info.personal && info.personal.chong) continue;     // 冲本人,排除
      if (info.flags.yanggong) continue;                      // 杨公忌日,大事一律不荐
      if (info.level === '忌') continue;
      let s = info.score;
      const why = [];
      if (ev.yi.includes(info.jianchu.name)) { s += 2; why.push(`${info.jianchu.name}日正合(${info.jianchu.gist})`); }
      if (ev.bonus.includes(info.zhishen.name)) { s += 2; why.push(`${info.zhishen.name}${info.zhishen.huang ? '黄道' : ''}相扶`); }
      if (ev.malus.includes(info.zhishen.name)) { s -= 2; why.push(`${info.zhishen.name}黑道有碍,列名但靠后`); }
      if (!ev.yi.includes(info.jianchu.name) && !why.length) continue; // 既不合建星又无神扶,不推
      if (info.zhishen.huang && !ev.bonus.includes(info.zhishen.name)) why.push(`${info.zhishen.name}黄道`);
      if (info.xiu.luck === '吉') why.push(`${info.xiu.name}吉宿`);
      if (info.personal) {
        info.personal.marks.forEach(m => why.push(m.split('——')[0]));
        why.push(info.personal.wx.rel === '克我' ? '流日克你日主,稍费力' : info.personal.wx.note.split(',')[1] || info.personal.wx.rel);
      }
      out.push({ info, score: s, why });
    }
    out.sort((a, b) => b.score - a.score || a.info.iso.localeCompare(b.info.iso));
    return out.slice(0, topN || 5);
  }

  return { JIANCHU, ZHISHEN, EVENTS, ANIMALS, WX_GOODS, XIU, XIAOXI, jianchuOf, zhishenOf, wxRelation, dayInfo, monthGrid, pickDays, wishEvent, zodiacAllies, xiuOf, pengzuOf, lunarFlags, xiaoxiOf };
}));
