import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { createCurrencyFormatter } from '../utils/currency';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CashflowChart({ dailyData, theme, periodLabel, currency = 'VND', formatCurrency }) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#263044' : '#E2E8F0';

  const formatter = formatCurrency || createCurrencyFormatter(currency);

  const labels = dailyData.map(item => {
    const parts = item.date.split('-');
    return `${parts[2]}/${parts[1]}`;
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Thu',
        data: dailyData.map(item => item.income),
        backgroundColor: '#10B981',
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 32,
      },
      {
        label: 'Chi',
        data: dailyData.map(item => item.expense),
        backgroundColor: '#EF4444',
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 32,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: textColor,
          boxWidth: 10,
          boxHeight: 10,
          borderRadius: 3,
          font: { family: 'Be Vietnam Pro', size: 11, weight: '600' },
          padding: 12,
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = formatter(ctx.parsed.y);
            return `${ctx.dataset.label}: ${val}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 10 } },
        border: { color: gridColor },
      },
      y: {
        grid: { color: gridColor },
        border: { dash: [4, 4], color: 'transparent' },
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value;
          }
        }
      }
    }
  };

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <h3>Doanh Thu vs Chi Phí</h3>
          {periodLabel && <p className="chart-period">{periodLabel}</p>}
        </div>
      </div>
      <div className="chart-canvas-wrapper bar-chart-wrapper">
        {dailyData.length > 0 ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="empty-chart">Chưa có dữ liệu</div>
        )}
      </div>
    </div>
  );
}
