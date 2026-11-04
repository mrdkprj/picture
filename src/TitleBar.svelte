<script lang="ts">
    import type { Snippet } from "svelte";
    import icon from "./assets/icon.png";
    import { OS } from "./constants";
    import { IPC } from "./ipc";
    import { appState } from "./state.svelte";

    const ipc = new IPC("main");

    let { titleText, titleTooltip, closeText, center, info, close }: { titleText: string; titleTooltip: string; closeText: string; center: Snippet; info: Snippet; close: () => void } = $props();

    const toggleMaximize = async () => {
        await ipc.send("toggle-maximize", {});
    };

    const minimize = async () => {
        await ipc.send("minimize", {});
    };

    const handelKeydown = () => {};
</script>

<div
    class="title-bar"
    data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}
    style:--background={"var(--menu-bgcolor)"}
    style:--color={"var(--menu-color)"}
    style:--toggleHover={"var(--primary-button-hover-color)"}
    style:--toggleButtonHover={"var(--primary-button-hover-color2)"}
>
    <div class="titlebar-drag-region"></div>
    <div class="titlebar-left" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
        <div class="icon-area" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
            <img class="ico" src={icon} alt="" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null} />
            <div class="title" title={titleTooltip} data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
                {titleText}
            </div>
        </div>
    </div>
    <div class="titlebar-center">
        {@render center()}
    </div>
    <div class="titlebar-right" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
        <div class="info-area">
            {@render info()}
        </div>
    </div>
    <div class="window-area">
        <div class="minimize" onclick={minimize} onkeydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
        <div class="maximize" onclick={toggleMaximize} onkeydown={handelKeydown} role="button" tabindex="-1">
            <div class:maxbtn={appState.settings.isMaximized} class:minbtn={!appState.settings.isMaximized}></div>
        </div>
        <div class="close" onclick={close} onkeydown={handelKeydown} role="button" tabindex="-1">{@html closeText}</div>
    </div>
</div>

<style>
    .title-bar {
        position: relative;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        height: 35px;
        min-height: 35px;
        width: 100%;
        color: var(--color);
        background-color: var(--background);
        user-select: none;
        -webkit-user-select: none;
    }

    .icon-area {
        font-size: 12px;
        display: flex;
        justify-content: left;
        align-items: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
        height: 100%;
    }

    .ico {
        width: 16px;
        height: 16px;
        margin: 0 5px;
    }

    .title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .info-area {
        display: flex;
        justify-content: space-between;
        align-items: center;
        white-space: nowrap;
        height: 100%;
        overflow: hidden;
        min-width: 50%;
    }

    .window-area {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 100%;
        position: relative;
        min-width: fit-content;
        order: 3;
    }

    .minimize,
    .maximize,
    .close {
        width: 45px;
        height: 100%;
        text-align: center;
        line-height: 30px;
        user-select: none;
        position: relative;
        -webkit-app-region: no-drag;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .maximize {
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1;
    }

    .minimize:hover,
    .maximize:hover {
        background-color: var(--toggleHover);
    }

    .maximize:hover .minbtn,
    .maximize:hover .maxbtn {
        background-color: var(--toggleButtonHover);
    }

    .minbtn,
    .maxbtn {
        position: relative;
        width: 7px;
        height: 7px;
        border: 1px solid var(--color);
        background-color: var(--background);
        pointer-events: none;
    }

    .maxbtn::after {
        content: "";
        width: 7px;
        height: 7px;
        position: absolute;
        top: -3px;
        left: 1px;
        z-index: -1;
        border: 1px solid var(--color);
    }

    .titlebar-drag-region {
        top: 0;
        left: 0;
        display: block;
        position: absolute;
        width: 100%;
        height: 100%;
        -webkit-app-region: drag;
    }

    .titlebar-left {
        order: 0;
        width: 20%;
        flex-grow: 2;
        justify-content: flex-start;
        display: flex;
        height: 100%;
        align-items: center;
        position: relative;
    }

    .titlebar-center {
        order: 1;
        width: 60%;
        max-width: fit-content;
        min-width: 0px;
        justify-content: center;
        display: flex;
        height: 100%;
        align-items: center;
        position: relative;
    }

    .titlebar-right {
        order: 2;
        width: calc(20% - 135px);
        min-width: min-content;
        flex-grow: 2;
        justify-content: flex-end;
        display: flex;
        height: 100%;
        align-items: center;
        position: relative;
    }
</style>
