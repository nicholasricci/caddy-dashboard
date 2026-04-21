import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CaddyConfigHostsResponseV1,
  ApplyConfigRequestV1,
  CaddyConfigIdsResponseV1,
  CaddyConfigUpstreamsResponseV1,
  CaddyNodeV1
} from '../../models/api-v1.model';
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

  listLiveConfigIds(id: string): Observable<CaddyConfigIdsResponseV1> {
    return this.http.get<CaddyConfigIdsResponseV1>(`${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids`);
  }

  getLiveConfigById(id: string, configId: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}`
    );
  }

  getLiveConfigUpstreams(id: string, configId: string): Observable<CaddyConfigUpstreamsResponseV1> {
    return this.http.get<CaddyConfigUpstreamsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}/upstreams`
    );
  }

  getLiveConfigHosts(id: string, configId: string): Observable<CaddyConfigHostsResponseV1> {
    return this.http.get<CaddyConfigHostsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}/hosts`
    );
  }

  syncConfig(id: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/nodes/${encodeURIComponent(id)}/sync`, {});
  }

  listSnapshots(id: string): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/nodes/${encodeURIComponent(id)}/snapshots`);
  }
}
