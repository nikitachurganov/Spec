/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { debugLog } from '../debug';
import { buildSpecification as legacyBuildSpecification } from '../legacy/legacyCore.js';
import { applyContainerPreviewCardTokens } from './buildContainerPreviewCard';
import * as specApply from '../tokens/applyTokens';
import { createSpacingTokenResolver } from '../tokens/spacingTokenResolver';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { clearLocalStylesCache } from '../figma/localStyles';
import { initVariableByIdRegistry, resetVariableByIdRegistry } from '../figma/variables';
import { createStyleResolver } from '../tokens/styleResolver';
import { setSpecBuildStyleContext } from '../tokens/specStyleContext';
import { postToUi } from '../postToUi';

const STAGING_PAGE_NAME = '__spec_plugin_staging__';

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

async function switchPageSafe(target: PageNode): Promise<void> {
  if (figma.currentPage === target) return;
  if (typeof figma.setCurrentPageAsync === 'function') {
    await figma.setCurrentPageAsync(target);
    return;
  }
  // Older API fallback (manifest enforces dynamic-page so this is unlikely).
  (figma as { currentPage: PageNode }).currentPage = target;
}

async function removeStagingPageSafe(stagingPage: PageNode | null): Promise<void> {
  if (!stagingPage || stagingPage.removed) return;
  try {
    stagingPage.remove();
  } catch (error) {
    console.warn('[Spec] Failed to remove staging page:', error);
  }
}

function positionWrapperNextToRoot(wrapper: FrameNode, root: SceneNode): void {
  const box = root.absoluteBoundingBox;
  if (box) {
    wrapper.x = Math.round(box.x + box.width + 120);
    wrapper.y = Math.round(box.y);
    return;
  }
  wrapper.x = Math.round((root.x ?? 0) + (root.width ?? 0) + 120);
  wrapper.y = Math.round(root.y ?? 0);
}

/**
 * Atomic generation: the documentation is constructed on a hidden staging page
 * and only the finished `DS specification / …` wrapper is moved to the user
 * page. Intermediate frames never appear in the visible Layers panel.
 *
 * If a staging page cannot be created (e.g. Starter file 3-page limit) the
 * orchestrator falls back to direct generation on the current page and logs a
 * warning. The overall behavior — single final wrapper, positioning, selection,
 * zoom — stays the same in both modes.
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
  resetVariableByIdRegistry();
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

  const originalPage = figma.currentPage;
  let stagingPage: PageNode | null = null;

  try {
    try {
      stagingPage = figma.createPage();
      stagingPage.name = STAGING_PAGE_NAME;
    } catch (createPageError) {
      console.warn(
        '[Spec] Cannot create staging page — falling back to direct generation. ' +
          'Intermediate nodes may briefly appear on canvas.',
        createPageError
      );
      stagingPage = null;
    }

    if (stagingPage) {
      await switchPageSafe(stagingPage);
    }

    const wrapper = await legacyBuildSpecification(settings, root);

    if (stagingPage) {
      originalPage.appendChild(wrapper);
    }

    positionWrapperNextToRoot(wrapper, root);

    if (stagingPage) {
      await switchPageSafe(originalPage);
      await removeStagingPageSafe(stagingPage);
      stagingPage = null;
    }

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
    await removeStagingPageSafe(stagingPage);
    try {
      if (figma.currentPage !== originalPage) {
        await switchPageSafe(originalPage);
      }
    } catch (restoreError) {
      console.warn('[Spec] Failed to restore original page', restoreError);
    }

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
