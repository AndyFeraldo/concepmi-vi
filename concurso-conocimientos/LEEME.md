# Concurso de Conocimientos · VI CONCEPMI

Sistema en vivo para 4 laptops: **Moderador**, **Delegación A**, **Delegación B** y **Proyector**.

- Aplicación web: `concepmi-vi/concurso-conocimientos/` (se publica junto con la landing, sin tocarla).
- Base de datos: Supabase, proyecto **Concurso-Concepmi**.

## Carpetas

| Ruta | Qué contiene |
|---|---|
| `concepmi-vi/concurso-conocimientos/` | La aplicación (HTML, CSS, JS). Usa los logos y a Wolfito de `concepmi-vi/public/images/`. |
| `concurso-conocimientos/banco-preguntas/` | Banco de 180 preguntas estilo CAPM: Excel, JSON y SQL (**no se publica**: tiene las respuestas). |
| `concurso-conocimientos/supabase/esquema.sql` | Tablas, reglas y funciones del concurso en Supabase. |

## Cómo se usa el día del evento

1. Abrir el enlace en las 4 laptops y elegir la pantalla de cada una (pide el PIN del moderador una sola vez).
2. **Proyector**: hacer clic en "Activar pantalla completa y sonido".
3. **Moderador**: escribir las dos delegaciones → *Guardar nombres* → *Iniciar enfrentamiento*.
4. Al terminar cada ronda → *Lanzar ronda 2* / *Lanzar ronda 3*.
5. Tras la ronda 3 (anuncio a los 10 s en el proyector) → *Guardar y registrar enfrentamiento*.
6. Al final del concurso → *Publicar resultados en vivo* (modo gala en el proyector).

**Antes del concurso real:** cambiar el PIN (botón *Cambiar PIN*; el inicial es `2026`) y, si se hicieron ensayos,
usar *Reiniciar banco* para que las preguntas usadas vuelvan a estar disponibles y *Borrar resultados* para limpiar la tabla.

## Reglas que aplica la base de datos

- Cada ronda: 5 preguntas al azar, las mismas para A y B, que nunca se repiten. 60 s.
- +1 por correcta. Gana la ronda quien tenga más correctas; si empatan, quien envió primero.
- Gana el enfrentamiento quien gane más rondas. Ganador: 20 + correctas. Otro: 10 + correctas.
- Máximo 2 enfrentamientos por delegación (los nombres se comparan sin tildes ni mayúsculas).
- Tabla general: suma de los enfrentamientos; desempate por más respuestas correctas.
- La respuesta correcta nunca sale de Supabase: la calificación se hace dentro de la base.

## Editar las preguntas

Las preguntas viven en `banco-preguntas/fuente/d1.py … d4.py`. Tras editarlas:
`python3 -I banco-preguntas/fuente/generar.py` regenera el Excel, el JSON y `preguntas.sql`,
que se pega en Supabase → SQL Editor (reemplaza las preguntas con el mismo id).
