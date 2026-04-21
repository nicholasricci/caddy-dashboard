import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { CaddyMatchSet } from './types';
import { fromLines, parseJsonObject, safeObject, toLines } from './value-utils';

@Component({
  selector: 'app-match-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4">
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Host (one per line)</span>
        <textarea class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs" [value]="lines('host')" (change)="setLines('host', ($any($event.target).value ?? '').toString())"></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Path (one per line)</span>
        <textarea class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs" [value]="lines('path')" (change)="setLines('path', ($any($event.target).value ?? '').toString())"></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Method (one per line)</span>
        <textarea class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs" [value]="lines('method')" (change)="setLines('method', ($any($event.target).value ?? '').toString())"></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Protocol</span>
        <input type="text" class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs" [value]="value().protocol ?? ''" (change)="setProtocol(($any($event.target).value ?? '').toString())" />
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Header matcher (JSON object)</span>
        <textarea class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs" [value]="headerText()" (change)="setHeader(($any($event.target).value ?? '').toString())"></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Query matcher (JSON object)</span>
        <textarea class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs" [value]="queryText()" (change)="setQuery(($any($event.target).value ?? '').toString())"></textarea>
      </label>
    </div>
  `
})
export class MatchBlockComponent {
  readonly value = input.required<CaddyMatchSet>();
  readonly valueChanged = output<CaddyMatchSet>();

  lines(key: 'host' | 'path' | 'method'): string {
    return toLines(this.value()[key]);
  }

  setLines(key: 'host' | 'path' | 'method', text: string): void {
    const current = { ...this.value() };
    current[key] = fromLines(text);
    this.valueChanged.emit(current);
  }

  setProtocol(protocol: string): void {
    this.valueChanged.emit({ ...this.value(), protocol });
  }

  headerText(): string {
    return JSON.stringify(safeObject(this.value().header), null, 2);
  }

  queryText(): string {
    return JSON.stringify(safeObject(this.value().query), null, 2);
  }

  setHeader(text: string): void {
    const parsed = parseJsonObject(text, safeObject(this.value().header));
    this.valueChanged.emit({ ...this.value(), header: parsed as Record<string, string[]> });
  }

  setQuery(text: string): void {
    const parsed = parseJsonObject(text, safeObject(this.value().query));
    this.valueChanged.emit({ ...this.value(), query: parsed as Record<string, string[]> });
  }
}
