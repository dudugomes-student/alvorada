-- =====================================================================
-- 003 — Tempo real e totais
-- Rode no SQL Editor do Supabase, uma vez, depois do 002.
--   * o app atualiza sozinho quando alguém lança algo em outro aparelho
--   * total de vendas por período (para o sócio, que vê só o total)
--   * cada um pode trocar a própria senha/PIN pelo app (já é nativo do login)
-- =====================================================================

-- 1) Tempo real
do $$ declare t text; begin
  foreach t in array array['perfis','servicos','clientes','agendamentos','produtos','movimentos_estoque','vendas'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 2) Total de vendas num período (dona e sócio)
create or replace function total_vendas(p_inicio timestamptz, p_fim timestamptz)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(total), 0) from vendas
  where sou_admin() and deleted_at is null and criado_em >= p_inicio and criado_em < p_fim
$$;

-- 3) Auditoria: mostra quem fez (perfil) em vez do id do login
create or replace view auditoria_legivel with (security_invoker = true) as
  select a.id, a.criado_em, a.tabela, a.acao, p.id as perfil_id, p.nome
  from auditoria a left join perfis p on p.usuario_id = a.usuario;
