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
  const candidates = classifyAnatomyCandidates(collected, rootNode, namingContext);

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
