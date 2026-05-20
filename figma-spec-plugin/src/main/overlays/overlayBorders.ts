/// <reference types="@figma/plugin-typings" />

import type { Rect } from './overlayGeometry';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { hexToRgb } from '../tokens/tokenMap';

export type BorderSide = 'top' | 'right' | 'bottom' | 'left';

const BORDER_THICKNESS = 1;

export async function resolveGapBorderColor(): Promise<RGB> {
  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply?.resolveSemanticSolidPaint && ctx.resolver) {
    try {
      const paint = await ctx.apply.resolveSemanticSolidPaint(ctx.resolver, 'gapStroke');
      if (paint.type === 'SOLID') return paint.color;
    } catch (e) {
      console.warn('[StyleResolver] gap border color', e);
    }
  }
  return hexToRgb('#F34747');
}

/** Gap zone orientation → which 1px border sides to draw. */
export function getGapBorderSides(gapOrientation: 'horizontal' | 'vertical'): BorderSide[] {
  if (gapOrientation === 'horizontal') {
    return ['top', 'bottom'];
  }
  return ['left', 'right'];
}

/**
 * 1px border lines as rectangles in local overlay coordinates (no frame strokes).
 */
export function createOverlayBorderLines(params: {
  namePrefix: string;
  rect: Rect;
  sides: BorderSide[];
  color: RGB;
}): RectangleNode[] {
  const lines: RectangleNode[] = [];
  const { rect, sides, color, namePrefix } = params;
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  for (const side of sides) {
    const line = figma.createRectangle();
    line.fills = [{ type: 'SOLID', color }];
    line.strokes = [];

    if (side === 'top') {
      line.name = `${namePrefix} / top`;
      line.x = x;
      line.y = y;
      line.resize(w, BORDER_THICKNESS);
    } else if (side === 'bottom') {
      line.name = `${namePrefix} / bottom`;
      line.x = x;
      line.y = y + h - BORDER_THICKNESS;
      line.resize(w, BORDER_THICKNESS);
    } else if (side === 'left') {
      line.name = `${namePrefix} / left`;
      line.x = x;
      line.y = y;
      line.resize(BORDER_THICKNESS, h);
    } else {
      line.name = `${namePrefix} / right`;
      line.x = x + w - BORDER_THICKNESS;
      line.y = y;
      line.resize(BORDER_THICKNESS, h);
    }

    lines.push(line);
  }

  return lines;
}
