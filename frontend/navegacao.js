const icons = {
  inicio: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  nova: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  viagens:
    '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 11h16M8 15h3M8 18h7"/>',
  aprovacoes: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 10l2 2 4-5"/>',
  veiculos: '<path d="m5 6-2 7v6h18v-6l-2-7zM3 13h18M6 19v2M18 19v2M6 16h2M16 16h2"/>',
  setores:
    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-6h4v6"/>',
};
const labels = {
  inicio: 'Início',
  nova: 'Nova viagem',
  viagens: 'Minhas viagens',
  aprovacoes: 'Aprovar condutores',
  veiculos: 'Veículos',
  setores: 'Setores',
};
const urls = {
  inicio: '/painel.html',
  nova: '/ocorrencias.html?nova=1',
  viagens: '/ocorrencias.html',
  aprovacoes: '/painel.html?secao=aprovacoes',
  veiculos: '/painel.html?secao=veiculos',
  setores: '/painel.html?secao=setores',
};
export function selecionarNavegacao(chave) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === chave) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const ativo = document.querySelector('[data-nav="' + chave + '"]');
  document.getElementById('header-location').textContent =
    ativo?.textContent || labels[chave] || 'Controle de Frotas';
}
function link(chave, texto) {
  const a = document.createElement('a');
  a.href = urls[chave];
  a.id = 'nav-' + chave;
  a.dataset.nav = chave;
  const icon = document.createElement('span');
  icon.className = 'nav-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    icons[chave] +
    '</svg>';
  const label = document.createElement('span');
  label.textContent = texto || labels[chave];
  a.append(icon, label);
  return a;
}
export function iniciarNavegacao(usuario, chave = 'inicio') {
  const nav = document.getElementById('sidebar-links');
  nav.replaceChildren();
  nav.append(link('inicio'));
  if (usuario.perfil === 'driver') nav.append(link('nova'));
  nav.append(link('viagens', usuario.perfil === 'driver' ? 'Minhas viagens' : 'Todas as viagens'));
  if (usuario.perfil === 'admin') {
    const heading = document.createElement('p');
    heading.className = 'nav-group-title';
    heading.textContent = 'ADMINISTRAÇÃO';
    nav.append(heading);
    for (const key of ['aprovacoes', 'veiculos', 'setores']) nav.append(link(key));
  }
  document.getElementById('menu-nome').textContent = usuario.nome;
  document.getElementById('perfil').textContent = {
    admin: 'Administrador',
    driver: 'Condutor',
    viewer: 'Consulta',
  }[usuario.perfil];
  document.getElementById('menu-avatar').textContent = usuario.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  selecionarNavegacao(chave);
  const sidebar = document.getElementById('sidebar'),
    toggle = document.getElementById('abrir-menu'),
    close = document.getElementById('fechar-menu'),
    overlay = document.getElementById('menu-overlay');
  const media = window.matchMedia('(max-width: 900px)');
  let aberto = false;
  function atualizar() {
    const modal = media.matches && aberto;
    document.body.classList.toggle('menu-aberto', modal);
    toggle.setAttribute('aria-expanded', String(modal));
    toggle.setAttribute(
      'aria-label',
      modal ? 'Fechar menu de navegação' : 'Abrir menu de navegação'
    );
    sidebar.inert = media.matches && !aberto;
    sidebar.setAttribute('aria-hidden', String(media.matches && !aberto));
    overlay.hidden = !modal;
  }
  function fechar(foco = true) {
    aberto = false;
    atualizar();
    if (foco) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    aberto = !aberto;
    atualizar();
    if (aberto) nav.querySelector('a')?.focus();
  });
  close.addEventListener('click', () => fechar());
  overlay.addEventListener('click', () => fechar());
  nav.addEventListener('click', (event) => {
    if (media.matches && event.target.closest('a')) fechar(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!media.matches || !aberto) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      fechar();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...sidebar.querySelectorAll('a[href], button:not([disabled])')].filter(
      (el) => el.getClientRects().length
    );
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  media.addEventListener('change', () => {
    aberto = false;
    atualizar();
  });
  atualizar();
  toggle.disabled = false;
}
export function atalhosInicio(usuario) {
  const container = document.getElementById('atalhos-inicio');
  container.replaceChildren();
  const atalhos =
    usuario.perfil === 'driver'
      ? [
          ['nova', 'Nova viagem', 'Registre a saída, o veículo e o destino.'],
          ['viagens', 'Minhas viagens', 'Abra a viagem em andamento, registre a chegada e assine.'],
        ]
      : usuario.perfil === 'admin'
        ? [
            ['viagens', 'Todas as viagens', 'Consulte as saídas e chegadas da frota.'],
            ['aprovacoes', 'Aprovar condutores', 'Libere o acesso de novos condutores.'],
            ['veiculos', 'Veículos', 'Cadastre, edite e organize os veículos.'],
            ['setores', 'Setores', 'Gerencie os setores usados nas viagens.'],
          ]
        : [['viagens', 'Todas as viagens', 'Consulte os registros de transporte da equipe.']];
  for (const [key, title, description] of atalhos) {
    const a = document.createElement('a');
    a.href = urls[key];
    a.className = 'home-shortcut';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    const p = document.createElement('p');
    p.textContent = description;
    const arrow = document.createElement('span');
    arrow.className = 'shortcut-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    a.append(h3, p, arrow);
    container.append(a);
  }
}
