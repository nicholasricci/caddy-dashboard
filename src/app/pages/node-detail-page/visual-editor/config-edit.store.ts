import { Injectable, signal } from '@angular/core';

export type JsonPath = (string | number)[];

export interface HydrateResult {
  ok: boolean;
  error: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneContainer(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (isObject(value)) {
    return { ...value };
  }
  return value;
}

function nextContainerFor(segment: string | number): Record<string, unknown> | unknown[] {
  return typeof segment === 'number' ? [] : {};
}

@Injectable()
export class ConfigEditStore {
  readonly config = signal<unknown>({});
  readonly parseError = signal<string | null>(null);

  hydrate(text: string): HydrateResult {
    try {
      const parsed = text.trim() ? (JSON.parse(text) as unknown) : {};
      this.config.set(parsed);
      this.parseError.set(null);
      return { ok: true, error: null };
    } catch {
      const error = 'Invalid JSON.';
      this.parseError.set(error);
      return { ok: false, error };
    }
  }

  setConfig(value: unknown): void {
    this.config.set(value);
    this.parseError.set(null);
  }

  serialize(pretty = true): string {
    return JSON.stringify(this.config(), null, pretty ? 2 : 0);
  }

  readAt(path: JsonPath): unknown {
    let current: unknown = this.config();
    for (const segment of path) {
      if (Array.isArray(current) && typeof segment === 'number') {
        current = current[segment];
        continue;
      }
      if (isObject(current) && typeof segment === 'string') {
        current = current[segment];
        continue;
      }
      return undefined;
    }
    return current;
  }

  updateAt(path: JsonPath, updater: (value: unknown) => unknown): void {
    const root = this.config();
    const next = this.updateRecursive(root, path, 0, updater);
    this.config.set(next);
  }

  insertAt(path: JsonPath, value: unknown, index?: number): void {
    const target = this.readAt(path);
    if (!Array.isArray(target)) {
      return;
    }
    const next = [...target];
    const insertIndex = index == null ? next.length : Math.max(0, Math.min(index, next.length));
    next.splice(insertIndex, 0, value);
    this.updateAt(path, () => next);
  }

  removeAt(path: JsonPath): void {
    if (path.length === 0) {
      return;
    }
    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    const parent = this.readAt(parentPath);
    if (Array.isArray(parent) && typeof key === 'number') {
      if (key < 0 || key >= parent.length) {
        return;
      }
      const next = [...parent];
      next.splice(key, 1);
      this.updateAt(parentPath, () => next);
      return;
    }
    if (isObject(parent) && typeof key === 'string' && key in parent) {
      const next = { ...parent };
      delete next[key];
      this.updateAt(parentPath, () => next);
    }
  }

  private updateRecursive(
    node: unknown,
    path: JsonPath,
    depth: number,
    updater: (value: unknown) => unknown
  ): unknown {
    if (depth >= path.length) {
      return updater(node);
    }

    const segment = path[depth];
    const currentContainer = cloneContainer(node);

    if (typeof segment === 'number') {
      const arr = Array.isArray(currentContainer) ? [...currentContainer] : [];
      const existing = arr[segment];
      const child = this.updateRecursive(
        existing ?? nextContainerFor(path[depth + 1] ?? ''),
        path,
        depth + 1,
        updater
      );
      arr[segment] = child;
      return arr;
    }

    const obj = isObject(currentContainer) ? { ...currentContainer } : {};
    const existing = obj[segment];
    obj[segment] = this.updateRecursive(
      existing ?? nextContainerFor(path[depth + 1] ?? ''),
      path,
      depth + 1,
      updater
    );
    return obj;
  }
}
