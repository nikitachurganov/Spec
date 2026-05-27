/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';

import type { PluginSettings } from '../../shared/settings';
import { loadFontOnce } from '../figma/text';
import { getRelativeVisualBounds } from '../figma/visualBounds';
import { applySectionTitleTokens } from '../tokens/applyTokens';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import type { StyleResolver } from '../tokens/styleResolver';
import { hexToRgb } from '../tokens/tokenMap';
import {
  applyThemeVariableMode,
  bindBackgroundPrimaryFill,
  resolveThemeVariables,
  type ThemeModeInfo,
  warnOnce,
} from '../tokens/themeModeResolver';

/** Matches `Specification / …` inner width (1440 − 2×60 padding). */
const SECTION_CONTENT_WIDTH = 1320;
const PREVIEW_ROW_HEIGHT = 254;
const PANEL_PADDING = 48;
const PANEL_CORNER_RADIUS = 12;

/** Fallback colors when the `Background/Primary` token is unavailable. */
const LIGHT_PANEL_FALLBACK = hexToRgb('#F7F7F7');
const DARK_PANEL_FALLBACK = hexToRgb('#202020');

const SECTION_TITLE = {
  fontSize: 32,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

export type BuildThemesSectionParams = {
  rootNode: SceneNode;
  settings: PluginSettings;
  resolver?: StyleResolver;
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
  primaryAxisSizingMode?: 'AUTO' | 'FIXED';
  counterAxisSizingMode?: 'AUTO' | 'FIXED';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  layoutGrow?: number;
  clipsContent?: boolean;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomLeftRadius?: number;
  bottomRightRadius?: number;
};

function stretchInParent(node: SceneNode): void {
  if (!('layoutAlign' in node)) return;
  try {
    (node as LayoutMixin).layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('[Themes] stretchInParent', node.name, error);
  }
}

function tryLayoutGrow(node: SceneNode, grow = 1): void {
  if (!('layoutGrow' in node)) return;
  try {
    (node as LayoutMixin).layoutGrow = grow;
  } catch (error) {
    console.warn('[Themes] layoutGrow', node.name, error);
  }
}

function createFrame(name: string, options: FrameOptions = {}): FrameNode {
  const frame = createPluginFrame();
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

  if (options.primaryAxisAlignItems) frame.primaryAxisAlignItems = options.primaryAxisAlignItems;
  if (options.counterAxisAlignItems) frame.counterAxisAlignItems = options.counterAxisAlignItems;
  if (options.topLeftRadius != null) frame.topLeftRadius = options.topLeftRadius;
  if (options.topRightRadius != null) frame.topRightRadius = options.topRightRadius;
  if (options.bottomLeftRadius != null) frame.bottomLeftRadius = options.bottomLeftRadius;
  if (options.bottomRightRadius != null) frame.bottomRightRadius = options.bottomRightRadius;
  if (options.layoutGrow != null) tryLayoutGrow(frame, options.layoutGrow);

  if (options.width != null || options.height != null) {
    frame.resize(
      Math.max(1, Math.round(options.width ?? frame.width)),
      Math.max(1, Math.round(options.height ?? frame.height))
    );
  }

  return frame;
}

async function createThemesSectionTitle(resolver: StyleResolver): Promise<TextNode> {
  await loadFontOnce(FONT_REGULAR);
  const title = createPluginText();
  title.name = 'Themes title';
  title.fontName = FONT_REGULAR;
  title.fontSize = SECTION_TITLE.fontSize;
  title.lineHeight = SECTION_TITLE.lineHeight;
  title.characters = 'Light and dark modes';
  title.textAutoResize = 'WIDTH_AND_HEIGHT';
  title.fills = [{ type: 'SOLID', color: hexToRgb('#1F1F1F') }];

  const ctx = getSpecBuildStyleContext();
  try {
    if (ctx?.apply) {
      await ctx.apply.applySectionTitleTokens(title, resolver);
    } else {
      await applySectionTitleTokens(title, resolver);
    }
  } catch (error) {
    console.warn('[Themes] section title tokens', error);
  }

  return title;
}

function applyThemePanelBackground(params: {
  panel: FrameNode;
  themeInfo: ThemeModeInfo | null;
  variant: 'light' | 'dark';
}): void {
  const fallbackColor = params.variant === 'light' ? LIGHT_PANEL_FALLBACK : DARK_PANEL_FALLBACK;
  if (!params.themeInfo) {
    params.panel.fills = [{ type: 'SOLID', color: fallbackColor }];
    return;
  }

  bindBackgroundPrimaryFill({
    node: params.panel,
    variable: params.themeInfo.backgroundPrimaryVariable,
    fallbackColor,
  });
}

function fitCloneIntoPanel(clone: SceneNode, maxWidth: number, maxHeight: number): void {
  if (clone.width <= 0 || clone.height <= 0) return;

  const scale = Math.min(1, maxWidth / clone.width, maxHeight / clone.height);
  if (
    scale < 1 &&
    typeof (clone as SceneNode & { rescale?: (factor: number) => void }).rescale === 'function'
  ) {
    (clone as SceneNode & { rescale: (factor: number) => void }).rescale(scale);
  }
}

function isCloneableRoot(node: SceneNode): node is SceneNode & { clone: () => SceneNode } {
  return typeof (node as { clone?: () => SceneNode }).clone === 'function';
}

function placeCloneInsideThemePanel(params: {
  panel: FrameNode;
  clone: SceneNode;
  sourceNode: SceneNode;
}): void {
  const { panel, clone, sourceNode } = params;
  const { visualBounds, rootOffset } = getRelativeVisualBounds(sourceNode);
  const offsetX = Math.round(rootOffset.x);
  const offsetY = Math.round(rootOffset.y);
  const needsAbsolutePlacement = offsetX !== 0 || offsetY !== 0;

  const panelWidth = Math.max(1, Math.floor(SECTION_CONTENT_WIDTH / 2));
  const maxW = Math.max(1, panelWidth - PANEL_PADDING * 2);
  const maxH = Math.max(1, PREVIEW_ROW_HEIGHT - PANEL_PADDING * 2);
  fitCloneIntoPanel(clone, maxW, maxH);

  panel.appendChild(clone);

  if (needsAbsolutePlacement && 'layoutPositioning' in clone) {
    try {
      (clone as SceneNode & LayoutMixin).layoutPositioning = 'ABSOLUTE';
      clone.x = Math.max(0, Math.round((panel.width - visualBounds.width) / 2) + offsetX);
      clone.y = Math.max(0, Math.round((panel.height - visualBounds.height) / 2) + offsetY);
      return;
    } catch (error) {
      console.warn('[Themes] absolute clone placement failed', error);
    }
  }

  clone.x = 0;
  clone.y = 0;
}

async function createThemePreviewPanel(params: {
  panelName: string;
  previewName: string;
  rootNode: SceneNode;
  variant: 'light' | 'dark';
  cornerRadii: Pick<
    FrameOptions,
    'topLeftRadius' | 'topRightRadius' | 'bottomLeftRadius' | 'bottomRightRadius'
  >;
  themeInfo: ThemeModeInfo | null;
}): Promise<FrameNode> {
  const { panelName, previewName, rootNode, variant, cornerRadii, themeInfo } = params;

  const panel = createFrame(panelName, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    height: PREVIEW_ROW_HEIGHT,
    paddingTop: PANEL_PADDING,
    paddingRight: PANEL_PADDING,
    paddingBottom: PANEL_PADDING,
    paddingLeft: PANEL_PADDING,
    layoutGrow: 1,
    clipsContent: false,
    ...cornerRadii,
  });

  applyThemePanelBackground({ panel, themeInfo, variant });
  await applyThemeVariableMode(panel, variant === 'light' ? 'Light' : 'Dark');

  if (!isCloneableRoot(rootNode)) {
    throw new Error('[Themes] Selected node cannot be cloned.');
  }

  const clone = rootNode.clone();
  clone.name = previewName;
  placeCloneInsideThemePanel({ panel, clone, sourceNode: rootNode });

  return panel;
}

/**
 * Builds the Themes documentation section with side-by-side light and dark
 * previews. Both panels use the `Background/Primary` token; the dark visual is
 * produced by pinning the panel's variable mode to the collection's dark mode.
 */
export async function buildThemesSection(params: BuildThemesSectionParams): Promise<FrameNode> {
  const { rootNode } = params;
  void params.settings;

  const ctx = getSpecBuildStyleContext();
  const resolver = params.resolver ?? ctx?.resolver;
  if (!resolver) {
    throw new Error('[Themes] Style resolver is not available.');
  }

  let themeInfo: ThemeModeInfo | null = null;
  try {
    const resolved = await resolveThemeVariables({
      useLibrary: params.settings.useLibraryTokens !== false,
    });
    themeInfo = resolved.themeInfo;
    if (!themeInfo) {
      warnOnce(
        'themes-build-fallback-panels',
        '[Themes] Could not resolve Background/Primary collection Light/Dark modes. Falling back to #F7F7F7 / #202020.'
      );
    }
  } catch (error) {
    warnOnce(
      'themes-build-resolver-failed',
      '[Themes] resolveThemeVariables failed. Falling back to static panel colors:',
      error
    );
  }

  const section = createFrame('Themes section', {
    layoutMode: 'VERTICAL',
    itemSpacing: 24,
    clipsContent: false,
  });
  section.resize(SECTION_CONTENT_WIDTH, section.height);

  const title = await createThemesSectionTitle(resolver);
  section.appendChild(title);
  stretchInParent(title);

  const previewRow = createFrame('Themes preview row', {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 0,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    height: PREVIEW_ROW_HEIGHT,
    clipsContent: false,
  });
  previewRow.resize(SECTION_CONTENT_WIDTH, PREVIEW_ROW_HEIGHT);
  stretchInParent(previewRow);

  const lightPanel = await createThemePreviewPanel({
    panelName: 'Theme preview / Light',
    previewName: 'Preview / Light',
    rootNode,
    variant: 'light',
    themeInfo,
    cornerRadii: {
      topLeftRadius: PANEL_CORNER_RADIUS,
      bottomLeftRadius: PANEL_CORNER_RADIUS,
      topRightRadius: 0,
      bottomRightRadius: 0,
    },
  });

  const darkPanel = await createThemePreviewPanel({
    panelName: 'Theme preview / Dark',
    previewName: 'Preview / Dark',
    rootNode,
    variant: 'dark',
    themeInfo,
    cornerRadii: {
      topLeftRadius: 0,
      bottomLeftRadius: 0,
      topRightRadius: PANEL_CORNER_RADIUS,
      bottomRightRadius: PANEL_CORNER_RADIUS,
    },
  });

  previewRow.appendChild(lightPanel);
  previewRow.appendChild(darkPanel);
  tryLayoutGrow(lightPanel, 1);
  tryLayoutGrow(darkPanel, 1);

  section.appendChild(previewRow);
  stretchInParent(previewRow);

  return section;
}
