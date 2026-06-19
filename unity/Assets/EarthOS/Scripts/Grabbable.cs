using UnityEngine;

namespace EarthOS
{
    /// <summary>
    /// 记忆碎片 / 愿望。可被手柄抓起、移动、释放。
    /// 若释放在「天桥落点」范围内 → 触发「把愿望搁在桥上」(帧05)，化作车流消散。
    /// </summary>
    public class Grabbable : MonoBehaviour, IGazeTarget
    {
        public Transform dropZone;        // 天桥落点 (set by SceneBuilder)
        public float dropRadius = 1.4f;
        public System.Action onPlaced;    // wired by ExperienceDirector

        Vector3 home;
        bool held, placed, returning;
        Renderer rend;
        Color baseEmis;
        float bob;

        void Start()
        {
            home = transform.position;
            rend = GetComponentInChildren<Renderer>();
            if (rend) baseEmis = rend.material.GetColor("_EmissionColor");
        }

        void Update()
        {
            if (placed) return;
            if (!held)
            {
                bob += Time.deltaTime;
                if (returning)
                {
                    transform.position = Vector3.Lerp(transform.position, home, Time.deltaTime * 3f);
                    if (Vector3.Distance(transform.position, home) < 0.02f) returning = false;
                }
                else
                {
                    transform.position = home + Vector3.up * Mathf.Sin(bob * 1.6f) * 0.05f;
                }
                transform.Rotate(Vector3.up, 18f * Time.deltaTime, Space.World);
            }
        }

        public void FollowTo(Vector3 p) { transform.position = p; }

        public void OnGrabBegin()
        {
            held = true; returning = false;
            ProceduralAudio.Instance?.PlayGrab();
            Pulse(2.4f);
        }

        public void OnGrabEnd()
        {
            held = false;
            if (dropZone && Vector3.Distance(transform.position, dropZone.position) <= dropRadius) Place();
            else returning = true;
        }

        void Place()
        {
            placed = true;
            ProceduralAudio.Instance?.PlayWhoosh();
            onPlaced?.Invoke();
            FX.Burst(transform.position, Palette.Gold, 60);
            Destroy(gameObject, 0.05f);
        }

        public void OnHoverEnter() => Pulse(1.8f);
        public void OnHoverExit() { if (rend) rend.material.SetColor("_EmissionColor", baseEmis); }
        public void OnSelect(Interactor by) { }   // grab handled via OnGrabBegin

        void Pulse(float mul) { if (rend) rend.material.SetColor("_EmissionColor", baseEmis * mul); }
    }
}
