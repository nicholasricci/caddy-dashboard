import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardApiService } from '../../services/dashboard-api.service';
import type { DiscoveryConfigV1, DiscoveryParametersV1, DiscoveryTagPairV1 } from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

type DiscoveryMethodId = 'aws_ssm' | 'aws_tag' | 'static_ip';

interface TagRowDraft {
  key: string;
  value: string;
}

interface DiscoveryModalDraft {
  name: string;
  method: DiscoveryMethodId;
  region: string;
  tagRows: TagRowDraft[];
  addressesText: string;
  enabled: boolean;
}

function normalizeDiscoveryRows(rows: unknown): DiscoveryConfigV1[] {
  if (Array.isArray(rows)) {
    return rows as DiscoveryConfigV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['discovery'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as DiscoveryConfigV1[];
    }
  }
  return [];
}

function coerceMethod(m: string | undefined): DiscoveryMethodId {
  if (m === 'aws_tag' || m === 'static_ip' || m === 'aws_ssm') {
    return m;
  }
  return 'aws_ssm';
}

function parseTagRowsFromConfig(d: DiscoveryConfigV1): TagRowDraft[] {
  const raw = d.parameters?.tags;
  if (Array.isArray(raw) && raw.length > 0) {
    const rows: TagRowDraft[] = [];
    for (const t of raw) {
      if (t && typeof t === 'object' && 'key' in t) {
        const o = t as unknown as Record<string, unknown>;
        rows.push({ key: String(o['key'] ?? ''), value: String(o['value'] ?? '') });
      }
    }
    if (rows.length > 0) {
      return rows;
    }
  }
  if (d.tag_key != null && String(d.tag_key).trim() !== '') {
    return [{ key: d.tag_key, value: d.tag_value ?? '' }];
  }
  return [{ key: '', value: '' }];
}

function parseAddressesText(d: DiscoveryConfigV1): string {
  const raw = d.parameters?.addresses;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(a => String(a)).filter(s => s.length > 0).join('\n');
  }
  return '';
}

@Component({
  selector: 'app-discovery-page',
  standalone: true,
  imports: [CommonModule, FormsModule, StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-6xl mx-auto">
      <header class="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="discovery" size="md" class="text-stitch-primary-fixed" />
            Autodiscovery setup
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 max-w-2xl leading-relaxed">
            Rules for finding nodes (e.g. <span class="font-mono text-stitch-on-surface">aws_ssm</span>,
            <span class="font-mono text-stitch-on-surface">aws_tag</span>,
            <span class="font-mono text-stitch-on-surface">static_ip</span>). Run a rule to sync inventory with the API.
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
        <div
          class="alert text-sm mb-8 rounded-sm border-stitch-ghost bg-stitch-surface-lowest text-stitch-on-surface"
        >
          <span class="text-stitch-error font-medium">{{ error() }}</span>
        </div>
      }

      <div class="grid gap-10 lg:grid-cols-[1fr_minmax(16rem,20rem)]">
        <div>
          <div class="flex justify-end mb-8">
            <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="openCreate()">
              <app-stitch-icon name="plus" size="xs" />
              New rule
            </button>
          </div>

          @if (loading()) {
            <div class="flex justify-center py-24 stitch-panel">
              <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
            </div>
          } @else {
            <div class="space-y-4">
              @for (d of configs(); track d.id; let i = $index) {
                <div
                  class="stitch-panel flex flex-wrap items-start justify-between gap-6"
                  [class.stitch-panel--dim]="i % 2 === 0"
                >
                  <div class="min-w-0 flex-1">
                    <h3 class="font-display font-semibold text-lg text-stitch-on-surface flex items-center gap-2">
                      <app-stitch-icon name="sparkles" size="xs" class="text-stitch-on-surface-variant" />
                      {{ d.name || d.id }}
                    </h3>
                    <p class="text-xs font-mono text-stitch-on-surface-variant mt-2">
                      {{ d.method }}
                      @if (d.method !== 'static_ip' && d.region) {
                        <span> · {{ d.region }}</span>
                      }
                    </p>
                    @if (d.method === 'aws_tag') {
                      @let pairs = tagPairsForCard(d);
                      @if (pairs.length) {
                        <div class="mt-3 flex flex-wrap gap-1.5">
                          @for (p of pairs; track $index) {
                            <span
                              class="inline-flex items-center rounded-sm border border-stitch-ghost bg-stitch-surface-lowest px-2 py-0.5 text-[11px] font-mono text-stitch-on-surface"
                              >{{ p.key }}={{ p.value }}</span
                            >
                          }
                        </div>
                      }
                    }
                    @if (d.method === 'static_ip') {
                      @let prev = addressesPreview(d);
                      @if (prev) {
                        <p class="text-xs font-mono text-stitch-on-surface mt-3 break-all">
                          {{ prev.preview.join(', ') }}
                          @if (prev.more > 0) {
                            <span class="text-stitch-on-surface-variant"> · +{{ prev.more }} more</span>
                          }
                        </p>
                      }
                    }
                    @if (d.method !== 'aws_tag' && d.tag_key) {
                      <p class="text-xs mt-3 font-mono text-stitch-on-surface">
                        tag: {{ d.tag_key }}={{ d.tag_value }}
                      </p>
                    }
                    <p class="text-xs mt-3">
                      <span class="stitch-status-chip">{{ d.enabled !== false ? 'enabled' : 'disabled' }}</span>
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
                      (click)="run(d)"
                      [disabled]="runningId() === d.id"
                    >
                      @if (runningId() === d.id) {
                        <span class="loading loading-spinner loading-xs"></span>
                      } @else {
                        <app-stitch-icon name="play" size="xs" />
                        Run
                      }
                    </button>
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
                      (click)="edit(d)"
                    >
                      <app-stitch-icon name="edit" size="xs" />
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm text-stitch-error stitch-icon-btn"
                      (click)="remove(d)"
                    >
                      <app-stitch-icon name="trash" size="xs" />
                      Delete
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
                  <app-stitch-icon name="discovery" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
                  <p class="text-sm text-stitch-on-surface-variant">No discovery rules yet.</p>
                  <button
                    type="button"
                    class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn justify-center mt-6"
                    (click)="openCreate()"
                  >
                    <app-stitch-icon name="plus" size="xs" />
                    Create rule
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div class="stitch-panel stitch-panel--dim">
            <p class="stitch-panel-title flex items-center gap-2">
              <app-stitch-icon name="info" size="xs" />
              How it works
            </p>
            <ol class="text-xs text-stitch-on-surface-variant space-y-3 list-decimal list-inside leading-relaxed">
              <li>Each rule defines a discovery method and optional region or tag filters.</li>
              <li>
                <span class="font-mono text-stitch-on-surface">Run</span> executes the rule server-side and refreshes the node list.
              </li>
              <li>Disable a rule with the Enabled checkbox when editing — it will not run on a schedule until re-enabled (if your backend supports scheduling).</li>
            </ol>
          </div>
          @if (lastRun(); as lr) {
            <div class="stitch-panel">
              <p class="stitch-panel-title flex items-center gap-2">
                <app-stitch-icon name="sync" size="xs" />
                Last run
              </p>
              <p class="text-xs font-mono text-stitch-on-surface break-words">{{ lr }}</p>
            </div>
          }
        </aside>
      </div>

      @if (showModal()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeModal()"
          (keydown.enter)="closeModal()"
          (keydown.space)="$event.preventDefault(); closeModal()"
          (keydown.escape)="closeModal()"
        >
          <div
            class="bg-stitch-surface-lowest w-full max-w-2xl max-h-[min(90vh,48rem)] overflow-y-auto rounded-sm p-8 border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            [attr.aria-labelledby]="'discovery-modal-title'"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="discovery-modal-title"
              class="font-display text-lg font-semibold mb-2 text-stitch-on-surface flex items-center gap-2"
            >
              @if (editingId()) {
                <app-stitch-icon name="edit" />
              } @else {
                <app-stitch-icon name="plus" />
              }
              {{ editingId() ? 'Edit rule' : 'New rule' }}
            </h3>

            <div class="space-y-6">
              <div>
                <label
                  class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                  for="discovery-rule-name"
                  >Name</label
                >
                <input
                  id="discovery-rule-name"
                  class="input-technical mt-1"
                  [(ngModel)]="draft.name"
                  autocomplete="off"
                />
              </div>

              <fieldset class="border-0 p-0 m-0 min-w-0">
                <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-3">
                  Discovery method
                </legend>
                <div
                  class="grid gap-3 sm:grid-cols-3"
                  role="group"
                  aria-label="Discovery method"
                >
                  @for (opt of methodChoices; track opt.id) {
                    <button
                      type="button"
                      class="stitch-panel text-left p-4 transition-colors border-stitch-ghost hover:bg-stitch-surface-low"
                      [class.ring-2]="draft.method === opt.id"
                      [class.ring-stitch-primary]="draft.method === opt.id"
                      [class.bg-stitch-surface-low]="draft.method === opt.id"
                      [attr.aria-pressed]="draft.method === opt.id"
                      (click)="setMethod(opt.id)"
                    >
                      <span class="flex items-start gap-2">
                        <app-stitch-icon [name]="opt.icon" size="sm" class="text-stitch-primary-fixed shrink-0 mt-0.5" />
                        <span class="min-w-0">
                          <span class="block font-display font-semibold text-sm text-stitch-on-surface">{{ opt.title }}</span>
                          <span class="block text-xs text-stitch-on-surface-variant mt-1 leading-snug">{{ opt.description }}</span>
                        </span>
                      </span>
                    </button>
                  }
                </div>
              </fieldset>

              @if (draft.method === 'aws_ssm') {
                <div>
                  <label
                    class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                    for="discovery-region-ssm"
                    >AWS region</label
                  >
                  <input
                    id="discovery-region-ssm"
                    class="input-technical mt-1 font-mono text-sm"
                    [(ngModel)]="draft.region"
                    placeholder="e.g. eu-central-1"
                    autocomplete="off"
                  />
                </div>
              }

              @if (draft.method === 'aws_tag') {
                <div>
                  <label
                    class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                    for="discovery-region-tag"
                    >AWS region</label
                  >
                  <input
                    id="discovery-region-tag"
                    class="input-technical mt-1 font-mono text-sm"
                    [(ngModel)]="draft.region"
                    placeholder="e.g. eu-central-1"
                    autocomplete="off"
                  />
                </div>
                <div class="space-y-3">
                  <p class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium">Resource tags</p>
                  @for (row of draft.tagRows; track $index; let ti = $index) {
                    <div class="flex flex-wrap items-end gap-3">
                      <div class="min-w-0 flex-1 basis-[8rem]">
                        <label class="sr-only" [attr.for]="'discovery-tag-key-' + ti">Tag key {{ ti + 1 }}</label>
                        <input
                          [id]="'discovery-tag-key-' + ti"
                          class="input-technical font-mono text-sm"
                          [(ngModel)]="row.key"
                          placeholder="Key"
                          autocomplete="off"
                        />
                      </div>
                      <div class="min-w-0 flex-1 basis-[8rem]">
                        <label class="sr-only" [attr.for]="'discovery-tag-value-' + ti">Tag value {{ ti + 1 }}</label>
                        <input
                          [id]="'discovery-tag-value-' + ti"
                          class="input-technical font-mono text-sm"
                          [(ngModel)]="row.value"
                          placeholder="Value"
                          autocomplete="off"
                        />
                      </div>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                        (click)="removeTagRow(ti)"
                        [disabled]="draft.tagRows.length <= 1"
                        [attr.aria-label]="'Remove tag row ' + (ti + 1)"
                      >
                        <app-stitch-icon name="trash" size="xs" />
                        Remove
                      </button>
                    </div>
                  }
                  <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="addTagRow()">
                    <app-stitch-icon name="plus" size="xs" />
                    Add tag
                  </button>
                </div>
              }

              @if (draft.method === 'static_ip') {
                <div>
                  <label
                    class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                    for="discovery-addresses"
                    >Addresses / CIDRs</label
                  >
                  <p class="text-xs text-stitch-on-surface-variant mt-1 mb-2">One IPv4/IPv6 address or CIDR per line.</p>
                  <textarea
                    id="discovery-addresses"
                    class="input-technical w-full min-h-[10rem] font-mono text-sm resize-y"
                    [(ngModel)]="draft.addressesText"
                    rows="8"
                    spellcheck="false"
                    autocomplete="off"
                  ></textarea>
                </div>
              }

              <label class="flex items-center gap-2 text-sm text-stitch-on-surface cursor-pointer" for="discovery-modal-enabled">
                <input
                  id="discovery-modal-enabled"
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-sm"
                  [(ngModel)]="draft.enabled"
                />
                Enabled
              </label>
            </div>
            <div class="flex justify-end gap-3 mt-10">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="saving()"
                (click)="save()"
              >
                @if (saving()) {
                  <span class="loading loading-spinner loading-xs"></span>
                } @else {
                  <app-stitch-icon name="apply" size="xs" />
                  Save
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DiscoveryPageComponent {
  private readonly api = inject(DashboardApiService);

  readonly methodChoices = [
    {
      id: 'aws_ssm' as const,
      title: 'AWS SSM',
      description: 'Enumerate instances with an active SSM agent in one region.',
      icon: 'server' as const
    },
    {
      id: 'aws_tag' as const,
      title: 'AWS tags',
      description: 'Filter EC2 by resource tags (key/value) in the chosen region.',
      icon: 'configure' as const
    },
    {
      id: 'static_ip' as const,
      title: 'Static targets',
      description: 'Register fixed hosts from IPs or CIDR blocks (one entry per line).',
      icon: 'document' as const
    }
  ];

  readonly configs = signal<DiscoveryConfigV1[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly runningId = signal<string | null>(null);
  readonly lastRun = signal<string | null>(null);

  draft: DiscoveryModalDraft = DiscoveryPageComponent.emptyDraft();

  constructor() {
    this.load();
  }

  private static emptyDraft(): DiscoveryModalDraft {
    return {
      name: '',
      method: 'aws_ssm',
      region: '',
      tagRows: [{ key: '', value: '' }],
      addressesText: '',
      enabled: true
    };
  }

  tagPairsForCard(d: DiscoveryConfigV1): DiscoveryTagPairV1[] {
    const params = d.parameters as DiscoveryParametersV1 | undefined;
    const raw = params?.tags;
    if (Array.isArray(raw) && raw.length > 0) {
      const out: DiscoveryTagPairV1[] = [];
      for (const t of raw) {
        if (t && typeof t === 'object' && 'key' in t) {
          const o = t as unknown as Record<string, unknown>;
          const key = String(o['key'] ?? '').trim();
          if (key.length > 0) {
            out.push({ key, value: String(o['value'] ?? '') });
          }
        }
      }
      if (out.length > 0) {
        return out;
      }
    }
    if (d.tag_key != null && String(d.tag_key).trim() !== '') {
      return [{ key: d.tag_key, value: d.tag_value ?? '' }];
    }
    return [];
  }

  addressesPreview(d: DiscoveryConfigV1): { preview: string[]; more: number } | null {
    if (d.method !== 'static_ip') {
      return null;
    }
    const raw = d.parameters?.addresses;
    if (!Array.isArray(raw) || raw.length === 0) {
      return null;
    }
    const strings = raw.map(a => String(a)).filter(s => s.length > 0);
    if (strings.length === 0) {
      return null;
    }
    const max = 3;
    return {
      preview: strings.slice(0, max),
      more: Math.max(0, strings.length - max)
    };
  }

  load(): void {
    this.loading.set(true);
    this.api.listDiscovery().subscribe({
      next: rows => {
        this.configs.set(normalizeDiscoveryRows(rows));
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error || 'Failed to load discovery');
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.draft = DiscoveryPageComponent.emptyDraft();
    this.showModal.set(true);
  }

  edit(d: DiscoveryConfigV1): void {
    this.editingId.set(d.id || null);
    this.draft = {
      name: d.name ?? '',
      method: coerceMethod(d.method),
      region: coerceMethod(d.method) !== 'static_ip' ? (d.region ?? '') : '',
      tagRows: parseTagRowsFromConfig(d),
      addressesText: parseAddressesText(d),
      enabled: d.enabled !== false
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  setMethod(m: DiscoveryMethodId): void {
    this.draft.method = m;
  }

  addTagRow(): void {
    this.draft.tagRows = [...this.draft.tagRows, { key: '', value: '' }];
  }

  removeTagRow(index: number): void {
    if (this.draft.tagRows.length <= 1) {
      return;
    }
    this.draft.tagRows = this.draft.tagRows.filter((_, i) => i !== index);
  }

  private buildPayloadFromDraft(): DiscoveryConfigV1 {
    const name = this.draft.name?.trim() ?? '';
    const enabled = this.draft.enabled;
    const method = this.draft.method;

    if (method === 'aws_ssm') {
      const region = this.draft.region?.trim();
      const body: DiscoveryConfigV1 = { name, method, enabled, parameters: {} };
      if (region) {
        body.region = region;
      }
      return body;
    }

    if (method === 'aws_tag') {
      const region = this.draft.region?.trim();
      const tags = this.draft.tagRows
        .map(r => ({ key: r.key.trim(), value: r.value.trim() }))
        .filter(r => r.key.length > 0);
      const first = tags[0];
      const body: DiscoveryConfigV1 = {
        name,
        method,
        enabled,
        parameters: { tags }
      };
      if (region) {
        body.region = region;
      }
      if (first) {
        body.tag_key = first.key;
        body.tag_value = first.value;
      }
      return body;
    }

    const addresses = this.draft.addressesText
      .split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    return {
      name,
      method,
      enabled,
      parameters: { addresses }
    };
  }

  save(): void {
    this.saving.set(true);
    const body = this.buildPayloadFromDraft();
    const id = this.editingId();
    const req = id ? this.api.updateDiscovery(id, { ...body, id }) : this.api.createDiscovery(body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Save failed');
      }
    });
  }

  remove(d: DiscoveryConfigV1): void {
    if (!d.id || !confirm('Delete this discovery rule?')) {
      return;
    }
    this.api.deleteDiscovery(d.id).subscribe({
      next: () => this.load(),
      error: err => this.error.set(err?.error?.error || 'Delete failed')
    });
  }

  run(d: DiscoveryConfigV1): void {
    if (!d.id) {
      return;
    }
    this.runningId.set(d.id);
    this.api.runDiscovery(d.id).subscribe({
      next: () => {
        this.runningId.set(null);
        const label = d.name || d.id;
        this.lastRun.set(`${new Date().toISOString()} — “${label}” completed. Node list refreshed.`);
        this.load();
      },
      error: err => {
        this.runningId.set(null);
        this.error.set(err?.error?.error || 'Run failed');
      }
    });
  }
}
