<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nextTick, ref } from "vue";
import { backlogCreatePbiRoute } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { activeFeatureRequest, featureRequestsRoute } from "../../application/feature-requests";
import type { FeatureRequestOrigin } from "../../application/feature-requests";
import type { ProjectId } from "../../application/projects";
import type { DeliveryStage, FeatureRequestId } from "../../domain/feature-requests";
import { useRememberWorkspaceOrigin } from "../projects";
import { ErrorNotice, useMessages, useNavigate, useQuery } from "../shell";
import FeatureRequestForm from "./FeatureRequestForm.vue";

const {
  project,
  source = undefined,
  stage = undefined,
  from = undefined,
  initialBacklog = undefined,
  focusKey = "request-create",
} = defineProps<{
  readonly project: ProjectId;
  readonly source?: { readonly id: string; readonly title: string } | undefined;
  readonly stage?: DeliveryStage | undefined;
  readonly from?: (() => FeatureRequestOrigin) | undefined;
  readonly initialBacklog?: BacklogSnapshot | undefined;
  readonly focusKey?: string;
}>();
const text = useMessages()["feature-requests"];
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const active = useQuery(activeFeatureRequest);
const open = ref(false);
let trigger: HTMLElement | undefined;
let origin: FeatureRequestOrigin | undefined;

async function start(event: MouseEvent) {
  if (open.value || active.pending.value) return;
  trigger = event.currentTarget as HTMLElement;
  origin = from?.();
  if (source) {
    const result = await active.run(project, source.id);
    if (result._tag !== "success") return;
    if (result.value) return show(result.value);
  }
  open.value = true;
}

async function show(id: FeatureRequestId) {
  remember(trigger);
  if (
    !(await navigate(
      featureRequestsRoute(project, {
        requestId: id,
        ...(stage && { stage }),
        ...(origin && { origin }),
      }),
    ))
  )
    remember(undefined);
}

async function dismiss(id?: FeatureRequestId) {
  open.value = false;
  await nextTick();
  if (id) await show(id);
  else trigger?.focus({ preventScroll: true });
}

async function createPbi() {
  open.value = false;
  remember(trigger);
  if (!(await navigate(backlogCreatePbiRoute(project)))) {
    remember(undefined);
    trigger?.focus({ preventScroll: true });
  }
}
</script>

<template>
  <UButton
    type="button"
    size="sm"
    :color="source ? 'neutral' : 'primary'"
    :variant="source ? 'link' : 'solid'"
    :class="{ 'pe:p-0 pe:text-start pe:wrap-anywhere': source }"
    :label="text.create"
    :data-pe-focus-key="focusKey"
    :loading="active.pending.value"
    data-testid="request-create"
    @click="start"
  />
  <ErrorNotice v-if="active.message.value" :message="active.message.value" />
  <FeatureRequestForm
    v-if="open"
    :project="project"
    :source="source"
    :initial-backlog="initialBacklog"
    @dismiss="dismiss"
    @create-pbi="createPbi"
  />
</template>
