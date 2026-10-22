// Pantalla de juego de la Delegación A (izquierda, azul) o B (derecha, verde).
import {
  backend, alEstado, ahora, llamar, recargarEstado, vigilarConexion, barra, esc, seg, mmss, aviso, confirmar, ICONOS, IMG,
} from "./nucleo.js";
import { SEGUNDOS_RONDA, TOTAL_RONDAS, PREGUNTAS_POR_RONDA, SEGUNDOS_SUSPENSO } from "./config.js";
import { activarAudio, sonidos } from "./sonido.js";

export function montar(raiz, { lado, desbloquear }) {
  const l = lado.toLowerCase();
  raiz.innerHTML = `
    <div class="fondo fondo--oscuro"></div>
    <div class="del del--${l}">
      ${barra({ titulo: "Delegación " + lado, sub: "Concurso de Conocimientos · VI CONCEPMI" })}
      <main class="del__cuerpo">
        <section class="del__equipo">
          <div class="insignia">${lado}</div>
          <div style="min-width:0">
            <div class="del__lado">Delegación ${lado} · ${lado === "A" ? "Izquierda" : "Derecha"}</div>
            <div class="del__nombre" data-nombre>—</div>
          </div>
          <div class="del__mini">
            <div class="mini"><span>Ronda</span><b data-ronda>1 / ${TOTAL_RONDAS}</b></div>
            <div class="mini"><span data-mini-lbl>Marcadas</span><b class="c" data-mini>0/${PREGUNTAS_POR_RONDA}</b></div>
          </div>
        </section>
        <div data-vista></div>
      </main>
      <button class="candado" title="Cambiar pantalla (requiere PIN)" data-candado>${ICONOS.candado}</button>
    </div>`;

  const $v = raiz.querySelector("[data-vista]");
  const dejarConexion = vigilarConexion(raiz);
  raiz.querySelector("[data-candado]").addEventListener("click", desbloquear);
  // Cualquier clic habilita el sonido (los navegadores lo exigen)
  const habilitar = () => activarAudio();
  raiz.addEventListener("pointerdown", habilitar);

  const sala = backend.sala("delegacion-" + l, { alPresencia() {}, alProgreso() {} });

  let e = null;
  let vista = "";
  let enviando = false;
  let enviadoLocal = null;     // clave de la ronda enviada desde esta laptop
  let autoEnviada = null;      // clave de la ronda que ya se intentó enviar al llegar a 0
  let ultimoSeg = null;

  const claveRonda = () => `${e.enfrentamiento}:${e.ronda}`;
  const claveResp = () => `resp:${claveRonda()}:${lado}`;
  const leerResp = () => { try { return JSON.parse(localStorage.getItem(claveResp()) || "{}"); } catch { return {}; } };
  const guardarResp = (r) => { try { localStorage.setItem(claveResp(), JSON.stringify(r)); } catch {} };
  const miEnvio = () => (lado === "A" ? e.envio_a : e.envio_b);
  const nombre = (x) => (x === "A" ? e.nombre_a : e.nombre_b) || "Delegación " + x;
  const acumulado = () => (e.rondas || []).reduce((s, r) => s + (r[l]?.correctas || 0), 0);

  function calcularVista() {
    if (!e) return "cargando";
    if (e.fase === "ronda") {
      if (miEnvio() || enviadoLocal === claveRonda()) return "enviado:" + claveRonda();
      if (ahora() < new Date(e.ronda_inicio).getTime()) return "previa:" + claveRonda();
      return "preguntas:" + claveRonda();
    }
    if (e.fase === "resultado") return "resultado:" + claveRonda();
    if (e.fase === "final") {
      const fin = new Date(e.final_en).getTime() + SEGUNDOS_SUSPENSO * 1000;
      return (ahora() < fin ? "suspenso:" : "final:") + e.enfrentamiento + ":" + (e.resultado?.ganador || "");
    }
    return "espera:" + (e.nombre_a || "") + ":" + (e.nombre_b || "");
  }

  function pintar() {
    const nueva = calcularVista();
    raiz.querySelector("[data-nombre]").textContent = e ? nombre(lado) : "—";
    raiz.querySelector("[data-ronda]").textContent = `${e?.ronda || 1} / ${TOTAL_RONDAS}`;
    if (nueva !== vista) {
      const tipo = nueva.split(":")[0];
      vista = nueva;
      ({ cargando: vCargando, espera: vEspera, previa: vPrevia, preguntas: vPreguntas, enviado: vEnviado, resultado: vResultado, suspenso: vSuspenso, final: vFinal })[tipo]();
    }
    actualizarMini();
  }

  function actualizarMini() {
    const lbl = raiz.querySelector("[data-mini-lbl]");
    const val = raiz.querySelector("[data-mini]");
    if (!e) return;
    if (vista.startsWith("preguntas")) {
      lbl.textContent = "Marcadas";
      val.textContent = `${Object.keys(leerResp()).length}/${PREGUNTAS_POR_RONDA}`;
    } else {
      lbl.textContent = "Acumulado";
      val.textContent = e.fase === "espera" ? "0" : String(acumulado());
    }
  }

  /* ---------- Vistas ---------- */
  function vCargando() {
    $v.innerHTML = `<div class="tarjeta del__aviso"><div class="icono-grande">${ICONOS.refrescar}</div><h2>Conectando…</h2></div>`;
  }

  function vEspera() {
    const listo = e.nombre_a && e.nombre_b;
    $v.innerHTML = `
      <div class="tarjeta del__aviso">
        <img class="del__wolfito" src="${IMG.wolfito}" alt="" />
        <div class="icono-grande">${ICONOS.reloj}</div>
        <h2>${listo ? "Esperando inicio del enfrentamiento" : "Esperando a las delegaciones"}</h2>
        <p>${listo
          ? `Su rival es <b>${esc(nombre(lado === "A" ? "B" : "A"))}</b>. El moderador está preparando la ronda. Cuando inicie, el cronómetro de ${SEGUNDOS_RONDA} segundos comenzará de inmediato y podrán responder las ${PREGUNTAS_POR_RONDA} preguntas.`
          : "El moderador está registrando a las delegaciones de este enfrentamiento."}</p>
        <div class="reglas">
          <span class="chip chip--lila">${TOTAL_RONDAS} rondas</span>
          <span class="chip chip--celeste">${PREGUNTAS_POR_RONDA} preguntas tipo CAPM</span>
          <span class="chip chip--ambar">${SEGUNDOS_RONDA} s por ronda</span>
          <span class="chip chip--verde">+1 por correcta</span>
        </div>
        <span class="chip chip--celeste"><span class="punto punto--vivo"></span>Sincronizado en vivo · Listo para competir</span>
      </div>`;
  }

  function vPrevia() {
    $v.innerHTML = `
      <div class="previa">
        <div>
          <div class="previa__lbl">Ronda ${e.ronda} de ${TOTAL_RONDAS} · ¡Prepárense!</div>
          <div class="previa__num" data-previa>3</div>
          <div class="previa__sub">${PREGUNTAS_POR_RONDA} preguntas · ${SEGUNDOS_RONDA} segundos</div>
        </div>
      </div>`;
  }

  function vPreguntas() {
    const resp = leerResp();
    const preguntas = e.preguntas || [];
    $v.innerHTML = `
      <div class="cronometro" data-crono>
        <div class="cronometro__fila">
          <div class="cronometro__lbl">${ICONOS.reloj} Cronómetro de la ronda ${e.ronda}</div>
          <div class="cronometro__t" data-t>01:00</div>
        </div>
        <div class="cronometro__barra"><i data-barra></i></div>
      </div>
      ${preguntas.map((p, i) => `
        <article class="pregunta ${resp[p.id] ? "respondida" : ""}" data-p="${p.id}">
          <div class="pregunta__enun"><span class="pregunta__num">${i + 1}</span><span>${esc(p.enunciado)}</span></div>
          <div class="opciones">
            ${["A", "B", "C", "D"].map((k) => `
              <button class="opcion ${resp[p.id] === k ? "sel" : ""}" data-op="${k}">
                <span class="opcion__letra">${k}</span><span>${esc(p.opciones[k])}</span>
              </button>`).join("")}
          </div>
        </article>`).join("")}
      <div class="enviar">
        <p>${ICONOS.info}<span data-marcadas></span></p>
        <button class="btn" data-enviar>${ICONOS.enviar} Enviar respuestas</button>
      </div>`;
    actualizarMarcadas();
    $v.querySelectorAll(".pregunta").forEach((art) => {
      art.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-op]");
        if (!b || enviando) return;
        const r = leerResp();
        r[art.dataset.p] = b.dataset.op;
        guardarResp(r);
        art.querySelectorAll(".opcion").forEach((o) => o.classList.toggle("sel", o === b));
        art.classList.add("respondida");
        sonidos.seleccion();
        actualizarMarcadas();
        actualizarMini();
        sala.progreso({ lado, ronda: e.ronda, marcadas: Object.keys(r).length });
      });
    });
    $v.querySelector("[data-enviar]").addEventListener("click", async () => {
      const n = Object.keys(leerResp()).length;
      const ok = await confirmar({
        titulo: "¿Enviar respuestas?",
        texto: n < PREGUNTAS_POR_RONDA
          ? `Han marcado <b>${n} de ${PREGUNTAS_POR_RONDA}</b> preguntas. Las que no marquen contarán como incorrectas. Después de enviar no se pueden cambiar.`
          : "Marcaron las 5 preguntas. Después de enviar no se pueden cambiar.",
        si: "Sí, enviar",
      });
      if (ok) enviar(false);
    });
    tic();
  }

  function actualizarMarcadas() {
    const n = Object.keys(leerResp()).length;
    const el = $v.querySelector("[data-marcadas]");
    if (el) el.textContent = n < PREGUNTAS_POR_RONDA
      ? `Han marcado ${n} de ${PREGUNTAS_POR_RONDA} preguntas. Pueden enviar aunque no hayan marcado todas.`
      : `¡Marcaron las ${PREGUNTAS_POR_RONDA} preguntas! Ya pueden enviar.`;
  }

  async function enviar(automatico) {
    if (enviando || !e || e.fase !== "ronda" || miEnvio()) return;
    enviando = true;
    const ronda = claveRonda();
    const btn = $v.querySelector("[data-enviar]");
    if (btn) { btn.disabled = true; btn.innerHTML = `${ICONOS.refrescar} Enviando…`; }
    $v.querySelectorAll(".opcion").forEach((o) => (o.disabled = true));
    let intentos = 0;
    while (true) {
      try {
        await llamar("enviar_respuestas", { p_lado: lado, p_enfrentamiento: e.enfrentamiento, p_ronda: e.ronda, p_respuestas: leerResp() });
        enviadoLocal = ronda;
        sonidos.envio();
        if (automatico) aviso("Se acabó el tiempo: se enviaron las respuestas marcadas.", "info");
        break;
      } catch (err) {
        if (/ya fueron enviadas/i.test(err.message)) { enviadoLocal = ronda; break; }
        if (/no está activa|terminó/i.test(err.message) || ++intentos >= 4) {
          aviso("No se pudo enviar: " + err.message, "error");
          $v.querySelectorAll(".opcion").forEach((o) => (o.disabled = false));
          if (btn) { btn.disabled = false; btn.innerHTML = `${ICONOS.enviar} Enviar respuestas`; }
          break;
        }
        await new Promise((r) => setTimeout(r, 700 * intentos));
      }
    }
    enviando = false;
    await recargarEstado();
    pintar();
  }

  function vEnviado() {
    const env = miEnvio();
    $v.innerHTML = `
      <div class="tarjeta del__aviso">
        <div class="icono-grande ok">${ICONOS.check}</div>
        <h2>¡Respuestas enviadas!</h2>
        <p>${env ? `Enviaron en <b>${seg(env.tiempo_ms)}</b>. ` : ""}Esperando a que <b>${esc(nombre(lado === "A" ? "B" : "A"))}</b> termine la ronda ${e.ronda}…</p>
        <span class="chip chip--verde"><span class="punto punto--vivo"></span>Ronda ${e.ronda} de ${TOTAL_RONDAS}</span>
      </div>`;
  }

  function vResultado() {
    const r = (e.rondas || [])[e.rondas.length - 1] || {};
    const mio = r[l] || {};
    const gane = r.ganador === lado;
    $v.innerHTML = `
      <div class="tarjeta del__aviso">
        <div class="icono-grande ${gane ? "oro" : ""}">${gane ? ICONOS.trofeo : ICONOS.medalla}</div>
        <h2>Ronda ${r.ronda} finalizada</h2>
        <div class="cifra-grande">${mio.correctas ?? 0}<span style="font-size:.45em;color:var(--tenue)"> / ${PREGUNTAS_POR_RONDA}</span></div>
        <p>respuestas correctas${mio.enviado === false ? " (no se enviaron respuestas a tiempo)" : ` · enviadas en ${seg(mio.tiempo_ms)}`}</p>
        <p style="font-size:1.1rem">${r.ganador === "E" ? "La ronda terminó en empate exacto." : `Ganador de la ronda: <b style="color:var(--oro)">${esc(nombre(r.ganador))}</b>`}<br><small class="texto-tenue">${esc(r.motivo || "")}</small></p>
        <span class="chip chip--lila">${e.ronda < TOTAL_RONDAS ? `Prepárense para la ronda ${e.ronda + 1}` : "Última ronda"}</span>
      </div>`;
  }

  function vSuspenso() {
    $v.innerHTML = `
      <div class="tarjeta del__aviso">
        <div class="icono-grande oro">${ICONOS.reloj_arena}</div>
        <h2>Calculando los resultados finales…</h2>
        <p>El anuncio oficial aparecerá en el proyector en <b data-suspenso>${SEGUNDOS_SUSPENSO}</b> segundos.</p>
      </div>`;
  }

  function vFinal() {
    const res = e.resultado || {};
    const g = res.ganador;
    const gane = g === lado;
    const corr = res["correctas_" + l] ?? 0;
    const bono = g === "E" ? null : gane ? 20 : 10;
    $v.innerHTML = `
      <div class="tarjeta del__aviso">
        <div class="icono-grande ${gane ? "oro" : ""}">${gane ? ICONOS.trofeo : ICONOS.estrella}</div>
        <h2>${g === "E" ? "Empate total" : gane ? "¡Felicitaciones! Ganaron el enfrentamiento" : "¡Gran participación!"}</h2>
        <p>${g === "E" ? "El moderador definirá al ganador." : `Ganador: <b style="color:var(--oro)">${esc(nombre(g))}</b> · ${esc(res.motivo || "")}`}</p>
        ${bono == null ? "" : `
        <div class="cifra-grande">${corr + bono}<span style="font-size:.4em;color:var(--tenue)"> pts</span></div>
        <p>${corr} respuestas correctas + ${bono} de ${gane ? "bono por victoria" : "bono por participación"}</p>`}
        <span class="chip chip--lila">Rondas ganadas: ${res["rondas_" + l] ?? 0} de ${TOTAL_RONDAS}</span>
      </div>`;
    if (gane && window.confetti) window.confetti({ particleCount: 160, spread: 90, origin: { y: .6 } });
  }

  /* ---------- Reloj (4 veces por segundo) ---------- */
  function tic() {
    if (!e) return;
    const v = calcularVista();
    if (v !== vista) return pintar();
    if (vista.startsWith("previa")) {
      const s = Math.ceil((new Date(e.ronda_inicio).getTime() - ahora()) / 1000);
      const el = $v.querySelector("[data-previa]");
      if (el && el.textContent !== String(Math.max(1, s))) { el.textContent = Math.max(1, s); sonidos.cuenta(); }
    }
    if (vista.startsWith("preguntas")) {
      const resta = (new Date(e.ronda_fin).getTime() - ahora()) / 1000;
      const t = $v.querySelector("[data-t]");
      const barraEl = $v.querySelector("[data-barra]");
      const crono = $v.querySelector("[data-crono]");
      if (t) t.textContent = mmss(resta);
      if (barraEl) barraEl.style.width = Math.max(0, Math.min(100, (resta / SEGUNDOS_RONDA) * 100)) + "%";
      if (crono) { crono.classList.toggle("alerta", resta <= 20 && resta > 10); crono.classList.toggle("critico", resta <= 10); }
      const s = Math.ceil(resta);
      if (s !== ultimoSeg) {
        ultimoSeg = s;
        if (s <= 10 && s > 0) (s <= 5 ? sonidos.ticUrgente : sonidos.tic)();
        if (s === SEGUNDOS_RONDA) sonidos.arranque();
      }
      if (resta <= 0 && !enviando && autoEnviada !== claveRonda()) { autoEnviada = claveRonda(); sonidos.fin(); enviar(true); }
    }
    if (vista.startsWith("suspenso")) {
      const el = $v.querySelector("[data-suspenso]");
      const s = Math.ceil((new Date(e.final_en).getTime() + SEGUNDOS_SUSPENSO * 1000 - ahora()) / 1000);
      if (el) el.textContent = Math.max(0, s);
    }
  }
  const reloj = setInterval(tic, 250);

  const dejarEstado = alEstado((nuevo) => {
    const antes = e;
    e = nuevo;
    if (antes && antes.enfrentamiento !== e.enfrentamiento) enviadoLocal = null;
    pintar();
  });

  return () => { clearInterval(reloj); dejarEstado(); dejarConexion(); raiz.removeEventListener("pointerdown", habilitar); };
}
