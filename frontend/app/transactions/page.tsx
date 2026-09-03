"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import StatusBadge from "../../components/common/StatusBadge";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import { fetchTransactions } from "../../lib/api";
import { Transaction } from "../../types/revive";
import {
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const limit = 20;

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTransactions({
        status: selectedStatus || undefined,
        limit,
        offset,
      });
      setTransactions(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedStatus, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadTransactions();
  };

  const formatCurrency = (amount: number, currency: string = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Client-side search filtering
  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && !selectedMethod) return true;

    const matchesQuery =
      !query ||
      tx.transaction_id.toLowerCase().includes(query) ||
      tx.order_id?.toLowerCase().includes(query) ||
      tx.customer?.name?.toLowerCase().includes(query) ||
      tx.failure_reason?.toLowerCase().includes(query);

    const matchesMethod =
      !selectedMethod || tx.payment_method?.toUpperCase() === selectedMethod.toUpperCase();

    return matchesQuery && matchesMethod;
  });

  return (
    <AppShell
      title="Transactions"
      description="Manage payment authorizations, failure diagnostic records, and recovery lifecycles."
      onRefresh={loadTransactions}
      isRefreshing={loading}
    >
      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4 items-end">
          {/* Search bar */}
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-bold text-slate-600 font-mono uppercase tracking-wider mb-1.5">
              Search Transactions
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Transaction ID, Customer, Order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-48">
            <label className="block text-xs font-bold text-slate-600 font-mono uppercase tracking-wider mb-1.5">
              Payment Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setOffset(0);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Payment Statuses</option>
              <option value="FAILED">FAILED (At Risk)</option>
              <option value="SUCCESS">SUCCESS (Captured)</option>
              <option value="ABANDONED">ABANDONED</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="w-40">
            <label className="block text-xs font-bold text-slate-600 font-mono uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
              <option value="NETBANKING">NETBANKING</option>
            </select>
          </div>

          {/* Submit Action */}
          <div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-mono transition-colors shadow-sm"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorBanner
          title="Failed to fetch transactions"
          message={error}
          onRetry={loadTransactions}
        />
      )}

      {/* Transactions Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={8} />
      ) : filteredTransactions.length === 0 ? (
        <EmptyState
          title="No Transactions Found"
          description="No transactions match your current search and filter criteria. Try clearing filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSelectedStatus("");
            setSelectedMethod("");
            setSearchQuery("");
            setOffset(0);
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-mono border-b border-slate-200">
                <tr>
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Failure Reason</th>
                  <th className="p-4">Recovery Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id || tx.transaction_id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="p-4 font-bold text-slate-900">
                      <Link
                        href={`/transactions/${tx.transaction_id}`}
                        className="text-indigo-600 group-hover:underline font-bold"
                      >
                        {tx.transaction_id}
                      </Link>
                    </td>
                    <td className="p-4 text-slate-800 font-sans font-medium">
                      {tx.customer?.name || "Guest Customer"}
                    </td>
                    <td className="p-4 text-slate-500">
                      {tx.order_id || "—"}
                    </td>
                    <td className="p-4 font-extrabold text-slate-900">
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="p-4 text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                        {tx.payment_method}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge type="payment" status={tx.status} size="sm" />
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate font-sans">
                      {tx.failure_reason || "—"}
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        type="recovery"
                        status={tx.recovery_status || "OPEN"}
                        size="sm"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/transactions/${tx.transaction_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-mono text-xs text-slate-500">
            <div>
              Showing {filteredTransactions.length} records (Offset: {offset})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loading}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-sm font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={filteredTransactions.length < limit || loading}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-sm font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
