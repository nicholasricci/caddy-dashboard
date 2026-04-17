import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, StitchIconComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center p-8 bg-stitch-surface-low">
      <div class="w-full max-w-md stitch-panel stitch-panel--dim rounded-sm shadow-sm p-12">
        <div class="mb-12">
          <div class="flex items-start gap-4 mb-6">
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-stitch-primary text-stitch-on-primary"
            >
              <app-stitch-icon name="logo" size="lg" />
            </span>
            <div>
              <h1 class="font-display text-4xl font-semibold tracking-tight text-stitch-on-surface">CaddyControl</h1>
              <p class="text-[11px] uppercase tracking-[0.25em] text-stitch-on-surface-variant mt-3">Server manager</p>
            </div>
          </div>
          <p class="text-sm text-stitch-on-surface-variant flex items-center gap-2">
            <app-stitch-icon name="lock" size="xs" class="text-stitch-on-surface-variant" />
            Sign in to continue
          </p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-8">
          <div>
            <label
              class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant mb-2"
              for="login-username"
              >Username</label
            >
            <input
              id="login-username"
              type="text"
              formControlName="username"
              class="input-technical"
              placeholder="operator"
              autocomplete="username"
            />
            @if (loginForm.get('username')?.invalid && loginForm.get('username')?.touched) {
              <p class="text-stitch-error text-xs mt-2">Required (min 3 characters)</p>
            }
          </div>

          <div>
            <label
              class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant mb-2"
              for="login-password"
              >Password</label
            >
            <input
              id="login-password"
              type="password"
              formControlName="password"
              class="input-technical"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            @if (loginForm.get('password')?.invalid && loginForm.get('password')?.touched) {
              <p class="text-stitch-error text-xs mt-2">Required (min 6 characters)</p>
            }
          </div>

          @if (error()) {
            <div class="text-stitch-error text-sm border-l-2 border-stitch-error pl-3 py-1">{{ error() }}</div>
          }

          <button
            type="submit"
            class="btn-stitch-primary btn-stitch-primary--md btn-stitch-primary--block stitch-icon-btn justify-center"
            [disabled]="loginForm.invalid || isLoading()"
          >
            @if (!isLoading()) {
              <app-stitch-icon name="play" size="xs" />
              Sign in
            } @else {
              <span class="loading loading-spinner loading-sm text-stitch-on-primary"></span>
            }
          </button>
        </form>

        <p class="text-center text-xs text-stitch-on-surface-variant mt-10 font-mono">
          Accounts are issued by an administrator.
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly error = signal<string | null>(null);
  readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      if (this.authService.user()) {
        void this.router.navigate(['/']);
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.error.set(null);
      const v = this.loginForm.value as { username: string; password: string };
      this.authService.login({ username: v.username, password: v.password }).subscribe({
        next: () => {
          this.isLoading.set(false);
          void this.router.navigate(['/']);
        },
        error: (err: { error?: { error?: string; detail?: string } }) => {
          this.isLoading.set(false);
          this.error.set(err.error?.error || err.error?.detail || 'Login failed.');
        }
      });
    } else {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }
}
