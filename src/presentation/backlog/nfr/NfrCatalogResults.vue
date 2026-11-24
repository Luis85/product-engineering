<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { NfrRecord, NfrSnapshot } from "../../../application/backlog";
import type { ProjectMember } from "../../../application/projects";
import type { NfrId } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import NfrClassification from "./NfrClassification.vue";

const { members, snapshot } = defineProps<{
  readonly rows: readonly NfrRecord[];
  readonly members: readonly ProjectMember[];
  readonly snapshot: NfrSnapshot;
  readonly filtered: boolean;
}>();
const emit = defineEmits<{ reset: []; open: [NfrId, MouseEvent]; repair: [string] }>();
const texts = useMessages().backlog;
const text = texts.nfr;
const empty = computed(() => (snapshot.records.length ? text.noMatch : text.blank));

function owner(id?: string) {
  return id
    ? (members.find((member) => member.id === id)?.name ?? text.ownerMissing)
    : text.unassigned;
}
</script>

<template>
  <div v-if="snapshot.ready" class="pe-backlog-actions pe:justify-between">
    <p role="status">{{ text.count(rows.length, snapshot.records.length) }}</p>
    <UButton
      v-if="filtered"
      type="button"
      variant="ghost"
      color="neutral"
      :label="texts.reset"
      @click="emit('reset')"
    />
  </div>
  <p v-if="snapshot.failed" role="alert">{{ text.errors.index }}</p>
  <div v-else-if="rows.length" class="pe-nfr-register">
    <div class="pe-nfr-row pe-nfr-register-header" aria-hidden="true">
      <span>{{ text.requirement }}</span><span>{{ text.categories }}</span
      ><span>{{ text.owner }}</span>
    </div>
    <ul>
      <li v-for="record in rows" :key="record.id" class="pe-nfr-row">
        <div>
          <small class="pe-nfr-id">{{ record.id }}</small>
          <UButton
            type="button"
            variant="link"
            class="pe-nfr-link"
            data-testid="nfr-row-open"
            :data-pe-focus-key="'nfr-' + record.id"
            @click="emit('open', record.id, $event)"
          >
            {{ record.title }}
          </UButton>
          <p class="pe:text-muted">{{ record.requirement }}</p>
        </div>
        <NfrClassification :categories="record.categories" />
        <span>{{ owner(record.owner_id) }}</span>
      </li>
    </ul>
  </div>
  <p v-else-if="snapshot.ready" class="pe-nfr-empty">{{ empty }}</p>
  <section v-if="snapshot.invalid.length" class="pe:grid pe:gap-1" :aria-label="text.invalid">
    <h3>{{ text.invalid }}</h3>
    <ul>
      <li v-for="record in snapshot.invalid" :key="record.path" class="pe:wrap-anywhere">
        <UButton
          type="button"
          variant="link"
          class="pe-nfr-link"
          @click="emit('repair', record.path)"
        >
          {{ record.label }} · {{ text.openNote }}
        </UButton>
      </li>
    </ul>
  </section>
</template>
