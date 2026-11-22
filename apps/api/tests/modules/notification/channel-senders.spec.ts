import { buildChannelSenders } from '../../../src/modules/notification/channel-senders.ts';

const emailFrom = 'Vigente <app@vigente.example>';

const gmail = {
  gmailClientId: 'id',
  gmailClientSecret: 'secret',
  gmailRefreshToken: 'refresh',
};

describe('qué canales tienen envío real', () => {
  it('sin variables no hay ninguno', () => {
    expect(buildChannelSenders({ emailFrom })).toEqual({});
  });

  it('con las tres de Gmail hay correo; con dos no', () => {
    expect(Object.keys(buildChannelSenders({ ...gmail, emailFrom }))).toEqual([
      'email',
    ]);
    expect(
      buildChannelSenders({
        ...gmail,
        gmailRefreshToken: undefined,
        emailFrom,
      }),
    ).toEqual({});
  });

  it('el chat sale por el webhook de Slack, o por el de Teams si solo está ese', () => {
    expect(
      Object.keys(
        buildChannelSenders({
          emailFrom,
          teamsWebhookUrl: 'https://teams.example/hook',
        }),
      ),
    ).toEqual(['slack']);
    expect(
      Object.keys(
        buildChannelSenders({
          ...gmail,
          emailFrom,
          slackWebhookUrl: 'https://hooks.example/x',
          teamsWebhookUrl: 'https://teams.example/hook',
        }),
      ),
    ).toEqual(['email', 'slack']);
  });
});
