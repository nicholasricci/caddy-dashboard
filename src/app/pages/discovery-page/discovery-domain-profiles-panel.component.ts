import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import type { DomainProfileBindingV1, DomainProfileV1 } from '../../models/api-v1.model';
import { DomainProfilesApiService } from '../../services/api/domain-profiles-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ProfileRegisterSnippetsComponent } from '../../ui/profile-register-snippets.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';
import {
  DOMAIN_BINDING_HINT,
  DOMAIN_PROFILE_EXAMPLE_DEFINITION,
  DOMAIN_PROFILE_SCENARIO,
  DOMAIN_PROFILE_SUMMARY,
  DOMAIN_PROFILE_WHAT_BULLETS,
  exampleDomainProfileCurl
} from '../../core/profile-help.copy';
import { environment } from '../../../environments/environment';

type BindingRowForm = FormGroup<{
  configId: FormControl<string>;
  matchIndexes: FormControl<string>;
}>;

type ProfileForm = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  bindings: FormArray<BindingRowForm>;
}>;

function parseMatchIndexes(raw: string): number[] | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const indexes: number[] = [];
  for (const part of parts) {
    const value = Number.parseInt(part, 10);
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    indexes.push(value);
  }
  return indexes.length > 0 ? indexes : undefined;
}

function bindingsSummary(profile: DomainProfileV1): string {
  const bindings = profile.bindings ?? [];
  if (bindings.length === 0) {
    return 'no bindings';
  }
  const preview = bindings
    .slice(0, 2)
    .map(b => {
      const indexes = b.match_indexes;
      if (indexes?.length) {
        return `${b.config_id}[${indexes.join(',')}]`;
      }
      return b.config_id;
    })
    .join(', ');
  const more = bindings.length > 2 ? ` +${bindings.length - 2}` : '';
  return `${preview}${more}`;
}

@Component({
  selector: 'app-discovery-domain-profiles-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent, ProfileRegisterSnippetsComponent],
  template: `
    <section class="stitch-panel stitch-panel--dim mt-3 border-l-2 border-stitch-secondary/40 ml-2 pl-4">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p class="stitch-panel-title">Domain profiles</p>
          <p class="text-xs text-stitch-on-surface-variant mt-1 leading-relaxed max-w-2xl">
            {{ domainProfileSummary }}
            Profiles here apply to <span class="font-mono text-stitch-on-surface">{{ discoveryName() }}</span>.
          </p>
        </div>
        <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="openCreate()">
          <app-stitch-icon name="plus" size="xs" />
          New profile
        </button>
      </div>

      <details class="mb-3 rounded-sm border border-stitch-ghost p-3">
        <summary class="text-sm font-medium text-stitch-on-surface cursor-pointer">What is this?</summary>
        <p class="text-xs text-stitch-on-surface-variant mt-3 leading-relaxed">{{ domainProfileScenario }}</p>
        <ul class="text-xs text-stitch-on-surface-variant mt-3 space-y-1 list-disc list-inside leading-relaxed">
          @for (item of domainProfileWhatBullets; track item) {
            <li>{{ item }}</li>
          }
        </ul>
      </details>

      <details class="mb-4 rounded-sm border border-stitch-ghost p-3">
        <summary class="text-sm font-medium text-stitch-on-surface cursor-pointer">Example usage</summary>
        <p class="text-xs text-stitch-on-surface-variant mt-3 leading-relaxed font-mono">{{ domainProfileExampleDefinition }}</p>
        <pre
          class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed mt-3"
        >{{ domainProfileExampleCurl }}</pre>
      </details>

      @if (error()) {
        <p class="text-sm text-stitch-error mb-3">{{ error() }}</p>
      }

      @if (loading()) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-sm text-stitch-on-surface-variant"></span>
        </div>
      } @else {
        <div class="space-y-3">
          @for (profile of profiles(); track profile.id) {
            <div
              class="flex flex-col gap-3 rounded-sm border border-stitch-ghost bg-stitch-surface-lowest px-4 py-3"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="font-display font-medium text-sm text-stitch-on-surface">{{ profile.name || profile.id }}</p>
                  @if (profile.description) {
                    <p class="text-xs text-stitch-on-surface-variant mt-1">{{ profile.description }}</p>
                  }
                  <p class="text-xs font-mono text-stitch-on-surface-variant mt-2 break-all">
                    id: {{ profile.id }} · {{ bindingsSummary(profile) }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
                    (click)="openEdit(profile)"
                  >
                    <app-stitch-icon name="edit" size="xs" />
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn-stitch-secondary btn-stitch-secondary--sm text-stitch-error stitch-icon-btn"
                    (click)="remove(profile)"
                  >
                    <app-stitch-icon name="trash" size="xs" />
                    Delete
                  </button>
                </div>
              </div>
              @if (profile.id) {
                <details class="w-full rounded-sm border border-stitch-ghost p-3">
                  <summary class="text-sm font-medium text-stitch-on-surface cursor-pointer">Code snippets</summary>
                  <div class="mt-3">
                    <app-profile-register-snippets kind="domain" [profileId]="profile.id" />
                  </div>
                </details>
              }
            </div>
          } @empty {
            <p class="text-sm text-stitch-on-surface-variant py-4 text-center">No domain profiles for this group yet.</p>
          }
        </div>
      }
    </section>

    @if (showModal()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
        role="presentation"
        tabindex="-1"
        (click)="closeModal()"
        (keydown.escape)="closeModal()"
      >
        <div
          class="bg-stitch-surface-lowest w-full max-w-xl max-h-[min(90vh,40rem)] overflow-y-auto rounded-sm p-8 border-stitch-ghost shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="domain-profile-modal-title"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <h3 id="domain-profile-modal-title" class="font-display text-lg font-semibold mb-6 text-stitch-on-surface">
            {{ editingId() ? 'Edit domain profile' : 'New domain profile' }}
          </h3>

          <form class="space-y-5" [formGroup]="profileForm" (ngSubmit)="save()">
            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="domain-profile-name"
                >Name</label
              >
              <input id="domain-profile-name" class="input-technical mt-1" formControlName="name" autocomplete="off" />
            </div>

            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="domain-profile-description"
                >Description</label
              >
              <input
                id="domain-profile-description"
                class="input-technical mt-1"
                formControlName="description"
                autocomplete="off"
              />
            </div>

            <fieldset class="border-0 p-0 m-0 min-w-0" formArrayName="bindings">
              <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">Bindings</legend>
              <p class="text-xs text-stitch-on-surface-variant mb-3 leading-relaxed">{{ domainBindingHint }}</p>
              <div class="space-y-3">
                @for (row of bindingRows.controls; track $index; let i = $index) {
                  <div class="flex flex-wrap items-end gap-3" [formGroupName]="i">
                    <div class="flex-1 min-w-[10rem]">
                      <label
                        class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                        [for]="'domain-binding-config-' + i"
                        >config_id</label
                      >
                      <input
                        [id]="'domain-binding-config-' + i"
                        class="input-technical mt-1 font-mono"
                        formControlName="configId"
                        placeholder="@route-id"
                        autocomplete="off"
                      />
                    </div>
                    <div class="w-32">
                      <label
                        class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                        [for]="'domain-binding-indexes-' + i"
                        >match_indexes</label
                      >
                      <input
                        [id]="'domain-binding-indexes-' + i"
                        class="input-technical mt-1 font-mono"
                        formControlName="matchIndexes"
                        placeholder="0"
                        autocomplete="off"
                      />
                    </div>
                    @if (bindingRows.length > 1) {
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm text-stitch-error stitch-icon-btn mb-0.5"
                        (click)="removeBindingRow(i)"
                        [attr.aria-label]="'Remove binding ' + (i + 1)"
                      >
                        <app-stitch-icon name="trash" size="xs" />
                      </button>
                    }
                  </div>
                }
              </div>
              <p class="text-xs text-stitch-on-surface-variant mt-2">match_indexes optional — comma-separated (default [0] on API).</p>
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn mt-3" (click)="addBindingRow()">
                <app-stitch-icon name="plus" size="xs" />
                Add binding
              </button>
            </fieldset>

            @if (saveError()) {
              <p class="text-sm text-stitch-error">{{ saveError() }}</p>
            }

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-stitch-primary btn-stitch-primary--sm" [disabled]="profileForm.invalid || saving()">
                @if (saving()) {
                  <span class="loading loading-spinner loading-xs"></span>
                }
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class DiscoveryDomainProfilesPanelComponent {
  private readonly profilesApi = inject(DomainProfilesApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly discoveryId = input.required<string>();
  readonly discoveryName = input.required<string>();

  readonly bindingsSummary = bindingsSummary;
  readonly domainProfileSummary = DOMAIN_PROFILE_SUMMARY;
  readonly domainProfileScenario = DOMAIN_PROFILE_SCENARIO;
  readonly domainProfileWhatBullets = DOMAIN_PROFILE_WHAT_BULLETS;
  readonly domainProfileExampleDefinition = DOMAIN_PROFILE_EXAMPLE_DEFINITION;
  readonly domainBindingHint = DOMAIN_BINDING_HINT;
  readonly domainProfileExampleCurl = exampleDomainProfileCurl(environment.apiUrl);

  private readonly refreshVersion = signal(0);
  private readonly actionError = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly profilesResource = rxResource({
    params: () => ({
      discoveryId: this.discoveryId(),
      refresh: this.refreshVersion()
    }),
    stream: ({ params }) => this.profilesApi.listForDiscovery(params.discoveryId)
  });

  readonly profiles = computed(() => this.profilesResource.value() ?? []);
  readonly loading = computed(() => this.profilesResource.isLoading());
  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.profilesResource.error();
    return e ? extractApiError(e, 'Failed to load domain profiles') : null;
  });

  readonly profileForm: ProfileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    bindings: this.fb.array([this.createBindingRow()])
  });

  get bindingRows(): FormArray<BindingRowForm> {
    return this.profileForm.controls.bindings;
  }

  reload(): void {
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
    this.profilesResource.reload();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.saveError.set(null);
    this.profileForm.reset({ name: '', description: '' });
    this.bindingRows.clear();
    this.bindingRows.push(this.createBindingRow());
    this.showModal.set(true);
  }

  openEdit(profile: DomainProfileV1): void {
    this.editingId.set(profile.id ?? null);
    this.saveError.set(null);
    this.profileForm.patchValue({
      name: profile.name ?? '',
      description: profile.description ?? ''
    });
    this.bindingRows.clear();
    const bindings = profile.bindings ?? [];
    if (bindings.length === 0) {
      this.bindingRows.push(this.createBindingRow());
    } else {
      for (const binding of bindings) {
        this.bindingRows.push(
          this.fb.nonNullable.group({
            configId: [binding.config_id ?? '', [Validators.required]],
            matchIndexes: [binding.match_indexes?.length ? binding.match_indexes.join(',') : '']
          })
        );
      }
    }
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.saveError.set(null);
  }

  addBindingRow(): void {
    this.bindingRows.push(this.createBindingRow());
  }

  removeBindingRow(index: number): void {
    if (this.bindingRows.length > 1) {
      this.bindingRows.removeAt(index);
    }
  }

  save(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const value = this.profileForm.getRawValue();
    const bindings: DomainProfileBindingV1[] = [];

    for (const row of value.bindings) {
      const configId = row.configId.trim();
      if (!configId) {
        continue;
      }
      const parsedIndexes = parseMatchIndexes(row.matchIndexes);
      if (row.matchIndexes.trim() && parsedIndexes === null) {
        this.saveError.set('match_indexes must be comma-separated non-negative integers.');
        return;
      }
      const binding: DomainProfileBindingV1 = { config_id: configId };
      if (parsedIndexes?.length) {
        binding.match_indexes = parsedIndexes;
      }
      bindings.push(binding);
    }

    if (bindings.length === 0) {
      this.saveError.set('At least one binding with config_id is required.');
      return;
    }

    const body = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      bindings
    };

    this.saving.set(true);
    this.saveError.set(null);

    const editingId = this.editingId();
    const request$ = editingId
      ? this.profilesApi.update(editingId, body)
      : this.profilesApi.create(this.discoveryId(), body);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.reload();
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(extractApiError(err, 'Failed to save domain profile'));
      }
    });
  }

  async remove(profile: DomainProfileV1): Promise<void> {
    const id = profile.id;
    if (!id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete domain profile',
      message: `Delete "${profile.name || id}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    this.profilesApi.delete(id).subscribe({
      next: () => this.reload(),
      error: err => this.actionError.set(extractApiError(err, 'Failed to delete domain profile'))
    });
  }

  private createBindingRow(): BindingRowForm {
    return this.fb.nonNullable.group({
      configId: ['', [Validators.required]],
      matchIndexes: ['']
    });
  }
}
