// Panel del moderador: controla el enfrentamiento, las rondas, los resultados y la tabla general.
import {
  backend, alEstado, alEnfrentamientos, ahora, llamar, recargarEstado, recargarEnfrentamientos, calcularTabla, jugadosPor,
  normalizar, pinGuardado, guardarPin, vigilarConexion, barra, esc, seg, mmss, aviso, confirmar, elegir, ICONOS,
} from "./nucleo.js";
import { TOTAL_RONDAS, PREGUNTAS_POR_RONDA } from "./config.js";

export function montar(raiz) {
  raiz.innerHTML = `
    <div class="fondo fondo--oscuro"></div>
    ${barra({
      titulo: "Panel del moderador",
      sub: "Concurso de Conocimientos · PMI Lima Student Club",
      derecha: `
        <div class="pantallas" data-pantallas></div>
        <button class="btn btn--sm" data-abrir="delegacion-a">${ICONOS.externo} A</button>
        <button class="btn btn--sm" data-abrir="delegacion-b">${ICONOS.externo} B</button>
        <button class="btn btn--sm" data-abrir="proyector">${ICONOS.externo} Proyector</button>`,
    })}
    <main class="mod">
      <section class="tarjeta mod__estado">
        <span class="chip" data-chip-estado></span>
        <span class="chip chip--lila" data-chip-ronda></span>
        <span class="chip chip--celeste" data-chip-banco>Banco: …</span>
        <div class="derecha">
          <button class="btn btn--sm" data-sonido></button>
          <button class="btn btn--sm" data-ir-historial>${ICONOS.historial} Historial <span data-n-hist>(0)</span></button>
          <button class="btn btn--sm" data-pin>${ICONOS.llave} Cambiar PIN</button>
          <button class="btn btn--sm btn--fantasma" data-salir>${ICONOS.salir} Salir</button>
        </div>
      </section>

      <div data-banner-final></div>

      <div class="mod__fila">
        <section class="tarjeta">
          <div class="mod__cab">
            <h2 class="titulo-seccion">${ICONOS.usuarios} Delegaciones</h2>
            <button class="btn btn--sm btn--fantasma" type="button" data-limpiar>Limpiar</button>
          </div>
          <form class="nombres" data-form-nombres autocomplete="off">
            <div class="campo">
              <label class="a" for="nom-a">Delegación A (izquierda · azul)</label>
              <input class="entrada a" id="nom-a" list="lista-delegaciones" maxlength="40" placeholder="Ej. UNI" />
              <div class="cupo" data-cupo="a"></div>
            </div>
            <div class="campo">
              <label class="b" for="nom-b">Delegación B (derecha · verde)</label>
              <input class="entrada b" id="nom-b" list="lista-delegaciones" maxlength="40" placeholder="Ej. CATÓLICA" />
              <div class="cupo" data-cupo="b"></div>
            </div>
            <datalist id="lista-delegaciones"></datalist>
            <button class="btn" type="submit" data-guardar>Guardar nombres</button>
          </form>
        </section>

        <section class="tarjeta">
          <div class="mod__cab">
            <h2 class="titulo-seccion">${ICONOS.engranaje} Acciones del moderador</h2>
            <span class="chip" data-indicador></span>
          </div>
          <div class="acciones">
            <button class="accion accion--iniciar" data-iniciar>${ICONOS.play}<span>Iniciar enfrentamiento</span><small data-sub-iniciar></small></button>
            <button class="accion accion--siguiente" data-siguiente>${ICONOS.siguiente}<span data-lbl-siguiente>Lanzar siguiente ronda</span><small data-sub-siguiente></small></button>
            <button class="accion accion--reset" data-reset>${ICONOS.reset}<span>Reset</span><small>Reinicia el enfrentamiento en curso</small></button>
          </div>
          <div class="acciones__pie">
            <span>Ronda activa: <b data-ronda-activa>—</b> <span class="reloj-mod" data-reloj-mod></span></span>
            <span>Preguntas asignadas: <span class="ids" data-ids>—</span></span>
          </div>
        </section>
      </div>

      <section class="tarjeta">
        <div class="mod__cab">
          <h2 class="titulo-seccion">${ICONOS.ojo} Monitor en vivo</h2>
          <span class="chip chip--celeste"><span class="punto punto--vivo"></span>Tiempo real</span>
        </div>
        <div class="monitor">
          ${["a", "b"].map((l) => `
            <div class="equipo-mon equipo-mon--${l}" data-mon="${l}">
              <div class="equipo-mon__cab">
                <div><div class="equipo-mon__lado">Delegación ${l.toUpperCase()}</div><div class="equipo-mon__nombre" data-n>—</div></div>
                <span class="chip" data-st></span>
              </div>
              <div class="stats">
                <div class="stat"><span>Correctas ronda</span><b class="c" data-c>0/${PREGUNTAS_POR_RONDA}</b></div>
                <div class="stat"><span>Tiempo de envío</span><b data-t>--</b></div>
                <div class="stat"><span>Total acumulado</span><b class="oro" data-acum>0</b></div>
              </div>
              <div class="rondas-mini" data-rmini></div>
            </div>`).join("")}
        </div>
      </section>

      <section class="tarjeta">
        <div class="tabla-cab">
          <div>
            <h2 class="titulo-seccion">${ICONOS.trofeo} Tabla de posición general</h2>
            <small class="texto-tenue">Suma de los enfrentamientos registrados · máximo 2 por delegación</small>
          </div>
          <div class="acc">
            <span class="chip" data-modo-proy></span>
            <button class="btn btn--oro btn--sm" data-publicar>${ICONOS.emision} Publicar resultados en vivo</button>
            <button class="btn btn--sm" data-inicial>${ICONOS.volver} Volver a pantalla inicial</button>
            <button class="btn btn--peligro btn--sm" data-borrar>${ICONOS.basura} Borrar resultados</button>
            <button class="btn btn--sm btn--icono" title="Actualizar" data-refrescar>${ICONOS.refrescar}</button>
          </div>
        </div>
        <div class="tabla-wrap"><table class="tabla">
          <thead><tr><th>Posición</th><th>Delegación</th><th class="num">Enfrentamiento 1</th><th class="num">Enfrentamiento 2</th><th class="num">Correctas</th><th class="num">Puntaje total</th></tr></thead>
          <tbody data-tabla></tbody>
        </table></div>
      </section>

      <section class="tarjeta" id="historial">
        <div class="mod__cab">
          <h2 class="titulo-seccion">${ICONOS.historial} Historial de enfrentamientos registrados</h2>
        </div>
        <div class="tabla-wrap"><table class="tabla">
          <thead><tr><th>Hora</th><th>Delegación A</th><th>Delegación B</th><th class="num">Rondas A/B</th><th class="num">Correctas A/B</th><th class="num">Puntaje A/B</th><th>Ganador</th><th></th></tr></thead>
          <tbody data-historial></tbody>
        </table></div>
      </section>

      <section class="tarjeta">
        <div class="mod__cab"><h2 class="titulo-seccion">${ICONOS.libro} Banco de preguntas y ensayos</h2></div>
        <div class="herramientas">
          <span class="texto-tenue" data-banco-det>…</span>
          <button class="btn btn--sm" data-reiniciar-banco>${ICONOS.reset} Reiniciar banco (después de los ensayos)</button>
        </div>
      </section>
    </main>`;

  const $ = (s) => raiz.querySelector(s);
  const pin = () => pinGuardado();
  const dejarConexion = vigilarConexion(raiz);

  let e = null;
  let enfs = [];
  let presentes = new Set();
  const progreso = { A: null, B: null };
  let banco = null;

  const sala = backend.sala("moderador", {
    alPresencia(roles) { presentes = new Set(roles); pintarPantallas(); },
    alProgreso(p) { if (e && p.ronda === e.ronda) { progreso[p.lado] = p.marcadas; pintarMonitor(); } },
  });
  void sala;

  /* ---------- Acciones con manejo de errores ---------- */
  async function accion(boton, fn, ok) {
    if (boton) boton.disabled = true;
    try {
      await fn();
      if (ok) aviso(ok, "ok");
      await recargarEstado();
    } catch (err) {
      aviso(err.message, "error");
      if (/PIN/.test(err.message)) { guardarPin(""); location.reload(); }
    } finally {
      if (boton) boton.disabled = false;
      pintar();
    }
  }
  async function cargarBanco() {
    try { banco = await llamar("banco_estado"); } catch { banco = null; }
    pintarBanco();
  }

  /* ---------- Nombres ---------- */
  const inA = $("#nom-a"), inB = $("#nom-b");
  let editando = false;
  [inA, inB].forEach((i) => i.addEventListener("input", () => { editando = true; pintarCupos(); }));
  $("[data-limpiar]").addEventListener("click", () => { inA.value = ""; inB.value = ""; editando = true; pintarCupos(); inA.focus(); });
  $("[data-form-nombres]").addEventListener("submit", (ev) => {
    ev.preventDefault();
    accion($("[data-guardar]"), async () => {
      await llamar("mod_guardar_nombres", { p_pin: pin(), p_a: inA.value, p_b: inB.value });
      editando = false;
    }, "Nombres guardados: ya aparecen en todas las pantallas");
  });

  function cupoHtml(nombre) {
    if (!normalizar(nombre)) return "";
    const n = jugadosPor(enfs, nombre);
    if (n >= 2) return `<span class="cupo cupo--bloq">${ICONOS.alerta} Ya jugó 2/2 enfrentamientos · no puede participar otra vez</span>`;
    if (n === 1) return `<span class="cupo cupo--ultimo">${ICONOS.info} Enfrentamiento 2/2 · última oportunidad para esta delegación</span>`;
    return `<span class="cupo cupo--nuevo">${ICONOS.info} Nueva delegación · enfrentamiento 1/2</span>`;
  }
  function pintarCupos() {
    for (const [l, inp] of [["a", inA], ["b", inB]]) {
      let h = cupoHtml(inp.value);
      if (inA.value && inB.value && normalizar(inA.value) === normalizar(inB.value) && l === "b") h = `<span class="cupo cupo--bloq">${ICONOS.alerta} A y B no pueden ser la misma delegación</span>`;
      $(`[data-cupo="${l}"]`).innerHTML = h;
    }
    const guardados = e && normalizar(inA.value) === normalizar(e.nombre_a) && normalizar(inB.value) === normalizar(e.nombre_b) && e.nombre_a;
    $("[data-guardar]").innerHTML = guardados ? `${ICONOS.check} Nombres guardados` : "Guardar nombres";
    $("[data-guardar]").classList.toggle("btn--primario", !guardados && !!(inA.value || inB.value));
  }
  function pintarDatalist() {
    const tabla = calcularTabla(enfs);
    $("#lista-delegaciones").innerHTML = tabla.map((f) => `<option value="${esc(f.nombre)}">${f.partidos.length}/2 enfrentamientos</option>`).join("");
  }

  /* ---------- Acciones del enfrentamiento ---------- */
  $("[data-iniciar]").addEventListener("click", (ev) => accion(ev.currentTarget, () => llamar("mod_iniciar", { p_pin: pin() }), "¡Enfrentamiento iniciado! Ronda 1 en curso"));
  $("[data-siguiente]").addEventListener("click", (ev) => accion(ev.currentTarget, () => llamar("mod_siguiente_ronda", { p_pin: pin() }), `Ronda ${(e?.ronda || 0) + 1} lanzada`));
  $("[data-reset]").addEventListener("click", async (ev) => {
    const ok = await confirmar({
      titulo: "¿Reiniciar el enfrentamiento?",
      texto: "Se descartan las rondas jugadas de este enfrentamiento y todo vuelve a ESPERANDO (los nombres se conservan). Las preguntas que ya salieron no se repetirán. La tabla general no se toca.",
      si: "Sí, reiniciar", peligro: true,
    });
    if (ok) accion(ev.currentTarget, () => llamar("mod_reset", { p_pin: pin() }), "Enfrentamiento reiniciado");
  });

  /* ---------- Tabla general y proyector ---------- */
  $("[data-publicar]").addEventListener("click", async (ev) => {
    const ok = await confirmar({
      titulo: "¿Publicar resultados en el proyector?",
      texto: `El proyector cambia a <b>modo gala</b>: cuenta regresiva de 10 segundos y revelación de la tabla general desde el último puesto hasta el campeón.`,
      si: "Publicar",
    });
    if (ok) accion(ev.currentTarget, () => llamar("mod_publicar_resultados", { p_pin: pin() }), "Modo gala en el proyector");
  });
  $("[data-inicial]").addEventListener("click", async (ev) => {
    const enCurso = e && e.fase !== "espera";
    const ok = await confirmar({
      titulo: "¿Volver a la pantalla inicial?",
      texto: (enCurso ? "<b>Hay un enfrentamiento sin registrar: se descartará.</b> " : "") +
        "Todas las pantallas vuelven al inicio y los nombres se limpian. Los resultados guardados en la tabla general no se borran.",
      si: "Volver al inicio", peligro: enCurso,
    });
    if (ok) { inA.value = ""; inB.value = ""; editando = false; accion(ev.currentTarget, () => llamar("mod_pantalla_inicial", { p_pin: pin() }), "Pantallas en estado inicial"); }
  });
  $("[data-borrar]").addEventListener("click", async () => {
    if (!enfs.length) return aviso("No hay resultados registrados para borrar");
    const valor = await elegir({
      titulo: "Borrar resultados",
      texto: "Elige qué quieres borrar de la tabla general. Las delegaciones de un enfrentamiento borrado recuperan su cupo.",
      opciones: [
        ...enfs.slice().reverse().map((x) => ({
          valor: x.id,
          html: `${ICONOS.basura} ${esc(x.nombre_a)} vs ${esc(x.nombre_b)} <span class="texto-tenue" style="margin-left:auto">${x.puntaje_a}–${x.puntaje_b} · ${new Date(x.creado).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>`,
        })),
        { valor: "*", clase: "btn--peligro", html: `${ICONOS.alerta} Borrar TODA la tabla general (${enfs.length} enfrentamientos)` },
      ],
    });
    if (!valor) return;
    if (valor === "*") {
      const ok = await confirmar({ titulo: "¿Borrar toda la tabla?", texto: "Se borrarán todos los enfrentamientos registrados. Escribe <b>BORRAR</b> para confirmar.", si: "Borrar todo", peligro: true, escribir: "BORRAR" });
      if (ok) accion(null, async () => { await llamar("mod_borrar_todo", { p_pin: pin() }); await recargarEnfrentamientos(); }, "Tabla general borrada");
    } else {
      const x = enfs.find((z) => z.id === valor);
      const ok = await confirmar({ titulo: "¿Borrar este enfrentamiento?", texto: `<b>${esc(x.nombre_a)} vs ${esc(x.nombre_b)}</b> (${x.puntaje_a}–${x.puntaje_b}) se quitará de la tabla general.`, si: "Borrar", peligro: true });
      if (ok) accion(null, async () => { await llamar("mod_borrar_enfrentamiento", { p_pin: pin(), p_id: valor }); await recargarEnfrentamientos(); }, "Enfrentamiento borrado");
    }
  });
  $("[data-refrescar]").addEventListener("click", () => { recargarEstado(); recargarEnfrentamientos(); cargarBanco(); });
  $("[data-ir-historial]").addEventListener("click", () => $("#historial").scrollIntoView({ behavior: "smooth" }));

  /* ---------- Barra ---------- */
  raiz.querySelectorAll("[data-abrir]").forEach((b) => b.addEventListener("click", () => window.open(location.pathname + "#" + b.dataset.abrir, "_blank")));
  $("[data-sonido]").addEventListener("click", (ev) => accion(ev.currentTarget, () => llamar("mod_sonido", { p_pin: pin(), p_activo: !e.sonido })));
  $("[data-salir]").addEventListener("click", () => { guardarPin(""); location.hash = ""; });
  $("[data-pin]").addEventListener("click", async () => {
    const nuevo = prompt("Nuevo PIN del moderador (mínimo 4 caracteres):");
    if (!nuevo) return;
    accion(null, async () => { await llamar("mod_cambiar_pin", { p_pin: pin(), p_nuevo: nuevo }); guardarPin(nuevo); }, "PIN actualizado. Úsalo para configurar las laptops.");
  });
  $("[data-reiniciar-banco]").addEventListener("click", async (ev) => {
    const ok = await confirmar({
      titulo: "¿Reiniciar el banco de preguntas?",
      texto: "Todas las preguntas vuelven a estar disponibles. Úsalo solo después de los ensayos, <b>antes</b> de empezar el concurso real.",
      si: "Reiniciar banco", peligro: true, escribir: "REINICIAR",
    });
    if (ok) accion(ev.currentTarget, async () => { await llamar("mod_reiniciar_banco", { p_pin: pin() }); await cargarBanco(); }, "Banco reiniciado");
  });

  /* ---------- Pintado ---------- */
  function pintarPantallas() {
    const etiquetas = [["delegacion-a", "A"], ["delegacion-b", "B"], ["proyector", "Proyector"]];
    $("[data-pantallas]").innerHTML = etiquetas.map(([r, t]) => `<span class="pantalla-dot ${presentes.has(r) ? "on" : ""}" title="${presentes.has(r) ? "Conectada" : "Sin conexión"}"><span class="punto"></span>${t}</span>`).join("");
  }
  function pintarBanco() {
    if (!banco) return;
    $("[data-chip-banco]").innerHTML = `${ICONOS.libro} Banco: ${banco.disponibles}/${banco.total} disponibles`;
    $("[data-banco-det]").textContent = `${banco.disponibles} de ${banco.total} preguntas sin usar · alcanzan para ${Math.floor(banco.disponibles / (PREGUNTAS_POR_RONDA * TOTAL_RONDAS))} enfrentamientos completos más.`;
  }

  function pintar() {
    if (!e) return;
    const fase = e.fase;
    const chip = $("[data-chip-estado]");
    const [t, c] = { espera: ["Estado: esperando", "chip--ambar"], ronda: ["Estado: en curso", "chip--celeste"], resultado: ["Estado: ronda finalizada", "chip--verde"], final: ["Estado: enfrentamiento finalizado", "chip--coral"] }[fase];
    chip.className = "chip " + c;
    chip.innerHTML = `<span class="punto ${fase === "ronda" ? "punto--vivo" : ""}"></span>${t}`;
    $("[data-chip-ronda]").textContent = `Ronda actual: ${e.ronda} / ${TOTAL_RONDAS}`;
    $("[data-sonido]").innerHTML = e.sonido ? `${ICONOS.sonido} Sonido proyector` : `${ICONOS.mudo} Proyector en silencio`;
    $("[data-modo-proy]").className = "chip " + (e.proyector === "gala" ? "chip--ambar" : "chip--lila");
    $("[data-modo-proy]").innerHTML = `${ICONOS.proyector} Proyector: ${e.proyector === "gala" ? "modo gala / resultados" : "modo enfrentamiento"}`;

    // Nombres (no pisar lo que el moderador está escribiendo)
    const bloqueados = fase !== "espera";
    inA.disabled = inB.disabled = bloqueados;
    $("[data-guardar]").disabled = bloqueados;
    if (!editando || bloqueados) { inA.value = e.nombre_a || ""; inB.value = e.nombre_b || ""; editando = false; }
    pintarCupos();

    // Botones
    const nombresOk = e.nombre_a && e.nombre_b && jugadosPor(enfs, e.nombre_a) < 2 && jugadosPor(enfs, e.nombre_b) < 2;
    const bIni = $("[data-iniciar]");
    bIni.disabled = !(fase === "espera" && nombresOk && !editando);
    $("[data-sub-iniciar]").textContent = fase !== "espera" ? "Bloqueado hasta guardar el resultado" : !nombresOk ? "Primero guarda dos delegaciones válidas" : editando ? "Guarda los nombres primero" : "Ronda 1 · puntajes en 0";
    const bSig = $("[data-siguiente]");
    bSig.disabled = !(fase === "resultado" && e.ronda < TOTAL_RONDAS);
    $("[data-lbl-siguiente]").textContent = e.ronda < TOTAL_RONDAS && fase !== "final" ? `Lanzar ronda ${fase === "espera" ? 2 : e.ronda + 1}` : "Lanzar siguiente ronda";
    $("[data-sub-siguiente]").textContent =
      fase === "final" || (e.ronda >= TOTAL_RONDAS && fase !== "espera") ? `Bloqueado · la ronda ${TOTAL_RONDAS} es la última`
      : fase === "ronda" ? "Se habilita cuando ambas envíen"
      : fase === "resultado" ? "Ambas delegaciones enviaron" : "Disponible tras la ronda 1";
    $("[data-reset]").disabled = fase === "espera";

    const ind = $("[data-indicador]");
    if (fase === "ronda") { ind.className = "chip chip--ambar"; ind.innerHTML = `<span class="punto punto--vivo"></span>Esperando respuestas…`; }
    else if (fase === "resultado" || fase === "final") { ind.className = "chip chip--verde"; ind.innerHTML = `<span class="punto"></span>Ambas delegaciones enviaron`; }
    else { ind.className = "chip"; ind.innerHTML = `<span class="punto"></span>Listo para iniciar`; }

    $("[data-ronda-activa]").textContent = fase === "espera" ? "—" : `Ronda ${e.ronda}`;
    $("[data-ids]").textContent = e.preguntas_ids?.length ? `[${e.preguntas_ids.join(", ")}]` : "—";

    pintarMonitor();
    pintarBannerFinal();
  }

  function pintarMonitor() {
    if (!e) return;
    const cerrada = e.fase === "resultado" || e.fase === "final";
    for (const l of ["a", "b"]) {
      const L = l.toUpperCase();
      const box = $(`[data-mon="${l}"]`);
      const env = e["envio_" + l];
      box.querySelector("[data-n]").textContent = e["nombre_" + l] || "—";
      const st = box.querySelector("[data-st]");
      if (e.fase === "espera") { st.className = "chip chip--ambar"; st.innerHTML = `${ICONOS.reloj} Esperando`; }
      else if (e.fase === "ronda" && !env) { st.className = "chip chip--celeste"; st.innerHTML = `<span class="punto punto--vivo"></span>Respondiendo · ${progreso[L] ?? 0}/${PREGUNTAS_POR_RONDA} marcadas`; }
      else if (env && env.enviado === false) { st.className = "chip chip--coral"; st.innerHTML = `${ICONOS.alerta} No envió a tiempo`; }
      else { st.className = "chip chip--verde"; st.innerHTML = `${ICONOS.check} Enviado`; }
      box.querySelector("[data-c]").textContent = env ? `${env.correctas}/${PREGUNTAS_POR_RONDA}` : `0/${PREGUNTAS_POR_RONDA}`;
      box.querySelector("[data-t]").textContent = env ? seg(env.tiempo_ms) : "--";
      box.querySelector("[data-acum]").textContent = (e.rondas || []).reduce((s, r) => s + (r[l]?.correctas || 0), 0) + (!cerrada && env ? env.correctas : 0);
      box.querySelector("[data-rmini]").innerHTML = (e.rondas || []).map((r) => `<span class="${r.ganador === L ? "gano" : ""}">R${r.ronda}: ${r[l].correctas} · ${seg(r[l].tiempo_ms)}${r.ganador === L ? " ★" : ""}</span>`).join("");
    }
  }

  function pintarBannerFinal() {
    const cont = $("[data-banner-final]");
    if (!e || e.fase !== "final") { cont.innerHTML = ""; cont.dataset.k = ""; return; }
    const res = e.resultado || {};
    const k = e.enfrentamiento + res.ganador;
    if (cont.dataset.k === k) return;
    cont.dataset.k = k;
    const empate = res.ganador === "E";
    const pa = (res.ganador === "A" ? 20 : 10) + (res.correctas_a || 0);
    const pb = (res.ganador === "B" ? 20 : 10) + (res.correctas_b || 0);
    cont.innerHTML = `
      <div class="banner-final">
        <div class="banner-final__icono">${ICONOS.trofeo}</div>
        <div>
          <span class="chip chip--ambar">Fin del enfrentamiento · Ronda ${TOTAL_RONDAS} completada</span>
          <h3>${empate ? "Empate total: define al ganador" : `Ganó ${esc(res.ganador === "A" ? e.nombre_a : e.nombre_b)} · ¿Listo para guardar y preparar el siguiente enfrentamiento?`}</h3>
          <p>${empate ? "Las delegaciones empataron en rondas, correctas y tiempo. Tras la pregunta de muerte súbita, elige al ganador." :
            `${esc(e.nombre_a)}: ${pa} pts · ${esc(e.nombre_b)}: ${pb} pts. Se registrará en la tabla general (+20 al ganador / +10 al otro) y se limpiarán los nombres.`}</p>
        </div>
        <div class="acc">
          ${empate ? `
            <button class="btn" data-def="A">Gana ${esc(e.nombre_a)}</button>
            <button class="btn" data-def="B">Gana ${esc(e.nombre_b)}</button>` : `
            <button class="btn btn--oro" data-registrar>${ICONOS.check} Guardar y registrar enfrentamiento</button>`}
        </div>
      </div>`;
    cont.querySelector("[data-registrar]")?.addEventListener("click", (ev) => accion(ev.currentTarget, async () => {
      await llamar("mod_registrar", { p_pin: pin() });
      await recargarEnfrentamientos();
      await cargarBanco();
      inA.value = ""; inB.value = ""; editando = false;
    }, "Enfrentamiento registrado en la tabla general"));
    cont.querySelectorAll("[data-def]").forEach((b) => b.addEventListener("click", (ev) => accion(ev.currentTarget, () => llamar("mod_definir_ganador", { p_pin: pin(), p_lado: b.dataset.def }))));
  }

  function pintarTablas() {
    const tabla = calcularTabla(enfs);
    const medallas = ["🥇", "🥈", "🥉"];
    $("[data-tabla]").innerHTML = tabla.length ? tabla.map((f) => `
      <tr class="${f.puesto <= 3 ? "top" : ""}">
        <td>${f.puesto <= 3 ? `<span class="medalla">${medallas[f.puesto - 1]}</span>` : f.puesto + ".º"}</td>
        <td class="delegacion"><b>${esc(f.nombre)}</b><small>${f.partidos.length}/2 enf.</small></td>
        <td class="num">${f.partidos[0] ? f.partidos[0].pts + " pts" : "—"}</td>
        <td class="num">${f.partidos[1] ? f.partidos[1].pts + " pts" : "—"}</td>
        <td class="num">${f.correctas}</td>
        <td class="total">${f.total}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="tabla-vacia">Aún no hay enfrentamientos registrados.</td></tr>`;

    $("[data-n-hist]").textContent = `(${enfs.length})`;
    $("[data-historial]").innerHTML = enfs.length ? enfs.slice().reverse().map((x) => `
      <tr>
        <td class="mono">${new Date(x.creado).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
        <td class="a">${esc(x.nombre_a)}</td><td class="b">${esc(x.nombre_b)}</td>
        <td class="num">${x.rondas_a} – ${x.rondas_b}</td>
        <td class="num">${x.correctas_a} – ${x.correctas_b}</td>
        <td class="num" style="color:var(--oro)">${x.puntaje_a} – ${x.puntaje_b}</td>
        <td>🏆 <b>${esc(x.ganador === "A" ? x.nombre_a : x.nombre_b)}</b></td>
        <td><button class="btn btn--sm btn--fantasma" title="Borrar este enfrentamiento" data-borrar-uno="${x.id}">${ICONOS.basura}</button></td>
      </tr>`).join("") : `<tr><td colspan="8" class="tabla-vacia">Sin enfrentamientos registrados.</td></tr>`;
    raiz.querySelectorAll("[data-borrar-uno]").forEach((b) => b.addEventListener("click", async () => {
      const x = enfs.find((z) => z.id === b.dataset.borrarUno);
      const ok = await confirmar({ titulo: "¿Borrar este enfrentamiento?", texto: `<b>${esc(x.nombre_a)} vs ${esc(x.nombre_b)}</b> (${x.puntaje_a}–${x.puntaje_b}) se quitará de la tabla general y ambas delegaciones recuperan un cupo.`, si: "Borrar", peligro: true });
      if (ok) accion(null, async () => { await llamar("mod_borrar_enfrentamiento", { p_pin: pin(), p_id: x.id }); await recargarEnfrentamientos(); }, "Enfrentamiento borrado");
    }));
  }

  /* ---------- Reloj de la ronda y cierre automático ---------- */
  let cierrePedido = "";
  const reloj = setInterval(() => {
    const el = $("[data-reloj-mod]");
    if (!e || e.fase !== "ronda") { el.textContent = ""; return; }
    const ini = new Date(e.ronda_inicio).getTime(), fin = new Date(e.ronda_fin).getTime(), t = ahora();
    el.textContent = t < ini ? `· inicia en ${Math.ceil((ini - t) / 1000)} s` : `· ${mmss((fin - t) / 1000)}`;
    // Si una delegación se desconectó y no envió, la ronda se cierra sola al vencer
    const k = e.enfrentamiento + ":" + e.ronda;
    if (t > fin + 11000 && cierrePedido !== k + Math.floor(t / 5000)) {
      cierrePedido = k + Math.floor(t / 5000);
      llamar("cerrar_ronda_vencida").then(recargarEstado).catch(() => {});
    }
  }, 500);

  const dejarEstado = alEstado((nuevo) => {
    const cambioRonda = !e || e.ronda !== nuevo.ronda || e.enfrentamiento !== nuevo.enfrentamiento;
    if (cambioRonda) { progreso.A = null; progreso.B = null; }
    const nuevaRonda = e && nuevo.fase === "ronda" && (e.fase !== "ronda" || cambioRonda);
    e = nuevo;
    if (nuevaRonda) cargarBanco();
    pintar();
  });
  const dejarEnf = alEnfrentamientos((lista) => { enfs = lista; pintarDatalist(); pintarTablas(); pintar(); });
  pintarPantallas();
  cargarBanco();

  return () => { clearInterval(reloj); dejarEstado(); dejarEnf(); dejarConexion(); };
}
