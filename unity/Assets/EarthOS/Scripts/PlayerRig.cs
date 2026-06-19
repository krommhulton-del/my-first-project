using UnityEngine;
using UnityEngine.XR;
using UnityEngine.SpatialTracking;

namespace EarthOS
{
    /// <summary>
    /// 第一人称漫游。VR：左摇杆平移 / 右摇杆转向（TrackedPoseDriver 负责头与手的姿态）。
    /// 无头显时自动切桌面模式：WASD + 鼠标视角 + 鼠标左键=扳机，方便在 PC 上运行与录屏。
    /// </summary>
    public class PlayerRig : MonoBehaviour
    {
        [Header("Refs (auto-wired by SceneBuilder)")]
        public Camera cam;
        public Transform leftHand;
        public Transform rightHand;

        [Header("Tuning")]
        public float moveSpeed = 2.4f;
        public float snapAngle = 30f;
        public float mouseSens = 2.2f;
        public float eyeHeight = 1.6f;

        public bool IsVR { get; private set; }
        float pitch;
        bool snapped;

        void Start()
        {
            IsVR = XRInputHub.VRActive;
            if (!IsVR)
            {
                // desktop: disable pose drivers, set seated eye height, capture mouse
                DisablePoseDrivers();
                if (cam) cam.transform.localPosition = new Vector3(0f, eyeHeight, 0f);
                if (leftHand) leftHand.gameObject.SetActive(false);
                if (rightHand) rightHand.gameObject.SetActive(false);
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
        }

        void DisablePoseDrivers()
        {
            foreach (var d in GetComponentsInChildren<TrackedPoseDriver>(true)) d.enabled = false;
        }

        void Update()
        {
            if (cam == null) return;
            if (IsVR) UpdateVR(); else UpdateDesktop();
        }

        void UpdateVR()
        {
            Vector2 m = XRInputHub.Axis(XRNode.LeftHand);
            Vector3 fwd = Vector3.ProjectOnPlane(cam.transform.forward, Vector3.up).normalized;
            Vector3 right = Vector3.ProjectOnPlane(cam.transform.right, Vector3.up).normalized;
            transform.position += (fwd * m.y + right * m.x) * moveSpeed * Time.deltaTime;

            float tx = XRInputHub.Axis(XRNode.RightHand).x;
            if (Mathf.Abs(tx) > 0.7f) { if (!snapped) { transform.RotateAround(cam.transform.position, Vector3.up, snapAngle * Mathf.Sign(tx)); snapped = true; } }
            else snapped = false;
        }

        void UpdateDesktop()
        {
            if (Cursor.lockState == CursorLockMode.Locked)
            {
                float yaw = Input.GetAxisRaw("Mouse X") * mouseSens;
                pitch = Mathf.Clamp(pitch - Input.GetAxisRaw("Mouse Y") * mouseSens, -80f, 80f);
                transform.Rotate(0f, yaw, 0f, Space.World);
                cam.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
            }
            Vector3 fwd = Vector3.ProjectOnPlane(transform.forward, Vector3.up).normalized;
            Vector3 right = transform.right;
            float z = (Input.GetKey(KeyCode.W) ? 1 : 0) - (Input.GetKey(KeyCode.S) ? 1 : 0);
            float x = (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0);
            float sp = moveSpeed * (Input.GetKey(KeyCode.LeftShift) ? 1.9f : 1f);
            transform.position += (fwd * z + right * x) * sp * Time.deltaTime;

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                bool locked = Cursor.lockState == CursorLockMode.Locked;
                Cursor.lockState = locked ? CursorLockMode.None : CursorLockMode.Locked;
                Cursor.visible = locked;
            }
        }
    }
}
