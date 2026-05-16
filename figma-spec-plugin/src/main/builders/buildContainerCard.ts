/**
 * Карточка контейнера: типы строк и порядок полей — `getContainerPropertyRows`.
 * Сборка фреймов в Figma — `legacyCore.js` (`createContainerCard`, `createBaseContainerPropertyRow`, …).
 */
export { getContainerPropertyRows } from '../spec/containerCardPropertyRows';
export type {
  BasePropertyRowData,
  PaddingPropertyRowData,
  PropertyRowData,
  ContainerPropertyRowInputs,
} from '../spec/containerCardPropertyRows';
export { getPaddingRows } from '../spec/paddingRows';
export type { PaddingRow, PaddingSide } from '../spec/paddingRows';
export { getPropertyIconNames } from '../icons/propertyIconResolver';
export type { PropertyIconContext } from '../icons/propertyIconResolver';
