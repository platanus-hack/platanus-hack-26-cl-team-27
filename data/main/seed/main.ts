import { createPrismaClient } from '../index.ts';
import { listProjectIds, saveProjectDefinition } from '../project/store.ts';
import { LOS_AROMOS } from './los-aromos.ts';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('Falta DATABASE_URL: copia .env.example a .env en la raíz.');
  process.exit(1);
}

const onlyIfEmpty = process.argv.includes('--si-no-hay');

const prisma = createPrismaClient(url);
try {
  const existing = await listProjectIds(prisma);
  if (onlyIfEmpty && existing.length > 0) {
    console.log(
      `La base ya tiene ${existing.length === 1 ? 'un proyecto' : `${existing.length} proyectos`}: no siembro.`,
    );
  } else {
    await saveProjectDefinition(prisma, LOS_AROMOS);
    console.log(`Sembré el proyecto ${LOS_AROMOS.name} (${LOS_AROMOS.id}).`);
  }
} finally {
  await prisma.$disconnect();
}
