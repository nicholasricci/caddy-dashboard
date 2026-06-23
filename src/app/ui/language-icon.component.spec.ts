import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PROFILE_SNIPPET_LANGUAGES } from '../core/profile-register-snippets';
import { LanguageIconComponent } from './language-icon.component';

describe('LanguageIconComponent', () => {
  let fixture: ComponentFixture<LanguageIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageIconComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageIconComponent);
  });

  for (const { id, label } of PROFILE_SNIPPET_LANGUAGES) {
    it(`renders an SVG for ${label}`, async () => {
      fixture.componentRef.setInput('language', id);
      fixture.componentRef.setInput('size', 'sm');
      fixture.detectChanges();
      await fixture.whenStable();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg).withContext(`expected SVG for ${id}`).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('width')).toBe('20');
      expect(svg?.getAttribute('height')).toBe('20');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  }

  it('uses 24px dimensions for md size', async () => {
    fixture.componentRef.setInput('language', 'python');
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();
    await fixture.whenStable();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });
});
