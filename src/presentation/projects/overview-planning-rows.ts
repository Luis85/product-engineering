import { pbiDetailRoute } from "../../application/backlog";
import { knowledgeDetailRoute } from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { Catalog } from "../../application/messages";
import type { overviewPlanning, ProjectId } from "../../application/projects";
import type { Route } from "../../application/routes";
import { storyMapsRoute, storyMapSliceRoute } from "../../application/story-maps";

export type PlanningCreation = "jtbd" | "vision" | "prd" | "map";
type PlanningLink = {
  readonly title: string;
  readonly key: string;
  readonly destination: Route;
  readonly testId?: string;
};
export type PlanningRow = {
  readonly id: "job" | "vision" | "prd" | "map" | "slice" | "handoff";
  readonly complete: boolean;
  readonly info?: string | undefined;
  readonly links: readonly PlanningLink[];
  readonly action: string;
  readonly destination?: Route | undefined;
  readonly creation?: PlanningCreation;
};
type Plan = ReturnType<typeof overviewPlanning>;
type Text = Catalog["projects"]["overviewPlanning"];

function noteLink(project: ProjectId, note: KnowledgeRecord): PlanningLink {
  return {
    key: note.id,
    title: `${note.displayId} · ${note.title}`,
    destination: knowledgeDetailRoute(project, note.id, { section: "overview" }),
  };
}

function noteLinks(project: ProjectId, note: KnowledgeRecord | undefined) {
  return note ? [noteLink(project, note)] : [];
}

function prdRow(project: ProjectId, prd: KnowledgeRecord | undefined, text: Text): PlanningRow {
  const links = noteLinks(project, prd);
  const requirement = prd?.values.requirement_id;
  return {
    id: "prd",
    complete: Boolean(requirement),
    links,
    info: prd ? requirement || text.missingRequirement : text.prdHelp,
    action: prd ? text.repairRequirement : text.writePrd,
    destination: requirement ? undefined : links[0]?.destination,
    creation: "prd",
  };
}

function foundations(
  project: ProjectId,
  plan: Plan,
  hasJobs: boolean,
  text: Text,
): readonly PlanningRow[] {
  const { jobs, vision, prd, map } = plan;
  return [
    {
      id: "job",
      complete: jobs.length > 0,
      info: jobs.length ? undefined : prd || map ? text.missingJob : text.jobHelp,
      links: jobs.map((job) => noteLink(project, job)),
      action: hasJobs ? text.anotherJob : text.firstJob,
      creation: "jtbd",
    },
    {
      id: "vision",
      complete: Boolean(vision),
      info: vision ? undefined : text.visionHelp,
      links: noteLinks(project, vision),
      action: text.writeVision,
      creation: "vision",
    },
    prdRow(project, prd, text),
  ];
}

function mapRow(project: ProjectId, map: Plan["map"], text: Text): PlanningRow {
  return {
    id: "map",
    complete: Boolean(map),
    info: map ? undefined : text.mapHelp,
    links: map
      ? [
          {
            key: map.id,
            title: `${map.displayId} · ${map.title}`,
            destination: storyMapsRoute(project, map.id),
          },
        ]
      : [],
    action: text.createMap,
    creation: "map",
  };
}

function sliceRows(
  project: ProjectId,
  { map, slice, count, reviewed, complete, pbis }: Plan,
  text: Text,
): readonly PlanningRow[] {
  const sliceRoute = firstSliceRoute(project, map, slice);
  return [
    {
      id: "slice",
      complete: count > 0,
      info: slice?.outcome || text.sliceHelp,
      links:
        slice && sliceRoute ? [{ key: slice.id, title: slice.title, destination: sliceRoute }] : [],
      action: slice ? text.planStories : text.planSlice,
      destination: map && storyMapsRoute(project, map.id),
    },
    {
      id: "handoff",
      complete,
      info: count ? text.progress(reviewed, count) : text.handoffHelp,
      links: pbis.map((item) => ({
        key: item.id,
        title: `${item.id} · ${item.title}`,
        destination: pbiDetailRoute(project, item.key),
        testId: "overview-slice-pbi",
      })),
      action: text.reviewStories,
      destination: sliceRoute,
    },
  ];
}

function firstSliceRoute(project: ProjectId, map: Plan["map"], slice: Plan["slice"]) {
  if (map && slice) return storyMapSliceRoute(project, map.id, slice.id);
}

export function planningRows(project: ProjectId, plan: Plan, hasJobs: boolean, text: Text) {
  return [
    ...foundations(project, plan, hasJobs, text),
    mapRow(project, plan.map, text),
    ...sliceRows(project, plan, text),
  ];
}
