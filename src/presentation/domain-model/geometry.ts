import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeRecord } from "../../application/knowledge";
import { boundedZoom } from "./camera";
import type { Camera, Point } from "./camera";

export const nodeWidth = 176;
export const nodeHeight = 72;
export type DiagramNode = KnowledgeRecord & Point;

export function diagramNodes(
  records: readonly KnowledgeRecord[],
  positions: Readonly<Record<string, Point>>,
) {
  return records.map((record, index): DiagramNode => ({
    ...record,
    ...(positions[record.id] ?? { x: 38 + (index % 3) * 254, y: 66 + Math.floor(index / 3) * 152 }),
  }));
}

function center(node: Point): Point {
  return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight / 2 };
}

function border(from: Point, toward: Point): Point {
  const x = toward.x - from.x;
  const y = toward.y - from.y;
  const scale = 1 / Math.max(Math.abs(x) / (nodeWidth / 2), Math.abs(y) / (nodeHeight / 2), 1e-7);
  return { x: from.x + x * scale, y: from.y + y * scale };
}

function coordinates(point: Point) {
  return `${point.x} ${point.y}`;
}

function connection(from: Point, to: Point, offset: number) {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const distance = Math.hypot(x, y) || 1;
  const control = {
    x: (from.x + to.x) / 2 - (y * offset) / distance,
    y: (from.y + to.y) / 2 + (x * offset) / distance,
  };
  const start = border(from, control);
  const end = border(to, control);
  return {
    path: `M ${coordinates(start)} Q ${coordinates(control)} ${coordinates(end)}`,
    label: {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4 - 6,
    },
  };
}

function loop(node: Point, index: number) {
  const lift = 60 + index * 30;
  const wing = 58 + index * 27;
  return {
    path: `M ${node.x + 37} ${node.y} C ${node.x + wing} ${node.y - lift}, ${node.x - wing} ${node.y - lift}, ${node.x - 37} ${node.y}`,
    label: { x: node.x, y: node.y - lift * 0.75 - 6 },
  };
}

function rowDetour(from: Point, to: Point) {
  const x = to.x - from.x;
  if (Math.abs(x) < 380 || Math.abs(to.y - from.y) > 44) return 0;
  // Long same-row edges pass above intervening cards and their adjacent connections.
  return -Math.sign(x) * 105;
}

export function diagramConnections(nodes: readonly DiagramNode[], edges: readonly DomainEdge[]) {
  const byId = new Map<string, DiagramNode>(nodes.map((node) => [node.id, node]));
  const groups = new Map<string, DomainEdge[]>();
  for (const edge of edges) {
    const { source, target } = edge;
    const key = source < target ? source + target : target + source;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) =>
    group.flatMap((edge, index) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return [];
      const from = center(source);
      const to = center(target);
      const lane = (index - (group.length - 1) / 2) * 38 * (source.id < target.id ? 1 : -1);
      return [
        {
          edge,
          ...(source === target
            ? loop(from, index)
            : connection(from, to, lane + rowDetour(from, to))),
        },
      ];
    }),
  );
}

export function fitDiagram(nodes: readonly DiagramNode[], width: number, height: number): Camera {
  const x = Math.min(...nodes.map((node) => node.x)) - 32;
  const y = Math.min(...nodes.map((node) => node.y)) - 68;
  const totalWidth = Math.max(...nodes.map((node) => node.x + nodeWidth)) - x + 32;
  const totalHeight = Math.max(...nodes.map((node) => node.y + nodeHeight)) - y + 32;
  const zoom = boundedZoom(Math.min(1, width / totalWidth, height / totalHeight));
  return {
    zoom,
    x: (width - totalWidth * zoom) / 2 - x * zoom,
    y: (height - totalHeight * zoom) / 2 - y * zoom,
  };
}
