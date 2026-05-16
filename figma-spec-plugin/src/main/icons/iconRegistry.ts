/// <reference types="@figma/plugin-typings" />
/**
 * SVG лежат рядом с этим файлом: `src/main/icons/*.svg`
 * (импорты `./Name.svg` разрешаются через esbuild `loader: { '.svg': 'text' }` в scripts/build.mjs).
 */

import AlignmentHorizontalBottom from './Alignment-Horizontal-Bottom.svg';
import AlignmentHorizontalCenter from './Alignment-Horizontal-Center.svg';
import AlignmentHorizontalTop from './Alignment-Horizontal-Top.svg';
import AlignmentVerticalLeft from './Alignment-Vertical-Left.svg';
import AlignmentVerticalMiddle from './Alignment-Vertical-Middle.svg';
import AlignmentVerticalRight from './Alignment-Vertical-Right.svg';
import Gap from './Gap.svg';
import Height from './Height.svg';
import Horizontal from './Horizontal.svg';
import Padding from './Padding.svg';
import PaddingBottom from './Padding-Bottom.svg';
import PaddingLeft from './Padding-Left.svg';
import PaddingLeftBottom from './Padding-Left-Bottom.svg';
import PaddingLeftBottomRight from './Padding-Left-Bottom-Right.svg';
import PaddingLeftBottomTop from './Padding-Left-Bottom-Top.svg';
import PaddingLeftRight from './Padding-Left-Right.svg';
import PaddingLeftTop from './Padding-Left-Top.svg';
import PaddingRight from './Padding-Right.svg';
import PaddingRightBottom from './Padding-Right-Bottom.svg';
import PaddingRightBottomTop from './Padding-Right-Bottom-Top.svg';
import PaddingRightLeftTop from './Padding-Right-Left-Top.svg';
import PaddingRightTop from './Padding-Right-Top.svg';
import PaddingTop from './Padding-Top.svg';
import PaddingTopBottom from './Padding-top-Bottom.svg';
import Vertical from './Vertical.svg';
import Width from './Width.svg';

export type SpecIconName =
  | 'Vertical'
  | 'Horizontal'
  | 'Alignment-Horizontal-Top'
  | 'Alignment-Horizontal-Bottom'
  | 'Alignment-Horizontal-Center'
  | 'Alignment-Vertical-Left'
  | 'Alignment-Vertical-Right'
  | 'Alignment-Vertical-Middle'
  | 'Width'
  | 'Height'
  | 'Padding'
  | 'Padding-Left'
  | 'Padding-Right'
  | 'Padding-Bottom'
  | 'Padding-Top'
  | 'Padding-Left-Bottom'
  | 'Padding-Left-Top'
  | 'Padding-Right-Top'
  | 'Padding-Right-Bottom'
  | 'Padding-Left-Right'
  | 'Padding-Top-Bottom'
  | 'Padding-Left-Bottom-Right'
  | 'Padding-Left-Bottom-Top'
  | 'Padding-Right-Bottom-Top'
  | 'Padding-Right-Left-Top'
  | 'Gap';

export type IconRegistry = Record<SpecIconName, string>;

export const SPEC_ICON_REGISTRY: IconRegistry = {
  Vertical,
  Horizontal,
  'Alignment-Horizontal-Top': AlignmentHorizontalTop,
  'Alignment-Horizontal-Bottom': AlignmentHorizontalBottom,
  'Alignment-Horizontal-Center': AlignmentHorizontalCenter,
  'Alignment-Vertical-Left': AlignmentVerticalLeft,
  'Alignment-Vertical-Right': AlignmentVerticalRight,
  'Alignment-Vertical-Middle': AlignmentVerticalMiddle,
  Width,
  Height,
  Padding,
  'Padding-Left': PaddingLeft,
  'Padding-Right': PaddingRight,
  'Padding-Bottom': PaddingBottom,
  'Padding-Top': PaddingTop,
  'Padding-Left-Bottom': PaddingLeftBottom,
  'Padding-Left-Top': PaddingLeftTop,
  'Padding-Right-Top': PaddingRightTop,
  'Padding-Right-Bottom': PaddingRightBottom,
  'Padding-Left-Right': PaddingLeftRight,
  'Padding-Top-Bottom': PaddingTopBottom,
  'Padding-Left-Bottom-Right': PaddingLeftBottomRight,
  'Padding-Left-Bottom-Top': PaddingLeftBottomTop,
  'Padding-Right-Bottom-Top': PaddingRightBottomTop,
  'Padding-Right-Left-Top': PaddingRightLeftTop,
  Gap,
};
