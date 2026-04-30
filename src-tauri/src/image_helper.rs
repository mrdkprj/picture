use crate::image::{
    output::{FormatEnum, WriteableMetadata},
    resize::Region,
    Image,
};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RotateArgs {
    file_path: String,
    orientation: i32,
    degree: i32,
}
pub fn rotate(args: RotateArgs) -> Result<Vec<u8>, String> {
    Image::cache(false);
    let image = Image::new_from_file(args.file_path)?;
    let buffer = if ["jpg", "jpeg"].contains(&image.get_file_type().as_str()) {
        image
            .with_metadata(Some(WriteableMetadata {
                density: None,
                orientation: Some(args.orientation),
            }))?
            .to_buffer()?
    } else {
        image.with_metadata(None)?.rotate(args.degree, None)?.to_buffer()?
    };

    Ok(buffer)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ResizeArgs {
    file: String,
    buffer: Vec<u8>,
    is_buffer: bool,
    width: i32,
    height: i32,
}
pub fn resize(args: ResizeArgs) -> Result<Vec<u8>, String> {
    let image = if args.is_buffer {
        Image::new_from_buffer(args.buffer)?
    } else {
        Image::new_from_file(args.file)?
    };
    let buffer = image.with_metadata(None)?.resize(args.width, args.height)?.to_buffer()?;
    Ok(buffer)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipArgs {
    file: String,
    buffer: Vec<u8>,
    is_buffer: bool,
    left: u32,
    top: u32,
    width: u32,
    height: u32,
}
pub fn clip(args: ClipArgs) -> Result<Vec<u8>, String> {
    let image = if args.is_buffer {
        Image::new_from_buffer(args.buffer)?
    } else {
        Image::new_from_file(args.file)?
    };
    let buffer = image
        .with_metadata(None)?
        .extract(Region {
            left: args.left,
            top: args.top,
            width: args.width,
            height: args.height,
        })?
        .to_buffer()?;
    Ok(buffer)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataRequest {
    file: String,
    buffer: Vec<u8>,
    is_buffer: bool,
}
pub fn get_metadata(args: MetadataRequest) -> Result<String, String> {
    if args.is_buffer {
        let data = Image::new_from_buffer(args.buffer)?.metadata()?;
        return Ok(serde_json::to_string(&data).unwrap());
    }

    if let Some(extension) = std::path::PathBuf::from(args.file.clone()).extension() {
        let data = if extension.to_string_lossy().to_ascii_lowercase().ends_with("ico") {
            Image::from_icon_file(args.file)?.metadata()?
        } else {
            Image::new_from_file(args.file)?.metadata()?
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
pub fn to_buffer(args: ToBufferArgs) -> Result<Vec<u8>, String> {
    let format = FormatEnum::from_str(&args.format).map_err(|e| e.to_string())?;
    let buffer = Image::new_from_file(args.file_path)?.to_format(format, None)?.to_buffer()?;
    Ok(buffer)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToIconArgs {
    is_buffer: bool,
    file: String,
    buffer: Vec<u8>,
    out_path: String,
}
pub fn to_icon(args: ToIconArgs) -> Result<(), String> {
    let image = if args.is_buffer {
        Image::new_from_buffer(args.buffer)?
    } else {
        Image::new_from_file(args.file)?
    };
    let _ = image.to_icon(args.out_path, None)?;
    Ok(())
}
