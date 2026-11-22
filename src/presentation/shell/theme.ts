const themes = ["dark", "light"] as const;

export function bindHostTheme(root: HTMLElement): () => void {
  const owner = root.ownerDocument;
  const original = new Set(themes.filter((theme) => root.classList.contains(theme)));
  const sync = () => {
    for (const theme of themes) {
      root.classList.toggle(theme, owner.body.classList.contains("theme-" + theme));
    }
  };

  sync();
  const Observer = owner.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(sync) : undefined;
  observer?.observe(owner.body, { attributes: true, attributeFilter: ["class"] });

  return () => {
    observer?.disconnect();
    for (const theme of themes) {
      root.classList.toggle(theme, original.has(theme));
    }
  };
}
