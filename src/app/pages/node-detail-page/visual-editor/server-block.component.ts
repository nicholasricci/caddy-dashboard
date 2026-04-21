import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BlockShellComponent } from './block-shell.component';
import { RouteBlockComponent } from './route-block.component';
import type { CaddyHttpServer, CaddyRoute } from './types';
import { fromLines, toLines } from './value-utils';

@Component({
  selector: 'app-server-block',
  standalone: true,
  imports: [BlockShellComponent, RouteBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-block-shell
      [title]="'Server: ' + name()"
      subtitle="apps.http.servers"
      [showDuplicate]="true"
      [showRemove]="true"
      (remove)="removeRequested.emit()"
      (duplicate)="duplicateRequested.emit()"
    >
      <div class="space-y-4">
        <label class="form-control">
          <span class="label-text text-xs text-stitch-on-surface-variant">Listen addresses (one per line)</span>
          <textarea
            class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
            [value]="listenText()"
            (change)="setListen(($any($event.target).value ?? '').toString())"
          ></textarea>
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text text-xs text-stitch-on-surface-variant">Read timeout</span>
            <input
              type="text"
              class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs"
              [value]="value().read_timeout ?? ''"
              (change)="setReadTimeout(($any($event.target).value ?? '').toString())"
            />
          </label>
          <label class="form-control">
            <span class="label-text text-xs text-stitch-on-surface-variant">Idle timeout</span>
            <input
              type="text"
              class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs"
              [value]="value().idle_timeout ?? ''"
              (change)="setIdleTimeout(($any($event.target).value ?? '').toString())"
            />
          </label>
        </div>
      </div>

      <div class="space-y-4 mt-4">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wider text-stitch-on-surface-variant">Routes</p>
          <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="addRoute()">Add route</button>
        </div>
        @for (route of routes(); track $index) {
          <app-route-block
            [value]="route"
            [showRemove]="true"
            (valueChanged)="setRoute($index, $event)"
            (removeRequested)="removeRoute($index)"
            (duplicateRequested)="duplicateRoute($index)"
          />
        } @empty {
          <p class="text-xs text-stitch-on-surface-variant">No routes configured.</p>
        }
      </div>
    </app-block-shell>
  `
})
export class ServerBlockComponent {
  readonly name = input.required<string>();
  readonly value = input.required<CaddyHttpServer>();
  readonly valueChanged = output<CaddyHttpServer>();
  readonly removeRequested = output<void>();
  readonly duplicateRequested = output<void>();

  listenText(): string {
    return toLines(this.value().listen);
  }

  routes(): CaddyRoute[] {
    return this.value().routes ?? [];
  }

  setListen(value: string): void {
    this.valueChanged.emit({ ...this.value(), listen: fromLines(value) });
  }

  setReadTimeout(value: string): void {
    this.valueChanged.emit({ ...this.value(), read_timeout: value.trim() });
  }

  setIdleTimeout(value: string): void {
    this.valueChanged.emit({ ...this.value(), idle_timeout: value.trim() });
  }

  addRoute(): void {
    this.valueChanged.emit({ ...this.value(), routes: [...this.routes(), { match: [], handle: [] }] });
  }

  setRoute(index: number, route: CaddyRoute): void {
    const next = [...this.routes()];
    next[index] = route;
    this.valueChanged.emit({ ...this.value(), routes: next });
  }

  removeRoute(index: number): void {
    const next = [...this.routes()];
    next.splice(index, 1);
    this.valueChanged.emit({ ...this.value(), routes: next });
  }

  duplicateRoute(index: number): void {
    const next = [...this.routes()];
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(next[index])) as CaddyRoute);
    this.valueChanged.emit({ ...this.value(), routes: next });
  }
}
