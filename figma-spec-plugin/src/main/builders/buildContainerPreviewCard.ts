/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginRectangle, createPluginText } from '../figma/pluginSceneNodes';

import type { StyleResolver } from '../tokens/styleResolver';
import { SPEC_TOKEN_MAP, specColorFallbackRgb } from '../tokens/tokenMap';
import { getNodeByIdSafeAsync } from '../figma/documentAccess';
import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';
import { getRelativeVisualBounds } from '../figma/visualBounds';
import { getNodeByPath, getNodePathFromRoot } from '../figma/nodePath';
import { createChildOverlaysForTarget } from '../overlays/childOverlay';
import { createGapOverlaysForTarget } from '../overlays/gapOverlay';
import {
  computePaddingValueSquareAnchors,
  roundRect,
  type OverlayGeometryContext,
  type Rect,
} from '../overlays/overlayGeometry';
import {
  createPaddingOverlay,
  PADDING_OVERLAY_LAYOUT,
  type TokenizedSpacingValue,
} from '../overlays/paddingOverlay';
import {
  applyTargetOutlineStroke,
  createTargetContainerOutline,
} from '../overlays/targetOutline';
import { loadFontOnce } from '../figma/text';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

export type PreviewSectionSettings = {
  childOverlays?: boolean;
  gapOverlays?: boolean;
  paddingOverlays?: boolean;
};

export type PreviewContainerPadding = {
  top: TokenizedSpacingValue;
  right: TokenizedSpacingValue;
  bottom: TokenizedSpacingValue;
  left: TokenizedSpacingValue;
};

export type PreviewContainerSpec = {
  id?: string;
  name?: string;
  padding: PreviewContainerPadding;
  spacing?: { gap?: TokenizedSpacingValue | null };
  layout?: { direction?: string };
};

export type CreatePaddingVisualizationOptions = {
  targetNodeId?: string;
  maxPreviewHeight?: number;
};

function canCloneNode(node: SceneNode | null | undefined): node is SceneNode & {
  clone: () => SceneNode;
} {
  return !!node && typeof node.clone === 'function';
}

function normalizePreviewSections(sections: Record<string, unknown>): PreviewSectionSettings {
  return {
    childOverlays: sections.childOverlays !== false,
    gapOverlays: sections.gapOverlays !== false,
    paddingOverlays: sections.paddingOverlays !== false,
  };
}

function roundPaddingValue(value: number): number {
  const raw = Math.max(0, Number(value) || 0);
  if (raw === 0) return 0;
  return Math.round(raw);
}

async function createPreviewUnavailableWrap(
  message: string,
  width?: number
): Promise<FrameNode> {
  const wrap = createPluginFrame();
  wrap.name = 'Preview wrapper';
  wrap.layoutMode = 'VERTICAL';
  wrap.fills = [];
  wrap.clipsContent = false;

  await loadFontOnce(FONT_REGULAR);
  const text = createPluginText();
  text.name = 'Preview unavailable';
  text.fontName = FONT_REGULAR;
  text.fontSize = 12;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }];
  text.characters = message;
  if (width && width > 0) {
    text.textAutoResize = 'HEIGHT';
    text.resize(Math.max(40, width - 4), text.height);
  }
  wrap.appendChild(text);
  return wrap;
}

function createPreviewWrapper(width: number, height: number): FrameNode {
  const wrapper = createPluginFrame();
  wrapper.name = 'Preview wrapper';
  wrapper.layoutMode = 'NONE';
  wrapper.clipsContent = false;
  wrapper.fills = [];
  wrapper.strokes = [];
  wrapper.resize(Math.max(1, width), Math.max(1, height));
  return wrapper;
}

function createOverlayContainer(width: number, height: number): FrameNode {
  const container = createPluginFrame();
  container.name = 'Overlay container';
  container.layoutMode = 'NONE';
  container.clipsContent = false;
  container.fills = [];
  container.strokes = [];
  container.x = 0;
  container.y = 0;
  container.resize(Math.max(1, width), Math.max(1, height));
  return container;
}

function intersectRects(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return roundRect({ x, y, width, height });
}

function createNonTargetOverlayRect(
  name: string,
  bounds: Rect,
  fillColor: RGB,
  fillOpacity: number
): RectangleNode | null {
  const normalized = roundRect(bounds);
  if (normalized.width <= 0 || normalized.height <= 0) return null;
  const rect = createPluginRectangle();
  rect.name = name;
  rect.x = Math.round(normalized.x);
  rect.y = Math.round(normalized.y);
  rect.resize(Math.max(1, Math.round(normalized.width)), Math.max(1, Math.round(normalized.height)));
  rect.fills = [{ type: 'SOLID', color: fillColor, opacity: fillOpacity }];
  rect.strokes = [];
  return rect;
}

function createSpecNonTargetOverlay(params: {
  previewBounds: Rect;
  targetBounds: Rect;
  overlayFill?: RGB;
  overlayOpacity?: number;
}): FrameNode | null {
  const { previewBounds, targetBounds } = params;
  const overlayFill = params.overlayFill ?? { r: 1, g: 1, b: 1 };
  const overlayOpacity = params.overlayOpacity ?? 0.72;

  const clampedTarget = intersectRects(previewBounds, targetBounds);
  if (!clampedTarget) {
    console.warn('[Spec] Skipping non-target overlay: target bounds do not intersect preview bounds');
    return null;
  }

  const overlay = createPluginFrame();
  overlay.name = 'Spec non-target overlay';
  overlay.layoutMode = 'NONE';
  overlay.clipsContent = false;
  overlay.fills = [];
  overlay.strokes = [];
  overlay.x = 0;
  overlay.y = 0;
  overlay.resize(Math.max(1, previewBounds.width), Math.max(1, previewBounds.height));

  const top = createNonTargetOverlayRect(
    'Spec non-target overlay / Top',
    {
      x: previewBounds.x,
      y: previewBounds.y,
      width: previewBounds.width,
      height: clampedTarget.y - previewBounds.y,
    },
    overlayFill,
    overlayOpacity
  );
  const bottom = createNonTargetOverlayRect(
    'Spec non-target overlay / Bottom',
    {
      x: previewBounds.x,
      y: clampedTarget.y + clampedTarget.height,
      width: previewBounds.width,
      height: previewBounds.y + previewBounds.height - (clampedTarget.y + clampedTarget.height),
    },
    overlayFill,
    overlayOpacity
  );
  const left = createNonTargetOverlayRect(
    'Spec non-target overlay / Left',
    {
      x: previewBounds.x,
      y: clampedTarget.y,
      width: clampedTarget.x - previewBounds.x,
      height: clampedTarget.height,
    },
    overlayFill,
    overlayOpacity
  );
  const right = createNonTargetOverlayRect(
    'Spec non-target overlay / Right',
    {
      x: clampedTarget.x + clampedTarget.width,
      y: clampedTarget.y,
      width: previewBounds.x + previewBounds.width - (clampedTarget.x + clampedTarget.width),
      height: clampedTarget.height,
    },
    overlayFill,
    overlayOpacity
  );

  if (top) overlay.appendChild(top);
  if (bottom) overlay.appendChild(bottom);
  if (left) overlay.appendChild(left);
  if (right) overlay.appendChild(right);

  if (!overlay.children.length) {
    return null;
  }

  return overlay;
}

/**
 * Builds preview clone + spacing overlays at original component size (no preview scaling).
 */
export async function createPaddingVisualization(
  container: PreviewContainerSpec,
  rootSourceNode: SceneNode,
  usableInnerWidth: number,
  _designTokens: unknown,
  sections: Record<string, unknown>,
  options?: CreatePaddingVisualizationOptions
): Promise<FrameNode> {
  void usableInnerWidth;
  void options?.maxPreviewHeight;

  const previewSections = normalizePreviewSections(sections || {});

  if (!canCloneNode(rootSourceNode)) {
    return createPreviewUnavailableWrap('Preview недоступен', usableInnerWidth);
  }

  const targetNodeId =
    options?.targetNodeId != null && options.targetNodeId !== ''
      ? options.targetNodeId
      : rootSourceNode.id;

  const resolvedTarget = await getNodeByIdSafeAsync(targetNodeId);
  const originalTargetNode: SceneNode =
    resolvedTarget && resolvedTarget.type !== 'PAGE' && resolvedTarget.type !== 'DOCUMENT'
      ? (resolvedTarget as SceneNode)
      : rootSourceNode;

  const targetPath = getNodePathFromRoot(rootSourceNode, originalTargetNode);
  const targetDisplayName = originalTargetNode.name || rootSourceNode.name || 'Component';
  const { visualBounds, rootOffset } = getRelativeVisualBounds(rootSourceNode);

  let rootClone: SceneNode;
  try {
    rootClone = rootSourceNode.clone();
    rootClone.name = `Preview / ${String(targetDisplayName)}`;
  } catch (e) {
    console.warn('Cannot clone source node', e);
    return createPreviewUnavailableWrap('Preview недоступен', usableInnerWidth);
  }

  let targetCloneNode: SceneNode = rootClone;
  if (targetPath && targetPath.length > 0) {
    const resolved = getNodeByPath(rootClone, targetPath);
    if (resolved) targetCloneNode = resolved;
  }

  const offsetX = Math.round(rootOffset.x);
  const offsetY = Math.round(rootOffset.y);

  let targetBounds: Rect;
  if (targetCloneNode.id === rootClone.id) {
    targetBounds = roundRect({
      x: offsetX,
      y: offsetY,
      width: rootClone.width,
      height: rootClone.height,
    });
  } else {
    const rel = getNodeBoundsRelativeToRoot(targetCloneNode, rootClone);
    targetBounds = roundRect({
      x: rel.x + offsetX,
      y: rel.y + offsetY,
      width: rel.width,
      height: rel.height,
    });
  }

  const cw = Math.max(1, Math.round(visualBounds.width));
  const ch = Math.max(1, Math.round(visualBounds.height));

  const targetX = targetBounds.x;
  const targetY = targetBounds.y;
  const targetWidth = Math.max(1, targetBounds.width);
  const targetHeight = Math.max(1, targetBounds.height);

  const pad = container.padding;
  const top = roundPaddingValue(pad.top.value);
  const right = roundPaddingValue(pad.right.value);
  const bottom = roundPaddingValue(pad.bottom.value);
  const left = roundPaddingValue(pad.left.value);

  const topSize = Math.min(top, targetHeight);
  const bottomSize = Math.min(bottom, targetHeight);
  const leftSize = Math.min(left, targetWidth);
  const rightSize = Math.min(right, targetWidth);

  const extra = PADDING_OVERLAY_LAYOUT.extraSize;

  const paddingValueAnchors = computePaddingValueSquareAnchors({
    targetX,
    targetY,
    targetWidth,
    targetHeight,
    topSize,
    rightSize,
    bottomSize,
    leftSize,
    extra,
    valueSquareGap: PADDING_OVERLAY_LAYOUT.valueSquareGap,
  });

  const containerLayoutDirection =
    container.layout?.direction === 'horizontal' ? 'horizontal' : 'vertical';

  const overlayGeometry: OverlayGeometryContext = {
    rootClone,
    targetClone: targetCloneNode,
    targetBounds: { x: targetX, y: targetY, width: targetWidth, height: targetHeight },
    previewScale: 1,
    padding: {
      top: topSize,
      right: rightSize,
      bottom: bottomSize,
      left: leftSize,
    },
    paddingValueAnchors,
    containerLayoutDirection,
  };

  rootClone.x = offsetX;
  rootClone.y = offsetY;

  const previewWrapper = createPreviewWrapper(cw, ch);
  previewWrapper.appendChild(rootClone);

  const overlayContainer = createOverlayContainer(cw, ch);
  previewWrapper.appendChild(overlayContainer);

  const nonTargetOverlay = createSpecNonTargetOverlay({
    previewBounds: { x: 0, y: 0, width: cw, height: ch },
    targetBounds,
  });
  if (nonTargetOverlay) {
    overlayContainer.appendChild(nonTargetOverlay);
  }

  if (previewSections.childOverlays !== false) {
    const childOverlays = await createChildOverlaysForTarget(targetCloneNode, rootClone);
    for (const co of childOverlays) {
      overlayContainer.appendChild(co);
    }
  }

  if (previewSections.gapOverlays !== false) {
    const gapOverlays = await createGapOverlaysForTarget(overlayGeometry, container);
    for (const go of gapOverlays) {
      overlayContainer.appendChild(go);
    }
  }

  if (previewSections.paddingOverlays !== false) {
    const oTop = await createPaddingOverlay('Top', pad.top, {
      x: targetX - extra,
      y: targetY,
      width: targetWidth + extra,
      height: topSize,
    });

    const oRight = await createPaddingOverlay('Right', pad.right, {
      x: targetX + targetWidth - rightSize,
      y: targetY - extra,
      width: rightSize,
      height: targetHeight + extra,
      topOverlayHeight: topSize,
      bottomOverlayHeight: bottomSize,
    });

    const oBottom = await createPaddingOverlay('Bottom', pad.bottom, {
      x: targetX - extra,
      y: targetY + targetHeight - bottomSize,
      width: targetWidth + extra,
      height: bottomSize,
    });

    const oLeft = await createPaddingOverlay('Left', pad.left, {
      x: targetX,
      y: targetY - extra,
      width: leftSize,
      height: targetHeight + extra,
      topOverlayHeight: topSize,
      bottomOverlayHeight: bottomSize,
    });

    if (oTop) overlayContainer.appendChild(oTop.node);
    if (oRight) overlayContainer.appendChild(oRight.node);
    if (oBottom) overlayContainer.appendChild(oBottom.node);
    if (oLeft) overlayContainer.appendChild(oLeft.node);
  }

  const targetOutline = createTargetContainerOutline(targetBounds);
  await applyTargetOutlineStroke(targetOutline);
  overlayContainer.appendChild(targetOutline);

  return previewWrapper;
}

/**
 * Только `Background/Secondary` через StyleResolver для фрейма `Container preview card`.
 */
export async function applyContainerPreviewCardTokens(
  previewCard: FrameNode,
  resolver: StyleResolver
): Promise<void> {
  previewCard.opacity = 1;

  try {
    if ('fillStyleId' in previewCard && previewCard.fillStyleId) {
      previewCard.fillStyleId = '';
    }
  } catch {
    /* ignore */
  }

  try {
    previewCard.strokeWeight = 0;
    previewCard.strokes = [];
  } catch {
    /* ignore */
  }

  const def = SPEC_TOKEN_MAP.colors.backgroundSecondary;
  const fb = specColorFallbackRgb(def.fallback as RGB | `#${string}`);

  await resolver.applyFill(previewCard, [...def.names], fb, 1, {
    preferredCollectionNames: def.preferredCollectionNames,
    debugTokenKey: 'backgroundSecondary',
    debugNodeLabel: 'Container preview card',
  });
}
