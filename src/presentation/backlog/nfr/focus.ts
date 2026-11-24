export function focusNfrLink(event: Event, selector: string | undefined) {
  const panel = event.currentTarget as HTMLElement | null;
  const link = selector ? panel?.querySelector<HTMLElement>(selector) : undefined;
  if (!link) return false;
  event.preventDefault();
  link.focus();
  return true;
}
import { backlogRoute, pbiDetailRoute } from "../../../application/backlog";
import type { ProjectId } from "../../../application/projects";
import { storyMapsRoute } from "../../../application/story-maps";
import type { NfrTarget } from "../../../domain/backlog";
import { isStoryMapId } from "../../../domain/story-maps";

export function nfrTargetRoute(project: ProjectId, { id, kind }: NfrTarget) {
  if (kind === "map") return isStoryMapId(id) ? storyMapsRoute(project, id) : undefined;
  return id.startsWith("UC-") ? pbiDetailRoute(project, id) : backlogRoute(project, id);
}
