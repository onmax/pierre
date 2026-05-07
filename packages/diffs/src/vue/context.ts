import { inject, type InjectionKey } from 'vue';

import type { Virtualizer } from '../components/Virtualizer';
import type { WorkerPoolManager } from '../worker';

export const VirtualizerInjectionKey: InjectionKey<Virtualizer | undefined> =
  Symbol('DiffsVirtualizer');

export const WorkerPoolInjectionKey: InjectionKey<
  WorkerPoolManager | undefined
> = Symbol('DiffsWorkerPool');

export function useVirtualizer(): Virtualizer | undefined {
  return inject(VirtualizerInjectionKey, undefined);
}

export function useWorkerPool(): WorkerPoolManager | undefined {
  return inject(WorkerPoolInjectionKey, undefined);
}
