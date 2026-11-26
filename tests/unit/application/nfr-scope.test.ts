import { expect, it } from "vitest";
import { nfrsForScope } from "../../../src/application/backlog";
import type {
  BacklogItem,
  NfrMap,
  NfrScopeSource,
  ScopedNfr,
} from "../../../src/application/backlog";
import type { NfrScopeRecord } from "../../../src/application/backlog/nfr/scope";

const project = "project-33333333-3333-4333-8333-000000000001";
const foreign = "project-33333333-3333-4333-8333-000000000002";
const item = (key: string, kind: BacklogItem["kind"], parent?: string): BacklogItem => ({
  id: key,
  key,
  kind,
  path: `P/${key}.md`,
  title: key,
  fields: {},
  state: "",
  owner: "",
  priority: "",
  adopted: true,
  conflict: false,
  brokenParent: false,
  ...(parent && { parent }),
});
const work = [
  item("EP-01", "EP"),
  item("FE-01", "FE", "EP-01"),
  item("UC-09", "UC", "FE-01"),
  item("TASK-01", "TASK", "UC-09"),
  item("UC-14", "UC", "FE-01"),
  item("Q-01", "Q", "UC-14"),
  { ...item("TASK-02", "TASK", "UC-09"), adopted: false },
  { ...item("TASK-03", "TASK", "UC-09"), conflict: true },
];
function map(
  id: string,
  links: NfrMap["links"],
  projectId = project as NfrMap["projectId"],
): NfrMap {
  return { projectId, id, title: id, links };
}
const maps = [
  map("SM-01", [
    { projectId: project, itemId: "UC-09" },
    { projectId: project, itemId: "UC-14" },
  ]),
  map("SM-OTHER", [{ projectId: project, itemId: "UC-14" }]),
  map("SM-SECOND", [{ projectId: project, itemId: "UC-09" }]),
  map("SM-HOP", [{ projectId: project, itemId: "FE-01" }]),
  map("SM-FOREIGN-LINK", [{ projectId: foreign, itemId: "UC-09" }]),
  map("SM-FOREIGN", [{ projectId: project, itemId: "UC-09" }], foreign),
];
const target = (id: string, kind: "item" | "map" = "item") => ({ kind, id });
function record(number: number, ...targets: NfrScopeRecord["targets"]): NfrScopeRecord {
  return {
    id: `nfr-33333333-3333-4333-8333-${String(number).padStart(12, "0")}`,
    projectId: project,
    title: String(number),
    requirement: "Clear scope",
    acceptance: "95% in 1 s",
    targets,
    categories: ["security", "performance-efficiency", "security"],
  };
}
const records: readonly NfrScopeRecord[] = [
  record(1, target("UC-09"), target("SM-01", "map"), target("UC-09")),
  record(2, target("FE-01")),
  record(3, target("TASK-01")),
  record(4, target("UC-14")),
  record(5, target("SM-OTHER", "map")),
  record(6, target("SM-SECOND", "map")),
  record(7, target("SM-HOP", "map")),
  record(8, target("SM-FOREIGN", "map")),
  record(9, target("SM-FOREIGN-LINK", "map")),
  record(10, target("MISSING")),
  record(11),
  record(12, target("Q-01")),
  record(13, target("TASK-02")),
  record(14, target("TASK-03")),
  { ...record(15, target("UC-09")), projectId: foreign },
];
const scope = (source: NfrScopeSource): readonly ScopedNfr[] =>
  nfrsForScope(project, source, records.toReversed(), work, maps);

it("resolves an item through its branch and actual maps, deduplicates origins and preserves acceptance", () => {
  const result = scope(target("UC-09"));
  expect(result.map(({ title }) => title)).toEqual(["1", "2", "3", "6"]);
  expect(result[0]).toMatchObject({
    acceptance: "95% in 1 s",
    categories: ["performance-efficiency", "security"],
    sources: [
      { kind: "item", id: "UC-09", title: "UC-09", projectId: project },
      { kind: "map", id: "SM-01", title: "SM-01", projectId: project },
    ],
  });
  expect(scope(target("TASK-01")).map(({ title }) => title)).toEqual(["1", "2", "3", "6"]);
  expect(scope(target("MISSING"))).toEqual([]);
  expect(scope(target("TASK-03"))).toEqual([]);
});

it("resolves a map through its own linked items, linked PBIs' companions and ancestors", () => {
  expect(scope(target("SM-01", "map")).map(({ title }) => title)).toEqual([
    "1",
    "2",
    "3",
    "4",
    "12",
  ]);
  expect(scope(target("SM-FOREIGN", "map"))).toEqual([]);
  expect(scope(target("SM-FOREIGN-LINK", "map")).map(({ title }) => title)).toEqual(["9"]);
  expect(scope(target("SM-HOP", "map")).map(({ title }) => title)).toEqual(["2", "7"]);
});

it("returns only the explicitly selected NFR, including unassigned ones, or no match", () => {
  const selected = record(11);
  expect(scope({ kind: "nfr", id: selected.id })).toMatchObject([
    {
      id: selected.id,
      sources: [{ kind: "nfr", id: selected.id, projectId: project, title: "11" }],
    },
  ]);
  expect(scope({ kind: "nfr", id: record(99).id })).toEqual([]);
});
