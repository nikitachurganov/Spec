/// <reference types="@figma/plugin-typings" />

import type { ValueSquareAnchor } from './overlayGeometry';
import {
  createSpacingSideOverlay,
  SPACING_OVERLAY_LAYOUT,
  type SpacingSideOverlayBounds,
  type SpacingSideName,
} from './spacingSideOverlay';

export type TokenizedSpacingValue = {
  value: number;
  token?: string;
};

export type PaddingSideName = SpacingSideName;

export type PaddingOverlayBounds = SpacingSideOverlayBounds;

export type PaddingOverlayResult = {
  node: FrameNode;
  valueAnchor: ValueSquareAnchor;
};

export async function createPaddingOverlay(
  side: PaddingSideName,
  tokenizedValue: TokenizedSpacingValue | null | undefined,
  bounds: PaddingOverlayBounds
): Promise<PaddingOverlayResult | null> {
  if (!tokenizedValue) return null;

  const result = await createSpacingSideOverlay({
    kind: 'padding',
    side,
    frameName: `Padding overlay / ${side}`,
    bounds,
    tokenizedValue,
  });

  return result;
}

export const PADDING_OVERLAY_LAYOUT = SPACING_OVERLAY_LAYOUT;
