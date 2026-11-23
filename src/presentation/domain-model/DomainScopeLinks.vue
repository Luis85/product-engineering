<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { computed } from "vue";
import { entityAssigned, setEntityScope } from "../../application/domain-model";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { EntityScopeTarget } from "../../domain/knowledge";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useNavigate,
  useNavigationGuard,
  useStream,
} from "../shell";

const { note, fromModel = false } = defineProps<{
  readonly note: KnowledgeRecord;
  readonly fromModel?: boolean;
}>();
const text = useMessages()["domain-model"];
const index = useStream(knowledgeSnapshot, knowledgeChanges);
const project = computed(() => projectKnowledge(note.projectId, index.value.records));
const current = computed(() => project.value.find(({ id }) => id === note.id) ?? note);
const isEntity = computed(() => note.kind === "entity");
const heading = computed(() => (isEntity.value ? text.productScope : text.assignedEntities));
const chooser = computed(() => (isEntity.value ? text.assignPrd : text.assignEntity));
const prd = computed(() => ({ kind: "prd", id: note.id }) as const);
type Link = {
  readonly entity: KnowledgeRecord;
  readonly target: EntityScopeTarget;
  readonly peer?: KnowledgeRecord;
};

const related = computed<readonly Link[]>(() => {
  if (isEntity.value)
    return (current.value.values.domain_scope ?? []).map((target) => {
      const peer = project.value.find(({ id, kind }) => kind === target.kind && id === target.id);
      return { target, entity: current.value, ...(peer && { peer }) };
    });
  return project.value
    .filter((record) => record.kind === "entity" && entityAssigned(record, prd.value))
    .map((peer) => ({ peer, entity: peer, target: prd.value }));
});
const choices = computed(() => {
  if (isEntity.value) {
    if (current.value.values.domain_archived) return [];
    return project.value.filter(
      (record) =>
        record.kind === "prd" && !entityAssigned(current.value, { kind: "prd", id: record.id }),
    );
  }
  return project.value.filter(
    (record) =>
      record.kind === "entity" &&
      !record.values.domain_archived &&
      !entityAssigned(record, prd.value),
  );
});
const navigate = useNavigate();
const { pending, message, run: write } = useCommand(setEntityScope);
useNavigationGuard(() => !pending.value);

function peerLabel(peer: KnowledgeRecord) {
  const archived = peer.values.domain_archived ? " · " + text.archived : "";
  return `${peer.title} · ${peer.displayId}${archived}`;
}

function linkKey(link: Link) {
  return link.target.kind + ":" + (link.peer?.id ?? link.target.id);
}

function open(peer: KnowledgeRecord) {
  return navigate(
    knowledgeDetailRoute(note.projectId, peer.id, {
      section: fromModel ? "domainmodel" : "knowledge-note",
      reference: { kind: fromModel ? "entity" : "knowledge", recordId: note.id },
    }),
  );
}

const form = useForm({
  defaultValues: { peer: "" },
  async onSubmit({ value }) {
    const peer = choices.value.find(({ id }) => id === value.peer);
    if (!peer) return;
    const entity = isEntity.value ? note : peer;
    const target = isEntity.value ? ({ kind: "prd", id: peer.id } as const) : prd.value;
    const result = await write(note.projectId, entity.id, target, true);
    if (result._tag === "success") form.reset();
  },
});

function remove(link: Link) {
  return write(note.projectId, link.entity.id, link.target, false);
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
          @click="open(link.peer)"
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
