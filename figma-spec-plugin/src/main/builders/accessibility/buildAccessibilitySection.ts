/// <reference types="@figma/plugin-typings" />

import { applySemanticColorKey } from '../../tokens/applyTokens';
import {
  COLOR_TOKEN_MAP,
  hexToRgb,
  SPEC_TOKEN_MAP,
  specColorFallbackRgb,
  type ColorSemanticKey,
} from '../../tokens/tokenMap';
import type { StyleResolver } from '../../tokens/styleResolver';
import { getSpecBuildStyleContext } from '../../tokens/specStyleContext';
import { loadFontOnce } from '../../figma/text';
import type { BuildContext } from '../buildTypes';
import { KEYBOARD_ROWS, SCREEN_READER_ITEMS } from './accessibilityContent';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'PT Sans', style: 'Bold' };
const FONT_MONO: FontName = { family: 'Overpass Mono', style: 'Regular' };

const KEY_CELL_WIDTH = 160;
const TABLE_MIN_WIDTH = 360;
const HEADER_CELL_MIN_HEIGHT = 48;
const CONTENT_ROW_MIN_HEIGHT = 64;
const TABLE_CORNER_RADIUS = 16;

/** Background/Primary for header cells and key badge — fallback #F7F7F7. */
const TABLE_SURFACE_FALLBACK = hexToRgb('#F7F7F7');

const SECTION_TITLE = {
  fontSize: 32,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const BLOCK_TITLE = {
  fontSize: 18,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const BODY = {
  fontSize: 16,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const TABLE_HEADER_LABEL = {
  fontSize: 14,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const ACTION_TEXT = {
  fontSize: 18,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const KEY_BADGE_TEXT = {
  fontSize: 16,
  lineHeight: { unit: 'PERCENT' as const, value: 140 },
};

type FrameOptions = {
  layoutMode?: 'VERTICAL' | 'HORIZONTAL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number;
  height?: number;
  minHeight?: number;
  counterAxisSizingMode?: 'AUTO' | 'FIXED';
  primaryAxisSizingMode?: 'AUTO' | 'FIXED';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  cornerRadius?: number;
  layoutGrow?: number;
  clipsContent?: boolean;
};

function stretchInParent(node: SceneNode): void {
  if (!('layoutAlign' in node)) return;
  try {
    (node as LayoutMixin).layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('[Accessibility] stretchInParent', node.name, error);
  }
}

function tryLayoutGrow(node: SceneNode, grow = 1): void {
  if (!('layoutGrow' in node)) return;
  try {
    (node as LayoutMixin).layoutGrow = grow;
  } catch (error) {
    console.warn('[Accessibility] layoutGrow', node.name, error);
  }
}

/** FILL/HUG/FIXED only work after the node is a child of an auto-layout frame. */
function safeLayoutSizing(
  node: FrameNode | TextNode,
  axis: 'horizontal' | 'vertical',
  mode: 'FIXED' | 'FILL' | 'HUG'
): void {
  try {
    if (axis === 'horizontal') {
      node.layoutSizingHorizontal = mode;
    } else {
      node.layoutSizingVertical = mode;
    }
  } catch (error) {
    console.warn('[Accessibility] layoutSizing', node.name, axis, mode, error);
  }
}

function enforceMinHeight(node: FrameNode, minHeight: number): void {
  if (node.height < minHeight) {
    node.resize(Math.max(1, node.width), minHeight);
  }
}

function applyFixedWidthInHorizontalRow(cell: FrameNode, width: number, minHeight: number): void {
  safeLayoutSizing(cell, 'horizontal', 'FIXED');
  safeLayoutSizing(cell, 'vertical', 'HUG');
  cell.resize(width, Math.max(minHeight, cell.height));
}

function applyStretchFillInHorizontalRow(cell: FrameNode, minHeight: number): void {
  tryLayoutGrow(cell, 1);
  stretchInParent(cell);
  safeLayoutSizing(cell, 'horizontal', 'FILL');
  safeLayoutSizing(cell, 'vertical', 'HUG');
  enforceMinHeight(cell, minHeight);
}

/** Key cell: fixed width 160, height Fill (STRETCH) inside horizontal row. */
function applyKeyCellFillHeight(keyCell: FrameNode): void {
  keyCell.resize(KEY_CELL_WIDTH, Math.max(CONTENT_ROW_MIN_HEIGHT, keyCell.height));
  safeLayoutSizing(keyCell, 'horizontal', 'FIXED');
  stretchInParent(keyCell);
}

function applyActionTextFillWidth(actionText: TextNode): void {
  actionText.textAutoResize = 'HEIGHT';
  safeLayoutSizing(actionText, 'horizontal', 'FILL');
}

function createFrame(name: string, options: FrameOptions = {}): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = options.layoutMode ?? 'VERTICAL';
  frame.primaryAxisSizingMode = options.primaryAxisSizingMode ?? 'AUTO';
  frame.counterAxisSizingMode = options.counterAxisSizingMode ?? 'AUTO';
  frame.itemSpacing = options.itemSpacing ?? 0;
  frame.paddingTop = options.paddingTop ?? 0;
  frame.paddingRight = options.paddingRight ?? 0;
  frame.paddingBottom = options.paddingBottom ?? 0;
  frame.paddingLeft = options.paddingLeft ?? 0;
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = options.clipsContent ?? false;

  if (options.primaryAxisAlignItems) {
    frame.primaryAxisAlignItems = options.primaryAxisAlignItems;
  }
  if (options.counterAxisAlignItems) {
    frame.counterAxisAlignItems = options.counterAxisAlignItems;
  }
  if (options.cornerRadius != null) {
    frame.cornerRadius = options.cornerRadius;
  }
  if (options.layoutGrow != null) {
    tryLayoutGrow(frame, options.layoutGrow);
  }

  if (options.width != null || options.height != null) {
    const w = options.width ?? Math.max(1, frame.width);
    const h = options.height ?? Math.max(1, frame.height);
    frame.resize(w, h);
  }

  if (options.minHeight != null && options.width != null) {
    frame.resize(options.width, Math.max(options.minHeight, frame.height));
  }

  return frame;
}

async function applyBackgroundPrimary(frame: FrameNode, resolver: StyleResolver): Promise<void> {
  const def = SPEC_TOKEN_MAP.colors.backgroundPrimary;
  try {
    await resolver.applyFill(frame, [...def.names], TABLE_SURFACE_FALLBACK);
  } catch {
    frame.fills = [{ type: 'SOLID', color: TABLE_SURFACE_FALLBACK }];
  }
}

async function applyBackgroundSecondary(frame: FrameNode, resolver: StyleResolver): Promise<void> {
  const def = SPEC_TOKEN_MAP.colors.backgroundSecondary;
  const fallback = specColorFallbackRgb(
    def.fallback as Parameters<typeof specColorFallbackRgb>[0]
  );
  try {
    await resolver.applyFill(frame, [...def.names], fallback);
  } catch {
    frame.fills = [{ type: 'SOLID', color: fallback }];
  }
}

async function applyFrameStroke(
  frame: FrameNode,
  resolver: StyleResolver,
  tokenKey: 'strokeBorder' | 'strokeBorderLight',
  bottomOnly = false
): Promise<void> {
  const def = COLOR_TOKEN_MAP[tokenKey];
  try {
    await applySemanticColorKey(frame, tokenKey, resolver, 'stroke');
  } catch {
    frame.strokes = [{ type: 'SOLID', color: hexToRgb(def.fallback) }];
  }
  frame.strokeAlign = 'INSIDE';
  if (bottomOnly) {
    frame.strokeTopWeight = 0;
    frame.strokeLeftWeight = 0;
    frame.strokeRightWeight = 0;
    frame.strokeBottomWeight = 1;
  } else {
    frame.strokeWeight = 1;
  }
}

async function applyBottomStroke(
  frame: FrameNode,
  resolver: StyleResolver,
  tokenKey: 'strokeBorder' | 'strokeBorderLight'
): Promise<void> {
  await applyFrameStroke(frame, resolver, tokenKey, true);
}

async function applyTextColor(
  text: TextNode,
  key: ColorSemanticKey,
  resolver: StyleResolver
): Promise<void> {
  try {
    await applySemanticColorKey(text, key, resolver, 'fill');
  } catch {
    const def = COLOR_TOKEN_MAP[key];
    text.fills = [{ type: 'SOLID', color: hexToRgb(def.fallback) }];
  }
}

async function loadMonoFont(): Promise<FontName> {
  try {
    await loadFontOnce(FONT_MONO);
    return FONT_MONO;
  } catch (e) {
    console.warn('[Accessibility] Overpass Mono unavailable, fallback PT Sans', e);
    await loadFontOnce(FONT_REGULAR);
    return FONT_REGULAR;
  }
}

async function createAccessibilityText(
  text: string,
  options: {
    name: string;
    fontName: FontName;
    fontSize: number;
    lineHeight: LineHeight;
    fontFamilyRole?: 'heading' | 'paragraph' | 'none';
    colorKey?: ColorSemanticKey;
    width?: number;
  },
  resolver: StyleResolver
): Promise<TextNode> {
  await loadFontOnce(options.fontName);
  const node = figma.createText();
  node.name = options.name;
  node.fontName = options.fontName;
  node.fontSize = options.fontSize;
  node.lineHeight = options.lineHeight;
  node.characters = text.length === 0 ? ' ' : text;

  if (options.width != null) {
    node.textAutoResize = 'HEIGHT';
    node.resize(options.width, node.height);
  } else {
    node.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  if (options.fontFamilyRole && options.fontFamilyRole !== 'none') {
    const ctx = getSpecBuildStyleContext();
    if (ctx?.apply) {
      try {
        if (options.fontFamilyRole === 'heading') {
          await ctx.apply.applyHeadingFontFamilyToken(node, options.fontName, resolver);
        } else {
          await ctx.apply.applyParagraphFontFamilyToken(node, options.fontName, resolver);
        }
      } catch (e) {
        console.warn('[Accessibility] font family token', e);
      }
    }
  }

  if (options.colorKey) {
    await applyTextColor(node, options.colorKey, resolver);
  }

  return node;
}

async function createSectionTitle(text: string, name: string, resolver: StyleResolver): Promise<TextNode> {
  const title = await createAccessibilityText(
    text,
    {
      name,
      fontName: FONT_REGULAR,
      fontSize: SECTION_TITLE.fontSize,
      lineHeight: SECTION_TITLE.lineHeight,
      fontFamilyRole: 'heading',
      colorKey: 'textPrimary',
    },
    resolver
  );

  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply) {
    try {
      await ctx.apply.applySectionTitleTokens(title, resolver);
    } catch (e) {
      console.warn('[Accessibility] section title tokens', e);
    }
  }

  return title;
}

async function createBlockTitle(text: string, name: string, resolver: StyleResolver): Promise<TextNode> {
  return createAccessibilityText(
    text,
    {
      name,
      fontName: FONT_BOLD,
      fontSize: BLOCK_TITLE.fontSize,
      lineHeight: BLOCK_TITLE.lineHeight,
      fontFamilyRole: 'paragraph',
      colorKey: 'textPrimary',
    },
    resolver
  );
}

async function createBodyText(
  text: string,
  name: string,
  resolver: StyleResolver,
  colorKey: ColorSemanticKey = 'textPrimary'
): Promise<TextNode> {
  return createAccessibilityText(
    text,
    {
      name,
      fontName: FONT_REGULAR,
      fontSize: BODY.fontSize,
      lineHeight: BODY.lineHeight,
      fontFamilyRole: 'paragraph',
      colorKey,
    },
    resolver
  );
}

async function createScreenReadersListText(
  text: string,
  resolver: StyleResolver
): Promise<TextNode> {
  const styleDef = SPEC_TOKEN_MAP.textStyles.bulletedList;
  await loadFontOnce(FONT_REGULAR);

  const node = figma.createText();
  node.name = 'Screen readers list text';
  node.characters = text.length === 0 ? ' ' : text;
  node.textAutoResize = 'WIDTH_AND_HEIGHT';

  await resolver.applyTextStyle(node, [...styleDef.names], styleDef.fallback);

  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply) {
    try {
      const baseFont =
        node.fontName === figma.mixed ? FONT_REGULAR : (node.fontName as FontName);
      await ctx.apply.applyParagraphFontFamilyToken(node, baseFont, resolver);
    } catch (e) {
      console.warn('[Accessibility] Screen readers list font family', e);
    }
  }

  return node;
}

async function createInnerBlock(
  name: string,
  titleText: string,
  titleLayerName: string,
  resolver: StyleResolver
): Promise<{ block: FrameNode; title: TextNode }> {
  const block = createFrame(name, { layoutMode: 'VERTICAL', itemSpacing: 12 });
  stretchInParent(block);
  const title = await createBlockTitle(titleText, titleLayerName, resolver);
  block.appendChild(title);
  stretchInParent(title);
  return { block, title };
}

async function createTableHeaderLabel(
  text: string,
  layerName: string,
  resolver: StyleResolver
): Promise<TextNode> {
  await loadFontOnce(FONT_BOLD);
  return createAccessibilityText(
    text,
    {
      name: layerName,
      fontName: FONT_BOLD,
      fontSize: TABLE_HEADER_LABEL.fontSize,
      lineHeight: TABLE_HEADER_LABEL.lineHeight,
      fontFamilyRole: 'paragraph',
      colorKey: 'textTertiary',
    },
    resolver
  );
}

async function createKeyboardHeaderCell(
  label: string,
  cellName: string,
  titleLayerName: string,
  resolver: StyleResolver,
  options: { fixedWidth?: number; stretch?: boolean }
): Promise<FrameNode> {
  const cell = createFrame(cellName, {
    layoutMode: 'VERTICAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'MIN',
    itemSpacing: 8,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 12,
    width: options.fixedWidth,
    minHeight: HEADER_CELL_MIN_HEIGHT,
  });

  await applyBackgroundPrimary(cell, resolver);

  if (options.fixedWidth != null) {
    cell.resize(options.fixedWidth, Math.max(HEADER_CELL_MIN_HEIGHT, cell.height));
  }

  const content = createFrame('Header cell content', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 4,
  });

  const title = await createTableHeaderLabel(label, titleLayerName, resolver);
  content.appendChild(title);
  cell.appendChild(content);

  if (options.fixedWidth != null) {
    cell.resize(options.fixedWidth, Math.max(HEADER_CELL_MIN_HEIGHT, cell.height));
  } else {
    enforceMinHeight(cell, HEADER_CELL_MIN_HEIGHT);
  }

  return cell;
}

async function createKeyBadge(key: string, resolver: StyleResolver): Promise<FrameNode> {
  const monoFont = await loadMonoFont();

  const badge = createFrame('Key badge', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    itemSpacing: 10,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    cornerRadius: 4,
  });

  await applyBackgroundPrimary(badge, resolver);

  const badgeText = await createAccessibilityText(
    key,
    {
      name: 'Key badge text',
      fontName: monoFont,
      fontSize: KEY_BADGE_TEXT.fontSize,
      lineHeight: KEY_BADGE_TEXT.lineHeight,
      fontFamilyRole: 'none',
      colorKey: 'textPrimary',
    },
    resolver
  );

  badge.appendChild(badgeText);
  return badge;
}

async function createKeyCell(key: string, resolver: StyleResolver): Promise<FrameNode> {
  const cell = createFrame('Keyboard navigation key cell', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 8,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 12,
    width: KEY_CELL_WIDTH,
  });
  const badge = await createKeyBadge(key, resolver);
  cell.appendChild(badge);
  return cell;
}

async function createActionCell(
  action: string,
  resolver: StyleResolver
): Promise<{ cell: FrameNode; actionText: TextNode }> {
  const cell = createFrame('Keyboard navigation action cell', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 8,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 12,
  });

  const actionText = await createAccessibilityText(
    action,
    {
      name: 'Action text',
      fontName: FONT_REGULAR,
      fontSize: ACTION_TEXT.fontSize,
      lineHeight: ACTION_TEXT.lineHeight,
      fontFamilyRole: 'paragraph',
      colorKey: 'textSecondary',
    },
    resolver
  );
  actionText.textAutoResize = 'HEIGHT';

  cell.appendChild(actionText);
  return { cell, actionText };
}

async function createKeyboardNavigationRow(
  rowData: { key: string; action: string },
  resolver: StyleResolver
): Promise<FrameNode> {
  const row = createFrame('Keyboard navigation row', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 0,
  });
  await applyBottomStroke(row, resolver, 'strokeBorderLight');

  const keyCell = await createKeyCell(rowData.key, resolver);
  const { cell: actionCell, actionText } = await createActionCell(rowData.action, resolver);

  row.appendChild(keyCell);
  row.appendChild(actionCell);

  applyKeyCellFillHeight(keyCell);
  applyStretchFillInHorizontalRow(actionCell, CONTENT_ROW_MIN_HEIGHT);
  applyActionTextFillWidth(actionText);

  stretchInParent(row);
  enforceMinHeight(row, CONTENT_ROW_MIN_HEIGHT);

  return row;
}

async function createKeyboardTableHeader(context: BuildContext): Promise<FrameNode> {
  const resolver = context.resolver;

  const row = createFrame('Keyboard navigation table header', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 0,
    clipsContent: true,
  });
  stretchInParent(row);
  await applyBackgroundPrimary(row, resolver);
  await applyBottomStroke(row, resolver, 'strokeBorder');

  const keyCell = await createKeyboardHeaderCell(
    'Клавиша',
    'Keyboard navigation header cell / Key',
    'Key column title',
    resolver,
    { fixedWidth: KEY_CELL_WIDTH }
  );

  const actionCell = await createKeyboardHeaderCell(
    'Действие',
    'Keyboard navigation header cell / Action',
    'Action column title',
    resolver,
    { stretch: true }
  );

  row.appendChild(keyCell);
  row.appendChild(actionCell);

  applyFixedWidthInHorizontalRow(keyCell, KEY_CELL_WIDTH, HEADER_CELL_MIN_HEIGHT);
  applyStretchFillInHorizontalRow(actionCell, HEADER_CELL_MIN_HEIGHT);

  enforceMinHeight(keyCell, HEADER_CELL_MIN_HEIGHT);
  enforceMinHeight(actionCell, HEADER_CELL_MIN_HEIGHT);
  enforceMinHeight(row, HEADER_CELL_MIN_HEIGHT);

  const rowWidth = Math.max(TABLE_MIN_WIDTH, row.width);
  row.resize(rowWidth, Math.max(HEADER_CELL_MIN_HEIGHT, row.height));

  return row;
}

async function createKeyboardTableBody(context: BuildContext): Promise<FrameNode> {
  const resolver = context.resolver;

  const body = createFrame('Keyboard navigation table body', {
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
  });
  stretchInParent(body);

  for (const rowData of KEYBOARD_ROWS) {
    const row = await createKeyboardNavigationRow(rowData, resolver);
    body.appendChild(row);
  }

  return body;
}

async function createKeyboardNavigationTable(context: BuildContext): Promise<FrameNode> {
  const resolver = context.resolver;

  const table = createFrame('Keyboard navigation table', {
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    cornerRadius: TABLE_CORNER_RADIUS,
    clipsContent: true,
  });
  stretchInParent(table);

  await applyBackgroundSecondary(table, resolver);
  await applyFrameStroke(table, resolver, 'strokeBorder');

  const header = await createKeyboardTableHeader(context);
  const body = await createKeyboardTableBody(context);

  table.appendChild(header);
  table.appendChild(body);
  stretchInParent(header);
  stretchInParent(body);

  return table;
}

async function buildKeyboardNavigationBlock(context: BuildContext): Promise<FrameNode> {
  const resolver = context.resolver;
  const { block } = await createInnerBlock(
    'Keyboard navigation block',
    'Клавиатурная навигация',
    'Keyboard navigation title',
    resolver
  );

  const table = await createKeyboardNavigationTable(context);
  block.appendChild(table);
  stretchInParent(table);
  return block;
}

async function buildAriaBlock(resolver: StyleResolver): Promise<FrameNode> {
  const { block } = await createInnerBlock('ARIA block', 'ARIA', 'ARIA title', resolver);
  const description = await createBodyText('Описание', 'ARIA description', resolver, 'textPrimary');
  block.appendChild(description);
  stretchInParent(description);
  return block;
}

async function buildScreenReadersBlock(resolver: StyleResolver): Promise<FrameNode> {
  const { block } = await createInnerBlock(
    'Screen readers block',
    'Скринридеры',
    'Screen readers title',
    resolver
  );

  const list = createFrame('Screen readers list', {
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
  });
  stretchInParent(list);

  const screenReadersText = SCREEN_READER_ITEMS.map((line) => `• ${line}`).join('\n');
  const listText = await createScreenReadersListText(screenReadersText, resolver);
  stretchInParent(listText);

  list.appendChild(listText);
  block.appendChild(list);
  stretchInParent(list);
  return block;
}

export async function buildAccessibilitySection(context: BuildContext): Promise<FrameNode> {
  void context.root;
  void context.settings;
  void context.spacingTokenResolver;

  const resolver = context.resolver;

  try {
    await loadFontOnce(FONT_REGULAR);
    await loadFontOnce(FONT_BOLD);
  } catch (e) {
    console.warn('[Accessibility] font load', e);
  }

  const section = createFrame('Accessibility section', {
    layoutMode: 'VERTICAL',
    itemSpacing: 24,
  });
  stretchInParent(section);

  const title = await createSectionTitle('Accessibility', 'Accessibility section title', resolver);
  section.appendChild(title);
  stretchInParent(title);

  const description = await createBodyText('Описание', 'Accessibility description', resolver);
  section.appendChild(description);
  stretchInParent(description);

  const keyboardBlock = await buildKeyboardNavigationBlock(context);
  section.appendChild(keyboardBlock);
  stretchInParent(keyboardBlock);

  const ariaBlock = await buildAriaBlock(resolver);
  section.appendChild(ariaBlock);
  stretchInParent(ariaBlock);

  const screenReadersBlock = await buildScreenReadersBlock(resolver);
  section.appendChild(screenReadersBlock);
  stretchInParent(screenReadersBlock);

  return section;
}
