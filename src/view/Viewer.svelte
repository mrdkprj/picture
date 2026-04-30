<script lang="ts">
    import { onMount } from "svelte";
    import Loader from "../assets/Loader.svelte";
    import History from "./History.svelte";
    import icon from "../assets/icon.png";
    import { viewState, dispatch } from "./viewStateReducer";
    import { appState } from "../state.svelte";
    import { ImageTransform } from "../imageTransform";
    import { Orientations, FORWARD, BACKWARD, Extensions, BROWSER_SHORTCUT_KEYS } from "../constants";
    import { IPC } from "../ipc";
    import util from "../util";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
    import path from "../path";
    import { getDropFiles } from "../fileDropHandler";
    import EditPic from "../assets/EditPic.svelte";
    import RotateLeft from "../assets/RotateLeft.svelte";
    import RotateRight from "../assets/RotateRight.svelte";
    import Delete from "../assets/Delete.svelte";
    import Pinned from "../assets/Pinned.svelte";
    import Pin from "../assets/Pin.svelte";
    import OpenMenu from "../assets/OpenMenu.svelte";
    import NotFound from "../assets/NotFound.svelte";
    import { scale } from "svelte/transition";

    let orientationIndex = 0;
    let imageArea: HTMLDivElement;
    let img: HTMLImageElement;

    const ipc = new IPC("main");
    const imageTransform = new ImageTransform();

    const updateImageDetail = async () => {
        if (!appState.imageFiles.length) {
            return;
        }

        const found = await util.exists($viewState.currentImageFile.fullPath);
        if (!found) {
            return;
        }

        const imageFile = $viewState.currentImageFile;

        try {
            const metadataString = await util.getMetadata(imageFile.fullPath, imageFile.buffer);

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
                dispatch({ type: "isHistoryOpen", value: !$viewState.isHistoryOpen });
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
                sortImageFiles(appState.imageFiles, e.id as Pic.SortType, $viewState.currentImageFile.fileName);
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
                loadFiles($viewState.currentImageFile.fullPath);
                break;
            }
        }
    };

    const fetchImage = async (index: number) => {
        if (!appState.imageFiles.length) {
            return;
        }

        if (index >= appState.imageFiles.length) {
            return;
        }

        if (index < 0) {
            return;
        }

        dispatch({ type: "index", value: index });
        await updateImageDetail();
    };

    const fetchFirst = async () => {
        if (appState.imageFiles.length) {
            await fetchImage(0);
        }
    };

    const fetchLast = async () => {
        if (appState.imageFiles.length) {
            await fetchImage(appState.imageFiles.length - 1);
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
        const imageFile = $viewState.currentImageFile;
        if (!imageFile.fullPath) return;

        const orientation = Orientations[orientationIndex];

        try {
            const buffer = await util.rotate(imageFile.fullPath, imageFile.detail.orientation == 0 ? 1 : imageFile.detail.orientation, orientation);
            if (appState.settings.preference.timestamp == "Normal") {
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

        const imageFile = $viewState.currentImageFile;

        if (!imageFile.fullPath) return;

        try {
            await ipc.invoke("trash", imageFile.fullPath);

            dispatch({ type: "removeFile" });

            if ($viewState.currentIndex > 0) {
                dispatch({ type: "index", value: $viewState.currentIndex-- });
            }

            if (appState.imageFiles.length - 1 > $viewState.currentIndex) {
                dispatch({ type: "index", value: $viewState.currentIndex++ });
            }

            await fetchImage($viewState.currentIndex);
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
        unlock();
    };

    const pin = async () => {
        const imageFile = $viewState.currentImageFile;

        if (!imageFile.fullPath) return;

        appState.settings.fullPath = imageFile.fullPath;
        appState.settings.directory = path.dirname(appState.settings.fullPath);
        appState.settings.history[path.dirname(appState.settings.fullPath)] = path.basename(appState.settings.fullPath);
    };

    const toggleMaximize = async () => {
        await ipc.send("toggle-maximize", {});
    };

    const minimize = async () => {
        await ipc.send("minimize", {});
    };

    const reveal = async () => {
        const imageFile = $viewState.currentImageFile;

        if (!imageFile.fullPath) return;

        await ipc.invoke("reveal", imageFile.fullPath);
    };

    const openFile = async () => {
        const result = await ipc.invoke("open", {
            properties: ["OpenFile"],
            title: "Select image",
            default_path: appState.settings.directory ? appState.settings.directory : ".",
            filters: [{ name: "Image file", extensions: Extensions }],
        });

        if (result.file_paths.length == 1) {
            const file = result.file_paths[0];
            appState.settings.directory = path.dirname(file);
            await loadFiles(file);
        }
    };

    const changeTimestampMode = (timestampMode: Pic.Timestamp) => {
        appState.settings.preference.timestamp = timestampMode;
    };

    const toggleMode = (mode: Pic.Mode) => {
        appState.settings.preference.mode = mode;
    };

    const toggleTheme = async (theme: Pic.Theme) => {
        appState.settings.preference.theme = theme;
        await ipc.invoke("change_theme", theme);
    };

    const exitFullscreen = async () => {
        dispatch({ type: "isFullscreen", value: false });
        // Cannot enter fullscreen if decoration is false
        await WebviewWindow.getCurrent().setDecorations(false);
        await WebviewWindow.getCurrent().setFullscreen(false);
    };

    const enterFullscreen = async () => {
        dispatch({ type: "isFullscreen", value: !$viewState.isFullscreen });
        // Cannot enter fullscreen if decoration is false
        await WebviewWindow.getCurrent().setDecorations(true);
        await WebviewWindow.getCurrent().setFullscreen(true);
    };

    const toggleFullscreen = async () => {
        if ($viewState.isFullscreen) {
            await exitFullscreen();
        } else {
            await enterFullscreen();
        }
    };

    const openEditDialog = () => {
        appState.workingImage = $viewState.currentImageFile;
        appState.mode = "edit";
    };

    const close = async () => {
        const imageFile = $viewState.currentImageFile;

        if (imageFile.fullPath && appState.settings.history[imageFile.directory]) {
            await pin();
        }
        await ipc.send("close", {});
    };

    const loadFiles = async (fullPath: string) => {
        const targetFile = path.basename(fullPath);
        const directory = path.dirname(fullPath);

        const allDirents = await ipc.invoke("readdir", directory);
        const fullPaths = allDirents.filter((dirent) => util.isImageFile(dirent)).map((dirent) => dirent.full_path);
        const imageFiles = await util.toImageFiles(fullPaths);
        sortImageFiles(imageFiles, appState.settings.preference.sort, targetFile);
    };

    const loadFilesFromDir = async (directory: string) => {
        const allDirents = await ipc.invoke("readdir", directory);

        const fullPaths = allDirents.filter((dirent) => util.isImageFile(dirent)).map((dirent) => dirent.full_path);
        const imageFiles = await util.toImageFiles(fullPaths);
        sortImageFiles(imageFiles, appState.settings.preference.sort);
    };

    const sortImageFiles = (imageFiles: Pic.ImageFile[], sortType: Pic.SortType, currentFileName?: string) => {
        appState.settings.preference.sort = sortType;

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
            if ($viewState.isHistoryOpen) {
                dispatch({ type: "isHistoryOpen", value: false });
            }
            await exitFullscreen();
        }

        if (e.key == "F5") {
            await loadFiles($viewState.currentImageFile.fullPath);
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
        if (!$viewState.isHistoryOpen) return false;

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

        if (e.button == 2 && appState.settings.preference.mode != "Mouse") {
            return showContextMenu(e);
        }

        if (!imageTransform.isImageMoved() && e.target.classList.contains("clickable")) {
            if (appState.settings.preference.mode == "Mouse") {
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
        orientationIndex = Orientations.indexOf($viewState.currentImageFile.detail.orientation);

        imageTransform.setImage($viewState.currentImageFile);

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
        if ($viewState.locked) {
            return false;
        }

        if ($viewState.isHistoryOpen) {
            closeHistory();
        }

        lock();
        return true;
    };

    const startFetch = async (index: number) => {
        if (beforeRequest()) {
            await fetchImage($viewState.currentIndex + index);
            unlock();
        }
    };

    const showActualSize = () => {
        imageTransform.showActualSize();
    };

    const toggleHistory = () => {
        dispatch({ type: "isHistoryOpen", value: !$viewState.isHistoryOpen });
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

    const lock = () => {
        dispatch({ type: "locked", value: true });
    };

    const unlock = () => {
        dispatch({ type: "locked", value: false });
    };

    const prepare = async () => {
        if (appState.workingImage.fullPath) {
            await loadFiles(appState.workingImage.fullPath);
        }
    };

    onMount(() => {
        prepare();
        ipc.receive("contextmenu-event", mainContextMenuCallback);
        ipc.receiveTauri("tauri://drag-drop", onFileDrop);

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

<div
    in:scale={{ delay: 0, duration: 100 }}
    class="viewport"
    class:dragging={$viewState.dragging}
    class:mouse={appState.settings.preference.mode == "Mouse"}
    class:history-open={$viewState.isHistoryOpen}
    class:full={$viewState.isFullscreen}
>
    <div class="title-bar">
        <div class="icon-area">
            <img class="ico" src={icon} alt="" />
            <div class="title" title={$viewState.currentImageFile.fileName}>
                {$viewState.currentImageFile.fileName}
            </div>
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
                    {#if appState.settings.history[$viewState.currentImageFile.directory] == $viewState.currentImageFile.fileName}
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
                <div class="text">{`${$viewState.currentImageFile.detail.renderedWidth} x ${$viewState.currentImageFile.detail.renderedHeight}`}</div>
                <div class="text">{$viewState.scaleRate}</div>
                <div class="text">{$viewState.counter}</div>
            </div>
            <div class="control-area">
                <div class="minimize" onclick={minimize} onkeydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
                <div class="maximize" onclick={toggleMaximize} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <div class:maxbtn={appState.settings.isMaximized} class:minbtn={!appState.settings.isMaximized}></div>
                </div>
                <div class="close" onclick={close} onkeydown={handelKeydown} role="button" tabindex="-1">&times;</div>
            </div>
        </div>
    </div>

    <div class="container">
        <Loader show={$viewState.locked} />
        {#if $viewState.isHistoryOpen}
            <History {onHistoryItemClick} onClose={closeHistory} />
        {/if}

        <div id="imageContainer" class="image-container can-focus" ondragover={(e) => e.preventDefault()} role="button" tabindex="-1" draggable="false">
            <div class="prev-area prev" onclick={() => startFetch(BACKWARD)} onkeydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow left"></span>
            </div>
            <div bind:this={imageArea} class="image-area clickable current" onmousedown={onImageAreaMousedown} onwheel={imageTransform.onWheel} onkeydown={handelKeydown} role="button" tabindex="-1">
                <img src={$viewState.currentImageFile.src} bind:this={img} class="pic clickable" alt="" onload={onImageLoaded} draggable="false" />
                {#if $viewState.currentImageFile.type == "undefined"}
                    <NotFound />
                {/if}
            </div>
            <div class="next-area next" onclick={() => startFetch(FORWARD)} onkeydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow right"></span>
            </div>
        </div>
    </div>
</div>
