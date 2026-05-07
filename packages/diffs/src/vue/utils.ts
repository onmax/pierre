import type { Slots, VNodeChild } from 'vue';
import { Comment, Fragment, h, isVNode, Text, toRaw } from 'vue';

import {
  CUSTOM_HEADER_SLOT_ID,
  DIFFS_TAG_NAME,
  HEADER_METADATA_SLOT_ID,
  HEADER_PREFIX_SLOT_ID,
} from '../constants';
import type { GetHoveredLineResult } from '../managers/InteractionManager';
import type {
  DiffLineAnnotation,
  FileContents,
  FileDiffMetadata,
  LineAnnotation,
  MergeConflictResolution,
} from '../types';
import { getLineAnnotationName } from '../utils/getLineAnnotationName';
import { getMergeConflictActionSlotName } from '../utils/getMergeConflictActionSlotName';
import {
  getMergeConflictActionAnchor,
  type MergeConflictDiffAction,
} from '../utils/parseMergeConflictDiffFromFile';

export { DIFFS_TAG_NAME };

export const GUTTER_UTILITY_SLOT_NAME = 'gutter-utility-slot';

export const GutterUtilitySlotStyle = {
  bottom: 0,
  position: 'absolute',
  textAlign: 'center',
  top: 0,
} as const;

export const MergeConflictSlotStyle = {
  display: 'contents',
} as const;

export function noopRender(): null {
  return null;
}

export function raw<T>(value: T): T {
  return toRaw(value);
}

export function hasExistingPrerenderedContent(host: HTMLElement): boolean {
  if ((host.shadowRoot?.children.length ?? 0) > 0) {
    return true;
  }

  return (
    host.querySelector('template[shadowrootmode="open"]') instanceof
    HTMLTemplateElement
  );
}

export function renderPrerenderedTemplate(
  prerenderedHTML: string | undefined
): VNodeChild[] {
  if (prerenderedHTML == null) {
    return [];
  }

  return [
    h('template', {
      innerHTML: prerenderedHTML,
      shadowrootmode: 'open',
    }),
  ];
}

export function renderFileSlots<LAnnotation>({
  file,
  getHoveredLine,
  lineAnnotations,
  slots,
}: {
  file: FileContents;
  getHoveredLine(): GetHoveredLineResult<'file'> | undefined;
  lineAnnotations: LineAnnotation<LAnnotation>[] | undefined;
  slots: Slots;
}): { children: VNodeChild[]; hasCustomHeader: boolean } {
  const children: VNodeChild[] = [];
  const customHeader = slots.header?.({ file });
  const hasCustomHeader = hasRenderedSlotContent(customHeader);
  if (hasCustomHeader) {
    children.push(h('div', { slot: CUSTOM_HEADER_SLOT_ID }, customHeader));
  } else {
    const prefix = slots['header-prefix']?.({ file });
    const metadata = slots['header-metadata']?.({ file });
    if (prefix != null) {
      children.push(h('div', { slot: HEADER_PREFIX_SLOT_ID }, prefix));
    }
    if (metadata != null) {
      children.push(h('div', { slot: HEADER_METADATA_SLOT_ID }, metadata));
    }
  }

  const annotationSlot = slots.annotation;
  if (annotationSlot != null) {
    for (const annotation of lineAnnotations ?? []) {
      children.push(
        h(
          'div',
          { slot: getLineAnnotationName(annotation) },
          annotationSlot({ annotation })
        )
      );
    }
  }

  const gutterUtility = slots['gutter-utility'];
  if (gutterUtility != null) {
    children.push(
      h(
        'div',
        { slot: GUTTER_UTILITY_SLOT_NAME, style: GutterUtilitySlotStyle },
        gutterUtility({ getHoveredLine })
      )
    );
  }

  return { children, hasCustomHeader };
}

export function renderDiffSlots<LAnnotation, T>({
  actions,
  fileDiff,
  getHoveredLine,
  getInstance,
  lineAnnotations,
  resolveConflict,
  slots,
}: {
  actions?: (MergeConflictDiffAction | undefined)[];
  fileDiff: FileDiffMetadata;
  getHoveredLine(): GetHoveredLineResult<'diff'> | undefined;
  getInstance?(): T | undefined;
  lineAnnotations: DiffLineAnnotation<LAnnotation>[] | undefined;
  resolveConflict?(
    action: MergeConflictDiffAction,
    resolution: MergeConflictResolution
  ): void;
  slots: Slots;
}): { children: VNodeChild[]; hasCustomHeader: boolean } {
  const children: VNodeChild[] = [];
  const customHeader = slots.header?.({ fileDiff });
  const hasCustomHeader = hasRenderedSlotContent(customHeader);
  if (hasCustomHeader) {
    children.push(h('div', { slot: CUSTOM_HEADER_SLOT_ID }, customHeader));
  } else {
    const prefix = slots['header-prefix']?.({ fileDiff });
    const metadata = slots['header-metadata']?.({ fileDiff });
    if (prefix != null) {
      children.push(h('div', { slot: HEADER_PREFIX_SLOT_ID }, prefix));
    }
    if (metadata != null) {
      children.push(h('div', { slot: HEADER_METADATA_SLOT_ID }, metadata));
    }
  }

  const annotationSlot = slots.annotation;
  if (annotationSlot != null) {
    for (const annotation of lineAnnotations ?? []) {
      children.push(
        h(
          'div',
          { slot: getLineAnnotationName(annotation) },
          annotationSlot({ annotation })
        )
      );
    }
  }

  const mergeConflictUtility = slots['merge-conflict-utility'];
  if (
    mergeConflictUtility != null &&
    actions != null &&
    getInstance != null &&
    resolveConflict != null
  ) {
    for (const action of actions) {
      if (action == null) {
        continue;
      }

      const anchor = getMergeConflictActionAnchor(action, fileDiff);
      if (anchor == null) {
        continue;
      }

      children.push(
        h(
          'div',
          {
            slot: getMergeConflictActionSlotName({
              conflictIndex: action.conflictIndex,
              hunkIndex: anchor.hunkIndex,
              lineIndex: anchor.lineIndex,
            }),
            style: MergeConflictSlotStyle,
          },
          mergeConflictUtility({
            action,
            context: {
              resolveConflict: (resolution: unknown) => {
                resolveConflict(action, resolution as MergeConflictResolution);
              },
            },
            getInstance,
          })
        )
      );
    }
  }

  const gutterUtility = slots['gutter-utility'];
  if (gutterUtility != null) {
    children.push(
      h(
        'div',
        { slot: GUTTER_UTILITY_SLOT_NAME, style: GutterUtilitySlotStyle },
        gutterUtility({ getHoveredLine })
      )
    );
  }

  return { children, hasCustomHeader };
}

export function hasSlot(slots: Slots, name: string): boolean {
  return slots[name] != null;
}

function hasRenderedSlotContent(content: VNodeChild): boolean {
  if (content == null || typeof content === 'boolean' || content === '') {
    return false;
  }

  if (Array.isArray(content)) {
    return content.some(hasRenderedSlotContent);
  }

  if (isVNode(content)) {
    if (content.type === Comment) {
      return false;
    }
    if (content.type === Fragment) {
      return hasRenderedSlotContent(content.children as VNodeChild);
    }
    if (content.type === Text) {
      return hasRenderedSlotContent(content.children as VNodeChild);
    }
  }

  return true;
}
