import { HttpContextToken } from '@angular/common/http';

/** When set, `authInterceptor` sends this value as the raw `Authorization` header (API key secret). */
export const API_KEY_AUTHORIZATION = new HttpContextToken<string | null>(() => null);
