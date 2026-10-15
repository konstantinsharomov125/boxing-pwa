import React, { useState } from 'react';
import { boxingStandards } from '../data/boxingStandards';

export default function StandardsTab() {
  const [filter, setFilter] = useState('All');

  const filteredDocs = filter === 'All' 
    ? boxingStandards.documents 
    : boxingStandards.documents.filter(d => d.category === filter);

  const categories = ['All', 'Государственные стандарты РФ', 'Инновационные дисциплины', 'Международные правила'];

  return (
    <div className="p-4 space-y-4 text-white">
      <div>
        <h2 className="text-lg font-bold">Нормативно-правовая база бокса</h2>
        <p className="text-xs text-slate-400">Стандарты Минспорта РФ и международные регламенты</p>
      </div>

      {/* Фильтры в стиле PWA / Dark UI */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {cat === 'All' ? 'Все' : cat}
          </button>
        ))}
      </div>

      {/* Список документов */}
      <div className="grid gap-3">
        {filteredDocs.map(doc => (
          <div key={doc.id} className="bg-slate-800/90 border border-slate-700 p-4 rounded-xl space-y-2">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
              {doc.category}
            </span>
            <h3 className="text-sm font-bold text-white">{doc.title}</h3>
            <p className="text-xs text-slate-400">{doc.documentNumber}</p>
            <p className="text-xs text-slate-300 leading-relaxed">{doc.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}