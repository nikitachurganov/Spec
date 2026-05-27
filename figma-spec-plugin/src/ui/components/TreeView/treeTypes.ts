import type { ReactNode } from 'react';

export type TreeNodeType = 'master' | 'child' | 'container';

export type TreeNodeData = {
  key: string;
  title: string;
  type?: TreeNodeType;
  disabled?: boolean;
  checkable?: boolean;
  children?: TreeNodeData[];
};

export type TreeCheckInfo = {
  checked: boolean;
  node: TreeNodeData;
  halfCheckedKeys: string[];
};

export type TreeSelectInfo = {
  node: TreeNodeData;
};

export type TreeViewProps = {
  data: TreeNodeData[];

  expandedKeys?: string[];
  checkedKeys?: string[];

  defaultExpandedKeys?: string[];
  defaultCheckedKeys?: string[];

  selectable?: boolean;
  checkable?: boolean;
  cascadeSelection?: boolean;

  onExpand?: (expandedKeys: string[]) => void;
  onCheck?: (checkedKeys: string[], info: TreeCheckInfo) => void;
  onSelect?: (selectedKeys: string[], info: TreeSelectInfo) => void;

  renderTitle?: (node: TreeNodeData) => ReactNode;
};
