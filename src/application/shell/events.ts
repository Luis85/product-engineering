type FileEvent = { readonly path: string; readonly extension: string };

export type ShellEvents = {
  readonly LayoutReady: Record<never, never>;
  readonly VaultReady: Record<never, never>;
  readonly FileCreated: FileEvent;
  readonly FileModified: FileEvent;
  readonly FileDeleted: FileEvent;
  readonly FileRenamed: FileEvent & { readonly oldPath: string };
  readonly MetadataChanged: FileEvent;
};
