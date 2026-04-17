import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed,
  Injector,
  afterNextRender
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardApiService } from '../../services/dashboard-api.service';
import loader from '@monaco-editor/loader';
import type { editor } from 'monaco-editor';
import type { CaddyNodeV1 } from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import {
  extractCaddyConfigFromSyncResponse,
  extractConfigFromSnapshotRecord,
  isLikelyCaddyConfigRoot
} from './node-detail-sync.util';

function normalizeSnapshots(rows: unknown): Record<string, unknown>[] {
  if (Array.isArray(rows)) {
    return rows as Record<string, unknown>[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['snapshots'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as Record<string, unknown>[];
    }
  }
  return [];
}

@Component({
  selector: 'app-node-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, StitchIconComponent],
  host: {
    class: 'flex w-full flex-1 min-h-0 flex-col'
  },
  template: `
    <div class="flex flex-1 min-h-0 flex-col bg-stitch-surface">
      <header class="px-10 py-8 bg-stitch-surface-low border-b border-stitch-ghost">
        <div class="flex flex-wrap items-start justify-between gap-6">
          <div>
            <a
              routerLink="/"
              class="text-xs font-mono text-stitch-primary-fixed hover:text-stitch-on-surface mb-3 inline-flex items-center gap-1"
            >
              <app-stitch-icon name="chevronLeft" size="xs" />
              Server overview
            </a>
            <h2 class="font-display text-2xl font-semibold text-stitch-on-surface flex items-center gap-3">
              <app-stitch-icon name="document" class="text-stitch-primary-fixed shrink-0" />
              {{ node()?.name || nodeId }}
            </h2>
            @if (node(); as n) {
              <p class="text-xs font-mono text-stitch-on-surface-variant mt-2 flex items-center gap-2 flex-wrap">
                <span class="stitch-status-chip">{{ n.status || 'unknown' }}</span>
                <span>·</span>
                <span>{{ n.private_ip || 'no IP' }}</span>
              </p>
            }
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
              (click)="openSyncConfirm()"
              [disabled]="busy()"
            >
              <app-stitch-icon name="sync" size="xs" />
              Sync
            </button>
            <button
              type="button"
              class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
              (click)="openReloadConfirm()"
              [disabled]="busy()"
            >
              <app-stitch-icon name="reload" size="xs" />
              Reload Caddy
            </button>
            <button
              type="button"
              class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
              (click)="openApplyConfirm()"
              [disabled]="busy() || !editorOk()"
            >
              <app-stitch-icon name="apply" size="xs" />
              Apply config
            </button>
          </div>
        </div>
      </header>

      <div class="flex flex-1 min-h-0 min-h-[32rem] w-full">
        <div class="flex-1 min-w-0 min-h-0 bg-stitch-surface-lowest flex flex-col">
          <div
            class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stitch-ghost bg-stitch-surface-low shrink-0"
          >
            <button
              type="button"
              class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
              (click)="openFormatConfirm()"
            >
              <app-stitch-icon name="sparkles" size="xs" />
              Format JSON
            </button>
            <button
              type="button"
              class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
              (click)="openCopyConfirm()"
            >
              <app-stitch-icon name="clipboard" size="xs" />
              Copy
            </button>
            <span class="text-[10px] uppercase tracking-wider text-stitch-on-surface-variant ml-auto font-medium">
              Editor
            </span>
          </div>
          <div #editorHost class="flex-1 min-h-0 min-h-[24rem] w-full relative"></div>
        </div>
        <aside class="w-[22rem] shrink-0 bg-stitch-surface-dim px-5 py-6 overflow-y-auto border-l border-stitch-ghost space-y-6">
          @if (node(); as n) {
            <div class="stitch-panel stitch-panel--dim !p-4">
              <p class="stitch-panel-title">Node metadata</p>
              <dl class="space-y-3 text-xs font-mono text-stitch-on-surface">
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">ID</dt>
                  <dd class="text-right truncate" [title]="n.id || ''">{{ n.id || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">SSM</dt>
                  <dd>{{ n.ssm_enabled ? 'Yes' : 'No' }}</dd>
                </div>
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">Instance</dt>
                  <dd class="text-right truncate" [title]="n.instance_id || ''">{{ n.instance_id || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">Region</dt>
                  <dd>{{ n.region || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">Created</dt>
                  <dd class="text-right truncate text-[10px]" [title]="n.created_at || ''">
                    {{ n.created_at || '—' }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2 border-b border-stitch-ghost/50 pb-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">Updated</dt>
                  <dd class="text-right truncate text-[10px]" [title]="n.updated_at || ''">
                    {{ n.updated_at || '—' }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-stitch-on-surface-variant shrink-0">Last seen</dt>
                  <dd class="text-right truncate text-[10px]" [title]="n.last_seen_at || ''">
                    {{ n.last_seen_at || '—' }}
                  </dd>
                </div>
              </dl>
            </div>
          }

          <div>
            <h3
              class="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-stitch-on-surface-variant mb-4 flex items-center gap-2"
            >
              <app-stitch-icon name="circleStack" size="xs" />
              Snapshots
            </h3>
            @if (snapLoading()) {
              <span class="loading loading-spinner loading-sm text-stitch-on-surface-variant"></span>
            } @else if (snapshots().length === 0) {
              <p class="text-sm text-stitch-on-surface-variant stitch-panel !p-4">No snapshots stored.</p>
            } @else {
              <ul class="space-y-3">
                @for (s of pagedSnapshots(); track snapshotTrack(s, $index)) {
                  <li
                    class="bg-stitch-surface-lowest rounded-sm px-3 py-3 border border-stitch-ghost flex flex-col gap-2"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <app-stitch-icon name="document" size="xs" class="shrink-0 text-stitch-on-surface-variant" />
                      <span class="truncate text-xs font-mono text-stitch-on-surface">{{ snapshotLabel(s) }}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn text-[11px]"
                        (click)="openLoadSnapshotConfirm(s)"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn text-[11px]"
                        (click)="openDiffSnapshotConfirm(s)"
                      >
                        Diff
                      </button>
                    </div>
                  </li>
                }
              </ul>
              @if (snapshots().length > snapPageSize) {
                <div
                  class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stitch-ghost/60 pt-4"
                >
                  <p class="text-[10px] font-mono text-stitch-on-surface-variant">
                    {{ snapshotPageSummary() }}
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm text-[11px]"
                      (click)="snapPrevPage()"
                      [disabled]="!snapCanGoPrev()"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm text-[11px]"
                      (click)="snapNextPage()"
                      [disabled]="!snapCanGoNext()"
                    >
                      Next
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        </aside>
      </div>

      @if (message()) {
        <div
          class="px-10 py-4 text-xs font-mono bg-stitch-surface-dim text-stitch-on-surface border-t border-stitch-ghost flex items-start gap-2"
        >
          <app-stitch-icon name="info" size="xs" class="shrink-0 mt-0.5 text-stitch-on-surface-variant" />
          <span class="break-all">{{ message() }}</span>
        </div>
      }
      @if (err()) {
        <div class="px-10 py-4 text-sm text-stitch-error bg-stitch-surface-low border-t border-stitch-error/25 flex items-start gap-2">
          <app-stitch-icon name="info" size="xs" class="shrink-0 mt-0.5" />
          <span>{{ err() }}</span>
        </div>
      }

      @if (confirmOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeConfirm()"
          (keydown.enter)="closeConfirm()"
          (keydown.space)="$event.preventDefault(); closeConfirm()"
          (keydown.escape)="closeConfirm()"
        >
          <div
            class="bg-stitch-surface-lowest w-full max-w-lg rounded-sm p-8 border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            [attr.aria-labelledby]="'node-detail-confirm-title'"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="node-detail-confirm-title"
              class="font-display text-lg font-semibold mb-3 text-stitch-on-surface flex items-center gap-2"
            >
              <app-stitch-icon name="info" size="sm" class="text-stitch-primary-fixed" />
              {{ confirmTitle() }}
            </h3>
            <p class="text-sm text-stitch-on-surface-variant leading-relaxed mb-8">
              {{ confirmDescription() }}
            </p>
            <div class="flex justify-end gap-3">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeConfirm()">
                Cancel
              </button>
              <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="runConfirm()">
                <app-stitch-icon name="apply" size="xs" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      }

      @if (diffOpen()) {
        <div
          class="fixed inset-0 z-[60] flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeDiffModal()"
          (keydown.enter)="closeDiffModal()"
          (keydown.space)="$event.preventDefault(); closeDiffModal()"
          (keydown.escape)="closeDiffModal()"
        >
          <div
            class="bg-stitch-surface-lowest w-full max-w-6xl h-[min(90vh,52rem)] flex flex-col overflow-hidden rounded-sm border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-detail-diff-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <div class="px-6 py-4 border-b border-stitch-ghost shrink-0 flex items-center justify-between gap-4">
              <h3 id="node-detail-diff-title" class="font-display text-lg font-semibold text-stitch-on-surface">
                Snapshot vs current editor
              </h3>
              <button
                type="button"
                class="btn-stitch-secondary btn-stitch-secondary--sm"
                (click)="closeDiffModal()"
              >
                Close
              </button>
            </div>
            <div #diffHost class="flex-1 min-h-0 min-h-[min(65vh,36rem)] w-full relative"></div>
            @if (diffFooterError()) {
              <div class="px-6 py-3 text-sm text-stitch-error border-t border-stitch-error/20 bg-stitch-surface-low shrink-0">
                {{ diffFooterError() }}
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class NodeDetailPageComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(DashboardApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  @ViewChild('editorHost') editorHost!: ElementRef<HTMLDivElement>;
  @ViewChild('diffHost') diffHost?: ElementRef<HTMLDivElement>;

  readonly nodeId = this.route.snapshot.paramMap.get('id') || '';
  readonly node = signal<CaddyNodeV1 | null>(null);
  readonly snapshots = signal<Record<string, unknown>[]>([]);
  /** Client-side page size (API returns full list; no offset/limit in v1 swagger). */
  readonly snapPageSize = 10;
  readonly snapPageIndex = signal(0);
  readonly snapLoading = signal(false);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly err = signal<string | null>(null);
  readonly editorOk = signal(false);

  readonly confirmOpen = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmDescription = signal('');
  readonly diffOpen = signal(false);
  readonly diffFooterError = signal<string | null>(null);

  private monacoEditor: editor.IStandaloneCodeEditor | null = null;
  private monacoNs: typeof import('monaco-editor') | null = null;
  private diffEditor: editor.IStandaloneDiffEditor | null = null;
  private diffOriginalModel: editor.ITextModel | null = null;
  private diffModifiedModel: editor.ITextModel | null = null;
  private diffResizeUnsubscribe: (() => void) | null = null;

  private pendingConfirm: (() => void) | null = null;

  readonly pagedSnapshots = computed(() => {
    const all = this.snapshots();
    const start = this.snapPageIndex() * this.snapPageSize;
    return all.slice(start, start + this.snapPageSize);
  });

  readonly snapshotPageSummary = computed(() => {
    const total = this.snapshots().length;
    if (total === 0) {
      return '';
    }
    const start = this.snapPageIndex() * this.snapPageSize + 1;
    const end = Math.min(total, (this.snapPageIndex() + 1) * this.snapPageSize);
    return `Showing ${start}–${end} of ${total}`;
  });

  readonly snapCanGoPrev = computed(() => this.snapPageIndex() > 0);

  readonly snapCanGoNext = computed(() => {
    const total = this.snapshots().length;
    const nextStart = (this.snapPageIndex() + 1) * this.snapPageSize;
    return nextStart < total;
  });

  ngAfterViewInit(): void {
    if (this.nodeId) {
      this.loadNode();
      this.loadSnapshots();
    }
    void this.initEditor();
  }

  ngOnDestroy(): void {
    this.disposeDiffEditor();
    this.monacoEditor?.dispose();
    this.monacoEditor = null;
  }

  snapshotTrack(s: Record<string, unknown>, index: number): string | number {
    const id = s['id'];
    return id != null ? String(id) : index;
  }

  snapPrevPage(): void {
    this.snapPageIndex.update(i => Math.max(0, i - 1));
  }

  snapNextPage(): void {
    const total = this.snapshots().length;
    if (total === 0) {
      return;
    }
    const maxIdx = Math.max(0, Math.ceil(total / this.snapPageSize) - 1);
    this.snapPageIndex.update(i => Math.min(maxIdx, i + 1));
  }

  private clampSnapPageIndex(): void {
    const n = this.snapshots().length;
    if (n === 0) {
      this.snapPageIndex.set(0);
      return;
    }
    const maxIdx = Math.max(0, Math.ceil(n / this.snapPageSize) - 1);
    if (this.snapPageIndex() > maxIdx) {
      this.snapPageIndex.set(maxIdx);
    }
  }

  private openConfirm(title: string, description: string, onConfirm: () => void): void {
    this.confirmTitle.set(title);
    this.confirmDescription.set(description);
    this.pendingConfirm = onConfirm;
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    this.pendingConfirm = null;
    this.confirmOpen.set(false);
  }

  runConfirm(): void {
    const fn = this.pendingConfirm;
    this.pendingConfirm = null;
    this.confirmOpen.set(false);
    fn?.();
  }

  openSyncConfirm(): void {
    this.openConfirm(
      'Sync from node',
      'Fetches the current Caddy configuration from the node, saves a snapshot on the server, and updates the editor when the response includes configuration JSON.',
      () => this.runSyncPersisted()
    );
  }

  openReloadConfirm(): void {
    this.openConfirm(
      'Reload Caddy',
      'Asks the node to reload the running configuration. Active connections may be affected depending on your Caddy setup.',
      () => this.runReload()
    );
  }

  openApplyConfirm(): void {
    this.openConfirm(
      'Apply configuration',
      'Sends the JSON in the editor to the node as the new active configuration. This replaces the running config if the server accepts the request.',
      () => this.runApply()
    );
  }

  openFormatConfirm(): void {
    this.openConfirm(
      'Format JSON',
      'Replaces editor content with a pretty-printed version. If the JSON is invalid, an error will be shown.',
      () => this.runFormatJson()
    );
  }

  openCopyConfirm(): void {
    this.openConfirm(
      'Copy to clipboard',
      'Copies all editor text to the system clipboard (for backup or sharing the current JSON).',
      () => this.runCopyJson()
    );
  }

  openLoadSnapshotConfirm(s: Record<string, unknown>): void {
    this.openConfirm(
      'Load snapshot into editor',
      'Replaces the editor with this saved snapshot. Review the JSON before applying or syncing.',
      () => this.runLoadSnapshot(s)
    );
  }

  openDiffSnapshotConfirm(s: Record<string, unknown>): void {
    this.openConfirm(
      'Compare snapshot to editor',
      'Opens a read-only side-by-side diff: snapshot on the left, current editor buffer on the right (not re-fetched from the node). The editor must contain valid JSON.',
      () => this.runOpenDiffAfterConfirm(s)
    );
  }

  private async initEditor(): Promise<void> {
    const el = this.editorHost?.nativeElement;
    if (!el) {
      return;
    }
    const monaco = await loader.init();
    this.monacoNs = monaco;
    this.monacoEditor = monaco.editor.create(el, {
      value:
        '{\n  "_hint": "Loading live config from the node…"\n}',
      language: 'json',
      theme: 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
      fontSize: 13
    });
    const validateJson = (): void => {
      try {
        JSON.parse(this.monacoEditor?.getValue() || '');
        this.editorOk.set(true);
      } catch {
        this.editorOk.set(false);
      }
    };
    this.monacoEditor.onDidChangeModelContent(validateJson);
    validateJson();
    this.layoutMainEditorSoon();
    if (this.nodeId) {
      this.bootstrapLiveConfig();
    }
  }

  /** Monaco needs an explicit layout after flex sizes settle (e.g. after modals or async load). */
  private layoutMainEditorSoon(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.monacoEditor?.layout();
      });
    });
  }

  private bootstrapLiveConfig(): void {
    this.busy.set(true);
    this.err.set(null);
    this.api.getLiveNodeConfig(this.nodeId).subscribe({
      next: body => {
        if (this.applyLiveConfigBody(body)) {
          this.message.set('Loaded live configuration from the node.');
          this.err.set(null);
          this.editorOk.set(true);
        } else {
          this.monacoEditor?.setValue(
            '{\n  "_hint": "Live config response was empty or not usable JSON. Try Sync or check the backend."\n}'
          );
          this.err.set('Live config endpoint returned no usable configuration.');
        }
        this.busy.set(false);
        this.layoutMainEditorSoon();
      },
      error: err => {
        this.busy.set(false);
        this.err.set(err?.error?.error ?? 'Could not load live configuration');
        this.layoutMainEditorSoon();
      }
    });
  }

  /** Returns true if editor was updated from the live endpoint body. */
  private applyLiveConfigBody(body: unknown): boolean {
    if (!this.monacoEditor || body === null || body === undefined) {
      return false;
    }
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) {
        return false;
      }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed != null && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            this.monacoEditor.setValue(JSON.stringify(parsed, null, 2));
            return true;
          }
          return this.applyLiveConfigBody(parsed);
        }
        return false;
      } catch {
        this.monacoEditor.setValue(body);
        return true;
      }
    }
    if (typeof body === 'object' && !Array.isArray(body)) {
      const o = body as Record<string, unknown>;
      const nested =
        extractCaddyConfigFromSyncResponse(o) ??
        (isLikelyCaddyConfigRoot(o) ? o : null);
      const fallback = Object.keys(o).length > 0 ? o : null;
      const toShow = nested ?? fallback;
      if (!toShow || Object.keys(toShow).length === 0) {
        return false;
      }
      this.monacoEditor.setValue(JSON.stringify(toShow, null, 2));
      return true;
    }
    if (Array.isArray(body)) {
      this.monacoEditor.setValue(JSON.stringify(body, null, 2));
      return true;
    }
    return false;
  }

  private runFormatJson(): void {
    const raw = this.monacoEditor?.getValue() || '';
    try {
      const parsed = JSON.parse(raw) as unknown;
      const text = JSON.stringify(parsed, null, 2);
      this.monacoEditor?.setValue(text);
      this.message.set('JSON formatted.');
      this.err.set(null);
    } catch {
      this.err.set('Could not format: invalid JSON.');
    }
  }

  private runCopyJson(): void {
    const text = this.monacoEditor?.getValue() || '';
    if (!text.trim()) {
      this.message.set('Nothing to copy.');
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => {
        this.message.set('Copied to clipboard.');
        this.err.set(null);
      },
      () => this.err.set('Clipboard not available.')
    );
  }

  private loadNode(): void {
    this.api.getNode(this.nodeId).subscribe({
      next: n => this.node.set(n),
      error: () => this.err.set('Could not load node')
    });
  }

  loadSnapshots(): void {
    this.snapLoading.set(true);
    this.api.listSnapshots(this.nodeId).subscribe({
      next: rows => {
        this.snapshots.set(normalizeSnapshots(rows));
        this.clampSnapPageIndex();
        this.snapLoading.set(false);
      },
      error: () => {
        this.snapLoading.set(false);
      }
    });
  }

  snapshotLabel(s: Record<string, unknown>): string {
    const t = s['created_at'] ?? s['timestamp'] ?? s['id'];
    return t != null ? String(t) : JSON.stringify(s).slice(0, 80);
  }

  private runLoadSnapshot(s: Record<string, unknown>): void {
    const cfg = extractConfigFromSnapshotRecord(s);
    if (!cfg) {
      this.err.set('Could not read configuration from this snapshot.');
      return;
    }
    const text = JSON.stringify(cfg, null, 2);
    this.monacoEditor?.setValue(text);
    this.message.set('Snapshot loaded into the editor (review, then Apply if needed).');
    this.err.set(null);
    this.layoutMainEditorSoon();
  }

  private runSyncPersisted(): void {
    this.busy.set(true);
    this.err.set(null);
    this.api.syncConfig(this.nodeId).subscribe({
      next: res => {
        this.busy.set(false);
        const cfg = extractCaddyConfigFromSyncResponse(res);
        if (cfg && this.monacoEditor) {
          this.monacoEditor.setValue(JSON.stringify(cfg, null, 2));
          this.editorOk.set(true);
        }
        this.message.set('Sync from node completed (snapshot saved on the server).');
        this.loadSnapshots();
        this.layoutMainEditorSoon();
      },
      error: err => {
        this.busy.set(false);
        this.err.set(err?.error?.error || 'Sync failed');
      }
    });
  }

  private runReload(): void {
    this.busy.set(true);
    this.err.set(null);
    this.api.reloadCaddy(this.nodeId).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Caddy reload request sent.');
      },
      error: err => {
        this.busy.set(false);
        this.err.set(err?.error?.error || 'Reload failed');
      }
    });
  }

  private runApply(): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this.monacoEditor?.getValue() || '{}') as Record<string, unknown>;
    } catch {
      this.err.set('Invalid JSON');
      return;
    }
    this.busy.set(true);
    this.err.set(null);
    this.api.applyConfig(this.nodeId, { config: parsed }).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Configuration applied.');
        this.loadSnapshots();
      },
      error: err => {
        this.busy.set(false);
        this.err.set(err?.error?.error || 'Apply failed');
      }
    });
  }

  private runOpenDiffAfterConfirm(s: Record<string, unknown>): void {
    const original = extractConfigFromSnapshotRecord(s);
    if (!original) {
      this.err.set('Could not read configuration from this snapshot.');
      return;
    }
    const current = this.monacoEditor?.getValue() || '';
    try {
      JSON.parse(current);
    } catch {
      this.err.set('Cannot compare: editor content is not valid JSON. Fix it and try again.');
      return;
    }
    this.diffFooterError.set(null);
    this.diffOpen.set(true);
    afterNextRender(
      () => {
        requestAnimationFrame(() => {
          void this.mountDiffEditor(original, current);
        });
      },
      { injector: this.injector }
    );
  }

  private async mountDiffEditor(
    originalObj: Record<string, unknown>,
    modifiedRaw: string
  ): Promise<void> {
    const el = this.diffHost?.nativeElement;
    if (!el) {
      return;
    }
    this.disposeDiffEditor();
    const minPx = Math.min(Math.floor(window.innerHeight * 0.62), 640);
    el.style.minHeight = `${minPx}px`;
    const monaco = this.monacoNs ?? (await loader.init());
    this.monacoNs = monaco;
    const originalText = JSON.stringify(originalObj, null, 2);
    let modifiedText: string;
    try {
      modifiedText = JSON.stringify(JSON.parse(modifiedRaw), null, 2);
    } catch {
      this.diffFooterError.set('Editor content is not valid JSON.');
      modifiedText = modifiedRaw;
    }
    const originalModel = monaco.editor.createModel(originalText, 'json');
    const modifiedModel = monaco.editor.createModel(modifiedText, 'json');
    this.diffOriginalModel = originalModel;
    this.diffModifiedModel = modifiedModel;
    const diffEditor = monaco.editor.createDiffEditor(el, {
      readOnly: true,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
      fontSize: 13
    });
    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
    this.diffEditor = diffEditor;
    const layoutDiff = (): void => {
      diffEditor.layout();
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutDiff();
      });
    });
    const onResize = (): void => layoutDiff();
    window.addEventListener('resize', onResize);
    this.diffResizeUnsubscribe = () => window.removeEventListener('resize', onResize);
  }

  closeDiffModal(): void {
    this.disposeDiffEditor();
    this.diffOpen.set(false);
    this.diffFooterError.set(null);
    this.layoutMainEditorSoon();
  }

  private disposeDiffEditor(): void {
    this.diffResizeUnsubscribe?.();
    this.diffResizeUnsubscribe = null;
    const host = this.diffHost?.nativeElement;
    if (host) {
      host.style.minHeight = '';
    }
    this.diffEditor?.dispose();
    this.diffEditor = null;
    this.diffOriginalModel?.dispose();
    this.diffOriginalModel = null;
    this.diffModifiedModel?.dispose();
    this.diffModifiedModel = null;
  }
}
