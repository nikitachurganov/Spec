import type { ComponentSetVariantOption } from './componentSetVariants';
import type { PluginSettings } from './settings';
import type { AnatomyPreviewPayload } from './anatomyPreview';
import type { HeaderSettings } from './headerSettings';

export type SpecLayerOption = {
  path: string;
  name: string;
  type: string;
  componentRole?: 'component-set' | 'master-component' | 'child-component' | 'none';
  depth: number;
  parentPath?: string;
  isAutoSelected: boolean;
  isSelectable: boolean;
  isComponentBoundary: boolean;
  isRoot?: boolean;
  isText?: boolean;
  kind?: string;
};

export type BuildSpecificationMessage = {
  type: 'BUILD_SPECIFICATION';
  payload: {
    settings: PluginSettings;
    /** Present when the selected source is a Component Set and a variant was chosen for Spec/Anatomy. */
    selectedVariantForSpecAndAnatomyId?: string;
  };
};

export type GetSettingsMessage = {
  type: 'GET_SETTINGS';
};

export type SaveSettingsMessage = {
  type: 'SAVE_SETTINGS';
  payload: {
    settings: PluginSettings;
  };
};

export type GetSpecLayerOptionsMessage = {
  type: 'GET_SPEC_LAYER_OPTIONS';
};

export type SaveSpecSelectedLayersMessage = {
  type: 'SAVE_SPEC_SELECTED_LAYERS';
  payload: {
    selectedLayerPaths: string[];
  };
};

export type SaveAnatomySelectedLayersMessage = {
  type: 'SAVE_ANATOMY_SELECTED_LAYERS';
  payload: {
    selectedLayerPaths: string[];
  };
};

export type ResizePluginMessage = {
  type: 'RESIZE_PLUGIN';
  payload: {
    width: number;
    height: number;
  };
};

export type GetHeaderOptionsMessage = {
  type: 'GET_HEADER_OPTIONS';
};

export type SetHeaderTemplateFromSelectionMessage = {
  type: 'SET_HEADER_TEMPLATE_FROM_SELECTION';
};

export type DeleteGeneratedDocumentationMessage = {
  type: 'DELETE_GENERATED_DOCUMENTATION';
  payload: {
    nodeId: string;
  };
};

export type UiToMainMessage =
  | BuildSpecificationMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetSpecLayerOptionsMessage
  | GetHeaderOptionsMessage
  | SetHeaderTemplateFromSelectionMessage
  | DeleteGeneratedDocumentationMessage
  | SaveSpecSelectedLayersMessage
  | SaveAnatomySelectedLayersMessage
  | ResizePluginMessage;

export type SpecificationBuiltMessage = {
  type: 'SPECIFICATION_BUILT';
  payload: {
    name: string;
    nodeId: string;
  };
};

export type ErrorMessage = {
  type: 'ERROR';
  payload: {
    message: string;
  };
};

export type SettingsLoadedMessage = {
  type: 'SETTINGS_LOADED';
  payload: {
    settings: PluginSettings;
  };
};

export type SpecLayerOptionsLoadedMessage = {
  type: 'SPEC_LAYER_OPTIONS_LOADED';
  payload: {
    rootId: string;
    rootName: string;
    options: SpecLayerOption[];
    specSelectedLayerPaths: string[];
    anatomySelectedLayerPaths: string[];
    autoSelectedLayerPaths: string[];
    specPreviewPayload: AnatomyPreviewPayload | null;
    anatomyPreviewPayload: AnatomyPreviewPayload | null;
  };
};

export type SpecLayerOptionsErrorMessage = {
  type: 'SPEC_LAYER_OPTIONS_ERROR';
  payload: {
    message: string;
  };
};

export type ActiveSourceClearedMessage = {
  type: 'ACTIVE_SOURCE_CLEARED';
  payload: {
    reason: string;
  };
};

export type ActiveSourcePendingMessage = {
  type: 'ACTIVE_SOURCE_PENDING';
  payload: {
    sourceNodeId: string;
    sourceName: string;
  };
};

export type ActiveSourceLoadingMessage = {
  type: 'ACTIVE_SOURCE_LOADING';
  payload: {
    sourceNodeId: string;
    sourceName: string;
  };
};

export type ActiveSourceSummaryMessage = {
  type: 'ACTIVE_SOURCE_SUMMARY';
  payload: {
    sourceNodeId: string | null;
    sourceName: string | null;
    sourceType: string | null;
    canGenerate: boolean;
    componentSetVariants?: ComponentSetVariantOption[];
    defaultVariantForSpecAndAnatomyId?: string | null;
  };
};

export type ReadyMessage = {
  type: 'READY';
};

export type HeaderOptionsLoadedMessage = {
  type: 'HEADER_OPTIONS_LOADED';
  payload: {
    headerFound: boolean;
    statusOptions: string[];
    statusSizeOptions: string[];
    headerSettings: HeaderSettings;
  };
};

export type HeaderTemplateSavedMessage = {
  type: 'HEADER_TEMPLATE_SAVED';
  payload: {
    componentId: string;
    componentName: string;
  };
};

export type GenerationProgressStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export type GenerationProgressStepId =
  | 'prepare'
  | 'resolve-source'
  | 'components-properties'
  | 'anatomy'
  | 'behavior'
  | 'use-case'
  | 'spec'
  | 'accessibility'
  | 'themes'
  | 'position'
  | 'finish';

export type GenerationProgressStep = {
  id: GenerationProgressStepId;
  title: string;
  status: GenerationProgressStatus;
  description?: string;
  error?: string;
};

export type GenerationProgressStartMessage = {
  type: 'generation-progress-start';
  steps: GenerationProgressStep[];
};

export type GenerationProgressUpdateMessage = {
  type: 'generation-progress-update';
  stepId: GenerationProgressStepId;
  status: GenerationProgressStatus;
  description?: string;
  error?: string;
};

export type GenerationProgressCompleteMessage = {
  type: 'generation-progress-complete';
};

export type GenerationProgressErrorMessage = {
  type: 'generation-progress-error';
  stepId?: GenerationProgressStepId;
  error: string;
};

export type MainToUiMessage =
  | SpecificationBuiltMessage
  | ErrorMessage
  | SettingsLoadedMessage
  | SpecLayerOptionsLoadedMessage
  | SpecLayerOptionsErrorMessage
  | HeaderOptionsLoadedMessage
  | HeaderTemplateSavedMessage
  | ActiveSourceClearedMessage
  | ActiveSourcePendingMessage
  | ActiveSourceLoadingMessage
  | ActiveSourceSummaryMessage
  | GenerationProgressStartMessage
  | GenerationProgressUpdateMessage
  | GenerationProgressCompleteMessage
  | GenerationProgressErrorMessage
  | ReadyMessage;
