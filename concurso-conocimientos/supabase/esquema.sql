-- =====================================================================
-- Concurso de Conocimientos · VI CONCEPMI · Esquema de Supabase
-- Toda la lógica del concurso vive aquí. Las pantallas solo leen la
-- tabla "estado" (en tiempo real) y llaman a las funciones de abajo.
-- La respuesta correcta nunca sale de la base de datos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Banco de preguntas (se carga con banco-preguntas/preguntas.sql)
create table if not exists public.preguntas (
  id           integer primary key,
  dominio      text not null,
  tema         text not null,
  dificultad   text not null,
  enunciado    text not null,
  opcion_a     text not null,
  opcion_b     text not null,
  opcion_c     text not null,
  opcion_d     text not null,
  correcta     char(1) not null check (correcta in ('A','B','C','D')),
  explicacion  text,
  activa       boolean not null default true
);
alter table public.preguntas add column if not exists usada_en timestamptz;
alter table public.preguntas enable row level security;
drop policy if exists "preguntas_lectura" on public.preguntas;
revoke all on public.preguntas from anon, authenticated;

-- PIN del moderador (solo su hash)
create table if not exists public.config (
  id        integer primary key default 1 check (id = 1),
  pin_hash  text not null
);
alter table public.config enable row level security;
revoke all on public.config from anon, authenticated;
insert into public.config (id, pin_hash)
values (1, extensions.crypt('2026', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- Estado en vivo del concurso (una sola fila, la escuchan las 4 pantallas)
create table if not exists public.estado (
  id              integer primary key default 1 check (id = 1),
  fase            text not null default 'espera' check (fase in ('espera','ronda','resultado','final')),
  ronda           integer not null default 1,
  nombre_a        text not null default '',
  nombre_b        text not null default '',
  enfrentamiento  uuid,
  ronda_inicio    timestamptz,
  ronda_fin       timestamptz,
  preguntas       jsonb not null default '[]',  -- sin la respuesta correcta
  preguntas_ids   integer[] not null default '{}',
  envio_a         jsonb,                        -- {enviado, tiempo_ms, correctas}
  envio_b         jsonb,
  rondas          jsonb not null default '[]',  -- resultado de cada ronda cerrada
  final_en        timestamptz,
  resultado       jsonb,                        -- resultado final del enfrentamiento
  proyector       text not null default 'enfrentamiento' check (proyector in ('enfrentamiento','gala')),
  gala_en         timestamptz,
  sonido          boolean not null default true,
  actualizado     timestamptz not null default now()
);
insert into public.estado (id) values (1) on conflict (id) do nothing;
alter table public.estado enable row level security;
drop policy if exists "estado_lectura" on public.estado;
create policy "estado_lectura" on public.estado for select to anon, authenticated using (true);
revoke insert, update, delete on public.estado from anon, authenticated;
grant select on public.estado to anon, authenticated;

-- Respuestas enviadas por cada delegación (privadas)
create table if not exists public.envios (
  enfrentamiento  uuid not null,
  ronda           integer not null,
  lado            char(1) not null check (lado in ('A','B')),
  respuestas      jsonb not null,
  correctas       integer not null,
  tiempo_ms       integer not null,
  creado          timestamptz not null default now(),
  primary key (enfrentamiento, ronda, lado)
);
alter table public.envios enable row level security;
revoke all on public.envios from anon, authenticated;

-- Historial de enfrentamientos registrados (base de la tabla general)
create table if not exists public.enfrentamientos (
  id             uuid primary key default gen_random_uuid(),
  creado         timestamptz not null default now(),
  nombre_a       text not null,
  nombre_b       text not null,
  clave_a        text not null,
  clave_b        text not null,
  rondas         jsonb not null,
  correctas_a    integer not null,
  correctas_b    integer not null,
  rondas_a       integer not null,
  rondas_b       integer not null,
  ganador        char(1) not null check (ganador in ('A','B')),
  puntaje_a      integer not null,
  puntaje_b      integer not null,
  tiempo_prom_a  numeric not null,
  tiempo_prom_b  numeric not null,
  anulado        boolean not null default false   -- "Borrar resultados" los anula (se pueden recuperar)
);
alter table public.enfrentamientos add column if not exists anulado boolean not null default false;
alter table public.enfrentamientos enable row level security;
drop policy if exists "enfrentamientos_lectura" on public.enfrentamientos;
create policy "enfrentamientos_lectura" on public.enfrentamientos for select to anon, authenticated using (true);
revoke insert, update, delete on public.enfrentamientos from anon, authenticated;
grant select on public.enfrentamientos to anon, authenticated;

-- Tiempo real
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'estado') then
    alter publication supabase_realtime add table public.estado;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'enfrentamientos') then
    alter publication supabase_realtime add table public.enfrentamientos;
  end if;
end $$;
alter table public.enfrentamientos replica identity full;

-- ---------------------------------------------------------------------
-- Utilidades internas
-- ---------------------------------------------------------------------

-- "Católica ", "CATOLICA" y "catolica" son la misma delegación
create or replace function public.normalizar(t text) returns text
language sql immutable set search_path = public as $$
  select upper(regexp_replace(btrim(translate(coalesce(t, ''),
    'áéíóúäëïöüàèìòùâêîôûÁÉÍÓÚÄËÏÖÜÀÈÌÒÙÂÊÎÔÛñÑ',
    'aeiouaeiouaeiouaeiouAEIOUAEIOUAEIOUAEIOUnN')), '\s+', ' ', 'g'))
$$;

create or replace function public._exigir_pin(p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from config where id = 1 and pin_hash = crypt(coalesce(p_pin, ''), pin_hash)) then
    raise exception 'PIN de moderador incorrecto';
  end if;
end $$;

-- Enfrentamientos ya jugados por una delegación
create or replace function public._jugados(p_clave text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from enfrentamientos where not anulado and (clave_a = p_clave or clave_b = p_clave)
$$;

create or replace function public._validar_nombres(p_a text, p_b text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if normalizar(p_a) = '' or normalizar(p_b) = '' then
    raise exception 'Escribe el nombre de ambas delegaciones';
  end if;
  if normalizar(p_a) = normalizar(p_b) then
    raise exception 'La Delegación A y la Delegación B no pueden ser la misma';
  end if;
  if _jugados(normalizar(p_a)) >= 2 then
    raise exception '% ya jugó sus 2 enfrentamientos', btrim(p_a);
  end if;
  if _jugados(normalizar(p_b)) >= 2 then
    raise exception '% ya jugó sus 2 enfrentamientos', btrim(p_b);
  end if;
end $$;

-- Sortea 5 preguntas nunca usadas y abre la ronda (con 4 s de "¡Prepárense!")
create or replace function public._lanzar_ronda(p_ronda integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ids integer[];
  v_preg jsonb;
  v_inicio timestamptz := now() + interval '4 seconds';
begin
  select array_agg(id) into v_ids from (
    select id from preguntas where activa and usada_en is null order by random() limit 5
  ) s;
  if v_ids is null or array_length(v_ids, 1) < 5 then
    raise exception 'No quedan preguntas sin usar en el banco. Reinicia el banco desde el panel.';
  end if;
  update preguntas set usada_en = now() where id = any(v_ids);
  select jsonb_agg(jsonb_build_object('id', p.id, 'enunciado', p.enunciado,
           'opciones', jsonb_build_object('A', p.opcion_a, 'B', p.opcion_b, 'C', p.opcion_c, 'D', p.opcion_d))
           order by array_position(v_ids, p.id))
    into v_preg from preguntas p where p.id = any(v_ids);
  update estado set fase = 'ronda', ronda = p_ronda, ronda_inicio = v_inicio,
    ronda_fin = v_inicio + interval '60 seconds', preguntas = v_preg, preguntas_ids = v_ids,
    envio_a = null, envio_b = null, actualizado = now()
  where id = 1;
end $$;

-- Cierra la ronda: ganador por correctas y, si empatan, por menor tiempo de envío
create or replace function public._cerrar_ronda() returns void
language plpgsql security definer set search_path = public as $$
declare
  e estado%rowtype;
  a jsonb; b jsonb;
  ca int; cb int; ta int; tb int;
  g text; motivo text;
  v_rondas jsonb;
  ra int := 0; rb int := 0; tca int := 0; tcb int := 0; tta int := 0; ttb int := 0;
  r jsonb; gf text; mf text;
begin
  select * into e from estado where id = 1 for update;
  a := coalesce(e.envio_a, jsonb_build_object('enviado', false, 'tiempo_ms', 60000, 'correctas', 0));
  b := coalesce(e.envio_b, jsonb_build_object('enviado', false, 'tiempo_ms', 60000, 'correctas', 0));
  ca := (a->>'correctas')::int; cb := (b->>'correctas')::int;
  ta := (a->>'tiempo_ms')::int; tb := (b->>'tiempo_ms')::int;

  if ca > cb then g := 'A'; motivo := ca || ' correctas vs ' || cb;
  elsif cb > ca then g := 'B'; motivo := cb || ' correctas vs ' || ca;
  elsif ta < tb then g := 'A'; motivo := 'Empate a ' || ca || ' · envió primero (' || round(ta / 1000.0, 1) || ' s vs ' || round(tb / 1000.0, 1) || ' s)';
  elsif tb < ta then g := 'B'; motivo := 'Empate a ' || cb || ' · envió primero (' || round(tb / 1000.0, 1) || ' s vs ' || round(ta / 1000.0, 1) || ' s)';
  else g := 'E'; motivo := 'Empate exacto en correctas y tiempo';
  end if;

  v_rondas := e.rondas || jsonb_build_array(jsonb_build_object(
    'ronda', e.ronda, 'a', a, 'b', b, 'ganador', g, 'motivo', motivo));

  if e.ronda < 3 then
    update estado set fase = 'resultado', envio_a = a, envio_b = b, rondas = v_rondas, actualizado = now() where id = 1;
    return;
  end if;

  -- Fin del enfrentamiento
  for r in select * from jsonb_array_elements(v_rondas) loop
    if r->>'ganador' = 'A' then ra := ra + 1; elsif r->>'ganador' = 'B' then rb := rb + 1; end if;
    tca := tca + (r->'a'->>'correctas')::int; tcb := tcb + (r->'b'->>'correctas')::int;
    tta := tta + (r->'a'->>'tiempo_ms')::int; ttb := ttb + (r->'b'->>'tiempo_ms')::int;
  end loop;
  if ra > rb then gf := 'A'; mf := 'Ganó ' || ra || ' de 3 rondas';
  elsif rb > ra then gf := 'B'; mf := 'Ganó ' || rb || ' de 3 rondas';
  elsif tca > tcb then gf := 'A'; mf := 'Igualdad en rondas · más respuestas correctas';
  elsif tcb > tca then gf := 'B'; mf := 'Igualdad en rondas · más respuestas correctas';
  elsif tta < ttb then gf := 'A'; mf := 'Igualdad en rondas y correctas · menor tiempo total';
  elsif ttb < tta then gf := 'B'; mf := 'Igualdad en rondas y correctas · menor tiempo total';
  else gf := 'E'; mf := 'Empate total · el moderador define al ganador';
  end if;

  update estado set fase = 'final', envio_a = a, envio_b = b, rondas = v_rondas, final_en = now(),
    resultado = jsonb_build_object(
      'ganador', gf, 'motivo', mf, 'rondas_a', ra, 'rondas_b', rb,
      'correctas_a', tca, 'correctas_b', tcb,
      'tiempo_prom_a', round(tta / 3000.0, 1), 'tiempo_prom_b', round(ttb / 3000.0, 1)),
    actualizado = now()
  where id = 1;
end $$;

-- ---------------------------------------------------------------------
-- Funciones públicas (las llaman las pantallas)
-- ---------------------------------------------------------------------

create or replace function public.servidor_ahora() returns timestamptz
language sql stable set search_path = public as $$ select now() $$;

create or replace function public.verificar_pin(p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  return exists (select 1 from config where id = 1 and pin_hash = crypt(coalesce(p_pin, ''), pin_hash));
end $$;

create or replace function public.banco_estado() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total', count(*) filter (where activa),
                            'disponibles', count(*) filter (where activa and usada_en is null))
  from preguntas
$$;

-- Delegación: enviar respuestas. p_respuestas = {"12":"A","40":"C",...}
create or replace function public.enviar_respuestas(p_lado text, p_enfrentamiento uuid, p_ronda integer, p_respuestas jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e estado%rowtype;
  v_ms int; v_ok int;
  v_envio jsonb;
begin
  select * into e from estado where id = 1 for update;
  if p_lado not in ('A','B') then raise exception 'Lado inválido'; end if;
  if e.fase <> 'ronda' or e.enfrentamiento is distinct from p_enfrentamiento or e.ronda <> p_ronda then
    raise exception 'La ronda ya no está activa';
  end if;
  if now() > e.ronda_fin + interval '10 seconds' then
    raise exception 'El tiempo de la ronda terminó';
  end if;
  if (p_lado = 'A' and e.envio_a is not null) or (p_lado = 'B' and e.envio_b is not null) then
    raise exception 'Las respuestas de esta ronda ya fueron enviadas';
  end if;

  v_ms := least(greatest((extract(epoch from (now() - e.ronda_inicio)) * 1000)::int, 0), 60000);
  select count(*)::int into v_ok from preguntas p
  where p.id = any(e.preguntas_ids) and upper(coalesce(p_respuestas->>(p.id::text), '')) = p.correcta;

  insert into envios (enfrentamiento, ronda, lado, respuestas, correctas, tiempo_ms)
  values (e.enfrentamiento, e.ronda, p_lado, coalesce(p_respuestas, '{}'), v_ok, v_ms);

  v_envio := jsonb_build_object('enviado', true, 'tiempo_ms', v_ms, 'correctas', v_ok);
  if p_lado = 'A' then
    update estado set envio_a = v_envio, actualizado = now() where id = 1;
    e.envio_a := v_envio;
  else
    update estado set envio_b = v_envio, actualizado = now() where id = 1;
    e.envio_b := v_envio;
  end if;

  if e.envio_a is not null and e.envio_b is not null then
    perform _cerrar_ronda();
  end if;
  return jsonb_build_object('tiempo_ms', v_ms);
end $$;

-- Cualquiera puede pedir cerrar una ronda vencida (solo actúa si el tiempo ya pasó)
create or replace function public.cerrar_ronda_vencida() returns void
language plpgsql security definer set search_path = public as $$
declare e estado%rowtype;
begin
  select * into e from estado where id = 1 for update;
  if e.fase = 'ronda' and now() > e.ronda_fin + interval '10 seconds' then
    perform _cerrar_ronda();
  end if;
end $$;

-- Moderador -------------------------------------------------------------

create or replace function public.mod_guardar_nombres(p_pin text, p_a text, p_b text) returns void
language plpgsql security definer set search_path = public as $$
declare e estado%rowtype;
begin
  perform _exigir_pin(p_pin);
  select * into e from estado where id = 1 for update;
  if e.fase <> 'espera' then raise exception 'Solo se pueden cambiar los nombres antes de iniciar'; end if;
  perform _validar_nombres(p_a, p_b);
  update estado set nombre_a = upper(regexp_replace(btrim(p_a), '\s+', ' ', 'g')),
                    nombre_b = upper(regexp_replace(btrim(p_b), '\s+', ' ', 'g')), actualizado = now() where id = 1;
end $$;

create or replace function public.mod_iniciar(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare e estado%rowtype;
begin
  perform _exigir_pin(p_pin);
  select * into e from estado where id = 1 for update;
  if e.fase <> 'espera' then raise exception 'Ya hay un enfrentamiento en curso'; end if;
  perform _validar_nombres(e.nombre_a, e.nombre_b);
  update estado set enfrentamiento = gen_random_uuid(), rondas = '[]', resultado = null, final_en = null,
    proyector = 'enfrentamiento', gala_en = null where id = 1;
  perform _lanzar_ronda(1);
end $$;

create or replace function public.mod_siguiente_ronda(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare e estado%rowtype;
begin
  perform _exigir_pin(p_pin);
  select * into e from estado where id = 1 for update;
  if e.fase <> 'resultado' or e.ronda >= 3 then
    raise exception 'La siguiente ronda solo se habilita cuando ambas delegaciones terminaron';
  end if;
  perform _lanzar_ronda(e.ronda + 1);
end $$;

-- Si hubo empate total, el moderador define al ganador
create or replace function public.mod_definir_ganador(p_pin text, p_lado text) returns void
language plpgsql security definer set search_path = public as $$
declare e estado%rowtype;
begin
  perform _exigir_pin(p_pin);
  select * into e from estado where id = 1 for update;
  if e.fase <> 'final' or e.resultado->>'ganador' <> 'E' or p_lado not in ('A','B') then
    raise exception 'No hay un empate por definir';
  end if;
  update estado set resultado = resultado || jsonb_build_object('ganador', p_lado, 'motivo', 'Definido por el moderador tras empate total'),
    actualizado = now() where id = 1;
end $$;

create or replace function public.mod_registrar(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e estado%rowtype;
  g text; pa int; pb int;
begin
  perform _exigir_pin(p_pin);
  select * into e from estado where id = 1 for update;
  if e.fase <> 'final' then raise exception 'El enfrentamiento aún no termina'; end if;
  g := e.resultado->>'ganador';
  if g not in ('A','B') then raise exception 'Primero define al ganador del empate'; end if;
  pa := (case when g = 'A' then 20 else 10 end) + (e.resultado->>'correctas_a')::int;
  pb := (case when g = 'B' then 20 else 10 end) + (e.resultado->>'correctas_b')::int;
  insert into enfrentamientos (nombre_a, nombre_b, clave_a, clave_b, rondas, correctas_a, correctas_b,
    rondas_a, rondas_b, ganador, puntaje_a, puntaje_b, tiempo_prom_a, tiempo_prom_b)
  values (e.nombre_a, e.nombre_b, normalizar(e.nombre_a), normalizar(e.nombre_b), e.rondas,
    (e.resultado->>'correctas_a')::int, (e.resultado->>'correctas_b')::int,
    (e.resultado->>'rondas_a')::int, (e.resultado->>'rondas_b')::int, g, pa, pb,
    (e.resultado->>'tiempo_prom_a')::numeric, (e.resultado->>'tiempo_prom_b')::numeric);
  perform mod_pantalla_inicial(p_pin);
end $$;

-- Reset: reinicia el enfrentamiento en curso (conserva los nombres)
create or replace function public.mod_reset(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update estado set fase = 'espera', ronda = 1, enfrentamiento = null, ronda_inicio = null, ronda_fin = null,
    preguntas = '[]', preguntas_ids = '{}', envio_a = null, envio_b = null, rondas = '[]',
    final_en = null, resultado = null, actualizado = now()
  where id = 1;
end $$;

-- Volver a pantalla inicial: todo al inicio, nombres vacíos, proyector en modo enfrentamiento
create or replace function public.mod_pantalla_inicial(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform mod_reset(p_pin);
  update estado set nombre_a = '', nombre_b = '', proyector = 'enfrentamiento', gala_en = null, actualizado = now()
  where id = 1;
end $$;

create or replace function public.mod_publicar_resultados(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update estado set proyector = 'gala', gala_en = now(), actualizado = now() where id = 1;
end $$;

create or replace function public.mod_borrar_enfrentamiento(p_pin text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update enfrentamientos set anulado = true where id = p_id;
end $$;

create or replace function public.mod_borrar_todo(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update enfrentamientos set anulado = true where not anulado;
end $$;

create or replace function public.mod_sonido(p_pin text, p_activo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update estado set sonido = p_activo, actualizado = now() where id = 1;
end $$;

create or replace function public.mod_cambiar_pin(p_pin text, p_nuevo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _exigir_pin(p_pin);
  if length(coalesce(p_nuevo, '')) < 4 then raise exception 'El PIN debe tener al menos 4 caracteres'; end if;
  update config set pin_hash = crypt(p_nuevo, gen_salt('bf')) where id = 1;
end $$;

-- Para ensayos: vuelve a habilitar todas las preguntas del banco
create or replace function public.mod_reiniciar_banco(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_pin(p_pin);
  update preguntas set usada_en = null where usada_en is not null;
end $$;

-- ---------------------------------------------------------------------
-- Permisos: solo las funciones públicas se pueden llamar desde las pantallas
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.servidor_ahora(), public.verificar_pin(text), public.banco_estado(),
  public.enviar_respuestas(text, uuid, integer, jsonb), public.cerrar_ronda_vencida(),
  public.mod_guardar_nombres(text, text, text), public.mod_iniciar(text), public.mod_siguiente_ronda(text),
  public.mod_definir_ganador(text, text), public.mod_registrar(text), public.mod_reset(text),
  public.mod_pantalla_inicial(text), public.mod_publicar_resultados(text),
  public.mod_borrar_enfrentamiento(text, uuid), public.mod_borrar_todo(text),
  public.mod_sonido(text, boolean), public.mod_cambiar_pin(text, text), public.mod_reiniciar_banco(text)
to anon, authenticated;
