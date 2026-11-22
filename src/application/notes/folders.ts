import { clashKey } from "../../domain/notes";

export function recordFolder(rootFolder: string, type: { readonly folder?: string }): string {
  return type.folder ? `${rootFolder}/${type.folder}` : rootFolder;
}

export function isInFolder(path: string, folder: string): boolean {
  return folder === "" || folder === "/" || clashKey(path).startsWith(clashKey(folder) + "/");
}
