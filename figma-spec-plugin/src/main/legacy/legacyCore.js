'use strict';

import { assembleSpecificationWrapper, findDsTemplateHeader } from '../builders/specificationWrapper';
import { createSpecIcon } from '../icons/iconFactory';
import { getPropertyIconNames } from '../icons/propertyIconResolver';
import { getContainerPropertyRows } from '../spec/containerCardPropertyRows';
import { getPaddingRows } from '../spec/paddingRows';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
var FONT_PT_SANS_REGULAR = { family: 'PT Sans', style: 'Regular' };
var FONT_PT_SANS_BOLD = { family: 'PT Sans', style: 'Bold' };

var FONT_REGULAR = { family: 'Inter', style: 'Regular' };
var FONT_MEDIUM = { family: 'Inter', style: 'Medium' };
var FONT_BOLD = { family: 'Inter', style: 'Bold' };

var activeFontRegular = FONT_PT_SANS_REGULAR;

var activeFontMedium = FONT_PT_SANS_REGULAR;

var activeFontBold = FONT_PT_SANS_BOLD;

function hexToRgb(hex) {
  var s = String(hex || '').replace(/^#/, '');
  if (s.length === 3) {
    s =
      s.charAt(0) +
      s.charAt(0) +
      s.charAt(1) +
      s.charAt(1) +
      s.charAt(2) +
      s.charAt(2);
  }
  var n = parseInt(s, 16);
  if (isNaN(n) || s.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

/** Цвет заливки/обводки/плашки значения только для Gap overlay (#F34747). */
var GAP_OVERLAY_COLOR = hexToRgb('#F34747');

/** Цвет padding overlay в preview (#003F8A) */
var PADDING_OVERLAY_COLOR = hexToRgb('#003F8A');

/** Обводка/заливка child overlay (#FFFFFF — fill 20%, stroke 100%) */
var CHILD_OVERLAY_COLOR = hexToRgb('#FFFFFF');

var SPEC_LAYOUT = {
  width: 1120,
  sectionGap: 24,
  cardGap: 12,
  padding: 32,
  cardPadding: 20,
  rowGap: 8,
  smallGap: 4,
  cornerRadius: 16,
  cardCornerRadius: 12,
};

/** Корневой фрейм «Specification / …» */
var SPECIFICATION_LAYOUT = {
  width: 1440,
  padding: 60,
  gap: 32,
};

var SPEC_COLORS = {
  /** Background/Primary — Containers section, Anatomy container (fallback до токенов) */
  backgroundPrimary: hexToRgb('#FFFFFF'),
  /** Background/Secondary — корень Specification / …, Container preview card (fallback) */
  backgroundSecondary: hexToRgb('#F7F7F7'),
  /** Заголовки блоков Spec / Component anatomy */
  sectionTitle: hexToRgb('#1F1F1F'),
  pageBg: { r: 0.96, g: 0.96, b: 0.96 },
  cardBg: { r: 1, g: 1, b: 1 },
  containerCardBg: hexToRgb('#FFFFFF'),
  textPrimary: hexToRgb('#1F1F1F'),
  textSecondary: hexToRgb('#4E4E4E'),
  labelText: hexToRgb('#8C8C8C'),
  border: { r: 0.88, g: 0.88, b: 0.88 },
  cardBorder: hexToRgb('#EAE8E8'),
  warningBg: { r: 1, g: 0.96, b: 0.86 },
  warningText: { r: 0.48, g: 0.28, b: 0 },
  previewCanvasBg: hexToRgb('#F7F7F7'),
  paddingMeasure: PADDING_OVERLAY_COLOR,
  paddingOverlay: PADDING_OVERLAY_COLOR,
  paddingValueSquare: hexToRgb('#449AFF'),
  paddingStroke: hexToRgb('#449AFF'),
  childOverlay: CHILD_OVERLAY_COLOR,
  childOverlayBg: CHILD_OVERLAY_COLOR,
};

SPEC_COLORS.gapMeasure = GAP_OVERLAY_COLOR;
SPEC_COLORS.gapValueSquare = GAP_OVERLAY_COLOR;
SPEC_COLORS.gapStroke = GAP_OVERLAY_COLOR;

var SECTION_TITLE_STYLE = {
  fontSize: 32,
  lineHeight: { unit: 'PERCENT', value: 130 },
  color: SPEC_COLORS.sectionTitle,
};

/** Padding measurer: measure fill (opacity совпадает с token fallback / effect). */
var PADDING_OVERLAY_LAYOUT = {
  extraSize: 20,
  overlayItemSpacing: 20,
  valueSquareSize: 28,
  valueSquareRadius: 8,
  valueSquareGap: 4,
  measureColor: PADDING_OVERLAY_COLOR,
  measureOpacity: 0.2,
};

/** Внутренний отступ Padding overlay от обводки до measure fill (px). */
var PADDING_OVERLAY_INSET = 1;

function makeSolidPaintWithOpacity(color, opacity) {
  return {
    type: 'SOLID',
    color: color,
    opacity: opacity,
  };
}

var SPEC_EFFECTS = {
  cardShadow: [
    {
      type: 'DROP_SHADOW',
      visible: true,
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 1 },
      radius: 2,
      spread: 0,
      blendMode: 'NORMAL',
    },
  ],
};

var LIBRARY_TOKEN_NAMES = {
  libraries: {
    typographyAndColors: 'Typography & Colors',
    radius: 'Typography & Colors/Radius',
    spaces: 'Typography & Colors/Spaces',
  },
  textStyles: {
    cardHeading: 'desktop/h5',
    body: 'Body/Paragraph (14px)',
  },
  colors: {
    cardBackground: 'Background/Secondary',
    cardBorder: 'Stroke/Divider-light',
    headingDivider: 'Stroke/Divider-light',
  },
  radius: {
    md: 'md',
    mdFullPath: 'Radius/md',
  },
  spaces: {
    medium: 'medium',
    mediumFullPath: 'Spaces/medium',
    xl: 'xl',
    xlFullPath: 'Spaces/xl',
  },
};

function normalizeTokenName(name) {
  return String(name || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function tokenNameMatches(actualName, expectedNames) {
  var actual = normalizeTokenName(actualName);
  var i;
  for (i = 0; i < expectedNames.length; i++) {
    var expected = normalizeTokenName(expectedNames[i]);
    if (!expected) continue;
    if (actual === expected || actual.endsWith('/' + expected)) return true;
  }
  return false;
}

var CONTENT_WIDTH = SPEC_LAYOUT.width - SPEC_LAYOUT.padding * 2;

var INNER_CONTENT_WIDTH = CONTENT_WIDTH;

var SPEC_CARD_LAYOUT = {
  descriptionWidth: 420,
  rowGap: 20,
  previewMinHeight: 160,
  containerCardContentHeight: 298,
};

var INNER_ROW_WIDTH =
  SPEC_LAYOUT.width -
  SPEC_LAYOUT.padding * 2 -
  SPEC_LAYOUT.cardPadding * 2;

var PROP_LABEL_WIDTH = 220;

var spacingTokens = {
  0: 'spacing/semantic/none',
  2: 'spacing/semantic/3xs',
  4: 'spacing/semantic/2xs',
  6: 'spacing/semantic/xs',
  8: 'spacing/semantic/small',
  10: 'spacing/semantic/small-plus',
  12: 'spacing/semantic/medium',
  16: 'spacing/semantic/large',
  20: 'spacing/semantic/xl',
  24: 'spacing/semantic/2xl',
  28: 'spacing/semantic/3xl',
  32: 'spacing/semantic/4xl',
  40: 'spacing/semantic/5xl',
  48: 'spacing/semantic/6xl',
  56: 'spacing/semantic/7xl',
  64: 'spacing/semantic/8xl',
};

// spacing/semantic/medium = 12px, spacing/semantic/xl = 20px — layout sizes:
var SPACING_VALUES = {
  medium: 12,
  xl: 20,
};

var RADIUS_VALUES = {
  md: 12,
};

var CONTAINER_CARD_LABEL_WIDTH = 144;

function getDesignSpaces(designTokens) {
  if (
    designTokens &&
    designTokens.spaces &&
    typeof designTokens.spaces.medium === 'number' &&
    typeof designTokens.spaces.xl === 'number'
  ) {
    return { medium: designTokens.spaces.medium, xl: designTokens.spaces.xl };
  }
  return { medium: SPACING_VALUES.medium, xl: SPACING_VALUES.xl };
}

function getDesignRadiusMd(designTokens) {
  if (
    designTokens &&
    designTokens.radius &&
    typeof designTokens.radius.md === 'number'
  )
    return designTokens.radius.md;
  return RADIUS_VALUES.md;
}

function containerCardContentInnerWidth(designTokens) {
  var s = getDesignSpaces(designTokens);
  return INNER_CONTENT_WIDTH - s.xl * 2;
}

function containerCardValueColumnWidth(designTokens) {
  var s = getDesignSpaces(designTokens);
  return (
    containerCardContentInnerWidth(designTokens) -
    CONTAINER_CARD_LABEL_WIDTH -
    s.medium
  );
}

function getPreviewCardWidth() {
  return (
    CONTENT_WIDTH -
    SPEC_CARD_LAYOUT.descriptionWidth -
    SPEC_CARD_LAYOUT.rowGap
  );
}

function descriptionCardContentInnerWidth(designTokens) {
  var s = getDesignSpaces(designTokens);
  return SPEC_CARD_LAYOUT.descriptionWidth - s.xl * 2;
}

function descriptionCardValueColumnWidth(designTokens) {
  var s = getDesignSpaces(designTokens);
  return (
    descriptionCardContentInnerWidth(designTokens) -
    CONTAINER_CARD_LABEL_WIDTH -
    s.medium
  );
}

var DEFAULT_SECTION_SETTINGS = {
  header: true,
  spec: true,
  componentAnatomy: true,
  childOverlays: true,
  gapOverlays: true,
  useComponentPropertyNames: true,
  useLibraryTokens: true,
};

function normalizeSectionSettings(settings) {
  var spec =
    settings && typeof settings.spec === 'boolean'
      ? settings.spec
      : settings && typeof settings.containers === 'boolean'
        ? settings.containers
        : DEFAULT_SECTION_SETTINGS.spec;

  var componentAnatomy =
    settings && typeof settings.componentAnatomy === 'boolean'
      ? settings.componentAnatomy
      : settings && typeof settings.anatomy === 'boolean'
        ? settings.anatomy
        : DEFAULT_SECTION_SETTINGS.componentAnatomy;

  return {
    header:
      settings && typeof settings.header === 'boolean'
        ? settings.header
        : DEFAULT_SECTION_SETTINGS.header,
    spec: spec,
    componentAnatomy: componentAnatomy,
    containers: spec,
    anatomy: componentAnatomy,
    childOverlays:
      settings && typeof settings.childOverlays === 'boolean'
        ? settings.childOverlays
        : DEFAULT_SECTION_SETTINGS.childOverlays,
    gapOverlays:
      settings && typeof settings.gapOverlays === 'boolean'
        ? settings.gapOverlays
        : DEFAULT_SECTION_SETTINGS.gapOverlays,
    useComponentPropertyNames:
      settings && typeof settings.useComponentPropertyNames === 'boolean'
        ? settings.useComponentPropertyNames
        : DEFAULT_SECTION_SETTINGS.useComponentPropertyNames,
    useLibraryTokens:
      settings && typeof settings.useLibraryTokens === 'boolean'
        ? settings.useLibraryTokens
        : DEFAULT_SECTION_SETTINGS.useLibraryTokens,
  };
}

function getSectionNumber(counter) {
  return counter.value++;
}

function getNodeByIdSafe(id) {
  try {
    return figma.getNodeById(id);
  } catch (error) {
    console.warn('Cannot get node by id', id, error);
    return null;
  }
}

/**
 * Индексы детей от root до target (без root). Пустой массив — target совпадает с root.
 */
function getNodePathFromRoot(rootNode, targetNode) {
  if (!rootNode || !targetNode) return null;
  if (targetNode.id === rootNode.id) {
    return [];
  }

  var path = [];
  var current = targetNode;

  while (current && current.id !== rootNode.id) {
    var parent = current.parent;
    if (!parent || !('children' in parent)) {
      return null;
    }

    var idx = -1;
    var k;
    for (k = 0; k < parent.children.length; k++) {
      if (parent.children[k].id === current.id) {
        idx = k;
        break;
      }
    }
    if (idx < 0) {
      return null;
    }

    path.unshift(idx);
    current = parent;
  }

  if (!current || current.id !== rootNode.id) {
    return null;
  }

  return path;
}

function getNodeByPath(rootNode, path) {
  if (!rootNode || !path || !Array.isArray(path)) return null;

  var current = rootNode;
  var i;
  for (i = 0; i < path.length; i++) {
    var index = path[i];
    if (!current || !('children' in current)) return null;
    if (!current.children[index]) return null;
    current = current.children[index];
  }
  return current;
}

function canCloneNode(node) {
  return node && typeof node.clone === 'function';
}

function getOverlayPaddingSize(value, scale) {
  var raw = Math.max(0, Number(value) || 0);
  if (raw === 0) return 0;
  var factor = typeof scale === 'number' && !isNaN(scale) ? scale : 1;
  return Math.max(8, raw * factor);
}

function resizeCloneToFit(clone, maxWidth, maxHeight) {
  var width = clone.width || 1;
  var height = clone.height || 1;
  var scale = Math.min(1, maxWidth / width, maxHeight / height);
  if (scale < 1 && typeof clone.rescale === 'function') {
    clone.rescale(scale);
  }
  return scale;
}

var CHILD_OVERLAY_TYPES = {
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

/** Пиксельные поправки child overlay под субпиксельный рендер Figma */
var CHILD_OVERLAY_OFFSETS = {
  textY: 0,
};

function nodeHasChildren(node) {
  return node && 'children' in node && Array.isArray(node.children);
}

function getVisibleLayoutChildren(node) {
  if (!nodeHasChildren(node)) return [];

  return node.children.filter(function (child) {
    if (!child) return false;
    if ('visible' in child && child.visible === false) return false;
    if (child.name && child.name.startsWith('_')) return false;
    if (child.name && child.name.startsWith('Padding overlay')) return false;
    if (child.name && child.name.startsWith('Child overlay')) return false;
    if (child.name && child.name.startsWith('Gap overlay')) return false;
    if (child.name && child.name.startsWith('Preview /')) return false;
    if (child.name && child.name.startsWith('Target container outline')) return false;

    if (typeof child.width !== 'number' || typeof child.height !== 'number') {
      return false;
    }

    if (child.width <= 0 || child.height <= 0) {
      return false;
    }

    return true;
  });
}

function getNodeBoundsRelativeToRoot(node, rootNode) {
  var nodeBox = node && node.absoluteBoundingBox;
  var rootBox = rootNode && rootNode.absoluteBoundingBox;

  if (
    nodeBox &&
    rootBox &&
    typeof nodeBox.x === 'number' &&
    typeof nodeBox.y === 'number' &&
    typeof nodeBox.width === 'number' &&
    typeof nodeBox.height === 'number' &&
    typeof rootBox.x === 'number' &&
    typeof rootBox.y === 'number'
  ) {
    return {
      x: nodeBox.x - rootBox.x,
      y: nodeBox.y - rootBox.y,
      width: nodeBox.width,
      height: nodeBox.height,
      source: 'absoluteBoundingBox',
    };
  }

  return {
    x: node && typeof node.x === 'number' ? node.x : 0,
    y: node && typeof node.y === 'number' ? node.y : 0,
    width: node && typeof node.width === 'number' ? node.width : 0,
    height: node && typeof node.height === 'number' ? node.height : 0,
    source: 'local',
  };
}

function getGapBoundsBetweenChildrenRelativeToRoot(
  previousChild,
  nextChild,
  rootClone,
  targetNode,
  direction
) {
  var prev = getNodeBoundsRelativeToRoot(previousChild, rootClone);
  var next = getNodeBoundsRelativeToRoot(nextChild, rootClone);
  var targetBounds = getNodeBoundsRelativeToRoot(targetNode, rootClone);

  var extra = PADDING_OVERLAY_LAYOUT.extraSize || 20;

  if (direction === 'horizontal') {
    var x = prev.x + prev.width;
    var width = next.x - x;

    var height = targetBounds.height + extra;
    var y = targetBounds.y + targetBounds.height - height;

    return {
      x: x,
      y: y,
      width: width,
      height: height,
      orientation: 'vertical',
    };
  }

  if (direction === 'vertical') {
    var y2 = prev.y + prev.height;
    var height2 = next.y - y2;

    var x2 = Math.min(prev.x, next.x);
    var right = Math.max(prev.x + prev.width, next.x + next.width);
    var width2 = right - x2;

    return {
      x: x2,
      y: y2,
      width: width2,
      height: height2,
      orientation: 'horizontal',
    };
  }

  return null;
}

function createTargetContainerOutline(targetBounds) {
  var outline = figma.createFrame();
  outline.name = 'Target container outline';
  outline.layoutMode = 'NONE';
  outline.clipsContent = false;

  outline.x = Math.round(Number(targetBounds.x) || 0);
  outline.y = Math.round(Number(targetBounds.y) || 0);
  outline.resize(
    Math.max(1, Math.round(Number(targetBounds.width) || 1)),
    Math.max(1, Math.round(Number(targetBounds.height) || 1))
  );

  outline.fills = [];
  outline.strokes = [
    {
      type: 'SOLID',
      color: hexToRgb('#003F8A'),
    },
  ];
  outline.strokeWeight = 1;
  outline.strokeAlign = 'OUTSIDE';
  outline.cornerRadius = 0;

  return outline;
}

function getChildOverlayOffset(child) {
  if (child && child.type === 'TEXT') {
    return {
      x: 0,
      y: CHILD_OVERLAY_OFFSETS.textY,
    };
  }

  return {
    x: 0,
    y: 0,
  };
}

function shouldCreateChildOverlay(node) {
  if (!node) return false;
  if (!CHILD_OVERLAY_TYPES[node.type]) return false;
  if ('visible' in node && node.visible === false) return false;
  if (node.name && String(node.name).indexOf('_') === 0) return false;

  if (node.name && String(node.name).indexOf('Padding overlay') === 0) return false;
  if (node.name && String(node.name).indexOf('Child overlay') === 0) return false;
  if (node.name && String(node.name).indexOf('Gap overlay') === 0) return false;
  if (node.name && String(node.name).indexOf('Preview /') === 0) return false;
  if (node.name && String(node.name).indexOf('Target container outline') === 0) return false;

  var box = node.absoluteBoundingBox;

  var localOk =
    typeof node.width === 'number' &&
    typeof node.height === 'number' &&
    node.width > 0 &&
    node.height > 0;

  var boxOk =
    box &&
    typeof box.width === 'number' &&
    typeof box.height === 'number' &&
    box.width > 0 &&
    box.height > 0;

  if (!localOk && !boxOk) return false;

  return true;
}

async function createChildOverlay(child, rootClone) {
  if (!shouldCreateChildOverlay(child)) return null;

  var bounds = getNodeBoundsRelativeToRoot(child, rootClone);

  if (bounds.width <= 0 || bounds.height <= 0) return null;

  var offset = getChildOverlayOffset(child);

  var overlay = figma.createFrame();
  overlay.name = 'Child overlay / ' + String(child.name);
  overlay.layoutMode = 'NONE';
  overlay.clipsContent = false;

  var rx =
    rootClone && typeof rootClone.x === 'number' && !isNaN(rootClone.x) ? rootClone.x : 0;

  var ry =
    rootClone && typeof rootClone.y === 'number' && !isNaN(rootClone.y) ? rootClone.y : 0;

  overlay.x = rx + bounds.x + offset.x;
  overlay.y = ry + bounds.y + offset.y;

  overlay.resize(bounds.width, bounds.height);

  overlay.fills = [
    makeSolidPaintWithOpacity(SPEC_COLORS.childOverlayBg || SPEC_COLORS.childOverlay, 0.2),
  ];

  overlay.strokes = [];
  overlay.cornerRadius = 0;

  await tryApplyChildOverlaySemantics(overlay);

  return overlay;
}

async function createChildOverlaysForTarget(targetNode, rootClone) {
  var overlays = [];

  if (!nodeHasChildren(targetNode)) return overlays;

  var ch = targetNode.children;
  var i;
  for (i = 0; i < ch.length; i++) {
    var child = ch[i];
    if (!shouldCreateChildOverlay(child)) continue;

    var co = await createChildOverlay(child, rootClone);
    if (co) overlays.push(co);
  }

  return overlays;
}

async function createChildOverlaysForClone(clone) {
  return await createChildOverlaysForTarget(clone, clone);
}

function createZeroPointFrame() {
  var frame = figma.createFrame();
  frame.name = 'Zero point';
  frame.fills = [];
  frame.strokes = [];
  frame.resize(0, 0);
  return frame;
}

function applyOverlayPaddingForSide(overlay, side, bounds) {
  var inset = PADDING_OVERLAY_INSET || 1;

  overlay.paddingTop = 0;
  overlay.paddingRight = 0;
  overlay.paddingBottom = 0;
  overlay.paddingLeft = 0;

  if (side === 'Left' || side === 'Right') {
    var bottom = Math.max(0, Number(bounds && bounds.bottomOverlayHeight) || 0);

    overlay.paddingLeft = inset;
    overlay.paddingRight = inset;
    overlay.paddingBottom = bottom;

    return;
  }

  if (side === 'Top' || side === 'Bottom') {
    overlay.paddingTop = inset;
    overlay.paddingBottom = inset;

    return;
  }
}

function getOverlayItemSpacing(side, bounds) {
  var baseSpacing = PADDING_OVERLAY_LAYOUT.extraSize || 20;

  if (side === 'Left' || side === 'Right') {
    var topOverlayHeight = Math.max(
      0,
      Number(bounds && bounds.topOverlayHeight) || 0
    );

    return baseSpacing + topOverlayHeight;
  }

  return baseSpacing;
}

async function createMeasureFillFrame(side, bounds) {
  void side;

  var frame = figma.createFrame();
  frame.name = 'Padding measure fill';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;

  var bw = Math.round(Math.max(1, Number(bounds && bounds.width) || 1));
  var bh = Math.round(Math.max(1, Number(bounds && bounds.height) || 1));
  frame.resize(bw, bh);

  try {
    frame.layoutGrow = 1;
  } catch (error) {
    console.warn('Cannot set layoutGrow for measure fill', error);
  }

  try {
    frame.layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot set layoutAlign STRETCH for measure fill', error);
  }

  await tryApplyPaddingMeasureFillFrame(frame);

  return frame;
}

async function createGapMeasureFillFrame(bounds) {
  var frame = figma.createFrame();
  frame.name = 'Gap measure fill';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;

  frame.resize(
    Math.max(1, Number(bounds && bounds.width) || 1),
    Math.max(1, Number(bounds && bounds.height) || 1)
  );

  try {
    frame.layoutGrow = 1;
  } catch (error) {
    console.warn('Cannot set layoutGrow for gap measure fill', error);
  }

  try {
    frame.layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot set layoutAlign STRETCH for gap measure fill', error);
  }

  await tryApplyGapMeasureFillFrame(frame);

  return frame;
}

async function applyGapOverlayStroke(overlay, orientation) {
  var strokeColor = SPEC_COLORS.gapStroke || GAP_OVERLAY_COLOR;
  var strokePaint = { type: 'SOLID', color: strokeColor };
  var ctxStroke = getSpecBuildStyleContext();
  if (
    ctxStroke &&
    ctxStroke.apply &&
    ctxStroke.resolver &&
    typeof ctxStroke.apply.resolveSemanticSolidPaint === 'function'
  ) {
    try {
      strokePaint = await ctxStroke.apply.resolveSemanticSolidPaint(
        ctxStroke.resolver,
        'gapStroke'
      );
    } catch (eStroke) {
      console.warn('[StyleResolver] gap overlay stroke paint', eStroke);
    }
  }

  overlay.strokes = [strokePaint];

  try {
    overlay.strokeWeight = 0;

    if (orientation === 'vertical') {
      overlay.strokeTopWeight = 0;
      overlay.strokeBottomWeight = 0;
      overlay.strokeLeftWeight = 1;
      overlay.strokeRightWeight = 1;
      return;
    }

    if (orientation === 'horizontal') {
      overlay.strokeTopWeight = 1;
      overlay.strokeBottomWeight = 1;
      overlay.strokeLeftWeight = 0;
      overlay.strokeRightWeight = 0;
      return;
    }
  } catch (error) {
    console.warn('Partial stroke weights are not available for gap overlay.', error);

    try {
      overlay.strokeWeight = 1;

      if (orientation === 'vertical') {
        overlay.strokeTopWeight = 0;
        overlay.strokeBottomWeight = 0;
        overlay.strokeLeftWeight = 1;
        overlay.strokeRightWeight = 1;
        return;
      }

      if (orientation === 'horizontal') {
        overlay.strokeLeftWeight = 0;
        overlay.strokeRightWeight = 0;
        overlay.strokeTopWeight = 1;
        overlay.strokeBottomWeight = 1;
        return;
      }
    } catch (error2) {
      console.warn(
        'Partial stroke weights are not available for gap overlay, fallback to full stroke.',
        error2
      );

      overlay.strokeWeight = 1;
    }
  }
}

async function applyPaddingOverlayStroke(overlay, side) {
  var strokeColor =
    SPEC_COLORS.paddingStroke ||
    SPEC_COLORS.paddingValueSquare ||
    hexToRgb('#449AFF');
  var strokePaintPad = { type: 'SOLID', color: strokeColor };
  var ctxPadStroke = getSpecBuildStyleContext();
  if (
    ctxPadStroke &&
    ctxPadStroke.apply &&
    ctxPadStroke.resolver &&
    typeof ctxPadStroke.apply.resolveSemanticSolidPaint === 'function'
  ) {
    try {
      strokePaintPad = await ctxPadStroke.apply.resolveSemanticSolidPaint(
        ctxPadStroke.resolver,
        'paddingStroke'
      );
    } catch (ePadStroke) {
      console.warn('[StyleResolver] padding overlay stroke paint', ePadStroke);
    }
  }

  overlay.strokes = [strokePaintPad];

  try {
    overlay.strokeWeight = 0;

    if (side === 'Top' || side === 'Bottom') {
      overlay.strokeTopWeight = 1;
      overlay.strokeBottomWeight = 1;
      overlay.strokeLeftWeight = 0;
      overlay.strokeRightWeight = 0;
      return;
    }

    if (side === 'Left' || side === 'Right') {
      overlay.strokeTopWeight = 0;
      overlay.strokeBottomWeight = 0;
      overlay.strokeLeftWeight = 1;
      overlay.strokeRightWeight = 1;
      return;
    }
  } catch (error) {
    console.warn(
      'Partial stroke weights are not available for padding overlay, trying strokeWeight preset.',
      error
    );

    try {
      overlay.strokeWeight = 1;

      if (side === 'Top' || side === 'Bottom') {
        overlay.strokeLeftWeight = 0;
        overlay.strokeRightWeight = 0;
        overlay.strokeTopWeight = 1;
        overlay.strokeBottomWeight = 1;
        return;
      }

      if (side === 'Left' || side === 'Right') {
        overlay.strokeTopWeight = 0;
        overlay.strokeBottomWeight = 0;
        overlay.strokeLeftWeight = 1;
        overlay.strokeRightWeight = 1;
        return;
      }
    } catch (error2) {
      console.warn(
        'Partial stroke weights are not available for padding overlay, fallback to full stroke.',
        error2
      );

      overlay.strokeWeight = 1;
    }
  }
}

async function createPaddingValueSquare(tokenizedValue) {
  var rawVal =
    tokenizedValue && tokenizedValue.value != null
      ? Number(tokenizedValue.value)
      : NaN;
  var valueStr = !isNaN(rawVal) ? String(Math.round(rawVal)) : '—';

  var square = figma.createFrame();
  square.name = 'Padding value square';
  square.layoutMode = 'HORIZONTAL';
  square.primaryAxisAlignItems = 'CENTER';
  square.counterAxisAlignItems = 'CENTER';
  square.primaryAxisSizingMode = 'AUTO';
  square.counterAxisSizingMode = 'FIXED';

  square.paddingLeft = 4;
  square.paddingRight = 4;
  square.paddingTop = 0;
  square.paddingBottom = 0;

  square.itemSpacing = 0;

  square.resize(20, 20);
  square.cornerRadius = 4;

  square.fills = [
    {
      type: 'SOLID',
      color: SPEC_COLORS.paddingValueSquare || hexToRgb('#449AFF'),
    },
  ];
  square.strokes = [];
  square.clipsContent = false;

  await tryApplyPaddingValueSquareFill(square);

  var text = await createTextNode(valueStr, {
    name: 'Padding value',
    fontName: activeFontRegular,
    fontSize: 12,
    lineHeight: { unit: 'PERCENT', value: 130 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
    skipSpecFontFamily: true,
  });

  square.appendChild(text);

  await tryApplyValueSquareLabelInverse(text);

  try {
    square.counterAxisSizingMode = 'FIXED';
    square.resize(Math.max(20, square.width), 20);
  } catch (error) {
    console.warn('Cannot enforce fixed height for Padding value square', error);
  }

  return square;
}

function positionValueSquareForPaddingOverlay(square, overlay, side) {
  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch (error) {
    console.warn('Cannot set absolute positioning for value square', error);
  }

  var gap = PADDING_OVERLAY_LAYOUT.valueSquareGap || 4;

  if (side === 'Top' || side === 'Bottom') {
    square.x = -square.width - gap;
    square.y = overlay.height / 2 - square.height / 2;
    return;
  }

  if (side === 'Left' || side === 'Right') {
    square.x = overlay.width / 2 - square.width / 2;
    square.y = -square.height - gap;
    return;
  }

  square.x = -square.width - gap;
  square.y = -square.height - gap;
}

function normalizeGapBounds(bounds) {
  var normalized = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    orientation: bounds.orientation,
  };

  var minSize = 8;

  if (
    bounds.orientation === 'vertical' &&
    normalized.width > 0 &&
    normalized.width < minSize
  ) {
    var delta = minSize - normalized.width;
    normalized.x = normalized.x - delta / 2;
    normalized.width = minSize;
  }

  if (
    bounds.orientation === 'horizontal' &&
    normalized.height > 0 &&
    normalized.height < minSize
  ) {
    var delta2 = minSize - normalized.height;
    normalized.y = normalized.y - delta2 / 2;
    normalized.height = minSize;
  }

  return normalized;
}

function positionGapValueSquare(square, overlay, orientation) {
  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch (error) {
    console.warn('Cannot set absolute positioning for gap value square', error);
  }

  var gap = PADDING_OVERLAY_LAYOUT.valueSquareGap || 4;

  if (orientation === 'vertical') {
    square.x = overlay.width / 2 - square.width / 2;
    square.y = -square.height - gap;
    return;
  }

  if (orientation === 'horizontal') {
    square.x = -square.width - gap;
    square.y = overlay.height / 2 - square.height / 2;
    return;
  }

  square.x = -square.width - gap;
  square.y = -square.height - gap;
}

async function createGapValueSquare(tokenizedGap) {
  var rawVal =
    tokenizedGap && tokenizedGap.value != null
      ? Number(tokenizedGap.value)
      : NaN;
  var valueStr = !isNaN(rawVal) ? String(Math.round(rawVal)) : '—';

  var square = figma.createFrame();
  square.name = 'Gap value square';
  square.layoutMode = 'HORIZONTAL';
  square.primaryAxisAlignItems = 'CENTER';
  square.counterAxisAlignItems = 'CENTER';
  square.primaryAxisSizingMode = 'AUTO';
  square.counterAxisSizingMode = 'FIXED';

  square.paddingLeft = 4;
  square.paddingRight = 4;
  square.paddingTop = 0;
  square.paddingBottom = 0;

  square.itemSpacing = 0;

  square.resize(20, 20);
  square.cornerRadius = 4;

  square.fills = [
    {
      type: 'SOLID',
      color: SPEC_COLORS.gapValueSquare || GAP_OVERLAY_COLOR,
    },
  ];
  square.strokes = [];
  square.clipsContent = false;

  await tryApplyGapValueSquareFill(square);

  var text = await createTextNode(valueStr, {
    name: 'Gap value',
    fontName: activeFontRegular,
    fontSize: 12,
    lineHeight: { unit: 'PERCENT', value: 130 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
    skipSpecFontFamily: true,
  });

  square.appendChild(text);

  await tryApplyValueSquareLabelInverse(text);

  try {
    square.counterAxisSizingMode = 'FIXED';
    square.resize(Math.max(20, square.width), 20);
  } catch (error) {
    console.warn('Cannot enforce fixed height for Gap value square', error);
  }

  return square;
}

async function createGapOverlay(bounds, tokenizedGap, direction, options) {
  if (!bounds) return null;
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  var gapNum = Number(tokenizedGap && tokenizedGap.value);
  if (!tokenizedGap || isNaN(gapNum) || gapNum <= 0) return null;

  var normalizedBounds = normalizeGapBounds(bounds);
  var orientation = normalizedBounds.orientation || bounds.orientation;

  if (!orientation || (orientation !== 'vertical' && orientation !== 'horizontal')) {
    return null;
  }

  if (normalizedBounds.width <= 0 || normalizedBounds.height <= 0) return null;

  var bottomPaddingOverlayHeight = Math.max(
    0,
    Number(
      (options && options.bottomPaddingOverlayHeight) ||
        (bounds && bounds.bottomPaddingOverlayHeight)
    ) || 0
  );

  var overlay = figma.createFrame();
  overlay.name = 'Gap overlay';

  overlay.layoutMode = orientation === 'vertical' ? 'VERTICAL' : 'HORIZONTAL';

  var baseSpacing = PADDING_OVERLAY_LAYOUT.extraSize || 20;

  if (direction === 'horizontal') {
    overlay.paddingTop = 0;
    overlay.paddingRight = 0;
    overlay.paddingLeft = 0;
    overlay.paddingBottom = bottomPaddingOverlayHeight;
    overlay.itemSpacing = baseSpacing + bottomPaddingOverlayHeight;
  } else {
    overlay.paddingTop = 0;
    overlay.paddingRight = 0;
    overlay.paddingBottom = 0;
    overlay.paddingLeft = 0;
    overlay.itemSpacing = baseSpacing;
  }

  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'MIN';
  overlay.clipsContent = false;

  overlay.x = Math.round(Number(normalizedBounds.x) || 0);
  overlay.y = Math.round(Number(normalizedBounds.y) || 0);
  overlay.resize(
    Math.round(Math.max(1, normalizedBounds.width)),
    Math.round(Math.max(1, normalizedBounds.height))
  );

  overlay.fills = [];

  await applyGapOverlayStroke(overlay, orientation);

  try {
    overlay.primaryAxisSizingMode = 'FIXED';
    overlay.counterAxisSizingMode = 'FIXED';
  } catch (_gapOs) {}

  var zeroPoint = createZeroPointFrame();
  var measureFill = await createGapMeasureFillFrame(normalizedBounds);
  var valueSquare = await createGapValueSquare(tokenizedGap);

  overlay.appendChild(zeroPoint);
  overlay.appendChild(measureFill);
  overlay.appendChild(valueSquare);

  positionGapValueSquare(valueSquare, overlay, orientation);

  return overlay;
}

async function createGapOverlaysForTarget(targetNode, rootClone, container, options) {
  var overlays = [];

  if (!container || !container.spacing || !container.spacing.gap) {
    return overlays;
  }

  var tokenizedGap = container.spacing.gap;

  if (!tokenizedGap) {
    return overlays;
  }

  var gapNum = Number(tokenizedGap.value);
  if (isNaN(gapNum) || gapNum <= 0) {
    return overlays;
  }

  var direction = container.layout && container.layout.direction;

  if (direction !== 'horizontal' && direction !== 'vertical') {
    return overlays;
  }

  var bottomPaddingOverlayHeight = Math.max(
    0,
    Number(options && options.bottomPaddingOverlayHeight) || 0
  );

  var gapOptions = {
    bottomPaddingOverlayHeight: bottomPaddingOverlayHeight,
  };

  var children = getVisibleLayoutChildren(targetNode);

  if (children.length < 2) {
    return overlays;
  }

  var i;
  for (i = 0; i < children.length - 1; i++) {
    var previousChild = children[i];
    var nextChild = children[i + 1];

    var bounds = getGapBoundsBetweenChildrenRelativeToRoot(
      previousChild,
      nextChild,
      rootClone,
      targetNode,
      direction
    );

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      continue;
    }

    bounds.bottomPaddingOverlayHeight = bottomPaddingOverlayHeight;

    var overlay = await createGapOverlay(bounds, tokenizedGap, direction, gapOptions);

    if (overlay) {
      overlays.push(overlay);
    }
  }

  return overlays;
}

async function createGapOverlaysForClone(clone, container, options) {
  return createGapOverlaysForTarget(clone, clone, container, options);
}

async function createPaddingOverlay(side, tokenizedValue, bounds) {
  var tv =
    tokenizedValue && typeof tokenizedValue === 'object' ? tokenizedValue : null;

  if (!tv || Number(tv.value) === 0) return null;

  var bw = Math.round(Math.max(0, Number(bounds && bounds.width) || 0));
  var bh = Math.round(Math.max(0, Number(bounds && bounds.height) || 0));
  if (bw <= 0 || bh <= 0) return null;

  var isHoriz = side === 'Top' || side === 'Bottom';

  var overlay = figma.createFrame();
  overlay.name = 'Padding overlay / ' + String(side);
  overlay.layoutMode = isHoriz ? 'HORIZONTAL' : 'VERTICAL';
  overlay.itemSpacing = getOverlayItemSpacing(side, bounds);
  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'MIN';

  overlay.clipsContent = false;

  overlay.x = Math.round(Number(bounds.x) || 0);
  overlay.y = Math.round(Number(bounds.y) || 0);
  overlay.resize(bw, bh);

  overlay.fills = [];

  applyOverlayPaddingForSide(overlay, side, bounds);

  await applyPaddingOverlayStroke(overlay, side);

  try {
    overlay.primaryAxisSizingMode = 'FIXED';
    overlay.counterAxisSizingMode = 'FIXED';
  } catch (_os) {}

  var zeroPoint = createZeroPointFrame();
  var measureFill = await createMeasureFillFrame(side, bounds);
  var valueSquare = await createPaddingValueSquare(tv);

  overlay.appendChild(zeroPoint);
  overlay.appendChild(measureFill);
  overlay.appendChild(valueSquare);

  positionValueSquareForPaddingOverlay(valueSquare, overlay, side);

  return overlay;
}

async function createPreviewUnavailableWrap(messageStr, usableInnerWidth) {
  var wrap = createFrameNode('Padding overlay container', {
    fills: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    clipsContent: false,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });

  var textW =
    usableInnerWidth != null && usableInnerWidth > 0
      ? Math.max(40, usableInnerWidth - 4)
      : undefined;

  var previewText = await createTextNode(String(messageStr), {
    name: 'Preview unavailable',
    fontName: activeFontRegular,
    fontSize: 12,
    lineHeight: { unit: 'PERCENT', value: 130 },
    fills: [{ type: 'SOLID', color: SPEC_COLORS.labelText }],
    width: textW,
  });

  await tryApplyLabelTextTertiary(previewText);

  wrap.appendChild(previewText);

  return wrap;
}

async function createPaddingVisualization(
  container,
  rootSourceNode,
  usableInnerWidth,
  designTokens,
  sections,
  options
) {
  void designTokens;

  options = options || {};

  var previewSections = normalizeSectionSettings(sections || {});

  var overlayContainer = figma.createFrame();
  overlayContainer.name = 'Padding overlay container';
  overlayContainer.layoutMode = 'NONE';
  overlayContainer.clipsContent = false;
  overlayContainer.fills = [];
  overlayContainer.strokes = [];

  if (!canCloneNode(rootSourceNode)) {
    return createPreviewUnavailableWrap('Preview недоступен', usableInnerWidth);
  }

  var targetNodeId =
    options.targetNodeId != null && options.targetNodeId !== ''
      ? options.targetNodeId
      : rootSourceNode.id;

  var originalTargetNode = getNodeByIdSafe(targetNodeId);
  if (!originalTargetNode) {
    originalTargetNode = rootSourceNode;
  }

  var targetPath = getNodePathFromRoot(rootSourceNode, originalTargetNode);

  var rootClone = null;
  try {
    rootClone = rootSourceNode.clone();
    rootClone.name = 'Preview / ' + String(rootSourceNode.name);
  } catch (cloneErr) {
    console.warn('Cannot clone source node', cloneErr);

    return createPreviewUnavailableWrap('Preview недоступен', usableInnerWidth);
  }

  var maxCloneW =
    usableInnerWidth != null && usableInnerWidth > 0
      ? Math.max(32, usableInnerWidth)
      : Math.max(32, getPreviewCardWidth() - 40);

  var maxCloneH = 180;
  var scale = resizeCloneToFit(rootClone, maxCloneW, maxCloneH);

  var targetCloneNode = rootClone;

  if (targetPath != null && targetPath.length > 0) {
    var resolved = getNodeByPath(rootClone, targetPath);
    if (resolved) {
      targetCloneNode = resolved;
    }
  }

  var targetBounds;
  if (targetCloneNode === rootClone) {
    targetBounds = {
      x: 0,
      y: 0,
      width: rootClone.width,
      height: rootClone.height,
    };
  } else {
    var rel = getNodeBoundsRelativeToRoot(targetCloneNode, rootClone);
    targetBounds = {
      x: rel.x,
      y: rel.y,
      width: rel.width,
      height: rel.height,
    };
  }

  var cw = Math.max(1, Math.round(Number(rootClone.width) || 1));
  var ch = Math.max(1, Math.round(Number(rootClone.height) || 1));

  var targetW = Math.max(1, Math.round(Number(targetBounds.width) || 1));
  var targetH = Math.max(1, Math.round(Number(targetBounds.height) || 1));

  var pad = container.padding;
  var top = Math.round(getOverlayPaddingSize(pad.top.value, scale));
  var right = Math.round(getOverlayPaddingSize(pad.right.value, scale));
  var bottom = Math.round(getOverlayPaddingSize(pad.bottom.value, scale));
  var left = Math.round(getOverlayPaddingSize(pad.left.value, scale));

  var topSize = Math.min(top, targetH);
  var bottomSize = Math.min(bottom, targetH);
  var leftSize = Math.min(left, targetW);
  var rightSize = Math.min(right, targetW);

  var targetX = Math.round(Number(targetBounds.x) || 0);
  var targetY = Math.round(Number(targetBounds.y) || 0);
  var targetWidth = targetW;
  var targetHeight = targetH;

  rootClone.x = 0;
  rootClone.y = 0;

  overlayContainer.appendChild(rootClone);
  overlayContainer.resize(cw, ch);

  var targetOutline = createTargetContainerOutline(targetBounds);
  overlayContainer.appendChild(targetOutline);

  await tryApplyTargetOutlineStroke(targetOutline);

  if (previewSections.childOverlays !== false) {
    var childOverlaysList = await createChildOverlaysForTarget(targetCloneNode, rootClone);
    var cj;
    for (cj = 0; cj < childOverlaysList.length; cj++) {
      overlayContainer.appendChild(childOverlaysList[cj]);
    }
  }

  if (previewSections.gapOverlays !== false) {
    var gapOverlaysList = await createGapOverlaysForTarget(
      targetCloneNode,
      rootClone,
      container,
      {
        bottomPaddingOverlayHeight: bottomSize,
      }
    );
    var gi;
    for (gi = 0; gi < gapOverlaysList.length; gi++) {
      overlayContainer.appendChild(gapOverlaysList[gi]);
    }
  }

  var extra = PADDING_OVERLAY_LAYOUT.extraSize || 20;

  var oTop = await createPaddingOverlay('Top', pad.top, {
    x: targetX - extra,
    y: targetY,
    width: targetWidth + extra,
    height: topSize,
  });

  var oRight = await createPaddingOverlay('Right', pad.right, {
    x: targetX + targetWidth - rightSize,
    y: targetY - extra,
    width: rightSize,
    height: targetHeight + extra,
    topOverlayHeight: topSize,
    bottomOverlayHeight: bottomSize,
  });

  var oBottom = await createPaddingOverlay('Bottom', pad.bottom, {
    x: targetX - extra,
    y: targetY + targetHeight - bottomSize,
    width: targetWidth + extra,
    height: bottomSize,
  });

  var oLeft = await createPaddingOverlay('Left', pad.left, {
    x: targetX,
    y: targetY - extra,
    width: leftSize,
    height: targetHeight + extra,
    topOverlayHeight: topSize,
    bottomOverlayHeight: bottomSize,
  });

  if (oTop) overlayContainer.appendChild(oTop);
  if (oRight) overlayContainer.appendChild(oRight);
  if (oBottom) overlayContainer.appendChild(oBottom);
  if (oLeft) overlayContainer.appendChild(oLeft);

  return overlayContainer;
}

async function createContainerPreviewCard(container, root, designTokens, sections) {
  var rad = getDesignRadiusMd(designTokens);
  var previewCardW = getPreviewCardWidth();
  var padLR = 120;
  var padTB = 80;

  var card = createFrameNode('Container preview card', {
    fills: [],
    strokes: [],
    strokeWeight: 0,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    cornerRadius: rad,
    paddingTop: padTB,
    paddingRight: padLR,
    paddingBottom: padTB,
    paddingLeft: padLR,
    counterAxisAlignItems: 'MIN',
    primaryAxisAlignItems: 'CENTER',
    clipsContent: false,
    effects: SPEC_EFFECTS.cardShadow,
  });

  try {
    card.strokes = [];
    card.strokeWeight = 0;
  } catch (_noStroke) {}

  try {
    card.layoutMode = 'VERTICAL';
    card.paddingLeft = padLR;
    card.paddingRight = padLR;
    card.paddingTop = padTB;
    card.paddingBottom = padTB;
    card.primaryAxisAlignItems = 'CENTER';
    card.counterAxisAlignItems = 'MIN';
  } catch (_previewPadAlignErr) {}

  try {
    card.clipsContent = false;
  } catch (_clipErr) {}

  await tryApplyContainerPreviewCardTokens(card);

  var innerUsable = Math.max(32, previewCardW - padLR * 2);

  var viz = await createPaddingVisualization(
    container,
    root,
    innerUsable,
    designTokens,
    sections,
    {
      targetNodeId: container.id,
    }
  );

  card.appendChild(viz);

  try {
    card.resizeWithoutConstraints(previewCardW, card.height);
  } catch (_previewResizeErr) {}

  try {
    card.layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot set Container preview card layoutAlign STRETCH', error);
  }

  return card;
}

async function createContainerSpecRow(container, index, root, designTokens, sections) {
  void index;

  var row = createFrameNode('Container spec row', {
    fills: [],
    layoutMode: 'HORIZONTAL',
    itemSpacing: SPEC_CARD_LAYOUT.rowGap,
    strokes: [],
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    counterAxisAlignItems: 'CENTER',
    primaryAxisAlignItems: 'MIN',
    clipsContent: false,
  });

  row.clipsContent = false;

  var descCard = await createContainerCard(container, index, designTokens);
  row.appendChild(descCard);

  var preview = await createContainerPreviewCard(container, root, designTokens, sections);
  row.appendChild(preview);

  row.resizeWithoutConstraints(
    descCard.width + preview.width + SPEC_CARD_LAYOUT.rowGap,
    Math.max(descCard.height, preview.height)
  );

  return row;
}

async function createEmptySectionsNotice(designTokens) {
  void designTokens;

  var wrap = createFrameNode('No sections enabled', {
    fills: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 8,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    width: INNER_CONTENT_WIDTH,
    paddingTop: 16,
    paddingRight: 0,
    paddingBottom: 16,
    paddingLeft: 0,
  });

  var hintNode = await createTextNode('Не выбраны информационные блоки для отображения.', {
    name: 'No sections hint',
    fontName: activeFontRegular,
    fontSize: 14,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textSecondary }],
    width: INNER_CONTENT_WIDTH - 8,
  });
  wrap.appendChild(hintNode);
  await tryApplyTextSecondary(hintNode);

  return wrap;
}

async function createStandaloneWarningsSection(spec, designTokens, sectionOrdinal) {
  var title =
    sectionOrdinal != null
      ? String(sectionOrdinal) + '. Предупреждения'
      : 'Предупреждения';

  var section = createFrameNode('Standalone warnings section', {
    fills: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });
  section.resize(INNER_CONTENT_WIDTH, section.height);

  section.appendChild(await createSectionTitle(title, designTokens));

  var warnBlock = await createWarningBlock(spec.warnings, null, designTokens);

  section.appendChild(warnBlock);
  stretchChildHorizontal(warnBlock);

  return section;
}

function isSupportedNode(node) {
  var t = node.type;
  return (
    t === 'COMPONENT' || t === 'INSTANCE' || t === 'FRAME' || t === 'COMPONENT_SET'
  );
}

function getSelectionInfo() {
  var selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      selected: false,
      supported: false,
      error: 'Выберите компонент, фрейм или инстанс для генерации спецификации.',
    };
  }

  if (selection.length > 1) {
    return {
      selected: true,
      supported: false,
      error: 'Выберите только один компонент, фрейм или инстанс.',
    };
  }

  var node = selection[0];
  var base = {
    selected: true,
    name: node.name,
    nodeType: node.type,
  };

  if (!isSupportedNode(node)) {
    return Object.assign({}, base, {
      supported: false,
      error: 'Выбранный тип слоя не поддерживается. Выберите компонент, фрейм или инстанс.',
    });
  }

  return Object.assign({}, base, {
    supported: true,
  });
}

function sendSelectionInfo() {
  figma.ui.postMessage({
    type: 'SELECTION_INFO',
    payload: getSelectionInfo(),
  });
}

function toSpacingToken(raw) {
  var v = Math.round(raw);
  var tok = spacingTokens[v];

  if (tok) {
    return {
      value: v,
      unit: 'px',
      token: tok,
      isCustom: false,
    };
  }

  return {
    value: v,
    unit: 'px',
    token: 'custom',
    isCustom: true,
  };
}

function getDirection(node) {
  if (!('layoutMode' in node) || node.layoutMode === undefined) {
    return 'none';
  }

  switch (node.layoutMode) {
    case 'HORIZONTAL':
      return 'horizontal';
    case 'VERTICAL':
      return 'vertical';
    case 'GRID':
      return 'grid';
    case 'NONE':
      return 'none';
    default:
      return 'none';
  }
}

function getSizingMode(value) {
  switch (value) {
    case 'FILL':
      return 'fill';
    case 'HUG':
      return 'hug';
    case 'FIXED':
      return 'fixed';
    default:
      return 'unknown';
  }
}

function parseSizing(node) {
  var wMode = 'unknown';
  var hMode = 'unknown';

  if ('layoutSizingHorizontal' in node && node.layoutSizingHorizontal !== undefined) {
    wMode = getSizingMode(node.layoutSizingHorizontal);
  }

  if ('layoutSizingVertical' in node && node.layoutSizingVertical !== undefined) {
    hMode = getSizingMode(node.layoutSizingVertical);
  }

  return {
    width: { mode: wMode, value: Math.round(node.width) },
    height: { mode: hMode, value: Math.round(node.height) },
  };
}

function parsePadding(node) {
  function padSide(prop) {
    if (prop in node && typeof node[prop] === 'number') return toSpacingToken(node[prop]);
    return toSpacingToken(0);
  }

  return {
    top: padSide('paddingTop'),
    right: padSide('paddingRight'),
    bottom: padSide('paddingBottom'),
    left: padSide('paddingLeft'),
  };
}

function parseSpacing(node) {
  if (
    !('layoutMode' in node) ||
    node.layoutMode === undefined ||
    node.layoutMode === 'NONE'
  ) {
    return { source: 'none' };
  }

  var out = {
    source: 'auto-layout',
  };

  if ('itemSpacing' in node && typeof node.itemSpacing === 'number') {
    out.gap = toSpacingToken(node.itemSpacing);
  }

  if ('counterAxisSpacing' in node && typeof node.counterAxisSpacing === 'number') {
    out.rowGap = toSpacingToken(node.counterAxisSpacing);
  }

  return out;
}

function pathJoin(parts) {
  return parts.join(' / ');
}

function isComponentBoundaryNode(node) {
  return (
    node &&
    (node.type === 'INSTANCE' ||
      node.type === 'COMPONENT' ||
      node.type === 'COMPONENT_SET')
  );
}

function canTraverseSpecNode(node, rootNode) {
  if (!node) return false;

  if (node.id === rootNode.id) {
    return true;
  }

  if (isComponentBoundaryNode(node)) {
    return false;
  }

  if (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  ) {
    return true;
  }

  return false;
}

function shouldCreateContainerSpecForNode(node, rootNode) {
  if (!node) return false;

  if (node.id === rootNode.id) {
    return true;
  }

  if (isComponentBoundaryNode(node)) {
    return false;
  }

  if (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  ) {
    return true;
  }

  return false;
}

function shouldIncludeSpecNode(node) {
  return !!node;
}

function walkSpecNode(node, rootNode, containers, parts) {
  if (!shouldIncludeSpecNode(node)) {
    return;
  }

  if (shouldCreateContainerSpecForNode(node, rootNode)) {
    var dir = getDirection(node);
    var layout = {
      direction: dir,
      wrap:
        'layoutWrap' in node && node.layoutWrap !== undefined
          ? node.layoutWrap === 'WRAP'
          : false,
    };

    if ('primaryAxisAlignItems' in node && node.primaryAxisAlignItems !== undefined) {
      layout.primaryAxisAlignment = String(node.primaryAxisAlignItems);
    }

    if ('counterAxisAlignItems' in node && node.counterAxisAlignItems !== undefined) {
      layout.counterAxisAlignment = String(node.counterAxisAlignItems);
    }

    var padding = parsePadding(node);
    var spacing = parseSpacing(node);

    var childNames = [];
    if ('children' in node && node.children && node.children.length) {
      for (var ci = 0; ci < node.children.length; ci++) {
        childNames.push(node.children[ci].name);
      }
    }

    var warnings = [];

    if (dir === 'none') {
      warnings.push(
        'Контейнер не использует Auto Layout. Padding и spacing могут быть неполными.'
      );
    }

    var hasCustomSpacing =
      padding.top.isCustom ||
      padding.right.isCustom ||
      padding.bottom.isCustom ||
      padding.left.isCustom ||
      !!(spacing.gap && spacing.gap.isCustom) ||
      !!(spacing.rowGap && spacing.rowGap.isCustom);

    if (hasCustomSpacing) {
      warnings.push('Некоторые spacing-значения не совпадают с токенами.');
    }

    containers.push({
      id: node.id,
      name: node.name,
      path: pathJoin(parts),
      type: node.type,
      layout: layout,
      sizing: parseSizing(node),
      padding: padding,
      spacing: spacing,
      children: childNames,
      warnings: warnings,
    });
  }

  if (!canTraverseSpecNode(node, rootNode)) {
    return;
  }

  if (!('children' in node) || !node.children || !node.children.length) return;

  for (var i = 0; i < node.children.length; i++) {
    var ch = node.children[i];
    walkSpecNode(ch, rootNode, containers, parts.concat([ch.name]));
  }
}

function parseContainers(root) {
  var containers = [];
  walkSpecNode(root, root, containers, [root.name]);
  return containers;
}

function parseAnatomy(root) {
  var items = [
    {
      id: root.id,
      name: 'Container',
      type: root.type,
      required: true,
      description: 'Основной контейнер компонента.',
    },
  ];

  function shouldSkip(child) {
    if (child.visible === false) return true;
    if (child.name && child.name.charAt(0) === '_') return true;
    switch (child.type) {
      case 'VECTOR':
      case 'BOOLEAN_OPERATION':
      case 'LINE':
      case 'ELLIPSE':
        return true;
      default:
        return false;
    }
  }

  function optionalFromName(nm) {
    var s = String(nm || '').toLowerCase();
    if (s.indexOf('optional') !== -1 || s.indexOf('slot') !== -1) return true;
    return false;
  }

  function desc(child) {
    switch (child.type) {
      case 'TEXT':
        return 'Текстовый элемент внутри компонента.';
      case 'FRAME':
        return 'Контейнер или структурная область компонента.';
      case 'INSTANCE':
        return 'Вложенный экземпляр компонента.';
      case 'COMPONENT':
        return 'Вложенный компонент.';
      default:
        return 'Элемент компонента.';
    }
  }

  if (!('children' in root) || !root.children || !root.children.length) {
    return items;
  }

  for (var i = 0; i < root.children.length; i++) {
    var ch = root.children[i];
    if (shouldSkip(ch)) continue;

    items.push({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      required: optionalFromName(ch.name) === false,
      description: desc(ch),
    });
  }

  return items;
}

function escapeMarkdownTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}



function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTokenWithValue(tokenizedValue) {
  if (!tokenizedValue) return '—';
  var ctxSp = getSpecBuildStyleContext();
  if (ctxSp && ctxSp.spacingTokenResolver && typeof tokenizedValue.value === 'number') {
    return ctxSp.spacingTokenResolver.formatSpacingValue(tokenizedValue.value);
  }
  var px = tokenizedValue.value + 'px';
  if (!tokenizedValue.token || tokenizedValue.token === 'custom') {
    return 'custom (' + px + ')';
  }
  return tokenizedValue.token + ' (' + px + ')';
}

function formatDirection(direction) {
  switch (direction) {
    case 'vertical':
      return 'Vertical';
    case 'horizontal':
      return 'Horizontal';
    case 'grid':
      return 'Grid';
    case 'none':
      return 'None';
    default:
      return 'None';
  }
}

function formatSizingModeOnly(sizing) {
  if (!sizing || !sizing.mode) return 'None';
  switch (sizing.mode) {
    case 'fill':
      return 'Fill';
    case 'hug':
      return 'Hug';
    case 'fixed':
      return 'Fixed';
    default:
      return 'None';
  }
}

function formatAlignmentForContainer(container) {
  var direction = container.layout.direction;
  var primary = container.layout.primaryAxisAlignment;
  var counter = container.layout.counterAxisAlignment;

  if (direction === 'none') return 'None';
  if (direction === 'grid') return 'None';

  function mapVertical(value) {
    if (value === 'MIN') return 'top';
    if (value === 'CENTER') return 'center';
    if (value === 'MAX') return 'bottom';
    if (value === 'SPACE_BETWEEN') return 'space between';
    return '—';
  }

  function mapHorizontal(value) {
    if (value === 'MIN') return 'left';
    if (value === 'CENTER') return 'center';
    if (value === 'MAX') return 'right';
    if (value === 'SPACE_BETWEEN') return 'space between';
    return '—';
  }

  var verticalPart = '—';
  var horizontalPart = '—';

  if (direction === 'vertical') {
    verticalPart = mapVertical(primary);
    horizontalPart = mapHorizontal(counter);
  } else if (direction === 'horizontal') {
    horizontalPart = mapHorizontal(primary);
    verticalPart = mapVertical(counter);
  } else {
    return 'None';
  }

  if (verticalPart === 'center' && horizontalPart === 'center') {
    return 'Center';
  }

  if (verticalPart === '—' && horizontalPart === '—') {
    return 'None';
  }

  if (verticalPart === '—') {
    return capitalizeFirst(horizontalPart);
  }

  if (horizontalPart === '—') {
    return capitalizeFirst(verticalPart);
  }

  return capitalizeFirst(verticalPart + ' ' + horizontalPart);
}

function formatGapForSpec(container) {
  var g = container.spacing && container.spacing.gap;
  if (!g || g.value === 0) return 'None';
  var ctxSp = getSpecBuildStyleContext();
  if (ctxSp && ctxSp.spacingTokenResolver) {
    return ctxSp.spacingTokenResolver.formatSpacingValue(g.value);
  }
  return formatTokenWithValue(g);
}

function formatRequired(required) {
  return required ? 'Обязательный' : 'Опциональный';
}

function makeSolidPaint(color) {
  return { type: 'SOLID', color: color };
}

async function getLocalTextStyleByNames(names) {
  try {
    var styles = await figma.getLocalTextStylesAsync();
    var i;
    for (i = 0; i < styles.length; i++) {
      if (tokenNameMatches(styles[i].name, names)) return styles[i];
    }
    return null;
  } catch (error) {
    console.warn('Cannot read local text styles', error);
    return null;
  }
}

async function getLibraryTextStyleByNames(names) {
  try {
    var tl = figma.teamLibrary;
    if (!tl) {
      return null;
    }

    if (typeof tl.getAvailableLibraryTextStylesAsync === 'function') {
      var libraryStyles = await tl.getAvailableLibraryTextStylesAsync();
      var j;
      for (j = 0; j < libraryStyles.length; j++) {
        if (tokenNameMatches(libraryStyles[j].name, names)) break;
      }
      if (j >= libraryStyles.length) return null;
      var matched = libraryStyles[j];

      if (typeof figma.importStyleByKeyAsync === 'function' && matched.key)
        return await figma.importStyleByKeyAsync(matched.key);

      return matched;
    }

    return null;
  } catch (error) {
    console.warn('Cannot read library text styles', error);
    return null;
  }
}

async function resolveTextStyle(names, fallbackLabel) {
  var ls = await getLocalTextStyleByNames(names);
  if (ls) return { source: 'local', style: ls };

  var lib = await getLibraryTextStyleByNames(names);
  if (lib) return { source: 'library', style: lib };

  return { source: 'fallback', style: null };
}

async function getLocalVariableByNames(names) {
  try {
    if (
      !figma.variables ||
      typeof figma.variables.getLocalVariablesAsync !== 'function'
    )
      return null;

    var variables = await figma.variables.getLocalVariablesAsync();
    var vi;
    for (vi = 0; vi < variables.length; vi++) {
      if (tokenNameMatches(variables[vi].name, names)) return variables[vi];
    }
    return null;
  } catch (error) {
    console.warn('Cannot read local variables', error);
    return null;
  }
}

async function getLibraryVariableByNames(names) {
  try {
    var tl = figma.teamLibrary;
    if (!tl || !figma.variables) {
      console.warn('Variables Team Library API is not available.');
      return null;
    }

    if (
      typeof tl.getAvailableLibraryVariableCollectionsAsync !== 'function' ||
      typeof tl.getVariablesInLibraryCollectionAsync !== 'function' ||
      typeof figma.variables.importVariableByKeyAsync !== 'function'
    ) {
      console.warn('Library variable import API is not available.');
      return null;
    }

    var collections = await tl.getAvailableLibraryVariableCollectionsAsync();
    var ci;
    for (ci = 0; ci < collections.length; ci++) {
      var collection = collections[ci];
      var collectionName = collection.name || '';
      var vars = await tl.getVariablesInLibraryCollectionAsync(collection.key);
      var vdx;
      for (vdx = 0; vdx < vars.length; vdx++) {
        var d = vars[vdx];
        var vn = d.name || '';
        var candA = vn;
        var candB = collectionName ? collectionName + '/' + vn : vn;
        if (
          (tokenNameMatches(candA, names) || tokenNameMatches(candB, names)) &&
          d.key
        )
          return await figma.variables.importVariableByKeyAsync(d.key);
      }
    }
    return null;
  } catch (error) {
    console.warn('Cannot read library variables', error);
    return null;
  }
}

async function resolveVariableByNames(names, fallbackLabel) {
  var lv = await getLocalVariableByNames(names);
  if (lv) return { source: 'local', variable: lv };

  var gv = await getLibraryVariableByNames(names);
  if (gv) return { source: 'library', variable: gv };

  return { source: 'fallback', variable: null };
}

function getFirstVariableValue(variable) {
  if (!variable || !variable.valuesByMode) return null;
  var mids = [];
  var mk;
  for (mk in variable.valuesByMode) {
    if (Object.prototype.hasOwnProperty.call(variable.valuesByMode, mk))
      mids.push(mk);
  }
  if (!mids.length) return null;
  return variable.valuesByMode[mids[0]];
}

function isColorValue(value) {
  return (
    value &&
    typeof value.r === 'number' &&
    typeof value.g === 'number' &&
    typeof value.b === 'number'
  );
}

function isNumberValue(value) {
  return typeof value === 'number' && !isNaN(value);
}

function rgbFromNestedValue(raw) {
  if (isColorValue(raw)) return { r: raw.r, g: raw.g, b: raw.b };
  if (!raw || typeof raw !== 'object') return null;

  try {
    if (raw.type === 'VARIABLE_ALIAS' && raw.id) return null;
  } catch (_eSkip) {}

  if (raw.color) {
    var c = rgbFromNestedValue(raw.color);
    if (c) return c;
  }

  var k;
  for (k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    var n = rgbFromNestedValue(raw[k]);
    if (n) return n;
  }

  return null;
}

async function resolveColorTokenByNames(names, fallbackColor, fallbackLabel) {
  var rv = await resolveVariableByNames(names, fallbackLabel);
  if (rv.variable)
    return {
      source: rv.source,
      variable: rv.variable,
      paints: null,
      styleId: null,
    };

  try {
    var paintStyles = await figma.getLocalPaintStylesAsync();
    var pi;
    for (pi = 0; pi < paintStyles.length; pi++) {
      var paintStyle = paintStyles[pi];
      if (!tokenNameMatches(paintStyle.name, names)) continue;

      var plist = [];
      try {
        if (paintStyle.paints && paintStyle.paints.length)
          plist = paintStyle.paints.concat();
      } catch (_eP) {}

      return {
        source: 'local-style',
        variable: null,
        styleId: paintStyle.id,
        paints:
          plist.length > 0 ? plist : [makeSolidPaint(fallbackColor)],
      };
    }
  } catch (error) {
    console.warn('Cannot read local paint styles', error);
  }

  return {
    source: 'fallback',
    variable: null,
    styleId: null,
    paints: [makeSolidPaint(fallbackColor)],
  };
}

function createPaintFromColorToken(tokenResult, fallbackColor) {
  var vbind = tokenResult && tokenResult.variable ? tokenResult.variable : null;

  if (vbind && figma.variables) {
    var canBind =
      typeof figma.variables.setBoundVariableForPaint === 'function';

    if (canBind) {
      try {
        var bp = figma.variables.setBoundVariableForPaint(
          makeSolidPaint(fallbackColor),
          'color',
          vbind
        );
        return bp;
      } catch (error) {
        console.warn('Cannot bind variable to paint', error);
      }
    }

    var fv = rgbFromNestedValue(getFirstVariableValue(vbind));
    if (fv) return makeSolidPaint(fv);
  }

  if (tokenResult && tokenResult.paints && tokenResult.paints.length)
    return tokenResult.paints[0];

  return makeSolidPaint(fallbackColor);
}

function applyFillToken(node, tokenResult, fallbackColor) {
  try {
    if (tokenResult && tokenResult.styleId && 'fillStyleId' in node) {
      node.fillStyleId = tokenResult.styleId;
      return;
    }

    node.fills = [createPaintFromColorToken(tokenResult, fallbackColor)];
  } catch (error) {
    console.warn('Cannot apply fill token', error);

    try {
      node.fills = [makeSolidPaint(fallbackColor)];
    } catch (_eB) {}
  }
}

function applyStrokeToken(node, tokenResult, fallbackColor, strokeWeight) {
  strokeWeight = strokeWeight != null ? strokeWeight : 1;

  try {
    node.strokeWeight = strokeWeight;

    if (tokenResult && tokenResult.styleId && 'strokeStyleId' in node) {
      node.strokeStyleId = tokenResult.styleId;
      return;
    }

    node.strokes = [
      createPaintFromColorToken(tokenResult, fallbackColor),
    ];
  } catch (error) {
    console.warn('Cannot apply stroke token', error);

    try {
      node.strokes = [makeSolidPaint(fallbackColor)];
    } catch (_eS) {}
  }
}

async function resolveNumberTokenByNames(names, fallbackValue, fallbackLabel) {
  var rv = await resolveVariableByNames(names, fallbackLabel);
  var vr = rv.variable;

  if (vr) {
    var value = getFirstVariableValue(vr);
    var n = null;

    if (isNumberValue(value)) n = value;
    else if (typeof value === 'string') {
      var p = parseFloat(value);
      if (!isNaN(p)) n = p;
    }

    if (n !== null)
      return {
        source: rv.source,
        value: Math.round(n),
        variable: vr,
      };

    console.warn('Variable found but value is not number: ' + fallbackLabel);
  }

  return { source: 'fallback', value: fallbackValue, variable: null };
}

async function loadSpecDesignTokens() {
  try {
    var headingStyleResult = await resolveTextStyle(
      [
        LIBRARY_TOKEN_NAMES.textStyles.cardHeading,
        'Typography & Colors/desktop/h5',
      ],
      LIBRARY_TOKEN_NAMES.textStyles.cardHeading
    );

    var bodyStyleResult = await resolveTextStyle(
      [
        LIBRARY_TOKEN_NAMES.textStyles.body,
        'Typography & Colors/Body/Paragraph (14px)',
        'Body/paragraph (14px)',
      ],
      LIBRARY_TOKEN_NAMES.textStyles.body
    );

    var cardBackground = await resolveColorTokenByNames(
      [
        LIBRARY_TOKEN_NAMES.colors.cardBackground,
        'Typography & Colors/Background/Secondary',
        'background/secondary',
      ],
      { r: 1, g: 1, b: 1 },
      LIBRARY_TOKEN_NAMES.colors.cardBackground
    );

    var cardBorder = await resolveColorTokenByNames(
      [
        LIBRARY_TOKEN_NAMES.colors.cardBorder,
        'Typography & Colors/Stroke/Divider-light',
        'stroke/divider-light',
      ],
      hexToRgb('#EAE8E8'),
      LIBRARY_TOKEN_NAMES.colors.cardBorder
    );

    var radiusMd = await resolveNumberTokenByNames(
      [
        LIBRARY_TOKEN_NAMES.radius.md,
        LIBRARY_TOKEN_NAMES.radius.mdFullPath,
        'Typography & Colors/Radius/md',
      ],
      RADIUS_VALUES.md,
      'Radius/md'
    );

    var spaceMedium = await resolveNumberTokenByNames(
      [
        LIBRARY_TOKEN_NAMES.spaces.medium,
        LIBRARY_TOKEN_NAMES.spaces.mediumFullPath,
        'Typography & Colors/Spaces/medium',
      ],
      SPACING_VALUES.medium,
      'Spaces/medium'
    );

    var spaceXl = await resolveNumberTokenByNames(
      [
        LIBRARY_TOKEN_NAMES.spaces.xl,
        LIBRARY_TOKEN_NAMES.spaces.xlFullPath,
        'Typography & Colors/Spaces/xl',
      ],
      SPACING_VALUES.xl,
      'Spaces/xl'
    );

    return {
      textStyles: {
        headingStyle: headingStyleResult.style,
        bodyStyle: bodyStyleResult.style,
      },
      colors: {
        cardBackground: cardBackground,
        cardBorder: cardBorder,
        headingDivider: cardBorder,
      },
      radius: {
        md: radiusMd.value,
      },
      spaces: {
        medium: spaceMedium.value,
        xl: spaceXl.value,
      },
    };
  } catch (error) {
    console.warn('loadSpecDesignTokens failed:', error);

    var fbDivider = {
      variable: null,
      paints: [makeSolidPaint(SPEC_COLORS.cardBorder)],
      styleId: null,
    };

    var fbBg = {
      variable: null,
      paints: [makeSolidPaint(SPEC_COLORS.containerCardBg)],
      styleId: null,
    };

    var fbBd = {
      variable: null,
      paints: [makeSolidPaint(SPEC_COLORS.cardBorder)],
      styleId: null,
    };

    return {
      textStyles: { headingStyle: null, bodyStyle: null },
      colors: {
        cardBackground: fbBg,
        cardBorder: fbBd,
        headingDivider: fbDivider,
      },
      radius: { md: RADIUS_VALUES.md },
      spaces: { medium: SPACING_VALUES.medium, xl: SPACING_VALUES.xl },
    };
  }
}

async function loadSpecFonts() {
  try {
    await Promise.all([
      figma.loadFontAsync(FONT_PT_SANS_REGULAR),
      figma.loadFontAsync(FONT_PT_SANS_BOLD),
    ]);
    activeFontRegular = FONT_PT_SANS_REGULAR;
    activeFontBold = FONT_PT_SANS_BOLD;
    activeFontMedium = FONT_PT_SANS_REGULAR;
    return;
  } catch (error) {
    console.warn('PT Sans is not available, trying Inter.', error);
  }

  try {
    await Promise.all([
      figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
      figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
    ]);

    activeFontRegular = { family: 'Inter', style: 'Regular' };
    activeFontBold = { family: 'Inter', style: 'Bold' };

    activeFontMedium = FONT_MEDIUM;
    try {
      await figma.loadFontAsync(FONT_MEDIUM);
    } catch (_) {}

    return;
  } catch (error) {
    console.warn('Inter is not available, trying Roboto.', error);
  }

  await Promise.all([
    figma.loadFontAsync({ family: 'Roboto', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Roboto', style: 'Bold' }),
  ]);

  activeFontRegular = { family: 'Roboto', style: 'Regular' };
  activeFontBold = { family: 'Roboto', style: 'Bold' };
  activeFontMedium = { family: 'Roboto', style: 'Medium' };
  try {
    await figma.loadFontAsync(activeFontMedium);
  } catch (_) {
    activeFontMedium = activeFontRegular;
  }
}


// AnatomyGenerator module. Keep this block isolated so it can be copied to another Figma plugin.

var AnatomyGenerator = (function () {
  var ANATOMY_LAYOUT = {
    markerSize: 24,
    markerOffset: 20,
    connectorThickness: 1,
    framePadding: 40,
    listGap: 120,
    listWidth: 260,
  };

  var ANATOMY_COLORS = {
    accent: hexToRgb('#FC8507'),
    markerText: { r: 1, g: 1, b: 1 },
    listText: hexToRgb('#4E4E4E'),
    background: hexToRgb('#F7F7F7'),
  };

  var DEFAULT_OPTIONS = {
    maxItems: 32,
    maxDepth: 8,
    sortMode: 'tree',
    includeHidden: false,
    includeContainer: false,

    framePadding: ANATOMY_LAYOUT.framePadding,
    listGap: ANATOMY_LAYOUT.listGap,
    listWidth: ANATOMY_LAYOUT.listWidth,

    markerSize: ANATOMY_LAYOUT.markerSize,
    markerOffset: ANATOMY_LAYOUT.markerOffset,
    connectorThickness: ANATOMY_LAYOUT.connectorThickness,
    markerRadius: 12,

    markerColor: ANATOMY_COLORS.accent,
    markerTextColor: ANATOMY_COLORS.markerText,
    connectorColor: ANATOMY_COLORS.accent,

    listTextColor: ANATOMY_COLORS.listText,

    fontRegular: { family: 'PT Sans', style: 'Regular' },
    fontBold: { family: 'PT Sans', style: 'Bold' },

    scale: 1,

    backgroundColor: ANATOMY_COLORS.background,
    frameFillColor: ANATOMY_COLORS.background,

    useComponentPropertyNames: true,
  };

  function mergeOptions(options) {
    var base = {};
    var k;
    for (k in DEFAULT_OPTIONS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_OPTIONS, k)) {
        base[k] = DEFAULT_OPTIONS[k];
      }
    }
    if (options && typeof options === 'object') {
      for (k in options) {
        if (Object.prototype.hasOwnProperty.call(options, k) && options[k] !== undefined) {
          base[k] = options[k];
        }
      }
    }
    return base;
  }

  function nodeHasChildren(node) {
    return node && 'children' in node && Array.isArray(node.children);
  }

  function normalizeName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function includesAny(value, patterns) {
    var i;
    for (i = 0; i < patterns.length; i++) {
      if (value.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  }

  function isServiceNode(node) {
    var name = String((node && node.name) || '');

    if (name.charAt(0) === '_') return true;

    var servicePrefixes = [
      'Padding overlay',
      'Gap overlay',
      'Child overlay',
      'Preview /',
      'Anatomy marker',
      'Anatomy connector',
      'Anatomy list',
      'Padding measure',
      'Gap measure',
      'Padding value',
      'Gap value',
      'Value square',
      'Container preview card',
      'Padding overlay container',
    ];

    var j;
    for (j = 0; j < servicePrefixes.length; j++) {
      if (name.indexOf(servicePrefixes[j]) === 0) return true;
    }

    var n = normalizeName(name);
    if (n.indexOf('value square') !== -1) return true;
    if (n.indexOf('measure fill') !== -1) return true;

    return false;
  }

  function shouldConsiderNode(node, options) {
    if (!node) return false;

    if (!options.includeHidden && 'visible' in node && node.visible === false) {
      return false;
    }

    if (isServiceNode(node)) {
      return false;
    }

    if (typeof node.width !== 'number' || typeof node.height !== 'number') {
      return false;
    }

    if (node.width <= 0 || node.height <= 0) {
      return false;
    }

    return true;
  }

  function isComponentLikeNode(node) {
    if (!node) return false;
    return (
      node.type === 'INSTANCE' ||
      node.type === 'COMPONENT' ||
      node.type === 'COMPONENT_SET'
    );
  }

  function isTextNode(node) {
    return node && node.type === 'TEXT';
  }

  function isLineLikeNode(node) {
    if (!node) return false;
    var name = normalizeName(node.name);

    if (node.type === 'LINE') return true;

    if (
      (node.type === 'VECTOR' || node.type === 'RECTANGLE') &&
      includesAny(name, [
        'divider',
        'separator',
        'line',
        'border',
        'разделитель',
        'линия',
      ])
    ) {
      return true;
    }

    if (
      includesAny(name, [
        'divider',
        'separator',
        'line',
        'border',
        'разделитель',
        'линия',
      ])
    ) {
      return true;
    }

    return false;
  }

  function isAtomicByName(node) {
    if (!node) return false;
    var name = normalizeName(node.name);

    return includesAny(name, [
      'icon',
      'икон',
      'label',
      'лейбл',
      'body',
      'wobbler',
      'tag',
      'badge',
      'avatar',
      'image',
      'media',
      'checkbox',
      'radio',
      'switch',
      'control',
      'button',
      'link',
      'input',
      'title',
      'subtitle',
      'description',
      'caption',
    ]);
  }

  function isStructuralContainer(node) {
    if (!node) return false;

    var name = normalizeName(node.name);

    if (node.type === 'TEXT') return false;

    if (isComponentLikeNode(node)) return false;

    if (
      includesAny(name, [
        'content',
        'container',
        'wrapper',
        'layout',
        'main',
        'center',
        'header',
        'footer',
        'text',
        'body container',
        'group',
      ])
    ) {
      return true;
    }

    if (
      node.type === 'FRAME' ||
      node.type === 'GROUP' ||
      node.type === 'SECTION'
    ) {
      return true;
    }

    return false;
  }

  function getDecompositionRole(node) {
    if (!node) return 'skip';

    if (isServiceNode(node)) return 'skip';

    if (isComponentLikeNode(node)) {
      return 'atomic';
    }

    if (isTextNode(node)) {
      return 'atomic';
    }

    if (isLineLikeNode(node)) {
      return 'atomic';
    }

    if (isAtomicByName(node)) {
      return 'atomic';
    }

    if (isStructuralContainer(node)) {
      return 'container';
    }

    if (
      node.type === 'VECTOR' ||
      node.type === 'BOOLEAN_OPERATION' ||
      node.type === 'POLYGON' ||
      node.type === 'STAR'
    ) {
      return 'skip';
    }

    if ('children' in node && Array.isArray(node.children)) {
      return 'container';
    }

    return 'atomic';
  }

  function decomposeAnatomyTree(rootNode, options) {
    var maxDepth = options.maxDepth != null ? options.maxDepth : 8;

    function walk(node, depth, parent) {
      if (!node || depth > maxDepth) {
        return [];
      }

      if (node !== rootNode && !shouldConsiderNode(node, options)) {
        return [];
      }

      var role = node === rootNode ? 'container' : getDecompositionRole(node);

      if (role === 'skip') {
        return [];
      }

      if (role === 'atomic') {
        return [
          {
            node: node,
            parent: parent,
            depth: depth,
            role: role,
          },
        ];
      }

      var childResults = [];

      if ('children' in node && Array.isArray(node.children)) {
        var c;
        for (c = 0; c < node.children.length; c++) {
          var child = node.children[c];
          var decomposed = walk(child, depth + 1, node);
          var d;
          for (d = 0; d < decomposed.length; d++) {
            childResults.push(decomposed[d]);
          }
        }
      }

      if (childResults.length > 0) {
        return childResults;
      }

      if (node !== rootNode && shouldConsiderNode(node, options)) {
        return [
          {
            node: node,
            parent: parent,
            depth: depth,
            role: 'fallback-container',
          },
        ];
      }

      return [];
    }

    return walk(rootNode, 0, null);
  }

  function sortAnatomyCandidates(candidates, options) {
    if ((options.sortMode || 'tree') === 'tree') {
      return candidates;
    }

    return candidates.slice().sort(function (a, b) {
      var aBox = a.node.absoluteBoundingBox;
      var bBox = b.node.absoluteBoundingBox;

      if (!aBox || !bBox) return 0;

      var yDiff = aBox.y - bBox.y;

      if (Math.abs(yDiff) > 8) {
        return yDiff;
      }

      return aBox.x - bBox.x;
    });
  }

  function removeDuplicateCandidates(candidates) {
    var seen = {};
    var result = [];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate || !candidate.node) continue;

      var id = candidate.node.id;
      if (seen[id]) continue;
      seen[id] = true;
      result.push(candidate);
    }
    return result;
  }

  // Component property name resolution is best-effort.
  // Direct componentPropertyReferences are preferred.
  // Heuristic matching is only used when there is a single safe candidate.

  function normalizePropertyName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[#!]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  // Examples:
  // "<- Content left" -> "Content left"
  // "Content right ->" -> "Content right"
  // "← Icon left" -> "Icon left"
  // "Icon right →" -> "Icon right"
  // "Top description#123:456" -> "Top description"
  function cleanDisplayName(name) {
    return String(name || '')
      .replace(/#\d+:\d+/g, '')
      .replace(/[#!]$/g, '')
      .replace(/^\s*(<-|←|<|‹|«|-\s*>|→)\s*/g, '')
      .replace(/\s*(->|→|>|›|»|<-\s*|←)\s*$/g, '')
      .replace(/^\s*[-–—]+\s*/g, '')
      .replace(/\s*[-–—]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanComponentPropertyName(name) {
    return cleanDisplayName(name);
  }

  function getNodeNamePath(node, rootLimit) {
    var names = [];
    var current = node;

    while (current && current !== rootLimit) {
      if (current.name) {
        names.unshift(current.name);
      }
      current = current.parent;
    }

    return names;
  }

  function getBooleanPropertyNames(metadata) {
    var definitions =
      metadata && metadata.mainComponentPropertyDefinitions
        ? metadata.mainComponentPropertyDefinitions
        : {};

    var keys = Object.keys(definitions);
    var result = [];
    var i;
    for (i = 0; i < keys.length; i++) {
      var propertyName = keys[i];
      var definition = definitions[propertyName];
      if (definition && definition.type === 'BOOLEAN') {
        result.push(propertyName);
      }
    }
    return result;
  }

  function getDirectComponentPropertyNameForNode(node) {
    try {
      if (node && node.componentPropertyReferences) {
        var refs = node.componentPropertyReferences;
        var refValues = [];
        var k;
        for (k in refs) {
          if (Object.prototype.hasOwnProperty.call(refs, k) && refs[k]) {
            refValues.push(refs[k]);
          }
        }
        if (refValues.length > 0) {
          return String(refValues[0]);
        }
      }
      return null;
    } catch (error) {
      console.warn('Cannot read direct component property reference for node', error);
      return null;
    }
  }

  function findBestComponentPropertyNameForNode(node, metadata, rootLimit) {
    if (!metadata) return null;

    var pi;

    var directName = getDirectComponentPropertyNameForNode(node);
    if (directName) {
      return cleanComponentPropertyName(directName);
    }

    var booleanPropertyNames = getBooleanPropertyNames(metadata);
    if (!booleanPropertyNames.length) {
      return null;
    }

    if (rootLimit) {
      var pathSegments = getNodeNamePath(node, rootLimit).map(normalizePropertyName);
      for (pi = 0; pi < booleanPropertyNames.length; pi++) {
        var propNm = booleanPropertyNames[pi];
        var normalizedProp = normalizePropertyName(propNm);
        if (pathSegments.indexOf(normalizedProp) !== -1) {
          return cleanComponentPropertyName(propNm);
        }
      }
    }

    var nodeName = normalizePropertyName(node.name);

    var genericLayerNames = [
      'label',
      'text',
      'icon',
      'description',
      'body',
      'content',
    ];

    var isGenericName = genericLayerNames.indexOf(nodeName) !== -1;

    var byName = null;
    for (pi = 0; pi < booleanPropertyNames.length; pi++) {
      var pName = booleanPropertyNames[pi];
      var normalizedProperty = normalizePropertyName(pName);
      if (normalizedProperty.indexOf(nodeName) !== -1 && nodeName.length > 2) {
        byName = pName;
        break;
      }
    }

    if (byName && isGenericName) {
      return cleanComponentPropertyName(byName);
    }

    if (isGenericName) {
      var semanticCandidates = [];
      for (pi = 0; pi < booleanPropertyNames.length; pi++) {
        var propName2 = booleanPropertyNames[pi];
        var np2 = normalizePropertyName(propName2);
        if (
          np2.indexOf('top') !== -1 ||
          np2.indexOf('bottom') !== -1 ||
          np2.indexOf('left') !== -1 ||
          np2.indexOf('right') !== -1 ||
          np2.indexOf('leading') !== -1 ||
          np2.indexOf('trailing') !== -1 ||
          np2.indexOf('description') !== -1 ||
          np2.indexOf('icon') !== -1 ||
          np2.indexOf('label') !== -1
        ) {
          semanticCandidates.push(propName2);
        }
      }

      if (semanticCandidates.length === 1) {
        return cleanComponentPropertyName(semanticCandidates[0]);
      }
    }

    return null;
  }

  async function getComponentPropertyMetadata(sourceNode) {
    var metadata = {
      instanceProperties: {},
      mainComponentPropertyDefinitions: {},
      propertyNames: [],
    };

    try {
      if (sourceNode.type === 'INSTANCE' && sourceNode.componentProperties) {
        metadata.instanceProperties = sourceNode.componentProperties || {};
      }

      if (
        sourceNode.type === 'INSTANCE' &&
        typeof sourceNode.getMainComponentAsync === 'function'
      ) {
        var mainComponent = await sourceNode.getMainComponentAsync();

        if (mainComponent && mainComponent.componentPropertyDefinitions) {
          metadata.mainComponentPropertyDefinitions =
            mainComponent.componentPropertyDefinitions || {};
        }
      }

      if (
        (sourceNode.type === 'COMPONENT' ||
          sourceNode.type === 'COMPONENT_SET') &&
        sourceNode.componentPropertyDefinitions
      ) {
        metadata.mainComponentPropertyDefinitions =
          sourceNode.componentPropertyDefinitions || {};
      }

      metadata.propertyNames = Object.keys(
        metadata.mainComponentPropertyDefinitions || {}
      );

      return metadata;
    } catch (error) {
      console.warn('Cannot read component property metadata', error);
      return metadata;
    }
  }

  function getDisplayAnatomyName(node, role, options) {
    void role;
    if (!node) {
      return 'Element';
    }

    if (options && options.useComponentPropertyNames !== false) {
      var propertyName = findBestComponentPropertyNameForNode(
        node,
        options.componentPropertyMetadata,
        options.anatomyRootNodeForNames
      );

      if (propertyName) {
        return cleanDisplayName(propertyName);
      }
    }

    var rawName = String((node && node.name) || '').trim();
    var cleanedLayerName = cleanDisplayName(rawName);

    if (cleanedLayerName) return cleanedLayerName;

    if (node.type === 'TEXT') return 'Text';
    if (node.type === 'INSTANCE') return 'Component';
    if (node.type === 'LINE') return 'Divider';

    return 'Element';
  }

  function collectSemanticAnatomyItems(rootNode, options) {
    var mergedOptions = mergeOptions(options || {});
    mergedOptions.maxDepth =
      mergedOptions.maxDepth != null ? mergedOptions.maxDepth : 8;
    mergedOptions.sortMode =
      mergedOptions.sortMode != null ? mergedOptions.sortMode : 'tree';

    mergedOptions.anatomyRootNodeForNames = rootNode;

    var candidates = decomposeAnatomyTree(rootNode, mergedOptions);
    var deduped = removeDuplicateCandidates(candidates);
    var sorted = sortAnatomyCandidates(deduped, mergedOptions);

    var maxTotal = mergedOptions.maxItems;
    var cap = maxTotal;
    if (mergedOptions.includeContainer) {
      cap = Math.max(0, maxTotal - 1);
    }

    var sliced = sorted.slice(0, cap);

    var items = sliced.map(function (candidate, index) {
      return {
        index: index + 1,
        id: candidate.node.id,
        name: getDisplayAnatomyName(
          candidate.node,
          candidate.role,
          mergedOptions
        ),
        type: candidate.node.type,
        role: candidate.role,
        depth: candidate.depth,
        bounds: getRelativeBounds(candidate.node, rootNode),
        node: candidate.node,
      };
    });

    if (mergedOptions.includeContainer) {
      var containerRow = {
        index: 1,
        id: rootNode.id,
        name: 'Container',
        type: rootNode.type,
        role: 'semantic-container',
        depth: 0,
        bounds: {
          x: 0,
          y: 0,
          width: rootNode.width,
          height: rootNode.height,
        },
        node: rootNode,
      };
      var j;
      for (j = 0; j < items.length; j++) {
        items[j].index = j + 2;
      }
      return [containerRow].concat(items);
    }

    return items;
  }

  function collectAnatomyItems(rootNode, options) {
    return collectSemanticAnatomyItems(rootNode, options);
  }

  function getRelativeBounds(node, rootNode) {
    var nodeBox = node.absoluteBoundingBox;
    var rootBox = rootNode.absoluteBoundingBox;

    if (nodeBox && rootBox) {
      return {
        x: nodeBox.x - rootBox.x,
        y: nodeBox.y - rootBox.y,
        width: nodeBox.width,
        height: nodeBox.height,
      };
    }

    return {
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || 0,
      height: node.height || 0,
    };
  }

  function getNodeLocalBounds(node) {
    return {
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || 0,
      height: node.height || 0,
    };
  }

  function getItemAnchorSide(itemBounds, rootBounds) {
    var itemCenterX = itemBounds.x + itemBounds.width / 2;
    var itemCenterY = itemBounds.y + itemBounds.height / 2;

    var distLeft = itemCenterX;
    var distRight = rootBounds.width - itemCenterX;
    var distTop = itemCenterY;
    var distBottom = rootBounds.height - itemCenterY;

    var distances = [
      { side: 'left', value: distLeft },
      { side: 'right', value: distRight },
      { side: 'top', value: distTop },
      { side: 'bottom', value: distBottom },
    ];

    distances.sort(function (a, b) {
      return a.value - b.value;
    });

    return distances[0].side;
  }

  function isVerticalPointerSide(side) {
    return side === 'top' || side === 'bottom';
  }

  function isHorizontalPointerSide(side) {
    return side === 'left' || side === 'right';
  }

  function getPointerAlignmentLines(rootBounds, options) {
    var markerSize =
      options.markerSize != null ? options.markerSize : ANATOMY_LAYOUT.markerSize;
    var markerOffset =
      options.markerOffset != null ? options.markerOffset : ANATOMY_LAYOUT.markerOffset;

    return {
      topY: rootBounds.y - markerOffset - markerSize,
      bottomY: rootBounds.y + rootBounds.height + markerOffset,
      leftX: rootBounds.x - markerOffset - markerSize,
      rightX: rootBounds.x + rootBounds.width + markerOffset,
    };
  }

  function getPointerGeometry(pointerData, rootBounds, alignmentLines, options) {
    void rootBounds;
    var markerSize =
      options.markerSize != null ? options.markerSize : ANATOMY_LAYOUT.markerSize;
    var side = pointerData.side;
    var itemBounds = pointerData.itemBounds;

    var itemCenterX = itemBounds.x + itemBounds.width / 2;
    var itemCenterY = itemBounds.y + itemBounds.height / 2;

    if (side === 'top') {
      var pointerX = itemCenterX - markerSize / 2;
      var pointerY = alignmentLines.topY;
      var targetY = itemBounds.y;
      var pointerHeight = Math.max(markerSize, targetY - pointerY);

      return {
        x: pointerX,
        y: pointerY,
        width: markerSize,
        height: pointerHeight,
        side: side,
      };
    }

    if (side === 'bottom') {
      var pointerX2 = itemCenterX - markerSize / 2;
      var pointerY2 = itemBounds.y + itemBounds.height;
      var markerY = alignmentLines.bottomY;
      var pointerHeight2 = Math.max(markerSize, markerY + markerSize - pointerY2);

      return {
        x: pointerX2,
        y: pointerY2,
        width: markerSize,
        height: pointerHeight2,
        side: side,
      };
    }

    if (side === 'left') {
      var pointerX3 = alignmentLines.leftX;
      var pointerY3 = itemCenterY - markerSize / 2;
      var targetX = itemBounds.x;
      var pointerWidth = Math.max(markerSize, targetX - pointerX3);

      return {
        x: pointerX3,
        y: pointerY3,
        width: pointerWidth,
        height: markerSize,
        side: side,
      };
    }

    if (side === 'right') {
      var pointerX4 = itemBounds.x + itemBounds.width;
      var pointerY4 = itemCenterY - markerSize / 2;
      var markerX = alignmentLines.rightX;
      var pointerWidth2 = Math.max(markerSize, markerX + markerSize - pointerX4);

      return {
        x: pointerX4,
        y: pointerY4,
        width: pointerWidth2,
        height: markerSize,
        side: side,
      };
    }

    return {
      x: itemCenterX,
      y: itemCenterY,
      width: markerSize,
      height: markerSize,
      side: side,
    };
  }

  function createConnectorForSide(index, side, options) {
    var thickness =
      options.connectorThickness != null
        ? options.connectorThickness
        : ANATOMY_LAYOUT.connectorThickness;
    var color = options.connectorColor || hexToRgb('#FC8507');

    var connector = figma.createFrame();
    connector.name = 'Anatomy connector / ' + index;
    connector.layoutMode = 'NONE';
    connector.fills = [{ type: 'SOLID', color: color }];
    connector.strokes = [];
    connector.clipsContent = false;

    if (isVerticalPointerSide(side)) {
      connector.resize(Math.max(1, Math.round(thickness)), 1);
      try {
        connector.layoutGrow = 1;
      } catch (error) {
        console.warn('Cannot set layoutGrow for vertical anatomy connector', error);
      }
      try {
        connector.layoutAlign = 'CENTER';
      } catch (error) {
        console.warn('Cannot set layoutAlign for vertical anatomy connector', error);
      }
    } else if (isHorizontalPointerSide(side)) {
      connector.resize(1, Math.max(1, Math.round(thickness)));
      try {
        connector.layoutGrow = 1;
      } catch (error) {
        console.warn('Cannot set layoutGrow for horizontal anatomy connector', error);
      }
      try {
        connector.layoutAlign = 'CENTER';
      } catch (error) {
        console.warn('Cannot set layoutAlign for horizontal anatomy connector', error);
      }
    }

    return connector;
  }

  async function createAnatomyPointer(index, side, geometry, options) {
    var marker = await createMarker(index, options);
    var connector = createConnectorForSide(index, side, options);

    var pointer = figma.createFrame();
    pointer.name = 'Anatomy pointer / ' + index;
    pointer.fills = [];
    pointer.strokes = [];
    pointer.clipsContent = false;
    pointer.itemSpacing = 0;

    if (side === 'top' || side === 'bottom') {
      pointer.layoutMode = 'VERTICAL';
      pointer.primaryAxisSizingMode = 'FIXED';
      pointer.counterAxisSizingMode = 'FIXED';
      pointer.primaryAxisAlignItems = 'MIN';
      pointer.counterAxisAlignItems = 'CENTER';
    }

    if (side === 'left' || side === 'right') {
      pointer.layoutMode = 'HORIZONTAL';
      pointer.primaryAxisSizingMode = 'FIXED';
      pointer.counterAxisSizingMode = 'FIXED';
      pointer.primaryAxisAlignItems = 'MIN';
      pointer.counterAxisAlignItems = 'CENTER';
    }

    if (side === 'top') {
      pointer.appendChild(marker);
      pointer.appendChild(connector);
    } else if (side === 'bottom') {
      pointer.appendChild(connector);
      pointer.appendChild(marker);
    } else if (side === 'left') {
      pointer.appendChild(marker);
      pointer.appendChild(connector);
    } else if (side === 'right') {
      pointer.appendChild(connector);
      pointer.appendChild(marker);
    }

    pointer.x = geometry.x;
    pointer.y = geometry.y;
    pointer.resize(geometry.width, geometry.height);

    return pointer;
  }

  async function applyAnatomyMarkerTextInverse(textNode) {
    var ctx = getSpecBuildStyleContext();
    if (!ctx || !ctx.apply || !ctx.resolver) return;
    try {
      await figma.loadFontAsync(textNode.fontName);
      await ctx.apply.applySemanticColorKey(
        textNode,
        'textInverse',
        ctx.resolver,
        'fill'
      );
    } catch (e) {
      console.warn('[Anatomy] marker text inverse', e);
    }
  }

  function createAnatomyText(content, opts) {
    var t = figma.createText();
    t.name = opts.name || 'Anatomy text';
    t.fontName = opts.fontName;
    t.fontSize = opts.fontSize;
    t.lineHeight = opts.lineHeight || { unit: 'PERCENT', value: 130 };
    t.fills = opts.fills || [{ type: 'SOLID', color: opts.color || opts.listTextColor }];

    if (opts.width != null && opts.width > 0) {
      t.textAutoResize = 'HEIGHT';
      t.resize(opts.width, t.height);
    } else {
      t.textAutoResize = 'WIDTH_AND_HEIGHT';
    }

    var str = content === undefined || content === null ? '' : String(content);
    t.characters = str.length === 0 ? ' ' : str;
    return t;
  }

  async function createMarker(index, options) {
    var frame = figma.createFrame();
    frame.name = 'Anatomy marker / ' + index;
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
    frame.fills = [
      { type: 'SOLID', color: options.markerColor || hexToRgb('#FC8507') },
    ];
    frame.strokes = [];
    frame.clipsContent = false;

    await figma.loadFontAsync(options.fontBold);
    var label = createAnatomyText(String(index), {
      name: 'Anatomy marker number',
      fontName: options.fontBold,
      fontSize: 12,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [
        {
          type: 'SOLID',
          color: options.markerTextColor || { r: 1, g: 1, b: 1 },
        },
      ],
    });

    await applyAnatomyMarkerTextInverse(label);
    frame.appendChild(label);
    return frame;
  }

  function createSmallListMarker(index, options) {
    var frame = figma.createFrame();
    frame.name = 'Anatomy list marker / ' + index;
    frame.layoutMode = 'HORIZONTAL';
    frame.primaryAxisAlignItems = 'CENTER';
    frame.counterAxisAlignItems = 'CENTER';
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
    frame.resize(20, 20);
    frame.cornerRadius = 10;
    frame.fills = [
      { type: 'SOLID', color: options.markerColor || hexToRgb('#FC8507') },
    ];
    frame.strokes = [];
    frame.clipsContent = false;

    var label = createAnatomyText(String(index), {
      name: 'Anatomy list marker label',
      fontName: options.fontBold,
      fontSize: 12,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [
        {
          type: 'SOLID',
          color: options.markerTextColor || { r: 1, g: 1, b: 1 },
        },
      ],
    });

    frame.appendChild(label);
    return frame;
  }

  async function createAnatomyListRow(item, options) {
    var row = figma.createFrame();
    row.name = 'Anatomy list item / ' + item.index;
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisAlignItems = 'MIN';
    row.counterAxisAlignItems = 'CENTER';
    row.primaryAxisSizingMode = 'FIXED';
    row.counterAxisSizingMode = 'AUTO';
    row.itemSpacing = 4;
    row.fills = [];
    row.strokes = [];
    row.clipsContent = false;

    var listText = options.listTextColor || hexToRgb('#4E4E4E');

    var numberText = createAnatomyText(String(item.index), {
      name: 'Anatomy list item number',
      fontName: options.fontBold,
      fontSize: 14,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [{ type: 'SOLID', color: listText }],
    });

    var nameText = createAnatomyText('\u2014 ' + item.name, {
      name: 'Anatomy list item name',
      fontName: options.fontRegular,
      fontSize: 14,
      lineHeight: { unit: 'PERCENT', value: 130 },
      fills: [{ type: 'SOLID', color: listText }],
    });

    await tryApplyTextSecondary(numberText);
    await tryApplyTextSecondary(nameText);

    row.appendChild(numberText);
    row.appendChild(nameText);

    nameText.layoutGrow = 1;
    nameText.textAutoResize = 'HEIGHT';

    row.resize(options.listWidth, row.height);

    return row;
  }

  async function createAnatomyList(items, options) {
    var list = figma.createFrame();
    list.name = 'Anatomy list';
    list.layoutMode = 'VERTICAL';
    list.itemSpacing = 12;
    list.fills = [];
    list.strokes = [];
    list.clipsContent = false;
    list.primaryAxisSizingMode = 'AUTO';
    list.counterAxisSizingMode = 'FIXED';
    list.resize(options.listWidth, 1);

    var ri;
    for (ri = 0; ri < items.length; ri++) {
      var row = await createAnatomyListRow(items[ri], options);
      list.appendChild(row);
    }

    var totalH = 0;
    var ch = list.children;
    var cj;
    for (cj = 0; cj < ch.length; cj++) {
      totalH += ch[cj].height || 0;
    }
    if (ch.length > 1) {
      totalH += list.itemSpacing * (ch.length - 1);
    }
    list.resize(options.listWidth, Math.max(1, Math.round(totalH)));

    return list;
  }

  async function createAnatomyFrame(params) {
    var sourceNode = params && params.sourceNode;
    if (!sourceNode || typeof sourceNode.clone !== 'function') {
      throw new Error('AnatomyGenerator.createAnatomyFrame: sourceNode must be cloneable.');
    }

    var title =
      params && params.title != null && params.title !== ''
        ? String(params.title)
        : 'Анатомия компонента';

    var merged = mergeOptions(params && params.options);

    var rootClone = sourceNode.clone();
    rootClone.name = 'Anatomy preview / ' + String(sourceNode.name);

    var sc = merged.scale;
    if (typeof sc === 'number' && !isNaN(sc) && sc > 0 && sc !== 1 && typeof rootClone.rescale === 'function') {
      rootClone.rescale(sc);
    }

    var items = collectSemanticAnatomyItems(rootClone, merged);

    var fp = merged.framePadding;
    var listGap = merged.listGap;

    var cw = rootClone.width;
    var ch = rootClone.height;

    var markerSize =
      merged.markerSize != null ? merged.markerSize : ANATOMY_LAYOUT.markerSize;
    var markerOffset =
      merged.markerOffset != null ? merged.markerOffset : ANATOMY_LAYOUT.markerOffset;
    var markerSafeArea = markerSize + markerOffset + 8;

    var previewGroup = figma.createFrame();
    previewGroup.name = 'Anatomy preview group';
    previewGroup.layoutMode = 'NONE';
    previewGroup.fills = [];
    previewGroup.strokes = [];
    previewGroup.clipsContent = false;
    previewGroup.resize(
      Math.max(1, Math.round(cw + markerSafeArea * 2)),
      Math.max(1, Math.round(ch + markerSafeArea * 2))
    );

    rootClone.x = markerSafeArea;
    rootClone.y = markerSafeArea;
    previewGroup.appendChild(rootClone);

    var rootBoundsRelative = { x: 0, y: 0, width: cw, height: ch };
    var rootBoundsInPreviewGroup = {
      x: rootClone.x,
      y: rootClone.y,
      width: rootClone.width,
      height: rootClone.height,
    };

    var alignmentLines = getPointerAlignmentLines(rootBoundsInPreviewGroup, merged);

    var pointerDataList = items.map(function (item) {
      var side = getItemAnchorSide(item.bounds, rootBoundsRelative);

      var itemBoundsInPreviewGroup = {
        x: rootClone.x + item.bounds.x,
        y: rootClone.y + item.bounds.y,
        width: item.bounds.width,
        height: item.bounds.height,
      };

      return {
        item: item,
        side: side,
        itemBounds: itemBoundsInPreviewGroup,
      };
    });

    var pi;
    for (pi = 0; pi < pointerDataList.length; pi++) {
      var pointerData = pointerDataList[pi];
      var geometry = getPointerGeometry(
        pointerData,
        rootBoundsInPreviewGroup,
        alignmentLines,
        merged
      );
      var pointer = await createAnatomyPointer(
        pointerData.item.index,
        pointerData.side,
        geometry,
        merged
      );
      previewGroup.appendChild(pointer);
    }

    var list = await createAnatomyList(items, merged);

    var anatomyFrame = figma.createFrame();
    anatomyFrame.name = title;
    anatomyFrame.layoutMode = 'NONE';
    anatomyFrame.clipsContent = false;

    var bg =
      merged.backgroundColor != null
        ? merged.backgroundColor
        : merged.frameFillColor || hexToRgb('#F7F7F7');
    anatomyFrame.fills = [{ type: 'SOLID', color: bg }];
    anatomyFrame.strokes = [];
    anatomyFrame.itemSpacing = 0;
    anatomyFrame.paddingTop = 0;
    anatomyFrame.paddingRight = 0;
    anatomyFrame.paddingBottom = 0;
    anatomyFrame.paddingLeft = 0;

    previewGroup.x = fp;
    previewGroup.y = fp;
    anatomyFrame.appendChild(previewGroup);

    list.x = fp + markerSafeArea + cw + listGap;
    list.y = fp;
    anatomyFrame.appendChild(list);

    var listH = list.height;
    var contentRight = Math.max(fp + previewGroup.width, list.x + list.width);
    var fw = contentRight + fp;
    var fh = fp + Math.max(previewGroup.height, listH) + fp;

    anatomyFrame.resize(Math.max(1, Math.round(fw)), Math.max(1, Math.round(fh)));

    return anatomyFrame;
  }

  async function loadFonts(options) {
    var merged = mergeOptions(options || {});

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

  return {
    loadFonts: loadFonts,
    createAnatomyFrame: createAnatomyFrame,
    collectAnatomyItems: collectAnatomyItems,
    collectSemanticAnatomyItems: collectSemanticAnatomyItems,
    getComponentPropertyMetadata: getComponentPropertyMetadata,
  };
})();

function stretchChildHorizontal(f) {
  if (!f || !f.parent) return;
  var parent = f.parent;
  if (
    !('layoutMode' in parent) ||
    parent.layoutMode === undefined ||
    parent.layoutMode === 'NONE'
  ) {
    return;
  }
  try {
    f.layoutSizingHorizontal = 'FILL';
    if (f.layoutMode && f.layoutMode !== 'NONE') {
      f.layoutSizingVertical = 'HUG';
    }
  } catch (error) {
    console.warn('stretchChildHorizontal skipped', f.name || '', error);
  }
}

function stretchInParent(node) {
  try {
    node.layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot stretch node in parent', node && node.name, error);
  }
}

function createFrameNode(name, options) {
  options = options || {};
  var f = figma.createFrame();
  f.name = name;
  if (options.fills !== undefined) {
    f.fills = options.fills;
  }
  if (options.strokes !== undefined) {
    f.strokes = options.strokes;
  }
  if (options.strokeWeight !== undefined) {
    f.strokeWeight = options.strokeWeight;
  }
  if (options.cornerRadius !== undefined) {
    f.cornerRadius = options.cornerRadius;
  }
  if (options.topLeftRadius !== undefined) {
    f.topLeftRadius = options.topLeftRadius;
  }
  if (options.topRightRadius !== undefined) {
    f.topRightRadius = options.topRightRadius;
  }
  if (options.bottomLeftRadius !== undefined) {
    f.bottomLeftRadius = options.bottomLeftRadius;
  }
  if (options.bottomRightRadius !== undefined) {
    f.bottomRightRadius = options.bottomRightRadius;
  }
  if (options.layoutMode !== undefined) {
    f.layoutMode = options.layoutMode;
  }
  if (options.primaryAxisSizingMode !== undefined) {
    f.primaryAxisSizingMode = options.primaryAxisSizingMode;
  }
  if (options.counterAxisSizingMode !== undefined) {
    f.counterAxisSizingMode = options.counterAxisSizingMode;
  }
  if (options.primaryAxisAlignItems !== undefined) {
    f.primaryAxisAlignItems = options.primaryAxisAlignItems;
  }
  if (options.counterAxisAlignItems !== undefined) {
    f.counterAxisAlignItems = options.counterAxisAlignItems;
  }
  if (options.layoutAlignItems !== undefined) {
    f.layoutAlignItems = options.layoutAlignItems;
  }
  if (options.itemSpacing !== undefined) {
    f.itemSpacing = options.itemSpacing;
  }
  if (options.paddingTop !== undefined) {
    f.paddingTop = options.paddingTop;
  }
  if (options.paddingRight !== undefined) {
    f.paddingRight = options.paddingRight;
  }
  if (options.paddingBottom !== undefined) {
    f.paddingBottom = options.paddingBottom;
  }
  if (options.paddingLeft !== undefined) {
    f.paddingLeft = options.paddingLeft;
  }
  if (options.layoutSizingHorizontal !== undefined) {
    f.layoutSizingHorizontal = options.layoutSizingHorizontal;
  }
  if (options.layoutSizingVertical !== undefined) {
    f.layoutSizingVertical = options.layoutSizingVertical;
  }
  if (options.clipsContent !== undefined) {
    f.clipsContent = options.clipsContent;
  }
  if (options.effects !== undefined) {
    f.effects = options.effects;
  }
  if (options.width != null && options.height != null) {
    f.resize(options.width, options.height);
  } else if (options.width != null) {
    f.resize(options.width, f.height);
  }
  return f;
}

async function createTextNode(text, options) {
  options = options || {};
  var raw = text === undefined || text === null ? '' : text;
  var str = typeof raw === 'string' ? raw : String(raw);
  var t = figma.createText();
  t.name = options.name || 'Text';

  var styleApplied = false;

  try {
    if (options.textStyle && options.textStyle.id) {
      try {
        t.textStyleId = options.textStyle.id;
        await figma.loadFontAsync(t.fontName);
        styleApplied = true;
      } catch (styErr) {
        console.warn('Text style apply failed:', styErr);
        try {
          t.textStyleId = '';
        } catch (_e) {}
      }
    }
  } catch (_e2) {}

  try {
    if (!styleApplied) {
      await figma.loadFontAsync(options.fontName || activeFontRegular);
      t.fontName = options.fontName || activeFontRegular;
      if (options.fontSize !== undefined && options.fontSize !== null) {
        t.fontSize = options.fontSize;
      } else {
        t.fontSize = 13;
      }
      if (options.lineHeight !== undefined && options.lineHeight !== null) {
        t.lineHeight = options.lineHeight;
      } else {
        t.lineHeight = { unit: 'PERCENT', value: 140 };
      }
      if (options.fills && options.fills.length) {
        t.fills = options.fills;
      } else if (options.fallbackSolidColor) {
        t.fills = [{ type: 'SOLID', color: options.fallbackSolidColor }];
      } else {
        t.fills = [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }];
      }
    } else {
      await figma.loadFontAsync(t.fontName);
    }

    var toSet = str.length === 0 ? ' ' : str;
    t.characters = toSet;
  } catch (charsErr) {
    console.warn('createTextNode failed:', charsErr);
    try {
      await figma.loadFontAsync(options.fontName || activeFontRegular);
      t.fontName = options.fontName || activeFontRegular;
      if (options.fontSize !== undefined && options.fontSize !== null) {
        t.fontSize = options.fontSize;
      } else {
        t.fontSize = 13;
      }
      if (options.lineHeight !== undefined && options.lineHeight !== null) {
        t.lineHeight = options.lineHeight;
      } else {
        t.lineHeight = { unit: 'PERCENT', value: 140 };
      }
      if (options.fills && options.fills.length) {
        t.fills = options.fills;
      } else if (options.fallbackSolidColor) {
        t.fills = [{ type: 'SOLID', color: options.fallbackSolidColor }];
      } else {
        t.fills = [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }];
      }
      t.characters = str.length === 0 ? ' ' : str;
    } catch (fatal) {
      console.error('createTextNode fatal:', fatal);
    }
  }

  if (options.width !== undefined && options.width !== null) {
    t.textAutoResize = 'HEIGHT';
    t.resize(options.width, t.height);
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  if (options.textAlignHorizontal) {
    t.textAlignHorizontal = options.textAlignHorizontal;
  }

  if (!options.skipSpecFontFamily) {
    await tryApplySpecFontFamily(t, options);
  }

  return t;
}

async function tryApplySpecFontFamily(textNode, options) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  var base = options.fontName || textNode.fontName;
  var role = options.fontFamilyRole;
  if (role == null) {
    role = 'paragraph';
  }
  try {
    if (role === 'heading') {
      await ctx.apply.applyHeadingFontFamilyToken(textNode, base, ctx.resolver);
    } else {
      await ctx.apply.applyParagraphFontFamilyToken(textNode, base, ctx.resolver);
    }
  } catch (e) {
    console.warn('[Spec] font family token', e);
  }
}

async function createSectionTitle(title, designTokens) {
  void designTokens;
  return await createTextNode(title, {
    name: 'Section title',
    fontName: activeFontBold,
    fontSize: 18,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
    width: INNER_CONTENT_WIDTH,
  });
}

/**
 * Горизонтальная группа: иконки (если есть) + текст значения. Для контейнерной карточки.
 */
async function createPropertyValueGroup(
  propertyName,
  propertyValue,
  iconContext,
  designTokens,
  dim,
  enableIcons
) {
  dim = dim || {};
  var rowWidth = dim.rowWidth != null ? dim.rowWidth : INNER_ROW_WIDTH;
  var labelWidth = dim.labelWidth != null ? dim.labelWidth : PROP_LABEL_WIDTH;
  var gapBetween = getDesignSpaces(designTokens).medium;
  var valueWidth =
    dim.valueWidth != null ? dim.valueWidth : rowWidth - labelWidth - gapBetween;

  var PROPERTY_ICON_GAP = 4;
  var PROPERTY_ICON_SIZE = 16;

  var specStyleCtx = getSpecBuildStyleContext();
  var styleResolver = specStyleCtx && specStyleCtx.resolver;

  var iconNames = [];
  if (enableIcons !== false) {
    try {
      iconNames = getPropertyIconNames(
        String(propertyName),
        String(propertyValue),
        iconContext || undefined
      );
    } catch (e) {
      console.warn('[Spec] property value group icons', e);
    }
  }

  var nIcons = iconNames.length;
  var iconsChainW =
    nIcons > 0 ? nIcons * (PROPERTY_ICON_GAP + PROPERTY_ICON_SIZE) : 0;
  var valueTextW = Math.max(1, valueWidth - iconsChainW);

  var lh130 = { unit: 'PERCENT', value: 130 };

  var valueNode = await createTextNode(String(propertyValue), {
    name: 'Property value',
    fontName: activeFontRegular,
    fontSize: 14,
    lineHeight: lh130,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
    width: valueTextW,
  });
  await tryApplyTextPrimary(valueNode);

  var valueGroup = createFrameNode('Property value group', {
    fills: [],
    strokes: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: PROPERTY_ICON_GAP,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    width: valueWidth,
    counterAxisAlignItems: 'CENTER',
    primaryAxisAlignItems: 'MIN',
    clipsContent: false,
  });

  var ix;
  for (ix = 0; ix < iconNames.length; ix++) {
    var iconName = iconNames[ix];
    try {
      var svgPart = await createSpecIcon(iconName, styleResolver);
      if (svgPart) {
        valueGroup.appendChild(svgPart);
      }
    } catch (oneIconErr) {
      console.warn('[Spec] property icon', oneIconErr);
    }
  }

  valueNode.resize(valueTextW, valueNode.height);
  valueGroup.appendChild(valueNode);

  return valueGroup;
}

async function createBaseContainerPropertyRow(rowData, designTokens, dim) {
  dim = dim || {};
  var rowWidth = dim.rowWidth != null ? dim.rowWidth : INNER_ROW_WIDTH;
  var labelWidth = dim.labelWidth != null ? dim.labelWidth : PROP_LABEL_WIDTH;

  var row = createFrameNode('Property row / ' + rowData.name, {
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 12,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    width: rowWidth,
    counterAxisAlignItems: 'CENTER',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    clipsContent: false,
  });

  try {
    row.layoutAlign = 'STRETCH';
  } catch (stretchErr) {
    console.warn('[Spec] Cannot stretch Property row', rowData.name, stretchErr);
  }

  var lh130 = { unit: 'PERCENT', value: 130 };
  var labelNode = await createTextNode(rowData.name + ':', {
    name: 'Property label',
    fontName: activeFontRegular,
    fontSize: 14,
    lineHeight: lh130,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.labelText }],
    width: labelWidth,
  });
  await tryApplyLabelTextTertiary(labelNode);
  labelNode.resize(labelWidth, labelNode.height);

  var valueGroup = await createPropertyValueGroup(
    rowData.name,
    rowData.value,
    rowData.iconContext,
    designTokens,
    dim,
    true
  );

  try {
    valueGroup.layoutGrow = 1;
  } catch (_growVg) {}

  row.appendChild(labelNode);
  row.appendChild(valueGroup);
  return row;
}

async function createPaddingContainerPropertyRow(rowData, designTokens, dim) {
  dim = dim || {};
  var rowWidth = dim.rowWidth != null ? dim.rowWidth : INNER_ROW_WIDTH;
  var labelWidth = dim.labelWidth != null ? dim.labelWidth : PROP_LABEL_WIDTH;

  var row = createFrameNode('Property row / Padding', {
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 12,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    width: rowWidth,
    counterAxisAlignItems: 'MIN',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    clipsContent: false,
  });

  try {
    row.layoutAlign = 'STRETCH';
  } catch (stretchErr) {
    console.warn('[Spec] Cannot stretch Property row / Padding', stretchErr);
  }

  var lh130 = { unit: 'PERCENT', value: 130 };
  var labelNode = await createTextNode('Padding:', {
    name: 'Property label',
    fontName: activeFontRegular,
    fontSize: 14,
    lineHeight: lh130,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.labelText }],
    width: labelWidth,
  });
  await tryApplyLabelTextTertiary(labelNode);
  labelNode.resize(labelWidth, labelNode.height);

  var valueStack = createFrameNode('Property value stack', {
    fills: [],
    strokes: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 4,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    counterAxisAlignItems: 'MIN',
    primaryAxisAlignItems: 'MIN',
    clipsContent: false,
  });

  try {
    valueStack.layoutGrow = 1;
  } catch (_growStack) {}

  var groups = rowData.valueGroups;
  var gi;
  for (gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    var vg = await createPropertyValueGroup(g.name, g.value, undefined, designTokens, dim, true);
    vg.name = 'Property value group / ' + g.name;
    valueStack.appendChild(vg);
  }

  row.appendChild(labelNode);
  row.appendChild(valueStack);
  return row;
}

async function createPropertyRow(label, value, designTokens, dim, containerForIcons, iconContext) {
  dim = dim || {};
  var rowWidth = dim.rowWidth != null ? dim.rowWidth : INNER_ROW_WIDTH;
  var labelWidth = dim.labelWidth != null ? dim.labelWidth : PROP_LABEL_WIDTH;
  var sp = getDesignSpaces(designTokens);
  var gap = sp.medium;
  var valueWidth =
    dim.valueWidth != null ? dim.valueWidth : rowWidth - labelWidth - gap;

  var row = createFrameNode('Property row', {
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: gap,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    width: rowWidth,
    counterAxisAlignItems: 'MIN',
    primaryAxisAlignItems: 'MIN',
    clipsContent: false,
  });

  var isContainerPropRow =
    Number(labelWidth) === Number(CONTAINER_CARD_LABEL_WIDTH);

  var labelText = String(label) + ':';
  var lh130 = { unit: 'PERCENT', value: 130 };

  var labelNode;
  var valueSlot;

  if (isContainerPropRow) {
    labelNode = await createTextNode(labelText, {
      name: 'Property label',
      fontName: activeFontRegular,
      fontSize: 14,
      lineHeight: lh130,
      fills: [{ type: 'SOLID', color: SPEC_COLORS.labelText }],
      width: labelWidth,
    });
    await tryApplyLabelTextTertiary(labelNode);
    labelNode.resize(labelWidth, labelNode.height);

    try {
      valueSlot = await createPropertyValueGroup(
        String(label),
        String(value),
        iconContext || undefined,
        designTokens,
        dim,
        !!containerForIcons
      );
    } catch (vgErr) {
      console.warn('[Spec] property value group', vgErr);
      var fallbackVal = await createTextNode(String(value), {
        name: 'Property value',
        fontName: activeFontRegular,
        fontSize: 14,
        lineHeight: lh130,
        fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
        width: valueWidth,
      });
      await tryApplyTextPrimary(fallbackVal);
      fallbackVal.resize(valueWidth, fallbackVal.height);
      valueSlot = fallbackVal;
    }
  } else {
    var dt = designTokens || { textStyles: {} };
    var bodyStyle =
      dt.textStyles && dt.textStyles.bodyStyle ? dt.textStyles.bodyStyle : null;

    var labelOpts = {
      name: 'Label',
      fontName: activeFontMedium,
      fontSize: 14,
      width: labelWidth,
    };

    if (bodyStyle) {
      labelOpts.textStyle = bodyStyle;
    } else {
      labelOpts.fills = [{ type: 'SOLID', color: SPEC_COLORS.textSecondary }];
      labelOpts.fallbackSolidColor = SPEC_COLORS.textSecondary;
    }

    labelNode = await createTextNode(labelText, labelOpts);

    if (!bodyStyle) {
      await tryApplyTextSecondary(labelNode);
    }

    var valOpts = {
      name: 'Value',
      fontName: activeFontMedium,
      fontSize: 14,
      width: valueWidth,
    };

    if (bodyStyle) {
      valOpts.textStyle = bodyStyle;
    } else {
      valOpts.fills = [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }];
      valOpts.fallbackSolidColor = SPEC_COLORS.textPrimary;
    }

    var valueNode = await createTextNode(String(value), valOpts);
    if (!bodyStyle) {
      await tryApplyTextPrimary(valueNode);
    }

    labelNode.resize(labelWidth, labelNode.height);
    valueNode.resize(valueWidth, valueNode.height);
    valueSlot = valueNode;
  }

  row.appendChild(labelNode);
  row.appendChild(valueSlot);
  return row;
}

function createDivider(designTokens, dividerWidth) {
  var w = dividerWidth != null ? dividerWidth : INNER_ROW_WIDTH;
  var r = figma.createRectangle();
  r.name = 'Divider';
  r.resize(w, 1);
  if (designTokens && designTokens.colors && designTokens.colors.cardBorder) {
    applyFillToken(r, designTokens.colors.cardBorder, SPEC_COLORS.border);
  } else {
    r.fills = [{ type: 'SOLID', color: SPEC_COLORS.border }];
  }
  r.strokes = [];
  return r;
}

async function createWarningBlock(lines, warnOpts, designTokens) {
  warnOpts = warnOpts || {};
  void designTokens;

  var outerW =
    warnOpts.outerWidth != null ? warnOpts.outerWidth : INNER_ROW_WIDTH;

  var wrap = createFrameNode('Warning block', {
    fills: [{ type: 'SOLID', color: SPEC_COLORS.warningBg }],
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    itemSpacing: 6,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    cornerRadius: 8,
  });
  wrap.resize(outerW, wrap.height);

  var textW = outerW - 24;
  for (var wi = 0; wi < lines.length; wi++) {
    var line = await createTextNode(lines[wi], {
      name: 'Warning line',
      fontSize: 12,
      fills: [{ type: 'SOLID', color: SPEC_COLORS.warningText }],
      width: textW,
    });
    wrap.appendChild(line);
  }
  return wrap;
}

async function createSpecHeader(spec, designTokens) {
  void designTokens;

  var block = createFrameNode('Spec header', {
    fills: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 8,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });

  var t1 = await createTextNode('Спецификация компонента', {
    name: 'Header title',
    fontName: activeFontBold,
    fontSize: 28,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
    width: INNER_CONTENT_WIDTH,
  });

  var t2 = await createTextNode(spec.component.name, {
    name: 'Header subtitle',
    fontSize: 16,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textSecondary }],
    width: INNER_CONTENT_WIDTH,
  });

  var t3 = await createTextNode('Сгенерировано из выбранного слоя Figma', {
    name: 'Header note',
    fontSize: 12,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textSecondary }],
    width: INNER_CONTENT_WIDTH,
  });

  await tryApplyTextPrimary(t1);
  await tryApplyTextSecondary(t2);
  await tryApplyTextSecondary(t3);

  block.appendChild(t1);
  block.appendChild(t2);
  block.appendChild(t3);
  return block;
}

async function createOverviewSection(spec, designTokens, sectionOrdinal) {
  var sectionTitle =
    sectionOrdinal != null
      ? String(sectionOrdinal) + '. Общая информация'
      : 'Общая информация';

  var section = createFrameNode('Overview section', {
    fills: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });
  section.resize(INNER_CONTENT_WIDTH, section.height);

  section.appendChild(await createSectionTitle(sectionTitle, designTokens));

  var card = createFrameNode('Overview card', {
    fills: [{ type: 'SOLID', color: SPEC_COLORS.cardBg }],
    strokes: [{ type: 'SOLID', color: SPEC_COLORS.border }],
    strokeWeight: 1,
    cornerRadius: SPEC_LAYOUT.cardCornerRadius,
    layoutMode: 'VERTICAL',
    itemSpacing: SPEC_LAYOUT.rowGap,
    paddingTop: SPEC_LAYOUT.cardPadding,
    paddingRight: SPEC_LAYOUT.cardPadding,
    paddingBottom: SPEC_LAYOUT.cardPadding,
    paddingLeft: SPEC_LAYOUT.cardPadding,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
  });
  card.resize(INNER_CONTENT_WIDTH, card.height);

  card.appendChild(
    await createPropertyRow('Название', spec.component.name, designTokens)
  );
  card.appendChild(await createPropertyRow('Тип', spec.component.type, designTokens));
  card.appendChild(
    await createPropertyRow(
      'Количество контейнеров',
      String(spec.containers.length),
      designTokens
    )
  );
  card.appendChild(
    await createPropertyRow(
      'Количество элементов анатомии',
      String(spec.anatomy.length),
      designTokens
    )
  );

  section.appendChild(card);
  stretchChildHorizontal(card);

  if (spec.warnings && spec.warnings.length) {
    var warnBlock = await createWarningBlock(spec.warnings, null, designTokens);
    section.appendChild(warnBlock);
    stretchChildHorizontal(warnBlock);
  }

  return section;
}

function createCardDividerStrip(designTokens, dividerTotalWidth) {
  var stripW =
    dividerTotalWidth != null ? dividerTotalWidth : INNER_CONTENT_WIDTH;
  var d = createFrameNode('Container card heading divider', {
    fills: [],
    layoutMode: 'NONE',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  });

  applyFillToken(
    d,
    designTokens.colors.headingDivider || designTokens.colors.cardBorder,
    SPEC_COLORS.cardBorder
  );

  d.resize(Math.max(1, stripW), 1);
  return d;
}

async function createContainerCard(container, index, designTokens) {
  void index;

  var sp = getDesignSpaces(designTokens);
  var rad = getDesignRadiusMd(designTokens);
  var outerW = SPEC_CARD_LAYOUT.descriptionWidth;

  var propDim = {
    rowWidth: descriptionCardContentInnerWidth(designTokens),
    labelWidth: CONTAINER_CARD_LABEL_WIDTH,
    valueWidth: descriptionCardValueColumnWidth(designTokens),
  };

  var card = createFrameNode('Container card', {
    fills: [],
    strokes: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    width: outerW,
    clipsContent: false,
    cornerRadius: rad,
    effects: SPEC_EFFECTS.cardShadow,
  });
  applyFillToken(card, designTokens.colors.cardBackground, SPEC_COLORS.containerCardBg);
  applyStrokeToken(card, designTokens.colors.cardBorder, SPEC_COLORS.cardBorder, 1);

  await tryApplyContainerCardTokens(card);

  var heading = createFrameNode('Container card heading', {
    fills: [],
    strokes: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    itemSpacing: sp.medium,
    paddingTop: sp.medium,
    paddingRight: sp.xl,
    paddingBottom: sp.medium,
    paddingLeft: sp.xl,
    cornerRadius: 0,
    topLeftRadius: rad,
    topRightRadius: rad,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
    width: outerW,
  });

  applyFillToken(
    heading,
    designTokens.colors.cardBackground,
    SPEC_COLORS.containerCardBg
  );

  var titleOpts = {
    name: 'Container card title',
    fontFamilyRole: 'heading',
    fontName: activeFontBold,
    fontSize: 16,
    lineHeight: { unit: 'PERCENT', value: 130 },
    fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
    width: outerW - sp.xl * 2,
  };

  var title = await createTextNode(String(container.name), titleOpts);
  await tryApplyTextPrimary(title);

  heading.appendChild(title);
  card.appendChild(heading);
  stretchChildHorizontal(heading);

  var divider = createCardDividerStrip(designTokens, outerW);
  card.appendChild(divider);
  stretchChildHorizontal(divider);

  var content = createFrameNode('Container card content', {
    fills: [],
    strokes: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'AUTO',
    clipsContent: false,
    itemSpacing: sp.medium,
    paddingTop: sp.xl,
    paddingRight: sp.xl,
    paddingBottom: sp.xl,
    paddingLeft: sp.xl,
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomLeftRadius: SPEC_LAYOUT.cardCornerRadius,
    bottomRightRadius: SPEC_LAYOUT.cardCornerRadius,
    width: outerW,
  });

  applyFillToken(
    content,
    designTokens.colors.cardBackground,
    SPEC_COLORS.containerCardBg
  );

  var dirDisplay = formatDirection(container.layout.direction);

  var specStyleForSpacing = getSpecBuildStyleContext();

  var specRows = getContainerPropertyRows({
    directionDisplay: dirDisplay,
    alignmentDisplay: formatAlignmentForContainer(container),
    widthDisplay: formatSizingModeOnly(container.sizing.width),
    heightDisplay: formatSizingModeOnly(container.sizing.height),
    gapDisplay: formatGapForSpec(container),
    paddingValueGroups: getPaddingRows(
      container,
      specStyleForSpacing && specStyleForSpacing.spacingTokenResolver
    ),
  });

  var ri;
  for (ri = 0; ri < specRows.length; ri++) {
    var rd = specRows[ri];
    if (rd.type === 'padding') {
      content.appendChild(await createPaddingContainerPropertyRow(rd, designTokens, propDim));
    } else {
      content.appendChild(await createBaseContainerPropertyRow(rd, designTokens, propDim));
    }
  }

  if (container.warnings && container.warnings.length) {
    var wb = await createWarningBlock(
      container.warnings,
      {
        outerWidth: descriptionCardContentInnerWidth(designTokens),
      },
      designTokens
    );
    content.appendChild(wb);
    stretchChildHorizontal(wb);
  }

  var contentFixedH = SPEC_CARD_LAYOUT.containerCardContentHeight;
  try {
    content.layoutSizingHorizontal = 'FILL';
    content.layoutSizingVertical = 'FIXED';
  } catch (_csl) {
    /* ignore */
  }
  content.primaryAxisSizingMode = 'FIXED';
  content.counterAxisSizingMode = 'AUTO';
  content.clipsContent = false;
  content.resize(Math.max(1, Math.round(Number(content.width) || outerW)), contentFixedH);

  card.appendChild(content);

  return card;
}

async function createSpecSection(containersSection) {
  var section = createFrameNode('Spec section', {
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 24,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    fills: [],
    strokes: [],
    clipsContent: false,
  });

  var title = await createTextNode('Spec', {
    name: 'Spec section title',
    fontFamilyRole: 'heading',
    fontName: activeFontRegular,
    fontSize: SECTION_TITLE_STYLE.fontSize,
    lineHeight: SECTION_TITLE_STYLE.lineHeight,
    fills: [{ type: 'SOLID', color: SECTION_TITLE_STYLE.color }],
  });

  await tryApplySectionTitleTokens(title);

  containersSection.name = 'Containers section';

  section.appendChild(title);
  section.appendChild(containersSection);

  stretchInParent(section);
  stretchInParent(containersSection);

  return section;
}

async function createAnatomySection(anatomyFrame) {
  var section = createFrameNode('Anatomy section', {
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 24,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    fills: [],
    strokes: [],
    clipsContent: false,
  });

  stretchInParent(section);

  var title = await createTextNode('Component anatomy', {
    name: 'Anatomy section title',
    fontFamilyRole: 'heading',
    fontName: activeFontRegular,
    fontSize: SECTION_TITLE_STYLE.fontSize,
    lineHeight: SECTION_TITLE_STYLE.lineHeight,
    fills: [{ type: 'SOLID', color: SECTION_TITLE_STYLE.color }],
  });

  await tryApplySectionTitleTokens(title);

  var anatomyContainer = createFrameNode('Anatomy container', {
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    cornerRadius: 16,
    fills: [{ type: 'SOLID', color: SPEC_COLORS.backgroundPrimary }],
    strokes: [],
    clipsContent: false,
  });

  stretchInParent(anatomyContainer);

  await tryApplyAnatomyContainerTokens(anatomyContainer);

  anatomyFrame.name = 'Anatomy';

  try {
    anatomyFrame.fills = [];
  } catch (clearErr) {
    console.warn('Cannot clear Anatomy frame fills', clearErr);
  }

  anatomyContainer.appendChild(anatomyFrame);

  await tryApplyAnatomySemanticColors(anatomyFrame);

  section.appendChild(title);
  section.appendChild(anatomyContainer);

  return section;
}

async function createContainersSection(spec, root, designTokens, sections) {
  var section = createFrameNode('Containers section', {
    fills: [{ type: 'SOLID', color: SPEC_COLORS.backgroundPrimary }],
    strokes: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 24,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    cornerRadius: 16,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    clipsContent: false,
  });

  stretchInParent(section);

  await tryApplyContainersSectionTokens(section);

  for (var ck = 0; ck < spec.containers.length; ck++) {
    var brow = await createContainerSpecRow(spec.containers[ck], ck + 1, root, designTokens, sections);

    section.appendChild(brow);
    try {
      if (brow.children.length >= 2) {
        var descCard = brow.children[0];
        var previewCard = brow.children[1];
        descCard.layoutSizingHorizontal = 'FIXED';
        descCard.layoutSizingVertical = 'FILL';
        previewCard.layoutSizingHorizontal = 'FILL';
        previewCard.layoutSizingVertical = 'FILL';
      }
    } catch (_rowStretchErr) {}

    stretchInParent(brow);
    stretchChildHorizontal(brow);
  }

  return section;
}

function directionRu(dir) {
  switch (dir) {
    case 'horizontal':
      return 'Горизонтальное Auto Layout';
    case 'vertical':
      return 'Вертикальное Auto Layout';
    case 'grid':
      return 'Сетка (Grid)';
    case 'none':
      return 'Нет Auto Layout';
    default:
      return escapeMarkdownTableCell(String(dir));
  }
}

function sizingLine(side) {
  return side.mode + ', ' + side.value + 'px';
}

function generateMarkdown(spec, sections) {
  sections = normalizeSectionSettings(sections);
  var lines = [];

  lines.push('# Спецификация компонента: ' + escapeMarkdownTableCell(spec.component.name));
  lines.push('');

  var sectionCounter = { value: 1 };

  var anySections =
    (sections.containers || sections.anatomy) || false;

  if (!anySections) {
    lines.push('Не выбраны информационные блоки для отображения.');
    return lines.join('\n');
  }

  if (spec.warnings.length) {
    var wnStandalone = getSectionNumber(sectionCounter);
    lines.push('## ' + wnStandalone + '. Предупреждения');
    lines.push('');
    for (var wj = 0; wj < spec.warnings.length; wj++) {
      lines.push('- ' + escapeMarkdownTableCell(spec.warnings[wj]));
    }
  }

  if (sections.anatomy) {
    var anNum = getSectionNumber(sectionCounter);

    lines.push('');
    lines.push('## ' + anNum + '. Анатомия');
    lines.push('');
    lines.push('| № | Элемент | Тип | Обязательность | Описание |');
    lines.push('|---:|---|---|---|---|');
    for (var ai = 0; ai < spec.anatomy.length; ai++) {
      var it = spec.anatomy[ai];
      lines.push(
        '| ' +
          (ai + 1) +
          ' | ' +
          escapeMarkdownTableCell(it.name) +
          ' | ' +
          escapeMarkdownTableCell(it.type) +
          ' | ' +
          formatRequired(it.required) +
          ' | ' +
          escapeMarkdownTableCell(it.description) +
          ' |'
      );
    }
  }

  if (sections.containers) {
    var cn = getSectionNumber(sectionCounter);

    lines.push('');
    lines.push('## ' + cn + '. Контейнеры');

    for (var ci = 0; ci < spec.containers.length; ci++) {
      var c = spec.containers[ci];
      var idx = ci + 1;

      lines.push('');
      lines.push('### ' + cn + '.' + idx + ' ' + escapeMarkdownTableCell(c.path));
      lines.push('');
      lines.push('| Параметр | Значение |');
      lines.push('|---|---|');
      lines.push('| Название | ' + escapeMarkdownTableCell(c.name) + ' |');
      lines.push('| Тип | ' + escapeMarkdownTableCell(c.type) + ' |');
      lines.push(
        '| Направление | ' + escapeMarkdownTableCell(directionRu(c.layout.direction)) + ' |'
      );
      lines.push(
        '| Выравнивание по основной оси | ' +
          (c.layout.primaryAxisAlignment
            ? escapeMarkdownTableCell(String(c.layout.primaryAxisAlignment))
            : '—') +
          ' |'
      );
      lines.push(
        '| Выравнивание по поперечной оси | ' +
          (c.layout.counterAxisAlignment
            ? escapeMarkdownTableCell(String(c.layout.counterAxisAlignment))
            : '—') +
          ' |'
      );
      lines.push('| Ширина | ' + escapeMarkdownTableCell(sizingLine(c.sizing.width)) + ' |');
      lines.push('| Высота | ' + escapeMarkdownTableCell(sizingLine(c.sizing.height)) + ' |');

      lines.push('');
      lines.push('#### Padding');
      lines.push('');
      lines.push('| Сторона | Значение |');
      lines.push('|---|---|');
      lines.push('| Top | ' + escapeMarkdownTableCell(formatTokenWithValue(c.padding.top)) + ' |');
      lines.push(
        '| Right | ' + escapeMarkdownTableCell(formatTokenWithValue(c.padding.right)) + ' |'
      );
      lines.push(
        '| Bottom | ' + escapeMarkdownTableCell(formatTokenWithValue(c.padding.bottom)) + ' |'
      );
      lines.push('| Left | ' + escapeMarkdownTableCell(formatTokenWithValue(c.padding.left)) + ' |');

      lines.push('');
      lines.push('#### Spacing');

      var hasEitherGapDefined = !!(c.spacing.gap || c.spacing.rowGap);

      lines.push('');
      if (!hasEitherGapDefined) {
        lines.push(
          escapeMarkdownTableCell('Gap не задан или контейнер не использует Auto Layout.')
        );
      }

      if (hasEitherGapDefined) {
        lines.push('');
        lines.push('| Параметр | Значение | Источник |');
        lines.push('|---|---|---|');

        if (c.spacing.gap) {
          lines.push(
            '| Gap | ' +
              escapeMarkdownTableCell(formatTokenWithValue(c.spacing.gap)) +
              ' | ' +
              escapeMarkdownTableCell('auto-layout') +
              ' |'
          );
        }

        if (c.spacing.rowGap) {
          lines.push(
            '| Row gap | ' +
              escapeMarkdownTableCell(formatTokenWithValue(c.spacing.rowGap)) +
              ' | ' +
              escapeMarkdownTableCell('auto-layout') +
              ' |'
          );
        }

        lines.push('');
      }

      if (c.warnings.length) {
        lines.push('#### Предупреждения');
        lines.push('');
        for (var cw = 0; cw < c.warnings.length; cw++) {
          lines.push('- ' + escapeMarkdownTableCell(c.warnings[cw]));
        }
      }
    }
  }

  return lines.join('\n');
}

function buildSpecObject(root) {
  var anatomy = parseAnatomy(root);
  var containers = parseContainers(root);
  var warnings = [];

  if (containers.length === 0) {
    warnings.push('Контейнеры не найдены.');
  }

  var hasNoAl = containers.some(function (c2) {
    return c2.layout.direction === 'none';
  });

  if (hasNoAl) {
    warnings.push('Некоторые контейнеры не используют Auto Layout.');
  }

  return {
    component: {
      id: root.id,
      name: root.name,
      type: root.type,
    },
    anatomy: anatomy,
    containers: containers,
    warnings: warnings,
  };
}

function generateSpec(sections) {
  sections = normalizeSectionSettings(sections);
  var info = getSelectionInfo();

  if (!info.supported) {
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message:
          info.error ||
          'Невозможно сгенерировать спецификацию для текущего выделения.',
      },
    });
    return;
  }

  var root = figma.currentPage.selection[0];
  var spec = buildSpecObject(root);

  figma.ui.postMessage({
    type: 'SPEC_GENERATED',
    payload: {
      spec: spec,
      markdown: generateMarkdown(spec, sections),
    },
  });
}

async function createSpecFrame(root, spec, designTokens, sections) {
  var specFrame = figma.createFrame();
  specFrame.name = 'Spec';
  specFrame.layoutMode = 'VERTICAL';
  specFrame.primaryAxisSizingMode = 'AUTO';
  specFrame.counterAxisSizingMode = 'FIXED';
  specFrame.resize(SPEC_LAYOUT.width, 100);
  specFrame.paddingTop = SPEC_LAYOUT.padding;
  specFrame.paddingRight = SPEC_LAYOUT.padding;
  specFrame.paddingBottom = SPEC_LAYOUT.padding;
  specFrame.paddingLeft = SPEC_LAYOUT.padding;
  specFrame.itemSpacing = SPEC_LAYOUT.sectionGap;
  specFrame.cornerRadius = SPEC_LAYOUT.cornerRadius;
  specFrame.fills = [{ type: 'SOLID', color: SPEC_COLORS.pageBg }];
  specFrame.clipsContent = false;

  if (!sections.containers) {
    var emptyNotice = await createEmptySectionsNotice(designTokens);
    specFrame.appendChild(emptyNotice);
    stretchChildHorizontal(emptyNotice);
  } else {
    var containersSec = await createContainersSection(
      spec,
      root,
      designTokens,
      sections
    );

    var specSection = await createSpecSection(containersSec);
    specFrame.appendChild(specSection);
    stretchInParent(specSection);
  }

  return specFrame;
}

async function generateSpecFrames(sections) {
  sections = normalizeSectionSettings(sections);
  try {
    var info = getSelectionInfo();

    if (!info.supported) {
      figma.ui.postMessage({
        type: 'ERROR',
        payload: {
          message:
            info.error ||
            'Невозможно сгенерировать спецификацию для текущего выделения.',
        },
      });
      return;
    }

    var root = figma.currentPage.selection[0];

    await loadSpecFonts();

    var designTokens = await loadSpecDesignTokens();

    var spec = buildSpecObject(root);

    var specFrame = await createSpecFrame(root, spec, designTokens, sections);
    specFrame.name = 'Spec / ' + root.name;

    figma.currentPage.appendChild(specFrame);

    var box = root.absoluteBoundingBox;
    if (box) {
      specFrame.x = box.x + box.width + 80;
      specFrame.y = box.y;
    } else {
      specFrame.x = root.x + root.width + 80;
      specFrame.y = root.y;
    }

    figma.currentPage.selection = [specFrame];
    figma.viewport.scrollAndZoomIntoView([specFrame]);

    figma.ui.postMessage({
      type: 'FRAMES_GENERATED',
      payload: {
        name: specFrame.name,
      },
    });
  } catch (error) {
    console.error(error);
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message:
          'Не удалось создать фреймы спецификации. Проверьте консоль плагина.',
      },
    });
  }
}

async function tryApplySpecificationFrameTokens(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySpecificationFrameTokens(frame, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applySpecificationFrameTokens', e);
  }
}

async function tryApplySectionTitleTokens(textNode) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySectionTitleTokens(textNode, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applySectionTitleTokens', e);
  }
}

async function tryApplyContainersSectionTokens(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applyContainersSectionTokens(frame, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applyContainersSectionTokens', e);
  }
}

async function tryApplyAnatomyContainerTokens(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applyAnatomyContainerTokens(frame, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applyAnatomyContainerTokens', e);
  }
}

async function tryApplyContainerCardTokens(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applyContainerCardTokens(frame, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applyContainerCardTokens', e);
  }
}

async function tryApplyContainerPreviewCardTokens(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applyContainerPreviewCardTokens(frame, ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] applyContainerPreviewCardTokens', e);
  }
}

async function tryApplyPaddingMeasureFillFrame(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) {
    var mColor =
      SPEC_COLORS.paddingMeasure ||
      PADDING_OVERLAY_LAYOUT.measureColor;
    var opacity =
      typeof PADDING_OVERLAY_LAYOUT.measureOpacity === 'number'
        ? PADDING_OVERLAY_LAYOUT.measureOpacity
        : 0.2;
    frame.fills = [makeSolidPaintWithOpacity(mColor, opacity)];
    return;
  }
  try {
    await ctx.apply.applySemanticEffectFill(
      frame,
      'paddingMeasureFill',
      ctx.resolver
    );
  } catch (e) {
    console.warn('[StyleResolver] padding measure fill', e);
    var mColor2 =
      SPEC_COLORS.paddingMeasure ||
      PADDING_OVERLAY_LAYOUT.measureColor;
    var opacity2 =
      typeof PADDING_OVERLAY_LAYOUT.measureOpacity === 'number'
        ? PADDING_OVERLAY_LAYOUT.measureOpacity
        : 0.2;
    frame.fills = [makeSolidPaintWithOpacity(mColor2, opacity2)];
  }
}

async function tryApplyGapMeasureFillFrame(frame) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) {
    frame.fills = [
      makeSolidPaintWithOpacity(SPEC_COLORS.gapMeasure || GAP_OVERLAY_COLOR, 0.2),
    ];
    return;
  }
  try {
    await ctx.apply.applySemanticEffectFill(frame, 'gapMeasureFill', ctx.resolver);
  } catch (e) {
    console.warn('[StyleResolver] gap measure fill', e);
    frame.fills = [
      makeSolidPaintWithOpacity(SPEC_COLORS.gapMeasure || GAP_OVERLAY_COLOR, 0.2),
    ];
  }
}

async function tryApplyTargetOutlineStroke(node) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      node,
      'targetOutlineStroke',
      ctx.resolver,
      'stroke'
    );
    try {
      node.strokeAlign = 'OUTSIDE';
    } catch (_sa) {
      /* ignore */
    }
  } catch (e) {
    console.warn('[StyleResolver] target outline', e);
  }
}

async function tryApplyGapValueSquareFill(square) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      square,
      'gapValueFill',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] gap value square fill', e);
  }
}

async function tryApplyPaddingValueSquareFill(square) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      square,
      'paddingValueFill',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] padding value square fill', e);
  }
}

async function tryApplyValueSquareLabelInverse(textNode) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      textNode,
      'textInverse',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] value square label inverse', e);
  }
}

async function tryApplyLabelTextTertiary(textNode) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      textNode,
      'textTertiary',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] label tertiary', e);
  }
}

async function tryApplyTextPrimary(textNode) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      textNode,
      'textPrimary',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] text primary', e);
  }
}

async function tryApplyTextSecondary(textNode) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      textNode,
      'textSecondary',
      ctx.resolver,
      'fill'
    );
  } catch (e) {
    console.warn('[StyleResolver] text secondary', e);
  }
}

async function tryApplyChildOverlaySemantics(overlay) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver) return;
  try {
    await ctx.apply.applySemanticColorKey(
      overlay,
      'childOverlayFill',
      ctx.resolver,
      'fill'
    );
    overlay.strokeWeight = 1;
    await ctx.apply.applySemanticColorKey(
      overlay,
      'childOverlayStroke',
      ctx.resolver,
      'stroke'
    );
  } catch (e) {
    console.warn('[StyleResolver] child overlay semantics', e);
  }
}

async function tryApplyAnatomySemanticColors(root) {
  var ctx = getSpecBuildStyleContext();
  if (!ctx || !ctx.apply || !ctx.resolver || typeof root.findAll !== 'function') return;
  try {
    var nodes = root.findAll(function (n) {
      return n.type === 'FRAME' || n.type === 'TEXT';
    });
    var i;
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var name = String(n.name || '');
      if (n.type === 'FRAME' && name.indexOf('Anatomy marker /') === 0) {
        await ctx.apply.applySemanticColorKey(
          n,
          'anatomyPointerFill',
          ctx.resolver,
          'fill'
        );
        continue;
      }
      if (n.type === 'FRAME' && name.indexOf('Anatomy list marker /') === 0) {
        await ctx.apply.applySemanticColorKey(
          n,
          'anatomyPointerFill',
          ctx.resolver,
          'fill'
        );
        continue;
      }
      if (n.type === 'FRAME' && name.indexOf('Anatomy connector /') === 0) {
        await ctx.apply.applySemanticColorKey(
          n,
          'anatomyConnector',
          ctx.resolver,
          'fill'
        );
        continue;
      }
      if (n.type === 'TEXT' && name.indexOf('Anatomy marker number') === 0) {
        try {
          await figma.loadFontAsync(n.fontName);
        } catch (_lf) {}
        await ctx.apply.applySemanticColorKey(
          n,
          'textInverse',
          ctx.resolver,
          'fill'
        );
        continue;
      }
      if (n.type === 'TEXT' && name.indexOf('Anatomy marker label') === 0) {
        await ctx.apply.applySemanticColorKey(
          n,
          'textInverse',
          ctx.resolver,
          'fill'
        );
        continue;
      }
      if (n.type === 'TEXT' && name.indexOf('Anatomy list marker label') === 0) {
        await ctx.apply.applySemanticColorKey(
          n,
          'textInverse',
          ctx.resolver,
          'fill'
        );
      }
    }
  } catch (e) {
    console.warn('[StyleResolver] anatomy semantic colors', e);
  }
}

async function buildSpecification(sections) {
  sections = normalizeSectionSettings(sections);
  try {
    var selection = figma.currentPage.selection;

    if (selection.length !== 1) {
      figma.ui.postMessage({
        type: 'ERROR',
        payload: {
          message:
            selection.length === 0
              ? 'Выберите компонент, фрейм или инстанс.'
              : 'Выберите только один компонент, фрейм или инстанс.',
        },
      });
      return;
    }

    var root = selection[0];

    if (!isSupportedNode(root)) {
      figma.ui.postMessage({
        type: 'ERROR',
        payload: {
          message:
            'Выбранный слой не поддерживается. Выберите компонент, фрейм или инстанс.',
        },
      });
      return;
    }

    await loadSpecFonts();
    var designTokens = await loadSpecDesignTokens();
    var spec = buildSpecObject(root);

    var specificationFrame = figma.createFrame();
    specificationFrame.name = 'Specification / ' + root.name;
    specificationFrame.layoutMode = 'VERTICAL';
    specificationFrame.primaryAxisSizingMode = 'AUTO';
    specificationFrame.counterAxisSizingMode = 'FIXED';
    specificationFrame.resize(SPECIFICATION_LAYOUT.width, 100);
    specificationFrame.itemSpacing = SPECIFICATION_LAYOUT.gap;
    specificationFrame.paddingTop = SPECIFICATION_LAYOUT.padding;
    specificationFrame.paddingRight = SPECIFICATION_LAYOUT.padding;
    specificationFrame.paddingBottom = SPECIFICATION_LAYOUT.padding;
    specificationFrame.paddingLeft = SPECIFICATION_LAYOUT.padding;
    specificationFrame.fills = [
      { type: 'SOLID', color: SPEC_COLORS.backgroundSecondary },
    ];
    specificationFrame.strokes = [];
    specificationFrame.clipsContent = false;

    await tryApplySpecificationFrameTokens(specificationFrame);

    if (sections.componentAnatomy || sections.anatomy) {
      var propertyMetadata = await AnatomyGenerator.getComponentPropertyMetadata(
        root
      );

      var anatomyOptions = await AnatomyGenerator.loadFonts({
        fontRegular: activeFontRegular,
        fontBold: activeFontBold,
      });

      anatomyOptions.componentPropertyMetadata = propertyMetadata;
      anatomyOptions.useComponentPropertyNames = !!sections.useComponentPropertyNames;

      var anatomyFrame = await AnatomyGenerator.createAnatomyFrame({
        sourceNode: root,
        title: 'Anatomy',
        options: anatomyOptions,
      });

      var anatomySection = await createAnatomySection(anatomyFrame);
      specificationFrame.appendChild(anatomySection);
      stretchInParent(anatomySection);
    }

    if (sections.spec || sections.containers) {
      var containersSection = await createContainersSection(
        spec,
        root,
        designTokens,
        sections
      );

      var specSection = await createSpecSection(containersSection);
      specificationFrame.appendChild(specSection);
      stretchInParent(specSection);
    }

    if (specificationFrame.children.length === 0) {
      var placeholder = await createTextNode(
        'Не выбраны блоки для генерации.',
        {
          name: 'Empty specification message',
          fontName: activeFontRegular,
          fontSize: 14,
          lineHeight: { unit: 'PERCENT', value: 130 },
          fills: [{ type: 'SOLID', color: SPEC_COLORS.textPrimary }],
        }
      );
      specificationFrame.appendChild(placeholder);
      stretchInParent(placeholder);
    }

    var includeHeader = sections.header !== false;
    var dsHeaderComponent = includeHeader ? findDsTemplateHeader() : null;
    var specificationRoot = await assembleSpecificationWrapper(
      root.name,
      specificationFrame,
      dsHeaderComponent,
      { includeHeader: includeHeader }
    );

    specificationRoot.x = root.x + root.width + 120;
    specificationRoot.y = root.y;

    figma.currentPage.appendChild(specificationRoot);

    figma.currentPage.selection = [specificationRoot];
    figma.viewport.scrollAndZoomIntoView([specificationRoot]);

    figma.ui.postMessage({
      type: 'SPECIFICATION_BUILT',
      payload: {
        name: specificationRoot.name,
      },
    });
  } catch (error) {
    console.error(error);
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message:
          'Не удалось собрать спецификацию. Проверьте консоль плагина.',
      },
    });
  }
}

async function generateAnatomy() {
  var selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message: 'Выберите один компонент или фрейм для генерации анатомии.',
      },
    });
    return;
  }

  var sourceNode = selection[0];

  if (!isSupportedNode(sourceNode)) {
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message: 'Выбранный слой не поддерживается.',
      },
    });
    return;
  }

  try {
    var anatomyOptions = await AnatomyGenerator.loadFonts({
      fontRegular: activeFontRegular,
      fontBold: activeFontBold,
    });

    var propertyMetadata = await AnatomyGenerator.getComponentPropertyMetadata(sourceNode);

    anatomyOptions.componentPropertyMetadata = propertyMetadata;
    anatomyOptions.useComponentPropertyNames =
      DEFAULT_SECTION_SETTINGS.useComponentPropertyNames;

    var anatomyFrame = await AnatomyGenerator.createAnatomyFrame({
      sourceNode: sourceNode,
      title: 'Анатомия компонента',
      options: anatomyOptions,
    });

    anatomyFrame.x = sourceNode.x + sourceNode.width + 120;
    anatomyFrame.y = sourceNode.y;

    figma.currentPage.appendChild(anatomyFrame);
    figma.currentPage.selection = [anatomyFrame];
    figma.viewport.scrollAndZoomIntoView([anatomyFrame]);

    figma.ui.postMessage({
      type: 'ANATOMY_GENERATED',
      payload: { name: anatomyFrame.name },
    });
  } catch (error) {
    console.error(error);
    figma.ui.postMessage({
      type: 'ERROR',
      payload: {
        message: 'Не удалось сгенерировать анатомию компонента.',
      },
    });
  }
}


export { buildSpecification };
