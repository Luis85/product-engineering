<script setup lang="ts">
import { computed } from "vue";
import { PROJECT_STORY_MAPS } from "../../application/story-maps";
import { useRoute } from "../shell";
import StoryMapsWorkspace from "./StoryMapsWorkspace.vue";

const route = useRoute();
const scope = computed(() => (route.value.name === PROJECT_STORY_MAPS ? route.value : undefined));
</script>

<template>
  <StoryMapsWorkspace v-if="scope" :key="scope.projectId" :scope="scope" />
</template>
