using UnityEngine;

namespace EarthOS
{
    /// <summary>古早言情·痛感色板 (from PROJECT.md §4.2)。</summary>
    public static class Palette
    {
        public static readonly Color Base  = Hex(0x0D, 0x0A, 0x0B); // 深邃夜底
        public static readonly Color Wine  = Hex(0x7A, 0x2A, 0x35); // 纸醉酒红
        public static readonly Color Ivory = Hex(0xE8, 0xDF, 0xD3); // 回忆米象
        public static readonly Color Gold  = Hex(0xB8, 0x96, 0x64); // 微醺金光
        public static readonly Color Mist  = Hex(0x2C, 0x3A, 0x47); // 冷夜雾蓝
        public static readonly Color Seal  = Hex(0xF5, 0xEB, 0xD8); // 高光白

        public static Color Hex(int r, int g, int b) => new Color(r / 255f, g / 255f, b / 255f, 1f);
        public static Color A(this Color c, float a) { c.a = a; return c; }
    }

    /// <summary>Procedural material / texture / mesh factory — keeps the project asset-free.</summary>
    public static class Proc
    {
        static Shader sStandard, sUnlit, sSprite, sParticleAdd;
        static Shader Standard    => sStandard    ? sStandard    : (sStandard    = Shader.Find("Standard"));
        static Shader UnlitColor  => sUnlit       ? sUnlit       : (sUnlit       = Shader.Find("Unlit/Color"));
        static Shader SpriteDef   => sSprite      ? sSprite      : (sSprite      = Shader.Find("Sprites/Default"));
        static Shader ParticleAdd => sParticleAdd ? sParticleAdd : (sParticleAdd = Shader.Find("Legacy Shaders/Particles/Additive"));

        public static Material Opaque(Color c, Color emission, float smoothness = 0.15f, float metallic = 0f)
        {
            var m = new Material(Standard);
            m.color = c;
            m.SetFloat("_Glossiness", smoothness);
            m.SetFloat("_Metallic", metallic);
            if (emission.maxColorComponent > 0.001f)
            {
                m.EnableKeyword("_EMISSION");
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                m.SetColor("_EmissionColor", emission);
            }
            return m;
        }

        public static Material Unlit(Color c)
        {
            var m = new Material(UnlitColor);
            m.color = c;
            return m;
        }

        public static Material Additive(Texture tex, Color tint)
        {
            var m = new Material(ParticleAdd);
            if (tex) m.mainTexture = tex;
            m.color = tint;
            return m;
        }

        public static Material Sprite(Texture2D tex, Color tint)
        {
            var m = new Material(SpriteDef);
            m.mainTexture = tex;
            m.color = tint;
            return m;
        }

        // ---- procedural textures ----

        public static Texture2D Noise(int size = 128)
        {
            var t = new Texture2D(size, size, TextureFormat.R8, false) { wrapMode = TextureWrapMode.Repeat };
            var px = new Color32[size * size];
            for (int i = 0; i < px.Length; i++) { byte v = (byte)Random.Range(0, 255); px[i] = new Color32(v, v, v, 255); }
            t.SetPixels32(px); t.Apply();
            return t;
        }

        public static Texture2D Vignette(int size = 256, float inner = 0.45f, float strength = 0.95f)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            Vector2 c = new Vector2(size / 2f, size / 2f);
            float maxD = size * 0.72f;
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = Vector2.Distance(new Vector2(x, y), c) / maxD;
                    float a = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(inner, 1f, d)) * strength;
                    px[y * size + x] = new Color(0.02f, 0.012f, 0.016f, a);
                }
            t.SetPixels32(px); t.Apply();
            return t;
        }

        public static Texture2D RadialGlow(int size = 128, float power = 2.2f)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var px = new Color[size * size];
            Vector2 c = new Vector2(size / 2f, size / 2f);
            float maxD = size / 2f;
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = Vector2.Distance(new Vector2(x, y), c) / maxD;
                    float a = Mathf.Clamp01(1f - d);
                    a = Mathf.Pow(a, power);
                    px[y * size + x] = new Color(1f, 1f, 1f, a);
                }
            t.SetPixels(px); t.Apply();
            return t;
        }

        /// <summary>暗立面 + 暖窗光 (钢铁森林 monolith facade).</summary>
        public static Texture2D Windows(int w = 64, int h = 256)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat };
            var px = new Color[w * h];
            for (int i = 0; i < px.Length; i++) px[i] = new Color(0.03f, 0.03f, 0.04f, 1f);
            int cols = 5, rows = 26;
            for (int r = 0; r < rows; r++)
                for (int cI = 0; cI < cols; cI++)
                {
                    if (Random.value < 0.35f) continue; // dark window
                    float lum = Random.Range(0.25f, 1f);
                    Color win = Color.Lerp(Palette.Mist, Palette.Gold, Random.value) * lum;
                    int x0 = Mathf.RoundToInt((cI + 0.25f) / cols * w), x1 = Mathf.RoundToInt((cI + 0.75f) / cols * w);
                    int y0 = Mathf.RoundToInt((r + 0.30f) / rows * h), y1 = Mathf.RoundToInt((r + 0.70f) / rows * h);
                    for (int y = y0; y < y1; y++)
                        for (int x = x0; x < x1; x++)
                            px[y * w + x] = win;
                }
            t.SetPixels(px); t.Apply();
            return t;
        }
    }
}
