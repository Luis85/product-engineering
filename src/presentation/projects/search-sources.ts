import { inject, provide } from "vue";
import type { InjectionKey } from "vue";
import type { ProjectId, ProjectSearchContributor } from "../../application/projects";
import type { Route } from "../../application/routes";

type ScopedRoute = Extract<Route, { readonly projectId: ProjectId }>;
type Contributor = ProjectSearchContributor<ScopedRoute>;

export type ProjectSearchSource = () => Contributor;
export type ProjectSearchLoader = () => Promise<ProjectSearchSource>;
export type ProjectSearchPart = { readonly projectSearch?: readonly ProjectSearchLoader[] };

const projectSearchKey: InjectionKey<readonly Contributor[]> = Symbol("project-search-sources");

export function provideProjectSearchSources(
  projects: Contributor,
  sources: readonly ProjectSearchSource[],
): void {
  provide(projectSearchKey, [projects, ...sources.map((setup) => setup())]);
}

export function useProjectSearchSources(): readonly Contributor[] {
  return inject(projectSearchKey, []);
}
