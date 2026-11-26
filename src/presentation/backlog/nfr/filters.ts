import { reactive } from "vue";
import type { NfrRecord } from "../../../application/backlog";
import type { ProjectId, ProjectMember } from "../../../application/projects";
import { nfrCategories, nfrTitleKey } from "../../../domain/backlog";
import type { NfrCategory } from "../../../domain/backlog";
import { useRouting } from "../../shell";

type Filters = { query: string; category: string };
const byLeaf = new WeakMap<object, Map<ProjectId, Filters>>();

export function useNfrFilters(project: ProjectId) {
  const { navigation } = useRouting();
  const projects = byLeaf.get(navigation) ?? new Map<ProjectId, Filters>();
  byLeaf.set(navigation, projects);
  const filters = projects.get(project) ?? reactive({ query: "", category: "" });
  projects.set(project, filters);
  return filters;
}

function matchesCategory(record: NfrRecord, category: string) {
  if (!category) return true;
  if (category === "unclassified") return record.categories.length === 0;
  return nfrCategories.some(
    ([id, standard]) =>
      record.categories.includes(id) && (id === category || standard === category),
  );
}

export function visibleNfrRecords(
  records: readonly NfrRecord[],
  members: readonly ProjectMember[],
  labels: Readonly<Record<NfrCategory, string>>,
  filters: Filters,
) {
  const query = nfrTitleKey(filters.query);
  return records.filter((record) => {
    if (!matchesCategory(record, filters.category)) return false;
    const owner = members.find(({ id }) => id === record.owner_id)?.name;
    return nfrTitleKey(
      [
        record.title,
        record.id,
        record.requirement,
        record.acceptance,
        owner,
        ...record.categories.map((id) => labels[id]),
      ].join(" "),
    ).includes(query);
  });
}
