/// <reference types="@figma/plugin-typings" />

import { DOCUMENTATION_BLOCK_ORDER, type DocumentationBlockId } from '../../shared/documentationBlockOrder';
import type { PluginSettings } from '../../shared/settings';
import { buildAccessibilitySection } from './accessibility/buildAccessibilitySection';
import { buildComponentsAndPropertiesSection } from './buildComponentsAndPropertiesSection';
import { buildThemesSection } from './buildThemesSection';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import type {
  GenerationProgressStatus,
  GenerationProgressStepId,
} from '../../shared/messages';

export type NormalizedSectionSettings = PluginSettings & {
  containers?: boolean;
  anatomy?: boolean;
};

export type AppendDocumentationBlocksDeps = {
  stretchInParent: (node: SceneNode) => void;
  buildAnatomyBlock: () => Promise<FrameNode | null>;
  buildSpecBlock: () => Promise<FrameNode | null>;
  onStepUpdate?: (
    stepId: GenerationProgressStepId,
    status: GenerationProgressStatus,
    description?: string,
    error?: string
  ) => void;
};

export type AppendDocumentationBlocksParams = {
  specificationFrame: FrameNode;
  sections: NormalizedSectionSettings;
  root: SceneNode;
  deps: AppendDocumentationBlocksDeps;
};

function toProgressStepId(blockId: DocumentationBlockId): GenerationProgressStepId | null {
  switch (blockId) {
    case 'componentsProperties':
      return 'components-properties';
    case 'anatomy':
      return 'anatomy';
    case 'behavior':
      return 'behavior';
    case 'useCase':
      return 'use-case';
    case 'spec':
      return 'spec';
    case 'accessibility':
      return 'accessibility';
    case 'themes':
      return 'themes';
    default:
      return null;
  }
}

function isBlockEnabled(blockId: DocumentationBlockId, sections: NormalizedSectionSettings): boolean {
  switch (blockId) {
    case 'componentsProperties':
      return sections.componentsProperties !== false;
    case 'anatomy':
      return !!(sections.componentAnatomy || sections.anatomy);
    case 'behavior':
      return sections.behavior === true;
    case 'useCase':
      return sections.usageScenarios === true;
    case 'spec':
      return !!(sections.spec || sections.containers);
    case 'accessibility':
      return sections.accessibility === true;
    case 'themes':
      return sections.themes === true;
    default:
      return false;
  }
}

async function appendBlock(
  blockId: DocumentationBlockId,
  params: AppendDocumentationBlocksParams
): Promise<void> {
  const { specificationFrame, sections, root, deps } = params;
  const styleCtx = getSpecBuildStyleContext();
  const progressStepId = toProgressStepId(blockId);
  if (progressStepId) {
    deps.onStepUpdate?.(progressStepId, 'running');
  }

  switch (blockId) {
    case 'componentsProperties': {
      if (!styleCtx?.resolver) {
        console.warn('[Components & properties] Section skipped: no style context');
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'skipped');
        return;
      }
      try {
        const section = await buildComponentsAndPropertiesSection({
          root,
          settings: sections,
          resolver: styleCtx.resolver,
          spacingTokenResolver: styleCtx.spacingTokenResolver,
        });
        if (section) {
          specificationFrame.appendChild(section);
          deps.stretchInParent(section);
          if (progressStepId) deps.onStepUpdate?.(progressStepId, 'success');
        } else if (progressStepId) {
          deps.onStepUpdate?.(progressStepId, 'skipped');
        }
      } catch (error) {
        console.warn('[Components & properties] Section generation failed:', error);
        if (progressStepId) {
          deps.onStepUpdate?.(
            progressStepId,
            'error',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      return;
    }

    case 'anatomy': {
      const section = await params.deps.buildAnatomyBlock();
      if (section) {
        specificationFrame.appendChild(section);
        deps.stretchInParent(section);
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'success');
      } else if (progressStepId) {
        deps.onStepUpdate?.(progressStepId, 'skipped');
      }
      return;
    }

    case 'behavior':
      if (progressStepId) deps.onStepUpdate?.(progressStepId, 'skipped');
      return;
    case 'useCase':
      if (progressStepId) deps.onStepUpdate?.(progressStepId, 'skipped');
      return;

    case 'spec': {
      const section = await params.deps.buildSpecBlock();
      if (section) {
        specificationFrame.appendChild(section);
        deps.stretchInParent(section);
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'success');
      } else if (progressStepId) {
        deps.onStepUpdate?.(progressStepId, 'skipped');
      }
      return;
    }

    case 'accessibility': {
      if (!styleCtx?.resolver) {
        console.warn('[Accessibility] Section skipped: no style context');
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'skipped');
        return;
      }
      const section = await buildAccessibilitySection({
        root,
        settings: sections,
        resolver: styleCtx.resolver,
        spacingTokenResolver: styleCtx.spacingTokenResolver,
      });
      specificationFrame.appendChild(section);
      deps.stretchInParent(section);
      if (progressStepId) deps.onStepUpdate?.(progressStepId, 'success');
      return;
    }

    case 'themes': {
      if (!styleCtx?.resolver) {
        console.warn('[Themes] Section skipped: no style context');
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'skipped');
        return;
      }
      try {
        const section = await buildThemesSection({
          rootNode: root,
          settings: sections,
          resolver: styleCtx.resolver,
        });
        specificationFrame.appendChild(section);
        deps.stretchInParent(section);
        if (progressStepId) deps.onStepUpdate?.(progressStepId, 'success');
      } catch (error) {
        console.warn('[Themes] Section generation failed:', error);
        if (progressStepId) {
          deps.onStepUpdate?.(
            progressStepId,
            'error',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      return;
    }

    default:
      return;
  }
}

/** Appends enabled documentation blocks to the specification frame in canonical order. */
export async function appendDocumentationBlocksInOrder(
  params: AppendDocumentationBlocksParams
): Promise<void> {
  for (const blockId of DOCUMENTATION_BLOCK_ORDER) {
    if (!isBlockEnabled(blockId, params.sections)) continue;
    await appendBlock(blockId, params);
  }
}
