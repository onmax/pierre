import type { PreloadFileOptions } from '@pierre/diffs/ssr';

export const VUE_API_MULTI_FILE_DIFF: PreloadFileOptions<undefined> = {
  file: {
    name: 'multi-file-diff.vue',
    contents: `<script setup lang="ts">
import { MultiFileDiff } from '@pierre/diffs/vue';
import type { FileContents } from '@pierre/diffs';

const props = defineProps<{
  oldFile: FileContents;
  newFile: FileContents;
}>();
</script>

<template>
  <MultiFileDiff
    :old-file="props.oldFile"
    :new-file="props.newFile"
    :options="{ theme: 'pierre-dark' }"
  />
</template>`,
  },
};

export const VUE_API_PATCH_DIFF: PreloadFileOptions<undefined> = {
  file: {
    name: 'patch-diff.vue',
    contents: `<script setup lang="ts">
import { PatchDiff } from '@pierre/diffs/vue';

const props = defineProps<{
  patch: string;
}>();
</script>

<template>
  <PatchDiff
    :patch="props.patch"
    :options="{ diffStyle: 'unified' }"
  />
</template>`,
  },
};

export const VUE_API_SLOTS: PreloadFileOptions<undefined> = {
  file: {
    name: 'annotated-diff.vue',
    contents: `<script setup lang="ts">
import { FileDiff } from '@pierre/diffs/vue';
import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs';

const props = defineProps<{
  fileDiff: FileDiffMetadata;
  annotations: DiffLineAnnotation<{ body: string }>[];
}>();
</script>

<template>
  <FileDiff
    :file-diff="props.fileDiff"
    :line-annotations="props.annotations"
  >
    <template #header="{ fileDiff }">
      <strong>{{ fileDiff.name }}</strong>
    </template>
    <template #annotation="{ annotation }">
      <p>{{ annotation.metadata.body }}</p>
    </template>
  </FileDiff>
</template>`,
  },
};

export const VUE_API_VIRTUALIZER: PreloadFileOptions<undefined> = {
  file: {
    name: 'virtualized-diffs.vue',
    contents: `<script setup lang="ts">
import { FileDiff, Virtualizer } from '@pierre/diffs/vue';
import type { FileDiffMetadata } from '@pierre/diffs';

const props = defineProps<{
  files: FileDiffMetadata[];
}>();
</script>

<template>
  <Virtualizer class="diff-scroll" :content-style="{ display: 'grid', gap: '16px' }">
    <FileDiff
      v-for="fileDiff in props.files"
      :key="fileDiff.name"
      :file-diff="fileDiff"
    />
  </Virtualizer>
</template>`,
  },
};

export const VUE_API_WORKER_POOL: PreloadFileOptions<undefined> = {
  file: {
    name: 'worker-pool.vue',
    contents: `<script setup lang="ts">
import {
  FileDiff,
  WorkerPoolProvider,
} from '@pierre/diffs/vue';
import workerUrl from '@pierre/diffs/worker/worker.js?worker&url';
import type { FileDiffMetadata } from '@pierre/diffs';

const props = defineProps<{
  fileDiff: FileDiffMetadata;
}>();
</script>

<template>
  <WorkerPoolProvider
    :pool-options="{
      workerFactory: () => new Worker(workerUrl, { type: 'module' }),
    }"
    :highlighter-options="{ langs: ['typescript'], theme: 'pierre-dark' }"
  >
    <FileDiff :file-diff="props.fileDiff" />
  </WorkerPoolProvider>
</template>`,
  },
};

export const VUE_API_SSR: PreloadFileOptions<undefined> = {
  file: {
    name: 'hydrated-file.vue',
    contents: `<script setup lang="ts">
import { File } from '@pierre/diffs/vue';
import type { PreloadedFileResult } from '@pierre/diffs/ssr';

const props = defineProps<{
  preloadedFile: PreloadedFileResult<undefined>;
}>();
</script>

<template>
  <File
    :file="props.preloadedFile.file"
    :options="props.preloadedFile.options"
    :line-annotations="props.preloadedFile.annotations"
    :prerendered-html="props.preloadedFile.prerenderedHTML"
  />
</template>`,
  },
};
