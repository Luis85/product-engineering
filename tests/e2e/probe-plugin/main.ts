import { ManagedRuntime } from "effect";
import { normalizePath, parseYaml, Plugin, stringifyYaml } from "obsidian";
import { noteStoreLayer } from "../../../src/infrastructure/obsidian/notes";
import { createNoteStoreProbeApi } from "../../support/notes/probe-api";
import type { NoteStoreProbeApi } from "../../support/notes/probe-api";
import {
  lineEditScenario,
  serializerScenario,
  storeScenario,
  vaultFacts,
} from "../../support/notes/scenarios";
import { readinessScenario } from "../../support/readiness-scenario";

export default class NoteStoreProbe extends Plugin {
  #api: NoteStoreProbeApi | undefined;

  get api(): NoteStoreProbeApi {
    if (!this.#api) throw new Error("The note-store probe is not loaded");
    return this.#api;
  }

  override onload(): void {
    const runtime = ManagedRuntime.make(noteStoreLayer(this.app));
    this.#api = createNoteStoreProbeApi(runtime);
    this.register(() => {
      this.#api = undefined;
      void runtime.dispose();
    });
  }

  vaultFacts() {
    return vaultFacts(this.app, { normalizePath, parseYaml, stringifyYaml });
  }

  storeFacts() {
    return storeScenario(this.app, this.api);
  }

  writeFacts() {
    return lineEditScenario(this.app, this.api);
  }

  serializerFacts(lines: readonly string[]) {
    return serializerScenario(lines, parseYaml);
  }

  readinessFacts() {
    return readinessScenario(this.app);
  }
}
