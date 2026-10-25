// Conexión a Supabase (proyecto "Concurso-Concepmi").
// La clave "anon" es pública por diseño: las reglas de la base de datos impiden
// leer las respuestas correctas o modificar el concurso sin el PIN del moderador.
export const SUPABASE_URL = "https://sczjwiqdktjtulnmnngk.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjemp3aXFka3RqdHVsbm1ubmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODc2MDIsImV4cCI6MjEwNjI2MzYwMn0.Jq3LN0sheR_6Bj8pqBQw4skeYCf_V1R0hDpgQEZwgcE";

// Reglas del concurso (las mismas que aplica la base de datos)
export const SEGUNDOS_RONDA = 60;
export const TOTAL_RONDAS = 3;
export const PREGUNTAS_POR_RONDA = 5;
export const SEGUNDOS_SUSPENSO = 10;   // "Anuncio oficial en…" antes del ganador
export const SEGUNDOS_PREVIA_GALA = 10; // cuenta regresiva antes de revelar la tabla
