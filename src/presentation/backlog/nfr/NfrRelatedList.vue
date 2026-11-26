<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nfrTargetKey } from "../../../application/backlog";
import type { NfrOrigin, NfrRecord, ScopedNfr } from "../../../application/backlog";
import type { NfrId } from "../../../domain/backlog";
import { useMessages } from "../../shell";

defineProps<{
  readonly direct: readonly NfrRecord[];
  readonly inherited: readonly ScopedNfr[];
}>();
const emit = defineEmits<{ open: [NfrId, MouseEvent]; origin: [NfrOrigin, MouseEvent] }>();
const text = useMessages().backlog.nfr;
</script>

<template>
  <ul v-if="direct.length || inherited.length" class="pe:grid pe:min-w-0 pe:gap-2">
    <li v-for="record in direct" :key="record.id">
      <UButton
        type="button"
        variant="link"
        class="pe-nfr-link"
        :data-nfr-open-record="record.id"
        :data-pe-focus-key="'nfr-source-' + record.id"
        @click="emit('open', record.id, $event)"
        >{{ record.title }}</UButton
      >
      <p>{{ record.acceptance }}</p>
    </li>
    <li v-for="record in inherited" :key="record.id">
      <strong>{{ record.title }}</strong>
      <p>{{ record.acceptance }}</p>
      <div class="pe:wrap-anywhere">
        <small>{{ text.inherited }}</small>
        <UButton
          v-for="origin in record.sources"
          :key="nfrTargetKey(origin)"
          type="button"
          variant="link"
          class="pe-nfr-link"
          :data-pe-focus-key="'nfr-origin-' + record.id + '-' + nfrTargetKey(origin)"
          @click="emit('origin', origin, $event)"
          >{{ origin.title }}</UButton
        >
      </div>
    </li>
  </ul>
  <p v-else>{{ text.noAssignments }}</p>
</template>
