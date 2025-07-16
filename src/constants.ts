export const PLATFROMS = {
    linux: "Linux",
    windows: "Windows",
};

export const SEPARATOR = navigator.userAgent.includes("Windows") ? "\\" : "/";

export const BROWSER_SHORTCUT_KEYS = ["f", "p", "r", "+", "-", "u", "g", "j"];

export const EmptyImageFile: Pic.ImageFile = {
    fullPath: "",
    directory: "",
    fileName: "",
    type: "undefined",
    src: "",
    timestamp: 0,
    detail: {
        orientation: 0,
        width: 0,
        height: 0,
        renderedWidth: 0,
        renderedHeight: 0,
        format: undefined,
    },
};

export const BACKWARD = -1;
export const FORWARD = 1;

export const Orientations = [1, 6, 3, 8];

export const OrientationName = {
    None: 1,
    Clock90deg: 6,
    Clock180deg: 3,
    Clock270deg: 8,
};

export const RotateDegree: { [key: number]: number } = {
    1: 0,
    6: 90,
    3: 180,
    8: 270,
};

export const Extensions = [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp", ".ico"];
