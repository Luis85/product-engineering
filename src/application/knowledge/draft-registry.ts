import { Context, Layer } from "effect";
import type { ProjectId } from "../projects";

type IsDirty = () => boolean;
type Registry = {
  register(projectId: ProjectId, noteId: string, dirty: IsDirty): () => void;
  hasDirty(projectId: ProjectId, noteId: string): boolean;
};

export class KnowledgeDraftRegistry extends Context.Service<KnowledgeDraftRegistry, Registry>()(
  "product-engineering/application/KnowledgeDraftRegistry",
) {}

const keyOf = (projectId: ProjectId, noteId: string) => projectId + ":" + noteId;

export const knowledgeDraftsLayer = Layer.sync(KnowledgeDraftRegistry, () => {
  const entries = new Map<string, Set<IsDirty>>();
  return {
    register(projectId, noteId, dirty) {
      const key = keyOf(projectId, noteId);
      const group = entries.get(key) ?? new Set<IsDirty>();
      entries.set(key, group);
      group.add(dirty);
      return () => {
        group.delete(dirty);
        if (!group.size) entries.delete(key);
      };
    },
    hasDirty(projectId, noteId) {
      return [...(entries.get(keyOf(projectId, noteId)) ?? [])].some((dirty) => dirty());
    },
  };
});
