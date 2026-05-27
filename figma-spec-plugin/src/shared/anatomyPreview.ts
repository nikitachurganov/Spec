export type AnatomyPreviewHotspotKind =
  | 'root'
  | 'component'
  | 'instance'
  | 'container'
  | 'text'
  | 'icon'
  | 'badge'
  | 'divider'
  | 'action'
  | 'unknown';

export type AnatomyPreviewHotspot = {
  path: string;
  nodeId: string;
  displayName: string;
  kind: AnatomyPreviewHotspotKind;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectable: boolean;
  depth: number;
  isRoot: boolean;
  isComponentLike: boolean;
};

export type AnatomyPreviewPayload = {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  hotspots: AnatomyPreviewHotspot[];
};
