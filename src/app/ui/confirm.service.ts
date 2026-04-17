import { ApplicationRef, createComponent, EnvironmentInjector, Injectable, inject } from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  ask(options: ConfirmOptions): Promise<boolean> {
    const hostElement = document.createElement('app-confirm-dialog-host');
    document.body.appendChild(hostElement);

    const componentRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.environmentInjector,
      hostElement
    });

    this.appRef.attachView(componentRef.hostView);
    componentRef.setInput('title', options.title);
    componentRef.setInput('message', options.message ?? '');
    componentRef.setInput('confirmLabel', options.confirmLabel ?? 'Confirm');
    componentRef.setInput('cancelLabel', options.cancelLabel ?? 'Cancel');
    componentRef.setInput('variant', options.variant ?? 'default');
    componentRef.setInput('busy', false);

    return new Promise(resolve => {
      const cleanup = (result: boolean) => {
        confirmSubscription.unsubscribe();
        cancelSubscription.unsubscribe();
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
        hostElement.remove();
        resolve(result);
      };

      const confirmSubscription = componentRef.instance.confirmed.subscribe(() => cleanup(true));
      const cancelSubscription = componentRef.instance.cancelled.subscribe(() => cleanup(false));
    });
  }
}
