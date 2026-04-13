import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

function isAuthPublicUrl(url: string): boolean {
  const base = environment.apiUrl.replace(/\/$/, '');
  return (
    url.startsWith(`${base}/auth/login`) ||
    url.startsWith(`${base}/auth/refresh`) ||
    url.includes(`${base}/auth/login`) ||
    url.includes(`${base}/auth/refresh`)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isAuthPublicUrl(req.url)) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthPublicUrl(req.url)) {
        return throwError(() => err);
      }
      return auth.refreshAccessToken().pipe(
        switchMap(() => {
          const t = auth.getAccessToken();
          if (!t) {
            router.navigate(['/login']);
            return throwError(() => err);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }));
        }),
        catchError(() => {
          router.navigate(['/login']);
          return throwError(() => err);
        })
      );
    })
  );
};
