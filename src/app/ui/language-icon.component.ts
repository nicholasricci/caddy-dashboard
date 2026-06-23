import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { ProfileSnippetLanguage } from '../core/profile-register-snippets';
import { languageIconSvg } from './language-icon.sources';

@Component({
  selector: 'app-language-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center'
  },
  template: `<span class="inline-flex" [innerHTML]="iconMarkup()"></span>`
})
export class LanguageIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly language = input.required<ProfileSnippetLanguage>();
  readonly size = input<'sm' | 'md'>('sm');

  readonly dimension = computed(() => (this.size() === 'sm' ? 20 : 24));

  readonly iconMarkup = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(languageIconSvg(this.language(), this.dimension()))
  );
}
