import { defineComponent, markRaw, type PropType, type VNodeChild } from 'vue';

import {
  getOrCreateWorkerPoolSingleton,
  type SetupWorkerPoolProps,
  terminateWorkerPoolSingleton,
  type WorkerInitializationRenderOptions,
  type WorkerPoolManager,
  type WorkerPoolOptions,
} from '../worker';
import { WorkerPoolInjectionKey } from './context';

export type { WorkerInitializationRenderOptions, WorkerPoolOptions };

let workerProviderCount = 0;

export type WorkerPoolProviderProps = SetupWorkerPoolProps;

export const WorkerPoolProvider = defineComponent({
  name: 'WorkerPoolProvider',
  props: {
    highlighterOptions: {
      required: true,
      type: Object as PropType<WorkerInitializationRenderOptions>,
    },
    poolOptions: {
      required: true,
      type: Object as PropType<WorkerPoolOptions>,
    },
  },
  data(): {
    workerPool: WorkerPoolManager | undefined;
  } {
    return {
      workerPool:
        typeof window === 'undefined'
          ? undefined
          : markRaw(
              getOrCreateWorkerPoolSingleton({
                highlighterOptions: this.highlighterOptions,
                poolOptions: this.poolOptions,
              })
            ),
    };
  },
  provide(): Record<symbol, WorkerPoolManager | undefined> {
    return {
      [WorkerPoolInjectionKey as symbol]: this.workerPool as
        | WorkerPoolManager
        | undefined,
    };
  },
  mounted(): void {
    if (this.workerPool != null) {
      workerProviderCount++;
    }
  },
  beforeUnmount(): void {
    if (this.workerPool == null) {
      return;
    }

    workerProviderCount--;
    if (workerProviderCount === 0) {
      terminateWorkerPoolSingleton();
    }
  },
  render(): VNodeChild {
    return this.$slots.default?.();
  },
});

export const WorkerPoolContextProvider = WorkerPoolProvider;
