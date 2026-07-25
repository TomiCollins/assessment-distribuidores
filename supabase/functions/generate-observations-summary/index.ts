// Supabase Edge Function: generate-observations-summary
// Sintetiza las observaciones cargadas por un distribuidor en las preguntas
// de una competencia específica del assessment.
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

interface ObsPayload {
  distribuidor: { nombre: string; bu: string; squad: string };
  competencia: string;
  observaciones: Array<{
    id: string;
    aspecto: string;
    nivel: string;
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

  let ctx: ObsPayload;
  try {
    ctx = await req.json();
  } catch (_e) {
    return errorResponse("Body JSON inválido", 400);
  }

  if (!ctx.observaciones?.length) {
    return errorResponse("No se recibieron observaciones para resumir", 400);
  }

  const systemPrompt = [
    "Sos un consultor senior de canal de distribución agrícola.",
    "Recibís las observaciones cualitativas que un distribuidor Bayer cargó en las preguntas de una competencia específica del assessment.",
    "Tu tarea es producir una SÍNTESIS ejecutiva breve, clara y accionable, en español rioplatense.",
    "",
    "Debés responder EXCLUSIVAMENTE con JSON válido con esta estructura:",
    '{ "summary": "texto plano de 2 a 4 párrafos separados por doble salto de línea" }',
    "",
    "Reglas estrictas:",
    "- 2 a 4 párrafos, separados por una línea en blanco.",
    "- Primer párrafo: síntesis general de lo que dicen las observaciones.",
    "- Párrafos siguientes: agrupar temas comunes, señalar preocupaciones, oportunidades o brechas mencionadas.",
    "- Último párrafo: 1 o 2 recomendaciones accionables surgidas de lo que el distribuidor comentó.",
    "- No inventes: usá SOLO lo que aparece en las observaciones.",
    "- No repitas literal cada observación; sintetizá.",
    "- No uses markdown (ni **, ni ##, ni listas, ni viñetas).",
    "- Tono profesional, directo, orientado a acción.",
  ].join("\n");

  const obsBlock = ctx.observaciones
    .map((o) =>
      `- [${o.id}] ${o.aspecto} (nivel ${o.nivel}): "${o.texto.replace(/"/g, "'")}"`
    )
    .join("\n");

  const userPrompt = [
    `Distribuidor: ${ctx.distribuidor.nombre}`,
    `BU / Squad: ${ctx.distribuidor.bu} / ${ctx.distribuidor.squad}`,
    `Competencia: ${ctx.competencia}`,
    "",
    `Observaciones cargadas (${ctx.observaciones.length}):`,
    obsBlock,
    "",
    "Generá la síntesis ejecutiva en el formato JSON pedido.",
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
        max_tokens: 600,
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

  let parsed: { summary?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    return errorResponse(
      `MyGenAssist devolvió JSON inválido: ${content.slice(0, 300)}`,
      502,
    );
  }

  const summary = (parsed.summary || "").trim();
  if (!summary) {
    return errorResponse("La IA no devolvió una síntesis utilizable", 502);
  }

  return new Response(
    JSON.stringify({
      summary,
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
