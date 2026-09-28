import { appointmentReminderMail, coiffeurApplicationDecidedMail, subscriptionEndedMail, subscriptionEndingSoonMail } from './mail.templates';

describe('appointmentReminderMail', () => {
  it("escapes the prestation names, which the salon types itself", () => {
    const mail = appointmentReminderMail('Coupe <a href="https://phish.example">ici</a>', 'demain à 10:00');

    expect(mail.html).not.toContain('<a href="https://phish.example">');
    expect(mail.html).toContain('Coupe &lt;a href=&quot;https://phish.example&quot;&gt;ici&lt;/a&gt;');
  });
});

describe('subscription emails', () => {
  it('link the coiffeur to their subscription page', () => {
    const link = 'https://worldhair.test/pro/abonnement';

    expect(subscriptionEndedMail(link).html).toContain(`href="${link}"`);
    expect(subscriptionEndingSoonMail('mer. 7 oct.', link).html).toContain(`href="${link}"`);
    expect(subscriptionEndingSoonMail('mer. 7 oct.', link).text).toContain('mer. 7 oct.');
  });

  it('tell a validated coiffeur how to put their salon online', () => {
    const link = 'https://worldhair.test/pro/abonnement';

    expect(coiffeurApplicationDecidedMail('validated', null, link).html).toContain(`href="${link}"`);
    expect(coiffeurApplicationDecidedMail('validated', null, null).html).not.toContain('href=');
  });
});
