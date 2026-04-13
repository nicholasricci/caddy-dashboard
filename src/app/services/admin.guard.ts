import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInitialization();

  const currentUser = authService.getCurrentUser();

  if (currentUser?.isAdmin) {
    return true;
  }

  return router.createUrlTree(['/']);
};
