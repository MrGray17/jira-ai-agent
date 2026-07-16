import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TriageService } from './triage';

describe('TriageService', () => {
  let service: TriageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(TriageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});