<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { ref, useId } from "vue";
import { replyToFactory } from "../../application/feature-requests";
import type { FactoryCallback, FeatureRequest } from "../../application/feature-requests";
import {
  invalidRequestField,
  normalizeRequestScope,
  requestScopeLimit,
} from "../../domain/feature-requests";
import { ErrorNotice, useCommand, useMessages } from "../shell";

const { record, question } = defineProps<{
  readonly record: FeatureRequest;
  readonly question: Extract<FactoryCallback, { readonly kind: "question" }>;
}>();
const text = useMessages()["feature-requests"];
const { pending, message, run } = useCommand(replyToFactory);
const id = useId();
const invalid = ref(false);
const changesScope = ref(false);
const area = ref<HTMLTextAreaElement>();
const form = useForm({
  defaultValues: { response: "" },
  onSubmit: async ({ value }) => {
    invalid.value = invalidRequestField("scope", normalizeRequestScope(value.response));
    if (invalid.value) return area.value?.focus();
    await run(record, question.id, value.response, changesScope.value);
  },
});

async function revise() {
  if (changesScope.value) return form.handleSubmit();
  changesScope.value = true;
  area.value?.focus();
}
</script>

<template>
  <form
    class="pe:grid pe:min-w-0 pe:gap-2"
    data-testid="request-clarification"
    @submit.prevent="form.handleSubmit"
  >
    <p>
      {{ question.question === "scope-confirmation" ? text.factory.prompt : question.question }}
    </p>
    <blockquote class="pe:whitespace-pre-wrap">{{ question.scope }}</blockquote>
    <form.Field name="response">
      <template #default="{ field }">
        <label :for="id">{{
          changesScope ? text.factory.revisedScope : text.factory.response
        }}</label>
        <textarea
          :id="id"
          ref="area"
          name="response"
          rows="4"
          :maxlength="requestScopeLimit"
          :aria-invalid="invalid"
          :value="field.state.value"
          @input="field.handleChange(($event.target as HTMLTextAreaElement).value)"
        />
      </template>
    </form.Field>
    <p v-if="invalid" role="alert">{{ text.errors.scope }}</p>
    <ErrorNotice v-if="message" :message="message" />
    <div class="pe:flex pe:flex-wrap pe:gap-2">
      <UButton
        v-if="!changesScope"
        type="submit"
        :label="text.factory.respond"
        :loading="pending"
        data-testid="request-answer"
      />
      <UButton
        type="button"
        :variant="changesScope ? 'solid' : 'soft'"
        :label="text.factory.revise"
        :loading="pending"
        data-testid="request-scope-change"
        @click="revise"
      />
      <UButton
        v-if="changesScope"
        type="button"
        variant="ghost"
        :label="text.cancel"
        @click="changesScope = false"
      />
    </div>
  </form>
</template>
