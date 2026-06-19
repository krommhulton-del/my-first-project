using UnityEngine;
using UnityEngine.XR;

namespace EarthOS
{
    /// <summary>Thin, version-stable wrapper over UnityEngine.XR.InputDevices (no Input System / XRI dependency).</summary>
    public static class XRInputHub
    {
        public static bool VRActive => XRSettings.isDeviceActive && XRSettings.enabled;

        public static Vector2 Axis(XRNode node)
        {
            var d = InputDevices.GetDeviceAtXRNode(node);
            return d.isValid && d.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 v) ? v : Vector2.zero;
        }

        public static bool Trigger(XRNode node)
        {
            var d = InputDevices.GetDeviceAtXRNode(node);
            return d.isValid && d.TryGetFeatureValue(CommonUsages.triggerButton, out bool b) && b;
        }

        public static bool Grip(XRNode node)
        {
            var d = InputDevices.GetDeviceAtXRNode(node);
            return d.isValid && d.TryGetFeatureValue(CommonUsages.gripButton, out bool b) && b;
        }

        public static bool Primary(XRNode node)
        {
            var d = InputDevices.GetDeviceAtXRNode(node);
            return d.isValid && d.TryGetFeatureValue(CommonUsages.primaryButton, out bool b) && b;
        }
    }
}
