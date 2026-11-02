-- =====================================================================
-- Salão Alvorada — banco de dados (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
-- Perfis:
--   dona          → Evinha: tudo
--   socio         → Idelson: tudo, menos estoque e detalhe das vendas
--                   (vê só o faturamento total das vendas)
--   profissional  → Roberto: a própria agenda, atendimentos e comissão;
--                   pode registrar venda de produto sem ver estoque/totais
-- Nada é apagado de verdade: registros vão para a "lixeira" (deleted_at)
-- e toda alteração fica na tabela auditoria.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
create type papel_usuario   as enum ('dona', 'socio', 'profissional');
create type tipo_preco      as enum ('fixo', 'a_partir', 'combinar');
create type categoria_serv  as enum ('mao_obra', 'quimica');
create type forma_pgto      as enum ('dinheiro', 'cartao', 'pix');
create type status_agenda   as enum ('marcado', 'concluido', 'cancelado', 'faltou');
create type tipo_agenda     as enum ('salao', 'pessoal');
create type tipo_movimento  as enum ('entrada', 'venda', 'uso', 'perda', 'ajuste');
create type origem_venda    as enum ('produtos', 'bazar');

-- ---------- Usuários ----------
create table perfis (
  id                 uuid primary key references auth.users(id) on delete cascade,
  nome               text not null,
  papel              papel_usuario not null default 'profissional',
  tema               text not null default 'azul',          -- 'rosa' | 'azul'
  comissao_mao_obra  numeric(5,2) not null default 0,       -- % quando ele(a) faz
  comissao_quimica   numeric(5,2) not null default 0,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

-- Papel de quem está logado (usado nas regras de acesso)
create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create or replace function sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() in ('dona', 'socio'), false)
$$;

create or replace function sou_dona() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() = 'dona', false)
$$;

-- ---------- Serviços ----------
create table servicos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  duracao_min     int  not null check (duracao_min > 0),
  preco           numeric(10,2),                 -- null quando "a combinar"
  tipo_preco      tipo_preco not null default 'fixo',
  categoria       categoria_serv not null default 'mao_obra',
  so_perfil       uuid references perfis(id),    -- ex.: maquiagem só Evinha
  ativo           boolean not null default true
);

-- ---------- Clientes ----------
create table clientes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  telefone     text,
  endereco     text,
  aniversario  date,
  observacoes  text,
  criado_em    timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on clientes (lower(nome));

-- ---------- Agenda (salão + compromissos pessoais) ----------
create table agendamentos (
  id               uuid primary key default gen_random_uuid(),
  tipo             tipo_agenda not null default 'salao',
  titulo           text,                          -- p/ compromissos pessoais
  cliente_id       uuid references clientes(id),
  profissional_id  uuid references perfis(id),
  servico_id       uuid references servicos(id),
  inicio           timestamptz not null,
  fim              timestamptz not null,
  status           status_agenda not null default 'marcado',
  valor            numeric(10,2),                 -- valor cobrado ao concluir
  forma_pagamento  forma_pgto,
  comissao_valor   numeric(10,2),                 -- calculado ao concluir
  criado_por       uuid references perfis(id) default auth.uid(),
  criado_em        timestamptz not null default now(),
  deleted_at       timestamptz,
  check (fim > inicio)
);
create index on agendamentos (inicio);
create index on agendamentos (profissional_id, inicio);

-- Calcula a comissão quando o atendimento é concluído
create or replace function calcular_comissao() returns trigger
language plpgsql security definer set search_path = public as $$
declare pct numeric; cat categoria_serv;
begin
  if new.tipo = 'salao' and new.status = 'concluido' and new.valor is not null then
    select categoria into cat from servicos where id = new.servico_id;
    select case when cat = 'quimica' then comissao_quimica else comissao_mao_obra end
      into pct from perfis where id = new.profissional_id;
    new.comissao_valor := round(new.valor * coalesce(pct, 0) / 100, 2);
  else
    new.comissao_valor := null;
  end if;
  return new;
end $$;
create trigger trg_comissao before insert or update on agendamentos
  for each row execute function calcular_comissao();

-- ---------- Produtos e estoque (renda extra da Evinha) ----------
create table produtos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  marca           text not null default 'Eudora',   -- Eudora, Boticário...
  preco_venda     numeric(10,2) not null default 0,
  custo           numeric(10,2),
  estoque_minimo  int not null default 2,
  codigo_barras   text,
  criado_em       timestamptz not null default now(),
  deleted_at      timestamptz
);

create table movimentos_estoque (
  id           uuid primary key default gen_random_uuid(),
  produto_id   uuid not null references produtos(id),
  tipo         tipo_movimento not null,
  quantidade   int not null,          -- positivo entra, negativo sai
  custo_unit   numeric(10,2),
  venda_id     uuid,
  observacao   text,
  criado_por   uuid references perfis(id) default auth.uid(),
  criado_em    timestamptz not null default now()
);
create index on movimentos_estoque (produto_id);

create view saldo_estoque with (security_invoker = true) as
  select p.id, p.nome, p.marca, p.preco_venda, p.custo, p.estoque_minimo,
         coalesce(sum(m.quantidade), 0)::int as saldo
  from produtos p left join movimentos_estoque m on m.produto_id = p.id
  where p.deleted_at is null
  group by p.id;

-- ---------- Vendas (produtos e bazar) ----------
create table vendas (
  id               uuid primary key default gen_random_uuid(),
  origem           origem_venda not null default 'produtos',
  cliente_id       uuid references clientes(id),
  descricao        text,                   -- bazar: "blusa azul"
  total            numeric(10,2) not null,
  forma_pagamento  forma_pgto not null,
  criado_por       uuid references perfis(id) default auth.uid(),
  criado_em        timestamptz not null default now(),
  deleted_at       timestamptz
);

create table venda_itens (
  id          uuid primary key default gen_random_uuid(),
  venda_id    uuid not null references vendas(id) on delete cascade,
  produto_id  uuid not null references produtos(id),
  quantidade  int not null check (quantidade > 0),
  preco_unit  numeric(10,2) not null
);

-- Registrar venda: qualquer usuário ativo pode lançar, mas só a dona lê.
-- itens = [{"produto_id": "...", "quantidade": 1, "preco_unit": 74.90}]
create or replace function registrar_venda(
  p_origem origem_venda, p_forma forma_pgto, p_itens jsonb,
  p_cliente uuid default null, p_descricao text default null, p_total numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; it jsonb; v_total numeric := 0;
begin
  if meu_papel() is null then raise exception 'Usuário sem acesso'; end if;
  if p_origem = 'produtos' then
    select coalesce(sum((x->>'quantidade')::int * (x->>'preco_unit')::numeric), 0)
      into v_total from jsonb_array_elements(p_itens) x;
  else
    v_total := coalesce(p_total, 0);
  end if;
  insert into vendas (origem, cliente_id, descricao, total, forma_pagamento)
    values (p_origem, p_cliente, p_descricao, v_total, p_forma) returning id into v_id;
  if p_origem = 'produtos' then
    for it in select * from jsonb_array_elements(p_itens) loop
      insert into venda_itens (venda_id, produto_id, quantidade, preco_unit)
        values (v_id, (it->>'produto_id')::uuid, (it->>'quantidade')::int, (it->>'preco_unit')::numeric);
      insert into movimentos_estoque (produto_id, tipo, quantidade, venda_id)
        values ((it->>'produto_id')::uuid, 'venda', -(it->>'quantidade')::int, v_id);
    end loop;
  end if;
  return v_id;
end $$;

-- Balcão: o que qualquer um pode consultar (sem custo nem quantidade exata)
create or replace function produtos_balcao()
returns table (id uuid, nome text, marca text, preco_venda numeric, disponivel boolean)
language sql stable security definer set search_path = public as $$
  select id, nome, marca, preco_venda, saldo > 0 from saldo_estoque
  where meu_papel() is not null order by nome
$$;

-- Faturamento do mês: dona e sócio. Vendas aparecem só como total.
create or replace function resumo_mes(p_mes date default date_trunc('month', now())::date)
returns table (salao numeric, vendas numeric, total numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(valor), 0) v from agendamentos
    where sou_admin() and tipo = 'salao' and status = 'concluido' and deleted_at is null
      and inicio >= p_mes and inicio < (p_mes + interval '1 month')
  ), v as (
    select coalesce(sum(total), 0) v from vendas
    where sou_admin() and deleted_at is null
      and criado_em >= p_mes and criado_em < (p_mes + interval '1 month')
  )
  select s.v, v.v, s.v + v.v from s, v
$$;

-- ---------- Auditoria ----------
create table auditoria (
  id          bigint generated always as identity primary key,
  usuario     uuid default auth.uid(),
  tabela      text not null,
  acao        text not null,
  registro    jsonb,
  criado_em   timestamptz not null default now()
);

create or replace function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabela, acao, registro)
    values (tg_table_name, tg_op, case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['perfis','servicos','clientes','agendamentos','produtos','movimentos_estoque','vendas'] loop
    execute format('create trigger trg_audit_%s after insert or update or delete on %I
                    for each row execute function registrar_auditoria()', t, t);
  end loop;
end $$;

-- ---------- Regras de acesso (RLS) ----------
alter table perfis             enable row level security;
alter table servicos           enable row level security;
alter table clientes           enable row level security;
alter table agendamentos       enable row level security;
alter table produtos           enable row level security;
alter table movimentos_estoque enable row level security;
alter table vendas             enable row level security;
alter table venda_itens        enable row level security;
alter table auditoria          enable row level security;

-- perfis: todos veem a equipe; só admins alteram
create policy perfis_ler    on perfis for select using (meu_papel() is not null);
create policy perfis_admin  on perfis for all    using (sou_admin()) with check (sou_admin());

-- serviços: todos leem; admins editam
create policy serv_ler   on servicos for select using (meu_papel() is not null);
create policy serv_admin on servicos for all    using (sou_admin()) with check (sou_admin());

-- clientes: todos leem e cadastram; só admins mandam para a lixeira
create policy cli_ler     on clientes for select using (meu_papel() is not null);
create policy cli_inserir on clientes for insert with check (meu_papel() is not null);
create policy cli_editar  on clientes for update using (meu_papel() is not null);

-- agenda: admins veem o salão todo; profissional vê só os dele;
-- compromisso pessoal só quem criou vê
create policy ag_ler on agendamentos for select using (
  (tipo = 'pessoal' and criado_por = auth.uid()) or
  (tipo = 'salao' and (sou_admin() or profissional_id = auth.uid()))
);
create policy ag_inserir on agendamentos for insert with check (
  (tipo = 'pessoal' and criado_por = auth.uid()) or (tipo = 'salao' and sou_admin())
);
create policy ag_editar on agendamentos for update using (
  (tipo = 'pessoal' and criado_por = auth.uid()) or
  (tipo = 'salao' and (sou_admin() or profissional_id = auth.uid()))
);

-- estoque e vendas: só a dona lê/edita direto (os outros usam as funções)
create policy prod_dona on produtos           for all using (sou_dona()) with check (sou_dona());
create policy mov_dona  on movimentos_estoque for all using (sou_dona()) with check (sou_dona());
create policy ven_dona  on vendas             for all using (sou_dona()) with check (sou_dona());
create policy vit_dona  on venda_itens        for all using (sou_dona()) with check (sou_dona());
create policy aud_dona  on auditoria          for select using (sou_dona());

-- ---------- Serviços iniciais ----------
insert into servicos (nome, duracao_min, preco, tipo_preco, categoria) values
  ('Corte masculino',          60,   40, 'fixo',     'mao_obra'),
  ('Corte feminino',           60,   60, 'fixo',     'mao_obra'),
  ('Escova',                   60,   40, 'a_partir', 'mao_obra'),
  ('Aplicação de coloração',   60,   70, 'fixo',     'mao_obra'),
  ('Coloração',               120,   90, 'a_partir', 'quimica'),
  ('Matização',                60,   80, 'fixo',     'quimica'),
  ('Luzes femininas',         180,  250, 'a_partir', 'quimica'),
  ('Progressiva',             120, null, 'combinar', 'quimica'),
  ('Selagem',                 120, null, 'combinar', 'quimica'),
  ('Botox capilar',           120, null, 'combinar', 'quimica'),
  ('Maquiagem',                60,  200, 'fixo',     'mao_obra'),
  ('Penteado',                 90,  180, 'a_partir', 'mao_obra');
-- Depois de criar a conta da Evinha, rode:
--   update servicos set so_perfil = '<id da Evinha>' where nome in ('Maquiagem', 'Penteado');
