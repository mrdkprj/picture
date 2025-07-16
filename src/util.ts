import path from "./path";
import { RotateDegree, Extensions } from "./constants";
import { Dirent, IPCBase } from "./ipc";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { convertFileSrc } from "@tauri-apps/api/core";

const ipc = new IPCBase();

class Util {
    async exists(target: string, createIfNotFound = false) {
        const found = await ipc.invoke("exists", target);
        if (found) {
            return found;
        }

        if (createIfNotFound) {
            await ipc.invoke("create", target);
        }

        return false;
    }

    async toImageFiles(fullPaths: string[]): Promise<Pic.ImageFile[]> {
        const stats = await ipc.invoke("stat_all", fullPaths);
        return stats.map((stat) => {
            const fullPath = stat.full_path;

            return {
                fullPath,
                src: convertFileSrc(fullPath),
                directory: path.dirname(fullPath),
                fileName: path.basename(fullPath),
                type: "path",
                timestamp: stat.attribute.mtime_ms,
                detail: {
                    orientation: 0,
                    width: 0,
                    height: 0,
                    renderedWidth: 0,
                    renderedHeight: 0,
                    format: undefined,
                },
            };
        });
    }

    async showErrorMessage(ex: any | string) {
        if (typeof ex == "string") {
            await ipc.invoke("message", { dialog_type: "message", kind: "error", message: ex });
        } else {
            await ipc.invoke("message", { dialog_type: "message", kind: "error", message: ex.message });
        }
    }

    async rotate(fullPath: string, currenOrientation: number, nextOrientation: number) {
        let degree = RotateDegree[currenOrientation] - RotateDegree[nextOrientation];

        if (currenOrientation === 1 || currenOrientation === 8) {
            degree = RotateDegree[nextOrientation] - RotateDegree[currenOrientation];
        }
        console.log({ file_path: fullPath, degree, orientation: nextOrientation });
        return await ipc.invoke("rotate", { file_path: fullPath, degree, orientation: nextOrientation });
    }

    async resizeBuffer(input: Pic.EditInput, size: Pic.ImageSize) {
        const isBuffer = input.type == "buffer";
        return await ipc.invoke("resize", { file_path: isBuffer ? "" : input.file, base64: isBuffer ? input.file : "", width: size.width, height: size.height });
    }

    async clipBuffer(input: Pic.EditInput, size: Pic.ClipRectangle) {
        const isBuffer = input.type == "buffer";
        return await ipc.invoke("clip", { file_path: isBuffer ? "" : input.file, base64: isBuffer ? input.file : "", top: size.top, left: size.left, width: size.width, height: size.height });
    }

    async getMetadata(fullPath: string) {
        return await ipc.invoke("metadata", fullPath);
    }

    async toBuffer(image: Pic.ImageFile, format: Pic.ImageFormat) {
        return await ipc.invoke("to_buffer", { file_path: image.fullPath, format: format == "png" ? "png" : "jpeg" });
    }

    async toIcon(destPath: string, sourcePath: string, mtime?: number) {
        await ipc.invoke("to_icon", { file_path: sourcePath, out_path: destPath });
        if (mtime) {
            await ipc.invoke("utimes", { file_path: destPath, atime_ms: mtime, mtime_ms: mtime });
        }
    }

    async saveFile(destPath: string, data: string, mtime?: number) {
        await ipc.invoke("write_image_file", {
            fullPath: destPath,
            data,
        });
        if (mtime) {
            await ipc.invoke("utimes", { file_path: destPath, atime_ms: mtime, mtime_ms: mtime });
        }
    }

    isImageFile(dirent: Dirent) {
        if (!dirent.attributes.is_file) return false;

        if (!Extensions.includes(path.extname(dirent.full_path).toLowerCase())) return false;

        return true;
    }

    private localCompareName(a: Pic.ImageFile, b: Pic.ImageFile) {
        return a.fileName.replace(path.extname(a.fileName), "").localeCompare(b.fileName.replace(path.extname(a.fileName), ""));
    }

    sort(imageFiles: Pic.ImageFile[], sortType: Pic.SortType) {
        switch (sortType) {
            case "NameAsc":
                imageFiles.sort((a, b) => this.localCompareName(a, b));
                break;
            case "NameDesc":
                imageFiles.sort((a, b) => this.localCompareName(b, a));
                break;
            case "DateAsc":
                imageFiles.sort((a, b) => a.timestamp - b.timestamp || this.localCompareName(a, b));
                break;
            case "DateDesc":
                imageFiles.sort((a, b) => b.timestamp - a.timestamp || this.localCompareName(a, b));
                break;
        }
    }

    toPhysicalPosition(bounds: Pic.Bounds) {
        return new PhysicalPosition(bounds.x, bounds.y);
    }

    toPhysicalSize(bounds: Pic.Bounds) {
        return new PhysicalSize(bounds.width, bounds.height);
    }

    toBounds(position: PhysicalPosition, size: PhysicalSize): Pic.Bounds {
        return {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        };
    }
}

const util = new Util();

export default util;
