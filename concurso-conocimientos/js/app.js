// Página de inicio, acceso con PIN y navegación entre pantallas.
import {
  iniciarNucleo, llamar, pinGuardado, guardarPin, pantallaAutorizada, autorizarPantalla, olvidarPantalla,
  esc, ICONOS, IMG, aviso,
} from "./nucleo.js";
import { activarAudio } from "./sonido.js";

const RUTAS = {
  moderador: { nombre: "Moderador", modulo: "./moderador.js" },
  "delegacion-a": { nombre: "Delegación A", modulo: "./delegacion.js", lado: "A" },
  "delegacion-b": { nombre: "Delegación B", modulo: "./delegacion.js", lado: "B" },
  proyector: { nombre: "Proyector", modulo: "./proyector.js" },
};

const app = document.getElementById("app");
let desmontar = null;

const rutaActual = () => location.hash.replace(/^#\/?/, "").toLowerCase();

async function mostrar() {
  if (desmontar) { try { desmontar(); } catch {} desmontar = null; }
  window.scrollTo(0, 0);
  const ruta = rutaActual();
  const def = RUTAS[ruta];
  document.body.dataset.pantalla = def ? ruta : "inicio";
  if (!def) return pintarInicio();

  // El moderador (con PIN en esta pestaña) puede abrir cualquier pantalla.
  // Las demás laptops quedan fijas en la pantalla que se autorizó.
  if (!pinGuardado() && pantallaAutorizada() !== ruta) return pintarPin(ruta, def);
  if (ruta === "moderador" && !pinGuardado()) return pintarPin(ruta, def);

  await iniciarNucleo();
  const mod = await import(def.modulo);
  desmontar = mod.montar(app, { lado: def.lado, desbloquear: () => pedirDesbloqueo() });
}

function pintarInicio() {
  const tarjeta = (ruta, clase, icono, nombre, desc, donde) => `
    <a class="rol ${clase}" href="#${ruta}">
      <span class="rol__icono">${icono}</span>
      <span class="rol__nombre">${nombre}</span>
      <span class="rol__desc">${desc}</span>
      <span class="rol__donde">${donde}</span>
    </a>`;
  app.innerHTML = `
    <div class="fondo"></div>
    <main class="inicio">
      <div class="inicio__cabecera">
        <img class="inicio__logo" src="${IMG.logo}" alt="CONCEPMI" />
        <div class="inicio__kicker">VI CONCEPMI 2026 · PMI Lima Student Club</div>
        <h1>Concurso de Conocimientos</h1>
        <p class="inicio__desc">Elige qué pantalla mostrará esta laptop. Cada una se configura una sola vez con el PIN del moderador y queda fija.</p>
      </div>
      <nav class="inicio__grid" aria-label="Pantallas del concurso">
        ${tarjeta("moderador", "rol--mod", ICONOS.engranaje, "Moderador", "Controla el enfrentamiento, las rondas, los resultados y la tabla general.", "Laptop 1 · Mesa de control")}
        ${tarjeta("delegacion-a", "rol--a", '<b style="font-family:var(--neon);font-size:1.5rem">A</b>', "Delegación A", "Pantalla de juego del equipo de la izquierda (azul).", "Laptop 2 · Izquierda del escenario")}
        ${tarjeta("delegacion-b", "rol--b", '<b style="font-family:var(--neon);font-size:1.5rem">B</b>', "Delegación B", "Pantalla de juego del equipo de la derecha (verde).", "Laptop 3 · Derecha del escenario")}
        ${tarjeta("proyector", "rol--proy", ICONOS.proyector, "Proyector", "Transmisión oficial para el público del auditorio.", "Laptop 4 · Pantalla gigante")}
      </nav>
      <footer class="inicio__pie"><img src="${IMG.club}" alt="PMI Lima Student Club" /> Concurso Nacional de Conocimientos · Examen tipo CAPM</footer>
    </main>
    <img class="inicio__wolfito" src="${IMG.wolfito}" alt="" />`;
}

function pintarPin(ruta, def) {
  const esMod = ruta === "moderador";
  app.innerHTML = `
    <div class="fondo"></div>
    <main class="pin">
      <div class="tarjeta pin__caja">
        <div class="pin__icono">${ICONOS.candado}</div>
        <h2>${esc(def.nombre)}</h2>
        <p>${esMod ? "Ingresa el PIN del moderador para controlar el concurso." : "Ingresa el PIN del moderador para configurar esta laptop como <b>" + esc(def.nombre) + "</b>. Quedará fija en esta pantalla."}</p>
        <form>
          <input class="entrada entrada--pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="••••" required />
          <button class="btn btn--primario" type="submit">Entrar</button>
          <a class="btn btn--fantasma" href="#">${ICONOS.volver} Volver al inicio</a>
        </form>
      </div>
    </main>`;
  const form = app.querySelector("form");
  const input = form.querySelector("input");
  setTimeout(() => input.focus(), 50);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    btn.disabled = true;
    activarAudio(); // el clic cuenta como interacción: habilita el sonido
    try {
      const ok = await llamar("verificar_pin", { p_pin: input.value });
      if (!ok) { aviso("PIN incorrecto", "error"); input.value = ""; input.focus(); return; }
      if (esMod) guardarPin(input.value);
      autorizarPantalla(ruta);
      mostrar();
    } catch (err) {
      aviso("No se pudo verificar el PIN: " + err.message, "error");
    } finally { btn.disabled = false; }
  });
}

// Botón discreto (candado) en las pantallas fijas: con el PIN se libera la laptop
async function pedirDesbloqueo() {
  const pin = prompt("PIN del moderador para cambiar la pantalla de esta laptop:");
  if (!pin) return;
  try {
    if (await llamar("verificar_pin", { p_pin: pin })) { olvidarPantalla(); location.hash = ""; }
    else aviso("PIN incorrecto", "error");
  } catch (err) { aviso(err.message, "error"); }
}

window.addEventListener("hashchange", mostrar);
mostrar();
