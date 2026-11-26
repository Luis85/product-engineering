<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useId } from "vue";
import { companionKinds } from "../../application/backlog";
import type { CompanionKind } from "../../application/backlog";
import { leafModalUi } from "../projects";
import { useMessages } from "../shell";
import type { useModal } from "../shell";

const { context, content } = defineProps<{
  readonly context: string;
  readonly content: ReturnType<typeof useModal>;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ select: [CompanionKind] }>();
const text = useMessages().backlog.companions;
const chooserId = useId();
const icons = {
  TASK: "i-lucide-check",
  ISS: "i-lucide-info",
  Q: "i-lucide-circle-help",
  BUG: "i-lucide-flag",
} satisfies Record<CompanionKind, string>;
</script>

<template>
  <UModal
    v-model:open="open"
    :title="text.add"
    :description="context"
    :content="content"
    :ui="{ ...leafModalUi, description: 'pe:wrap-anywhere' }"
  >
    <template #body>
      <div class="pe:grid pe:grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] pe:gap-2">
        <UButton
          v-for="kind in companionKinds"
          :key="kind"
          type="button"
          variant="soft"
          class="pe-pbi-companion-choice pe:flex pe:min-w-0 pe:items-start pe:text-start pe:whitespace-normal"
          :aria-labelledby="chooserId + '-label-' + kind"
          :aria-describedby="chooserId + '-purpose-' + kind"
          :data-testid="'pbi-companion-' + kind"
          :data-autofocus="kind === 'TASK' || undefined"
          @click="emit('select', kind)"
        >
          <UIcon :name="icons[kind]" aria-hidden="true" class="pe:size-5 pe:shrink-0" />
          <span class="pe:grid pe:min-w-0 pe:gap-0.5 pe:wrap-anywhere">
            <strong :id="chooserId + '-label-' + kind">{{ text.labels[kind] }}</strong>
            <span :id="chooserId + '-purpose-' + kind" class="pe:text-xs">{{
              text.purpose[kind]
            }}</span>
          </span>
        </UButton>
      </div>
    </template>
  </UModal>
</template>
