<script lang="ts">
    import Viewer from "./view/Viewer.svelte";
    import Edit from "./edit/Edit.svelte";
    import { appState } from "./state.svelte";
    import { onMount } from "svelte";
    import Settings from "./settings";
    import util from "./util";
    import { IPC } from "./ipc";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

    const ipc = new IPC("edit");

    let ready = $state(false);
    let settings = new Settings();

    const onWindowSizeChanged = async () => {
        const isFullscreen = await WebviewWindow.getCurrent().isFullscreen();
        if (isFullscreen) return;

        const isMaximized = await WebviewWindow.getCurrent().isMaximized();
        appState.settings.isMaximized = isMaximized;
    };

    const toggleMaximize = async () => {
        const renderer = WebviewWindow.getCurrent();
        const maximized = await renderer.isMaximized();
        if (maximized) {
            await renderer.unmaximize();
            await renderer.setPosition(util.toPhysicalPosition(appState.settings.bounds));
            await renderer.setSize(util.toPhysicalSize(appState.settings.bounds));
        } else {
            const bounds = await renderer.outerPosition();
            const size = await renderer.size();
            appState.settings.bounds = util.toBounds(bounds, size);
            await renderer.maximize();
        }
    };

    const minimize = async () => {
        await WebviewWindow.getCurrent().minimize();
    };

    const prepare = async () => {
        appState.settings = await settings.init();
        await ipc.invoke("prepare_windows", appState.settings.preference);
        await ipc.invoke("listen_file_drop", "imageContainer");

        const main = WebviewWindow.getCurrent();

        await main.setPosition(util.toPhysicalPosition(appState.settings.bounds));

        await main.setSize(util.toPhysicalSize(appState.settings.bounds));

        if (appState.settings.isMaximized) {
            await main.maximize();
        }

        const files = await ipc.invoke("get_init_args", undefined);

        if (files.length) {
            appState.workingImage = await util.toImageFile(files[0]);
        } else if (appState.settings.fullPath) {
            const found = await util.exists(appState.settings.fullPath);
            if (found) {
                appState.workingImage = await util.toImageFile(appState.settings.fullPath);
            }
        }

        ready = true;
        await main.show();
    };

    const close = async () => {
        await ipc.invoke("unlisten_file_drop", undefined);

        await settings.save(appState.settings);

        await WebviewWindow.getCurrent().close();
    };

    onMount(() => {
        prepare();
        ipc.receiveTauri("tauri://resize", onWindowSizeChanged);
        ipc.receive("toggle-maximize", toggleMaximize);
        ipc.receive("minimize", minimize);
        ipc.receive("close", close);

        return () => {
            ipc.release();
        };
    });
</script>

{#if ready}
    {#if appState.mode == "view"}
        <Viewer />
    {:else}
        <Edit />
    {/if}
{/if}
