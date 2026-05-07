import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import { JSDOM } from 'jsdom';
import type { App, Component, VNodeChild } from 'vue';

import type { VueUnresolvedFileOptions } from '../src/vue';

let createApp: typeof import('vue').createApp;
let createSSRApp: typeof import('vue').createSSRApp;
let defineComponent: typeof import('vue').defineComponent;
let h: typeof import('vue').h;
let nextTick: typeof import('vue').nextTick;
let renderToString: typeof import('@vue/server-renderer').renderToString;
let FileVue: typeof import('../src/vue').File;
let FileDiffVue: typeof import('../src/vue').FileDiff;
let MultiFileDiffVue: typeof import('../src/vue').MultiFileDiff;
let PatchDiffVue: typeof import('../src/vue').PatchDiff;
let UnresolvedFileVue: typeof import('../src/vue').UnresolvedFile;
let VirtualizerVue: typeof import('../src/vue').Virtualizer;
let FileClass: typeof import('../src/components/File').File;
let VirtualizerClass: typeof import('../src/components/Virtualizer').Virtualizer;
let parseDiffFromFile: typeof import('../src').parseDiffFromFile;
let preloadFile: typeof import('../src/ssr').preloadFile;

const TAG = 'diffs-container';
const originalGlobals = {
  CSSStyleSheet: Reflect.get(globalThis, 'CSSStyleSheet'),
  customElements: Reflect.get(globalThis, 'customElements'),
  document: Reflect.get(globalThis, 'document'),
  Document: Reflect.get(globalThis, 'Document'),
  Element: Reflect.get(globalThis, 'Element'),
  HTMLElement: Reflect.get(globalThis, 'HTMLElement'),
  HTMLPreElement: Reflect.get(globalThis, 'HTMLPreElement'),
  HTMLStyleElement: Reflect.get(globalThis, 'HTMLStyleElement'),
  HTMLTemplateElement: Reflect.get(globalThis, 'HTMLTemplateElement'),
  IntersectionObserver: Reflect.get(globalThis, 'IntersectionObserver'),
  MouseEvent: Reflect.get(globalThis, 'MouseEvent'),
  navigator: Reflect.get(globalThis, 'navigator'),
  Node: Reflect.get(globalThis, 'Node'),
  requestAnimationFrame: Reflect.get(globalThis, 'requestAnimationFrame'),
  ResizeObserver: Reflect.get(globalThis, 'ResizeObserver'),
  SVGElement: Reflect.get(globalThis, 'SVGElement'),
  window: Reflect.get(globalThis, 'window'),
};

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost',
});

class MockCSSStyleSheet {
  replaceSync(_value: string): void {}
}

class MockIntersectionObserver {
  disconnect(): void {}
  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
}

class MockResizeObserver {
  disconnect(): void {}
  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
}

beforeAll(async () => {
  Object.assign(globalThis, {
    CSSStyleSheet: MockCSSStyleSheet,
    customElements: dom.window.customElements,
    document: dom.window.document,
    Document: dom.window.Document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLPreElement: dom.window.HTMLPreElement,
    HTMLStyleElement: dom.window.HTMLStyleElement,
    HTMLTemplateElement: dom.window.HTMLTemplateElement,
    IntersectionObserver: MockIntersectionObserver,
    MouseEvent: dom.window.MouseEvent,
    navigator: dom.window.navigator,
    Node: dom.window.Node,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(Date.now()), 0) as unknown as number;
    },
    ResizeObserver: MockResizeObserver,
    SVGElement: dom.window.SVGElement,
    window: dom.window,
  });

  ({ createApp, createSSRApp, defineComponent, h, nextTick } =
    await import('vue'));
  ({ renderToString } = await import('@vue/server-renderer'));
  ({
    File: FileVue,
    FileDiff: FileDiffVue,
    MultiFileDiff: MultiFileDiffVue,
    PatchDiff: PatchDiffVue,
    UnresolvedFile: UnresolvedFileVue,
    Virtualizer: VirtualizerVue,
  } = await import('../src/vue'));
  ({ File: FileClass } = await import('../src/components/File'));
  ({ Virtualizer: VirtualizerClass } =
    await import('../src/components/Virtualizer'));
  ({ parseDiffFromFile } = await import('../src'));
  ({ preloadFile } = await import('../src/ssr'));
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else {
      Object.assign(globalThis, { [key]: value });
    }
  }

  dom.window.close();
});

async function flushDom(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mountComponent(
  component: Component,
  container: HTMLElement
): Promise<App<Element>> {
  const app = createApp(component);
  app.mount(container);
  await flushDom();
  return app;
}

function getHosts(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(TAG)).filter(
    (host): host is HTMLElement => host instanceof dom.window.HTMLElement
  );
}

function dispatchClick(target: Element): void {
  target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

const file = {
  contents: 'const value = 1;\n',
  name: 'file.ts',
};

const oldFile = {
  contents: 'const value = 1;\n',
  name: 'file.ts',
};

const newFile = {
  contents: 'const value = 2;\n',
  name: 'file.ts',
};

const patch = `diff --git a/file.ts b/file.ts
index 0000000..1111111 100644
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-const value = 1;
+const value = 2;
`;

const unresolvedFile = {
  contents: `const value = 1;
<<<<<<< HEAD
const conflict = 'current';
=======
const conflict = 'incoming';
>>>>>>> branch
`,
  name: 'file.ts',
};

describe('diffs Vue lane', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  test('renders the core Vue components', async () => {
    const fileDiff = parseDiffFromFile(oldFile, newFile);
    const component = defineComponent({
      render(): VNodeChild {
        return h('div', [
          h(FileVue, { file }),
          h(FileDiffVue, { fileDiff }),
          h(MultiFileDiffVue, { newFile, oldFile }),
          h(PatchDiffVue, { patch }),
          h(UnresolvedFileVue, { file: unresolvedFile }),
        ]);
      },
    });

    const app = await mountComponent(component, container);
    try {
      const hosts = getHosts(container);
      expect(hosts).toHaveLength(5);
      for (const host of hosts) {
        expect(host.shadowRoot?.querySelector('pre')).not.toBeNull();
      }
    } finally {
      app.unmount();
    }
  });

  test('renders header, annotation, gutter, and merge-conflict slots', async () => {
    const component = defineComponent({
      render(): VNodeChild {
        return h('div', [
          h(
            FileVue,
            {
              file,
              lineAnnotations: [{ lineNumber: 1, metadata: 'note' }],
            },
            {
              annotation: ({
                annotation,
              }: {
                annotation: { metadata: string };
              }) =>
                h(
                  'span',
                  { 'data-test-file-annotation': '' },
                  annotation.metadata
                ),
              'gutter-utility': ({
                getHoveredLine,
              }: {
                getHoveredLine(): unknown;
              }) =>
                h(
                  'button',
                  { 'data-test-file-gutter': '', type: 'button' },
                  getHoveredLine() == null ? 'idle' : 'hovered'
                ),
              header: ({ file }: { file: { name: string } }) =>
                h('button', { 'data-test-file-header': '' }, file.name),
            }
          ),
          h(
            UnresolvedFileVue,
            { file: unresolvedFile },
            {
              'merge-conflict-utility': ({
                action,
                context,
              }: {
                action: { conflictIndex: number };
                context: { resolveConflict(resolution: 'current'): void };
              }) =>
                h(
                  'button',
                  {
                    'data-test-conflict-action': '',
                    onClick: () => context.resolveConflict('current'),
                    type: 'button',
                  },
                  String(action.conflictIndex)
                ),
            }
          ),
        ]);
      },
    });

    const app = await mountComponent(component, container);
    try {
      expect(
        container.querySelector('[data-test-file-header]')?.textContent
      ).toBe('file.ts');
      expect(
        container.querySelector('[data-test-file-annotation]')?.textContent
      ).toBe('note');
      expect(
        container.querySelector('[data-test-file-gutter]')?.textContent
      ).toBe('idle');

      const conflictAction = container.querySelector(
        '[data-test-conflict-action]'
      );
      if (!(conflictAction instanceof dom.window.HTMLElement)) {
        throw new Error('expected merge conflict action slot');
      }

      dispatchClick(conflictAction);
      await flushDom();
      expect(container.querySelector('[data-test-conflict-action]')).toBeNull();
    } finally {
      app.unmount();
    }
  });

  test('does not expose core merge-conflict callbacks in Vue options', () => {
    const options: VueUnresolvedFileOptions<unknown> = {
      mergeConflictActionsType: 'default',
    };
    expect(options.mergeConflictActionsType).toBe('default');

    const actionOptions: VueUnresolvedFileOptions<unknown> = {
      // @ts-expect-error Vue unresolved files own this callback internally.
      onMergeConflictAction: () => {},
    };
    const resolveOptions: VueUnresolvedFileOptions<unknown> = {
      // @ts-expect-error Vue users resolve conflicts through slot context.
      onMergeConflictResolve: () => {},
    };
    expect(actionOptions).toBeDefined();
    expect(resolveOptions).toBeDefined();
  });

  test('falls back to prefix and metadata slots when header slots are empty', async () => {
    const fileDiff = parseDiffFromFile(oldFile, newFile);
    const component = defineComponent({
      render(): VNodeChild {
        return h('div', [
          h(
            FileVue,
            { file },
            {
              header: () => [],
              'header-prefix': () =>
                h('span', { 'data-test-file-prefix': '' }, 'file prefix'),
            }
          ),
          h(
            FileDiffVue,
            { fileDiff },
            {
              header: () => [],
              'header-metadata': () =>
                h('span', { 'data-test-diff-metadata': '' }, 'diff metadata'),
            }
          ),
        ]);
      },
    });

    const app = await mountComponent(component, container);
    try {
      expect(
        container.querySelector('[data-test-file-prefix]')?.textContent
      ).toBe('file prefix');
      expect(
        container.querySelector('[data-test-diff-metadata]')?.textContent
      ).toBe('diff metadata');
    } finally {
      app.unmount();
    }
  });

  test('updates props without cleaning up the renderer instance', async () => {
    const cleanUpSpy = spyOn(FileClass.prototype, 'cleanUp');
    const component = defineComponent({
      data() {
        return {
          file,
        };
      },
      methods: {
        updateFile() {
          this.file = {
            contents: 'const value = 2;\n',
            name: 'file.ts',
          };
        },
      },
      render(): VNodeChild {
        return h('div', [
          h(
            'button',
            {
              'data-test-update': '',
              onClick: this.updateFile,
              type: 'button',
            },
            'Update'
          ),
          h(FileVue, { file: this.file }),
        ]);
      },
    });

    const app = await mountComponent(component, container);
    try {
      const update = container.querySelector('[data-test-update]');
      if (!(update instanceof dom.window.HTMLElement)) {
        throw new Error('expected update button');
      }

      dispatchClick(update);
      await flushDom();
      expect(cleanUpSpy).toHaveBeenCalledTimes(0);
    } finally {
      app.unmount();
      expect(cleanUpSpy).toHaveBeenCalledTimes(1);
      cleanUpSpy.mockRestore();
    }
  });

  test('Virtualizer provides virtualized renderer instances to children', async () => {
    const connectSpy = spyOn(VirtualizerClass.prototype, 'connect');
    const component = defineComponent({
      render(): VNodeChild {
        return h(
          VirtualizerVue,
          { style: { height: '200px', overflow: 'auto' } },
          {
            default: () => h(FileVue, { file }),
          }
        );
      },
    });

    const app = await mountComponent(component, container);
    try {
      expect(connectSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      app.unmount();
      connectSpy.mockRestore();
    }
  });

  test('SSR output hydrates without Vue mismatch warnings and keeps slots live', async () => {
    const preloaded = await preloadFile({ file });
    const component = defineComponent({
      data() {
        return {
          count: 0,
        };
      },
      render(): VNodeChild {
        return h(
          FileVue,
          {
            file: preloaded.file,
            options: preloaded.options,
            prerenderedHTML: preloaded.prerenderedHTML,
          },
          {
            header: () =>
              h(
                'button',
                {
                  'data-test-ssr-header': '',
                  onClick: () => {
                    this.count += 1;
                  },
                  type: 'button',
                },
                `Count ${this.count}`
              ),
          }
        );
      },
    });

    const html = await renderToString(createSSRApp(component));
    expect(html).toContain('<diffs-container');
    expect(html).toContain('shadowrootmode="open"');
    expect(html).toContain('data-allow-mismatch="children"');

    container.innerHTML = html;
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const app = createSSRApp(component);
    app.mount(container, true);
    await flushDom();

    try {
      const relevantWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('Hydration')
      );
      const relevantErrors = errorSpy.mock.calls.filter(([message]) =>
        String(message).includes('Hydration')
      );
      expect(relevantWarnings).toHaveLength(0);
      expect(relevantErrors).toHaveLength(0);

      const header = container.querySelector('[data-test-ssr-header]');
      if (!(header instanceof dom.window.HTMLElement)) {
        throw new Error('expected hydrated header slot');
      }

      expect(header.textContent).toBe('Count 0');
      dispatchClick(header);
      await flushDom();
      expect(header.textContent).toBe('Count 1');
    } finally {
      app.unmount();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
