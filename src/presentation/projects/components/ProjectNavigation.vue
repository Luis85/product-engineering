<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed } from "vue";
import type { Route } from "../../../application/routes";
import type { Project } from "../../../application/projects";
import { useMessages } from "../../shell";
import type { NavigationGroup } from "../sections";

const { collapsed, groups, project, section } = defineProps<{
  readonly project: Project | undefined;
  readonly collapsed: boolean;
  readonly groups: readonly NavigationGroup[];
  readonly section: Route["name"];
}>();
const emit = defineEmits<{ pick: [trigger: HTMLElement]; select: [route: Route] }>();
const text = useMessages().projects;
const title = computed(() => project?.name ?? text.title);
</script>

<template>
  <div class="pe-project-navigation" :data-collapsed="collapsed">
    <UButton
      :aria-label="text.picker"
      variant="ghost"
      color="neutral"
      type="button"
      data-pe-focus-key="project-picker"
      data-autofocus
      class="pe-project-picker"
      @click="emit('pick', $event.currentTarget as HTMLElement)"
    >
      <span class="pe-project-picker-mark" aria-hidden="true"
        ><UIcon name="i-lucide-folder"
      /></span>
      <span class="pe-project-picker-label pe-project-expanded-label">
        <strong>{{ title }}</strong>
        <span v-if="project">{{ text.project }}</span>
      </span>
      <UIcon name="i-lucide-chevron-down" class="pe-project-expanded-label" aria-hidden="true" />
    </UButton>
    <nav :aria-label="text.navigation" data-testid="frame-navigation" class="pe-project-nav-groups">
      <div v-for="(group, index) in groups" :key="group.label" class="pe-project-nav-group">
        <div v-if="!collapsed || index === 0" class="pe-project-nav-heading">
          <p class="pe-project-expanded-label">{{ group.label }}</p>
          <slot v-if="index === 0" name="rail-toggle" />
        </div>
        <UButton
          v-for="entry in group.items"
          :key="entry.route.name"
          :aria-label="entry.label"
          :aria-current="section === entry.route.name ? 'page' : undefined"
          :icon="entry.icon"
          :data-pe-focus-key="entry.route.name"
          type="button"
          variant="ghost"
          color="neutral"
          class="pe-project-nav-entry"
          @click="emit('select', entry.route)"
        >
          <span class="pe-project-expanded-label">{{ entry.label }}</span>
        </UButton>
      </div>
    </nav>
  </div>
</template>
