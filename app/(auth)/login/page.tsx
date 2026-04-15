"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { api, TOKEN_COOKIE, ROLE_COOKIE, NAME_COOKIE, PERMS_COOKIE } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("CBC");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    api.get<Record<string, string>>("/settings").then((r) => {
      if (r.data.company_name) setCompanyName(r.data.company_name);
      if (r.data.logo_url) setLogoUrl(r.data.logo_url);
    }).catch(() => {});
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // FastAPI OAuth2PasswordRequestForm expects URL-encoded form data
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const res = await api.post<AuthResponse>("/auth/token", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      Cookies.set(TOKEN_COOKIE, res.data.access_token, { expires: 7, sameSite: "lax" });
      Cookies.set(ROLE_COOKIE, res.data.role, { expires: 7, sameSite: "lax" });
      Cookies.set(NAME_COOKIE, res.data.name, { expires: 7, sameSite: "lax" });
      Cookies.set(PERMS_COOKIE, JSON.stringify(res.data.permissions || []), { expires: 7, sameSite: "lax" });

      const role = res.data.role;
      if (role === "tenant") {
        router.push("/dashboard/workspace");
      } else {
        router.push("/dashboard/properties");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Login failed. Check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: dark brand panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-2/5 bg-cbc-midnight text-white flex-col justify-between p-12">
        <div>
          {logoUrl ? (
            <img
              src={logoUrl.startsWith("http") ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL || ""}${logoUrl}`}
              alt={companyName}
              style={{ height: 48, objectFit: "contain" }}
            />
          ) : (
            <div className="text-3xl font-bold tracking-tight">{companyName}</div>
          )}
          <div className="text-sm uppercase tracking-widest text-gray-400 mt-1">
            Coworking OS
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">
            Manage every desk,
            <br />
            every meeting,
            <br />
            every coin.
          </h1>
          <p className="text-gray-400 max-w-sm">
            Property management for Modera Coworking — built for the people who
            run the floor.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          © {new Date().getFullYear()} CBC Coworking
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-white">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-500 mt-1">
              Use your CBC Estate staff or tenant credentials.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-11 text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0, color: "#9ca3af", display: "flex",
                  }}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
