// dili.js — 地利:方位合命选旺地(子平迁徙择向法)
// 法理:喜用神五行配后天八方(东/东南=木,南=火,西南/东北=土,西/西北=金,北=水),
//      以现居地为原点算目标地的真方位角落卦位,五行入喜用则旺、入忌神则背。
//      内置全国省级行政区(以省会坐标为锚)与主要城市坐标,方位角实算,不含糊。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Dili = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  // [名称, 纬度, 经度, 省级?]  省级条目用省会坐标为锚
  const PLACES = [
    ['北京', 39.9, 116.4, 1], ['天津', 39.1, 117.2, 1], ['河北', 38.0, 114.5, 1], ['石家庄', 38.0, 114.5, 0],
    ['山西', 37.9, 112.5, 1], ['太原', 37.9, 112.5, 0], ['内蒙古', 40.8, 111.7, 1], ['呼和浩特', 40.8, 111.7, 0],
    ['辽宁', 41.8, 123.4, 1], ['沈阳', 41.8, 123.4, 0], ['大连', 38.9, 121.6, 0],
    ['吉林', 43.9, 125.3, 1], ['长春', 43.9, 125.3, 0], ['黑龙江', 45.8, 126.5, 1], ['哈尔滨', 45.8, 126.5, 0],
    ['上海', 31.2, 121.5, 1], ['江苏', 32.1, 118.8, 1], ['南京', 32.1, 118.8, 0], ['苏州', 31.3, 120.6, 0], ['无锡', 31.6, 120.3, 0], ['徐州', 34.3, 117.2, 0],
    ['浙江', 30.3, 120.2, 1], ['杭州', 30.3, 120.2, 0], ['宁波', 29.9, 121.6, 0], ['温州', 28.0, 120.7, 0],
    ['安徽', 31.8, 117.2, 1], ['合肥', 31.8, 117.2, 0], ['福建', 26.1, 119.3, 1], ['福州', 26.1, 119.3, 0], ['厦门', 24.5, 118.1, 0],
    ['江西', 28.7, 115.9, 1], ['南昌', 28.7, 115.9, 0], ['山东', 36.7, 117.0, 1], ['济南', 36.7, 117.0, 0], ['青岛', 36.1, 120.4, 0], ['烟台', 37.5, 121.4, 0],
    ['河南', 34.7, 113.6, 1], ['郑州', 34.7, 113.6, 0], ['洛阳', 34.6, 112.5, 0],
    ['湖北', 30.6, 114.3, 1], ['武汉', 30.6, 114.3, 0], ['湖南', 28.2, 112.9, 1], ['长沙', 28.2, 112.9, 0],
    ['广东', 23.1, 113.3, 1], ['广州', 23.1, 113.3, 0], ['深圳', 22.5, 114.1, 0], ['佛山', 23.0, 113.1, 0], ['东莞', 23.0, 113.8, 0], ['珠海', 22.3, 113.6, 0],
    ['广西', 22.8, 108.3, 1], ['南宁', 22.8, 108.3, 0], ['桂林', 25.3, 110.3, 0],
    ['海南', 20.0, 110.3, 1], ['海口', 20.0, 110.3, 0], ['三亚', 18.3, 109.5, 0],
    ['重庆', 29.6, 106.5, 1], ['四川', 30.7, 104.1, 1], ['成都', 30.7, 104.1, 0],
    ['贵州', 26.6, 106.6, 1], ['贵阳', 26.6, 106.6, 0], ['云南', 25.0, 102.7, 1], ['昆明', 25.0, 102.7, 0],
    ['西藏', 29.7, 91.1, 1], ['拉萨', 29.7, 91.1, 0], ['陕西', 34.3, 108.9, 1], ['西安', 34.3, 108.9, 0],
    ['甘肃', 36.1, 103.8, 1], ['兰州', 36.1, 103.8, 0], ['青海', 36.6, 101.8, 1], ['西宁', 36.6, 101.8, 0],
    ['宁夏', 38.5, 106.2, 1], ['银川', 38.5, 106.2, 0], ['新疆', 43.8, 87.6, 1], ['乌鲁木齐', 43.8, 87.6, 0],
    ['台湾', 25.0, 121.5, 1], ['台北', 25.0, 121.5, 0], ['香港', 22.3, 114.2, 1], ['澳门', 22.2, 113.5, 1],
  ];
  const rad = Math.PI / 180;
  function find(name) {
    const t = String(name || '').trim().replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
    if (!t) return null;
    return PLACES.find(p => p[0] === t) || PLACES.find(p => t.includes(p[0]) || p[0].includes(t)) || null;
  }
  // 方位角(自北顺时针)与球面距离
  function bearing(a, b) {
    const φ1 = a[1] * rad, φ2 = b[1] * rad, Δλ = (b[2] - a[2]) * rad;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) / rad) + 360) % 360;
  }
  function distKm(a, b) {
    const φ1 = a[1] * rad, φ2 = b[1] * rad, Δφ = (b[1] - a[1]) * rad, Δλ = (b[2] - a[2]) * rad;
    const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }
  const DIRS = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
  const DIR_WX = { 正东: '木', 东南: '木', 正南: '火', 西南: '土', 正西: '金', 西北: '金', 正北: '水', 东北: '土' };
  const dirOf = deg => DIRS[Math.round(deg / 45) % 8];
  const WX_DIRS = { 木: ['正东', '东南'], 火: ['正南'], 土: ['西南', '东北'], 金: ['正西', '西北'], 水: ['正北'] };

  // 验一地:chart 只需 yong.xiWx / yong.jiWx(Bazi.chart 产物即可)
  function judge(chart, fromName, toName) {
    const a = find(fromName), b = find(toName);
    if (!a) return { err: `不认识「${fromName}」——写省份或大城市名` };
    if (!b) return { err: `不认识「${toName}」——写省份或大城市名` };
    const km = distKm(a, b);
    if (km < 80) {
      return { from: a[0], to: b[0], km, local: true,
        verdict: '本地', note: '两地不足八十公里,方位之力不显——同城之内看宅运门向,不看省域方位。' };
    }
    const deg = bearing(a, b);
    const dir = dirOf(deg);
    const wx = DIR_WX[dir];
    const xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    let verdict, score, note;
    if (wx === xi[0]) { verdict = '大旺'; score = 2; note = `${dir}属${wx},正是你第一喜用——往这走,如鱼得水`; }
    else if (xi.includes(wx)) { verdict = '旺'; score = 1; note = `${dir}属${wx},在你喜用之列——去得,有助力`; }
    else if (wx === ji[0]) { verdict = '背'; score = -2; note = `${dir}属${wx},正犯你头号忌神——能不去就不去,非去不可则须旺宅化解`; }
    else if (ji.includes(wx)) { verdict = '偏背'; score = -1; note = `${dir}属${wx},在你忌神之列——不添力,反耗你`; }
    else { verdict = '平', score = 0, note = `${dir}属${wx},于你不喜不忌——平常之地,成事靠人不靠地`; }
    return { from: a[0], to: b[0], km, deg: Math.round(deg), dir, wx, verdict, score, note, local: false };
  }

  // 挑旺地:列出喜用方位上的省级去处(按距离近远),并点名要避的背方
  function recommend(chart, fromName, topN) {
    const a = find(fromName);
    if (!a) return { err: `不认识「${fromName}」——写省份或大城市名` };
    const xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    const goodDirs = [].concat(...xi.map(w => WX_DIRS[w]));
    const badDirs = [].concat(...ji.map(w => WX_DIRS[w]));
    const scan = PLACES.filter(p => p[3] === 1 && p[0] !== a[0]).map(p => {
      const km = distKm(a, p);
      const dir = dirOf(bearing(a, p));
      return { name: p[0], km, dir, wx: DIR_WX[dir] };
    }).filter(x => x.km >= 80);
    const good = scan.filter(x => goodDirs.includes(x.dir)).sort((x, y) => x.km - y.km).slice(0, topN || 8);
    const bad = scan.filter(x => badDirs.includes(x.dir)).sort((x, y) => x.km - y.km).slice(0, 5);
    return {
      from: a[0], xi, ji,
      goodDirs: [...new Set(goodDirs)], badDirs: [...new Set(badDirs)],
      good, bad,
    };
  }

  return { find, bearing, distKm, dirOf, judge, recommend, PLACES, DIR_WX, WX_DIRS, DIRS };
}));
