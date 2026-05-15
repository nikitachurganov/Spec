/**
 * Rebuilds code.js from anatomy-generator.js and ui.html.
 *
 * Current layout (after fix):
 * - Anatomy block after loadSpecFonts, before function stretchChildHorizontal.
 * - At EOF: PLUGIN_UI embed + figma.showUI + onmessage + figma.on + sendSelectionInfo.
 *
 * Run from this folder: node sync-plugin-code.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var dir = __dirname;
var codePath = path.join(dir, 'code.js');
var agPath = path.join(dir, 'anatomy-generator.js');
var uiPath = path.join(dir, 'ui.html');

var code = fs.readFileSync(codePath, 'utf8');
var ag = fs.readFileSync(agPath, 'utf8');
var ui = fs.readFileSync(uiPath, 'utf8');

var agMark = 'var AnatomyGenerator = (function () {';
var agStart = ag.indexOf(agMark);
if (agStart === -1) {
  throw new Error('anatomy-generator.js: missing ' + agMark);
}
var agEnd = ag.lastIndexOf('})();');
if (agEnd === -1) {
  throw new Error('anatomy-generator.js: missing closing })();');
}
var agBlock = ag.slice(agStart, agEnd + '})();'.length);

var hstart = agBlock.indexOf('  function hexToRgb(hex) {');
var hend = agBlock.indexOf('  var ANATOMY_COLORS', hstart);
if (hstart === -1 || hend === -1) {
  throw new Error('Could not strip inner hexToRgb from anatomy block.');
}
agBlock = agBlock.slice(0, hstart) + agBlock.slice(hend);

var anatomyFull =
  '// AnatomyGenerator module. Keep this block isolated so it can be copied to another Figma plugin.\n\n' +
  agBlock;

var oldHexFn =
  "function hexToRgb(hex) {\n" +
  "  var normalized = String(hex).replace('#', '');\n" +
  "  var bigint = parseInt(normalized, 16);\n" +
  "  return {\n" +
  "    r: ((bigint >> 16) & 255) / 255,\n" +
  "    g: ((bigint >> 8) & 255) / 255,\n" +
  "    b: (bigint & 255) / 255,\n" +
  "  };\n" +
  "}\n";

var newHexFn =
  "function hexToRgb(hex) {\n" +
  "  var s = String(hex || '').replace(/^#/, '');\n" +
  "  if (s.length === 3) {\n" +
  "    s =\n" +
  "      s.charAt(0) +\n" +
  "      s.charAt(0) +\n" +
  "      s.charAt(1) +\n" +
  "      s.charAt(1) +\n" +
  "      s.charAt(2) +\n" +
  "      s.charAt(2);\n" +
  "  }\n" +
  "  var n = parseInt(s, 16);\n" +
  "  if (isNaN(n) || s.length !== 6) {\n" +
  "    return { r: 0, g: 0, b: 0 };\n" +
  "  }\n" +
  "  return {\n" +
  "    r: ((n >> 16) & 255) / 255,\n" +
  "    g: ((n >> 8) & 255) / 255,\n" +
  "    b: (n & 255) / 255,\n" +
  "  };\n" +
  "}\n";

function applyHexUpgrade(src) {
  if (src.indexOf(oldHexFn) !== -1) {
    return src.split(oldHexFn).join(newHexFn);
  }
  return src;
}

if (code.indexOf('/* PLUGIN_UI_EMBED_BEGIN */') !== -1) {
  var anaMarker =
    '// AnatomyGenerator module. Keep this block isolated so it can be copied to another Figma plugin.';
  var anaStart = code.indexOf(anaMarker);
  if (anaStart === -1) {
    throw new Error('code.js: missing AnatomyGenerator marker.');
  }
  var closeNeedle = '})();\n\nfunction stretchChildHorizontal(f) {';
  var closePos = code.indexOf(closeNeedle, anaStart);
  if (closePos === -1) {
    throw new Error('code.js: anatomy block end anchor not found.');
  }
  var anaEnd = closePos + '})();'.length;
  code = code.slice(0, anaStart) + anatomyFull + code.slice(anaEnd);

  var uiStart = code.indexOf('/* PLUGIN_UI_EMBED_BEGIN */');
  var showPos = code.indexOf('figma.showUI((typeof __html__', uiStart);
  if (uiStart === -1 || showPos === -1) {
    throw new Error('code.js: PLUGIN_UI embed or figma.showUI not found.');
  }
  var newEmbed =
    '\n// Inlined ui.html when __html__ is missing after clone/import.\n' +
    '/* PLUGIN_UI_EMBED_BEGIN */\n' +
    'var PLUGIN_UI_HTML_FALLBACK = ' +
    JSON.stringify(ui) +
    ';\n' +
    '/* PLUGIN_UI_EMBED_END */\n\n';
  code = code.slice(0, uiStart) + newEmbed + code.slice(showPos);

  code = applyHexUpgrade(code);
  fs.writeFileSync(codePath, code);
  console.log('OK: refreshed anatomy + UI embed in', codePath);
  process.exit(0);
}

var oldStart = code.indexOf('// AnatomyGenerator module.');
if (oldStart === -1) {
  throw new Error('code.js: missing AnatomyGenerator marker.');
}
var bootStart = code.lastIndexOf('figma.showUI(typeof __html__', oldStart);
if (bootStart === -1) {
  throw new Error('code.js: legacy figma.showUI not found before anatomy block.');
}
var bootEndMarker =
  "figma.on('selectionchange', sendSelectionInfo);\n\nsendSelectionInfo();";
var bootEnd = code.indexOf(bootEndMarker, bootStart);
if (bootEnd === -1) {
  bootEndMarker =
    "figma.on('selectionchange', sendSelectionInfo);\r\n\r\nsendSelectionInfo();";
  bootEnd = code.indexOf(bootEndMarker, bootStart);
}
if (bootEnd === -1) {
  throw new Error('code.js: missing bootstrap tail (figma.on + sendSelectionInfo).');
}
bootEnd += bootEndMarker.length;
while (bootEnd < code.length && (code[bootEnd] === '\n' || code[bootEnd] === '\r')) {
  bootEnd++;
}

var codeMid = code.slice(0, bootStart) + code.slice(bootEnd, oldStart);
codeMid = applyHexUpgrade(codeMid);

var needle = '}\n\n\nfunction stretchChildHorizontal(f) {';
var ni = codeMid.indexOf(needle);
if (ni === -1) {
  throw new Error('code.js: insert needle after loadSpecFonts not found.');
}
var afterBraces = ni + '}\n\n\n'.length;
codeMid =
  codeMid.slice(0, afterBraces) + anatomyFull + '\n\n' + codeMid.slice(afterBraces);

var uiEmbed =
  '\n// Inlined ui.html when __html__ is missing after clone/import.\n' +
  '/* PLUGIN_UI_EMBED_BEGIN */\n' +
  'var PLUGIN_UI_HTML_FALLBACK = ' +
  JSON.stringify(ui) +
  ';\n' +
  '/* PLUGIN_UI_EMBED_END */\n\n' +
  "figma.showUI((typeof __html__ !== 'undefined' && __html__) ? __html__ : PLUGIN_UI_HTML_FALLBACK, {\n" +
  '  width: 520,\n' +
  '  height: 560,\n' +
  '});\n\n' +
  'figma.ui.onmessage = function (message) {\n' +
  "  if (!message || typeof message.type !== 'string') return;\n\n" +
  '  var payload = message.payload || {};\n\n' +
  '  var sectionSettings =\n' +
  "    payload && typeof payload === 'object' && payload.sections\n" +
  '      ? payload.sections\n' +
  '      : undefined;\n\n' +
  "  if (message.type === 'BUILD_SPECIFICATION') {\n" +
  '    void buildSpecification(sectionSettings);\n' +
  '    return;\n' +
  '  }\n\n' +
  "  if (message.type === 'GENERATE_SPEC' || message.type === 'GENERATE_MARKDOWN') {\n" +
  '    generateSpec(sectionSettings);\n' +
  '  }\n\n' +
  "  if (message.type === 'GENERATE_FRAMES') {\n" +
  '    void generateSpecFrames(sectionSettings);\n' +
  '  }\n\n' +
  "  if (message.type === 'GENERATE_ANATOMY') {\n" +
  '    void generateAnatomy();\n' +
  '  }\n\n' +
  "  if (message.type === 'REFRESH_SELECTION') sendSelectionInfo();\n" +
  '};\n\n' +
  "figma.on('selectionchange', sendSelectionInfo);\n\n" +
  'sendSelectionInfo();\n';

var out = codeMid + uiEmbed;
fs.writeFileSync(codePath, out);
console.log('OK: full rebuild wrote', codePath, 'bytes', out.length);
