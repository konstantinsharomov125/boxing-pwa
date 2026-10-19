import React from 'react';

/** Отображение числового поля: отсутствие значения ≠ нулю. */
export function NumericCell({ field, unit }) {
  if (!field || !field.hasValue) {
    return <span className="text-slate-500 italic">не указано</span>;
  }
  return (
    <span className="text-white font-mono">
      {field.display}
      {unit ? <span className="text-slate-500 font-normal"> {unit}</span> : null}
    </span>
  );
}

export function StatusBadge({ text, tone }) {
  if (!text) return <span className="text-slate-500 italic">—</span>;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
        tone === 'amber'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-slate-800 border-slate-600 text-slate-300'
      }`}
    >
      {text}
    </span>
  );
}

/**
 * Общая таблица staging-раздела.
 * Каждая ячейка — { key, render } из рендерера строки, поэтому
 * React-ключи задаются в компонентах, а не в литералах массивов.
 */
export function StagingTable({ head, rows, renderCells, onSelect }) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full text-left text-xs text-slate-300">
      <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
        <tr>
          {head.map((title) => <th key={title} className="p-2 whitespace-nowrap">{title}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            className="hover:bg-slate-800/60 cursor-pointer"
          >
            {renderCells(row).map((cell) => (
              <td key={cell.key} className="p-2 align-top max-w-[22rem]">{cell.render()}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
