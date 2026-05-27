/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';

import {
  collectSemanticAnatomyItems,
  getComponentPropertyMetadata,
} from './anatomyDecomposition';
import {
  calculatePointerPlacements,
  createAnatomyConnectorFrame,
  getDefaultConnectorColor,
  getPointerFrameBounds,
} from './anatomyGeometry';
import type {
  AnatomyGeneratorOptions,
  AnatomyItem,
  AnatomyPointerPlacement,
  AnatomyRect,
  ConnectorObstacle,
} from './anatomyTypes';
import {
  ANATOMY_COLORS,
  hexToRgb,
  mergeAnatomyOptions,
} from './anatomyStyles';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { getRelativeVisualBounds } from '../figma/visualBounds';
import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';

const anatomyCoverageWarnings = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (anatomyCoverageWarnings.has(key)) return;
  anatomyCoverageWarnings.add(key);
  console.warn(message);
}

function getPlacementItemId(item: AnatomyItem): string {
  return String(item.id || item.nodeId);
}

function isVisibleSceneNode(node: SceneNode): boolean {
  return !('visible' in node) || node.visible !== false;
}

function isSolidPaintWithColor(paint: Paint): paint is SolidPaint {
  return paint.type === 'SOLID' && Boolean(paint.visible ?? true);
}

function isAccentOrange(color: RGB): boolean {
  const red = color.r * 255;
  const green = color.g * 255;
  const blue = color.b * 255;
  return (
    Math.abs(red - 252) <= 35 &&
    Math.abs(green - 133) <= 55 &&
    Math.abs(blue - 7) <= 45
  );
}

function nodeHasAccentPaint(node: SceneNode): boolean {
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const paint of node.fills) {
      if (isSolidPaintWithColor(paint) && isAccentOrange(paint.color)) {
        return true;
      }
    }
  }
  if ('strokes' in node && Array.isArray(node.strokes)) {
    for (const paint of node.strokes) {
      if (isSolidPaintWithColor(paint) && isAccentOrange(paint.color)) {
        return true;
      }
    }
  }
  return false;
}

function sortAnatomyItemsByVisualOrder(items: AnatomyItem[]): AnatomyItem[] {
  const ROW_TOLERANCE = 12;
  const sorted = items.slice().sort((a, b) => {
    const aBounds = a.targetBounds ?? a.bounds;
    const bBounds = b.targetBounds ?? b.bounds;
    const yDelta = aBounds.y - bBounds.y;
    if (Math.abs(yDelta) > ROW_TOLERANCE) {
      return yDelta;
    }
    return aBounds.x - bBounds.x;
  });
  return sorted.map((item, index) => ({
    ...item,
    markerIndex: index + 1,
    index: index + 1,
    name: item.finalLabel,
  }));
}

function collectAccentObstacles(
  rootNode: SceneNode,
  rootBoundsInPreview: AnatomyRect
): ConnectorObstacle[] {
  const obstacles: ConnectorObstacle[] = [];

  function walk(node: SceneNode): void {
    if (!isVisibleSceneNode(node)) return;
    if (nodeHasAccentPaint(node)) {
      const relative = getNodeBoundsRelativeToRoot(node, rootNode);
      const width = Math.max(1, Math.round(relative.width));
      const height = Math.max(1, Math.round(relative.height));
      if (Number.isFinite(relative.x) && Number.isFinite(relative.y) && width > 0 && height > 0) {
        obstacles.push({
          id: `accent:${node.id}`,
          kind: 'accent',
          relatedItemId: node.id,
          bounds: {
            x: Math.round(rootBoundsInPreview.x + relative.x),
            y: Math.round(rootBoundsInPreview.y + relative.y),
            width,
            height,
          },
        });
      }
    }

    if (!('children' in node) || !Array.isArray(node.children)) return;
    for (const child of node.children) {
      walk(child as SceneNode);
    }
  }

  walk(rootNode);
  return obstacles;
}

function validateAnatomyCoverage(params: {
  items: AnatomyItem[];
  placements: AnatomyPointerPlacement[];
  selectedPathsCount: number;
  renderedPointersCount: number;
}): void {
  const { items, placements, selectedPathsCount, renderedPointersCount } = params;
  const uniquePlacementIds = new Set<string>();
  for (const placement of placements) {
    const id = getPlacementItemId(placement.item);
    if (uniquePlacementIds.has(id)) {
      warnOnce(
        `anatomy-duplicate-placement:${id}`,
        `[Anatomy] Duplicate placement id detected: ${id}.`
      );
      continue;
    }
    uniquePlacementIds.add(id);
  }

  const missingItemIds: string[] = [];
  for (const item of items) {
    const id = getPlacementItemId(item);
    if (!uniquePlacementIds.has(id)) {
      missingItemIds.push(id);
      warnOnce(
        `anatomy-missing-placement:${id}`,
        `[Anatomy] Missing marker placement for item "${item.finalLabel || item.name || item.rawName}" (${id}).`
      );
    }
  }

  if (
    selectedPathsCount > 0 &&
    (items.length !== selectedPathsCount ||
      placements.length !== items.length ||
      renderedPointersCount !== placements.length ||
      missingItemIds.length > 0)
  ) {
    warnOnce(
      `anatomy-coverage-mismatch:${selectedPathsCount}:${items.length}:${placements.length}:${renderedPointersCount}`,
      `[Anatomy] Coverage mismatch: selectedPaths=${selectedPathsCount}, items=${items.length}, placements=${placements.length}, renderedMarkers=${renderedPointersCount}, missingItemIds=${missingItemIds.join(',') || 'none'}.`
    );
  }
}

async function applyAnatomyMarkerTextInverse(textNode: TextNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (!ctx?.apply?.applySemanticColorKey || !ctx.resolver) return;
  try {
    await figma.loadFontAsync(textNode.fontName as FontName);
    await ctx.apply.applySemanticColorKey(textNode, 'textInverse', ctx.resolver, 'fill');
  } catch (error) {
    console.warn('[Anatomy] marker text inverse', error);
  }
}

async function tryApplyTextSecondary(textNode: TextNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (!ctx?.apply?.applySemanticColorKey || !ctx.resolver) return;
  try {
    await figma.loadFontAsync(textNode.fontName as FontName);
    await ctx.apply.applySemanticColorKey(textNode, 'textSecondary', ctx.resolver, 'fill');
  } catch (error) {
    console.warn('[Anatomy] list text secondary', error);
  }
}

function createAnatomyText(
  content: string,
  opts: {
    name: string;
    fontName: FontName;
    fontSize: number;
    lineHeight?: LineHeight;
    fills: Paint[];
    width?: number;
  }
): TextNode {
  const t = createPluginText();
  t.name = opts.name;
  t.fontName = opts.fontName;
  t.fontSize = opts.fontSize;
  t.lineHeight = opts.lineHeight || { unit: 'PERCENT', value: 130 };
  t.fills = opts.fills;

  if (opts.width != null && opts.width > 0) {
    t.textAutoResize = 'HEIGHT';
    t.resize(opts.width, t.height);
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  const str = content === undefined || content === null ? '' : String(content);
  t.characters = str.length === 0 ? ' ' : str;
  return t;
}

async function createMarker(
  markerLabel: string,
  options: ReturnType<typeof mergeAnatomyOptions>
): Promise<FrameNode> {
  const frame = createPluginFrame();
  frame.name = `Anatomy marker / ${markerLabel}`;
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = 0;
  frame.paddingTop = 0;
  frame.paddingRight = 0;
  frame.paddingBottom = 0;
  frame.paddingLeft = 0;
  frame.resize(options.markerSize, options.markerSize);
  frame.cornerRadius = options.markerSize / 2;
  frame.fills = [{ type: 'SOLID', color: options.markerColor || getDefaultConnectorColor() }];
  frame.strokes = [];
  frame.clipsContent = false;

  await figma.loadFontAsync(options.fontBold);
  const label = createAnatomyText(markerLabel, {
    name: 'Anatomy marker number',
    fontName: options.fontBold,
    fontSize: 12,
    lineHeight: { unit: 'PERCENT', value: 130 },
    fills: [{ type: 'SOLID', color: options.markerTextColor || ANATOMY_COLORS.markerText }],
  });

  await applyAnatomyMarkerTextInverse(label);
  frame.appendChild(label);
  return frame;
}

function getConnectorOrigin(placement: AnatomyPointerPlacement): { x: number; y: number } {
  if (!placement.segments.length) {
    return { x: placement.markerX, y: placement.markerY };
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const segment of placement.segments) {
    minX = Math.min(minX, segment.x);
    minY = Math.min(minY, segment.y);
  }
  return { x: minX, y: minY };
}

async function createAnatomyPointer(
  placement: AnatomyPointerPlacement,
  options: ReturnType<typeof mergeAnatomyOptions>
): Promise<FrameNode> {
  const markerLabel =
    placement.item.anatomyIndex ?? String(placement.item.markerIndex);
  const markerSize = options.markerSize;
  const bounds = getPointerFrameBounds(placement, markerSize);
  const connectorColor = options.connectorColor || getDefaultConnectorColor();

  const pointer = createPluginFrame();
  pointer.name = `Anatomy pointer / ${markerLabel}`;
  pointer.layoutMode = 'NONE';
  pointer.fills = [];
  pointer.strokes = [];
  pointer.clipsContent = false;
  pointer.itemSpacing = 0;
  pointer.paddingTop = 0;
  pointer.paddingRight = 0;
  pointer.paddingBottom = 0;
  pointer.paddingLeft = 0;

  const marker = await createMarker(markerLabel, options);
  marker.x = placement.markerX - bounds.x;
  marker.y = placement.markerY - bounds.y;
  pointer.appendChild(marker);

  if (placement.segments.length > 0) {
    const connector = createAnatomyConnectorFrame(
      placement.item.markerIndex,
      placement.segments,
      connectorColor
    );
    const origin = getConnectorOrigin(placement);
    connector.x = origin.x - bounds.x;
    connector.y = origin.y - bounds.y;
    pointer.appendChild(connector);
  }

  pointer.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
  pointer.x = bounds.x;
  pointer.y = bounds.y;

  return pointer;
}

async function createAnatomyListRow(
  item: AnatomyItem,
  options: ReturnType<typeof mergeAnatomyOptions>
): Promise<FrameNode> {
  const row = createPluginFrame();
  row.name = `Anatomy list item / ${item.markerIndex}`;
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.itemSpacing = 4;
  row.fills = [];
  row.strokes = [];
  row.clipsContent = false;

  const listText = options.listTextColor || hexToRgb('#4E4E4E');
  const label = item.finalLabel || item.name;

  const listLabel = item.anatomyIndex ?? String(item.markerIndex);
  const numberText = createAnatomyText(listLabel, {
    name: 'Anatomy list item number',
    fontName: options.fontBold,
    fontSize: 14,
    fills: [{ type: 'SOLID', color: listText }],
  });

  const nameText = createAnatomyText(`\u2014 ${label}`, {
    name: 'Anatomy list item name',
    fontName: options.fontRegular,
    fontSize: 14,
    fills: [{ type: 'SOLID', color: listText }],
    width: options.listWidth,
  });

  await tryApplyTextSecondary(numberText);
  await tryApplyTextSecondary(nameText);

  row.appendChild(numberText);
  row.appendChild(nameText);
  nameText.layoutGrow = 1;

  row.resize(options.listWidth, row.height);
  return row;
}

async function createAnatomyList(
  items: AnatomyItem[],
  options: ReturnType<typeof mergeAnatomyOptions>
): Promise<FrameNode> {
  const list = createPluginFrame();
  list.name = 'Anatomy list';
  list.layoutMode = 'VERTICAL';
  list.itemSpacing = 12;
  list.fills = [];
  list.strokes = [];
  list.clipsContent = false;
  list.primaryAxisSizingMode = 'AUTO';
  list.counterAxisSizingMode = 'FIXED';
  list.resize(options.listWidth, 1);

  for (const item of items) {
    list.appendChild(await createAnatomyListRow(item, options));
  }

  let totalH = 0;
  for (const child of list.children) {
    totalH += child.height;
  }
  if (list.children.length > 1) {
    totalH += list.itemSpacing * (list.children.length - 1);
  }
  list.resize(options.listWidth, Math.max(1, Math.round(totalH)));

  return list;
}

export type CreateAnatomyFrameParams = {
  sourceNode: SceneNode & { clone: () => SceneNode };
  title?: string;
  options?: AnatomyGeneratorOptions;
};

async function createAnatomyFrame(params: CreateAnatomyFrameParams): Promise<FrameNode> {
  const sourceNode = params.sourceNode;
  if (!sourceNode || typeof sourceNode.clone !== 'function') {
    throw new Error('AnatomyGenerator.createAnatomyFrame: sourceNode must be cloneable.');
  }

  const title =
    params.title != null && params.title !== '' ? String(params.title) : 'Анатомия компонента';

  const merged = mergeAnatomyOptions(params.options);

  const rootClone = sourceNode.clone() as SceneNode & { rescale?: (factor: number) => void };
  rootClone.name = `Anatomy preview / ${String(sourceNode.name)}`;

  const scale = merged.scale;
  if (
    typeof scale === 'number' &&
    !Number.isNaN(scale) &&
    scale > 0 &&
    scale !== 1 &&
    typeof rootClone.rescale === 'function'
  ) {
    rootClone.rescale(scale);
  }

  const items = collectSemanticAnatomyItems(rootClone, merged);
  const { rootOffset } = getRelativeVisualBounds(rootClone);
  const offsetX = Math.round(rootOffset.x);
  const offsetY = Math.round(rootOffset.y);

  const fp = merged.framePadding;
  const listGap = merged.listGap;

  const markerSize = merged.markerSize;
  const markerOffset = merged.markerOffset;
  const markerSafeArea = markerSize + markerOffset + 8;

  const previewGroup = createPluginFrame();
  previewGroup.name = 'Anatomy preview group';
  previewGroup.layoutMode = 'NONE';
  previewGroup.fills = [];
  previewGroup.strokes = [];
  previewGroup.clipsContent = false;
  previewGroup.resize(1, 1);

  rootClone.x = markerSafeArea + offsetX;
  rootClone.y = markerSafeArea + offsetY;

  const rootBoundsRelative: AnatomyRect = { x: 0, y: 0, width: rootClone.width, height: rootClone.height };
  const rootBoundsInPreview: AnatomyRect = {
    x: rootClone.x,
    y: rootClone.y,
    width: rootClone.width,
    height: rootClone.height,
  };

  const itemsForLayout = items.map((item) => ({
    ...item,
    targetBounds: {
      x: rootBoundsInPreview.x + item.bounds.x,
      y: rootBoundsInPreview.y + item.bounds.y,
      width: Math.max(1, item.bounds.width),
      height: Math.max(1, item.bounds.height),
    },
  }));
  const visualOrderedItems = sortAnatomyItemsByVisualOrder(itemsForLayout);
  const accentObstacles = collectAccentObstacles(rootClone, rootBoundsInPreview);

  const placements = calculatePointerPlacements(
    visualOrderedItems,
    rootBoundsRelative,
    rootBoundsInPreview,
    markerSize,
    { obstacles: accentObstacles }
  );

  const pointers: FrameNode[] = [];
  for (const placement of placements) {
    try {
      pointers.push(await createAnatomyPointer(placement, merged));
    } catch (error) {
      const id = getPlacementItemId(placement.item);
      warnOnce(
        `anatomy-render-pointer-failed:${id}`,
        `[Anatomy] Failed to render marker for "${placement.item.finalLabel || placement.item.name || placement.item.rawName}" (${id}).`
      );
      console.warn('[Anatomy] Pointer render error', error);
    }
  }
  validateAnatomyCoverage({
    items: visualOrderedItems,
    placements,
    selectedPathsCount: Array.isArray(merged.selectedLayerPaths) ? merged.selectedLayerPaths.length : 0,
    renderedPointersCount: pointers.length,
  });

  let minX = rootClone.x;
  let minY = rootClone.y;
  let maxX = rootClone.x + rootClone.width;
  let maxY = rootClone.y + rootClone.height;
  for (const pointer of pointers) {
    minX = Math.min(minX, pointer.x);
    minY = Math.min(minY, pointer.y);
    maxX = Math.max(maxX, pointer.x + pointer.width);
    maxY = Math.max(maxY, pointer.y + pointer.height);
  }

  const shiftX = minX < 0 ? -minX : 0;
  const shiftY = minY < 0 ? -minY : 0;
  rootClone.x += shiftX;
  rootClone.y += shiftY;
  for (const pointer of pointers) {
    pointer.x += shiftX;
    pointer.y += shiftY;
  }

  maxX += shiftX;
  maxY += shiftY;
  previewGroup.resize(Math.max(1, Math.round(maxX)), Math.max(1, Math.round(maxY)));
  previewGroup.appendChild(rootClone);
  for (const pointer of pointers) {
    previewGroup.appendChild(pointer);
  }

  const list = await createAnatomyList(visualOrderedItems, merged);

  const anatomyFrame = createPluginFrame();
  anatomyFrame.name = title;
  anatomyFrame.layoutMode = 'NONE';
  anatomyFrame.clipsContent = false;

  const bg = merged.backgroundColor ?? merged.frameFillColor ?? ANATOMY_COLORS.background;
  anatomyFrame.fills = [{ type: 'SOLID', color: bg }];
  anatomyFrame.strokes = [];
  anatomyFrame.paddingTop = 0;
  anatomyFrame.paddingRight = 0;
  anatomyFrame.paddingBottom = 0;
  anatomyFrame.paddingLeft = 0;

  previewGroup.x = fp;
  previewGroup.y = fp;
  anatomyFrame.appendChild(previewGroup);

  list.x = fp + previewGroup.width + listGap;
  list.y = fp + Math.max(0, (previewGroup.height - list.height) / 2);
  anatomyFrame.appendChild(list);

  const listH = list.height;
  const contentRight = Math.max(fp + previewGroup.width, list.x + list.width);
  const fw = contentRight + fp;
  const fh = fp + Math.max(previewGroup.height, listH) + fp;

  anatomyFrame.resize(Math.max(1, Math.round(fw)), Math.max(1, Math.round(fh)));

  return anatomyFrame;
}

async function loadFonts(options?: AnatomyGeneratorOptions): Promise<ReturnType<typeof mergeAnatomyOptions>> {
  const merged = mergeAnatomyOptions(options);

  try {
    await Promise.all([
      figma.loadFontAsync(merged.fontRegular),
      figma.loadFontAsync(merged.fontBold),
    ]);
  } catch (error) {
    console.warn('Cannot load anatomy fonts, trying Inter.', error);
    merged.fontRegular = { family: 'Inter', style: 'Regular' };
    merged.fontBold = { family: 'Inter', style: 'Bold' };
    await Promise.all([
      figma.loadFontAsync(merged.fontRegular),
      figma.loadFontAsync(merged.fontBold),
    ]);
  }

  return merged;
}

export const AnatomyGenerator = {
  loadFonts,
  createAnatomyFrame,
  collectAnatomyItems: collectSemanticAnatomyItems,
  collectSemanticAnatomyItems,
  getComponentPropertyMetadata,
};
