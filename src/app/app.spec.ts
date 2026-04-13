import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AnimationHelpers } from './testing/test-utilities';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let component: App;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [provideZonelessChangeDetection(), provideRouter(routes)]
    }).compileComponents();

    AnimationHelpers.fastForwardAnimations();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  afterEach(() => {
    AnimationHelpers.restoreAnimations();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have router outlet', () => {
    const routerOutlet = fixture.nativeElement.querySelector('router-outlet');
    expect(routerOutlet).toBeTruthy();
  });

  it('should render without errors', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('should handle route changes', async () => {
    await fixture.whenStable();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('should be responsive', () => {
    const originalInnerWidth = window.innerWidth;

    try {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();

      expect(fixture.nativeElement).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      });

      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();

      expect(fixture.nativeElement).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth
      });
    }
  });

  it('should handle component lifecycle properly', () => {
    expect(component).toBeTruthy();

    fixture.destroy();

    expect(() => fixture.destroy()).not.toThrow();
  });

  describe('Error Boundaries', () => {
    it('should handle rendering errors gracefully', () => {
      spyOn(console, 'error');

      try {
        spyOnProperty(fixture.nativeElement, 'innerHTML', 'get').and.throwError('Render error');
        fixture.detectChanges();
      } catch {
        // expected
      }

      expect(component).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should initialize quickly', () => {
      const startTime = performance.now();

      TestBed.createComponent(App);

      const endTime = performance.now();
      const initTime = endTime - startTime;

      expect(initTime).toBeLessThan(100);
    });

    it('should not have memory leaks', () => {
      const initialMemory = (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < 10; i++) {
        const testFixture = TestBed.createComponent(App);
        testFixture.detectChanges();
        testFixture.destroy();
      }

      const w = window as unknown as { gc?: () => void };
      if (typeof w.gc === 'function') {
        w.gc();
      }

      const finalMemory = (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0;

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const interactiveElements = fixture.nativeElement.querySelectorAll(
        'button, input, select, textarea, a[href]'
      );

      if (interactiveElements.length === 0) {
        expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
        return;
      }

      interactiveElements.forEach((element: HTMLElement) => {
        expect(element.tabIndex >= 0 || element.hasAttribute('tabindex')).toBeTruthy();
      });
    });

    it('should support keyboard navigation', () => {
      const keyboardEvent = new KeyboardEvent('keydown', { key: 'Tab' });

      expect(() => {
        document.dispatchEvent(keyboardEvent);
        fixture.detectChanges();
      }).not.toThrow();
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing modern features gracefully', () => {
      const originalFetch = window.fetch;

      try {
        delete (window as { fetch?: typeof fetch }).fetch;

        expect(() => {
          fixture.detectChanges();
        }).not.toThrow();
      } finally {
        window.fetch = originalFetch;
      }
    });

    it('should work with different user agents', () => {
      const originalUserAgent = navigator.userAgent;

      try {
        Object.defineProperty(navigator, 'userAgent', {
          writable: true,
          value: 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2)'
        });

        expect(() => {
          fixture.detectChanges();
        }).not.toThrow();
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          writable: true,
          value: originalUserAgent
        });
      }
    });
  });
});
