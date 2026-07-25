// Supabase Edge Function: generate-network-findings
// Genera insights ejecutivos sobre el desempeño agregado de la red / alcance
// (BU, squad o total). Requiere secret: MYGENASSIST_TOKEN

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MYGENASSIST_URL = "https://chat.int.bayer.com/api/v2/chat/completions";
const MYGENASSIST_MODEL = "gpt-4o-mini";

interface NetworkPayload {
  esRedCompleta?: boolean;
  alcance: {
    descripcion: string;
    distribuidores: number;
    totalPromedio: number;
    totalPromedioRed: number;
  };
  competencias: Array<{
    name: string;
    scopeAvg: number;
    redAvg: number;
    diff: number;
    weight: number;
    min?: number;
    max?: number;
    gap?: number;
  }>;
  pilares?: Array<{
    id: string;
    name: string;
    scopeAvg: number;
    redAvg: number;
    diff: number;
    weight: number;
  }>;
  outliersArriba: Array<{
    nombre: string;
    bu: string;
    squad: string;
    total: number;
    diff: number;
  }>;
  outliersAbajo: Array<{
    nombre: string;
    bu: string;
    squad: string;
    total: number;
    diff: number;
  }>;
  resumenRed?: {
    madurez: {
      alta: number; media: number; baja: number;
      pctAlta: number; pctMedia: number; pctBaja: number;
    };
    dispersion: { min: number; max: number; gap: number; stddev: number };
    buSummary: Array<{ bu: string; count: number; avg: number }>;
    competenciaMasFuerte: { name: string; avg: number } | null;
    competenciaMasDebil:  { name: string; avg: number } | null;
    competenciaMayorDispersion:
      { name: string; min: number; max: number; gap: number } | null;
    topDistribuidores:    Array<{ nombre: string; bu: string; squad: string; total: number }>;
    bottomDistribuidores: Array<{ nombre: string; bu: string; squad: string; total: number }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Método no permitido", 405);
  }

  const token = Deno.env.get("MYGENASSIST_TOKEN");
  if (!token) {
    return errorResponse("MYGENASSIST_TOKEN no configurado como secret", 500);
  }

  let ctx: NetworkPayload;
  try {
    ctx = await req.json();
  } catch (_e) {
    return errorResponse("Body JSON inválido", 400);
  }

  const systemPromptFiltered = [
    "Sos un consultor senior de canal de distribución agrícola.",
    "Analizás el desempeño AGREGADO de un SUBCONJUNTO de la red Bayer (una BU o un squad) y producís insights ejecutivos accionables, en español rioplatense.",
    "",
    "Debés responder EXCLUSIVAMENTE con JSON válido con esta estructura:",
    '{ "sections": [ { "title": "...", "content": "..." } ] }',
    "",
    "Reglas estrictas:",
    "- Exactamente 4 secciones: Posicionamiento del alcance, Fortaleza principal, Brecha crítica, Recomendación estratégica.",
    "- Cada content: 2 a 3 oraciones. Mencioná números concretos del contexto.",
    "- Compará siempre el alcance con el promedio de la red completa.",
    "- Cuando aporte, mencioná en qué PILAR estratégico (Excelencia Comercial, Excelencia Operacional, Experiencia al Cliente / CX, o Digitalización y NMDN) se ubica la fortaleza o la brecha principal, usando el desglose por pilar del contexto.",
    "- Si hay outliers relevantes (arriba o abajo), mencioná al menos uno por nombre para ilustrar.",
    "- No inventes datos. Usá SOLO lo del contexto.",
    "- No repitas el título dentro del content.",
    "- No uses markdown (nada de **, ##, listas, viñetas).",
    "- Tono profesional, directo, orientado a acción.",
  ].join("\n");

  const systemPromptFullRed = [
    "Sos un consultor senior de canal de distribución agrícola.",
    "Analizás la RED COMPLETA de distribuidores Bayer y producís insights ejecutivos accionables, en español rioplatense.",
    "IMPORTANTE: como estás mirando la red completa, NO compares el alcance contra 'la red' (sería tautológico). En su lugar hablá de patrones INTERNOS: dispersión, distribución de madurez, diferencias entre BUs, competencia más fuerte, competencia más débil, referentes y rezagados, oportunidades transversales.",
    "",
    "Debés responder EXCLUSIVAMENTE con JSON válido con esta estructura:",
    '{ "sections": [ { "title": "...", "content": "..." } ] }',
    "",
    "Reglas estrictas:",
    "- Exactamente 4 secciones: Panorama general de la red, Fortaleza principal, Brechas y alertas, Oportunidades y recomendaciones.",
    "- Cada content: 2 a 3 oraciones. Mencioná números concretos del contexto.",
    "- En 'Panorama general de la red' y 'Oportunidades y recomendaciones' usá el desglose por PILAR estratégico (Excelencia Comercial, Excelencia Operacional, Experiencia al Cliente / CX, Digitalización y NMDN) para dar una lectura de alto nivel: qué pilar sostiene la red y cuál está más rezagado.",
    "- Mencioná al menos un distribuidor por nombre entre referentes o rezagados.",
    "- Si hay diferencias entre BUs relevantes, mencionalas.",
    "- No inventes datos. Usá SOLO lo del contexto.",
    "- No repitas el título dentro del content.",
    "- No uses markdown (nada de **, ##, listas, viñetas).",
    "- Tono profesional, directo, orientado a acción.",
  ].join("\n");

  const compsBlock = ctx.competencias
    .slice()
    .sort((a, b) => {
      // En red completa, ordenar por score (peor primero) para destacar brechas
      // En scope filtrado, mantener por magnitud de diff vs red
      if (ctx.esRedCompleta) return a.scopeAvg - b.scopeAvg;
      return Math.abs(b.diff) - Math.abs(a.diff);
    })
    .map((c) => {
      if (ctx.esRedCompleta) {
        const spread = typeof c.gap === "number"
          ? ` · dispersión ${c.gap} pts (min ${c.min}% · max ${c.max}%)`
          : "";
        return `- ${c.name}: ${c.scopeAvg}% promedio · peso ${c.weight}%${spread}`;
      }
      const sign = c.diff > 0 ? "+" : "";
      return `- ${c.name}: alcance ${c.scopeAvg}%, red ${c.redAvg}% (${sign}${c.diff} pts, peso ${c.weight}%)`;
    })
    .join("\n");

  const upsBlock = ctx.outliersArriba.length
    ? ctx.outliersArriba
        .map((o) =>
          `- ${o.nombre} (${o.bu} / ${o.squad}): total ${o.total}%, +${o.diff} pts vs promedio`
        )
        .join("\n")
    : "  (ninguno significativo)";

  const downsBlock = ctx.outliersAbajo.length
    ? ctx.outliersAbajo
        .map((o) =>
          `- ${o.nombre} (${o.bu} / ${o.squad}): total ${o.total}%, ${o.diff} pts vs promedio`
        )
        .join("\n")
    : "  (ninguno significativo)";

  const pilaresBlock = ctx.pilares && ctx.pilares.length
    ? ctx.pilares
        .map((p) => {
          if (ctx.esRedCompleta) {
            return `- ${p.name}: ${p.scopeAvg}% promedio · peso ${p.weight}%`;
          }
          const sign = p.diff > 0 ? "+" : "";
          return `- ${p.name}: alcance ${p.scopeAvg}%, red ${p.redAvg}% (${sign}${p.diff} pts, peso ${p.weight}%)`;
        })
        .join("\n")
    : "";

  let systemPrompt: string;
  let userPrompt: string;

  if (ctx.esRedCompleta && ctx.resumenRed) {
    const r = ctx.resumenRed;
    systemPrompt = systemPromptFullRed;

    const buBlock = r.buSummary.length
      ? r.buSummary
          .map((b) => `- ${b.bu}: ${b.count} distribuidores · promedio ${b.avg}%`)
          .join("\n")
      : "  (sin datos)";

    const topBlock = r.topDistribuidores.length
      ? r.topDistribuidores
          .map((d) => `- ${d.nombre} (${d.bu} / ${d.squad}): ${d.total}%`)
          .join("\n")
      : "  (sin datos)";

    const bottomBlock = r.bottomDistribuidores.length
      ? r.bottomDistribuidores
          .map((d) => `- ${d.nombre} (${d.bu} / ${d.squad}): ${d.total}%`)
          .join("\n")
      : "  (sin datos)";

    userPrompt = [
      "Analizá la RED COMPLETA de distribuidores Bayer evaluados.",
      "",
      `Distribuidores evaluados: ${ctx.alcance.distribuidores}`,
      `Score total promedio de la red: ${ctx.alcance.totalPromedio}%`,
      "",
      "DISTRIBUCIÓN DE MADUREZ:",
      `- Alta (≥80): ${r.madurez.alta} distribuidores (${r.madurez.pctAlta}%)`,
      `- Media (70-79): ${r.madurez.media} distribuidores (${r.madurez.pctMedia}%)`,
      `- Baja (<70): ${r.madurez.baja} distribuidores (${r.madurez.pctBaja}%)`,
      "",
      "DISPERSIÓN DEL SCORE TOTAL:",
      `- Rango: ${r.dispersion.min}% a ${r.dispersion.max}% (gap ${r.dispersion.gap} pts, desvío estándar ${r.dispersion.stddev} pts)`,
      "",
      "AGREGADO POR BU (ordenado de mayor a menor promedio):",
      buBlock,
      "",
      "COMPETENCIAS (peor a mejor, con dispersión interna):",
      compsBlock,
      r.competenciaMayorDispersion
        ? `\nMayor heterogeneidad interna: ${r.competenciaMayorDispersion.name} (${r.competenciaMayorDispersion.gap} pts entre ${r.competenciaMayorDispersion.min}% y ${r.competenciaMayorDispersion.max}%).`
        : "",
      pilaresBlock
        ? "\nDESEMPEÑO POR PILAR ESTRATÉGICO (4 pilares que agrupan las 9 competencias):\n" + pilaresBlock
        : "",
      "",
      "REFERENTES (top 3 por score total):",
      topBlock,
      "",
      "REZAGADOS (bottom 3 por score total):",
      bottomBlock,
      "",
      "OUTLIERS por arriba (>= +10 pts vs promedio de la red):",
      upsBlock,
      "",
      "OUTLIERS por abajo (<= -10 pts vs promedio de la red):",
      downsBlock,
      "",
      "Generá los insights ejecutivos en el formato JSON pedido, siguiendo la estructura de 4 secciones para RED COMPLETA (Panorama general de la red, Fortaleza principal, Brechas y alertas, Oportunidades y recomendaciones).",
    ].filter(Boolean).join("\n");
  } else {
    systemPrompt = systemPromptFiltered;
    const totalDiff = ctx.alcance.totalPromedio - ctx.alcance.totalPromedioRed;
    const posicion = totalDiff >= 5
      ? `${totalDiff} pts por encima de la red`
      : totalDiff <= -5
      ? `${Math.abs(totalDiff)} pts por debajo de la red`
      : "en línea con la red";

    userPrompt = [
      `Analizá el desempeño AGREGADO del siguiente subconjunto de la red Bayer:`,
      "",
      `ALCANCE: ${ctx.alcance.descripcion}`,
      `Distribuidores incluidos: ${ctx.alcance.distribuidores}`,
      `Score total promedio del alcance: ${ctx.alcance.totalPromedio}%`,
      `Score total promedio de la red completa: ${ctx.alcance.totalPromedioRed}%`,
      `Posicionamiento: ${posicion}`,
      "",
      "COMPETENCIAS (alcance vs red completa, ordenadas por magnitud de brecha):",
      compsBlock,
      pilaresBlock
        ? "\nDESEMPEÑO POR PILAR ESTRATÉGICO (4 pilares que agrupan las 9 competencias):\n" + pilaresBlock
        : "",
      "",
      "OUTLIERS POR ARRIBA (>= +10 pts vs promedio del alcance):",
      upsBlock,
      "",
      "OUTLIERS POR ABAJO (<= -10 pts vs promedio del alcance):",
      downsBlock,
      "",
      "Generá los insights ejecutivos en el formato JSON pedido.",
    ].join("\n");
  }

  let aiRes: Response;
  try {
    aiRes = await fetch(MYGENASSIST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MYGENASSIST_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return errorResponse(
      `No se pudo contactar MyGenAssist: ${(e as Error).message}`,
      502,
    );
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    return errorResponse(
      `MyGenAssist devolvió ${aiRes.status}: ${errText.slice(0, 400)}`,
      502,
    );
  }

  const aiData = await aiRes.json();
  const content: string | undefined = aiData?.choices?.[0]?.message?.content;
  if (!content) {
    return errorResponse("MyGenAssist no devolvió contenido", 502);
  }

  let parsed: { sections?: Array<{ title: string; content: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    return errorResponse(
      `MyGenAssist devolvió JSON inválido: ${content.slice(0, 300)}`,
      502,
    );
  }

  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

  return new Response(
    JSON.stringify({
      sections,
      model: MYGENASSIST_MODEL,
      generated_at: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
