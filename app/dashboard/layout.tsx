"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PropertyProvider, useProperty } from "@/lib/PropertyContext";

const NAV_ITEMS = [
  { href: "/dashboard/properties", label: "Properties", icon: "🏢" },
  { href: "/dashboard/map", label: "Floor Map", icon: "🗺️" },
  { href: "/dashboard/resources", label: "Resources", icon: "📦" },
  { href: "/dashboard/plans", label: "Plans", icon: "💰" },
  { href: "/dashboard/workspace", label: "Workspace", icon: "📅" },
  { href: "/dashboard/tenants", label: "Tenants", icon: "👥" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [companyName, setCompanyName] = useState("CBC");
  const { propertyId, propertyName, properties, setPropertyId } = useProperty();

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar_collapsed") === "true");
    api.get<Record<string, string>>("/settings").then((r) => {
      if (r.data.logo_url) setLogoUrl(r.data.logo_url);
      if (r.data.company_name) setCompanyName(r.data.company_name);
    }).catch(() => {});
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? 64 : 220,
          transition: "width 0.2s ease",
          background: "#13232E",
          color: "white",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: collapsed ? "16px 0" : "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            textAlign: collapsed ? "center" : "left",
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl.startsWith("http") ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL || ""}${logoUrl}`}
              alt={companyName}
              style={{ height: collapsed ? 28 : 36, maxWidth: collapsed ? 40 : 140, objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: collapsed ? 16 : 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {collapsed ? companyName.slice(0, 1) : companyName}
            </div>
          )}
          {!collapsed && (
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              Coworking OS
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: collapsed ? "12px 4px" : "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "10px 0" : "8px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "white" : "rgba(255,255,255,0.6)",
                  background: active ? "#003DA5" : "transparent",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div style={{ padding: "0 12px 8px", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            MVP v1.0 · CBC Coworking OS
          </div>
        )}
        <button
          onClick={toggleSidebar}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "12px 0",
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            background: "none",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header
          style={{
            height: 56,
            background: "white",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Property</div>
              {properties.length > 1 ? (
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(Number(e.target.value))}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "2px 8px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {propertyName || "Loading..."}
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>CBC Coworking OS</div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <PropertyProvider>
      <DashboardShell>{children}</DashboardShell>
    </PropertyProvider>
  );
}
