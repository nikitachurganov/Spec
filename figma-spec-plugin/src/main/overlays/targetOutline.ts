/// <reference types="@figma/plugin-typings" />
import { createPluginFrame } from '../figma/pluginSceneNodes';

import type { Rect } from './overlayGeometry';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { hexToRgb } from '../tokens/tokenMap';

export function createTargetContainerOutline(targetBounds: Rect): FrameNode {
  const outline = createPluginFrame();
  outline.name = 'Target container outline';
  outline.layoutMode = 'NONE';
  outline.clipsContent = false;

  outline.x = Math.round(targetBounds.x);
  outline.y = Math.round(targetBounds.y);
  outline.resize(
    Math.max(1, Math.round(targetBounds.width)),
    Math.max(1, Math.round(targetBounds.height))
  );

  outline.fills = [];
  outline.strokes = [{ type: 'SOLID', color: hexToRgb('#003F8A') }];
  outline.strokeWeight = 1;
  try {
    outline.strokeAlign = 'OUTSIDE';
  } catch {
    /* ignore */
  }
  outline.cornerRadius = 0;

  return outline;
}

export async function applyTargetOutlineStroke(outline: FrameNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (!ctx?.apply?.applySemanticColorKey || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      outline,
      'targetOutlineStroke',
      ctx.resolver,
      'stroke'
    );
    try {
      outline.strokeAlign = 'OUTSIDE';
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn('[StyleResolver] target outline', e);
  }
}
