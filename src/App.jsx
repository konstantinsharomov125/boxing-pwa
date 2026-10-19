import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  Dumbbell, 
  Brain, 
  UserPlus, 
  FileText, 
  X, 
  Users, 
  Trash2, 
  Plus, 
  BookOpen, 
  Library,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import BoxDataView from './components/BoxDataView';
import PhysTestView from './components/PhysTestView';
import MatrixView from './components/MatrixView';
import ReportView from './components/ReportView';
import StandardsTab from './components/StandardsTab';
import ResearchDatabaseView from './components/ResearchDatabaseView';
import LongitudinalView from './components/LongitudinalView';
import { getQualificationOptions, normalizeAthleteQualification } from './data/qualifications.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('boxdata');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Список групп (по умолчанию "Все группы")
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('box_groups');
    return saved ? JSON.parse(saved) : ['Все группы'];
  });

  const [selectedGroup, setSelectedGroup] = useState('Все группы');

  // Список спортсменов
  const normalizeAthletes = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map((a) => ({
      ...a,
      qualification: normalizeAthleteQualification(a.qualification),
    }));
  };

  const [athletes, setAthletes] = useState(() => {
    const saved = localStorage.getItem('box_athletes');
    if (saved) {
      try { return normalizeAthletes(JSON.parse(saved)); } catch { /* ignore */ }
    }
    return [];
  });

  const [selectedAthlete, setSelectedAthlete] = useState(athletes[0] || null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Поля модального окна добавления спортсмена/группы
  const [athleteNameInput, setAthleteNameInput] = useState('');
  const [athleteAgeInput, setAthleteAgeInput] = useState('15');
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
      age: Number(athleteAgeInput) || 15,
      sex: athleteSexInput || null,
      qualification: normalizeAthleteQualification(athleteQualInput),
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

  const navItems = [
    { id: 'boxdata', label: '1. Соревновательный профиль', icon: Activity },
    { id: 'phys', label: '2. Морфофункциональный профиль', icon: Dumbbell },
    { id: 'matrix', label: '3. Коррекция', icon: Brain },
    { id: 'report', label: '4. Экспорт отчета', icon: FileText },
    { id: 'standards', label: '5. Нормативы и стандарты', icon: BookOpen },
    { id: 'research', label: '6. База исследований', icon: Library },
    { id: 'longitudinal', label: '7. Динамика', icon: Activity },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100 font-sans antialiased overflow-x-hidden">
      {/* Боковое навигационное меню (Sidebar) */}
      <aside 
        className={`bg-slate-800 border-r border-slate-700/80 flex flex-col transition-all duration-300 z-20 shrink-0 sticky top-0 h-screen ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Логотип и переключатель сворачивания */}
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between gap-2 h-16">
          <div className="flex items-center space-x-3 overflow-hidden">
            <Shield className="w-7 h-7 text-blue-500 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-base font-bold tracking-wider text-white whitespace-nowrap">
                BOX-PROFILE
              </span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Пункты навигации */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="truncate text-left">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Правая часть: Верхняя панель + Основной контент */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Верхняя шапка (управление выбором группы/спортсмена) */}
        <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4 shadow-md sticky top-0 z-10">
          <div className="text-sm font-semibold text-slate-300">
            {navItems.find(i => i.id === activeTab)?.label}
          </div>

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

        {/* Основная область контента */}
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
      </div>

      {/* Модальное окно добавления */}
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
                    {getQualificationOptions().map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
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
                  Эти поля используются анализатором для подбора сопоставимых референтных моделей.
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