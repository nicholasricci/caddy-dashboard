import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  APIKeyCreateResponseV1,
  APIKeyListResponseV1,
  APIKeyV1,
  CreateAPIKeyRequestV1
} from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

export function normalizeApiKeys(body: unknown): APIKeyV1[] {
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: APIKeyV1[] }).items;
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class ApiKeysApiService extends ApiBaseService {
  listApiKeys(): Observable<APIKeyV1[]> {
    return this.http
      .get<APIKeyListResponseV1>(`${this.base}/api-keys`)
      .pipe(map(body => normalizeApiKeys(body)));
  }

  createApiKey(body: CreateAPIKeyRequestV1): Observable<APIKeyCreateResponseV1> {
    return this.http.post<APIKeyCreateResponseV1>(`${this.base}/api-keys`, body);
  }

  revokeApiKey(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/api-keys/${encodeURIComponent(id)}/revoke`, {});
  }

  deleteApiKey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api-keys/${encodeURIComponent(id)}`);
  }
}
