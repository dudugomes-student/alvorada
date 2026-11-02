// Edge Function: redefinir-pin
// Deixa a Evinha ou o Idelson criarem um PIN novo para quem entra com usuário + PIN
// (hoje, o Roberto). Roda no servidor do Supabase com a chave secreta,
// que nunca fica dentro do app.
//
// Chamada pelo app: POST { usuario: "roberto", pin: "482915" }
// com o login de quem está pedindo (precisa ser dona ou sócio).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) quem está pedindo?
  const comoQuemPede = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: papel, error: erroPapel } = await comoQuemPede.rpc('meu_papel');
  if (erroPapel || (papel !== 'dona' && papel !== 'socio')) return resposta(403, { erro: 'Só a Evinha ou o Idelson podem trocar PIN.' });

  // 2) dados do pedido
  const { usuario, pin } = await req.json().catch(() => ({}));
  if (typeof usuario !== 'string' || !/^[a-z0-9._-]{2,30}$/.test(usuario)) return resposta(400, { erro: 'Usuário inválido.' });
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return resposta(400, { erro: 'O PIN precisa ter 6 números.' });

  // 3) troca a senha do login ligado a esse usuário
  const admin = createClient(url, secreta);
  const { data: perfil } = await admin.from('perfis').select('usuario_id').eq('usuario', usuario).single();
  if (!perfil?.usuario_id) return resposta(404, { erro: 'Esse usuário ainda não tem login criado.' });
  const { error } = await admin.auth.admin.updateUserById(perfil.usuario_id, { password: pin });
  if (error) return resposta(500, { erro: 'Não foi possível trocar o PIN.' });

  return resposta(200, { ok: true });
});
