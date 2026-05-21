/// <reference types="@figma/plugin-typings" />

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
import type { AnatomyGeneratorOptions, AnatomyItem, AnatomyPointerPlacement } from './anatomyTypes';
import {
  ANATOMY_LAYOUT,
  ANATOMY_COLORS,
  ANATOMY_POINTER_RIGHT_OFFSET,
  hexToRgb,
  mergeAnatomyOptions,
} from './anatomyStyles';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';

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
  const t = figma.createText();
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
  const frame = figma.createFrame();
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

  const pointer = figma.createFrame();
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
  const row = figma.createFrame();
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
  const list = figma.createFrame();
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

  const fp = merged.framePadding;
  const listGap = merged.listGap;
  const cw = rootClone.width;
  const ch = rootClone.height;

  const markerSize = merged.markerSize;
  const markerOffset = merged.markerOffset;
  const markerSafeArea = markerSize + markerOffset + 8;
  const rightColumnExtent = ANATOMY_POINTER_RIGHT_OFFSET + markerSize + 8;

  const previewGroup = figma.createFrame();
  previewGroup.name = 'Anatomy preview group';
  previewGroup.layoutMode = 'NONE';
  previewGroup.fills = [];
  previewGroup.strokes = [];
  previewGroup.clipsContent = false;
  previewGroup.resize(
    Math.max(1, Math.round(cw + markerSafeArea + rightColumnExtent)),
    Math.max(1, Math.round(ch + markerSafeArea * 2))
  );

  rootClone.x = markerSafeArea;
  rootClone.y = markerSafeArea;
  previewGroup.appendChild(rootClone);

  const rootBoundsRelative = { x: 0, y: 0, width: cw, height: ch };
  const rootBoundsInPreview = {
    x: rootClone.x,
    y: rootClone.y,
    width: rootClone.width,
    height: rootClone.height,
  };

  const placements = calculatePointerPlacements(
    items,
    rootBoundsRelative,
    rootBoundsInPreview,
    markerSize,
    markerOffset,
    rootClone
  );

  for (const placement of placements) {
    previewGroup.appendChild(await createAnatomyPointer(placement, merged));
  }

  const list = await createAnatomyList(items, merged);

  const anatomyFrame = figma.createFrame();
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

  list.x = fp + markerSafeArea + cw + listGap;
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
