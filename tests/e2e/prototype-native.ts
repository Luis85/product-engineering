import { browser } from "@wdio/globals";

export function capturePrototypeDownload(control: WebdriverIO.Element) {
  return browser.execute(
    (button: HTMLElement) =>
      new Promise<{ name: string; text: string; bytes: number[] }>((done, fail) => {
        const owner = button.ownerDocument.defaultView;
        if (!owner) throw new Error("Download is missing its owning window");
        const prototype = owner.HTMLAnchorElement.prototype;
        const previousUrl = Object.getOwnPropertyDescriptor(owner.URL, "createObjectURL");
        const previousClick = Object.getOwnPropertyDescriptor(prototype, "click");
        const create = owner.URL.createObjectURL.bind(owner.URL);
        let bytes: Promise<ArrayBuffer> | undefined;
        const restore = () => {
          if (previousUrl) Object.defineProperty(owner.URL, "createObjectURL", previousUrl);
          else Reflect.deleteProperty(owner.URL, "createObjectURL");
          if (previousClick) Object.defineProperty(prototype, "click", previousClick);
          else Reflect.deleteProperty(prototype, "click");
        };
        const timer = owner.setTimeout(() => {
          restore();
          fail(new Error("The prototype did not start a local download"));
        }, 5000);
        owner.URL.createObjectURL = (resource) => {
          if (resource instanceof owner.Blob) bytes = resource.arrayBuffer();
          return create(resource);
        };
        prototype.click = function (this: HTMLAnchorElement) {
          restore();
          owner.clearTimeout(timer);
          const name = this.download;
          if (!this.href.startsWith("blob:") || !bytes) {
            fail(new Error("Expected an object URL backed by a native Blob"));
            return;
          }
          void bytes.then((buffer) => {
            const content = new Uint8Array(buffer);
            done({ name, text: new TextDecoder().decode(content), bytes: Array.from(content) });
          }, fail);
        };
        button.click();
      }),
    control,
  );
}
