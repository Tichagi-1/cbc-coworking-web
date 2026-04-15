"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Cookies from "js-cookie";
import { api, PROPERTY_COOKIE } from "@/lib/api";
import type { Building } from "@/lib/types";

interface PropertyCtx {
  propertyId: number;
  propertyName: string;
  properties: Building[];
  setPropertyId: (id: number) => void;
  loading: boolean;
}

const PropertyContext = createContext<PropertyCtx>({
  propertyId: 1,
  propertyName: "",
  properties: [],
  setPropertyId: () => {},
  loading: true,
});

export function useProperty() {
  return useContext(PropertyContext);
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Building[]>([]);
  const [propertyId, setPropertyIdState] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Building[]>("/properties/")
      .then((r) => {
        const list = r.data;
        setProperties(list);

        const saved = Cookies.get(PROPERTY_COOKIE);
        const savedId = saved ? parseInt(saved, 10) : null;

        if (savedId && list.some((p) => p.id === savedId)) {
          setPropertyIdState(savedId);
        } else if (list.length > 0) {
          setPropertyIdState(list[0].id);
          Cookies.set(PROPERTY_COOKIE, String(list[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setPropertyId(id: number) {
    setPropertyIdState(id);
    Cookies.set(PROPERTY_COOKIE, String(id));
  }

  const current = properties.find((p) => p.id === propertyId);

  return (
    <PropertyContext.Provider
      value={{
        propertyId,
        propertyName: current?.name || "",
        properties,
        setPropertyId,
        loading,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}
