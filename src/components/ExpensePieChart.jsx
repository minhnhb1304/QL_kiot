import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { createCurrencyFormatter } from '../utils/currency';

ChartJS.register(ArcElement, Tooltip, Legend);

const PRESET_COLORS = [
  '#F97316', '#EC4899', '#3B82F6', '#EAB308', 
  '#6366F1', '#14B8A6', '#8B5CF6', '#64748B'
];

export default function ExpensePieChart({ categoriesData, theme, currency = 'VND', formatCurrency }) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';

  const formatter = formatCurrency || createCurrencyFormatter(currency);

  const labels = categoriesData.map(item => item.name);
  const values = categoriesData.map(item => item.value);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: PRESET_COLORS.slice(0, categoriesData.length),
        borderWidth: 2,
        borderColor: isDark ? '#161C28' : '#FFFFFF',
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          boxWidth: 10,
          boxHeight: 10,
          borderRadius: 3,
          padding: 10,
          font: { family: 'Be Vietnam Pro', size: 11, weight: '600' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const val = formatter(context.parsed);
            return `${label}: ${val}`;
          }
        }
      }
    },
    cutout: '68%'
  };

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <h3>Tỷ Trọng Chi Phí</h3>
      </div>
      <div className="chart-canvas-wrapper pie-chart-wrapper">
        {categoriesData.length > 0 ? (
          <Doughnut data={data} options={options} />
        ) : (
          <div className="empty-chart">Chưa có dữ liệu</div>
        )}
      </div>
    </div>
  );
}
