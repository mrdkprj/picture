use crate::image::{ClipArgs, MetadataRequest, ResizeArgs, RotateArgs, ToBufferArgs, ToIconArgs};
use serde::{Deserialize, Serialize};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use std::{env, path::PathBuf};
#[cfg(target_os = "windows")]
use tauri::Emitter;
use tauri::{Manager, WebviewWindow};
use zouni::{
    dialog::{FileDialogResult, MessageResult},
    Dirent, FileAttribute,
};
mod dialog;
mod image;
mod menu;

static THEME_DARK: &str = "dark";

#[derive(Serialize)]
struct OpenedUrls(Vec<String>);
#[tauri::command]
fn get_init_args(app: tauri::AppHandle) -> Vec<String> {
    if let Some(urls) = app.try_state::<OpenedUrls>() {
        return urls.inner().0.clone();
    }

    Vec::new()
}

#[tauri::command]
fn change_theme(window: tauri::WebviewWindow, payload: &str) {
    let theme = if payload == THEME_DARK {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    };
    window.set_theme(Some(theme)).unwrap();
    menu::change_theme(theme);
}

#[tauri::command]
async fn open_context_menu(window: tauri::WebviewWindow, payload: menu::Position) {
    menu::popup_menu(&window, window.label(), payload).await;
}

#[tauri::command]
fn reveal(payload: String) -> Result<(), String> {
    zouni::shell::show_item_in_folder(payload)
}

#[tauri::command]
fn trash(payload: String) -> Result<(), String> {
    zouni::fs::trash(payload)
}

#[tauri::command]
fn exists(payload: String) -> bool {
    PathBuf::from(payload).exists()
}

#[tauri::command]
fn stat(payload: String) -> Result<FileAttribute, String> {
    zouni::fs::stat(&payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileAttributeEx {
    full_path: String,
    attribute: FileAttribute,
}
#[tauri::command]
fn stat_all(payload: Vec<String>) -> Result<Vec<FileAttributeEx>, String> {
    let mut result = Vec::new();
    for path in payload {
        let attribute = zouni::fs::stat(&path)?;
        result.push(FileAttributeEx {
            full_path: path,
            attribute,
        });
    }
    Ok(result)
}

#[tauri::command]
fn mkdir(payload: String) -> Result<(), String> {
    std::fs::create_dir(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn mkdir_all(payload: String) -> Result<(), String> {
    std::fs::create_dir_all(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn create(payload: String) -> Result<(), String> {
    match std::fs::File::create(payload) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn read_text_file(payload: String) -> Result<String, String> {
    std::fs::read_to_string(payload).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteFileInfo {
    fullPath: String,
    data: String,
}
#[tauri::command]
fn write_text_file(payload: WriteFileInfo) -> Result<(), String> {
    std::fs::write(payload.fullPath, payload.data).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_image_file(payload: WriteFileInfo) -> Result<(), String> {
    let data = image::from_base64(payload.data);
    std::fs::write(payload.fullPath, data).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UtimesArgs {
    file_path: String,
    atime_ms: u64,
    mtime_ms: u64,
}
#[tauri::command]
fn utimes(payload: UtimesArgs) -> Result<(), String> {
    zouni::fs::utimes(payload.file_path, payload.atime_ms, payload.mtime_ms)
}

#[tauri::command]
async fn message(payload: dialog::DialogOptions) -> MessageResult {
    dialog::show(payload).await
}

#[tauri::command]
async fn open(payload: dialog::FileDialogOptions) -> FileDialogResult {
    dialog::open(payload).await
}

#[tauri::command]
async fn save(payload: dialog::FileDialogOptions) -> FileDialogResult {
    dialog::save(payload).await
}

#[allow(unused_variables)]
#[tauri::command]
fn listen_file_drop(window: WebviewWindow, app: tauri::AppHandle, payload: String) -> tauri::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let label = window.label().to_string();
        window.with_webview(move |webview| {
            zouni::webview2::register_file_drop(unsafe { &webview.controller().CoreWebView2().unwrap() }, Some(payload), move |event| {
                app.emit_to(
                    tauri::EventTarget::WebviewWindow {
                        label: label.to_string(),
                    },
                    "tauri://drag-drop",
                    event,
                )
                .unwrap();
            })
            .unwrap();
        })
    }
    #[cfg(target_os = "linux")]
    {
        Ok(())
    }
}

#[tauri::command]
fn unlisten_file_drop() {
    #[cfg(target_os = "windows")]
    zouni::webview2::clear();
}

#[tauri::command]
fn readdir(payload: String) -> Result<Vec<Dirent>, String> {
    zouni::fs::readdir(payload, false, false)
}

#[tauri::command]
fn metadata(payload: MetadataRequest) -> Result<String, String> {
    image::get_metadata(payload)
}

#[tauri::command]
fn rotate(payload: RotateArgs) -> Result<String, String> {
    image::rotate(payload)
}

#[tauri::command]
fn resize(payload: ResizeArgs) -> Result<String, String> {
    image::resize(payload)
}

#[tauri::command]
fn clip(payload: ClipArgs) -> Result<String, String> {
    image::clip(payload)
}

#[tauri::command]
fn to_buffer(payload: ToBufferArgs) -> Result<String, String> {
    image::to_buffer(payload)
}

#[tauri::command]
fn to_icon(payload: ToIconArgs) -> Result<(), String> {
    image::to_icon(payload)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[allow(non_snake_case)]
pub struct Settings {
    pub timestamp: String,
    pub theme: String,
    pub sort: String,
    pub mode: String,
}
#[tauri::command]
fn prepare_windows(window: WebviewWindow, payload: Settings) -> tauri::Result<bool> {
    let theme = match payload.theme.as_str() {
        "dark" => tauri::Theme::Dark,
        "light" => tauri::Theme::Light,
        _ => tauri::Theme::Dark,
    };

    window.set_theme(Some(theme))?;

    menu::create_context_menu(&window, &payload)?;

    Ok(true)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let mut urls = Vec::new();
            for arg in env::args().skip(1) {
                urls.push(arg);
            }
            app.manage(OpenedUrls(urls));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_init_args,
            prepare_windows,
            readdir,
            change_theme,
            reveal,
            trash,
            exists,
            open_context_menu,
            mkdir,
            mkdir_all,
            create,
            read_text_file,
            write_text_file,
            write_image_file,
            stat,
            stat_all,
            message,
            open,
            save,
            listen_file_drop,
            unlisten_file_drop,
            metadata,
            utimes,
            rotate,
            resize,
            clip,
            to_buffer,
            to_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
