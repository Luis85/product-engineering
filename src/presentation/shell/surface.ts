export const loadSurface = () => import("./mount");

export type SurfaceLoader = typeof loadSurface;
