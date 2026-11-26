export type Point = { readonly x: number; readonly y: number };
export type Camera = Point & { readonly zoom: number };

export const minimumZoom = 0.08;
export const maximumZoom = 4;

export function boundedZoom(zoom: number) {
  return Math.max(minimumZoom, Math.min(maximumZoom, zoom));
}

export function zoomAt(camera: Camera, anchor: Point, scale: number): Camera {
  const zoom = boundedZoom(camera.zoom * scale);
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
  };
}
