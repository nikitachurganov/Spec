import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AnatomyPreviewHotspot, AnatomyPreviewPayload } from '@shared/anatomyPreview';
import styles from './AnatomyPreviewSelector.module.css';

export type AnatomyPreviewSelectorProps = {
  payload: AnatomyPreviewPayload | null;
  selectedPaths: string[];
  onSelectedPathsChange: (paths: string[]) => void;
};

type InteractionState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  mode: 'pan' | 'select';
  panX: number;
  panY: number;
  moved: boolean;
};

function togglePath(paths: string[], path: string): string[] {
  if (paths.includes(path)) {
    return paths.filter((value) => value !== path);
  }
  return [...paths, path];
}

function area(spot: AnatomyPreviewHotspot): number {
  return Math.max(1, spot.bounds.width * spot.bounds.height);
}

function kindPriority(kind: AnatomyPreviewHotspot['kind']): number {
  if (kind === 'text') return 0;
  if (kind === 'action') return 1;
  if (kind === 'icon') return 2;
  if (kind === 'badge') return 3;
  if (kind === 'divider') return 4;
  if (kind === 'component' || kind === 'instance') return 5;
  if (kind === 'container') return 6;
  if (kind === 'unknown') return 50;
  if (kind === 'root') return 99;
  return 50;
}

function containsPoint(spot: AnatomyPreviewHotspot, x: number, y: number): boolean {
  const x1 = spot.bounds.x;
  const y1 = spot.bounds.y;
  const x2 = x1 + spot.bounds.width;
  const y2 = y1 + spot.bounds.height;
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

function sortCandidates(candidates: AnatomyPreviewHotspot[], selectedSet: Set<string>): AnatomyPreviewHotspot[] {
  return [...candidates].sort((a, b) => {
    const selectedWeight = Number(selectedSet.has(b.path)) - Number(selectedSet.has(a.path));
    if (selectedWeight !== 0) return selectedWeight;
    const areaDiff = area(a) - area(b);
    if (areaDiff !== 0) return areaDiff;
    const depthDiff = b.depth - a.depth;
    if (depthDiff !== 0) return depthDiff;
    const kindDiff = kindPriority(a.kind) - kindPriority(b.kind);
    if (kindDiff !== 0) return kindDiff;
    return a.path.localeCompare(b.path);
  });
}

export function AnatomyPreviewSelector({
  payload,
  selectedPaths,
  onSelectedPathsChange,
}: AnatomyPreviewSelectorProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [previewHovered, setPreviewHovered] = useState(false);

  const selectableHotspots = useMemo(
    () => (payload?.hotspots || []).filter((spot) => spot.selectable),
    [payload]
  );

  useEffect(() => {
    setHoveredPath(null);
  }, [payload?.imageDataUrl]);

  useEffect(() => {
    setFitMode(true);
  }, [payload?.imageDataUrl]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function updateSize() {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;
      setViewportWidth(currentViewport.clientWidth);
      setViewportHeight(currentViewport.clientHeight);
    }
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(viewport);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (isEditableTarget(event.target)) return;
      if (previewHovered || isPanning) {
        event.preventDefault();
      }
      setSpacePressed(true);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpacePressed(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [previewHovered, isPanning]);

  if (!payload || !payload.imageDataUrl) {
    return (
      <div className={styles.root}>
        <p className={styles.fallback}>
          Preview is unavailable. Use the layer tree to select Anatomy items.
        </p>
      </div>
    );
  }
  const previewPayload = payload;

  function fitToViewport() {
    if (!viewportWidth || !viewportHeight) return;
    const sx = viewportWidth / Math.max(1, previewPayload.imageWidth);
    const sy = viewportHeight / Math.max(1, previewPayload.imageHeight);
    const nextScale = Math.max(0.1, Math.min(3, Math.min(sx, sy)));
    const width = previewPayload.imageWidth * nextScale;
    const height = previewPayload.imageHeight * nextScale;
    setScale(nextScale);
    setPan({
      x: Math.round((viewportWidth - width) / 2),
      y: Math.round((viewportHeight - height) / 2),
    });
  }

  useEffect(() => {
    if (fitMode) fitToViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitMode, viewportWidth, viewportHeight, previewPayload.imageWidth, previewPayload.imageHeight]);

  const effectiveScale = scale;

  function toggleSelection(path: string): void {
    onSelectedPathsChange(togglePath(selectedPaths, path));
  }

  function resolveHitCandidates(clientX: number, clientY: number): AnatomyPreviewHotspot[] {
    const viewport = viewportRef.current;
    if (!viewport) return [];
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const x = (clientX - rect.left - pan.x) / effectiveScale;
    const y = (clientY - rect.top - pan.y) / effectiveScale;
    const hits = selectableHotspots.filter((spot) => containsPoint(spot, x, y));
    return sortCandidates(hits, selectedSet);
  }

  function zoomAroundClient(clientX: number, clientY: number, nextScaleRaw: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextScale = Math.max(0.5, Math.min(3, nextScaleRaw));
    const currentScale = scaleRef.current;
    const currentPan = panRef.current;
    const logicalX = (clientX - rect.left - currentPan.x) / currentScale;
    const logicalY = (clientY - rect.top - currentPan.y) / currentScale;
    const nextPanX = clientX - rect.left - logicalX * nextScale;
    const nextPanY = clientY - rect.top - logicalY * nextScale;
    setScale(nextScale);
    setPan({ x: nextPanX, y: nextPanY });
    setFitMode(false);
  }

  function startInteraction(event: ReactPointerEvent<HTMLDivElement>, mode: 'pan' | 'select') {
    const overlay = event.currentTarget;
    overlay.setPointerCapture(event.pointerId);
    interactionRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      mode,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    if (mode === 'pan') {
      setIsPanning(true);
      setFitMode(false);
      event.preventDefault();
    }
  }

  function onOverlayPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      startInteraction(event, 'pan');
      return;
    }
    if (event.button === 0) {
      startInteraction(event, 'select');
    }
  }

  function onOverlayPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = interactionRef.current;
    if (!start) {
      if (!isPanning) {
        const sortedCandidates = resolveHitCandidates(event.clientX, event.clientY);
        setHoveredPath(sortedCandidates[0]?.path ?? null);
      }
      return;
    }
    if (start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    if (!start.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      start.moved = true;
    }
    if (start.mode === 'pan') {
      setPan({
        x: start.panX + dx,
        y: start.panY + dy,
      });
    } else {
      if (!start.moved) {
        const sortedCandidates = resolveHitCandidates(event.clientX, event.clientY);
        setHoveredPath(sortedCandidates[0]?.path ?? null);
      }
    }
  }

  function onOverlayPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.mode === 'select' && !start.moved) {
      const sortedCandidates = resolveHitCandidates(event.clientX, event.clientY);
      if (sortedCandidates.length > 0) {
        toggleSelection(sortedCandidates[0].path);
      }
    }
    interactionRef.current = null;
    setIsPanning(false);
  }

  function onOverlayPointerCancel(): void {
    interactionRef.current = null;
    setIsPanning(false);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        const direction = event.deltaY < 0 ? 1 : -1;
        const step = 0.25;
        const nextScale = scaleRef.current + direction * step;
        zoomAroundClient(event.clientX, event.clientY, nextScale);
        return;
      }

      setFitMode(false);
      setPan((prev) => ({
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h4 className={styles.headerTitle}>Превью</h4>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => {
              const viewport = viewportRef.current;
              if (!viewport) return;
              const rect = viewport.getBoundingClientRect();
              zoomAroundClient(rect.left + rect.width / 2, rect.top + rect.height / 2, effectiveScale - 0.25);
            }}
          >
            -
          </button>
          <span className={styles.zoomText}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => {
              const viewport = viewportRef.current;
              if (!viewport) return;
              const rect = viewport.getBoundingClientRect();
              zoomAroundClient(rect.left + rect.width / 2, rect.top + rect.height / 2, effectiveScale + 0.25);
            }}
          >
            +
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => {
              setFitMode(true);
            }}
          >
            По размеру
          </button>
        </div>
      </div>
      <div className={styles.card}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          onMouseEnter={() => setPreviewHovered(true)}
          onMouseLeave={() => setPreviewHovered(false)}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}
        >
          <div
            className={styles.canvas}
            style={{
                width: `${previewPayload.imageWidth}px`,
                height: `${previewPayload.imageHeight}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <img
                src={previewPayload.imageDataUrl}
              alt="Anatomy preview"
              className={styles.image}
              draggable={false}
                style={{
                  width: `${previewPayload.imageWidth}px`,
                  height: `${previewPayload.imageHeight}px`,
                }}
            />
            <div
              className={`${styles.overlay} ${isPanning ? styles.overlayPanning : ''}`}
              onPointerMove={onOverlayPointerMove}
              onMouseLeave={() => setHoveredPath(null)}
              onPointerDown={onOverlayPointerDown}
              onPointerUp={onOverlayPointerUp}
              onPointerCancel={onOverlayPointerCancel}
              style={{
                cursor: isPanning ? 'grabbing' : spacePressed ? 'grab' : hoveredPath ? 'pointer' : 'default',
              }}
            >
              {selectableHotspots.map((spot) => {
                const left = spot.bounds.x;
                const top = spot.bounds.y;
                const width = spot.bounds.width;
                const height = spot.bounds.height;
                const selected = selectedSet.has(spot.path);
                const hovered = hoveredPath === spot.path;
                return (
                  <div
                    key={spot.path}
                    className={[
                      styles.hotspot,
                      selected ? styles.hotspotSelected : '',
                      hovered ? styles.hotspotHover : '',
                    ].join(' ')}
                    title={spot.displayName}
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
