export async function preloadSurface(): Promise<void> {
  await import("../../src/presentation/shell/mount");
  const { appSurface } = await import("../../src/presentation/app-surface");
  await Promise.all([
    appSurface.screen(appSurface.start)?.(),
    appSurface.context?.(),
    ...(appSurface.sections ?? []).flatMap((section) => [section.component(), section.badge?.()]),
  ]);
}
