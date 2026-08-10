import React from 'react';
import TransactionList from '../components/TransactionList';

export default function LedgerPage({ transactions, onDeleteTransaction, onEditTransaction, onOpenAddModal, storeProfile, formatCurrency }) {
  return (
    <div className="ledger-page">
      <TransactionList
        transactions={transactions}
        onDeleteTransaction={onDeleteTransaction}
        onEditTransaction={onEditTransaction}
        onOpenAddModal={onOpenAddModal}
        currency={storeProfile?.currency || 'VND'}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
