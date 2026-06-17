import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { startWith } from 'rxjs/operators';
import type {
  CaddyConfigHostsResponseV1,
  CaddyConfigIdInfoV1,
  CaddyConfigUpstreamsResponseV1,
  MutateDomainsResponseV1,
  MutateUpstreamsResponseV1
} from '../../models/api-v1.model';
import { parseIntegerList, parseLineList } from '../../core/mutation-form.util';
import { extractApiError } from '../../core/http-error.util';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

type RightPanelTab = 'inspect' | 'domains' | 'upstreams';
type MutationKind = 'domains' | 'upstreams';
type MutationMode = 'preview' | 'applied';

interface MutationResultVm {
  kind: MutationKind;
  mode: MutationMode;
  response: MutateDomainsResponseV1 | MutateUpstreamsResponseV1;
}

@Component({
  selector: 'app-live-config-id-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent],
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
                <div class="mb-3">
                  <label
                    for="live-config-id-filter"
                    class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                    >Search IDs</label
                  >
                  <input
                    id="live-config-id-filter"
                    type="search"
                    autocomplete="off"
                    class="input-technical mt-1 w-full font-mono text-xs"
                    aria-controls="live-config-id-list"
                    [value]="idSearchQuery()"
                    (input)="onIdSearchInput($event)"
                  />
                </div>
                @if (filteredIdItems().length === 0) {
                  <p class="text-sm text-stitch-on-surface-variant">No matching IDs.</p>
                } @else {
                  <ul id="live-config-id-list" class="space-y-2">
                    @for (item of filteredIdItems(); track trackId(item, $index)) {
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
              }
            </aside>

            <section class="min-h-0 flex flex-col">
              @if (!selectedId()) {
                <p class="text-sm text-stitch-on-surface-variant p-4 md:p-5">
                  Select an @id to inspect config fragment and upstreams.
                </p>
              } @else {
                <div class="shrink-0 px-4 md:px-5 pt-4 border-b border-stitch-ghost">
                  <div class="stitch-panel stitch-panel--dim !p-3 mb-3">
                    <p class="stitch-panel-title mb-1">Selected ID</p>
                    <p class="font-mono text-xs text-stitch-on-surface break-all">{{ selectedId() }}</p>
                  </div>
                  <div class="flex flex-wrap gap-2 pb-3" role="tablist" aria-label="Live config panel">
                    @for (tab of panelTabs; track tab.id) {
                      <button
                        type="button"
                        role="tab"
                        class="btn-stitch-secondary btn-stitch-secondary--sm text-[11px]"
                        [class.ring-2]="rightPanelTab() === tab.id"
                        [class.ring-stitch-primary]="rightPanelTab() === tab.id"
                        [attr.aria-selected]="rightPanelTab() === tab.id"
                        (click)="setRightPanelTab(tab.id)"
                      >
                        {{ tab.label }}
                      </button>
                    }
                  </div>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
                  @if (rightPanelTab() === 'inspect') {
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
                  }

                  @if (rightPanelTab() === 'domains') {
                    <form [formGroup]="domainsForm" class="space-y-4" (ngSubmit)="$event.preventDefault()">
                      <div>
                        <label for="mutate-add-domains" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                          >Add domains</label
                        >
                        <textarea
                          id="mutate-add-domains"
                          formControlName="add_domains"
                          rows="3"
                          class="input-technical w-full font-mono text-xs"
                          placeholder="one domain per line or comma-separated"
                        ></textarea>
                      </div>
                      <div>
                        <label for="mutate-remove-domains" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                          >Remove domains</label
                        >
                        <textarea
                          id="mutate-remove-domains"
                          formControlName="remove_domains"
                          rows="3"
                          class="input-technical w-full font-mono text-xs"
                          placeholder="one domain per line or comma-separated"
                        ></textarea>
                      </div>
                      <label class="flex items-center gap-2 text-sm text-stitch-on-surface">
                        <input type="checkbox" formControlName="update_tls_policies" class="checkbox checkbox-sm" />
                        Update TLS policies
                      </label>

                      <details class="stitch-panel stitch-panel--dim !p-4">
                        <summary class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant cursor-pointer select-none">
                          Advanced
                        </summary>
                        <div class="mt-4 space-y-4">
                          <div>
                            <label for="mutate-match-indexes" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                              >Match indexes</label
                            >
                            <textarea
                              id="mutate-match-indexes"
                              formControlName="match_indexes"
                              rows="2"
                              class="input-technical w-full font-mono text-xs"
                              placeholder="0, 1"
                            ></textarea>
                          </div>
                          <div>
                            <label for="mutate-dns-provider" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                              >DNS challenge provider</label
                            >
                            <input
                              id="mutate-dns-provider"
                              type="text"
                              formControlName="dns_provider"
                              class="input-technical w-full font-mono text-xs"
                              autocomplete="off"
                            />
                          </div>
                          <div>
                            <label for="mutate-dns-token" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                              >DNS challenge API token</label
                            >
                            <input
                              id="mutate-dns-token"
                              type="password"
                              formControlName="dns_api_token"
                              class="input-technical w-full font-mono text-xs"
                              autocomplete="off"
                            />
                          </div>
                        </div>
                      </details>

                      @if (domainsFormInvalid()) {
                        <p class="text-sm text-stitch-error">Add or remove at least one domain before preview.</p>
                      }
                    </form>
                  }

                  @if (rightPanelTab() === 'upstreams') {
                    <form [formGroup]="upstreamsForm" class="space-y-4" (ngSubmit)="$event.preventDefault()">
                      <div>
                        <label for="mutate-add-dial" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                          >Add dial</label
                        >
                        <input
                          id="mutate-add-dial"
                          type="text"
                          formControlName="add_dial"
                          class="input-technical w-full font-mono text-xs"
                          placeholder="127.0.0.1:8080"
                        />
                      </div>
                      <div>
                        <label for="mutate-remove-dial" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                          >Remove dial</label
                        >
                        <input
                          id="mutate-remove-dial"
                          type="text"
                          formControlName="remove_dial"
                          class="input-technical w-full font-mono text-xs"
                          placeholder="127.0.0.1:8081"
                        />
                      </div>
                      <label class="flex items-center gap-2 text-sm text-stitch-on-surface">
                        <input type="checkbox" formControlName="prune_unhealthy" class="checkbox checkbox-sm" />
                        Prune unhealthy upstreams
                      </label>

                      <details class="stitch-panel stitch-panel--dim !p-4">
                        <summary class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant cursor-pointer select-none">
                          Advanced
                        </summary>
                        <div class="mt-4">
                          <label for="mutate-probe-timeout" class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-2"
                            >Probe timeout (ms)</label
                          >
                          <input
                            id="mutate-probe-timeout"
                            type="number"
                            formControlName="probe_timeout_ms"
                            class="input-technical w-full font-mono text-xs"
                            min="0"
                          />
                        </div>
                      </details>

                      @if (upstreamsFormInvalid()) {
                        <p class="text-sm text-stitch-error">
                          Provide add dial, remove dial, or enable prune unhealthy before preview.
                        </p>
                      }
                    </form>
                  }

                  @if (mutationResult(); as result) {
                    <div class="stitch-panel stitch-panel--dim !p-4 space-y-3">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="stitch-status-chip">{{ resultBadge(result) }}</span>
                        <p class="stitch-panel-title">Mutation result</p>
                      </div>
                      @if (mutationDiffPretty(result); as diffText) {
                        <div>
                          <p class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-1">Diff</p>
                          <pre class="text-xs font-mono text-stitch-on-surface overflow-auto">{{ diffText }}</pre>
                        </div>
                      }
                      @if (result.response.preview) {
                        <div>
                          <p class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant mb-1">Preview config</p>
                          <pre class="text-xs font-mono text-stitch-on-surface overflow-auto max-h-48">{{ previewPretty(result) }}</pre>
                        </div>
                      }
                    </div>
                  }

                  @if (mutationError()) {
                    <p class="text-sm text-stitch-error">{{ mutationError() }}</p>
                  }
                </div>

                @if (rightPanelTab() === 'domains' || rightPanelTab() === 'upstreams') {
                  <div class="shrink-0 px-4 md:px-5 py-3 border-t border-stitch-ghost flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm"
                      [disabled]="mutationBusy() || mutationFormInvalid()"
                      (click)="runPreview()"
                    >
                      @if (mutationBusy()) {
                        <span class="loading loading-spinner loading-xs"></span>
                      }
                      Preview
                    </button>
                    <button
                      type="button"
                      class="btn-stitch-primary btn-stitch-primary--sm"
                      [disabled]="mutationBusy() || !canApplyMutation()"
                      (click)="runApply()"
                    >
                      Apply
                    </button>
                  </div>
                }
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
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private loadVersion = 0;

  readonly panelTabs: { id: RightPanelTab; label: string }[] = [
    { id: 'inspect', label: 'Inspect' },
    { id: 'domains', label: 'Domains' },
    { id: 'upstreams', label: 'Upstreams' }
  ];

  readonly open = input.required<boolean>();
  readonly nodeId = input<string>('');
  readonly nodeName = input<string>('');
  readonly closeRequested = output<void>();

  readonly loadingIds = signal(false);
  readonly idsError = signal<string | null>(null);
  readonly idItems = signal<CaddyConfigIdInfoV1[]>([]);
  readonly idSearchQuery = signal('');

  readonly selectedId = signal<string | null>(null);
  readonly selectedItem = signal<CaddyConfigIdInfoV1 | null>(null);
  readonly loadingDetail = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly currentFragment = signal<Record<string, unknown> | null>(null);
  readonly currentUpstreams = signal<CaddyConfigUpstreamsResponseV1 | null>(null);
  readonly currentHosts = signal<CaddyConfigHostsResponseV1 | null>(null);

  readonly rightPanelTab = signal<RightPanelTab>('inspect');
  readonly mutationBusy = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly mutationResult = signal<MutationResultVm | null>(null);
  readonly previewFingerprint = signal<string | null>(null);

  readonly domainsForm = this.fb.nonNullable.group({
    add_domains: [''],
    remove_domains: [''],
    update_tls_policies: [false],
    match_indexes: [''],
    dns_provider: [''],
    dns_api_token: ['']
  });

  readonly upstreamsForm = this.fb.nonNullable.group({
    add_dial: [''],
    remove_dial: [''],
    prune_unhealthy: [false],
    probe_timeout_ms: ['']
  });

  private readonly domainsFormValue = toSignal(
    this.domainsForm.valueChanges.pipe(startWith(this.domainsForm.getRawValue())),
    { initialValue: this.domainsForm.getRawValue() }
  );
  private readonly upstreamsFormValue = toSignal(
    this.upstreamsForm.valueChanges.pipe(startWith(this.upstreamsForm.getRawValue())),
    { initialValue: this.upstreamsForm.getRawValue() }
  );

  readonly fragmentPretty = computed(() => JSON.stringify(this.currentFragment() ?? {}, null, 2));
  readonly upstreamsPretty = computed(() => JSON.stringify(this.currentUpstreams()?.upstreams ?? [], null, 2));
  readonly hostsPretty = computed(() => JSON.stringify(this.currentHosts()?.hosts ?? [], null, 2));

  readonly filteredIdItems = computed(() => {
    const q = this.idSearchQuery().trim().toLowerCase();
    const items = this.idItems();
    if (!q) {
      return items;
    }
    return items.filter(item => (item.id ?? '').toLowerCase().includes(q));
  });

  readonly domainsFormInvalid = computed(() => {
    const domains = this.domainsFormValue();
    return this.rightPanelTab() === 'domains' && !this.domainsPayloadValid(domains);
  });
  readonly upstreamsFormInvalid = computed(() => {
    const upstreams = this.upstreamsFormValue();
    return this.rightPanelTab() === 'upstreams' && !this.upstreamsPayloadValid(upstreams);
  });

  readonly mutationFormInvalid = computed(() => {
    const domains = this.domainsFormValue();
    const upstreams = this.upstreamsFormValue();
    if (this.rightPanelTab() === 'domains') {
      return !this.domainsPayloadValid(domains);
    }
    if (this.rightPanelTab() === 'upstreams') {
      return !this.upstreamsPayloadValid(upstreams);
    }
    return true;
  });

  readonly canApplyMutation = computed(() => {
    const fp = this.previewFingerprint();
    if (!fp) {
      return false;
    }
    return fp === this.currentMutationFingerprint();
  });

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

    effect(() => {
      this.domainsFormValue();
      this.upstreamsFormValue();
      this.rightPanelTab();
      this.selectedId();
      this.invalidatePreview();
    });
  }

  trackId(item: CaddyConfigIdInfoV1, index: number): string | number {
    return item.id ?? index;
  }

  onIdSearchInput(event: Event): void {
    const el = event.target as HTMLInputElement | null;
    this.idSearchQuery.set(el?.value ?? '');
  }

  setRightPanelTab(tab: RightPanelTab): void {
    this.rightPanelTab.set(tab);
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
    this.selectedItem.set(item);
    this.rightPanelTab.set('inspect');
    this.resetMutationForms();
    this.clearMutationState();
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

  runPreview(): void {
    void this.executeMutation(true);
  }

  async runApply(): Promise<void> {
    const tab = this.rightPanelTab();
    if (tab !== 'domains' && tab !== 'upstreams') {
      return;
    }
    const ok = await this.confirm.ask({
      title: tab === 'domains' ? 'Apply domain mutation?' : 'Apply upstream mutation?',
      message:
        'This updates the live Caddy configuration on the node. Run Preview first if you have not reviewed the diff.',
      confirmLabel: 'Apply'
    });
    if (!ok) {
      return;
    }
    void this.executeMutation(false);
  }

  resultBadge(result: MutationResultVm): string {
    if (result.mode === 'preview') {
      return 'preview';
    }
    return result.response.changed ? 'applied' : 'unchanged';
  }

  mutationDiffPretty(result: MutationResultVm): string | null {
    const diff = result.response.diff;
    if (!diff || Object.keys(diff).length === 0) {
      return null;
    }
    return JSON.stringify(diff, null, 2);
  }

  previewPretty(result: MutationResultVm): string {
    return JSON.stringify(result.response.preview ?? {}, null, 2);
  }

  private invalidatePreview(): void {
    const fp = this.previewFingerprint();
    if (!fp) {
      return;
    }
    if (fp !== this.currentMutationFingerprint()) {
      this.previewFingerprint.set(null);
    }
  }

  private clearMutationState(): void {
    this.mutationError.set(null);
    this.mutationResult.set(null);
    this.previewFingerprint.set(null);
    this.mutationBusy.set(false);
  }

  private resetMutationForms(): void {
    this.domainsForm.reset({
      add_domains: '',
      remove_domains: '',
      update_tls_policies: false,
      match_indexes: '',
      dns_provider: '',
      dns_api_token: ''
    });
    this.upstreamsForm.reset({
      add_dial: '',
      remove_dial: '',
      prune_unhealthy: false,
      probe_timeout_ms: ''
    });
  }

  private domainsPayloadValid(formValue: {
    add_domains?: string;
    remove_domains?: string;
  }): boolean {
    const add = parseLineList(formValue.add_domains ?? '');
    const remove = parseLineList(formValue.remove_domains ?? '');
    return add.length > 0 || remove.length > 0;
  }

  private upstreamsPayloadValid(formValue: {
    add_dial?: string;
    remove_dial?: string;
    prune_unhealthy?: boolean;
  }): boolean {
    const add = (formValue.add_dial ?? '').trim();
    const remove = (formValue.remove_dial ?? '').trim();
    const prune = Boolean(formValue.prune_unhealthy);
    return Boolean(add || remove || prune);
  }

  private currentMutationFingerprint(): string | null {
    const tab = this.rightPanelTab();
    const configId = this.selectedId();
    if (!configId) {
      return null;
    }
    if (tab === 'domains') {
      return JSON.stringify({ tab, configId, ...this.domainsForm.getRawValue() });
    }
    if (tab === 'upstreams') {
      return JSON.stringify({ tab, configId, ...this.upstreamsForm.getRawValue() });
    }
    return null;
  }

  private async executeMutation(dryRun: boolean): Promise<void> {
    const nodeId = this.nodeId();
    const configId = this.selectedId();
    const tab = this.rightPanelTab();
    if (!nodeId || !configId || (tab !== 'domains' && tab !== 'upstreams')) {
      return;
    }
    if (!dryRun && !this.canApplyMutation()) {
      return;
    }

    this.mutationBusy.set(true);
    this.mutationError.set(null);

    if (tab === 'domains') {
      const body = this.buildDomainsRequest(configId, dryRun);
      this.api.mutateDomains(nodeId, body).subscribe({
        next: res => this.onMutationSuccess('domains', dryRun, res),
        error: err => this.onMutationError(err)
      });
      return;
    }

    const body = this.buildUpstreamsRequest(configId, dryRun);
    this.api.mutateUpstreams(nodeId, body).subscribe({
      next: res => this.onMutationSuccess('upstreams', dryRun, res),
      error: err => this.onMutationError(err)
    });
  }

  private buildDomainsRequest(configId: string, dryRun: boolean) {
    const add = parseLineList(this.domainsForm.controls.add_domains.value);
    const remove = parseLineList(this.domainsForm.controls.remove_domains.value);
    const matchIndexes = parseIntegerList(this.domainsForm.controls.match_indexes.value);
    const provider = this.domainsForm.controls.dns_provider.value.trim();
    const token = this.domainsForm.controls.dns_api_token.value.trim();
    const target: {
      config_id: string;
      add_domains?: string[];
      remove_domains?: string[];
      match_indexes?: number[];
    } = { config_id: configId };
    if (add.length) {
      target.add_domains = add;
    }
    if (remove.length) {
      target.remove_domains = remove;
    }
    if (matchIndexes.length) {
      target.match_indexes = matchIndexes;
    }
    const body: {
      dry_run: boolean;
      targets: typeof target[];
      update_tls_policies?: boolean;
      dns_challenge?: { provider?: string; api_token?: string };
    } = {
      dry_run: dryRun,
      targets: [target]
    };
    if (this.domainsForm.controls.update_tls_policies.value) {
      body.update_tls_policies = true;
    }
    if (provider || token) {
      body.dns_challenge = {
        ...(provider ? { provider } : {}),
        ...(token ? { api_token: token } : {})
      };
    }
    return body;
  }

  private buildUpstreamsRequest(configId: string, dryRun: boolean) {
    const add = this.upstreamsForm.controls.add_dial.value.trim();
    const remove = this.upstreamsForm.controls.remove_dial.value.trim();
    const probeRaw = this.upstreamsForm.controls.probe_timeout_ms.value.trim();
    const probe = probeRaw ? Number.parseInt(probeRaw, 10) : NaN;
    const target: {
      config_id: string;
      add_dial?: string;
      remove_dial?: string;
      probe_timeout_ms?: number;
      prune_unhealthy?: boolean;
    } = { config_id: configId };
    if (add) {
      target.add_dial = add;
    }
    if (remove) {
      target.remove_dial = remove;
    }
    if (this.upstreamsForm.controls.prune_unhealthy.value) {
      target.prune_unhealthy = true;
    }
    if (Number.isFinite(probe) && probe > 0) {
      target.probe_timeout_ms = probe;
    }
    return {
      dry_run: dryRun,
      targets: [target]
    };
  }

  private onMutationSuccess(
    kind: MutationKind,
    dryRun: boolean,
    response: MutateDomainsResponseV1 | MutateUpstreamsResponseV1
  ): void {
    this.mutationBusy.set(false);
    this.mutationResult.set({
      kind,
      mode: dryRun ? 'preview' : 'applied',
      response
    });
    if (dryRun) {
      this.previewFingerprint.set(this.currentMutationFingerprint());
      return;
    }
    this.previewFingerprint.set(null);
    this.domainsForm.controls.dns_api_token.setValue('');
    const item = this.selectedItem();
    if (item) {
      this.select(item);
    }
  }

  private onMutationError(err: unknown): void {
    this.mutationBusy.set(false);
    this.mutationError.set(extractApiError(err, 'Mutation request failed.'));
  }

  private fetchIds(nodeId: string): void {
    this.loadingIds.set(true);
    this.idsError.set(null);
    this.idItems.set([]);
    this.idSearchQuery.set('');
    this.selectedId.set(null);
    this.selectedItem.set(null);
    this.currentFragment.set(null);
    this.currentUpstreams.set(null);
    this.currentHosts.set(null);
    this.detailError.set(null);
    this.loadingDetail.set(false);
    this.rightPanelTab.set('inspect');
    this.resetMutationForms();
    this.clearMutationState();
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
