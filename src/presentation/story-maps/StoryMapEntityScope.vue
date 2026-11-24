<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, watch } from "vue";
import { backlogRoute, pbiDetailRoute } from "../../application/backlog";
import { entityAssigned, resolveDomainScope } from "../../application/domain-model";
import { knowledgeDetailRoute } from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import { storyMapDomainContribution } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import { isKnowledgeId } from "../../domain/knowledge";
import { DomainScopeLinks } from "../domain-model";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { ErrorNotice, useMessages, useNavigate, useQuery } from "../shell";

const { map, records, backlog } = defineProps<{
  readonly map: StoryMapRecord;
  readonly records: readonly KnowledgeRecord[];
  readonly backlog: unknown;
}>();
const text = useMessages()["story-maps"].context;
const target = { kind: "map" as const, id: map.id };
const scope = useQuery(() =>
  resolveDomainScope(map.projectId, [target], storyMapDomainContribution),
);
const direct = computed(
  () =>
    new Set(
      records
        .filter((record) => record.kind === "entity" && entityAssigned(record, target))
        .map(({ id }) => id),
    ),
);
const inherited = computed(
  () => scope.value.value?.entities.filter(({ id }) => !direct.value.has(id)) ?? [],
);
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
watch([() => map, () => records, () => backlog], () => void scope.run(), { immediate: true });
watch(inherited, () => restore(), { flush: "post" });

function openEntity(id: string, event: MouseEvent) {
  if (!isKnowledgeId(id)) return;
  remember(event.currentTarget as HTMLElement);
  return navigate(
    knowledgeDetailRoute(map.projectId, id, {
      section: "storymaps",
      reference: { kind: "story-map", recordId: map.id },
    }),
  );
}

function openOrigin(kind: string, id: string, event: MouseEvent) {
  if (kind === "prd") return openEntity(id, event);
  if (kind !== "item") return;
  remember(event.currentTarget as HTMLElement);
  return navigate(
    id.startsWith("UC-") ? pbiDetailRoute(map.projectId, id) : backlogRoute(map.projectId, id),
  );
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-3">
    <DomainScopeLinks :map="{ projectId: map.projectId, id: map.id }" />
    <ul
      v-if="inherited.length"
      class="pe:grid pe:min-w-0 pe:gap-2"
      :aria-label="text.inheritedEntities"
    >
      <li v-for="entity in inherited" :key="entity.id">
        <UButton
          type="button"
          variant="link"
          class="pe:p-0 pe:wrap-anywhere pe:text-start"
          :data-pe-focus-key="'story-entity-' + entity.id"
          @click="openEntity(entity.id, $event)"
          >{{ entity.displayId }} · {{ entity.title }}</UButton
        >
        <div class="pe:flex pe:flex-wrap pe:items-center pe:gap-1">
          <small>{{ text.entityOrigin }}</small>
          <template v-for="origin in entity.origins" :key="origin.kind + ':' + origin.id">
            <span v-if="origin.kind === 'map'">{{ origin.title }}</span>
            <UButton
              v-else
              type="button"
              color="neutral"
              size="xs"
              variant="link"
              class="pe:p-0 pe:wrap-anywhere pe:text-start"
              :data-pe-focus-key="'story-entity-' + entity.id + '-' + origin.id"
              @click="openOrigin(origin.kind, origin.id, $event)"
              >{{ origin.title }}</UButton
            >
          </template>
        </div>
      </li>
    </ul>
    <ErrorNotice v-if="scope.message.value" :message="scope.message.value" />
  </div>
</template>
