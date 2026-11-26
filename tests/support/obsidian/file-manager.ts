import type { TFile, Vault } from "./vault";
import { parseYaml, stringifyYaml, yamlBlock, yamlMap } from "./yaml";

export class FileManager {
  constructor(readonly vault: Vault) {}

  renameFile(file: TFile, path: string): Promise<void> {
    return this.vault.renameFile(file, path);
  }

  async trashFile(file: TFile): Promise<boolean> {
    await this.vault.trashFile(file);
    return true;
  }

  async processFrontMatter(
    file: TFile,
    change: (data: Record<string, unknown>) => void,
  ): Promise<void> {
    await this.vault.process(file, (input) => {
      const block = yamlBlock(input);
      const frontmatter: Record<string, unknown> = block
        ? (yamlMap(parseYaml(block.yaml)) ?? {})
        : {};
      change(frontmatter);
      const eol = block?.eol ?? "\n";
      const serialized = stringifyYaml(frontmatter).replaceAll("\n", eol);
      return `---${eol}${serialized}---${eol}${block?.body ?? input}`;
    });
  }
}
