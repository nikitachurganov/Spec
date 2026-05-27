/// <reference types="@figma/plugin-typings" />

/** @deprecated use AnatomyBounds */
export type AnatomyRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Rect = AnatomyRect;

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
  sourceNodeId: string;
  sourceNodeName: string;
  selectedPath?: string;
  isManualSelection?: boolean;
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
  /** Semantic action role: 'Delete', 'Edit', 'Add', 'Close', 'Search', 'More'. */
  actionName?: string;
  /** True if the node is a destructive/danger/delete case. */
  isDestructive?: boolean;
  parentContextName?: string;
  level: AnatomyLevel;
  slotPosition?: SlotPosition;

  bounds: AnatomyBounds;
  uniquenessKey: string;
};

export type AnatomyItem = AnatomyCandidate & {
  markerIndex: number;
  finalLabel: string;
  targetBounds?: Rect;
  /** Hierarchical anatomy index shown on markers, e.g. "1", "1.1", "2.2". */
  anatomyIndex?: string;
  representedCount: number;
  representedNodeIds: string[];
  /** @deprecated use markerIndex */
  index?: number;
  /** @deprecated use nodeId */
  id?: string;
  sourceNodeId?: string;
  selectedPath?: string;
  isManualSelection?: boolean;
  /** @deprecated use finalLabel */
  name?: string;
  type?: SceneNode['type'];
};

export type AnatomyConnectorSegment = {
  orientation: 'horizontal' | 'vertical' | 'diagonal';
  x: number;
  y: number;
  length: number;
  nameSuffix: string;
  toX?: number;
  toY?: number;
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

export type PointerSide = AnatomyPointerSide;

export type AnatomyPointerTarget = {
  itemId: string;
  markerIndex: number;
  label: string;
  targetBounds: Rect;
  targetCenter: Point;
};

export type StraightConnectorLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ConnectorObstacle = {
  id: string;
  kind: 'accent' | 'target' | 'marker';
  bounds: Rect;
  relatedItemId?: string;
};

export type PointerCandidate = {
  itemId: string;
  markerIndex: number;
  side: PointerSide;
  markerCenter: Point;
  markerBounds: Rect;
  targetPoint: Point;
  line: StraightConnectorLine;
  score: number;
};

export type FinalPointerPlacement = {
  itemId: string;
  markerIndex: number;
  side: PointerSide;
  markerCenter: Point;
  markerBounds: Rect;
  targetPoint: Point;
  line: StraightConnectorLine;
};

export type {
  AnatomyPointerLayoutInput,
  AnatomyPointerLayoutResult,
  AnatomyPointerRoute,
  AnatomyPointerAnchorType,
  AnatomyPointerRow,
  AnatomyRouteEntryMode,
  LayoutAnatomyPointersRightSideParams,
  Bounds,
} from './anatomyPointerLayout';

export type {
  AnatomyLayoutItem,
  AnatomyLabelLayout,
  AnatomyRoute,
  AnatomyLayoutResult,
  AnatomyRouteType,
  AnatomyAnchorType,
  AnatomyNodeLevel,
  AnatomyGroupDirection,
} from './anatomyLayoutTypes';

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
  selectedLayerPaths?: string[];
};
