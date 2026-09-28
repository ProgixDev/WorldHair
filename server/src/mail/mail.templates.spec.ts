import { appointmentReminderMail } from './mail.templates';

describe('appointmentReminderMail', () => {
  it("escapes the prestation names, which the salon types itself", () => {
    const mail = appointmentReminderMail('Coupe <a href="https://phish.example">ici</a>', 'demain à 10:00');

    expect(mail.html).not.toContain('<a href="https://phish.example">');
    expect(mail.html).toContain('Coupe &lt;a href=&quot;https://phish.example&quot;&gt;ici&lt;/a&gt;');
  });
});
