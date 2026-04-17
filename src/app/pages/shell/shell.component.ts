import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, RouterOutlet, StitchIconComponent],
  template: `
    <div class="h-screen overflow-hidden flex bg-stitch-surface text-stitch-on-surface">
      <aside
        class="w-[280px] shrink-0 bg-stitch-surface-low flex flex-col border-r border-stitch-ghost"
        aria-label="Main navigation"
      >
        <div class="px-7 py-8">
          <div class="flex items-start gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-sm bg-stitch-primary text-stitch-on-primary">
              <app-stitch-icon name="logo" size="md" class="text-stitch-on-primary" />
            </span>
            <div>
              <h1 class="font-display text-lg font-semibold tracking-tight text-stitch-on-surface leading-tight">
                CaddyControl
              </h1>
              <p class="text-[10px] text-stitch-on-surface-variant mt-1.5 font-medium uppercase tracking-[0.18em]">
                Server manager
              </p>
            </div>
          </div>
        </div>

        <nav class="flex-1 px-3 py-2 space-y-0.5" aria-label="Primary">
          <a
            routerLink="/"
            routerLinkActive="bg-stitch-surface text-stitch-on-surface font-medium border-l-2 border-stitch-primary pl-[calc(0.75rem-2px)]"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex items-center gap-3 px-3 py-3 text-sm text-stitch-on-surface-variant hover:bg-stitch-surface-container/50 rounded-sm transition-colors border-l-2 border-transparent"
          >
            <app-stitch-icon name="server" />
            <span>Server overview</span>
          </a>
          <a
            routerLink="/discovery"
            routerLinkActive="bg-stitch-surface text-stitch-on-surface font-medium border-l-2 border-stitch-primary pl-[calc(0.75rem-2px)]"
            class="flex items-center gap-3 px-3 py-3 text-sm text-stitch-on-surface-variant hover:bg-stitch-surface-container/50 rounded-sm transition-colors border-l-2 border-transparent"
          >
            <app-stitch-icon name="discovery" />
            <span>Autodiscovery</span>
          </a>
          @if (user()?.isAdmin) {
            <a
              routerLink="/admin/users"
              routerLinkActive="bg-stitch-surface text-stitch-on-surface font-medium border-l-2 border-stitch-primary pl-[calc(0.75rem-2px)]"
              class="flex items-center gap-3 px-3 py-3 text-sm text-stitch-on-surface-variant hover:bg-stitch-surface-container/50 rounded-sm transition-colors border-l-2 border-transparent"
            >
              <app-stitch-icon name="users" />
              <span>User management</span>
            </a>
            <a
              routerLink="/admin/audit"
              routerLinkActive="bg-stitch-surface text-stitch-on-surface font-medium border-l-2 border-stitch-primary pl-[calc(0.75rem-2px)]"
              class="flex items-center gap-3 px-3 py-3 text-sm text-stitch-on-surface-variant hover:bg-stitch-surface-container/50 rounded-sm transition-colors border-l-2 border-transparent"
            >
              <app-stitch-icon name="audit" />
              <span>Audit log</span>
            </a>
          }
        </nav>

        <div class="px-4 py-4 mx-3 mb-3 stitch-panel stitch-panel--dim">
          <p class="stitch-panel-title mb-2">API status</p>
          <div class="flex items-center gap-2 text-xs font-mono text-stitch-on-surface">
            @if (apiConnected() === null) {
              <span class="loading loading-spinner loading-xs"></span>
              <span class="text-stitch-on-surface-variant">Checking…</span>
            } @else if (apiConnected()) {
              <span class="h-2 w-2 rounded-full bg-emerald-600 shrink-0" aria-hidden="true"></span>
              <span>Reachable</span>
            } @else {
              <span class="h-2 w-2 rounded-full bg-stitch-error shrink-0" aria-hidden="true"></span>
              <span class="text-stitch-error">Unreachable</span>
            }
          </div>
        </div>

        <div class="mt-auto px-3 py-4 border-t border-stitch-ghost bg-stitch-surface-container/25">
          @if (user(); as u) {
            <div class="flex items-center gap-2 px-3 py-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-sm bg-stitch-surface-lowest border-stitch-ghost border"
              >
                <app-stitch-icon name="users" size="xs" />
              </span>
              <p class="text-xs font-mono text-stitch-on-surface truncate flex-1" [title]="u.username">{{ u.username }}</p>
            </div>
          }
          <button
            type="button"
            class="stitch-icon-btn justify-start mt-1 w-full text-left px-3 py-2 text-sm text-stitch-primary-fixed hover:bg-stitch-surface-lowest rounded-sm transition-colors"
            (click)="logout()"
          >
            <app-stitch-icon name="signOut" size="xs" />
            Sign out
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-stitch-surface">
        <main class="flex-1 min-h-0 overflow-auto flex flex-col">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(DashboardApiService);

  readonly user = this.auth.user;

  /** null = loading */
  readonly apiConnected = signal<boolean | null>(null);

  ngOnInit(): void {
    this.api.ready().subscribe({
      next: () => this.apiConnected.set(true),
      error: () => this.apiConnected.set(false)
    });
  }

  logout(): void {
    this.auth.logoutRemote().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login'])
    });
  }
}
