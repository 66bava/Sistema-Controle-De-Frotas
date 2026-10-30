import { api, feedback } from './api.js';
let enviando = false;
function mostrar(view) {
  if (enviando) return;
  feedback('');
  for (const section of document.querySelectorAll('[id^="view-"]'))
    section.hidden = section.id !== 'view-' + view;
  document.title =
    (view === 'cadastro' ? 'Cadastro' : view === 'sucesso' ? 'Cadastro recebido' : 'Entrar') +
    ' · Controle de Frotas';
  const title = document.querySelector('#view-' + view + ' h2');
  title.tabIndex = -1;
  title.focus();
}
document
  .querySelectorAll('[data-view]')
  .forEach((button) => button.addEventListener('click', () => mostrar(button.dataset.view)));
document.querySelectorAll('[data-password]').forEach((button) =>
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.password);
    const mostrarSenha = input.type === 'password';
    input.type = mostrarSenha ? 'text' : 'password';
    button.textContent = mostrarSenha ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(mostrarSenha));
  })
);
async function enviar(form, action) {
  if (enviando) return;
  enviando = true;
  feedback('');
  const button = form.querySelector('[type=submit]');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Aguarde…';
  form.setAttribute('aria-busy', 'true');
  try {
    await action();
  } catch (error) {
    feedback(error.message);
  } finally {
    enviando = false;
    button.disabled = false;
    button.innerHTML = original;
    form.removeAttribute('aria-busy');
  }
}
document.querySelector('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  enviar(form, async () => {
    await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    window.location.assign('/painel.html');
  });
});
const senha = document.querySelector('#cadastro-senha');
const confirmacao = document.querySelector('#cadastro-confirmacao');
function conferirConfirmacao() {
  confirmacao.setCustomValidity(
    confirmacao.value && confirmacao.value !== senha.value ? 'As senhas precisam ser iguais.' : ''
  );
}
confirmacao.addEventListener('input', conferirConfirmacao);
senha.addEventListener('input', conferirConfirmacao);
document.querySelector('#cadastro-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  enviar(form, async () => {
    await api('/auth/cadastro', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    form.reset();
    // Liberar a troca de tela após o envio; nenhum dado é enviado novamente.
    enviando = false;
    mostrar('sucesso');
  });
});
api('/auth/sessao')
  .then(() => window.location.replace('/painel.html'))
  .catch((error) => {
    if (error.status !== 401) feedback(error.message);
  });
