-- =====================================================================
-- 002 — Equipe do Salão Alvorada
-- Rode no SQL Editor do Supabase, uma vez, DEPOIS do schema.sql.
-- O que faz:
--   * cadastra Evinha (dona, rosa), Idelson (sócio, azul) e Roberto (profissional, azul)
--   * Roberto entra com usuário + PIN: o endereço interno dele é
--     roberto@alvorada.app (não recebe e-mail; só serve para o login)
--   * liga o login ao perfil pelo e-mail, automaticamente
--   * deixa Maquiagem e Penteado só na agenda da Evinha
-- =====================================================================

-- 1) Perfil passa a ter id próprio; o login fica em usuario_id (opcional)
alter table perfis drop constraint if exists perfis_id_fkey;
alter table perfis alter column id set default gen_random_uuid();
alter table perfis add column if not exists usuario_id uuid unique references auth.users(id) on delete set null;
alter table perfis add column if not exists email text unique;
-- nome de usuário para quem entra com PIN (ex.: "roberto")
alter table perfis add column if not exists usuario text unique;

-- 2) Funções de quem está logado
create or replace function meu_perfil() returns uuid
language sql stable security definer set search_path = public as $$
  select id from perfis where usuario_id = auth.uid() and ativo
$$;

create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where usuario_id = auth.uid() and ativo
$$;

-- 3) "Criado por" passa a apontar para o perfil
alter table agendamentos       alter column criado_por set default meu_perfil();
alter table movimentos_estoque alter column criado_por set default meu_perfil();
alter table vendas             alter column criado_por set default meu_perfil();

-- 4) Regras da agenda usando o perfil
drop policy if exists ag_ler     on agendamentos;
drop policy if exists ag_inserir on agendamentos;
drop policy if exists ag_editar  on agendamentos;
create policy ag_ler on agendamentos for select using (
  (tipo = 'pessoal' and criado_por = meu_perfil()) or
  (tipo = 'salao' and (sou_admin() or profissional_id = meu_perfil()))
);
create policy ag_inserir on agendamentos for insert with check (
  (tipo = 'pessoal' and criado_por = meu_perfil()) or (tipo = 'salao' and sou_admin())
);
create policy ag_editar on agendamentos for update using (
  (tipo = 'pessoal' and criado_por = meu_perfil()) or
  (tipo = 'salao' and (sou_admin() or profissional_id = meu_perfil()))
);

-- 5) Quando um login é criado, liga ao perfil com o mesmo e-mail
create or replace function ligar_login_ao_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update perfis set usuario_id = new.id where lower(email) = lower(new.email) and usuario_id is null;
  return new;
end $$;
drop trigger if exists trg_ligar_login on auth.users;
create trigger trg_ligar_login after insert on auth.users
  for each row execute function ligar_login_ao_perfil();

-- 6) A equipe
insert into perfis (nome, papel, tema, email, usuario, comissao_mao_obra, comissao_quimica) values
  ('Evinha Barbosa',            'dona',         'rosa', 'evinhabarbosa8573@gmail.com', null,      0,  0),
  ('Idelson Barbosa',           'socio',        'azul', 'idelsonbarbosa@terra.com.br', null,      0,  0),
  ('Roberto Ferreira da Silva', 'profissional', 'azul', 'roberto@alvorada.app',        'roberto', 60, 40)
on conflict (email) do nothing;

-- se os logins já tinham sido criados antes, liga agora
update perfis p set usuario_id = u.id
  from auth.users u
  where lower(u.email) = lower(p.email) and p.usuario_id is null;

-- 7) Maquiagem e Penteado: só a Evinha
update servicos set so_perfil = (select id from perfis where email = 'evinhabarbosa8573@gmail.com')
  where nome in ('Maquiagem', 'Penteado');

-- Conferência: deve listar os 3, com "tem_login" verdadeiro para quem já foi convidado
select nome, papel, tema, email, usuario, usuario_id is not null as tem_login from perfis order by papel;
