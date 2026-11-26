import { expect, it } from "vitest";
import type { DomainEdge } from "../../../src/application/domain-model";
import type { KnowledgeRecord } from "../../../src/application/knowledge";
import { zoomAt } from "../../../src/presentation/domain-model/camera";
import {
  diagramConnections,
  diagramNodes,
  fitDiagram,
} from "../../../src/presentation/domain-model/geometry";
import {
  readDomainView,
  writeDomainView,
} from "../../../src/presentation/domain-model/view-preferences";

const project = "project-33333333-3333-4333-8333-000000000001";
const organisation = "knowledge-33333333-3333-4333-8333-000000000041";
const serviceCase = "knowledge-33333333-3333-4333-8333-000000000042";
const approval = "knowledge-33333333-3333-4333-8333-000000000043";

it("zooms about the same model point under a plain wheel pointer, including at the bounds", () => {
  const camera = { x: -35, y: 20, zoom: 1.4 };
  const anchor = { x: 243, y: 100 };
  const before = { x: (anchor.x - camera.x) / camera.zoom, y: (anchor.y - camera.y) / camera.zoom };
  const next = zoomAt(camera, anchor, 1.28);
  expect(next.zoom).toBeCloseTo(1.792);
  expect((anchor.x - next.x) / next.zoom).toBeCloseTo(before.x);
  expect((anchor.y - next.y) / next.zoom).toBeCloseTo(before.y);
  const limited = zoomAt(next, anchor, 100);
  expect(limited.zoom).toBe(4);
  expect((anchor.x - limited.x) / limited.zoom).toBeCloseTo(before.x);
  expect((anchor.y - limited.y) / limited.zoom).toBeCloseTo(before.y);
  expect(zoomAt(limited, anchor, 2)).toEqual(limited);
});

it("persists independent camera and entity positions for each project when the view is reopened", () => {
  const customer = "project-33333333-3333-4333-8333-000000000001";
  const admin = "project-33333333-3333-4333-8333-000000000002";
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  const customerView = {
    camera: { x: -58, y: 12, zoom: 1.6 },
    positions: { "ENT-01": { x: 45, y: 22 } },
  };
  const adminView = {
    camera: { x: 40, y: -10, zoom: 0.9 },
    positions: { "ENT-01": { x: 9, y: 62 } },
  };
  writeDomainView(storage, customer, customerView);
  expect(readDomainView(storage, admin)).toEqual({
    camera: { x: 0, y: 0, zoom: 1 },
    positions: {},
  });
  writeDomainView(storage, admin, adminView);
  expect(readDomainView(storage, customer)).toEqual(customerView);
  expect(readDomainView(storage, admin)).toEqual(adminView);
});

it("keeps a usable camera when stored preferences are malformed or outside zoom bounds", () => {
  let stored = "{";
  const storage = {
    getItem: () => stored,
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  };
  const defaults = { camera: { x: 0, y: 0, zoom: 1 }, positions: {} };
  expect(readDomainView(storage, project)).toEqual(defaults);
  stored = JSON.stringify({ camera: [0, 0], positions: "broken" });
  expect(readDomainView(storage, project)).toEqual(defaults);
  stored = JSON.stringify({
    camera: { x: 12, y: -3, zoom: "infinite" },
    positions: { bad: { x: "left", y: 7 } },
  });
  expect(readDomainView(storage, project)).toEqual(defaults);
  stored = JSON.stringify({
    camera: { x: 12, y: -3, zoom: 99 },
    positions: {
      [organisation]: { x: 2200, y: 77 },
      bad: null,
    },
  });
  expect(readDomainView(storage, project)).toEqual({
    camera: { x: 12, y: -3, zoom: 4 },
    positions: { [organisation]: { x: 2200, y: 77 } },
  });
  expect(() => writeDomainView(storage, project, defaults)).not.toThrow();
});

function record(id: KnowledgeRecord["id"], displayId: string): KnowledgeRecord {
  return {
    id,
    projectId: project,
    title: displayId,
    path: displayId + ".md",
    kind: "entity",
    displayId,
    values: {},
  };
}

it("draws distinct parallel, reversed and loop paths and fits manually separated cards in the real viewport units", () => {
  const records = [
    record(organisation, "ENT-01"),
    record(serviceCase, "ENT-02"),
    record(approval, "ENT-03"),
  ];
  const edge: DomainEdge = {
    id: "REL-01",
    source: organisation,
    target: serviceCase,
    verb: "reports",
    sourceCardinality: "1",
    targetCardinality: "0..*",
  };
  const shapes = diagramConnections(diagramNodes(records, {}), [
    edge,
    { ...edge, id: "REL-02", verb: "reviews" },
    { ...edge, id: "REL-03", source: serviceCase, target: organisation },
    { ...edge, id: "REL-04", target: organisation },
    { ...edge, id: "REL-05", target: approval },
    { ...edge, id: "REL-06", source: "knowledge-missing" },
  ]);
  expect(new Set(shapes.map(({ path }) => path)).size).toBe(5);
  expect(shapes[3]?.path).toContain(" C ");
  expect(shapes[4]?.label.y).toBeLessThan(55);
  const moved = diagramNodes(records, { [approval]: { x: 2300, y: -150 } });
  const fit = fitDiagram(moved, 390, 300);
  expect(fit.zoom).toBeLessThan(0.2);
  for (const node of moved) {
    expect(node.x * fit.zoom + fit.x).toBeGreaterThan(0);
    expect((node.x + 176) * fit.zoom + fit.x).toBeLessThan(390);
    expect(node.y * fit.zoom + fit.y).toBeGreaterThan(0);
  }
});
