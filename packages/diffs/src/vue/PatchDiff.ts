import { defineComponent, h, type PropType, type VNodeChild } from 'vue';

import type { FileDiffOptions } from '../components/FileDiff';
import type { SelectedLineRange } from '../managers/InteractionManager';
import type { DiffLineAnnotation, VirtualFileMetrics } from '../types';
import { getSingularPatch } from '../utils/getSingularPatch';
import { FileDiff } from './FileDiff';

export interface PatchDiffProps<LAnnotation> {
  disableWorkerPool?: boolean;
  lineAnnotations?: DiffLineAnnotation<LAnnotation>[];
  metrics?: VirtualFileMetrics;
  options?: FileDiffOptions<LAnnotation>;
  patch: string;
  prerenderedHtml?: string;
  prerenderedHTML?: string;
  selectedLines?: SelectedLineRange | null;
}

export const PatchDiff = defineComponent({
  name: 'PatchDiff',
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
    options: {
      required: false,
      type: Object as PropType<FileDiffOptions<unknown>>,
    },
    patch: {
      required: true,
      type: String,
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
      return getSingularPatch(this.patch);
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
