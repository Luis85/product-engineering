<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { BacklogSnapshot } from "../../application/backlog";
import { useMessages } from "../shell";

const { snapshot } = defineProps<{ readonly snapshot: BacklogSnapshot }>();
const emit = defineEmits<{ configure: [] }>();
const text = useMessages().backlog;
</script>

<template>
  <template v-if="snapshot.issue">
    <p role="alert">{{ text.errors[snapshot.issue] }}</p>
    <UButton
      v-if="snapshot.issue === 'base'"
      type="button"
      variant="soft"
      class="pe:justify-self-start"
      :label="text.registerBase"
      @click="emit('configure')"
    />
  </template>
  <p v-else-if="!snapshot.ready" role="status">{{ text.waiting }}</p>
  <template v-else>
    <p
      v-if="snapshot.duplicates.length"
      role="alert"
      class="pe:wrap-anywhere pe:text-error"
      data-testid="backlog-duplicates"
    >
      {{ text.errors.duplicate }} {{ snapshot.duplicates.join(", ") }}
    </p>
    <slot />
  </template>
</template>
