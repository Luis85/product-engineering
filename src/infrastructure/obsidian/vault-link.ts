import { parseLinktext } from "obsidian";
import type { MetadataCache, Vault } from "obsidian";

export function vaultLinkText(link: string) {
  const wiki = /^!?\[\[([^\]]+)\]\]$/.exec(link);
  return (wiki?.[1] ?? link).split("|")[0] ?? "";
}

export function resolveVaultLink(
  vault: Vault,
  cache: MetadataCache | undefined,
  link: string,
  source: string,
) {
  const target = parseLinktext(vaultLinkText(link)).path;
  if (!target) return vault.getFileByPath(source);
  return cache?.getFirstLinkpathDest(target, source) ?? vault.getFileByPath(target);
}
