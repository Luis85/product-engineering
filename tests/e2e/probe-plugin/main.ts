import { Effect } from "effect";
import { normalizePath, parseYaml, Plugin, stringifyYaml } from "obsidian";
import { createNoteStoreProbeApi } from "../../support/notes/probe-api";
import type { NoteStoreProbeApi } from "../../support/notes/probe-api";
import {
  lineEditScenario,
  serializerScenario,
  storeScenario,
  vaultFacts,
} from "../../support/notes/scenarios";
import { readinessScenario } from "../../support/readiness-scenario";
import { probeEvents, startupRuntime } from "./host-events";
import { observeStartup } from "./startup-recorder";
import type { StartupRecorder } from "./startup-recorder";

export default class NoteStoreProbe extends Plugin {
  #api: NoteStoreProbeApi | undefined;
  #startup: StartupRecorder | undefined;
  #events: ReturnType<typeof probeEvents> | undefined;

  get api(): NoteStoreProbeApi {
    if (!this.#api) throw new Error("The note-store probe is not loaded");
    return this.#api;
  }

  get startup() {
    if (!this.#startup) throw new Error("The startup recorder is not loaded");
    return this.#startup;
  }

  get events() {
    if (!this.#events) throw new Error("The index recorder is not loaded");
    return this.#events;
  }

  override onload(): Promise<void> {
    const startup = observeStartup(this);
    const runtime = startupRuntime(this, startup);
    this.#startup = startup;
    this.#api = createNoteStoreProbeApi(runtime);
    this.#events = probeEvents(runtime);
    this.register(() => {
      this.#api = undefined;
      this.#startup = undefined;
      this.#events = undefined;
      void runtime.dispose();
    });
    return runtime.runPromise(Effect.void);
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
