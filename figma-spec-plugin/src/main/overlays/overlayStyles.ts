/// <reference types="@figma/plugin-typings" />

import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { hexToRgb } from '../tokens/tokenMap';

const GAP_COLOR = hexToRgb('#F34747');
/** Gap borders, value square — Error palette */
const GAP_ERROR_COLOR = hexToRgb('#FF5C52');
const GAP_VALUE_SQUARE_COLOR = GAP_ERROR_COLOR;
const PADDING_VALUE_COLOR = hexToRgb('#449AFF');

function solidWithOpacity(color: RGB, opacity: number): SolidPaint {
  return { type: 'SOLID', color, opacity };
}

export async function applyPaddingMeasureFill(frame: FrameNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.applySemanticEffectFill && ctx.resolver) {
    try {
      await ctx.apply.applySemanticEffectFill(frame, 'paddingMeasureFill', ctx.resolver);
      return;
    } catch (e) {
      console.warn('[StyleResolver] padding measure fill', e);
    }
  }
  frame.fills = [solidWithOpacity(hexToRgb('#003F8A'), 0.2)];
}

type FillableNode = FrameNode | RectangleNode;

export async function applyGapGuideLineFill(line: RectangleNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.resolveSemanticSolidPaint && ctx.resolver) {
    try {
      line.fills = [await ctx.apply.resolveSemanticSolidPaint(ctx.resolver, 'gapStroke')];
      return;
    } catch (e) {
      console.warn('[StyleResolver] gap guide line fill', e);
    }
  }
  line.fills = [{ type: 'SOLID', color: GAP_ERROR_COLOR }];
  line.strokes = [];
}

export async function applyGapMeasureFill(frame: FillableNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.applySemanticEffectFill && ctx.resolver) {
    try {
      await ctx.apply.applySemanticEffectFill(frame as FrameNode, 'gapMeasureFill', ctx.resolver);
      return;
    } catch (e) {
      console.warn('[StyleResolver] gap measure fill', e);
    }
  }
  frame.fills = [solidWithOpacity(GAP_ERROR_COLOR, 0.2)];
}

export async function applyPaddingValueSquareFill(square: FrameNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.applySemanticColorKey && ctx.resolver) {
    try {
      await ctx.apply.applySemanticColorKey(square, 'paddingValueFill', ctx.resolver, 'fill');
      return;
    } catch (e) {
      console.warn('[StyleResolver] padding value square fill', e);
    }
  }
  square.fills = [{ type: 'SOLID', color: PADDING_VALUE_COLOR }];
}

export async function applyGapValueSquareFill(square: FrameNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.applySemanticColorKey && ctx.resolver) {
    try {
      await ctx.apply.applySemanticColorKey(square, 'gapValueFill', ctx.resolver, 'fill');
      return;
    } catch (e) {
      console.warn('[StyleResolver] gap value square fill', e);
    }
  }
  square.fills = [{ type: 'SOLID', color: GAP_VALUE_SQUARE_COLOR }];
}

export async function applyValueSquareLabelInverse(text: TextNode): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.applySemanticColorKey && ctx.resolver) {
    try {
      await ctx.apply.applySemanticColorKey(text, 'textInverse', ctx.resolver, 'fill');
    } catch (e) {
      console.warn('[StyleResolver] value square label inverse', e);
    }
  }
}

/**
 * @param stripShape — `horizontal` strip (Top/Bottom analog) or `vertical` strip (Left/Right analog).
 */
export async function applyGapOverlayStroke(
  overlay: FrameNode,
  stripShape: 'horizontal' | 'vertical'
): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  let strokePaint: Paint = { type: 'SOLID', color: GAP_COLOR };
  if (ctx?.apply?.resolveSemanticSolidPaint && ctx.resolver) {
    try {
      strokePaint = await ctx.apply.resolveSemanticSolidPaint(ctx.resolver, 'gapStroke');
    } catch (e) {
      console.warn('[StyleResolver] gap overlay stroke', e);
    }
  }

  overlay.strokes = [strokePaint];
  try {
    overlay.strokeWeight = 0;
    if (stripShape === 'horizontal') {
      overlay.strokeTopWeight = 1;
      overlay.strokeBottomWeight = 1;
      overlay.strokeLeftWeight = 0;
      overlay.strokeRightWeight = 0;
    } else {
      overlay.strokeTopWeight = 0;
      overlay.strokeBottomWeight = 0;
      overlay.strokeLeftWeight = 1;
      overlay.strokeRightWeight = 1;
    }
  } catch {
    overlay.strokeWeight = 1;
  }
}

export async function applyPaddingOverlayStroke(
  overlay: FrameNode,
  side: 'Top' | 'Right' | 'Bottom' | 'Left'
): Promise<void> {
  const ctx = getSpecBuildStyleContext();
  let strokePaint: Paint = { type: 'SOLID', color: PADDING_VALUE_COLOR };
  if (ctx?.apply?.resolveSemanticSolidPaint && ctx.resolver) {
    try {
      strokePaint = await ctx.apply.resolveSemanticSolidPaint(ctx.resolver, 'paddingStroke');
    } catch (e) {
      console.warn('[StyleResolver] padding overlay stroke', e);
    }
  }

  overlay.strokes = [strokePaint];
  try {
    overlay.strokeWeight = 0;
    if (side === 'Top' || side === 'Bottom') {
      overlay.strokeTopWeight = 1;
      overlay.strokeBottomWeight = 1;
      overlay.strokeLeftWeight = 0;
      overlay.strokeRightWeight = 0;
    } else {
      overlay.strokeTopWeight = 0;
      overlay.strokeBottomWeight = 0;
      overlay.strokeLeftWeight = 1;
      overlay.strokeRightWeight = 1;
    }
  } catch {
    overlay.strokeWeight = 1;
  }
}
