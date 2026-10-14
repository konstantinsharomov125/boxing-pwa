import React, { useState, useEffect } from 'react';
import { Shield, Activity, Dumbbell, Brain, UserPlus, FileText, X, FolderPlus, Users } from 'lucide-react';
import BoxDataView from './components/BoxDataView';
import PhysTestView from './components/PhysTestView';
import MatrixView from './components/MatrixView';
import ReportView from './components/ReportView';

export default function App() {
  const [activeTab, setActiveTab] = useState('boxdata');

  // Список групп подготовки (по умолчанию только "Все группы")
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('box_groups');
    return saved ? JSON.parse(saved) : ['Все группы'];
  });

  const [selectedGroup, setSelectedGroup] = useState('Все группы');

  // Список спортсменов (по умолчанию пустой)
  const [athletes, setAthletes] = useState(() => {
    const saved = localStorage.getItem('box_athletes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [selectedAthlete, setSelectedAthlete] = useState(athletes[0] || null);
  const [isAddAthleteOpen, setIsAddAthleteOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);

  // Поля формы добавления атлета (только ФИО и группа)
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState(groups[1] || 'Все группы');

  // Поле создания новой группы
  const [newGroupNameInput, setNewGroupNameInput] = useState('');

  useEffect(() => {
    localStorage.setItem('box_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('box_athletes', JSON.stringify(athletes));
  }, [athletes]);

  // Фильтрация спортсменов по выбранной группе
  const filteredAthletes = selectedGroup === 'Все группы' 
    ? athletes 
    : athletes.filter(a => a.group === selectedGroup);

  // Синхронизация активного спортсмена при смене группы или списка
  useEffect(() => {
    if (filteredAthletes.length > 0) {
      if (!filteredAthletes.some(a => a.id === selectedAthlete?.id)) {
        setSelectedAthlete(filteredAthletes[0]);
      }
    } else {
      setSelectedAthlete(null);
    }
  }, [selectedGroup, filteredAthletes, selectedAthlete]);

  const handleAddAthlete = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newAthlete = {
      id: Date.now(),
      name: newName.trim(),
      group: newGroup === 'Все группы' ? (groups[1] || 'Основная группа') : newGroup,
      style: 'Темповик',
      weight: '67 кг',
    };

    const updated = [...athletes, newAthlete];
    setAthletes(updated);
    setSelectedAthlete(newAthlete);
    setNewName('');
    setIsAddAthleteOpen(false);
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupNameInput.trim() || groups.includes(newGroupNameInput.trim())) return;
    const updatedGroups = [...groups, newGroupNameInput.trim()];
    setGroups(updatedGroups);
    setNewGroup(newGroupNameInput.trim());
    setNewGroupNameInput('');
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

        {/* Правый верхний блок управления */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Селект группы */}
          <div className="flex items-center space-x-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-700">
            <Users className="w-4 h-4 text-blue-400 ml-1" />
            <select 
              className="bg-transparent text-xs focus:outline-none text-slate-200 cursor-pointer pr-1"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.map((g, idx) => (
                <option key={idx} value={g} className="bg-slate-800 text-white">{g}</option>
              ))}
            </select>
          </div>

          {/* Селект спортсмена (ТОЛЬКО ФИО) */}
          <div className="flex items-center space-x-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-700">
            <span className="text-xs text-slate-400 pl-1">Спортсмен:</span>
            <select 
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
              value={selectedAthlete ? selectedAthlete.id : ''}
              onChange={(e) => setSelectedAthlete(athletes.find(a => a.id == e.target.value))}
            >
              {filteredAthletes.length > 0 ? (
                filteredAthletes.map(a => (
                  <option key={a.id} value={a.id} className="bg-slate-800 text-white font-normal">
                    {a.name}
                  </option>
                ))
              ) : (
                <option value="" disabled className="bg-slate-800 text-slate-500">Нет спортсменов</option>
              )}
            </select>
          </div>

          {/* Кнопка добавления группы */}
          <button 
            onClick={() => setIsManageGroupsOpen(true)}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Добавить группу"
          >
            <FolderPlus className="w-4 h-4 text-blue-400" />
            <span>Добавить группу</span>
          </button>

          {/* Кнопка добавления спортсмена */}
          <button 
            onClick={() => setIsAddAthleteOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
            title="Добавить спортсмена"
          >
            <UserPlus className="w-4 h-4" />
            <span>Добавить спортсмена</span>
          </button>
        </div>
      </header>

      {/* Навигационное меню вкладок */}
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
      </nav>

      {/* Основная область */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {selectedAthlete ? (
          <>
            {activeTab === 'boxdata' && <BoxDataView athlete={selectedAthlete} />}
            {activeTab === 'phys' && <PhysTestView athlete={selectedAthlete} />}
            {activeTab === 'matrix' && <MatrixView athlete={selectedAthlete} />}
            {activeTab === 'report' && <ReportView athlete={selectedAthlete} />}
          </>
        ) : (
          <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 my-8">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300 mb-1">Спортсмены не найдены</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              В выбранной группе пока нет зарегистрированных спортсменов. Нажмите «Добавить спортсмена», чтобы начать работу.
            </p>
            <button 
              onClick={() => setIsAddAthleteOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить первого спортсмена</span>
            </button>
          </div>
        )}
      </main>

      {/* МОДАЛЬНОЕ ОКНО: Добавление спортсмена */}
      {isAddAthleteOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setIsAddAthleteOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Добавить спортсмена
            </h3>

            <form onSubmit={handleAddAthlete} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">ФИО спортсмена</label>
                <input 
                  type="text" 
                  required
                  placeholder="например, Смирнов Артем"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Группа подготовки</label>
                <select 
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {groups.map((g, idx) => (
                    <option key={idx} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsAddAthleteOpen(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm font-medium cursor-pointer">
                  Отмена
                </button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium cursor-pointer shadow-lg shadow-blue-500/30">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: Добавить группу */}
      {isManageGroupsOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setIsManageGroupsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5" /> Добавить группу
            </h3>

            <form onSubmit={handleCreateGroup} className="mb-4 flex gap-2">
              <input 
                type="text"
                placeholder="Название новой группы"
                value={newGroupNameInput}
                onChange={(e) => setNewGroupNameInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded font-medium cursor-pointer">
                Создать
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <span className="text-xs text-slate-400 block font-semibold mb-1">Существующие группы:</span>
              {groups.map((g, idx) => (
                <div key={idx} className="bg-slate-900/60 p-2.5 rounded border border-slate-700 text-xs text-slate-200 flex justify-between items-center">
                  <span>{g}</span>
                  <span className="text-[10px] text-slate-500">
                    {g === 'Все группы' ? `${athletes.length} атл.` : `${athletes.filter(a => a.group === g).length} атл.`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-2 border-t border-slate-700 flex justify-end">
              <button onClick={() => setIsManageGroupsOpen(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs cursor-pointer">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}