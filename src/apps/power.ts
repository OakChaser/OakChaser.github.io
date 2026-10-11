// reboot / poweroff — system-ish commands that reload or close the page.
import type { Command, Context } from '../shell/types';
import { DIM, RESET } from '../term/ansi';

/** A brief delay so the message is visible before the page goes away. */
const DELAY = 500;

function broadcast(ctx: Context, verb: string): void {
  ctx.stdout.print(`${DIM}The system is going down for ${verb} NOW!${RESET}`);
}

export const reboot: Command = {
  name: 'reboot',
  description: 'restart the page',
  async run(ctx) {
    broadcast(ctx, 'reboot');
    if (typeof location === 'undefined') return;
    setTimeout(() => location.reload(), DELAY);
  },
};

export const poweroff: Command = {
  name: 'poweroff',
  description: 'close the tab (best effort)',
  async run(ctx) {
    broadcast(ctx, 'poweroff');
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      // Only script-opened windows may close themselves; browsers block this on
      // a normal tab. Try anyway, and fall back to a blank "off" screen.
      try {
        window.close();
      } catch {
        /* ignored */
      }
      setTimeout(() => {
        document.body.style.background = '#000';
        const app = document.getElementById('app');
        if (app) app.style.display = 'none';
      }, 150);
    }, DELAY);
  },
};
