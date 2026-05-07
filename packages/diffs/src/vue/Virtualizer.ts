import {
  defineComponent,
  h,
  markRaw,
  type PropType,
  type VNodeChild,
  type VNodeRef,
} from 'vue';

import {
  Virtualizer as VirtualizerClass,
  type VirtualizerConfig,
} from '../components/Virtualizer';
import { VirtualizerInjectionKey } from './context';

export interface VirtualizerProps {
  config?: Partial<VirtualizerConfig>;
  contentClass?: unknown;
  contentStyle?: unknown;
}

export const Virtualizer = defineComponent({
  name: 'Virtualizer',
  inheritAttrs: false,
  props: {
    config: {
      required: false,
      type: Object as PropType<Partial<VirtualizerConfig>>,
    },
    contentClass: {
      required: false,
      type: [String, Object, Array] as PropType<unknown>,
    },
    contentStyle: {
      required: false,
      type: [String, Object, Array] as PropType<unknown>,
    },
  },
  data(): {
    contentElement: HTMLElement | null;
    rootElement: HTMLElement | null;
    virtualizer: VirtualizerClass | undefined;
  } {
    return {
      contentElement: null,
      rootElement: null,
      virtualizer:
        typeof window === 'undefined'
          ? undefined
          : markRaw(new VirtualizerClass(this.config)),
    };
  },
  provide(): Record<symbol, VirtualizerClass | undefined> {
    return {
      [VirtualizerInjectionKey as symbol]: this.virtualizer as
        | VirtualizerClass
        | undefined,
    };
  },
  mounted(): void {
    if (this.rootElement != null) {
      this.virtualizer?.setup(
        this.rootElement,
        this.contentElement ?? undefined
      );
    }
  },
  beforeUnmount(): void {
    this.virtualizer?.cleanUp();
  },
  methods: {
    setContentElement(node: Element | null): void {
      this.contentElement = node instanceof HTMLElement ? node : null;
    },
    setRootElement(node: Element | null): void {
      this.rootElement = node instanceof HTMLElement ? node : null;
    },
  },
  render(): VNodeChild {
    return h(
      'div',
      {
        ...this.$attrs,
        ref: this.setRootElement as VNodeRef,
      },
      [
        h(
          'div',
          {
            class: this.contentClass,
            ref: this.setContentElement as VNodeRef,
            style: this.contentStyle,
          },
          this.$slots.default?.()
        ),
      ]
    );
  },
});
