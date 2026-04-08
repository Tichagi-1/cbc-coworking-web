"use client";

import type { Unit, UnitStatus, UserRole } from "@/lib/types";

interface ZonePanelProps {
  unit: Unit | null;
  open: boolean;
  role?: UserRole;
  onClose: () => void;
  onEdit?: (unit: Unit) => void;
}

const STATUS_BADGE: Record<UnitStatus, string> = {
  occupied: "bg-green-100 text-green-800 border-green-200",
  vacant: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export default function ZonePanel({
  unit,
  open,
  role,
  onClose,
  onEdit,
}: ZonePanelProps) {
  const canEdit = role === "admin" || role === "manager";

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-40 transform transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {unit && (
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {unit.unit_type.replace("_", " ")}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-0.5">
                  {unit.name}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-auto">
              <div>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    STATUS_BADGE[unit.status]
                  }`}
                >
                  {unit.status.toUpperCase()}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-gray-500">Area</dt>
                <dd className="text-gray-900 font-medium">{unit.area_m2} m²</dd>

                <dt className="text-gray-500">Seats</dt>
                <dd className="text-gray-900 font-medium">{unit.seats}</dd>

                <dt className="text-gray-500">Monthly rate</dt>
                <dd className="text-gray-900 font-medium">
                  ${unit.monthly_rate.toLocaleString()}
                </dd>
              </dl>

              {unit.description && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Description
                  </div>
                  <p className="text-sm text-gray-700">{unit.description}</p>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="p-5 border-t border-gray-200">
                <button
                  onClick={() => onEdit?.(unit)}
                  className="w-full rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2 transition"
                >
                  Edit Unit
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
