<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { pbiCompanions } from "../../application/backlog";
import type { BacklogItem, PbiDetail } from "../../application/backlog";
import { KnowledgeMarkdown } from "../knowledge";
import { useMessages } from "../shell";
import type { PbiTab } from "./pbi-tabs";

const { detail, items } = defineProps<{
  readonly detail: PbiDetail;
  readonly items: readonly BacklogItem[];
}>();
const emit = defineEmits<{ tab: [PbiTab] }>();
const text = useMessages().backlog;
const companions = computed(() => pbiCompanions(items, detail.edit.item));
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-4">
    <article class="pe:min-w-0 pe:rounded-md pe:border pe:border-default pe:p-3">
      <KnowledgeMarkdown
        v-if="detail.edit.draft.body"
        :body="detail.edit.draft.body"
        :path="detail.edit.item.path"
      />
      <p v-else class="pe:text-muted">{{ text.noDescription }}</p>
    </article>
    <section class="pe:grid pe:min-w-0 pe:gap-1">
      <div class="pe-backlog-actions pe:justify-between">
        <h2 class="pe:font-semibold">{{ text.criteria.title }}</h2>
        <UButton
          type="button"
          variant="link"
          :label="text.pbiTabs.criteria"
          @click="emit('tab', 'criteria')"
        />
      </div>
      <ul v-if="detail.criteria?.length" class="pe:list-disc pe:ps-5 pe:wrap-anywhere">
        <li v-for="criterion in detail.criteria" :key="criterion.id">
          {{ criterion.text || criterion.id }}
        </li>
      </ul>
      <p v-else class="pe:text-muted">{{ text.criteria.empty }}</p>
    </section>
    <section class="pe-backlog-actions pe:justify-between">
      <p>{{ text.companions.count(companions.open, companions.total) }}</p>
      <UButton
        type="button"
        variant="link"
        :label="text.pbiTabs.companions"
        @click="emit('tab', 'companions')"
      />
    </section>
  </div>
</template>
