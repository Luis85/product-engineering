<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { prototypeSourceRoute } from "../../application/prototypes";
import type { PrototypeRecord, PrototypeSourceOption } from "../../application/prototypes";
import { useRememberWorkspaceOrigin } from "../projects";
import { useHistory, useMessages, useNavigate, useRouting } from "../shell";

const { record, scope = undefined } = defineProps<{
  readonly record: PrototypeRecord;
  readonly scope?: PrototypeSourceOption | undefined;
}>();
const text = useMessages().prototypes;
const navigate = useNavigate();
const { definition, history } = useRouting();
const { back } = useHistory();
const remember = useRememberWorkspaceOrigin();

async function open(event: MouseEvent) {
  if (!scope) return;
  const route = prototypeSourceRoute(scope);
  const previous = history.value.back.at(-1);
  remember(event.currentTarget as HTMLElement);
  const success =
    previous && definition.equals(previous, route) ? await back() : await navigate(route);
  if (!success) remember(undefined);
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-0.5 pe:wrap-anywhere" data-testid="prototype-scope">
    <template v-if="scope">
      <UButton
        type="button"
        variant="link"
        class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
        :data-pe-focus-key="'prototype-scope-' + record.id"
        @click="open"
        >{{ scope.title }}</UButton
      >
      <span class="pe:text-xs pe:text-muted"
        >{{ scope.displayId }} · {{ text.sourceKinds[scope.source.kind] }}</span
      >
    </template>
    <p v-else class="pe:text-muted">
      {{ [record.sourceId, text.missingSource].filter(Boolean).join(" · ") }}
    </p>
  </div>
</template>
