import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApplyConfigRequestV1, CaddyNodeV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class NodesApiService extends ApiBaseService {
  listNodes(): Observable<CaddyNodeV1[]> {
    return this.http.get<CaddyNodeV1[]>(`${this.base}/nodes`);
  }

  getNode(id: string): Observable<CaddyNodeV1> {
    return this.http.get<CaddyNodeV1>(`${this.base}/nodes/${encodeURIComponent(id)}`);
  }

  createNode(body: CaddyNodeV1): Observable<CaddyNodeV1> {
    return this.http.post<CaddyNodeV1>(`${this.base}/nodes`, body);
  }

  updateNode(id: string, body: CaddyNodeV1): Observable<CaddyNodeV1> {
    return this.http.put<CaddyNodeV1>(`${this.base}/nodes/${encodeURIComponent(id)}`, body);
  }

  deleteNode(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/nodes/${encodeURIComponent(id)}`);
  }

  applyConfig(id: string, body: ApplyConfigRequestV1): Observable<Record<string, string>> {
    return this.http.post<Record<string, string>>(`${this.base}/nodes/${encodeURIComponent(id)}/apply`, body);
  }

  reloadCaddy(id: string): Observable<Record<string, string>> {
    return this.http.post<Record<string, string>>(`${this.base}/nodes/${encodeURIComponent(id)}/reload`, {});
  }

  getLiveNodeConfig(id: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/nodes/${encodeURIComponent(id)}/config/live`);
  }

  syncConfig(id: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/nodes/${encodeURIComponent(id)}/sync`, {});
  }

  listSnapshots(id: string): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/nodes/${encodeURIComponent(id)}/snapshots`);
  }
}
