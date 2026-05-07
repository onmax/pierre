import { defineComponent, h, type PropType, toRaw, type VNodeChild } from 'vue';

import type { FileDiffOptions } from '../components/FileDiff';
import type { SelectedLineRange } from '../managers/InteractionManager';
import type {
  DiffLineAnnotation,
  FileContents,
  VirtualFileMetrics,
} from '../types';
import { parseDiffFromFile } from '../utils/parseDiffFromFile';
import { FileDiff } from './FileDiff';

export interface MultiFileDiffProps<LAnnotation> {
  disableWorkerPool?: boolean;
  lineAnnotations?: DiffLineAnnotation<LAnnotation>[];
  metrics?: VirtualFileMetrics;
  newFile: FileContents;
  oldFile: FileContents;
  options?: FileDiffOptions<LAnnotation>;
  prerenderedHtml?: string;
  prerenderedHTML?: string;
  selectedLines?: SelectedLineRange | null;
}

export const MultiFileDiff = defineComponent({
  name: 'MultiFileDiff',
  inheritAttrs: false,
  props: {
    disableWorkerPool: {
      default: false,
      type: Boolean,
    },
    lineAnnotations: {
      required: false,
      type: Array as PropType<DiffLineAnnotation<unknown>[]>,
    },
    metrics: {
      required: false,
      type: Object as PropType<VirtualFileMetrics>,
    },
    newFile: {
      required: true,
      type: Object as PropType<FileContents>,
    },
    oldFile: {
      required: true,
      type: Object as PropType<FileContents>,
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
  computed: {
    fileDiff() {
      const options = this.options == null ? undefined : toRaw(this.options);
      return parseDiffFromFile(
        toRaw(this.oldFile),
        toRaw(this.newFile),
        options?.parseDiffOptions
      );
    },
  },
  render(): VNodeChild {
    return h(
      FileDiff,
      {
        ...this.$attrs,
        disableWorkerPool: this.disableWorkerPool,
        fileDiff: this.fileDiff,
        lineAnnotations: this.lineAnnotations,
        metrics: this.metrics,
        options: this.options,
        prerenderedHTML: this.prerenderedHTML,
        prerenderedHtml: this.prerenderedHtml,
        selectedLines: this.selectedLines,
      },
      this.$slots
    );
  },
});
