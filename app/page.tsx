"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = document.cookie.match(/cbc_token=([^;]+)/)?.[1];
    if (token) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#13232E",
        color: "white",
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>CBC</div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}>
          Coworking OS
        </div>
        <div style={{ marginTop: 16, color: "rgba(255,255,255,0.4)" }}>Loading...</div>
      </div>
    </div>
  );
}
