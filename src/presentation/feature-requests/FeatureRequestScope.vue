<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { nextTick, ref, useId } from "vue";
import { editRequestScope } from "../../application/feature-requests";
import type { FeatureRequest } from "../../application/feature-requests";
import {
  invalidRequestField,
  normalizeRequestScope,
  requestScopeLimit,
} from "../../domain/feature-requests";
import { ErrorNotice, useCommand, useMessages } from "../shell";

const { record } = defineProps<{ readonly record: FeatureRequest }>();
const text = useMessages()["feature-requests"];
const { pending, message, run } = useCommand(editRequestScope);
const editing = ref(false);
const area = ref<HTMLTextAreaElement>();
const panel = ref<HTMLElement>();
const invalid = ref(false);
const id = useId();
const form = useForm({
  defaultValues: { scope: record.scope },
  onSubmit: async ({ value }) => {
    invalid.value = invalidRequestField("scope", normalizeRequestScope(value.scope));
    if (invalid.value) return area.value?.focus();
    const result = await run(record, value.scope);
    if (result._tag === "success") await close();
  },
});

async function open() {
  form.reset({ scope: record.scope });
  invalid.value = false;
  editing.value = true;
  await nextTick();
  area.value?.focus();
}

async function close() {
  editing.value = false;
  await nextTick();
  panel.value?.querySelector<HTMLElement>("button")?.focus();
}
</script>

<template>
  <div ref="panel" class="pe:grid pe:justify-items-start pe:gap-2">
    <UButton
      v-if="!editing"
      type="button"
      variant="link"
      class="pe:p-0"
      :label="text.editScope"
      data-testid="request-edit-scope"
      @click="open"
    />
    <form
      v-else
      class="pe:grid pe:w-full pe:gap-2"
      data-testid="request-scope-form"
      @submit.prevent="form.handleSubmit"
      @keydown.esc.prevent="close"
    >
      <form.Field name="scope">
        <template #default="{ field }">
          <label :for="id" class="pe:font-semibold">{{ text.scope }}</label>
          <textarea
            :id="id"
            ref="area"
            name="scope"
            rows="4"
            :maxlength="requestScopeLimit"
            :aria-invalid="invalid"
            :aria-describedby="invalid ? id + '-error' : undefined"
            :value="field.state.value"
            @input="field.handleChange(($event.target as HTMLTextAreaElement).value)"
          />
        </template>
      </form.Field>
      <p v-if="invalid" :id="id + '-error'" role="alert">{{ text.errors.scope }}</p>
      <ErrorNotice v-if="message" :message="message" />
      <div class="pe:flex pe:flex-wrap pe:gap-2">
        <UButton
          type="submit"
          :label="text.saveScope"
          :loading="pending"
          data-testid="request-save-scope"
        />
        <UButton type="button" variant="ghost" :label="text.cancel" @click="close" />
      </div>
    </form>
  </div>
</template>
