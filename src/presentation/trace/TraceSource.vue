<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed } from "vue";
import { storyMapsRoute } from "../../application/story-maps";
import type { TraceSources } from "../../application/trace";
import type { Route } from "../../application/routes";
import { useMessages } from "../shell";
import TraceLink from "./TraceLink.vue";

const { source } = defineProps<{ readonly source: TraceSources }>();
const text = useMessages().trace;
type NoteRow = {
  readonly key: string;
  readonly icon: string;
  readonly label: string;
  readonly title: string;
  readonly route?: Route | undefined;
  readonly commit?: string | undefined;
};

function noteRow(
  key: "research" | "job" | "vision" | "requirement",
  icon: string,
  proof: TraceSources["research"],
  identity = proof?.record.displayId,
): NoteRow {
  return {
    key,
    icon,
    label: text[key],
    title: proof ? `${identity} · ${proof.record.title}` : text.gaps[key],
    route: proof?.route,
    commit: proof?.commit,
  };
}

const notes = computed(() => [
  noteRow("research", "i-lucide-search", source.research),
  noteRow("job", "i-lucide-flag", source.job),
  noteRow("vision", "i-lucide-eye", source.vision),
  noteRow(
    "requirement",
    "i-lucide-book-open",
    source.requirement,
    source.requirement && `${source.requirement.record.displayId}#${source.requirement.id}`,
  ),
]);
</script>

<template>
  <section class="pe-trace-chain" :aria-label="text.source" data-testid="trace-source">
    <h3>{{ text.source }}</h3>
    <ol>
      <li v-for="row in notes" :key="row.key">
        <UIcon :name="row.icon" class="pe-trace-mark" aria-hidden="true" />
        <div>
          <p class="pe-trace-label">{{ row.label }}</p>
          <TraceLink
            v-if="row.route"
            :destination="row.route"
            :data-pe-focus-key="'trace-source-' + row.key"
            :data-testid="'trace-source-' + row.key"
          >
            {{ row.title }}
          </TraceLink>
          <p v-else>{{ row.title }}</p>
          <p v-if="row.commit" class="pe-trace-label" data-testid="trace-source-commit">
            {{ text.sourceCommit }} <code>{{ row.commit }}</code>
          </p>
        </div>
      </li>
      <li v-for="{ map, card, slice } in source.maps" :key="map.id + '/' + card.id">
        <UIcon name="i-lucide-map" class="pe-trace-mark" aria-hidden="true" />
        <div>
          <p class="pe-trace-label">
            {{ map.title }} · {{ slice ? `${slice.id} · ${slice.title}` : text.unsliced }}
          </p>
          <TraceLink
            :destination="storyMapsRoute(map.projectId, map.id, card.id)"
            :data-pe-focus-key="'trace-card-' + map.id + '-' + card.id"
            :data-trace-card="card.id"
            >{{ map.displayId }}:{{ card.id }} · {{ card.title }}</TraceLink
          >
        </div>
      </li>
      <li v-if="!source.maps.length">
        <UIcon name="i-lucide-map" class="pe-trace-mark" aria-hidden="true" />
        <div>
          <p class="pe-trace-label">{{ text.map }}</p>
          <p>{{ text.gaps.map }}</p>
        </div>
      </li>
      <li>
        <UIcon name="i-lucide-list-tree" class="pe-trace-mark" aria-hidden="true" />
        <div>
          <p class="pe-trace-label">
            {{ source.item.id ? `${source.item.id} · ${text.pbi}` : text.pbi }}
          </p>
          <TraceLink :destination="source.pbiRoute" data-pe-focus-key="trace-source-pbi">
            {{ source.item.title }}
          </TraceLink>
        </div>
      </li>
    </ol>
  </section>
</template>
