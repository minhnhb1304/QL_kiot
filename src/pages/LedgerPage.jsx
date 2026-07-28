import React from 'react';
import TransactionList from '../components/TransactionList';

export default function LedgerPage({ transactions, onDeleteTransaction, onOpenAddModal }) {
  return (
    <div className="ledger-page">
      <TransactionList
        transactions={transactions}
        onDeleteTransaction={onDeleteTransaction}
        onOpenAddModal={onOpenAddModal}
      />
    </div>
  );
}
