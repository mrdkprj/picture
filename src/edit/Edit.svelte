<script lang="ts">
    import { onMount } from "svelte";
    import Loader from "../Loader.svelte";
    import icon from "../assets/icon.ico";
    import ChangeSize from "../assets/ChangeSize.svelte";
    import Clip from "../assets/Clip.svelte";
    import Redo from "../assets/Redo.svelte";
    import Resize from "../assets/Resize.svelte";
    import Save from "../assets/Save.svelte";
    import SaveCopy from "../assets/SaveCopy.svelte";
    import Shrink from "../assets/Shrink.svelte";
    import Undo from "../assets/Undo.svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { ImageTransform } from "../imageTransform";
    import { BROWSER_SHORTCUT_KEYS, OrientationName } from "../constants";
    import Size from "./Size.svelte";
    import { IPC } from "../ipc";
    import util from "../util";
    import path from "../path";
    import { DEFAULT_SETTINGS } from "../settings";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

    const imageTransform = new ImageTransform();
    const ipc = new IPC("edit");

    let imageArea: HTMLDivElement;
    let img: HTMLImageElement;
    let clipArea: HTMLDivElement;
    let settings: Pic.Settings = DEFAULT_SETTINGS;

    const undoStack: Pic.ImageFile[] = [];
    const redoStack: Pic.ImageFile[] = [];

    const startEditImage = (imageFile: Pic.ImageFile): Pic.EditInput => {
        return { file: imageFile.fullPath, type: imageFile.type, format: imageFile.detail.format };
    };

    const endEditImage = async (result: string, imageFile: Pic.ImageFile) => {
        imageFile.fullPath = result;
        imageFile.type = "buffer";

        try {
            const metadataString = await util.getMetadata(result, true);
            const metadata = JSON.parse(metadataString);

            imageFile.detail.orientation = metadata.orientation == 0 ? 1 : metadata.orientation;

            const { width = 0, height = 0 } = metadata;

            imageFile.detail.width = width;
            imageFile.detail.height = height;
            const orientation = metadata.orientation == 0 ? 1 : metadata.orientation;
            imageFile.detail.renderedWidth = orientation % 2 === 0 ? height : width;
            imageFile.detail.renderedHeight = orientation % 2 === 0 ? width : height;
            if (path.extname(imageFile.fullPath) == ".ico") {
                imageFile.detail.format = "ico";
            } else {
                imageFile.detail.format = metadata.format;
            }
            return imageFile;
        } catch (ex: any) {
            await util.showErrorMessage(ex);
            return imageFile;
        }
    };

    const clipImage = async (rect: Pic.ClipRectangle) => {
        const imageFile = structuredClone($appState.currentImageFile);

        try {
            const input = startEditImage(imageFile);
            const result = await util.clipBuffer(input, rect);
            const image = await endEditImage(result, imageFile);

            showEditResult(image);
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const resize = async (request: Pic.ResizeRequest) => {
        const imageFile = structuredClone($appState.currentImageFile);

        if (request.format) {
            return await convertImage(imageFile, request.format);
        }

        try {
            const input = startEditImage(imageFile);
            const result = await util.resizeBuffer(input, request.size);
            const image = await endEditImage(result, imageFile);
            showEditResult(image);
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const getSaveDestPath = async (image: Pic.ImageFile, saveCopy: boolean, format?: Pic.ImageFormat) => {
        let savePath = $appState.currentImageFile.fullPath;

        if (saveCopy) {
            const ext = format ? `.${format}` : path.extname(image.fileName);
            const fileName = image.fileName.replace(ext, "");
            const saveFileName = `${fileName}-${new Date().getTime()}${ext}`;

            const result = await ipc.invoke("save", { default_path: path.join(image.directory, saveFileName), filters: [{ name: "Image", extensions: format ? [format] : ["jpeg", "jpg"] }] });
            if (!result.canceled) {
                savePath = result.file_paths[0];
            }
        }

        return savePath;
    };

    const convertImage = async (image: Pic.ImageFile, format: Pic.ImageFormat) => {
        const savePath = await getSaveDestPath(image, true, format);

        if (!savePath) return;

        try {
            if (format == "ico") {
                if (settings.preference.timestamp == "Normal") {
                    await util.toIcon(savePath, image);
                } else {
                    await util.toIcon(savePath, image, image.timestamp);
                }
            } else {
                const buffer = await util.toBuffer(image, format);
                if (settings.preference.timestamp == "Normal") {
                    await util.saveFile(savePath, buffer);
                } else {
                    await util.saveFile(savePath, buffer, image.timestamp);
                }
            }

            image.fullPath = savePath;
            image.directory = path.dirname(savePath);
            image.fileName = path.basename(savePath);
            image.type = "path";

            showEditResult(image);
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const saveImage = async (saveCopy: boolean) => {
        if ($appState.currentImageFile.type === "path") return;

        if (!saveCopy) {
            const result = await ipc.invoke("message", { dialog_type: "ask", buttons: ["OK", "Cancel"], message: "Overwrite image?" });
            if (!result) {
                return;
            }
        }

        const savePath = await getSaveDestPath($appState.currentImageFile, saveCopy);

        if (!savePath) return;

        try {
            if (settings.preference.timestamp == "Normal") {
                await util.saveFile(savePath, $appState.currentImageFile.fullPath);
            } else {
                await util.saveFile(savePath, $appState.currentImageFile.fullPath, $appState.currentImageFile.timestamp);
            }
            await ipc.sendTo("main", "after-edit-image", {});
            close();
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const onKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey && BROWSER_SHORTCUT_KEYS.includes(e.key)) {
            e.preventDefault();
        }

        if (e.key == "Escape") {
            if ($appState.isSizeDialogOpen) {
                dispatch({ type: "toggleSizeDialog", value: false });
            } else {
                close();
            }
        }

        if (e.ctrlKey && e.key == "r") {
            e.preventDefault();
        }

        if (e.ctrlKey && e.key == "z") {
            undo();
        }

        if (e.ctrlKey && e.key == "y") {
            redo();
        }

        if (e.ctrlKey && e.key == "s") {
            saveImage(false);
        }
    };

    const onImageMousedown = (e: MouseEvent) => {
        if ($appState.editMode == "Clip") return;

        imageTransform.onMousedown(e);
    };

    const onMouseDown = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (!e.target.classList.contains("clickable")) return;

        if ($appState.editMode == "Clip") {
            prepareClip(e);
        }
    };

    const onMousemove = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (e.button != 0) return;

        if ($appState.clipping) {
            clip(e);
        }

        imageTransform.onMousemove(e);
    };

    const onMouseup = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if ($appState.clipping) {
            dispatch({ type: "clipping", value: false });
            requestEdit();
            return;
        }

        dispatch({ type: "dragging", value: false });

        imageTransform.onMouseup(e);
    };

    const onImageDragStart = () => {
        dispatch({ type: "dragging", value: true });
    };

    const onImageDragEnd = () => {
        dispatch({ type: "dragging", value: false });
    };

    const loadImage = (data: Pic.ImageFile) => {
        dispatch({ type: "loadImage", value: data });
    };

    const onImageLoaded = async () => {
        imageTransform.setImage($appState.currentImageFile);
        dispatch({ type: "imageScale", value: imageTransform.getScale() });
        dispatch({ type: "imageRatio", value: imageTransform.getImageRatio() });
    };

    const changeEditMode = (mode: Pic.EditMode) => {
        if ($appState.editMode == mode) {
            dispatch({ type: "editMode", value: "Resize" });
        } else {
            dispatch({ type: "editMode", value: mode });
        }

        clearClip();
    };

    const changeResizeMode = (shrinkable: boolean) => {
        imageTransform.enableShrink(shrinkable);
        dispatch({ type: "allowShrink", value: shrinkable });
    };

    const prepareClip = (e: MouseEvent) => {
        dispatch({ type: "startClip", value: { rect: img.getBoundingClientRect(), position: { startX: e.clientX, startY: e.clientY } } });
    };

    const clip = (e: MouseEvent) => {
        dispatch({ type: "moveClip", value: { x: e.clientX, y: e.clientY } });
    };

    const clearClip = () => {
        dispatch({ type: "clipping", value: false });
    };

    const resizeImage = () => {
        changeEditMode("Resize");
        requestEdit();
    };

    const openSizeDialog = () => {
        dispatch({ type: "toggleSizeDialog", value: true });
    };

    const changeButtonState = () => {
        dispatch({
            type: "buttonState",
            value: {
                canUndo: !!undoStack.length,
                canRedo: !!redoStack.length,
                isResized: imageTransform.isResized(),
            },
        });
    };

    const undo = () => {
        const stack = undoStack.pop();

        if (stack) {
            redoStack.push(structuredClone($appState.currentImageFile));
            loadImage(stack);
        }

        changeButtonState();
    };

    const redo = () => {
        const stack = redoStack.pop();

        if (stack) {
            undoStack.push(structuredClone($appState.currentImageFile));
            loadImage(stack);
        }

        changeButtonState();
    };

    const getActualRect = (rect: Pic.ImageRectangle) => {
        const orientation = $appState.currentImageFile.detail.orientation;
        const rotated = orientation % 2 == 0;

        const width = rotated ? rect.height : rect.width;
        const height = rotated ? rect.width : rect.height;

        let top = rect.top;
        let left = rect.left;

        if (orientation === OrientationName.Clock90deg) {
            top = rect.right;
            left = rect.top;
        }

        if (orientation == OrientationName.Clock180deg) {
            top = rect.bottom;
            left = rect.right;
        }

        if (orientation == OrientationName.Clock270deg) {
            top = rect.left;
            left = rect.bottom;
        }

        return {
            top,
            left,
            width,
            height,
        };
    };

    const getClipInfo = (): Pic.ClipRectangle | null => {
        const clip = clipArea.getBoundingClientRect();

        if (clip.width < 5 || clip.height < 5) return null;

        const imageRect = img.getBoundingClientRect();

        if (clip.left > imageRect.right || clip.right < imageRect.left) return null;

        if (clip.top > imageRect.bottom || clip.bottom < imageRect.top) return null;

        const rate = Math.max(imageRect.width / $appState.currentImageFile.detail.renderedWidth, imageRect.height / $appState.currentImageFile.detail.renderedHeight);

        const clipLeft = Math.floor((clip.left - imageRect.left) / rate);
        const clipRight = Math.floor((imageRect.right - clip.right) / rate);
        const clipTop = Math.floor((clip.top - imageRect.top) / rate);
        const clipBottom = Math.floor((imageRect.bottom - clip.bottom) / rate);

        const clipWidth = Math.floor(clip.width / rate);
        const clipHeight = Math.floor(clip.height / rate);

        const left = clipLeft < 0 ? 0 : clipLeft;
        const top = clipTop < 0 ? 0 : clipTop;
        const right = clipRight < 0 ? 0 : clipRight;
        const bottom = clipBottom < 0 ? 0 : clipBottom;

        let width = clipLeft < 0 ? Math.floor(clipWidth + clipLeft) : clipWidth;
        width = clipRight < 0 ? Math.floor(width + clipRight) : width;

        let height = clipTop < 0 ? Math.floor(clipHeight + clipTop) : clipHeight;
        height = clipBottom < 0 ? Math.floor(height + clipBottom) : height;

        return getActualRect({
            top,
            left,
            right,
            bottom,
            width,
            height,
        });
    };

    const onSizeFormatChange = async (width: number, height: number, format: Pic.ImageFormat) => {
        if (!prepare()) return;

        const size = {
            width,
            height,
        };

        if ($appState.currentImageFile.detail.format == format) {
            await resize({ size });
        } else {
            await resize({ size, format });
        }

        unlock();
    };

    const requestEdit = async () => {
        if ($appState.editMode === "Clip") {
            if (!prepare()) return;

            const clipInfo = getClipInfo();

            if (!clipInfo) return clearClip();

            await clipImage(clipInfo);
        }

        if ($appState.editMode === "Resize" && imageTransform.isResized()) {
            if (!prepare()) return;
            const scale = imageTransform.getScale();

            const size = {
                width: Math.floor($appState.currentImageFile.detail.width * scale),
                height: Math.floor($appState.currentImageFile.detail.height * scale),
            };

            await resize({ size });
        }

        unlock();
    };

    const showEditResult = (image: Pic.ImageFile) => {
        if (redoStack.length) {
            redoStack.length = 0;
        }

        undoStack.push(structuredClone($appState.currentImageFile));

        changeButtonState();

        if ($appState.editMode == "Clip") {
            clearClip();
        }

        changeResizeMode(false);

        loadImage(image);
    };

    const onWindowResize = () => {
        if (img.src) {
            imageTransform.onWindowResize();
            clearClip();
        }
    };

    const minimize = async () => {
        await ipc.sendTo("main", "minimize", {});
    };

    const toggleMaximize = async () => {
        await ipc.sendTo("main", "toggle-maximize", {});
    };

    const onWindowSizeChanged = async () => {
        const isMaximized = await WebviewWindow.getCurrent().isMaximized();
        dispatch({ type: "isMaximized", value: isMaximized });
    };

    const onTransformChange = () => {
        if (imageTransform.isResized() && $appState.editMode == "Clip") {
            changeEditMode("Resize");
        }

        changeButtonState();

        dispatch({ type: "imageScale", value: imageTransform.getScale() });
        dispatch({ type: "imageRatio", value: imageTransform.getImageRatio() });
    };

    const prepare = () => {
        if ($appState.loading) {
            return false;
        }
        lock();
        return true;
    };

    const applyConfig = (data: Pic.Settings) => {
        dispatch({ type: "isMaximized", value: data.isMaximized });
        undoStack.length = 0;
        redoStack.length = 0;
    };

    const clear = () => {
        unlock();
        dispatch({ type: "clearImage" });
        changeEditMode($appState.editMode);
        changeResizeMode(false);
    };

    const close = async () => {
        clear();
        await ipc.sendTo("main", "on-edit-close", {});
    };

    const lock = () => {
        dispatch({ type: "loading", value: true });
    };

    const unlock = () => {
        dispatch({ type: "loading", value: false });
    };

    const updateSettings = (newSettings: Pic.Settings) => {
        settings = newSettings;
    };

    const onOpen = (data: Pic.OpenEditEvent) => {
        applyConfig(data.settings);
        loadImage(data.file);
    };

    onMount(() => {
        imageTransform.init(imageArea, img);
        imageTransform.on("transformchange", onTransformChange);
        imageTransform.on("dragstart", onImageDragStart);
        imageTransform.on("dragend", onImageDragEnd);
        ipc.receiveTauri("tauri://resize", onWindowSizeChanged);
        ipc.receive("sync-setting", updateSettings);
        ipc.receive("open-edit-dialog", onOpen);

        return () => {
            ipc.release();
        };
    });

    const handelKeydown = () => {};
</script>

<svelte:window onresize={onWindowResize} />
<svelte:document onkeydown={onKeydown} onmousedown={onMouseDown} onmousemove={onMousemove} onmouseup={onMouseup} />

<div class="viewport" class:dragging={$appState.dragging}>
    <div
        class="title-bar"
        class:can-undo={$appState.canUndo}
        class:can-redo={$appState.canRedo}
        class:resized={$appState.isResized}
        class:edited={$appState.isEdited}
        class:clipping={$appState.editMode == "Clip"}
        class:shrinkable={$appState.allowShrink}
        class:is-icon={$appState.currentImageFile.detail.format == "ico"}
    >
        <div class="icon-area">
            <img class="ico" src={icon} alt="" />
            <span id="title">{$appState.currentImageFile.fileName}</span>
        </div>
        <div class="menu header">
            <div class="btn-area">
                <div class="btn clip" title="clip" onclick={() => changeEditMode("Clip")} onkeydown={handelKeydown} role="button" tabindex="-1"><Clip /></div>
                <div class="btn resize" title="resize" onclick={resizeImage} onkeydown={handelKeydown} role="button" tabindex="-1"><Resize /></div>
                <div class="btn size" title="change size" onclick={openSizeDialog} onkeydown={handelKeydown} role="button" tabindex="-1"><ChangeSize /></div>
                <div class="separator btn"></div>
                <div class="btn undo" title="Undo" onclick={undo} onkeydown={handelKeydown} role="button" tabindex="-1"><Undo /></div>
                <div class="btn redo" title="Redo" onclick={redo} onkeydown={handelKeydown} role="button" tabindex="-1"><Redo /></div>
                <div class="btn shrink" title="Enable Shrink" onclick={() => changeResizeMode(!imageTransform.isShrinkable())} onkeydown={handelKeydown} role="button" tabindex="-1"><Shrink /></div>
                <div class="separator btn"></div>
                <div class="btn save-copy" title="Save Copy" onclick={() => saveImage(true)} onkeydown={handelKeydown} role="button" tabindex="-1"><SaveCopy /></div>
                <div class="btn save" title="Save" onclick={() => saveImage(false)} onkeydown={handelKeydown} role="button" tabindex="-1"><Save /></div>
            </div>
        </div>
        <div class="window-area">
            <div class="info-area">
                <div class="scale-text">{`${$appState.renderedWidth} x ${$appState.renderedHeight}`}</div>
                <div class="scale-text">{`${Math.floor($appState.imageRatio * 100)}%`}</div>
            </div>
            <div class="control-area">
                <div class="minimize" onclick={minimize} onkeydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
                <div class="maximize" onclick={toggleMaximize} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <div class:maxbtn={$appState.isMaximized} class:minbtn={!$appState.isMaximized}></div>
                </div>
                <div class="close" onclick={close} onkeydown={handelKeydown} role="button" tabindex="-1">&larr;</div>
            </div>
        </div>
    </div>

    <div class="container clickable" draggable="false">
        <Loader show={$appState.loading} />
        {#if $appState.isSizeDialogOpen}
            <Size onApply={onSizeFormatChange} />
        {/if}
        <div class="image-container clickable">
            <div bind:this={imageArea} class="image-area clickable" onwheel={imageTransform.onWheel}>
                {#if $appState.clipping}
                    <div class="clip-canvas clickable" style={$appState.clipCanvasStyle}>
                        <div bind:this={clipArea} class="clip-area" style={$appState.clipAreaStyle}></div>
                    </div>
                {/if}
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <img src={$appState.currentImageFile.src} bind:this={img} class="pic clickable" alt="" onmousedown={onImageMousedown} onload={onImageLoaded} draggable="false" />
            </div>
        </div>
    </div>
</div>
