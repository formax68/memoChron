import { normalizePath } from "obsidian";

export enum PathType {
  HTTP_URL = "http_url",
  FILE_URL = "file_url",
  VAULT_RELATIVE = "vault_relative",
  ABSOLUTE_PATH = "absolute_path",
}

export interface PathInfo {
  type: PathType;
  originalPath: string;
  normalizedPath: string;
}

export function detectPathType(path: string): PathType {
  if (!path) {
    return PathType.VAULT_RELATIVE;
  }

  // Check for HTTP(S) URLs
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return PathType.HTTP_URL;
  }

  // Check for file:// URLs
  if (path.startsWith("file://")) {
    return PathType.FILE_URL;
  }

  // Check for absolute paths
  // Windows: C:\, D:\, etc.
  // Unix: /
  if (
    (path.length >= 3 && path[1] === ":" && path[2] === "\\") ||
    path.startsWith("/")
  ) {
    return PathType.ABSOLUTE_PATH;
  }

  // Everything else is considered vault-relative
  return PathType.VAULT_RELATIVE;
}

export function normalizeFilePath(path: string, type: PathType): string {
  switch (type) {
    case PathType.FILE_URL:
      // Remove file:// prefix and decode URI components
      return decodeURIComponent(path.replace(/^file:\/\//, ""));
    
    case PathType.VAULT_RELATIVE:
      // Normalize path for Obsidian
      return normalizePath(path);
    
    case PathType.ABSOLUTE_PATH:
      // Return as-is for absolute paths
      return path;
    
    case PathType.HTTP_URL:
      // Return as-is for HTTP URLs
      return path;
    
    default:
      return path;
  }
}

export function getPathInfo(path: string): PathInfo {
  const type = detectPathType(path);
  const normalizedPath = normalizeFilePath(path, type);
  
  return {
    type,
    originalPath: path,
    normalizedPath,
  };
}

export function isLocalPath(pathInfo: PathInfo): boolean {
  return (
    pathInfo.type === PathType.FILE_URL ||
    pathInfo.type === PathType.VAULT_RELATIVE ||
    pathInfo.type === PathType.ABSOLUTE_PATH
  );
}

export function isRemoteUrl(pathInfo: PathInfo): boolean {
  return pathInfo.type === PathType.HTTP_URL;
}