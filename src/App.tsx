import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { MemoryRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Perfil } from './data/types';
import { DadosProvider, useDados } from './data/store';
import { AvisoProvider, Icone, iniciais } from './ui';
import Inicio from './pages/Inicio';
import Agenda from './pages/Agenda';
import Caixa from './pages/Caixa';
import Estoque from './pages/Estoque';
import Clientes from './pages/Clientes';
import Ajustes from './pages/Ajustes';

const papelNome = { dona: 'Administradora', socio: 'Administrador', profissional: 'Profissional' } as const;

/** Troca de tema com efeito de onda saindo do ponto tocado (View Transitions). */
function trocarComOnda(e: MouseEvent, tema: string, mudar: () => void) {
  const raiz = document.documentElement;
  raiz.style.setProperty('--onda-x', `${e.clientX}px`);
  raiz.style.setProperty('--onda-y', `${e.clientY}px`);
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const aplicar = () => flushSync(() => { raiz.dataset.tema = tema; mudar(); });
  if (doc.startViewTransition && !reduzir) doc.startViewTransition(aplicar);
  else aplicar();
}

function Login() {
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
        <p className="faixa-demo">Versão de demonstração: os dados ficam só neste aparelho. Na versão final cada um entra com e-mail e senha.</p>
      </div>
    </div>
  );
}

function Estrutura() {
  const { eu, sair, podeEstoque, ehAdmin } = useDados();
  const loc = useLocation();
  const menu = useRef<HTMLElement>(null);
  const [pilula, setPilula] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.tema = eu?.tema ?? 'rosa';
  }, [eu?.tema]);

  // pílula do menu desliza até o item ativo
  useLayoutEffect(() => {
    const ativo = menu.current?.querySelector<HTMLElement>('a.ativo');
    setPilula(ativo ? { top: ativo.offsetTop, height: ativo.offsetHeight } : null);
  }, [loc.pathname, eu?.id]);

  if (!eu) return <Login />;

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
          <button className="item" onClick={(e) => trocarComOnda(e, 'rosa', sair)}><Icone nome="sair" /> Sair ({eu.nome.split(' ')[0]})</button>
        </div>
      </nav>

      <main className="conteudo pagina" key={loc.pathname}>
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

export default function App() {
  return (
    <DadosProvider>
      <AvisoProvider>
        <div className="fundo" aria-hidden="true"><span className="blob b1" /><span className="blob b2" /></div>
        <Roteador />
      </AvisoProvider>
    </DadosProvider>
  );
}
