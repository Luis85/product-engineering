<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
  projectKnowledgeRoute,
} from "../../../application/knowledge";
import { projectMembers } from "../../../application/projects";
import type { ProjectSettings } from "../../../application/projects";
import { useMessages, useStream } from "../../shell";
import { useRestoreWorkspacePosition } from "../workspace-position";
import ProjectOverviewLink from "./ProjectOverviewLink.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const open = defineModel<boolean>("open", { required: true });
const catalog = useMessages();
const text = catalog.projects.overviewDelivery;
const library = useStream(knowledgeSnapshot, knowledgeChanges);
const rows = computed(() => {
  const members = new Map((projectMembers(project) ?? []).map(({ id, name }) => [id, name]));
  return projectKnowledge(project.id, library.value.records).flatMap((note) => {
    const { kind, id, displayId, title, values } = note;
    if (kind !== "jtbd" && kind !== "vision" && kind !== "prd") return [];
    return [
      {
        id,
        displayId,
        title,
        kindLabel: catalog.projects.templates.labels[kind],
        owner: (values.owner_id && members.get(values.owner_id)) || catalog.knowledge.unassigned,
        approval: values.approval && catalog.knowledge.approvals[values.approval],
      },
    ];
  });
});
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch(rows, () => restore("available"), { flush: "post" });
</script>

<template>
  <details
    v-if="rows.length"
    class="pe-overview-panel pe-overview-disclosure"
    :open="open"
    data-testid="overview-foundations"
    @toggle="open = ($event.currentTarget as HTMLDetailsElement).open"
  >
    <summary>{{ text.allFoundations }}</summary>
    <section :aria-label="text.foundation">
      <header class="pe-overview-section-head">
        <h2>{{ text.foundation }}</h2>
        <ProjectOverviewLink
          :destination="projectKnowledgeRoute(project.id)"
          data-pe-focus-key="overview-knowledge"
        >
          {{ text.openKnowledge }}
        </ProjectOverviewLink>
      </header>
      <div class="pe-overview-panel pe-overview-table-panel">
        <table
          class="pe-overview-table pe-overview-foundations-table"
          role="table"
          :aria-label="text.foundation"
        >
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col">{{ text.artifact }}</th>
              <th scope="col">{{ catalog.knowledge.owner }}</th>
              <th scope="col">{{ text.state }}</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <tr v-for="row in rows" :key="row.id" role="row">
              <td role="cell">
                <ProjectOverviewLink
                  :destination="knowledgeDetailRoute(project.id, row.id, { section: 'overview' })"
                  :data-pe-focus-key="'overview-foundation-' + row.id"
                  >{{ row.title }}</ProjectOverviewLink
                >
                <small>{{ row.displayId }} · {{ row.kindLabel }}</small>
              </td>
              <td role="cell">
                <span class="pe-overview-field-label">{{ catalog.knowledge.owner }}</span>
                {{ row.owner }}
              </td>
              <td role="cell">
                <span class="pe-overview-field-label">{{ text.state }}</span>
                {{ row.approval || catalog.backlog.unset }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </details>
</template>
