/// <reference types="@figma/plugin-typings" />

/** @deprecated use AnatomyBounds */
export type AnatomyRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnatomyBounds = AnatomyRect & {
  centerX: number;
  centerY: number;
};

export type AnatomyPointerSide = 'left' | 'top' | 'right' | 'bottom';

/** @deprecated use AnatomyPointerSide */
export type AnatomySide = AnatomyPointerSide;

export type AnatomyEntityKind =
  | 'container-variant'
  | 'slot'
  | 'state-indicator'
  | 'structure';

export type AnatomyFeature =
  | 'icon'
  | 'tag'
  | 'badge'
  | 'counter'
  | 'divider'
  | 'nested-menu'
  | 'chevron'
  | 'description'
  | 'shortcut'
  | 'selected-indicator'
  | 'group-label'
  | 'section-label';

export type AnatomyRole =
  | 'menu-item'
  | 'nested-menu'
  | 'icon'
  | 'badge'
  | 'tag'
  | 'counter'
  | 'chevron'
  | 'divider'
  | 'description'
  | 'shortcut'
  | 'selected-indicator'
  | 'group-label'
  | 'section-label'
  | 'text'
  | 'component-instance'
  | 'shape'
  | 'container'
  | 'element';

export type AnatomyLevel = 'root' | 'nested';

export type SlotPosition = 'leading' | 'trailing' | 'none' | 'nested';

export type AnatomyCandidate = {
  node: SceneNode;
  nodeId: string;
  nodePath: number[];
  depth: number;

  rawName: string;
  baseName: string;
  displayName: string;

  entityKind: AnatomyEntityKind;
  role: AnatomyRole;
  features: AnatomyFeature[];

  stateName?: string;
  variantName?: string;
  parentContextName?: string;
  level: AnatomyLevel;
  slotPosition?: SlotPosition;

  bounds: AnatomyBounds;
  uniquenessKey: string;
};

export type AnatomyItem = AnatomyCandidate & {
  markerIndex: number;
  finalLabel: string;
  representedCount: number;
  representedNodeIds: string[];
  /** @deprecated use markerIndex */
  index?: number;
  /** @deprecated use nodeId */
  id?: string;
  /** @deprecated use finalLabel */
  name?: string;
  type?: SceneNode['type'];
};

export type AnatomyConnectorSegment = {
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  length: number;
  nameSuffix: string;
};

export type AnatomyPointerPlacement = {
  item: AnatomyItem;
  side: AnatomyPointerSide;
  targetX: number;
  targetY: number;
  markerX: number;
  markerY: number;
  /** Used by connector builder */
  markerSize: number;
  itemBounds: AnatomyBounds;
  segments: AnatomyConnectorSegment[];
};

export type ComponentPropertyMetadata = {
  instanceProperties: ComponentProperties;
  mainComponentPropertyDefinitions: ComponentPropertyDefinitions;
  propertyNames: string[];
};

export type AnatomyGeneratorOptions = {
  maxItems?: number;
  maxDepth?: number;
  sortMode?: 'tree' | 'position';
  includeHidden?: boolean;
  includeContainer?: boolean;
  framePadding?: number;
  listGap?: number;
  listWidth?: number;
  markerSize?: number;
  markerOffset?: number;
  connectorThickness?: number;
  markerRadius?: number;
  markerColor?: RGB;
  markerTextColor?: RGB;
  connectorColor?: RGB;
  listTextColor?: RGB;
  fontRegular?: FontName;
  fontBold?: FontName;
  scale?: number;
  backgroundColor?: RGB;
  frameFillColor?: RGB;
  useComponentPropertyNames?: boolean;
  componentPropertyMetadata?: ComponentPropertyMetadata;
  anatomyRootNodeForNames?: SceneNode;
};
