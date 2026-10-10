// Catppuccin Mocha — one source of truth for the whole site's color language.
// The same palette feeds the xterm.js theme, the shell prompt, the markdown
// renderer, and TUI apps, so everything shares a single coherent scheme.
import { fgHex } from './ansi';

/** Canonical Catppuccin Mocha hex values. */
export const mocha = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  lavender: '#b4befe',
  blue: '#89b4fa',
  sapphire: '#74c7ec',
  sky: '#89dceb',
  teal: '#94e2d5',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  peach: '#fab387',
  maroon: '#eba0ac',
  red: '#f38ba8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
} as const;

/** xterm.js theme (truecolor) built from Mocha. */
export const termTheme = {
  background: mocha.base,
  foreground: mocha.text,
  cursor: mocha.lavender,
  cursorAccent: mocha.base,
  selectionBackground: mocha.surface2,
  selectionForeground: mocha.text,
  black: mocha.surface1,
  red: mocha.red,
  green: mocha.green,
  yellow: mocha.yellow,
  blue: mocha.blue,
  magenta: mocha.pink,
  cyan: mocha.teal,
  white: mocha.subtext1,
  brightBlack: mocha.surface2,
  brightRed: mocha.red,
  brightGreen: mocha.green,
  brightYellow: mocha.yellow,
  brightBlue: mocha.blue,
  brightMagenta: mocha.pink,
  brightCyan: mocha.teal,
  brightWhite: mocha.subtext0,
} as const;

/** Semantic foreground roles shared across the UI. */
export const ui = {
  heading: fgHex(mocha.mauve), // section titles
  dir: fgHex(mocha.blue), // directories (ls / tree / completion)
  bullet: fgHex(mocha.overlay0), // list bullets
  border: fgHex(mocha.surface2), // rules / box connectors
  hr: fgHex(mocha.surface1), // horizontal rules
  host: fgHex(mocha.mauve), // prompt hostname
  cwd: fgHex(mocha.blue), // prompt path
  symbol: fgHex(mocha.overlay0), // prompt "$"
} as const;

/** Powerlevel10k (classic, Catppuccin Mocha) prompt glyphs. */
export const p10k = {
  head: '\uE0B6', // round head — left prompt first segment start
  tail: '\uE0B4', // round tail — left prompt last segment end
  subseg: '\uE0B1', // thin separator between same-background segments
  osIcon: '\uF17C', // Tux (nf-fa-linux)
  folderIcon: '\uF115', // nf-fa-folder-open-o
  prompt: '\u276F', // ❯ — transient (history) prompt
  okIcon: '\u2714', // ✔ — status: last command succeeded
  errIcon: '\u2718', // ✘ — status: last command failed
  /** Default segment background. */
  bg: mocha.surface0,
  osFg: mocha.text,
  dirFg: mocha.lavender,
  sepFg: mocha.overlay0,
  transientFg: mocha.green,
  transientErrFg: mocha.maroon,
  okFg: mocha.green,
  errFg: mocha.maroon,
} as const;

