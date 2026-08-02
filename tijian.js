// tijian.js — 断语体检员:拿机器查稿子,把「解读质量」纳入可测范围
//
// 缘起(CLAUDE.md 待办第 8 条):本程序有一半的字是大模型写的,而铁律一到八管的正是这些字——
// 零说教、先答案后凭据、禁空话、术语不上稿、不推荐花钱消灾、不比卦面乐观悲观半分。
// 在此之前,这些铁律**只写在提示词里,没有任何一处在稿子出来之后回头查过**。
// 模型不听话时,程序不知道;测试也只能零零星星地断言几个词。
//
// 更要命的是「一个口径一处算」这条(§四)被破得很彻底:实测同一类禁词散在九处以上,
// 而且内容互不相同——
//   index.html:1802 的车轱辘话清单有 12 个词;同文件 1828 行那份只有 9 个,还多出「综上所述」;
//   yunshi.html:678 那份是 9 个;tests/dashi.test.mjs:109 的数组 9 个;tests/wenji.test.mjs:129 只有 7 个;
//   tests/chuduan.test.mjs:117、tests/design.test.mjs:310、tests/e2e.mjs:742/1010/1032 各写各的正则。
// 于是「哪些话算空话」这件事,程序里有九个互相冲突的答案。本模块把它收成一处:
//   **提示词里的禁令与测试里的断言,从此取同一份表。**
//
// 边界(不许假装没有):
//   · 这是**内部一致性**工具,不是「解读准不准」的裁判。它能判「这句话是不是空话」,
//     判不了「这个断语对不对」——后者要靠事件层回测,那是另一回事。
//   · 它只做确定性规则,不调模型。调模型查模型,查出来的东西没法钉成测试。
//   · 具体度的门槛是本项目自定的,不是行业标准。数字都摆出来,可以吵。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Tijian = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  // ————————————————————————————————————————————————
  //  一、词表:唯一出处
  //  每一类都写清「凭哪条铁律」,免得日后有人往里加自己不喜欢的词。
  // ————————————————————————————————————————————————
  const RULES = {
    // 铁律三:禁空话。车轱辘话——放到随便谁身上都成立的句子。
    空话: {
      law: '铁律三·禁空话',
      say: '车轱辘话:放谁身上都成立的句子',
      words: [
        '机遇与挑战并存', '机遇与挑战', '有得有失', '顺其自然', '保持平常心', '平常心',
        '谋事在人成事在天', '一切皆有可能', '时间会证明', '静观其变', '随缘',
        '心态最重要', '摆正心态', '调整心态', '保持乐观', '多沟通多包容', '凡事有两面',
        '仅供参考', '因人而异', '总的来说', '综上所述', '视情况而定', '还得看你自己',
        '还得看个人', '希望对你有帮助', '保持耐心', '顺势而为',
      ],
    },
    // 铁律一:零说教。不讲道理、不劝人、不灌鸡汤。
    说教: {
      law: '铁律一·零说教',
      say: '说教与鸡汤:讲道理、劝人、灌心灵鸡汤',
      words: [
        '你要明白', '你要知道', '你要学会', '要学会', '你应该明白', '请记住', '要记住',
        '与其不如', '人生就是', '生活就是', '命运掌握在', '相信自己', '加油',
        '不忘初心', '心怀感恩', '珍惜眼前', '放下执念', '看开一点', '想开一点',
      ],
      // 「与其…不如…」这类跨字句式单列(词表匹配不到,得用正则)
      res: [/与其[^。;!?]{0,12}不如/, /人生(在世|苦短|如)/, /学会[^。;!?]{0,6}(放下|接受|感恩|知足)/],
    },
    // 铁律五:不推荐花钱消灾。任何情况下不松口。
    花钱消灾: {
      law: '铁律五·不推荐花钱消灾',
      say: '推荐花钱消灾、开光、请购法物、付费化解',
      words: ['开光', '请购', '请一尊', '请个法器', '法器', '供奉', '结缘价', '付费化解', '花钱消灾', '捐功德', '添香油'],
      res: [/请[一个]?[尊串条块]/, /买[一个]?[串块]?(手串|吊坠|貔貅|符)/],
    },
    // 铁律八:术语不上稿。只在推演时用,写给客人看的成稿里一个都不许出现。
    // 留神:这里只收**多字专名**,不收「喜」「忌」「爻」这类单字——单字误伤太多(喜事、忌口)。
    术语: {
      law: '铁律八·术语不上稿',
      say: '推演用的名目漏进了给客人看的成稿',
      words: [
        '用神', '世应', '世爻', '应爻', '旬空', '十神', '喜用神', '忌神', '喜忌',
        '天干', '地支', '干支', '日主', '日柱', '月柱', '年柱', '时柱', '月令', '支藏', '藏干',
        '比肩', '劫财', '食神', '伤官', '正财', '偏财', '正官', '七杀', '正印', '偏印', '枭神',
        // 五类归口名(bazi.SHISHEN_CLASS 的值)——v0.99 补:十神收了,归口名却漏着,
        // 于是 mingge 的叙事一路把「官杀」「比劫」「财星」印到客人眼前,三个版本没人查。
        // 与 v0.81「身旺」那次同一类漏洞:表要么全在,要么全不在。
        '官杀', '比劫', '财星', '印星', '食伤',
        '旺相休囚', '旺衰', '调候', '动宫', '伏吟', '反吟', '天克地冲', '岁运', '纳甲', '六亲',
        // BANDS 五档要么全在表上、要么全不在——原先只收了「身强/身弱」,
        // 于是「身旺」(bazi.js 里真正在用的那个值)一路漏到界面上没人查(v0.81 补)。
        '身旺', '偏旺', '偏弱',
        '月破', '进神', '退神', '飞神', '伏神', '三合局', '六合局', '空亡', '身强', '身弱',
      ],
    },
    // §十一(2026-08-02 用户原话):「你很想凹一个直白通俗接地气的风格…接地气不是用在用词上的,
    // 是用在解读水平上的。」——接地气是判断的具体与准确,不是把话说得市井。
    // 这一类收的是**凹出来的绰号式比喻**:拿俏皮话代替本体、代替内容。词表按全应用扫出的实例收录,
    // 清一个收一个,不许再回来(v0.99 起)。「明面/底下」这对已向用户解释过的定名不在此列。
    装腔: {
      law: '§十一·接地气在水平不在用词',
      say: '凹出来的市井腔:拿绰号代替本体、拿俏皮话代替内容',
      words: [
        '那一汪', '那一摊', '这一摊', '那股力', '这股劲', '那股劲', '这摊儿', '那头儿', '这档子',
        '泄压口', '递梯子', '掀桌', '钱认你', '闷声攒', '跑码头', '双押', '下重注', '轮流喂',
      ],
    },
    // 铁律二:先答案后凭据。段首铺垫句一律算废稿。
    铺垫: {
      law: '铁律二·先答案后凭据',
      say: '段首拿铺垫句开头,没把结论摆在第一句',
      res: [
        /^[\s　]*(首先|其次|接下来|然后|最后)/,
        /^[\s　]*(在[^。;!?]{2,20}的情况下|从[^。;!?]{2,20}来看|就[^。;!?]{2,20}而言)[,,]/,
        /^[\s　]*(关于|至于|说到)[^。;!?]{0,10}[,,]/,
      ],
      perLine: true,   // 这一类逐段查段首,不查全文
    },
    // 铁律三的另一面:把握度必须说死,不许模棱。
    模棱: {
      law: '铁律三·把握度用「几成」说死',
      say: '模棱两可、把决定推回给客人',
      words: ['可能吧', '也许吧', '不好说', '很难讲', '建议你', '你可以考虑', '你不妨', '看你自己怎么想'],
    },
  };

  const KINDS = Object.keys(RULES);
  const FATAL = ['空话', '说教', '花钱消灾', '术语', '模棱'];   // 违反即废稿
  const WARN = ['铺垫'];                                        // 扣分不废稿

  // ————————————————————————————————————————————————
  //  二、合法的例外:先把这些挖掉再查
  //  引文、卦名、宫名、书名——它们本来就该出现在稿子里,不是术语泄漏。
  // ————————————————————————————————————————————————
  const GUA64 = ('乾坤屯蒙需讼师比小畜履泰否同人大有谦豫随蛊临观噬嗑贲剥复无妄大畜颐大过坎离' +
    '咸恒遯大壮晋明夷家人睽蹇解损益夬姤萃升困井革鼎震艮渐归妹丰旅巽兑涣节中孚小过既济未济');
  // 剥掉:①「…」『…』里的引文 ②《…》书名 ③(…)里的注 ④ 明确标了「原话」「书上说」的整句
  function stripQuoted(text) {
    return String(text || '')
      .replace(/[「『][^」』]*[」』]/g, '　')
      .replace(/《[^》]*》/g, '　')
      .replace(/[""][^""]*[""]/g, '　');
  }

  // ————————————————————————————————————————————————
  //  三、具体度:只用确定性规则,不调模型
  //  三个可数的东西——数字、时间、动作。门槛是本项目自定的,写死在这里,可以吵。
  // ————————————————————————————————————————————————
  // 留神:数字要按「一个数」计,不按「一个字」计——'2026' 是一个数不是四个,
  //       否则一句「2026年」就凑出四分具体度,门槛形同虚设(第一版就栽在这)。
  const RE_NUM = /\d+(\.\d+)?|[一二三四五六七八九十百千万两]{1,3}\s*[成年月日天岁个万元块人次倍]|几成/g;
  const RE_TIME = /\d{4}年|\d{1,2}月|\d{1,2}[日号]|[上中下]旬|本周|下周|这个月|下个月|年底|年初|开春|入秋|[子丑寅卯辰巳午未申酉戌亥]时/g;
  const RE_ACT = /(签|谈|递|投|问|找|约|搬|挪|停|撤|退|加|减|存|还|买|卖|办|报|考|走|避|绕|开口|摊开|定下来|拖过|压过|先|别|不要|少)/g;

  function countAll(text, re) {
    const m = String(text).match(new RegExp(re.source, re.flags.replace('g', '') + 'g'));
    return m ? m.length : 0;
  }

  // ————————————————————————————————————————————————
  //  四、与程序数据是否矛盾
  //  只判**确实判得了**的四类;判不了的照实列在 undecidable 里,不许装作查过。
  // ————————————————————————————————————————————————
  // 正反两组要互斥,否则「这事成不了」会同时命中两边、互相抵消(第一版就栽在这:
  // CHENG_POS 里的「这事成」把「这事成不了」也吃了,于是与程序打架的稿子被判成干净)。
  const CHENG_POS = /(能成(?!不)|可成|成得了|这事成(?![不无])|办得成|走得通|成算不小|多半能)/;
  const CHENG_NEG = /(不成(?!问题)|成不了|办不成|走不通|没戏|白搭|别耗|成算不大)/;
  const WX = ['木', '火', '土', '金', '水'];

  function checkFacts(text, facts) {
    const hits = [], undecidable = [];
    if (!facts) return { hits, undecidable: ['没传程序算出的事实进来,这一层没查'] };
    const t = String(text);

    // ① 成不成:程序说成,稿子却说不成(或反过来)
    if (facts.cheng === '成' && CHENG_NEG.test(t) && !CHENG_POS.test(t)) {
      hits.push({ kind: '矛盾', rule: '成算', why: `程序断「${facts.cheng}」,稿子却写成不了`, snippet: (t.match(CHENG_NEG) || [''])[0] });
    }
    if (facts.cheng === '不成' && CHENG_POS.test(t) && !CHENG_NEG.test(t)) {
      hits.push({ kind: '矛盾', rule: '成算', why: `程序断「${facts.cheng}」,稿子却写能成`, snippet: (t.match(CHENG_POS) || [''])[0] });
    }
    // ② 几成:稿子给的成数与程序给的差两成以上
    if (facts.pct) {
      const want = pctNum(facts.pct);
      const got = [...t.matchAll(/([一二三四五六七八九十两]|\d{1,2})\s*成/g)].map(m => pctNum(m[1] + '成')).filter(x => x != null);
      const bad = got.filter(x => want != null && Math.abs(x - want) >= 2);
      if (bad.length) hits.push({ kind: '矛盾', rule: '几成', why: `程序给「${facts.pct}」,稿子写了 ${bad.map(x => x + '成').join('、')}`, snippet: facts.pct });
    }
    // ③ 旺你的五行:稿子说旺你的是 X,而 X 在程序的忌神里
    if (facts.jiWx && facts.jiWx.length) {
      for (const w of facts.jiWx) {
        const re = new RegExp('(旺你的|帮你的|你的药|对你有利的)[^。;!?]{0,12}' + w);
        if (re.test(t)) hits.push({ kind: '矛盾', rule: '喜忌', why: `程序把${w}算作耗你的,稿子却说它旺你`, snippet: w });
      }
    }
    // ④ 姻缘方向留白(v0.77):程序不表态时,稿子不许自己补一个吉凶
    if (facts.held) {
      const re = /(感情|姻缘|婚姻)[^。;!?]{0,10}(大吉|必成|一定[能会]|必有波折|注定|铁定)/;
      if (re.test(t)) hits.push({ kind: '矛盾', rule: '方向留白', why: '程序对这一类不表态方向,稿子却自己下了吉凶断语', snippet: (t.match(re) || [''])[0] });
    }

    // 判不了的,照实说
    undecidable.push('应期的具体日子:稿子里的日期与程序给的日期能不能对上,要看它指的是不是同一件事,机器分不清');
    undecidable.push('断语与卦面的轻重是否相称(铁律七):这要读懂卦,不是数词能办的');
    return { hits, undecidable };
  }
  const CN = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function pctNum(s) {
    const m = String(s).match(/([一二三四五六七八九十两]|\d{1,2})\s*成/);
    if (!m) return null;
    return /\d/.test(m[1]) ? Number(m[1]) : CN[m[1]];
  }

  // ————————————————————————————————————————————————
  //  五、体检主函数
  // ————————————————————————————————————————————————
  // text : 要查的稿子
  // opts : { zone: '断语'|'专业'(专业区放行术语), facts: {...}, minChars: 60 }
  function check(text, opts) {
    opts = opts || {};
    const zone = opts.zone || '断语';
    const raw = String(text || '');
    const body = stripQuoted(raw);           // 引文与书名先挖掉,免得误伤
    const hits = [];

    for (const kind of KINDS) {
      if (kind === '术语' && zone === '专业') continue;   // 专业区本来就该说术语
      const R = RULES[kind];
      if (R.perLine) {
        const lines = raw.split(/\n+/).map(x => x.trim()).filter(x => x.length > 8);
        for (const ln of lines) for (const re of (R.res || [])) {
          if (re.test(ln)) hits.push({ kind, rule: R.law, why: R.say, snippet: ln.slice(0, 18) });
        }
        continue;
      }
      // 长词优先、短词不重复计:「保持平常心」命中之后,「平常心」不该再算一处,
      // 否则一句话能刷出三四条,分数与条数都失真(第一版就栽在这)。
      const covered = [];
      const taken = (a, b) => covered.some(([x, y]) => a >= x && b <= y);
      const words = (R.words || []).slice().sort((a, b) => b.length - a.length);
      for (const w of words) {
        let i = body.indexOf(w);
        while (i >= 0) {
          if (!taken(i, i + w.length)) {
            covered.push([i, i + w.length]);
            hits.push({ kind, rule: R.law, why: R.say, snippet: w, at: i });
          }
          i = body.indexOf(w, i + w.length);
        }
      }
      for (const re of (R.res || [])) {
        const m = body.match(re);
        if (m && m.index != null && !taken(m.index, m.index + m[0].length)) {
          covered.push([m.index, m.index + m[0].length]);
          hits.push({ kind, rule: R.law, why: R.say, snippet: m[0], at: m.index });
        }
      }
    }

    // 复读:同一句话(去标点、≥8 字)出现两遍
    const sents = raw.split(/[。!?;\n]+/).map(x => x.replace(/[\s,,、::「」()()]/g, '')).filter(x => x.length >= 8);
    const seen = {};
    for (const s of sents) { if (seen[s]) hits.push({ kind: '复读', rule: '字数靠新信息堆,不靠复读', why: '同一句话说了两遍', snippet: s.slice(0, 16) }); seen[s] = 1; }

    // 具体度
    const chars = raw.replace(/\s/g, '').length;
    const stats = {
      chars,
      nums: countAll(raw, RE_NUM),
      times: countAll(raw, RE_TIME),
      acts: countAll(raw, RE_ACT),
      sents: sents.length,
    };
    stats.numPer100 = chars ? +(stats.nums / chars * 100).toFixed(1) : 0;
    stats.timePer100 = chars ? +(stats.times / chars * 100).toFixed(1) : 0;
    // 门槛:本项目自定。每百字至少一个数字、整篇至少一处落到时间、至少三个可照做的动作。
    const thin = [];
    if (chars >= (opts.minChars || 60)) {
      if (stats.numPer100 < 1) thin.push(`每百字只有 ${stats.numPer100} 个数字(要 ≥1)`);
      if (stats.times === 0) thin.push('全篇没有一处落到具体时间');
      if (stats.acts < 3) thin.push(`能照着做的动作只有 ${stats.acts} 处(要 ≥3)`);
    }
    for (const w of thin) hits.push({ kind: '不具体', rule: '铁律三·做法具体到动作与时间', why: w, snippet: '' });

    // 与程序数据对账
    const fx = checkFacts(raw, opts.facts);
    hits.push(...fx.hits);

    const fatal = hits.filter(h => FATAL.includes(h.kind) || h.kind === '矛盾');
    // 扣分:铁律级每条 −12,其余每条 −4,下限 0
    const score = Math.max(0, 100 - fatal.length * 12 - (hits.length - fatal.length) * 4);
    return {
      pass: fatal.length === 0,
      score, hits, fatal, stats,
      undecidable: fx.undecidable,
      zone,
      summary: fatal.length
        ? `废稿:${[...new Set(fatal.map(h => h.kind))].join('、')}共 ${fatal.length} 处`
        : (hits.length ? `可用,但有 ${hits.length} 处要收拾(${[...new Set(hits.map(h => h.kind))].join('、')})` : '干净'),
    };
  }

  // ————————————————————————————————————————————————
  //  六、给提示词用的禁令句:提示词与检查器取同一份表(§四 一处算)
  // ————————————————————————————————————————————————
  function banLine(kinds) {
    const ks = kinds && kinds.length ? kinds : ['空话', '说教', '花钱消灾', '模棱'];
    return ks.map(k => `【${k}·${RULES[k].say}】禁用:${(RULES[k].words || []).join('/')}`).join(';');
  }
  // 把体检结果折成一句能直接甩回给模型的话
  function rewriteHint(res) {
    if (!res || res.pass) return '';
    const by = {};
    for (const h of res.fatal) (by[h.kind] = by[h.kind] || []).push(h.snippet);
    return '上一稿不合格,按这几条重写(其余不动):' +
      Object.keys(by).map(k => `${k}——「${[...new Set(by[k])].slice(0, 6).join('」「')}」这些一个都不许出现`).join(';') +
      '。把握度用「几成」说死,做法落到动作与时间。';
  }

  return { check, banLine, rewriteHint, RULES, KINDS, FATAL, WARN, GUA64, stripQuoted };
}));
