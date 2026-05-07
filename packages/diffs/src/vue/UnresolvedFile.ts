import {
  defineComponent,
  h,
  markRaw,
  type PropType,
  toRaw,
  type VNodeChild,
  type VNodeRef,
} from 'vue';

import {
  UnresolvedFile as UnresolvedFileClass,
  type UnresolvedFileOptions,
} from '../components/UnresolvedFile';
import type {
  GetHoveredLineResult,
  SelectedLineRange,
} from '../managers/InteractionManager';
import type {
  DiffLineAnnotation,
  FileContents,
  FileDiffMetadata,
  MergeConflictActionPayload,
  MergeConflictMarkerRow,
  MergeConflictResolution,
} from '../types';
import { areOptionsEqual } from '../utils/areOptionsEqual';
import {
  type MergeConflictDiffAction,
  parseMergeConflictDiffFromFile,
} from '../utils/parseMergeConflictDiffFromFile';
import type { WorkerPoolManager } from '../worker';
import { WorkerPoolInjectionKey } from './context';
import {
  DIFFS_TAG_NAME,
  hasExistingPrerenderedContent,
  hasSlot,
  noopRender,
  raw,
  renderDiffSlots,
  renderPrerenderedTemplate,
} from './utils';

export interface UnresolvedFileProps<LAnnotation> {
  disableWorkerPool?: boolean;
  file: FileContents;
  lineAnnotations?: DiffLineAnnotation<LAnnotation>[];
  options?: VueUnresolvedFileOptions<LAnnotation>;
  prerenderedHtml?: string;
  prerenderedHTML?: string;
  selectedLines?: SelectedLineRange | null;
}

export interface VueUnresolvedFileOptions<LAnnotation> extends Omit<
  UnresolvedFileOptions<LAnnotation>,
  | 'mergeConflictActionsType'
  | 'onMergeConflictAction'
  | 'onMergeConflictResolve'
> {
  mergeConflictActionsType?: 'default' | 'none';
}

export function mergeUnresolvedOptions<LAnnotation>({
  hasConflictUtility,
  hasCustomHeader,
  hasGutterUtility,
  onMergeConflictAction,
  options,
}: {
  hasConflictUtility: boolean;
  hasCustomHeader: boolean;
  hasGutterUtility: boolean;
  onMergeConflictAction: UnresolvedFileOptions<LAnnotation>['onMergeConflictAction'];
  options: VueUnresolvedFileOptions<LAnnotation> | undefined;
}): UnresolvedFileOptions<LAnnotation> {
  const normalizedOptions = (options ??
    {}) as VueUnresolvedFileOptions<LAnnotation> & {
    onMergeConflictAction?: unknown;
    onMergeConflictResolve?: unknown;
  };
  const {
    mergeConflictActionsType,
    onMergeConflictAction: _onMergeConflictAction,
    onMergeConflictResolve: _onMergeConflictResolve,
    ...restOptions
  } = normalizedOptions;
  return {
    ...restOptions,
    mergeConflictActionsType: hasConflictUtility
      ? noopRender
      : mergeConflictActionsType === 'default' ||
          mergeConflictActionsType === 'none'
        ? mergeConflictActionsType
        : undefined,
    onMergeConflictAction,
    renderCustomHeader: hasCustomHeader ? noopRender : undefined,
    renderGutterUtility: hasGutterUtility ? noopRender : undefined,
  };
}

interface UnresolvedState {
  actions: (MergeConflictDiffAction | undefined)[];
  fileDiff: FileDiffMetadata;
  markerRows: MergeConflictMarkerRow[];
}

export const UnresolvedFile = defineComponent({
  name: 'UnresolvedFile',
  inheritAttrs: false,
  inject: {
    workerPool: { default: undefined, from: WorkerPoolInjectionKey },
  },
  props: {
    disableWorkerPool: {
      default: false,
      type: Boolean,
    },
    file: {
      required: true,
      type: Object as PropType<FileContents>,
    },
    lineAnnotations: {
      required: false,
      type: Array as PropType<DiffLineAnnotation<unknown>[]>,
    },
    options: {
      required: false,
      type: Object as PropType<VueUnresolvedFileOptions<unknown>>,
    },
    prerenderedHTML: {
      required: false,
      type: String,
    },
    prerenderedHtml: {
      required: false,
      type: String,
    },
    selectedLines: {
      default: undefined,
      type: Object as PropType<SelectedLineRange | null | undefined>,
    },
  },
  data(): {
    hostElement: HTMLElement | null;
    instance: UnresolvedFileClass<unknown> | null;
    slotState: { hasCustomHeader: boolean };
    state: UnresolvedState;
    shouldRenderPrerenderedTemplate: boolean;
  } {
    const state = parseMergeConflictDiffFromFile(
      raw(this.file),
      this.options?.maxContextLines
    );
    return {
      hostElement: null,
      instance: null,
      slotState: markRaw({ hasCustomHeader: false }),
      state,
      shouldRenderPrerenderedTemplate:
        (this.prerenderedHtml ?? this.prerenderedHTML) != null,
    };
  },
  computed: {
    hasConflictUtility(): boolean {
      return hasSlot(this.$slots, 'merge-conflict-utility');
    },
    hasGutterUtility(): boolean {
      return hasSlot(this.$slots, 'gutter-utility');
    },
    rawFile(): FileContents {
      return raw(this.file);
    },
    rawLineAnnotations(): DiffLineAnnotation<unknown>[] | undefined {
      return this.lineAnnotations == null
        ? undefined
        : raw(this.lineAnnotations);
    },
    rawOptions(): VueUnresolvedFileOptions<unknown> | undefined {
      return this.options == null ? undefined : raw(this.options);
    },
    resolvedPrerenderedHTML(): string | undefined {
      return this.prerenderedHtml ?? this.prerenderedHTML;
    },
    rawSelectedLines(): SelectedLineRange | null | undefined {
      return this.selectedLines == null
        ? this.selectedLines
        : toRaw(this.selectedLines);
    },
  },
  mounted(): void {
    this.mountOrHydrate();
    this.shouldRenderPrerenderedTemplate = false;
  },
  updated(): void {
    this.renderInstance();
  },
  beforeUnmount(): void {
    this.instance?.cleanUp();
    this.instance = null;
  },
  methods: {
    createInstance(): UnresolvedFileClass<unknown> {
      if (this.instance != null) {
        return this.instance as UnresolvedFileClass<unknown>;
      }

      const workerPool = this.disableWorkerPool
        ? undefined
        : (toRaw(this.workerPool) as WorkerPoolManager | undefined);
      this.instance = markRaw(
        new UnresolvedFileClass(this.getResolvedOptions(), workerPool, true)
      ) as UnresolvedFileClass<unknown>;
      return this.instance as UnresolvedFileClass<unknown>;
    },
    getHoveredLine(): GetHoveredLineResult<'diff'> | undefined {
      return this.instance?.getHoveredLine();
    },
    getInstance(): UnresolvedFileClass<unknown> | undefined {
      return (this.instance ?? undefined) as
        | UnresolvedFileClass<unknown>
        | undefined;
    },
    handleMergeConflictAction(
      payload: MergeConflictActionPayload,
      instance: UnresolvedFileClass<unknown>
    ): void {
      this.resolveConflictAction(
        payload.conflict.conflictIndex,
        payload.resolution,
        instance
      );
    },
    mountOrHydrate(): void {
      const hostElement = this.hostElement;
      if (hostElement == null) {
        return;
      }

      const instance = this.createInstance();
      if (
        this.resolvedPrerenderedHTML != null &&
        hasExistingPrerenderedContent(hostElement)
      ) {
        instance.hydrate({
          actions: this.state.actions,
          fileContainer: hostElement,
          fileDiff: this.state.fileDiff,
          lineAnnotations: this.rawLineAnnotations,
          markerRows: this.state.markerRows,
          prerenderedHTML: this.resolvedPrerenderedHTML,
        });
      } else {
        instance.render({
          actions: this.state.actions,
          fileContainer: hostElement,
          fileDiff: this.state.fileDiff,
          lineAnnotations: this.rawLineAnnotations,
          markerRows: this.state.markerRows,
        });
      }

      if (this.rawSelectedLines !== undefined) {
        instance.setSelectedLines(this.rawSelectedLines);
      }
    },
    renderInstance(): void {
      const instance = this.instance;
      if (instance == null) {
        return;
      }

      const forceRender = !areOptionsEqual(
        instance.options,
        this.getResolvedOptions()
      );
      instance.setOptions(this.getResolvedOptions());
      instance.render({
        actions: this.state.actions,
        fileDiff: this.state.fileDiff,
        forceRender,
        lineAnnotations: this.rawLineAnnotations,
        markerRows: this.state.markerRows,
      });
      if (this.rawSelectedLines !== undefined) {
        instance.setSelectedLines(this.rawSelectedLines);
      }
    },
    resolveConflict(
      action: MergeConflictDiffAction,
      resolution: MergeConflictResolution
    ): void {
      this.resolveConflictAction(action.conflictIndex, resolution);
    },
    resolveConflictAction(
      conflictIndex: number,
      resolution: MergeConflictResolution,
      instance?: UnresolvedFileClass<unknown>
    ): void {
      const targetInstance = instance ?? this.instance ?? undefined;
      const result = targetInstance?.resolveConflict(
        conflictIndex,
        resolution,
        this.state.fileDiff
      );
      if (result == null) {
        return;
      }

      this.state = {
        actions: result.actions,
        fileDiff: result.fileDiff,
        markerRows: result.markerRows,
      };
    },
    setHostElement(node: Element | null): void {
      this.hostElement = node instanceof HTMLElement ? node : null;
    },
    getResolvedOptions(): UnresolvedFileOptions<unknown> {
      return mergeUnresolvedOptions({
        hasConflictUtility: this.hasConflictUtility,
        hasCustomHeader: this.slotState.hasCustomHeader,
        hasGutterUtility: this.hasGutterUtility,
        onMergeConflictAction: this.handleMergeConflictAction,
        options: this.rawOptions,
      });
    },
  },
  render(): VNodeChild {
    const children = this.shouldRenderPrerenderedTemplate
      ? renderPrerenderedTemplate(this.resolvedPrerenderedHTML)
      : [];
    const renderedSlots = renderDiffSlots({
      actions: this.state.actions,
      fileDiff: this.state.fileDiff,
      getHoveredLine: this.getHoveredLine,
      getInstance: this.getInstance,
      lineAnnotations: this.rawLineAnnotations,
      resolveConflict: this.resolveConflict,
      slots: this.$slots,
    });
    this.slotState.hasCustomHeader = renderedSlots.hasCustomHeader;
    children.push(...renderedSlots.children);

    return h(
      DIFFS_TAG_NAME,
      {
        ...this.$attrs,
        'data-allow-mismatch':
          this.resolvedPrerenderedHTML == null ? undefined : 'children',
        ref: this.setHostElement as VNodeRef,
      },
      children
    );
  },
});
