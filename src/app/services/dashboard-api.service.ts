import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuditLogListResultV1,
  ApplyConfigRequestV1,
  BackfillSnapshotsResponseV1,
  CaddyConfigHostsResponseV1,
  CaddyConfigIdsResponseV1,
  CaddyConfigUpstreamsResponseV1,
  CaddyNodeV1,
  CreateNodeRequestV1,
  CreateUserRequestV1,
  DiscoveryConfigV1,
  MutateDomainsRequestV1,
  MutateDomainsResponseV1,
  MutateUpstreamsRequestV1,
  MutateUpstreamsResponseV1,
  PropagateConfigResponseV1,
  SnapshotRecordV1,
  UpdateNodeRequestV1,
  UpdateUserRequestV1,
  UserV1
} from '../models/api-v1.model';
import { AdminApiService } from './api/admin-api.service';
import { AuditApiService } from './api/audit-api.service';
import { DiscoveryApiService } from './api/discovery-api.service';
import { NodesApiService } from './api/nodes-api.service';
import { SystemApiService } from './api/system-api.service';
import { UsersApiService } from './api/users-api.service';

/**
 * Application-facing API facade delegating to domain-scoped HTTP services.
 * Prefer injecting the specific `*ApiService` in new code; this class keeps existing call sites stable.
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private readonly system = inject(SystemApiService);
  private readonly audit = inject(AuditApiService);
  private readonly nodes = inject(NodesApiService);
  private readonly discovery = inject(DiscoveryApiService);
  private readonly users = inject(UsersApiService);
  private readonly admin = inject(AdminApiService);

  health(): Observable<unknown> {
    return this.system.health();
  }

  ready(): Observable<unknown> {
    return this.system.ready();
  }

  listNodes(): Observable<CaddyNodeV1[]> {
    return this.nodes.listNodes();
  }

  getNode(id: string): Observable<CaddyNodeV1> {
    return this.nodes.getNode(id);
  }

  createNode(body: CreateNodeRequestV1): Observable<CaddyNodeV1> {
    return this.nodes.createNode(body);
  }

  updateNode(id: string, body: UpdateNodeRequestV1): Observable<CaddyNodeV1> {
    return this.nodes.updateNode(id, body);
  }

  deleteNode(id: string): Observable<void> {
    return this.nodes.deleteNode(id);
  }

  applyConfig(id: string, body: ApplyConfigRequestV1): Observable<Record<string, string>> {
    return this.nodes.applyConfig(id, body);
  }

  reloadCaddy(id: string): Observable<Record<string, string>> {
    return this.nodes.reloadCaddy(id);
  }

  getLiveNodeConfig(id: string): Observable<unknown> {
    return this.nodes.getLiveNodeConfig(id);
  }

  listLiveConfigIds(id: string): Observable<CaddyConfigIdsResponseV1> {
    return this.nodes.listLiveConfigIds(id);
  }

  getLiveConfigById(id: string, configId: string): Observable<Record<string, unknown>> {
    return this.nodes.getLiveConfigById(id, configId);
  }

  getLiveConfigUpstreams(id: string, configId: string): Observable<CaddyConfigUpstreamsResponseV1> {
    return this.nodes.getLiveConfigUpstreams(id, configId);
  }

  getLiveConfigHosts(id: string, configId: string): Observable<CaddyConfigHostsResponseV1> {
    return this.nodes.getLiveConfigHosts(id, configId);
  }

  syncConfig(id: string): Observable<Record<string, unknown>> {
    return this.nodes.syncConfig(id);
  }

  listSnapshots(id: string): Observable<SnapshotRecordV1[]> {
    return this.nodes.listSnapshots(id);
  }

  mutateDomains(id: string, body: MutateDomainsRequestV1): Observable<MutateDomainsResponseV1> {
    return this.nodes.mutateDomains(id, body);
  }

  mutateUpstreams(id: string, body: MutateUpstreamsRequestV1): Observable<MutateUpstreamsResponseV1> {
    return this.nodes.mutateUpstreams(id, body);
  }

  propagateConfig(id: string): Observable<PropagateConfigResponseV1> {
    return this.nodes.propagateConfig(id);
  }

  listDiscovery(): Observable<DiscoveryConfigV1[]> {
    return this.discovery.listDiscovery();
  }

  listDiscoverySnapshots(id: string): Observable<SnapshotRecordV1[]> {
    return this.discovery.listDiscoverySnapshots(id);
  }

  getDiscovery(id: string): Observable<DiscoveryConfigV1> {
    return this.discovery.getDiscovery(id);
  }

  backfillSnapshots(): Observable<BackfillSnapshotsResponseV1> {
    return this.admin.backfillSnapshots();
  }

  createDiscovery(body: DiscoveryConfigV1): Observable<DiscoveryConfigV1> {
    return this.discovery.createDiscovery(body);
  }

  updateDiscovery(id: string, body: DiscoveryConfigV1): Observable<DiscoveryConfigV1> {
    return this.discovery.updateDiscovery(id, body);
  }

  deleteDiscovery(id: string): Observable<void> {
    return this.discovery.deleteDiscovery(id);
  }

  runDiscovery(id: string): Observable<unknown> {
    return this.discovery.runDiscovery(id);
  }

  listAuditLogs(): Observable<AuditLogListResultV1> {
    return this.audit.listAuditLogs();
  }

  listUsers(): Observable<UserV1[]> {
    return this.users.listUsers();
  }

  getUser(id: string): Observable<UserV1> {
    return this.users.getUser(id);
  }

  createUser(body: CreateUserRequestV1): Observable<UserV1> {
    return this.users.createUser(body);
  }

  updateUser(id: string, body: UpdateUserRequestV1): Observable<UserV1> {
    return this.users.updateUser(id, body);
  }

  deleteUser(id: string): Observable<void> {
    return this.users.deleteUser(id);
  }
}
