# Deploy de la Edge Function `generate-strategic-analysis`

Esta función corre en Supabase, recibe métricas **agregadas** del dashboard (nunca datos individuales de distribuidores) y llama a **MyGenAssist** (IA interna de Bayer) para producir la lectura estratégica.

## 1. Ir al Dashboard de Supabase

Tu proyecto: `olkqjragrvnneubzgqjd`

Link directo → https://supabase.com/dashboard/project/olkqjragrvnneubzgqjd/functions

## 2. Guardar el token de MyGenAssist como Secret

1. En el menú lateral: **Project Settings → Edge Functions → Secrets** (o `Functions → Secrets`).
2. Click en **Add new secret**.
3. Name: `MYGENASSIST_TOKEN`
4. Value: pegar el token que generaste en MyGenAssist.
5. **Save**.

> El token nunca sale de Supabase. Ni el frontend ni el navegador lo ven. Solo la Edge Function corriendo en Supabase lo lee vía `Deno.env.get('MYGENASSIST_TOKEN')`.

## 3. Crear la Edge Function

1. En el menú lateral: **Edge Functions**.
2. Click en **Deploy a new function** (o **Create a new function**).
3. Function name: `generate-strategic-analysis` (exactamente así, sin guiones distintos).
4. En el editor web, borrar el contenido y pegar el archivo:
   `supabase/functions/generate-strategic-analysis/index.ts`
5. Verify JWT: **ON** (recomendado — solo usuarios logueados podrán llamarla).
6. **Deploy function**.

## 4. Probar

En la app productiva:
1. Login como admin.
2. Ir al tab **Dashboard**.
3. En la card *"Lectura estratégica (IA)"* → click en **Regenerar**.
4. Deberías ver *"Generando análisis con IA..."* y a los pocos segundos aparecen 5-6 párrafos con los datos reales de tu scope.
5. El pie de la card mostrará: `· IA (gpt-4o-mini) · dd/MM HH:mm`.

Si aparece `· IA no disponible, usando motor local`, revisar:
- Secret cargado con el nombre exacto `MYGENASSIST_TOKEN`.
- Function con nombre exacto `generate-strategic-analysis`.
- Logs de la function en el Dashboard → Edge Functions → tu function → **Logs**.

## 5. Actualizar la función después

Cada vez que edites el archivo local `supabase/functions/generate-strategic-analysis/index.ts`, tenés que **re-deployar**:
- Dashboard → Edge Functions → `generate-strategic-analysis` → **Edit** → pegar la nueva versión → **Deploy**.

Cuando puedas instalar la CLI (`scoop install supabase` o `npm i -g supabase`), esto se automatiza con:
```powershell
supabase link --project-ref olkqjragrvnneubzgqjd
supabase functions deploy generate-strategic-analysis
```

## Seguridad – qué se envía a MyGenAssist

Solo se envían **números agregados** del scope seleccionado:
- Padrón total / con assessment / sin assessment / % cobertura.
- Score promedio, cantidad de distribuidores >= 80% y <= 69%.
- Promedios y pesos de las 9 competencias.
- Top 3 y bottom 3 squads por % de cobertura.

**No se envían:** razones sociales, CUITs, respuestas individuales, IDs de usuarios, ni el payload de ningún assessment puntual.
