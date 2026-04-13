import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Shared HTTP client + normalized API root for domain API services. */
@Injectable()
export abstract class ApiBaseService {
  protected readonly http = inject(HttpClient);
  protected readonly base = environment.apiUrl.replace(/\/$/, '');
}
