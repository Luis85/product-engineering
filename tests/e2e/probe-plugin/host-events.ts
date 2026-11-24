import { Effect, Layer, ManagedRuntime, Option, Stream } from "effect";
import type { Plugin } from "obsidian";
import type { AppRuntime } from "../../../src/application/app-services";
import { appServicesLayer } from "../../../src/application/app-services-layer";
import { resolveNfrScope } from "../../../src/application/backlog";
import { resolveDomainScope } from "../../../src/application/domain-model";
import { appNoteTypes } from "../../../src/application/note-types";
import { NoteIndex, noteSnapshot } from "../../../src/application/notes";
import type { ProjectId } from "../../../src/application/projects";
import { EventBus } from "../../../src/application/shell";
import {
  storyMapDomainContribution,
  storyMapNfrContribution,
} from "../../../src/application/story-maps";
import type { NfrTarget } from "../../../src/domain/backlog";
import type { NoteType } from "../../../src/domain/notes";
import { notesAdapters } from "../../../src/infrastructure/obsidian/notes";
import { projectFilesLayer } from "../../../src/infrastructure/obsidian/projects";
import { hostLanguage } from "../../../src/infrastructure/obsidian/shell/language";
import { shellAdapters } from "../../../src/infrastructure/obsidian/shell/layers";
import { referenceNoteTypes } from "../../support/notes/reference-types";
import type { StartupRecorder } from "./startup-recorder";

const types: readonly NoteType[] = referenceNoteTypes;

function observeIndex(startup: StartupRecorder) {
  return Layer.effectDiscard(
    Effect.gen(function* () {
      const index = yield* NoteIndex;
      const initial = types.map((type) =>
        index.noteChanges(type).pipe(
          Stream.filter((snapshot) => snapshot.ready),
          Stream.runHead,
        ),
      );
      yield* Effect.forkScoped(
        Effect.all(initial, { concurrency: "unbounded" }).pipe(
          Effect.tap((snapshots) =>
            Effect.sync(() => {
              if (snapshots.every(Option.isSome)) {
                startup.recordIndexReady(
                  snapshots.reduce((count, snapshot) => count + snapshot.value.notes.length, 0),
                );
              }
            }),
          ),
        ),
      );
    }),
  );
}

function observeHost(startup: StartupRecorder) {
  return Layer.effect(
    EventBus,
    Effect.map(EventBus, (bus) => ({
      ...bus,
      publish(event) {
        startup.recordHost(event);
        return bus.publish(event);
      },
    })),
  );
}

export function startupRuntime(plugin: Plugin, startup: StartupRecorder): AppRuntime {
  const { hostEvents, ...shell } = shellAdapters(plugin);
  const services = appServicesLayer(
    {
      ...shell,
      ...notesAdapters(plugin),
      projectFiles: projectFilesLayer(plugin.app.vault),
      hostEvents: Layer.empty,
    },
    {
      language: hostLanguage(),
      developmentMode: false,
      noteTypes: [...appNoteTypes, ...types.filter((type) => !appNoteTypes.includes(type))],
    },
  );
  const observed = Layer.provide(
    hostEvents,
    Layer.merge(observeHost(startup), observeIndex(startup)),
  );
  return ManagedRuntime.make(Layer.provideMerge(observed, services));
}

export function probeEvents(runtime: AppRuntime) {
  const snapshots = Effect.forEach(types, (type) =>
    Effect.map(noteSnapshot(type), (snapshot) => ({
      type: type.type,
      snapshot,
    })),
  );
  return {
    productScope: (project: ProjectId, target: NfrTarget) =>
      runtime.runPromise(
        Effect.all({
          domain: resolveDomainScope(project, [target], storyMapDomainContribution),
          nfrs: resolveNfrScope(project, target, storyMapNfrContribution),
        }),
      ),
    counts: () =>
      runtime.runPromise(
        Effect.map(snapshots, (byType) =>
          byType.map(({ type, snapshot }) => ({
            type,
            count: snapshot.notes.length,
            ready: snapshot.ready,
            failed: snapshot.failure !== undefined,
          })),
        ),
      ),
    titleShown: (path: string, title: string) =>
      runtime.runPromise(
        Effect.map(snapshots, (byType) =>
          byType.some(({ snapshot }) =>
            snapshot.notes.some((note) => note.path === path && note.values.title === title),
          ),
        ),
      ),
  };
}
