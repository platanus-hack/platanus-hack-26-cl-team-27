import { AuthenticationClient } from '@aps_sdk/authentication';

import {
  apsErrorStatus,
  readApsCredentials,
} from '../src/modules/aps/aps-auth.ts';

const credentials = readApsCredentials(process.env);
if (!credentials) {
  console.error(
    'Faltan APS_CLIENT_ID y APS_CLIENT_SECRET en el .env de la raíz.',
  );
  process.exit(1);
}

try {
  const token = await new AuthenticationClient().getTwoLeggedToken(
    credentials.clientId,
    credentials.clientSecret,
    ['viewables:read'],
  );
  console.log(
    `APS: credenciales válidas (HTTP 200, el token dura ${token.expires_in} s).`,
  );
} catch (error) {
  console.error(
    `APS: credenciales rechazadas (HTTP ${apsErrorStatus(error) ?? 'sin respuesta'}).`,
  );
  process.exit(1);
}
