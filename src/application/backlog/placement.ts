import { Effect, Result } from "effect";
import { parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import type { Frontmatter } from "../../domain/notes";
import { NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import { BacklogError, backlogLink, compareRank } from "./model";
import type { BacklogItem } from "./model";
import {
  BacklogWrites,
  frontmatterPatch,
  matchesFields,
  scopedBacklog,
  stillInBacklog,
  writableRow,
} from "./service";
import type { BacklogContext } from "./service";

export type BacklogPlacement = {
  readonly target: string;
  readonly zone: "before" | "inside" | "after";
  readonly level?: BacklogKind;
};

const step = 1024;

export function nextRank(items: readonly BacklogItem[]) {
  return Math.max(0, ...items.map(({ rank }) => rank ?? 0)) + step;
}

function between(before: number | undefined, after: number | undefined) {
  if (before === undefined) return after === undefined ? step : after - step;
  if (after === undefined) return before + step;
  const rank = before / 2 + after / 2;
  return rank > before && rank < after ? rank : undefined;
}

export function rankingPeers(
  items: readonly BacklogItem[],
  item: BacklogItem,
  level?: BacklogKind,
  parent = item.parent,
) {
  const focused = level === item.kind && parent === item.parent;
  return items
    .filter((peer) => (focused ? peer.kind === item.kind : peer.parent === parent))
    .toSorted(compareRank);
}

function shiftRank(peers: readonly BacklogItem[], target: BacklogItem, zone: "before" | "after") {
  const index = peers.indexOf(target);
  if (index < 0) return;
  const boundary = zone === "before" ? index : index + 1;
  if (target.rank === undefined) {
    const tail = peers.slice(boundary);
    if (tail.some(({ rank }) => rank !== undefined) || zone === "after") return;
  }
  return between(peers[boundary - 1]?.rank, peers[boundary]?.rank);
}

export function planningReparent(items: readonly BacklogItem[], row: BacklogItem, parent: string) {
  const target = items.find(({ key }) => key === parent);
  if (!target || target.kind !== parentKind(row.kind) || target.conflict)
    return Result.fail(new BacklogError({ reason: "parent" }));
  const peers = items.filter((item) => item.parent === target.key && item.key !== row.key);
  return Result.succeed({
    fields: { parent: backlogLink(target.path), order: nextRank(peers) },
    peers: [target, ...peers],
  });
}

export function planningPlacement(
  items: readonly BacklogItem[],
  row: BacklogItem,
  placement: BacklogPlacement,
  parent = row.parent,
) {
  if (placement.zone === "inside") return planningReparent(items, row, placement.target);
  const target = items.find(({ key }) => key === placement.target);
  if (!target || target.key === row.key || target.conflict)
    return Result.fail(new BacklogError({ reason: "rank" }));
  const peers = rankingPeers(items, row, placement.level, parent).filter(
    ({ key }) => key !== row.key,
  );
  const rank = shiftRank(peers, target, placement.zone);
  return rank === undefined || !Number.isFinite(rank)
    ? Result.fail(new BacklogError({ reason: "rank" }))
    : Result.succeed({ fields: { order: rank }, peers });
}

export function verifyPeers(context: BacklogContext, peers: readonly BacklogItem[]) {
  const storeEffect = NoteStore.use((store) =>
    Effect.forEach(peers, (peer) =>
      Effect.gen(function* () {
        const note = yield* store.readFresh(peer.path);
        if (
          !stillInBacklog(context, peer, note.frontmatter) ||
          !matchesFields(note.frontmatter, peer.fields, {
            order: peer.fields.order,
            parent: peer.fields.parent,
          })
        )
          return yield* new BacklogError({ reason: "conflict" });
      }),
    ),
  );
  return Effect.asVoid(storeEffect);
}

function writeRank(
  context: BacklogContext,
  row: BacklogItem,
  fields: Frontmatter,
  before: Frontmatter,
) {
  return NoteStore.use((store) =>
    store.update(row.path, (current) =>
      stillInBacklog(context, row, current) && matchesFields(current, before, fields)
        ? Result.succeed(frontmatterPatch(fields))
        : Result.fail(new BacklogError({ reason: "conflict" })),
    ),
  );
}

export const moveBacklogItem = (project: ProjectId, key: string, placement: BacklogPlacement) =>
  BacklogWrites.use(({ lock, recent, undo }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const context = yield* scopedBacklog(project);
        const { row, items } = yield* writableRow(context, key);
        const { fields, peers } = yield* Effect.fromResult(
          planningPlacement(items, row, placement),
        );
        yield* verifyPeers(context, peers);
        const saved = yield* writeRank(context, row, fields, row.fields);
        recent.set(saved.path, saved);
        undo.set(project, {
          key: row.key,
          before: row.fields,
          after: fields,
          keys: Object.keys(fields),
        });
      }),
    ),
  );

export const undoBacklogMove = (project: ProjectId) =>
  BacklogWrites.use(({ lock, recent, undo }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const change = undo.get(project);
        if (!change) return false;
        const context = yield* scopedBacklog(project);
        const { row, items } = yield* writableRow(context, change.key);
        const fields = Object.fromEntries(change.keys.map((key) => [key, change.before[key]]));
        if (Object.hasOwn(fields, "parent")) {
          const parent = items.find(
            (peer) =>
              backlogLink(peer.path) === fields.parent ||
              "[[" + peer.path.slice(peer.path.lastIndexOf("/") + 1, -3) + "]]" === fields.parent,
          );
          if (typeof fields.parent === "string" && parent?.kind !== parentKind(row.kind))
            return yield* new BacklogError({ reason: "parent" });
          if (parent) yield* verifyPeers(context, [parent]);
        }
        const saved = yield* writeRank(context, row, fields, change.after);
        recent.set(saved.path, saved);
        undo.delete(project);
        return true;
      }),
    ),
  );
