"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";

type UseCourseRouteDataInput = {
  courseSigla: string;
  useInitSeed?: boolean;
};

const parseDur = (d?: string | null | undefined) => {
  if (!d) return 0;
  const parts = String(d)
    .split(":")
    .map((x) => Number(x));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3)
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return 0;
};

export function useCourseRouteData({
  courseSigla,
  useInitSeed = false,
}: UseCourseRouteDataInput) {
  const { data: initialProductData } = api.post.course.getProdutosInit.useQuery(
    undefined,
    {
      enabled: useInitSeed,
    },
  );

  const { data: productData, refetch: refetchProducts } =
    api.post.course.getProdutos.useQuery(undefined, {
      placeholderData: useInitSeed ? (initialProductData ?? []) : undefined,
    });

  const singleProduct = useMemo(
    () =>
      ((productData?.filter((produto: any) => produto.SIGLA === courseSigla) ??
        []) as any[]),
    [courseSigla, productData],
  );

  const {
    data: stepData,
    isLoading: isLoadingSteps,
    refetch: refetchEtapas,
  } = api.post.course.getEtapas.useQuery(
    {
      id: courseSigla,
      liberado: singleProduct[0]?.OWNED || false,
      free: singleProduct[0]?.PRECO?.FREE || false,
    },
    {
      enabled: Boolean(singleProduct[0]),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: true,
    },
  );

  const modulesStep = useMemo(() => {
    const byId: Record<string, { ID: any; NOME: string; STEPS: any[] }> = {};
    (stepData || []).forEach((s: any) => {
      const key = String(s?.MODULO ?? "");
      if (!byId[key]) {
        const nomeInferido =
          (s as any)?.MODULONOME ||
          (s?.MODULO === 0 ? "INTRODUÇÃO" : `MÓDULO ${s?.MODULO}`);
        byId[key] = { ID: s?.MODULO, NOME: String(nomeInferido), STEPS: [] };
      }
      byId[key].STEPS.push(s);
    });
    return Object.values(byId)
      .sort((a: any, b: any) => Number(a?.ID ?? 0) - Number(b?.ID ?? 0))
      .map((m: any) => ({
        ID: m.ID,
        NOME: m.NOME,
        STEPS: (m.STEPS || []).sort(
          (a: any, b: any) =>
            Number(a?.ORDEM ?? a?.ID ?? 0) - Number(b?.ORDEM ?? b?.ID ?? 0),
        ),
      }));
  }, [stepData]);

  const totals = useMemo(() => {
    const totalModules = (modulesStep || []).length;
    const totalLessons = (stepData || []).length;
    const seconds = (stepData || []).reduce(
      (acc: number, s: any) => acc + parseDur(s?.DURACAO),
      0,
    );
    const materials = (stepData || []).filter((s: any) => !!s?.MATERIAL).length;
    return { totalModules, totalLessons, seconds, materials };
  }, [modulesStep, stepData]);

  return {
    initialProductData,
    productData,
    singleProduct,
    stepData: stepData || [],
    isLoadingSteps,
    refetchProducts,
    refetchEtapas,
    modulesStep,
    totals,
  };
}
