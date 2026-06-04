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
import { resetGenerationTemplateCache } from '../components/templateLookupCache';
import {
  DEBUG_GENERATION_PERFORMANCE,
  perfTimeEnd,
  perfTimeStart,
} from '../generation/generationPerformance';
import type {
  GenerationProgressStatus,
  GenerationProgressStepId,
} from '../../shared/messages';

const SUPPORTED_ROOT_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'COMPONENT',
  'INSTANCE',
  'FRAME',
  'COMPONENT_SET',
]);

type ValidatedSelection =
  | { ok: true; root: SceneNode }
  | { ok: false; message: string };

type GenerationProgressCallbacks = {
  onStepUpdate?: (
    stepId: GenerationProgressStepId,
    status: GenerationProgressStatus,
    description?: string,
    error?: string
  ) => void;
};

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
export type BuildSpecificationParams = {
  sourceNode?: SceneNode;
  progress?: GenerationProgressCallbacks;
  /** Root for Anatomy and Spec; defaults to documentation root when omitted. */
  anatomySpecRoot?: SceneNode;
};

export async function buildSpecification(
  settings: PluginSettings,
  params: BuildSpecificationParams = {}
): Promise<void> {
  const progressCallbacks = params.progress;
  let root: SceneNode;
  if (params.sourceNode) {
    root = params.sourceNode;
  } else {
    const validation = validateSelection();
    if (!validation.ok) {
      postToUi({ type: 'ERROR', payload: { message: validation.message } });
      return;
    }
    root = validation.root;
  }

  const anatomySpecRoot = params.anatomySpecRoot ?? root;

  await ensureDocumentReadyForTraversal();
  progressCallbacks?.onStepUpdate?.('prepare', 'running', 'Подготавливаем ресурсы и токены');

  resetGenerationTemplateCache();
  perfTimeStart('[generation] total');

  clearLocalStylesCache();
  resetVariableApiCaches();
  resetVariableByIdRegistry();
  resetThemeVariablesCache();

  const needsVariableRegistry = settings.spec === true || settings.themes === true;
  if (needsVariableRegistry) {
    await initVariableByIdRegistry();
  }

  const resolver = createStyleResolver({
    useLibraryTokens: settings.useLibraryTokens !== false,
  });
  await resolver.init();

  const spacingTokenResolver = settings.spec
    ? await createSpacingTokenResolver()
    : null;
  if (spacingTokenResolver) {
    await spacingTokenResolver.init();
  }

  setSpecBuildStyleContext({
    resolver,
    spacingTokenResolver: spacingTokenResolver ?? undefined,
    apply: {
      ...specApply,
      applyContainerPreviewCardTokens,
    },
  });

  try {
    progressCallbacks?.onStepUpdate?.('prepare', 'success');
    const wrapper = await buildDocumentationAtomically({
      selectedNode: root,
      settings,
      onStepUpdate: progressCallbacks?.onStepUpdate,
      build: async () =>
        legacyBuildSpecification(settings, root, progressCallbacks, anatomySpecRoot),
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
      payload: { name: wrapper.name, nodeId: wrapper.id },
    });
    perfTimeEnd('[generation] total');
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
