import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { rxResource } from '@angular/core/rxjs-interop';
import type {
  AuditListFilterV1,
  AuditLogEntryV1,
  AuditLogListMetaV1,
  AuditLogListResultV1
} from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { extractApiError } from '../../core/http-error.util';

interface AuditRowViewModel {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  summary: string;
  payloadText: string | null;
}

interface AuditDraftFilter {
  action: string;
  resource: string;
  actor: string;
  resource_id: string;
  fromLocal: string;
  toLocal: string;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium'
});

function emptyDraftFilter(): AuditDraftFilter {
  return {
    action: '',
    resource: '',
    actor: '',
    resource_id: '',
    fromLocal: '',
    toLocal: ''
  };
}

function fromDatetimeLocalInput(local: string): string | undefined {
  const trimmed = local.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function toAuditEntries(rows: AuditLogListResultV1 | unknown): AuditLogEntryV1[] {
  if (Array.isArray(rows)) {
    return rows as AuditLogEntryV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const record = rows as Record<string, unknown>;
  if (Array.isArray(record['items'])) {
    return record['items'] as AuditLogEntryV1[];
  }
  return [];
}

function toAuditMeta(rows: AuditLogListResultV1 | unknown): AuditLogListMetaV1 | null {
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) {
    return null;
  }

  const meta = (rows as Record<string, unknown>)['meta'];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }

  return meta as AuditLogListMetaV1;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function displayText(value: unknown, fallback = '-'): string {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function formatTimestamp(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) {
    return '-';
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : timestampFormatter.format(date);
}

function formatPayloadText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeEntry(entry: AuditLogEntryV1, payload: Record<string, unknown> | null): string {
  if (typeof entry['details'] === 'string' && entry['details'].trim()) {
    return entry['details'].trim();
  }

  const parts: string[] = [];
  const pushIfPresent = (label: string, value: unknown): void => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${label}: ${value}`);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${label}: ${value}`);
    }
  };

  if (payload) {
    pushIfPresent('name', payload['name']);
    pushIfPresent('method', payload['method']);
    pushIfPresent('region', payload['region']);
    pushIfPresent('scope', payload['snapshot_scope']);
    if (typeof payload['enabled'] === 'boolean') {
      parts.push(payload['enabled'] ? 'enabled' : 'disabled');
    }
    if (typeof payload['discovered_nodes'] === 'number') {
      const count = payload['discovered_nodes'];
      parts.push(`discovered nodes: ${count}`);
    }
  }

  return parts.join(' · ') || '-';
}

function toAuditRow(entry: AuditLogEntryV1, index: number): AuditRowViewModel {
  const payload = toRecord(entry['payload'] ?? entry['details']);
  const payloadText = formatPayloadText(entry['payload'] ?? entry['details']);

  return {
    id: `${entry['id'] ?? entry['created_at'] ?? 'entry'}-${index}`,
    timestamp: formatTimestamp(entry['created_at'] ?? entry['timestamp']),
    actor: displayText(entry['actor']),
    action: displayText(entry['action']),
    resource: displayText(entry['resource'] ?? entry['target']),
    resourceId: displayText(entry['resource_id']),
    summary: summarizeEntry(entry, payload),
    payloadText
  };
}

function draftToAppliedFilter(draft: AuditDraftFilter, limit: number): AuditListFilterV1 {
  const filter: AuditListFilterV1 = { limit, offset: 0 };
  if (draft.action) {
    filter.action = draft.action;
  }
  if (draft.resource) {
    filter.resource = draft.resource;
  }
  const actor = draft.actor.trim();
  if (actor) {
    filter.actor = actor;
  }
  const resourceId = draft.resource_id.trim();
  if (resourceId) {
    filter.resource_id = resourceId;
  }
  const from = fromDatetimeLocalInput(draft.fromLocal);
  if (from) {
    filter.from = from;
  }
  const to = fromDatetimeLocalInput(draft.toLocal);
  if (to) {
    filter.to = to;
  }
  return filter;
}

@Component({
  selector: 'app-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-6xl mx-auto">
      <header class="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="audit" size="md" class="text-stitch-primary-fixed" />
            Audit log
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed">
            Recent administrative actions and system events.
          </p>
        </div>
        <button
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
          (click)="load()"
          [disabled]="loading()"
        >
          <app-stitch-icon name="refresh" size="xs" [class.animate-spin]="loading()" />
          Refresh
        </button>
      </header>

      @if (error()) {
        <div class="alert text-sm mb-8 rounded-sm border-stitch-ghost bg-stitch-surface-lowest text-stitch-on-surface">
          <span class="text-stitch-error font-medium">{{ error() }}</span>
        </div>
      }

      <section class="stitch-panel stitch-panel--dim mb-8">
        <p class="stitch-panel-title mb-4">Filters</p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant">Action</span>
            <select
              class="select select-bordered w-full mt-1.5 px-3 font-mono text-xs"
              [value]="draftFilter().action"
              (change)="setDraftField('action', readSelectValue($event))"
            >
              <option value="">All</option>
              @for (action of actionOptions(); track action) {
                <option [value]="action">{{ action }}</option>
              }
            </select>
          </label>
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant">Resource</span>
            <select
              class="select select-bordered w-full mt-1.5 px-3 font-mono text-xs"
              [value]="draftFilter().resource"
              (change)="setDraftField('resource', readSelectValue($event))"
            >
              <option value="">All</option>
              @for (resource of resourceOptions(); track resource) {
                <option [value]="resource">{{ resource }}</option>
              }
            </select>
          </label>
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant" for="audit-filter-actor">Actor</span>
            <input
              id="audit-filter-actor"
              type="text"
              class="input input-bordered w-full mt-1.5 font-mono text-xs"
              [value]="draftFilter().actor"
              (input)="setDraftField('actor', readInputValue($event))"
            />
          </label>
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant" for="audit-filter-resource-id">Resource ID</span>
            <input
              id="audit-filter-resource-id"
              type="text"
              class="input input-bordered w-full mt-1.5 font-mono text-xs"
              [value]="draftFilter().resource_id"
              (input)="setDraftField('resource_id', readInputValue($event))"
            />
          </label>
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant" for="audit-filter-from">From</span>
            <input
              id="audit-filter-from"
              type="datetime-local"
              class="input input-bordered w-full mt-1.5 font-mono text-xs"
              [value]="draftFilter().fromLocal"
              (input)="setDraftField('fromLocal', readInputValue($event))"
            />
          </label>
          <label class="form-control">
            <span class="text-xs text-stitch-on-surface-variant" for="audit-filter-to">To</span>
            <input
              id="audit-filter-to"
              type="datetime-local"
              class="input input-bordered w-full mt-1.5 font-mono text-xs"
              [value]="draftFilter().toLocal"
              (input)="setDraftField('toLocal', readInputValue($event))"
            />
          </label>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" class="btn-stitch-primary btn-stitch-primary--sm" (click)="applyFilters()" [disabled]="loading()">
            Apply filters
          </button>
          <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="clearFilters()" [disabled]="loading()">
            Clear
          </button>
          <label class="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-stitch-on-surface-variant">
            <span>Page size</span>
            <select
              class="select select-bordered select-sm min-w-[4.75rem] pl-3 pr-8 font-mono text-xs"
              [value]="pageSize()"
              (change)="onPageSizeChange(readSelectNumber($event))"
            >
              @for (size of pageSizeOptions; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </label>
        </div>
      </section>

      @if (loading()) {
        <div class="flex py-16 stitch-panel justify-center">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (entries().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
          <app-stitch-icon name="audit" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-sm text-stitch-on-surface-variant">No audit entries match the current filters.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="whitespace-nowrap align-top">{{ row.timestamp }}</td>
                  <td class="align-top">{{ row.actor }}</td>
                  <td class="align-top">
                    <span class="stitch-status-chip">{{ row.action }}</span>
                  </td>
                  <td class="align-top min-w-52">
                    <div class="font-medium text-stitch-on-surface">{{ row.resource }}</div>
                    <div class="mt-1 text-xs font-mono text-stitch-on-surface-variant break-all">
                      {{ row.resourceId }}
                    </div>
                  </td>
                  <td class="align-top min-w-80 max-w-[34rem]">
                    <div class="text-sm text-stitch-on-surface break-words">{{ row.summary }}</div>
                    @if (row.payloadText) {
                      <details class="mt-2">
                        <summary class="cursor-pointer text-xs text-stitch-primary select-none">Payload JSON</summary>
                        <pre class="mt-2 overflow-auto rounded-sm bg-stitch-surface-lowest p-3 text-[11px] leading-5 text-stitch-on-surface whitespace-pre-wrap break-all border border-stitch-ghost">{{ row.payloadText }}</pre>
                      </details>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (pageSummary()) {
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-[10px] font-mono text-stitch-on-surface-variant">{{ pageSummary() }}</p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn-stitch-secondary btn-stitch-secondary--sm text-[11px]"
                (click)="prevPage()"
                [disabled]="!canGoPrev()"
              >
                Previous
              </button>
              <button
                type="button"
                class="btn-stitch-secondary btn-stitch-secondary--sm text-[11px]"
                (click)="nextPage()"
                [disabled]="!canGoNext()"
              >
                Next
              </button>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class AuditPageComponent {
  private readonly api = inject(DashboardApiService);
  private readonly refreshVersion = signal(0);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly draftFilter = signal<AuditDraftFilter>(emptyDraftFilter());
  readonly pageSize = signal<number>(20);
  readonly appliedFilter = signal<AuditListFilterV1>({ limit: 20, offset: 0 });

  readonly typesResource = rxResource({
    stream: () => this.api.listAuditTypes()
  });
  readonly entriesResource = rxResource({
    params: () => {
      const filter = this.appliedFilter();
      return {
        action: filter.action ?? '',
        resource: filter.resource ?? '',
        actor: filter.actor ?? '',
        resource_id: filter.resource_id ?? '',
        from: filter.from ?? '',
        to: filter.to ?? '',
        limit: filter.limit ?? this.pageSize(),
        offset: filter.offset ?? 0,
        refresh: this.refreshVersion()
      };
    },
    stream: () => this.api.listAuditLogs(this.appliedFilter())
  });

  readonly actionOptions = computed(() => this.typesResource.value()?.actions ?? []);
  readonly resourceOptions = computed(() => this.typesResource.value()?.resources ?? []);
  readonly loading = computed(() => this.entriesResource.isLoading());
  readonly error = computed(() => {
    const e = this.entriesResource.error();
    return e ? extractApiError(e, 'Could not load audit logs') : null;
  });
  readonly entries = computed(() => toAuditEntries(this.entriesResource.value() as AuditLogListResultV1 | unknown));
  readonly rows = computed(() => this.entries().map((entry, index) => toAuditRow(entry, index)));
  readonly meta = computed(() => toAuditMeta(this.entriesResource.value() as AuditLogListResultV1 | unknown));
  readonly canGoPrev = computed(() => (this.appliedFilter().offset ?? 0) > 0);
  readonly canGoNext = computed(() => {
    const meta = this.meta();
    const total = meta?.total;
    if (typeof total !== 'number') {
      return false;
    }
    const offset = this.appliedFilter().offset ?? 0;
    return offset + this.entries().length < total;
  });
  readonly pageSummary = computed(() => {
    const meta = this.meta();
    const total = meta?.total;
    if (typeof total !== 'number' || total === 0) {
      return '';
    }
    const offset = this.appliedFilter().offset ?? 0;
    const visible = this.entries().length;
    if (visible === 0) {
      return `0 of ${total} entries`;
    }
    const start = offset + 1;
    const end = Math.min(offset + visible, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  readSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  readSelectNumber(event: Event): number {
    return Number((event.target as HTMLSelectElement).value);
  }

  readInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  setDraftField<K extends keyof AuditDraftFilter>(field: K, value: AuditDraftFilter[K]): void {
    this.draftFilter.update(draft => ({ ...draft, [field]: value }));
  }

  applyFilters(): void {
    this.appliedFilter.set(draftToAppliedFilter(this.draftFilter(), this.pageSize()));
    this.refreshVersion.update(v => v + 1);
  }

  clearFilters(): void {
    this.draftFilter.set(emptyDraftFilter());
    this.pageSize.set(20);
    this.appliedFilter.set({ limit: 20, offset: 0 });
    this.refreshVersion.update(v => v + 1);
  }

  onPageSizeChange(size: number): void {
    if (!PAGE_SIZE_OPTIONS.includes(size as (typeof PAGE_SIZE_OPTIONS)[number])) {
      return;
    }
    this.pageSize.set(size);
    this.appliedFilter.update(current => ({ ...current, limit: size, offset: 0 }));
    this.refreshVersion.update(v => v + 1);
  }

  prevPage(): void {
    if (!this.canGoPrev()) {
      return;
    }
    const current = this.appliedFilter();
    const limit = current.limit ?? this.pageSize();
    const offset = current.offset ?? 0;
    this.appliedFilter.set({ ...current, offset: Math.max(0, offset - limit) });
    this.refreshVersion.update(v => v + 1);
  }

  nextPage(): void {
    if (!this.canGoNext()) {
      return;
    }
    const current = this.appliedFilter();
    const limit = current.limit ?? this.pageSize();
    const offset = current.offset ?? 0;
    this.appliedFilter.set({ ...current, offset: offset + limit });
    this.refreshVersion.update(v => v + 1);
  }

  load(): void {
    this.refreshVersion.update(v => v + 1);
  }
}
