//! SCRATCH STUB of codex-exec-server (not OpenAI code): only the surface codex-apply-patch uses, backed by tokio::fs.
//! Signatures mirror codex-rs/file-system/src/lib.rs @ 67f0994b; behaviour is plain local, unsandboxed file I/O.
use std::future::Future;
use std::io;
use std::pin::Pin;
use std::sync::{Arc, LazyLock};
use codex_utils_path_uri::PathUri;

pub type FileSystemResult<T> = io::Result<T>;
pub type ExecutorFileSystemFuture<'a, T> = Pin<Box<dyn Future<Output = FileSystemResult<T>> + Send + 'a>>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReadFileOptions { pub follow_symlinks: bool }
impl Default for ReadFileOptions { fn default() -> Self { Self { follow_symlinks: true } } }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WriteFileOptions { pub follow_symlinks: bool }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GetMetadataOptions { pub follow_symlinks: bool }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CreateDirectoryOptions { pub recursive: bool, pub follow_symlinks: bool }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RemoveOptions { pub recursive: bool, pub force: bool, pub follow_symlinks: bool }
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FileMetadata { pub is_directory: bool, pub is_file: bool, pub is_symlink: bool, pub size: u64, pub created_at_ms: i64, pub modified_at_ms: i64 }
#[derive(Clone, Debug)]
pub struct FileSystemSandboxContext {}

pub trait ExecutorFileSystem: Send + Sync {
    fn read_file_text<'a>(&'a self, path: &'a PathUri, options: ReadFileOptions, sandbox: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, String>;
    fn write_file<'a>(&'a self, path: &'a PathUri, contents: Vec<u8>, options: WriteFileOptions, sandbox: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()>;
    fn create_directory<'a>(&'a self, path: &'a PathUri, o: CreateDirectoryOptions, sandbox: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()>;
    fn get_metadata<'a>(&'a self, path: &'a PathUri, o: GetMetadataOptions, sandbox: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, FileMetadata>;
    fn remove<'a>(&'a self, path: &'a PathUri, o: RemoveOptions, sandbox: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()>;
}

pub struct LocalFs;
impl ExecutorFileSystem for LocalFs {
    fn read_file_text<'a>(&'a self, path: &'a PathUri, _o: ReadFileOptions, _s: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, String> {
        Box::pin(async move {
            let b = tokio::fs::read(path.to_path_buf()).await?;
            String::from_utf8(b).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
        })
    }
    fn write_file<'a>(&'a self, path: &'a PathUri, c: Vec<u8>, _o: WriteFileOptions, _s: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()> {
        Box::pin(async move { tokio::fs::write(path.to_path_buf(), c).await })
    }
    fn create_directory<'a>(&'a self, path: &'a PathUri, o: CreateDirectoryOptions, _s: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()> {
        Box::pin(async move { if o.recursive { tokio::fs::create_dir_all(path.to_path_buf()).await } else { tokio::fs::create_dir(path.to_path_buf()).await } })
    }
    fn get_metadata<'a>(&'a self, path: &'a PathUri, o: GetMetadataOptions, _s: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, FileMetadata> {
        Box::pin(async move {
            let p = path.to_path_buf();
            let m = if o.follow_symlinks { tokio::fs::metadata(&p).await? } else { tokio::fs::symlink_metadata(&p).await? };
            Ok(FileMetadata { is_directory: m.is_dir(), is_file: m.is_file(), is_symlink: m.file_type().is_symlink(), size: m.len(), created_at_ms: 0, modified_at_ms: 0 })
        })
    }
    fn remove<'a>(&'a self, path: &'a PathUri, o: RemoveOptions, _s: Option<&'a FileSystemSandboxContext>) -> ExecutorFileSystemFuture<'a, ()> {
        Box::pin(async move {
            let p = path.to_path_buf();
            let r = match tokio::fs::symlink_metadata(&p).await { Ok(m) if m.is_dir() => if o.recursive { tokio::fs::remove_dir_all(&p).await } else { tokio::fs::remove_dir(&p).await }, Ok(_) => tokio::fs::remove_file(&p).await, Err(e) => Err(e) };
            match r { Err(e) if o.force && e.kind() == io::ErrorKind::NotFound => Ok(()), r => r }
        })
    }
}
pub static LOCAL_FS: LazyLock<Arc<dyn ExecutorFileSystem>> = LazyLock::new(|| Arc::new(LocalFs));
