import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import type {
  CaddyConfigHostsResponseV1,
  CaddyConfigIdInfoV1,
  CaddyConfigUpstreamsResponseV1
} from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

@Component({
  selector: 'app-live-config-id-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StitchIconComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
        role="presentation"
        tabindex="-1"
        (click)="closeRequested.emit()"
        (keydown.enter)="closeRequested.emit()"
        (keydown.space)="$event.preventDefault(); closeRequested.emit()"
        (keydown.escape)="closeRequested.emit()"
      >
        <div
          class="bg-stitch-surface-lowest w-full max-w-6xl h-[min(90vh,52rem)] rounded-sm border-stitch-ghost shadow-2xl overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'live-config-id-title'"
          (click)="$event.stopPropagation()"
          (keydown.escape)="closeRequested.emit(); $event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <div class="px-6 py-4 border-b border-stitch-ghost shrink-0 flex items-center justify-between gap-4">
            <div class="min-w-0">
              <h3 id="live-config-id-title" class="font-display text-lg font-semibold text-stitch-on-surface flex items-center gap-2">
                <app-stitch-icon name="circleStack" size="sm" class="text-stitch-primary-fixed" />
                Live config @id
              </h3>
              <p class="text-xs font-mono text-stitch-on-surface-variant mt-1 truncate">
                {{ nodeName() || nodeId() || 'Unknown node' }}
              </p>
            </div>
            <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeRequested.emit()">Close</button>
          </div>

          <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[20rem,1fr]">
            <aside class="border-r border-stitch-ghost bg-stitch-surface-low p-4 overflow-y-auto min-h-0">
              <p class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-3">IDs</p>
              @if (loadingIds()) {
                <span class="loading loading-spinner loading-sm text-stitch-on-surface-variant"></span>
              } @else if (idsError()) {
                <p class="text-sm text-stitch-error">{{ idsError() }}</p>
              } @else if (idItems().length === 0) {
                <p class="text-sm text-stitch-on-surface-variant">No @id entries found.</p>
              } @else {
                <ul class="space-y-2">
                  @for (item of idItems(); track trackId(item, $index)) {
                    <li>
                      <button
                        type="button"
                        class="w-full text-left stitch-panel stitch-panel--dim !p-3 border-stitch-ghost hover:bg-stitch-surface-lowest transition-colors"
                        [class.ring-2]="selectedId() === (item.id || '')"
                        [class.ring-stitch-primary]="selectedId() === (item.id || '')"
                        (click)="select(item)"
                      >
                        <p class="font-mono text-xs text-stitch-on-surface break-all">{{ item.id || '(missing id)' }}</p>
                        <p class="text-[11px] text-stitch-on-surface-variant mt-1">
                          Upstreams:
                          {{ item.has_upstreams ? (item.upstream_count ?? (item.upstreams?.length ?? 0)) : 0 }}
                        </p>
                        <p class="text-[11px] text-stitch-on-surface-variant mt-1">
                          Hosts:
                          {{ item.host_count ?? (item.hosts?.length ?? 0) }}
                        </p>
                      </button>
                    </li>
                  }
                </ul>
              }
            </aside>

            <section class="min-h-0 p-4 md:p-5 overflow-y-auto">
              @if (!selectedId()) {
                <p class="text-sm text-stitch-on-surface-variant">Select an @id to inspect config fragment and upstreams.</p>
              } @else {
                <div class="space-y-4">
                  <div class="stitch-panel stitch-panel--dim !p-4">
                    <p class="stitch-panel-title mb-2">Selected ID</p>
                    <p class="font-mono text-xs text-stitch-on-surface break-all">{{ selectedId() }}</p>
                  </div>

                  @if (loadingDetail()) {
                    <span class="loading loading-spinner loading-sm text-stitch-on-surface-variant"></span>
                  } @else if (detailError()) {
                    <p class="text-sm text-stitch-error">{{ detailError() }}</p>
                  } @else {
                    <div class="stitch-panel !p-0 overflow-hidden">
                      <div class="px-4 py-3 border-b border-stitch-ghost">
                        <p class="stitch-panel-title">Config fragment</p>
                      </div>
                      <pre class="p-4 text-xs font-mono text-stitch-on-surface overflow-auto">{{ fragmentPretty() }}</pre>
                    </div>

                    <div class="stitch-panel !p-0 overflow-hidden">
                      <div class="px-4 py-3 border-b border-stitch-ghost">
                        <p class="stitch-panel-title">Upstreams</p>
                      </div>
                      @if (!currentUpstreams()?.has_upstreams) {
                        <p class="p-4 text-sm text-stitch-on-surface-variant">No upstreams linked to this @id.</p>
                      } @else {
                        <pre class="p-4 text-xs font-mono text-stitch-on-surface overflow-auto">{{ upstreamsPretty() }}</pre>
                      }
                    </div>

                    <div class="stitch-panel !p-0 overflow-hidden">
                      <div class="px-4 py-3 border-b border-stitch-ghost">
                        <p class="stitch-panel-title">Hosts</p>
                      </div>
                      @if ((currentHosts()?.host_count ?? 0) === 0) {
                        <p class="p-4 text-sm text-stitch-on-surface-variant">No hosts linked to this @id.</p>
                      } @else {
                        <pre class="p-4 text-xs font-mono text-stitch-on-surface overflow-auto">{{ hostsPretty() }}</pre>
                      }
                    </div>
                  }
                </div>
              }
            </section>
          </div>
        </div>
      </div>
    }
  `
})
export class LiveConfigIdDialogComponent {
  private readonly api = inject(DashboardApiService);
  private loadVersion = 0;

  readonly open = input.required<boolean>();
  readonly nodeId = input<string>('');
  readonly nodeName = input<string>('');
  readonly closeRequested = output<void>();

  readonly loadingIds = signal(false);
  readonly idsError = signal<string | null>(null);
  readonly idItems = signal<CaddyConfigIdInfoV1[]>([]);

  readonly selectedId = signal<string | null>(null);
  readonly loadingDetail = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly currentFragment = signal<Record<string, unknown> | null>(null);
  readonly currentUpstreams = signal<CaddyConfigUpstreamsResponseV1 | null>(null);
  readonly currentHosts = signal<CaddyConfigHostsResponseV1 | null>(null);

  readonly fragmentPretty = computed(() => JSON.stringify(this.currentFragment() ?? {}, null, 2));
  readonly upstreamsPretty = computed(() => JSON.stringify(this.currentUpstreams()?.upstreams ?? [], null, 2));
  readonly hostsPretty = computed(() => JSON.stringify(this.currentHosts()?.hosts ?? [], null, 2));

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const nodeId = this.nodeId();
      if (!nodeId) {
        this.idsError.set('Missing node id.');
        return;
      }
      this.fetchIds(nodeId);
    });
  }

  trackId(item: CaddyConfigIdInfoV1, index: number): string | number {
    return item.id ?? index;
  }

  select(item: CaddyConfigIdInfoV1): void {
    if (!item.id) {
      return;
    }
    const nodeId = this.nodeId();
    if (!nodeId) {
      return;
    }
    const id = item.id;
    this.selectedId.set(id);
    this.loadingDetail.set(true);
    this.detailError.set(null);
    const version = ++this.loadVersion;

    forkJoin({
      fragment: this.api.getLiveConfigById(nodeId, id),
      upstreams: this.api.getLiveConfigUpstreams(nodeId, id),
      hosts: this.api.getLiveConfigHosts(nodeId, id)
    }).subscribe({
      next: result => {
        if (version !== this.loadVersion) {
          return;
        }
        this.currentFragment.set(result.fragment ?? {});
        this.currentUpstreams.set(result.upstreams ?? null);
        this.currentHosts.set(result.hosts ?? null);
        this.loadingDetail.set(false);
      },
      error: err => {
        if (version !== this.loadVersion) {
          return;
        }
        this.loadingDetail.set(false);
        this.detailError.set(err?.error?.error ?? 'Could not load details for this @id.');
      }
    });
  }

  private fetchIds(nodeId: string): void {
    this.loadingIds.set(true);
    this.idsError.set(null);
    this.idItems.set([]);
    this.selectedId.set(null);
    this.currentFragment.set(null);
    this.currentUpstreams.set(null);
    this.currentHosts.set(null);
    this.detailError.set(null);
    this.loadingDetail.set(false);
    const version = ++this.loadVersion;

    this.api.listLiveConfigIds(nodeId).subscribe({
      next: body => {
        if (version !== this.loadVersion) {
          return;
        }
        const items = Array.isArray(body?.items) ? body.items : [];
        this.idItems.set(items);
        this.loadingIds.set(false);
      },
      error: err => {
        if (version !== this.loadVersion) {
          return;
        }
        this.loadingIds.set(false);
        this.idsError.set(err?.error?.error ?? 'Could not load @id entries.');
      }
    });
  }
}
