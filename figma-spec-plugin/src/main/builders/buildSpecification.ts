import type { PluginSettings } from '../../shared/settings';
import { buildSpecification as legacyBuildSpecification } from '../legacy/legacyCore.js';
import { applyContainerPreviewCardTokens } from './buildContainerPreviewCard';
import * as specApply from '../tokens/applyTokens';
import { createStyleResolver } from '../tokens/styleResolver';
import { setSpecBuildStyleContext } from '../tokens/specStyleContext';

/**
 * Runs the specification build. Legacy layout lives in `legacy/legacyCore.js`;
 * design tokens / variables are layered via `StyleResolver` + `applyTokens`.
 * Внешний Auto Layout `DS specification / …` с двумя прямыми детьми: инстанс шапки
 * `.DS-Template-header/Default` и фрейм `Specification / …` — через `assembleSpecificationWrapper`.
 */
export async function buildSpecification(settings: PluginSettings): Promise<void> {
  const resolver = createStyleResolver({
    useLibraryTokens: settings.useLibraryTokens !== false,
  });
  await resolver.init();
  setSpecBuildStyleContext({
    resolver,
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
      console.log('[StyleResolver] Tokens resolved', resolver.getDebugSummary());
    }
  } finally {
    setSpecBuildStyleContext(undefined);
  }
}
