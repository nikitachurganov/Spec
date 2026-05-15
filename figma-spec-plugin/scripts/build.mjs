/**
 * 1) Vite → dist/ui.html + assets
 * 2) esbuild → dist/code.js with __html__ from dist/ui.html
 */
import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

/**
 * `figma.showUI(__html__)` injects HTML into an iframe with no base URL for
 * `dist/`, so `<script src="./assets/ui.js">` never loads. Inline CSS/JS.
 */
function resolveDistHref(href) {
  if (href.startsWith('./')) return path.join(distDir, href.slice(2));
  throw new Error(`Unexpected asset href (expected ./…): ${href}`);
}

function inlineUiHtmlForFigmaIframe(html) {
  let out = html;

  out = out.replace(/<link[^>]*>/gi, (full) => {
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(full)) return full;
    const hrefM = full.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefM) return full;
    const cssPath = resolveDistHref(hrefM[1]);
    const css = fs.readFileSync(cssPath, 'utf8');
    return `<style>${css}</style>`;
  });

  out = out.replace(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi, (full, src) => {
    if (!src.startsWith('./')) return full;
    const jsPath = resolveDistHref(src);
    let js = fs.readFileSync(jsPath, 'utf8');
    js = js.replace(/<\/script/gi, '<\\/script');
    return `<script type="module">${js}</script>`;
  });

  return out;
}

await viteBuild({ configFile: path.join(root, 'vite.config.ts') });

const uiPath = path.join(distDir, 'ui.html');
if (!fs.existsSync(uiPath)) {
  throw new Error('dist/ui.html missing after Vite build');
}
const htmlRaw = fs.readFileSync(uiPath, 'utf8');
const html = inlineUiHtmlForFigmaIframe(htmlRaw);
fs.writeFileSync(uiPath, html, 'utf8');

await esbuild.build({
  entryPoints: [path.join(root, 'src', 'main', 'code.ts')],
  bundle: true,
  outfile: path.join(root, 'dist', 'code.js'),
  format: 'iife',
  platform: 'browser',
  target: 'es2017',
  logLevel: 'info',
  define: {
    __html__: JSON.stringify(html),
  },
});

console.log('Built dist/code.js and dist/ui.html (assets inlined for showUI(__html__))');
