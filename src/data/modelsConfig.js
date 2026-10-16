import { loadUserResearch, ADMISSION_CONDITIONS, ADMISSIBLE_STATUSES } from './userResearchStore.js';

/**
 * Научная конфигурация показателей и референтных моделей BOX-PROFILE.
 *
 * Назначение файла — контракт данных для анализатора (будущий
 * `src/utils/fullAnalyzer.js`), а не хранилище исследований.
 * Числовые результаты исследований остаются в `src/data/researchDatabase.js`;
 * здесь описываются показатели, категории, схема референтных моделей,
 * статусы достоверности и правила сопоставимости измерений.
 *
 * Принципы:
 *  - никакие значения не выдумываются: неизвестные поля = null;
 *  - отсутствующие данные не заменяются нулями;
 *  - статус публикации не приравнивается к доказанности норматива;
 *  - среднее из отдельного исследования не является универсальным нормативом.
 */

// ---------------------------------------------------------------------------
// 1. Статусы научных данных
// ---------------------------------------------------------------------------

/**
 * Статус описывает степень проверки ИСТОЧНИКА данных, а не доказанность
 * конкретного норматива. Публикация в рецензируемом журнале сама по себе
 * не делает содержащиеся в ней средние значения валидированной
 * референтной моделью.
 */
export const DATA_QUALITY_STATUSES = {
  verified_fulltext: {
    labelRu: 'Верифицировано по полному тексту',
    description:
      'Данные сверены с полным текстом первоисточника: протокол, выборка и ' +
      'статистики подтверждены. Не означает автоматически, что значения ' +
      'пригодны как референтная модель для другой когорты, и не делает ' +
      'модель валидированной нормой — допуск к сравнению определяется ' +
      'отдельным критерием admission.',
  },
  verified_primary: {
    labelRu: 'Верифицировано по первоисточнику',
    description:
      'Данные подтверждены первичным источником (статья, диссертация, ' +
      'официальный документ), но полный текст не сверен целиком.',
  },
  abstract_only: {
    labelRu: 'Только аннотация',
    description:
      'Известна только аннотация или тезисы. Протокол измерения, размер ' +
      'выборки и характер распределения могут быть неизвестны.',
  },
  secondary_source: {
    labelRu: 'Вторичный источник',
    description:
      'Данные получены из обзора, учебника или пересказа, а не из ' +
      'первичного исследования. Требуется проверка по первоисточнику.',
  },
  provisional: {
    labelRu: 'Предварительные данные',
    description:
      'Рабочие данные, ожидающие подтверждения. Не использовать для ' +
      'нормативных выводов без оговорки о неопределённости.',
  },
  unverified: {
    labelRu: 'Непроверенные данные',
    description:
      'Источник указан, но данные не сверены. Уровень достоверности ' +
      'не повышается автоматически.',
  },
  demo: {
    labelRu: 'Демонстрационные данные',
    description:
      'Значения предназначены для демонстрации интерфейса и не являются ' +
      'научными данными. Не выдавать за научные.',
  },
  derived_from_verified_data: {
    labelRu: 'Производные от верифицированных данных',
    description:
      'Показатель рассчитан по формуле из верифицированных исходных ' +
      'данных; достоверность ограничена достоверностью входов и ' +
      'корректностью формулы.',
  },
};

// ---------------------------------------------------------------------------
// 2. Научные категории показателей
// ---------------------------------------------------------------------------

export const METRIC_CATEGORIES = [
  {
    id: 'anthropometry',
    nameRu: 'Антропометрия и морфология',
    description: 'Состав тела, размерные характеристики, биоимпедансные показатели.',
  },
  {
    id: 'punchBiomechanics',
    nameRu: 'Биомеханика ударов',
    description: 'Сила, мощность и эффективность ударных действий.',
  },
  {
    id: 'physicalFitness',
    nameRu: 'Физическая и специальная физическая подготовленность',
    description: 'Анаэробная производительность, скоростно-силовые и выносливостные показатели СФП.',
  },
  {
    id: 'physiology',
    nameRu: 'Физиологические показатели',
    description: 'Аэробная производительность, кардиореспираторные показатели.',
  },
  {
    id: 'psychomotor',
    nameRu: 'Психомоторные и перцептивные способности',
    description: 'Время реакции, дифференцирование усилий, свойства нервной системы.',
  },
  {
    id: 'competition',
    nameRu: 'Соревновательная деятельность',
    description: 'Показатели, рассчитываемые по протоколу боя: плотность, КЭУ, КВ, точность.',
  },
  {
    id: 'trainingLoad',
    nameRu: 'Тренировочная нагрузка, восстановление и адаптация',
    description: 'Объёмы и интенсивность нагрузки, показатели восстановления. Пока показателей нет — категория зарезервирована.',
  },
];

// ---------------------------------------------------------------------------
// 2.1 Документированные правила возрастных групп
// ---------------------------------------------------------------------------

/**
 * Возрастная группа определяется ТОЛЬКО по этим правилам из фактического
 * возраста (полных лет). Спортивная квалификация из возраста не выводится.
 * Группы соответствуют значениям cohort.ageGroup референтных моделей.
 * Границы соответствуют возрастным этапам подготовки из boxingStandards.js
 * (minAge: СС — 14, ВСМ — 17); для спортсменов младше 17 лет референтных
 * когорт в текущей базе нет.
 */
export const AGE_GROUP_RULES = [
  { minAge: 19, maxAge: null, ageGroup: 'Взрослые (ЭВСМ)' },
  { minAge: 17, maxAge: 18, ageGroup: 'Юниоры (17–18 лет)' },
];

// ---------------------------------------------------------------------------
// 3. Каталог показателей
// ---------------------------------------------------------------------------

/**
 * Схема записи показателя:
 * {
 *   id:                  стабильный ID; совпадает с ключами, уже используемыми
 *                        в приложении (PhysTestView, BoxDataView, researchDatabase);
 *   name:                каноническое название (латиница);
 *   nameRu:              название на русском;
 *   category:            id из METRIC_CATEGORIES;
 *   definition:          научное определение показателя;
 *   protocol:            операционное определение / протокол измерения;
 *                        null — если протокол в имеющихся источниках не указан;
 *   unit:                единица измерения; null для безразмерных/качественных;
 *   direction:           'higher_better' | 'lower_better' | 'optimal_range' | 'none';
 *   validation:          { type: 'number', min, max, required } — границы для
 *                        отлова ошибок ввода (НЕ нормативы), либо
 *                        { type: 'enum', values: [...] } для качественных;
 *   missingData:         'report_missing' — сообщить об отсутствии (по умолчанию)
 *                        | 'exclude' — исключить из расчётов.
 *                        Подстановка нулей запрещена всегда;
 *   formula:             формула для расчётных показателей, иначе null;
 *   derivedFrom:         ID показателей-аргументов для расчётных, иначе null;
 *   interpretationLimits: ограничения интерпретации;
 *   dataStatus:          статус из DATA_QUALITY_STATUSES.
 * }
 */
export const METRICS_CATALOG = [
  // --- Антропометрия и морфология (поля формы PhysTestView) ---
  {
    id: 'weight',
    name: 'Body mass',
    nameRu: 'Масса тела',
    category: 'anthropometry',
    definition: 'Общая масса тела спортсмена.',
    protocol: null,
    unit: 'кг',
    direction: 'none',
    validation: { type: 'number', min: 20, max: 200, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Интерпретируется только относительно весовой категории спортсмена; ' +
      'абсолютное значение без контекста категории не информативно.',
    dataStatus: 'unverified',
  },
  {
    id: 'smm',
    name: 'Skeletal muscle mass',
    nameRu: 'Масса скелетной мускулатуры',
    category: 'anthropometry',
    definition: 'Масса скелетных мышц по данным биоимпедансометрии.',
    protocol: 'Биоимпедансный анализ (аппарат типа InBody).',
    unit: 'кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 10, max: 70, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Значения зависят от модели анализатора и протокола; сопоставимы только ' +
      'результаты, полученные на сопоставимом оборудовании. Оценка «выше — лучше» ' +
      'справедлива лишь в пределах весовой категории.',
    dataStatus: 'unverified',
  },
  {
    id: 'inbodyScore',
    name: 'InBody score',
    nameRu: 'Оценка InBody',
    category: 'anthropometry',
    definition: 'Интегральная оценка состава тела по шкале анализатора InBody.',
    protocol: 'Автоматический расчёт аппаратом InBody.',
    unit: 'усл. ед.',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 100, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Проприетарная шкала производителя; не является самостоятельным научным ' +
      'показателем и не сопоставима с данными других анализаторов.',
    dataStatus: 'unverified',
  },
  {
    id: 'phaseAngle',
    name: 'Phase angle',
    nameRu: 'Фазовый угол',
    category: 'anthropometry',
    definition: 'Фазовый угол биоимпеданса — маркер целостности клеточных мембран и клеточной массы.',
    protocol: 'Биоимпедансный анализ на частоте 50 кГц.',
    unit: 'градусы',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 15, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Зависит от частоты измерения и оборудования; референтные значения ' +
      'различаются между популяциями.',
    dataStatus: 'unverified',
  },
  {
    id: 'bodyFat',
    name: 'Body fat percentage',
    nameRu: 'Процент жира в теле',
    category: 'anthropometry',
    definition: 'Доля жировой массы в общей массе тела.',
    protocol: 'Биоимпедансный анализ.',
    unit: '%',
    direction: 'optimal_range',
    validation: { type: 'number', min: 2, max: 60, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Биоимпеданс даёт косвенную оценку; сопоставимость с калиперометрией и ' +
      'DEXA ограничена. Оптимум зависит от весовой категории.',
    dataStatus: 'unverified',
  },
  {
    id: 'ecwTbw',
    name: 'ECW/TBW ratio',
    nameRu: 'Соотношение ВКЖ/ОКЖ',
    category: 'anthropometry',
    definition: 'Отношение внеклеточной жидкости к общей жидкости организма.',
    protocol: 'Многочастотный биоимпедансный анализ.',
    unit: 'усл. ед.',
    direction: 'lower_better',
    validation: { type: 'number', min: 0.3, max: 0.5, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Повышенные значения могут отражать отёчность или воспаление; ' +
      'интерпретация только в динамике конкретного спортсмена.',
    dataStatus: 'unverified',
  },

  // --- Анаэробная производительность (physicalFitness) ---
  {
    id: 'relPower',
    name: 'Relative peak power',
    nameRu: 'Удельная мощность',
    category: 'physicalFitness',
    definition: 'Пиковая анаэробная мощность, отнесённая к массе тела.',
    protocol: null,
    unit: 'Вт/кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 30, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Зависит от протокола теста (длительность, эргометр); значения из ' +
      'разных протоколов несопоставимы.',
    dataStatus: 'unverified',
  },
  {
    id: 'avgPower',
    name: 'Average power',
    nameRu: 'Средний показатель мощности',
    category: 'physicalFitness',
    definition: 'Средняя мощность за время анаэробного теста.',
    protocol: null,
    unit: 'Вт',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 3000, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Сопоставимость ограничена протоколом теста и массой тела спортсмена.',
    dataStatus: 'unverified',
  },
  {
    id: 'timeMaxSpeed',
    name: 'Time to max speed',
    nameRu: 'Время достижения макс. скорости',
    category: 'physicalFitness',
    definition: 'Время от старта теста до достижения максимальной скорости.',
    protocol: null,
    unit: 'сек',
    direction: 'lower_better',
    validation: { type: 'number', min: 0, max: 30, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Показатель зависит от протокола и эргометра.',
    dataStatus: 'unverified',
  },
  {
    id: 'timePeakPower',
    name: 'Time to peak power',
    nameRu: 'Время достижения пиковой мощности',
    category: 'physicalFitness',
    definition: 'Время от старта теста до достижения пиковой мощности.',
    protocol: null,
    unit: 'сек',
    direction: 'lower_better',
    validation: { type: 'number', min: 0, max: 30, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Показатель зависит от протокола и эргометра.',
    dataStatus: 'unverified',
  },
  {
    id: 'maxRpm',
    name: 'Max cadence',
    nameRu: 'Максимальный скоростной режим',
    category: 'physicalFitness',
    definition: 'Максимальная частота вращения педалей в анаэробном тесте.',
    protocol: null,
    unit: 'об/мин',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 300, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Применимо только при велоэргометрическом протоколе.',
    dataStatus: 'unverified',
  },
  {
    id: 'fatigueIndex',
    name: 'Fatigue index',
    nameRu: 'Индекс утомления',
    category: 'physicalFitness',
    definition: 'Относительное снижение мощности к концу анаэробного теста.',
    protocol: null,
    unit: '%',
    direction: 'lower_better',
    validation: { type: 'number', min: 0, max: 100, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Формула расчёта варьирует между протоколами; требуется фиксация методики.',
    dataStatus: 'unverified',
  },

  // --- Аэробная производительность (physiology) ---
  {
    id: 'vo2maxAbs',
    name: 'Absolute VO2max',
    nameRu: 'МПК абсолютное',
    category: 'physiology',
    definition: 'Максимальное потребление кислорода в абсолютных единицах.',
    protocol: null,
    unit: 'л/мин',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 8, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Прямая газоаналитика и расчётные методы дают несопоставимые значения; ' +
      'требуется указание метода.',
    dataStatus: 'unverified',
  },
  {
    id: 'vo2maxRel',
    name: 'Relative VO2max',
    nameRu: 'Относительное МПК',
    category: 'physiology',
    definition: 'Максимальное потребление кислорода на килограмм массы тела.',
    protocol: null,
    unit: 'мл/мин/кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 10, max: 90, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Сопоставимость ограничена методом измерения (прямой/косвенный) и ' +
      'характеристиками референтной когорты.',
    dataStatus: 'unverified',
  },
  {
    id: 'aerobicThreshold',
    name: 'Aerobic threshold',
    nameRu: 'Аэробный порог',
    category: 'physiology',
    definition: 'Уровень потребления кислорода на аэробном пороге.',
    protocol: null,
    unit: 'мл/мин/кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 90, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Метод определения порога (вентиляционный/лактатный) должен быть указан.',
    dataStatus: 'unverified',
  },
  {
    id: 'maxVentilation',
    name: 'Maximal ventilation',
    nameRu: 'Максимальная вентиляция',
    category: 'physiology',
    definition: 'Максимальная лёгочная вентиляция при предельной нагрузке.',
    protocol: null,
    unit: 'л/мин',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 250, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Зависит от протокола нагрузочного теста.',
    dataStatus: 'unverified',
  },
  {
    id: 'tidalVolume',
    name: 'Tidal volume',
    nameRu: 'Дыхательный объём',
    category: 'physiology',
    definition: 'Объём воздуха за один дыхательный цикл.',
    protocol: null,
    unit: 'л',
    direction: 'none',
    validation: { type: 'number', min: 0, max: 8, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Без указания условий измерения (покой/нагрузка) показатель не интерпретируется.',
    dataStatus: 'unverified',
  },
  {
    id: 'respExchangeRatio',
    name: 'Respiratory exchange ratio',
    nameRu: 'Дыхательный коэффициент',
    category: 'physiology',
    definition: 'Отношение выделенного CO2 к потреблённому O2.',
    protocol: null,
    unit: 'усл. ед.',
    direction: 'none',
    validation: { type: 'number', min: 0.5, max: 1.5, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Значение зависит от фазы нагрузки; само по себе не является показателем ' +
      'подготовленности — используется как критерий достижения предельной нагрузки.',
    dataStatus: 'unverified',
  },

  // --- Специальная физическая подготовленность (punchBiomechanics / physicalFitness) ---
  {
    id: 'leftPunch',
    name: 'Left punch force',
    nameRu: 'Сила удара левой рукой',
    category: 'punchBiomechanics',
    definition: 'Пиковая сила прямого удара левой рукой.',
    protocol: null,
    unit: 'кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 1500, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Значения зависят от измерительного устройства (динамометр, акселерометр) ' +
      'и не сопоставимы между разными системами.',
    dataStatus: 'unverified',
  },
  {
    id: 'rightPunch',
    name: 'Right punch force',
    nameRu: 'Сила удара правой рукой',
    category: 'punchBiomechanics',
    definition: 'Пиковая сила прямого удара правой рукой.',
    protocol: null,
    unit: 'кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 1500, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'См. ограничения для leftPunch.',
    dataStatus: 'unverified',
  },
  {
    id: 'tonnage10s',
    name: '10-second punch tonnage',
    nameRu: 'Скоростно-силовая выносливость (тоннаж за 10 сек)',
    category: 'physicalFitness',
    definition: 'Суммарный «тоннаж» ударов по измерителю за 10 секунд.',
    protocol: null,
    unit: 'кг',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 5000, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Авторский тест; сопоставимость ограничена конкретным оборудованием и протоколом.',
    dataStatus: 'unverified',
  },
  {
    id: 'punches10s',
    name: 'Punches per 10 seconds',
    nameRu: 'Количество ударов за 10 сек',
    category: 'physicalFitness',
    definition: 'Число ударов, нанесённых за 10 секунд максимального темпа.',
    protocol: null,
    unit: 'ударов',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 150, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Зависит от того, засчитываются ли только акцентированные удары.',
    dataStatus: 'unverified',
  },
  {
    id: 'punches3min',
    name: 'Punches per 3 minutes',
    nameRu: 'Количество ударов за 3 мин',
    category: 'physicalFitness',
    definition: 'Число ударов, нанесённых за 3 минуты работы (модель раунда).',
    protocol: null,
    unit: 'ударов',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 600, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Условия теста (мешок/лапы/спарринг) существенно влияют на результат.',
    dataStatus: 'unverified',
  },

  // --- Психомоторика ---
  {
    id: 'nsType',
    name: 'Nervous system type (tapping test)',
    nameRu: 'Тип нервной системы (теппинг-тест)',
    category: 'psychomotor',
    definition: 'Сила нервной системы по результатам теппинг-теста.',
    protocol: 'Теппинг-тест (двигательный тест Ильина).',
    unit: null,
    direction: 'none',
    validation: {
      type: 'enum',
      values: ['Сильный (средне-сильный)', 'Слабый (средне-слабый)'],
      required: false,
    },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Качественная классификация; не является количественным показателем, ' +
      'z-оценки неприменимы.',
    dataStatus: 'unverified',
  },
  {
    id: 'reactionTime',
    name: 'Simple reaction time',
    nameRu: 'Время простой реакции',
    category: 'psychomotor',
    definition: 'Латентный период простой двигательной реакции на стимул.',
    protocol: null,
    unit: 'мс',
    direction: 'lower_better',
    validation: { type: 'number', min: 50, max: 1000, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits:
      'Зависит от типа стимула (свет/звук) и устройства; значения разных ' +
      'протоколов несопоставимы.',
    dataStatus: 'unverified',
  },
  {
    id: 'diffError',
    name: 'Force differentiation error',
    nameRu: 'Ошибка дифференцирования усилия',
    category: 'psychomotor',
    definition: 'Относительная ошибка воспроизведения заданного мышечного усилия.',
    protocol: null,
    unit: '%',
    direction: 'lower_better',
    validation: { type: 'number', min: 0, max: 50, required: false },
    missingData: 'report_missing',
    formula: null,
    derivedFrom: null,
    interpretationLimits: 'Требуется фиксация эталонного усилия и оборудования.',
    dataStatus: 'unverified',
  },

  // --- Соревновательная деятельность (расчётные показатели BoxDataView) ---
  {
    id: 'density',
    name: 'Bout density',
    nameRu: 'Плотность боя',
    category: 'competition',
    definition: 'Моторная активность боксёра: число ударов в единицу времени боя.',
    protocol: null,
    unit: 'уд/мин',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 60, required: false },
    missingData: 'report_missing',
    formula: 'Плотность = Всего ударов / Общее время боя (мин)',
    derivedFrom: ['totalPunches'],
    interpretationLimits:
      'Зависит от числа и длительности раундов; сопоставление между форматами ' +
      'боёв (3×3 мин, 5×2 мин и т.п.) требует осторожности.',
    dataStatus: 'unverified',
  },
  {
    id: 'keu',
    name: 'Punch efficiency coefficient',
    nameRu: 'Коэффициент эффективности ударов (КЭУ)',
    category: 'competition',
    definition: 'Доля ударов, достигших цели, от общего числа ударов.',
    protocol: null,
    unit: 'усл. ед.',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 1, required: false },
    missingData: 'report_missing',
    formula: 'КЭУ = Удары в цель / Всего ударов',
    derivedFrom: ['targetPunches', 'totalPunches'],
    interpretationLimits:
      'Зависит от критерия засчитывания удара «в цель»; не сопоставим между ' +
      'системами подсчёта с разными критериями.',
    dataStatus: 'unverified',
  },
  {
    id: 'kv',
    name: 'Endurance coefficient',
    nameRu: 'Коэффициент выносливости (КВ)',
    category: 'competition',
    definition: 'Устойчивость активности: отношение активности 1-го раунда к финальному.',
    protocol: null,
    unit: 'усл. ед.',
    direction: 'optimal_range',
    validation: { type: 'number', min: 0, max: 5, required: false },
    missingData: 'report_missing',
    formula: 'КВ = Активность в 1-м раунде / Активность в финальном раунде',
    derivedFrom: ['firstRoundTarget', 'lastRoundTarget'],
    interpretationLimits:
      'Интерпретация «ближе к 1.00 — лучше» является авторской гипотезой, а не ' +
      'валидированным нормативом.',
    dataStatus: 'unverified',
  },
  {
    id: 'jabsAcc',
    name: 'Jab accuracy',
    nameRu: 'Точность джебов',
    category: 'competition',
    definition: 'Доля джебов, достигших цели.',
    protocol: null,
    unit: '%',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 100, required: false },
    missingData: 'report_missing',
    formula: 'Точность джебов = Джебы в цель / Всего джебов × 100',
    derivedFrom: null,
    interpretationLimits: 'Зависит от критериев подсчёта ударов в цель.',
    dataStatus: 'unverified',
  },
  {
    id: 'powerAcc',
    name: 'Power punch accuracy',
    nameRu: 'Точность силовых ударов',
    category: 'competition',
    definition: 'Доля силовых ударов, достигших цели.',
    protocol: null,
    unit: '%',
    direction: 'higher_better',
    validation: { type: 'number', min: 0, max: 100, required: false },
    missingData: 'report_missing',
    formula: 'Точность силовых = Силовые в цель / Всего силовых × 100',
    derivedFrom: null,
    interpretationLimits: 'Зависит от критериев подсчёта ударов в цель.',
    dataStatus: 'unverified',
  },
];

// ---------------------------------------------------------------------------
// 4. Схема референтной модели
// ---------------------------------------------------------------------------

/**
 * Структура записи референтной модели (REFERENCE_MODELS):
 * {
 *   id:             стабильный ID модели;
 *   sourceRef:      ID записи в src/data/researchDatabase.js (RESEARCH_DATABASE)
 *                   или null для моделей без записи в базе исследований;
 *   sourceLocation: где фактически хранятся числа ('researchDatabase' |
 *                   'inline:BoxDataView.jsx' | ...);
 *   cohort: {
 *     sex:            'male' | 'female' | null (неизвестно);
 *     ageGroup:       строка из источника или null;
 *     qualification:  строка из источника или null;
 *     weightCategory: строка из источника или null;
 *   };
 *   sampleSize:     размер выборки; null — если в источнике не указан;
 *   protocol:       протокол и условия измерения; null — если неизвестны;
 *   statistics:     какие статистики реально представлены в источнике:
 *                   { mean: bool, sd: bool, percentiles: bool, range: bool };
 *   coversMetrics:  ID показателей из METRICS_CATALOG, покрываемые моделью;
 *   applicabilityLimits: ограничения применимости (когорта, протокол, формат);
 *   modelKind:      'descriptive_study_result'   — описательный результат
 *                                                 отдельного исследования;
 *                   'validated_reference_model'  — валидированная референтная
 *                                                 модель (требует доказательств);
 *                   'official_standard'          — официальный спортивный
 *                                                 норматив;
 *                   'author_hypothesis'          — авторская гипотеза/эвристика;
 *   dataStatus:     статус из DATA_QUALITY_STATUSES.
 * }
 *
 * Отсутствие sd (statistics.sd === false или sd = null в источнике) делает
 * расчёт z-score недопустимым — см. isZScoreAllowed().
 */

// ---------------------------------------------------------------------------
// 5. Референтные модели на основе существующей базы исследований
// ---------------------------------------------------------------------------

/**
 * Модели адаптированы из записей RESEARCH_DATABASE (src/data/researchDatabase.js).
 * Числовые mean/sd здесь НЕ дублируются — они читаются из записи источника
 * по sourceRef. Все записи сохранены со статусом 'unverified': ни цитирования,
 * ни числа на данном этапе не верифицированы, и достоверность не повышается.
 * Все модели — описательные результаты отдельных исследований, а не
 * валидированные референтные нормативы.
 */
export const REFERENCE_MODELS = [
  {
    id: 'model_vniifk_2022_msmk_mid',
    sourceRef: 'vniifk_2022_msmk_mid',
    sourceLocation: 'researchDatabase',
    cohort: {
      sex: null,
      ageGroup: 'Взрослые (ЭВСМ)',
      qualification: 'МСМК / Сборная РФ',
      weightCategory: 'Средний вес (63.5–75 кг)',
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: true, sd: true, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'vo2maxRel', 'relPower', 'reactionTime'],
    /**
     * Критерий допуска к научному сравнению. Допуск требует выполнения ВСЕХ
     * условий: происхождение чисел установлено (valuesProvenanceVerified),
     * задокументированы протокол и размер выборки, статус данных —
     * verified_fulltext или verified_primary. До выполнения условий числовые
     * значения модели не используются для нормативных отклонений и
     * автоматических рекомендаций — только как исследовательский результат
     * с явной пометкой.
     */
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Сверка числовых значений с полным текстом первоисточника',
        'Документирование протокола измерения каждого показателя',
        'Указание размера и состава выборки',
        'Подтверждение единиц измерения и оборудования',
      ],
      valuesProvenanceVerified: false,
      note:
        'Источник указан, но данные не сверены; допуск к сравнению не предоставлен.',
    },
    applicabilityLimits:
      'Когорта ограничена средним весом и высшей квалификацией; экстраполяция ' +
      'на другие весовые категории и разряды недопустима.',
    modelKind: 'descriptive_study_result',
    dataStatus: 'unverified',
  },
  {
    id: 'model_filimonov_2000_ms_mid',
    sourceRef: 'filimonov_2000_ms_mid',
    sourceLocation: 'researchDatabase',
    cohort: {
      sex: null,
      ageGroup: 'Взрослые (ЭВСМ)',
      qualification: 'МС / КМС',
      weightCategory: 'Средний вес (63.5–75 кг)',
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: true, sd: true, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'vo2maxRel', 'relPower', 'reactionTime'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Установление природы приведённых значений (эмпирические средние или авторские модельные ориентиры)',
        'Сверка числовых значений с полным текстом первоисточника',
        'Документирование протокола измерения каждого показателя',
        'Указание размера и состава выборки',
      ],
      valuesProvenanceVerified: false,
      note:
        'Данные из методического пособия; происхождение чисел не установлено, допуск к сравнению не предоставлен.',
    },
    applicabilityLimits:
      'Данные из методического пособия; неизвестно, являются ли приведённые ' +
      'значения эмпирическими средними или модельными ориентирами автора.',
    modelKind: 'descriptive_study_result',
    dataStatus: 'unverified',
  },
  {
    id: 'model_taymazov_1997_juniors',
    sourceRef: 'taymazov_1997_juniors',
    sourceLocation: 'researchDatabase',
    cohort: {
      sex: null,
      ageGroup: 'Юниоры (17–18 лет)',
      qualification: '1-й разряд / КМС',
      weightCategory: 'Все категории',
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: true, sd: true, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'vo2maxRel', 'relPower', 'reactionTime'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Сверка числовых значений с полным текстом первоисточника',
        'Документирование протокола измерения каждого показателя',
        'Указание размера и состава выборки',
        'Подтверждение единиц измерения и оборудования',
      ],
      valuesProvenanceVerified: false,
      note:
        'Источник указан, но данные не сверены; допуск к сравнению не предоставлен.',
    },
    applicabilityLimits:
      'Когорта юниоров всех весовых категорий; не применима к взрослым ' +
      'высококвалифицированным боксёрам.',
    modelKind: 'descriptive_study_result',
    dataStatus: 'unverified',
  },
  {
    id: 'model_sharomov_2025_chm',
    sourceRef: 'sharomov_2025_chm',
    sourceLocation: 'researchDatabase',
    cohort: {
      sex: null,
      ageGroup: 'Взрослые (ЭВСМ)',
      qualification: 'МСМК / Сборная РФ',
      weightCategory: 'Все категории (ЧМ-2025)',
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: true, sd: true, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'vo2maxRel', 'relPower', 'reactionTime'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Сверка числовых значений с полным текстом первоисточника',
        'Документирование протокола анализа боёв (критерии подсчёта ударов)',
        'Указание размера выборки боёв и боксёров',
        'Подтверждение единиц измерения',
      ],
      valuesProvenanceVerified: false,
      note:
        'Анализ одного турнира; данные не сверены с первоисточником, допуск к сравнению не предоставлен.',
    },
    applicabilityLimits:
      'Анализ одного турнира (ЧМ-2025); результаты отражают конкретную выборку ' +
      'боёв и не являются универсальным нормативом.',
    modelKind: 'descriptive_study_result',
    dataStatus: 'unverified',
  },
];

/**
 * Модели, жёстко зашитые в src/components/BoxDataView.jsx (QUALIFICATION_MODELS).
 * Числа остаются в компоненте; здесь фиксируются только метаданные и статус,
 * чтобы будущий анализатор мог учитывать их происхождение при миграции.
 * Происхождение порогов не подтверждено источником → author_hypothesis.
 */
export const QUALIFICATION_MODELS_MAP = [
  {
    id: 'qual_model_msmk',
    sourceRef: null,
    sourceLocation: 'inline:BoxDataView.jsx',
    cohort: {
      sex: null,
      ageGroup: null,
      qualification: 'МСМК / Сборная',
      weightCategory: null,
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: false, sd: false, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Документирование научного источника пороговых значений',
        'Наличие статистик распределения (mean, sd) из сопоставимой когорты',
      ],
      valuesProvenanceVerified: false,
      note:
        'Авторские точечные пороги без источника и статистик; допуск к сравнению не предоставлен.',
    },
    applicabilityLimits:
      'Точечные значения без статистик распределения; z-score и интервальные ' +
      'оценки невозможны.',
    modelKind: 'author_hypothesis',
    dataStatus: 'unverified',
  },
  {
    id: 'qual_model_ms',
    sourceRef: null,
    sourceLocation: 'inline:BoxDataView.jsx',
    cohort: {
      sex: null,
      ageGroup: null,
      qualification: 'МС / КМС',
      weightCategory: null,
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: false, sd: false, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Документирование научного источника пороговых значений',
        'Наличие статистик распределения (mean, sd) из сопоставимой когорты',
      ],
      valuesProvenanceVerified: false,
      note:
        'Авторские точечные пороги без источника и статистик; допуск к сравнению не предоставлен.',
    },
    applicabilityLimits: 'См. qual_model_msmk.',
    modelKind: 'author_hypothesis',
    dataStatus: 'unverified',
  },
  {
    id: 'qual_model_first_rank',
    sourceRef: null,
    sourceLocation: 'inline:BoxDataView.jsx',
    cohort: {
      sex: null,
      ageGroup: null,
      qualification: '1-й разряд / Юниоры',
      weightCategory: null,
    },
    sampleSize: null,
    protocol: null,
    statistics: { mean: false, sd: false, percentiles: false, range: false },
    coversMetrics: ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc'],
    admission: {
      eligibleForComparison: false,
      requiredConditions: [
        'Документирование научного источника пороговых значений',
        'Наличие статистик распределения (mean, sd) из сопоставимой когорты',
      ],
      valuesProvenanceVerified: false,
      note:
        'Авторские точечные пороги без источника и статистик; допуск к сравнению не предоставлен.',
    },
    applicabilityLimits: 'См. qual_model_msmk.',
    modelKind: 'author_hypothesis',
    dataStatus: 'unverified',
  },
];

// ---------------------------------------------------------------------------
// 6. Сопоставимость измерений
// ---------------------------------------------------------------------------

// Условия допуска (ADMISSION_CONDITIONS) и допустимые статусы
// (ADMISSIBLE_STATUSES) определены в userResearchStore.js и реэкспортированы
// здесь для единой точки доступа к контракту данных.
export { ADMISSION_CONDITIONS, ADMISSIBLE_STATUSES };

/**
 * Конвертирует пользовательскую запись из userResearchStore в формат
 * референтной модели. Допуск к сравнению (eligibleForComparison) возможен
 * только при выполнении ВСЕХ условий допуска И статусе verified_fulltext /
 * verified_primary; статусы abstract_only, secondary_source, provisional,
 * unverified допуска не дают независимо от отметок.
 */
export function userEntryToModel(entry) {
  const metrics = entry.metrics || {};
  const coversMetrics = Object.keys(metrics).filter(
    (id) => metrics[id] && typeof metrics[id].mean === 'number',
  );
  const allConditions = Array.isArray(entry.admissionConditions)
    && entry.admissionConditions.length === 4
    && entry.admissionConditions.every(Boolean);
  const admissibleStatus = ADMISSIBLE_STATUSES.includes(entry.dataStatus);

  return {
    id: `model_${entry.id}`,
    sourceRef: entry.id,
    sourceLocation: 'user',
    cohort: {
      sex: entry.sex ?? null,
      ageGroup: entry.group ?? null,
      qualification: entry.qualification ?? null,
      weightCategory: entry.weightCategory ?? null,
    },
    sampleSize: entry.sampleSize ?? null,
    protocol: entry.protocol ?? null,
    statistics: {
      mean: coversMetrics.length > 0,
      sd: coversMetrics.some((id) => typeof metrics[id].sd === 'number' && metrics[id].sd > 0),
      percentiles: false,
      range: false,
    },
    coversMetrics,
    admission: {
      eligibleForComparison: allConditions && admissibleStatus,
      requiredConditions: [...ADMISSION_CONDITIONS],
      valuesProvenanceVerified: admissibleStatus,
      note: allConditions && admissibleStatus
        ? 'Условия допуска отмечены пользователем как выполненные.'
        : 'Условия допуска не выполнены или статус не верифицирован.',
    },
    applicabilityLimits:
      'Пользовательская запись: применимость определяется указанной когортой и протоколом.',
    modelKind: 'descriptive_study_result',
    dataStatus: entry.dataStatus || 'unverified',
  };
}

/** Все референтные модели: встроенные + конвертированные пользовательские. */
export function getAllReferenceModels() {
  return REFERENCE_MODELS.concat(loadUserResearch().map(userEntryToModel));
}

/**
 * Уровни сопоставимости модели с конкретным спортсменом:
 *  - 'full'        — полная сопоставимость: все обязательные характеристики
 *                    совпадают или явно не ограничены моделью;
 *  - 'limited'     — ограниченная сопоставимость: нормативная интерпретация
 *                    запрещена, допустим только исследовательский результат
 *                    с явной пометкой неопределённости;
 *  - 'incompatible'— несовместимость: сравнение не выполняется;
 *  - 'insufficient_data' — недостаточность данных: критичная характеристика
 *                    спортсмена отсутствует, совместимость неустановлена.
 * Значение null у спортсмена НЕ считается совпадением. Если модель не
 * ограничена характеристикой, это явно отражено в её метаданных
 * (null или значение вида «Все категории…»).
 */
export const COMPARABILITY_LEVELS = {
  full: 'Полная сопоставимость',
  limited: 'Ограниченная сопоставимость',
  incompatible: 'Несовместимость',
  insufficient_data: 'Недостаточность данных',
};

/** Сообщение при отсутствии пригодных референтных данных. */
export const INSUFFICIENT_DATA_MESSAGE = 'Недостаточно сопоставимых научных данных';

/**
 * Правила проверки совместимости показателя спортсмена с референтной моделью.
 * Анализатор обязан применять их до любого числового сравнения.
 */
export const COMPARABILITY_RULES = {
  /**
   * Поля, по которым проверяется совместимость.
   * unitMismatch / protocolMismatch / cohortMismatch → модель отклоняется.
   */
  fields: ['unit', 'protocol', 'equipment', 'cohort.sex', 'cohort.ageGroup', 'cohort.qualification', 'cohort.weightCategory'],
  rules: {
    unitMismatch:
      'Несовпадение единиц измерения → модель несовместима (incompatible).',
    protocolMismatch:
      'Разные протоколы или оборудование → модель несовместима. Если протокол ' +
      'одной из сторон неизвестен (null), совместимость считается ' +
      'неустановленной → недостаточность данных.',
    cohortMismatch:
      'Несовпадение заданных у обеих сторон характеристик когорты (пол, ' +
      'возрастная группа, квалификация, весовая категория) → несовместимость. ' +
      'Отсутствие у спортсмена характеристики, заданной у модели, → ' +
      'недостаточность данных, а не совпадение. Характеристика, не заданная ' +
      'у модели (null или «Все категории…»), совместимость не ограничивает.',
    admissionRequired:
      'Нормативная интерпретация (z-score как сравнительное отклонение) ' +
      'допускается только для моделей с admission.eligibleForComparison = true. ' +
      'Статус публикации (включая verified_fulltext) сам по себе допуска не даёт.',
    missingSd:
      'Отсутствует пригодное стандартное отклонение (sd ≤ 0, не число, не конечно) ' +
      '→ z-score не рассчитывается; допускается только качественное сравнение ' +
      'со средним с оговоркой.',
    missingMean:
      'Отсутствует среднее значение → числовое сравнение не выполняется.',
    noAggregation:
      'z-оценки разных референтных моделей не усредняются и не объединяются ' +
      'автоматически: объединение допустимо только при статистическом обосновании.',
    insufficientData:
      'Если ни одна модель не прошла проверку совместимости, результат — ' +
      '«' + INSUFFICIENT_DATA_MESSAGE + '», а не числовая оценка.',
  },
};

// ---------------------------------------------------------------------------
// 7. Селекторы (чистые функции для будущего fullAnalyzer.js)
// ---------------------------------------------------------------------------

/** Показатель по ID или null. */
export function getMetricById(id) {
  return METRICS_CATALOG.find((m) => m.id === id) || null;
}

/** Все показатели категории. */
export function getMetricsByCategory(categoryId) {
  return METRICS_CATALOG.filter((m) => m.category === categoryId);
}

/** Характеристика модели считается не заданной (не ограничивает совместимость). */
function isModelFieldUnset(value) {
  return value == null || (typeof value === 'string' && value.startsWith('Все категории'));
}

/**
 * Оценка совместимости одной модели с когортой спортсмена по одному показателю.
 *
 * @returns {{
 *   level: 'full'|'limited'|'incompatible'|'insufficient_data',
 *   issues: string[]
 * }}
 */
export function assessModelCompatibility(model, metricId, cohort = {}) {
  const issues = [];
  const metric = getMetricById(metricId);

  if (!model.coversMetrics.includes(metricId)) {
    return { level: 'incompatible', issues: ['Модель не покрывает данный показатель.'] };
  }

  // Единицы измерения (если известны обе стороны — обязаны совпадать)
  const modelUnit = model.unitOverrides?.[metricId] ?? metric?.unit ?? null;
  const athleteUnit = cohort.units?.[metricId] ?? null;
  if (modelUnit != null && athleteUnit != null && modelUnit !== athleteUnit) {
    return {
      level: 'incompatible',
      issues: [`Несовпадение единиц измерения: модель — ${modelUnit}, измерение — ${athleteUnit}.`],
    };
  }

  // Протокол и оборудование
  if (model.protocol == null) {
    if (metric?.protocol == null) {
      issues.push('Протокол измерения неизвестен у модели и у показателя — совместимость неустановлена.');
    } else {
      issues.push('Протокол измерения в референтной модели не документирован — совместимость неустановлена.');
    }
  } else if (cohort.protocol != null && cohort.protocol !== model.protocol) {
    return {
      level: 'incompatible',
      issues: ['Протокол обследования спортсмена не совпадает с протоколом модели.'],
    };
  } else if (cohort.protocol == null) {
    issues.push('Протокол обследования спортсмена не указан — совместимость по протоколу неустановлена.');
  }

  // Характеристики когорты: null у спортсмена — не совпадение, а недостаток данных
  let hasInsufficient = false;
  for (const f of ['sex', 'ageGroup', 'qualification', 'weightCategory']) {
    const modelVal = model.cohort[f];
    const athleteVal = cohort[f];
    if (isModelFieldUnset(modelVal)) continue;
    if (athleteVal == null) {
      hasInsufficient = true;
      issues.push(`Характеристика «${f}» задана у модели («${modelVal}»), но отсутствует у спортсмена.`);
      continue;
    }
    if (modelVal !== athleteVal) {
      return {
        level: 'incompatible',
        issues: [`Несовпадение характеристики «${f}»: модель — «${modelVal}», спортсмен — «${athleteVal}».`],
      };
    }
  }

  if (hasInsufficient) return { level: 'insufficient_data', issues };
  if (issues.length > 0) return { level: 'limited', issues };
  return { level: 'full', issues: [] };
}

/**
 * Референтные модели, покрывающие показатель и потенциально сопоставимые
 * с когортой спортсмена. Возвращает записи { ...model, compatibility },
 * отсортированные по убыванию уровня совместимости; несовместимые модели
 * исключаются. Нормативная интерпретация допустима только при
 * compatibility.level === 'full' И admission.eligibleForComparison === true.
 *
 * @param {string} metricId
 * @param {{ sex?: string|null, ageGroup?: string|null, qualification?: string|null, weightCategory?: string|null, protocol?: string|null, units?: object }} cohort
 */
export function getComparableModels(metricId, cohort = {}) {
  const rank = { full: 3, limited: 2, insufficient_data: 1, incompatible: 0 };
  return getAllReferenceModels().map((model) => ({
    ...model,
    compatibility: assessModelCompatibility(model, metricId, cohort),
  }))
    .filter((m) => m.compatibility.level !== 'incompatible')
    .sort((a, b) => rank[b.compatibility.level] - rank[a.compatibility.level]);
}

/**
 * Допустим ли расчёт z-score как сравнительного отклонения:
 *  - показатель количественный;
 *  - модель допущена к сравнению (admission.eligibleForComparison) —
 *    статус публикации сам по себе допуска не даёт;
 *  - заявлены mean и sd, фактические значения конечны, sd > 0;
 *  - статус данных — не демонстрационный.
 *
 * @param {string} metricId
 * @param {object} model — запись из REFERENCE_MODELS
 * @param {object|null} sourceStats — фактические статистики источника
 *        (например, RESEARCH_DATABASE[i].metrics[metricId]); если переданы,
 *        проверяется также наличие конечных mean/sd.
 */
export function isZScoreAllowed(metricId, model, sourceStats = null) {
  const metric = getMetricById(metricId);
  if (!metric || metric.validation.type !== 'number') return false;
  if (!model || !model.statistics.mean || !model.statistics.sd) return false;
  if (model.dataStatus === 'demo') return false;
  if (model.admission?.eligibleForComparison !== true) return false;
  if (sourceStats) {
    const { mean, sd } = sourceStats;
    if (typeof mean !== 'number' || typeof sd !== 'number' || !Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) {
      return false;
    }
  }
  return true;
}
