/// <reference types="@figma/plugin-typings" />

import type {
  AnatomyPreviewHotspot,
  AnatomyPreviewPayload,
  PreviewCoordinateSpace,
} from '../../shared/anatomyPreview';
import type { DecompositionTree } from '../decomposition/decompositionTypes';
import { getNodeVisualBounds } from '../figma/visualBounds';
import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';

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

function getCoordinateSpace(rootNode: SceneNode): PreviewCoordinateSpace {
  const rootBox = rootNode.absoluteBoundingBox;
  if (
    rootBox &&
    Number.isFinite(rootBox.x) &&
    Number.isFinite(rootBox.y) &&
    Number.isFinite(rootBox.width) &&
    Number.isFinite(rootBox.height) &&
    rootBox.width > 0 &&
    rootBox.height > 0
  ) {
    return {
      originX: rootBox.x,
      originY: rootBox.y,
      width: rootBox.width,
      height: rootBox.height,
      source: 'absoluteBoundingBox',
    };
  }

  const visual = getNodeVisualBounds(rootNode, {
    includeInvisible: false,
    includeAbsoluteChildren: true,
  });
  return {
    originX: visual.x,
    originY: visual.y,
    width: Math.max(1, visual.width),
    height: Math.max(1, visual.height),
    source: 'visualBounds',
  };
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
  rootNode: SceneNode;
  coordinateSpace: PreviewCoordinateSpace;
  decomposition: DecompositionTree;
}): AnatomyPreviewHotspot[] {
  const { rootNode, coordinateSpace, decomposition } = params;
  const rootBounds: Rect = {
    x: coordinateSpace.originX,
    y: coordinateSpace.originY,
    width: coordinateSpace.width,
    height: coordinateSpace.height,
  };
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
    const relativeBox = getNodeBoundsRelativeToRoot(node, rootNode);
    if (
      !Number.isFinite(relativeBox.x) ||
      !Number.isFinite(relativeBox.y) ||
      !Number.isFinite(relativeBox.width) ||
      !Number.isFinite(relativeBox.height)
    ) {
      continue;
    }
    const nodeBox = {
      x: rootBounds.x + relativeBox.x,
      y: rootBounds.y + relativeBox.y,
      width: Math.max(1, relativeBox.width),
      height: Math.max(1, relativeBox.height),
    };

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
  const coordinateSpace = getCoordinateSpace(params.rootNode);
  const exportBytes = await params.rootNode.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 1 },
  });
  const imageDataUrl = createPngDataUrl(exportBytes);

  return {
    imageDataUrl,
    imageWidth: coordinateSpace.width,
    imageHeight: coordinateSpace.height,
    coordinateSpace,
    hotspots: createHotspots({
      rootNode: params.rootNode,
      coordinateSpace,
      decomposition: params.decomposition,
    }),
  };
}
