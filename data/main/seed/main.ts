import { createPrismaClient } from '../index.ts';
import {
  inviteToOrganization,
  listProjectIds,
  saveOrganization,
  saveProjectDefinition,
} from '../project/store.ts';
import { LOS_AROMOS, LOS_AROMOS_ORGANIZATION } from './los-aromos.ts';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('Falta DATABASE_URL: copia .env.example a .env en la raíz.');
  process.exit(1);
}

const onlyIfEmpty = process.argv.includes('--si-no-hay');
const adminEmail = process.env['SEED_ADMIN_EMAIL']?.trim();

const prisma = createPrismaClient(url);
try {
  const existing = await listProjectIds(prisma);
  if (onlyIfEmpty && existing.length > 0) {
    console.log(
      `La base ya tiene ${existing.length === 1 ? 'un proyecto' : `${existing.length} proyectos`}: no siembro.`,
    );
  } else {
    await saveOrganization(prisma, LOS_AROMOS_ORGANIZATION);
    await saveProjectDefinition(prisma, LOS_AROMOS);
    console.log(
      `Sembré el proyecto ${LOS_AROMOS.name} (${LOS_AROMOS.id}) en ${LOS_AROMOS_ORGANIZATION.name}.`,
    );
  }
  if (adminEmail) {
    await inviteToOrganization(prisma, {
      organizationId: LOS_AROMOS_ORGANIZATION.id,
      email: adminEmail,
      role: 'admin',
    });
    console.log(
      `Invité a ${adminEmail} como administrador de ${LOS_AROMOS_ORGANIZATION.name}.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
