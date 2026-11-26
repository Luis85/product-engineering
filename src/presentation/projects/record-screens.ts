import { defineAsyncComponent, inject, provide } from "vue";
import type { Component, InjectionKey } from "vue";
import type { ProjectRecordRoute } from "../../application/projects";
import type { Route } from "../../application/routes";
import type { ScreenLoader } from "../shell";

type RecordKind = ProjectRecordRoute["reference"]["kind"];
type RecordScreen = { readonly section: Route["name"]; readonly component: Component };
type RecordLoader = { readonly section: Route["name"]; readonly load: ScreenLoader };
export type ProjectRecordScreens = Partial<Record<RecordKind, RecordLoader>>;
export type ProjectRecordPart = { readonly projectRecords?: ProjectRecordScreens };

const screens = Symbol("project-record-screens") as InjectionKey<
  (kind: RecordKind) => RecordScreen | undefined
>;

export function provideProjectRecordScreens(loaders: ProjectRecordScreens) {
  const components = new Map<RecordKind, RecordScreen>();
  for (const [kind, loader] of Object.entries(loaders)) {
    if (loader) {
      components.set(kind, {
        section: loader.section,
        component: defineAsyncComponent(loader.load),
      });
    }
  }
  provide(screens, (kind) => components.get(kind));
}

export function useProjectRecordScreens() {
  return inject(screens, () => undefined);
}
