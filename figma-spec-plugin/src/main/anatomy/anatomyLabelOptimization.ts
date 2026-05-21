/// <reference types="@figma/plugin-typings" />

import {
  ANATOMY_POINTER_LABEL_SHIFT_STEP,
  ANATOMY_POINTER_MAX_LABEL_Y_OFFSET,
} from './anatomyStyles';
import type {
  AnatomyLabelLayout,
  AnatomyLayoutItem,
  AnatomyRoute,
  Bounds,
} from './anatomyLayoutTypes';
import { pickRouteForItem } from './anatomyConnectorRouting';
import { resolveVerticalLabelCollisions } from './anatomyLabelPlacement';

/** Deterministic Y-offset candidates (spec order). */
export function getLabelYOffsets(
  labelShiftStep = ANATOMY_POINTER_LABEL_SHIFT_STEP,
  maxLabelYOffset = ANATOMY_POINTER_MAX_LABEL_Y_OFFSET
): number[] {
  const offsets = [0];
  for (let step = 1; step <= 6; step += 1) {
    const magnitude = step * labelShiftStep;
    if (magnitude > maxLabelYOffset) {
      break;
    }
    offsets.push(-magnitude, magnitude);
  }
  return offsets;
}

function labelBoundsOverlap(a: Bounds, b: Bounds, labelGap: number): boolean {
  const gap = Math.max(0, labelGap);
  return !(
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function hasLabelCollision(
  candidate: Bounds,
  placed: AnatomyLabelLayout[],
  labelGap: number
): boolean {
  for (const other of placed) {
    if (labelBoundsOverlap(candidate, other.labelBounds, labelGap)) {
      return true;
    }
  }
  return false;
}

function buildCandidateLabel(
  initial: AnatomyLabelLayout,
  centerY: number
): AnatomyLabelLayout {
  const labelY = centerY - initial.labelBounds.height / 2;
  return {
    ...initial,
    resolvedCenterY: centerY,
    labelBounds: {
      ...initial.labelBounds,
      y: labelY,
    },
  };
}

function resolveNonOverlappingFallback(
  initial: AnatomyLabelLayout,
  placed: AnatomyLabelLayout[],
  labelGap: number,
  labelShiftStep: number,
  maxLabelYOffset: number
): AnatomyLabelLayout {
  const offsets = getLabelYOffsets(labelShiftStep, maxLabelYOffset);
  for (const offset of offsets) {
    const candidate = buildCandidateLabel(initial, initial.preferredCenterY + offset);
    if (!hasLabelCollision(candidate.labelBounds, placed, labelGap)) {
      return candidate;
    }
  }

  const pushed = [...placed, initial];
  const resolved = resolveVerticalLabelCollisions(pushed, labelGap);
  const found = resolved.find((l) => l.itemId === initial.itemId);
  return found ?? initial;
}

type CandidateEvaluation = {
  label: AnatomyLabelLayout;
  route: AnatomyRoute;
  score: number;
  valid: boolean;
};

/**
 * Stage 5: shift label Y (within max offset) to reduce overlaps and improve routes.
 */
export function optimizeAnatomyLabelYPositions(params: {
  items: AnatomyLayoutItem[];
  initialLabels: AnatomyLabelLayout[];
  frameBounds: Bounds;
  existingRoutes?: AnatomyRoute[];
  labelGap: number;
  labelShiftStep?: number;
  maxLabelYOffset?: number;
  targetBoundsList: Array<{ id: string; bounds: Bounds }>;
}): AnatomyLabelLayout[] {
  const {
    items,
    initialLabels,
    frameBounds,
    labelGap,
    labelShiftStep = ANATOMY_POINTER_LABEL_SHIFT_STEP,
    maxLabelYOffset = ANATOMY_POINTER_MAX_LABEL_Y_OFFSET,
    targetBoundsList,
    existingRoutes = [],
  } = params;

  const initialById = new Map(initialLabels.map((l) => [l.itemId, l]));
  const placedLabels: AnatomyLabelLayout[] = [];
  const placedRoutes: AnatomyRoute[] = [...existingRoutes];
  void frameBounds;

  for (const item of items) {
    const initial = initialById.get(item.id);
    if (!initial) {
      continue;
    }

    const offsets = getLabelYOffsets(labelShiftStep, maxLabelYOffset);
    let best: CandidateEvaluation | null = null;

    for (const offset of offsets) {
      const candidateCenterY = initial.preferredCenterY + offset;
      const candidateLabel = buildCandidateLabel(initial, candidateCenterY);

      if (hasLabelCollision(candidateLabel.labelBounds, placedLabels, labelGap)) {
        continue;
      }

      const labelsForValidation = [...placedLabels, candidateLabel];
      const route = pickRouteForItem(
        item,
        candidateLabel.labelBounds,
        placedRoutes,
        labelsForValidation,
        targetBoundsList,
        initial.preferredCenterY
      );

      const valid = !route.hasIntersection;
      const score =
        route.score +
        (valid ? 0 : 10000) +
        Math.abs(offset) * 0.25;

      if (
        !best ||
        (valid && !best.valid) ||
        (valid === best.valid && score < best.score)
      ) {
        best = { label: candidateLabel, route, score, valid };
      }
    }

    let finalLabel: AnatomyLabelLayout;
    let finalRoute: AnatomyRoute;

    if (best?.valid) {
      finalLabel = best.label;
      finalRoute = best.route;
    } else if (best) {
      finalLabel = best.label;
      finalRoute = { ...best.route, hasIntersection: true };
    } else {
      finalLabel = resolveNonOverlappingFallback(
        initial,
        placedLabels,
        labelGap,
        labelShiftStep,
        maxLabelYOffset
      );
      const labelsForValidation = [...placedLabels, finalLabel];
      finalRoute = pickRouteForItem(
        item,
        finalLabel.labelBounds,
        placedRoutes,
        labelsForValidation,
        targetBoundsList,
        initial.preferredCenterY
      );
    }

    placedLabels.push(finalLabel);
    placedRoutes.push(finalRoute);
  }

  return resolveVerticalLabelCollisions(placedLabels, labelGap).map((label) => ({
    ...label,
    resolvedCenterY: label.labelBounds.y + label.labelBounds.height / 2,
  }));
}
