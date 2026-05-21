/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { loadFontOnce } from '../figma/text';
import { applySectionTitleTokens } from '../tokens/applyTokens';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import type { StyleResolver } from '../tokens/styleResolver';
import { SPEC_TOKEN_MAP, hexToRgb, specColorFallbackRgb } from '../tokens/tokenMap';
import { findThemeModes, type ThemeModeInfo } from '../tokens/themeModeResolver';

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

let warnedThemeModesMissing = false;
let warnedDarkModeApplyFailed = false;

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

type VariableModeCapableNode = SceneNode & {
  setExplicitVariableModeForCollection?: (collectionId: string, modeId: string) => void;
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
  const title = figma.createText();
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

/**
 * Sets an explicit variable mode on the node (and its subtree) for the given
 * collection — used to switch a clone between light/dark themes.
 */
function setExplicitVariableMode(
  node: SceneNode,
  collectionId: string,
  modeId: string
): boolean {
  const capable = node as VariableModeCapableNode;
  if (typeof capable.setExplicitVariableModeForCollection !== 'function') return false;
  try {
    capable.setExplicitVariableModeForCollection(collectionId, modeId);
    return true;
  } catch (error) {
    console.warn('[Themes] setExplicitVariableModeForCollection failed on', node.name, error);
    return false;
  }
}

/**
 * Both panels (Light and Dark) MUST use the `Background/Primary` token.
 *
 * To produce the dark visual we keep the same token binding but set an explicit
 * dark variable mode on the panel. Figma re-resolves the bound variable per
 * node mode, so the same token renders white on the light panel and dark on
 * the dark panel.
 *
 * When the variable cannot be resolved or the matching theme mode is missing,
 * we fall back to hardcoded #F7F7F7 / #202020 fills.
 */
async function applyPanelBackgroundPrimary(params: {
  panel: FrameNode;
  resolver: StyleResolver;
  mode: 'light' | 'dark';
  themeInfo: ThemeModeInfo | null;
}): Promise<void> {
  const { panel, resolver, mode, themeInfo } = params;
  const token = SPEC_TOKEN_MAP.colors.backgroundPrimary;
  const tokenNames = [...token.names];
  const tokenFallback = specColorFallbackRgb(token.fallback as Parameters<typeof specColorFallbackRgb>[0]);

  const resolved = await resolver.resolveColor(tokenNames, tokenFallback);
  const modeId =
    mode === 'light' ? themeInfo?.lightModeId ?? null : themeInfo?.darkModeId ?? null;

  const variableInThemeCollection =
    !!resolved.variable &&
    !!themeInfo &&
    resolved.variable.variableCollectionId === themeInfo.collectionId;

  // If we have the right variable AND the right mode, bind + pin mode.
  if (resolved.variable && themeInfo && modeId && variableInThemeCollection) {
    const modeApplied = setExplicitVariableMode(panel, themeInfo.collectionId, modeId);
    try {
      await resolver.applyFill(panel, tokenNames, tokenFallback);
      if (modeApplied) return;
    } catch (error) {
      console.warn('[Themes] applyFill Background/Primary failed', error);
    }
  }

  // Try plain token binding (will inherit page/parent mode for light, otherwise fallback).
  if (mode === 'light') {
    try {
      await resolver.applyFill(panel, tokenNames, tokenFallback);
      return;
    } catch (error) {
      console.warn('[Themes] light panel applyFill failed', error);
    }
    panel.fills = [{ type: 'SOLID', color: LIGHT_PANEL_FALLBACK }];
    return;
  }

  // Dark mode — variable mode unavailable: use hardcoded dark fallback.
  if (!warnedDarkModeApplyFailed) {
    warnedDarkModeApplyFailed = true;
    console.warn(
      '[Themes] Could not apply dark variable mode. Using #202020 fallback for the dark panel.'
    );
  }
  panel.fills = [{ type: 'SOLID', color: DARK_PANEL_FALLBACK }];
}

function fitCloneIntoPanel(node: SceneNode, maxWidth: number, maxHeight: number): void {
  if (node.width <= 0 || node.height <= 0) return;
  const scale = Math.min(1, maxWidth / node.width, maxHeight / node.height);
  if (
    scale < 1 &&
    typeof (node as SceneNode & { rescale?: (factor: number) => void }).rescale === 'function'
  ) {
    (node as SceneNode & { rescale: (factor: number) => void }).rescale(scale);
  }
}

function isCloneableRoot(node: SceneNode): node is SceneNode & { clone: () => SceneNode } {
  return typeof (node as { clone?: () => SceneNode }).clone === 'function';
}

async function createThemePreviewPanel(params: {
  panelName: string;
  previewName: string;
  rootNode: SceneNode;
  resolver: StyleResolver;
  variant: 'light' | 'dark';
  cornerRadii: Pick<
    FrameOptions,
    'topLeftRadius' | 'topRightRadius' | 'bottomLeftRadius' | 'bottomRightRadius'
  >;
  themeInfo: ThemeModeInfo | null;
}): Promise<FrameNode> {
  const { panelName, previewName, rootNode, resolver, variant, cornerRadii, themeInfo } = params;

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
    clipsContent: true,
    ...cornerRadii,
  });

  await applyPanelBackgroundPrimary({ panel, resolver, mode: variant, themeInfo });

  if (!isCloneableRoot(rootNode)) {
    throw new Error('[Themes] Selected node cannot be cloned.');
  }

  const clone = rootNode.clone();
  clone.name = previewName;

  const panelWidth = Math.max(1, Math.floor(SECTION_CONTENT_WIDTH / 2));
  const maxW = Math.max(1, panelWidth - PANEL_PADDING * 2);
  const maxH = Math.max(1, PREVIEW_ROW_HEIGHT - PANEL_PADDING * 2);
  fitCloneIntoPanel(clone, maxW, maxH);

  // Pin the same variable mode on the clone subtree so internal tokens follow.
  if (themeInfo) {
    const modeId =
      variant === 'light' ? themeInfo.lightModeId ?? null : themeInfo.darkModeId ?? null;
    if (modeId) {
      setExplicitVariableMode(clone, themeInfo.collectionId, modeId);
    }
  }

  panel.appendChild(clone);
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
    themeInfo = await findThemeModes();
    if (!themeInfo && !warnedThemeModesMissing) {
      warnedThemeModesMissing = true;
      console.warn(
        '[Themes] Theme modes were not found. Falling back to #F7F7F7 / #202020.'
      );
    }
  } catch (error) {
    if (!warnedThemeModesMissing) {
      warnedThemeModesMissing = true;
      console.warn('[Themes] findThemeModes failed:', error);
    }
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
    resolver,
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
    resolver,
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
