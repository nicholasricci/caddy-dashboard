import { ComponentFixture } from '@angular/core/testing';

/**
 * DOM query helpers
 */
export class DOMHelpers {
  constructor(private readonly fixture: ComponentFixture<unknown>) {}

  getByTestId(testId: string): HTMLElement | null {
    return this.fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  getAllByTestId(testId: string): HTMLElement[] {
    return Array.from(this.fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));
  }

  getByText(text: string): HTMLElement | null {
    const walker = document.createTreeWalker(this.fixture.nativeElement, NodeFilter.SHOW_TEXT, null);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(text)) {
        return node.parentElement;
      }
    }
    return null;
  }

  getButtonByText(text: string): HTMLButtonElement | null {
    const buttons = this.fixture.nativeElement.querySelectorAll('button');
    return (
      Array.from(buttons as NodeListOf<HTMLButtonElement>).find(button =>
        button.textContent?.trim().includes(text)
      ) || null
    );
  }

  hasClass(element: HTMLElement, className: string): boolean {
    return element.classList.contains(className);
  }

  click(element: HTMLElement): void {
    element.click();
    this.fixture.detectChanges();
  }

  setInputValue(selector: string, value: string): void {
    const input = this.fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      this.fixture.detectChanges();
    }
  }

  async waitForStable(): Promise<void> {
    await this.fixture.whenStable();
    this.fixture.detectChanges();
  }

  getElement(selector: string): HTMLElement | null {
    return this.fixture.nativeElement.querySelector(selector);
  }

  detectChanges(): void {
    this.fixture.detectChanges();
  }
}

/**
 * Animation testing helpers
 */
export class AnimationHelpers {
  static fastForwardAnimations(): void {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0.01ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }

  static restoreAnimations(): void {
    const styles = document.head.querySelectorAll('style');
    styles.forEach(s => {
      if (s.textContent?.includes('animation-duration: 0.01ms')) {
        s.remove();
      }
    });
  }
}
