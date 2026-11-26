<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import type { KnowledgeRecord } from "../../application/knowledge";
import { saveStoryMapFoundations } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { KnowledgeId } from "../../domain/knowledge";
import { KnowledgeReferences } from "../knowledge";
import { leafModalUi } from "../projects";
import { ErrorNotice, useCommand, useMessages, useModal, useNavigationGuard } from "../shell";

const { map, records } = defineProps<{
  readonly map: StoryMapRecord;
  readonly records: readonly KnowledgeRecord[];
}>();
const emit = defineEmits<{ dismiss: [] }>();
const text = useMessages()["story-maps"];
const base = map;
const open = ref(true);
const { pending, message, run: save } = useCommand(saveStoryMapFoundations);
const modal = useModal(open, () => emit("dismiss"), close);
useNavigationGuard(() => !pending.value);

const prds = computed(() => records.filter(({ kind }) => kind === "prd"));
const jobs = computed(() => records.filter(({ kind }) => kind === "jtbd"));
const form = useForm({
  defaultValues: { prd: base.prdId ?? "", jobs: [...base.jobIds], references: base.references },
  async onSubmit({ value }) {
    const result = await save(base, {
      prdId: value.prd ? (value.prd as KnowledgeId) : undefined,
      jobIds: value.jobs,
      references: value.references,
    });
    if (result._tag === "success") close();
  },
});
const selected = form.useStore(({ values }) => values.jobs);
const missingJobs = computed(() =>
  selected.value.filter((id) => !jobs.value.some((job) => job.id === id)),
);
const currentPrd = form.useStore(({ values }) => values.prd);
const missingPrd = computed(
  () => currentPrd.value && !prds.value.some(({ id }) => id === currentPrd.value),
);
const references = form.useStore(({ values }) => values.references);

function selectJob(id: KnowledgeId, event: Event) {
  form.setFieldValue(
    "jobs",
    (event.currentTarget as HTMLInputElement).checked
      ? [...selected.value, id]
      : selected.value.filter((existing) => existing !== id),
  );
}

function close() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.foundation.edit"
    :description="map.title"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form
        class="pe:grid pe:min-w-0 pe:gap-3"
        data-testid="story-map-foundation-form"
        @submit.prevent="form.handleSubmit()"
      >
        <form.Field v-slot="{ field }" name="prd">
          <label class="pe:grid pe:min-w-0 pe:gap-1">
            {{ text.foundation.prd }}
            <select
              name="prdId"
              class="pe:w-full pe:min-w-0"
              :value="field.state.value"
              :disabled="pending"
              data-autofocus
              @change="field.handleChange(($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ text.foundation.unassigned }}</option>
              <option v-if="missingPrd" :value="currentPrd">
                {{ currentPrd }} · {{ text.errors.target }}
              </option>
              <option v-for="prd in prds" :key="prd.id" :value="prd.id">
                {{ prd.displayId }} · {{ prd.title }}
              </option>
            </select>
          </label>
        </form.Field>
        <fieldset class="pe:grid pe:min-w-0 pe:gap-2" :disabled="pending">
          <legend>{{ text.foundation.jobs }}</legend>
          <label
            v-for="job in jobs"
            :key="job.id"
            class="pe:flex pe:items-start pe:gap-2 pe:wrap-anywhere"
          >
            <input
              type="checkbox"
              name="jobIds"
              :value="job.id"
              :checked="selected.includes(job.id)"
              @change="selectJob(job.id, $event)"
            />
            <span>{{ job.displayId }} · {{ job.title }}</span>
          </label>
          <label
            v-for="id in missingJobs"
            :key="id"
            class="pe:flex pe:items-start pe:gap-2 pe:wrap-anywhere"
          >
            <input
              type="checkbox"
              name="jobIds"
              :value="id"
              checked
              @change="selectJob(id, $event)"
            />
            <span>{{ id }} · {{ text.errors.target }}</span>
          </label>
          <p v-if="!jobs.length && !missingJobs.length">{{ text.foundation.noJobs }}</p>
        </fieldset>
        <KnowledgeReferences
          :source="map.path"
          :references="references"
          :editable="!pending"
          explicit-only
          @change="form.setFieldValue('references', $event)"
        />
        <ErrorNotice v-if="message" :message="message" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :disabled="pending"
            :label="text.cancel"
            data-testid="story-map-foundation-cancel"
            @click="close"
          />
          <UButton
            type="submit"
            :loading="pending"
            :label="text.foundation.save"
            data-testid="story-map-foundation-save"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
