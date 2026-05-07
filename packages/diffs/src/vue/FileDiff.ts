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
  FileDiff as FileDiffClass,
  type FileDiffOptions,
} from '../components/FileDiff';
import { VirtualizedFileDiff } from '../components/VirtualizedFileDiff';
import type { Virtualizer } from '../components/Virtualizer';
import type {
  GetHoveredLineResult,
  SelectedLineRange,
} from '../managers/InteractionManager';
import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  VirtualFileMetrics,
} from '../types';
import { areOptionsEqual } from '../utils/areOptionsEqual';
import type { WorkerPoolManager } from '../worker';
import { VirtualizerInjectionKey, WorkerPoolInjectionKey } from './context';
import {
  DIFFS_TAG_NAME,
  hasExistingPrerenderedContent,
  hasSlot,
  noopRender,
  raw,
  renderDiffSlots,
  renderPrerenderedTemplate,
} from './utils';

type FileDiffInstance<LAnnotation> =
  | FileDiffClass<LAnnotation>
  | VirtualizedFileDiff<LAnnotation>;

export interface DiffBaseProps<LAnnotation> {
  disableWorkerPool?: boolean;
  lineAnnotations?: DiffLineAnnotation<LAnnotation>[];
  metrics?: VirtualFileMetrics;
  options?: FileDiffOptions<LAnnotation>;
  prerenderedHtml?: string;
  prerenderedHTML?: string;
  selectedLines?: SelectedLineRange | null;
}

export interface FileDiffProps<LAnnotation> extends DiffBaseProps<LAnnotation> {
  fileDiff: FileDiffMetadata;
}

export function mergeFileDiffOptions<LAnnotation>({
  hasCustomHeader,
  hasGutterUtility,
  options,
}: {
  hasCustomHeader: boolean;
  hasGutterUtility: boolean;
  options: FileDiffOptions<LAnnotation> | undefined;
}): FileDiffOptions<LAnnotation> | undefined {
  if (hasCustomHeader || hasGutterUtility) {
    return {
      ...options,
      renderCustomHeader: hasCustomHeader ? noopRender : undefined,
      renderGutterUtility: hasGutterUtility ? noopRender : undefined,
    };
  }

  return options;
}

export const FileDiff = defineComponent({
  name: 'FileDiff',
  inheritAttrs: false,
  inject: {
    virtualizer: { default: undefined, from: VirtualizerInjectionKey },
    workerPool: { default: undefined, from: WorkerPoolInjectionKey },
  },
  props: {
    disableWorkerPool: {
      default: false,
      type: Boolean,
    },
    fileDiff: {
      required: true,
      type: Object as PropType<FileDiffMetadata>,
    },
    lineAnnotations: {
      required: false,
      type: Array as PropType<DiffLineAnnotation<unknown>[]>,
    },
    metrics: {
      required: false,
      type: Object as PropType<VirtualFileMetrics>,
    },
    options: {
      required: false,
      type: Object as PropType<FileDiffOptions<unknown>>,
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
    instance: FileDiffInstance<unknown> | null;
    slotState: { hasCustomHeader: boolean };
    shouldRenderPrerenderedTemplate: boolean;
  } {
    return {
      hostElement: null,
      instance: null,
      slotState: markRaw({ hasCustomHeader: false }),
      shouldRenderPrerenderedTemplate:
        (this.prerenderedHtml ?? this.prerenderedHTML) != null,
    };
  },
  computed: {
    hasGutterUtility(): boolean {
      return hasSlot(this.$slots, 'gutter-utility');
    },
    rawFileDiff(): FileDiffMetadata {
      return raw(this.fileDiff);
    },
    rawLineAnnotations(): DiffLineAnnotation<unknown>[] | undefined {
      return this.lineAnnotations == null
        ? undefined
        : raw(this.lineAnnotations);
    },
    rawMetrics(): VirtualFileMetrics | undefined {
      return this.metrics == null ? undefined : raw(this.metrics);
    },
    rawOptions(): FileDiffOptions<unknown> | undefined {
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
    createInstance(): FileDiffInstance<unknown> {
      if (this.instance != null) {
        return this.instance as FileDiffInstance<unknown>;
      }

      const virtualizer = toRaw(this.virtualizer) as Virtualizer | undefined;
      const workerPool = this.disableWorkerPool
        ? undefined
        : (toRaw(this.workerPool) as WorkerPoolManager | undefined);
      this.instance = markRaw(
        virtualizer == null
          ? new FileDiffClass(this.getResolvedOptions(), workerPool, true)
          : new VirtualizedFileDiff(
              this.getResolvedOptions(),
              virtualizer,
              this.rawMetrics,
              workerPool,
              true
            )
      ) as FileDiffInstance<unknown>;
      return this.instance as FileDiffInstance<unknown>;
    },
    getHoveredLine(): GetHoveredLineResult<'diff'> | undefined {
      return this.instance?.getHoveredLine();
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
          fileContainer: hostElement,
          fileDiff: this.rawFileDiff,
          lineAnnotations: this.rawLineAnnotations,
          prerenderedHTML: this.resolvedPrerenderedHTML,
        });
      } else {
        instance.render({
          fileContainer: hostElement,
          fileDiff: this.rawFileDiff,
          lineAnnotations: this.rawLineAnnotations,
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
        fileDiff: this.rawFileDiff,
        forceRender,
        lineAnnotations: this.rawLineAnnotations,
      });
      if (this.rawSelectedLines !== undefined) {
        instance.setSelectedLines(this.rawSelectedLines);
      }
    },
    setHostElement(node: Element | null): void {
      this.hostElement = node instanceof HTMLElement ? node : null;
    },
    getResolvedOptions(): FileDiffOptions<unknown> | undefined {
      return mergeFileDiffOptions({
        hasCustomHeader: this.slotState.hasCustomHeader,
        hasGutterUtility: this.hasGutterUtility,
        options: this.rawOptions,
      });
    },
  },
  render(): VNodeChild {
    const children = this.shouldRenderPrerenderedTemplate
      ? renderPrerenderedTemplate(this.resolvedPrerenderedHTML)
      : [];
    const renderedSlots = renderDiffSlots({
      fileDiff: this.rawFileDiff,
      getHoveredLine: this.getHoveredLine,
      lineAnnotations: this.rawLineAnnotations,
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
