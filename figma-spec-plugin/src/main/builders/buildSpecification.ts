import type { PluginSettings } from '../../shared/settings';
import { debugLog } from '../debug';
import { buildSpecification as legacyBuildSpecification } from '../legacy/legacyCore.js';
import { applyContainerPreviewCardTokens } from './buildContainerPreviewCard';
import * as specApply from '../tokens/applyTokens';
import { createSpacingTokenResolver } from '../tokens/spacingTokenResolver';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { clearLocalStylesCache } from '../figma/localStyles';
import { createStyleResolver } from '../tokens/styleResolver';
import { setSpecBuildStyleContext } from '../tokens/specStyleContext';

/**
 * Runs the specification build. Legacy layout lives in `legacy/legacyCore.js`;
 * design tokens / variables are layered via `StyleResolver` + `applyTokens`.
 * Секции в `Specification / …`: accessibility → componentAnatomy → spec; плюс `settings.header` во wrapper.
 * Внешний wrapper: при `header === true` — `.DS-Template-header/Default` + `Specification / …`.
 */
export async function buildSpecification(settings: PluginSettings): Promise<void> {
  await ensureDocumentReadyForTraversal();
  clearLocalStylesCache();
  const resolver = createStyleResolver({
    useLibraryTokens: settings.useLibraryTokens !== false,
  });
  await resolver.init();
  const spacingTokenResolver = await createSpacingTokenResolver();
  await spacingTokenResolver.init();
  setSpecBuildStyleContext({
    resolver,
    spacingTokenResolver,
    apply: {
      ...specApply,
      applyContainerPreviewCardTokens,
    },
  });
  try {
    await legacyBuildSpecification(settings);
    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.FIGMA_SPEC_DEBUG === '1'
    ) {
      debugLog('[StyleResolver] Tokens resolved', resolver.getDebugSummary());
    }
  } finally {
    setSpecBuildStyleContext(undefined);
  }
}
