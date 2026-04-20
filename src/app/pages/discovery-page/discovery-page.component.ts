import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { DashboardApiService } from '../../services/dashboard-api.service';
import type { DiscoveryConfigV1, DiscoveryParametersV1, DiscoveryTagPairV1, SnapshotScopeV1 } from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { DiscoveryRuleFormModalComponent } from './discovery-rule-form-modal.component';
import { extractApiError } from '../../core/http-error.util';

type DiscoveryMethodId = 'aws_ssm' | 'aws_tag' | 'static_ip';

interface TagRowDraft {
  key: string;
  value: string;
}

interface DiscoveryModalDraft {
  name: string;
  method: DiscoveryMethodId;
  snapshotScope: SnapshotScopeV1;
  region: string;
  tagRows: TagRowDraft[];
  addressesText: string;
  enabled: boolean;
}

type DiscoveryTagRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent, DiscoveryRuleFormModalComponent],
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
                    <p class="text-xs mt-3 text-stitch-on-surface-variant font-mono">
                      snapshots: {{ d.snapshot_scope || 'node' }}
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

      <app-discovery-rule-form-modal
        [open]="showModal()"
        [editing]="!!editingId()"
        [saving]="saving()"
        [form]="discoveryForm"
        [methodChoices]="methodChoices"
        (cancelRequested)="closeModal()"
        (saveRequested)="save()"
        (methodChanged)="setMethod($event)"
        (snapshotScopeChanged)="setSnapshotScope($event)"
        (addTagRequested)="addTagRow()"
        (removeTagRequested)="removeTagRow($event)"
      />
    </div>
  `
})
export class DiscoveryPageComponent {
  private readonly api = inject(DashboardApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

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

  private readonly refreshVersion = signal(0);
  private readonly optimisticConfigsById = signal<Record<string, DiscoveryConfigV1>>({});
  private readonly pendingSnapshotScopeById = signal<Record<string, SnapshotScopeV1>>({});
  readonly actionError = signal<string | null>(null);
  readonly configsResource = rxResource({
    stream: () => {
      this.refreshVersion();
      return this.api.listDiscovery();
    }
  });
  readonly configs = computed(() => {
    const rows = normalizeDiscoveryRows(this.configsResource.value() as unknown);
    const optimisticById = this.optimisticConfigsById();
    const pending = this.pendingSnapshotScopeById();
    const merged: DiscoveryConfigV1[] = rows.map(row => {
      const id = row.id ?? '';
      const optimistic = id ? optimisticById[id] : undefined;
      return optimistic ? { ...row, ...optimistic, id } : row;
    });
    if (Object.keys(optimisticById).length > 0) {
      const knownIds = new Set(merged.map(row => row.id ?? '').filter(id => id.length > 0));
      for (const [id, cfg] of Object.entries(optimisticById)) {
        if (!knownIds.has(id)) {
          merged.push(cfg);
        }
      }
    }
    if (Object.keys(pending).length === 0) {
      return merged;
    }
    return merged.map(row => {
      const id = row.id ?? '';
      const forcedScope = id ? pending[id] : undefined;
      return forcedScope ? { ...row, snapshot_scope: forcedScope } : row;
    });
  });
  readonly loading = computed(() => this.configsResource.isLoading());
  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.configsResource.error();
    return e ? extractApiError(e, 'Failed to load discovery') : null;
  });
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly runningId = signal<string | null>(null);
  readonly lastRun = signal<string | null>(null);

  readonly discoveryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    method: ['aws_ssm' as DiscoveryMethodId],
    snapshotScope: ['node' as SnapshotScopeV1],
    region: [''],
    tagRows: this.fb.array([this.createTagRow()]),
    addressesText: [''],
    enabled: [true]
  });

  constructor() {
    this.syncMethodValidators(this.discoveryForm.controls.method.value);
    this.load();
  }

  private static emptyDraft(): DiscoveryModalDraft {
    return {
      name: '',
      method: 'aws_ssm',
      snapshotScope: 'node',
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
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
  }

  openCreate(): void {
    this.editingId.set(null);
    const empty = DiscoveryPageComponent.emptyDraft();
    this.resetForm(empty);
    this.showModal.set(true);
  }

  edit(d: DiscoveryConfigV1): void {
    this.editingId.set(d.id || null);
    const draft: DiscoveryModalDraft = {
      name: d.name ?? '',
      method: coerceMethod(d.method),
      snapshotScope: d.snapshot_scope === 'group' ? 'group' : 'node',
      region: coerceMethod(d.method) !== 'static_ip' ? (d.region ?? '') : '',
      tagRows: parseTagRowsFromConfig(d),
      addressesText: parseAddressesText(d),
      enabled: d.enabled !== false
    };
    this.resetForm(draft);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  setMethod(m: DiscoveryMethodId): void {
    this.discoveryForm.controls.method.setValue(m);
    this.syncMethodValidators(m);
  }

  setSnapshotScope(scope: SnapshotScopeV1): void {
    this.discoveryForm.controls.snapshotScope.setValue(scope);
  }

  addTagRow(): void {
    this.tagRows().push(this.createTagRow());
  }

  removeTagRow(index: number): void {
    if (this.tagRows().length <= 1) {
      return;
    }
    this.tagRows().removeAt(index);
  }

  private buildPayloadFromDraft(): DiscoveryConfigV1 {
    const value = this.discoveryForm.getRawValue();
    const name = value.name?.trim() ?? '';
    const enabled = value.enabled;
    const method = value.method;
    const snapshotScope = value.snapshotScope;

    if (method === 'aws_ssm') {
      const region = value.region?.trim();
      const body: DiscoveryConfigV1 = { name, method, enabled, snapshot_scope: snapshotScope, parameters: {} };
      if (region) {
        body.region = region;
      }
      return body;
    }

    if (method === 'aws_tag') {
      const region = value.region?.trim();
      const tags = (value.tagRows as { key: string; value: string }[])
        .map(r => ({ key: r.key.trim(), value: r.value.trim() }))
        .filter(r => r.key.length > 0);
      const first = tags[0];
      const body: DiscoveryConfigV1 = {
        name,
        method,
        enabled,
        snapshot_scope: snapshotScope,
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

    const addresses = value.addressesText
      .split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    return {
      name,
      method,
      enabled,
      snapshot_scope: snapshotScope,
      parameters: { addresses }
    };
  }

  save(): void {
    if (this.discoveryForm.invalid) {
      return;
    }
    this.saving.set(true);
    const body = this.buildPayloadFromDraft();
    const id = this.editingId();
    const req = id ? this.api.updateDiscovery(id, { ...body, id }) : this.api.createDiscovery(body);
    req.subscribe({
      next: saved => {
        const savedId = saved.id ?? id ?? '';
        if (savedId) {
          const optimisticRow: DiscoveryConfigV1 = {
            ...body,
            ...saved,
            id: savedId
          };
          this.optimisticConfigsById.update(current => ({
            ...current,
            [savedId]: optimisticRow
          }));
          const scope = body.snapshot_scope === 'group' ? 'group' : 'node';
          this.pendingSnapshotScopeById.update(current => ({ ...current, [savedId]: scope }));
        }
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.actionError.set(extractApiError(err, 'Save failed'));
      }
    });
  }

  async remove(d: DiscoveryConfigV1): Promise<void> {
    if (!d.id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete discovery rule',
      message: 'Delete this discovery rule?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.api.deleteDiscovery(d.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Delete failed'))
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
        this.actionError.set(extractApiError(err, 'Run failed'));
      }
    });
  }

  currentMethod(): DiscoveryMethodId {
    return this.discoveryForm.controls.method.value;
  }

  tagRows(): FormArray<DiscoveryTagRowForm> {
    return this.discoveryForm.controls.tagRows;
  }

  private createTagRow(): DiscoveryTagRowForm {
    return this.fb.nonNullable.group({
      key: [''],
      value: ['']
    });
  }

  private resetForm(draft: DiscoveryModalDraft): void {
    this.discoveryForm.controls.name.setValue(draft.name);
    this.discoveryForm.controls.method.setValue(draft.method);
    this.discoveryForm.controls.snapshotScope.setValue(draft.snapshotScope);
    this.discoveryForm.controls.region.setValue(draft.region);
    this.discoveryForm.controls.addressesText.setValue(draft.addressesText);
    this.discoveryForm.controls.enabled.setValue(draft.enabled);
    this.tagRows().clear();
    const rows = draft.tagRows.length > 0 ? draft.tagRows : [{ key: '', value: '' }];
    for (const row of rows) {
      this.tagRows().push(this.fb.nonNullable.group({ key: [row.key], value: [row.value] }));
    }
    this.syncMethodValidators(draft.method);
  }

  private syncMethodValidators(method: DiscoveryMethodId): void {
    const region = this.discoveryForm.controls.region;
    const addressesText = this.discoveryForm.controls.addressesText;
    if (method === 'static_ip') {
      region.clearValidators();
      addressesText.setValidators([Validators.required]);
    } else {
      region.setValidators([Validators.required]);
      addressesText.clearValidators();
    }
    region.updateValueAndValidity({ emitEvent: false });
    addressesText.updateValueAndValidity({ emitEvent: false });
  }
}
