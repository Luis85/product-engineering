<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, watch } from "vue";
import { backlogRoute, pbiDetailRoute } from "../../application/backlog";
import { entityAssigned, setEntityScope } from "../../application/domain-model";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import {
  PROJECT_STORY_MAPS,
  storyMapDomainContribution,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
} from "../../application/story-maps";
import type { EntityScopeTarget } from "../../domain/knowledge";
import { isStoryMapId } from "../../domain/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useNavigationGuard,
  useRouting,
  useStream,
} from "../shell";
import {
  useProjectSearchSources,
  useRememberWorkspaceOrigin,
  useRestoreWorkspacePosition,
} from "../projects";

const {
  note = undefined,
  item = undefined,
  map = undefined,
  fromModel = false,
  fromPbi = false,
} = defineProps<{
  readonly note?: KnowledgeRecord;
  readonly item?: { readonly projectId: ProjectId; readonly id: string };
  readonly map?: { readonly projectId: ProjectId; readonly id: StoryMapId };
  readonly fromModel?: boolean;
  readonly fromPbi?: boolean;
}>();
const text = useMessages()["domain-model"];
const index = useStream(knowledgeSnapshot, knowledgeChanges);
const contributors = useProjectSearchSources();
const projectId = note?.projectId ?? item?.projectId ?? map?.projectId;
const storyMaps =
  projectId && note?.kind === "entity"
    ? useStream(storyMapsSnapshot(projectId), storyMapsChanges(projectId))
    : undefined;
const project = computed(() => (projectId ? projectKnowledge(projectId, index.value.records) : []));
const current = computed(() => project.value.find(({ id }) => id === note?.id) ?? note);
const isEntity = computed(() => note?.kind === "entity");
const heading = computed(() => (isEntity.value ? text.productScope : text.assignedEntities));
const chooser = computed(() =>
  isEntity.value
    ? targets.value.some(({ target }) => target.kind !== "prd")
      ? text.assignScope
      : text.assignPrd
    : text.assignEntity,
);
const source: EntityScopeTarget | undefined = item
  ? { kind: "item", id: item.id }
  : map
    ? { kind: "map", id: map.id }
    : note && { kind: "prd", id: note.id };
type ScopePeer = {
  readonly id: string;
  readonly title: string;
  readonly displayId: string;
  readonly target: EntityScopeTarget;
};
const targets = computed<readonly ScopePeer[]>(() => {
  if (!projectId || !isEntity.value) return [];
  const items = contributors
    .flatMap((contribute) => contribute(projectId))
    .flatMap((record) =>
      record.kind === "item"
        ? [
            {
              id: record.recordId,
              title: record.title,
              displayId: record.displayId ?? record.recordId,
              target: { kind: "item", id: record.recordId } as const,
            },
          ]
        : [],
    );
  const prds = project.value
    .filter(({ kind }) => kind === "prd")
    .map(({ id, title, displayId }) => ({
      id,
      title,
      displayId,
      target: { kind: "prd", id } as const,
    }));
  const maps =
    storyMaps?.value.maps.map(({ id, title, displayId }) => ({
      id,
      title,
      displayId,
      target: { kind: "map", id } as const,
    })) ?? [];
  return [...prds, ...maps, ...items];
});

type Link = {
  readonly entity: KnowledgeRecord;
  readonly target: EntityScopeTarget;
  readonly peer?: KnowledgeRecord | ScopePeer;
};

const related = computed<readonly Link[]>(() => {
  const entity = current.value;
  if (isEntity.value && entity) {
    return (entity.values.domain_scope ?? []).map((target) => {
      const peer = targets.value.find(
        (candidate) => candidate.target.kind === target.kind && candidate.id === target.id,
      );
      return { target, entity, ...(peer && { peer }) };
    });
  }
  if (!source) return [];
  return project.value
    .filter((record) => record.kind === "entity" && entityAssigned(record, source))
    .map((peer) => ({ peer, entity: peer, target: source }));
});
const choices = computed(() => {
  const entity = current.value;
  if (isEntity.value && entity) {
    if (entity.values.domain_archived) return [];
    return targets.value.filter((peer) => !entityAssigned(entity, peer.target));
  }
  if (!source) return [];
  return project.value.filter(
    (record) =>
      record.kind === "entity" && !record.values.domain_archived && !entityAssigned(record, source),
  );
});
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const rememberOrigin = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
watch(related, () => restore(), { flush: "post" });
const {
  pending,
  message,
  run: write,
} = useCommand(
  (
    scopeProject: ProjectId,
    entity: KnowledgeRecord["id"],
    target: EntityScopeTarget,
    assigned: boolean,
  ) => setEntityScope(scopeProject, entity, target, assigned, storyMapDomainContribution),
);
useNavigationGuard(() => !pending.value);

function peerLabel(peer: KnowledgeRecord | ScopePeer) {
  const archived = "values" in peer && peer.values.domain_archived ? " · " + text.archived : "";
  return `${peer.title} · ${peer.displayId}${archived}`;
}

function linkKey(link: Link) {
  return link.target.kind + ":" + (link.peer?.id ?? link.target.id);
}

function open(peer: KnowledgeRecord | ScopePeer, event: MouseEvent) {
  if (!projectId) return;
  rememberOrigin(event.currentTarget as HTMLElement);
  if ("target" in peer && peer.target.kind === "map" && isStoryMapId(peer.id))
    return openMap(peer.id);
  if ("target" in peer && peer.target.kind === "item")
    return navigate(
      peer.id.startsWith("UC-")
        ? pbiDetailRoute(projectId, peer.id)
        : backlogRoute(projectId, peer.id),
    );
  const knowledge = project.value.find(({ id }) => id === peer.id);
  if (!knowledge) return;
  return navigate(knowledgeDetailRoute(projectId, knowledge.id, scopeOrigin()));
}

function openMap(id: StoryMapId) {
  if (!projectId) return;
  const previous = history.value.back.at(-1);
  return previous?.name === PROJECT_STORY_MAPS &&
    previous.projectId === projectId &&
    previous.mapId === id
    ? back()
    : navigate(storyMapsRoute(projectId, id));
}

function scopeOrigin() {
  if (map) {
    return { section: "storymaps", reference: { kind: "story-map", recordId: map.id } };
  }
  if (item) {
    return {
      section: fromPbi ? "usecase" : "backlog",
      reference: { kind: "item", recordId: item.id },
    };
  }
  if (note) {
    return {
      section: fromModel ? "domainmodel" : "knowledge-note",
      reference: { kind: fromModel ? "entity" : "knowledge", recordId: note.id },
    };
  }
}

const form = useForm({
  defaultValues: { peer: "" },
  async onSubmit({ value }) {
    const peer = choices.value.find(({ id }) => id === value.peer);
    if (!peer || !projectId) return;
    const entity = "target" in peer ? note : peer;
    const target = "target" in peer ? peer.target : source;
    if (!entity || !target) return;
    const result = await write(projectId, entity.id, target, true);
    if (result._tag === "success") form.reset();
  },
});

function remove(link: Link) {
  if (projectId) return write(projectId, link.entity.id, link.target, false);
}
</script>

<template>
  <section data-testid="domain-scope" class="pe:grid pe:min-w-0 pe:gap-2">
    <h3 class="pe:text-base pe:font-medium">
      {{ heading }}
    </h3>
    <ul v-if="related.length" class="pe:grid pe:min-w-0 pe:gap-1">
      <li
        v-for="link in related"
        :key="linkKey(link)"
        class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-center pe:gap-1"
      >
        <UButton
          v-if="link.peer"
          type="button"
          variant="link"
          color="neutral"
          class="pe:min-w-0 pe:max-w-full pe:text-start"
          :data-domain-scope-link="link.peer.id"
          :data-pe-focus-key="'domain-link-' + link.peer.id"
          @click="open(link.peer, $event)"
        >
          <span class="pe:min-w-0 pe:wrap-anywhere pe:whitespace-normal">
            {{ peerLabel(link.peer) }}
          </span>
        </UButton>
        <span v-else class="pe:wrap-anywhere pe:text-sm pe:text-muted"
          >{{ link.target.id }} · {{ text.scopeUnavailable }}</span
        >
        <UButton
          type="button"
          size="xs"
          variant="ghost"
          color="neutral"
          data-domain-remove-assignment
          :disabled="pending"
          @click="remove(link)"
          >{{ text.unassign }}</UButton
        >
      </li>
    </ul>
    <p v-else class="pe:text-sm pe:text-muted">{{ text.noAssignments }}</p>
    <form
      v-if="choices.length"
      class="pe:grid pe:min-w-0 pe:items-end pe:gap-2 pe:@min-[700px]:grid-cols-[minmax(0,1fr)_auto]"
      @submit.prevent="form.handleSubmit()"
    >
      <form.Field v-slot="{ field }" name="peer">
        <label class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
          {{ chooser }}
          <select
            name="domain-assignment"
            class="pe:w-full pe:min-w-0"
            required
            :value="field.state.value"
            @change="field.handleChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>{{ text.chooseScope }}</option>
            <option v-for="peer in choices" :key="peer.id" :value="peer.id">
              {{ peer.title }} · {{ peer.displayId }}
            </option>
          </select>
        </label>
      </form.Field>
      <UButton
        type="submit"
        variant="soft"
        size="sm"
        class="pe:justify-self-start"
        :loading="pending"
        >{{ text.assign }}</UButton
      >
    </form>
    <ErrorNotice v-if="message" :message="message" />
  </section>
</template>
