import type { ProjectId } from "../../application/projects";
import { boundedZoom } from "./camera";
import type { Camera, Point } from "./camera";

type StoragePort = Pick<Storage, "getItem" | "setItem">;
type DomainView = { readonly camera: Camera; readonly positions: Record<string, Point> };

export const initialCamera: Camera = { x: 0, y: 0, zoom: 1 };

function storageKey(project: ProjectId) {
  return "product-engineering:domain-model:" + project;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function point(value: unknown): value is Point {
  return plainRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function savedCamera(value: unknown): Camera {
  if (!plainRecord(value)) return initialCamera;
  const { zoom } = value;
  if (!point(value) || typeof zoom !== "number" || !Number.isFinite(zoom)) {
    return initialCamera;
  }
  return { x: value.x, y: value.y, zoom: boundedZoom(zoom) };
}

function savedPositions(value: unknown) {
  if (!plainRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) =>
      point(candidate) ? [[key, { x: candidate.x, y: candidate.y }]] : [],
    ),
  );
}

export function readDomainView(store: StoragePort | undefined, project: ProjectId): DomainView {
  try {
    const data: unknown = JSON.parse(store?.getItem(storageKey(project)) ?? "null");
    if (plainRecord(data))
      return { camera: savedCamera(data.camera), positions: savedPositions(data.positions) };
  } catch {
    // A corrupt preference cannot block opening the canvas.
  }
  return { camera: initialCamera, positions: {} };
}

export function writeDomainView(
  store: StoragePort | undefined,
  project: ProjectId,
  view: DomainView,
) {
  try {
    store?.setItem(storageKey(project), JSON.stringify(view));
  } catch {
    // Diagram interaction remains available when local storage is blocked.
  }
}
