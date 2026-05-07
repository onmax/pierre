import {
  defineComponent,
  h,
  markRaw,
  type PropType,
  toRaw,
  type VNodeChild,
  type VNodeRef,
} from 'vue';

import { File as FileClass, type FileOptions } from '../components/File';
import { VirtualizedFile } from '../components/VirtualizedFile';
import { type Virtualizer } from '../components/Virtualizer';
import type {
  GetHoveredLineResult,
  SelectedLineRange,
} from '../managers/InteractionManager';
import type {
  FileContents,
  LineAnnotation,
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
  renderFileSlots,
  renderPrerenderedTemplate,
} from './utils';

type FileInstance<LAnnotation> =
  | FileClass<LAnnotation>
  | VirtualizedFile<LAnnotation>;

export interface FileProps<LAnnotation> {
  disableWorkerPool?: boolean;
  file: FileContents;
  lineAnnotations?: LineAnnotation<LAnnotation>[];
  metrics?: VirtualFileMetrics;
  options?: FileOptions<LAnnotation>;
  prerenderedHtml?: string;
  prerenderedHTML?: string;
  selectedLines?: SelectedLineRange | null;
}

export function mergeFileOptions<LAnnotation>({
  hasCustomHeader,
  hasGutterUtility,
  options,
}: {
  hasCustomHeader: boolean;
  hasGutterUtility: boolean;
  options: FileOptions<LAnnotation> | undefined;
}): FileOptions<LAnnotation> | undefined {
  if (hasCustomHeader || hasGutterUtility) {
    return {
      ...options,
      renderCustomHeader: hasCustomHeader ? noopRender : undefined,
      renderGutterUtility: hasGutterUtility ? noopRender : undefined,
    };
  }

  return options;
}

export const File = defineComponent({
  name: 'File',
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
    file: {
      required: true,
      type: Object as PropType<FileContents>,
    },
    lineAnnotations: {
      required: false,
      type: Array as PropType<LineAnnotation<unknown>[]>,
    },
    metrics: {
      required: false,
      type: Object as PropType<VirtualFileMetrics>,
    },
    options: {
      required: false,
      type: Object as PropType<FileOptions<unknown>>,
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
    instance: FileInstance<unknown> | null;
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
    rawFile(): FileContents {
      return raw(this.file);
    },
    rawLineAnnotations(): LineAnnotation<unknown>[] | undefined {
      return this.lineAnnotations == null
        ? undefined
        : raw(this.lineAnnotations);
    },
    rawMetrics(): VirtualFileMetrics | undefined {
      return this.metrics == null ? undefined : raw(this.metrics);
    },
    rawOptions(): FileOptions<unknown> | undefined {
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
    createInstance(): FileInstance<unknown> {
      if (this.instance != null) {
        return this.instance as FileInstance<unknown>;
      }

      const virtualizer = toRaw(this.virtualizer) as Virtualizer | undefined;
      const workerPool = this.disableWorkerPool
        ? undefined
        : (toRaw(this.workerPool) as WorkerPoolManager | undefined);
      this.instance = markRaw(
        virtualizer == null
          ? new FileClass(this.getResolvedOptions(), workerPool, true)
          : new VirtualizedFile(
              this.getResolvedOptions(),
              virtualizer,
              this.rawMetrics,
              workerPool,
              true
            )
      ) as FileInstance<unknown>;
      return this.instance as FileInstance<unknown>;
    },
    getHoveredLine(): GetHoveredLineResult<'file'> | undefined {
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
          file: this.rawFile,
          fileContainer: hostElement,
          lineAnnotations: this.rawLineAnnotations,
          prerenderedHTML: this.resolvedPrerenderedHTML,
        });
      } else {
        instance.render({
          file: this.rawFile,
          fileContainer: hostElement,
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
        file: this.rawFile,
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
    getResolvedOptions(): FileOptions<unknown> | undefined {
      return mergeFileOptions({
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
    const renderedSlots = renderFileSlots({
      file: this.rawFile,
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
