using UnityEngine;

namespace EarthOS
{
    /// <summary>粒子系统工厂：万家灯火 / 浮尘 / 车流光带 / 消散爆发。全部代码生成。</summary>
    public static class FX
    {
        static Texture2D _glow;
        static Texture2D Glow => _glow ? _glow : (_glow = Proc.RadialGlow(64, 2.0f));

        static ParticleSystem New(string name, Transform parent, out ParticleSystemRenderer r)
        {
            var go = new GameObject(name);
            if (parent) go.transform.SetParent(parent, false);
            var ps = go.AddComponent<ParticleSystem>();
            r = go.GetComponent<ParticleSystemRenderer>();
            r.material = Proc.Additive(Glow, Color.white);
            r.renderMode = ParticleSystemRenderMode.Billboard;
            return ps;
        }

        static Gradient FadeInOut(Color c)
        {
            var g = new Gradient();
            g.SetKeys(
                new[] { new GradientColorKey(c, 0f), new GradientColorKey(c, 1f) },
                new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.3f), new GradientAlphaKey(1f, 0.7f), new GradientAlphaKey(0f, 1f) });
            return g;
        }

        /// <summary>万家灯火 — 一大片缓慢闪烁的暖/冷光点。</summary>
        public static ParticleSystem LightSea(Transform parent, Vector3 center, Vector3 size, int count, Color warm, Color cold)
        {
            var ps = New("FX_LightSea", parent, out var r);
            ps.transform.position = center;
            var main = ps.main;
            main.loop = true; main.startLifetime = 6f; main.startSpeed = 0.02f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.06f, 0.22f);
            main.maxParticles = count; main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startColor = new ParticleSystem.MinMaxGradient(warm, cold);
            var em = ps.emission; em.rateOverTime = count / 6f;
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = size;
            var col = ps.colorOverLifetime; col.enabled = true; col.color = FadeInOut(Color.white);
            var sz = ps.sizeOverLifetime; sz.enabled = true;
            sz.size = new ParticleSystem.MinMaxCurve(1f, Twinkle());
            r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
            return ps;
        }

        /// <summary>浮尘 — 光束里缓慢上浮的微尘。</summary>
        public static ParticleSystem Dust(Transform parent, Vector3 center, Vector3 size, int count)
        {
            var ps = New("FX_Dust", parent, out var r);
            ps.transform.position = center;
            var main = ps.main;
            main.loop = true; main.startLifetime = 10f; main.startSpeed = 0.04f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.01f, 0.04f);
            main.maxParticles = count; main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = -0.01f;
            main.startColor = Palette.Ivory.A(0.5f);
            var em = ps.emission; em.rateOverTime = count / 10f;
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = size;
            var col = ps.colorOverLifetime; col.enabled = true; col.color = FadeInOut(Palette.Ivory);
            ps.Play();
            return ps;
        }

        /// <summary>车流光带 — 拉伸的暖/冷光条沿一个方向流过。</summary>
        public static ParticleSystem CarStreaks(Transform parent, Vector3 center, Vector3 dir, float spread)
        {
            var ps = New("FX_CarStreaks", parent, out var r);
            ps.transform.position = center;
            ps.transform.rotation = Quaternion.LookRotation(dir.normalized);
            var main = ps.main;
            main.loop = true; main.startLifetime = 2.6f;
            main.startSpeed = new ParticleSystem.MinMaxCurve(6f, 12f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.06f, 0.16f);
            main.maxParticles = 120; main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startColor = new ParticleSystem.MinMaxGradient(
                new Color(1f, 0.7f, 0.35f), new Color(0.74f, 0.88f, 1f));
            var em = ps.emission; em.rateOverTime = 26f;
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = new Vector3(spread, spread * 0.4f, 0.2f);
            var col = ps.colorOverLifetime; col.enabled = true; col.color = FadeInOut(Color.white);
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.lengthScale = 3.2f; r.velocityScale = 0.16f;
            ps.Play();
            return ps;
        }

        /// <summary>消散爆发 — 用于「把愿望放上桥」和「无相」散场。</summary>
        public static void Burst(Vector3 pos, Color color, int count)
        {
            var ps = New("FX_Burst", null, out var r);
            ps.transform.position = pos;
            var main = ps.main;
            main.loop = false; main.duration = 0.4f; main.startLifetime = new ParticleSystem.MinMaxCurve(0.8f, 2.0f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.6f, 2.6f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.03f, 0.12f);
            main.maxParticles = count; main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = 0.02f;
            main.startColor = color;
            var em = ps.emission; em.rateOverTime = 0f;
            em.SetBursts(new[] { new ParticleSystem.Burst(0f, (short)count) });
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Sphere; sh.radius = 0.15f;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(color, 0f), new GradientColorKey(color, 1f) },
                      new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
            col.color = g;
            ps.Play();
            Object.Destroy(ps.gameObject, 3f);
        }

        static AnimationCurve Twinkle()
        {
            var c = new AnimationCurve();
            for (int i = 0; i <= 6; i++) c.AddKey(i / 6f, 0.5f + 0.5f * Mathf.Abs(Mathf.Sin(i * 1.3f)));
            return c;
        }
    }
}
