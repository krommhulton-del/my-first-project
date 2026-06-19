# 《地球Online · 北京副本 #047》— Unity 交互 VR 大作业 · 上手指南

> 一个**全程序生成**的交互 VR 体验：没有任何外部模型 / 贴图 / 音频文件，几何、材质、粒子、UI、音乐、音效全部运行时由代码搭出来。
> ⚠️ 我（Claude Code）**无法在云端编译 / 上头显验证**，这是**第一刀**。打开后若有编译报错或运行异常，把报错原文发我，我逐条改。

---

## 0. 环境
- **Unity 2022.3 LTS**（建议，例如 2022.3.40f1）。若你装的是 Unity 6，多半也能开，只是包版本会自动升级；真报错就告诉我版本号。
- 渲染管线：**Built-in**（默认，无需 URP/HDRP 设置）。
- 输入：依赖 **legacy Input Manager**（新建项目默认就是）。若 Project Settings ▸ Player ▸ *Active Input Handling* 被设成了 *Input System (New)*，改成 **Both** 或 **Input Manager (Old)**。

## 1. 打开项目
1. Unity Hub ▸ **Add** ▸ 选择仓库里的 `unity/` 文件夹 ▸ 用 2022.3 打开。
2. 首次打开等它把 `Packages/manifest.json` 里的包导入完（XR、UGUI、legacy input helpers 等）。

## 2. （可选但推荐）放一个中文衬线字体
- 不放也能跑：会自动回退到系统中文字体（微软雅黑 / PingFang 等），中文正常显示。
- 想要古早言情那股**宋体**味：下载 **Noto Serif SC**（思源宋体）`.otf`，放到
  `Assets/EarthOS/Resources/Fonts/`，命名 **`NotoSerifSC.otf`**。代码会优先用它。

## 3. 生成场景并运行
- 菜单栏 ▸ **EarthOS ▸ ① 新建并保存「北京副本」场景** ▸ 它会建好 `Assets/EarthOS/Scenes/Beijing.unity` 并加入 Build Settings。
- 按 **▶ Play**。
  - **桌面（无头显，方便录屏）**：`WASD` 走 · 鼠标转视角 · **鼠标左键** = 扳机（选择 / 抓取）· `Esc` 解锁鼠标 · 结尾 `R` 重启。
  - **VR**：见 §4。

## 4. 接头显跑 VR
1. Project Settings ▸ **XR Plug-in Management** ▸ Install ▸ 勾 **OpenXR**（PC 标签页）。
2. OpenXR 设置里加一个 **Interaction Profile**（按你的头显选，如 Oculus Touch / HTC Vive / Index 等）。
3. 连头显（Quest 用 Link / Air Link，或 SteamVR），按 ▶ Play。
   - 左摇杆 移动 · 右摇杆 转身 · **扳机** 选择 / 抓取 · A/X 键 结尾重启。
   - 无头显时项目**自动切桌面模式**，不用改任何东西。

## 5. 录答辩视频
- 桌面模式直接用 **OBS** 或 **Unity Recorder**（Package Manager 装 `com.unity.recorder`）录 Game 视图即可。
- VR 模式录头显画面（Quest 自带录制 / SteamVR mirror + OBS）。

---

## 6. 大作业要求 → 在哪儿实现（答辩用）

| 要求 | 实现位置 |
|---|---|
| **交互 VR 应用** | 整个体验；`SceneBootstrap` 运行时搭建，`PlayerRig` + `TrackedPoseDriver` 提供头/手追踪 |
| **UI · Overlay 模式** | `UIController` 的 ScreenSpaceOverlay 画布：标题卡、底部字幕、准星、提示、胶片颗粒 + 暗角、结尾落款联 |
| **UI · WorldSpace 模式** | 漂浮旁白面板（始终朝向玩家）+ 四选一选项菜单，都是 WorldSpace 画布 |
| **第一人称视角漫游** | `PlayerRig`：VR 左摇杆 / 桌面 WASD+鼠标；沿 +Z 走过 9 个记忆节点 |
| **手柄交互** | `Interactor` 射线：点选四选项、抓取「记忆碎片」放到天桥落点（帧05 愿望）；`XRInputHub` 读扳机/摇杆/按键 |
| **背景音乐** | `ProceduralAudio` 运行时合成 4s 无缝 drone 循环 |
| **交互音效** | 同上：抓取 / 放置 whoosh / 选择 / 结尾低频重击，全程序合成 |
| **粒子系统** | `FX`：万家灯火光海、光束浮尘、天桥车流光带、放愿望与无相散场的粒子爆发 |
| **场景布局** | 钢铁森林（带暖窗发光立面的 monolith 群）、天桥、片场孤光、出租车座、俯瞰光海 |

## 7. 体验流程（节拍）
北京站(旁白) → 钢铁森林(CBD 旁白) → **天桥**(抓起记忆碎片放上落点) → 俯瞰夜景 → 片场金句 → **四选一**「你为什么还留在北京」 → 那个人(随选项变的旁白) → 出租车「良辰美景奈何天」 → **无相散场**(万物炸成粒子→擦黑→落款「你与北京，两不相欠」)→ `R`/按键 重启。

文案 = DS 定稿（`PROJECT.md` §3.3），未改。

## 8. 文件结构
```
unity/
  Packages/manifest.json            依赖
  ProjectSettings/ProjectVersion.txt 目标 2022.3
  Assets/EarthOS/
    Scripts/
      EarthCommon.cs      色板 + 程序化材质/贴图工厂
      ProceduralAudio.cs  程序化 BGM + 音效
      FX.cs               粒子工厂
      XRInputHub.cs       手柄输入(UnityEngine.XR，稳定)
      PlayerRig.cs        第一人称漫游(VR + 桌面回退)
      Interactor.cs       射线交互(手/相机)
      Grabbable.cs        记忆碎片/愿望
      UIController.cs      Overlay + WorldSpace UI
      ChoiceMenu.cs        四选一
      ExperienceDirector.cs 节拍/分支/结尾编排
      SceneBootstrap.cs    运行时搭整个场景（核心）
    Editor/SceneBuilder.cs  一键建场景菜单
```

## 9. 排错速查
- **中文显示成方框** → 系统没找到中文字体，按 §2 放一个 `.otf`。
- **`TrackedPoseDriver` 找不到** → 确认 `com.unity.xr.legacyinputhelpers` 已导入（在 manifest 里）。
- **`UnityEngine.Input` 报错 / 桌面不能动** → Active Input Handling 改成 Both（§0）。
- **VR 里看不到标题/字幕** → 正常：Overlay UI 只在桌面镜像可见；头显里看 WorldSpace 旁白与选项。
- **任何编译报错** → 直接把红字发我，这是第一刀，咱们一条条收。
