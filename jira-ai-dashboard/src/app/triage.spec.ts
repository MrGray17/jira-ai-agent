import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TriageService } from './triage';

describe('TriageService', () => {
  let service: TriageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(TriageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
