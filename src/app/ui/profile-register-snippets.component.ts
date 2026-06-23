import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { highlightProfileSnippet } from '../core/profile-snippet-highlight';
import {
  PROFILE_SNIPPET_LANGUAGES,
  PROFILE_SNIPPET_PLACEHOLDER_KEY,
  profileRegisterSnippet,
  type ProfileRegisterKind,
  type ProfileSnippetLanguage
} from '../core/profile-register-snippets';
import { LanguageIconComponent } from './language-icon.component';
import { StitchIconComponent } from './stitch-icon.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-profile-register-snippets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StitchIconComponent, LanguageIconComponent],
  template: `
    <div>
      <p class="text-xs text-stitch-on-surface-variant leading-relaxed mb-3">{{ hintText() }}</p>

      <div class="flex flex-wrap gap-2" role="tablist" [attr.aria-label]="tabListLabel()">
        @for (lang of languages; track lang.id) {
          <button
            type="button"
            role="tab"
            class="btn-stitch-secondary btn-stitch-secondary--sm p-2 min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center"
            [class.ring-2]="selectedLanguage() === lang.id"
            [class.ring-stitch-primary]="selectedLanguage() === lang.id"
            [attr.aria-selected]="selectedLanguage() === lang.id"
            [attr.aria-label]="lang.label"
            [title]="lang.label"
            (click)="selectLanguage(lang.id)"
          >
            <app-language-icon [language]="lang.id" size="sm" />
          </button>
        }
      </div>

      <div class="relative mt-3">
        <pre
          class="profile-snippet-highlight text-xs font-mono leading-relaxed rounded-sm border border-stitch-ghost bg-stitch-surface-lowest p-3 pr-20 max-h-64 overflow-y-auto"
        >
          <code class="hljs" [innerHTML]="highlightedSnippet()"></code>
        </pre>
        <button
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn absolute top-2 right-2"
          (click)="copySnippet()"
        >
          <app-stitch-icon name="clipboard" size="xs" />
          Copy
        </button>
      </div>

      @if (copyFeedback()) {
        <p class="text-xs text-emerald-700 mt-2">Copied to clipboard.</p>
      }
    </div>
  `
})
export class ProfileRegisterSnippetsComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly kind = input.required<ProfileRegisterKind>();
  readonly profileId = input.required<string>();
  readonly apiKey = input<string>();
  readonly baseUrl = input(environment.apiUrl);

  readonly languages = PROFILE_SNIPPET_LANGUAGES;
  readonly selectedLanguage = signal<ProfileSnippetLanguage>('shell');
  readonly copyFeedback = signal(false);

  readonly activeSnippet = computed(() =>
    profileRegisterSnippet(this.kind(), this.selectedLanguage(), {
      baseUrl: this.baseUrl(),
      profileId: this.profileId(),
      apiKey: this.apiKey()
    })
  );

  readonly highlightedSnippet = computed(() => {
    const html = highlightProfileSnippet(this.activeSnippet(), this.selectedLanguage());
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  readonly hintText = computed(() => {
    const key = this.apiKey()?.trim();
    if (key) {
      return 'Your new API key is embedded below — copy before closing this dialog.';
    }
    return `Replace \`${PROFILE_SNIPPET_PLACEHOLDER_KEY}\` with your API key secret.`;
  });

  tabListLabel(): string {
    return this.kind() === 'upstream' ? 'Upstream register snippet language' : 'Domain register snippet language';
  }

  selectLanguage(language: ProfileSnippetLanguage): void {
    this.selectedLanguage.set(language);
    this.copyFeedback.set(false);
  }

  async copySnippet(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.activeSnippet());
      this.copyFeedback.set(true);
    } catch {
      this.copyFeedback.set(false);
    }
  }
}
