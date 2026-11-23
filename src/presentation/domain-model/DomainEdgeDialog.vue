<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { ref } from "vue";
import { newDomainEdgeId, saveDomainEdge } from "../../application/domain-model";
import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { cardinalities, isKnowledgeId } from "../../domain/knowledge";
import type { Cardinality } from "../../domain/knowledge";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useService,
} from "../shell";

const props = defineProps<{
  readonly projectId: ProjectId;
  readonly entities: readonly KnowledgeRecord[];
  readonly source?: string | undefined;
  readonly edge?: DomainEdge;
}>();
const { projectId, edge, source } = props;
const emit = defineEmits<{ dismiss: []; saved: [string] }>();
const catalog = useMessages();
const text = catalog["domain-model"];
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"));
const writer = useCommand(saveDomainEdge);
const id = edge?.id ?? useService(newDomainEdgeId);
useNavigationGuard(() => !writer.pending.value);

const fields = ["source", "target", "sourceCardinality", "targetCardinality"] as const;
const form = useForm({
  defaultValues: {
    source: edge?.source ?? source ?? "",
    target: edge?.target ?? "",
    verb: edge?.verb ?? "",
    rule: edge?.rule ?? "",
    sourceCardinality: String(edge?.sourceCardinality ?? "1"),
    targetCardinality: String(edge?.targetCardinality ?? "0..*"),
  },
  async onSubmit({ value }) {
    if (!isKnowledgeId(value.source) || !isKnowledgeId(value.target)) return;
    const result = await writer.run(
      projectId,
      {
        ...value,
        id,
        source: value.source,
        target: value.target,
        sourceCardinality: value.sourceCardinality as Cardinality,
        targetCardinality: value.targetCardinality as Cardinality,
      },
      edge,
    );
    if (result._tag !== "success") return;
    open.value = false;
    emit("saved", id);
  },
});
const entityFields = new Set<string>(["source", "target"]);
function dismiss() {
  if (!writer.pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="edge ? text.editEdge : text.createEdge"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!writer.pending.value"
    @update:open="dismiss"
  >
    <template #body>
      <form
        class="pe:grid pe:min-w-0 pe:gap-3"
        @submit.prevent="form.handleSubmit()"
        @keydown.esc.stop.prevent="dismiss"
      >
        <form.Field v-for="key in fields" :key="key" v-slot="{ field }" :name="key">
          <label class="pe:grid pe:min-w-0 pe:gap-1">
            {{ text[key] }}
            <select
              :name="key"
              class="pe:w-full pe:min-w-0"
              required
              :data-autofocus="key === 'source' ? '' : undefined"
              :value="field.state.value"
              @change="field.handleChange(($event.target as HTMLSelectElement).value)"
            >
              <template v-if="entityFields.has(key)">
                <option value="" disabled>{{ text.chooseEntity }}</option>
                <option v-for="entity in entities" :key="entity.id" :value="entity.id">
                  {{ entity.title }} · {{ entity.displayId }}
                </option>
              </template>
              <option v-for="card in cardinalities" v-else :key="card" :value="card">
                {{ card }} · {{ text.cardinalities[card] }}
              </option>
            </select>
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="verb">
          <label class="pe:grid pe:gap-1">
            {{ text.verb }}
            <input
              name="verb"
              required
              :value="field.state.value"
              @input="field.handleChange(($event.target as HTMLInputElement).value)"
            />
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="rule">
          <label class="pe:grid pe:gap-1">
            {{ text.rule }}
            <textarea
              name="rule"
              rows="3"
              :value="field.state.value"
              @input="field.handleChange(($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </form.Field>
        <ErrorNotice v-if="writer.message.value" :message="writer.message.value" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :disabled="writer.pending.value"
            @click="dismiss"
            >{{ catalog.knowledge.cancel }}</UButton
          >
          <UButton type="submit" :loading="writer.pending.value">{{ text.save }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
