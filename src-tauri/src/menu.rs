use crate::{get_window_handel, Settings};
use async_std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::HashMap;
use tauri::Emitter;
use wcpopup::{
    config::{ColorScheme, Config, MenuSize, Theme as MenuTheme, ThemeColor, DEFAULT_DARK_COLOR_SCHEME},
    Menu, MenuBuilder,
};

static MENU_MAP: Lazy<Mutex<HashMap<String, Menu>>> = Lazy::new(|| Mutex::new(HashMap::new()));

const MENU_EVENT_NAME: &str = "contextmenu-event";

#[derive(Debug, Clone, Deserialize)]
pub struct Position {
    x: i32,
    y: i32,
}

pub async fn popup_menu(window: &tauri::WebviewWindow, menu_name: &str, position: Position) {
    let map = MENU_MAP.lock().await;
    let menu = map.get(menu_name).unwrap();
    let result = menu.popup_at_async(position.x, position.y).await;

    if let Some(item) = result {
        window
            .emit_to(
                tauri::EventTarget::WebviewWindow {
                    label: window.label().to_string(),
                },
                MENU_EVENT_NAME,
                item,
            )
            .unwrap();
    };
}

pub fn change_theme(theme: tauri::Theme) {
    let map = MENU_MAP.try_lock().unwrap();
    map.values().for_each(|menu| menu.set_theme(from_tauri_theme(theme)));
}

fn from_tauri_theme(theme: tauri::Theme) -> MenuTheme {
    if theme == tauri::Theme::Dark {
        MenuTheme::Dark
    } else {
        MenuTheme::Light
    }
}

fn get_menu_config(settings: &Settings) -> Config {
    Config {
        theme: if settings.theme == "dark" {
            MenuTheme::Dark
        } else {
            MenuTheme::Light
        },
        color: ThemeColor {
            dark: ColorScheme {
                color: 0xefefef,
                background_color: 0x202020,
                hover_background_color: 0x373535,
                ..DEFAULT_DARK_COLOR_SCHEME
            },
            ..Default::default()
        },
        size: MenuSize {
            border_size: 0,
            item_horizontal_padding: 20,
            ..Default::default()
        },
        ..Default::default()
    }
}

pub fn create_context_menu(window: &tauri::WebviewWindow, settings: &Settings) -> tauri::Result<()> {
    let window_handle = get_window_handel(window);

    let config = get_menu_config(settings);

    let mut builder = MenuBuilder::new_from_config(window_handle, config);

    builder.text("OpenFile", "Open File", false);
    builder.text("Reveal", "Reveal in File Explorer", false);
    builder.text("History", "History", false);
    builder.text("ShowActualSize", "Show Actual Size", false);
    builder.separator();
    builder.text("ToFirst", "Move to First", false);
    builder.text("ToLast", "Move to Last", false);
    let mut sortby = builder.submenu("Sort", "Sort By", false);
    sortby.radio("NameAsc", "Name(Asc)", "Sort", settings.sort == "NameAsc", false);
    sortby.radio("NameDesc", "Name(Desc)", "Sort", settings.sort == "NameDesc", false);
    sortby.radio("DateAsc", "Date(Asc)", "Sort", settings.sort == "DateAsc", false);
    sortby.radio("DateDesc", "Date(Desc)", "Sort", settings.sort == "DateDesc", false);
    sortby.build().unwrap();
    builder.separator();
    let mut timestamp = builder.submenu("Timestamp", "Timestamp", false);
    timestamp.radio("Normal", "Normal", "Timestamp", settings.timestamp == "Normal", false);
    timestamp.radio("Unchanged", "Unchanged", "Timestamp", settings.timestamp == "Unchanged", false);
    timestamp.build().unwrap();
    let mut mode = builder.submenu("Mode", "Mode", false);
    mode.radio("Keyboard", "Keyboard", "Mode", settings.mode == "Keyboard", false);
    mode.radio("Mouse", "Mouse", "Mode", settings.mode == "Mouse", false);
    mode.build().unwrap();
    let mut theme = builder.submenu("Theme", "Theme", false);
    theme.radio("dark", "Dark", "Theme", settings.theme == "dark", false);
    theme.radio("light", "Light", "Theme", settings.theme == "light", false);
    theme.build().unwrap();
    builder.separator();
    builder.text("Reload", "Reload", false);

    let menu = builder.build().unwrap();

    let mut map = MENU_MAP.try_lock().unwrap();
    (*map).insert(window.label().to_string(), menu);

    Ok(())
}
