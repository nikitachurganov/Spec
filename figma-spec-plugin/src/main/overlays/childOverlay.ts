/// <reference types="@figma/plugin-typings" />
import { createPluginFrame } from '../figma/pluginSceneNodes';

import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { hexToRgb } from '../tokens/tokenMap';

const CHILD_OVERLAY_TYPES: Record<string, boolean> = {
  TEXT: true,
  INSTANCE: true,
  COMPONENT: true,
  FRAME: true,
  RECTANGLE: true,
  ELLIPSE: true,
  VECTOR: true,
  BOOLEAN_OPERATION: true,
  GROUP: true,
};

function shouldCreateChildOverlay(node: SceneNode): boolean {
  if (!CHILD_OVERLAY_TYPES[node.type]) return false;
  if ('visible' in node && node.visible === false) return false;
  const name = String(node.name || '');
  if (name.indexOf('_') === 0) return false;
  if (name.indexOf('Padding overlay') === 0) return false;
  if (name.indexOf('Child overlay') === 0) return false;
  if (name.indexOf('Gap overlay') === 0) return false;
  if (name.indexOf('Preview /') === 0) return false;
  if (name.indexOf('Target container outline') === 0) return false;

  const box = node.absoluteBoundingBox;
  const localOk =
    typeof node.width === 'number' &&
    typeof node.height === 'number' &&
    node.width > 0 &&
    node.height > 0;
  const boxOk =
    box &&
    typeof box.width === 'number' &&
    typeof box.height === 'number' &&
    box.width > 0 &&
    box.height > 0;

  return localOk || !!boxOk;
}

async function applyChildOverlaySemantics(overlay: FrameNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (!ctx?.apply?.applySemanticColorKey || !ctx.resolver) {
    overlay.fills = [{ type: 'SOLID', color: hexToRgb('#449AFF'), opacity: 0.2 }];
    return;
  }
  try {
    await ctx.apply.applySemanticColorKey(overlay, 'childOverlayFill', ctx.resolver, 'fill');
    overlay.strokeWeight = 1;
    await ctx.apply.applySemanticColorKey(overlay, 'childOverlayStroke', ctx.resolver, 'stroke');
  } catch (e) {
    console.warn('[StyleResolver] child overlay', e);
  }
}

async function createChildOverlay(
  child: SceneNode,
  rootClone: SceneNode
): Promise<FrameNode | null> {
  if (!shouldCreateChildOverlay(child)) return null;

  const bounds = getNodeBoundsRelativeToRoot(child, rootClone);
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const overlay = createPluginFrame();
  overlay.name = `Child overlay / ${child.name}`;
  overlay.layoutMode = 'NONE';
  overlay.clipsContent = false;
  overlay.x = bounds.x;
  overlay.y = bounds.y;
  overlay.resize(bounds.width, bounds.height);
  overlay.fills = [{ type: 'SOLID', color: hexToRgb('#449AFF'), opacity: 0.2 }];
  overlay.strokes = [];
  overlay.cornerRadius = 0;

  await applyChildOverlaySemantics(overlay);
  return overlay;
}

export async function createChildOverlaysForTarget(
  targetNode: SceneNode,
  rootClone: SceneNode
): Promise<FrameNode[]> {
  const overlays: FrameNode[] = [];
  if (!('children' in targetNode)) return overlays;

  for (const child of targetNode.children) {
    const co = await createChildOverlay(child as SceneNode, rootClone);
    if (co) overlays.push(co);
  }
  return overlays;
}
