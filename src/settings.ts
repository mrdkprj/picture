import { appDataDir } from "@tauri-apps/api/path";
import path from "./path";
import util from "./util";
import { IPCBase } from "./ipc";

const ipc = new IPCBase();
const SETTINGS_FILE_NAME = "picviewer.config.json";
export const DEFAULT_SETTINGS: Pic.Settings = {
    directory: "",
    fullPath: "",
    preference: {
        timestamp: "Unchanged",
        sort: "NameAsc",
        mode: "Keyboard",
        theme: "dark",
    },
    history: {},
    bounds: { width: 1200, height: 800, x: 0, y: 0 },
    isMaximized: false,
};

export default class Settings {
    private dataDir = "";
    private file = "";
    private timestamp = 0;

    async init(): Promise<Pic.Settings> {
        this.dataDir = await appDataDir();
        const settingPath = path.join(this.dataDir, "temp");
        this.file = path.join(settingPath, SETTINGS_FILE_NAME);
        const fileExists = await util.exists(this.file);

        let settings = DEFAULT_SETTINGS;
        if (fileExists) {
            this.timestamp = (await this.stat()).mtime_ms;
            const rawData = await ipc.invoke("read_text_file", this.file);
            if (rawData) {
                settings = this.createSettings(JSON.parse(rawData));
            }
        } else {
            await ipc.invoke("mkdir_all", settingPath);
            await ipc.invoke("create", this.file);
            await ipc.invoke("write_text_file", { fullPath: settingPath, data: JSON.stringify(settings) });
            this.timestamp = (await this.stat()).mtime_ms;
        }

        return settings;
    }

    private async stat() {
        return await ipc.invoke("stat", this.file);
    }

    private createSettings(rawSettings: any): Pic.Settings {
        const Settings = { ...DEFAULT_SETTINGS } as any;

        Object.keys(rawSettings).forEach((key) => {
            if (!(key in Settings)) return;

            const value = rawSettings[key];

            if (typeof value === "object" && key !== "history") {
                Object.keys(value).forEach((valueKey) => {
                    if (valueKey in Settings[key]) {
                        Settings[key][valueKey] = value[valueKey];
                    }
                });
            } else {
                Settings[key] = value;
            }
        });

        return Settings;
    }

    async save(settings: Pic.Settings) {
        const stat = await this.stat();
        const newTimestamp = stat.mtime_ms;
        if (newTimestamp > this.timestamp) {
            const currencSettings = JSON.parse(await ipc.invoke("read_text_file", this.file)) as Pic.Settings;
            settings.history = { ...settings.history, ...currencSettings.history };
        }
        await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(settings) });
    }
}
