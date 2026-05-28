import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AnatomyPreviewHotspot, AnatomyPreviewPayload } from '@shared/anatomyPreview';
import styles from './AnatomyPreviewSelector.module.css';

const DEBUG_PREVIEW_COORDS = false;
const DOUBLE_CLICK_DELAY_MS = 220;

export type AnatomyPreviewSelectorProps = {
  payload: AnatomyPreviewPayload | null;
  selectedPaths: string[];
  onSelectedPathsChange: (paths: string[]) => void;
  purpose?: 'anatomy' | 'spec';
  title?: string;
  showTitle?: boolean;
  selectedCountLabel?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
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
type AnatomySelectionMode = 'normal' | 'deep';
type PreviewPointerPoint = {
  clientX: number;
  clientY: number;
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

function kindPriority(kind: AnatomyPreviewHotspot['kind'], purpose: 'anatomy' | 'spec'): number {
  if (purpose === 'spec') {
    if (kind === 'container') return 0;
    if (kind === 'component' || kind === 'instance') return 1;
    if (kind === 'root') return 99;
    return 50;
  }
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

function sortCandidates(
  candidates: AnatomyPreviewHotspot[],
  selectedSet: Set<string>,
  purpose: 'anatomy' | 'spec'
): AnatomyPreviewHotspot[] {
  return [...candidates].sort((a, b) => {
    const selectedWeight = Number(selectedSet.has(b.path)) - Number(selectedSet.has(a.path));
    if (selectedWeight !== 0) return selectedWeight;
    const areaDiff = area(a) - area(b);
    if (areaDiff !== 0) return areaDiff;
    const depthDiff = b.depth - a.depth;
    if (depthDiff !== 0) return depthDiff;
    const kindDiff = kindPriority(a.kind, purpose) - kindPriority(b.kind, purpose);
    if (kindDiff !== 0) return kindDiff;
    return a.path.localeCompare(b.path);
  });
}

function anatomyNormalPriority(kind: AnatomyPreviewHotspot['kind'], isRoot: boolean): number {
  if (isRoot) return 99;
  if (kind === 'container') return 0;
  if (kind === 'component' || kind === 'instance') return 1;
  if (kind === 'action') return 2;
  if (kind === 'text') return 3;
  if (kind === 'icon' || kind === 'badge' || kind === 'divider') return 4;
  return 10;
}

function anatomyDeepPriority(kind: AnatomyPreviewHotspot['kind'], isRoot: boolean): number {
  if (isRoot) return 99;
  if (kind === 'text') return 0;
  if (kind === 'action') return 1;
  if (kind === 'icon' || kind === 'badge' || kind === 'divider') return 2;
  if (kind === 'container') return 3;
  if (kind === 'component' || kind === 'instance') return 4;
  return 10;
}

function sortCandidatesForNormalClick(
  candidates: AnatomyPreviewHotspot[],
  selectedSet: Set<string>
): AnatomyPreviewHotspot[] {
  return [...candidates].sort((a, b) => {
    const selectedWeight = Number(selectedSet.has(b.path)) - Number(selectedSet.has(a.path));
    if (selectedWeight !== 0) return selectedWeight;
    const depthDiff = a.depth - b.depth;
    if (depthDiff !== 0) return depthDiff;
    const areaDiff = area(b) - area(a);
    if (areaDiff !== 0) return areaDiff;
    const kindDiff =
      anatomyNormalPriority(a.kind, a.isRoot) - anatomyNormalPriority(b.kind, b.isRoot);
    if (kindDiff !== 0) return kindDiff;
    return a.path.localeCompare(b.path);
  });
}

function sortCandidatesForDeepClick(
  candidates: AnatomyPreviewHotspot[],
  _selectedSet: Set<string>
): AnatomyPreviewHotspot[] {
  return [...candidates].sort((a, b) => {
    const rootDiff = Number(a.isRoot) - Number(b.isRoot);
    if (rootDiff !== 0) return rootDiff;
    const depthDiff = b.depth - a.depth;
    if (depthDiff !== 0) return depthDiff;
    const areaDiff = area(a) - area(b);
    if (areaDiff !== 0) return areaDiff;
    const kindDiff = anatomyDeepPriority(a.kind, a.isRoot) - anatomyDeepPriority(b.kind, b.isRoot);
    if (kindDiff !== 0) return kindDiff;
    return a.path.localeCompare(b.path);
  });
}

function chooseNextCandidate(
  candidates: AnatomyPreviewHotspot[],
  selectedSet: Set<string>
): AnatomyPreviewHotspot {
  const selectedIndex = candidates.findIndex((candidate) => selectedSet.has(candidate.path));
  if (selectedIndex >= 0) {
    return candidates[(selectedIndex + 1) % candidates.length];
  }
  return candidates[0];
}

export function AnatomyPreviewSelector({
  payload,
  selectedPaths,
  onSelectedPathsChange,
  purpose = 'anatomy',
  title = 'Превью',
  showTitle = true,
  selectedCountLabel,
  emptyStateTitle = 'Превью недоступно',
  emptyStateDescription = 'Используйте дерево для выбора элементов.',
}: AnatomyPreviewSelectorProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transformLayerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hotspotLayerRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const singleClickTimeoutRef = useRef<number | null>(null);
  const lastPointerRef = useRef<PreviewPointerPoint | null>(null);
  const pointerInsidePreviewRef = useRef(false);
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
  const [isModifierPressed, setIsModifierPressed] = useState(false);
  const previewPayload = payload;
  const hasPreview = Boolean(previewPayload?.imageDataUrl);

  const selectableHotspots = useMemo(
    () => (payload?.hotspots || []).filter((spot) => spot.selectable),
    [payload]
  );
  const isSpecFocusMode = purpose === 'spec' && selectedPaths.length > 0;
  const selectedSpecHotspots = useMemo(
    () => (payload?.hotspots || []).filter((spot) => selectedSet.has(spot.path)),
    [payload, selectedSet]
  );

  useEffect(() => {
    setHoveredPath(null);
  }, [payload?.imageDataUrl]);

  useEffect(() => {
    if (spacePressed || isPanning) {
      setHoveredPath(null);
    }
  }, [spacePressed, isPanning]);

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
    if (!DEBUG_PREVIEW_COORDS) return;
    if (!previewPayload?.imageDataUrl) return;
    const viewport = viewportRef.current;
    const transformLayer = transformLayerRef.current;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const hotspotLayer = hotspotLayerRef.current;
    if (!viewport || !transformLayer || !canvas || !image || !hotspotLayer) return;
    const viewportRect = viewport.getBoundingClientRect();
    const transformRect = transformLayer.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const hotspotLayerRect = hotspotLayer.getBoundingClientRect();
    console.table({
      imageWidth: previewPayload.imageWidth,
      imageHeight: previewPayload.imageHeight,
      coordinateOriginX: previewPayload.coordinateSpace?.originX,
      coordinateOriginY: previewPayload.coordinateSpace?.originY,
      viewportLeft: viewportRect.left,
      viewportTop: viewportRect.top,
      transformLeft: transformRect.left,
      transformTop: transformRect.top,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
      imageLeft: imageRect.left,
      imageTop: imageRect.top,
      hotspotLayerLeft: hotspotLayerRect.left,
      hotspotLayerTop: hotspotLayerRect.top,
      scale,
      panX: pan.x,
      panY: pan.y,
    });
    const firstSelected = selectableHotspots.find((spot) => selectedSet.has(spot.path));
    if (firstSelected) {
      console.log('[Preview coords] selected hotspot', {
        path: firstSelected.path,
        bounds: firstSelected.bounds,
        expectedScreenX: viewportRect.left + pan.x + firstSelected.bounds.x * scale,
        expectedScreenY: viewportRect.top + pan.y + firstSelected.bounds.y * scale,
      });
    }
  }, [pan.x, pan.y, previewPayload, scale, selectableHotspots, selectedSet]);

  useEffect(() => {
    return () => {
      if (singleClickTimeoutRef.current != null) {
        window.clearTimeout(singleClickTimeoutRef.current);
        singleClickTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const isModifierEvent = (event: KeyboardEvent): boolean =>
      event.ctrlKey || event.metaKey || event.key === 'Control' || event.key === 'Meta';

    const recomputeModifierHover = () => {
      if (purpose !== 'anatomy') return;
      if (!pointerInsidePreviewRef.current) return;
      if (spacePressed || isPanning) return;
      const pointer = lastPointerRef.current;
      if (!pointer) return;
      const mode: AnatomySelectionMode = isModifierPressed ? 'deep' : 'normal';
      const hoverCandidate = resolveHitCandidateForPreview(pointer.clientX, pointer.clientY, mode);
      setHoveredPath(hoverCandidate?.path ?? null);
    };

    function onKeyDown(event: KeyboardEvent) {
      if (isModifierEvent(event)) {
        setIsModifierPressed(event.ctrlKey || event.metaKey || event.key === 'Control' || event.key === 'Meta');
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (isModifierEvent(event)) {
        setIsModifierPressed(event.ctrlKey || event.metaKey);
      }
    }
    function onBlur() {
      setIsModifierPressed(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    recomputeModifierHover();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isModifierPressed, isPanning, purpose, spacePressed]);

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

  function fitToViewport() {
    if (!previewPayload || !previewPayload.imageDataUrl) return;
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
  }, [
    fitMode,
    viewportWidth,
    viewportHeight,
    previewPayload?.imageWidth,
    previewPayload?.imageHeight,
    previewPayload?.imageDataUrl,
  ]);

  const effectiveScale = scale;

  function toggleSelection(path: string): void {
    onSelectedPathsChange(togglePath(selectedPaths, path));
  }

  function clearPendingSingleClick(): void {
    if (singleClickTimeoutRef.current != null) {
      window.clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = null;
    }
  }

  function getHotspotCandidatesAtPoint(clientX: number, clientY: number): AnatomyPreviewHotspot[] {
    const viewport = viewportRef.current;
    if (!viewport) return [];
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const x = (clientX - rect.left - pan.x) / effectiveScale;
    const y = (clientY - rect.top - pan.y) / effectiveScale;
    return selectableHotspots.filter((spot) => {
      if (spot.bounds.width <= 0 || spot.bounds.height <= 0) return false;
      return containsPoint(spot, x, y);
    });
  }

  function resolveHitCandidateForPreview(
    clientX: number,
    clientY: number,
    mode: AnatomySelectionMode
  ): AnatomyPreviewHotspot | null {
    const candidates = getHotspotCandidatesAtPoint(clientX, clientY);
    if (!candidates.length) return null;
    if (purpose !== 'anatomy') {
      return sortCandidates(candidates, selectedSet, purpose)[0] ?? null;
    }
    if (mode === 'deep') {
      return sortCandidatesForDeepClick(candidates, selectedSet)[0] ?? null;
    }
    return sortCandidatesForNormalClick(candidates, selectedSet)[0] ?? null;
  }

  function applySelectionFromPointer(
    clientX: number,
    clientY: number,
    mode: AnatomySelectionMode,
    shouldCycleDeep = false
  ): void {
    const candidates = getHotspotCandidatesAtPoint(clientX, clientY);
    if (!candidates.length) return;
    if (purpose !== 'anatomy') {
      const candidate = sortCandidates(candidates, selectedSet, purpose)[0];
      if (candidate) {
        toggleSelection(candidate.path);
      }
      return;
    }
    if (mode === 'deep') {
      const sorted = sortCandidatesForDeepClick(candidates, selectedSet);
      if (!sorted.length) return;
      const candidate = shouldCycleDeep ? chooseNextCandidate(sorted, selectedSet) : sorted[0];
      if (candidate) toggleSelection(candidate.path);
      return;
    }
    const candidate = sortCandidatesForNormalClick(candidates, selectedSet)[0];
    if (candidate) toggleSelection(candidate.path);
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
      setHoveredPath(null);
      setIsPanning(true);
      setFitMode(false);
      event.preventDefault();
    }
  }

  function onOverlayPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      clearPendingSingleClick();
      startInteraction(event, 'pan');
      return;
    }
    if (event.button === 0) {
      startInteraction(event, 'select');
    }
  }

  function onOverlayPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    lastPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    const start = interactionRef.current;
    if (!start) {
      if (!isPanning && !spacePressed) {
        const mode: AnatomySelectionMode =
          purpose === 'anatomy' && isModifierPressed ? 'deep' : 'normal';
        const hoverCandidate = resolveHitCandidateForPreview(event.clientX, event.clientY, mode);
        setHoveredPath(hoverCandidate?.path ?? null);
      } else {
        setHoveredPath(null);
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
      if (!start.moved && !spacePressed) {
        const mode: AnatomySelectionMode =
          purpose === 'anatomy' && isModifierPressed ? 'deep' : 'normal';
        const hoverCandidate = resolveHitCandidateForPreview(event.clientX, event.clientY, mode);
        setHoveredPath(hoverCandidate?.path ?? null);
      } else if (spacePressed) {
        setHoveredPath(null);
      }
    }
  }

  function onOverlayPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.mode === 'select' && !start.moved) {
      const isDeepModifier = event.ctrlKey || event.metaKey;
      if (purpose !== 'anatomy') {
        applySelectionFromPointer(event.clientX, event.clientY, 'normal');
      } else if (isDeepModifier) {
        clearPendingSingleClick();
        applySelectionFromPointer(event.clientX, event.clientY, 'deep', true);
      } else {
        clearPendingSingleClick();
        singleClickTimeoutRef.current = window.setTimeout(() => {
          applySelectionFromPointer(event.clientX, event.clientY, 'normal');
          singleClickTimeoutRef.current = null;
        }, DOUBLE_CLICK_DELAY_MS);
      }
    }
    interactionRef.current = null;
    setIsPanning(false);
  }

  function onOverlayDoubleClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (purpose !== 'anatomy') return;
    if (spacePressed || isPanning) return;
    clearPendingSingleClick();
    applySelectionFromPointer(event.clientX, event.clientY, 'deep');
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
        <h4 className={styles.headerTitle}>
          {selectedCountLabel || (showTitle ? title : '')}
        </h4>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlBtn}
            disabled={!hasPreview}
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
            disabled={!hasPreview}
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
            disabled={!hasPreview}
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
          onMouseEnter={() => {
            pointerInsidePreviewRef.current = true;
            setPreviewHovered(true);
          }}
          onMouseLeave={() => {
            pointerInsidePreviewRef.current = false;
            lastPointerRef.current = null;
            setHoveredPath(null);
            setPreviewHovered(false);
          }}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}
        >
          {hasPreview && previewPayload ? (
            <div
              ref={transformLayerRef}
              className={styles.transformLayer}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              }}
            >
              <div
                ref={canvasRef}
                className={styles.canvas}
                style={{
                  width: `${previewPayload.imageWidth}px`,
                  height: `${previewPayload.imageHeight}px`,
                }}
              >
                <img
                  ref={imageRef}
                  src={previewPayload.imageDataUrl}
                  alt="Anatomy preview"
                  className={styles.image}
                  draggable={false}
                  style={{
                    width: `${previewPayload.imageWidth}px`,
                    height: `${previewPayload.imageHeight}px`,
                  }}
                />
                {isSpecFocusMode ? <div className={styles.previewDimOverlay} /> : null}
                {isSpecFocusMode
                  ? selectedSpecHotspots.map((spot) => (
                      <div
                        key={`focus-${spot.path}`}
                        className={styles.specFocusHotspot}
                        style={{
                          left: `${spot.bounds.x}px`,
                          top: `${spot.bounds.y}px`,
                          width: `${spot.bounds.width}px`,
                          height: `${spot.bounds.height}px`,
                        }}
                      />
                    ))
                  : null}
                <div
                  ref={hotspotLayerRef}
                  className={styles.hotspotLayer}
                  style={{
                    width: `${previewPayload.imageWidth}px`,
                    height: `${previewPayload.imageHeight}px`,
                  }}
                >
                  {selectableHotspots.map((spot) => {
                    const left = spot.bounds.x;
                    const top = spot.bounds.y;
                    const width = spot.bounds.width;
                    const height = spot.bounds.height;
                    const selected = selectedSet.has(spot.path);
                    const hovered = hoveredPath === spot.path && !selected && !spacePressed && !isPanning;
                    return (
                      <div
                        key={spot.path}
                        className={[
                          styles.hotspot,
                      isSpecFocusMode && !selected ? styles.hotspotDimmed : '',
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
                <div
                  className={`${styles.overlay} ${isPanning ? styles.overlayPanning : ''}`}
                  onPointerMove={onOverlayPointerMove}
                  onMouseLeave={() => setHoveredPath(null)}
                  onPointerDown={onOverlayPointerDown}
                  onPointerUp={onOverlayPointerUp}
                  onDoubleClick={onOverlayDoubleClick}
                  onPointerCancel={onOverlayPointerCancel}
                  style={{
                    cursor: isPanning
                      ? 'grabbing'
                      : spacePressed
                        ? 'grab'
                        : hoveredPath
                          ? 'pointer'
                          : 'default',
                  }}
                />
                {DEBUG_PREVIEW_COORDS ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      outline: '1px solid rgba(0, 120, 255, 0.65)',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <p className={styles.placeholderTitle}>{emptyStateTitle}</p>
              <p className={styles.placeholderDescription}>{emptyStateDescription}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
