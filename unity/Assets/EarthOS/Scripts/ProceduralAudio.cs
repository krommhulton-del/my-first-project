using UnityEngine;

namespace EarthOS
{
    /// <summary>
    /// 背景音乐 + 交互音效 全部运行时合成 —— 无需任何音频文件。
    /// 满足大作业「背景音乐 / 交互音效」要求。
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class ProceduralAudio : MonoBehaviour
    {
        public static ProceduralAudio Instance { get; private set; }

        AudioSource bgm;   // looping drone
        AudioSource sfx;   // one-shots
        const int FS = 44100;

        AudioClip cSelect, cGrab, cWhoosh, cHit;

        void Awake()
        {
            Instance = this;
            bgm = GetComponent<AudioSource>();
            sfx = gameObject.AddComponent<AudioSource>();
            sfx.spatialBlend = 0f; sfx.playOnAwake = false;

            bgm.clip = BuildDrone();
            bgm.loop = true; bgm.spatialBlend = 0f; bgm.volume = 0.55f; bgm.playOnAwake = false;

            cSelect = BuildSelect();
            cGrab   = BuildGrab();
            cWhoosh = BuildWhoosh();
            cHit    = BuildHit();
        }

        public void StartMusic() { if (bgm && !bgm.isPlaying) bgm.Play(); }
        public void PlaySelect() => sfx.PlayOneShot(cSelect, 0.6f);
        public void PlayGrab()   => sfx.PlayOneShot(cGrab, 0.7f);
        public void PlayWhoosh() => sfx.PlayOneShot(cWhoosh, 0.5f);
        public void PlayHit()    => sfx.PlayOneShot(cHit, 0.9f);

        // ---------- synthesis ----------

        // 4s seamless drone: all partials are integer cycles over the buffer.
        AudioClip BuildDrone()
        {
            int n = FS * 4;
            var d = new float[n];
            float[] f = { 55f, 82.5f, 110f, 165f, 220f };
            float[] w = { 0.50f, 0.30f, 0.32f, 0.18f, 0.12f };
            float lp = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / FS;
                float s = 0f;
                for (int k = 0; k < f.Length; k++) s += w[k] * Mathf.Sin(2f * Mathf.PI * f[k] * t);
                float lfo = 0.55f + 0.35f * Mathf.Sin(2f * Mathf.PI * 0.25f * t);   // 1 cycle / 4s
                float air = Random.value * 2f - 1f;
                lp += 0.0009f * (air - lp);                                          // one-pole lowpass
                d[i] = Mathf.Clamp(s * 0.42f * lfo + lp * 0.6f, -1f, 1f);
            }
            var c = AudioClip.Create("drone", n, 1, FS, false);
            c.SetData(d, 0);
            return c;
        }

        AudioClip BuildSelect()
        {
            int n = (int)(FS * 0.32f);
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / FS, env = Mathf.Exp(-t * 12f);
                d[i] = env * 0.5f * (Mathf.Sin(2 * Mathf.PI * 880 * t) + 0.6f * Mathf.Sin(2 * Mathf.PI * 1320 * t));
            }
            var c = AudioClip.Create("select", n, 1, FS, false); c.SetData(d, 0); return c;
        }

        AudioClip BuildGrab()
        {
            int n = (int)(FS * 0.28f);
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / FS, env = Mathf.Exp(-t * 9f);
                float freq = Mathf.Lerp(220f, 120f, t / (n / (float)FS));
                d[i] = env * 0.55f * Mathf.Sin(2 * Mathf.PI * freq * t);
            }
            var c = AudioClip.Create("grab", n, 1, FS, false); c.SetData(d, 0); return c;
        }

        AudioClip BuildWhoosh()
        {
            int n = (int)(FS * 1.1f);
            var d = new float[n]; float lp = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / FS, p = t / (n / (float)FS);
                float env = Mathf.Sin(Mathf.PI * Mathf.Clamp01(p)) ;
                float ns = Random.value * 2f - 1f;
                float a = Mathf.Lerp(0.02f, 0.25f, p);        // sweep the lowpass open
                lp += a * (ns - lp);
                d[i] = Mathf.Clamp(lp * env * 1.6f, -1f, 1f);
            }
            var c = AudioClip.Create("whoosh", n, 1, FS, false); c.SetData(d, 0); return c;
        }

        AudioClip BuildHit()
        {
            int n = (int)(FS * 1.8f);
            var d = new float[n]; float lp = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / FS, env = Mathf.Exp(-t * 2.2f);
                float freq = Mathf.Lerp(70f, 28f, Mathf.Clamp01(t / 1.4f));
                float sine = Mathf.Sin(2 * Mathf.PI * freq * t);
                float ns = Random.value * 2f - 1f; lp += 0.02f * (ns - lp);
                d[i] = Mathf.Clamp((sine * 0.7f + lp * 0.5f) * env, -1f, 1f);
            }
            var c = AudioClip.Create("hit", n, 1, FS, false); c.SetData(d, 0); return c;
        }
    }
}
