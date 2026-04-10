"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";

const BUILDING_ID = 1;

interface CoinSummaryItem {
  resource_id: number;
  resource_name: string;
  plan_name: string | null;
  coin_pct: number;
  base_rate_uzs: number;
  coins_accrued: number;
}

interface CoinSummary {
  tenant_id: number;
  total_coins_accrued: number;
  total_monthly_uzs: number;
  next_reset_date: string | null;
  breakdown: CoinSummaryItem[];
}

function formatUzs(value: number): string {
  return value.toLocaleString() + " сум";
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [coinSummary, setCoinSummary] = useState<CoinSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadTenants() {
    try {
      const res = await api.get<Tenant[]>("/tenants/", {
        params: { building_id: BUILDING_ID },
      });
      setTenants(res.data);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load tenants");
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  async function toggleExpand(tenantId: number) {
    if (expandedId === tenantId) {
      setExpandedId(null);
      setCoinSummary(null);
      return;
    }
    setExpandedId(tenantId);
    setCoinSummary(null);
    setLoadingSummary(true);
    try {
      const res = await api.get<CoinSummary>(
        `/tenants/${tenantId}/coin-summary`
      );
      setCoinSummary(res.data);
    } catch {
      setCoinSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleResetCoins(tenantId: number) {
    if (!confirm("Reset coins for this tenant? This will set balance to the accrued amount."))
      return;
    setResetting(true);
    try {
      await api.post(`/tenants/${tenantId}/coins/reset`);
      await loadTenants();
      // Refresh summary
      const res = await api.get<CoinSummary>(
        `/tenants/${tenantId}/coin-summary`
      );
      setCoinSummary(res.data);
      setToast("Coins reset successfully");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError((e as Error)?.message || "Failed to reset coins");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Tenants</h1>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">
            x
          </button>
        </div>
      )}
      {toast && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          {toast}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
          No tenants found.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Company
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Plan
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Coin Balance
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Last Reset
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  Resident
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <tr key={t.id} className="group">
                    <td colSpan={5} className="p-0">
                      {/* Main row */}
                      <button
                        onClick={() => toggleExpand(t.id)}
                        className="w-full text-left flex items-center hover:bg-gray-50 transition"
                      >
                        <span className="px-4 py-3 flex-1 font-medium text-gray-900">
                          {t.company_name}
                        </span>
                        <span className="px-4 py-3 w-40">
                          {t.plan_type ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                              {t.plan_type}
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </span>
                        <span className="px-4 py-3 w-32 text-right font-medium text-gray-900">
                          {t.coin_balance.toLocaleString()}
                        </span>
                        <span className="px-4 py-3 w-36 text-gray-500">
                          {t.coin_last_reset
                            ? dayjs(t.coin_last_reset).format("MMM D, YYYY")
                            : "--"}
                        </span>
                        <span className="px-4 py-3 w-24 text-center">
                          {t.is_resident ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                              YES
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">
                              NO
                            </span>
                          )}
                        </span>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                          {loadingSummary ? (
                            <div className="text-sm text-gray-500">
                              Loading coin summary...
                            </div>
                          ) : coinSummary ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white rounded-md border border-gray-200 p-3">
                                  <div className="text-xs uppercase tracking-wide text-gray-500">
                                    Total Monthly
                                  </div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {formatUzs(coinSummary.total_monthly_uzs)}
                                  </div>
                                </div>
                                <div className="bg-white rounded-md border border-gray-200 p-3">
                                  <div className="text-xs uppercase tracking-wide text-gray-500">
                                    Coins Accrued
                                  </div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {coinSummary.total_coins_accrued.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-white rounded-md border border-gray-200 p-3">
                                  <div className="text-xs uppercase tracking-wide text-gray-500">
                                    Next Reset
                                  </div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {coinSummary.next_reset_date
                                      ? dayjs(coinSummary.next_reset_date).format(
                                          "MMM D, YYYY"
                                        )
                                      : "--"}
                                  </div>
                                </div>
                              </div>

                              {/* Breakdown table */}
                              {coinSummary.breakdown.length > 0 && (
                                <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">
                                          Resource
                                        </th>
                                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">
                                          Plan
                                        </th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                                          Base Rate
                                        </th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                                          Coin %
                                        </th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">
                                          Coins
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {coinSummary.breakdown.map((item) => (
                                        <tr key={item.resource_id}>
                                          <td className="px-3 py-2 text-gray-900">
                                            {item.resource_name}
                                          </td>
                                          <td className="px-3 py-2">
                                            {item.plan_name ? (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                                                {item.plan_name}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">
                                                --
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-700">
                                            {formatUzs(item.base_rate_uzs)}
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-700">
                                            {item.coin_pct}%
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                                            {item.coins_accrued.toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleResetCoins(t.id)}
                                  disabled={resetting}
                                  className="px-3 py-1.5 text-sm font-medium border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 disabled:opacity-50"
                                >
                                  {resetting ? "Resetting..." : "Reset Coins"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Could not load coin summary. The API may not be
                              available yet.
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
