# Remember Settings Window

**中文** | [English](README.md)

一个 [Obsidian](https://obsidian.md) 插件，用于记住**设置独立窗口**（Obsidian 1.13.0 新增功能）的尺寸和位置，下次打开时自动恢复。

## 📖 背景

从 Obsidian 1.13.0 开始，设置面板可以在独立窗口中打开（通过 **设置 → 界面 → 在新窗口中打开设置** 切换）。但这个窗口每次打开都是默认大小和位置，手动调整后的结果在关闭后不会被保留。

这个插件就是为了解决这个问题。

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 记住窗口大小 | 拖拽调整设置窗口大小后自动保存 |
| 记住窗口位置 | 拖拽移动设置窗口位置后自动保存 |
| 默认尺寸 | 可配置默认宽高，在「记住大小」未开启时使用 |
| 多语言 | 支持英文和中文，可通过 JSON 文件扩展其他语言 |

## 📦 安装

### 从 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian → **设置 → 第三方插件**
2. 点击 **浏览**，搜索 **Remember Settings Window**
3. 点击 **安装**，然后 **启用**

### 从 GitHub Releases 安装

1. 从最新 [release](../../releases) 下载 `main.js` 和 `manifest.json`
2. 放入 `<vault>/.obsidian/plugins/obsidian-remember-settings-window/`
3. 重启 Obsidian，在 **设置 → 第三方插件** 中启用

### 从源码构建

1. 克隆本仓库
2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
3. 将 `dist/` 目录中的文件复制到仓库插件目录：
   ```
   <vault>/.obsidian/plugins/obsidian-remember-settings-window/
   ```
4. 重启 Obsidian 并启用插件

## 🚀 使用方法

启用插件后，打开插件设置面板（**设置 → 第三方插件 → Remember Settings Window**）：

| 设置项 | 说明 |
|---|---|
| 语言 | 选择显示语言（「自动」会跟随系统语言） |
| 记住拖拽调整后的窗口大小 | 开启后，设置窗口会以最后一次拖拽调整的尺寸打开 |
| 记住拖拽调整后的窗口位置 | 开启后，设置窗口会以最后一次拖拽移动的位置打开 |
| 默认宽度 / 默认高度 | 当「记住大小」未开启时使用的窗口尺寸 |

所有设置在下次打开设置窗口时生效。

## 🌐 语言 / 国际化

插件**实时**从插件目录下的 `locale/` 文件夹加载语言文件。新增语言文件后打开设置面板即可自动识别，**无需重启或重新加载插件**。

### 内置语言

| 文件 | `_displayName` | 语言 |
|---|---|---|
| `en.json` | `English` | 英文 |
| `zh-cn.json` | `简体中文` | 简体中文 |

这些文件在安装插件时已包含在 `locale/` 目录中。

### 添加新语言

1. 打开插件的 `locale/` 目录：
   ```
   <vault>/.obsidian/plugins/obsidian-remember-settings-window/locale/
   ```
2. 新建 `<代码>.json` 文件（如 `ja.json` 代表日语，`fr.json` 代表法语）
3. 添加 `_displayName` 字段填写语言的原生名称，然后翻译其他所有键（可参考 `en.json`）
4. 打开插件设置面板 — 新语言会自动出现在下拉菜单中

示例 `ja.json`：
```json
{
    "_displayName": "日本語",
    "settingRememberSize": "リサイズ後のウィンドウサイズを記憶",
    "settingRememberSizeDesc": "有効にすると、設定ウィンドウのサイズが記憶され、次回開いた時に復元されます。",
    "settingRememberPosition": "移動後のウィンドウ位置を記憶",
    "settingRememberPositionDesc": "有効にすると、設定ウィンドウの位置が記憶され、次回開いた時に復元されます。",
    "defaultSizeHeader": "デフォルトのウィンドウサイズ",
    "defaultSizeDesc": "「リサイズ後のウィンドウサイズを記憶」が無効の場合、以下のサイズが使用されます。",
    "defaultWidth": "デフォルトの幅",
    "defaultHeight": "デフォルトの高さ",
    "language": "言語",
    "languageDesc": "プラグインの表示言語を選択します。",
    "languageAuto": "自動（システムに従う）",
    "enabled": "有効",
    "disabled": "無効"
}
```

> **提示：** 如果你创建了翻译，欢迎提交 Pull Request，将其作为内置语言打包！

## ⚙️ 配置文件

| 文件 | 用途 |
|---|---|
| `data.json` | 插件设置：语言、开关状态和默认尺寸 |
| `window-geometry.json` | 保存的窗口边界 — 首次加载时自动生成 |
| `locale/*.json` | 语言文件 — 首次加载时自动复制，用户可自行扩展 |

## 🔧 工作原理

1. 插件加载时，monkey-patch `app.setting.open` 以拦截设置窗口的创建
2. 当设置窗口打开时，通过对比 `BrowserWindow.getAllWindows()` 与已知窗口 ID 来识别新窗口
3. 在设置窗口上绑定 Electron 的 `resize` / `move` 事件，实时捕获几何变化
4. 在 `resize-ended` / `move-ended`（拖拽结束）时，防抖写入 `window-geometry.json`
5. 下次设置窗口打开时，通过 `setBounds()` 应用保存的或默认的几何数据

## 📋 要求

- Obsidian 1.13.0+（设置独立窗口功能从此版本开始支持）
- 仅桌面端（依赖 Electron API）

## 🛠️ 开发

```bash
npm install
npm run dev     # 开发模式（监听变化，输出到 dist/）
npm run build   # 生产构建（压缩，输出到 dist/）
```

## 📄 许可证

[MIT](LICENSE) © [Xzhi](https://github.com/GitHub-Xzhi/)

## 💖支持

如果你喜欢这个插件，并对我表示感谢，你可以在这里请我喝一杯奶茶！

|             **微信**              |           **微信赞赏**           |              **支付宝**              |
| :-------------------------------: | :------------------------------: | :----------------------------------: |
| ![微信收款码](assets/README/wx_fkm.png) | ![微信赞赏码](assets/README/wxzsm.png) | ![支付宝收款码](assets/README/zfb_fkm.png) |