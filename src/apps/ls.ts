import type { Command } from '../shell/types';
import { RESET } from '../term/ansi';
import { ui } from '../term/palette';

const DIR = ui.dir; // blue — directories, with a default-color trailing slash

export const ls: Command = {
  name: 'ls',
  description: 'list directory contents: ls [dir]',
  async run(ctx, argv) {
    const target = argv[1] ?? '.';
    const entries = ctx.listDir(target);
    if (!entries) {
      ctx.stdout.print(`ls: ${target}: not a directory`);
      return;
    }
    if (entries.length === 0) {
      ctx.stdout.print('(empty)');
      return;
    }
    for (const e of entries) {
      const name = e.dir ? `${DIR}${e.name}${RESET}/` : e.name;
      ctx.stdout.print(`  ${name}`);
    }
  },
};
