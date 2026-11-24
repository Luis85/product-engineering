import { reactive } from "vue";
import { deliverableNote } from "../../../application/backlog";
import type { DeliverableRecord } from "../../../application/backlog";
import type { KnowledgeRecord } from "../../../application/knowledge";
import type { ProjectId, ProjectMember } from "../../../application/projects";
import { useRouting } from "../../shell";

export type DeliverableFilters = { query: string; status: string; template: string };
const filtersByLeaf = new WeakMap<object, Map<ProjectId, DeliverableFilters>>();

export function useDeliverableFilters(project: ProjectId) {
  const { navigation } = useRouting();
  const projects = filtersByLeaf.get(navigation) ?? new Map<ProjectId, DeliverableFilters>();
  filtersByLeaf.set(navigation, projects);
  const filters = projects.get(project) ?? reactive({ query: "", status: "", template: "" });
  projects.set(project, filters);
  return filters;
}

export function deliverableRows(
  records: readonly DeliverableRecord[],
  notes: readonly KnowledgeRecord[],
  owners: readonly Pick<ProjectMember, "id" | "name">[],
) {
  return records.map((record) => {
    const note = deliverableNote(record, notes);
    const owner =
      owners.find(({ id }) => id === record.values.owner_id)?.name ?? record.values.owner_id;
    return { record, note, owner, template: record.values.template || note?.kind };
  });
}

export type DeliverableRow = ReturnType<typeof deliverableRows>[number];

function matchesTemplate(template: string | undefined, filter: string) {
  if (!filter) return true;
  return filter === "untyped" ? !template : template === filter;
}

export function visibleDeliverableRows(
  rows: readonly DeliverableRow[],
  filters: DeliverableFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return rows.filter(({ record, note, owner, template }) => {
    if (filters.status && filters.status !== record.values.status) return false;
    if (!matchesTemplate(template, filters.template)) return false;
    const { title, outcome, due, knowledge_id } = record.values;
    return [
      title,
      outcome,
      due,
      knowledge_id,
      owner,
      record.displayId,
      record.id,
      note?.title,
      note?.displayId,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
}
