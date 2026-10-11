// fastfetch — a fixed, fake system summary. No real detection except the "WM"
// line, which reports the visitor's browser. Colorized with Catppuccin Mocha.
import type { Command } from '../shell/types';
import { BOLD, RESET, fgHex } from '../term/ansi';
import { mocha } from '../term/palette';

const USER = 'oakchaser';
const HOST = 'nya_oakchaser';

/** Page-open time (module load = when the visitor opened the page). */
const START = Date.now();

/** Format an elapsed duration the way fastfetch does (`1 hour, 1 min, 1 sec`). */
export function formatUptime(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts: string[] = [];
  const push = (n: number, unit: string) => {
    if (n > 0) parts.push(`${n} ${unit}${n === 1 ? '' : 's'}`);
  };
  push(d, 'day');
  push(h, 'hour');
  push(m, 'min');
  push(s, 'sec');
  return parts.length ? parts.join(', ') : '0 secs';
}

/** Human-readable browser name + major version from the User-Agent. */
function browserLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  // Order matters: Edge/Opera also carry "Chrome", and Chrome carries "Safari".
  const probes: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of probes) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1].split('.')[0]}`;
  }
  return 'Browser';
}

function infoLines(): [key: string, value: string][] {
  return [
    ['OS', 'NyanOS 1.0.0 (Mocha) x86_64'],
    ['Host', HOST],
    ['Kernel', 'nya 6.9.0-nyan'],
    ['Uptime', formatUptime(Date.now() - START)],
    ['Packages', '206 (nya), 30 (cask)'],
    ['Shell', 'nya_zsh 5.9'],
    ['Terminal', 'xterm.js'],
    ['WM', browserLabel()],
    ['CPU', 'Neko Core i9 (8) @ 3.60 GHz'],
    ['GPU', 'Nyan Cat (20) @ 1.58 GHz [Integrated]'],
    ['Memory', '41.61 GiB / 48.00 GiB (87%)'],
    ['Disk (/)', '781.66 GiB / 926.35 GiB (84%) - apfs'],
    ['Locale', 'en_US.UTF-8'],
  ];
}

export const fastfetch: Command = {
  name: 'fastfetch',
  description: 'print a (fake) system summary',
  async run(ctx) {
    const title = `${USER}@${HOST}`;
    ctx.stdout.print(
      `${BOLD}${fgHex(mocha.blue)}${USER}${RESET}${fgHex(mocha.overlay0)}@${RESET}` +
        `${BOLD}${fgHex(mocha.blue)}${HOST}${RESET}`,
    );
    ctx.stdout.print(fgHex(mocha.overlay0) + '-'.repeat(title.length) + RESET);
    for (const [key, value] of infoLines()) {
      ctx.stdout.print(`${BOLD}${fgHex(mocha.mauve)}${key}${RESET}${fgHex(mocha.overlay0)}:${RESET} ${value}`);
    }
  },
};
