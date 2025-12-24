import React from 'react';

export default function ReportStrip({ report }) {
  if (!report) return null;

  // Превращаем объект в массив [key, value]
  const entries = Object.entries(report);

  return (
    <div className="report-strip">
      {entries.map(([key, value]) => {
        let displayVal = value;
        // Округляем числа до 4 знаков
        if (typeof value === 'number') {
          displayVal = parseFloat(value.toFixed(4));
        }
        return (
          <div key={key} className="report-item">
            <span className="report-key">{key}:</span>
            <span className="report-value">{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
}