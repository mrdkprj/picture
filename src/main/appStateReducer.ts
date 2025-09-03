import { writable } from "svelte/store";
import { EmptyImageFile } from "../constants";
import { DEFAULT_SETTINGS } from "../settings";

type AppState = {
    imageFiles: Pic.ImageFile[];
    currentImageFile: Pic.ImageFile;
    currentIndex: number;
    isMaximized: boolean;
    isFullscreen: boolean;
    pinned: string;
    isMouseOnly: boolean;
    isHistoryOpen: boolean;
    locked: boolean;
    dragging: boolean;
    counter: string;
    fileCount: number;
    title: string;
    scaleRate: string;
    category: string;
    settings: Pic.Settings;
};

export const initialAppState: AppState = {
    imageFiles: [],
    currentImageFile: EmptyImageFile,
    currentIndex: 0,
    isMaximized: false,
    pinned: "",
    isMouseOnly: false,
    isFullscreen: false,
    locked: false,
    dragging: false,
    isHistoryOpen: false,
    counter: "",
    fileCount: 0,
    title: "",
    scaleRate: "",
    category: "",
    settings: DEFAULT_SETTINGS,
};

type AppAction =
    | { type: "updateCurrentImage" }
    | { type: "updateImageDetail"; value: Pic.ImageDetail }
    | { type: "settings"; value: Pic.Settings }
    | { type: "isMaximized"; value: boolean }
    | { type: "isFullscreen"; value: boolean }
    | { type: "pin"; value: string }
    | { type: "isMouseOnly"; value: boolean }
    | { type: "category"; value: string }
    | { type: "locked"; value: boolean }
    | { type: "dragging"; value: boolean }
    | { type: "title"; value: string }
    | { type: "scaleRate"; value: string }
    | { type: "files"; value: Pic.ImageFile[] }
    | { type: "index"; value: number }
    | { type: "removeFile" }
    | { type: "updateOrientation"; value: number }
    | { type: "isHistoryOpen"; value: boolean };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "files": {
            return { ...state, imageFiles: action.value, currentIndex: 0, currentImageFile: EmptyImageFile, fileCount: action.value.length };
        }

        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "pin":
            return { ...state, pinned: action.value };

        case "isMouseOnly":
            return { ...state, isMouseOnly: action.value };

        case "updateCurrentImage": {
            const imageSrc = `${state.currentImageFile.src}?${new Date().getTime()}`;
            return { ...state, currentImageFile: { ...state.currentImageFile, src: imageSrc } };
        }

        case "updateImageDetail": {
            return { ...state, currentImageFile: { ...state.currentImageFile, detail: action.value } };
        }

        case "index": {
            const currentImageFile = state.imageFiles.length ? state.imageFiles[action.value] : EmptyImageFile;
            const counter = `${action.value + 1} / ${state.imageFiles.length}`;
            currentImageFile.src = `${currentImageFile.src}?${new Date().getTime()}`;
            return { ...state, currentIndex: action.value, currentImageFile, counter };
        }

        case "removeFile": {
            const files = state.imageFiles.filter((_, i) => i != state.currentIndex);
            return { ...state, imageFiles: files };
        }

        case "settings":
            return { ...state, settings: action.value };

        case "updateOrientation": {
            return { ...state, currentImageFile: { ...state.currentImageFile, detail: { ...state.currentImageFile.detail, orientation: action.value } } };
        }

        case "isFullscreen":
            return { ...state, isFullscreen: action.value };

        case "category":
            return { ...state, category: action.value };

        case "locked":
            return { ...state, locked: action.value };

        case "dragging":
            return { ...state, dragging: action.value };

        case "title":
            return { ...state, title: action.value };

        case "scaleRate":
            return { ...state, scaleRate: action.value };

        case "isHistoryOpen":
            return { ...state, isHistoryOpen: action.value };

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const appState = store;
