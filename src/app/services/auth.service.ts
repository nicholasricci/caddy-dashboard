import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, of, share, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { decodeJwtPayload } from '../core/jwt.util';
import { LoginRequestV1, SessionUserV1, TokenMapV1 } from '../models/api-v1.model';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly httpRaw = new HttpClient(inject(HttpBackend));
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');

  private readonly userSubject = new BehaviorSubject<SessionUserV1 | null>(null);
  readonly user$ = this.userSubject.asObservable();

  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /** Single in-flight refresh so concurrent 401s share one token rotation. */
  private refreshInFlight$: Observable<void> | null = null;

  constructor() {
    this.initialize();
  }

  private get tokenStorage(): Storage {
    return environment.authTokenStorage === 'sessionStorage' ? sessionStorage : localStorage;
  }

  private initialize(): void {
    if (this.initializationPromise) {
      return;
    }
    this.initializationPromise = this.loadInitialUser();
  }

  private async loadInitialUser(): Promise<void> {
    const token = this.getAccessToken();
    if (token) {
      this.hydrateUserFromAccessToken(token);
    }
    this.isInitialized = true;
  }

  private pickToken(tokens: TokenMapV1, ...keys: string[]): string | null {
    for (const k of keys) {
      const v = tokens[k];
      if (v && typeof v === 'string') {
        return v;
      }
    }
    return null;
  }

  private storeTokens(tokens: TokenMapV1): void {
    const access = this.pickToken(tokens, 'access_token', 'accessToken', 'token');
    const refresh = this.pickToken(tokens, 'refresh_token', 'refreshToken');
    if (access) {
      this.tokenStorage.setItem(ACCESS_KEY, access);
    }
    if (refresh) {
      this.tokenStorage.setItem(REFRESH_KEY, refresh);
    }
  }

  private hydrateUserFromAccessToken(access: string): void {
    const payload = decodeJwtPayload(access);
    if (!payload) {
      // Opaque or non-JWT access token: still allow session; admin JWT claims won't apply.
      this.userSubject.next({
        id: null,
        username: 'user',
        role: null,
        isAdmin: false
      });
      return;
    }
    const id = (payload['sub'] as string) ?? (payload['user_id'] as string) ?? null;
    const username =
      (payload['username'] as string) ??
      (payload['preferred_username'] as string) ??
      (payload['name'] as string) ??
      'user';
    const role = (payload['role'] as string) ?? null;
    const roles = payload['roles'];
    const roleFromArr = Array.isArray(roles) && roles.length ? String(roles[0]) : null;
    const r = role ?? roleFromArr;
    const isAdmin =
      r === 'admin' ||
      payload['is_admin'] === true ||
      payload['admin'] === true;
    this.userSubject.next({
      id,
      username,
      role: r,
      isAdmin
    });
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken() && this.userSubject.value !== null;
  }

  getCurrentUser(): SessionUserV1 | null {
    return this.userSubject.value;
  }

  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  getAccessToken(): string | null {
    return this.tokenStorage.getItem(ACCESS_KEY);
  }

  /** @deprecated Use getAccessToken */
  getToken(): string | null {
    return this.getAccessToken();
  }

  login(data: LoginRequestV1): Observable<TokenMapV1> {
    return this.http.post<TokenMapV1>(`${this.apiUrl}/auth/login`, data).pipe(
      tap(tokens => {
        this.storeTokens(tokens);
        const access = this.getAccessToken();
        if (access) {
          this.hydrateUserFromAccessToken(access);
        }
      })
    );
  }

  refreshAccessToken(): Observable<void> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    const rt = this.tokenStorage.getItem(REFRESH_KEY);
    if (!rt) {
      return throwError(() => new Error('No refresh token'));
    }
    this.refreshInFlight$ = this.httpRaw
      .post<TokenMapV1>(`${this.apiUrl}/auth/refresh`, { refresh_token: rt })
      .pipe(
        tap(tokens => this.storeTokens(tokens)),
        tap(() => {
          const access = this.getAccessToken();
          if (access) {
            this.hydrateUserFromAccessToken(access);
          }
        }),
        map(() => undefined),
        catchError(err => {
          this.logout();
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        share()
      );
    return this.refreshInFlight$;
  }

  logout(): void {
    this.clearStoredTokens();
    this.userSubject.next(null);
  }

  logoutRemote(): Observable<void> {
    const refreshToken = this.tokenStorage.getItem(REFRESH_KEY);
    const accessToken = this.getAccessToken();
    if (!refreshToken) {
      this.logout();
      return of(void 0);
    }

    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    return this.httpRaw.post<void>(`${this.apiUrl}/auth/logout`, { refresh_token: refreshToken }, { headers }).pipe(
      catchError(() => of(void 0)),
      tap(() => this.logout())
    );
  }

  /** Clears tokens from both storages so logout is complete after persistence mode changes. */
  private clearStoredTokens(): void {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(ACCESS_KEY);
      s.removeItem(REFRESH_KEY);
    }
  }
}
