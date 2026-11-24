import { domainModelRoute } from "../../application/domain-model";
import { backlogBoardRoute } from "../../application/backlog";
import { projectKnowledgeRoute } from "../../application/knowledge";
import type { Catalog } from "../../application/messages";
import { projectAdministrationRoute, projectOverviewRoute } from "../../application/projects";
import type { ProjectId } from "../../application/projects";
import type { Route } from "../../application/routes";
import { storyMapsRoute } from "../../application/story-maps";

type Section = {
  readonly label: string;
  readonly route: Route;
  readonly icon: `i-lucide-${string}`;
};
type Group = keyof Catalog["projects"]["groups"];
export type NavigationGroup = { readonly label: string; readonly items: readonly Section[] };

const groupOrder = ["project", "planning", "delivery", "administration"] as const;

export function projectGroups(
  catalog: Catalog,
  id: ProjectId | undefined,
  extras: readonly Section[],
) {
  const { projects } = catalog;
  const groups: Readonly<Record<Group, readonly Section[]>> = {
    project: id
      ? [
          {
            label: projects.overview,
            route: projectOverviewRoute(id),
            icon: "i-lucide-layout-grid",
          },
          {
            label: catalog.knowledge.title,
            route: projectKnowledgeRoute(id),
            icon: "i-lucide-book-open",
          },
          {
            label: catalog["domain-model"].title,
            route: domainModelRoute(id),
            icon: "i-lucide-network",
          },
        ]
      : [],
    planning: id
      ? [
          { label: catalog["story-maps"].title, route: storyMapsRoute(id), icon: "i-lucide-map" },
          {
            label: catalog.backlog.title,
            route: backlogBoardRoute(id),
            icon: "i-lucide-list-tree",
          },
        ]
      : [],
    delivery: [],
    administration: [
      ...(id
        ? [
            {
              label: projects.administration,
              route: projectAdministrationRoute(id),
              icon: "i-lucide-sliders-horizontal",
            } as const,
          ]
        : []),
      ...extras,
    ],
  };
  return groupOrder.flatMap((group) => {
    const items = groups[group];
    return items.length ? [{ label: projects.groups[group], items }] : [];
  });
}
