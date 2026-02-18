import { EmptyImageFile } from "./constants";
import { DEFAULT_SETTINGS } from "./settings";

type Mode = "view" | "edit";
type AppState = {
    mode: Mode;
    workingImage: Pic.ImageFile;
    settings: Pic.Settings;
    imageFiles: Pic.ImageFile[];
};

export const appState: AppState = $state({
    mode: "view",
    workingImage: EmptyImageFile,
    settings: DEFAULT_SETTINGS,
    imageFiles: [],
});
