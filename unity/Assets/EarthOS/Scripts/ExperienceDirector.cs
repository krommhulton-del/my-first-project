using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace EarthOS
{
    public enum BeatKind { Narration, Bridge, Choice, TheOne, End }

    [System.Serializable]
    public class Beat
    {
        public Transform anchor;
        public float radius = 4.5f;
        [TextArea] public string text;
        public BeatKind kind = BeatKind.Narration;
        [HideInInspector] public bool fired;
    }

    /// <summary>
    /// 副本导演：第一人称漫游触发旁白；天桥放愿望；四选一→「那个人」分支；无相散场→落款→重启。
    /// 中文文案全部为 DS 定稿（PROJECT.md §3.3），此处只做编排。
    /// </summary>
    public class ExperienceDirector : MonoBehaviour
    {
        // ---- DS 定稿文案（单一真相，供 SceneBuilder 取用）----
        public const string L_STATION  = "行李箱的轮子，在北京站前广场，迟疑了一下。";
        public const string L_CBD      = "在举目无亲的地方，人，才能成为另一个自己。";
        public const string L_SET      = "凌晨四点，卸妆棉上是粉底、灰尘、和一句没说出口的台词。";
        public const string L_BRIDGE   = "在这片钢铁森林里，她把一个愿望，轻轻搁在了车来车往的桥上。";
        public const string L_OVERLOOK = "龙舌兰的杯底，映着极静极美的北京。";
        public const string L_TAXI     = "直到窗外那些流动的灯火，都像他的侧脸，她才知道完了。良辰美景奈何天。";
        public const string Q          = "你，为什么还留在北京？";
        public const string OPT_A = "梦，还没做完";
        public const string OPT_B = "已经没有别的地方可去";
        public const string OPT_C = "等一个人，或者等一个答案";
        public const string OPT_D = "记不起来了";
        public const string BR_A = "这座城市的梦太吵了。";
        public const string BR_B = "你看，它也并没有真的留你。";
        public const string BR_C = "有些人，真的，只能在北京才会遇见。";
        public const string BR_D = "趁酒杯摇曳，快乐还没过期。";
        public const string SEAL_A = "你与北京，两不相欠。";
        public const string SEAL_B = "恨海情天，终付无言。";

        [Header("Wiring (by SceneBuilder)")]
        public UIController ui;
        public ChoiceMenu choiceMenu;
        public PlayerRig rig;
        public Transform head;
        public Transform worldRoot;
        public Beat[] beats;
        public Beat theOneBeat;

        bool ended;
        float titleTimer;
        Beat shown;

        void Start()
        {
            ProceduralAudio.Instance?.StartMusic();
            ui?.Init(XRInputHub.VRActive);
        }

        void Update()
        {
            if (ended) { if (RestartPressed()) Restart(); return; }

            titleTimer += Time.deltaTime;
            if (titleTimer > 5f) ui?.HideTitle();

            bool choiceOpen = choiceMenu && choiceMenu.gameObject.activeSelf;

            Beat near = null; float best = float.MaxValue;
            foreach (var b in beats)
            {
                if (b == null || b.anchor == null) continue;
                float d = Flat(head.position, b.anchor.position);
                if (d > b.radius) continue;

                if (b.kind == BeatKind.Choice && !b.fired)
                {
                    b.fired = true; ui?.HideTitle(); shown = null; ui?.HideLine();
                    choiceMenu?.Show(OnChosen);
                }
                else if (b.kind == BeatKind.End && !b.fired)
                {
                    b.fired = true; StartCoroutine(EndSequence());
                }
                else if (!string.IsNullOrEmpty(b.text) && d < best)
                {
                    best = d; near = b;
                }
            }

            if (!choiceOpen)
            {
                if (near != null)
                {
                    if (near != shown) { shown = near; ui?.ShowLine(near.text, near.anchor.position + Vector3.up * 1.7f); }
                }
                else if (shown != null) { shown = null; ui?.HideLine(); }
            }
        }

        void OnChosen(string key)
        {
            string line = key == "A" ? BR_A : key == "B" ? BR_B : key == "D" ? BR_D : BR_C;
            if (theOneBeat != null) theOneBeat.text = line;
        }

        public void OnWishPlaced()
        {
            // 帧05 愿望被车流带走：一记微光 + 让旁白停一拍
            if (ui) ui.FadeToBlack(0.15f);
            Invoke(nameof(ClearFlash), 0.25f);
        }
        void ClearFlash() { if (ui) ui.FadeFromBlack(0.5f); }

        IEnumerator EndSequence()
        {
            ui?.HideLine();
            ProceduralAudio.Instance?.PlayHit();

            // 散场：场景里的形体逐个炸成粒子并隐去
            if (worldRoot)
            {
                var rends = worldRoot.GetComponentsInChildren<Renderer>();
                foreach (var rd in rends)
                {
                    if (rd is ParticleSystemRenderer) continue;
                    FX.Burst(rd.bounds.center, Random.value < 0.5f ? Palette.Gold : Palette.Mist, 24);
                    rd.enabled = false;
                    if (Random.value < 0.5f) yield return null;
                }
            }
            ui?.FadeToBlack(0.6f);
            yield return new WaitForSeconds(2.2f);
            ui?.ShowCouplet(SEAL_A, SEAL_B);
            yield return new WaitForSeconds(1.5f);
            ended = true;
        }

        void Restart()
        {
            int bi = SceneManager.GetActiveScene().buildIndex;
            if (bi >= 0) SceneManager.LoadScene(bi);
            else SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }

        bool RestartPressed()
        {
            if (Input.GetKeyDown(KeyCode.R)) return true;
            return XRInputHub.Primary(UnityEngine.XR.XRNode.RightHand) || XRInputHub.Primary(UnityEngine.XR.XRNode.LeftHand);
        }

        static float Flat(Vector3 a, Vector3 b) { a.y = 0; b.y = 0; return Vector3.Distance(a, b); }
    }
}
