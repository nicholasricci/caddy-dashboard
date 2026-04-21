import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BlockShellComponent } from './block-shell.component';
import { HandleBlockComponent } from './handle-block.component';
import { MatchBlockComponent } from './match-block.component';
import type { CaddyHandler, CaddyMatchSet, CaddyRoute } from './types';

@Component({
  selector: 'app-route-block',
  standalone: true,
  imports: [BlockShellComponent, MatchBlockComponent, HandleBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-block-shell
      title="Route"
      subtitle="match + handle"
      [showDuplicate]="true"
      [showRemove]="showRemove()"
      (duplicate)="duplicateRequested.emit()"
      (remove)="removeRequested.emit()"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-control">
          <span class="label-text block text-xs text-stitch-on-surface-variant">Route behavior</span>
          <label class="mt-1.5 inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" [checked]="value().terminal === true" (change)="setTerminal(!!$any($event.target).checked)" />
            <span class="text-xs text-stitch-on-surface-variant">Terminal route</span>
          </label>
        </div>
        <label class="form-control">
          <span class="label-text block text-xs text-stitch-on-surface-variant">Group</span>
          <input
            type="text"
            class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs"
            [value]="value().group ?? ''"
            (change)="setGroup(($any($event.target).value ?? '').toString())"
          />
        </label>
      </div>

      <div class="space-y-4 mt-4">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wider text-stitch-on-surface-variant">Match sets</p>
          <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="addMatch()">
            Add match
          </button>
        </div>
        @for (matchSet of matches(); track $index) {
          <app-block-shell title="Match set" [subtitle]="'#' + ($index + 1)" [showRemove]="true" (remove)="removeMatch($index)">
            <app-match-block [value]="matchSet" (valueChanged)="setMatch($index, $event)" />
          </app-block-shell>
        }
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wider text-stitch-on-surface-variant">Handlers</p>
          <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="addHandle()">
            Add handler
          </button>
        </div>
        @for (handler of handles(); track $index) {
          <app-handle-block
            [value]="handler"
            (valueChanged)="setHandle($index, $event)"
            (removeRequested)="removeHandle($index)"
            (duplicateRequested)="duplicateHandle($index)"
          />
        }
      </div>
    </app-block-shell>
  `
})
export class RouteBlockComponent {
  readonly value = input.required<CaddyRoute>();
  readonly showRemove = input(true);
  readonly valueChanged = output<CaddyRoute>();
  readonly removeRequested = output<void>();
  readonly duplicateRequested = output<void>();

  matches(): CaddyMatchSet[] {
    return this.value().match ?? [];
  }

  handles(): CaddyHandler[] {
    return this.value().handle ?? [];
  }

  setTerminal(terminal: boolean): void {
    this.valueChanged.emit({ ...this.value(), terminal });
  }

  setGroup(group: string): void {
    this.valueChanged.emit({ ...this.value(), group: group.trim() });
  }

  addMatch(): void {
    this.valueChanged.emit({ ...this.value(), match: [...this.matches(), {}] });
  }

  setMatch(index: number, match: CaddyMatchSet): void {
    const next = [...this.matches()];
    next[index] = match;
    this.valueChanged.emit({ ...this.value(), match: next });
  }

  removeMatch(index: number): void {
    const next = [...this.matches()];
    next.splice(index, 1);
    this.valueChanged.emit({ ...this.value(), match: next });
  }

  addHandle(): void {
    this.valueChanged.emit({
      ...this.value(),
      handle: [...this.handles(), { handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] }]
    });
  }

  setHandle(index: number, handler: CaddyHandler): void {
    const next = [...this.handles()];
    next[index] = handler;
    this.valueChanged.emit({ ...this.value(), handle: next });
  }

  removeHandle(index: number): void {
    const next = [...this.handles()];
    next.splice(index, 1);
    this.valueChanged.emit({ ...this.value(), handle: next });
  }

  duplicateHandle(index: number): void {
    const next = [...this.handles()];
    const source = next[index];
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(source)) as CaddyHandler);
    this.valueChanged.emit({ ...this.value(), handle: next });
  }
}
