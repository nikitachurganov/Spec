/// <reference types="@figma/plugin-typings" />

import { collectAnatomyCandidates } from './anatomyDecomposition';
import type { AnatomyCandidate, AnatomyGeneratorOptions, AnatomyItem } from './anatomyTypes';
import type { NamingContext } from './anatomyNaming';
import {
  assignFinalLabels,
  capAnatomyItems,
  filterRedundantNestedItems,
  getAnatomyUniquenessKey,
  normalizeDefaultStates,
  reduceToUniqueAnatomyItems,
  reindexAnatomyItems,
  sortAnatomyItems,
} from './anatomyUniqueness';
import { classifyAnatomyCandidates } from './anatomyClassification';

/**
 * Specs-style anatomy pipeline:
 * collect → classify → normalize states → uniqueness → reduce → filter nested →
 * labels → sort → limit → reindex markers
 */
export function runAnatomyPipeline(
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions,
  namingContext: NamingContext
): AnatomyItem[] {
  const collected = collectAnatomyCandidates(rootNode, options, namingContext);
  return runAnatomyPipelineFromCandidates(collected, rootNode, options, namingContext);
}

export function runAnatomyPipelineFromCandidates(
  collected: AnatomyCandidate[],
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions,
  namingContext: NamingContext
): AnatomyItem[] {
  const isManualMode = collected.some((candidate) => candidate.isManualSelection === true);
  const candidates = classifyAnatomyCandidates(collected, rootNode, namingContext);

  if (isManualMode) {
    const orderByPath = new Map<string, number>();
    const selectedLayerPaths = Array.isArray(options.selectedLayerPaths) ? options.selectedLayerPaths : [];
    selectedLayerPaths.forEach((path, index) => {
      if (!orderByPath.has(path)) {
        orderByPath.set(path, index);
      }
    });

    const unique: AnatomyCandidate[] = [];
    const seenManualIds = new Set<string>();

    for (const candidate of candidates) {
      const manualId = candidate.selectedPath
        ? `manual:${candidate.selectedPath}`
        : `manual-node:${candidate.nodeId}`;
      if (seenManualIds.has(manualId)) continue;
      seenManualIds.add(manualId);
      unique.push(candidate);
    }

    unique.sort((a, b) => {
      const aOrder =
        a.selectedPath != null && orderByPath.has(a.selectedPath)
          ? (orderByPath.get(a.selectedPath) as number)
          : Number.POSITIVE_INFINITY;
      const bOrder =
        b.selectedPath != null && orderByPath.has(b.selectedPath)
          ? (orderByPath.get(b.selectedPath) as number)
          : Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.depth - b.depth || a.nodeId.localeCompare(b.nodeId);
    });

    const manualItems: AnatomyItem[] = unique.map((candidate) => ({
      ...candidate,
      markerIndex: 0,
      finalLabel: candidate.baseName,
      representedCount: 1,
      representedNodeIds: [candidate.nodeId],
      id: candidate.selectedPath ? `manual:${candidate.selectedPath}` : `manual-node:${candidate.nodeId}`,
      sourceNodeId: candidate.sourceNodeId || candidate.nodeId,
      isManualSelection: true,
    }));

    assignFinalLabels(manualItems);
    return manualItems.map((item, index) => {
      const markerIndex = index + 1;
      return {
        ...item,
        markerIndex,
        index: markerIndex,
        name: item.finalLabel,
      };
    });
  }

  normalizeDefaultStates(candidates);
  for (const c of candidates) {
    c.uniquenessKey = getAnatomyUniquenessKey(c);
  }

  let items = reduceToUniqueAnatomyItems(candidates);
  items = filterRedundantNestedItems(items);
  assignFinalLabels(items);
  items = sortAnatomyItems(items);
  items = capAnatomyItems(items, options.maxItems ?? 8);
  return reindexAnatomyItems(items);
}
