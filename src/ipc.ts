import { listen, emit, UnlistenFn, once, emitTo, EventName } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

type TauriCommand<Req, Res> = {
    Request: Req;
    Response: Res;
};

type FileAttribute = {
    is_device: boolean;
    is_directory: boolean;
    is_file: boolean;
    is_hidden: boolean;
    is_read_only: boolean;
    is_symbolic_link: boolean;
    is_system: boolean;
    atime_ms: number;
    ctime_ms: number;
    mtime_ms: number;
    birthtime_ms: number;
    size: number;
};

export type FileAttributeExt = {
    full_path: string;
    attribute: FileAttribute;
};

type WriteFileInfo = {
    fullPath: string;
    data: string;
};

type DialogOptions = {
    dialog_type: "message" | "confirm" | "ask";
    title?: string;
    kind?: "info" | "warning" | "error";
    cancel_id?: number;
    buttons?: string[];
    message: string;
};

type FileFilter = {
    name: string;
    extensions: string[];
};

type OpenProperty = "OpenFile" | "OpenDirectory" | "MultiSelections";

type FileDialogOptions = {
    title?: string;
    default_path?: string;
    filters?: FileFilter[];
    properties?: OpenProperty[];
};

type FileDialogResult = {
    canceled: boolean;
    file_paths: string[];
};

type RotateArgs = {
    file_path: string;
    orientation: number;
    degree: number;
};

type ToBufferArgs = {
    file_path: string;
    format: string;
};

type ResizeArgs = {
    file: string;
    is_buffer: boolean;
    width: number;
    height: number;
};

type ClipArgs = {
    file: string;
    is_buffer: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
};

type ToIconArgs = {
    file: string;
    is_buffer: boolean;
    out_path: string;
};

type MetadataRequest = {
    file: string;
    is_buffer: boolean;
};

type UtimesArgs = {
    file_path: string;
    atime_ms: number;
    mtime_ms: number;
};

export type Dirent = {
    name: string;
    parent_path: string;
    full_path: string;
    mime_type: string;
    attributes: FileAttribute;
};

type TauriCommandMap = {
    prepare_windows: TauriCommand<Pic.Preference, boolean>;
    get_init_args: TauriCommand<undefined, string[]>;
    readdir: TauriCommand<string, Dirent[]>;
    open_context_menu: TauriCommand<Pic.Position, undefined>;
    change_theme: TauriCommand<Pic.Theme, undefined>;
    reveal: TauriCommand<string, undefined>;
    trash: TauriCommand<string, undefined>;
    exists: TauriCommand<string, boolean>;
    mkdir: TauriCommand<string, undefined>;
    mkdir_all: TauriCommand<string, undefined>;
    create: TauriCommand<string, undefined>;
    read_text_file: TauriCommand<string, string>;
    write_text_file: TauriCommand<WriteFileInfo, undefined>;
    write_image_file: TauriCommand<WriteFileInfo, undefined>;
    stat: TauriCommand<string, FileAttribute>;
    stat_all: TauriCommand<string[], FileAttributeExt[]>;
    message: TauriCommand<DialogOptions, boolean>;
    save: TauriCommand<FileDialogOptions, FileDialogResult>;
    open: TauriCommand<FileDialogOptions, FileDialogResult>;
    listen_file_drop: TauriCommand<string, undefined>;
    unlisten_file_drop: TauriCommand<undefined, undefined>;
    rotate: TauriCommand<RotateArgs, string>;
    resize: TauriCommand<ResizeArgs, string>;
    clip: TauriCommand<ClipArgs, string>;
    metadata: TauriCommand<MetadataRequest, string>;
    to_buffer: TauriCommand<ToBufferArgs, string>;
    to_icon: TauriCommand<ToIconArgs, undefined>;
    utimes: TauriCommand<UtimesArgs, undefined>;
};

export class IPCBase {
    invoke = async <K extends keyof TauriCommandMap>(channel: K, data: TauriCommandMap[K]["Request"]): Promise<TauriCommandMap[K]["Response"]> => {
        return await invoke<TauriCommandMap[K]["Response"]>(channel, {
            payload: data,
        });
    };
}

export class IPC extends IPCBase {
    private label: string;
    private funcs: UnlistenFn[] = [];

    constructor(label: RendererName) {
        super();
        this.label = label;
    }

    receiveOnce = async <K extends keyof RendererChannelEventMap>(channel: K, handler: (e: RendererChannelEventMap[K]) => void) => {
        const fn = await once<RendererChannelEventMap[K]>(channel, (e) => handler(e.payload), { target: { kind: "WebviewWindow", label: this.label } });
        this.funcs.push(fn);
    };

    receive = async <K extends keyof RendererChannelEventMap>(channel: K, handler: (e: RendererChannelEventMap[K]) => void) => {
        const fn = await listen<RendererChannelEventMap[K]>(channel, (e) => handler(e.payload), { target: { kind: "WebviewWindow", label: this.label } });
        this.funcs.push(fn);
    };

    receiveTauri = async <T>(event: EventName, handler: (e: T) => void) => {
        const fn = await listen<T>(event, (e) => handler(e.payload), {
            target: { kind: "WebviewWindow", label: this.label },
        });
        this.funcs.push(fn);
    };

    send = async <K extends keyof RendererChannelEventMap>(channel: K, data: RendererChannelEventMap[K]) => {
        await emit(channel, data);
    };

    sendTo = async <K extends keyof RendererChannelEventMap>(rendererName: RendererName, channel: K, data: RendererChannelEventMap[K]) => {
        await emitTo({ kind: "WebviewWindow", label: rendererName }, channel, data);
    };

    release = () => {
        this.funcs.forEach((fn) => fn());
    };
}
