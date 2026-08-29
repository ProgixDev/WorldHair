import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { CoiffeurApplicationsService } from './coiffeur-applications.service';
import { ReviewDecision } from './dto/review-application.dto';
import { PracticeZone, SubmitCoiffeurApplicationDto } from './dto/submit-application.dto';

const USER_ID = 'user-1';

function salonDto(
  userId: string = USER_ID,
  overrides: Partial<SubmitCoiffeurApplicationDto> = {},
): SubmitCoiffeurApplicationDto {
  return {
    firstName: 'Sofia',
    lastName: 'Benali',
    phone: '06 12 34 56 78',
    salonName: 'Studio W',
    practiceZone: PracticeZone.Salon,
    addressLine: '12 rue des Lilas',
    postalCode: '75011',
    city: 'Paris',
    invoiceDocumentPath: `${userId}/invoice.pdf`,
    identityDocumentPath: `${userId}/identity.pdf`,
    diplomaDocumentPath: `${userId}/diploma.pdf`,
    kbisDocumentPath: `${userId}/kbis.pdf`,
    ...overrides,
  } as SubmitCoiffeurApplicationDto;
}

describe('CoiffeurApplicationsService', () => {
  let supabase: FakeSupabaseService;
  let service: CoiffeurApplicationsService;
  let events: EventEmitter2;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    events = new EventEmitter2();
    service = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, events);
  });

  it('getMine() returns null before any application exists', async () => {
    await expect(service.getMine(USER_ID)).resolves.toBeNull();
  });

  it('submit() creates a pending application and promotes the role to coiffeur', async () => {
    const application = await service.submit(USER_ID, salonDto());

    expect(application).toMatchObject({
      profileId: USER_ID,
      status: 'pending',
      practiceZone: 'salon',
      addressLine: '12 rue des Lilas',
      shopProfileComplete: false,
    });
    await expect(service.getMine(USER_ID)).resolves.toMatchObject({ id: application.id });
  });

  it('rejects a domicile application missing invoice fields but requiring travelRadiusKm', async () => {
    const application = await service.submit(
      USER_ID,
      salonDto(USER_ID, {
        practiceZone: PracticeZone.Domicile,
        addressLine: undefined,
        postalCode: undefined,
        city: undefined,
        invoiceDocumentPath: undefined,
        travelRadiusKm: 15,
      }),
    );

    expect(application).toMatchObject({
      practiceZone: 'domicile',
      travelRadiusKm: 15,
      addressLine: null,
      invoiceDocumentPath: null,
    });
  });

  it('rejects a salon application without invoiceDocumentPath', async () => {
    await expect(
      service.submit(USER_ID, salonDto(USER_ID, { invoiceDocumentPath: undefined })),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a document path that isn't under the caller's own folder", async () => {
    await expect(
      service.submit(USER_ID, salonDto(USER_ID, { identityDocumentPath: 'someone-else/identity.pdf' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('resubmission replaces the previous application in place (same row, cleared review)', async () => {
    const first = await service.submit(USER_ID, salonDto());
    await service.decide(first.id, ReviewDecision.Rejected, 'Diplôme illisible');

    const resubmitted = await service.submit(USER_ID, salonDto(USER_ID, { salonName: 'Studio W 2' }));

    expect(resubmitted.id).toBe(first.id);
    expect(resubmitted.status).toBe('pending');
    expect(resubmitted.reviewMessage).toBeNull();
    expect(resubmitted.salonName).toBe('Studio W 2');
  });

  it('completeShopProfile() rejects while the application is still pending', async () => {
    await service.submit(USER_ID, salonDto());

    await expect(service.completeShopProfile(USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('completeShopProfile() rejects when no application exists at all', async () => {
    await expect(service.completeShopProfile(USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('completeShopProfile() succeeds once the application is validated', async () => {
    const application = await service.submit(USER_ID, salonDto());
    await service.decide(application.id, ReviewDecision.Validated);

    await expect(service.completeShopProfile(USER_ID)).resolves.toMatchObject({
      shopProfileComplete: true,
    });
  });

  it('listByStatus() filters by status and paginates', async () => {
    const a = await service.submit('user-a', salonDto('user-a'));
    await service.submit('user-b', salonDto('user-b'));
    await service.decide(a.id, ReviewDecision.Validated);

    await expect(service.listByStatus('validated', { limit: 20, offset: 0 })).resolves.toEqual([
      expect.objectContaining({ id: a.id, status: 'validated' }),
    ]);
    await expect(service.listByStatus(undefined, { limit: 1, offset: 0 })).resolves.toHaveLength(1);
  });

  it('decide() rejecting sets the review message; approving clears it', async () => {
    const application = await service.submit(USER_ID, salonDto());

    const rejected = await service.decide(application.id, ReviewDecision.Rejected, 'Photo floue');
    expect(rejected).toMatchObject({ status: 'rejected', reviewMessage: 'Photo floue' });

    const revalidated = await service.decide(application.id, ReviewDecision.Validated, 'ignored');
    expect(revalidated).toMatchObject({ status: 'validated', reviewMessage: null });
  });

  it('decide() throws NotFoundException for an unknown application id', async () => {
    await expect(
      service.decide('00000000-0000-0000-0000-000000000000', ReviewDecision.Validated),
    ).rejects.toThrow(NotFoundException);
  });

  it('decide() emits coiffeur-application.decided for notifications/ to pick up', async () => {
    const application = await service.submit(USER_ID, salonDto());
    const handler = jest.fn();
    events.on('coiffeur-application.decided', handler);

    await service.decide(application.id, ReviewDecision.Rejected, 'Photo floue');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: application.id,
        profileId: USER_ID,
        status: 'rejected',
        reviewMessage: 'Photo floue',
      }),
    );
  });
});
