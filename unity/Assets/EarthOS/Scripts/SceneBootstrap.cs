using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR;
using UnityEngine.SpatialTracking;

namespace EarthOS
{
    /// <summary>
    /// 一个组件，运行时从零搭出整个《地球Online·北京副本》VR 体验：
    /// 环境/光/雾、XR 第一人称漫游 rig、生成式几何、粒子、Overlay+WorldSpace UI、
    /// 程序化音乐音效、互动、导演编排。全部代码生成，无需任何美术/音频资源。
    /// 用法：空场景里建一个空物体，挂上本组件，按 Play。
    /// </summary>
    public class SceneBootstrap : MonoBehaviour
    {
        Font uiFont;
        Sprite whiteSpr, vignetteSpr, dotSpr;
        Transform world;
        Camera cam;

        void Start()
        {
            uiFont = LoadFont();
            whiteSpr = SolidSprite(Color.white);
            vignetteSpr = ToSprite(Proc.Vignette());
            dotSpr = ToSprite(Proc.RadialGlow(32, 1.4f));

            BuildEnvironment();
            var rig = BuildRig(out cam, out Transform lh, out Transform rh);
            world = new GameObject("World").transform;
            BuildGeometryAndBeats(out Beat[] beats, out Beat theOne, out Transform dropZone, out Grabbable orb,
                                  out Transform choiceAnchor, out Transform worldNarrationStart);
            BuildParticles();

            var audio = BuildAudio();
            var ui = BuildUI(out ChoiceMenu choice, choiceAnchor);
            ui.cam = cam; choice.cam = cam;

            // director
            var dirGO = new GameObject("Director");
            var dir = dirGO.AddComponent<ExperienceDirector>();
            dir.ui = ui; dir.choiceMenu = choice; dir.rig = rig; dir.head = cam.transform;
            dir.worldRoot = world; dir.beats = beats; dir.theOneBeat = theOne;
            orb.onPlaced = dir.OnWishPlaced;

            Destroy(gameObject.GetComponent<SceneBootstrap>()); // done; leave the empty host
        }

        // ----------------------------------------------------------------- environment
        void BuildEnvironment()
        {
            RenderSettings.fog = true;
            RenderSettings.fogColor = Palette.Base;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.022f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = Palette.Base * 1.6f;

            var sun = new GameObject("Dir Light").AddComponent<Light>();
            sun.type = LightType.Directional; sun.intensity = 0.25f;
            sun.color = Palette.Mist; sun.transform.rotation = Quaternion.Euler(55f, -30f, 0f);
        }

        // ----------------------------------------------------------------- rig
        PlayerRig BuildRig(out Camera camera, out Transform leftHand, out Transform rightHand)
        {
            var rigGO = new GameObject("XRRig");
            var rig = rigGO.AddComponent<PlayerRig>();

            var camGO = new GameObject("Main Camera");
            camGO.tag = "MainCamera";
            camGO.transform.SetParent(rigGO.transform, false);
            camera = camGO.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Palette.Base;
            camera.nearClipPlane = 0.05f; camera.farClipPlane = 400f;
            camGO.AddComponent<AudioListener>();
            AddPose(camGO, TrackedPoseDriver.DeviceType.GenericXRDevice, TrackedPoseDriver.TrackedPose.Center);
            var deskInt = camGO.AddComponent<Interactor>();
            deskInt.desktopInteractor = true; deskInt.cam = camera;

            leftHand = BuildHand(rigGO.transform, "LeftHand", TrackedPoseDriver.TrackedPose.LeftPose, XRNode.LeftHand, camera);
            rightHand = BuildHand(rigGO.transform, "RightHand", TrackedPoseDriver.TrackedPose.RightPose, XRNode.RightHand, camera);

            rig.cam = camera; rig.leftHand = leftHand; rig.rightHand = rightHand;
            return rig;
        }

        Transform BuildHand(Transform parent, string name, TrackedPoseDriver.TrackedPose pose, XRNode node, Camera camera)
        {
            var h = new GameObject(name);
            h.transform.SetParent(parent, false);
            h.transform.localPosition = new Vector3(node == XRNode.LeftHand ? -0.2f : 0.2f, 1.2f, 0.1f);
            AddPose(h, TrackedPoseDriver.DeviceType.GenericXRController, pose);
            var inter = h.AddComponent<Interactor>();
            inter.desktopInteractor = false; inter.node = node; inter.cam = camera;
            // little controller nub
            var nub = GameObject.CreatePrimitive(PrimitiveType.Cube);
            nub.transform.SetParent(h.transform, false);
            nub.transform.localScale = new Vector3(0.04f, 0.04f, 0.12f);
            Destroy(nub.GetComponent<Collider>());
            nub.GetComponent<Renderer>().sharedMaterial = Proc.Opaque(Palette.Gold, Palette.Gold * 0.4f);
            return h.transform;
        }

        void AddPose(GameObject go, TrackedPoseDriver.DeviceType dt, TrackedPoseDriver.TrackedPose pose)
        {
            var tpd = go.AddComponent<TrackedPoseDriver>();
            tpd.SetPoseSource(dt, pose);
            tpd.trackingType = TrackedPoseDriver.TrackingType.RotationAndPosition;
            tpd.updateType = TrackedPoseDriver.UpdateType.UpdateAndBeforeRender;
        }

        // ----------------------------------------------------------------- geometry + beats
        void BuildGeometryAndBeats(out Beat[] beats, out Beat theOne, out Transform dropZone, out Grabbable orb,
                                   out Transform choiceAnchor, out Transform worldNarrationStart)
        {
            // ground
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground"; ground.transform.SetParent(world, false);
            ground.transform.localScale = new Vector3(12, 1, 12);
            ground.transform.position = new Vector3(0, 0, 30);
            ground.GetComponent<Renderer>().sharedMaterial = Proc.Opaque(Palette.Base * 0.7f, Color.black, 0.05f);

            // 钢铁森林 monoliths around the CBD zone
            var winMat = MonolithMat();
            for (int i = 0; i < 16; i++)
            {
                float z = Random.Range(6f, 18f);
                float x = (Random.value < 0.5f ? -1 : 1) * Random.Range(4f, 11f);
                float hgt = Random.Range(8f, 24f);
                var m = GameObject.CreatePrimitive(PrimitiveType.Cube);
                m.name = "Monolith"; m.transform.SetParent(world, false);
                m.transform.position = new Vector3(x, hgt / 2f, z);
                m.transform.localScale = new Vector3(Random.Range(2f, 4f), hgt, Random.Range(2f, 4f));
                var mr = m.GetComponent<Renderer>(); mr.sharedMaterial = winMat;
                mr.material.mainTextureScale = new Vector2(1, hgt / 5f);
                mr.material.SetTextureScale("_EmissionMap", new Vector2(1, hgt / 5f));
            }

            // 天桥 deck
            var deck = GameObject.CreatePrimitive(PrimitiveType.Cube);
            deck.name = "BridgeDeck"; deck.transform.SetParent(world, false);
            deck.transform.position = new Vector3(0, 0.05f, 20f);
            deck.transform.localScale = new Vector3(6f, 0.1f, 4f);
            deck.GetComponent<Renderer>().sharedMaterial = Proc.Opaque(Palette.Mist * 0.5f, Palette.Gold * 0.06f, 0.3f);

            // 片场 lone tungsten light + small stage
            AddPoint(new Vector3(0, 5f, 38f), new Color(1f, 0.8f, 0.5f), 6f, 14f);
            var stage = GameObject.CreatePrimitive(PrimitiveType.Cube);
            stage.transform.SetParent(world, false); stage.transform.position = new Vector3(0, 0.2f, 38f);
            stage.transform.localScale = new Vector3(3f, 0.4f, 3f);
            stage.GetComponent<Renderer>().sharedMaterial = Proc.Opaque(Palette.Base * 0.9f, Color.black);

            // 那个人 warm presence
            AddPoint(new Vector3(2.5f, 1.6f, 51f), new Color(1f, 0.55f, 0.3f), 4.5f, 9f);

            // 出租车 seat + cold light
            var seat = GameObject.CreatePrimitive(PrimitiveType.Cube);
            seat.transform.SetParent(world, false); seat.transform.position = new Vector3(0, 0.5f, 57f);
            seat.transform.localScale = new Vector3(2.4f, 1f, 1.6f);
            seat.GetComponent<Renderer>().sharedMaterial = Proc.Opaque(Palette.Base, Color.black, 0.2f);
            AddPoint(new Vector3(3f, 2f, 57f), Palette.Mist * 2f, 3.5f, 10f);

            // cold rim light over bridge
            AddPoint(new Vector3(0, 4f, 20f), Palette.Mist * 2f, 4f, 16f);

            // memory shard (grabbable) at the bridge
            var dz = new GameObject("DropZone").transform;
            dz.SetParent(world, false); dz.position = new Vector3(0, 0.8f, 20f);
            dropZone = dz;

            var orbGO = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            orbGO.name = "MemoryShard"; orbGO.transform.SetParent(world, false);
            orbGO.transform.position = new Vector3(0f, 1.2f, 18.4f);
            orbGO.transform.localScale = Vector3.one * 0.22f;
            orbGO.GetComponent<Renderer>().material = Proc.Opaque(Palette.Gold, Palette.Gold * 2.6f);
            orb = orbGO.AddComponent<Grabbable>();
            orb.dropZone = dropZone;

            // beats along the +Z path
            beats = new[]
            {
                Bt(0,4,    ExperienceDirector.L_STATION,  BeatKind.Narration),
                Bt(0,12,   ExperienceDirector.L_CBD,      BeatKind.Narration),
                Bt(0,20,   ExperienceDirector.L_BRIDGE,   BeatKind.Bridge),
                Bt(0,30,   ExperienceDirector.L_OVERLOOK, BeatKind.Narration),
                Bt(0,38,   ExperienceDirector.L_SET,      BeatKind.Narration),
                Bt(0,46,   ExperienceDirector.Q,          BeatKind.Choice),
                Bt(2.5f,51,"",                            BeatKind.TheOne),
                Bt(0,57,   ExperienceDirector.L_TAXI,     BeatKind.Narration),
                Bt(0,64,   "",                            BeatKind.End),
            };
            theOne = beats[6];
            choiceAnchor = beats[5].anchor;
            worldNarrationStart = beats[0].anchor;
        }

        Beat Bt(float x, float z, string text, BeatKind kind)
        {
            var a = new GameObject("Beat_" + kind + "_" + z).transform;
            a.SetParent(world, false); a.position = new Vector3(x, 0, z);
            return new Beat { anchor = a, text = text, kind = kind, radius = 4.5f };
        }

        void AddPoint(Vector3 pos, Color color, float intensity, float range)
        {
            var l = new GameObject("Point").AddComponent<Light>();
            l.transform.SetParent(world, false); l.transform.position = pos;
            l.type = LightType.Point; l.color = color; l.intensity = intensity; l.range = range;
        }

        Material MonolithMat()
        {
            var win = Proc.Windows();
            var m = new Material(Shader.Find("Standard"));
            m.color = new Color(0.06f, 0.06f, 0.08f);
            m.mainTexture = win;
            m.SetFloat("_Glossiness", 0.2f);
            m.EnableKeyword("_EMISSION");
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            m.SetTexture("_EmissionMap", win);
            m.SetColor("_EmissionColor", Color.white * 1.2f);
            return m;
        }

        // ----------------------------------------------------------------- particles
        void BuildParticles()
        {
            FX.LightSea(world, new Vector3(0, 2.5f, 40f), new Vector3(60, 10, 28), 320,
                        new Color(1f, 0.72f, 0.42f), new Color(0.6f, 0.78f, 1f));
            FX.Dust(world, new Vector3(0, 2.5f, 24f), new Vector3(36, 6, 50), 140);
            FX.CarStreaks(world, new Vector3(0, 1.4f, 20f), Vector3.right, 12f);
        }

        // ----------------------------------------------------------------- audio
        ProceduralAudio BuildAudio()
        {
            var go = new GameObject("Audio");
            go.AddComponent<AudioSource>();
            return go.AddComponent<ProceduralAudio>();
        }

        // ----------------------------------------------------------------- UI
        UIController BuildUI(out ChoiceMenu choice, Transform choiceAnchor)
        {
            var ui = new GameObject("UI").AddComponent<UIController>();

            // --- Overlay canvas ---
            var ov = NewCanvas("OverlayCanvas", RenderMode.ScreenSpaceOverlay);
            ui.grain = AddRaw(ov, "Grain", Proc.Noise(), new Color(1, 1, 1, 0.05f));
            ui.grain.uvRect = new Rect(0, 0, 4, 4);
            AddImageStretch(ov, "Vignette", vignetteSpr, Color.white);

            // title
            var title = new GameObject("Title"); title.transform.SetParent(ov, false);
            var trt = RT(title); Stretch(trt);
            ui.titleGroup = title.AddComponent<CanvasGroup>();
            ui.titleMain = Lbl(title.transform, "地球 ONLINE", 86, Palette.Ivory, TextAnchor.MiddleCenter,
                               new Vector2(0.5f, 0.56f), new Vector2(1200, 140));
            ui.titleSub = Lbl(title.transform, "副本 #047 — 北京 · 北京", 34, Palette.Gold, TextAnchor.MiddleCenter,
                              new Vector2(0.5f, 0.47f), new Vector2(1200, 80));

            // subtitle, hint, crosshair
            ui.subtitle = Lbl(ov, "", 36, Palette.Ivory, TextAnchor.LowerCenter, new Vector2(0.5f, 0.12f), new Vector2(1500, 200));
            ui.hint = Lbl(ov, "", 24, Palette.Ivory.A(0.5f), TextAnchor.LowerLeft, new Vector2(0.12f, 0.05f), new Vector2(1100, 60));
            var cross = AddImage(ov, "Crosshair", dotSpr, Palette.Seal.A(0.7f), new Vector2(0.5f, 0.5f), new Vector2(10, 10));
            ui.crosshair = cross;

            // fader (black), then couplet on top
            var fade = AddImageStretch(ov, "Fader", whiteSpr, new Color(0.02f, 0.012f, 0.016f, 0f));
            fade.raycastTarget = false; ui.fader = fade;
            var coup = new GameObject("Couplet"); coup.transform.SetParent(ov, false); Stretch(RT(coup));
            ui.coupletGroup = coup.AddComponent<CanvasGroup>(); ui.coupletGroup.alpha = 0;
            ui.coupletA = Lbl(coup.transform, "", 46, Palette.Seal, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.54f), new Vector2(1400, 100));
            ui.coupletB = Lbl(coup.transform, "", 46, Palette.Seal, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.46f), new Vector2(1400, 100));

            // --- WorldSpace narration ---
            var wGO = new GameObject("WorldNarration");
            var wc = wGO.AddComponent<Canvas>(); wc.renderMode = RenderMode.WorldSpace;
            var wrt = wGO.GetComponent<RectTransform>(); wrt.sizeDelta = new Vector2(1000, 420);
            wGO.transform.localScale = Vector3.one * 0.004f;
            wGO.transform.position = new Vector3(0, 1.7f, 6f);
            ui.worldGroup = wGO.AddComponent<CanvasGroup>(); ui.worldGroup.alpha = 0;
            ui.worldText = Lbl(wGO.transform, "", 54, Palette.Ivory, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(960, 400));
            ui.worldText.fontStyle = FontStyle.Normal;

            // --- WorldSpace choice menu ---
            choice = BuildChoice(choiceAnchor);

            return ui;
        }

        ChoiceMenu BuildChoice(Transform anchor)
        {
            var go = new GameObject("ChoiceMenu");
            var c = go.AddComponent<Canvas>(); c.renderMode = RenderMode.WorldSpace;
            var rt = go.GetComponent<RectTransform>(); rt.sizeDelta = new Vector2(1000, 760);
            go.transform.localScale = Vector3.one * 0.004f;
            go.transform.position = anchor.position + new Vector3(0, 1.7f, 1.5f);
            var menu = go.AddComponent<ChoiceMenu>();

            Lbl(go.transform, ExperienceDirector.Q, 52, Palette.Ivory, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.86f), new Vector2(960, 120));

            string[] keys = { "A", "B", "C", "D" };
            string[] txt = { ExperienceDirector.OPT_A, ExperienceDirector.OPT_B, ExperienceDirector.OPT_C, ExperienceDirector.OPT_D };
            var opts = new ChoiceOption[4];
            for (int i = 0; i < 4; i++)
            {
                var oGO = new GameObject("Opt_" + keys[i]); oGO.transform.SetParent(go.transform, false);
                var ort = RT(oGO); ort.anchorMin = ort.anchorMax = new Vector2(0.5f, 0.5f);
                ort.pivot = new Vector2(0.5f, 0.5f); ort.sizeDelta = new Vector2(880, 120);
                ort.anchoredPosition = new Vector2(0, 150 - i * 150);
                var bg = oGO.AddComponent<Image>(); bg.sprite = whiteSpr; bg.color = Palette.Base.A(0.35f);
                var lab = Lbl(oGO.transform, keys[i] + "    " + txt[i], 44, Palette.Ivory.A(0.85f), TextAnchor.MiddleCenter,
                              new Vector2(0.5f, 0.5f), new Vector2(840, 110));
                var box = oGO.AddComponent<BoxCollider>(); box.size = new Vector3(880, 120, 10);
                var opt = oGO.AddComponent<ChoiceOption>(); opt.key = keys[i]; opt.background = bg; opt.label = lab;
                opts[i] = opt;
            }
            menu.options = opts;
            return menu;
        }

        // ----------------------------------------------------------------- UI helpers
        Transform NewCanvas(string name, RenderMode mode)
        {
            var go = new GameObject(name);
            var can = go.AddComponent<Canvas>(); can.renderMode = mode;
            if (mode == RenderMode.ScreenSpaceOverlay)
            {
                var sc = go.AddComponent<CanvasScaler>();
                sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                sc.referenceResolution = new Vector2(1920, 1080); sc.matchWidthOrHeight = 0.5f;
            }
            return go.transform;
        }

        RectTransform RT(GameObject go) { return go.GetComponent<RectTransform>() ?? go.AddComponent<RectTransform>(); }
        void Stretch(RectTransform rt) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero; }

        Text Lbl(Transform parent, string text, int size, Color color, TextAnchor anchor, Vector2 anchorPos01, Vector2 sizeDelta)
        {
            var go = new GameObject("Text"); go.transform.SetParent(parent, false);
            var rt = RT(go); rt.anchorMin = rt.anchorMax = anchorPos01; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = sizeDelta; rt.anchoredPosition = Vector2.zero;
            var t = go.AddComponent<Text>();
            t.font = uiFont; t.fontSize = size; t.color = color; t.alignment = anchor; t.text = text;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false; t.lineSpacing = 1.1f;
            return t;
        }

        RawImage AddRaw(Transform parent, string name, Texture tex, Color color)
        {
            var go = new GameObject(name); go.transform.SetParent(parent, false); Stretch(RT(go));
            var r = go.AddComponent<RawImage>(); r.texture = tex; r.color = color; r.raycastTarget = false;
            tex.wrapMode = TextureWrapMode.Repeat;
            return r;
        }

        Image AddImageStretch(Transform parent, string name, Sprite spr, Color color)
        {
            var go = new GameObject(name); go.transform.SetParent(parent, false); Stretch(RT(go));
            var im = go.AddComponent<Image>(); im.sprite = spr; im.color = color; im.raycastTarget = false;
            return im;
        }

        Image AddImage(Transform parent, string name, Sprite spr, Color color, Vector2 anchor01, Vector2 size)
        {
            var go = new GameObject(name); go.transform.SetParent(parent, false);
            var rt = RT(go); rt.anchorMin = rt.anchorMax = anchor01; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = size; rt.anchoredPosition = Vector2.zero;
            var im = go.AddComponent<Image>(); im.sprite = spr; im.color = color; im.raycastTarget = false;
            return im;
        }

        // ----------------------------------------------------------------- assets
        Font LoadFont()
        {
            var f = Resources.Load<Font>("Fonts/NotoSerifSC");
            if (f) return f;
            f = Font.CreateDynamicFontFromOSFont(new[]
            {
                "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "Noto Serif SC",
                "Microsoft YaHei", "Microsoft YaHei UI", "PingFang SC", "Hiragino Sans GB",
                "Heiti SC", "SimHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Arial Unicode MS", "Arial"
            }, 44);
            return f;
        }

        Sprite ToSprite(Texture2D t) => Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(0.5f, 0.5f));
        Sprite SolidSprite(Color c)
        {
            var t = new Texture2D(4, 4); var px = new Color[16];
            for (int i = 0; i < 16; i++) px[i] = c; t.SetPixels(px); t.Apply();
            return ToSprite(t);
        }
    }
}
