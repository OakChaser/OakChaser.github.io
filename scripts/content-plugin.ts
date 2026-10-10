// Vite plugin: keeps src/generated/content.ts fresh.
// - runs the compiler once at buildStart (covers `vite` and `vite build`)
// - on dev server, recompiles whenever a file under content/ changes and live-reloads
// - prerenders the home page (index.md) into the HTML as semantic markup inside a
//   <noscript>, so crawlers and no-JS clients see real headings and links instead
//   of an empty JS-rendered terminal.
import type { Plugin } from 'vite';
import { marked } from 'marked';
import { buildContent } from './build-content';

export function contentPlugin(): Plugin {
  // Home-page body, captured whenever content is (re)built, so transformIndexHtml
  // can inline it without re-reading the manifest module.
  let homeBody = '';

  return {
    name: 'ghpage:content',

    async buildStart() {
      const m = await buildContent();
      homeBody = m.documents.find((d) => d.slug === 'index')?.body ?? '';
      this.info(`content: ${m.documents.length} doc(s), ${m.apps.length} app decl(s)`);
    },

    transformIndexHtml() {
      if (!homeBody) return;
      // Prerender index.md to semantic HTML (h1/h2, ul/li, real <a href>), so the
      // static response is crawlable. Internal links stay as "#slug", which the
      // terminal's hash router already runs as a command.
      const html = marked.parse(homeBody) as string;
      return [
        {
          tag: 'noscript',
          children: html,
          injectTo: 'body',
        },
      ];
    },

    configureServer(server) {
      const onChange = async (file: string) => {
        if (!file.replace(/\\/g, '/').includes('/content/')) return;
        try {
          const m = await buildContent();
          homeBody = m.documents.find((d) => d.slug === 'index')?.body ?? '';
          server.ws.send({ type: 'full-reload' });
          server.config.logger.info('content rebuilt', { timestamp: true });
        } catch (e) {
          server.config.logger.error(`content rebuild failed: ${String(e)}`, { error: e as Error });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
    },
  };
}
