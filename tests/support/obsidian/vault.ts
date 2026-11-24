import { Events } from "./events";
import { nextTurn } from "./metadata-cache";
import type { MetadataCache } from "./metadata-cache";
import { normalizePath } from "./paths";
import { withoutBom } from "./yaml";

function folderOf(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 1 ? "/" : path.slice(0, separator);
}

function childPath(parent: TFolder, name: string): string {
  return parent.path === "/" ? name : `${parent.path}/${name}`;
}

function checkPath(path: string): void {
  if (normalizePath(path) !== path) throw new Error("The test vault requires a normalized path");
}

function existingError(): Error {
  return Object.assign(new Error("The test vault path already exists"), { code: "EEXIST" });
}

class TAbstractFile {
  constructor(
    readonly vault: Vault,
    public path: string,
    public parent: TFolder | null,
  ) {}

  get name(): string {
    return this.path === "/" ? "/" : this.path.slice(this.path.lastIndexOf("/") + 1);
  }
}

export class TFolder extends TAbstractFile {
  readonly children: (TFile | TFolder)[] = [];
}

export class TFile extends TAbstractFile {
  get extension(): string {
    const dot = this.name.lastIndexOf(".");
    return dot < 1 ? "" : this.name.slice(dot + 1).toLowerCase();
  }

  get basename(): string {
    const dot = this.name.lastIndexOf(".");
    return dot === -1 ? this.name : this.name.slice(0, dot);
  }
}

type Entry = TFile | TFolder;

function removeFromParent(file: TFile): void {
  const children = file.parent?.children;
  if (!children) return;
  const index = children.indexOf(file);
  if (index !== -1) children.splice(index, 1);
}

export class Vault extends Events {
  readonly #root = new TFolder(this, "/", null);
  readonly #entries = new Map<string, Entry>([["/", this.#root]]);
  readonly #contents = new Map<TFile, string>();
  readonly #held: (() => void)[] = [];
  #holding = false;
  failReads = false;
  failWrites = false;

  constructor(
    readonly metadataCache: MetadataCache,
    public caseInsensitive = false,
  ) {
    super();
  }

  getRoot(): TFolder {
    return this.#root;
  }

  getAbstractFileByPath(path: string): Entry | null {
    return this.#entries.get(path) ?? null;
  }

  getFileByPath(path: string): TFile | null {
    this.#checkReads();
    return this.#fileAt(path);
  }

  #fileAt(path: string): TFile | null {
    const entry = this.#entries.get(path);
    return entry instanceof TFile ? entry : null;
  }

  getFolderByPath(path: string): TFolder | null {
    const entry = this.getAbstractFileByPath(path);
    return entry instanceof TFolder ? entry : null;
  }

  getMarkdownFiles(): TFile[] {
    this.#checkReads();
    return [...this.#contents.keys()].filter((file) => file.extension === "md");
  }

  #checkReads(): void {
    if (this.failReads) throw new Error("Test vault read failed");
  }

  read(file: TFile): Promise<string> {
    return Promise.resolve().then(() => {
      this.#checkReads();
      return withoutBom(this.#text(file));
    });
  }

  cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }

  readBinary(file: TFile): Promise<ArrayBuffer> {
    return Promise.resolve().then(() => {
      this.#checkReads();
      return new TextEncoder().encode(this.#text(file)).buffer;
    });
  }

  #text(file: TFile): string {
    const text = this.#contents.get(file);
    if (text === undefined)
      throw Object.assign(new Error("Test vault file was not found"), { code: "ENOENT" });
    return text;
  }

  #clashing(path: string): Entry | undefined {
    if (!this.caseInsensitive) return this.#entries.get(path);
    const key = normalizePath(path).toLowerCase();
    return [...this.#entries.values()].find(
      (entry) => normalizePath(entry.path).toLowerCase() === key,
    );
  }

  #folders(path: string): TFolder {
    let parent = this.#root;
    for (const name of path.split("/").filter(Boolean)) {
      const target = childPath(parent, name);
      const existing = this.getFolderByPath(target);
      if (existing) {
        parent = existing;
        continue;
      }
      if (this.#clashing(target)) throw existingError();
      const folder = new TFolder(this, target, parent);
      parent.children.push(folder);
      this.#entries.set(target, folder);
      this.trigger("create", folder);
      parent = folder;
    }
    return parent;
  }

  #parent(path: string): TFolder {
    const parent = this.getFolderByPath(folderOf(path));
    if (!parent)
      throw Object.assign(new Error("Test vault parent folder was not found"), { code: "ENOENT" });
    return parent;
  }

  #createFile(path: string, text: string, parent: TFolder): TFile {
    const file = new TFile(this, path, parent);
    this.#entries.set(path, file);
    this.#contents.set(file, text);
    parent.children.push(file);
    this.trigger("create", file);
    this.metadataCache.index(file, text);
    return file;
  }

  #replace(file: TFile, text: string): void {
    this.#contents.set(file, text);
    this.trigger("modify", file);
    this.metadataCache.index(file, text);
  }

  async #write(): Promise<void> {
    await nextTurn();
    if (this.#holding)
      await new Promise<void>((resolve) => {
        this.#held.push(resolve);
      });
    if (this.failWrites) throw new Error("Test vault write failed");
  }

  async create(path: string, text: string): Promise<TFile> {
    await this.#write();
    checkPath(path);
    if (this.#clashing(path)) throw existingError();
    return this.#createFile(path, text, this.#parent(path));
  }

  async createFolder(path: string): Promise<TFolder> {
    await this.#write();
    checkPath(path);
    if (this.#clashing(path)) throw existingError();
    return this.#folders(path);
  }

  async process(file: TFile, edit: (text: string) => string): Promise<string> {
    await this.#write();
    const input = this.#text(file);
    const output = edit(input);
    if (output !== input) this.#replace(file, output);
    return output;
  }

  async renameFile(file: TFile, path: string): Promise<void> {
    await this.#write();
    this.#text(file);
    checkPath(path);
    if (path === file.path) return;
    const clash = this.#clashing(path);
    if (clash && clash !== file) throw existingError();
    const parent = this.#parent(path);
    const previous = file.path;
    this.#entries.delete(previous);
    removeFromParent(file);
    file.path = path;
    file.parent = parent;
    parent.children.push(file);
    this.#entries.set(path, file);
    this.trigger("rename", file, previous);
  }

  #deleteFile(file: TFile): void {
    this.#entries.delete(file.path);
    this.#contents.delete(file);
    removeFromParent(file);
    this.metadataCache.delete(file);
    this.trigger("delete", file);
    this.metadataCache.trigger("resolved");
  }

  async trashFile(file: TFile): Promise<void> {
    await this.#write();
    this.#text(file);
    this.#deleteFile(file);
  }

  async seedFile(path: string, text: string): Promise<TFile> {
    await nextTurn();
    const existing = this.#fileAt(path);
    if (existing) {
      this.#replace(existing, text);
      return existing;
    }
    if (this.#clashing(path)) throw existingError();
    return this.#createFile(path, text, this.#folders(folderOf(path)));
  }

  async removeOutside(path: string): Promise<void> {
    await nextTurn();
    const file = this.#fileAt(path);
    if (file) this.#deleteFile(file);
  }

  holdWrites(): void {
    this.#holding = true;
  }

  releaseWrites(): void {
    this.#holding = false;
    for (const release of this.#held.splice(0)) release();
  }

  heldWrites(): number {
    return this.#held.length;
  }
}
