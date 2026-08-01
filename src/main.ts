import {
    Plugin,
    PluginSettingTab,
    Setting,
    App,
    debounce,
} from "obsidian";

/**
 * 内置默认语言数据
 * 仅用于首次安装时自动创建 locale/en.json 和 locale/zh-cn.json
 * 后续由 locale/ 目录中的 JSON 文件接管，用户可自由编辑
 */
const LOCALE_DEFAULTS: Record<string, Record<string, string>> = {
    "en": {
        "_displayName": "English",
        "settingRememberSize": "Remember window size after resizing",
        "settingRememberSizeDesc": "When enabled, the settings window size will be remembered (stored in window-geometry.json) and restored next time.",
        "settingRememberPosition": "Remember window position after moving",
        "settingRememberPositionDesc": "When enabled, the settings window position will be remembered (stored in window-geometry.json) and restored next time.",
        "defaultSizeHeader": "Default window size",
        "defaultSizeDesc": "When \"Remember window size after resizing\" is off, the following dimensions are used as the default window size.",
        "defaultWidth": "Default width",
        "defaultHeight": "Default height",
        "language": "Language",
        "languageDesc": "Select the display language for this plugin.",
        "languageAuto": "Auto (follow system)",
        "enabled": "Enabled",
        "disabled": "Disabled",
    },
    "zh-cn": {
        "_displayName": "简体中文",
        "settingRememberSize": "记住拖拽调整后的窗口大小",
        "settingRememberSizeDesc": "开启后，拖拽调整设置窗口大小的操作会被记住（存储在 window-geometry.json），下次打开时使用该尺寸。",
        "settingRememberPosition": "记住拖拽调整后的窗口位置",
        "settingRememberPositionDesc": "开启后，拖拽移动设置窗口位置的操作会被记住（存储在 window-geometry.json），下次打开时使用该位置。",
        "defaultSizeHeader": "窗口默认大小",
        "defaultSizeDesc": "当「记住拖拽调整后的窗口大小」未开启时，使用以下尺寸作为设置窗口的默认大小。",
        "defaultWidth": "默认宽度",
        "defaultHeight": "默认高度",
        "language": "语言",
        "languageDesc": "选择插件的显示语言。",
        "languageAuto": "自动（跟随系统）",
        "enabled": "已启用",
        "disabled": "已禁用",
    },
};

// ═══════════════════════════════════════════════════════════════════
//  Electron 类型声明（Obsidian 基于 Electron，此处声明窗口 API 的类型）
// ═══════════════════════════════════════════════════════════════════

/** 窗口的几何信息（位置和尺寸） */
interface ElectronBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Electron BrowserWindow 的简化类型声明 */
interface ElectronWindow {
    id: number;
    getBounds(): ElectronBounds;
    setBounds(b: Partial<ElectronBounds>): void;
    on(event: string, cb: () => void): void;
    removeListener(event: string, cb: () => void): void;
    isDestroyed(): boolean;
}

// ═══════════════════════════════════════════════════════════════════
//  插件设置类型（存储在 data.json 中，用户通过设置面板修改）
// ═══════════════════════════════════════════════════════════════════

interface SettingsWindowSettings {
    /** 显示语言："auto" 表示跟随系统，否则为具体 locale code */
    language: string;
    /** 是否记住拖拽调整后的窗口大小 */
    rememberSize: boolean;
    /** 是否记住拖拽调整后的窗口位置 */
    rememberPosition: boolean;
    /** 默认窗口宽度（当不记住大小时使用） */
    defaultWidth: number;
    /** 默认窗口高度（当不记住大小时使用） */
    defaultHeight: number;
}

/** 插件默认设置 */
const DEFAULT_SETTINGS: SettingsWindowSettings = {
    language: "auto",
    rememberSize: true,
    rememberPosition: true,
    defaultWidth: 1000,
    defaultHeight: 800,
};

// ═══════════════════════════════════════════════════════════════════
//  窗口几何数据（存储在 window-geometry.json 中，由插件自动维护）
// ═══════════════════════════════════════════════════════════════════

/** 窗口几何信息 */
interface WindowGeometry {
    width: number;
    height: number;
    x: number;
    y: number;
}

/** 几何数据文件名（存放在插件目录下，与 data.json 分开存储） */
const GEOMETRY_FILE = "window-geometry.json";

/** 几何数据中设置窗口对应的键名 */
const GEOMETRY_KEY  = "settings";

// ═══════════════════════════════════════════════════════════════════
//  i18n 常量
// ═══════════════════════════════════════════════════════════════════

/** locale 文件存放的子目录名 */
const LOCALE_DIR = "locale";

/** JSON 中用于指定语言显示名称的特殊字段 */
const DISPLAY_NAME_KEY = "_displayName";

// ═══════════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取 Electron 模块引用
 * Obsidian 的渲染进程中可通过 window.require("electron") 访问
 */
function getElectron(): any | null {
    try {
        return (window as any).require("electron");
    } catch {
        return null;
    }
}

/**
 * 获取当前所有 Electron 浏览器窗口
 * 兼容 Electron >= 28（@electron/remote）和旧版 remote API
 */
function getAllBrowserWindows(): ElectronWindow[] {
    try {
        const electron = getElectron();
        if (!electron) return [];
        if (electron.BrowserWindow?.getAllWindows) {
            return electron.BrowserWindow.getAllWindows() as ElectronWindow[];
        }
        if (electron.remote?.BrowserWindow?.getAllWindows) {
            return electron.remote.BrowserWindow.getAllWindows() as ElectronWindow[];
        }
    } catch {}
    return [];
}

// ═══════════════════════════════════════════════════════════════════
//  插件主类
// ═══════════════════════════════════════════════════════════════════
export default class RememberSettingsWindowPlugin extends Plugin {
    /** 用户设置（存储在 data.json） */
    settings: SettingsWindowSettings = { ...DEFAULT_SETTINGS };

    /** 窗口几何数据（存储在 window-geometry.json） */
    private geometries: Record<string, WindowGeometry> = {};

    /** 已加载的翻译字典：locale code → 翻译键值对 */
    private locales: Record<string, Record<string, string>> = {};

    // ── 设置窗口追踪状态 ──
    private settingsWinId: number | null = null;
    private settingsWinCbs: Array<[string, () => void]> | null = null;
    private settingsWinRef: ElectronWindow | null = null;
    private settingsOpening = false;
    private detectTimer: number | null = null;
    private knownWinIds = new Set<number>();

    // ── 被 monkey-patch 的原始方法 ──
    private origSettingOpen: (() => void) | null = null;

    // ══════════════════════════════════════════════════════════════
    //  生命周期
    // ══════════════════════════════════════════════════════════════

    async onload(): Promise<void> {
        // 加载用户设置
        await this.loadSettings();

        // 初始化 i18n（从 locale/ 目录加载语言文件）
        await this.rescanLocales();

        // 加载窗口几何数据
        await this.loadGeometryFile();

        // 注册插件设置面板
        this.addSettingTab(new SettingsWindowSettingTab(this.app, this));

        // 检查 Electron API 是否可用（仅桌面端支持）
        if (!getElectron()) {
            return;
        }

        // 记录当前已存在的所有窗口 ID（通常只有主窗口）
        for (const w of getAllBrowserWindows()) {
            this.knownWinIds.add(w.id);
        }

        // 拦截 app.setting.open，以便在设置窗口弹出时捕获并追踪
        this.hookSettingOpen();
    }

    onunload(): void {
        if (this.origSettingOpen && (this.app as any).setting) {
            (this.app as any).setting.open = this.origSettingOpen;
        }
        this.detachSettingsWin();
        if (this.detectTimer !== null) {
            window.clearInterval(this.detectTimer);
            this.detectTimer = null;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  插件设置管理（读写 data.json）
    // ══════════════════════════════════════════════════════════════

    async loadSettings(): Promise<void> {
        const data = (await this.loadData()) as Partial<SettingsWindowSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    // ══════════════════════════════════════════════════════════════
    //  i18n 国际化
    //
    //  locale/ 目录下放 JSON 文件，文件名随意（如 ja.json、fr.json）
    //  JSON 内需含 "_displayName" 字段指明下拉菜单中的显示名
    //  每次打开设置面板时实时重扫，新增文件即刻生效
    // ══════════════════════════════════════════════════════════════

    /**
     * 实时扫描 locale/ 目录并加载所有 JSON 语言文件
     * 全部使用 Obsidian 官方 API（FileSystemAdapter + adapter.list/read）
     * 在 onload 和每次打开设置面板时调用
     */
    async rescanLocales(): Promise<void> {
        const adapter = this.app.vault.adapter;
        const localeDir = `${this.manifest.dir}/${LOCALE_DIR}`;

        // 确保 locale 目录存在
        try {
            if (!(await adapter.exists(localeDir))) {
                await adapter.mkdir(localeDir);
            }
        } catch (e) {
            console.warn("[RememberSettingsWindow] 创建语言目录失败:", e);
            return;
        }

        // 使用官方 adapter.list() 列出目录下所有文件
        let listed;
        try {
            listed = await adapter.list(localeDir);
        } catch (e) {
            console.warn("[RememberSettingsWindow] 读取语言目录失败:", e);
            return;
        }

        // 如果目录中没有 JSON 文件，写入内置默认语言文件
        const hasJson = listed.files.some((f: string) => f.endsWith(".json"));
        if (!hasJson) {
            for (const [code, translations] of Object.entries(LOCALE_DEFAULTS)) {
                try {
                    await adapter.write(
                        `${localeDir}/${code}.json`,
                        JSON.stringify(translations, null, 4),
                    );
                } catch (e) {
                    console.warn(`[RememberSettingsWindow] 写入默认语言文件 ${code}.json 失败:`, e);
                }
            }
            // 重新列出文件
            try {
                listed = await adapter.list(localeDir);
            } catch {
                return;
            }
        }

        // 清空并重新加载所有 JSON 文件
        this.locales = {};
        for (const filePath of listed.files) {
            if (!filePath.endsWith(".json")) continue;
            const fileName = filePath.split("/").pop()!;
            const code = fileName.replace(/\.json$/, "");
            try {
                const raw = await adapter.read(filePath);
                this.locales[code] = JSON.parse(raw);
            } catch (e) {
                console.warn(`[RememberSettingsWindow] 加载 ${fileName} 失败:`, e);
            }
        }
    }

    /**
     * 获取当前生效的 locale code
     * "auto" 模式下自动检测系统语言，否则使用用户选择的语言
     */
    getLocale(): string {
        if (this.settings.language === "auto") {
            return this.detectLocale();
        }
        return this.settings.language;
    }

    /** 翻译快捷方法：获取指定键在当前语言下的文本 */
    i18n(key: string): string {
        const locale = this.getLocale();
        // 当前语言 → 英文回退 → 键名本身
        return this.locales[locale]?.[key]
            ?? this.locales["en"]?.[key]
            ?? key;
    }

    /** 获取所有已加载的 locale code 列表 */
    getAvailableLocales(): string[] {
        return Object.keys(this.locales);
    }

    /** 获取语言的显示名称（从 JSON 的 _displayName 字段读取，否则用 locale code） */
    getLocaleName(code: string): string {
        return this.locales[code]?.[DISPLAY_NAME_KEY] ?? code;
    }

    /**
     * 根据 moment.locale() 自动检测系统语言
     * 匹配策略：精确匹配 → 语言前缀匹配 → 回退到英文
     */
    private detectLocale(): string {
        try {
            const sysLocale: string =
                (window as any).moment?.locale?.() ?? "en";

            if (this.locales[sysLocale]) return sysLocale;

            const lang = sysLocale.split("-")[0];
            for (const code of Object.keys(this.locales)) {
                if (code.startsWith(lang)) return code;
            }
        } catch { /* moment 不可用时回退 */ }
        return "en";
    }

    // ══════════════════════════════════════════════════════════════
    //  窗口几何数据管理（读写 window-geometry.json）
    // ══════════════════════════════════════════════════════════════

    /** 从 window-geometry.json 加载保存的窗口几何数据 */
    private async loadGeometryFile(): Promise<void> {
        const adapter = this.app.vault.adapter;
        const filePath = this.manifest.dir + "/" + GEOMETRY_FILE;

        try {
            if (await adapter.exists(filePath)) {
                const raw = await adapter.read(filePath);
                this.geometries = JSON.parse(raw);
            } else {
                this.geometries = {};
                // 首次启动时创建空的几何数据文件，方便用户找到它
                await adapter.write(filePath, JSON.stringify({}, null, 2));
            }
        } catch (e) {
            console.warn("[RememberSettingsWindow] 读取窗口几何数据失败:", e);
            this.geometries = {};
        }
    }

    /**
     * 防抖保存窗口几何数据到 window-geometry.json
     * 1 秒防抖：避免拖拽过程中频繁写入磁盘
     */
    private debouncedSave = debounce(
        async () => {
            const adapter = this.app.vault.adapter;
            const filePath = this.manifest.dir + "/" + GEOMETRY_FILE;
            try {
                await adapter.write(
                    filePath,
                    JSON.stringify(this.geometries, null, 2),
                );
            } catch (e) {
                console.warn("[RememberSettingsWindow] 保存窗口几何数据失败:", e);
            }
        },
        1000,
        true,
    );

    // ══════════════════════════════════════════════════════════════
    //  拦截 app.setting.open（核心逻辑）
    // ══════════════════════════════════════════════════════════════

    private hookSettingOpen(): void {
        const setting = (this.app as any).setting;
        if (!setting || typeof setting.open !== "function") {
            return;
        }

        this.origSettingOpen = setting.open.bind(setting);

        setting.open = (...args: any[]) => {
            this.settingsOpening = true;
            const result = this.origSettingOpen!.apply(setting, args);
            this.startDetecting();
            return result;
        };
    }

    private startDetecting(): void {
        if (this.detectTimer !== null) {
            window.clearInterval(this.detectTimer);
        }

        let attempts = 0;
        this.detectTimer = window.setInterval(() => {
            attempts++;
            const found = this.tryFindNewSettingsWin();
            if (found || attempts >= 15) {
                if (this.detectTimer !== null) {
                    window.clearInterval(this.detectTimer);
                    this.detectTimer = null;
                }
                this.settingsOpening = false;
            }
        }, 200);
    }

    private tryFindNewSettingsWin(): boolean {
        for (const win of getAllBrowserWindows()) {
            if (!this.knownWinIds.has(win.id)) {
                this.knownWinIds.add(win.id);
                this.attachSettingsWin(win);
                return true;
            }
        }
        return false;
    }

    // ══════════════════════════════════════════════════════════════
    //  设置窗口事件监听
    // ══════════════════════════════════════════════════════════════

    private attachSettingsWin(win: ElectronWindow): void {
        this.detachSettingsWin();

        this.settingsWinId  = win.id;
        this.settingsWinRef = win;

        // 立即应用保存的几何数据或默认尺寸
        this.applySettingsGeometry(win);

        /** 捕获当前窗口边界到内存（不写磁盘） */
        const captureBounds = (): void => {
            try {
                if (win.isDestroyed()) return;
                const b = win.getBounds();
                this.geometries[GEOMETRY_KEY] = {
                    width: b.width,
                    height: b.height,
                    x: b.x,
                    y: b.y,
                };
            } catch { /* 窗口已被销毁 */ }
        };

        /** 拖拽结束时的保存操作 */
        const doSave = (): void => {
            captureBounds();
            this.debouncedSave();
        };

        /**
         * 防抖保存：拖拽停止 500ms 后自动触发
         * 这是 resize-ended / move-ended 的回退方案，
         * 因为后者需要 Electron 33+，部分 Obsidian 版本可能不支持
         */
        let saveTimer: number | null = null;
        const debouncedSaveAfterDrag = (): void => {
            captureBounds();
            if (saveTimer !== null) {
                window.clearTimeout(saveTimer);
            }
            saveTimer = window.setTimeout(() => {
                this.debouncedSave();
                saveTimer = null;
            }, 500);
        };

        /** 窗口关闭时：清理追踪状态和定时器 */
        const onClosed = (): void => {
            if (saveTimer !== null) {
                window.clearTimeout(saveTimer);
            }
            this.knownWinIds.delete(win.id);
            this.settingsWinId  = null;
            this.settingsWinRef = null;
            this.settingsWinCbs = null;
        };

        // 事件绑定策略：
        //   resize / move     → 实时更新内存 + 启动 500ms 防抖保存（兼容所有版本）
        //   resize-ended / move-ended → 立即保存（Electron 33+ 才触发）
        //   closed            → 清理
        const cbs: Array<[string, () => void]> = [
            ["resize",       debouncedSaveAfterDrag],
            ["resize-ended", doSave],
            ["move",         debouncedSaveAfterDrag],
            ["move-ended",   doSave],
            ["closed",       onClosed],
        ];

        for (const [evt, cb] of cbs) {
            win.on(evt, cb);
        }
        this.settingsWinCbs = cbs;
    }

    private detachSettingsWin(): void {
        if (this.settingsWinRef && this.settingsWinCbs) {
            for (const [evt, cb] of this.settingsWinCbs) {
                try {
                    if (!this.settingsWinRef.isDestroyed()) {
                        this.settingsWinRef.removeListener(evt, cb);
                    }
                } catch {}
            }
        }
        this.settingsWinRef = null;
        this.settingsWinCbs = null;
        this.settingsWinId  = null;
    }

    // ══════════════════════════════════════════════════════════════
    //  应用窗口几何数据
    // ══════════════════════════════════════════════════════════════

    private applySettingsGeometry(win: ElectronWindow): void {
        const saved  = this.geometries[GEOMETRY_KEY];
        const bounds: Partial<ElectronBounds> = {};

        if (this.settings.rememberSize && saved) {
            bounds.width  = saved.width;
            bounds.height = saved.height;
        } else {
            bounds.width  = this.settings.defaultWidth;
            bounds.height = this.settings.defaultHeight;
        }

        if (this.settings.rememberPosition && saved) {
            bounds.x = saved.x;
            bounds.y = saved.y;
        }

        if (Object.keys(bounds).length > 0) {
            requestAnimationFrame(() => {
                try {
                    if (!win.isDestroyed()) win.setBounds(bounds);
                } catch {}
            });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  插件设置面板
// ═══════════════════════════════════════════════════════════════════
class SettingsWindowSettingTab extends PluginSettingTab {
    plugin: RememberSettingsWindowPlugin;

    constructor(app: App, plugin: RememberSettingsWindowPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        // 每次打开面板时实时重扫 locale/ 目录，新增语言文件即刻生效
        await this.plugin.rescanLocales();

        const tr = (key: string) => this.plugin.i18n(key);

        // ── 语言选择 ──
        const langOptions: Record<string, string> = {
            "auto": tr("languageAuto"),
        };
        for (const code of this.plugin.getAvailableLocales()) {
            langOptions[code] = this.plugin.getLocaleName(code);
        }

        new Setting(containerEl)
            .setName(tr("language"))
            .setDesc(tr("languageDesc"))
            .addDropdown((dropdown) =>
                dropdown
                    .addOptions(langOptions)
                    .setValue(this.plugin.settings.language)
                    .onChange(async (v) => {
                        this.plugin.settings.language = v;
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );

        // ── 开关：记住窗口大小 ──
        new Setting(containerEl)
            .setName(tr("settingRememberSize"))
            .setDesc(tr("settingRememberSizeDesc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.rememberSize)
                    .onChange(async (v) => {
                        this.plugin.settings.rememberSize = v;
                        await this.plugin.saveSettings();
                    }),
            );

        // ── 开关：记住窗口位置 ──
        new Setting(containerEl)
            .setName(tr("settingRememberPosition"))
            .setDesc(tr("settingRememberPositionDesc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.rememberPosition)
                    .onChange(async (v) => {
                        this.plugin.settings.rememberPosition = v;
                        await this.plugin.saveSettings();
                    }),
            );

        // ── 默认窗口大小 ──
        new Setting(containerEl)
            .setName(tr("defaultSizeHeader"))
            .setHeading();
        containerEl.createEl("p", {
            text: tr("defaultSizeDesc"),
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName(tr("defaultWidth"))
            .addText((text) =>
                text
                    .setPlaceholder("1000")
                    .setValue(String(this.plugin.settings.defaultWidth))
                    .onChange(async (v) => {
                        const n = parseInt(v, 10);
                        if (!isNaN(n) && n > 0) {
                            this.plugin.settings.defaultWidth = n;
                            await this.plugin.saveSettings();
                        }
                    }),
            )
            .addExtraButton((btn) =>
                btn
                    .setIcon("reset")
                    .setTooltip(`${DEFAULT_SETTINGS.defaultWidth}`)
                    .onClick(async () => {
                        this.plugin.settings.defaultWidth = DEFAULT_SETTINGS.defaultWidth;
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );

        new Setting(containerEl)
            .setName(tr("defaultHeight"))
            .addText((text) =>
                text
                    .setPlaceholder("800")
                    .setValue(String(this.plugin.settings.defaultHeight))
                    .onChange(async (v) => {
                        const n = parseInt(v, 10);
                        if (!isNaN(n) && n > 0) {
                            this.plugin.settings.defaultHeight = n;
                            await this.plugin.saveSettings();
                        }
                    }),
            )
            .addExtraButton((btn) =>
                btn
                    .setIcon("reset")
                    .setTooltip(`${DEFAULT_SETTINGS.defaultHeight}`)
                    .onClick(async () => {
                        this.plugin.settings.defaultHeight = DEFAULT_SETTINGS.defaultHeight;
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }
}
