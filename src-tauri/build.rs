fn main() {
    println!("cargo::rerun-if-changed=build.rs");
    #[cfg(target_os = "windows")]
    {
        if let Ok(manifest_dr) = std::env::var("CARGO_MANIFEST_DIR") {
            println!("cargo:rustc-link-search=native={}", std::path::PathBuf::from(manifest_dr).join("vips").to_string_lossy());
        }
        if let Ok(app_dir) = std::env::var("LOCALAPPDATA") {
            println!("cargo:rustc-link-search=native={}", std::path::PathBuf::from(app_dir).join("pic").join("vips").to_string_lossy());
        }
    }
    tauri_build::build()
}
