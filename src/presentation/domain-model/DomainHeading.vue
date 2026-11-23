<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useMessages } from "../shell";

defineProps<{ readonly canCreate: boolean; readonly canRelate: boolean }>();
const emit = defineEmits<{ create: [Event]; relate: [Event] }>();
const text = useMessages()["domain-model"];
</script>

<template>
  <header class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-start pe:justify-between pe:gap-3">
    <div class="pe:grid pe:min-w-0 pe:gap-1">
      <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ text.title }}</h1>
      <p class="pe:text-muted">{{ text.summary }}</p>
    </div>
    <div v-if="canCreate" class="pe:flex pe:flex-wrap pe:gap-2">
      <UButton
        v-if="canRelate"
        type="button"
        variant="soft"
        color="neutral"
        data-testid="domain-create-edge"
        @click="emit('relate', $event)"
        >{{ text.createEdge }}</UButton
      >
      <UButton type="button" data-testid="domain-create-entity" @click="emit('create', $event)">{{
        text.createEntity
      }}</UButton>
    </div>
  </header>
</template>
