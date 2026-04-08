"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/dashboard/map", label: "Floor Map", icon: "▦" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📅" },
  { href: "/dashboard/tenants", label: "Tenants", icon: "👥" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-cbc-midnight text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="text-xl font-bold tracking-tight">CBC</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Coworking OS
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                  active
                    ? "bg-cbc-blue text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-gray-500">
          v1.0.0
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 justify-between">
          <div>
            <div className="text-sm text-gray-500">Building</div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">
              Modera Coworking
            </div>
          </div>
          <div className="text-sm text-gray-600">CBC Coworking OS</div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
