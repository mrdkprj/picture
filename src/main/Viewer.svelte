<script lang="ts">
    import { onMount } from "svelte";
    import Loader from "../Loader.svelte";
    import History from "./History.svelte";
    import icon from "../assets/icon.ico";
    import { appState, dispatch } from "./appStateReducer";
    import { ImageTransform } from "../imageTransform";
    import { Orientations, FORWARD, BACKWARD, Extensions, BROWSER_SHORTCUT_KEYS } from "../constants";
    import { IPC } from "../ipc";
    import util from "../util";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
    import path from "../path";
    import Settings from "../settings";
    import { getDropFiles } from "../fileDropHandler";
    import EditPic from "../assets/EditPic.svelte";
    import RotateLeft from "../assets/RotateLeft.svelte";
    import RotateRight from "../assets/RotateRight.svelte";
    import Delete from "../assets/Delete.svelte";
    import Pinned from "../assets/Pinned.svelte";
    import Pin from "../assets/Pin.svelte";
    import OpenMenu from "../assets/OpenMenu.svelte";
    import NotFound from "../assets/NotFound.svelte";

    let orientationIndex = 0;
    let imageArea: HTMLDivElement;
    let img: HTMLImageElement;
    let topRendererName: RendererName = "main";
    let settings = new Settings();

    const ipc = new IPC("main");
    const imageTransform = new ImageTransform();

    const updateImageDetail = async () => {
        if (!$appState.imageFiles.length) {
            return;
        }

        const found = await util.exists($appState.currentImageFile.fullPath);
        if (!found) {
            return;
        }

        const imageFile = $appState.currentImageFile;

        try {
            const metadataString = await util.getMetadata(imageFile.fullPath);

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

            dispatch({ type: "updateImageDetail", value: imageFile.detail });
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const mainContextMenuCallback = async (e: Pic.ContextMenuEvent) => {
        const id = e.name ? e.name : e.id;

        switch (id) {
            case "OpenFile":
                openFile();
                break;
            case "Reveal":
                reveal();
                break;
            case "History":
                dispatch({ type: "isHistoryOpen", value: !$appState.isHistoryOpen });
                break;
            case "ShowActualSize":
                showActualSize();
                break;
            case "ToFirst":
                fetchFirst();
                break;
            case "ToLast":
                fetchLast();
                break;
            case "Sort": {
                sortImageFiles($appState.imageFiles, e.id as Pic.SortType, $appState.currentImageFile.fileName);
                break;
            }
            case "Timestamp":
                changeTimestampMode(e.id as Pic.Timestamp);
                break;
            case "Mode":
                toggleMode(e.id as Pic.Mode);
                break;
            case "Theme":
                toggleTheme(e.id as Pic.Theme);
                break;
            case "Reload": {
                loadFiles($appState.currentImageFile.fullPath);
                break;
            }
        }
    };

    const fetchImage = async (index: number) => {
        if (!$appState.imageFiles.length) {
            return;
        }

        if (index == 1 && $appState.imageFiles.length - 1 <= $appState.currentIndex) {
            return;
        }

        if (index == -1 && $appState.currentIndex <= 0) {
            return;
        }

        dispatch({ type: "index", value: index });
        await updateImageDetail();
    };

    const fetchFirst = async () => {
        if ($appState.imageFiles.length) {
            await fetchImage(0);
        }
    };

    const fetchLast = async () => {
        if ($appState.imageFiles.length) {
            await fetchImage($appState.imageFiles.length - 1);
        }
    };

    const onHistoryItemClick = async (fullPath: string): Promise<boolean> => {
        let found = await util.exists(fullPath);
        if (found) {
            await loadFiles(fullPath);
            return true;
        }

        const directory = path.dirname(fullPath);

        found = await util.exists(directory);
        if (found) {
            await loadFilesFromDir(directory);
            return true;
        }

        return false;
    };

    const rotate = async () => {
        const imageFile = $appState.currentImageFile;
        if (!imageFile.fullPath) return;

        const orientation = Orientations[orientationIndex];

        try {
            const buffer = await util.rotate(imageFile.fullPath, imageFile.detail.orientation == 0 ? 1 : imageFile.detail.orientation, orientation);
            if ($appState.settings.preference.timestamp == "Normal") {
                await util.saveFile(imageFile.fullPath, buffer);
            } else {
                await util.saveFile(imageFile.fullPath, buffer, imageFile.timestamp);
            }
            dispatch({ type: "updateOrientation", value: orientation });
            dispatch({ type: "updateCurrentImage" });
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    const deleteFile = async () => {
        if (!beforeRequest()) return;

        const imageFile = $appState.currentImageFile;

        if (!imageFile.fullPath) return;

        try {
            await ipc.invoke("trash", imageFile.fullPath);

            dispatch({ type: "removeFile" });

            if ($appState.currentIndex > 0) {
                dispatch({ type: "index", value: $appState.currentIndex-- });
            }

            if ($appState.imageFiles.length - 1 > $appState.currentIndex) {
                dispatch({ type: "index", value: $appState.currentIndex++ });
            }

            await fetchImage($appState.currentIndex);
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
        unlock();
    };

    const updateSettings = (settings: Pic.Settings) => {
        dispatch({ type: "settings", value: settings });
    };

    const pin = async () => {
        const imageFile = $appState.currentImageFile;

        if (!imageFile.fullPath) return;

        const settings = { ...$appState.settings };
        settings.fullPath = imageFile.fullPath;
        settings.directory = path.dirname(settings.fullPath);
        settings.history[path.dirname(settings.fullPath)] = path.basename(settings.fullPath);
        updateSettings(settings);
    };

    const toggleMaximize = async () => {
        const renderer = topRendererName === "main" ? await WebviewWindow.getByLabel("main") : await WebviewWindow.getByLabel("edit");

        if (!renderer) return;

        const maximized = await renderer.isMaximized();
        if (maximized) {
            await renderer.unmaximize();
            await renderer.setPosition(util.toPhysicalPosition($appState.settings.bounds));
            await renderer.setSize(util.toPhysicalSize($appState.settings.bounds));
        } else {
            const bounds = await renderer.outerPosition();
            const size = await renderer.size();
            const settings = { ...$appState.settings };
            settings.bounds = util.toBounds(bounds, size);
            updateSettings(settings);
            await renderer.maximize();
        }
    };

    const minimize = async () => {
        const renderer = topRendererName === "main" ? await WebviewWindow.getByLabel("main") : await WebviewWindow.getByLabel("edit");

        if (!renderer) return;

        await renderer.minimize();
    };

    const changeTopRenderer = async (name: RendererName) => {
        topRendererName = name;

        const nextTopRenderer = topRendererName === "main" ? await WebviewWindow.getByLabel("main") : await WebviewWindow.getByLabel("edit");
        const hidingRenderer = topRendererName === "main" ? await WebviewWindow.getByLabel("edit") : await WebviewWindow.getByLabel("main");

        if ($appState.settings.isMaximized) {
            await nextTopRenderer?.maximize();
        }

        if (!$appState.settings.isMaximized) {
            await nextTopRenderer?.setPosition(util.toPhysicalPosition($appState.settings.bounds));
            await nextTopRenderer?.setSize(util.toPhysicalSize($appState.settings.bounds));
            await nextTopRenderer?.unmaximize();
        }

        await hidingRenderer?.hide();
        await nextTopRenderer?.show();
    };

    const onWindowSizeChanged = async () => {
        const isFullscreen = await WebviewWindow.getCurrent().isFullscreen();
        if (isFullscreen) return;

        const isMaximized = await WebviewWindow.getCurrent().isMaximized();
        dispatch({ type: "isMaximized", value: isMaximized });
        const settings = { ...$appState.settings };
        settings.isMaximized = isMaximized;
        updateSettings(settings);
    };

    const onCloseEditDialog = () => changeTopRenderer("main");

    const reveal = async () => {
        const imageFile = $appState.currentImageFile;

        if (!imageFile.fullPath) return;

        await ipc.invoke("reveal", imageFile.fullPath);
    };

    const openFile = async () => {
        const result = await ipc.invoke("open", {
            properties: ["OpenFile"],
            title: "Select image",
            default_path: $appState.settings.directory ? $appState.settings.directory : ".",
            filters: [{ name: "Image file", extensions: Extensions }],
        });

        if (result.file_paths.length == 1) {
            const file = result.file_paths[0];
            const settings = { ...$appState.settings };
            settings.directory = path.dirname(file);
            updateSettings(settings);

            await loadFiles(file);
        }
    };

    const changeTimestampMode = (timestampMode: Pic.Timestamp) => {
        const settings = { ...$appState.settings };
        settings.preference.timestamp = timestampMode;
        updateSettings(settings);
    };

    const toggleMode = (mode: Pic.Mode) => {
        const settings = { ...$appState.settings };
        settings.preference.mode = mode;
        updateSettings(settings);
        dispatch({ type: "isMouseOnly", value: mode === "Mouse" });
    };

    const toggleTheme = async (theme: Pic.Theme) => {
        const settings = { ...$appState.settings };
        settings.preference.theme = theme;
        updateSettings(settings);

        await ipc.invoke("change_theme", theme);
    };

    const exitFullscreen = async () => {
        dispatch({ type: "isFullscreen", value: false });
        // Cannot enter fullscreen if decoration is false
        await WebviewWindow.getCurrent().setDecorations(false);
        await WebviewWindow.getCurrent().setFullscreen(false);
    };

    const enterFullscreen = async () => {
        dispatch({ type: "isFullscreen", value: !$appState.isFullscreen });
        // Cannot enter fullscreen if decoration is false
        await WebviewWindow.getCurrent().setDecorations(true);
        await WebviewWindow.getCurrent().setFullscreen(true);
    };

    const toggleFullscreen = async () => {
        if ($appState.isFullscreen) {
            await exitFullscreen();
        } else {
            await enterFullscreen();
        }
    };

    const openEditDialog = async () => {
        const file = $appState.currentImageFile;
        await ipc.sendTo("edit", "open-edit-dialog", { file, settings: $appState.settings });

        await changeTopRenderer("edit");
    };

    const beforeClose = async () => {
        await ipc.invoke("unlisten_file_drop", undefined);
        const imageFile = $appState.currentImageFile;

        if (imageFile.fullPath && $appState.settings.history[imageFile.directory]) {
            await pin();
        }

        await settings.save($appState.settings);

        const edit = await WebviewWindow.getByLabel("edit");
        await edit?.destroy();
        WebviewWindow.getCurrent().destroy();
    };

    const loadFiles = async (fullPath: string) => {
        const targetFile = path.basename(fullPath);
        const directory = path.dirname(fullPath);

        const allDirents = await ipc.invoke("readdir", directory);
        const fullPaths = allDirents.filter((dirent) => util.isImageFile(dirent)).map((dirent) => dirent.full_path);
        const imageFiles = await util.toImageFiles(fullPaths);
        sortImageFiles(imageFiles, $appState.settings.preference.sort, targetFile);
    };

    const loadFilesFromDir = async (directory: string) => {
        const allDirents = await ipc.invoke("readdir", directory);

        const fullPaths = allDirents.filter((dirent) => util.isImageFile(dirent)).map((dirent) => dirent.full_path);
        const imageFiles = await util.toImageFiles(fullPaths);
        sortImageFiles(imageFiles, $appState.settings.preference.sort);
    };

    const sortImageFiles = (imageFiles: Pic.ImageFile[], sortType: Pic.SortType, currentFileName?: string) => {
        const settings = { ...$appState.settings };
        settings.preference.sort = sortType;
        updateSettings(settings);

        if (!imageFiles.length) return;

        util.sort(imageFiles, sortType);

        dispatch({ type: "files", value: imageFiles });

        if (currentFileName) {
            const currentIndex = imageFiles.findIndex((imageFile) => imageFile.fileName === currentFileName);
            dispatch({ type: "index", value: currentIndex });
        } else {
            dispatch({ type: "index", value: 0 });
        }
    };

    const onKeydown = async (e: KeyboardEvent) => {
        if (e.ctrlKey && BROWSER_SHORTCUT_KEYS.includes(e.key)) {
            e.preventDefault();
        }

        if (e.ctrlKey) {
            if (e.key == "ArrowRight") {
                await rotateRight();
                return;
            }

            if (e.key == "ArrowLeft") {
                await rotateLeft();
                return;
            }

            if (e.key == "ArrowUp") {
                orientationIndex = 0;
                await rotate();
                return;
            }

            if (e.key == "ArrowDown") {
                orientationIndex = 2;
                await rotate();
                return;
            }

            if (e.key == "r") {
                e.preventDefault();
            }

            if (e.key == "h") {
                toggleHistory();
            }

            if (e.key == "s") {
                e.preventDefault();
                await pin();
            }
        }

        if (e.key == "F11") {
            e.preventDefault();
            await toggleFullscreen();
        }

        if (e.key == "Escape") {
            await exitFullscreen();
        }

        if (e.key == "F5") {
            await loadFiles($appState.currentImageFile.fullPath);
        }

        if (e.key === "Delete") {
            await deleteFile();
        }

        if (e.key === "ArrowRight") {
            await startFetch(FORWARD);
        }

        if (e.key === "ArrowLeft") {
            await startFetch(BACKWARD);
        }
    };

    const shouldCloseHistory = (e: MouseEvent) => {
        if (!$appState.isHistoryOpen) return false;

        return !e.composedPath().some((target) => target instanceof HTMLElement && target.classList.contains("history"));
    };

    const onImageAreaMousedown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains("clickable")) {
            imageTransform.onMousedown(e);
        }
    };

    const showContextMenu = async (e: MouseEvent) => {
        await ipc.invoke("open_context_menu", { x: e.screenX, y: e.screenY });
    };

    const onMouseup = async (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (shouldCloseHistory(e)) {
            return closeHistory();
        }

        if (e.button == 2 && !$appState.isMouseOnly) {
            return showContextMenu(e);
        }

        if (!imageTransform.isImageMoved() && e.target.classList.contains("clickable")) {
            if ($appState.isMouseOnly) {
                e.preventDefault();
                if (e.button == 0) {
                    await startFetch(-1);
                }

                if (e.button == 2) {
                    await startFetch(1);
                }
            }
        }

        imageTransform.onMouseup(e);
    };

    const onImageDragStart = () => {
        dispatch({ type: "dragging", value: true });
    };

    const onImageDragEnd = () => {
        dispatch({ type: "dragging", value: false });
    };

    const onImageLoaded = async () => {
        await updateImageDetail();
        orientationIndex = Orientations.indexOf($appState.currentImageFile.detail.orientation);

        imageTransform.setImage($appState.currentImageFile);

        unlock();
    };

    const changeInfoTexts = () => {
        const scaleRate = `${Math.floor(imageTransform.getImageRatio() * 100)}%`;
        dispatch({ type: "scaleRate", value: scaleRate });
    };

    const rotateLeft = async () => {
        orientationIndex--;
        if (orientationIndex < 0) {
            orientationIndex = Orientations.length - 1;
        }

        await rotate();
    };

    const rotateRight = async () => {
        orientationIndex++;
        if (orientationIndex > Orientations.length - 1) {
            orientationIndex = 0;
        }

        await rotate();
    };

    const beforeRequest = () => {
        if ($appState.locked) {
            return false;
        }

        if ($appState.isHistoryOpen) {
            closeHistory();
        }

        lock();
        return true;
    };

    const startFetch = async (index: number) => {
        if (beforeRequest()) {
            await fetchImage($appState.currentIndex + index);
            unlock();
        }
    };

    const onEditImage = async () => {
        loadFiles($appState.currentImageFile.fullPath);
    };

    const showActualSize = () => {
        imageTransform.showActualSize();
    };

    const toggleHistory = () => {
        dispatch({ type: "isHistoryOpen", value: !$appState.isHistoryOpen });
    };

    const closeHistory = () => {
        dispatch({ type: "isHistoryOpen", value: false });
    };

    const onFileDrop = async (e: Pic.FileDropEvent) => {
        const files = getDropFiles(e);
        if (files.length) {
            await loadFiles(files[0]);
        }
    };

    const close = () => {
        WebviewWindow.getCurrent().close();
    };

    const lock = () => {
        dispatch({ type: "locked", value: true });
    };

    const unlock = () => {
        dispatch({ type: "locked", value: false });
    };

    const prepare = async () => {
        await ipc.invoke("prepare_windows", $appState.settings.preference);
        await ipc.invoke("listen_file_drop", "imageContainer");

        dispatch({ type: "isMaximized", value: $appState.settings.isMaximized });
        toggleMode($appState.settings.preference.mode);

        const main = WebviewWindow.getCurrent();

        await main.setPosition(util.toPhysicalPosition($appState.settings.bounds));

        await main.setSize(util.toPhysicalSize($appState.settings.bounds));

        if ($appState.settings.isMaximized) {
            await main.maximize();
        }

        await main.show();

        const files = await ipc.invoke("get_init_args", undefined);

        if (files.length) {
            return await loadFiles(files[0]);
        }

        if ($appState.settings.fullPath) {
            const found = await util.exists($appState.settings.fullPath);
            if (found) {
                await loadFiles($appState.settings.fullPath);
            }
        }
    };

    onMount(() => {
        const initSettings = async () => {
            const data = await settings.init();
            updateSettings(data);
        };
        initSettings();
        ipc.receiveOnce("backend-ready", prepare);
        ipc.receiveTauri("tauri://close-requested", beforeClose);
        ipc.receive("contextmenu-event", mainContextMenuCallback);
        ipc.receiveTauri("tauri://drag-drop", onFileDrop);
        ipc.receiveTauri("tauri://resize", onWindowSizeChanged);
        ipc.receive("on-edit-close", onCloseEditDialog);
        ipc.receive("toggle-maximize", toggleMaximize);
        ipc.receive("minimize", minimize);
        ipc.receive("after-edit-image", onEditImage);

        imageTransform.init(imageArea, img);
        imageTransform.on("transformchange", changeInfoTexts);
        imageTransform.on("dragstart", onImageDragStart);
        imageTransform.on("dragend", onImageDragEnd);

        return () => {
            ipc.release();
        };
    });

    const handelKeydown = () => {};
</script>

<svelte:window onresize={imageTransform.onWindowResize} />
<svelte:document onkeydown={onKeydown} onmousemove={imageTransform.onMousemove} onmouseup={onMouseup} oncontextmenu={(e) => e.preventDefault()} />

<div class="viewport" class:dragging={$appState.dragging} class:mouse={$appState.isMouseOnly} class:history-open={$appState.isHistoryOpen} class:full={$appState.isFullscreen}>
    <div class="title-bar">
        <div class="icon-area">
            <img class="ico" src={icon} alt="" />
            <div class="title" title={$appState.currentImageFile.fileName}>
                {$appState.currentImageFile.fileName}
            </div>
            <div class="category">{$appState.category}</div>
        </div>
        <div class="menu header">
            <div class="btn-area">
                <div class="btn can-focus" onclick={openEditDialog} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <EditPic />
                </div>
                <div class="btn can-focus" onclick={rotateLeft} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <RotateLeft />
                </div>
                <div class="btn can-focus" onclick={deleteFile} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <Delete />
                </div>
                <div class="btn can-focus" onclick={rotateRight} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <RotateRight />
                </div>
                <div class="btn can-focus" onclick={pin} onkeydown={handelKeydown} role="button" tabindex="-1">
                    {#if $appState.settings.history[$appState.currentImageFile.directory] == $appState.currentImageFile.fileName}
                        <Pinned />
                    {:else}
                        <Pin />
                    {/if}
                </div>
                <div class="btn can-focus" onclick={showContextMenu} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <OpenMenu />
                </div>
            </div>
        </div>
        <div class="window-area">
            <div class="info-area">
                <div class="text">{`${$appState.currentImageFile.detail.renderedWidth} x ${$appState.currentImageFile.detail.renderedHeight}`}</div>
                <div class="text">{$appState.scaleRate}</div>
                <div class="text">{$appState.counter}</div>
            </div>
            <div class="control-area">
                <div class="minimize" onclick={minimize} onkeydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
                <div class="maximize" onclick={toggleMaximize} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <div class:maxbtn={$appState.isMaximized} class:minbtn={!$appState.isMaximized}></div>
                </div>
                <div class="close" onclick={close} onkeydown={handelKeydown} role="button" tabindex="-1">&times;</div>
            </div>
        </div>
    </div>

    <div class="container">
        <Loader show={$appState.locked} />
        {#if $appState.isHistoryOpen}
            <History {onHistoryItemClick} onClose={closeHistory} />
        {/if}

        <div id="imageContainer" class="image-container can-focus" ondragover={(e) => e.preventDefault()} role="button" tabindex="-1" draggable="false">
            <div class="prev-area prev" onclick={() => startFetch(BACKWARD)} onkeydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow left"></span>
            </div>
            <div bind:this={imageArea} class="image-area clickable current" onmousedown={onImageAreaMousedown} onwheel={imageTransform.onWheel} onkeydown={handelKeydown} role="button" tabindex="-1">
                <img src={$appState.currentImageFile.src} bind:this={img} class="pic clickable" alt="" onload={onImageLoaded} draggable="false" />
                {#if $appState.currentImageFile.type == "undefined"}
                    <NotFound />
                {/if}
            </div>
            <div class="next-area next" onclick={() => startFetch(FORWARD)} onkeydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow right"></span>
            </div>
        </div>
    </div>
</div>
