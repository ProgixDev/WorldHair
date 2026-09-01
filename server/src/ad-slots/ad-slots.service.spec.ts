import { NotFoundException } from '@nestjs/common';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { AdSlotsService } from './ad-slots.service';

describe('AdSlotsService', () => {
  let supabase: FakeSupabaseService;
  let service: AdSlotsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new AdSlotsService(supabase as unknown as SupabaseService);
  });

  it('listAll() returns the 3 fixed placements, inactive by default', async () => {
    const slots = await service.listAll();

    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.id).sort()).toEqual([
      'booking_confirmation',
      'home_banner',
      'search_results',
    ]);
    expect(slots.every((s) => s.active === false)).toBe(true);
  });

  it('update() activates a slot with a headline, image and link', async () => {
    const updated = await service.update('home_banner', {
      active: true,
      headline: 'Offre de rentrée',
      imageUrl: 'https://cdn.example.com/banner.png',
      linkUrl: 'https://example.com/offre',
    });

    expect(updated).toMatchObject({
      id: 'home_banner',
      active: true,
      headline: 'Offre de rentrée',
      imageUrl: 'https://cdn.example.com/banner.png',
      linkUrl: 'https://example.com/offre',
    });

    const [refetched] = (await service.listAll()).filter((s) => s.id === 'home_banner');
    expect(refetched).toMatchObject({ active: true, headline: 'Offre de rentrée' });
  });

  it('update() with an empty imageUrl/linkUrl clears them', async () => {
    await service.update('home_banner', {
      imageUrl: 'https://cdn.example.com/banner.png',
      linkUrl: 'https://example.com/offre',
    });

    const cleared = await service.update('home_banner', { imageUrl: '', linkUrl: '' });

    expect(cleared.imageUrl).toBeNull();
    expect(cleared.linkUrl).toBeNull();
  });

  it('update() only changes the fields it was given', async () => {
    await service.update('home_banner', { headline: 'Titre A' });
    const updated = await service.update('home_banner', { active: true });

    expect(updated).toMatchObject({ active: true, headline: 'Titre A' });
  });

  it('update() throws NotFoundException for an unknown placement id', async () => {
    await expect(
      service.update('unknown_placement' as never, { active: true }),
    ).rejects.toThrow(NotFoundException);
  });
});
