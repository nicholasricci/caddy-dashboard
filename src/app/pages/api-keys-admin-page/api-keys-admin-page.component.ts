import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { UpstreamProfilesApiService } from '../../services/api/upstream-profiles-api.service';
import {
  API_KEY_SCOPE_REGISTER_UPSTREAM,
  type APIKeyV1,
  type CreateAPIKeyRequestV1,
  type UpstreamProfileV1
} from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';
import { normalizeDiscoveryRows } from '../../core/api-list-normalize.util';
import { environment } from '../../../environments/environment';

type ApiKeyStatus = 'active' | 'revoked' | 'expired';

function parseScopesText(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

function apiKeyStatus(key: APIKeyV1): ApiKeyStatus {
  if (key.revoked_at) {
    return 'revoked';
  }
  if (key.expires_at) {
    const expires = Date.parse(key.expires_at);
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return 'expired';
    }
  }
  return 'active';
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

function datetimeLocalToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

@Component({
  selector: 'app-api-keys-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-6xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="lock" size="md" class="text-stitch-primary-fixed" />
            API keys
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed max-w-2xl">
            Machine-to-machine credentials for external automation (e.g.
            <span class="font-mono text-stitch-on-surface">register_upstream</span> on discovery groups). Admin only.
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

      <div class="flex justify-end mb-8">
        <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="openCreate()">
          <app-stitch-icon name="plus" size="xs" />
          Create API key
        </button>
      </div>

      @if (loading()) {
        <div class="flex py-16 stitch-panel justify-center">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (apiKeys().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
          <app-stitch-icon name="lock" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-sm text-stitch-on-surface-variant">No API keys yet. Create one for external register-upstream calls.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                <th class="font-medium py-6 px-4 text-left">Name</th>
                <th class="font-medium py-6 px-4 text-left">Prefix</th>
                <th class="font-medium py-6 px-4 text-left">Scopes</th>
                <th class="font-medium py-6 px-4 text-left">Discovery groups</th>
                <th class="font-medium py-6 px-4 text-left">Upstream profiles</th>
                <th class="font-medium py-6 px-4 text-left">Status</th>
                <th class="font-medium py-6 px-4 text-left">Last used</th>
                <th class="py-6 px-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (key of apiKeys(); track key.id; let i = $index) {
                <tr
                  class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                  [class.bg-transparent]="i % 2 === 0"
                  [class.bg-stitch-surface-low/80]="i % 2 !== 0"
                >
                  <td class="py-6 px-4 align-middle font-medium">{{ key.name || '—' }}</td>
                  <td class="py-6 px-4 align-middle font-mono text-xs">{{ key.key_prefix || '—' }}</td>
                  <td class="py-6 px-4 align-middle">
                    <div class="flex flex-wrap gap-1">
                      @for (scope of key.scopes || []; track scope) {
                        <span class="stitch-status-chip">{{ scope }}</span>
                      } @empty {
                        <span class="text-stitch-on-surface-variant">—</span>
                      }
                    </div>
                  </td>
                  <td class="py-6 px-4 align-middle text-xs">
                    {{ discoveryLabels(key.allowed_discovery_config_ids) }}
                  </td>
                  <td class="py-6 px-4 align-middle text-xs">
                    {{ profileLabels(key.allowed_upstream_profile_ids) }}
                  </td>
                  <td class="py-6 px-4 align-middle">
                    <span
                      class="stitch-status-chip"
                      [class.text-stitch-error]="statusOf(key) === 'revoked'"
                      [class.text-amber-700]="statusOf(key) === 'expired'"
                    >
                      {{ statusLabel(statusOf(key)) }}
                    </span>
                  </td>
                  <td class="py-6 px-4 align-middle text-xs font-mono text-stitch-on-surface-variant">
                    {{ formatTs(key.last_used_at) }}
                  </td>
                  <td class="py-6 px-4 text-right align-middle whitespace-nowrap">
                    @if (statusOf(key) === 'active') {
                      <button
                        type="button"
                        class="text-sm text-amber-700 hover:underline mr-3 inline-flex items-center gap-1"
                        (click)="revoke(key)"
                      >
                        Revoke
                      </button>
                    }
                    <button
                      type="button"
                      class="text-sm text-stitch-error hover:underline inline-flex items-center gap-1"
                      (click)="remove(key)"
                    >
                      <app-stitch-icon name="trash" size="xs" />
                      Delete
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (showCreateModal()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeCreateModal()"
          (keydown.escape)="closeCreateModal()"
        >
          <div
            class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-keys-create-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3 id="api-keys-create-title" class="font-display text-lg font-semibold mb-2 text-stitch-on-surface flex items-center gap-2">
              <app-stitch-icon name="plus" />
              New API key
            </h3>
            <p class="text-sm text-stitch-on-surface-variant mb-6">
              The secret is shown once after creation. Store it securely before closing the reveal dialog.
            </p>

            @if (createError()) {
              <p class="text-sm text-stitch-error mb-4">{{ createError() }}</p>
            }

            <form [formGroup]="keyForm" class="space-y-5">
              <div>
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="api-key-name"
                  >Name</label
                >
                <input id="api-key-name" class="input-technical mt-1" formControlName="name" autocomplete="off" />
              </div>

              <div>
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="api-key-scopes"
                  >Scopes</label
                >
                <textarea
                  id="api-key-scopes"
                  class="input-technical mt-1 font-mono text-sm min-h-[4rem]"
                  formControlName="scopesText"
                  placeholder="register_upstream"
                  rows="2"
                ></textarea>
                <p class="text-xs text-stitch-on-surface-variant mt-1">
                  Comma or newline separated. Today only
                  <span class="font-mono">{{ registerUpstreamScope }}</span> has effect.
                </p>
                @if (scopeWarning()) {
                  <p class="text-xs text-amber-700 mt-2">{{ scopeWarning() }}</p>
                }
              </div>

              <fieldset class="border-0 p-0 m-0 min-w-0">
                <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">
                  Allowed discovery groups <span class="text-stitch-error">*</span>
                </legend>
                @if (discoveryConfigs().length === 0) {
                  <p class="text-sm text-stitch-on-surface-variant">No discovery rules available. Create one first.</p>
                } @else {
                  <div class="space-y-2 max-h-40 overflow-y-auto stitch-panel stitch-panel--dim p-3">
                    @for (cfg of discoveryConfigs(); track cfg.id) {
                      <label class="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm mt-0.5"
                          [checked]="isDiscoverySelected(cfg.id)"
                          (change)="toggleDiscovery(cfg.id, $event)"
                        />
                        <span>
                          <span class="font-medium">{{ cfg.name || cfg.id }}</span>
                          @if (cfg.method) {
                            <span class="text-stitch-on-surface-variant font-mono text-xs ml-1">({{ cfg.method }})</span>
                          }
                        </span>
                      </label>
                    }
                  </div>
                }
                @if (discoverySelectionError()) {
                  <p class="text-xs text-stitch-error mt-2">{{ discoverySelectionError() }}</p>
                }
              </fieldset>

              @if (availableProfilesForSelection().length > 0) {
                <fieldset class="border-0 p-0 m-0 min-w-0">
                  <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">
                    Allowed upstream profiles (optional)
                  </legend>
                  <p class="text-xs text-stitch-on-surface-variant mb-2">
                    Restrict profile-based register calls. Leave empty to allow any profile on the selected discovery groups.
                  </p>
                  <div class="space-y-2 max-h-40 overflow-y-auto stitch-panel stitch-panel--dim p-3">
                    @for (profile of availableProfilesForSelection(); track profile.id) {
                      <label class="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm mt-0.5"
                          [checked]="isProfileSelected(profile.id)"
                          (change)="toggleProfile(profile.id, $event)"
                        />
                        <span>
                          <span class="font-medium">{{ profile.name || profile.id }}</span>
                          <span class="text-stitch-on-surface-variant font-mono text-xs ml-1"
                            >({{ discoveryLabels([profile.discovery_config_id ?? '']) }})</span
                          >
                        </span>
                      </label>
                    }
                  </div>
                </fieldset>
              }

              <div>
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="api-key-expires"
                  >Expires at (optional)</label
                >
                <input id="api-key-expires" class="input-technical mt-1" type="datetime-local" formControlName="expiresAt" />
              </div>
            </form>

            <div class="flex justify-end gap-3 mt-8">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeCreateModal()">Cancel</button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="keyForm.invalid || createBusy()"
                (click)="create()"
              >
                @if (createBusy()) {
                  <span class="loading loading-spinner loading-xs"></span>
                } @else {
                  <app-stitch-icon name="apply" size="xs" />
                }
                Create
              </button>
            </div>
          </div>
        </div>
      }

      @if (revealedSecret(); as reveal) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md">
          <div
            class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-xl border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-keys-secret-title"
            (keydown.escape)="$event.stopPropagation()"
          >
            <h3 id="api-keys-secret-title" class="font-display text-lg font-semibold mb-2 text-stitch-on-surface flex items-center gap-2">
              <app-stitch-icon name="lock" />
              API key created
            </h3>
            <p class="text-sm text-stitch-error font-medium mb-4">
              Copy this secret now. It cannot be retrieved again after you close this dialog.
            </p>

            <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-1" for="api-key-secret-value"
              >Secret</label
            >
            <div class="flex gap-2 mb-6">
              <input
                id="api-key-secret-value"
                class="input-technical font-mono text-sm flex-1"
                readonly
                [value]="reveal.secret"
              />
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="copySecret(reveal.secret)">
                Copy
              </button>
            </div>
            @if (copyFeedback()) {
              <p class="text-xs text-emerald-700 mb-4">Copied to clipboard.</p>
            }

            <div class="stitch-panel stitch-panel--dim p-4 mb-4">
              <p class="stitch-panel-title mb-2">Example: register upstream</p>
              <pre class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed">{{ registerUpstreamCurl(reveal) }}</pre>
            </div>

            @if (reveal.profileIds.length > 0) {
              <div class="stitch-panel stitch-panel--dim p-4 mb-6">
                <p class="stitch-panel-title mb-2">Example: register via upstream profile</p>
                <pre class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed">{{ registerProfileCurl(reveal) }}</pre>
              </div>
            } @else {
              <div class="mb-6"></div>
            }

            <div class="flex justify-end">
              <button type="button" class="btn-stitch-primary btn-stitch-primary--sm" (click)="acknowledgeSecret()">
                I have saved the secret
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ApiKeysAdminPageComponent {
  private readonly api = inject(DashboardApiService);
  private readonly profilesApi = inject(UpstreamProfilesApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly registerUpstreamScope = API_KEY_SCOPE_REGISTER_UPSTREAM;

  private readonly refreshVersion = signal(0);
  readonly actionError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly discoverySelectionError = signal<string | null>(null);
  readonly createBusy = signal(false);
  readonly showCreateModal = signal(false);
  readonly revealedSecret = signal<{ secret: string; discoveryIds: string[]; profileIds: string[] } | null>(null);
  readonly copyFeedback = signal(false);
  readonly selectedDiscoveryIds = signal<Set<string>>(new Set());
  readonly selectedUpstreamProfileIds = signal<Set<string>>(new Set());

  readonly dataResource = rxResource({
    params: () => this.refreshVersion(),
    stream: () =>
      this.api.listDiscovery().pipe(
        switchMap(discovery => {
          const configs = normalizeDiscoveryRows(discovery);
          const ids = configs.map(c => c.id).filter((id): id is string => !!id);
          const profiles$ =
            ids.length === 0
              ? of([] as UpstreamProfileV1[])
              : forkJoin(ids.map(id => this.profilesApi.listForDiscovery(id))).pipe(map(lists => lists.flat()));
          return forkJoin({
            keys: this.api.listApiKeys(),
            discovery: of(discovery),
            profiles: profiles$
          });
        })
      )
  });

  readonly apiKeys = computed(() => this.dataResource.value()?.keys ?? []);
  readonly discoveryConfigs = computed(() => normalizeDiscoveryRows(this.dataResource.value()?.discovery));
  readonly upstreamProfiles = computed(() => this.dataResource.value()?.profiles ?? []);
  readonly discoveryNameById = computed(() => {
    const map = new Map<string, string>();
    for (const cfg of this.discoveryConfigs()) {
      if (cfg.id) {
        map.set(cfg.id, cfg.name?.trim() || cfg.id);
      }
    }
    return map;
  });
  readonly profileNameById = computed(() => {
    const map = new Map<string, string>();
    for (const profile of this.upstreamProfiles()) {
      if (profile.id) {
        map.set(profile.id, profile.name?.trim() || profile.id);
      }
    }
    return map;
  });

  readonly availableProfilesForSelection = computed(() => {
    const selectedDiscovery = this.selectedDiscoveryIds();
    if (selectedDiscovery.size === 0) {
      return [];
    }
    return this.upstreamProfiles().filter(
      p => p.id && p.discovery_config_id && selectedDiscovery.has(p.discovery_config_id)
    );
  });

  readonly loading = computed(() => this.dataResource.isLoading());
  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.dataResource.error();
    return e ? extractApiError(e, 'Failed to load API keys') : null;
  });

  readonly keyForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    scopesText: [API_KEY_SCOPE_REGISTER_UPSTREAM, [Validators.required]],
    expiresAt: ['']
  });

  readonly scopeWarning = computed(() => {
    const scopes = parseScopesText(this.keyForm.controls.scopesText.value);
    const unknown = scopes.filter(s => s !== API_KEY_SCOPE_REGISTER_UPSTREAM);
    if (unknown.length === 0) {
      return null;
    }
    return `Scopes other than ${API_KEY_SCOPE_REGISTER_UPSTREAM} are stored but have no effect on the API today.`;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
    this.dataResource.reload();
  }

  statusOf(key: APIKeyV1): ApiKeyStatus {
    return apiKeyStatus(key);
  }

  statusLabel(status: ApiKeyStatus): string {
    if (status === 'revoked') {
      return 'Revoked';
    }
    if (status === 'expired') {
      return 'Expired';
    }
    return 'Active';
  }

  formatTs(value: string | null | undefined): string {
    return formatTimestamp(value);
  }

  discoveryLabels(ids: string[] | undefined): string {
    if (!ids?.length) {
      return '—';
    }
    const map = this.discoveryNameById();
    return ids.map(id => map.get(id) ?? id).join(', ');
  }

  profileLabels(ids: string[] | undefined): string {
    if (!ids?.length) {
      return '—';
    }
    const map = this.profileNameById();
    return ids.map(id => map.get(id) ?? id).join(', ');
  }

  openCreate(): void {
    this.createError.set(null);
    this.discoverySelectionError.set(null);
    this.keyForm.reset({
      name: '',
      scopesText: API_KEY_SCOPE_REGISTER_UPSTREAM,
      expiresAt: ''
    });
    this.selectedDiscoveryIds.set(new Set());
    this.selectedUpstreamProfileIds.set(new Set());
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createError.set(null);
    this.discoverySelectionError.set(null);
  }

  isDiscoverySelected(id: string | undefined): boolean {
    if (!id) {
      return false;
    }
    return this.selectedDiscoveryIds().has(id);
  }

  toggleDiscovery(id: string | undefined, event: Event): void {
    if (!id) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedDiscoveryIds.update(set => {
      const next = new Set(set);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
        const profilesOnDiscovery = this.upstreamProfiles()
          .filter(p => p.discovery_config_id === id)
          .map(p => p.id)
          .filter((pid): pid is string => !!pid);
        this.selectedUpstreamProfileIds.update(profileSet => {
          const nextProfiles = new Set(profileSet);
          for (const pid of profilesOnDiscovery) {
            nextProfiles.delete(pid);
          }
          return nextProfiles;
        });
      }
      return next;
    });
    this.discoverySelectionError.set(null);
  }

  isProfileSelected(id: string | undefined): boolean {
    if (!id) {
      return false;
    }
    return this.selectedUpstreamProfileIds().has(id);
  }

  toggleProfile(id: string | undefined, event: Event): void {
    if (!id) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedUpstreamProfileIds.update(set => {
      const next = new Set(set);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  create(): void {
    if (this.keyForm.invalid) {
      return;
    }
    const discoveryIds = [...this.selectedDiscoveryIds()];
    if (discoveryIds.length === 0) {
      this.discoverySelectionError.set('Select at least one discovery group.');
      return;
    }

    const value = this.keyForm.getRawValue();
    const scopes = parseScopesText(value.scopesText);
    if (scopes.length === 0) {
      this.createError.set('At least one scope is required.');
      return;
    }

    const profileIds = [...this.selectedUpstreamProfileIds()];
    const body: CreateAPIKeyRequestV1 = {
      name: value.name.trim(),
      scopes,
      allowed_discovery_config_ids: discoveryIds,
      expires_at: datetimeLocalToIso(value.expiresAt),
      ...(profileIds.length > 0 ? { allowed_upstream_profile_ids: profileIds } : {})
    };

    this.createBusy.set(true);
    this.createError.set(null);
    this.api.createApiKey(body).subscribe({
      next: res => {
        this.createBusy.set(false);
        this.closeCreateModal();
        this.copyFeedback.set(false);
        this.revealedSecret.set({
          secret: res.secret,
          discoveryIds,
          profileIds
        });
        this.load();
      },
      error: err => {
        this.createBusy.set(false);
        this.createError.set(extractApiError(err, 'Create failed'));
      }
    });
  }

  async copySecret(secret: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(secret);
      this.copyFeedback.set(true);
    } catch {
      this.copyFeedback.set(false);
    }
  }

  registerUpstreamCurl(reveal: { secret: string; discoveryIds: string[] }): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const discoveryId = reveal.discoveryIds[0] ?? '<discovery-config-id>';
    return `curl -X POST "${base}/discovery/${discoveryId}/register-upstream" \\
  -H "Authorization: ${reveal.secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"config_id":"@your-route-id","dial":"10.0.0.5:8080"}'`;
  }

  registerProfileCurl(reveal: { secret: string; profileIds: string[] }): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const profileId = reveal.profileIds[0] ?? '<upstream-profile-id>';
    return `curl -X POST "${base}/upstream-profiles/${profileId}/register" \\
  -H "Authorization: ${reveal.secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"private_ip":"10.0.0.5"}'`;
  }

  acknowledgeSecret(): void {
    this.revealedSecret.set(null);
    this.copyFeedback.set(false);
  }

  async revoke(key: APIKeyV1): Promise<void> {
    if (!key.id || apiKeyStatus(key) !== 'active') {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Revoke API key',
      message: `Revoke "${key.name}"? The key stays in the audit log but can no longer authenticate.`,
      confirmLabel: 'Revoke',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.api.revokeApiKey(key.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Revoke failed'))
    });
  }

  async remove(key: APIKeyV1): Promise<void> {
    if (!key.id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete API key',
      message: `Permanently delete "${key.name}"? This removes the record from the database.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.api.deleteApiKey(key.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Delete failed'))
    });
  }
}
