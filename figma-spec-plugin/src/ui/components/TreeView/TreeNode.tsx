import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { TreeNodeData } from './treeTypes';
import styles from './TreeView.module.css';

export type TreeNodeProps = {
  node: TreeNodeData;
  level: number;
  /** Whether this node is the last child of its parent. */
  isLastChild: boolean;

  checkable: boolean;
  selectable: boolean;

  expandedKeys: Set<string>;
  checkedKeys: Set<string>;
  halfCheckedKeys: Set<string>;
  selectedKeys: Set<string>;

  renderTitle?: (node: TreeNodeData) => ReactNode;
  onSwitch: (key: string) => void;
  onCheck: (node: TreeNodeData, checked: boolean) => void;
  onSelect: (node: TreeNodeData) => void;
};

function classNames(...names: Array<string | false | undefined | null>): string {
  return names.filter(Boolean).join(' ');
}

/**
 * Switcher (chevron) center X from the row's left edge, in pixels.
 *
 * Row layout (flex, gap=4px, row padding-left=8px, indent always rendered):
 *   level=L: [pad=8][indent=L*24][gap=4][switcher=24] → center = 8 + L*24 + 4 + 12 = L*24 + 24
 *
 * Uniform per-level step of 24px keeps tree connectors aligned.
 */
function switcherCenterX(level: number): number {
  return level * 24 + 24;
}

/**
 * Width of the horizontal connector from a parent's switcher center
 * to the LEFT edge of the child's switcher button.
 *
 * Parent at level L: switcher center = L*24 + 24
 * Child at level L+1: switcher left = 8 + (L+1)*24 + 4 = L*24 + 36
 * Width = (L*24 + 36) - (L*24 + 24) = 12px (constant for any level).
 *
 * The connector terminates BEFORE the child's chevron, so the chevron
 * is never overlapped by the tree connector line.
 */
const CHILD_CONNECTOR_WIDTH = 12;

function NavDropDownIcon() {
  return (
    <svg
      className={styles.switcherIcon}
      data-icon="nav-drop-down"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M4 6L8 10L12 6" />
    </svg>
  );
}

function NavDropUpIcon() {
  return (
    <svg
      className={styles.switcherIcon}
      data-icon="nav-drop-up"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M4 10L8 6L12 10" />
    </svg>
  );
}

/**
 * Master / component icon: solid filled diamond (Figma component style).
 * Uses the metaTag color via currentColor.
 */
function MasterIcon() {
  return (
    <svg
      className={styles.metaTagIcon}
      data-icon="master"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M8 1.5L14.5 8L8 14.5L1.5 8Z" />
    </svg>
  );
}

/**
 * Child / instance icon: outlined diamond (Figma instance style).
 */
function ChildIcon() {
  return (
    <svg
      className={styles.metaTagIcon}
      data-icon="child"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M8 2.5L13.5 8L8 13.5L2.5 8Z" />
    </svg>
  );
}

type TreeCheckboxProps = {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
};

function TreeCheckbox({
  checked,
  indeterminate,
  disabled,
  ariaLabel,
  onChange,
}: TreeCheckboxProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.checkbox}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function TreeNode({
  node,
  level,
  isLastChild,
  checkable,
  selectable,
  expandedKeys,
  checkedKeys,
  halfCheckedKeys,
  selectedKeys,
  renderTitle,
  onSwitch,
  onCheck,
  onSelect,
}: TreeNodeProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  const expanded = expandedKeys.has(node.key);
  const checked = checkedKeys.has(node.key);
  const halfChecked = halfCheckedKeys.has(node.key);
  const selected = selectedKeys.has(node.key);
  const isExpanded = hasChildren && expanded;

  const showCheckbox = checkable && node.checkable !== false;
  const isComponentNode = node.type === 'master' || node.type === 'child';

  const ownX = switcherCenterX(level);
  const connW = CHILD_CONNECTOR_WIDTH;

  function handleRowClick(): void {
    if (!selectable || node.disabled) return;
    onSelect(node);
  }

  function handleSwitcherClick(event: React.MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    onSwitch(node.key);
  }

  return (
    <li
      className={classNames(
        styles.treeItem,
        isExpanded ? styles.treeItemExpanded : null
      )}
      role="treeitem"
      aria-level={level + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selectable ? selected : undefined}
      aria-disabled={node.disabled || undefined}
    >
      <div
        className={classNames(
          styles.treeRow,
          !hasChildren ? styles.treeRowNoSwitcher : null,
          selectable && selected ? styles.treeRowSelected : null,
          node.disabled ? styles.treeRowDisabled : null
        )}
        onClick={handleRowClick}
      >
        <span
          className={styles.indent}
          style={{ width: level * 24 }}
          aria-hidden="true"
        />

        {hasChildren ? (
          <button
            type="button"
            className={styles.switcher}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={handleSwitcherClick}
          >
            {expanded ? <NavDropUpIcon /> : <NavDropDownIcon />}
          </button>
        ) : null}

        {showCheckbox ? (
          <span className={styles.checkboxWrap}>
            <TreeCheckbox
              checked={checked}
              indeterminate={halfChecked}
              disabled={Boolean(node.disabled)}
              ariaLabel={node.title}
              onChange={(nextChecked) => onCheck(node, nextChecked)}
            />
          </span>
        ) : null}

        <span className={styles.title} title={node.title}>
          {renderTitle ? renderTitle(node) : node.title}
        </span>

        {isComponentNode ? (
          <span
            className={styles.metaTag}
            data-kind={node.type}
            aria-label={node.type === 'master' ? 'Master component' : 'Child component'}
            onClick={(event) => event.stopPropagation()}
          >
            {node.type === 'master' ? <MasterIcon /> : <ChildIcon />}
          </span>
        ) : null}
      </div>

      {isExpanded ? (
        <ul
          className={styles.children}
          role="group"
          style={
            {
              /**
               * --conn-x: parent (this node) checkbox center X.
               * Inherited by child items for vertical and horizontal connectors.
               *
               * --conn-w: width of the horizontal L-connector arm.
               * Constant per nesting level (18px for level-0 parent, 14px otherwise).
               */
              '--conn-x': `${ownX}px`,
              '--conn-w': `${connW}px`,
            } as CSSProperties
          }
        >
          {children.map((child, idx) => (
            <TreeNode
              key={child.key}
              node={child}
              level={level + 1}
              isLastChild={idx === children.length - 1}
              checkable={checkable}
              selectable={selectable}
              expandedKeys={expandedKeys}
              checkedKeys={checkedKeys}
              halfCheckedKeys={halfCheckedKeys}
              selectedKeys={selectedKeys}
              renderTitle={renderTitle}
              onSwitch={onSwitch}
              onCheck={onCheck}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
