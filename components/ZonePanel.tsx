"use client";

import type { Unit, UnitStatus, UnitType, UserRole } from "@/lib/types";

interface ZonePanelProps {
  unit: Unit | null;
  open: boolean;
  role?: UserRole;
  loading?: boolean;
  onClose: () => void;
  onEdit?: (unit: Unit) => void;
}

const STATUS_PILL: Record<UnitStatus, string> = {
  occupied: "bg-green-100 text-green-800 border-green-200",
  vacant: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const TYPE_LABEL: Record<UnitType, string> = {
  office: "Office",
  meeting_room: "Meeting Room",
  hot_desk: "Hot Desk",
  open_space: "Open Space",
};

export default function ZonePanel({
  unit,
  open,
  role,
  loading = false,
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
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="min-w-0 flex-1 pr-4">
            {unit ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 rounded">
                    {TYPE_LABEL[unit.unit_type]}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-1.5 truncate">
                  {unit.name}
                </h3>
              </>
            ) : (
              <h3 className="text-xl font-semibold text-gray-900">
                {loading ? "Loading…" : "Unit"}
              </h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1 overflow-auto">
          {!unit && loading && (
            <div className="text-sm text-gray-500">Fetching unit details…</div>
          )}

          {unit && (
            <>
              <div>
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
                    STATUS_PILL[unit.status]
                  }`}
                >
                  {unit.status.toUpperCase()}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <dt className="text-gray-500">Area</dt>
                <dd className="text-gray-900 font-medium">
                  {unit.area_m2} m²
                </dd>

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

              {/* Active Lease section — visible only when occupied */}
              {unit.status === "occupied" && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    Active Lease
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium text-green-800">
                        Currently leased
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly rate</span>
                      <span className="font-medium text-gray-900">
                        ${unit.monthly_rate.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 pt-1">
                      Lease details endpoint coming soon.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {unit && canEdit && (
          <div className="p-5 border-t border-gray-200">
            <button
              onClick={() => onEdit?.(unit)}
              className="w-full rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2 transition"
            >
              Edit Unit
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
