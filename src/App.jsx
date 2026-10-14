import React, { useState, useEffect } from 'react';
import { Shield, Activity, Dumbbell, Brain, UserPlus, FileText, X } from 'lucide-react';
import BoxDataView from './components/BoxDataView';
import PhysTestView from './components/PhysTestView';
import MatrixView from './components/MatrixView';
import ReportView from './components/ReportView';

export default function App() {
  const [activeTab, setActiveTab] = useState('boxdata');

  const [athletes, setAthletes] = useState(() => {
    const saved = localStorage.getItem('box_athletes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      { id: 1, name: 'Иванов Алексей', style: 'Темповик', weight: '67 кг' },
      { id: 2, name: 'Петров Дмитрий', style: 'Нокаутер', weight: '75 кг' },
    ];
  });

  const [selectedAthlete, setSelectedAthlete] = useState(athletes[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newStyle, setNewStyle] = useState('Темповик');
  const [newWeight, setNewWeight] = useState('67 кг');

  useEffect(() => {
    localStorage.setItem('box_athletes', JSON.stringify(athletes));
  }, [athletes]);

  const handleAddAthlete = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newAthlete = {
      id: Date.now(),
      name: newName.trim(),
      style: newStyle,
      weight: newWeight,
    };

    const updatedAthletes = [...athletes, newAthlete];
    setAthletes(updatedAthletes);
    setSelectedAthlete(newAthlete);
    setNewName('');
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Шапка приложения */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">BOX-PROFILE</h1>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400">Спортсмен:</span>
            <select 
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 text-white cursor-pointer"
              value={selectedAthlete ? selectedAthlete.id : ''}
              onChange={(e) => setSelectedAthlete(athletes.find(a => a.id == e.target.value))}
            >
              {athletes.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.style}, {a.weight})</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
            title="Добавить нового боксера"
          >
            <UserPlus className="w-4 h-4" /> Добавить бойца
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

      {/* Основная рабочая область */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'boxdata' && <BoxDataView athlete={selectedAthlete} />}
        {activeTab === 'phys' && <PhysTestView athlete={selectedAthlete} />}
        {activeTab === 'matrix' && <MatrixView athlete={selectedAthlete} />}
        {activeTab === 'report' && <ReportView athlete={selectedAthlete} />}
      </main>

      {/* Модальное окно добавления спортсмена */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Регистрация нового боксера
            </h3>

            <form onSubmit={handleAddAthlete} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">ФИО спортсмена</label>
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
                <label className="block text-sm text-slate-300 mb-1">Индивидуальный стиль</label>
                <select 
                  value={newStyle}
                  onChange={(e) => setNewStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Темповик">Темповик</option>
                  <option value="Нокаутер">Нокаутер</option>
                  <option value="Игровик (контратакующий)">Игровик (контратакующий)</option>
                  <option value="Универсал">Универсал</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Весовая категория</label>
                <input 
                  type="text" 
                  required
                  placeholder="например, 71 кг"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-blue-500/30"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}