import { shallowRef, watch } from "vue";
import {
  backlogInputs,
  backlogRoute,
  backlogSnapshot,
  pbiDetailRoute,
} from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { useAsyncStream, useQuery, useRoute } from "../shell";

export function backlogSearchSource() {
  const changes = useAsyncStream<unknown, never>(null, backlogInputs);
  const route = useRoute();
  const query = useQuery(backlogSnapshot);
  const loaded = shallowRef<{ project: ProjectId; snapshot: BacklogSnapshot }>();
  watch(
    [() => ("projectId" in route.value ? route.value.projectId : undefined), changes],
    ([project]) => {
      if (loaded.value?.project !== project) loaded.value = undefined;
      if (project)
        void query.run(project).then((outcome) => {
          if (outcome._tag === "success") loaded.value = { project, snapshot: outcome.value };
        });
    },
    { immediate: true },
  );
  return (projectId: ProjectId) => {
    return projectId === loaded.value?.project
      ? loaded.value.snapshot.items.flatMap(({ adopted, conflict, id, title, path, kind }) =>
          adopted && !conflict && id
            ? [
                {
                  projectId,
                  kind: "item",
                  recordId: id,
                  title,
                  displayId: id,
                  notePath: path,
                  route:
                    kind === "UC" ? pbiDetailRoute(projectId, id) : backlogRoute(projectId, id),
                },
              ]
            : [],
        )
      : [];
  };
}
