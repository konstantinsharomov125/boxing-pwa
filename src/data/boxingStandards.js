export const boxingStandards = {
  documents: [
    {
      id: 'fssp-boxing-2025',
      title: 'Федеральный стандарт спортивной подготовки по виду спорта «бокс»',
      documentNumber: 'Приказ Минспорта России от 09.12.2025 № 1076',
      category: 'Государственные стандарты РФ',
      description: 'Регламентирует этапы подготовки, годовые объемы нагрузок и процентное соотношение видов подготовки.'
    },
    {
      id: 'new-disciplines-2025',
      title: 'Правила дисциплин: «интерактивный бокс», «удар на силу»',
      documentNumber: 'Приказ Минспорта России от 15.07.2025 № 560',
      category: 'Инновационные дисциплины',
      description: 'Нормативы для дисциплин с использованием VR-технологий и цифровых измерителей.'
    },
    {
      id: 'iba-rules',
      title: 'Технические правила и правила соревнований IBA',
      documentNumber: 'Международный регламент (Март 2024)',
      category: 'Международные правила',
      description: 'Стандарты судейства, экипировки и весовых категорий.'
    },
    {
      id: 'world-boxing-rules',
      title: 'Правила соревнований World Boxing',
      documentNumber: 'Международный регламент (Февраль 2024)',
      category: 'Международные правила',
      description: 'Критерии оценки чистых ударов (Quality blows) и 10-балльная система.'
    }
  ],
  stagesConfig: {
    np: {
      name: 'Начальная подготовка (НП)',
      minAge: 10,
      maxHoursPerYear: 416,
      ratios: { gpp: 45, spp: 25, tech: 20, tact: 5, theo: 5 }
    },
    tr: {
      name: 'Тренировочный этап (спортивная специализация)',
      minAge: 12,
      maxHoursPerYear: 832,
      ratios: { gpp: 35, spp: 35, tech: 15, tact: 10, theo: 5 }
    },
    ss: {
      name: 'Этап спортивного совершенствования (СС)',
      minAge: 14,
      maxHoursPerYear: 1248,
      ratios: { gpp: 25, spp: 40, tech: 15, tact: 15, theo: 5 }
    },
    vsp: {
      name: 'Этап высшего спортивного мастерства (ВСМ)',
      minAge: 17,
      maxHoursPerYear: 1664,
      ratios: { gpp: 20, spp: 45, tech: 10, tact: 20, theo: 5 }
    }
  }
};