// Test-only stand-in for the Obsidian API. The real `obsidian` package ships
// type declarations with no runtime entry, so it cannot be imported under
// Vitest; vitest.config.ts aliases it to this stub. Only the names main.ts
// imports need to exist, and only class identity matters — tests exercise the
// pure helpers, never the UI classes.

export class App {}
export class Plugin {}
export class ItemView {}
export class Modal {}
export class Notice {}
export class PluginSettingTab {}
export class Setting {}
export class TFile {}
export class WorkspaceLeaf {}

export const Platform = { isMobile: false };

export type Debouncer<TArgs extends unknown[], TReturn> = ((...args: TArgs) => void) & {
  run(): TReturn | undefined;
  cancel(): void;
};

export function debounce<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): Debouncer<TArgs, TReturn> {
  const wrapped = ((...args: TArgs) => {
    fn(...args);
  }) as Debouncer<TArgs, TReturn>;
  wrapped.run = () => undefined;
  wrapped.cancel = () => {};
  return wrapped;
}

export function normalizePath(path: string): string {
  return path;
}
