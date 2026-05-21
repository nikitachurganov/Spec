/// <reference types="@figma/plugin-typings" />

import {
  detectAnatomyEntityKind,
  detectAnatomyFeatures,
  detectAnatomyRole,
  detectSlotPosition,
  getCanonicalAnatomyBaseName,
} from './anatomyFeatures';
import {
  detectAnatomyAction,
  extractStateName,
  getBaseDisplayName,
  getDisplayAnatomyName,
  isDestructiveNode,
  normalizeName,
  type NamingContext,
} from './anatomyNaming';
import type { AnatomyCandidate, AnatomyLevel } from './anatomyTypes';
import { getAnatomyUniquenessKey } from './anatomyUniqueness';

function isNestedMenuContext(parentContextName?: string): boolean {
  if (!parentContextName) return false;
  return normalizeName(parentContextName).includes('nested menu');
}

function resolveLevel(parentContextName?: string): AnatomyLevel {
  return isNestedMenuContext(parentContextName) ? 'nested' : 'root';
}

export function classifyAnatomyCandidate(
  candidate: AnatomyCandidate,
  _rootNode: SceneNode,
  namingContext: NamingContext
): AnatomyCandidate {
  const { node, parentContextName } = candidate;
  const features = detectAnatomyFeatures(node);
  const rawBaseName = getBaseDisplayName(node, namingContext);
  const role = detectAnatomyRole(node, rawBaseName, features);
  const entityKind = detectAnatomyEntityKind(role);
  const level = resolveLevel(parentContextName);
  const slotPosition = entityKind === 'slot' ? detectSlotPosition(node) : undefined;

  const baseName = getCanonicalAnatomyBaseName({
    entityKind,
    role,
    rawBaseName,
    slotPosition,
    parentContextName,
  });

  const actionName = detectAnatomyAction(node) || undefined;
  const isDestructive = isDestructiveNode(node);

  let stateName: string | undefined;
  if (entityKind === 'container-variant') {
    stateName = extractStateName(node) || undefined;
    if (!stateName && isDestructive) {
      stateName = 'Destructive';
    }
  }

  const classified: AnatomyCandidate = {
    ...candidate,
    rawName: node.name || '',
    baseName,
    displayName: getDisplayAnatomyName(node, namingContext),
    entityKind,
    role,
    features,
    stateName,
    actionName,
    isDestructive,
    level,
    slotPosition,
    uniquenessKey: '',
  };

  classified.uniquenessKey = getAnatomyUniquenessKey(classified);
  return classified;
}

export function classifyAnatomyCandidates(
  candidates: AnatomyCandidate[],
  rootNode: SceneNode,
  namingContext: NamingContext
): AnatomyCandidate[] {
  return candidates.map((c) => classifyAnatomyCandidate(c, rootNode, namingContext));
}
