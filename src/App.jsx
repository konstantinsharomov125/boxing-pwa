import React, { useState, useEffect } from 'react';
import { Shield, Activity, Dumbbell, Brain, UserPlus, FileText, X, Users, Trash2, Plus, BookOpen, Library } from 'lucide-react';
import BoxDataView from './components/BoxDataView';
import PhysTestView from './components/PhysTestView';
import MatrixView from './components/MatrixView';
import ReportView from './components/ReportView';
import StandardsTab from './components/StandardsTab';
import ResearchDatabaseView from './components/ResearchDatabaseView';
import LongitudinalView from './components/LongitudinalView';

export default function App() {
  const [activeTab, setActiveTab] = useState('boxdata');

  // Список групп (по умолчанию "Все группы")
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('box_groups');
    return saved ? JSON.parse(saved) : ['Все группы'];
  });

  const [selectedGroup, setSelectedGroup] = useState('Все группы');

  // Список спортсменов
  const [athletes, setAthletes] = useState(() => {
    const saved = localStorage.getItem('box_athletes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [selectedAthlete, setSelectedAthlete] = useState(athletes[0] || null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Поля модального окна добавления спортсмена/группы
  const [athleteNameInput, setAthleteNameInput] = useState('');
  const [athleteAgeInput, setAthleteAgeInput] = useState('15'); // Возраст для ФССП нормативов
  const [athleteSexInput, setAthleteSexInput] = useState('');
  const [athleteQualInput, setAthleteQualInput] = useState('');
  const [athleteWeightCatInput, setAthleteWeightCatInput] = useState('');
  const [targetGroup, setTargetGroup] = useState('Все группы');
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');

  useEffect(() => {
    localStorage.setItem('box_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('box_athletes', JSON.stringify(athletes));
  }, [athletes]);

  // Фильтрация спортсменов по группе
  const filteredAthletes = selectedGroup === 'Все группы' 
    ? athletes 
    : athletes.filter(a => a.group === selectedGroup);

  useEffect(() => {
    if (filteredAthletes.length > 0) {
      if (!filteredAthletes.some(a => a.id === selectedAthlete?.id)) {
        setSelectedAthlete(filteredAthletes[0]);
      }
    } else {
      setSelectedAthlete(null);
    }
  }, [selectedGroup, filteredAthletes, selectedAthlete]);

  // Обработчик добавления группы/спортсмена
  const handleAddSubmit = (e) => {
    e.preventDefault();
    let finalGroup = targetGroup;

    if (isCreatingNewGroup && newGroupNameInput.trim()) {
      finalGroup = newGroupNameInput.trim();
      if (!groups.includes(finalGroup)) {
        setGroups([...groups, finalGroup]);
      }
    } else if (finalGroup === 'Все группы') {
      finalGroup = groups[1] || 'Основная группа';
      if (!groups.includes(finalGroup)) {
        setGroups([...groups, finalGroup]);
      }
    }

    if (!athleteNameInput.trim()) return;

    const newAthlete = {
      id: Date.now(),
      name: athleteNameInput.trim(),
      age: Number(athleteAgeInput) || 15, // Сохраняем возраст для нормативного модуля
      sex: athleteSexInput || null,
      qualification: athleteQualInput || null,
      weightCategory: athleteWeightCatInput.trim() || null,
      group: finalGroup,
      style: 'Темповик',
      weight: '67 кг',
    };

    const updated = [...athletes, newAthlete];
    setAthletes(updated);
    setSelectedAthlete(newAthlete);
    
    // Сброс полей
    setAthleteNameInput('');
    setAthleteAgeInput('15');
    setAthleteSexInput('');
    setAthleteQualInput('');
    setAthleteWeightCatInput('');
    setNewGroupNameInput('');
    setIsCreatingNewGroup(false);
    setIsAddModalOpen(false);
  };

  // Удаление спортсмена
  const handleDeleteAthlete = (id) => {
    if (window.confirm('Вы уверены, что хотите удалить спортсмена?')) {
      const updated = athletes.filter(a => a.id !== id);
      setAthletes(updated);
      if (selectedAthlete?.id === id) {
        setSelectedAthlete(updated[0] || null);
      }
    }
  };

  // Удаление группы
  const handleDeleteGroup = (groupName) => {
    if (groupName === 'Все группы') return;
    if (window.confirm(`Удалить группу "${groupName}"? Спортсмены этой группы перейдут в "Все группы".`)) {
      setGroups(groups.filter(g => g !== groupName));
      if (selectedGroup === groupName) {
        setSelectedGroup('Все группы');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Шапка приложения */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">BOX-PROFILE</h1>
          </div>
        </div>

        {/* Управление выбором и добавлением */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Фильтр по группе */}
          <div className="flex items-center space-x-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-700">
            <Users className="w-4 h-4 text-blue-400 ml-1" />
            <span className="text-xs text-slate-400 pl-1">Группа:</span>
            <select 
              className="bg-transparent text-xs focus:outline-none text-slate-200 cursor-pointer pr-1"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.map((g, idx) => (
                <option key={idx} value={g} className="bg-slate-800 text-white">{g}</option>
              ))}
            </select>

            {selectedGroup !== 'Все группы' && (
              <button 
                onClick={() => handleDeleteGroup(selectedGroup)}
                className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                title="Удалить выбранную группу"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Выбор спортсмена */}
          <div className="flex items-center space-x-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-700">
            <span className="text-xs text-slate-400 pl-1">Спортсмен:</span>
            <select 
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
              value={selectedAthlete ? selectedAthlete.id : ''}
              onChange={(e) => setSelectedAthlete(athletes.find(a => a.id == e.target.value))}
            >
              <option value="" disabled className="bg-slate-800 text-slate-400">Все спортсмены</option>
              {filteredAthletes.map(a => (
                <option key={a.id} value={a.id} className="bg-slate-800 text-white font-normal">
                  {a.name} ({a.age || 15} лет)
                </option>
              ))}
            </select>

            {selectedAthlete && (
              <button 
                onClick={() => handleDeleteAthlete(selectedAthlete.id)}
                className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                title="Удалить спортсмена"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Кнопка добавления */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
            title="Добавить спортсмена или группу"
          >
            <UserPlus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </div>
      </header>

      {/* Навигационное меню вкладок (включая новую вкладку стандартов) */}
      <nav className="bg-slate-800/60 border-b border-slate-700/50 px-6 flex space-x-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('boxdata')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'boxdata' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Activity className="w-4 h-4" />
          <span>1. Соревновательный профиль</span>
        </button>

        <button 
          onClick={() => setActiveTab('phys')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'phys' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>2. Морфофункциональный профиль</span>
        </button>

        <button 
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'matrix' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Brain className="w-4 h-4" />
          <span>3. Коррекция</span>
        </button>

        <button 
          onClick={() => setActiveTab('report')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'report' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <FileText className="w-4 h-4" />
          <span>4. Экспорт отчета</span>
        </button>

        {/* Новая вкладка Нормативы и стандарты */}
        <button 
          onClick={() => setActiveTab('standards')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'standards' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span>5. Нормативы и стандарты</span>
        </button>

        {/* Вкладка базы исследований */}
        <button 
          onClick={() => setActiveTab('research')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'research' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Library className="w-4 h-4 text-blue-400" />
          <span>6. База исследований</span>
        </button>
        <button onClick={() => setActiveTab('longitudinal')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'longitudinal' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <Activity className="w-4 h-4 text-blue-400" />
          <span>7. Динамика</span>
        </button>
      </nav>

      {/* Основная область */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'longitudinal' ? (
          selectedAthlete ? <LongitudinalView athlete={selectedAthlete} /> : null
        ) : activeTab === 'standards' ? (
          <StandardsTab />
        ) : activeTab === 'research' ? (
          <ResearchDatabaseView />
        ) : selectedAthlete ? (
          <>
            {activeTab === 'boxdata' && <BoxDataView athlete={selectedAthlete} />}
            {activeTab === 'phys' && <PhysTestView athlete={selectedAthlete} />}
            {activeTab === 'matrix' && <MatrixView athlete={selectedAthlete} />}
            {activeTab === 'report' && <ReportView athlete={selectedAthlete} />}
          </>
        ) : (
          <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 my-8">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300 mb-1">Нет выбранного спортсмена</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              В системе пока нет зарегистрированных спортсменов или они не выбраны. Нажмите кнопку «Добавить», чтобы занести данные.
            </p>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить спортсмена</span>
            </button>
          </div>
        )}
      </main>

      {/* Модальное окно: Добавление группы и спортсмена */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Добавление спортсмена
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Строка 1: Выбор или создание группы */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-300">Группа подготовки</label>
                  <button 
                    type="button"
                    onClick={() => setIsCreatingNewGroup(!isCreatingNewGroup)}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    {isCreatingNewGroup ? '← Выбрать из списка' : '+ Создать новую группу'}
                  </button>
                </div>

                {isCreatingNewGroup ? (
                  <input 
                    type="text"
                    required
                    placeholder="Название новой группы"
                    value={newGroupNameInput}
                    onChange={(e) => setNewGroupNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <select 
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    {groups.map((g, idx) => (
                      <option key={idx} value={g}>{g}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Строка 2: Ввод ФИО */}
              <div>
                <label className="block text-xs text-slate-300 mb-1">ФИО спортсмена</label>
                <input 
                  type="text" 
                  required
                  placeholder="например, Смирнов Артем"
                  value={athleteNameInput}
                  onChange={(e) => setAthleteNameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Строка 3: Возраст спортсмена (нужен для ФССП нормативов) */}
              <div>
                <label className="block text-xs text-slate-300 mb-1">Возраст (лет)</label>
                <input 
                  type="number" 
                  required
                  min="8"
                  max="45"
                  value={athleteAgeInput}
                  onChange={(e) => setAthleteAgeInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Строка 4: Данные когорты для научного анализатора (необязательные) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Пол</label>
                  <select
                    value={athleteSexInput}
                    onChange={(e) => setAthleteSexInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Не указан</option>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Квалификация</label>
                  <select
                    value={athleteQualInput}
                    onChange={(e) => setAthleteQualInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Не указана</option>
                    <option value="МСМК / Сборная РФ">МСМК / Сборная РФ</option>
                    <option value="МС / КМС">МС / КМС</option>
                    <option value="1-й разряд / КМС">1-й разряд / КМС</option>
                    <option value="Без разряда">Без разряда</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Весовая категория (официальная)</label>
                <input
                  type="text"
                  placeholder="например, Средний вес (63.5–75 кг)"
                  value={athleteWeightCatInput}
                  onChange={(e) => setAthleteWeightCatInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Эти поля используются анализатором для подбора сопоставимых референтных моделей. Если не указаны, сравнение с моделями будет ограничено.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm font-medium cursor-pointer">
                  Отмена
                </button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium cursor-pointer shadow-lg shadow-blue-500/30">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
