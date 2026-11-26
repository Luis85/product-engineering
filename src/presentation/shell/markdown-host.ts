import { inject } from "vue";
import type { InjectionKey } from "vue";

export type VaultFile = {
  readonly path: string;
  readonly name: string;
  readonly kind: "note" | "image" | "attachment" | "unsupported";
  readonly headings: readonly string[];
};

export type VaultLink = {
  readonly path: string;
  readonly heading: string;
  readonly alias: string;
  readonly embed: boolean;
};

export type VaultLinkTarget = { readonly path: string; readonly supported: boolean };
export type VaultNoteLinks = {
  readonly inline: readonly {
    readonly link: string;
    readonly label: string;
    readonly original: string;
  }[];
  readonly inbound: readonly string[];
};

export type MarkdownHost = {
  readonly render: (
    source: string,
    path: string,
    container: HTMLElement,
    signal: AbortSignal,
  ) => Promise<void>;
  readonly files: () => readonly VaultFile[];
  readonly makeLink: (link: VaultLink, source: string) => string | undefined;
  readonly resolve: (link: string, source: string) => VaultLinkTarget | undefined;
  readonly open: (link: string, source: string) => Promise<void>;
  readonly noteLinks: (source: string) => VaultNoteLinks;
};

const plainText: MarkdownHost = {
  render: async (source, _path, container) => {
    container.textContent = source;
  },
  files: () => [],
  makeLink: () => undefined,
  resolve: () => undefined,
  open: async () => undefined,
  noteLinks: () => ({ inline: [], inbound: [] }),
};

export const markdownHostKey: InjectionKey<MarkdownHost> = Symbol("markdown-host");

export function useMarkdownHost() {
  return inject(markdownHostKey, plainText);
}
