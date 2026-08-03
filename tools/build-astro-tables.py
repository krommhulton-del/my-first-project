# 星历表生成器(v1.08):月亮改良式 + 真北交摆动项 + 冥王星采样表,全部以 DE421 为客观标准
#
# 缘起:用户报「星盘排盘一塌糊涂」。月亮低精度式 ±0.3° 近交界就翻星座;冥王星没有;北交点没有。
# 规矩(照 v0.94 VSOP 的成例):**数据机器生成、误差实测戳在文件里、勿手改**。
# 方法上有一条关键取舍:月亮与北交的**论元结构**(D/M/M′/F 的线性组合)是天文学标准内容,
# 但各项**振幅不凭记忆写**——全部拿 DE421 最小二乘拟合出来,再在独立留出集上量残差。
# 这样表里的每一个数都来自 JPL 历表,不来自本会话的记忆。
# 依赖:PYTHONPATH 指向 de421 sdist(pip download de421),jplephem。
# 跑法:PYTHONPATH=<de421目录> python3 tools/build-astro-tables.py
import math, json, sys, os
import numpy as np
import de421
from jplephem import Ephemeris

E = Ephemeris(de421)
EMRAT = 81.30056907419062
D2R = math.pi / 180.0
AU = 149597870.700

def rotZ(v, a):
    c, s = math.cos(a), math.sin(a); return (c*v[0]+s*v[1], -s*v[0]+c*v[1], v[2])
def rotY(v, a):
    c, s = math.cos(a), math.sin(a); return (c*v[0]-s*v[2], v[1], s*v[0]+c*v[2])
def rotX(v, a):
    c, s = math.cos(a), math.sin(a); return (v[0], c*v[1]+s*v[2], -s*v[1]+c*v[2])
def precess(v, T):
    zeta = (2306.2181*T + 0.30188*T*T + 0.017998*T**3)/3600*D2R
    z    = (2306.2181*T + 1.09468*T*T + 0.018203*T**3)/3600*D2R
    th   = (2004.3109*T - 0.42665*T*T - 0.041833*T**3)/3600*D2R
    return rotZ(rotY(rotZ(v, -zeta), th), -z)
def obliq(T):
    return (84381.448 - 46.8150*T - 0.00059*T*T + 0.001813*T**3)/3600*D2R
def ecl_of_date(v, jed):
    T = (jed-2451545.0)/36525.0
    ve = rotX(precess(v, T), obliq(T))
    return (math.atan2(ve[1], ve[0])/D2R % 360,
            math.atan2(ve[2], math.hypot(ve[0], ve[1]))/D2R)

def moon_geo_ecl(jed):
    m = E.position('moon', jed)
    return ecl_of_date((m[0].item(), m[1].item(), m[2].item()), jed)

# ── 基本论元(Meeus 1998 ch.47 的标准多项式;这些是公开标准式,不是拟合对象)──
def fund(T):
    D  = 297.8501921 + 445267.1114034*T - 0.0018819*T*T + T**3/545868 - T**4/113065000
    M  = 357.5291092 + 35999.0502909*T - 0.0001536*T*T + T**3/24490000
    Mp = 134.9633964 + 477198.8675055*T + 0.0087414*T*T + T**3/69699 - T**4/14712000
    F  = 93.2720950 + 483202.0175233*T - 0.0036539*T*T - T**3/3526000 + T**4/863310000
    Lp = 218.3164477 + 481267.88123421*T - 0.0015786*T*T + T**3/538841 - T**4/65194000
    return D, M, Mp, F, Lp

# 论元组合清单(黄经 / 黄纬):ELP 主项的 (D,M,M′,F) 系数——结构公开,振幅全拟合
LON_ARGS = [
 (0,0,1,0),(2,0,-1,0),(2,0,0,0),(0,0,2,0),(0,1,0,0),(0,0,0,2),(2,0,-2,0),(2,-1,-1,0),
 (2,0,1,0),(2,-1,0,0),(0,1,-1,0),(1,0,0,0),(0,1,1,0),(2,0,0,-2),(0,0,1,2),(0,0,1,-2),
 (4,0,-1,0),(0,0,3,0),(4,0,-2,0),(2,1,-1,0),(2,1,0,0),(1,0,-1,0),(1,1,0,0),(2,-1,1,0),
 (2,0,2,0),(4,0,0,0),(2,0,-3,0),(0,1,2,0),(0,1,-2,0),(2,0,-1,2),(2,0,-1,-2),(1,0,1,0),
 (2,-2,0,0),(0,1,0,2),(0,2,0,0),(2,-2,-1,0),(2,0,1,-2),(2,0,0,2),(4,-1,-1,0),(0,0,2,-2),
 (3,0,-1,0),(2,1,1,0),(4,-1,-2,0),(0,2,-1,0),(2,2,-1,0),(2,1,-2,0),(2,-1,0,-2),(4,0,1,0),
 (0,0,4,0),(4,-1,0,0),(1,0,-2,0),
]
LAT_ARGS = [
 (0,0,0,1),(0,0,1,1),(0,0,1,-1),(2,0,0,-1),(2,0,-1,1),(2,0,-1,-1),(2,0,0,1),(0,0,2,1),
 (2,0,1,-1),(0,0,2,-1),(2,-1,0,-1),(2,0,-2,-1),(2,0,1,1),(2,1,0,-1),(2,-1,-1,1),(2,-1,0,1),
 (2,-1,-1,-1),(0,1,-1,-1),(4,0,-1,-1),(0,1,0,1),(0,0,0,3),(0,1,-1,1),(1,0,0,1),(0,1,1,1),
 (0,1,1,-1),(0,1,0,-1),(1,0,0,-1),(0,0,3,1),(4,0,0,-1),(4,0,-1,1),(0,0,1,-3),(4,0,-2,1),
 (2,0,0,-3),(2,0,2,-1),(2,-1,1,-1),(2,0,-2,1),(0,0,3,-1),(2,0,2,1),(2,0,-3,-1),(2,1,-1,1),
 (2,1,0,1),(4,0,0,1),(2,-1,1,1),(2,-2,0,-1),(0,0,1,3),(2,1,1,-1),(1,1,0,-1),(1,1,0,1),
]

def fit_moon():
    # 训练集与留出集分开:训练 3.7 天步进,留出 5.3 天步进错开——残差要在**留出集**上量
    def rows(step, phase):
        js, lons, lats = [], [], []
        jed = 2415400.5 + phase
        while jed <= 2469700.5:
            lo, la = moon_geo_ecl(jed)
            js.append(jed); lons.append(lo); lats.append(la)
            jed += step
        return np.array(js), np.array(lons), np.array(lats)
    jtr, lotr, latr = rows(3.7, 0.0)
    jte, lote, late = rows(5.3, 1.9)

    def design(js, args, kind):
        T = (js - 2451545.0)/36525.0
        D, M, Mp, F, Lp = fund(T)
        cols = []
        for (a, b, c, d) in args:
            arg = (a*D + b*M + c*Mp + d*F) * D2R
            cols.append(np.sin(arg))
        A = np.stack(cols, axis=1)
        if kind == 'lon':
            y = (lotr if js is jtr else lote) - Lp % 360
        return A, T, D, M, Mp, F, Lp

    # 黄经:目标 = 月亮黄经 − L′(缠绕到 ±180)
    def wrap(x):
        return (x + 180) % 360 - 180
    T = (jtr - 2451545.0)/36525.0
    D, M, Mp, F, Lp = fund(T)
    Atr = np.stack([np.sin((a*D + b*M + c*Mp + d*F)*D2R) for (a,b,c,d) in LON_ARGS], axis=1)
    ytr = wrap(lotr - Lp)
    coef_lon, *_ = np.linalg.lstsq(Atr, ytr, rcond=None)
    T2 = (jte - 2451545.0)/36525.0
    D2, M2, Mp2, F2, Lp2 = fund(T2)
    Ate = np.stack([np.sin((a*D2 + b*M2 + c*Mp2 + d*F2)*D2R) for (a,b,c,d) in LON_ARGS], axis=1)
    res_lon = wrap(lote - Lp2 - Ate@coef_lon)
    # 黄纬
    Btr = np.stack([np.sin((a*D + b*M + c*Mp + d*F)*D2R) for (a,b,c,d) in LAT_ARGS], axis=1)
    coef_lat, *_ = np.linalg.lstsq(Btr, latr, rcond=None)
    Bte = np.stack([np.sin((a*D2 + b*M2 + c*Mp2 + d*F2)*D2R) for (a,b,c,d) in LAT_ARGS], axis=1)
    res_lat = late - Bte@coef_lat
    return (coef_lon, np.max(np.abs(res_lon)), np.sqrt(np.mean(res_lon**2)),
            coef_lat, np.max(np.abs(res_lat)), np.sqrt(np.mean(res_lat**2)), len(jte))

def fit_node():
    # 真北交:DE421 月亮状态向量 → 瞬时轨道面升交点;平交点多项式(标准式)+ 拟合摆动项
    js, nodes = [], []
    jed = 2415400.5
    while jed <= 2469700.5:
        p, v = E.position_and_velocity('moon', jed)
        T = (jed-2451545.0)/36525.0
        pe = rotX(precess((p[0].item(), p[1].item(), p[2].item()), T), obliq(T))
        ve = rotX(precess((v[0].item(), v[1].item(), v[2].item()), T), obliq(T))
        h = (pe[1]*ve[2]-pe[2]*ve[1], pe[2]*ve[0]-pe[0]*ve[2], pe[0]*ve[1]-pe[1]*ve[0])
        js.append(jed); nodes.append(math.atan2(h[0], -h[1])/D2R % 360)
        jed += 3.0
    js = np.array(js); nodes = np.array(nodes)
    T = (js-2451545.0)/36525.0
    Om = 125.0445479 - 1934.1362891*T + 0.0020754*T*T + T**3/467441   # 平交点(标准多项式)
    D, M, Mp, F, Lp = fund(T)
    resid = (nodes - Om + 180) % 360 - 180
    ARGS = [(2,0,0,-2),(2,0,0,0),(0,0,1,0),(0,0,0,2),(0,1,0,0),(2,0,-1,0),(0,0,1,-2),(2,0,0,2),
            (0,0,2,0),(2,0,1,-2),(0,0,1,2),(1,0,0,0)]
    A = np.stack([np.sin((a*D+b*M+c*Mp+d*F)*D2R) for (a,b,c,d) in ARGS], axis=1)
    coef, *_ = np.linalg.lstsq(A, resid, rcond=None)
    res = resid - A@coef
    return ARGS, coef, np.max(np.abs(res)), np.sqrt(np.mean(res**2)), np.max(np.abs(resid)), len(js)

def pluto_rows():
    rows = []
    jed = 2415400.5
    while jed <= 2469700.5:
        s = E.position('sun', jed)
        p = E.position('pluto', jed)
        hv = tuple(p[i].item()-s[i].item() for i in range(3))
        lon, lat = ecl_of_date(hv, jed)
        r = math.sqrt(sum(x*x for x in hv))/AU
        rows.append([round(jed,1), round(lon,5), round(lat,5), round(r,6)])
        jed += 40.0
    return rows

cl, mlon, rlon, cb, mlat, rlat, nte = fit_moon()
NA, nc, nmax, nrms, rawmax, nn = fit_node()
plu = pluto_rows()

out = []
out.append('// data/astro-moon.js — 月亮改良式 + 真北交摆动项(v1.08,机器生成,勿手改)')
out.append('// 客观标准:JPL DE421(pypi jplephem+de421)。论元结构为公开标准式(Meeus ch.47),')
out.append('// **各项振幅全部由 DE421 最小二乘拟合而来,不含手写数值**;残差在错开步进的留出集上实测:')
out.append('// 黄经 max %.4f° rms %.4f° · 黄纬 max %.4f° rms %.4f°(留出集 %d 点,1900–2052)' % (mlon, rlon, mlat, rlat, nte))
out.append('// 真北交(瞬时轨道面):平交点标准多项式 + %d 个拟合摆动项;拟合前摆幅 max %.3f°,拟合后残差 max %.4f° rms %.4f°(%d 点)' % (len(NA), rawmax, nmax, nrms, nn))
out.append('// 生成器:tools/build-astro-tables.py(依赖 pip 包 de421,重跑即可复现)')
out.append('(function(root,f){if(typeof module==="object"&&module.exports){module.exports=f();}else{root.AstroMoon=f();}}(typeof self!=="undefined"?self:this,function(){')
out.append('return {')
out.append('LON_ARGS:%s,' % json.dumps(LON_ARGS))
out.append('LON_COEF:%s,' % json.dumps([round(float(x), 7) for x in cl]))
out.append('LAT_ARGS:%s,' % json.dumps(LAT_ARGS))
out.append('LAT_COEF:%s,' % json.dumps([round(float(x), 7) for x in cb]))
out.append('NODE_ARGS:%s,' % json.dumps(NA))
out.append('NODE_COEF:%s,' % json.dumps([round(float(x), 6) for x in nc]))
out.append('ERR:{lonMax:%.4f,latMax:%.4f,nodeMax:%.4f},' % (mlon, mlat, nmax))
out.append('};}));')
open(os.path.join(os.path.dirname(__file__), '..', 'data', 'astro-moon.js'), 'w').write('\n'.join(out))

po = []
po.append('// data/astro-pluto.js — 冥王星日心黄经/黄纬/距离采样表(v1.08,机器生成,勿手改)')
po.append('// 客观标准:JPL DE421,40 天步进直接采样(日心运动平滑,JS 端 Catmull-Rom 插值),')
po.append('// 覆盖 JD %.1f–%.1f(约 1900-12 至 2052-06);**出界不排,照实说**。' % (plu[0][0], plu[-1][0]))
po.append('// 地心位置由 astro.js 用 VSOP 地球向量合成;合成后的地心黄经误差另在测试里对 DE421 实测。')
po.append('// 生成器:tools/build-astro-tables.py')
po.append('(function(root,f){if(typeof module==="object"&&module.exports){module.exports=f();}else{root.AstroPluto=f();}}(typeof self!=="undefined"?self:this,function(){')
po.append('return {J0:%.1f,STEP:40,ROWS:%s};' % (plu[0][0], json.dumps([[r[1], r[2], r[3]] for r in plu])))
po.append('}));')
open(os.path.join(os.path.dirname(__file__), '..', 'data', 'astro-pluto.js'), 'w').write('\n'.join(po))

print('月亮黄经 留出集 max %.4f° rms %.4f°' % (mlon, rlon))
print('月亮黄纬 留出集 max %.4f° rms %.4f°' % (mlat, rlat))
print('真北交 拟合前 max %.3f° → 拟合后 max %.4f° rms %.4f°' % (rawmax, nmax, nrms))
print('冥王星采样 %d 行' % len(plu))
