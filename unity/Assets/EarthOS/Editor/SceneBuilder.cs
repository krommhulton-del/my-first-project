using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace EarthOS.EditorTools
{
    /// <summary>便捷菜单：一键生成可运行场景。真正的搭建在运行时由 SceneBootstrap 完成。</summary>
    public static class SceneBuilder
    {
        const string ScenePath = "Assets/EarthOS/Scenes/Beijing.unity";

        [MenuItem("EarthOS/① 新建并保存「北京副本」场景")]
        public static void NewScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var go = new GameObject("EarthOS_Bootstrap");
            go.AddComponent<SceneBootstrap>();

            if (!AssetDatabase.IsValidFolder("Assets/EarthOS/Scenes"))
                AssetDatabase.CreateFolder("Assets/EarthOS", "Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);

            var list = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            if (!list.Exists(s => s.path == ScenePath))
                list.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = list.ToArray();

            Debug.Log("[EarthOS] 场景已创建并加入 Build Settings：" + ScenePath + "\n按 ▶ Play 运行（桌面：WASD+鼠标+左键）。");
        }

        [MenuItem("EarthOS/② 仅在当前场景添加 Bootstrap")]
        public static void AddBootstrap()
        {
            var go = new GameObject("EarthOS_Bootstrap");
            go.AddComponent<SceneBootstrap>();
            Selection.activeGameObject = go;
            Debug.Log("[EarthOS] 已添加 Bootstrap。按 ▶ Play 运行。");
        }
    }
}
