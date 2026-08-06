import React from 'react';
import { createCurrencyFormatter } from '../utils/currency';

export default function KpiCard({
  title,
  amount,
  color,
  subtitle,
  badgeText,
  badgeType,
  formatAsCurrency = true,
  currency = 'VND',
  formatCurrency
}) {
  const formatter = formatCurrency || createCurrencyFormatter(currency);
  const formattedAmount = formatAsCurrency ? formatter(amount || 0) : amount;

  return (
    <div className="card kpi-card">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {badgeText && (
          <span className={`badge ${badgeType ? `badge-${badgeType}` : ''}`}>
            {badgeText}
          </span>
        )}
      </div>

      <div className="kpi-body">
        <h3 className="kpi-amount" style={{ color: color || 'var(--text-main)' }}>
          {formattedAmount}
        </h3>

        {subtitle && (
          <div className="kpi-footer">
            <span className="kpi-subtitle">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
