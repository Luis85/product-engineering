const notices: Notice[] = [];
let fail = false;

export class Notice {
  readonly message: string;

  constructor(message: string | DocumentFragment) {
    if (fail) {
      fail = false;
      throw new Error("Test notice failed");
    }
    this.message = typeof message === "string" ? message : (message.textContent ?? "");
    notices.push(this);
  }
}

export function recordedNotices(): readonly string[] {
  return notices.map(({ message }) => message);
}

export function clearNotices(): void {
  notices.length = 0;
  fail = false;
}

export function failNextNotice(): void {
  fail = true;
}
