<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import { computed, onScopeDispose, ref, useId, watch } from "vue";
import type { ItemRow } from "../../../application/items";
import { ITEM_STATUSES } from "../../../domain/items";
import { ConflictChoice } from "../../notes";
import { ErrorNotice, useMessages } from "../../shell";
import { useItemForm } from "../use-item-form";

const props = defineProps<{ record?: ItemRow; rows: readonly ItemRow[] }>();
const emit = defineEmits<{ saved: [id: string]; cancel: []; saving: [state: boolean] }>();
const text = useMessages().items;
const root = ref<HTMLFormElement | null>(null);
const statusId = useId();
const statusErrorId = statusId + "-error";
const {
  form,
  input,
  issue,
  summary,
  message,
  pending,
  blocked,
  conflicts,
  labels,
  submit,
  applyChoices,
} = useItemForm({
  ...(props.record ? { record: props.record } : {}),
  rows: () => props.rows,
  root: () => root.value,
  done: (id) => emit("saved", id),
});

watch(pending, (state) => emit("saving", state), { flush: "sync" });
onScopeDispose(() => emit("saving", false));

const savingButton = computed(() =>
  pending.value
    ? {
        leadingIcon: "i-lucide-loader-circle",
        ui: { leadingIcon: "pe:animate-spin pe:motion-reduce:animate-none" },
      }
    : {},
);
const invalidSummary = computed(
  () => summary.value && { severity: "warning" as const, ...summary.value },
);
const titleError = computed(() => issue("title") ?? false);
const statusError = computed(() => issue("status"));
const dueError = computed(() => issue("due") ?? false);
const statusDescription = computed(() => (statusError.value ? statusErrorId : undefined));

function fieldText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const statusText = computed(() => fieldText(input.value.status));
const invalidStatus = computed(
  () => statusText.value !== "" && !ITEM_STATUSES.some((code) => code === statusText.value),
);

function changeStatus(event: Event) {
  const select = event.currentTarget as HTMLSelectElement;
  form.setFieldValue("status", select.value);
}

function cancel() {
  if (!pending.value) emit("cancel");
}
</script>

<template>
  <form
    ref="root"
    data-testid="item-form"
    class="pe:grid pe:min-w-0 pe:gap-4"
    novalidate
    @submit.prevent="submit"
  >
    <ConflictChoice
      v-if="conflicts.length"
      :conflicts="conflicts"
      :labels="labels"
      @apply="applyChoices"
    />
    <template v-else>
      <ErrorNotice
        v-if="invalidSummary"
        data-testid="item-form-summary"
        :message="invalidSummary"
      />
      <ErrorNotice v-if="message" :message="message" />

      <UFormField name="title" :label="text.fields.title" :error="titleError" required>
        <form.Field v-slot="{ field }" name="title">
          <UInput
            :name="field.name"
            :model-value="fieldText(field.state.value)"
            aria-required="true"
            data-autofocus
            class="pe:w-full"
            @update:model-value="field.handleChange"
            @blur="field.handleBlur()"
          />
        </form.Field>
      </UFormField>

      <div class="pe:grid pe:gap-1">
        <label :for="statusId" class="pe:text-sm pe:font-medium">{{ text.fields.status }}</label>
        <select
          :id="statusId"
          name="status"
          :value="statusText"
          aria-required="true"
          :aria-invalid="Boolean(statusError)"
          :aria-describedby="statusDescription"
          class="pe:min-h-9 pe:w-full pe:min-w-0 pe:rounded-md pe:border pe:border-accented pe:bg-default pe:px-2.5 pe:py-1 pe:text-sm"
          @change="changeStatus"
        >
          <option value="" disabled>{{ text.missing.status }}</option>
          <option v-if="invalidStatus" :value="statusText" disabled>{{ statusText }}</option>
          <option v-for="code in ITEM_STATUSES" :key="code" :value="code">
            {{ text.status[code] }}
          </option>
        </select>
        <p v-if="statusError" :id="statusErrorId" class="pe:text-sm pe:text-error">
          {{ statusError }}
        </p>
      </div>

      <UFormField name="due" :label="text.fields.due" :error="dueError">
        <form.Field v-slot="{ field }" name="due">
          <UInput
            :name="field.name"
            :model-value="fieldText(field.state.value)"
            placeholder="YYYY-MM-DD"
            class="pe:w-full"
            @update:model-value="field.handleChange"
            @blur="field.handleBlur()"
          />
        </form.Field>
      </UFormField>
    </template>

    <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2 pe:border-t pe:border-default pe:pt-3">
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        :aria-disabled="pending"
        @click="cancel"
      >
        {{ text.actions.cancel }}
      </UButton>
      <UButton
        v-if="!conflicts.length"
        type="submit"
        :aria-disabled="blocked"
        v-bind="savingButton"
      >
        {{ text.actions.save }}
      </UButton>
    </div>
  </form>
</template>
