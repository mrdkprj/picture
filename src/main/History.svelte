<script lang="ts">
    import path from "../path";
    import { appState, dispatch } from "./appStateReducer";

    let {
        onClose,
        onHistoryItemClick,
    }: {
        onClose: () => void;
        onHistoryItemClick: (fullPath: string) => Promise<boolean>;
    } = $props();

    const onItemClick = async (e: MouseEvent) => {
        const fullPath = (e.target as HTMLElement).textContent ?? "";
        const result = await onHistoryItemClick(fullPath);
        if (!result) {
            const settings = reconstructHistory(path.dirname(fullPath));
            dispatch({ type: "settings", value: settings });
        } else {
            onClose();
        }
    };

    const reconstructHistory = (directory: string): Pic.Settings => {
        const settings = { ...$appState.settings };
        delete settings.history[directory];

        if (settings.directory == directory) {
            settings.directory = "";
            settings.fullPath = "";

            const historyDirectories = Object.keys(settings.history);
            if (historyDirectories.length > 0) {
                const newDirectory = historyDirectories[0];
                settings.directory = newDirectory;
                settings.fullPath = settings.history[newDirectory];
            }
        }
        return settings;
    };

    const removeHistory = (e: MouseEvent) => {
        const fullPath = (e.target as HTMLElement).nextElementSibling?.textContent ?? "";
        const settings = reconstructHistory(path.dirname(fullPath));
        dispatch({ type: "settings", value: settings });
    };

    const handelKeydown = () => {};
</script>

<div class="history-container can-focus" tabindex="-1">
    <div class="history-title">
        <div id="closeHistoryBtn" class="close-history-btn" onclick={onClose} onkeydown={handelKeydown} role="button" tabindex="-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
        </div>
    </div>
    <ul id="history" class="history">
        {#each Object.entries($appState.settings.history) as [key, value]}
            <li>
                <div class="remove-history-btn" onclick={removeHistory} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path
                            fill-rule="evenodd"
                            d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                        />
                    </svg>
                </div>
                <div class="history-item" title={`${key}\\${value}`} ondblclick={onItemClick} onkeydown={handelKeydown} role="button" tabindex="-1">
                    <div>{`${key}\\${value}`}</div>
                </div>
            </li>
        {/each}
    </ul>
</div>
