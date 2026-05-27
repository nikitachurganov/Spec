/// <reference types="@figma/plugin-typings" />

import { attachNodeToActiveStagingPage } from '../tokens/specStyleContext';

export function createPluginFrame(): FrameNode {
  const node = figma.createFrame();
  attachNodeToActiveStagingPage(node);
  return node;
}

export function createPluginText(): TextNode {
  const node = figma.createText();
  attachNodeToActiveStagingPage(node);
  return node;
}

export function createPluginRectangle(): RectangleNode {
  const node = figma.createRectangle();
  attachNodeToActiveStagingPage(node);
  return node;
}

export function createPluginVector(): VectorNode {
  const node = figma.createVector();
  attachNodeToActiveStagingPage(node);
  return node;
}

export function createPluginLine(): LineNode {
  const node = figma.createLine();
  attachNodeToActiveStagingPage(node);
  return node;
}
