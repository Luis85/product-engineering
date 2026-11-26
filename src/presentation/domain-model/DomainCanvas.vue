<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, ref, useId, watch } from "vue";
import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { useMessages } from "../shell";
import { maximumZoom, minimumZoom, zoomAt } from "./camera";
import type { Camera, Point } from "./camera";
import { diagramConnections, diagramNodes, fitDiagram, nodeHeight, nodeWidth } from "./geometry";
import { initialCamera, readDomainView, writeDomainView } from "./view-preferences";

const { projectId, entities, edges, selected } = defineProps<{
  readonly projectId: ProjectId;
  readonly entities: readonly KnowledgeRecord[];
  readonly edges: readonly DomainEdge[];
  readonly selected: string | undefined;
}>();
const emit = defineEmits<{ select: [string] }>();
const text = useMessages()["domain-model"];
const canvas = ref<HTMLElement>();
const marker = useId();
const camera = ref<Camera>(initialCamera);
const positions = ref<Record<string, Point>>({});
let storage: Storage | undefined;
onMounted(() => {
  try {
    storage = canvas.value?.ownerDocument.defaultView?.localStorage;
  } catch {
    return;
  }
  const view = readDomainView(storage, projectId);
  camera.value = view.camera;
  positions.value = view.positions;
});

function persist() {
  writeDomainView(storage, projectId, { camera: camera.value, positions: positions.value });
}

watch(
  [camera, positions],
  () => {
    if (!drag?.active) persist();
  },
  { flush: "post" },
);
const nodes = computed(() => diagramNodes(entities, positions.value));
const connections = computed(() => diagramConnections(nodes.value, edges));
const selectedNode = computed(() => nodes.value.find(({ id }) => id === selected));
const world = computed(() => {
  const { x, y, zoom } = camera.value;
  return { transform: `translate(${x}px, ${y}px) scale(${zoom})` };
});
const grid = computed(() => {
  const { x, y, zoom } = camera.value;
  return { backgroundPosition: `${x}px ${y}px`, backgroundSize: `${24 * zoom}px ${24 * zoom}px` };
});

function wheel(event: WheelEvent) {
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return;
  const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const delta =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
  camera.value = zoomAt(camera.value, anchor, Math.exp(-delta * 0.0015));
}

function scale(factor: number) {
  const rect = canvas.value?.getBoundingClientRect();
  if (rect) camera.value = zoomAt(camera.value, { x: rect.width / 2, y: rect.height / 2 }, factor);
}

function reset() {
  camera.value = initialCamera;
}

function fit() {
  const port = canvas.value;
  if (port && nodes.value.length)
    camera.value = fitDiagram(nodes.value, port.clientWidth, port.clientHeight);
}

const directions = [
  { key: "ArrowLeft", symbol: "←", dx: -1, dy: 0, label: text.left },
  { key: "ArrowUp", symbol: "↑", dx: 0, dy: -1, label: text.up },
  { key: "ArrowDown", symbol: "↓", dx: 0, dy: 1, label: text.down },
  { key: "ArrowRight", symbol: "→", dx: 1, dy: 0, label: text.right },
];
type Direction = (typeof directions)[number];
function pan(event: KeyboardEvent) {
  const direction = directions.find(({ key }) => key === event.key);
  if (!direction) return;
  event.preventDefault();
  camera.value = {
    ...camera.value,
    x: camera.value.x - direction.dx * 40,
    y: camera.value.y - direction.dy * 40,
  };
}

function position(id: string, point: Point) {
  positions.value = { ...positions.value, [id]: point };
}

function move(node: Point & { id: string }, direction: Direction) {
  position(node.id, { x: node.x + direction.dx * 24, y: node.y + direction.dy * 24 });
}

function moveByKey(node: Point & { id: string }, event: KeyboardEvent) {
  const direction = directions.find(({ key }) => key === event.key);
  if (!direction) return;
  event.preventDefault();
  move(node, direction);
}

type Drag = {
  readonly pointer: number;
  readonly anchor: Point;
  readonly origin: Point;
  readonly node?: string;
  active: boolean;
};
let drag: Drag | undefined;
let dragged = false;
function pointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return;
  const target = event.target as Element;
  if (target.closest("[data-domain-edge-graphic]")) return;
  const id = target.closest<HTMLElement>("[data-domain-node]")?.dataset.domainNode;
  const node = nodes.value.find(({ id: key }) => key === id);
  dragged = false;
  drag = {
    pointer: event.pointerId,
    anchor: { x: event.clientX, y: event.clientY },
    origin: node ?? camera.value,
    active: false,
    ...(node && { node: node.id }),
  };
}

function pointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const dx = event.clientX - drag.anchor.x;
  const dy = event.clientY - drag.anchor.y;
  if (!drag.active && Math.hypot(dx, dy) < 3) return;
  if (!drag.active) {
    drag.active = true;
    canvas.value?.setPointerCapture?.(drag.pointer);
  }
  event.preventDefault();
  if (drag.node) {
    position(drag.node, {
      x: drag.origin.x + dx / camera.value.zoom,
      y: drag.origin.y + dy / camera.value.zoom,
    });
  } else {
    camera.value = { ...camera.value, x: drag.origin.x + dx, y: drag.origin.y + dy };
  }
}

function pointerEnd(event: PointerEvent) {
  if (drag?.pointer !== event.pointerId) return;
  dragged = drag.active;
  drag = undefined;
  if (dragged) persist();
}

function choose(id: string, event: MouseEvent) {
  if (!dragged || event.detail === 0) emit("select", id);
  dragged = false;
}
</script>

<template>
  <section class="pe-domain-diagram" :aria-label="text.diagram">
    <div class="pe-domain-toolbar">
      <div
        class="pe:flex pe:flex-wrap pe:items-center pe:gap-1"
        role="group"
        :aria-label="text.camera"
      >
        <UButton
          type="button"
          size="sm"
          color="neutral"
          variant="soft"
          :aria-label="text.zoomOut"
          :disabled="camera.zoom <= minimumZoom"
          @click="scale(1 / 1.25)"
          >−</UButton
        >
        <span class="pe-domain-zoom">{{ Math.round(camera.zoom * 100) }}%</span>
        <UButton
          type="button"
          size="sm"
          color="neutral"
          variant="soft"
          :aria-label="text.zoomIn"
          :disabled="camera.zoom >= maximumZoom"
          @click="scale(1.25)"
          >+</UButton
        >
        <UButton
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          data-testid="domain-camera-reset"
          @click="reset"
          >{{ text.actualSize }}</UButton
        >
        <UButton
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          data-testid="domain-camera-fit"
          @click="fit"
          >{{ text.fit }}</UButton
        >
      </div>
      <div
        v-if="selectedNode"
        class="pe:flex pe:flex-wrap pe:items-center pe:gap-1"
        role="group"
        :aria-label="text.moveEntity"
      >
        <span class="pe:text-sm pe:text-muted">{{ text.moveEntity }}</span>
        <UButton
          v-for="direction in directions"
          :key="direction.key"
          type="button"
          size="sm"
          color="neutral"
          variant="soft"
          :aria-label="direction.label"
          :data-domain-move="direction.key"
          @click="move(selectedNode, direction)"
          >{{ direction.symbol }}</UButton
        >
      </div>
    </div>
    <div
      ref="canvas"
      class="pe-domain-viewport"
      :style="grid"
      data-testid="domain-viewport"
      tabindex="0"
      role="region"
      :aria-label="text.diagram"
      :aria-description="text.diagramHelp"
      @wheel.prevent="wheel"
      @keydown.self="pan"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerEnd"
      @pointercancel="pointerEnd"
      @lostpointercapture="pointerEnd"
    >
      <div class="pe-domain-world" :style="world" data-domain-world :data-zoom="camera.zoom">
        <svg class="pe-domain-wires" width="1" height="1" aria-hidden="true">
          <defs>
            <marker
              :id="marker"
              orient="auto"
              markerWidth="8"
              markerHeight="8"
              refX="7.5"
              refY="4"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
            </marker>
          </defs>
          <g
            v-for="connection in connections"
            :key="connection.edge.id"
            :data-domain-edge-graphic="connection.edge.id"
            :class="{ 'pe-domain-selected': selected === connection.edge.id }"
            @click="emit('select', connection.edge.id)"
          >
            <path
              :d="connection.path"
              :marker-end="'url(#' + marker + ')'"
              class="pe-domain-wire"
            />
            <path :d="connection.path" class="pe-domain-wire-hit" />
            <text :x="connection.label.x" :y="connection.label.y" class="pe-domain-wire-label">
              {{ connection.edge.verb }}
            </text>
          </g>
        </svg>
        <button
          v-for="node in nodes"
          :key="node.id"
          type="button"
          class="pe-domain-node"
          :style="{
            left: node.x + 'px',
            top: node.y + 'px',
            width: nodeWidth + 'px',
            height: nodeHeight + 'px',
          }"
          :data-domain-node="node.id"
          :data-pe-focus-key="'entity-' + node.id"
          :aria-pressed="selected === node.id"
          @click="choose(node.id, $event)"
          @keydown="moveByKey(node, $event)"
        >
          <strong class="pe:line-clamp-2 pe:wrap-anywhere">{{ node.title }}</strong>
          <small>{{ node.displayId }}</small>
        </button>
      </div>
    </div>
  </section>
</template>
