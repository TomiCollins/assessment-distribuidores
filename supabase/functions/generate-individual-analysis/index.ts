// Supabase Edge Function: generate-individual-analysis
// Genera una lectura ejecutiva IA para un distribuidor específico.
// Requiere secret: MYGENASSIST_TOKEN

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MYGENASSIST_URL = "https://chat.int.bayer.com/api/v2/chat/completions";
const MYGENASSIST_MODEL = "gpt-4o-mini";

interface IndividualPayload {
  distribuidor: { nombre: string; bu: string; squad: string };
  scoreTotal: number;
  avgRed: number;
  competencias: Array<{
    name: string;
    score: number;
    weight: number;
    avgRed: number;
  }>;
  pilares?: Array<{
    id: string;
    name: string;
    score: number;
    avgRed: number;
    weight: number;
  }>;
  fortalezasClave?: Array<{
    competencia: string;
    aspecto: string;
    ponderacion: number;
  }>;
  brechasClave?: Array<{
    competencia: string;
    aspecto: string;
    ponderacion: number;
  }>;
  observaciones?: Array<{
    competencia: string;
    aspecto: string;
    texto: string;
  }>;
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

  let ctx: IndividualPayload;
  try {
    ctx = await req.json();
  } catch (_e) {
    return errorResponse("Body JSON inválido", 400);
  }

  const tieneObservaciones = !!(ctx.observaciones && ctx.observaciones.length > 0);
  const tienePilares = !!(ctx.pilares && ctx.pilares.length > 0);

  const seccionesEsperadas = tieneObservaciones
    ? "Diagnóstico general, Fortalezas destacadas, Prioridades de mejora, Lectura de las observaciones, Acciones sugeridas"
    : "Diagnóstico general, Fortalezas destacadas, Prioridades de mejora, Acciones sugeridas";

  const cantidadSecciones = tieneObservaciones ? 5 : 4;

  const systemPrompt = [
    "Sos un consultor senior de canal de distribución agrícola.",
    "Analizás el desempeño de un distribuidor Bayer específico y producís una lectura ejecutiva breve, clara y accionable, en español rioplatense.",
    "",
    "Debés responder EXCLUSIVAMENTE con JSON válido con esta estructura:",
    '{ "sections": [ { "title": "...", "content": "..." } ] }',
    "",
    "Reglas estrictas:",
    `- Exactamente ${cantidadSecciones} secciones, en este orden y con estos títulos: ${seccionesEsperadas}.`,
    "- Cada content: 2 a 4 oraciones. Mencioná números concretos del contexto cuando aplique.",
    "- Compará el score del distribuidor con el promedio de la red cuando aporte contexto.",
    tienePilares
      ? "- En 'Diagnóstico general' mencioná explícitamente cómo se posiciona el distribuidor en los 4 pilares estratégicos (Excelencia Comercial, Excelencia Operacional, Experiencia al Cliente / CX, Digitalización y NMDN), destacando el pilar más fuerte y el más débil."
      : "",
    "- En 'Fortalezas destacadas' y 'Prioridades de mejora' mencioná no sólo las competencias sino ejemplos específicos (aspectos concretos) del listado provisto.",
    tieneObservaciones
      ? "- En 'Lectura de las observaciones' sintetizá los temas o patrones que aparecen en las observaciones cargadas por el evaluador; identificá al menos un patrón o tema recurrente, no las cites textualmente."
      : "",
    "- 'Acciones sugeridas' DEBE contener exactamente 3 acciones concretas y ejecutables, cada una formulada como verbo en infinitivo o imperativo + qué + resultado esperado o plazo (ej: 'Definir un plan comercial trimestral con metas por producto'). Separá las 3 acciones con punto y seguido, no con viñetas ni saltos de línea.",
    "- No inventes datos. Usá SOLO lo del contexto.",
    "- No repitas el título dentro del content.",
    "- No uses markdown (nada de **, ##, listas, viñetas).",
    "- Tono profesional, directo, orientado a acción.",
  ].filter(Boolean).join("\n");

  const compsBlock = ctx.competencias
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((c) =>
      `- ${c.name}: ${c.score}% (red ${c.avgRed}%, peso ${c.weight}%)`
    )
    .join("\n");

  const pilaresBlock = tienePilares
    ? ctx.pilares!
        .map((p) =>
          `- ${p.name}: ${p.score}% (red ${p.avgRed}%, peso ${p.weight}%)`
        )
        .join("\n")
    : "";

  const fortalezasBlock = ctx.fortalezasClave && ctx.fortalezasClave.length
    ? ctx.fortalezasClave
        .map((f) => `- ${f.competencia} · ${f.aspecto} (peso ${f.ponderacion}%)`)
        .join("\n")
    : "  (sin fortalezas específicas destacadas)";

  const brechasBlock = ctx.brechasClave && ctx.brechasClave.length
    ? ctx.brechasClave
        .map((b) => `- ${b.competencia} · ${b.aspecto} (peso ${b.ponderacion}%)`)
        .join("\n")
    : "  (sin brechas específicas destacadas)";

  const observacionesBlock = tieneObservaciones
    ? ctx.observaciones!
        .map((o) => `- [${o.competencia} · ${o.aspecto}] ${o.texto}`)
        .join("\n")
    : "";

  const diff = ctx.scoreTotal - ctx.avgRed;
  const posicion = diff >= 5
    ? `${diff} pts por encima de la red`
    : diff <= -5
    ? `${Math.abs(diff)} pts por debajo de la red`
    : "en línea con la red";

  const userPromptParts = [
    `Analizá el desempeño del siguiente distribuidor Bayer:`,
    "",
    `DISTRIBUIDOR: ${ctx.distribuidor.nombre}`,
    `BU / Squad: ${ctx.distribuidor.bu} / ${ctx.distribuidor.squad}`,
    "",
    "SCORE TOTAL:",
    `- Score del distribuidor: ${ctx.scoreTotal}%`,
    `- Promedio de la red en alcance: ${ctx.avgRed}%`,
    `- Posicionamiento: ${posicion}`,
    "",
    "DESGLOSE POR COMPETENCIA (score, promedio red, peso ponderado):",
    compsBlock,
    "",
    "FORTALEZAS ESPECÍFICAS (preguntas con evaluación 'alto' de mayor peso):",
    fortalezasBlock,
    "",
    "BRECHAS ESPECÍFICAS (preguntas con evaluación 'bajo' de mayor peso):",
    brechasBlock,
  ];

  if (tienePilares) {
    userPromptParts.push(
      "",
      "DESGLOSE POR PILAR ESTRATÉGICO (4 pilares que agrupan las 9 competencias):",
      pilaresBlock,
    );
  }

  if (tieneObservaciones) {
    userPromptParts.push(
      "",
      "OBSERVACIONES CARGADAS POR EL EVALUADOR (usalas para 'Lectura de las observaciones'):",
      observacionesBlock,
    );
  }

  userPromptParts.push(
    "",
    `Generá la lectura ejecutiva en el formato JSON pedido con exactamente ${cantidadSecciones} secciones en el orden indicado.`,
  );

  const userPrompt = userPromptParts.join("\n");

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
        max_tokens: 1100,
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
