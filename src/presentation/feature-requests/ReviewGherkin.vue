<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { ref } from "vue";
import { leafModalUi } from "../projects";
import { useMessages, useModal } from "../shell";

const { gherkin, revision } = defineProps<{
  readonly gherkin: string;
  readonly revision: string;
}>();
const text = useMessages()["feature-requests"].review;
const open = ref(false);
let trigger: HTMLElement | undefined;
const close = () => {
  open.value = false;
};
const modal = useModal(open, () => trigger?.focus({ preventScroll: true }), close);
function show(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  open.value = true;
}
</script>

<template>
  <UButton
    type="button"
    variant="outline"
    color="neutral"
    size="sm"
    :label="text.openGherkin"
    data-testid="review-gherkin"
    @click="show"
  />
  <UModal
    v-model:open="open"
    :title="text.gherkinTitle"
    :description="revision"
    :content="modal"
    :ui="leafModalUi"
  >
    <template #body>
      <pre class="pe-request-markdown">{{ gherkin }}</pre>
      <UButton
        type="button"
        variant="outline"
        color="neutral"
        data-autofocus
        :label="text.close"
        @click="close"
      />
    </template>
  </UModal>
</template>
