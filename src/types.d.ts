declare global {
    interface Window {
        api: Api;
    }

    type RendererName = "main" | "edit";
    type Renderer = { [key in RendererName]: Electron.BrowserWindow | undefined };

    type MainChannelEventMap = {
        minimize: Pic.Event;
        "toggle-maximize": Pic.Event;
        close: Pic.Event;
        "drop-file": Pic.DropRequest;
        "fetch-image": Pic.FetchRequest;
        delete: Pic.Event;
        pin: Pic.Event;
        restore: Pic.RestoreRequest;
        rotate: Pic.RotateRequest;
        "remove-history": Pic.RemoveHistoryRequest;
        "toggle-fullscreen": Pic.FullscreenChangeEvent;
        clip: Pic.ClipRequest;
        resize: Pic.ResizeRequest;
        "close-edit-dialog": Pic.Event;
        "menu-click": Pic.ContextMenuClickEvent;
        restart: Pic.Event;
        "open-edit-dialog": Pic.Event;
        "save-image": Pic.SaveImageRequest;
        error: Pic.ShowDialogRequest;
    };

    type RendererChannelEventMap = {
        "backend-ready": Pic.Event;
        "after-edit-image": Pic.Event;
        minimize: Pic.Event;
        "contextmenu-event": Pic.ContextMenuEvent;
        "on-edit-close": Pic.Event;
        "sync-setting": Pic.Settings;
        "toggle-maximize": Pic.Event;
        "open-edit-dialog": Pic.OpenEditEvent;
    };

    interface Api {
        send: <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => void;
        receive: <K extends keyof RendererChannelEventMap>(channel: K, listener: (data: RendererChannelEventMap[K]) => void) => () => void;
        removeAllListeners: <K extends keyof RendererChannelEventMap>(channel: K) => void;
        onFileDrop: (files: File[]) => string[];
    }

    namespace Pic {
        type Timestamp = "Normal" | "Unchanged";
        type Mode = "Keyboard" | "Mouse";
        type Theme = "dark" | "light";
        type SortType = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc";

        type ContextMenuSubTypeMap = {
            OpenFile: null;
            Reveal: null;
            History: null;
            ShowActualSize: null;
            ToFirst: null;
            ToLast: null;
            Sort: Pic.SortType;
            Timestamp: Pic.Timestamp;
            Mode: Pic.Mode;
            Theme: Pic.Theme;
            Reload: null;
        };

        type ContextMenuEvent = {
            id: keyof ContextMenuSubTypeMap;
            name: string;
        };

        type ImageTransformEvent = "transformchange" | "dragstart" | "dragend";
        type ImageSroucetype = "path" | "buffer" | "undefined";
        type EditMode = "Clip" | "Resize";

        type Position = {
            x: number;
            y: number;
        };

        type Bounds = {
            width: number;
            height: number;
            x: number;
            y: number;
        };

        type ImageRectangle = {
            left: number;
            right: number;
            top: number;
            bottom: number;
            width: number;
            height: number;
        };

        type ClipRectangle = {
            left: number;
            top: number;
            width: number;
            height: number;
        };

        type ImageSize = {
            width: number;
            height: number;
        };

        type ReadyEvent = {
            settings: Pic.Settings;
            menu: Pic.ContextMenu[];
        };

        type Settings = {
            directory: string;
            fullPath: string;
            preference: Preference;
            history: { [key: string]: string };
            bounds: Bounds;
            isMaximized: boolean;
        };

        type Preference = {
            timestamp: Timestamp;
            sort: SortType;
            mode: Mode;
            theme: Theme;
        };

        type ImageFile = {
            fullPath: string;
            src: string;
            directory: string;
            fileName: string;
            type: ImageSroucetype;
            timestamp: number;
            detail: ImageDetail;
        };

        type FormatEnum = "jpeg" | "png";
        type ImageFormat = FormatEnum | undefined | "ico";
        type ImageDetail = {
            width: number;
            height: number;
            renderedWidth: number;
            renderedHeight: number;
            orientation: number;
            format: Pic.ImageFormat;
            category?: number | undefined;
        };

        type OpenEditEvent = {
            file: ImageFile;
            settings: Pic.Settings;
        };

        type ResizeRequest = {
            size: ImageSize;
            format?: Pic.ImageFormat;
        };

        type EditInput = {
            file: string;
            type: ImageSroucetype;
            format: Pic.ImageFormat;
        };

        type EditOutput = {
            file: Buffer;
            format: Pic.ImageFormat;
        };

        type EditResult = {
            image: ImageFile;
            message?: string;
        };

        type SaveImageRequest = {
            image: ImageFile;
            saveCopy: boolean;
        };

        type SaveImageResult = {
            image: ImageFile;
            status: "Done" | "Cancel" | "Error";
            message?: string;
        };

        type ShowDialogRequest = {
            renderer: RendererName;
            message: string;
        };

        type FileDropEvent = {
            paths: string[];
        };

        type Event = {
            args?: any;
        };
    }
}

export {};
