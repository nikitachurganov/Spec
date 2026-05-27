/// <reference types="@figma/plugin-typings" />

import type { AnatomyPreviewHotspot, AnatomyPreviewPayload } from '../../shared/anatomyPreview';
import type { DecompositionTree } from '../decomposition/decompositionTypes';

type BuildAnatomyPreviewPayloadParams = {
  rootNode: SceneNode;
  decomposition: DecompositionTree;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function toRootBounds(rootNode: SceneNode): Rect {
  const box = rootNode.absoluteBoundingBox;
  if (
    box &&
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  ) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  const x = 'x' in rootNode && Number.isFinite(rootNode.x) ? rootNode.x : 0;
  const y = 'y' in rootNode && Number.isFinite(rootNode.y) ? rootNode.y : 0;
  const width = Math.max(1, Number.isFinite(rootNode.width) ? rootNode.width : 1);
  const height = Math.max(1, Number.isFinite(rootNode.height) ? rootNode.height : 1);
  return { x, y, width, height };
}

function intersection(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}

function asPreviewKind(kind: string): AnatomyPreviewHotspot['kind'] {
  if (
    kind === 'root' ||
    kind === 'component' ||
    kind === 'instance' ||
    kind === 'container' ||
    kind === 'text' ||
    kind === 'icon' ||
    kind === 'badge' ||
    kind === 'divider' ||
    kind === 'action'
  ) {
    return kind;
  }
  return 'unknown';
}

function isHotspotSelectable(
  node: SceneNode,
  decompositionNode: DecompositionTree['root']
): boolean {
  if (decompositionNode.isRoot) return true;
  if ('visible' in node && node.visible === false) return false;
  if (decompositionNode.isText) return true;
  if (decompositionNode.isComponentLike) return true;
  if (decompositionNode.isStandardLayoutContainer || decompositionNode.isAutoLayout) return true;
  return (
    decompositionNode.kind === 'slot' ||
    decompositionNode.kind === 'icon' ||
    decompositionNode.kind === 'badge' ||
    decompositionNode.kind === 'divider' ||
    decompositionNode.kind === 'action'
  );
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const figmaWithBase64 = figma as typeof figma & {
    base64Encode?: (value: Uint8Array) => string;
  };
  if (typeof figmaWithBase64.base64Encode === 'function') {
    return figmaWithBase64.base64Encode(bytes);
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function createPngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${uint8ArrayToBase64(bytes)}`;
}

function createHotspots(params: {
  rootBounds: Rect;
  decomposition: DecompositionTree;
}): AnatomyPreviewHotspot[] {
  const { rootBounds, decomposition } = params;
  const hotspots: AnatomyPreviewHotspot[] = [];
  const entries = Array.from(decomposition.decompositionByPath.entries()).sort((a, b) => {
    const depthA = a[1].depth;
    const depthB = b[1].depth;
    if (depthA !== depthB) return depthA - depthB;
    return a[0].localeCompare(b[0]);
  });

  for (const [path, decompositionNode] of entries) {
    const node = decomposition.nodeByPath.get(path);
    if (!node) continue;
    const nodeBox = node.absoluteBoundingBox;
    if (
      !nodeBox ||
      !Number.isFinite(nodeBox.x) ||
      !Number.isFinite(nodeBox.y) ||
      !Number.isFinite(nodeBox.width) ||
      !Number.isFinite(nodeBox.height) ||
      nodeBox.width <= 0 ||
      nodeBox.height <= 0
    ) {
      continue;
    }

    const clipped = intersection(
      rootBounds,
      {
        x: nodeBox.x,
        y: nodeBox.y,
        width: nodeBox.width,
        height: nodeBox.height,
      }
    );
    if (!clipped) continue;

    hotspots.push({
      path,
      nodeId: decompositionNode.nodeId,
      displayName: decompositionNode.displayName || decompositionNode.name || 'Layer',
      kind: asPreviewKind(decompositionNode.kind),
      bounds: {
        x: clipped.x - rootBounds.x,
        y: clipped.y - rootBounds.y,
        width: clipped.width,
        height: clipped.height,
      },
      selectable: isHotspotSelectable(node, decompositionNode),
      depth: decompositionNode.depth,
      isRoot: decompositionNode.isRoot,
      isComponentLike: decompositionNode.isComponentLike,
    });
  }

  return hotspots;
}

export async function buildAnatomyPreviewPayload(
  params: BuildAnatomyPreviewPayloadParams
): Promise<AnatomyPreviewPayload> {
  const rootBounds = toRootBounds(params.rootNode);
  const exportBytes = await params.rootNode.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 1 },
  });
  const imageDataUrl = createPngDataUrl(exportBytes);

  return {
    imageDataUrl,
    imageWidth: rootBounds.width,
    imageHeight: rootBounds.height,
    hotspots: createHotspots({
      rootBounds,
      decomposition: params.decomposition,
    }),
  };
}
