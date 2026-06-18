import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_KEY_AUTHORIZATION } from '../../core/http-context.tokens';
import {
  DomainProfileV1,
  DomainProfileWriteRequestV1,
  RegisterDomainByProfileRequestV1,
  RegisterDomainProfileResponseV1
} from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

export function normalizeDomainProfiles(body: unknown): DomainProfileV1[] {
  if (Array.isArray(body)) {
    return body as DomainProfileV1[];
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidates = [obj['items'], obj['profiles'], obj['data']];
    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value as DomainProfileV1[];
      }
    }
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class DomainProfilesApiService extends ApiBaseService {
  listForDiscovery(discoveryId: string): Observable<DomainProfileV1[]> {
    return this.http
      .get<unknown>(`${this.base}/discovery/${encodeURIComponent(discoveryId)}/domain-profiles`)
      .pipe(map(body => normalizeDomainProfiles(body)));
  }

  get(id: string): Observable<DomainProfileV1> {
    return this.http.get<DomainProfileV1>(`${this.base}/domain-profiles/${encodeURIComponent(id)}`);
  }

  create(discoveryId: string, body: DomainProfileWriteRequestV1): Observable<DomainProfileV1> {
    return this.http.post<DomainProfileV1>(
      `${this.base}/discovery/${encodeURIComponent(discoveryId)}/domain-profiles`,
      body
    );
  }

  update(id: string, body: DomainProfileWriteRequestV1): Observable<DomainProfileV1> {
    return this.http.put<DomainProfileV1>(`${this.base}/domain-profiles/${encodeURIComponent(id)}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/domain-profiles/${encodeURIComponent(id)}`);
  }

  registerByProfile(
    profileId: string,
    apiKeySecret: string,
    body: RegisterDomainByProfileRequestV1
  ): Observable<RegisterDomainProfileResponseV1> {
    return this.http.post<RegisterDomainProfileResponseV1>(
      `${this.base}/domain-profiles/${encodeURIComponent(profileId)}/register`,
      body,
      {
        context: new HttpContext().set(API_KEY_AUTHORIZATION, apiKeySecret.trim())
      }
    );
  }
}
