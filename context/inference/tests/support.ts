import type { ChangeSummary } from '../src/domain/Evidence.ts';
import type { ProjectVocabulary } from '../src/domain/Vocabulary.ts';

export const vocabulary: ProjectVocabulary = {
  project: 'Edificio Los Aromos',
  subjects: [
    {
      id: 'losa-n3',
      label: 'Losa nivel 3',
      category: 'losa',
      attributes: [{ key: 'espesor_cm', label: 'Espesor', unit: 'cm' }],
    },
    {
      id: 'ventanas-norte',
      label: 'Ventanas fachada norte',
      category: 'ventana',
      attributes: [
        { key: 'ancho_cm', label: 'Ancho', unit: 'cm' },
        { key: 'material', label: 'Material', unit: null },
      ],
    },
  ],
  stakeholders: [
    { id: 'fernanda', name: 'Fernanda Lagos', role: 'Arquitecta' },
    { id: 'paula', name: 'Paula Rojas', role: 'Ingeniera calculista' },
    { id: 'camila', name: 'Camila Vera', role: 'Instalaciones eléctricas' },
    { id: 'tomas', name: 'Tomás Reyes', role: 'Terminaciones' },
  ],
};

export const slabChange: ChangeSummary = {
  subjectId: 'losa-n3',
  attribute: 'espesor_cm',
  before: 15,
  after: 20,
  unit: 'cm',
  summary: 'Espesor: 15 cm → 20 cm',
};
