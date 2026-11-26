<script setup lang="ts">
import { computed } from "vue";
import { chatMarkdown } from "../markdown";

const { markdown } = defineProps<{ readonly markdown: string }>();
const lines = computed(() => chatMarkdown(markdown));
</script>

<template>
  <div class="pe-copilot-markdown">
    <component v-for="(line, index) in lines" :key="index" :is="line.tag">
      <component
        v-for="(token, position) in line.content"
        :key="position"
        :is="token.tag"
        data-markdown
        >{{ token.text }}</component
      >
    </component>
  </div>
</template>
