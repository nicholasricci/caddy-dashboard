import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardApiService } from '../../services/dashboard-api.service';
import type { UserV1 } from '../../models/api-v1.model';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

@Component({
  selector: 'app-users-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, StitchIconComponent],
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
                  [ngClass]="{
                    'bg-transparent': i % 2 === 0,
                    'bg-stitch-surface-low/80': i % 2 !== 0
                  }"
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
            <label
              class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
              for="users-modal-username"
              >Username</label
            >
            <input
              id="users-modal-username"
              class="input-technical mt-1 mb-5"
              [ngModel]="draftUsername()"
              (ngModelChange)="draftUsername.set($event)"
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
              [ngModel]="draftPassword()"
              (ngModelChange)="draftPassword.set($event)"
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
              [ngModel]="draftRole()"
              (ngModelChange)="draftRole.set($event)"
              placeholder="admin / user"
            />
            <div class="flex justify-end gap-3">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="save()">
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

  readonly users = signal<UserV1[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly draftUsername = signal('');
  readonly draftPassword = signal('');
  readonly draftRole = signal('user');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listUsers().subscribe({
      next: rows => {
        this.users.set(rows ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error || 'Failed to load users');
        this.loading.set(false);
      }
    });
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.draftUsername.set('');
    this.draftPassword.set('');
    this.draftRole.set('user');
    this.showModal.set(true);
  }

  edit(u: UserV1): void {
    this.editingId.set(u.id || null);
    this.draftUsername.set(u.username || '');
    this.draftPassword.set('');
    this.draftRole.set(u.role || 'user');
    this.showModal.set(true);
  }

  save(): void {
    const id = this.editingId();
    if (id) {
      this.api
        .updateUser(id, {
          username: this.draftUsername() || undefined,
          password: this.draftPassword() || undefined,
          role: this.draftRole() || undefined
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.load();
          },
          error: err => this.error.set(err?.error?.error || 'Update failed')
        });
    } else {
      if (!this.draftUsername() || !this.draftPassword()) {
        this.error.set('Username and password required');
        return;
      }
      this.api
        .createUser({
          username: this.draftUsername(),
          password: this.draftPassword(),
          role: this.draftRole() || undefined
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.load();
          },
          error: err => this.error.set(err?.error?.error || 'Create failed')
        });
    }
  }

  remove(u: UserV1): void {
    if (!u.id || !confirm(`Delete ${u.username}?`)) {
      return;
    }
    this.api.deleteUser(u.id).subscribe({
      next: () => this.load(),
      error: err => this.error.set(err?.error?.error || 'Delete failed')
    });
  }
}
