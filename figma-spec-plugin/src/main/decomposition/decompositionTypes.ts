/// <reference types="@figma/plugin-typings" />

export type DecompositionNodeKind =
  | 'root'
  | 'component'
  | 'instance'
  | 'container'
  | 'slot'
  | 'text'
  | 'icon'
  | 'badge'
  | 'divider'
  | 'action'
  | 'unknown';

export type DecompositionNode = {
  path: string;
  key: string;
  name: string;
  displayName: string;
  kind: DecompositionNodeKind;

  nodeId: string;
  parentPath: string | null;

  depth: number;
  isRoot: boolean;
  isComponentLike: boolean;
  isStandardLayoutContainer: boolean;
  isAutoLayout: boolean;
  isVisible: boolean;
  isText: boolean;

  hasChildren: boolean;
  children: DecompositionNode[];

  metadata: {
    componentName?: string;
    mainComponentName?: string;
    variantProperties?: Record<string, string>;
    componentProperties?: Record<string, unknown>;
    state?: string;
    action?: string;
    slot?: string;
    textPreview?: string;
  };
};

export type DecompositionTree = {
  root: DecompositionNode;
  nodeByPath: Map<string, SceneNode>;
  decompositionByPath: Map<string, DecompositionNode>;
};
