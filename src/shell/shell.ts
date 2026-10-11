// The REPL: prompt → line-edit user input → parse → run command (with pipes)
// → repeat. Owns the cwd, a tiny virtual FS view (/bin = commands, root = docs),
// and an in-line editor (history, cursor movement).
import type { Term } from '../term/term';
import type { ContentStore } from '../content/store';
import type { Context, DirEntry, Registry, StdOut } from './types';
import { parseLine } from './parser';
import { resolvePath } from './path';
import { isDir, childrenOf } from './vfs';
import {
  INVERSE,
  RESET,
  bgHex,
  displayWidth,
  fgHex,
  prevClusterStart,
  nextClusterEnd,
  stripAnsi,
} from '../term/ansi';
import { p10k, ui } from '../term/palette';

export interface ShellDeps {
  term: Term;
  registry: Registry;
  store: ContentStore;
  /** Command to run once on start (e.g. the homepage). */
  initialCommand?: string;
}

/** Split a line into pipe segments, respecting double quotes. */
function splitPipe(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (const c of line) {
    if (c === '"') {
      inQ = !inQ;
      cur += c;
    } else if (c === '|' && !inQ) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Longest common prefix of a set of strings. */
function commonPrefix(arr: string[]): string {
  if (arr.length === 0) return '';
  let pre = arr[0];
  for (const w of arr) {
    while (!w.startsWith(pre)) pre = pre.slice(0, -1);
  }
  return pre;
}

export class Shell {
  private readonly term: Term;
  private readonly registry: Registry;
  private readonly store: ContentStore;
  private readonly initialCommand?: string;
  private cwd = ''; // '' = root '/'
  private curPrompt = '';
  private curWidth = 0;
  /** Right prompt (status pill) drawn flush right on the input line. */
  private curRPrompt = '';
  /** Exit status of the last executed command (drives status + transient color). */
  private lastOk = true;
  /** Rows the input region (prompt + input, possibly wrapped) occupies. */
  private lineRows = 1;
  /** Cursor's row (0-based) within that region. */
  private cursorRow = 0;
  /** Rows currently occupied by the candidate list BELOW the input line. */
  private listBelow = 0;
  private buffer = '';
  private cursor = 0;
  private history: string[] = [];
  private histIdx = -1;
  private resolveLine?: (line: string) => void;
  /** Active menu-completion session (listing + cycling candidates on Tab). */
  private compSession?: {
    wordStart: number;
    base: string;
    matches: string[];
    index: number;
    /** Rendered cells (colored text + plain text + visible width) for the list. */
    items: { text: string; plain: string; width: number }[];
    /** Column layout of the list. */
    layout: { maxw: number; cols: number; rows: number };
  };

  constructor(deps: ShellDeps) {
    this.term = deps.term;
    this.registry = deps.registry;
    this.store = deps.store;
    this.initialCommand = deps.initialCommand;
  }

  /** Virtual FS path label: '/' at root, '/bin' in the bin dir. */
  private pathLabel(): string {
    return '/' + this.cwd;
  }

  /** Roll the terminal title to `oakchaser@NyanOS: <path>`. */
  private updateTitle(): void {
    document.title = `oakchaser@NyanOS: ${this.pathLabel()}`;
  }

  /**
   * Build the active prompt: a powerlevel10k classic single line, Catppuccin
   * Mocha — a rounded SURFACE0 pill holding the OS icon and the directory,
   * capped by round head/tail (no ❯; that only appears in the transient prompt).
   */
  private promptFor(): { text: string; width: number } {
    const loc = this.pathLabel();
    const text =
      RESET +
      fgHex(p10k.bg) + p10k.head +
      bgHex(p10k.bg) + fgHex(p10k.osFg) + ' ' + p10k.osIcon + ' ' +
      fgHex(p10k.sepFg) + p10k.subseg +
      fgHex(p10k.dirFg) + ' ' + p10k.folderIcon + ' ' + loc + ' ' +
      '\x1b[49m' + fgHex(p10k.bg) + p10k.tail +
      RESET + ' ';
    return { text, width: displayWidth(stripAnsi(text)) };
  }

  /** The right prompt: a rounded pill showing the last command's status. */
  private statusPrompt(): string {
    const ok = this.lastOk;
    return (
      RESET +
      fgHex(p10k.bg) + p10k.head +
      bgHex(p10k.bg) + fgHex(ok ? p10k.okFg : p10k.errFg) +
      ' ' + (ok ? p10k.okIcon : p10k.errIcon) + ' ' +
      '\x1b[49m' + fgHex(p10k.bg) + p10k.tail +
      RESET
    );
  }

  /** The transient (history) prompt: a single `❯ ` tinted by the last status. */
  private transientPrompt(): string {
    const c = this.lastOk ? p10k.transientFg : p10k.transientErrFg;
    return `${fgHex(c)}${p10k.prompt}${RESET} `;
  }

  /** Replace the whole input region with `❯ <shown>` and a newline. Clears the
   *  full (possibly wrapped) multi-row region, not just the cursor's row. */
  private finishLine(shown: string): void {
    this.clearBelow(); // drop any candidate list sitting under the input line
    let out = '\x1b[?25l';
    if (this.cursorRow > 0) out += `\x1b[${this.cursorRow}A`;
    out += '\r';
    const rows = this.lineRows;
    for (let i = 0; i < rows; i++) {
      out += '\x1b[2K';
      if (i < rows - 1) out += '\x1b[1B';
    }
    if (rows > 1) out += `\x1b[${rows - 1}A`;
    out += '\r' + this.transientPrompt() + shown + '\r\n';
    this.term.write(out + '\x1b[?25h');
    this.lineRows = 1;
    this.cursorRow = 0;
  }

  /** Start the read/eval loop. Never returns. */
  async start(): Promise<void> {
    this.term.onShellData((d) => this.onData(d));
    if (this.initialCommand) {
      this.updateTitle();
      this.finishLine(this.initialCommand);
      await this.execute(this.initialCommand);
    }
    for (;;) {
      this.buffer = '';
      this.cursor = 0;
      this.histIdx = -1;
      this.lineRows = 1;
      this.cursorRow = 0;
      this.updateTitle();
      const { text, width } = this.promptFor();
      this.curPrompt = text;
      this.curWidth = width;
      this.curRPrompt = this.statusPrompt();
      this.redraw();
      const line = await this.readLine();
      await this.execute(line);
    }
  }

  /** Run a command string exactly as if the user typed it (used by buttons). */
  inject(command: string): void {
    if (!this.resolveLine) return;
    this.finishLine(command);
    const r = this.resolveLine;
    this.resolveLine = undefined;
    r(command);
  }

  private readLine(): Promise<string> {
    return new Promise<string>((resolve) => {
      this.resolveLine = resolve;
    });
  }

  // ---- virtual FS view ----
  private isDir(p: string): boolean {
    return p === '' || p === 'bin';
  }

  private chdir(target: string): string | null {
    const p = resolvePath(target, this.cwd);
    if (this.isDir(p)) {
      this.cwd = p;
      return null;
    }
    return `${target}: not a directory`;
  }

  private listDir(target: string): DirEntry[] | null {
    const p = resolvePath(target, this.cwd);
    if (p === '') {
      return [{ name: 'bin', dir: true }, ...this.store.all().map((d) => ({ name: d.slug, dir: false }))];
    }
    if (p === 'bin') {
      // Only real /bin executables — not builtins (cd) or document-commands.
      return this.registry
        .list()
        .filter((c) => !c.builtin && !c.doc)
        .map((c) => ({ name: c.name, dir: false }));
    }
    const doc = this.store.get(p);
    if (doc) return [{ name: doc.slug, dir: false }];
    return null;
  }

  /** Execute a (possibly piped) command line. */
  private async execute(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.history.push(trimmed);

    const segments = splitPipe(trimmed);
    let stdin = '';
    for (let i = 0; i < segments.length; i++) {
      const argv = parseLine(segments[i]);
      const name = argv[0];
      const p = resolvePath(name, this.cwd);
      // /bin commands resolve by bare name (PATH) or by path; docs live at root.
      const cmd =
        this.registry.get(name) ??
        this.registry.get(p) ??
        (p.startsWith('bin/') ? this.registry.get(p.slice(4)) : undefined);
      if (!cmd) {
        this.lastOk = false;
        this.term.print(`command not found: ${name} — try help`);
        return;
      }

      const isLast = i === segments.length - 1;
      let buffer = '';
      const stdout: StdOut = isLast
        ? { write: (s) => this.term.write(s), print: (s) => this.term.print(s) }
        : { write: (s) => void (buffer += s), print: (s) => void (buffer += s + '\n') };

      const ctx: Context = {
        term: this.term,
        store: this.store,
        stdin,
        stdout,
        tty: isLast,
        cwd: this.cwd,
        resolve: (n: string) => this.registry.get(n),
        list: () => this.registry.list(),
        chdir: (t: string) => this.chdir(t),
        listDir: (t: string) => this.listDir(t),
      };

      try {
        await cmd.run(ctx, argv);
      } catch (e) {
        this.lastOk = false;
        this.term.print(`error: ${String(e)}`);
        return;
      }
      stdin = buffer;
    }
    this.lastOk = true;
  }

  // ---- inline line editor ----
  private onData(d: string): void {
    if (!this.resolveLine) return;
    // Any keystroke other than Tab / Shift-Tab cancels an in-progress completion
    // menu and removes the candidate list drawn beneath the input line.
    if (d !== '\t' && d !== '\x1b[Z') {
      this.compSession = undefined;
      this.clearBelow();
    }
    switch (d) {
      case '\r':
      case '\n': {
        const line = this.buffer;
        this.finishLine(line);
        const r = this.resolveLine;
        this.resolveLine = undefined;
        r(line);
        break;
      }
      case '\x7f':
      case '\b': {
        if (this.cursor > 0) {
          // Delete the whole grapheme cluster to the left (so a ZWJ emoji like
          // 👨‍👩‍👧 vanishes in one keystroke, not codepoint-by-codepoint).
          const cut = prevClusterStart(this.buffer, this.cursor);
          this.buffer = this.buffer.slice(0, cut) + this.buffer.slice(this.cursor);
          this.cursor = cut;
          this.redraw();
        }
        break;
      }
      case '\x1b[A':
      case '\x1bOA':
      case '\x10': // Ctrl-P
        this.histMove('up');
        break;
      case '\x1b[B':
      case '\x1bOB':
      case '\x0e': // Ctrl-N
        this.histMove('down');
        break;
      case '\x1b[C':
      case '\x06': // Ctrl-F
        if (this.cursor < this.buffer.length) {
          this.cursor++;
          this.redraw();
        }
        break;
      case '\x1b[D':
      case '\x02': // Ctrl-B
        if (this.cursor > 0) {
          this.cursor--;
          this.redraw();
        }
        break;
      case '\x01': // Ctrl-A
        this.cursor = 0;
        this.redraw();
        break;
      case '\x05': // Ctrl-E
        this.cursor = this.buffer.length;
        this.redraw();
        break;
      case '\x0b': // Ctrl-K
        this.buffer = this.buffer.slice(0, this.cursor);
        this.redraw();
        break;
      case '\x15': // Ctrl-U
        this.buffer = this.buffer.slice(this.cursor);
        this.cursor = 0;
        this.redraw();
        break;
      case '\x17': {
        // Ctrl-W
        let i = this.cursor;
        while (i > 0 && /\s/.test(this.buffer[i - 1])) i--;
        while (i > 0 && !/\s/.test(this.buffer[i - 1])) i--;
        this.buffer = this.buffer.slice(0, i) + this.buffer.slice(this.cursor);
        this.cursor = i;
        this.redraw();
        break;
      }
      case '\x04': // Ctrl-D
        // At an empty prompt, Ctrl-D is "logout": reset cwd and re-run `index`
        // (the homepage) — always, regardless of which page first loaded. With
        // text present it deletes the grapheme cluster to the right, like a shell.
        if (this.buffer.length === 0) {
          this.cwd = '';
          const r = this.resolveLine;
          this.resolveLine = undefined;
          r?.('index');
          return;
        }
        if (this.cursor < this.buffer.length) {
          // Delete the whole grapheme cluster to the right (don't split an emoji).
          const end = nextClusterEnd(this.buffer, this.cursor);
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(end);
          this.redraw();
        }
        break;
      case '\x0c': {
        // Ctrl-L
        this.term.write('\x1b[2J\x1b[3J\x1b[H');
        this.redraw();
        break;
      }
      case '\x03': // Ctrl-C
        this.finishLine(this.buffer + '^C');
        if (this.resolveLine) {
          const r = this.resolveLine;
          this.resolveLine = undefined;
          r('');
        }
        break;
      case '\t': // Tab — complete / forward-cycle the menu
        this.complete(false);
        break;
      case '\x1b[Z': // Shift-Tab — reverse-cycle the menu
        this.complete(true);
        break;
      default:
        if (d.length >= 1 && !/[\x00-\x1f\x7f]/.test(d)) {
          this.buffer = this.buffer.slice(0, this.cursor) + d + this.buffer.slice(this.cursor);
          this.cursor += d.length;
          this.redraw();
        }
    }
  }

  private histMove(dir: 'up' | 'down'): void {
    const n = this.history.length;
    if (n === 0) return;
    if (dir === 'up') {
      this.histIdx = this.histIdx === -1 ? n - 1 : Math.max(0, this.histIdx - 1);
    } else {
      if (this.histIdx === -1) return;
      this.histIdx++;
      if (this.histIdx >= n) this.histIdx = -1;
    }
    const entry = this.histIdx === -1 ? '' : this.history[this.histIdx];
    this.buffer = entry;
    this.cursor = entry.length;
    this.redraw();
  }

  /** Tab-complete the word at the cursor. The first Tab takes the longest
   *  common prefix; when that makes no progress it lists the candidates below
   *  (like zsh) and opens a menu — further Tabs cycle through them inline.
   *  Completion is path-aware (`cat bin/le<Tab>`, `cd ../b<Tab>`) and
   *  case-insensitive. */
  private complete(reverse = false): void {
    const before = this.buffer.slice(0, this.cursor);
    const wordStart = before.lastIndexOf(' ') + 1;
    const word = before.slice(wordStart);
    const isFirstWord = wordStart === 0;

    const s = this.compSession;
    if (s) {
      // A menu is open. If the buffer still holds the current candidate, Tab
      // advances to the next; if we just listed (index -1), start on the first.
      const region = this.buffer.slice(s.wordStart, this.cursor);
      const n = s.matches.length;
      if (s.index >= 0 && region === s.matches[s.index]) {
        s.index = reverse ? (s.index - 1 + n) % n : (s.index + 1) % n;
      } else if (s.index === -1 && region === s.base) {
        s.index = reverse ? n - 1 : 0;
      } else {
        this.compSession = undefined; // line edited underneath us — recompute
      }
      if (this.compSession) {
        const sel = this.compSession.matches[this.compSession.index];
        this.buffer =
          this.buffer.slice(0, this.compSession.wordStart) + sel + this.buffer.slice(this.cursor);
        this.cursor = this.compSession.wordStart + sel.length;
        this.drawList(this.compSession.index); // re-highlight the selected cell
        this.redraw();
        return;
      }
    }

    // Split the word into a directory part ("bin/", "../", "") and a basename.
    const slash = word.lastIndexOf('/');
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
    const base = slash >= 0 ? word.slice(slash + 1) : word;

    // Candidate set: entries in dirPart (path-segment aware) plus, for the first
    // word, bare command names.
    const cand = new Map<string, { name: string; dir: boolean }>();
    for (const e of this.entriesFor(dirPart)) cand.set(e.name, e);
    if (isFirstWord && dirPart === '') {
      for (const c of this.registry.list()) if (!cand.has(c.name)) cand.set(c.name, { name: c.name, dir: false });
    }

    const baseLc = base.toLowerCase();
    const names = [...cand.keys()].filter((n) => n.toLowerCase().startsWith(baseLc)).sort();
    const text = (name: string) => dirPart + name + (cand.get(name)!.dir ? '/' : '');
    // Directories are shown blue with a plain (default-color) trailing slash.
    // `plain` is the uncolored form, used for the inverted (selected) cell so the
    // directory's own RESET can't cancel the highlight.
    const label = (name: string): { text: string; plain: string; width: number } => {
      const dir = cand.get(name)!.dir;
      const plain = name + (dir ? '/' : '');
      return {
        text: dir ? `${ui.dir}${name}${RESET}/` : name,
        plain,
        width: displayWidth(plain),
      };
    };

    if (names.length === 0) {
      this.term.write('\x07'); // bell
      this.compSession = undefined;
      return;
    }
    if (names.length === 1) {
      // Unique match: complete it outright (a trailing space ends the word).
      const m = text(names[0]);
      const suffix = cand.get(names[0])!.dir ? '' : ' ';
      this.replaceRange(wordStart, this.cursor, m + suffix);
      this.compSession = undefined;
      return;
    }
    const lcp = commonPrefix(names);
    if (lcp.length > base.length) {
      // Ambiguous but a longer shared prefix exists — take it; next Tab re-runs.
      this.replaceRange(wordStart, this.cursor, dirPart + lcp);
      this.compSession = undefined;
      return;
    }

    // Ambiguous with no further shared prefix: print the candidates BELOW the
    // input line (cursor stays put), then open a menu so the next Tab cycles.
    this.clearBelow();
    const items = names.map(label);
    const layout = this.layoutList(items, this.term.cols);
    this.compSession = {
      wordStart,
      base: word,
      matches: names.map(text),
      index: -1,
      items,
      layout,
    };
    this.drawList(-1);
    this.redraw();
  }

  /** Column layout for the candidate list: pack cells of `maxw` visible width
   *  plus a 2-space gap, never exceeding the terminal width (minus the indent). */
  private layoutList(
    items: { text: string; width: number }[],
    cols0: number,
  ): { maxw: number; cols: number; rows: number } {
    const maxw = Math.max(...items.map((i) => i.width));
    const gap = 2;
    const usable = Math.max(1, cols0 - 2); // leave room for the leading indent
    const cols = Math.max(1, Math.min(items.length, Math.floor(usable / (maxw + gap))));
    const rows = Math.ceil(items.length / cols);
    return { maxw, cols, rows };
  }

  /** Render the candidate list (column-major), inverting the selected cell. */
  private renderList(
    items: { text: string; plain: string; width: number }[],
    layout: { maxw: number; cols: number; rows: number },
    selected: number,
  ): string[] {
    const { maxw, cols, rows } = layout;
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      const cells: string[] = [];
      for (let c = 0; c < cols; c++) {
        const i = c * rows + r;
        if (i < items.length) {
          const it = items[i];
          const pad = ' '.repeat(maxw - it.width);
          cells.push(
            i === selected ? `${INVERSE}${it.plain}${pad}${RESET}` : it.text + pad,
          );
        }
      }
      lines.push(cells.join('  ').replace(/\s+$/, ''));
    }
    return lines;
  }

  /** Draw (or redraw) the candidate list on the rows just below the input line.
   *  The cursor ends back on the input line; the caller redraws it. */
  private drawList(selected: number): void {
    const s = this.compSession;
    if (!s) return;
    const lines = this.renderList(s.items, s.layout, selected);

    // Move to the first list row (creating it on the first draw), rewrite each
    // row in place without adding newlines past the list, then return up to the
    // input line.
    this.term.write(this.listBelow === 0 ? '\r\n' : '\x1b[1B');
    for (let i = 0; i < lines.length; i++) {
      this.term.write('\r\x1b[2K  ' + lines[i]);
      if (i < lines.length - 1) this.term.write('\r\n');
    }
    this.term.write(`\x1b[${lines.length}A\r`);
    this.listBelow = lines.length;
  }

  /** Erase the candidate list below the input line and return the cursor to it. */
  private clearBelow(): void {
    const n = this.listBelow;
    if (n <= 0) return;
    this.term.write('\x1b[1B');
    for (let i = 0; i < n; i++) {
      this.term.write('\r\x1b[2K');
      if (i < n - 1) this.term.write('\x1b[1B');
    }
    this.term.write(`\x1b[${n}A\r`);
    this.listBelow = 0;
  }

  /** Entries of the directory a completion word points at ('' = cwd dir). */
  private entriesFor(dirPart: string): DirEntry[] {
    const slug = resolvePath(dirPart === '' ? '.' : dirPart, this.cwd);
    const ctx = { store: this.store, list: () => this.registry.list() } as unknown as Context;
    return isDir(slug, ctx) ? childrenOf(slug, ctx) : [];
  }

  private replaceRange(start: number, end: number, replacement: string): void {
    this.buffer = this.buffer.slice(0, start) + replacement + this.buffer.slice(end);
    this.cursor = start + replacement.length;
    this.redraw();
  }

  /**
   * Redraw the input line. The prompt + input may span several terminal rows
   * (long input wraps), so this tracks the region's row count (`lineRows`) and
   * the cursor's row within it (`cursorRow`): it steps to the region's first
   * row, clears the whole (possibly taller) previous region, redraws, then
   * places the cursor. A single-row redraw wouldn't erase the earlier wrapped
   * rows, which is what duplicated the prompt on every keystroke.
   */
  private redraw(): void {
    const cols = Math.max(1, this.term.cols);
    const pw = this.curWidth;
    const bw = displayWidth(this.buffer);
    const total = pw + bw;
    const rows = Math.max(1, Math.ceil(total / cols));

    // Emit the WHOLE redraw as one write, with the cursor hidden: separate
    // writes would each get their own render, flashing the cursor at row starts
    // as it is moved around. One write = one parse = one render.
    let out = '\x1b[?25l';

    // 1) Back to the first row of the previous region and clear all its rows.
    if (this.cursorRow > 0) out += `\x1b[${this.cursorRow}A`;
    out += '\r';
    const clearRows = Math.max(this.lineRows, rows);
    for (let i = 0; i < clearRows; i++) {
      out += '\x1b[2K';
      if (i < clearRows - 1) out += '\x1b[1B';
    }
    if (clearRows > 1) out += `\x1b[${clearRows - 1}A`;
    out += '\r';

    // 2) Draw the prompt + input, then return to the first row.
    out += this.curPrompt + this.buffer;
    if (rows > 1) out += `\x1b[${rows - 1}A`;
    out += '\r';

    // 3) Right prompt (status pill) on the first row, flush right — hidden when
    //    the input would reach it (same as p10k; keeps a one-column gap).
    if (this.curRPrompt) {
      const rW = displayWidth(stripAnsi(this.curRPrompt));
      const startCol = cols - rW; // 0-indexed
      if (total <= startCol - 1) out += `\x1b[${startCol + 1}G` + this.curRPrompt + '\r';
    }

    // 4) Place the edit cursor at its row/column within the region.
    const abs = pw + displayWidth(this.buffer.slice(0, this.cursor));
    let crow = Math.floor(abs / cols);
    let ccol = abs % cols;
    if (crow > rows - 1) {
      crow = rows - 1;
      ccol = cols - 1;
    }
    if (crow > 0) out += `\x1b[${crow}B`;
    out += `\x1b[${ccol + 1}G`;

    this.term.write(out + '\x1b[?25h');

    this.lineRows = rows;
    this.cursorRow = crow;
  }
}
