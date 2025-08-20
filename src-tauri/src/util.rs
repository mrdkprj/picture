#![allow(dead_code)]
use base64::{engine::general_purpose, Engine};
use serde::{Deserialize, Serialize};
use sharp::{
    output::{FormatEnum, WriteableMetadata},
    resize::Region,
    Sharp,
};

fn to_base64(buffer: &[u8]) -> String {
    let mut buf = String::new();
    general_purpose::STANDARD.encode_string(buffer, &mut buf);
    buf
}

pub fn from_base64(value: String) -> Vec<u8> {
    general_purpose::STANDARD.decode(value).unwrap()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RotateArgs {
    file_path: String,
    orientation: i32,
    degree: i32,
}

pub fn rotate(args: RotateArgs) -> Result<String, String> {
    Sharp::cache(false);
    let sharp = Sharp::new_from_file(args.file_path)?;
    let buffer = if ["jpg", "jpeg"].contains(&sharp.get_file_type().as_str()) {
        sharp
            .with_metadata(Some(WriteableMetadata {
                density: None,
                orientation: Some(args.orientation),
            }))?
            .to_buffer()?
    } else {
        sharp.rotate(args.degree, None)?.with_metadata(None)?.to_buffer()?
    };

    Ok(to_base64(buffer.as_slice()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ResizeArgs {
    file_path: Option<String>,
    base64: Option<String>,
    width: i32,
    height: i32,
}
pub fn resize(args: ResizeArgs) -> Result<String, String> {
    let sharp = if let Some(path) = args.file_path {
        Sharp::new_from_file(path)?
    } else {
        Sharp::new_from_buffer(from_base64(args.base64.unwrap()))?
    };
    let buffer = sharp.with_metadata(None)?.resize(args.width, args.height)?.with_metadata(None)?.to_buffer()?;
    Ok(to_base64(buffer.as_slice()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipArgs {
    file_path: Option<String>,
    base64: Option<String>,
    left: u32,
    top: u32,
    width: u32,
    height: u32,
}
pub fn clip(args: ClipArgs) -> Result<String, String> {
    let sharp = if let Some(path) = args.file_path {
        Sharp::new_from_file(path)?
    } else {
        Sharp::new_from_buffer(from_base64(args.base64.unwrap()))?
    };
    let buffer = sharp
        .with_metadata(None)?
        .extract(Region {
            left: args.left,
            top: args.top,
            width: args.width,
            height: args.height,
        })?
        .with_metadata(None)?
        .jpeg(None)?
        .to_buffer()?;
    Ok(to_base64(buffer.as_slice()))
}

pub fn get_metadata(file_path: String) -> Result<String, String> {
    if let Some(extension) = std::path::PathBuf::from(&file_path).extension() {
        let data = if extension.to_string_lossy().to_ascii_lowercase().ends_with("ico") {
            Sharp::from_icon_file(file_path)?.metadata()?
        } else {
            Sharp::new_from_file(file_path)?.metadata()?
        };
        return Ok(serde_json::to_string(&data).unwrap());
    }

    Ok(String::new())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToBufferArgs {
    file_path: String,
    format: String,
}
pub fn to_buffer(args: ToBufferArgs) -> Result<String, String> {
    let format = match args.format.as_str() {
        "png" => FormatEnum::Png,
        "jpeg" => FormatEnum::Jpeg,
        _ => FormatEnum::Jpeg,
    };
    let buffer = Sharp::new_from_file(args.file_path)?.to_format(format, None)?.to_buffer()?;
    Ok(to_base64(buffer.as_slice()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToIconArgs {
    file_path: String,
    out_path: String,
}
pub fn to_icon(args: ToIconArgs) -> Result<(), String> {
    let _ = Sharp::new_from_file(args.file_path)?.to_icon(args.out_path, None)?;
    Ok(())
}
