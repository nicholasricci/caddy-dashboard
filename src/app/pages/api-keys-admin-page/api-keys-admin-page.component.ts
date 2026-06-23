import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { UpstreamProfilesApiService } from '../../services/api/upstream-profiles-api.service';
import { DomainProfilesApiService } from '../../services/api/domain-profiles-api.service';
import {
  API_KEY_KNOWN_SCOPES,
  API_KEY_SCOPE_REGISTER_DOMAIN,
  API_KEY_SCOPE_REGISTER_UPSTREAM,
  type APIKeyV1,
  type CreateAPIKeyRequestV1,
  type DomainProfileV1,
  type UpstreamProfileV1
} from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ProfileRegisterSnippetsComponent } from '../../ui/profile-register-snippets.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';
import {
  DOMAIN_PROFILE_API_KEYS_RESTRICT_NOTE,
  DOMAIN_PROFILE_CURL_INTRO,
  DOMAIN_PROFILE_SUMMARY,
  exampleDomainProfileCurl,
  exampleUpstreamProfileCurl,
  UPSTREAM_PROFILE_API_KEYS_RESTRICT_NOTE,
  UPSTREAM_PROFILE_CURL_INTRO,
  UPSTREAM_PROFILE_SUMMARY
} from '../../core/profile-help.copy';
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
  imports: [ReactiveFormsModule, StitchIconComponent, ProfileRegisterSnippetsComponent],
  template: `
    <div class="w-full min-w-0 px-10 py-12 max-w-7xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="lock" size="md" class="text-stitch-primary-fixed" />
            API keys
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed max-w-2xl">
            Machine-to-machine credentials for external automation (scopes
            <span class="font-mono text-stitch-on-surface">{{ registerUpstreamScope }}</span>,
            <span class="font-mono text-stitch-on-surface">{{ registerDomainScope }}</span>). Admin only.
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
        <div class="min-w-0 rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                <th class="font-medium py-4 px-4 text-left">Name</th>
                <th class="font-medium py-4 px-4 text-left">Prefix</th>
                <th class="font-medium py-4 px-4 text-left">Scopes</th>
                <th class="font-medium py-4 px-4 text-left">Access</th>
                <th class="font-medium py-4 px-4 text-left">Status</th>
                <th class="font-medium py-4 px-4 text-left">Last used</th>
                <th class="font-medium py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (key of apiKeys(); track key.id; let i = $index) {
                <tr
                  class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                  [class.bg-transparent]="i % 2 === 0"
                  [class.bg-stitch-surface-low/80]="i % 2 !== 0"
                >
                  <td class="py-4 px-4 align-middle font-medium min-w-0 break-words">{{ key.name || '—' }}</td>
                  <td class="py-4 px-4 align-middle font-mono text-xs min-w-0 break-all">{{ key.key_prefix || '—' }}</td>
                  <td class="py-4 px-4 align-middle min-w-0">
                    <div class="flex flex-wrap gap-1 max-w-full">
                      @for (scope of key.scopes || []; track scope) {
                        <span class="stitch-status-chip max-w-full break-all">{{ scope }}</span>
                      } @empty {
                        <span class="text-stitch-on-surface-variant">—</span>
                      }
                    </div>
                  </td>
                  <td class="py-4 px-4 align-middle text-xs min-w-0 space-y-1">
                    <div class="break-words">
                      <span class="text-stitch-on-surface-variant">Discovery:</span>
                      {{ discoveryLabels(key.allowed_discovery_config_ids) }}
                    </div>
                    <div class="break-words">
                      <span class="text-stitch-on-surface-variant">Upstream:</span>
                      {{ profileLabels(key.allowed_upstream_profile_ids) }}
                    </div>
                    <div class="break-words">
                      <span class="text-stitch-on-surface-variant">Domain:</span>
                      {{ domainProfileLabels(key.allowed_domain_profile_ids) }}
                    </div>
                  </td>
                  <td class="py-4 px-4 align-middle">
                    <span
                      class="stitch-status-chip"
                      [class.text-stitch-error]="statusOf(key) === 'revoked'"
                      [class.text-amber-700]="statusOf(key) === 'expired'"
                    >
                      {{ statusLabel(statusOf(key)) }}
                    </span>
                  </td>
                  <td class="py-4 px-4 align-middle text-xs font-mono text-stitch-on-surface-variant min-w-0 break-words">
                    {{ formatTs(key.last_used_at) }}
                  </td>
                  <td class="py-4 px-4 text-right align-middle min-w-0">
                    <div class="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    @if (statusOf(key) === 'active') {
                      <button
                        type="button"
                        class="text-sm text-amber-700 hover:underline inline-flex items-center gap-1 shrink-0"
                        (click)="revoke(key)"
                      >
                        Revoke
                      </button>
                    }
                    <button
                      type="button"
                      class="text-sm text-stitch-error hover:underline inline-flex items-center gap-1 shrink-0"
                      (click)="remove(key)"
                    >
                      <app-stitch-icon name="trash" size="xs" />
                      Delete
                    </button>
                    </div>
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
                  placeholder="register_upstream&#10;register_domain"
                  rows="2"
                ></textarea>
                <p class="text-xs text-stitch-on-surface-variant mt-1">
                  Comma or newline separated. Known scopes:
                  <span class="font-mono">{{ registerUpstreamScope }}</span>,
                  <span class="font-mono">{{ registerDomainScope }}</span>.
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

              @if (hasRegisterUpstreamScope() && availableUpstreamProfilesForSelection().length > 0) {
                <fieldset class="border-0 p-0 m-0 min-w-0">
                  <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">
                    Allowed upstream profiles (optional)
                  </legend>
                  <p class="text-xs text-stitch-on-surface-variant mb-2 leading-relaxed">
                    {{ upstreamProfileSummary }} {{ upstreamProfileApiKeysRestrictNote }}
                  </p>
                  <div class="space-y-2 max-h-40 overflow-y-auto stitch-panel stitch-panel--dim p-3">
                    @for (profile of availableUpstreamProfilesForSelection(); track profile.id) {
                      <label class="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm mt-0.5"
                          [checked]="isUpstreamProfileSelected(profile.id)"
                          (change)="toggleUpstreamProfile(profile.id, $event)"
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
                  <details class="mt-3 rounded-sm border border-stitch-ghost p-3">
                    <summary class="text-sm font-medium text-stitch-on-surface cursor-pointer">Example call</summary>
                    <pre
                      class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed mt-3"
                    >{{ createModalUpstreamProfileCurl }}</pre>
                  </details>
                </fieldset>
              }

              @if (hasRegisterDomainScope() && availableDomainProfilesForSelection().length > 0) {
                <fieldset class="border-0 p-0 m-0 min-w-0">
                  <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">
                    Allowed domain profiles (optional)
                  </legend>
                  <p class="text-xs text-stitch-on-surface-variant mb-2 leading-relaxed">
                    {{ domainProfileSummary }} {{ domainProfileApiKeysRestrictNote }}
                  </p>
                  <div class="space-y-2 max-h-40 overflow-y-auto stitch-panel stitch-panel--dim p-3">
                    @for (profile of availableDomainProfilesForSelection(); track profile.id) {
                      <label class="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm mt-0.5"
                          [checked]="isDomainProfileSelected(profile.id)"
                          (change)="toggleDomainProfile(profile.id, $event)"
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
                  <details class="mt-3 rounded-sm border border-stitch-ghost p-3">
                    <summary class="text-sm font-medium text-stitch-on-surface cursor-pointer">Example call</summary>
                    <pre
                      class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed mt-3"
                    >{{ createModalDomainProfileCurl }}</pre>
                  </details>
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

            @if (revealHasRegisterUpstreamScope(reveal)) {
              <div class="stitch-panel stitch-panel--dim p-4 mb-4">
                <p class="text-xs text-stitch-on-surface-variant mb-3 leading-relaxed">{{ upstreamProfileCurlIntro }}</p>
                <p class="stitch-panel-title mb-3">Example: register via upstream profile</p>
                <app-profile-register-snippets
                  kind="upstream"
                  [profileId]="revealUpstreamProfileId(reveal)"
                  [apiKey]="reveal.secret"
                />
              </div>
            }

            @if (revealHasRegisterUpstreamScope(reveal)) {
              <div class="stitch-panel stitch-panel--dim p-4 mb-4">
                <p class="stitch-panel-title mb-2">Example: register upstream (per route)</p>
                <pre class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed">{{ registerUpstreamCurl(reveal) }}</pre>
              </div>
            }

            @if (revealHasRegisterDomainScope(reveal)) {
              <div class="stitch-panel stitch-panel--dim p-4 mb-4">
                <p class="text-xs text-stitch-on-surface-variant mb-3 leading-relaxed">{{ domainProfileCurlIntro }}</p>
                <p class="stitch-panel-title mb-3">Example: register via domain profile</p>
                <app-profile-register-snippets
                  kind="domain"
                  [profileId]="revealDomainProfileId(reveal)"
                  [apiKey]="reveal.secret"
                />
              </div>
            }

            @if (revealHasRegisterDomainScope(reveal)) {
              <div class="stitch-panel stitch-panel--dim p-4 mb-6">
                <p class="stitch-panel-title mb-2">Example: register domain (per route)</p>
                <pre class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed">{{ registerDomainCurl(reveal) }}</pre>
              </div>
            } @else if (!revealHasRegisterUpstreamScope(reveal)) {
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
  private readonly upstreamProfilesApi = inject(UpstreamProfilesApiService);
  private readonly domainProfilesApi = inject(DomainProfilesApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly registerUpstreamScope = API_KEY_SCOPE_REGISTER_UPSTREAM;
  readonly registerDomainScope = API_KEY_SCOPE_REGISTER_DOMAIN;
  readonly upstreamProfileSummary = UPSTREAM_PROFILE_SUMMARY;
  readonly domainProfileSummary = DOMAIN_PROFILE_SUMMARY;
  readonly upstreamProfileApiKeysRestrictNote = UPSTREAM_PROFILE_API_KEYS_RESTRICT_NOTE;
  readonly domainProfileApiKeysRestrictNote = DOMAIN_PROFILE_API_KEYS_RESTRICT_NOTE;
  readonly upstreamProfileCurlIntro = UPSTREAM_PROFILE_CURL_INTRO;
  readonly domainProfileCurlIntro = DOMAIN_PROFILE_CURL_INTRO;
  readonly createModalUpstreamProfileCurl = exampleUpstreamProfileCurl(environment.apiUrl);
  readonly createModalDomainProfileCurl = exampleDomainProfileCurl(environment.apiUrl);

  private readonly refreshVersion = signal(0);
  private readonly scopesRevision = signal(0);
  readonly actionError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly discoverySelectionError = signal<string | null>(null);
  readonly createBusy = signal(false);
  readonly showCreateModal = signal(false);
  readonly revealedSecret = signal<{
    secret: string;
    discoveryIds: string[];
    scopes: string[];
    upstreamProfileIds: string[];
    domainProfileIds: string[];
  } | null>(null);
  readonly copyFeedback = signal(false);
  readonly selectedDiscoveryIds = signal<Set<string>>(new Set());
  readonly selectedUpstreamProfileIds = signal<Set<string>>(new Set());
  readonly selectedDomainProfileIds = signal<Set<string>>(new Set());

  readonly dataResource = rxResource({
    params: () => this.refreshVersion(),
    stream: () =>
      this.api.listDiscovery().pipe(
        switchMap(discovery => {
          const configs = normalizeDiscoveryRows(discovery);
          const ids = configs.map(c => c.id).filter((id): id is string => !!id);
          const upstreamProfiles$ =
            ids.length === 0
              ? of([] as UpstreamProfileV1[])
              : forkJoin(ids.map(id => this.upstreamProfilesApi.listForDiscovery(id))).pipe(map(lists => lists.flat()));
          const domainProfiles$ =
            ids.length === 0
              ? of([] as DomainProfileV1[])
              : forkJoin(ids.map(id => this.domainProfilesApi.listForDiscovery(id))).pipe(map(lists => lists.flat()));
          return forkJoin({
            keys: this.api.listApiKeys(),
            discovery: of(discovery),
            upstreamProfiles: upstreamProfiles$,
            domainProfiles: domainProfiles$
          });
        })
      )
  });

  readonly apiKeys = computed(() => this.dataResource.value()?.keys ?? []);
  readonly discoveryConfigs = computed(() => normalizeDiscoveryRows(this.dataResource.value()?.discovery));
  readonly upstreamProfiles = computed(() => this.dataResource.value()?.upstreamProfiles ?? []);
  readonly domainProfiles = computed(() => this.dataResource.value()?.domainProfiles ?? []);
  readonly discoveryNameById = computed(() => {
    const map = new Map<string, string>();
    for (const cfg of this.discoveryConfigs()) {
      if (cfg.id) {
        map.set(cfg.id, cfg.name?.trim() || cfg.id);
      }
    }
    return map;
  });
  readonly upstreamProfileNameById = computed(() => {
    const map = new Map<string, string>();
    for (const profile of this.upstreamProfiles()) {
      if (profile.id) {
        map.set(profile.id, profile.name?.trim() || profile.id);
      }
    }
    return map;
  });
  readonly domainProfileNameById = computed(() => {
    const map = new Map<string, string>();
    for (const profile of this.domainProfiles()) {
      if (profile.id) {
        map.set(profile.id, profile.name?.trim() || profile.id);
      }
    }
    return map;
  });

  readonly keyForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    scopesText: [API_KEY_SCOPE_REGISTER_UPSTREAM, [Validators.required]],
    expiresAt: ['']
  });

  readonly selectedScopes = computed(() => {
    this.scopesRevision();
    return parseScopesText(this.keyForm.controls.scopesText.value);
  });

  readonly hasRegisterUpstreamScope = computed(() =>
    this.selectedScopes().includes(API_KEY_SCOPE_REGISTER_UPSTREAM)
  );
  readonly hasRegisterDomainScope = computed(() => this.selectedScopes().includes(API_KEY_SCOPE_REGISTER_DOMAIN));

  readonly availableUpstreamProfilesForSelection = computed(() => {
    const selectedDiscovery = this.selectedDiscoveryIds();
    if (selectedDiscovery.size === 0) {
      return [];
    }
    return this.upstreamProfiles().filter(
      p => p.id && p.discovery_config_id && selectedDiscovery.has(p.discovery_config_id)
    );
  });

  readonly availableDomainProfilesForSelection = computed(() => {
    const selectedDiscovery = this.selectedDiscoveryIds();
    if (selectedDiscovery.size === 0) {
      return [];
    }
    return this.domainProfiles().filter(
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

  readonly scopeWarning = computed(() => {
    this.scopesRevision();
    const scopes = parseScopesText(this.keyForm.controls.scopesText.value);
    const known = new Set<string>(API_KEY_KNOWN_SCOPES);
    const unknown = scopes.filter(s => !known.has(s));
    if (unknown.length === 0) {
      return null;
    }
    return `Scopes other than ${API_KEY_SCOPE_REGISTER_UPSTREAM} and ${API_KEY_SCOPE_REGISTER_DOMAIN} are stored but have no effect on the API today.`;
  });

  constructor() {
    this.keyForm.controls.scopesText.valueChanges.subscribe(() => {
      this.scopesRevision.update(v => v + 1);
    });
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
    const map = this.upstreamProfileNameById();
    return ids.map(id => map.get(id) ?? id).join(', ');
  }

  domainProfileLabels(ids: string[] | undefined): string {
    if (!ids?.length) {
      return '—';
    }
    const map = this.domainProfileNameById();
    return ids.map(id => map.get(id) ?? id).join(', ');
  }

  revealHasRegisterUpstreamScope(reveal: { scopes: string[] }): boolean {
    return reveal.scopes.includes(API_KEY_SCOPE_REGISTER_UPSTREAM);
  }

  revealHasRegisterDomainScope(reveal: { scopes: string[] }): boolean {
    return reveal.scopes.includes(API_KEY_SCOPE_REGISTER_DOMAIN);
  }

  revealUpstreamProfileId(reveal: { upstreamProfileIds: string[] }): string {
    return reveal.upstreamProfileIds[0] ?? '<upstream-profile-id>';
  }

  revealDomainProfileId(reveal: { domainProfileIds: string[] }): string {
    return reveal.domainProfileIds[0] ?? '<domain-profile-id>';
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
    this.selectedDomainProfileIds.set(new Set());
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
        const upstreamOnDiscovery = this.upstreamProfiles()
          .filter(p => p.discovery_config_id === id)
          .map(p => p.id)
          .filter((pid): pid is string => !!pid);
        const domainOnDiscovery = this.domainProfiles()
          .filter(p => p.discovery_config_id === id)
          .map(p => p.id)
          .filter((pid): pid is string => !!pid);
        this.selectedUpstreamProfileIds.update(profileSet => {
          const nextProfiles = new Set(profileSet);
          for (const pid of upstreamOnDiscovery) {
            nextProfiles.delete(pid);
          }
          return nextProfiles;
        });
        this.selectedDomainProfileIds.update(profileSet => {
          const nextProfiles = new Set(profileSet);
          for (const pid of domainOnDiscovery) {
            nextProfiles.delete(pid);
          }
          return nextProfiles;
        });
      }
      return next;
    });
    this.discoverySelectionError.set(null);
  }

  isUpstreamProfileSelected(id: string | undefined): boolean {
    if (!id) {
      return false;
    }
    return this.selectedUpstreamProfileIds().has(id);
  }

  toggleUpstreamProfile(id: string | undefined, event: Event): void {
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

  isDomainProfileSelected(id: string | undefined): boolean {
    if (!id) {
      return false;
    }
    return this.selectedDomainProfileIds().has(id);
  }

  toggleDomainProfile(id: string | undefined, event: Event): void {
    if (!id) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedDomainProfileIds.update(set => {
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

    const upstreamProfileIds = this.hasRegisterUpstreamScope() ? [...this.selectedUpstreamProfileIds()] : [];
    const domainProfileIds = this.hasRegisterDomainScope() ? [...this.selectedDomainProfileIds()] : [];
    const body: CreateAPIKeyRequestV1 = {
      name: value.name.trim(),
      scopes,
      allowed_discovery_config_ids: discoveryIds,
      expires_at: datetimeLocalToIso(value.expiresAt),
      ...(upstreamProfileIds.length > 0 ? { allowed_upstream_profile_ids: upstreamProfileIds } : {}),
      ...(domainProfileIds.length > 0 ? { allowed_domain_profile_ids: domainProfileIds } : {})
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
          scopes,
          upstreamProfileIds,
          domainProfileIds
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

  registerDomainCurl(reveal: { secret: string; discoveryIds: string[] }): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const discoveryId = reveal.discoveryIds[0] ?? '<discovery-config-id>';
    return `curl -X POST "${base}/discovery/${discoveryId}/register-domain" \\
  -H "Authorization: ${reveal.secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"config_id":"@your-route-id","domains":["app.example.com"]}'`;
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
