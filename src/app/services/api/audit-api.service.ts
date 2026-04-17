import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogEntryV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class AuditApiService extends ApiBaseService {
  listAuditLogs(): Observable<AuditLogEntryV1[]> {
    return this.http.get<AuditLogEntryV1[]>(`${this.base}/audit`);
  }
}
