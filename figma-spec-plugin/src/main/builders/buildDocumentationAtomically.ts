/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { getSpecBuildStyleContext, setSpecBuildStyleContext } from '../tokens/specStyleContext';
import type {
  GenerationProgressStatus,
  GenerationProgressStepId,
} from '../../shared/messages';

const DOCUMENTATION_LEFT_GAP = 160;

type PlacementMode = 'replace-source-position' | 'left-of-source';

type SourcePlacementSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: (BaseNode & ChildrenMixin) | null;
  indexInParent: number | null;
  absoluteX: number;
  absoluteY: number;
};

function hasChildrenParent(node: BaseNode | null): node is BaseNode & ChildrenMixin {
  return !!node && 'children' in node && 'appendChild' in node;
}

function resolvePlacementMode(settings: PluginSettings): PlacementMode {
  const isComponentsPropertiesEnabled = Boolean(settings.componentsProperties);
  return isComponentsPropertiesEnabled ? 'replace-source-position' : 'left-of-source';
}

function captureSourcePlacementSnapshot(selectedNode: SceneNode): SourcePlacementSnapshot {
  const parent = hasChildrenParent(selectedNode.parent) ? selectedNode.parent : null;
  const indexInParent = parent ? parent.children.indexOf(selectedNode) : null;
  const absoluteBox = selectedNode.absoluteBoundingBox;

  return {
    id: selectedNode.id,
    name: selectedNode.name,
    x: selectedNode.x,
    y: selectedNode.y,
    width: selectedNode.width,
    height: selectedNode.height,
    parent,
    indexInParent: indexInParent !== null && indexInParent >= 0 ? indexInParent : null,
    absoluteX: absoluteBox ? absoluteBox.x : selectedNode.x,
    absoluteY: absoluteBox ? absoluteBox.y : selectedNode.y,
  };
}

function appendFinalFrameToSnapshotParent(params: {
  frame: FrameNode;
  snapshot: SourcePlacementSnapshot;
  fallbackPage: PageNode;
}): 'snapshot-parent' | 'fallback-page' {
  const { frame, snapshot, fallbackPage } = params;
  const parent = snapshot.parent;
  if (!parent) {
    fallbackPage.appendChild(frame);
    return 'fallback-page';
  }

  try {
    if ('insertChild' in parent && snapshot.indexInParent !== null) {
      const safeIndex = Math.min(Math.max(snapshot.indexInParent, 0), parent.children.length);
      parent.insertChild(safeIndex, frame);
      return 'snapshot-parent';
    }
    parent.appendChild(frame);
    return 'snapshot-parent';
  } catch (error) {
    console.warn(
      '[Spec] Failed to insert documentation into source parent, using current page',
      {
        sourceId: snapshot.id,
        sourceName: snapshot.name,
      },
      error
    );
    fallbackPage.appendChild(frame);
    return 'fallback-page';
  }
}

function positionFinalFrame(params: {
  frame: FrameNode;
  snapshot: SourcePlacementSnapshot;
  placementMode: PlacementMode;
  insertionTarget: 'snapshot-parent' | 'fallback-page';
}): void {
  const { frame, snapshot, placementMode, insertionTarget } = params;

  if (placementMode === 'replace-source-position') {
    if (insertionTarget === 'snapshot-parent') {
      frame.x = Math.round(snapshot.x);
      frame.y = Math.round(snapshot.y);
      return;
    }

    frame.x = Math.round(snapshot.absoluteX);
    frame.y = Math.round(snapshot.absoluteY);
    return;
  }

  if (insertionTarget === 'snapshot-parent') {
    frame.x = Math.round(snapshot.x - frame.width - DOCUMENTATION_LEFT_GAP);
    frame.y = Math.round(snapshot.y);
    return;
  }

  frame.x = Math.round(snapshot.absoluteX - frame.width - DOCUMENTATION_LEFT_GAP);
  frame.y = Math.round(snapshot.absoluteY);
}

function setActiveStagingPage(stagingPage: PageNode | undefined): void {
  const ctx = getSpecBuildStyleContext();
  if (!ctx) return;
  setSpecBuildStyleContext({ ...ctx, stagingPage });
}

function snapshotTopLevelNodeIds(page: PageNode): Set<string> {
  return new Set(page.children.map((child) => child.id));
}

function removeLeakedTopLevelNodes(page: PageNode, idsBefore: Set<string>, keepId?: string): void {
  for (const child of [...page.children]) {
    if (keepId && child.id === keepId) continue;
    if (idsBefore.has(child.id)) continue;
    try {
      child.remove();
    } catch (error) {
      console.warn('[Spec] Failed to remove leaked build node from page', child.name, error);
    }
  }
}

function ensureNodeOnStagingPage(stagingPage: PageNode, node: SceneNode): void {
  if (node.parent !== stagingPage) {
    stagingPage.appendChild(node);
  }
}

export async function buildDocumentationAtomically(params: {
  selectedNode: SceneNode;
  settings: PluginSettings;
  onStepUpdate?: (
    stepId: GenerationProgressStepId,
    status: GenerationProgressStatus,
    description?: string,
    error?: string
  ) => void;
  build: (params: {
    selectedNode: SceneNode;
    stagingPage: PageNode;
    originalPage: PageNode;
    settings: PluginSettings;
  }) => Promise<FrameNode>;
}): Promise<FrameNode> {
  const originalPage = figma.currentPage;
  const originalTopLevelIds = snapshotTopLevelNodeIds(originalPage);
  const sourcePlacementSnapshot = captureSourcePlacementSnapshot(params.selectedNode);
  const placementMode = resolvePlacementMode(params.settings);
  let stagingPage: PageNode | null = null;

  try {
    stagingPage = figma.createPage();
    stagingPage.name = '';
    setActiveStagingPage(stagingPage);

    const finalFrame = await params.build({
      selectedNode: params.selectedNode,
      stagingPage,
      originalPage,
      settings: params.settings,
    });
    finalFrame.setPluginData('isGeneratedDocumentation', 'true');
    finalFrame.setPluginData('sourceNodeId', params.selectedNode.id);

    ensureNodeOnStagingPage(stagingPage, finalFrame);
    removeLeakedTopLevelNodes(originalPage, originalTopLevelIds);
    params.onStepUpdate?.('position', 'running', 'Размещаем документацию на холсте');
    const insertionTarget = appendFinalFrameToSnapshotParent({
      frame: finalFrame,
      snapshot: sourcePlacementSnapshot,
      fallbackPage: originalPage,
    });

    positionFinalFrame({
      frame: finalFrame,
      snapshot: sourcePlacementSnapshot,
      placementMode,
      insertionTarget,
    });
    params.onStepUpdate?.('position', 'success');

    stagingPage.remove();
    stagingPage = null;

    return finalFrame;
  } catch (error) {
    removeLeakedTopLevelNodes(originalPage, originalTopLevelIds);

    if (stagingPage && !stagingPage.removed) {
      stagingPage.remove();
    }

    throw error;
  } finally {
    setActiveStagingPage(undefined);
  }
}
