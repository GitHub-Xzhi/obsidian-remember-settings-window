# Remember Settings Window

[中文](README-ZH.md) | **English**

An [Obsidian](https://obsidian.md) plugin that remembers the size and position of the **settings popout window** (introduced in Obsidian 1.13.0), and restores them automatically next time you open it.

## 📖 Background

Starting from Obsidian 1.13.0, Settings can open in a separate window instead of a modal dialog (toggle via **Settings → Interface → Open settings in new window**). However, the window always opens with a default size and position, and any manual adjustments are lost after closing.

This plugin solves that problem.

## ✨ Features

| Feature | Description |
|---|---|
| Remember window size | Saves the settings window size after drag-resizing |
| Remember window position | Saves the settings window position after drag-moving |
| Default size | Configurable default width & height, used when "remember size" is off |
| Multi-language | Supports English and Chinese, extensible via JSON locale files |

## 📦 Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian → **Settings → Community plugins**
2. Click **Browse** and search for **Remember Settings Window**
3. Click **Install**, then **Enable**

### From GitHub Releases

1. Download `main.js` and `manifest.json` from the latest [release](../../releases)
2. Place them in `<vault>/.obsidian/plugins/obsidian-remember-settings-window/`
3. Restart Obsidian and enable the plugin in **Settings → Community plugins**

### From source

1. Clone this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Copy the contents of the `dist/` folder into your vault's plugin directory:
   ```
   <vault>/.obsidian/plugins/obsidian-remember-settings-window/
   ```
4. Restart Obsidian and enable **Remember Settings Window**

## 🚀 Usage

After enabling the plugin, open its settings panel (**Settings → Community plugins → Remember Settings Window**):

| Setting | Description |
|---|---|
| Language | Choose display language (Auto follows your system locale) |
| Remember window size | Toggle on/off. When on, the settings window reopens with the last drag-resized dimensions |
| Remember window position | Toggle on/off. When on, the settings window reopens at the last drag-moved screen position |
| Default width / height | The size applied when "remember size" is off |

All settings take effect the next time the settings window opens.

## 🌐 Language / i18n

The plugin loads language files **in real-time** from the `locale/` directory inside the plugin folder. New language files are detected automatically when you open the settings panel — **no restart or reload needed**.

### Built-in languages

| File | `_displayName` | Language |
|---|---|---|
| `en.json` | `English` | English |
| `zh-cn.json` | `简体中文` | Simplified Chinese |

These files are bundled in `locale/` when you install the plugin.

### Adding a new language

1. Navigate to your plugin's `locale/` directory:
   ```
   <vault>/.obsidian/plugins/obsidian-remember-settings-window/locale/
   ```
2. Create a new JSON file named `<code>.json` (e.g. `ja.json` for Japanese, `fr.json` for French)
3. Add a `_displayName` field with the language's native name, then translate all other keys (copy from `en.json` as reference)
4. Open the plugin settings panel — your new language will appear in the dropdown automatically

Example `ja.json`:
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

> **Tip:** If you create a translation, consider submitting a pull request so it can be bundled as a built-in language!

## ⚙️ Configuration files

| File | Purpose |
|---|---|
| `data.json` | Plugin settings: language, toggles, and default dimensions |
| `window-geometry.json` | Saved window bounds — auto-generated on first load |
| `locale/*.json` | Language files — auto-copied on first load, user-extensible |

## 🔧 How it works

1. On plugin load, monkey-patch `app.setting.open` to intercept settings window creation.
2. When the settings window opens, compare `BrowserWindow.getAllWindows()` against known window IDs to identify the new window.
3. Attach Electron `resize` / `move` event listeners to capture geometry changes in real-time.
4. On `resize-ended` / `move-ended` (drag finished), persist the bounds to `window-geometry.json` with debouncing.
5. Next time the settings window opens, apply saved or default geometry via `setBounds()`.

## 📋 Requirements

- Obsidian 1.13.0+（设置独立窗口功能从此版本开始支持）
- Desktop only (the plugin relies on the Electron API)

## 🛠️ Development

```bash
npm install
npm run dev     # Watch mode, output to dist/
npm run build   # Production build, output to dist/
```

## 📄 License

[MIT](LICENSE) © [Xzhi](https://github.com/GitHub-Xzhi/)

## 💖 Support

If you enjoy this plugin and want to say thanks, you can buy me a bubble tea!

|             **WeChat Pay**              |           **WeChat Tip**           |              **Alipay**              |
| :-------------------------------: | :------------------------------: | :----------------------------------: |
| ![WeChat Pay](assets/README/wx_fkm.png) | ![WeChat Tip](assets/README/wxzsm.png) | ![Alipay](assets/README/zfb_fkm.png) |
