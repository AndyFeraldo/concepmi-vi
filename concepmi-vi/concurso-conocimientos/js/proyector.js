// Pantalla del proyector: lo que ve el público en el auditorio. Nunca muestra preguntas ni respuestas.
import {
  backend, alEstado, alEnfrentamientos, ahora, calcularTabla, llamar, esc, seg, contarHasta, pantallaCompleta, ICONOS, IMG,
} from "./nucleo.js";
import { SEGUNDOS_RONDA, TOTAL_RONDAS, PREGUNTAS_POR_RONDA, SEGUNDOS_SUSPENSO, SEGUNDOS_PREVIA_GALA } from "./config.js";
import { activarAudio, audioListo, setSonido, sonidos } from "./sonido.js";

const CIRC_RELOJ = 2 * Math.PI * 54;
const CIRC_ANILLO = 2 * Math.PI * 60;

export function montar(raiz, { desbloquear }) {
  raiz.innerHTML = `
    <div class="fondo"></div>
    <div class="proy">
      <div class="proy__deco">
        <div class="orbe orbe--1"></div><div class="orbe orbe--2"></div><div class="orbe orbe--3"></div>
        <div class="foco" data-foco></div>
        <div class="rayo"></div><div class="rayo"></div><div class="rayo"></div>
        ${Array.from({ length: 26 }, () => `<i class="chispa" style="left:${Math.random() * 100}%;top:${60 + Math.random() * 45}%;animation-delay:${-Math.random() * 6}s;animation-duration:${4 + Math.random() * 5}s"></i>`).join("")}
      </div>
      <header class="proy__barra">
        <img class="logo" src="${IMG.logo}" alt="CONCEPMI" />
        <span class="sep"></span>
        <div>
          <div class="proy__titulo">Concurso de Conocimientos</div>
          <div class="proy__sub">VI CONCEPMI 2026 · Transmisión oficial</div>
        </div>
        <div class="der">
          <span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span>
          <img class="club" src="${IMG.club}" alt="PMI Lima Student Club" />
        </div>
      </header>
      <section class="proy__escena" data-escena></section>
      <footer class="proy__pie" data-pie>Concurso Nacional de Conocimientos · Preguntas tipo examen <b>CAPM</b> del PMI</footer>
      <img class="proy__wolfito" src="${IMG.wolfito}" alt="" data-wolfito />
    </div>
    <svg width="0" height="0" style="position:absolute"><defs>
      <linearGradient id="gradReloj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1FCBEA"/><stop offset="1" stop-color="#A98BFF"/></linearGradient>
    </defs></svg>
    <button class="candado" title="Cambiar pantalla (requiere PIN)" data-candado>${ICONOS.candado}</button>
    <div class="previa" data-previa hidden><div>
      <div class="previa__lbl" data-previa-lbl></div>
      <div class="previa__num" data-previa-num>3</div>
      <div class="previa__sub">${PREGUNTAS_POR_RONDA} preguntas · ${SEGUNDOS_RONDA} segundos</div>
    </div></div>`;

  const $esc = raiz.querySelector("[data-escena]");
  const $previa = raiz.querySelector("[data-previa]");
  const $foco = raiz.querySelector("[data-foco]");
  const $wolfito = raiz.querySelector("[data-wolfito]");
  raiz.querySelector("[data-candado]").addEventListener("click", desbloquear);
  raiz.addEventListener("dblclick", pantallaCompleta);
  backend.sala("proyector", { alPresencia() {}, alProgreso() {} });

  // Los navegadores exigen un clic para reproducir sonido
  let capa = null;
  if (!audioListo()) {
    capa = document.createElement("div");
    capa.className = "activar";
    capa.innerHTML = `<button>${ICONOS.expandir}<span>Activar pantalla completa y sonido</span><small>Haz clic una vez para comenzar la transmisión</small></button>`;
    capa.addEventListener("click", () => { activarAudio(); pantallaCompleta(); capa.remove(); capa = null; });
    raiz.append(capa);
  }

  let e = null;
  let enfs = [];
  let vista = "";
  let ultimoSeg = null;
  let confetiFin = 0;
  const ya = new Set(); // efectos que ya sonaron (para no repetirlos)
  const una = (clave, fn) => { if (!ya.has(clave)) { ya.add(clave); fn(); } };

  const nombre = (x) => (x === "A" ? e.nombre_a : e.nombre_b) || (x === "A" ? "Delegación A" : "Delegación B");
  const acumulado = (l, hastaRonda = 99) => (e.rondas || []).filter((r) => r.ronda <= hastaRonda).reduce((s, r) => s + (r[l]?.correctas || 0), 0);
  const ganadorEn = () => new Date(e.final_en).getTime() + SEGUNDOS_SUSPENSO * 1000;

  function calcularVista() {
    if (!e) return "nada";
    if (e.proyector === "gala") return "gala:" + e.gala_en;
    if (e.fase === "final" && ahora() >= ganadorEn()) return "ganador:" + e.enfrentamiento + ":" + (e.resultado?.ganador || "");
    if (e.fase === "espera" && !(e.nombre_a && e.nombre_b)) return "portada";
    return "marcador";
  }

  function pintar() {
    if (!e) return;
    setSonido(e.sonido);
    const nueva = calcularVista();
    if (nueva !== vista) {
      vista = nueva;
      $foco.classList.remove("on");
      confetiFin = 0;
      if (window.confetti) window.confetti.reset();
      const tipo = nueva.split(":")[0];
      $wolfito.hidden = tipo !== "portada";
      if (tipo === "portada") vPortada();
      else if (tipo === "marcador") vMarcador();
      else if (tipo === "ganador") vGanador();
      else if (tipo === "gala") vGala();
    }
    if (vista === "marcador") actualizarMarcador();
    if (vista === "portada") actualizarPortada();
  }

  /* ================= PORTADA (sin enfrentamiento) ================= */
  function vPortada() {
    $esc.innerHTML = `
      <div class="portada">
        <div class="portada__kicker">PMI Lima Student Club presenta</div>
        <img class="portada__logo" src="${IMG.logo}" alt="CONCEPMI" />
        <h1>Concurso de Conocimientos</h1>
        <div class="portada__info">
          <span class="chip chip--lila">${ICONOS.libro} Preguntas tipo CAPM</span>
          <span class="chip chip--celeste">${ICONOS.reloj} ${PREGUNTAS_POR_RONDA} preguntas · ${SEGUNDOS_RONDA} s por ronda</span>
          <span class="chip chip--ambar">${ICONOS.trofeo} Mejor de ${TOTAL_RONDAS} rondas</span>
        </div>
        <span class="chip chip--verde" style="font-size:1.05em;padding:.7em 1.4em" data-portada-estado><span class="punto punto--vivo"></span>Próximo enfrentamiento en preparación</span>
      </div>`;
  }
  function actualizarPortada() {
    const el = $esc.querySelector("[data-portada-estado]");
    if (el) el.innerHTML = `<span class="punto punto--vivo"></span>${enfs.length ? `${enfs.length} enfrentamiento${enfs.length === 1 ? "" : "s"} disputado${enfs.length === 1 ? "" : "s"} · Próximo en preparación` : "Próximo enfrentamiento en preparación"}`;
  }

  /* ================= MARCADOR (enfrentamiento en curso) ================= */
  function tarjetaEquipo(l) {
    const L = l.toUpperCase();
    return `
      <article class="equipo equipo--${l}" data-eq="${l}">
        <div class="equipo__cab"><span class="equipo__lado">Equipo ${L}</span><span class="insignia">${L}</span></div>
        <div class="equipo__nombre"><span data-n></span><small>Delegación universitaria</small></div>
        <div class="equipo__estado espera" data-st></div>
        <div class="equipo__tiempo"><span>${ICONOS.reloj.replace("<svg", '<svg style="width:1.1em;height:1.1em;vertical-align:-.2em;margin-right:.4em"')}<span data-tlbl>Tiempo de envío</span></span><b data-t>—</b></div>
        <div class="equipo__stats">
          <div class="stat"><span data-clbl>Correctas</span><b class="c" data-c>—</b></div>
          <div class="stat"><span>Total acumulado</span><b class="oro" data-acum>0</b></div>
        </div>
      </article>`;
  }

  function vMarcador() {
    $esc.innerHTML = `
      <div class="marcador">
        <div class="marcador__cab">
          <div class="ronda-pill" data-ronda></div>
          <span class="chip info">${PREGUNTAS_POR_RONDA} preguntas CAPM · ${SEGUNDOS_RONDA} s</span>
          <div class="rastreo" data-rastreo></div>
          <div class="estado">Estado: <span class="chip" data-estado></span></div>
        </div>
        <div data-suspenso></div>
        <div class="duelo">
          ${tarjetaEquipo("a")}
          <div class="centro" data-centro></div>
          ${tarjetaEquipo("b")}
        </div>
        <div data-banner></div>
      </div>`;
  }

  function actualizarMarcador() {
    const enRonda = e.fase === "ronda";
    const cerrada = e.fase === "resultado" || e.fase === "final";
    const ultima = cerrada ? e.rondas[e.rondas.length - 1] : null;

    $esc.querySelector("[data-ronda]").textContent = `Ronda ${e.ronda} de ${TOTAL_RONDAS}`;
    $esc.querySelector("[data-rastreo]").innerHTML = Array.from({ length: TOTAL_RONDAS }, (_, i) => {
      const r = (e.rondas || [])[i];
      const cls = r ? "g" + r.ganador.toLowerCase() : e.fase !== "espera" && i + 1 === e.ronda ? "actual" : "";
      return `<span class="${cls}" title="Ronda ${i + 1}">R${i + 1}</span>`;
    }).join("");

    const est = $esc.querySelector("[data-estado]");
    const [txt, cls] = e.fase === "espera" ? ["Esperando", "chip--ambar"]
      : enRonda ? (ahora() < new Date(e.ronda_inicio).getTime() ? ["Preparados", "chip--lila"] : ["En curso · Respondiendo", "chip--celeste"])
      : e.fase === "resultado" ? ["Ronda finalizada", "chip--verde"]
      : ["Enfrentamiento finalizado", "chip--ambar"];
    est.className = "chip " + cls;
    est.innerHTML = (enRonda ? ICONOS.rayo : "") + txt;

    for (const l of ["a", "b"]) {
      const card = $esc.querySelector(`[data-eq="${l}"]`);
      const envio = e["envio_" + l];
      card.querySelector("[data-n]").textContent = nombre(l.toUpperCase());
      const st = card.querySelector("[data-st]");
      let stCls, stHtml;
      if (e.fase === "espera") { stCls = "espera"; stHtml = `${ICONOS.reloj} Esperando ronda`; }
      else if (enRonda && ahora() < new Date(e.ronda_inicio).getTime()) { stCls = "espera"; stHtml = `${ICONOS.reloj} Preparados`; }
      else if (enRonda && !envio) { stCls = "respondiendo"; stHtml = `${ICONOS.rayo} <span class="puntos-anim">Respondiendo</span>`; }
      else if (envio && envio.enviado === false) { stCls = "noenvio"; stHtml = `${ICONOS.alerta} Sin envío a tiempo`; }
      else { stCls = "enviado"; stHtml = `${ICONOS.check} Respuestas enviadas`; }
      if (st.dataset.k !== stCls) { st.className = "equipo__estado " + stCls; st.innerHTML = stHtml; st.dataset.k = stCls; }
      card.querySelector("[data-tlbl]").textContent = `Tiempo ronda ${e.ronda}:`;
      card.querySelector("[data-t]").textContent = envio ? seg(envio.tiempo_ms) : e.fase === "espera" ? "—" : "…";
      card.querySelector("[data-clbl]").textContent = `Correctas R${e.ronda}`;
      const c = card.querySelector("[data-c]");
      if (cerrada && ultima) {
        c.classList.remove("oculto");
        if (c.dataset.r !== ultima.ronda + "") { c.dataset.r = ultima.ronda; c.dataset.valor = 0; c.textContent = "0"; }
        contarHasta(c, ultima[l].correctas, 1200);
      } else { c.classList.add("oculto"); c.textContent = enRonda && envio ? "?" : "—"; c.dataset.r = ""; }
      const acum = card.querySelector("[data-acum]");
      contarHasta(acum, e.fase === "espera" ? 0 : acumulado(l), 1200);
      card.classList.toggle("gana", !!ultima && ultima.ganador === l.toUpperCase());
      card.classList.toggle("pierde", !!ultima && ultima.ganador !== "E" && ultima.ganador !== l.toUpperCase());
    }

    // Centro: VS o reloj de la ronda
    const centro = $esc.querySelector("[data-centro]");
    const quiereReloj = enRonda && ahora() >= new Date(e.ronda_inicio).getTime() && !(e.envio_a && e.envio_b);
    if (quiereReloj && centro.dataset.k !== "reloj") {
      centro.dataset.k = "reloj";
      centro.innerHTML = `
        <div class="reloj" data-reloj>
          <svg viewBox="0 0 120 120"><circle class="pista" cx="60" cy="60" r="54"/><circle class="arco" cx="60" cy="60" r="54" stroke-dasharray="${CIRC_RELOJ}" stroke-dashoffset="0"/></svg>
          <div class="reloj__num"><b data-rs>60</b><span>segundos</span></div>
        </div>`;
    } else if (!quiereReloj && centro.dataset.k !== "vs") {
      centro.dataset.k = "vs";
      centro.innerHTML = `<div class="vs">VS</div><img class="centro__wolfito" src="${IMG.wolfito}" alt="" />`;
    }

    // Banner de resultado de la ronda y suspenso final
    const banner = $esc.querySelector("[data-banner]");
    if (ultima) {
      const k = "r" + ultima.ronda;
      if (banner.dataset.k !== k) {
        banner.dataset.k = k;
        banner.innerHTML = `
          <div class="banner-ronda">
            <div class="ic">${ICONOS.medalla}</div>
            <div><small>Resultado oficial de la ronda ${ultima.ronda}</small>
              <h3>${ultima.ganador === "E" ? "Ronda empatada" : `Ganador de la ronda: <em>${esc(nombre(ultima.ganador))}</em>`}</h3></div>
            <div class="motivo">${ICONOS.rayo}${esc(ultima.motivo)}</div>
          </div>`;
        una("banner" + e.enfrentamiento + k, () => sonidos.whoosh());
      }
    } else if (banner.dataset.k) { banner.dataset.k = ""; banner.innerHTML = ""; }

    const susp = $esc.querySelector("[data-suspenso]");
    if (e.fase === "final") {
      if (!susp.dataset.k) {
        susp.dataset.k = "1";
        susp.innerHTML = `
          <div class="suspenso">
            <div class="ic">${ICONOS.reloj_arena}</div>
            <div><small>Momento de suspenso · Ronda ${TOTAL_RONDAS} completada</small>
              <h3>Calculando bonificaciones finales del enfrentamiento…</h3></div>
            <div class="cuenta"><span>Anuncio oficial en</span><b data-cuenta>${SEGUNDOS_SUSPENSO}</b></div>
          </div>`;
        una("redoble" + e.enfrentamiento, () => sonidos.redoble(Math.max(1, (ganadorEn() - ahora()) / 1000)));
      }
    } else if (susp.dataset.k) { susp.dataset.k = ""; susp.innerHTML = ""; }

    // Sonido al recibir cada envío
    for (const l of ["a", "b"]) if (e["envio_" + l]?.enviado) una(`envio${e.enfrentamiento}${e.ronda}${l}`, () => sonidos.envio());
  }

  /* ================= GANADOR DEL ENFRENTAMIENTO ================= */
  function vGanador() {
    const res = e.resultado || {};
    const g = res.ganador;
    const empate = g === "E";
    const tarjetaFinal = (l) => {
      const L = l.toUpperCase();
      const gana = g === L;
      const bono = empate ? null : gana ? 20 : 10;
      const corr = res["correctas_" + l] ?? 0;
      return `
        <div class="final-card final-card--${l} ${gana ? "gana" : ""}">
          <div class="final-card__cab">
            <div><small>Delegación ${L}</small><b>${esc(nombre(L))}</b></div>
            <span class="etiqueta ${gana ? "oro" : ""}">${gana ? ICONOS.medalla.replace("<svg", '<svg style="width:1.1em;height:1.1em"') + " Ganador" : empate ? "Empate" : "Participante"}</span>
          </div>
          <div class="linea">Rondas ganadas <b>${res["rondas_" + l] ?? 0} de ${TOTAL_RONDAS}</b></div>
          <div class="linea">Respuestas correctas acumuladas <b>${corr} pts</b></div>
          <div class="linea">${gana ? "Bono por victoria" : "Bono por participación"} <b class="bono ${gana ? "oro" : ""}">${bono == null ? "por definir" : "+" + bono + " pts"}</b></div>
          <div class="linea">Tiempo promedio por ronda <b>${res["tiempo_prom_" + l] ?? 0} s</b></div>
          <div class="total">Puntaje final <b data-total="${bono == null ? corr : corr + bono}">0</b></div>
        </div>`;
    };
    $esc.innerHTML = `
      <div class="ganador">
        <div class="trofeo">${ICONOS.trofeo}</div>
        <span class="chip chip--ambar">Enfrentamiento concluido · Mejor de ${TOTAL_RONDAS} rondas</span>
        <h2>${empate ? "¡Empate total!" : `Equipo ganador del enfrentamiento:<br><em>${esc(nombre(g))}</em>`}</h2>
        <div class="texto-tenue" style="font-size:.95em;letter-spacing:.12em;text-transform:uppercase;font-weight:700">${esc(res.motivo || "")} · Resumen: ${esc(nombre("A"))} (${res.rondas_a ?? 0}) vs (${res.rondas_b ?? 0}) ${esc(nombre("B"))}</div>
        <div class="resumen-rondas">
          ${(e.rondas || []).map((r) => `
            <div class="r-card ${r.ganador === "E" ? "" : "g" + r.ganador.toLowerCase()}">
              <small>Ronda ${r.ronda}</small>
              <b>${r.ganador === "E" ? "Empate" : "★ " + esc(nombre(r.ganador))}</b>
              <span>${r.a.correctas} pts (${seg(r.a.tiempo_ms)}) · ${r.b.correctas} pts (${seg(r.b.tiempo_ms)})</span>
            </div>`).join("")}
        </div>
        <div class="finales">${tarjetaFinal("a")}${tarjetaFinal("b")}</div>
      </div>`;
    $esc.querySelectorAll("[data-total]").forEach((el) => setTimeout(() => contarHasta(el, +el.dataset.total, 1800), 700));
    $foco.classList.add("on");
    una("ganador" + e.enfrentamiento + g, () => {
      sonidos.fanfarria();
      setTimeout(() => sonidos.aplausos(5), 600);
      lluviaConfeti(6000, g === "A" ? ["#3D8BFF", "#FFC23D", "#FFFFFF"] : g === "B" ? ["#2BD98A", "#FFC23D", "#FFFFFF"] : undefined);
    });
  }

  /* ================= GALA: TABLA GENERAL ================= */
  let gala = null;
  function vGala() {
    const tabla = calcularTabla(enfs);
    const podio = tabla.slice(0, 3);
    const resto = tabla.slice(3);
    const t0 = new Date(e.gala_en).getTime() + SEGUNDOS_PREVIA_GALA * 1000;
    // Cronograma: del último puesto al 4.º cada 1,4 s; luego 3.º, 2.º y 1.º con redoble
    const eventos = [];
    resto.slice().reverse().forEach((f, i) => eventos.push({ t: t0 + i * 1200, tipo: "fila", puesto: f.puesto }));
    let t = t0 + resto.length * 1200 + (resto.length ? 1500 : 0);
    [[3, 3000], [2, 4000], [1, 5500]].forEach(([p, redoble]) => {
      if (podio[p - 1]) { eventos.push({ t, tipo: "redoble", dur: redoble, puesto: p }); t += redoble; eventos.push({ t, tipo: "podio", puesto: p }); t += 1800; }
    });
    gala = { tabla, eventos, t0, total: tabla.length };

    const lugar = (p) => {
      const f = podio[p - 1];
      if (!f) return `<div class="podio__lugar podio__lugar--${p}"></div>`;
      return `
        <div class="podio__lugar podio__lugar--${p} ${p === 1 ? "campeon" : ""}" data-podio="${p}">
          ${p === 1 ? `<div class="podio__corona">${ICONOS.corona}</div><span class="etq-campeon">CAMPEÓN</span>` : ""}
          <div class="podio__nombre">${esc(f.nombre)}</div>
          <div class="podio__pts">${f.total}<small>pts</small></div>
          <div class="podio__det">${f.partidos.map((x, i) => `E${i + 1}: ${x.pts}`).join(" · ")} · ${f.correctas} correctas</div>
          <div class="podio__base">${p}°</div>
        </div>`;
    };

    $esc.innerHTML = `
      <div class="gala-previa" data-gprevia>
        <span class="chip chip--ambar">${ICONOS.estrella} Ceremonia de clausura · Tabla de posición general</span>
        <h2>Revelación oficial<br>de resultados</h2>
        <p>Totalizando los puntajes de todos los enfrentamientos universitarios…</p>
        <div class="anillo">
          <svg viewBox="0 0 132 132"><circle class="pista" cx="66" cy="66" r="60"/><circle class="arco" cx="66" cy="66" r="60" stroke-dasharray="${CIRC_ANILLO}" stroke-dashoffset="0" data-garco/></svg>
          <b data-gnum>${SEGUNDOS_PREVIA_GALA}</b><span>SEGUNDOS</span>
        </div>
        <p class="texto-tenue" style="font-size:.95em">Revelación de posiciones de menor a mayor</p>
      </div>
      <div class="gala" data-gtabla hidden>
        <div class="gala__cab">
          <div class="ic">${ICONOS.trofeo}</div>
          <div><small>Posiciones oficiales · VI CONCEPMI</small><h2>Tabla de posición general del concurso</h2></div>
          <span class="chip chip--ambar" data-greveladas>${ICONOS.estrella} Reveladas: 0 de ${tabla.length}</span>
        </div>
        ${tabla.length ? `
        <div class="gala__cuerpo" style="${resto.length ? "" : "grid-template-columns:1fr"}">
          <div class="podio">${lugar(2)}${lugar(1)}${lugar(3)}</div>
          ${resto.length ? `<div class="lista-gala" style="${resto.length > 9 ? "grid-template-columns:1fr 1fr;font-size:.82em" : ""}">
            ${resto.map((f) => `
              <div class="fila-gala" data-fila="${f.puesto}">
                <span class="pos">${f.puesto}.º</span>
                <span class="nom">${esc(f.nombre)}<small>${f.partidos.length} enfrentamiento${f.partidos.length === 1 ? "" : "s"} · ${f.correctas} correctas</small></span>
                <span class="det">${f.partidos.map((x, i) => `E${i + 1}: ${x.pts}`).join(" | ")}</span>
                <span class="pts">${f.total}</span>
              </div>`).join("")}
          </div>` : ""}
        </div>` : `<div class="portada"><h1 style="font-size:3em">Aún no hay enfrentamientos registrados</h1></div>`}
      </div>`;
    actualizarGala();
  }

  function actualizarGala() {
    if (!gala) return;
    const ms = ahora();
    const previa = $esc.querySelector("[data-gprevia]");
    const tablaEl = $esc.querySelector("[data-gtabla]");
    if (!previa || !tablaEl) return;
    if (ms < gala.t0) {
      const resta = (gala.t0 - ms) / 1000;
      const s = Math.ceil(resta);
      $esc.querySelector("[data-gnum]").textContent = s;
      $esc.querySelector("[data-garco]").style.strokeDashoffset = CIRC_ANILLO * (1 - resta / SEGUNDOS_PREVIA_GALA);
      una("gtic" + e.gala_en + s, () => (s <= 3 ? sonidos.ticUrgente() : sonidos.tic()));
      return;
    }
    if (!previa.hidden) { previa.hidden = true; tablaEl.hidden = false; una("gabre" + e.gala_en, () => sonidos.golpe()); }
    let reveladas = 0;
    for (const ev of gala.eventos) {
      if (ms < ev.t) continue;
      const id = "g" + e.gala_en + ev.tipo + ev.puesto;
      if (ev.tipo === "fila") {
        reveladas++;
        const el = $esc.querySelector(`[data-fila="${ev.puesto}"]`);
        if (el && !el.classList.contains("visible")) { el.classList.add("visible"); una(id, () => sonidos.whoosh()); }
      } else if (ev.tipo === "redoble") {
        if (ms < ev.t + ev.dur) una(id, () => sonidos.redoble(ev.dur / 1000));
      } else if (ev.tipo === "podio") {
        reveladas++;
        const el = $esc.querySelector(`[data-podio="${ev.puesto}"]`);
        if (el && !el.classList.contains("visible")) {
          el.classList.add("visible");
          una(id, () => {
            if (ev.puesto === 1) {
              sonidos.fanfarria(); setTimeout(() => sonidos.aplausos(7), 500);
              $foco.classList.add("on");
              lluviaConfeti(9000, ["#FFC23D", "#FFD465", "#FFFFFF", "#A98BFF"]);
            } else {
              sonidos.golpe();
              confetiSimple(ev.puesto === 2 ? ["#EEF1F8", "#9BA3B8"] : ["#F2A86E", "#A8551F"]);
            }
          });
        }
      }
    }
    const rev = $esc.querySelector("[data-greveladas]");
    if (rev) rev.innerHTML = `${ICONOS.estrella} Reveladas: ${reveladas} de ${gala.total}`;
  }

  /* ================= Efectos ================= */
  function confetiSimple(colores) {
    if (!window.confetti) return;
    window.confetti({ particleCount: 140, spread: 80, startVelocity: 45, origin: { y: 0.55 }, colors: colores });
  }
  function lluviaConfeti(ms, colores) {
    if (!window.confetti) return;
    confetiFin = Date.now() + ms;
    (function cuadro() {
      window.confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: colores });
      window.confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: colores });
      if (Date.now() < confetiFin) requestAnimationFrame(cuadro);
    })();
    window.confetti({ particleCount: 260, spread: 120, startVelocity: 55, origin: { y: 0.4 }, colors: colores });
  }

  /* ================= Reloj ================= */
  function tic() {
    if (!e) return;
    const v = calcularVista();
    if (v !== vista) pintar();
    // Cuenta regresiva de inicio de ronda
    const enPrevia = e.proyector !== "gala" && e.fase === "ronda" && ahora() < new Date(e.ronda_inicio).getTime();
    $previa.hidden = !enPrevia;
    if (enPrevia) {
      const s = Math.max(1, Math.ceil((new Date(e.ronda_inicio).getTime() - ahora()) / 1000));
      raiz.querySelector("[data-previa-lbl]").textContent = `Ronda ${e.ronda} de ${TOTAL_RONDAS} · ¡Prepárense!`;
      const num = raiz.querySelector("[data-previa-num]");
      if (num.textContent !== String(s)) { num.textContent = s; num.style.animation = "none"; void num.offsetWidth; num.style.animation = ""; }
      una(`prev${e.enfrentamiento}${e.ronda}${s}`, () => sonidos.cuenta());
    }
    if (vista === "marcador") {
      actualizarMarcador();
      const r = $esc.querySelector("[data-reloj]");
      if (r) {
        const resta = Math.max(0, (new Date(e.ronda_fin).getTime() - ahora()) / 1000);
        r.querySelector("[data-rs]").textContent = Math.ceil(resta);
        r.querySelector(".arco").style.strokeDashoffset = CIRC_RELOJ * (1 - resta / SEGUNDOS_RONDA);
        r.classList.toggle("alerta", resta <= 20 && resta > 10);
        r.classList.toggle("critico", resta <= 10);
        const s = Math.ceil(resta);
        if (s !== ultimoSeg) {
          ultimoSeg = s;
          if (s === SEGUNDOS_RONDA) una(`arr${e.enfrentamiento}${e.ronda}`, () => sonidos.arranque());
          if (s <= 10 && s > 0) (s <= 5 ? sonidos.ticUrgente : sonidos.tic)();
          if (s === 0) una(`fin${e.enfrentamiento}${e.ronda}`, () => sonidos.fin());
        }
      }
      const cuenta = $esc.querySelector("[data-cuenta]");
      if (cuenta) cuenta.textContent = Math.max(0, Math.ceil((ganadorEn() - ahora()) / 1000));
      // Si una laptop se desconectó, el proyector también puede cerrar la ronda vencida
      if (e.fase === "ronda" && ahora() > new Date(e.ronda_fin).getTime() + 11000) una(`cerrar${e.enfrentamiento}${e.ronda}${Math.floor(ahora() / 5000)}`, () => llamar("cerrar_ronda_vencida").catch(() => {}));
    }
    if (vista.startsWith("gala")) actualizarGala();
  }
  const reloj = setInterval(tic, 200);

  const dejarEstado = alEstado((nuevo) => { e = nuevo; if (e.proyector !== "gala") gala = null; pintar(); });
  const dejarEnf = alEnfrentamientos((lista) => { enfs = lista; if (vista === "portada") actualizarPortada(); });

  return () => { clearInterval(reloj); dejarEstado(); dejarEnf(); if (capa) capa.remove(); };
}
