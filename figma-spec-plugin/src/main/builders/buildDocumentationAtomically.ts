/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { getSpecBuildStyleContext, setSpecBuildStyleContext } from '../tokens/specStyleContext';

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

export function positionFinalFrameNearSelection(params: {
  frame: FrameNode;
  selectedNode: SceneNode;
}): void {
  const box = params.selectedNode.absoluteBoundingBox;
  if (box) {
    params.frame.x = Math.round(box.x + box.width + 120);
    params.frame.y = Math.round(box.y);
    return;
  }

  params.frame.x = Math.round((params.selectedNode.x ?? 0) + (params.selectedNode.width ?? 0) + 120);
  params.frame.y = Math.round(params.selectedNode.y ?? 0);
}

export async function buildDocumentationAtomically(params: {
  selectedNode: SceneNode;
  settings: PluginSettings;
  build: (params: {
    selectedNode: SceneNode;
    stagingPage: PageNode;
    originalPage: PageNode;
    settings: PluginSettings;
  }) => Promise<FrameNode>;
}): Promise<FrameNode> {
  const originalPage = figma.currentPage;
  const originalTopLevelIds = snapshotTopLevelNodeIds(originalPage);
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
    originalPage.appendChild(finalFrame);

    positionFinalFrameNearSelection({
      frame: finalFrame,
      selectedNode: params.selectedNode,
    });

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
