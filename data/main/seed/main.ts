import { createPrismaClient } from '../index.ts';
import { inviteToOrganization, saveOrganization } from '../project/store.ts';
import { CORDILLERA, emailOf, PEOPLE } from './cordillera.ts';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('Falta DATABASE_URL: copia .env.example a .env en la raíz.');
  process.exit(1);
}

const onlyIfEmpty = process.argv.includes('--si-no-hay');
const base = process.env['SEED_EMAIL']?.trim() || undefined;

const prisma = createPrismaClient(url);
try {
  if (onlyIfEmpty) {
    const organizations = await prisma.organization.count();
    if (organizations > 0) {
      console.log(
        `La base ya tiene ${organizations === 1 ? 'una organización' : `${organizations} organizaciones`}: no siembro.`,
      );
    } else {
      await saveOrganization(prisma, CORDILLERA);
      console.log(`Creé ${CORDILLERA.name}, sin proyectos ni personas.`);
    }
  } else {
    await saveOrganization(prisma, CORDILLERA);
    for (const person of PEOPLE) {
      await inviteToOrganization(prisma, {
        organizationId: CORDILLERA.id,
        email: emailOf(person, base),
        role: person.role,
      });
    }
    console.log(`Sembré ${CORDILLERA.name} con estas invitaciones:`);
    for (const person of PEOPLE) {
      console.log(`  ${person.role.padEnd(6)}  ${emailOf(person, base)}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
