import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class SystemApiService extends ApiBaseService {
  health(): Observable<unknown> {
    return this.http.get(`${this.base}/health`);
  }
}
