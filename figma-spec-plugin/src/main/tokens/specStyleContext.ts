/// <reference types="@figma/plugin-typings" />

import type { StyleResolver } from './styleResolver';
import type { ColorSemanticKey } from './tokenMap';
import type { SpacingTokenResolver } from './spacingTokenResolver';

/** Key shared with `legacyCore.js` (string must match exactly). */
export const SPEC_BUILD_STYLE_CONTEXT_KEY = '__SPEC_BUILD_STYLE_CONTEXT_V1__';

export type SpecBuildStyleContext = {
  resolver: StyleResolver;
  /** Temporary page for atomic builds; plugin nodes are appended here instead of currentPage. */
  stagingPage?: PageNode;
  /** Имена spacing-токенов для текста Padding/Gap (библиотека + fallback). */
  spacingTokenResolver?: SpacingTokenResolver;
  apply: {
    applySpecificationFrameTokens(frame: FrameNode, r: StyleResolver): Promise<void>;
    applySectionTitleTokens(text: TextNode, r: StyleResolver): Promise<void>;
    applyHeadingFontFamilyToken(text: TextNode, base: FontName, r: StyleResolver): Promise<void>;
    applyParagraphFontFamilyToken(text: TextNode, base: FontName, r: StyleResolver): Promise<void>;
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

export function attachNodeToActiveStagingPage(node: BaseNode): void {
  const stagingPage = getSpecBuildStyleContext()?.stagingPage;
  if (!stagingPage || stagingPage.removed || node.type === 'PAGE') return;
  if (node.parent === stagingPage) return;
  stagingPage.appendChild(node as SceneNode);
}
