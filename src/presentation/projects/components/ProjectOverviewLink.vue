<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { Route } from "../../../application/routes";
import { useNavigate } from "../../shell";
import { useRememberWorkspaceOrigin } from "../workspace-position";

const { destination, primary = false } = defineProps<{
  readonly destination: Route;
  readonly primary?: boolean;
}>();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();

async function open(event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(destination))) remember(undefined);
}
</script>

<template>
  <UButton
    type="button"
    :variant="primary ? 'solid' : 'link'"
    class="pe-overview-link"
    @click="open"
    ><slot
  /></UButton>
</template>
