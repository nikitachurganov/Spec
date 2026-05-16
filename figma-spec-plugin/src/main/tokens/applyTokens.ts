/// <reference types="@figma/plugin-typings" />

import { COLOR_TOKEN_MAP, SPEC_TOKEN_MAP, type ColorSemanticKey, hexToRgb, specColorFallbackRgb } from './tokenMap';
import type { StyleResolver } from './styleResolver';
import { findByAliases, resolvedColorToSolidRgb } from './styleResolver';

type ColorTokenDef = {
  readonly names: readonly string[];
  readonly fallback: string;
  readonly fallbackOpacity?: number;
  readonly tokenType?: 'color' | 'effect';
};

/** Solid paint для обводок gap/padding с сохранением stroke weights в legacy. */
export async function resolveSemanticSolidPaint(
  resolver: StyleResolver,
  key: ColorSemanticKey,
  opacity?: number
): Promise<Paint> {
  const def = COLOR_TOKEN_MAP[key] as ColorTokenDef;
  const rgb = hexToRgb(def.fallback);
  const r = await resolver.resolveColor([...def.names], rgb);
  const solidRgb = resolvedColorToSolidRgb(r, rgb, null);
  const op = opacity !== undefined ? opacity : def.fallbackOpacity;
  const base: SolidPaint =
    op != null && op !== 1
      ? { type: 'SOLID', color: solidRgb, opacity: op }
      : { type: 'SOLID', color: solidRgb };
  const setBound = figma.variables?.setBoundVariableForPaint;
  if (r.variable && typeof setBound === 'function') {
    try {
      return setBound.call(figma.variables, base, 'color', r.variable);
    } catch {
      /* fall through */
    }
  }
  return base;
}

/**
 * Effect style по имени, иначе полупрозрачная заливка (как раньше measure fill).
 */
export async function applySemanticEffectFill(
  frame: FrameNode,
  key: ColorSemanticKey,
  resolver: StyleResolver
): Promise<void> {
  const def = COLOR_TOKEN_MAP[key] as ColorTokenDef;
  if (def.tokenType !== 'effect') {
    await resolver.applyFill(
      frame,
      [...def.names],
      hexToRgb(def.fallback),
      def.fallbackOpacity ?? 1
    );
    return;
  }
  const fx = findByAliases(figma.getLocalEffectStyles(), [...def.names]);
  if (fx) {
    try {
      frame.effectStyleId = fx.id;
      try {
        frame.fills = [];
      } catch {
        /* ignore */
      }
      return;
    } catch {
      /* fall through */
    }
  }
  await resolver.applyFill(
    frame,
    [...def.names],
    hexToRgb(def.fallback),
    def.fallbackOpacity ?? 0.2
  );
}

export async function applySemanticColorKey(
  node: GeometryMixin | TextNode | MinimalStrokesMixin,
  key: ColorSemanticKey,
  resolver: StyleResolver,
  target: 'fill' | 'stroke'
): Promise<void> {
  const def = COLOR_TOKEN_MAP[key] as ColorTokenDef;
  if (def.tokenType === 'effect' && target === 'fill' && (node as SceneNode).type === 'FRAME') {
    await applySemanticEffectFill(node as FrameNode, key, resolver);
    return;
  }
  const rgb = hexToRgb(def.fallback);
  if (target === 'stroke' && 'strokes' in node) {
    await resolver.applyStroke(node as MinimalStrokesMixin, [...def.names], rgb, def.fallbackOpacity);
    return;
  }
  if (target === 'fill' && 'fills' in node) {
    await resolver.applyFill(node as GeometryMixin, [...def.names], rgb, def.fallbackOpacity);
  }
}

export async function applySpecificationFrameTokens(
  frame: FrameNode,
  resolver: StyleResolver
): Promise<void> {
  const c = SPEC_TOKEN_MAP.colors.backgroundSecondary;
  await resolver.applyFill(frame, [...c.names], specColorFallbackRgb(c.fallback as Parameters<typeof specColorFallbackRgb>[0]));
}

export async function applySectionTitleTokens(text: TextNode, resolver: StyleResolver): Promise<void> {
  const ts = SPEC_TOKEN_MAP.textStyles.sectionTitle;
  const col = SPEC_TOKEN_MAP.colors.sectionTitle;
  await resolver.applyTextStyle(text, [...ts.names], ts.fallback);
  await resolver.applyFill(text, [...col.names], col.fallback);
}

export async function applyContainersSectionTokens(
  frame: FrameNode,
  resolver: StyleResolver
): Promise<void> {
  const bg = SPEC_TOKEN_MAP.colors.backgroundPrimary;
  await resolver.applyFill(frame, [...bg.names], specColorFallbackRgb(bg.fallback as Parameters<typeof specColorFallbackRgb>[0]));
}

export async function applyAnatomyContainerTokens(
  frame: FrameNode,
  resolver: StyleResolver
): Promise<void> {
  const bg = SPEC_TOKEN_MAP.colors.backgroundPrimary;
  await resolver.applyFill(frame, [...bg.names], specColorFallbackRgb(bg.fallback as Parameters<typeof specColorFallbackRgb>[0]));
}

export async function applyContainerCardTokens(frame: FrameNode, resolver: StyleResolver): Promise<void> {
  const bg = SPEC_TOKEN_MAP.colors.containerCard;
  const stroke = SPEC_TOKEN_MAP.colors.divider;
  await resolver.applyFill(frame, [...bg.names], specColorFallbackRgb(bg.fallback as Parameters<typeof specColorFallbackRgb>[0]));
  try {
    frame.strokeWeight = 1;
    await resolver.applyStroke(frame, [...stroke.names], specColorFallbackRgb(stroke.fallback as Parameters<typeof specColorFallbackRgb>[0]));
  } catch {
    /* ignore */
  }
}
