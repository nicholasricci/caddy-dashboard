import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_KEY_AUTHORIZATION } from '../../core/http-context.tokens';
import {
  RegisterUpstreamByProfileRequestV1,
  RegisterUpstreamProfileResponseV1,
  UpstreamProfileV1,
  UpstreamProfileWriteRequestV1
} from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

export function normalizeUpstreamProfiles(body: unknown): UpstreamProfileV1[] {
  if (Array.isArray(body)) {
    return body as UpstreamProfileV1[];
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidates = [obj['items'], obj['profiles'], obj['data']];
    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value as UpstreamProfileV1[];
      }
    }
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class UpstreamProfilesApiService extends ApiBaseService {
  listForDiscovery(discoveryId: string): Observable<UpstreamProfileV1[]> {
    return this.http
      .get<unknown>(`${this.base}/discovery/${encodeURIComponent(discoveryId)}/upstream-profiles`)
      .pipe(map(body => normalizeUpstreamProfiles(body)));
  }

  get(id: string): Observable<UpstreamProfileV1> {
    return this.http.get<UpstreamProfileV1>(`${this.base}/upstream-profiles/${encodeURIComponent(id)}`);
  }

  create(discoveryId: string, body: UpstreamProfileWriteRequestV1): Observable<UpstreamProfileV1> {
    return this.http.post<UpstreamProfileV1>(
      `${this.base}/discovery/${encodeURIComponent(discoveryId)}/upstream-profiles`,
      body
    );
  }

  update(id: string, body: UpstreamProfileWriteRequestV1): Observable<UpstreamProfileV1> {
    return this.http.put<UpstreamProfileV1>(`${this.base}/upstream-profiles/${encodeURIComponent(id)}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/upstream-profiles/${encodeURIComponent(id)}`);
  }

  registerByProfile(
    profileId: string,
    apiKeySecret: string,
    body: RegisterUpstreamByProfileRequestV1
  ): Observable<RegisterUpstreamProfileResponseV1> {
    return this.http.post<RegisterUpstreamProfileResponseV1>(
      `${this.base}/upstream-profiles/${encodeURIComponent(profileId)}/register`,
      body,
      {
        context: new HttpContext().set(API_KEY_AUTHORIZATION, apiKeySecret.trim())
      }
    );
  }
}
