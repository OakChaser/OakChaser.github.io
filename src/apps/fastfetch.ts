// fastfetch — a fixed, fake system summary (Tux penguin logo + NyanOS info).
// No real detection: it always prints the same block, just for flavor.
import type { Command } from '../shell/types';

// Tux penguin, as fastfetch's built-in `linux` logo.
const LOGO = [
  '        #####',
  '       #######',
  '       ##O#O##',
  '       #######',
  '     ###########',
  '    #############',
  '   ###############',
  '   ################',
  '  #################',
  '#####################',
  '#####################',
  '  #################',
];

const INFO = [
  'oakchaser@NyanOS',
  '----------------',
  'OS: NyanOS 1.0.0 (Mocha) x86_64',
  'Host: nyachaser (NyanOS @ oakchaser.me)',
  'Kernel: nya 6.9.0-nyan',
  'Uptime: 9 days, 15 hours, 46 mins',
  'Packages: 206 (nya), 30 (cask)',
  'Shell: nya_zsh 5.9',
  'Terminal: xterm.js',
  'WM: NyanWM',
  'CPU: Neko Core i9 (8) @ 3.60 GHz',
  'GPU: Nyan Cat (20) @ 1.58 GHz [Integrated]',
  'Memory: 6.66 GiB / 16.00 GiB (42%)',
  'Disk (/): 42.00 GiB / 100.00 GiB (42%)',
  'Locale: en_US.UTF-8',
];

export const fastfetch: Command = {
  name: 'fastfetch',
  description: 'print a (fake) system summary',
  async run(ctx) {
    const logoW = Math.max(...LOGO.map((l) => l.length));
    const rows = Math.max(LOGO.length, INFO.length);
    for (let i = 0; i < rows; i++) {
      const left = (LOGO[i] ?? '').padEnd(logoW);
      const right = INFO[i] ?? '';
      ctx.stdout.print(right ? `${left}    ${right}` : left.replace(/\s+$/, ''));
    }
  },
};
