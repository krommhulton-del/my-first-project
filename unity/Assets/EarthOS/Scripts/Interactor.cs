using UnityEngine;
using UnityEngine.XR;

namespace EarthOS
{
    /// <summary>Anything the pointer can hover / select (choice options, grabbables).</summary>
    public interface IGazeTarget
    {
        void OnHoverEnter();
        void OnHoverExit();
        void OnSelect(Interactor by);
    }

    /// <summary>
    /// 手柄交互核心：从手（VR）或相机（桌面）发射射线，悬停高亮 + 扳机选择 + 抓取记忆碎片。
    /// </summary>
    public class Interactor : MonoBehaviour
    {
        public bool desktopInteractor;     // true = camera ray (no headset); false = VR hand
        public XRNode node = XRNode.RightHand;
        public Camera cam;
        public float maxDist = 6f;
        public float holdDist = 1.1f;

        LineRenderer line;
        IGazeTarget hover;
        Grabbable held;
        bool prevSelect;

        void Start()
        {
            bool vr = XRInputHub.VRActive;
            if (desktopInteractor && vr) { enabled = false; return; }
            if (!desktopInteractor && !vr) { gameObject.SetActive(false); return; }

            if (!desktopInteractor)
            {
                line = gameObject.AddComponent<LineRenderer>();
                line.widthMultiplier = 0.004f;
                line.material = Proc.Additive(Proc.RadialGlow(32, 1f), Palette.Gold.A(0.8f));
                line.positionCount = 2;
                line.useWorldSpace = true;
                line.numCapVertices = 2;
            }
        }

        void RayOriginDir(out Vector3 o, out Vector3 d)
        {
            if (desktopInteractor && cam) { o = cam.transform.position; d = cam.transform.forward; }
            else { o = transform.position; d = transform.forward; }
        }

        bool SelectHeld()
        {
            return desktopInteractor ? Input.GetMouseButton(0) : XRInputHub.Trigger(node);
        }

        void Update()
        {
            RayOriginDir(out Vector3 o, out Vector3 d);
            bool hit = Physics.Raycast(o, d, out RaycastHit info, maxDist);
            IGazeTarget tgt = hit ? info.collider.GetComponentInParent<IGazeTarget>() : null;

            if (tgt != hover)
            {
                hover?.OnHoverExit();
                hover = tgt;
                hover?.OnHoverEnter();
            }

            if (line)
            {
                line.enabled = true;
                line.SetPosition(0, o);
                line.SetPosition(1, hit ? info.point : o + d * maxDist);
            }

            bool sel = SelectHeld();
            bool down = sel && !prevSelect;
            bool up = !sel && prevSelect;
            prevSelect = sel;

            if (down)
            {
                if (held == null && tgt is Grabbable g) { held = g; g.OnGrabBegin(); }
                else if (held == null) tgt?.OnSelect(this);
            }

            if (held != null)
            {
                Vector3 p = desktopInteractor && cam ? cam.transform.position + cam.transform.forward * holdDist
                                                     : transform.position + transform.forward * 0.04f;
                held.FollowTo(p);
                if (up) { held.OnGrabEnd(); held = null; }
            }
        }
    }
}
