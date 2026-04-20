import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { DiscoveryApiService } from './discovery-api.service';

describe('DiscoveryApiService', () => {
  let service: DiscoveryApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        DiscoveryApiService
      ]
    });
    service = TestBed.inject(DiscoveryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('normalizes array snapshot responses', done => {
    service.listDiscoverySnapshots('disc-1').subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0]['id']).toBe('snap-1');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-1/snapshots`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'snap-1' }]);
  });

  it('normalizes object snapshot responses', done => {
    service.listDiscoverySnapshots('disc-2').subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0]['id']).toBe('snap-2');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-2/snapshots`);
    req.flush({ snapshots: [{ id: 'snap-2' }] });
  });
});
