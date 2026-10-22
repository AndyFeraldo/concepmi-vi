// Efectos de sonido generados en el navegador (sin archivos externos).
let ctx = null;
let maestro = null;
let activo = true;

export function activarAudio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    ctx = new C();
    maestro = ctx.createGain();
    maestro.gain.value = 0.6;
    maestro.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}
export const audioListo = () => !!ctx && ctx.state === "running";
export function setSonido(v) { activo = !!v; }

function tono({ f = 440, tipo = "sine", t = 0, dur = 0.2, vol = 0.3, hasta = null, ataque = 0.01, filtro = null }) {
  if (!ctx || !activo) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t0);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let nodo = o;
  if (filtro) {
    const fl = ctx.createBiquadFilter();
    fl.type = "lowpass"; fl.frequency.value = filtro;
    o.connect(fl); nodo = fl;
  }
  nodo.connect(g); g.connect(maestro);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function ruido({ t = 0, dur = 0.1, vol = 0.3, filtro = 1800, tipo = "bandpass" }) {
  if (!ctx || !activo) return;
  const t0 = ctx.currentTime + t;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const fl = ctx.createBiquadFilter();
  fl.type = tipo; fl.frequency.value = filtro;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(fl); fl.connect(g); g.connect(maestro);
  src.start(t0);
}

export const sonidos = {
  tic() { tono({ f: 1200, tipo: "square", dur: 0.05, vol: 0.08 }); },
  ticUrgente() { tono({ f: 1650, tipo: "square", dur: 0.08, vol: 0.14 }); tono({ f: 825, tipo: "sine", dur: 0.12, vol: 0.12 }); },
  fin() { tono({ f: 220, tipo: "sawtooth", dur: 0.7, vol: 0.25, filtro: 900 }); tono({ f: 164, tipo: "sawtooth", dur: 0.9, vol: 0.2, filtro: 700, t: 0.05 }); },
  envio() { tono({ f: 880, dur: 0.15, vol: 0.2 }); tono({ f: 1320, dur: 0.3, vol: 0.18, t: 0.1 }); },
  seleccion() { tono({ f: 660, tipo: "triangle", dur: 0.06, vol: 0.08 }); },
  cuenta() { tono({ f: 520, tipo: "triangle", dur: 0.25, vol: 0.25 }); },
  arranque() { [523, 659, 784, 1047].forEach((f, i) => tono({ f, tipo: "triangle", dur: 0.35, vol: 0.22, t: i * 0.07 })); },
  whoosh() { ruido({ dur: 0.45, vol: 0.35, filtro: 900, tipo: "lowpass" }); tono({ f: 300, hasta: 1200, tipo: "sine", dur: 0.35, vol: 0.06 }); },
  golpe() { tono({ f: 140, hasta: 45, tipo: "sine", dur: 0.6, vol: 0.6 }); ruido({ dur: 0.25, vol: 0.4, filtro: 300, tipo: "lowpass" }); },
  redoble(segundos = 3) {
    if (!ctx || !activo) return;
    const golpes = Math.floor(segundos * 18);
    for (let i = 0; i < golpes; i++) {
      const k = i / golpes;
      ruido({ t: i / 18, dur: 0.07, vol: 0.12 + 0.35 * k, filtro: 2200 + 800 * k });
    }
  },
  fanfarria() {
    const notas = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.42], [784, 0.62], [1047, 0.74]];
    notas.forEach(([f, t]) => {
      tono({ f, tipo: "sawtooth", dur: 0.5, vol: 0.18, t, filtro: 2600 });
      tono({ f: f / 2, tipo: "square", dur: 0.5, vol: 0.06, t, filtro: 1200 });
    });
    [523, 659, 784, 1047].forEach((f) => tono({ f, tipo: "sawtooth", dur: 1.8, vol: 0.12, t: 0.95, ataque: 0.05, filtro: 2400 }));
    this.golpe();
  },
  aplausos(segundos = 4) {
    if (!ctx || !activo) return;
    for (let i = 0; i < segundos * 40; i++) {
      ruido({ t: Math.random() * segundos, dur: 0.03 + Math.random() * 0.03, vol: 0.08 + Math.random() * 0.12, filtro: 1500 + Math.random() * 2500 });
    }
  },
};
