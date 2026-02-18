import { writable } from "svelte/store";
import { EmptyImageFile } from "../constants";
import { appState } from "../state.svelte";

type ViewState = {
    currentImageFile: Pic.ImageFile;
    currentIndex: number;
    isFullscreen: boolean;
    pinned: string;
    isHistoryOpen: boolean;
    locked: boolean;
    dragging: boolean;
    counter: string;
    fileCount: number;
    title: string;
    scaleRate: string;
};

export const initialViewState: ViewState = {
    currentImageFile: EmptyImageFile,
    currentIndex: 0,
    pinned: "",
    isFullscreen: false,
    locked: false,
    dragging: false,
    isHistoryOpen: false,
    counter: "",
    fileCount: 0,
    title: "",
    scaleRate: "",
};

type AppAction =
    | { type: "updateCurrentImage" }
    | { type: "updateImageDetail"; value: Pic.ImageDetail }
    | { type: "isFullscreen"; value: boolean }
    | { type: "pin"; value: string }
    | { type: "locked"; value: boolean }
    | { type: "dragging"; value: boolean }
    | { type: "title"; value: string }
    | { type: "scaleRate"; value: string }
    | { type: "files"; value: Pic.ImageFile[] }
    | { type: "index"; value: number }
    | { type: "removeFile" }
    | { type: "updateOrientation"; value: number }
    | { type: "isHistoryOpen"; value: boolean };

const updater = (state: ViewState, action: AppAction): ViewState => {
    switch (action.type) {
        case "files": {
            appState.imageFiles = action.value;
            return { ...state, currentIndex: 0, currentImageFile: EmptyImageFile, fileCount: action.value.length };
        }

        case "pin":
            return { ...state, pinned: action.value };

        case "updateCurrentImage": {
            const imageSrc = `${state.currentImageFile.src}?${new Date().getTime()}`;
            return { ...state, currentImageFile: { ...state.currentImageFile, src: imageSrc } };
        }

        case "updateImageDetail": {
            return { ...state, currentImageFile: { ...state.currentImageFile, detail: action.value } };
        }

        case "index": {
            const currentImageFile = appState.imageFiles.length ? appState.imageFiles[action.value] : EmptyImageFile;
            const counter = `${action.value + 1} / ${appState.imageFiles.length}`;
            currentImageFile.src = `${currentImageFile.src}?${new Date().getTime()}`;
            return { ...state, currentIndex: action.value, currentImageFile, counter };
        }

        case "removeFile": {
            const files = appState.imageFiles.filter((_, i) => i != state.currentIndex);
            appState.imageFiles = files;
            return state;
        }

        case "updateOrientation": {
            return { ...state, currentImageFile: { ...state.currentImageFile, detail: { ...state.currentImageFile.detail, orientation: action.value } } };
        }

        case "isFullscreen":
            return { ...state, isFullscreen: action.value };

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

const store = writable(initialViewState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const viewState = store;
