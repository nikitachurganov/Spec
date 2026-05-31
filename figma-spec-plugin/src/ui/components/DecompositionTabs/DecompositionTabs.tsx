import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import styles from './DecompositionTabs.module.css';

export type DecompositionTabId = 'anatomy' | 'spec';

type DecompositionTabConfig = {
  id: DecompositionTabId;
  label: string;
};

const DECOMPOSITION_TABS: DecompositionTabConfig[] = [
  { id: 'anatomy', label: 'Анатомия' },
  { id: 'spec', label: 'Spec' },
];

type IndicatorStyle = {
  width: number;
  x: number;
};

export type DecompositionTabsProps = {
  activeTab: DecompositionTabId;
  onTabChange: (tab: DecompositionTabId) => void;
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function DecompositionTabs({ activeTab, onTabChange }: DecompositionTabsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<DecompositionTabId, HTMLButtonElement | null>>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({ width: 0, x: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const activeButton = tabRefs.current[activeTab];
    if (!container || !activeButton) {
      setIndicatorStyle({ width: 0, x: 0 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeButton.getBoundingClientRect();
    setIndicatorStyle({
      width: activeRect.width,
      x: activeRect.left - containerRect.left,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={styles.tabsContainer}
      role="tablist"
      aria-label="Decomposition tabs"
    >
      {DECOMPOSITION_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={joinClassNames(styles.tabButton, isActive && styles.tabButtonActive)}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.tabLabelReserve} aria-hidden="true">
              {tab.label}
            </span>
            <span className={styles.tabLabelVisible}>{tab.label}</span>
          </button>
        );
      })}
      <div
        className={styles.activeIndicator}
        aria-hidden="true"
        style={{
          width: indicatorStyle.width,
          transform: `translateX(${indicatorStyle.x}px)`,
          opacity: indicatorStyle.width > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
