"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BillingMode, Plan } from "@/lib/types";

const BUILDING_ID = 1;

function formatUzs(value: number): string {
  return value.toLocaleString() + " сум";
}

const EMPTY_PLAN: Omit<Plan, "id" | "created_at"> = {
  building_id: BUILDING_ID,
  name: "",
  billing_mode: "per_unit",
  base_rate_uzs: 0,
  coin_pct: 5,
  coin_reset_day: 1,
  meeting_discount_pct: 10,
  meeting_discount_on: false,
  event_discount_pct: 0,
  event_discount_on: false,
  is_active: true,
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [billingMode, setBillingMode] = useState<BillingMode>("per_unit");
  const [baseRate, setBaseRate] = useState("0");
  const [coinPct, setCoinPct] = useState("5");
  const [coinResetDay, setCoinResetDay] = useState("1");
  const [meetingDiscountPct, setMeetingDiscountPct] = useState("10");
  const [meetingDiscountOn, setMeetingDiscountOn] = useState(false);
  const [eventDiscountPct, setEventDiscountPct] = useState("0");
  const [isActive, setIsActive] = useState(true);

  async function loadPlans() {
    try {
      const res = await api.get<Plan[]>("/plans", {
        params: { building_id: BUILDING_ID },
      });
      setPlans(res.data);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load plans");
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function populateForm(p: Omit<Plan, "id" | "created_at">) {
    setName(p.name);
    setBillingMode(p.billing_mode);
    setBaseRate(String(p.base_rate_uzs));
    setCoinPct(String(p.coin_pct));
    setCoinResetDay(String(p.coin_reset_day));
    setMeetingDiscountPct(String(p.meeting_discount_pct));
    setMeetingDiscountOn(p.meeting_discount_on);
    setEventDiscountPct(String(p.event_discount_pct));
    setIsActive(p.is_active);
  }

  function selectPlan(plan: Plan) {
    setSelectedId(plan.id);
    setIsNew(false);
    populateForm(plan);
  }

  function startNew() {
    setSelectedId(null);
    setIsNew(true);
    populateForm(EMPTY_PLAN);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        building_id: BUILDING_ID,
        name: name.trim(),
        billing_mode: billingMode,
        base_rate_uzs: parseFloat(baseRate) || 0,
        coin_pct: parseFloat(coinPct) || 0,
        coin_reset_day: parseInt(coinResetDay, 10) || 1,
        meeting_discount_pct: parseInt(meetingDiscountPct, 10) || 0,
        meeting_discount_on: meetingDiscountOn,
        event_discount_pct: parseInt(eventDiscountPct, 10) || 0,
        event_discount_on: false,
        is_active: isActive,
      };

      if (isNew) {
        const res = await api.post<Plan>("/plans", body);
        await loadPlans();
        setSelectedId(res.data.id);
        setIsNew(false);
        showToast("Plan created");
      } else if (selectedId) {
        await api.patch(`/plans/${selectedId}`, body);
        await loadPlans();
        showToast("Plan updated");
      }
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || (e as Error)?.message;
      setError(detail || "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm("Delete this plan? Resources linked to it will be unlinked."))
      return;
    setSubmitting(true);
    try {
      await api.delete(`/plans/${selectedId}`);
      setSelectedId(null);
      setIsNew(false);
      await loadPlans();
      showToast("Plan deleted");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const coinPreview = (() => {
    const rate = parseFloat(baseRate) || 0;
    const pct = parseFloat(coinPct) || 0;
    const coins = Math.round((rate * pct) / 100);
    return `${pct}% of ${formatUzs(rate)} = ${coins.toLocaleString()} coins/month`;
  })();

  const meetingPreview = (() => {
    const pct = parseInt(meetingDiscountPct, 10) || 0;
    return meetingDiscountOn
      ? `${pct}% discount on meeting room bookings`
      : "Disabled";
  })();

  const showForm = isNew || selectedId !== null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Plans</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: plan list */}
        <div className="lg:col-span-1 space-y-3">
          <button
            onClick={startNew}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md"
          >
            + New Plan
          </button>

          {plans.length === 0 && (
            <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-md">
              No plans yet. Create one to get started.
            </div>
          )}

          {plans.map((p) => {
            const active = p.id === selectedId && !isNew;
            return (
              <button
                key={p.id}
                onClick={() => selectPlan(p)}
                className={`block w-full text-left p-4 rounded-lg border transition ${
                  active
                    ? "border-cbc-blue bg-cbc-blue/5 ring-1 ring-cbc-blue"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-gray-900 truncate">
                    {p.name}
                  </div>
                  {!p.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold">
                      INACTIVE
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                    {p.billing_mode === "per_unit" ? "Per Unit" : "Per Seat"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    {p.coin_pct}% coins
                  </span>
                  {p.meeting_discount_on && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                      -{p.meeting_discount_pct}% meetings
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {formatUzs(p.base_rate_uzs)} / month
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT: form */}
        <div className="lg:col-span-2">
          {showForm ? (
            <form
              onSubmit={handleSave}
              className="bg-white border border-gray-200 rounded-lg p-6 space-y-5"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {isNew ? "New Plan" : "Edit Plan"}
              </h2>

              {/* Name */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise, Startup, Freelancer"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Billing mode */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Billing mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="billing_mode"
                      checked={billingMode === "per_unit"}
                      onChange={() => setBillingMode("per_unit")}
                      className="accent-cbc-blue"
                    />
                    Per Unit
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="billing_mode"
                      checked={billingMode === "per_seat"}
                      onChange={() => setBillingMode("per_seat")}
                      className="accent-cbc-blue"
                    />
                    Per Seat
                  </label>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {billingMode === "per_unit"
                    ? "Flat rate per resource unit"
                    : "Rate multiplied by number of seats"}
                </div>
              </div>

              {/* Base rate */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Base rate (сум / month)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                    className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-500">
                    = {formatUzs(parseFloat(baseRate) || 0)} / month
                  </span>
                </div>
              </div>

              {/* Coin accrual */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Coin accrual (% of base rate)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={coinPct}
                    onChange={(e) => setCoinPct(e.target.value)}
                    className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{coinPreview}</div>
              </div>

              {/* Coin reset day */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Coin reset day of month
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={coinResetDay}
                  onChange={(e) => setCoinResetDay(e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Meeting room discount */}
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Meeting room discount
                  </label>
                  <button
                    type="button"
                    onClick={() => setMeetingDiscountOn(!meetingDiscountOn)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      meetingDiscountOn ? "bg-cbc-blue" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        meetingDiscountOn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {meetingDiscountOn && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={meetingDiscountPct}
                      onChange={(e) => setMeetingDiscountPct(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
                <div className="text-xs text-gray-400">{meetingPreview}</div>
              </div>

              {/* Event discount — coming soon */}
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200 opacity-60">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Event discount
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-500 font-semibold">
                    Coming soon
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {eventDiscountPct}% discount on event bookings (not yet
                  available)
                </div>
              </div>

              {/* Status toggle */}
              <div className="flex items-center gap-3">
                <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  {isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                {!isNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setIsNew(false);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
              Select a plan from the list or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
