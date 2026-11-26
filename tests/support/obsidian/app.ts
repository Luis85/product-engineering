import { FileManager } from "./file-manager";
import { MetadataCache } from "./metadata-cache";
import { Vault } from "./vault";
import { Workspace } from "./workspace";

export class App {
  readonly metadataCache = new MetadataCache();
  readonly vault: Vault;
  readonly fileManager: FileManager;
  readonly workspace: Workspace;

  constructor({ document: owner = document, layoutReady = true, caseInsensitive = false } = {}) {
    this.vault = new Vault(this.metadataCache, caseInsensitive);
    this.fileManager = new FileManager(this.vault);
    this.workspace = new Workspace(owner, this, layoutReady);
  }
}
