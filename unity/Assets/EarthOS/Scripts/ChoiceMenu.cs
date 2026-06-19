using System;
using UnityEngine;
using UnityEngine.UI;

namespace EarthOS
{
    /// <summary>帧08 互动选项 —— WorldSpace 四选一，手柄/鼠标射线点选。</summary>
    public class ChoiceMenu : MonoBehaviour
    {
        public ChoiceOption[] options;
        public Camera cam;
        Action<string> onChosen;
        bool done;

        void Awake() { gameObject.SetActive(false); }

        public void Show(Action<string> chosen)
        {
            onChosen = chosen; done = false;
            gameObject.SetActive(true);
            foreach (var o in options) o.Reset(this);
        }

        void Update()
        {
            if (cam) transform.rotation = cam.transform.rotation;   // billboard
        }

        public void Pick(string key, ChoiceOption picked)
        {
            if (done) return;
            done = true;
            ProceduralAudio.Instance?.PlaySelect();
            foreach (var o in options) if (o != picked) o.Dim();
            picked.Highlight(true);
            onChosen?.Invoke(key);
            Invoke(nameof(Close), 1.4f);
        }

        void Close() { gameObject.SetActive(false); }
    }

    /// <summary>单个选项面板（带 BoxCollider 供射线命中）。</summary>
    public class ChoiceOption : MonoBehaviour, IGazeTarget
    {
        public string key = "A";
        public Image background;
        public Text label;
        ChoiceMenu menu;

        public void Reset(ChoiceMenu m)
        {
            menu = m;
            if (background) background.color = Palette.Base.A(0.35f);
            if (label) label.color = Palette.Ivory.A(0.85f);
        }

        public void OnHoverEnter()
        {
            if (background) background.color = Palette.Wine.A(0.5f);
            if (label) label.color = Palette.Seal;
        }

        public void OnHoverExit()
        {
            if (background) background.color = Palette.Base.A(0.35f);
            if (label) label.color = Palette.Ivory.A(0.85f);
        }

        public void OnSelect(Interactor by) { menu?.Pick(key, this); }

        public void Highlight(bool on)
        {
            if (label) label.color = on ? Palette.Seal : Palette.Ivory.A(0.85f);
            if (background) background.color = on ? Palette.Gold.A(0.4f) : Palette.Base.A(0.35f);
        }

        public void Dim()
        {
            if (background) background.color = Palette.Base.A(0.12f);
            if (label) label.color = Palette.Ivory.A(0.2f);
        }
    }
}
