// zhaigua.js — 占宅:问住处的六爻专项(v0.93,板块 C)
//
// ── 断法依据:《增删卜易》占宅诸章,规则逐条挂原话(繁体照原貌,核对靠 tests/zhaigua.test.mjs)──
//   舊宅章第一百十三(1560 字,标题在,归章可判):**指其所疑之处而占之**——野鹤明说
//   「若以一卦而斷全家之事者予則不能」,所以现住宅不搞一卦断全家,一疑一占;
//   鬼祟诊断表(六神×地支→患在何处)、财层(旺财持世宝藏兴焉)、六亲互化凶表皆出此章。
//   蓋造買宅賃宅章第一百零六:**这一章在本转录里标题丢了**(目录有、正文标题没了,
//   内容混在家宅章那一段),归章判不了——该章诸规则一律**只挂书名不挂章**(v0.79 规矩)。
//   創造宮室章第一百零七 · 修方動土章第一百零八 · 遷居過火章第一百零九 ·
//   歸宅入火章第一百一十 · 入宅六親凶吉章第一百十一 · 尋地章第一百十九 · 占地形勢章第一百二十:标题俱在。
//
// ── 与地利板块的分工(§四)──
//   dili.js 管「去哪个城市」(宏观方位),本模块管「这一处宅子」(微观、走卦)。
//   方位表取 Dili.ZHI_DIR(只此一份);断卦元素(旺衰/旬空/六神/进退)全取 Najia.zhuangGua,
//   六冲六合卦按对应爻支机械判(排盘层,零表);**本模块一个断法元素不自算**。
//
// ── 铁律五的一处留神 ──
//   舊宅章原文有「黃錢數張漿水一碗」的送法——那要买东西,哪怕几毛钱也不推荐(铁律五从严)。
//   程序给的做法取同章觉子那句**「一正可奪百邪,見怪不怪其怪自滅」**与「修德作福」——不花钱。
//   原文送法只在材料里作旁注注明「原文另载某法,本程序不荐购物」,不进做法清单。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./dili.js'));
  } else { root.Zhaigua = factory(root.Najia, root.Dili); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Dili) {

  const ZHI = Najia.ZHI;
  const chongZ = z => ZHI[(ZHI.indexOf(z) + 6) % 12];
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  // 五行绝地(十二长生之绝,排盘层通行全表;入宅克制之法用:择忌神绝之时)
  const JUE = { 木: '申', 火: '亥', 土: '巳', 金: '寅', 水: '巳' };
  // 五行长生之支(同上;安床取用神长生之方)
  const CHANGSHENG = { 木: '亥', 火: '寅', 土: '申', 金: '巳', 水: '申' };

  function zGua(cast, date) {
    const moving = [false, false, false, false, false, false];
    for (const i of (cast.moving || [])) moving[i] = true;
    return Najia.zhuangGua(cast.benId, date || new Date(), { moving, bianId: cast.bianId });
  }
  const shiLine = z => z.lines[z.shi - 1];
  // 六冲卦/六合卦:内外对应爻支两两相冲/相合(机械判,零表)
  const liuChong = z => [0, 1, 2].every(i => chongZ(z.lines[i].zhi) === z.lines[i + 3].zhi);
  const liuHeGua = z => [0, 1, 2].every(i => LIUHE[z.lines[i].zhi] === z.lines[i + 3].zhi);
  const bianOf = (z, pos) => z.bian && z.bian.lines ? z.bian.lines.find(b => b.pos === pos) : null;
  const guiLines = z => z.lines.filter(l => l.liuQin === '官鬼');

  // ── 鬼祟诊断表(舊宅章,逐条明文):患在何处按鬼爻之支;那一路的性质按鬼爻六神 ──
  const GUI_ZHI = {
    亥: { say: '患在水路:水沟、池塘、上下水、渗漏这一路', q: '亥子鬼投河溺井之魂或因水溝池塘之患' },
    子: { say: '患在水路:水沟、池塘、上下水、渗漏这一路', q: '亥子鬼投河溺井之魂或因水溝池塘之患' },
    辰: { say: '患在墙垣地基:墙体、屋面、地基下沉这一路', q: '辰戌丑未之鬼墻倒屋塌或因墻垣獸頭之犯' },
    戌: { say: '患在墙垣地基:墙体、屋面、地基下沉这一路', q: '辰戌丑未之鬼墻倒屋塌或因墻垣獸頭之犯' },
    丑: { say: '患在墙垣地基:墙体、屋面、地基下沉这一路', q: '辰戌丑未之鬼墻倒屋塌或因墻垣獸頭之犯' },
    未: { say: '患在墙垣地基:墙体、屋面、地基下沉这一路', q: '辰戌丑未之鬼墻倒屋塌或因墻垣獸頭之犯' },
    寅: { say: '患在门户梁架:门窗、栋梁、木作这一路', q: '寅卯鬼懸梁自縊又爲門戶棟梁' },
    卯: { say: '患在门户梁架:门窗、栋梁、木作这一路', q: '寅卯鬼懸梁自縊又爲門戶棟梁' },
    巳: { say: '患在炉灶用火:厨房、灶位、电火这一路', q: '巳午鬼火傷窯死兼爲鑪竈不安' },
    午: { say: '患在炉灶用火:厨房、灶位、电火这一路', q: '巳午鬼火傷窯死兼爲鑪竈不安' },
    申: { say: '患在金器旧物:刀剪利器、金属旧物这一路', q: '鬼臨申酉之鄕刀劍之身之魄或因金錢爲怪' },
    酉: { say: '患在金器旧物:刀剪利器、金属旧物这一路', q: '鬼臨申酉之鄕刀劍之身之魄或因金錢爲怪' },
  };
  const GUI_SHEN = {
    白虎: { say: '这一路带旧丧之气,多与经过丧事的旧物旧屋有关', q: '鬼臨白虎必有伏屍' },
    玄武: { say: '这一路从水上来', q: '鬼臨元武水怪山魑' },
    螣蛇: { say: '这一路多虫蛇之扰', q: '蛇主虫蛇爲妖' },
    朱雀: { say: '这一路牵口舌、官非、火烛', q: '雀是官非火盜' },
    勾陈: { say: '这一路牵纠纷缠讼,拖着不清', q: '勾陳鬼牢獄羈身' },
    青龙: { say: '这一路因酒色宴乐而起', q: '靑龍鬼色欲而喪' },
  };

  // ── 六亲互化凶表(舊宅章末段,逐条明文;扫动爻与变爻) ──
  function liuqinHua(z) {
    const out = [];
    for (const L of z.lines) {
      if (!L.moving) continue;
      const b = bianOf(z, L.pos);
      if (!b) continue;
      const f = L.liuQin, t = b.toLiuQin;
      if ((f === '妻财' && t === '父母') || (f === '父母' && t === '妻财')) out.push({
        plain: '长辈那一头有忧——这宅里父母长辈的身体与安顿先上心', q: '財動克父財化父父化財堂上之憂', src: '增删卜易·舊宅章第一百十三' });
      else if ((f === '官鬼' && t === '子孙') || (f === '子孙' && t === '官鬼')) out.push({
        plain: '小辈那一头有损——孩子的安全与身体这宅里要多看一眼', q: '父動克子鬼化子子化鬼膝前有損', src: '增删卜易·舊宅章第一百十三' });
      else if ((f === '兄弟' && t === '官鬼') || (f === '官鬼' && t === '兄弟')) out.push({
        plain: '平辈手足那一头有伤——兄弟姐妹在这宅里的事别硬扛', q: '兄弟變鬼鬼變兄弟鬼動克兄', src: '增删卜易·舊宅章第一百十三' });
      else if ((f === '妻财' && t === '官鬼') || (f === '官鬼' && t === '妻财') || (f === '兄弟' && t === '妻财') || (f === '妻财' && t === '兄弟')) out.push({
        plain: '夫妻那一头拧——住这宅子两口子容易离心,床位与私房账都要摆到明处', q: '妻財變鬼鬼變妻財兄動化財財化兄弟旣防手足刑傷又主分衾折枕', src: '增删卜易·舊宅章第一百十三' });
    }
    return out;
  }

  // ══════════ 六种问型 ══════════

  // 一、现住宅(指其所疑之处而占):问「家里某处是不是有问题」
  function jiu(z) {
    const sub = [], gui = guiLines(z), shi = shiLine(z);
    const guiMoving = gui.filter(l => l.moving);
    const guiShi = shi.liuQin === '官鬼';
    const zisunShi = shi.liuQin === '子孙';
    const zisunMoving = z.lines.some(l => l.moving && l.liuQin === '子孙');
    const allQuiet = z.lines.every(l => !l.moving);
    let verdict, vq;
    if (zisunShi || zisunMoving) {
      verdict = '不是你疑的这处。这一卦福神当家,你指的那处没毛病——别再疑它';
      vq = { q: '福德動搖不是此方之禍子孫持世或動於卦中或官鬼不動及六爻安寧非此處也', src: '增删卜易·舊宅章第一百十三' };
    } else if (guiShi || guiMoving.length) {
      verdict = '就是这处。你疑的地方这一卦点头了——修补、挪改要动起来,改完再占一卦看改得对不对';
      vq = { q: '官鬼發動的於此處興妖官鬼持世克世官鬼動爻實因此處有害', src: '增删卜易·舊宅章第一百十三' };
      const gl = guiMoving[0] || (guiShi ? shi : gui[0]);
      if (gl) {
        const gz = GUI_ZHI[gl.zhi], gs = GUI_SHEN[gl.liuShen];
        if (gz) sub.push({ plain: gz.say, tech: `鬼爻临${gl.zhi}`, q: gz.q, src: '增删卜易·舊宅章第一百十三' });
        if (gs) sub.push({ plain: gs.say, tech: `鬼爻临${gl.liuShen}`, q: gs.q, src: '增删卜易·舊宅章第一百十三' });
      }
      sub.push({ plain: '做法不花一分钱:把那处修利索、清干净,人行得正,看见怪也当没看见——书上原话就是这么教的;另有送法载于原文,要买东西,本程序不荐',
        tech: '觉子泊云之法', q: '一正可奪百邪見怪不怪其怪自滅', src: '增删卜易·舊宅章第一百十三' });
    } else if (allQuiet) {
      verdict = '这处没事。六爻安静、祸端不动——你疑的地方搁下吧';
      vq = { q: '官鬼不動及六爻安寧非此處也', src: '增删卜易·舊宅章第一百十三' };
    } else {
      verdict = '这处不是祸根,但卦里有别的事在动——你疑错了地方,想想家里最近真正变动的是哪一摊,指着它再占';
      vq = { q: '須指其所疑之事而占之其應如是', src: '增删卜易·舊宅章第一百十三' };
    }
    // 财层:宅里有藏
    const cai = z.lines.find(l => l.liuQin === '妻财' && ((l.pos === z.shi && l.power && l.power.score > 0) || l.moving));
    if (cai && (cai.pos === z.shi || cai.moving)) sub.push({
      plain: '这宅底子里有值钱的东西——旧物、老家当别当破烂扔,清点一遍再说',
      tech: `财爻${cai.pos === z.shi ? '持世' : '发动'}`, q: '旺財持世寶藏興焉', src: '增删卜易·舊宅章第一百十三' });
    return { verdict, vq, sub: sub.concat(liuqinHua(z)),
      note: '这一法的规矩是「一疑一占」:野鹤原话「若以一卦而斷全家之事者予則不能」——问哪处就断哪处,别拿这一卦兼断全家。' };
  }

  // 二、买房/盖房/租房(蓋造買宅賃宅——该章标题在转录里丢了,只挂书不挂章)
  function mai(z) {
    const sub = [], shi = shiLine(z);
    const fuLines = z.lines.filter(l => l.liuQin === '父母');
    const fuOK = fuLines.some(l => l.power && l.power.score > 0);
    const shiOK = shi.power && shi.power.score > 0;
    const caiMoving = z.lines.some(l => l.moving && l.liuQin === '妻财');
    const guiMoving = z.lines.some(l => l.moving && l.liuQin === '官鬼');
    const shiBian = bianOf(z, shi.pos);
    const chong = liuChong(z), he = liuHeGua(z);
    const fanYin = z.bian && z.bian.guaNotes && z.bian.guaNotes.some(n => /反吟/.test(n));
    let score = 0;
    if (fuOK) { score += 2; sub.push({ plain: '这处宅的根基旺——住得安、守得久', tech: '父爻旺相', q: '父旺持世此處淸安宜久住', src: '增删卜易' }); }
    if (shiOK) score += 1;
    if (he) { score += 1; sub.push({ plain: '这一卦上下相合,这桩事有始有终——能成,而且成了顺', tech: '六合卦', q: '爻逢六合終見享通', src: '增删卜易' }); }
    if (chong) { score -= 2; sub.push({ plain: '这一卦上下对冲,住不长久——就算成了,也是过渡的住处,别按安家的钱砸进去', tech: '六冲卦', q: '但不喜其六沖六沖不久之象', src: '增删卜易' }); }
    if (fanYin) { score -= 2; sub.push({ plain: '这一卦是走回头路的样子——买了要反悔、住了多愁叹,这处不合适', tech: '卦反吟', q: '卦遇反吟多於愁嘆', src: '增删卜易' }); }
    if (caiMoving && !fuOK) { score -= 1; sub.push({ plain: '钱那股力正冲着宅的根基——这处别定,另寻别处更合适', tech: '财动克父', q: '財爻發動他方仁里另宜求', src: '增删卜易' }); }
    if (shiBian && shiBian.jinTui === '进神') { score += 1; sub.push({ plain: '越住越兴,置业能一处变几处', tech: '世化进神', q: '世動而化進綿長百代', src: '增删卜易' }); }
    if (shiBian && shiBian.jinTui === '退神') { score -= 1; sub.push({ plain: '勉强成了也会退掉——成后生悔,这处别勉强', tech: '世化退神', q: '世動化退勉彊成之終須退悔', src: '增删卜易' }); }
    if (shi.power && shi.power.ruMu && shi.liuQin === '官鬼') { score -= 3; sub.push({ plain: '这一卦最忌的样子出现了——这处不要,换,不商量', tech: '世随鬼入墓', q: '最忌隨官入墓須防鬼動傷身', src: '增删卜易' }); }
    if ((shi.kong || (shi.power && shi.power.yuePo)) || fuLines.every(l => l.kong || (l.power && l.power.yuePo))) {
      score -= 2; sub.push({ plain: '人或宅的根基是虚的——这一步先不迈', tech: '世/父空破', q: '父動克世及世爻父爻空破墓絕者亦不宜行', src: '增删卜易' });
    }
    const verdict = score >= 2 ? '这处可以定。人宅两旺、根基立得住——按野鹤的规矩,这样的就该成'
      : score <= -2 ? '这处不要。卦面明说不宜行——钱留着,另寻'
      : '成是成得了,但成色一般——比着别处再看一眼,不抢';
    return { verdict, vq: { q: '凡蓋造買宅賃宅世與父爻旺相不犯沖克者卽宜成之', src: '增删卜易' }, sub,
      note: '盖造、买宅、租宅同法(原文一章并论)。问一家人各自吉凶要分占——入宅那一型专办这个。' };
  }

  // 三、迁居比较(弃旧换新):内三爻旧宅、外三爻新房
  function qian(z) {
    const inWx = z.lines.slice(0, 3), outWx = z.lines.slice(3, 6);
    const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }, SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    let ke = 0, sheng = 0;
    for (const a of inWx) for (const b of outWx) { if (KE[a.wx] === b.wx) ke++; if (SHENG[a.wx] === b.wx) sheng++; }
    let verdict, vq;
    if (ke > sheng) { verdict = '别迁。旧压新,新处立不起来——这回搬不如不搬'; vq = { q: '內克外者外宅不利不宜遷之', src: '增删卜易·遷居過火章第一百零九' }; }
    else if (sheng > ke) { verdict = '迁。旧养新,新处兴隆——这一步走得'; vq = { q: '內生外者外宅興隆過遷爲吉', src: '增删卜易·遷居過火章第一百零九' }; }
    else { verdict = '新旧两处不分高下——这卦定不了去留,拿要搬的那处单独占一卦(按「买房盖房」那一型)再定'; vq = { q: '內克外者外宅不利不宜遷之內生外者外宅興隆過遷爲吉', src: '增删卜易·遷居過火章第一百零九' }; }
    return { verdict, vq, sub: [],
      note: '野鹤自注:此法用在「要不要弃旧换新」的比较上才合适——宅已买定只问入伙,用「入宅择日」那一型。' };
  }

  // 四、入宅择日(六亲分占 + 克制之法)
  function ru(z, qin) {
    const map = { 父母: '父母', 兄弟: '兄弟', 妻儿: '妻财' };
    const yq = map[qin] || '父母';
    const yong = z.lines.find(l => l.liuQin === yq && (!l.kong)) || z.lines.find(l => l.liuQin === yq);
    const sub = [];
    if (!yong) return { verdict: `这一卦${qin}那一头的爻没露面,断不了他的吉凶——换个时辰再占,别硬断`, vq: { q: '占父母父母宜於旺相', src: '增删卜易·入宅六親凶吉章第一百十一' }, sub, note: '' };
    const b = bianOf(z, yong.pos);
    const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const hurtMoving = z.lines.find(l => l.moving && l !== yong && KE[l.wx] === yong.wx);
    const bad = (yong.power && yong.power.score < 0) || (b && (b.huiTou === '回头克' || /鬼/.test(b.toLiuQin || ''))) || hurtMoving;
    let verdict, vq;
    if (!bad) { verdict = `这天入宅,${qin}这一头稳——用得`; vq = { q: '占父母父母宜於旺相占兄弟妻兒皆宜旺相而遇生扶', src: '增删卜易·入宅六親凶吉章第一百十一' }; }
    else {
      verdict = `这天入宅,${qin}这一头受冲撞——按书上的克制之法办,不必硬改日子`;
      vq = { q: '不宜變動而化鬼及刑沖克害', src: '增删卜易·入宅六親凶吉章第一百十一' };
      if (hurtMoving) {
        const jueZhi = JUE[hurtMoving.wx];
        const anFang = (Dili.ZHI_DIR && Dili.ZHI_DIR[CHANGSHENG[yong.wx]]) || '';
        sub.push({ plain: `挑克得住那股冲撞的时辰进门:${jueZhi}时(那股力到${jueZhi}就绝);${qin}的床榻安在${anFang}一带(他那一头之力最生发的方位)`,
          tech: `忌神${hurtMoving.zhi}(${hurtMoving.wx})绝于${jueZhi};用神${yong.wx}长生于${CHANGSHENG[yong.wx]}`,
          q: '凡六親所犯之神令之趨避無一不驗', src: '增删卜易·入宅六親凶吉章第一百十一' });
      }
    }
    return { verdict, vq, sub, note: '入宅按亲分占:父母一卦、兄弟一卦、妻儿一卦,哪一卦不利就按克制之法避,或另择一时进门——原文教的就是改时不改日也行。' };
  }

  // 五、修方动土
  function xiu(z) {
    const sub = [], shi = shiLine(z);
    const zisun = z.lines.find(l => l.liuQin === '子孙');
    const gui = guiLines(z);
    let verdict, vq;
    if (shi.liuQin === '子孙') { verdict = '动得。福神当家,这土动了是添福的'; vq = { q: '世臨福德最相宜', src: '增删卜易·修方動土章第一百零八' }; }
    else if (gui.some(l => l.moving)) { verdict = '缓一缓。祸根之力在动,这时动土招事'; vq = { q: '官鬼交重有禍基', src: '增删卜易·修方動土章第一百零八' }; }
    else if (shi.power && shi.power.score > 0) { verdict = '动得。你自己这头旺相有生扶,开工无碍'; vq = { q: '世旺逢生宜化吉', src: '增删卜易·修方動土章第一百零八' }; }
    else { verdict = '先停。你自己这头衰而受克,这一阵不宜开工'; vq = { q: '世衰受克且停工', src: '增删卜易·修方動土章第一百零八' }; }
    if (zisun && Dili.ZHI_DIR) sub.push({ plain: `起手的方位挑${Dili.ZHI_DIR[zisun.zhi]}(福神所在那一头)`, tech: `子孙临${zisun.zhi}`, q: '子孫之方宜起手', src: '增删卜易·修方動土章第一百零八' });
    for (const g of gui) {
      if (Dili.ZHI_DIR) sub.push({ plain: `${Dili.ZHI_DIR[g.zhi]}那一头别动土${'辰戌丑未'.includes(g.zhi) ? '——祸根正落在土位上,这一条书上单独点了名' : ''}`,
        tech: `官鬼临${g.zhi}`, q: '辰戌丑未'.includes(g.zhi) ? '鬼在辰戌丑未此方切忌動土' : '官鬼之位莫挑泥', src: '增删卜易·修方動土章第一百零八' });
    }
    return { verdict, vq, sub, note: '修方动土问的是「动不动、往哪动」;盖成之后房子本身如何,按「买房盖房」那一型另占。' };
  }

  // 六、看地/形势(世为穴;六神配山水路田;形势归形势、吉凶归世爻)
  function di(z) {
    const sub = [], shi = shiLine(z);
    const chong = liuChong(z), he = liuHeGua(z);
    const shiBian = bianOf(z, shi.pos);
    let verdict, vq;
    const shiOK = shi.power && shi.power.score > 0;
    if (he && shiOK) { verdict = '好地。藏风聚气、穴位有力——这样的地书上叫代代兴隆'; vq = { q: '三合六合聚气藏風', src: '增删卜易·尋地章第一百十九' }; }
    else if (chong) { verdict = '不是聚气之地。六冲飞砂走石,散——不必再看'; vq = { q: '世沖六沖飛砂走石', src: '增删卜易·尋地章第一百十九' }; }
    else if (shiOK) { verdict = '地可用。穴位旺相立得住,虽不是上上之格,守得住'; vq = { q: '所驗者世爲穴也世宜旺相或臨日月或日月動爻生扶乃吉地也', src: '增删卜易·尋地章第一百十九' }; }
    else { verdict = '地气弱。穴位衰而无扶——这处不取'; vq = { q: '世宜旺相或臨日月或日月動爻生扶乃吉地也', src: '增删卜易·尋地章第一百十九' }; }
    if (shiOK && shiBian && (shiBian.huaPo || shiBian.huaMu)) sub.push({
      plain: '眼下看着好,里头藏着毛病——定之前把看不见的那一层(产权、地质、水路)查透', tech: '世旺化破', q: '世旺而化絕破吉處藏凶', src: '增删卜易·尋地章第一百十九' });
    if (!shiOK && shiBian && shiBian.huiTou === '回头生') sub.push({
      plain: '眼下不起眼,往后是旺处——这样的地便宜时候拿', tech: '世衰化回头生', q: '世衰而化生合凶中有吉', src: '增删卜易·尋地章第一百十九' });
    // 形势层(占地形勢章):六神配位,只报形势不断吉凶——原文自己划的界
    const SHEN_POS = { 青龙: '左边一带', 白虎: '右边一带', 朱雀: '前方', 玄武: '后方', 螣蛇: '路径', 勾陈: '田地平坡' };
    for (const L of z.lines) {
      const p = SHEN_POS[L.liuShen];
      if (!p || !L.power) continue;
      if (L.liuShen === '白虎') { if (L.power.score < 0) sub.push({ plain: '右边低伏收敛——这一位书上要的就是收', tech: '虎衰', q: '虎山宜衰宜克爪牙埋伏', src: '增删卜易·占地形勢章第一百二十' }); }
      else if (L.power.score > 0 && (L.liuShen === '青龙' || L.liuShen === '玄武')) sub.push({ plain: `${p}有靠有势`, tech: `${L.liuShen}旺`, q: L.liuShen === '青龙' ? '靑龍宜旺扶頭角軒昂' : '元武逢破散後脈空虛', src: '增删卜易·占地形勢章第一百二十' });
      else if (L.power.score < -1 && L.liuShen === '玄武') sub.push({ plain: '后方空虚没靠山', tech: '玄武破', q: '元武逢破散後脈空虛', src: '增删卜易·占地形勢章第一百二十' });
    }
    const top = z.lines[5];
    if (top.kong || (top.power && top.power.yuePo)) sub.push({ plain: '出水那一头不收口——水路、排水、财口都散,这是这块地明着的短处', tech: '上爻空破', q: '第六爻爲上爻若逢空破水口不固', src: '增删卜易·占地形勢章第一百二十' });
    return { verdict, vq, sub,
      note: '形势归形势、吉凶归穴位——原文自己划的界:「此乃占地穴之形勢耳非關吉凶禍福」。问葬后功名财禄,各按各章分占,别拿这一卦兼断。' };
  }

  const TYPES = {
    jiu: { name: '现住的宅(指着疑处问)', fn: jiu },
    mai: { name: '买房 / 盖房 / 租房', fn: mai },
    qian: { name: '要不要弃旧换新', fn: qian },
    ru: { name: '入宅择日(按亲分占)', fn: ru },
    xiu: { name: '修方动土', fn: xiu },
    di: { name: '看地 / 形势', fn: di },
  };

  function judge(type, cast, opts) {
    const t = TYPES[type];
    if (!t) return null;
    const z = zGua(cast, opts && opts.date);
    const r = t.fn(z, opts && opts.qin);
    r.type = type; r.typeName = t.name;
    return r;
  }

  function material(type, cast, opts) {
    const r = judge(type, cast, opts);
    if (!r) return '';
    let s = `【占宅·程序初断(${r.typeName};已算死,勿另立结论)】\n${r.verdict}\n(书上凭据:「${r.vq.q}」《${r.vq.src}》)\n`;
    for (const x of r.sub) s += `— ${x.plain}${x.tech ? `(推演:${x.tech})` : ''}(原话「${x.q}」)\n`;
    if (r.note) s += r.note + '\n';
    s += '【写法铁规】①依卦有据,卦面没照到的写「此卦未及此节」;②不推荐任何花钱的东西——' +
      '原文那条要买物件的送法只可注明「原文另载,本程序不荐」;③禁空话禁说教,第一句就是答案;' +
      '④凶就报凶:该说「这处不要」就说,不打圆场。';
    return s;
  }

  return { judge, material, TYPES, GUI_ZHI, GUI_SHEN };
}));
