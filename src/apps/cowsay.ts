// cowsay — a moo-ving tribute to the classic. Wraps the message into a speech
// balloon and appends the default cow. Mirrors the reference (cowsay 3.8.4):
// Text::Wrap at -W (default 40), hard-breaks over-long words, balloon corners
// `< >` for one line and `/ \ | /` for many, with -e eyes / -T tongue.
import type { Command } from '../shell/types';

export interface CowOptions {
  width?: number;
  eyes?: string;
  tongue?: string;
  /** -n: keep the input's own line breaks, don't word-wrap. */
  noWrap?: boolean;
}

/** Greedy word wrap to `width`, hard-breaking words longer than the width into
 *  `width - 1` chunks (matching cowsay's Text::Wrap behavior). */
function wrapPlain(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const words = text.split(/\s+/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur !== '') {
      lines.push(cur);
      cur = '';
    }
  };
  for (let word of words) {
    while (word.length >= w) {
      flush();
      lines.push(word.slice(0, w - 1));
      word = word.slice(w - 1);
    }
    if (word === '') continue;
    if (cur === '') cur = word;
    else if (cur.length + 1 + word.length <= w) cur += ' ' + word;
    else {
      flush();
      cur = word;
    }
  }
  flush();
  if (lines.length === 0) lines.push('');
  return lines;
}

/** Build the full cowsay output (balloon + cow) for `text`. */
export function cowSay(text: string, opts: CowOptions = {}): string {
  const width = opts.width ?? 40;
  const eyes = (opts.eyes ?? 'oo').slice(0, 2);
  const tongue = (opts.tongue ?? '  ').slice(0, 2);

  const message = opts.noWrap
    ? text.split('\n').filter((_l, i, a) => i < a.length - 1 || a[i] !== '')
    : wrapPlain(text, width);
  if (message.length === 0) message.push('');

  const max = Math.max(...message.map((l) => l.length), 0);
  const max2 = max + 2;
  const fmt = (l: string, r: string, m: string) => `${l} ${m.padEnd(max)} ${r}`;

  const balloon: string[] = [' ' + '_'.repeat(max2)];
  if (message.length < 2) {
    balloon.push(fmt('<', '>', message[0]));
  } else {
    balloon.push(fmt('/', '\\', message[0]));
    for (let i = 1; i < message.length - 1; i++) balloon.push(fmt('|', '|', message[i]));
    balloon.push(fmt('\\', '/', message[message.length - 1]));
  }
  balloon.push(' ' + '-'.repeat(max2));

  const cow = [
    '        \\   ^__^',
    `         \\  (${eyes})\\_______`,
    '            (__)\\       )\\/\\',
    `             ${tongue} ||----w |`,
    '                ||     ||',
  ];

  return balloon.concat(cow).join('\n') + '\n';
}

export const cowsay: Command = {
  name: 'cowsay',
  description: 'cowsay [-W n] [-e eyes] [-T tongue] [-n] <message>',
  async run(ctx, argv) {
    let width = 40;
    let eyes = 'oo';
    let tongue = '  ';
    let noWrap = false;
    const words: string[] = [];

    for (let i = 1; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-W') width = Number(argv[++i]) || width;
      else if (a === '-e') eyes = argv[++i] ?? eyes;
      else if (a === '-T') tongue = argv[++i] ?? tongue;
      else if (a === '-n') noWrap = true;
      else if (a.startsWith('-') && a !== '-') continue; // ignore unknown flags
      else words.push(a);
    }

    const text = words.length > 0 ? words.join(' ') : ctx.stdin.replace(/\n$/, '');
    ctx.stdout.write(cowSay(text, { width, eyes, tongue, noWrap }));
  },
};
