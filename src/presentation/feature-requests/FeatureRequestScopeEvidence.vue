<script setup lang="ts">
import { computed } from "vue";
import type { RequestPackage } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { nfrs, domain } = defineProps<{
  readonly nfrs: RequestPackage["nfrs"];
  readonly domain: RequestPackage["domain"];
}>();
const text = useMessages()["feature-requests"];
const empty = (size: number | undefined) =>
  size === undefined ? text.unknown : size === 0 ? text.emptyScope : undefined;
const nfrStatus = computed(() => empty(nfrs?.length));
const domainStatus = computed(() => empty(domain?.entities.length));
const entities = computed(() => domain?.entities ?? []);
const edges = computed(() => domain?.edges ?? []);
const origin = ({
  displayId,
  id,
  title,
}: {
  readonly displayId?: string;
  readonly id: string;
  readonly title: string;
}) => `${displayId ?? id} · ${title}`;
</script>

<template>
  <section class="pe-request-panel" data-testid="request-nfrs">
    <h2>{{ text.nonFunctional }}</h2>
    <p v-if="nfrStatus">{{ nfrStatus }}</p>
    <details v-for="nfr in nfrs" :key="nfr.id" class="pe-request-disclosure">
      <summary>{{ nfr.title }}</summary>
      <p class="pe:whitespace-pre-wrap">{{ nfr.requirement }}</p>
      <p class="pe:whitespace-pre-wrap">{{ nfr.acceptance }}</p>
      <ul>
        <li v-for="source in nfr.sources" :key="source.kind + ':' + source.id">
          {{ origin(source) }}
        </li>
      </ul>
    </details>
  </section>
  <section class="pe-request-panel" data-testid="request-domain">
    <h2>{{ text.domain }}</h2>
    <p v-if="domainStatus">{{ domainStatus }}</p>
    <details v-for="entity in entities" :key="entity.id" class="pe-request-disclosure">
      <summary>{{ entity.displayId }} · {{ entity.title }}</summary>
      <pre class="pe-request-markdown">{{ entity.definition }}</pre>
      <ul>
        <li v-for="attribute in entity.attributes" :key="attribute.name">
          {{ attribute.name }} · {{ attribute.description }}
        </li>
      </ul>
      <ul>
        <li v-for="source in entity.origins" :key="source.kind + ':' + source.id">
          {{ origin(source) }}
        </li>
      </ul>
    </details>
    <details v-for="edge in edges" :key="edge.id" class="pe-request-disclosure">
      <summary>
        {{ edge.sourceEntity.title }} · {{ edge.verb }} → {{ edge.targetEntity.title }}
      </summary>
      <p>{{ edge.sourceCardinality }} → {{ edge.targetCardinality }} · {{ edge.rule }}</p>
    </details>
  </section>
</template>
