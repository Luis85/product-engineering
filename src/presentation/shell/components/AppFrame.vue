<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, defineAsyncComponent } from "vue";
import { useHistory, useNavigate, useRoute, useRouting } from "../navigation";
import { frameMenu } from "../routing";
import { useMessages } from "../runtime/use-runtime";
import RouteOutlet from "./RouteOutlet.vue";

const catalog = useMessages();
const { definition } = useRouting();
const frame = definition.frame ? defineAsyncComponent(definition.frame) : undefined;
const route = useRoute();
const navigate = useNavigate();
const { canGoBack, canGoForward, back, forward } = useHistory();
const menu = frameMenu(definition);
const context = definition.context ? defineAsyncComponent(definition.context) : undefined;
const active = {
  "aria-current": "page",
  color: "primary",
  variant: "soft",
  class: "pe:font-semibold",
} as const;
const inactive = { color: "neutral", variant: "ghost" } as const;
const buttons = computed(() =>
  menu.map((entry) => ({
    ...entry,
    attrs: entry.route.name === route.value.name ? active : inactive,
  })),
);
</script>

<template>
  <component :is="frame" v-if="frame" />
  <div v-else data-testid="app-frame" :lang="catalog.shell.language" class="pe:@container">
    <div class="pe:grid pe:min-w-0 pe:gap-4 pe:p-4 pe:@min-[860px]:grid-cols-[12rem_minmax(0,1fr)]">
      <nav
        :aria-label="catalog.shell.frame.navigation"
        class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-center pe:gap-2 pe:border-b pe:border-default pe:pb-3 pe:@min-[860px]:flex-col pe:@min-[860px]:items-stretch pe:@min-[860px]:border-r pe:@min-[860px]:border-b-0 pe:@min-[860px]:pr-3"
      >
        <div
          v-if="canGoBack || canGoForward"
          data-testid="frame-history"
          class="pe:flex pe:flex-wrap pe:gap-1"
        >
          <UButton
            :aria-label="catalog.shell.frame.back"
            :aria-disabled="canGoBack ? undefined : true"
            icon="i-lucide-arrow-left"
            type="button"
            color="neutral"
            size="sm"
            variant="ghost"
            @click="back"
          />
          <UButton
            :aria-label="catalog.shell.frame.forward"
            :aria-disabled="canGoForward ? undefined : true"
            icon="i-lucide-arrow-right"
            type="button"
            color="neutral"
            size="sm"
            variant="ghost"
            @click="forward"
          />
        </div>
        <div v-if="context" data-testid="frame-context" class="pe:min-w-0">
          <component :is="context" />
        </div>
        <ul
          data-testid="frame-navigation"
          class="pe:flex pe:flex-wrap pe:gap-1 pe:@min-[860px]:flex-col"
        >
          <li v-for="entry in buttons" :key="entry.route.name" class="pe:min-w-0">
            <UButton
              v-bind="entry.attrs"
              :icon="entry.icon"
              type="button"
              size="sm"
              class="pe:max-w-full pe:text-left pe:whitespace-normal pe:@min-[860px]:w-full"
              @click="navigate(entry.route)"
            >
              {{ entry.label(catalog) }}
            </UButton>
          </li>
        </ul>
      </nav>
      <section :aria-label="catalog.shell.frame.content" class="pe:min-w-0">
        <RouteOutlet />
      </section>
    </div>
  </div>
</template>
