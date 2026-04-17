import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { DashboardApiService } from '../../services/dashboard-api.service';
import type { UserV1 } from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';

function normalizeUsers(rows: unknown): UserV1[] {
  if (Array.isArray(rows)) {
    return rows as UserV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['users'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as UserV1[];
    }
  }
  return [];
}

@Component({
  selector: 'app-users-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-4xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="users" size="md" class="text-stitch-primary-fixed" />
            User management
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed">
            Manage dashboard accounts (admin only).
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

      <div class="flex justify-end mb-8">
        <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="openCreate()">
          <app-stitch-icon name="plus" size="xs" />
          Add user
        </button>
      </div>

      @if (loading()) {
        <div class="flex py-16 stitch-panel justify-center">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (users().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
          <app-stitch-icon name="users" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-sm text-stitch-on-surface-variant">No users returned from the API.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                <th class="font-medium py-6 px-4 text-left">Username</th>
                <th class="font-medium py-6 px-4 text-left">Role</th>
                <th class="py-6 px-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id; let i = $index) {
                <tr
                  class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                  [class.bg-transparent]="i % 2 === 0"
                  [class.bg-stitch-surface-low/80]="i % 2 !== 0"
                >
                  <td class="py-6 px-4 font-mono text-sm align-middle">{{ u.username }}</td>
                  <td class="py-6 px-4 align-middle">
                    <span class="stitch-status-chip">{{ u.role || '—' }}</span>
                  </td>
                  <td class="py-6 px-4 text-right align-middle whitespace-nowrap">
                    <button
                      type="button"
                      class="text-sm text-stitch-primary-fixed hover:text-stitch-on-surface mr-3 inline-flex items-center gap-1"
                      (click)="edit(u)"
                    >
                      <app-stitch-icon name="edit" size="xs" />
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-sm text-stitch-error hover:underline inline-flex items-center gap-1"
                      (click)="remove(u)"
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
            class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-md border-stitch-ghost shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="users-modal-title"
              class="font-display text-lg font-semibold mb-6 text-stitch-on-surface flex items-center gap-2"
            >
              @if (editingId()) {
                <app-stitch-icon name="edit" />
              } @else {
                <app-stitch-icon name="plus" />
              }
              {{ editingId() ? 'Edit user' : 'New user' }}
            </h3>
            <form [formGroup]="userForm">
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="users-modal-username"
                >Username</label
              >
              <input
                id="users-modal-username"
                class="input-technical mt-1 mb-5"
                formControlName="username"
                [readonly]="!!editingId()"
              />
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="users-modal-password"
                >Password</label
              >
              <input
                id="users-modal-password"
                class="input-technical mt-1 mb-5"
                type="password"
                formControlName="password"
                placeholder="••••••••"
              />
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="users-modal-role"
                >Role</label
              >
              <input
                id="users-modal-role"
                class="input-technical mt-1 mb-8"
                formControlName="role"
                placeholder="admin / user"
              />
            </form>
            <div class="flex justify-end gap-3">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="userForm.invalid"
                (click)="save()"
              >
                <app-stitch-icon name="apply" size="xs" />
                Save
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class UsersAdminPageComponent {
  private readonly api = inject(DashboardApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  private readonly refreshVersion = signal(0);
  readonly actionError = signal<string | null>(null);
  readonly usersResource = rxResource({
    stream: () => {
      this.refreshVersion();
      return this.api.listUsers();
    }
  });
  readonly users = computed(() => normalizeUsers(this.usersResource.value() as unknown));
  readonly loading = computed(() => this.usersResource.isLoading());
  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.usersResource.error();
    return e ? extractApiError(e, 'Failed to load users') : null;
  });
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly userForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.minLength(6)]],
    role: ['user', [Validators.required]]
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.userForm.reset({ username: '', password: '', role: 'user' });
    this.userForm.controls.username.enable();
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.showModal.set(true);
  }

  edit(u: UserV1): void {
    this.editingId.set(u.id || null);
    this.userForm.reset({
      username: u.username || '',
      password: '',
      role: u.role || 'user'
    });
    this.userForm.controls.username.disable();
    this.userForm.controls.password.setValidators([Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.showModal.set(true);
  }

  save(): void {
    if (this.userForm.invalid) {
      return;
    }
    const id = this.editingId();
    const value = this.userForm.getRawValue();
    if (id) {
      this.api
        .updateUser(id, {
          username: value.username || undefined,
          password: value.password || undefined,
          role: value.role || undefined
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.load();
          },
          error: err => this.actionError.set(extractApiError(err, 'Update failed'))
        });
    } else {
      this.api
        .createUser({
          username: value.username,
          password: value.password,
          role: value.role || undefined
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.load();
          },
          error: err => this.actionError.set(extractApiError(err, 'Create failed'))
        });
    }
  }

  async remove(u: UserV1): Promise<void> {
    if (!u.id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete user',
      message: `Delete ${u.username}?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.api.deleteUser(u.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Delete failed'))
    });
  }
}
