import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { MemoryRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as AppNativo } from '@capacitor/app';
import type { Perfil } from './data/types';
import { DadosProvider, useDados } from './data/store';
import { AvisoProvider, Campo, Icone, Janela, iniciais, useAviso } from './ui';
import Inicio from './pages/Inicio';
import Agenda from './pages/Agenda';
import Caixa from './pages/Caixa';
import Estoque from './pages/Estoque';
import Clientes from './pages/Clientes';
import Ajustes from './pages/Ajustes';

const papelNome = { dona: 'Administradora', socio: 'Administrador', profissional: 'Profissional' } as const;

/** Marca de onde sai a onda da troca de cor (ponto tocado). */
function marcarOnda(x: number, y: number) {
  const raiz = document.documentElement;
  raiz.style.setProperty('--onda-x', `${x}px`);
  raiz.style.setProperty('--onda-y', `${y}px`);
}

/** Troca o tema com efeito de onda (View Transitions), quando o aparelho suporta. */
function aplicarTema(tema: string, mudar: () => void = () => {}) {
  const raiz = document.documentElement;
  if (raiz.dataset.tema === tema) { mudar(); return; }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fazer = () => flushSync(() => { raiz.dataset.tema = tema; mudar(); });
  if (doc.startViewTransition && !reduzir) doc.startViewTransition(fazer);
  else fazer();
}

function trocarComOnda(e: MouseEvent, tema: string, mudar: () => void) {
  marcarOnda(e.clientX, e.clientY);
  aplicarTema(tema, mudar);
}

// ---------- entrada: demonstração (escolher pessoa) ----------
function LoginDemo() {
  const { db, entrar } = useDados();
  const entrarComo = (e: MouseEvent, p: Perfil) => trocarComOnda(e, p.tema, () => entrar(p.id));
  return (
    <div className="login">
      <div className="login-caixa neu">
        <div className="coluna" style={{ gap: 6 }}>
          <span className="marca" style={{ padding: 0, fontSize: 40 }}>Alvorada</span>
          <p className="pequeno">Quem está usando?</p>
        </div>
        <div className="lista">
          {db.perfis.filter((p) => p.ativo).map((p) => (
            <button key={p.id} className="login-pessoa neu" onClick={(e) => entrarComo(e, p)} data-tema={p.tema}>
              <span className="avatar">{iniciais(p.nome)}</span>
              <span className="coluna" style={{ gap: 2 }}>
                <strong>{p.nome}</strong>
                <span className="pequeno">{papelNome[p.papel]}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="faixa-demo">Versão de demonstração: os dados ficam só neste aparelho.</p>
      </div>
    </div>
  );
}

// ---------- entrada: de verdade (e-mail e senha, ou usuário e PIN) ----------
function Login() {
  const { entrarComSenha } = useDados();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ehUsuario = login.trim() !== '' && !login.includes('@');

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const botao = (e.nativeEvent as SubmitEvent).submitter?.getBoundingClientRect();
    if (botao) marcarOnda(botao.left + botao.width / 2, botao.top + botao.height / 2);
    setErro(''); setEnviando(true);
    const r = await entrarComSenha(login, senha);
    setEnviando(false);
    if (r) setErro(r);
  };

  return (
    <div className="login">
      <form className="login-caixa neu" onSubmit={enviar}>
        <div className="coluna" style={{ gap: 6 }}>
          <span className="marca" style={{ padding: 0, fontSize: 40 }}>Alvorada</span>
          <p className="pequeno">Entre com seu e-mail e senha, ou com seu usuário e PIN.</p>
        </div>
        <Campo rotulo="E-mail ou usuário">{(id) => (
          <input id={id} className="entrada" autoComplete="username" autoCapitalize="none" value={login}
            onChange={(e) => setLogin(e.target.value)} placeholder="ex.: roberto" autoFocus />
        )}</Campo>
        <Campo rotulo={ehUsuario ? 'PIN' : 'Senha'}>{(id) => (
          <input id={id} className="entrada" type="password" autoComplete="current-password" value={senha}
            inputMode={ehUsuario ? 'numeric' : undefined} onChange={(e) => setSenha(e.target.value)} />
        )}</Campo>
        {erro && <p role="alert" className="etiqueta alerta" style={{ alignSelf: 'flex-start' }}>{erro}</p>}
        <button className="btn primario" type="submit" disabled={enviando || !login.trim() || !senha}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="pequeno">Esqueceu a senha ou o PIN? Peça para a Evinha ou o Idelson criarem um novo.</p>
      </form>
    </div>
  );
}

function Carregando({ texto }: { texto: string }) {
  return <div className="carregando" role="status"><span className="anel" aria-hidden="true" /><p>{texto}</p></div>;
}

// ---------- trocar a própria senha / PIN ----------
function MinhaSenha({ fechar }: { fechar: () => void }) {
  const { eu, trocarMinhaSenha } = useDados();
  const avisar = useAviso();
  const pin = !!eu?.usuario;
  const [nova, setNova] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState('');
  const valida = pin ? /^\d{6}$/.test(nova) : nova.length >= 6;
  return (
    <form className="coluna" onSubmit={async (e) => {
      e.preventDefault();
      if (!valida) return setErro(pin ? 'O PIN precisa ter 6 números.' : 'A senha precisa ter pelo menos 6 caracteres.');
      if (nova !== repete) return setErro('As duas não são iguais.');
      const r = await trocarMinhaSenha(nova);
      if (r) return setErro(r);
      avisar(pin ? 'PIN trocado' : 'Senha trocada');
      fechar();
    }}>
      <Campo rotulo={pin ? 'Novo PIN (6 números)' : 'Nova senha'}>{(id) => <input id={id} className="entrada" type="password" inputMode={pin ? 'numeric' : undefined} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} autoFocus />}</Campo>
      <Campo rotulo={pin ? 'Repita o PIN' : 'Repita a senha'}>{(id) => <input id={id} className="entrada" type="password" inputMode={pin ? 'numeric' : undefined} autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} />}</Campo>
      {erro && <p role="alert" className="etiqueta alerta" style={{ alignSelf: 'flex-start' }}>{erro}</p>}
      <button className="btn primario" type="submit">Salvar</button>
    </form>
  );
}

// ---------- menu da conta (celular) ----------
function MenuConta({ fechar, abrirSenha, sair }: { fechar: () => void; abrirSenha: () => void; sair: (e: MouseEvent) => void }) {
  const { eu, ehAdmin } = useDados();
  const ir = useNavigate();
  return (
    <div className="coluna">
      <p className="pequeno">{eu?.nome}, {eu ? papelNome[eu.papel].toLowerCase() : ''}</p>
      {ehAdmin && <button className="btn" onClick={() => { ir('/ajustes'); fechar(); }}><Icone nome="ajustes" /> Ajustes</button>}
      <button className="btn" onClick={() => { fechar(); abrirSenha(); }}><Icone nome="editar" /> {eu?.usuario ? 'Trocar meu PIN' : 'Trocar minha senha'}</button>
      <button className="btn perigo" onClick={(e) => { fechar(); sair(e); }}><Icone nome="sair" /> Sair</button>
    </div>
  );
}

function Estrutura() {
  const { eu, sair, podeEstoque, ehAdmin, demo, carregando, erro, recarregar } = useDados();
  const loc = useLocation();
  const menu = useRef<HTMLElement>(null);
  const [pilula, setPilula] = useState<{ top: number; height: number } | null>(null);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);

  // botão "voltar" do Android: volta para o início; no início, minimiza o app
  const irPara = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const ouvinte = AppNativo.addListener('backButton', () => {
      if (loc.pathname !== '/') irPara('/');
      else AppNativo.minimizeApp();
    });
    return () => { ouvinte.then((o) => o.remove()); };
  }, [loc.pathname, irPara]);

  // a cor da tela segue quem entrou (rosa Evinha, azul Idelson e Roberto)
  useEffect(() => { aplicarTema(eu?.tema ?? 'rosa'); }, [eu?.tema]);

  useLayoutEffect(() => {
    const ativo = menu.current?.querySelector<HTMLElement>('a.ativo');
    setPilula(ativo ? { top: ativo.offsetTop, height: ativo.offsetHeight } : null);
  }, [loc.pathname, eu?.id]);

  if (!eu) {
    if (carregando) return <Carregando texto="Abrindo o Alvorada…" />;
    if (erro && !demo) return (
      <div className="login"><div className="login-caixa neu">
        <h2>Não deu para abrir</h2><p>{erro}</p>
        <div className="linha"><button className="btn primario" onClick={recarregar}>Tentar de novo</button><button className="btn" onClick={sair}>Sair</button></div>
      </div></div>
    );
    return demo ? <LoginDemo /> : <Login />;
  }

  const sairComOnda = (e: MouseEvent) => trocarComOnda(e, 'rosa', sair);
  const links = [
    { to: '/', nome: eu.papel === 'profissional' ? 'Meu painel' : 'Início', icone: 'inicio' },
    { to: '/agenda', nome: 'Agenda', icone: 'agenda' },
    { to: '/caixa', nome: eu.papel === 'profissional' ? 'Vender' : 'Caixa', icone: 'caixa' },
    ...(podeEstoque ? [{ to: '/estoque', nome: 'Estoque', icone: 'estoque' }] : []),
    { to: '/clientes', nome: 'Clientes', icone: 'clientes' },
  ];

  return (
    <div className="app">
      <nav className="lateral" aria-label="Menu principal" ref={menu}>
        {pilula && <span className="pilula" style={{ top: pilula.top, height: pilula.height }} aria-hidden="true" />}
        <span className="marca">Alvorada</span>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? 'ativo' : '')}>
            <Icone nome={l.icone} /> {l.nome}
          </NavLink>
        ))}
        <div className="rodape">
          {ehAdmin && (
            <NavLink to="/ajustes" className={({ isActive }) => (isActive ? 'ativo' : '')}>
              <Icone nome="ajustes" /> Ajustes
            </NavLink>
          )}
          {!demo && <button className="item" onClick={() => setSenhaAberta(true)}><Icone nome="editar" /> {eu.usuario ? 'Trocar meu PIN' : 'Minha senha'}</button>}
          <button className="item" onClick={sairComOnda}><Icone nome="sair" /> Sair ({eu.nome.split(' ')[0]})</button>
        </div>
      </nav>

      <button className="botao-conta btn btn-icone" aria-label="Minha conta" onClick={() => setContaAberta(true)}>
        <span className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}>{iniciais(eu.nome)}</span>
      </button>

      <main className="conteudo pagina" key={loc.pathname}>
        {erro && !demo && (
          <p className="faixa-demo linha entre" role="alert">{erro} <button className="btn mini" onClick={recarregar}>Tentar de novo</button></p>
        )}
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/caixa" element={<Caixa />} />
          {podeEstoque && <Route path="/estoque" element={<Estoque />} />}
          <Route path="/clientes" element={<Clientes />} />
          {ehAdmin && <Route path="/ajustes" element={<Ajustes />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="barra-inferior glass" aria-label="Menu">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? 'ativo' : '')}>
            <Icone nome={l.icone} /> {l.nome}
          </NavLink>
        ))}
      </nav>

      <Janela titulo={eu.usuario ? 'Trocar meu PIN' : 'Trocar minha senha'} aberta={senhaAberta} fechar={() => setSenhaAberta(false)}>
        <MinhaSenha fechar={() => setSenhaAberta(false)} />
      </Janela>
      <Janela titulo="Minha conta" aberta={contaAberta} fechar={() => setContaAberta(false)}>
        <MenuConta fechar={() => setContaAberta(false)} abrirSenha={() => setSenhaAberta(true)} sair={sairComOnda} />
      </Janela>
    </div>
  );
}

/*
 * Navegação interna (MemoryRouter): não depende do endereço da janela,
 * então funciona igual no navegador, em pré-visualizações, no .exe e no .apk.
 * A chave por usuário faz cada login começar na página inicial.
 */
function Roteador() {
  const { eu } = useDados();
  return (
    <MemoryRouter key={eu?.id ?? 'saiu'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Estrutura />
    </MemoryRouter>
  );
}

function ComDados() {
  const avisar = useAviso();
  return (
    <DadosProvider aoErro={(m) => avisar(m, 'erro')}>
      <div className="fundo" aria-hidden="true"><span className="blob b1" /><span className="blob b2" /></div>
      <Roteador />
    </DadosProvider>
  );
}

export default function App() {
  return (
    <AvisoProvider>
      <ComDados />
    </AvisoProvider>
  );
}
