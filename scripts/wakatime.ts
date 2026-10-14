// Build-time generator for the terminal's `wakatime` page.
//
// Credit: the template model (inline {expr} tokens plus CUSTOM_WAKA START/END
// code blocks sharing one scope), and the parser/compile/run design below, are
// adapted from Twisuki/custom_waka_readme —
// https://github.com/Twisuki/custom_waka_readme
//
// The template at .github/wakatime-template.md may contain:
//   - {expr}   inline JS expression, stringified into the output
//   - <!--CUSTOM_WAKA_START--> ... <!--CUSTOM_WAKA_END-->   a JS block whose
//     variables are shared, top-to-bottom in source order, with later tokens
// The wakatime data (allTime, last14, updatedAt) is injected as globals, the
// whole program is compiled and run in a node:vm context, and the result is
// written to content/wakatime.md. The content compiler then exposes it as the
// `wakatime` command. Meant to run during deploy: without WAKATIME_API_KEY it
// is a no-op so local builds keep working.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TEMPLATE = join(ROOT, '.github', 'wakatime-template.md');
const OUT = join(ROOT, 'content', 'wakatime.md');
const DAYS = 14;

// region wakatime data

interface RawStats {
  total_seconds: number;
  start: string;
  end: string;
  days_including_holidays: number;
  days_minus_holidays: number;
  holidays: number;
  username: string;
}

interface RawSummaryItem {
  name: string;
  total_seconds: number;
}

interface RawSummaryDay {
  grand_total: { total_seconds: number };
  languages?: RawSummaryItem[];
  editors?: RawSummaryItem[];
  range: { date: string };
}

interface RawSummaries {
  data: RawSummaryDay[];
}

interface NamedStat {
  name: string;
  time: number;
}

export interface WakaContext {
  username: string;
  allTime: {
    time: number;
    start: string;
    end: string;
    days: number;
    daysMinusHolidays: number;
    holidays: number;
  } | null;
  last14: {
    label: string;
    start: string;
    end: string;
    total: number;
    days: Array<{ date: string; time: number }>;
    languages: NamedStat[];
    editors: NamedStat[];
  };
  updatedAt: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aggregate(items: RawSummaryItem[] | undefined, acc: Map<string, number>): void {
  for (const it of items ?? []) acc.set(it.name, (acc.get(it.name) ?? 0) + it.total_seconds);
}

function ranked(acc: Map<string, number>): NamedStat[] {
  return [...acc.entries()].map(([name, time]) => ({ name, time })).sort((a, b) => b.time - a.time);
}

async function fetchStats(range: string, apiKey: string): Promise<RawStats | null> {
  const url = `https://wakatime.com/api/v1/users/current/stats/${range}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wakatime ${range}: HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { data?: RawStats };
  return body.data ?? null;
}

async function fetchSummaries(apiKey: string): Promise<RawSummaries | null> {
  const range = encodeURIComponent(`Last ${DAYS} Days`);
  const url = `https://wakatime.com/api/v1/users/current/summaries?range=${range}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wakatime summaries: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as RawSummaries;
}

/** Fetch all-time stats + last-14-days summaries, shape for the template. */
export async function getData(apiKey: string): Promise<WakaContext> {
  const [stats, summaries] = await Promise.all([
    fetchStats('all_time', apiKey).catch((e) => {
      console.warn(`wakatime: stats/all_time failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }),
    fetchSummaries(apiKey).catch((e) => {
      console.warn(`wakatime: summaries failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }),
  ]);

  const days = (summaries?.data ?? []).map((d) => ({
    date: d.range.date,
    time: d.grand_total.total_seconds ?? 0,
  }));
  const langAcc = new Map<string, number>();
  const editorAcc = new Map<string, number>();
  for (const d of summaries?.data ?? []) {
    aggregate(d.languages, langAcc);
    aggregate(d.editors, editorAcc);
  }

  const today = new Date();
  const fallbackEnd = isoDay(today);
  const fallbackStart = isoDay(new Date(today.getTime() - (DAYS - 1) * 86_400_000));

  return {
    username: stats?.username ?? '',
    allTime: stats
      ? {
          time: stats.total_seconds,
          start: stats.start.slice(0, 10),
          end: stats.end.slice(0, 10),
          days: stats.days_including_holidays,
          daysMinusHolidays: stats.days_minus_holidays,
          holidays: stats.holidays,
        }
      : null,
    last14: {
      label: `${DAYS} days`,
      start: days[0]?.date ?? fallbackStart,
      end: days[days.length - 1]?.date ?? fallbackEnd,
      total: days.reduce((sum, d) => sum + d.time, 0),
      days,
      languages: ranked(langAcc),
      editors: ranked(editorAcc),
    },
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

// endregion

// region template (ported from custom_waka_readme src/parse + src/runtime)

type NodeType = 'static' | 'block' | 'token';

interface Node {
  type: NodeType;
  index: number;
  line: number;
  content: string;
}

const START_TAG = '<!--CUSTOM_WAKA_START-->\n';
const END_TAG = '<!--CUSTOM_WAKA_END-->\n';
const TOKEN_REGEX = /\{[^{}\n]*\}/g;

/** 1-based source line of an offset. */
function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/** Split [start, end) into static/token nodes. `{{...}}` escapes one brace layer. */
function tokenize(text: string, start: number, end: number, out: Omit<Node, 'index'>[]): void {
  const regex = TOKEN_REGEX;
  regex.lastIndex = start;
  let lastEnd = start;
  let match = regex.exec(text);
  while (match !== null && match.index < end) {
    if (match.index > lastEnd) {
      out.push({ type: 'static', line: lineOf(text, lastEnd), content: text.slice(lastEnd, match.index) });
    }
    const isMulti = text[match.index - 1] === '{' && text[match.index + match[0].length] === '}';
    out.push({
      type: isMulti ? 'static' : 'token',
      line: lineOf(text, match.index),
      content: match[0].slice(1, -1),
    });
    lastEnd = match.index + match[0].length;
    match = regex.exec(text);
  }
  if (lastEnd < end) {
    out.push({ type: 'static', line: lineOf(text, lastEnd), content: text.slice(lastEnd, end) });
  }
}

export function parseTemplate(text: string): Node[] {
  const drafts: Omit<Node, 'index'>[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const blockStart = text.indexOf(START_TAG, cursor);
    if (blockStart === -1) {
      tokenize(text, cursor, text.length, drafts);
      break;
    }
    const blockEnd = text.indexOf(END_TAG, blockStart);
    if (blockEnd === -1) {
      throw new Error(`wakatime-template.md:${lineOf(text, blockStart)} unclosed <!--CUSTOM_WAKA_START--> block`);
    }
    tokenize(text, cursor, blockStart, drafts);
    drafts.push({
      type: 'block',
      line: lineOf(text, blockStart),
      content: text.slice(blockStart + START_TAG.length, blockEnd),
    });
    cursor = blockEnd + END_TAG.length;
  }
  return drafts.map((n, i) => ({ ...n, index: i }));
}

/** Compile block/token nodes into one program that fills `__token__[]`. */
function compile(nodes: Node[]): string {
  const lines: string[] = [];
  let tokenIndex = 0;
  for (const node of nodes) {
    if (node.type === 'static') continue;
    lines.push(`  __flag__ = { type: ${JSON.stringify(node.type)}, line: ${node.line} }`);
    if (node.type === 'block') {
      lines.push(`  ${node.content}`);
    } else {
      lines.push(`  __token__[${tokenIndex}] = (${node.content})`);
      tokenIndex++;
    }
  }
  lines.push('  __flag__ = null');
  return [
    'let __flag__',
    'var __token__ = []',
    'try {',
    lines.join('\n'),
    '}',
    'catch (e) {',
    '  const f = __flag__',
    "  throw f ? new Error('wakatime-template.md:' + f.line + ' (' + f.type + ') ' + e.message) : e",
    '}',
  ].join('\n');
}

/** Parse, evaluate in a vm context with `data` as globals, splice results back. */
export function renderTemplate(template: string, data: object): string {
  const nodes = parseTemplate(template);
  const source = compile(nodes);
  const sandbox = { ...data } as Record<string, unknown>;
  const tokens = runInNewContext(`${source}\n__token__`, sandbox, { timeout: 10_000 }) as unknown[];
  let tokenIndex = 0;
  return nodes
    .map((node) => {
      if (node.type === 'static') return node.content;
      if (node.type === 'block') return '';
      return String(tokens[tokenIndex++]);
    })
    .join('');
}

// endregion

export async function generateWakatime(): Promise<void> {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) {
    console.log('wakatime: WAKATIME_API_KEY not set, skipping content/wakatime.md');
    return;
  }
  const template = readFileSync(TEMPLATE, 'utf8');
  const data = await getData(apiKey);
  writeFileSync(OUT, renderTemplate(template, data));
  console.log(`wakatime: wrote ${relative(ROOT, OUT)}`);
}

// CLI: `tsx scripts/wakatime.ts`
if (basename(process.argv[1] ?? '') === 'wakatime.ts') {
  generateWakatime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
