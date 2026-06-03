/// <reference types="@figma/plugin-typings" />

import { DEBUG_COMPONENTS_PROPERTIES } from './variantAxes';

const LOG_PREFIX = '[Components & properties]';

type InstanceComponentProperty = InstanceNode['componentProperties'][string];

const warnedMissingProperties = new Set<string>();

export function resetComponentPropertyWarnings(): void {
  warnedMissingProperties.clear();
}

function propertyNameCandidates(visibleName: string): string[] {
  const capitalized = visibleName.charAt(0).toUpperCase() + visibleName.slice(1);
  return [visibleName, visibleName.toLowerCase(), capitalized];
}

function matchesPropertyKey(key: string, visibleName: string): boolean {
  return key === visibleName || key.startsWith(`${visibleName}#`);
}

function matchesInstanceProperty(
  key: string,
  visibleName: string,
  prop: InstanceComponentProperty
): boolean {
  const propName = 'name' in prop ? prop.name : undefined;
  if (propName === visibleName) return true;
  if (matchesPropertyKey(key, visibleName)) return true;
  return false;
}

export function getComponentPropertyDefinitions(
  component: ComponentNode
): ComponentPropertyDefinitions {
  const parent = component.parent;
  if (parent?.type === 'COMPONENT_SET') {
    return parent.componentPropertyDefinitions;
  }
  return component.componentPropertyDefinitions ?? {};
}

export function findPropertyDefinition(
  definitions: ComponentPropertyDefinitions,
  visibleName: string
): ComponentPropertyDefinitions[string] | undefined {
  if (definitions[visibleName]) return definitions[visibleName];

  for (const [key, def] of Object.entries(definitions)) {
    if (matchesPropertyKey(key, visibleName)) return def;
  }

  return undefined;
}

function findKeyOnInstance(
  instance: InstanceNode,
  visibleName: string,
  definitions?: ComponentPropertyDefinitions
): string | null {
  const props = instance.componentProperties ?? {};

  for (const candidate of propertyNameCandidates(visibleName)) {
    if (props[candidate]) return candidate;
  }

  for (const [key, prop] of Object.entries(props)) {
    for (const candidate of propertyNameCandidates(visibleName)) {
      if (matchesInstanceProperty(key, candidate, prop)) return key;
    }
  }

  if (definitions) {
    for (const candidate of propertyNameCandidates(visibleName)) {
      if (definitions[candidate]) return candidate;
    }
    for (const key of Object.keys(definitions)) {
      for (const candidate of propertyNameCandidates(visibleName)) {
        if (matchesPropertyKey(key, candidate)) return key;
      }
    }
  }

  return null;
}

export function findComponentPropertyKey(
  instance: InstanceNode,
  visibleName: string,
  definitions?: ComponentPropertyDefinitions
): string | null {
  return findKeyOnInstance(instance, visibleName, definitions);
}

function findInstanceWithProperty(
  root: InstanceNode,
  visibleName: string,
  definitions?: ComponentPropertyDefinitions
): InstanceNode | null {
  if (findKeyOnInstance(root, visibleName, definitions)) return root;

  const nested = root.findAll((node) => node.type === 'INSTANCE') as InstanceNode[];
  for (const instance of nested) {
    if (findKeyOnInstance(instance, visibleName, definitions)) return instance;
  }

  return null;
}

export function safeAxisLabel(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Variant';
}

function resolveInactiveAxisValue(
  definitions: ComponentPropertyDefinitions,
  visibleName: string
): string {
  const def = findPropertyDefinition(definitions, visibleName);
  if (!def || def.type !== 'VARIANT') return '';

  const options = def.variantOptions ?? [];
  const emptyOption = options.find((option) => option.trim() === '');
  if (emptyOption !== undefined) return emptyOption;

  const variantPlaceholder = options.find((option) => option.toLowerCase() === 'variant');
  if (variantPlaceholder) return variantPlaceholder;

  return options[0] ?? 'Variant';
}

function resolvePropertyValueForSet(
  definitions: ComponentPropertyDefinitions,
  visibleName: string,
  desiredValue: string
): string | boolean {
  const def = findPropertyDefinition(definitions, visibleName);
  if (!def) return desiredValue;

  if (desiredValue.trim() === '') {
    return resolveInactiveAxisValue(definitions, visibleName);
  }

  if (def.type === 'VARIANT') {
    const options = def.variantOptions ?? [];
    if (options.length === 0) return desiredValue;

    if (options.includes(desiredValue)) return desiredValue;

    const caseInsensitive = options.find(
      (option) => option.toLowerCase() === desiredValue.toLowerCase()
    );
    if (caseInsensitive) return caseInsensitive;

    const variantPlaceholder = options.find(
      (option) => option.toLowerCase() === 'variant'
    );
    if (variantPlaceholder) return variantPlaceholder;

    return options[0];
  }

  if (def.type === 'BOOLEAN') {
    return desiredValue.toLowerCase() === 'true';
  }

  return desiredValue;
}

function warnPropertyNotFound(visibleName: string, instance: InstanceNode): void {
  if (warnedMissingProperties.has(visibleName)) return;
  warnedMissingProperties.add(visibleName);

  const available = Object.entries(instance.componentProperties ?? {}).map(
    ([key, prop]) => ({
      key,
      type: prop.type,
      name: 'name' in prop ? prop.name : undefined,
      value: prop.value,
    })
  );

  console.warn(`${LOG_PREFIX} Property not found: ${visibleName}`, { available });
}

/**
 * Sets a component property on a template instance by visible name.
 * Resolves VARIANT option values from the template component definitions.
 */
export function setInstancePropertyByVisibleName(
  instance: InstanceNode,
  visibleName: string,
  value: string | boolean,
  definitions?: ComponentPropertyDefinitions
): boolean {
  const target = findInstanceWithProperty(instance, visibleName, definitions) ?? instance;
  const key = findKeyOnInstance(target, visibleName, definitions);
  if (!key) {
    warnPropertyNotFound(visibleName, target);
    return false;
  }

  const prop = target.componentProperties[key];
  const resolvedValue =
    definitions && typeof value === 'string'
      ? resolvePropertyValueForSet(definitions, visibleName, value)
      : value;

  if (prop && typeof resolvedValue === 'string' && prop.type === 'BOOLEAN') {
    console.warn(`${LOG_PREFIX} Property "${visibleName}" expects boolean, got "${resolvedValue}"`);
    return false;
  }

  try {
    target.setProperties({ [key]: resolvedValue });
    if (DEBUG_COMPONENTS_PROPERTIES) {
      console.log(`${LOG_PREFIX} set property`, {
        visibleName,
        key,
        targetName: target.name,
        type: prop?.type,
        value: resolvedValue,
      });
    }
    return true;
  } catch (error) {
    console.warn(`${LOG_PREFIX} setProperties failed for ${visibleName}`, error, {
      key,
      resolvedValue,
      propType: prop?.type,
    });
    return false;
  }
}

const ORIENTATION_PROPERTY_CANDIDATES = ['orientation', 'Direction', 'Axis', 'Position'] as const;

const HORIZONTAL_ORIENTATION_VALUES = ['top', 'horizontal', 'h'];
const VERTICAL_ORIENTATION_VALUES = ['left', 'vertical', 'v'];

export type AxisTemplateRole = 'horizontal' | 'vertical';

export function configureAxisTemplateInstance(
  instance: InstanceNode,
  templateComponent: ComponentNode,
  config: { horizontal: string; vertical: string }
): void {
  const definitions = getComponentPropertyDefinitions(templateComponent);

  setInstancePropertyByVisibleName(instance, 'horizontal', config.horizontal, definitions);
  setInstancePropertyByVisibleName(instance, 'vertical', config.vertical, definitions);
}

export function applyTemplateOrientation(
  instance: InstanceNode,
  templateComponent: ComponentNode,
  role: AxisTemplateRole
): void {
  const definitions = getComponentPropertyDefinitions(templateComponent);
  const wantValues =
    role === 'horizontal' ? HORIZONTAL_ORIENTATION_VALUES : VERTICAL_ORIENTATION_VALUES;

  for (const candidate of ORIENTATION_PROPERTY_CANDIDATES) {
    const def = findPropertyDefinition(definitions, candidate);
    if (!def || def.type !== 'VARIANT') continue;

    const options = def.variantOptions ?? [];
    const match = options.find((option) =>
      wantValues.some((want) => option.toLowerCase().includes(want))
    );
    if (match) {
      setInstancePropertyByVisibleName(instance, candidate, match, definitions);
      if (DEBUG_COMPONENTS_PROPERTIES) {
        console.log(`${LOG_PREFIX} orientation`, { role, property: candidate, value: match });
      }
      return;
    }
  }
}

export function logTemplatePropertyDebug(
  templateComponent: ComponentNode,
  horizontalInstance: InstanceNode,
  verticalInstance: InstanceNode
): void {
  if (!DEBUG_COMPONENTS_PROPERTIES) return;

  const definitions = getComponentPropertyDefinitions(templateComponent);
  console.log(`${LOG_PREFIX} template property definitions`, Object.entries(definitions).map(([key, def]) => ({
    key,
    type: def.type,
    variantOptions: def.type === 'VARIANT' ? def.variantOptions : undefined,
  })));
  console.log(`${LOG_PREFIX} horizontal instance properties`, horizontalInstance.componentProperties);
  console.log(`${LOG_PREFIX} vertical instance properties`, verticalInstance.componentProperties);
}
