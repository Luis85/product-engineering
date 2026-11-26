<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import { createKnowledge, newKnowledgeId, saveKnowledgeNote } from "../../application/knowledge";
import type { KnowledgeNote } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import type { EntityAttribute, KnowledgeId } from "../../domain/knowledge";
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
  readonly base?: KnowledgeNote;
}>();
const { projectId, base } = props;
const emit = defineEmits<{ dismiss: []; saved: [KnowledgeId] }>();
const catalog = useMessages();
const text = catalog["domain-model"];
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"));
const id = base?.id ?? useService(newKnowledgeId);
const create = useCommand(createKnowledge);
const save = useCommand(saveKnowledgeNote);
const pending = computed(() => create.pending.value || save.pending.value);
const error = computed(() => create.message.value ?? save.message.value);
useNavigationGuard(() => !pending.value);
const attributes: readonly EntityAttribute[] = base?.values.domain_attributes ?? [];
const form = useForm({
  defaultValues: { title: base?.title ?? "", definition: base?.body ?? "", attributes },
  async onSubmit({ value }) {
    const result = base
      ? await save.run(base, value.definition, {
          title: value.title,
          domain_attributes: value.attributes,
        })
      : await create.run(
          { projectId, id },
          {
            kind: "entity",
            title: value.title,
            owner_id: "",
            actor_type: "",
            vision_id: "",
            job_ids: [],
            entity: { definition: value.definition, attributes: value.attributes },
          },
        );
    if (result._tag !== "success") return;
    open.value = false;
    emit("saved", id);
  },
});
const rows = form.useStore((state) => state.values.attributes);

function editAttribute(index: number, property: keyof EntityAttribute, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  form.setFieldValue("attributes", (before) =>
    before.map((row, at) => (at === index ? { ...row, [property]: value } : row)),
  );
}

function dismiss() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="base ? text.editEntity : text.createEntity"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    @update:open="dismiss"
  >
    <template #body>
      <form
        class="pe:grid pe:min-w-0 pe:gap-4"
        @submit.prevent="form.handleSubmit()"
        @keydown.esc.stop.prevent="dismiss"
      >
        <form.Field v-slot="{ field }" name="title">
          <label class="pe:grid pe:gap-1">
            {{ text.name }}
            <input
              name="title"
              data-autofocus
              required
              :value="field.state.value"
              @input="field.handleChange(($event.target as HTMLInputElement).value)"
            />
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="definition">
          <label class="pe:grid pe:gap-1">
            {{ text.definition }}
            <textarea
              name="definition"
              rows="5"
              :value="field.state.value"
              @input="field.handleChange(($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </form.Field>
        <fieldset class="pe:grid pe:min-w-0 pe:gap-3">
          <legend class="pe:font-medium">{{ text.attributes }}</legend>
          <div v-for="(attribute, index) in rows" :key="index" class="pe:grid pe:min-w-0 pe:gap-2">
            <label class="pe:grid pe:gap-1">
              {{ text.attributeName }}
              <input
                name="attribute-name"
                :value="attribute.name"
                @input="editAttribute(index, 'name', $event)"
              />
            </label>
            <label class="pe:grid pe:gap-1">
              {{ text.attributeDescription }}
              <input
                name="attribute-description"
                :value="attribute.description"
                @input="editAttribute(index, 'description', $event)"
              />
            </label>
            <UButton
              type="button"
              variant="ghost"
              color="neutral"
              class="pe:justify-self-start"
              @click="
                form.setFieldValue('attributes', (before) => before.filter((_, at) => at !== index))
              "
            >
              {{ text.removeAttribute }}
            </UButton>
          </div>
          <UButton
            type="button"
            variant="soft"
            data-testid="domain-add-attribute"
            class="pe:justify-self-start"
            @click="
              form.setFieldValue('attributes', (before) => [
                ...before,
                { name: '', description: '' },
              ])
            "
          >
            {{ text.addAttribute }}
          </UButton>
        </fieldset>
        <ErrorNotice v-if="error" :message="error" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :disabled="pending"
            @click="dismiss"
            >{{ catalog.knowledge.cancel }}</UButton
          >
          <UButton type="submit" :loading="pending">{{ text.save }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
