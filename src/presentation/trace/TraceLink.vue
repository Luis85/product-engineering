<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { Route } from "../../application/routes";
import { useRememberWorkspaceOrigin } from "../projects";
import { useNavigate } from "../shell";

const { destination } = defineProps<{ readonly destination: Route }>();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();

async function open(event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(destination))) remember(undefined);
}
</script>

<template>
  <UButton type="button" variant="link" class="pe-trace-link" @click="open"><slot /></UButton>
</template>
