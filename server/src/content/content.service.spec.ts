import { NotFoundException } from '@nestjs/common';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { ContentService } from './content.service';

describe('ContentService', () => {
  let supabase: FakeSupabaseService;
  let service: ContentService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new ContentService(supabase as unknown as SupabaseService);
  });

  it('get() returns the seeded onboarding_products_slide content', async () => {
    const content = await service.get('onboarding_products_slide');

    expect(content).toMatchObject({
      key: 'onboarding_products_slide',
      heading: 'Des produits de qualité',
      imageUrl: null,
    });
  });

  it('get() throws NotFoundException for an unknown key', async () => {
    await expect(service.get('unknown_key')).rejects.toThrow(NotFoundException);
  });

  it('update() changes heading, body and image together', async () => {
    const updated = await service.update('onboarding_products_slide', {
      heading: 'Des marques que vous aimerez',
      body: 'Texte mis à jour.',
      imageUrl: 'https://cdn.example.com/slide.png',
    });

    expect(updated).toMatchObject({
      heading: 'Des marques que vous aimerez',
      body: 'Texte mis à jour.',
      imageUrl: 'https://cdn.example.com/slide.png',
    });
  });

  it('update() with an empty imageUrl clears it', async () => {
    await service.update('onboarding_products_slide', {
      imageUrl: 'https://cdn.example.com/slide.png',
    });

    const cleared = await service.update('onboarding_products_slide', { imageUrl: '' });

    expect(cleared.imageUrl).toBeNull();
  });

  it('update() throws NotFoundException for an unknown key', async () => {
    await expect(service.update('unknown_key', { heading: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
