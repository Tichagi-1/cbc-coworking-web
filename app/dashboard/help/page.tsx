"use client";

import { useState } from "react";
import { hasPermission, getRole } from "@/lib/permissions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  receptionist: "Receptionist",
  owner: "Owner",
  tenant: "Tenant",
};

const ROLE_DESC: Record<string, string> = {
  admin: "Full access to all features: properties, resources, bookings, analytics, users, and settings.",
  manager: "Manage properties, resources, tenants, bookings. No access to system settings or user management.",
  receptionist: "View properties, tenants, floor maps. Create and cancel bookings.",
  owner: "Read-only access to properties, analytics, tenants, and floor maps.",
  tenant: "Access to workspace view and booking functionality.",
};

interface Section {
  id: string;
  title: string;
  perm?: string;
  content: () => React.ReactNode;
}

export default function HelpPage() {
  const role = getRole();
  const [expanded, setExpanded] = useState<string>("getting-started");
  const [search, setSearch] = useState("");

  const toggle = (id: string) => setExpanded(expanded === id ? "" : id);

  const sections: Section[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P><B>Login:</B> Use your email and password at the login screen. If you forgot your password, contact your administrator.</P>
          <P><B>Navigation:</B> Use the sidebar on the left to switch between sections. The sidebar shows only pages available to your role.</P>
          <P><B>Your role:</B> <span style={{ padding: "2px 8px", borderRadius: 4, background: "#eff6ff", color: "#1e40af", fontWeight: 600, fontSize: 12 }}>{ROLE_LABEL[role] || role}</span></P>
          <P style={{ color: "var(--color-gray-500)" }}>{ROLE_DESC[role] || ""}</P>
          <P><B>Property selector:</B> The header bar shows the current property. If multiple properties exist, use the dropdown to switch between them.</P>
        </div>
      ),
    },
    {
      id: "properties",
      title: "Properties",
      perm: "view_properties",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P>Properties represent buildings managed in the system. Each property has floors, resources, and tenants.</P>
          <P><B>Property card:</B> Shows name, type (Business Center, Retail, etc.), class (A+/A/B/C), address, GLA, and floor count.</P>
          <P><B>Facade Map:</B> A photo of the building facade with color-coded floor zones. Green = high occupancy, yellow = medium, red = low, gray = not configured. Hover for details, click to navigate to that floor.</P>
          <P><B>Stacking Plan:</B> Vertical bar chart of all floors showing occupancy percentage. Click a floor to expand and see its resources.</P>
          <P><B>Key Metrics:</B> GLA (Gross Leasable Area), Occupancy rate (by area, not resource count), total floors, and tenant count.</P>
          {hasPermission("manage_properties") && (
            <P><B>Editing:</B> Click "Edit" to modify property details. Upload a facade photo to enable floor zone mapping. Use "Edit Zones" to draw polygon zones on the facade and assign them to floors.</P>
          )}
        </div>
      ),
    },
    {
      id: "floor-map",
      title: "Floor Map",
      perm: "view_floor_map",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P>The floor map shows an interactive canvas of each floor's layout with color-coded zones for resources.</P>
          <P><B>Zone colors:</B> Fill color shows status (green = occupied, red = vacant, yellow = reserved). Border color shows resource type.</P>
          <P><B>Click a zone</B> to see resource details: name, type, area, seats, rate, tenant.</P>
          {hasPermission("edit_floor_map") && (
            <>
              <P><B>Edit mode:</B> Toggle "Edit" to enter edit mode. Click empty space to place polygon points, double-click to finish. Then assign a resource to the zone.</P>
              <P><B>Upload floor plan:</B> Click "Upload" to set the background image for a floor. Supports PNG, JPG, PDF.</P>
              <P><B>Floor settings:</B> Set total area (m2) or seats and choose vacancy metric (area or seats) in floor settings.</P>
            </>
          )}
        </div>
      ),
    },
    {
      id: "resources",
      title: "Resources",
      perm: "manage_resources",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P><B>Resource types:</B></P>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--color-gray-700)", lineHeight: 1.8 }}>
            <li><B>Office</B> — leasable office space (counts toward vacancy)</li>
            <li><B>Open Space</B> — shared work area (counts toward vacancy)</li>
            <li><B>Hot Desk</B> — flexible desk (counts toward vacancy)</li>
            <li><B>Meeting Room</B> — bookable by coins/money (excluded from vacancy)</li>
            <li><B>Zoom Cabin</B> — small video call booth (excluded from vacancy)</li>
            <li><B>Event Zone</B> — event space (excluded from vacancy)</li>
            <li><B>Amenity</B> — kitchen, lounge, etc. (excluded from vacancy)</li>
          </ul>
          <P><B>Tenant assignment:</B> When setting status to "occupied" or "reserved" for an office/open space/hot desk, selecting a tenant is required.</P>
          <P><B>Tariff plans:</B> Resources can be linked to tariff plans that calculate monthly rates and coin accruals.</P>
        </div>
      ),
    },
    {
      id: "bookings",
      title: "Bookings",
      perm: "view_workspace",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P><B>Bookings calendar:</B> Shows all bookings for meeting rooms on a weekly calendar view.</P>
          <P><B>Creating a booking:</B> Select a meeting room, choose date and time slot, select payment method (coins or money).</P>
          <P><B>Coin system:</B> Tenants receive coins monthly based on their tariff plan (percentage of monthly rate). Coins are used to book meeting rooms. Unused coins reset on the 1st of each month.</P>
          <P><B>Cancellation:</B> Bookings can be cancelled. Coins are refunded automatically.</P>
        </div>
      ),
    },
    {
      id: "tenants",
      title: "Tenants",
      perm: "view_tenants",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P>The tenants page shows all companies/individuals renting space in the building.</P>
          <P><B>Units column:</B> Shows which resources (offices, desks) are assigned to each tenant via blue badges.</P>
          <P><B>Coin balance:</B> Current coin balance for meeting room bookings. Color: green = healthy, yellow = low, red = critical.</P>
          {hasPermission("create_tenant") && <P><B>Creating tenants:</B> Click "+ New Tenant" to add a company or individual. Link them to a user account.</P>}
          {hasPermission("adjust_coins") && <P><B>Coin management:</B> Click "Coins" to view history, manually adjust balance, or trigger a reset.</P>}
        </div>
      ),
    },
    {
      id: "analytics",
      title: "Analytics",
      perm: "view_analytics",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P><B>Occupancy Rate:</B> Calculated by area (m2), not by resource count. Formula: occupied_area / GLA x 100. Based on BOMA standards.</P>
          <P><B>Why "---" or null?</B> If GLA is not configured for a floor or building, occupancy cannot be calculated. Set the GLA in floor settings or property edit.</P>
          <P><B>Vacancy metrics:</B> Only leasable types (office, open space, hot desk) count toward vacancy. Meeting rooms, zoom cabins, and event zones are revenue resources and excluded.</P>
          <P><B>Charts:</B> Booking trends, revenue by period, top tenants, coin usage.</P>
        </div>
      ),
    },
    {
      id: "settings",
      title: "Settings & Administration",
      perm: "manage_settings",
      content: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <P><B>Users:</B> Create accounts, assign roles, activate/deactivate, reset passwords (key icon).</P>
          <P><B>Roles:</B> admin, manager, receptionist, owner, tenant. Each role has a set of permissions that can be customized in the Roles tab.</P>
          <P><B>Permissions:</B> 17 granular permissions control what each role can do. Admin always has all permissions. Changes take effect on next login.</P>
          <P><B>Purge:</B> The analytics page has a "Purge Bookings" button (admin only) that deletes all booking data and resets coin balances. Requires password confirmation.</P>
        </div>
      ),
    },
    {
      id: "faq",
      title: "FAQ",
      content: () => {
        const faqs = [
          { q: "I forgot my password", a: "Contact your administrator. They can reset your password from Settings > Users > key icon." },
          { q: "I don't see some menu items", a: "Menu items are filtered by your role and permissions. Contact admin if you need access to additional sections." },
          { q: "Occupancy shows '---' or null", a: "GLA (Gross Leasable Area) is not configured for the building or floor. Admin should set it in property edit or floor settings." },
          { q: "How do coins work?", a: "Tenants receive coins monthly (% of their monthly rate). Coins are spent on meeting room bookings. Balance resets on the 1st of each month." },
          { q: "Which resource types count toward vacancy?", a: "Only Office, Open Space, and Hot Desk. Meeting rooms, zoom cabins, event zones, and amenities are excluded from vacancy calculations." },
          { q: "How is occupancy calculated?", a: "By area (m2): sum of occupied resource areas / floor GLA x 100. This follows BOMA standards. It is NOT a count of occupied vs total resources." },
          { q: "How do I upload a floor plan?", a: "Go to Floor Map, select or create a floor, then click Upload. Supports PNG, JPG, and PDF files." },
          { q: "What does the facade map show?", a: "A photo of the building with color-coded zones per floor. Green = high occupancy, yellow = medium, red = low, gray = not configured. Click a zone to navigate to that floor." },
        ];
        const q = search.toLowerCase();
        const filtered = q ? faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) : faqs;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((f, i) => (
              <div key={i} style={{ padding: "10px 14px", background: "var(--color-gray-50)", borderRadius: 8, border: "1px solid var(--color-gray-100)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)", marginBottom: 4 }}>Q: {f.q}</div>
                <div style={{ fontSize: 13, color: "var(--color-gray-500)", lineHeight: 1.5 }}>{f.a}</div>
              </div>
            ))}
            {filtered.length === 0 && <P style={{ color: "var(--color-gray-400)" }}>No results for "{search}"</P>}
          </div>
        );
      },
    },
  ];

  const visible = sections.filter((s) => !s.perm || hasPermission(s.perm));

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1730", margin: 0 }}>Help</h1>
        <span style={{ padding: "2px 8px", borderRadius: 4, background: "var(--color-gray-100)", color: "var(--color-gray-500)", fontSize: 11, fontWeight: 600 }}>
          CBC Coworking OS
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search help..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-gray-200)", borderRadius: 8, fontSize: 14, marginBottom: 20 }}
      />

      {/* Table of contents */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {visible.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: expanded === s.id ? "1px solid #1F69FF" : "1px solid var(--color-gray-200)",
              background: expanded === s.id ? "#eff6ff" : "white",
              color: expanded === s.id ? "#1F69FF" : "var(--color-gray-500)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((s) => (
          <div key={s.id} style={{ background: "white", border: "1px solid var(--color-gray-200)", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => toggle(s.id)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: "#0A1730" }}>{s.title}</span>
              <span style={{ fontSize: 14, color: "var(--color-gray-400)", transition: "transform 0.2s", transform: expanded === s.id ? "rotate(180deg)" : "" }}>
                ▼
              </span>
            </button>
            {expanded === s.id && (
              <div style={{ padding: "0 18px 16px", borderTop: "1px solid var(--color-gray-100)" }}>
                <div style={{ paddingTop: 12 }}>{s.content()}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ margin: 0, fontSize: 14, color: "var(--color-gray-700)", lineHeight: 1.6, ...style }}>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600, color: "var(--color-gray-900)" }}>{children}</strong>;
}
