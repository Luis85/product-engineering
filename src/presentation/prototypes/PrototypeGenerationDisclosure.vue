<script setup lang="ts">
import type {
  PrototypeGenerationDisclosure,
  PrototypeRecord,
  PrototypeSourceOption,
} from "../../application/prototypes";
import { useMessages } from "../shell";

defineProps<{
  readonly target: Pick<PrototypeRecord, "displayId" | "title">;
  readonly scope: Pick<PrototypeSourceOption, "displayId" | "title">;
  readonly request: PrototypeGenerationDisclosure;
  readonly replacing: boolean;
}>();

const prototype = useMessages().prototypes;
const text = prototype.generation;
</script>

<template>
  <dl class="pe-prototype-brief pe:my-0" data-testid="prototype-generation-target">
    <div>
      <dt>{{ prototype.prototype }}</dt>
      <dd>{{ target.displayId }} · {{ target.title }}</dd>
    </div>
    <div>
      <dt>{{ prototype.scope }}</dt>
      <dd>{{ scope.displayId }} · {{ scope.title }}</dd>
    </div>
    <div>
      <dt>{{ text.destination }}</dt>
      <dd>{{ request.destination.label }}</dd>
    </div>
  </dl>
  <p class="pe:text-sm pe:text-muted">
    {{ request.destination.kind === "provider" ? text.aboutProvider : text.aboutDemo }}
  </p>
  <details class="pe:min-w-0" data-testid="prototype-generation-request">
    <summary>{{ text.sentBrief }}</summary>
    <div class="pe:mt-2 pe:grid pe:min-w-0 pe:gap-2">
      <div>
        <p class="pe:text-sm pe:font-semibold">{{ text.instructionLabel }}</p>
        <pre class="pe-prototype-generation-payload">{{ request.instruction }}</pre>
      </div>
      <div>
        <p class="pe:text-sm pe:font-semibold">{{ prototype.brief.title }}</p>
        <pre class="pe-prototype-generation-payload" data-testid="prototype-generation-brief">{{
          request.markdown
        }}</pre>
      </div>
    </div>
  </details>
  <p class="pe:text-sm pe:text-muted">{{ text.noFiles }}</p>
  <p v-if="replacing">{{ text.replace }}</p>
</template>
