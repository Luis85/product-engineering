<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useRoute, useRouting } from "../navigation";
import NotFoundState from "./NotFoundState.vue";

const { definition } = useRouting();
const route = useRoute();
const loader = computed(() => definition.screen(route.value));
const screen = computed(() => (loader.value ? defineAsyncComponent(loader.value) : NotFoundState));
</script>

<template>
  <component :is="screen" :key="route.name" />
</template>
