import {
  teamsText,
  webhookBody,
  WebhookSender,
} from '../../src/infra/adapters/WebhookSender.ts';

const delivery = { id: 'd1', to: '#costos', recipientName: 'Daniela Soto' };

const rendered = {
  subject: 'Losa nivel 3',
  text: '*Losa nivel 3*\n• *Sube el costo*: Actualiza\n<https://vigente.example/c1|Revisa el cambio y responde>',
  html: null,
};

describe('webhookBody', () => {
  it('para Slack manda el texto tal cual, con a quién va dirigido', () => {
    expect(webhookBody('slack', delivery, rendered)).toEqual({
      text: `Para Daniela Soto (#costos)\n${rendered.text}`,
    });
  });

  it('para Teams arma una tarjeta con el texto en su markdown', () => {
    const body = JSON.stringify(webhookBody('teams', delivery, rendered));

    expect(body).toContain('application/vnd.microsoft.card.adaptive');
    expect(body).toContain('Para Daniela Soto (#costos)');
    expect(body).toContain('**Losa nivel 3**');
    expect(body).toContain(
      '[Revisa el cambio y responde](https://vigente.example/c1)',
    );
  });

  it('teamsText convierte negritas y enlaces de Slack y separa las líneas', () => {
    expect(teamsText('*a*\n<https://x.example/y|ver>')).toBe(
      '**a**\n\n[ver](https://x.example/y)',
    );
  });
});

describe('WebhookSender', () => {
  it('publica en la URL y devuelve un id propio de la entrega', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const sender = new WebhookSender(
      'https://hooks.example/T/B/x',
      'slack',
      fetcher,
    );

    await expect(sender.send(delivery, rendered)).resolves.toBe('slack:d1');

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://hooks.example/T/B/x');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(
      webhookBody('slack', delivery, rendered),
    );
  });

  it('si el proveedor responde con error, falla con el estado y el detalle', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('invalid_token', { status: 403 }));

    await expect(
      new WebhookSender('https://hooks.example/x', 'teams', fetcher).send(
        delivery,
        rendered,
      ),
    ).rejects.toThrow('Teams respondió 403: invalid_token');
  });
});
