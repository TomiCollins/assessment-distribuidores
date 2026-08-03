// Supabase Edge Function: generate-strategic-analysis
// Recibe métricas agregadas del dashboard de assessment de distribuidores
// y devuelve una lectura estratégica generada por MyGenAssist (Bayer).
//
// Requiere el secret: MYGENASSIST_TOKEN
// Se despliega desde el Dashboard de Supabase o con `supabase functions deploy`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MYGENASSIST_URL = "https://chat.int.bayer.com/api/v2/chat/completions";
const MYGENASSIST_MODEL = "gpt-4o-mini";

interface StrategicPayload {
  totalPadron: number;
  conAssessment: number;
  sinAssessment: number;
  coverage: number;
  evaluados: number;
  avgScore: number;
  highCount: number;
  lowCount: number;
  buCount: number;
  squadCount: number;
  competencias: Array<{ name: string; avg: number; weight: number }>;
  pilares?: Array<{ id: string; name: string; avg: number; weight: number }>;
  squadsMejores: Array<{ squad: string; pct: number }>;
  squadsPeores: Array<{ squad: string; pct: number }>;
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
    return errorResponse(
      "MYGENASSIST_TOKEN no configurado como secret",
      500,
    );
  }

  let ctx: StrategicPayload;
  try {
    ctx = await req.json();
  } catch (_e) {
    return errorResponse("Body JSON inválido", 400);
  }

  const systemPrompt = [
    "Sos un consultor senior de canal de distribución agrícola.",
    "Tu trabajo es analizar métricas agregadas del assessment de distribuidores Bayer",
    "y producir una lectura estratégica ejecutiva en español rioplatense, clara y accionable.",
    "",
    "Debés responder EXCLUSIVAMENTE con JSON válido con esta estructura:",
    '{ "sections": [ { "title": "...", "content": "..." } ] }',
    "",
    "Reglas estrictas:",
    "- Exactamente 5 a 6 secciones: Panorámica general, Cobertura territorial, Lectura por pilar, Fortalezas y brechas, Digitalización, Recomendación comercial.",
    "- En la sección 'Lectura por pilar' analizá los 3 pilares estratégicos (Excelencia Comercial, Excelencia Operacional, Digitalización y NMDN) mencionando el score de cada uno y qué implica esa lectura agregada para la red.",
    "- Cada content: 2 a 4 oraciones. Menciona números concretos del contexto.",
    "- No inventes datos ni distribuidores. Usá solo los que aparecen en el contexto.",
    "- No repitas el título dentro del content.",
    "- No uses markdown (nada de **, ##, listas, viñetas).",
    "- Tono profesional, directo, orientado a acción.",
  ].join("\n");

  const pilaresBlock = (ctx.pilares && ctx.pilares.length)
    ? [
      "",
      "DESEMPEÑO POR PILAR ESTRATÉGICO (3 pilares que agrupan las 9 competencias):",
      ctx.pilares
        .map((p) => `- ${p.name}: ${p.avg}% (peso ${p.weight}%)`)
        .join("\n"),
    ].join("\n")
    : "";

  const userPrompt = [
    "Analizá estas métricas del dashboard de assessments de distribuidores Bayer:",
    "",
    "COBERTURA DEL PADRÓN EN ALCANCE:",
    `- Padrón total en alcance: ${ctx.totalPadron}`,
    `- Con assessment cargado: ${ctx.conAssessment}`,
    `- Sin assessment (pendientes): ${ctx.sinAssessment}`,
    `- % de cobertura: ${ctx.coverage}%`,
    "",
    "PERFORMANCE DE LA RED:",
    `- Distribuidores evaluados: ${ctx.evaluados}`,
    `- Score promedio ponderado: ${ctx.avgScore}%`,
    `- Distribuidores con score >= 80%: ${ctx.highCount}`,
    `- Distribuidores con score <= 69%: ${ctx.lowCount}`,
    `- BUs / Squads cubiertos: ${ctx.buCount} / ${ctx.squadCount}`,
    "",
    "DESEMPEÑO POR COMPETENCIA (nombre, promedio, peso ponderado):",
    ctx.competencias
      .map((c) => `- ${c.name}: ${c.avg}% (peso ${c.weight}%)`)
      .join("\n"),
    pilaresBlock,
    "",
    "SQUADS CON MAYOR AVANCE DE CARGA:",
    ctx.squadsMejores.map((s) => `- ${s.squad}: ${s.pct}%`).join("\n") ||
      "- (sin datos)",
    "",
    "SQUADS CON MAYOR DEUDA DE CARGA:",
    ctx.squadsPeores.map((s) => `- ${s.squad}: ${s.pct}%`).join("\n") ||
      "- (sin datos)",
    "",
    "Generá la lectura estratégica en el formato JSON pedido.",
  ].join("\n");

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
        max_tokens: 900,
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
