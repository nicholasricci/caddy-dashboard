import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConfigEditStore } from './config-edit.store';
import { ServerBlockComponent } from './server-block.component';
import type { CaddyHttpServer } from './types';

@Component({
  selector: 'app-visual-config-editor',
  standalone: true,
  imports: [ServerBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-full min-h-0 overflow-y-auto overscroll-contain'
  },
  template: `
    <div class="min-h-full p-4 md:p-5 space-y-5 bg-stitch-surface-lowest">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-display text-lg text-stitch-on-surface">Visual HTTP editor</h3>
        <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="addServer()">Add server</button>
      </div>

      @for (serverName of serverNames(); track serverName) {
        <app-server-block
          [name]="serverName"
          [value]="serverByName(serverName)"
          (valueChanged)="setServer(serverName, $event)"
          (removeRequested)="removeServer(serverName)"
          (duplicateRequested)="duplicateServer(serverName)"
        />
      } @empty {
        <div class="stitch-panel stitch-panel--dim text-center py-10">
          <p class="text-sm text-stitch-on-surface-variant">No HTTP servers found under apps.http.servers.</p>
        </div>
      }
    </div>
  `
})
export class VisualConfigEditorComponent {
  readonly store = input.required<ConfigEditStore>();
  readonly configChanged = output<void>();

  serverNames(): string[] {
    const servers = this.serversRecord();
    return Object.keys(servers);
  }

  serverByName(name: string): CaddyHttpServer {
    return (this.serversRecord()[name] ?? {}) as CaddyHttpServer;
  }

  addServer(): void {
    const id = `srv${Date.now()}`;
    this.store().updateAt(['apps', 'http', 'servers', id], value => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
      return { listen: [':443'], routes: [] };
    });
    this.configChanged.emit();
  }

  setServer(name: string, server: CaddyHttpServer): void {
    this.store().updateAt(['apps', 'http', 'servers', name], () => server);
    this.configChanged.emit();
  }

  removeServer(name: string): void {
    this.store().removeAt(['apps', 'http', 'servers', name]);
    this.configChanged.emit();
  }

  duplicateServer(name: string): void {
    const source = this.serverByName(name);
    const nextName = `${name}_copy`;
    this.store().updateAt(['apps', 'http', 'servers', nextName], () => JSON.parse(JSON.stringify(source)) as CaddyHttpServer);
    this.configChanged.emit();
  }

  private serversRecord(): Record<string, unknown> {
    const current = this.store().readAt(['apps', 'http', 'servers']);
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return {};
    }
    return current as Record<string, unknown>;
  }
}
