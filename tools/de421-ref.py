# DE421 参照器(v1.08 星盘二次体检的客观标准)
#
# 缘起:用户报「星盘排盘一塌糊涂」。v0.94 的客观标准是 VSOP87D 全序列,但它只覆盖八大行星,
# 月亮用的是 ±0.3° 低精度式、冥王星干脆没有、上升的恒星时公式无人对过表。
# 本环境网络只放行包仓库,pypi 上恰有 JPL 官方历表 DE421 的打包(jplephem + de421,NASA JPL 出品,
# 精度远超本项目一切需要)——用它作**外部客观标准**逐项对照:
#   行星几何黄经(顺带验 VSOP 链路)· 月亮(量真实误差)· 冥王星(生成采样表)· 真北交(拟合摆动项)
#
# 坐标链:DE421 给 ICRF/J2000 赤道系 km → IAU1976 岁差转到当日平赤道 → 按当日平黄赤交角转到
# **当日平黄道**(与 VSOP87D 同一约定:几何位置、平分点,无光行差无章动)。
# 用法:python3 tools/de421-ref.py <cmd>  (cmd = check | moon | pluto | node)
# 依赖:pip install jplephem==1.2 de421(约 27MB,legacy .npy 格式)
import sys, json, math
import de421
from jplephem import Ephemeris

E = Ephemeris(de421)
EMRAT = 81.30056907419062  # DE421 常数(地/月质量比,constants.npy 同值)
D2R = math.pi / 180.0

def rotZ(v, a):
    c, s = math.cos(a), math.sin(a)
    return (c*v[0] + s*v[1], -s*v[0] + c*v[1], v[2])
def rotY(v, a):
    c, s = math.cos(a), math.sin(a)
    return (c*v[0] - s*v[2], v[1], s*v[0] + c*v[2])
def rotX(v, a):
    c, s = math.cos(a), math.sin(a)
    return (v[0], c*v[1] + s*v[2], -s*v[1] + c*v[2])

def precess_to_date(v, T):
    # IAU1976:J2000 平赤道 → 当日平赤道。角量单位角秒。
    zeta = (2306.2181*T + 0.30188*T*T + 0.017998*T**3) / 3600 * D2R
    z    = (2306.2181*T + 1.09468*T*T + 0.018203*T**3) / 3600 * D2R
    theta= (2004.3109*T - 0.42665*T*T - 0.041833*T**3) / 3600 * D2R
    return rotZ(rotY(rotZ(v, -zeta), theta), -z)

def obliquity(T):
    return (84381.448 - 46.8150*T - 0.00059*T*T + 0.001813*T**3) / 3600 * D2R

def to_ecliptic_of_date(v, jed):
    T = (jed - 2451545.0) / 36525.0
    vq = precess_to_date(v, T)
    ve = rotX(vq, obliquity(T))
    lon = math.atan2(ve[1], ve[0]) / D2R % 360
    lat = math.atan2(ve[2], math.hypot(ve[0], ve[1])) / D2R
    return lon, lat

def earth_ssb(jed):
    emb = E.position('earthmoon', jed)
    moon = E.position('moon', jed)          # 地心月亮
    return tuple(emb[i].item() - moon[i].item()/(1.0+EMRAT) for i in range(3))

def body_geo(name, jed):
    e = earth_ssb(jed)
    if name == 'moon':
        m = E.position('moon', jed)
        v = (m[0].item(), m[1].item(), m[2].item())
    else:
        b = E.position(name, jed)
        v = tuple(b[i].item() - e[i] for i in range(3))
    return to_ecliptic_of_date(v, jed)

def moon_state(jed):
    p, vel = E.position_and_velocity('moon', jed)
    return (p[0].item(), p[1].item(), p[2].item()), (vel[0].item(), vel[1].item(), vel[2].item())

NAMES = { 'sun':'sun', 'mer':'mercury', 'ven':'venus', 'mar':'mars',
          'jup':'jupiter', 'sat':'saturn', 'ura':'uranus', 'nep':'neptune', 'plu':'pluto', 'moon':'moon' }

cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'

if cmd == 'check':
    # 行星与月亮:1900–2050 网格采样,输出 JSON 给 node 端与 astro.js 对照
    out = []
    for i in range(600):
        jed = 2415385.5 + i * 91.31  # ~1900-12 起,91 天步进,盖到 2050
        row = { 'jd': jed }
        for k, nm in NAMES.items():
            lon, lat = body_geo(nm, jed)
            row[k] = [round(lon, 6), round(lat, 6)]
        out.append(row)
    print(json.dumps(out))

elif cmd == 'pluto':
    # 冥王星**日心**黄经/黄纬/距离采样(平滑,40 天步进),JS 端与 VSOP 地球向量合成地心位置。
    # 范围盖 DE421 全程(约 1900–2052),出界照实拒排。
    AU = 149597870.700
    rows = []
    jed = 2415400.5
    while jed <= 2469700.5:
        e = earth_ssb(jed)
        s = E.position('sun', jed)
        p = E.position('pluto', jed)
        hv = tuple(p[i].item() - s[i].item() for i in range(3))   # 日心向量
        lon, lat = to_ecliptic_of_date(hv, jed)
        r = math.sqrt(sum(x*x for x in hv)) / AU
        rows.append([round(jed, 1), round(lon, 5), round(lat, 5), round(r, 6)])
        jed += 40.0
    print(json.dumps(rows))

elif cmd == 'node':
    # 真北交点:地心月亮瞬时轨道面升交点(黄道系),1900–2052 逐 3 天采样。
    out = []
    jed = 2415400.5
    while jed <= 2469700.5:
        (px, py, pz), (vx, vy, vz) = moon_state(jed)
        T = (jed - 2451545.0) / 36525.0
        pe = rotX(precess_to_date((px, py, pz), T), obliquity(T))
        ve = rotX(precess_to_date((vx, vy, vz), T), obliquity(T))
        hx = pe[1]*ve[2] - pe[2]*ve[1]
        hy = pe[2]*ve[0] - pe[0]*ve[2]
        hz = pe[0]*ve[1] - pe[1]*ve[0]
        lon = math.atan2(hx, -hy) / D2R % 360     # n = ẑ×h = (−hy, hx, 0)
        out.append([round(jed, 1), round(lon, 4)])
        jed += 3.0
    print(json.dumps(out))
