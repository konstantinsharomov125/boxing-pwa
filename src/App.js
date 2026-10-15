import React, { useState } from 'react';
import StandardsTab from './components/StandardsTab';
import AthleteProfileView from './components/AthleteProfileView';

export default function App() {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Состояние для живого ввода данных спортсмена
  const [athlete, setAthlete] = useState({
    name: 'Иван Смирнов',
    age: 15,
    weightCategory: '63.5 кг'
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка навигации box-profile */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Box Profile</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Спортсмен и нормативы
          </button>
          <button 
            onClick={() => setActiveTab('standards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'standards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            База документов
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="py-8 px-4 max-w-4xl mx-auto">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Форма изменения параметров атлета */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Параметры боксера</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ФИО</label>
                  <input 
                    type="text" 
                    value={athlete.name}
                    onChange={(e) => setAthlete({ ...athlete, name: e.target.value })}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Возраст (лет)</label>
                  <input 
                    type="number" 
                    value={athlete.age}
                    onChange={(e) => setAthlete({ ...athlete, age: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Весовая категория</label>
                  <input 
                    type="text" 
                    value={athlete.weightCategory}
                    onChange={(e) => setAthlete({ ...athlete, weightCategory: e.target.value })}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Карточка с автоматически подтягивающимися нормами ФССП */}
            <AthleteProfileView athlete={athlete} />
          </div>
        )}

        {activeTab === 'standards' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <StandardsTab />
          </div>
        )}
      </main>
    </div>
  );
}