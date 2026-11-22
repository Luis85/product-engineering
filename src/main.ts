import { Plugin } from "obsidian";
import { bootstrap, reportUnloadFailure } from "./bootstrap";
import type { BootstrapHandle } from "./bootstrap";

type ActiveLoad = {
  readonly controller: AbortController;
  readonly pending: Promise<BootstrapHandle>;
  handle?: BootstrapHandle;
};

export default class ShellPlugin extends Plugin {
  #load: ActiveLoad | undefined;

  override async onload(): Promise<void> {
    const controller = new AbortController();
    const load: ActiveLoad = {
      controller,
      pending: bootstrap(this, { signal: controller.signal }),
    };
    this.#load = load;
    try {
      const handle = await load.pending;
      if (this.#load === load) load.handle = handle;
      else await handle.dispose().catch(reportUnloadFailure);
    } catch (cause) {
      if (this.#load === load) this.#load = undefined;
      throw cause;
    }
  }

  override onunload(): void {
    const load = this.#load;
    this.#load = undefined;
    if (!load) return;

    load.controller.abort();
    if (load.handle) void load.handle.dispose().catch(reportUnloadFailure);
  }

  override async onExternalSettingsChange(): Promise<void> {
    const load = this.#load;
    if (!load) return;

    const handle = load.handle ?? (await load.pending.catch(() => undefined));
    if (this.#load === load && handle) await handle.reloadSettings();
  }
}
