// Núcleo compartido: conexión, estado en vivo, hora del servidor, PIN y utilidades de UI.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

/* ---------------- Conexión ----------------
   En producción se usa Supabase. Las pruebas automáticas inyectan
   window.__CONCURSO_BACKEND__ con la misma interfaz. */
function backendSupabase() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return {
    async estado() {
      const { data, error } = await sb.from("estado").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
    async enfrentamientos() {
      const { data, error } = await sb.from("enfrentamientos").select("*").eq("anulado", false).order("creado", { ascending: true });
      if (error) throw error;
      return data;
    },
    async rpc(nombre, args) {
      const { data, error } = await sb.rpc(nombre, args || {});
      if (error) throw new Error(error.message);
      return data;
    },
    escuchar({ alEstado, alEnfrentamientos, alConexion }) {
      sb.channel("bd")
        .on("postgres_changes", { event: "*", schema: "public", table: "estado" }, (p) => p.new && p.new.id && alEstado(p.new))
        .on("postgres_changes", { event: "*", schema: "public", table: "enfrentamientos" }, () => alEnfrentamientos())
        .subscribe((s) => alConexion(s === "SUBSCRIBED"));
    },
    sala(rol, { alPresencia, alProgreso }) {
      const canal = sb.channel("sala", { config: { presence: { key: rol + ":" + Math.random().toString(36).slice(2, 8) } } });
      canal
        .on("presence", { event: "sync" }, () => alPresencia(Object.keys(canal.presenceState()).map((k) => k.split(":")[0])))
        .on("broadcast", { event: "progreso" }, ({ payload }) => alProgreso(payload))
        .subscribe(async (s) => { if (s === "SUBSCRIBED") await canal.track({ rol, desde: Date.now() }); });
      return { progreso: (payload) => canal.send({ type: "broadcast", event: "progreso", payload }) };
    },
  };
}

export const backend = window.__CONCURSO_BACKEND__ || backendSupabase();

/* ---------------- Hora del servidor ----------------
   Las 4 laptops pueden tener relojes distintos: se corrige con la hora de la base. */
let desfase = 0;
export const ahora = () => Date.now() + desfase;
async function sincronizarHora() {
  let mejor = null;
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const srv = new Date(await backend.rpc("servidor_ahora")).getTime();
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (!mejor || rtt < mejor.rtt) mejor = { rtt, desfase: srv - (t0 + t1) / 2 };
    } catch { /* se reintenta en el próximo ciclo */ }
  }
  if (mejor) desfase = mejor.desfase;
}

/* ---------------- Estado en vivo ---------------- */
let estado = null;
let enfrentamientos = [];
let conectado = false;
const oyentesEstado = new Set();
const oyentesEnf = new Set();
const oyentesConexion = new Set();

export const estadoActual = () => estado;
export const enfrentamientosActuales = () => enfrentamientos;

export function alEstado(fn) { oyentesEstado.add(fn); if (estado) fn(estado); return () => oyentesEstado.delete(fn); }
export function alEnfrentamientos(fn) { oyentesEnf.add(fn); fn(enfrentamientos); return () => oyentesEnf.delete(fn); }
export function alConexion(fn) { oyentesConexion.add(fn); fn(conectado); return () => oyentesConexion.delete(fn); }

function aplicarEstado(e) {
  // Ignora eventos viejos que lleguen desordenados
  if (estado && e.actualizado && estado.actualizado && new Date(e.actualizado) < new Date(estado.actualizado)) return;
  estado = e;
  oyentesEstado.forEach((f) => f(estado));
}
export async function recargarEstado() {
  try { aplicarEstado(await backend.estado()); } catch (err) { console.warn("estado", err); }
}
export async function recargarEnfrentamientos() {
  try { enfrentamientos = await backend.enfrentamientos(); oyentesEnf.forEach((f) => f(enfrentamientos)); } catch (err) { console.warn("enfrentamientos", err); }
}
function marcarConexion(v) { conectado = v; oyentesConexion.forEach((f) => f(v)); if (v) { recargarEstado(); recargarEnfrentamientos(); } }

let iniciado = false;
export async function iniciarNucleo() {
  if (iniciado) return;
  iniciado = true;
  backend.escuchar({ alEstado: aplicarEstado, alEnfrentamientos: recargarEnfrentamientos, alConexion: marcarConexion });
  await Promise.all([sincronizarHora(), recargarEstado(), recargarEnfrentamientos()]);
  // Red de seguridad: si se pierde un evento en tiempo real, se corrige solo
  setInterval(recargarEstado, 8000);
  setInterval(sincronizarHora, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { recargarEstado(); recargarEnfrentamientos(); } });
}

/* ---------------- Llamadas al servidor ---------------- */
export async function llamar(nombre, args) {
  try {
    return await backend.rpc(nombre, args);
  } catch (err) {
    const msg = String(err.message || err).replace(/^.*?ERROR:\s*/, "");
    throw new Error(msg);
  }
}

/* ---------------- PIN del moderador (por pestaña) ---------------- */
const CLAVE_PIN = "concurso-pin";
const CLAVE_PANTALLA = "concurso-pantalla";
export const pinGuardado = () => { try { return sessionStorage.getItem(CLAVE_PIN) || ""; } catch { return ""; } };
export const guardarPin = (p) => { try { sessionStorage.setItem(CLAVE_PIN, p); } catch {} };
export const pantallaAutorizada = () => { try { return sessionStorage.getItem(CLAVE_PANTALLA) || ""; } catch { return ""; } };
export const autorizarPantalla = (r) => { try { sessionStorage.setItem(CLAVE_PANTALLA, r); } catch {} };
export const olvidarPantalla = () => { try { sessionStorage.removeItem(CLAVE_PANTALLA); } catch {} };

/* ---------------- Tabla general ---------------- */
export function normalizar(t) {
  return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

// Suma los enfrentamientos de cada delegación. Desempate: más correctas, luego más victorias.
export function calcularTabla(enfs) {
  const mapa = new Map();
  const fila = (clave, nombre) => {
    if (!mapa.has(clave)) mapa.set(clave, { clave, nombre, partidos: [], total: 0, correctas: 0, victorias: 0 });
    return mapa.get(clave);
  };
  for (const e of enfs) {
    const a = fila(e.clave_a, e.nombre_a), b = fila(e.clave_b, e.nombre_b);
    a.partidos.push({ pts: e.puntaje_a, gano: e.ganador === "A", rival: e.nombre_b });
    b.partidos.push({ pts: e.puntaje_b, gano: e.ganador === "B", rival: e.nombre_a });
    a.total += e.puntaje_a; b.total += e.puntaje_b;
    a.correctas += e.correctas_a; b.correctas += e.correctas_b;
    if (e.ganador === "A") a.victorias++; else b.victorias++;
  }
  return [...mapa.values()]
    .sort((x, y) => y.total - x.total || y.correctas - x.correctas || y.victorias - x.victorias || x.nombre.localeCompare(y.nombre))
    .map((f, i) => ({ ...f, puesto: i + 1 }));
}

export function jugadosPor(enfs, nombre) {
  const c = normalizar(nombre);
  if (!c) return 0;
  return enfs.filter((e) => e.clave_a === c || e.clave_b === c).length;
}

/* ---------------- Utilidades de UI ---------------- */
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export const seg = (ms) => (ms == null ? "--" : (Math.round(ms / 100) / 10).toFixed(1).replace(".0", "") + " s");
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

export function aviso(texto, tipo = "info") {
  let cont = $(".avisos");
  if (!cont) { cont = document.createElement("div"); cont.className = "avisos"; document.body.append(cont); }
  const el = document.createElement("div");
  el.className = "aviso aviso--" + tipo;
  el.innerHTML = (tipo === "error" ? ICONOS.alerta : tipo === "ok" ? ICONOS.check : ICONOS.info) + `<div>${esc(texto)}</div>`;
  cont.append(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; setTimeout(() => el.remove(), 400); }, tipo === "error" ? 6000 : 3500);
}

// Modal de confirmación. Devuelve true/false (o el texto escrito si se pide confirmación escrita).
export function confirmar({ titulo, texto, si = "Confirmar", no = "Cancelar", peligro = false, escribir = null }) {
  return new Promise((ok) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${esc(titulo)}</h3>
        <p>${texto}</p>
        ${escribir ? `<input class="entrada" id="m-escribir" placeholder="Escribe ${esc(escribir)}" autocomplete="off" />` : ""}
        <div class="modal__acciones">
          <button class="btn btn--fantasma" data-r="0">${esc(no)}</button>
          <button class="btn ${peligro ? "btn--peligro" : "btn--primario"}" data-r="1" ${escribir ? "disabled" : ""}>${esc(si)}</button>
        </div>
      </div>`;
    document.body.append(fondo);
    const btnSi = fondo.querySelector('[data-r="1"]');
    const entrada = fondo.querySelector("#m-escribir");
    if (entrada) {
      entrada.addEventListener("input", () => { btnSi.disabled = entrada.value.trim().toUpperCase() !== escribir; });
      setTimeout(() => entrada.focus(), 50);
    } else setTimeout(() => btnSi.focus(), 50);
    const cerrar = (v) => { fondo.remove(); document.removeEventListener("keydown", tecla); ok(v); };
    const tecla = (e) => { if (e.key === "Escape") cerrar(false); };
    document.addEventListener("keydown", tecla);
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo) return cerrar(false);
      const b = e.target.closest("[data-r]");
      if (b && !b.disabled) cerrar(b.dataset.r === "1");
    });
  });
}

// Modal con varias opciones. Devuelve el valor elegido o null.
export function elegir({ titulo, texto, opciones }) {
  return new Promise((ok) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${esc(titulo)}</h3>
        <p>${texto}</p>
        <div class="modal__opciones">
          ${opciones.map((o, i) => `<button class="btn ${o.clase || ""}" data-i="${i}" style="justify-content:flex-start">${o.html}</button>`).join("")}
        </div>
        <div class="modal__acciones"><button class="btn btn--fantasma" data-cancelar>Cancelar</button></div>
      </div>`;
    document.body.append(fondo);
    const cerrar = (v) => { fondo.remove(); ok(v); };
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo || e.target.closest("[data-cancelar]")) return cerrar(null);
      const b = e.target.closest("[data-i]");
      if (b) cerrar(opciones[+b.dataset.i].valor);
    });
  });
}

// Anima un número desde su valor actual hasta "hasta"
export function contarHasta(el, hasta, ms = 900) {
  const desde = Number(el.dataset.valor ?? el.textContent) || 0;
  el.dataset.valor = hasta;
  if (desde === hasta) { el.textContent = hasta; return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function pantallaCompleta() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
  else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

/* ---------------- Íconos (trazo, estilo de la landing) ---------------- */
const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICONOS = {
  trofeo: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
  siguiente: svg('<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  reloj: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  check: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  alerta: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  usuarios: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  ojo: svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  engranaje: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  proyector: svg('<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>'),
  candado: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  enviar: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  sonido: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
  mudo: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>'),
  historial: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
  basura: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
  refrescar: svg('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>'),
  volver: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  emision: svg('<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>'),
  expandir: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>'),
  externo: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  medalla: svg('<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>'),
  corona: svg('<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>'),
  rayo: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
  estrella: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  llave: svg('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
  libro: svg('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
  salir: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'),
  reloj_arena: svg('<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>'),
};

export const IMG = {
  logo: "../public/images/concepmi-vi-logo.png",
  wolfito: "../public/images/wolfito-concepmi.png",
  club: "../public/images/pmi-lima-student-club.png",
};

// Barra superior común a moderador y delegaciones
export function barra({ titulo, sub, derecha = "" }) {
  return `
    <header class="barra">
      <div class="barra__marca">
        <img class="barra__logo" src="${IMG.logo}" alt="CONCEPMI" />
        <span class="barra__sep"></span>
        <div><div class="barra__titulo">${titulo}</div><div class="barra__sub">${sub}</div></div>
      </div>
      <div class="barra__der">${derecha}<span class="conexion" data-conexion></span></div>
    </header>`;
}

// Mantiene actualizado el indicador de conexión dentro de "raiz"
export function vigilarConexion(raiz) {
  return alConexion((ok) => {
    const el = raiz.querySelector("[data-conexion]");
    if (!el) return;
    el.className = "conexion " + (ok ? "conexion--ok" : "conexion--mal");
    el.innerHTML = `<span class="punto ${ok ? "punto--vivo" : ""}"></span>${ok ? "En vivo" : "Reconectando…"}`;
  });
}
