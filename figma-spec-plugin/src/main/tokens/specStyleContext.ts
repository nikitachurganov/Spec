/// <reference types="@figma/plugin-typings" />

import type { StyleResolver } from './styleResolver';
import type { ColorSemanticKey } from './tokenMap';

/** Key shared with `legacyCore.js` (string must match exactly). */
export const SPEC_BUILD_STYLE_CONTEXT_KEY = '__SPEC_BUILD_STYLE_CONTEXT_V1__';

export type SpecBuildStyleContext = {
  resolver: StyleResolver;
  apply: {
    applySpecificationFrameTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    applySectionTitleTokens(text: TextNode, r: StyleResolver): Promise<void>;
    applyContainersSectionTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    applyAnatomyContainerTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    applyContainerCardTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    applyContainerPreviewCardTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    resolveSemanticSolidPaint(
      resolver: StyleResolver,
      key: ColorSemanticKey,
      opacity?: number
    ): Promise<Paint>;
    applySemanticEffectFill(
      frame: FrameNode,
      key: ColorSemanticKey,
      resolver: StyleResolver
    ): Promise<void>;
    applySemanticColorKey(
      node: GeometryMixin | TextNode | MinimalStrokesMixin,
      key: ColorSemanticKey,
      resolver: StyleResolver,
      target: 'fill' | 'stroke'
    ): Promise<void>;
  };
};

export function setSpecBuildStyleContext(ctx: SpecBuildStyleContext | undefined): void {
  const g = globalThis as unknown as Record<string, SpecBuildStyleContext | undefined>;
  if (ctx === undefined) delete g[SPEC_BUILD_STYLE_CONTEXT_KEY];
  else g[SPEC_BUILD_STYLE_CONTEXT_KEY] = ctx;
}

export function getSpecBuildStyleContext(): SpecBuildStyleContext | undefined {
  return (globalThis as unknown as Record<string, SpecBuildStyleContext | undefined>)[
    SPEC_BUILD_STYLE_CONTEXT_KEY
  ];
}
