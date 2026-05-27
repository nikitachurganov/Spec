/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { debugLog } from '../debug';
import { buildSpecification as legacyBuildSpecification } from '../legacy/legacyCore.js';
import { applyContainerPreviewCardTokens } from './buildContainerPreviewCard';
import { buildDocumentationAtomically } from './buildDocumentationAtomically';
import * as specApply from '../tokens/applyTokens';
import { createSpacingTokenResolver } from '../tokens/spacingTokenResolver';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { clearLocalStylesCache } from '../figma/localStyles';
import {
  initVariableByIdRegistry,
  resetVariableApiCaches,
  resetVariableByIdRegistry,
} from '../figma/variables';
import { createStyleResolver } from '../tokens/styleResolver';
import { setSpecBuildStyleContext } from '../tokens/specStyleContext';
import { resetThemeVariablesCache } from '../tokens/themeModeResolver';
import { postToUi } from '../postToUi';

const SUPPORTED_ROOT_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'COMPONENT',
  'INSTANCE',
  'FRAME',
  'COMPONENT_SET',
]);

type ValidatedSelection =
  | { ok: true; root: SceneNode }
  | { ok: false; message: string };

function validateSelection(): ValidatedSelection {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      ok: false,
      message: 'Выберите компонент, фрейм или инстанс.',
    };
  }

  if (selection.length > 1) {
    return {
      ok: false,
      message: 'Выберите только один компонент, фрейм или инстанс.',
    };
  }

  const root = selection[0];
  if (!SUPPORTED_ROOT_TYPES.has(root.type)) {
    return {
      ok: false,
      message:
        'Выбранный слой не поддерживается. Выберите компонент, фрейм или инстанс.',
    };
  }

  return { ok: true, root };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Error';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Atomic generation: build on a temporary unnamed page without switching the
 * user away from their current page, then move the finished wrapper back.
 */
export async function buildSpecification(settings: PluginSettings): Promise<void> {
  const validation = validateSelection();
  if (!validation.ok) {
    postToUi({ type: 'ERROR', payload: { message: validation.message } });
    return;
  }
  const root = validation.root;

  await ensureDocumentReadyForTraversal();

  clearLocalStylesCache();
  resetVariableApiCaches();
  resetVariableByIdRegistry();
  resetThemeVariablesCache();
  await initVariableByIdRegistry();

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
    const wrapper = await buildDocumentationAtomically({
      selectedNode: root,
      settings,
      build: async () => legacyBuildSpecification(settings, root),
    });

    try {
      figma.currentPage.selection = [wrapper];
      figma.viewport.scrollAndZoomIntoView([wrapper]);
    } catch (viewportError) {
      console.warn('[Spec] selection/viewport failed', viewportError);
    }

    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.FIGMA_SPEC_DEBUG === '1'
    ) {
      debugLog('[StyleResolver] Tokens resolved', resolver.getDebugSummary());
    }

    postToUi({
      type: 'SPECIFICATION_BUILT',
      payload: { name: wrapper.name },
    });
  } catch (error) {
    const errMsg = getErrorMessage(error);
    console.error('[Spec] buildSpecification failed:', errMsg, error);
    postToUi({
      type: 'ERROR',
      payload: { message: `Не удалось собрать спецификацию: ${errMsg}` },
    });
  } finally {
    setSpecBuildStyleContext(undefined);
  }
}
