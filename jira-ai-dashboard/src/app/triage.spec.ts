import { TestBed } from '@angular/core/testing';

import { Triage } from './triage';

describe('Triage', () => {
  let service: Triage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Triage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
