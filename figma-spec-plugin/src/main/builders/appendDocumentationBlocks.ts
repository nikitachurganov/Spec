/// <reference types="@figma/plugin-typings" />

import { DOCUMENTATION_BLOCK_ORDER, type DocumentationBlockId } from '../../shared/documentationBlockOrder';
import type { PluginSettings } from '../../shared/settings';
import { buildAccessibilitySection } from './accessibility/buildAccessibilitySection';
import { buildComponentsAndPropertiesSection } from './buildComponentsAndPropertiesSection';
import { buildThemesSection } from './buildThemesSection';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';

export type NormalizedSectionSettings = PluginSettings & {
  containers?: boolean;
  anatomy?: boolean;
};

export type AppendDocumentationBlocksDeps = {
  stretchInParent: (node: SceneNode) => void;
  buildAnatomyBlock: () => Promise<FrameNode | null>;
  buildSpecBlock: () => Promise<FrameNode | null>;
};

export type AppendDocumentationBlocksParams = {
  specificationFrame: FrameNode;
  sections: NormalizedSectionSettings;
  root: SceneNode;
  deps: AppendDocumentationBlocksDeps;
};

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

  switch (blockId) {
    case 'componentsProperties': {
      if (!styleCtx?.resolver) {
        console.warn('[Components & properties] Section skipped: no style context');
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
        }
      } catch (error) {
        console.warn('[Components & properties] Section generation failed:', error);
      }
      return;
    }

    case 'anatomy': {
      const section = await params.deps.buildAnatomyBlock();
      if (section) {
        specificationFrame.appendChild(section);
        deps.stretchInParent(section);
      }
      return;
    }

    case 'behavior':
    case 'useCase':
      return;

    case 'spec': {
      const section = await params.deps.buildSpecBlock();
      if (section) {
        specificationFrame.appendChild(section);
        deps.stretchInParent(section);
      }
      return;
    }

    case 'accessibility': {
      if (!styleCtx?.resolver) {
        console.warn('[Accessibility] Section skipped: no style context');
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
      return;
    }

    case 'themes': {
      if (!styleCtx?.resolver) {
        console.warn('[Themes] Section skipped: no style context');
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
      } catch (error) {
        console.warn('[Themes] Section generation failed:', error);
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
