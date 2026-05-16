/// <reference types="@figma/plugin-typings" />

import type { StyleResolver } from '../tokens/styleResolver';
import { SPEC_TOKEN_MAP, specColorFallbackRgb } from '../tokens/tokenMap';

/**
 * Только `Background/Secondary` через StyleResolver для фрейма `Container preview card`.
 * Без повторной подстановки library paint из legacy `applyFillToken`.
 */
export async function applyContainerPreviewCardTokens(
  previewCard: FrameNode,
  resolver: StyleResolver
): Promise<void> {
  previewCard.opacity = 1;

  try {
    if ('fillStyleId' in previewCard && (previewCard as FrameNode).fillStyleId)
      (previewCard as FrameNode).fillStyleId = '';
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
