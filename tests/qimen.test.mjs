// 奇门遁甲排盘测试:结构不变量 + 定局 + 值符值使落宫
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Qimen = require('../qimen.js');

let pass = 0, fail = 0;
const eq = (a, b, msg) => { if (a === b) { pass++; } else { fail++; console.error(`✗ ${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const ok = (c, msg) => { if (c) { pass++; } else { fail++; console.error(`✗ ${msg}`); } };
const uniq = a => new Set(a).size === a.length;

const YIQI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
const OUTER = [1, 2, 3, 4, 6, 7, 8, 9];

// 多取几个时刻覆盖阴阳遁与不同局
const samples = [
  new Date(2026, 0, 5, 10, 0),   // 小寒 阳遁
  new Date(2025, 11, 25, 3, 0),  // 冬至后 阳遁
  new Date(2026, 2, 21, 14, 0),  // 春分 阳遁
  new Date(2026, 5, 25, 23, 30), // 夏至后 阴遁(晚子时)
  new Date(2026, 6, 9, 23, 57),  // 小暑 阴遁(用户实占时刻)
  new Date(2026, 8, 20, 8, 0),   // 秋分前后 阴遁
  new Date(2026, 10, 15, 16, 0), // 立冬后 阴遁
];

for (const dt of samples) {
  const c = Qimen.cast(dt);
  const tag = dt.toISOString().slice(0, 16);

  // 九宫齐全
  eq(Object.keys(c.cells).length, 9, `${tag} 九宫齐全`);
  // 地盘六仪三奇为一个排列
  const earth = OUTER.concat(5).map(p => c.cells[p].earthGan);
  ok(uniq(earth) && earth.every(g => YIQI.includes(g)), `${tag} 地盘为六仪三奇排列`);
  // 天盘八宫干互异(= 地盘除中5之八干)
  const sky = OUTER.map(p => c.cells[p].skyGan);
  ok(uniq(sky) && sky.length === 8, `${tag} 天盘八干互异`);
  // 九星:八外宫互异,且不含天禽(天禽居中寄二)
  const stars = OUTER.map(p => c.cells[p].star);
  ok(uniq(stars) && stars.length === 8 && !stars.includes('天禽'), `${tag} 八外宫九星互异`);
  // 八门:八外宫互异
  const gates = OUTER.map(p => c.cells[p].gate);
  ok(uniq(gates) && gates.length === 8, `${tag} 八门互异`);
  // 八神:八外宫互异
  const shen = OUTER.map(p => c.cells[p].shen);
  ok(uniq(shen) && shen.length === 8, `${tag} 八神互异`);
  // 局数 1..9
  ok(c.ju >= 1 && c.ju <= 9, `${tag} 局数 ${c.ju} 在 1..9`);
  // 值符星飞临之宫,其天盘星即值符星
  eq(c.cells[c.zhiFu.atGong].star.replace('(寄二)', ''), c.zhiFu.star, `${tag} 值符落宫星一致`);
  // 值使门飞临之宫,其八门即值使门
  eq(c.cells[c.zhiShi.atGong].gate, c.zhiShi.gate, `${tag} 值使落宫门一致`);
  // report 不抛错且含关键信息
  const r = Qimen.report(c);
  ok(r.includes('值符') && r.includes('值使') && r.includes(c.dun), `${tag} report 完整`);
  // verdict:事宫即值符所临之宫,吉凶级别合法
  const v = Qimen.verdict(c);
  eq(v.gong, c.zhiFu.atGong, `${tag} 事宫=值符落宫`);
  ok(['上吉', '顺', '平', '滞', '凶'].includes(v.lv), `${tag} verdict 级别合法(${v.lv})`);
}

// 阴阳遁边界
eq(Qimen.cast(new Date(2025, 11, 25, 12, 0)).yin, false, '冬至后为阳遁');
eq(Qimen.cast(new Date(2026, 0, 20, 12, 0)).yin, false, '大寒为阳遁');
eq(Qimen.cast(new Date(2026, 5, 25, 12, 0)).yin, true, '夏至后为阴遁');
eq(Qimen.cast(new Date(2026, 6, 9, 12, 0)).yin, true, '小暑为阴遁');

// 用户实占:2026-07-09 小暑 → 阴遁,局 ∈ {8,2,5}
const uc = Qimen.cast(new Date(2026, 6, 9, 23, 57));
eq(uc.jieqi, '小暑', '2026-07-09 节气为小暑');
ok([8, 2, 5].includes(uc.ju), `2026-07-09 局数 ${uc.ju} ∈ 小暑三元{8,2,5}`);

console.log(`\n奇门遁甲:${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
