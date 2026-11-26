import type { BacklogItem } from "../backlog";
import type { KnowledgeRecord } from "../knowledge";
import type { storySliceStories } from "../story-maps";
import type { StoryMapRecord } from "../story-maps";

type PlanningContext = {
  readonly key: string;
  readonly record: KnowledgeRecord | StoryMapRecord;
  readonly jobs: readonly KnowledgeRecord[];
  readonly prd?: KnowledgeRecord | undefined;
  readonly map?: StoryMapRecord;
};

export function overviewContexts(
  knowledge: readonly KnowledgeRecord[],
  maps: readonly StoryMapRecord[],
) {
  const jobs = knowledge.filter(({ kind }) => kind === "jtbd");
  const prds = knowledge.filter(({ kind }) => kind === "prd");
  const linkedJobs = (...ids: readonly string[]) => jobs.filter(({ id }) => ids.includes(id));
  const branches: PlanningContext[] = maps.map((map) => {
    const prd = prds.find(({ id }) => id === map.prdId);
    return {
      key: map.id,
      map,
      prd,
      jobs: linkedJobs(...map.jobIds, ...(prd?.values.job_ids ?? [])),
      record: map,
    };
  });
  for (const prd of prds) {
    if (!branches.some((branch) => branch.prd === prd)) {
      branches.push({
        key: prd.id,
        prd,
        jobs: linkedJobs(...(prd.values.job_ids ?? [])),
        record: prd,
      });
    }
  }
  const unplanned = jobs.filter((job) => !branches.some((branch) => branch.jobs.includes(job)));
  return [...branches, ...unplanned.map((job) => ({ key: job.id, jobs: [job], record: job }))];
}

export function selectedOverviewContext(contexts: readonly PlanningContext[], selection?: string) {
  if (!selection) return contexts[0];
  return (
    contexts.find(({ key }) => key === selection) ??
    contexts.find(
      ({ prd, jobs }) => prd?.id === selection || jobs.some(({ id }) => id === selection),
    ) ??
    contexts[0]
  );
}

function applicableVision(
  knowledge: readonly KnowledgeRecord[],
  jobs: readonly KnowledgeRecord[],
  prd?: KnowledgeRecord,
) {
  const visions = knowledge.filter(({ kind }) => kind === "vision");
  return (
    visions.find(({ id }) => id === prd?.values.vision_id) ??
    visions.find(({ values }) => values.job_ids?.some((id) => jobs.some((job) => job.id === id))) ??
    visions.find(({ values }) => values.approval === "approved") ??
    visions[0]
  );
}

function sliceCoverage(
  map: StoryMapRecord | undefined,
  items: readonly BacklogItem[],
  storiesForSlice: typeof storySliceStories,
) {
  const slice = map?.slices[0];
  const stories = map && slice ? storiesForSlice(map, slice.id, items) : [];
  const reviewed = stories.filter(({ covered, deferred }) => covered || deferred).length;
  const linked = stories.flatMap(({ links }) =>
    links.flatMap(({ item }) => (item?.kind === "UC" ? [item] : [])),
  );
  const pbis = [...new Map(linked.map((item) => [item.id, item])).values()];
  const complete = stories.length > 0 && reviewed === stories.length;
  return { slice, count: stories.length, reviewed, pbis, complete };
}

export function overviewPlanning(
  current: PlanningContext | undefined,
  knowledge: readonly KnowledgeRecord[],
  items: readonly BacklogItem[],
  storiesForSlice: typeof storySliceStories,
) {
  const { jobs = [], prd, map } = current ?? {};
  const vision = applicableVision(knowledge, jobs, prd);
  const coverage = sliceCoverage(map, items, storiesForSlice);
  return {
    jobs,
    vision,
    prd,
    map,
    ...coverage,
    next: nextPlanningStep(prd, map, coverage, jobs.length > 0, vision),
  };
}

function nextPlanningStep(
  prd: KnowledgeRecord | undefined,
  map: StoryMapRecord | undefined,
  coverage: ReturnType<typeof sliceCoverage>,
  hasJobs: boolean,
  vision: KnowledgeRecord | undefined,
) {
  if (prd && !prd.values.requirement_id) return "prd";
  if (map) return nextSliceStep(coverage);
  if (prd) return "map";
  if (!hasJobs) return "job";
  return vision ? "prd" : "vision";
}

function nextSliceStep({ complete, count }: ReturnType<typeof sliceCoverage>) {
  if (complete) return undefined;
  return count ? "handoff" : "slice";
}
