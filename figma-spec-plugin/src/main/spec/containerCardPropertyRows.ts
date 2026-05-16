/// <reference types="@figma/plugin-typings" />

import type { PropertyIconContext } from '../icons/propertyIconResolver';
import type { PaddingRow } from './paddingRows';

export type BasePropertyRowData = {
  type: 'base';
  name: string;
  value: string;
  iconContext?: PropertyIconContext;
};

export type PaddingPropertyRowData = {
  type: 'padding';
  name: 'Padding';
  valueGroups: PaddingRow[];
};

export type PropertyRowData = BasePropertyRowData | PaddingPropertyRowData;

export type ContainerPropertyRowInputs = {
  directionDisplay: string;
  alignmentDisplay: string;
  widthDisplay: string;
  heightDisplay: string;
  gapDisplay: string;
  paddingValueGroups: PaddingRow[];
};

/** Список строк карточки контейнера: одна логическая строка Padding со всеми группами значений. */
export function getContainerPropertyRows(input: ContainerPropertyRowInputs): PropertyRowData[] {
  const {
    directionDisplay,
    alignmentDisplay,
    widthDisplay,
    heightDisplay,
    gapDisplay,
    paddingValueGroups,
  } = input;

  const dirCtx: PropertyIconContext = { direction: directionDisplay };

  return [
    {
      type: 'base',
      name: 'Direction',
      value: directionDisplay,
      iconContext: dirCtx,
    },
    {
      type: 'base',
      name: 'Alignment',
      value: alignmentDisplay,
      iconContext: dirCtx,
    },
    {
      type: 'base',
      name: 'Width',
      value: widthDisplay,
    },
    {
      type: 'base',
      name: 'Height',
      value: heightDisplay,
    },
    {
      type: 'padding',
      name: 'Padding',
      valueGroups: paddingValueGroups,
    },
    {
      type: 'base',
      name: 'Gap',
      value: gapDisplay,
    },
  ];
}
