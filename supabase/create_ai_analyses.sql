-- =========================================================
-- Tabla para persistir las lecturas ejecutivas generadas por IA
--   (estratégica, hallazgos de red y lectura individual)
-- Se guarda 1 fila por generación; el cliente lee la más reciente
-- filtrando por kind + scope_key, y compara payload_hash para
-- decidir si el resultado sigue vigente o hay que regenerar.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text        NOT NULL CHECK (kind IN ('strategic', 'network_findings', 'individual')),
  scope_key      text        NOT NULL,                                -- ej: "bu||squad" o "assessment_id"
  assessment_id  uuid        NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  payload_hash   text        NOT NULL,                                -- huella del input; si cambia, se regenera
  sections       jsonb       NOT NULL,                                -- [{title, content}]
  model          text        NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índice compuesto para el patrón de lectura habitual: "última fila para este (user, kind, scope_key)"
CREATE INDEX IF NOT EXISTS ai_analyses_lookup_idx
  ON public.ai_analyses (user_id, kind, scope_key, generated_at DESC);

-- Índice para las lecturas del admin (recorren muchos user_id)
CREATE INDEX IF NOT EXISTS ai_analyses_admin_idx
  ON public.ai_analyses (kind, scope_key, generated_at DESC);

-- =========================================================
-- Row Level Security
-- =========================================================
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

-- SELECT: el dueño ve las suyas; el admin ve todas.
DROP POLICY IF EXISTS ai_analyses_select ON public.ai_analyses;
CREATE POLICY ai_analyses_select
  ON public.ai_analyses
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- INSERT: sólo puede insertar filas propias.
DROP POLICY IF EXISTS ai_analyses_insert ON public.ai_analyses;
CREATE POLICY ai_analyses_insert
  ON public.ai_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: el dueño puede borrar las suyas (por si querés "regenerar duro").
DROP POLICY IF EXISTS ai_analyses_delete ON public.ai_analyses;
CREATE POLICY ai_analyses_delete
  ON public.ai_analyses
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- (No definimos UPDATE: cada regeneración crea una fila nueva; el histórico queda.)

-- =========================================================
-- Verificación rápida (opcional, comentada)
-- =========================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'ai_analyses';
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.ai_analyses'::regclass;
