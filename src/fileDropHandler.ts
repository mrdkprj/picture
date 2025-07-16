import path from "./path";
import { Extensions } from "./constants";

export const getDropFiles = (e: Pic.FileDropEvent) => {
    if (!e.paths) return [];

    return e.paths.filter((fullPath) => Extensions.includes(path.extname(fullPath)));
};
