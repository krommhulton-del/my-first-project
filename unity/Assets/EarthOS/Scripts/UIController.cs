using UnityEngine;
using UnityEngine.UI;

namespace EarthOS
{
    /// <summary>
    /// 同时演示两种 UI：
    ///  · Overlay（ScreenSpaceOverlay）—— 标题卡、底部字幕、准星、提示、胶片颗粒/暗角、结尾落款。
    ///  · WorldSpace —— 漂浮在场景里的旁白面板（始终朝向玩家）。
    /// </summary>
    public class UIController : MonoBehaviour
    {
        [Header("Overlay")]
        public CanvasGroup titleGroup;
        public Text titleMain, titleSub;
        public Text subtitle;
        public Text hint;
        public Image crosshair;
        public RawImage grain;
        public CanvasGroup coupletGroup;
        public Text coupletA, coupletB;

        [Header("WorldSpace")]
        public CanvasGroup worldGroup;
        public Text worldText;

        [Header("Fade")]
        public Image fader;            // full-screen black (无相 散场)

        public Camera cam;

        float titleA = 1f, worldA = 0f, coupletA_ = 0f, faderA = 0f, faderSpeed = 0.5f;

        public void Init(bool isVR)
        {
            if (hint) hint.text = isVR
                ? "左摇杆 移动 · 右摇杆 转身 · 扳机 交互 / 抓取"
                : "WASD 移动 · 鼠标 视角 · 左键 交互 / 抓取 · Esc 解锁鼠标";
            if (crosshair) crosshair.enabled = !isVR;
            Set(worldGroup, 0f); Set(coupletGroup, 0f);
        }

        void Update()
        {
            if (titleGroup) titleGroup.alpha = Mathf.MoveTowards(titleGroup.alpha, titleA, Time.deltaTime * 0.6f);
            if (worldGroup) worldGroup.alpha = Mathf.MoveTowards(worldGroup.alpha, worldA, Time.deltaTime * 1.1f);
            if (coupletGroup) coupletGroup.alpha = Mathf.MoveTowards(coupletGroup.alpha, coupletA_, Time.deltaTime * 0.4f);

            if (grain)
            {
                var r = grain.uvRect;
                r.x = Random.value; r.y = Random.value;   // jitter the grain
                grain.uvRect = r;
            }
            if (worldGroup && cam && worldGroup.alpha > 0.01f)
                worldGroup.transform.rotation = cam.transform.rotation;   // billboard

            if (fader)
            {
                var c = fader.color;
                c.a = Mathf.MoveTowards(c.a, faderA, Time.deltaTime * faderSpeed);
                fader.color = c;
            }
        }

        public void FadeToBlack(float speed = 0.5f) { faderA = 1f; faderSpeed = speed; }
        public void FadeFromBlack(float speed = 0.5f) { faderA = 0f; faderSpeed = speed; }

        public void HideTitle() => titleA = 0f;

        public void ShowLine(string text, Vector3 worldPos)
        {
            if (worldText) worldText.text = text;
            if (worldGroup) worldGroup.transform.position = worldPos;
            worldA = 1f;
            if (subtitle) subtitle.text = text;       // mirror to Overlay
        }

        public void HideLine() { worldA = 0f; if (subtitle) subtitle.text = ""; }

        public void ShowCouplet(string a, string b)
        {
            if (coupletA) coupletA.text = a;
            if (coupletB) coupletB.text = b;
            coupletA_ = 1f;
            if (subtitle) subtitle.text = "";
        }

        static void Set(CanvasGroup g, float a) { if (g) g.alpha = a; }
    }
}
