"use client";

import { FormEvent, useState, useEffect } from "react";
import type { RatePeriod, UnitType } from "@/lib/types";

export interface ZoneFormData {
  name: string;
  unit_type: UnitType;
  area_m2: number;
  seats: number;
  monthly_rate: number;
  rate_period: RatePeriod;
}

interface ZoneNameModalProps {
  open: boolean;
  defaultType: UnitType;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: ZoneFormData) => void;
}

const FLEX_PERIODS: { value: RatePeriod; label: string }[] = [
  { value: "day", label: "per day" },
  { value: "biweekly", label: "per 2 weeks" },
  { value: "month", label: "per month" },
];

function defaultPeriodForType(t: UnitType): RatePeriod {
  if (t === "meeting_room") return "hour";
  if (t === "office") return "month";
  // hot_desk / open_space — user picks; default to month
  return "month";
}

function rateLabelForType(t: UnitType): string {
  if (t === "meeting_room") return "Rate $/hour";
  if (t === "office") return "Rate $/month";
  return "Rate $";
}

export default function ZoneNameModal({
  open,
  defaultType,
  submitting = false,
  onClose,
  onSubmit,
}: ZoneNameModalProps) {
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState<UnitType>(defaultType);
  const [area, setArea] = useState("0");
  const [seats, setSeats] = useState("1");
  const [rate, setRate] = useState("0");
  const [ratePeriod, setRatePeriod] = useState<RatePeriod>(
    defaultPeriodForType(defaultType)
  );

  useEffect(() => {
    if (open) {
      setName("");
      setUnitType(defaultType);
      setArea("0");
      setSeats("1");
      setRate("0");
      setRatePeriod(defaultPeriodForType(defaultType));
    }
  }, [open, defaultType]);

  // When the user changes type within the form, update period to a sensible
  // default for the new type.
  useEffect(() => {
    setRatePeriod(defaultPeriodForType(unitType));
  }, [unitType]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      unit_type: unitType,
      area_m2: parseFloat(area) || 0,
      seats: parseInt(seats, 10) || 1,
      monthly_rate: parseFloat(rate) || 0,
      rate_period: ratePeriod,
    });
  }

  const showFlexPeriod = unitType === "hot_desk" || unitType === "open_space";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-gray-900">Name this zone</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit name
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office 201"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none bg-white"
          >
            <option value="office">Office</option>
            <option value="meeting_room">Meeting Room</option>
            <option value="hot_desk">Hot Desk</option>
            <option value="open_space">Open Space</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area m²
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seats
            </label>
            <input
              type="number"
              min="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {rateLabelForType(unitType)}
            </label>
            <input
              type="number"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
            />
          </div>
        </div>

        {showFlexPeriod && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pricing period
            </label>
            <div className="flex gap-4 text-sm text-gray-700">
              {FLEX_PERIODS.map((p) => (
                <label key={p.value} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="rate_period"
                    value={p.value}
                    checked={ratePeriod === p.value}
                    onChange={() => setRatePeriod(p.value)}
                    className="text-cbc-blue focus:ring-cbc-blue"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Create zone"}
          </button>
        </div>
      </form>
    </div>
  );
}
