import { languageFromCode } from "../src/application/messages";
import type { UserMessage } from "../src/application/shell";
import { makeRuntime } from "../src/infrastructure/runtime";
import { appSurface } from "../src/presentation/app-surface";
import { mountSurface } from "../src/presentation/shell";
import { memoryNavigation, releaseAll } from "../src/presentation/shell/host";
import "../src/styles/app.css";
import "./fake-host.css";
import { harnessLayer, parseScenario } from "./layers";

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing harness element #${id}`);
  return found;
}

function showNotice(list: HTMLElement, message: UserMessage): void {
  const entry = document.createElement("li");
  entry.dataset.severity = message.severity;
  const title = document.createElement("strong");
  title.textContent = message.title;
  const detail = document.createElement("p");
  detail.textContent = message.detail;
  entry.append(title, detail);
  if (message.link) {
    const link = document.createElement("a");
    link.href = message.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = message.link;
    entry.append(link);
  }
  list.append(entry);
}

const themeSwitch = element("harness-theme");
themeSwitch.addEventListener("click", () => {
  const dark = document.body.classList.toggle("theme-dark");
  document.body.classList.toggle("theme-light", !dark);
  themeSwitch.setAttribute("aria-pressed", String(dark));
});

const params = new URLSearchParams(window.location.search);
const language = languageFromCode(params.get("lang") ?? "en");
const scenario = parseScenario(params.get("scenario"));
const notices = element("harness-notices");
notices.lang = language;
const wide = element("preview-wide");
const narrow = element("preview-narrow");
const runtime = makeRuntime(
  harnessLayer(scenario, {
    language,
    notify: (message) => showNotice(notices, message),
  }),
);
const releases: (() => void)[] = [];

function mountPreview(root: HTMLElement) {
  return mountSurface(root, runtime, {
    surface: appSurface,
    navigation: memoryNavigation(appSurface),
  });
}

async function dispose(): Promise<void> {
  try {
    releaseAll(releases.splice(0));
  } finally {
    await runtime.dispose();
  }
}

try {
  releases.push(await mountPreview(wide));
  releases.push(await mountPreview(narrow));
} catch (cause) {
  await dispose();
  throw cause;
}

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) void dispose();
});
