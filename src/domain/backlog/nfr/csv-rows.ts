type QuoteIssue = "quote" | "quote-tail" | "quote-open";
type Row = {
  readonly line: number;
  readonly cells: readonly string[];
  readonly issue?: QuoteIssue;
};

class CsvRows {
  readonly rows: Row[] = [];
  private cells: string[] = [];
  private field = "";
  private issue: QuoteIssue | undefined;
  private state: "plain" | "quoted" | "closed" = "plain";
  private line = 1;
  private start = 1;

  constructor(private readonly separator: string) {}

  read(token: string, escaped: boolean) {
    if (this.state === "quoted") this.readQuoted(token, escaped);
    else if (token === "\n") this.finishRow();
    else if (token === this.separator) this.finishField();
    else if (token === '"') this.openQuote();
    else this.readPlain(token);
    if (token === "\n") this.line++;
  }

  private readQuoted(token: string, escaped: boolean) {
    if (escaped || token !== '"') {
      this.field += token;
      return;
    }
    this.state = "closed";
  }

  private openQuote() {
    if (this.field || this.state === "closed") this.issue ??= "quote";
    else this.state = "quoted";
  }

  private readPlain(token: string) {
    if (this.state !== "closed") this.field += token;
    else if (/[^ \t]/.test(token)) this.issue ??= "quote-tail";
  }

  private finishField() {
    this.cells.push(this.field);
    this.field = "";
    this.state = "plain";
  }

  private finishRow() {
    this.finishField();
    if (this.issue || this.cells.length > 1 || this.cells[0]?.trim())
      this.rows.push({
        line: this.start,
        cells: this.cells,
        ...(this.issue && { issue: this.issue }),
      });
    this.start = this.line + 1;
    this.cells = [];
    this.issue = undefined;
  }

  isQuoted() {
    return this.state === "quoted";
  }

  end() {
    if (this.isQuoted()) this.issue ??= "quote-open";
    this.finishRow();
    return this.rows;
  }
}

export function parseNfrRows(source: string) {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = text.split("\n").find((line) => line.trim());
  const csv = new CsvRows(header?.includes(";") ? ";" : ",");
  const tokens = /[",;\n]|[^",;\n]+/g;
  let match = tokens.exec(text);
  while (match) {
    const token = match[0];
    const escaped = token === '"' && csv.isQuoted() && text[tokens.lastIndex] === '"';
    if (escaped) tokens.lastIndex++;
    csv.read(token, escaped);
    match = tokens.exec(text);
  }
  return csv.end();
}
