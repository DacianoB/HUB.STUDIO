"use client";

import { createContext, useContext } from "react";

type SalaRouteSharedData = {
  classId: string;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  userData: any;
  singleProduct: any[];
  moduleSelected: any;
  moduleSelectedData: any;
  aulaData: any;
  turmaMaterial: any;
  turmaExercicio: any;
};

const SalaRouteContext = createContext<SalaRouteSharedData | null>(null);

export function SalaRouteProvider({
  value,
  children,
}: {
  value: SalaRouteSharedData;
  children: React.ReactNode;
}) {
  return (
    <SalaRouteContext.Provider value={value}>
      {children}
    </SalaRouteContext.Provider>
  );
}

export function useSalaRouteData() {
  const context = useContext(SalaRouteContext);
  if (!context) {
    throw new Error("useSalaRouteData must be used inside SalaRouteProvider");
  }
  return context;
}
