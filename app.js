console.log('[Mave] Script carregado.');

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_CFG = window.SUPABASE_CONFIG || {};
const sb = (window.supabase && SUPABASE_CFG.url && SUPABASE_CFG.anonKey)
  ? window.supabase.createClient(SUPABASE_CFG.url, SUPABASE_CFG.anonKey)
  : null;

// ============================================================
// CONSTANTES
// ============================================================
const COR_HEX_FALLBACK = '#8A857C';

// Restricao de dominio para cadastro (espelhada por trigger no auth.users)
const ALLOWED_EMAIL_DOMAIN = 'mavebr.com';

// Mapa entre as chaves do state.config (plural) e os valores
// gravados na coluna config_items.tipo (singular).
const TIPO_FROM_KEY = {
  diametros: 'diametro',
  caixas: 'caixa',
  linhas: 'linha',
  turnos: 'turno',
  operadores: 'operador',
  metas: 'meta',
};

const TABLE_FOR = {
  trancadeira: 'registros_trancadeira',
  grampeadeira: 'registros_grampeadeira',
  extensor: 'registros_extensor',
};

// ============================================================
// HELPERS GERAIS
// ============================================================
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function nowTime() { return new Date().toTimeString().slice(0, 5); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function traduzirErroAuth(err) {
  const msg = (err && err.message) || '';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (cheque sua caixa de entrada).';
  if (/User already registered/i.test(msg) || /already registered/i.test(msg)) return 'Este e-mail já está cadastrado. Faça login.';
  if (/Password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many requests/i.test(msg)) return 'Muitas tentativas em pouco tempo. Aguarde alguns segundos.';
  if (/mavebr|@mavebr\.com são permitidos/i.test(msg) || /Database error saving new user/i.test(msg)) {
    return `Use seu e-mail corporativo @${ALLOWED_EMAIL_DOMAIN}.`;
  }
  return msg || 'Erro ao autenticar.';
}

// ============================================================
// MAPPERS DB <-> APP
// O DB usa snake_case; o app usa camelCase em alguns campos.
// ============================================================
const FROM_DB = {
  trancadeira: (row) => ({
    id: row.id,
    hora: row.hora,
    data: row.data,
    tipoCaixa: row.tipo_caixa,
    linha: row.linha,
    cor: row.cor,
    diametro: row.diametro,
    peso: row.peso != null ? Number(row.peso).toFixed(2) : '0.00',
  }),
  grampeadeira: (row) => ({
    id: row.id,
    hora: row.hora,
    data: row.data,
    op: row.op,
    hi: row.hi,
    hf: row.hf,
    operador: row.operador,
    qtd: row.qtd,
    tam: row.tam != null ? Number(row.tam).toFixed(2) : '0.00',
    gancho: row.gancho,
    he: !!row.he,
    he_dados: row.he_dados || null,
  }),
  extensor: (row) => ({
    id: row.id,
    hora: row.hora,
    data: row.data,
    tipoCaixa: row.tipo_caixa,
    cor: row.cor,
    diametro: row.diametro,
    qtd: row.qtd,
  }),
};

const TO_DB = {
  trancadeira: (r, userId) => ({
    user_id: userId || null,
    data: r.data,
    tipo_caixa: r.tipoCaixa,
    linha: r.linha,
    cor: r.cor,
    diametro: r.diametro,
    peso: parseFloat(r.peso),
  }),
  grampeadeira: (r, userId) => ({
    user_id: userId || null,
    data: r.data,
    op: r.op,
    hi: r.hi,
    hf: r.hf,
    operador: r.operador,
    qtd: parseInt(r.qtd, 10),
    tam: parseFloat(r.tam),
    gancho: r.gancho,
    he: !!r.he,
    he_dados: r.he ? r.he_dados : null,
  }),
  extensor: (r, userId) => ({
    user_id: userId || null,
    data: r.data,
    tipo_caixa: r.tipoCaixa,
    cor: r.cor,
    diametro: r.diametro,
    qtd: parseInt(r.qtd, 10),
  }),
};

// ============================================================
// DATA LAYER (Supabase)
// ============================================================
async function dbLoadConfig() {
  const [coresRes, itemsRes, opsRes, linhasRes, turnosRes, metasRes] = await Promise.all([
    sb.from('cores').select('*').order('created_at', { ascending: true }),
    sb.from('config_items').select('*').order('created_at', { ascending: true }),
    sb.from('operadores').select('*').order('created_at', { ascending: true }),
    sb.from('linhas').select('*').order('created_at', { ascending: true }),
    sb.from('turnos').select('*').order('created_at', { ascending: true }),
    sb.from('metas').select('*').order('created_at', { ascending: true }),
  ]);
  if (coresRes.error) throw coresRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (opsRes.error) throw opsRes.error;
  if (linhasRes.error) throw linhasRes.error;
  if (turnosRes.error) throw turnosRes.error;
  if (metasRes.error) throw metasRes.error;

  const items = itemsRes.data || [];
  const byTipo = (tipo) => items.filter(i => i.tipo === tipo);
  const operadoresList = (opsRes.data || []).map(o => ({
    id: o.id,
    nome: o.nome,
    matricula: o.matricula || '',
    funcao: o.funcao || '',
    turno: o.turno || '',
    capacidade: o.capacidade_produtiva != null ? Number(o.capacidade_produtiva) : null,
  }));
  const linhasList = (linhasRes.data || []).map(l => ({
    id: l.id,
    nome: l.nome,
    capacidade: l.capacidade_produtiva != null ? Number(l.capacidade_produtiva) : null,
  }));
  const turnosList = (turnosRes.data || []).map(t => ({
    id: t.id,
    nome: t.nome,
    hi: t.hora_inicio || '',
    hf: t.hora_fim || '',
  }));
  const metasList = (metasRes.data || []).map(m => ({
    id: m.id,
    tipo: m.tipo,
    operador: m.operador || '',
    valor: m.valor != null ? Number(m.valor) : 0,
  }));

  state.configIds = {
    diametros: byTipo('diametro').map(i => i.id),
    caixas:    byTipo('caixa').map(i => i.id),
  };

  return {
    cores:     (coresRes.data || []).map(c => ({ id: c.id, nome: c.nome, hex: c.hex })),
    diametros: byTipo('diametro').map(i => i.valor),
    caixas:    byTipo('caixa').map(i => i.valor),
    linhas:    linhasList,
    turnos:    turnosList,
    operadores: operadoresList,
    metas:     metasList,
  };
}

async function dbLoadRegistros() {
  const [trRes, grRes, exRes] = await Promise.all([
    sb.from('registros_trancadeira').select('*').order('created_at', { ascending: true }),
    sb.from('registros_grampeadeira').select('*').order('created_at', { ascending: true }),
    sb.from('registros_extensor').select('*').order('created_at', { ascending: true }),
  ]);
  if (trRes.error) throw trRes.error;
  if (grRes.error) throw grRes.error;
  if (exRes.error) throw exRes.error;
  return {
    trancadeira:  (trRes.data || []).map(FROM_DB.trancadeira),
    grampeadeira: (grRes.data || []).map(FROM_DB.grampeadeira),
    extensor:     (exRes.data || []).map(FROM_DB.extensor),
  };
}

async function getCurrentUserId() {
  const { data } = await sb.auth.getUser();
  return data && data.user ? data.user.id : null;
}

// ===== Tema (claro/escuro) =====
const THEME_KEY = 'mave_tema';
function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
function setTheme(t) {
  const next = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  const btn = document.getElementById('btnTema');
  if (btn) btn.textContent = next === 'dark' ? 'Tema claro' : 'Tema escuro';
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

// ============================================================
// ESTADO
// ============================================================
const state = {
  config: { cores: [], diametros: [], caixas: [], linhas: [], turnos: [], operadores: [], metas: [] },
  configIds: { diametros: [], caixas: [] },
  email: null,
  profile: null,
  recovering: false,
  registros: { trancadeira: [], grampeadeira: [], extensor: [] },
  editing: { trancadeira: null, grampeadeira: null, extensor: null },
  filtros: {
    trancadeira: { de: '', ate: '', operador: '' },
    grampeadeira: { de: '', ate: '', operador: '' },
    extensor:    { de: '', ate: '', operador: '' },
  },
};

// ============================================================
// TELAS
// ============================================================
const screenLogin = document.getElementById('screen-login');
const screenSignup = document.getElementById('screen-signup');
const screenPending = document.getElementById('screen-pending');
const screenForgot = document.getElementById('screen-forgot');
const screenReset = document.getElementById('screen-reset');
const screenApp = document.getElementById('screen-app');

function hideAuthScreens() {
  screenLogin.classList.add('hidden');
  screenSignup.classList.add('hidden');
  if (screenPending) screenPending.classList.add('hidden');
  if (screenForgot) screenForgot.classList.add('hidden');
  if (screenReset) screenReset.classList.add('hidden');
  screenApp.style.display = 'none';
}
function showLogin() {
  hideAuthScreens();
  screenLogin.classList.remove('hidden');
  window.scrollTo(0, 0);
}
function showSignup() {
  hideAuthScreens();
  screenSignup.classList.remove('hidden');
  window.scrollTo(0, 0);
}
function showPending() {
  hideAuthScreens();
  if (screenPending) screenPending.classList.remove('hidden');
  window.scrollTo(0, 0);
}
function showForgot() {
  hideAuthScreens();
  if (screenForgot) screenForgot.classList.remove('hidden');
  window.scrollTo(0, 0);
}
function showReset() {
  hideAuthScreens();
  if (screenReset) screenReset.classList.remove('hidden');
  window.scrollTo(0, 0);
}
function showApp() {
  hideAuthScreens();
  screenApp.style.display = 'block';
  window.scrollTo(0, 0);
}

// ============================================================
// MOSTRAR/OCULTAR SENHA
// ============================================================
const senhaInput = document.getElementById('senha');
document.getElementById('togglePassword').addEventListener('click', () => {
  const isPwd = senhaInput.type === 'password';
  senhaInput.type = isPwd ? 'text' : 'password';
  document.getElementById('togglePassword').textContent = isPwd ? 'Ocultar' : 'Mostrar';
});
const signupSenhaInput = document.getElementById('signup-senha');
document.getElementById('toggleSignupPassword').addEventListener('click', () => {
  const isPwd = signupSenhaInput.type === 'password';
  signupSenhaInput.type = isPwd ? 'text' : 'password';
  document.getElementById('toggleSignupPassword').textContent = isPwd ? 'Ocultar' : 'Mostrar';
});
const resetSenhaInput = document.getElementById('reset-senha');
const toggleResetPasswordBtn = document.getElementById('toggleResetPassword');
if (toggleResetPasswordBtn && resetSenhaInput) {
  toggleResetPasswordBtn.addEventListener('click', () => {
    const isPwd = resetSenhaInput.type === 'password';
    resetSenhaInput.type = isPwd ? 'text' : 'password';
    toggleResetPasswordBtn.textContent = isPwd ? 'Ocultar' : 'Mostrar';
  });
}

// ============================================================
// NAVEGAÇÃO ENTRE LOGIN E CADASTRO
// ============================================================
document.getElementById('linkCadastro').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('alertSignup').classList.remove('show');
  document.getElementById('signupForm').reset();
  showSignup();
});
document.getElementById('linkVoltarLogin').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('alert').classList.remove('show');
  showLogin();
});
const linkEsqueciSenha = document.getElementById('linkEsqueciSenha');
if (linkEsqueciSenha) {
  linkEsqueciSenha.addEventListener('click', (e) => {
    e.preventDefault();
    const alertForgot = document.getElementById('alertForgot');
    if (alertForgot) alertForgot.classList.remove('show');
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
      forgotForm.reset();
      const preset = document.getElementById('email').value.trim();
      if (preset) document.getElementById('forgot-email').value = preset;
    }
    showForgot();
  });
}
const linkVoltarLoginForgot = document.getElementById('linkVoltarLoginForgot');
if (linkVoltarLoginForgot) {
  linkVoltarLoginForgot.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('alert').classList.remove('show');
    showLogin();
  });
}

// ============================================================
// LOGIN
// ============================================================
const loginForm = document.getElementById('loginForm');
const alertBox = document.getElementById('alert');
const btnLogin = loginForm.querySelector('.btn-login');
const lembrarCheckbox = document.getElementById('lembrar');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sb) { alertBox.textContent = 'Supabase não configurado. Edite supabase-config.js.'; alertBox.classList.add('show'); return; }
  const email = document.getElementById('email').value.trim().toLowerCase();
  const senha = senhaInput.value;
  if (!email || !senha) {
    alertBox.textContent = 'Preencha e-mail e senha.';
    alertBox.classList.add('show');
    return;
  }
  alertBox.classList.remove('show');
  btnLogin.textContent = 'Entrando...';
  btnLogin.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  btnLogin.textContent = 'Entrar';
  btnLogin.disabled = false;
  if (error) {
    alertBox.textContent = traduzirErroAuth(error);
    alertBox.classList.add('show');
    senhaInput.value = '';
    senhaInput.focus();
    return;
  }
  await enterApp(data.user.email);
});

// ============================================================
// CADASTRO
// ============================================================
const signupForm = document.getElementById('signupForm');
const alertSignup = document.getElementById('alertSignup');
const btnSignup = signupForm.querySelector('.btn-login');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sb) { alertSignup.textContent = 'Supabase não configurado. Edite supabase-config.js.'; alertSignup.classList.add('show'); return; }
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const senha = signupSenhaInput.value;
  const confirma = document.getElementById('signup-confirma').value;
  if (!email || !senha || !confirma) {
    alertSignup.textContent = 'Preencha todos os campos.';
    alertSignup.classList.add('show');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alertSignup.textContent = 'Digite um e-mail válido.';
    alertSignup.classList.add('show');
    return;
  }
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    alertSignup.textContent = `Use seu e-mail corporativo @${ALLOWED_EMAIL_DOMAIN}.`;
    alertSignup.classList.add('show');
    return;
  }
  if (senha.length < 6) {
    alertSignup.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
    alertSignup.classList.add('show');
    return;
  }
  if (senha !== confirma) {
    alertSignup.textContent = 'As senhas não coincidem.';
    alertSignup.classList.add('show');
    return;
  }
  alertSignup.classList.remove('show');
  btnSignup.textContent = 'Criando conta...';
  btnSignup.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: senha });
  btnSignup.textContent = 'Criar conta';
  btnSignup.disabled = false;
  if (error) {
    alertSignup.textContent = traduzirErroAuth(error);
    alertSignup.classList.add('show');
    return;
  }

  // Se a confirmação por e-mail estiver desativada nas configs do projeto,
  // o Supabase ja devolve session direto. Em qualquer caso, o usuario novo
  // entra como pending e precisa ser aprovado por um admin.
  if (data.session) {
    signupForm.reset();
    await enterApp(data.user.email);
    return;
  }

  signupForm.reset();
  document.getElementById('email').value = email;
  senhaInput.focus();
  alertBox.textContent = 'Conta criada! Confirme seu e-mail e aguarde a aprovação do administrador.';
  alertBox.style.background = 'var(--success-bg)';
  alertBox.style.color = 'var(--success)';
  alertBox.style.borderColor = '#B5DCC4';
  alertBox.classList.add('show');
  showLogin();
  setTimeout(() => {
    alertBox.style.background = '';
    alertBox.style.color = '';
    alertBox.style.borderColor = '';
  }, 6000);
});

// ============================================================
// ESQUECI A SENHA (envio do link)
// ============================================================
const forgotForm = document.getElementById('forgotForm');
const alertForgot = document.getElementById('alertForgot');
if (forgotForm) {
  const btnForgot = forgotForm.querySelector('.btn-login');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) {
      alertForgot.textContent = 'Supabase não configurado.';
      alertForgot.classList.add('show');
      return;
    }
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    if (!email) {
      alertForgot.textContent = 'Informe seu e-mail.';
      alertForgot.style.background = '';
      alertForgot.style.color = '';
      alertForgot.style.borderColor = '';
      alertForgot.classList.add('show');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alertForgot.textContent = 'Digite um e-mail válido.';
      alertForgot.style.background = '';
      alertForgot.style.color = '';
      alertForgot.style.borderColor = '';
      alertForgot.classList.add('show');
      return;
    }
    alertForgot.classList.remove('show');
    btnForgot.textContent = 'Enviando...';
    btnForgot.disabled = true;
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    btnForgot.textContent = 'Enviar link de recuperação';
    btnForgot.disabled = false;
    if (error) {
      alertForgot.textContent = traduzirErroAuth(error);
      alertForgot.style.background = '';
      alertForgot.style.color = '';
      alertForgot.style.borderColor = '';
      alertForgot.classList.add('show');
      return;
    }
    alertForgot.textContent = 'Se este e-mail estiver cadastrado, você receberá um link em instantes. Verifique também a caixa de spam.';
    alertForgot.style.background = 'var(--success-bg)';
    alertForgot.style.color = 'var(--success)';
    alertForgot.style.borderColor = '#B5DCC4';
    alertForgot.classList.add('show');
  });
}

// ============================================================
// NOVA SENHA (apos PASSWORD_RECOVERY)
// ============================================================
const resetForm = document.getElementById('resetForm');
const alertReset = document.getElementById('alertReset');
if (resetForm) {
  const btnReset = resetForm.querySelector('.btn-login');
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) {
      alertReset.textContent = 'Supabase não configurado.';
      alertReset.classList.add('show');
      return;
    }
    const nova = resetSenhaInput.value;
    const confirma = document.getElementById('reset-confirma').value;
    if (!nova || !confirma) {
      alertReset.textContent = 'Preencha os dois campos.';
      alertReset.style.background = '';
      alertReset.style.color = '';
      alertReset.style.borderColor = '';
      alertReset.classList.add('show');
      return;
    }
    if (nova.length < 6) {
      alertReset.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
      alertReset.style.background = '';
      alertReset.style.color = '';
      alertReset.style.borderColor = '';
      alertReset.classList.add('show');
      return;
    }
    if (nova !== confirma) {
      alertReset.textContent = 'As senhas não coincidem.';
      alertReset.style.background = '';
      alertReset.style.color = '';
      alertReset.style.borderColor = '';
      alertReset.classList.add('show');
      return;
    }
    alertReset.classList.remove('show');
    btnReset.textContent = 'Salvando...';
    btnReset.disabled = true;
    const { error } = await sb.auth.updateUser({ password: nova });
    btnReset.textContent = 'Salvar nova senha';
    btnReset.disabled = false;
    if (error) {
      alertReset.textContent = traduzirErroAuth(error);
      alertReset.style.background = '';
      alertReset.style.color = '';
      alertReset.style.borderColor = '';
      alertReset.classList.add('show');
      return;
    }
    state.recovering = false;
    resetForm.reset();
    try { history.replaceState({}, '', window.location.pathname); } catch (e2) {}
    await sb.auth.signOut();
    alertBox.textContent = 'Senha redefinida com sucesso. Entre com a nova senha.';
    alertBox.style.background = 'var(--success-bg)';
    alertBox.style.color = 'var(--success)';
    alertBox.style.borderColor = '#B5DCC4';
    alertBox.classList.add('show');
    showLogin();
    setTimeout(() => {
      alertBox.style.background = '';
      alertBox.style.color = '';
      alertBox.style.borderColor = '';
    }, 6000);
  });
}

// ============================================================
// LOGOUT + TEMA
// ============================================================
document.getElementById('btnTema').addEventListener('click', toggleTheme);

async function doLogout() {
  if (sb) await sb.auth.signOut();
  state.email = null;
  state.profile = null;
  state.registros = { trancadeira: [], grampeadeira: [], extensor: [] };
  state.editing = { trancadeira: null, grampeadeira: null, extensor: null };
  setUserChrome(null);
  loginForm.reset();
  alertBox.classList.remove('show');
  showLogin();
}

document.getElementById('btnLogout').addEventListener('click', doLogout);
const btnPendingLogout = document.getElementById('btnPendingLogout');
if (btnPendingLogout) btnPendingLogout.addEventListener('click', doLogout);

// ============================================================
// ABAS
// ============================================================
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
function activateTab(target) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
  panels.forEach(p => p.classList.toggle('active', p.id === 'panel-' + target));
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

// ============================================================
// HELPERS GERAIS (UI)
// ============================================================
const toast = document.getElementById('toast');
function showToast(msg = 'Registro salvo com sucesso!', kind = 'success') {
  toast.textContent = msg;
  toast.classList.toggle('toast-error', kind === 'error');
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), kind === 'error' ? 3500 : 2500);
}

// ============================================================
// FILTRO POR DATA + EXPORT CSV
// ============================================================
function applyFilter(items, filtro) {
  const de = filtro && filtro.de ? filtro.de : null;
  const ate = filtro && filtro.ate ? filtro.ate : null;
  const op = filtro && filtro.operador ? filtro.operador : null;
  if (!de && !ate && !op) return items;
  return items.filter(r => {
    if (de || ate) {
      if (!r.data) return false;
      if (de && r.data < de) return false;
      if (ate && r.data > ate) return false;
    }
    if (op && r.operador !== op) return false;
    return true;
  });
}

function setCountBadge(kind, shown, total) {
  const el = document.getElementById(TABLE_META[kind].countId);
  if (!el) return;
  if (shown === total) {
    el.textContent = total + (total === 1 ? ' registro' : ' registros');
  } else {
    el.textContent = `${shown} de ${total} ${total === 1 ? 'registro' : 'registros'}`;
  }
}

function setExportButton(kind, count) {
  const btn = document.querySelector(`.btn-export[data-kind="${kind}"]`);
  if (btn) btn.disabled = count === 0;
  const clear = document.querySelector(`.btn-clear-filter[data-kind="${kind}"]`);
  if (clear) {
    const f = state.filtros[kind];
    clear.disabled = !f.de && !f.ate && !f.operador;
  }
}

// CSV: separador ';' + virgula decimal + UTF-8 BOM (Excel BR friendly)
function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (s.includes('"') || s.includes(';') || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace('.', ',');
}
function fmtBool(v) { return v ? 'Sim' : 'Não'; }

const CSV_HEADERS = {
  trancadeira: ['Hora', 'Data', 'Tipo Caixa', 'Linha', 'Cor', 'Diâmetro (mm)', 'Peso (kg)'],
  grampeadeira: ['Hora reg.', 'Nº O.P.', 'Data', 'Início', 'Fim', 'Operador', 'Qtd', 'Tamanho', 'Gancho',
                 'HE', 'HE Início', 'HE Fim', 'HE Tamanho', 'HE Qtd', 'HE Gancho'],
  extensor: ['Hora reg.', 'Data', 'Tipo Caixa', 'Cor', 'Diâmetro (mm)', 'Quantidade'],
};

function csvRow(kind, r) {
  if (kind === 'trancadeira') {
    return [r.hora, r.data, r.tipoCaixa, r.linha, r.cor, fmtNum(r.diametro), fmtNum(r.peso)];
  }
  if (kind === 'grampeadeira') {
    const he = r.he_dados || {};
    return [
      r.hora, r.op, r.data, r.hi, r.hf, r.operador, r.qtd, fmtNum(r.tam), r.gancho,
      fmtBool(r.he),
      r.he ? he.hi : '', r.he ? he.hf : '', r.he ? fmtNum(he.tam) : '', r.he ? he.qtd : '', r.he ? he.gancho : '',
    ];
  }
  if (kind === 'extensor') {
    return [r.hora, r.data, r.tipoCaixa, r.cor, fmtNum(r.diametro), r.qtd];
  }
  return [];
}

function exportCSV(kind) {
  const all = state.registros[kind];
  const items = applyFilter(all, state.filtros[kind]);
  if (items.length === 0) return;
  const ordered = [...items];
  const headers = CSV_HEADERS[kind];
  const lines = [headers, ...ordered.map(r => csvRow(kind, r))]
    .map(line => line.map(csvCell).join(';'));
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mave-${kind}-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(`${items.length} ${items.length === 1 ? 'registro exportado' : 'registros exportados'}.`);
}

function setupTableToolbar() {
  for (const kind of Object.keys(TABLE_META)) {
    const meta = TABLE_META[kind];
    const tbody = document.getElementById(meta.tbodyId);
    if (!tbody) continue;
    const wrapper = tbody.closest('.table-wrapper');
    if (!wrapper) continue;
    const card = wrapper.closest('.card');
    if (!card || card.querySelector('.table-toolbar')) continue;
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    const operadorField = (kind === 'grampeadeira') ? `
        <label class="filter-field">Operador
          <select data-filter="operador" data-kind="${kind}">
            <option value="">Todos</option>
          </select>
        </label>` : '';
    toolbar.innerHTML = `
      <div class="filters">
        <label class="filter-field">De
          <input type="date" data-filter="de" data-kind="${kind}">
        </label>
        <label class="filter-field">Até
          <input type="date" data-filter="ate" data-kind="${kind}">
        </label>${operadorField}
        <button type="button" class="btn-clear-filter" data-kind="${kind}" disabled>Limpar filtro</button>
      </div>
      <button type="button" class="btn-export" data-kind="${kind}" disabled>Exportar CSV</button>
    `;
    card.insertBefore(toolbar, wrapper);
    toolbar.querySelectorAll('input[type="date"]').forEach(input => {
      input.addEventListener('input', () => {
        state.filtros[kind][input.dataset.filter] = input.value;
        renderTable(kind);
      });
    });
    const opSel = toolbar.querySelector('select[data-filter="operador"]');
    if (opSel) {
      opSel.addEventListener('change', () => {
        state.filtros[kind].operador = opSel.value;
        renderTable(kind);
      });
    }
    toolbar.querySelector('.btn-clear-filter').addEventListener('click', () => {
      state.filtros[kind] = { de: '', ate: '', operador: '' };
      toolbar.querySelectorAll('input[type="date"]').forEach(i => { i.value = ''; });
      const sel = toolbar.querySelector('select[data-filter="operador"]');
      if (sel) sel.value = '';
      renderTable(kind);
    });
    toolbar.querySelector('.btn-export').addEventListener('click', () => exportCSV(kind));
  }
}

function renderOperatorFilter() {
  const sel = document.querySelector('select[data-filter="operador"][data-kind="grampeadeira"]');
  if (!sel) return;
  const target = state.filtros.grampeadeira.operador || '';
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'Todos';
  sel.appendChild(all);
  for (const op of (state.config.operadores || [])) {
    const o = document.createElement('option');
    o.value = op.nome;
    o.textContent = op.nome;
    sel.appendChild(o);
  }
  if (target && ![...sel.options].some(o => o.value === target)) {
    const o = document.createElement('option');
    o.value = target;
    o.textContent = target + ' (removido)';
    sel.appendChild(o);
  }
  sel.value = target;
}

// ============================================================
// DROPDOWNS DOS FORMULÁRIOS
// ============================================================
function fillSelect(selectId, options, ensureValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione…';
  sel.appendChild(placeholder);
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    sel.appendChild(o);
  }
  if (ensureValue && ![...sel.options].some(o => o.value === ensureValue)) {
    const o = document.createElement('option');
    o.value = ensureValue;
    o.textContent = ensureValue + ' (removido da config)';
    sel.appendChild(o);
  }
  if (previous && [...sel.options].some(o => o.value === previous)) {
    sel.value = previous;
  }
}

function renderDropdowns() {
  const cfg = state.config;
  const corNomes = cfg.cores.map(c => c.nome);
  fillSelect('t-tipo-caixa', cfg.caixas);
  fillSelect('t-linha', (cfg.linhas || []).map(l => l.nome));
  fillSelect('t-cor', corNomes);
  fillSelect('t-diametro', cfg.diametros);
  fillSelect('g-operador', (cfg.operadores || []).map(o => o.nome));
  fillSelect('e-tipo-caixa', cfg.caixas);
  fillSelect('e-cor', corNomes);
  fillSelect('e-diametro', cfg.diametros);
  renderOperatorFilter();
  populateOpTurnoSelect();
  populateMetaOperadorSelect();
}

// ============================================================
// CONFIGURAÇÕES (listas editáveis) -- Supabase
// ============================================================
const CONFIG_LISTS = [
  { listId: 'list-cores',      key: 'cores',      isCor: true,  inputId: 'input-cor' },
  { listId: 'list-diametros',  key: 'diametros',  isCor: false, inputId: 'input-diametro' },
  { listId: 'list-caixas',     key: 'caixas',     isCor: false, inputId: 'input-caixa' },
];
const metaForListId = (id) => CONFIG_LISTS.find(m => m.listId === id);

function renderConfigList(meta) {
  const ul = document.getElementById(meta.listId);
  if (!ul) return;
  const items = state.config[meta.key] || [];
  ul.innerHTML = '';
  items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.index = String(idx);
    const label = meta.isCor ? item.nome : item;
    li.innerHTML =
      `<span class="item-text">${escapeHtml(label)}</span>` +
      `<span class="item-actions"><button class="edit">Editar</button><button class="remove">Remover</button></span>`;
    ul.appendChild(li);
  });
}

function renderAllConfigLists() {
  for (const meta of CONFIG_LISTS) renderConfigList(meta);
  attachConfigActionHandlers();
  populateOpTurnoSelect();
  populateMetaOperadorSelect();
  renderOperadoresTable();
  renderLinhasTable();
  renderTurnosTable();
  renderMetasTable();
}

function normForCompare(s) {
  return String(s || '').trim().toLowerCase();
}

function configHasDuplicate(meta, value, ignoreIdx = -1) {
  const target = normForCompare(value);
  const list = state.config[meta.key] || [];
  return list.some((item, i) => {
    if (i === ignoreIdx) return false;
    const label = meta.isCor ? item.nome : item;
    return normForCompare(label) === target;
  });
}

window.addItem = async function(listId, inputId) {
  if (!sb) return;
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (!value) return;
  const meta = metaForListId(listId);
  if (!meta) return;

  if (configHasDuplicate(meta, value)) {
    showToast(`Já existe um item com o valor "${value}".`, 'error');
    input.focus();
    input.select();
    return;
  }

  if (meta.isCor) {
    const { data, error } = await sb.from('cores')
      .insert({ nome: value, hex: COR_HEX_FALLBACK })
      .select().single();
    if (error) { showToast('Erro ao adicionar: ' + error.message, 'error'); return; }
    state.config.cores.push({ id: data.id, nome: data.nome, hex: data.hex });
  } else {
    const tipo = TIPO_FROM_KEY[meta.key];
    const { data, error } = await sb.from('config_items')
      .insert({ tipo, valor: value })
      .select().single();
    if (error) { showToast('Erro ao adicionar: ' + error.message, 'error'); return; }
    state.config[meta.key].push(data.valor);
    state.configIds[meta.key].push(data.id);
  }
  input.value = '';
  renderConfigList(meta);
  renderDropdowns();
  attachConfigActionHandlers();
  renderDashboard();
};

function startConfigEdit(li) {
  const meta = metaForListId(li.parentElement.id);
  if (!meta) return;
  const idx = Number(li.dataset.index);
  const current = meta.isCor ? state.config[meta.key][idx].nome : state.config[meta.key][idx];
  const textEl = li.querySelector('.item-text');
  const actionsEl = li.querySelector('.item-actions');

  const newSpan = document.createElement('span');
  newSpan.className = 'item-text';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = current;
  newSpan.appendChild(input);
  textEl.replaceWith(newSpan);
  actionsEl.innerHTML = '<button class="save">Salvar</button><button class="cancel">Cancelar</button>';
  input.focus();
  input.select();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveConfigEdit(li); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelConfigEdit(li); }
  });
  attachConfigActionHandlers();
}

async function saveConfigEdit(li) {
  if (!sb) return;
  const input = li.querySelector('.edit-input');
  const newValue = input.value.trim();
  if (!newValue) { input.focus(); return; }
  const meta = metaForListId(li.parentElement.id);
  const idx = Number(li.dataset.index);

  if (configHasDuplicate(meta, newValue, idx)) {
    showToast(`Já existe um item com o valor "${newValue}".`, 'error');
    input.focus();
    input.select();
    return;
  }

  if (meta.isCor) {
    const id = state.config[meta.key][idx].id;
    const { error } = await sb.from('cores').update({ nome: newValue }).eq('id', id);
    if (error) { showToast('Erro ao atualizar: ' + error.message, 'error'); return; }
    state.config[meta.key][idx].nome = newValue;
  } else {
    const id = state.configIds[meta.key][idx];
    const { error } = await sb.from('config_items').update({ valor: newValue }).eq('id', id);
    if (error) { showToast('Erro ao atualizar: ' + error.message, 'error'); return; }
    state.config[meta.key][idx] = newValue;
  }
  renderConfigList(meta);
  renderDropdowns();
  attachConfigActionHandlers();
  renderDashboard();
}

function cancelConfigEdit(li) {
  const meta = metaForListId(li.parentElement.id);
  renderConfigList(meta);
  attachConfigActionHandlers();
}

async function removeConfigItem(li) {
  if (!sb) return;
  const meta = metaForListId(li.parentElement.id);
  const idx = Number(li.dataset.index);
  const label = meta.isCor ? state.config[meta.key][idx].nome : state.config[meta.key][idx];
  if (!confirm(`Remover "${label}"? Essa ação não pode ser desfeita.`)) return;

  if (meta.isCor) {
    const id = state.config[meta.key][idx].id;
    const { error } = await sb.from('cores').delete().eq('id', id);
    if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
    state.config[meta.key].splice(idx, 1);
  } else {
    const id = state.configIds[meta.key][idx];
    const { error } = await sb.from('config_items').delete().eq('id', id);
    if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
    state.config[meta.key].splice(idx, 1);
    state.configIds[meta.key].splice(idx, 1);
  }
  renderConfigList(meta);
  renderDropdowns();
  attachConfigActionHandlers();
  renderDashboard();
}

function attachConfigActionHandlers() {
  document.querySelectorAll('.config-list .remove').forEach(btn => {
    btn.onclick = () => removeConfigItem(btn.closest('li'));
  });
  document.querySelectorAll('.config-list .edit').forEach(btn => {
    btn.onclick = () => startConfigEdit(btn.closest('li'));
  });
  document.querySelectorAll('.config-list .save').forEach(btn => {
    btn.onclick = () => saveConfigEdit(btn.closest('li'));
  });
  document.querySelectorAll('.config-list .cancel').forEach(btn => {
    btn.onclick = () => cancelConfigEdit(btn.closest('li'));
  });
}

// ============================================================
// OPERADORES (tabela dedicada)
// ============================================================
function formatTurnoLabel(t) {
  if (!t) return '';
  if (t.hi && t.hf) return `${t.nome} · ${t.hi} às ${t.hf}`;
  return t.nome;
}

function populateOpTurnoSelect() {
  const sel = document.getElementById('op-turno');
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione…';
  sel.appendChild(placeholder);
  for (const t of (state.config.turnos || [])) {
    const o = document.createElement('option');
    const label = formatTurnoLabel(t);
    o.value = label;
    o.textContent = label;
    sel.appendChild(o);
  }
  if (previous && [...sel.options].some(o => o.value === previous)) sel.value = previous;
}

function renderOperadoresTable() {
  const tbody = document.getElementById('tbody-operadores');
  if (!tbody) return;
  const ops = state.config.operadores || [];
  if (ops.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum operador cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  ops.forEach((op) => {
    const tr = document.createElement('tr');
    tr.dataset.id = op.id;
    tr.innerHTML =
      `<td>${escapeHtml(op.nome)}</td>` +
      `<td>${escapeHtml(op.matricula || '—')}</td>` +
      `<td>${escapeHtml(op.funcao || '—')}</td>` +
      `<td>${escapeHtml(op.turno || '—')}</td>` +
      `<td>${op.capacidade != null ? escapeHtml(String(op.capacidade)) : '—'}</td>` +
      `<td class="td-actions"><button class="op-remove" type="button">Remover</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.op-remove').forEach(btn => {
    btn.onclick = () => removeOperador(btn.closest('tr').dataset.id);
  });
}

async function addOperadorFromForm() {
  if (!sb) return;
  const nome = document.getElementById('op-nome').value.trim();
  if (!nome) {
    showToast('Informe o nome do operador.', 'error');
    return;
  }
  const matricula = document.getElementById('op-matricula').value.trim() || null;
  const funcao = document.getElementById('op-funcao').value.trim() || null;
  const turno = document.getElementById('op-turno').value || null;
  const capRaw = document.getElementById('op-capacidade').value.trim();
  const capacidade = capRaw ? parseFloat(capRaw) : null;

  const nomeNorm = normForCompare(nome);
  const matNorm = matricula ? normForCompare(matricula) : null;
  const dupNome = state.config.operadores.find(o => normForCompare(o.nome) === nomeNorm);
  if (dupNome) {
    showToast(`Já existe um operador chamado "${nome}".`, 'error');
    document.getElementById('op-nome').focus();
    return;
  }
  if (matNorm) {
    const dupMat = state.config.operadores.find(o => o.matricula && normForCompare(o.matricula) === matNorm);
    if (dupMat) {
      showToast(`Já existe um operador com a matrícula "${matricula}" (${dupMat.nome}).`, 'error');
      document.getElementById('op-matricula').focus();
      return;
    }
  }

  const { data, error } = await sb.from('operadores')
    .insert({ nome, matricula, funcao, turno, capacidade_produtiva: capacidade })
    .select().single();
  if (error) { showToast('Erro ao adicionar operador: ' + error.message, 'error'); return; }

  state.config.operadores.push({
    id: data.id,
    nome: data.nome,
    matricula: data.matricula || '',
    funcao: data.funcao || '',
    turno: data.turno || '',
    capacidade: data.capacidade_produtiva != null ? Number(data.capacidade_produtiva) : null,
  });
  document.getElementById('op-nome').value = '';
  document.getElementById('op-matricula').value = '';
  document.getElementById('op-funcao').value = '';
  document.getElementById('op-turno').value = '';
  document.getElementById('op-capacidade').value = '';
  renderOperadoresTable();
  renderDropdowns();
  renderDashboard();
  showToast('Operador adicionado.');
}

async function removeOperador(id) {
  if (!sb || !id) return;
  const op = state.config.operadores.find(o => o.id === id);
  const label = op ? op.nome : 'este operador';
  if (!confirm(`Remover ${label}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await sb.from('operadores').delete().eq('id', id);
  if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
  state.config.operadores = state.config.operadores.filter(o => o.id !== id);
  renderOperadoresTable();
  renderDropdowns();
  renderDashboard();
}

const opMatriculaInput = document.getElementById('op-matricula');
if (opMatriculaInput) {
  opMatriculaInput.addEventListener('input', () => {
    const d = opMatriculaInput.value.replace(/\D+/g, '');
    if (d !== opMatriculaInput.value) opMatriculaInput.value = d;
  });
}
const btnAddOperador = document.getElementById('btn-add-operador');
if (btnAddOperador) btnAddOperador.addEventListener('click', addOperadorFromForm);

// ============================================================
// LINHAS DE PRODUCAO (tabela dedicada)
// ============================================================
function renderLinhasTable() {
  const tbody = document.getElementById('tbody-linhas');
  if (!tbody) return;
  const linhas = state.config.linhas || [];
  if (linhas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhuma linha cadastrada.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  linhas.forEach((l) => {
    const tr = document.createElement('tr');
    tr.dataset.id = l.id;
    tr.innerHTML =
      `<td>${escapeHtml(l.nome)}</td>` +
      `<td>${l.capacidade != null ? escapeHtml(String(l.capacidade)) : '—'}</td>` +
      `<td class="td-actions"><button class="ln-remove" type="button">Remover</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.ln-remove').forEach(btn => {
    btn.onclick = () => removeLinha(btn.closest('tr').dataset.id);
  });
}

async function addLinhaFromForm() {
  if (!sb) return;
  const nome = document.getElementById('ln-nome').value.trim();
  if (!nome) { showToast('Informe o nome da linha.', 'error'); return; }
  const capRaw = document.getElementById('ln-capacidade').value.trim();
  const capacidade = capRaw ? parseFloat(capRaw) : NaN;
  if (!Number.isFinite(capacidade) || capacidade <= 0) {
    showToast('Informe a capacidade produtiva da linha.', 'error');
    document.getElementById('ln-capacidade').focus();
    return;
  }

  const nomeNorm = normForCompare(nome);
  const dup = (state.config.linhas || []).find(l => normForCompare(l.nome) === nomeNorm);
  if (dup) {
    showToast(`Já existe uma linha chamada "${nome}".`, 'error');
    document.getElementById('ln-nome').focus();
    return;
  }

  const { data, error } = await sb.from('linhas')
    .insert({ nome, capacidade_produtiva: capacidade })
    .select().single();
  if (error) { showToast('Erro ao adicionar linha: ' + error.message, 'error'); return; }

  state.config.linhas.push({
    id: data.id,
    nome: data.nome,
    capacidade: data.capacidade_produtiva != null ? Number(data.capacidade_produtiva) : null,
  });
  document.getElementById('ln-nome').value = '';
  document.getElementById('ln-capacidade').value = '';
  renderLinhasTable();
  renderDropdowns();
  renderDashboard();
  showToast('Linha adicionada.');
}

async function removeLinha(id) {
  if (!sb || !id) return;
  const l = (state.config.linhas || []).find(x => x.id === id);
  const label = l ? l.nome : 'esta linha';
  if (!confirm(`Remover ${label}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await sb.from('linhas').delete().eq('id', id);
  if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
  state.config.linhas = state.config.linhas.filter(x => x.id !== id);
  renderLinhasTable();
  renderDropdowns();
  renderDashboard();
}

const btnAddLinha = document.getElementById('btn-add-linha');
if (btnAddLinha) btnAddLinha.addEventListener('click', addLinhaFromForm);

// ============================================================
// TURNOS (tabela dedicada)
// ============================================================
function renderTurnosTable() {
  const tbody = document.getElementById('tbody-turnos');
  if (!tbody) return;
  const turnos = state.config.turnos || [];
  if (turnos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum turno cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  turnos.forEach((t) => {
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    tr.innerHTML =
      `<td>${escapeHtml(t.nome)}</td>` +
      `<td>${escapeHtml(t.hi || '—')}</td>` +
      `<td>${escapeHtml(t.hf || '—')}</td>` +
      `<td class="td-actions"><button class="tn-remove" type="button">Remover</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.tn-remove').forEach(btn => {
    btn.onclick = () => removeTurno(btn.closest('tr').dataset.id);
  });
}

async function addTurnoFromForm() {
  if (!sb) return;
  const nome = document.getElementById('tn-nome').value.trim();
  if (!nome) { showToast('Informe o nome do turno.', 'error'); return; }
  const hi = document.getElementById('tn-hi').value || null;
  const hf = document.getElementById('tn-hf').value || null;

  const nomeNorm = normForCompare(nome);
  const dup = (state.config.turnos || []).find(t => normForCompare(t.nome) === nomeNorm);
  if (dup) {
    showToast(`Já existe um turno chamado "${nome}".`, 'error');
    document.getElementById('tn-nome').focus();
    return;
  }

  const { data, error } = await sb.from('turnos')
    .insert({ nome, hora_inicio: hi, hora_fim: hf })
    .select().single();
  if (error) { showToast('Erro ao adicionar turno: ' + error.message, 'error'); return; }

  state.config.turnos.push({
    id: data.id,
    nome: data.nome,
    hi: data.hora_inicio || '',
    hf: data.hora_fim || '',
  });
  document.getElementById('tn-nome').value = '';
  document.getElementById('tn-hi').value = '';
  document.getElementById('tn-hf').value = '';
  renderTurnosTable();
  renderDropdowns();
  renderDashboard();
  showToast('Turno adicionado.');
}

async function removeTurno(id) {
  if (!sb || !id) return;
  const t = (state.config.turnos || []).find(x => x.id === id);
  const label = t ? t.nome : 'este turno';
  if (!confirm(`Remover ${label}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await sb.from('turnos').delete().eq('id', id);
  if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
  state.config.turnos = state.config.turnos.filter(x => x.id !== id);
  renderTurnosTable();
  renderDropdowns();
  renderDashboard();
}

const btnAddTurno = document.getElementById('btn-add-turno');
if (btnAddTurno) btnAddTurno.addEventListener('click', addTurnoFromForm);

// ============================================================
// METAS DE PRODUCAO (tabela dedicada)
// ============================================================
function populateMetaOperadorSelect() {
  const sel = document.getElementById('mt-operador');
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione…';
  sel.appendChild(placeholder);
  for (const op of (state.config.operadores || [])) {
    const o = document.createElement('option');
    o.value = op.nome;
    o.textContent = op.nome;
    sel.appendChild(o);
  }
  if (previous && [...sel.options].some(o => o.value === previous)) sel.value = previous;
}

function renderMetasTable() {
  const tbody = document.getElementById('tbody-metas');
  if (!tbody) return;
  const metas = state.config.metas || [];
  if (metas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhuma meta cadastrada.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  metas.forEach((m) => {
    const tr = document.createElement('tr');
    tr.dataset.id = m.id;
    const tipoLabel = m.tipo === 'geral' ? 'Meta Geral' : 'Meta Operador';
    tr.innerHTML =
      `<td>${escapeHtml(tipoLabel)}</td>` +
      `<td>${escapeHtml(m.operador || '—')}</td>` +
      `<td>${escapeHtml(String(m.valor))}</td>` +
      `<td class="td-actions"><button class="mt-remove" type="button">Remover</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.mt-remove').forEach(btn => {
    btn.onclick = () => removeMeta(btn.closest('tr').dataset.id);
  });
}

async function addMetaFromForm() {
  if (!sb) return;
  const tipo = document.getElementById('mt-tipo').value;
  const operador = tipo === 'operador' ? (document.getElementById('mt-operador').value || '').trim() : null;
  const valorRaw = document.getElementById('mt-valor').value.trim();
  const valor = valorRaw ? parseFloat(valorRaw) : NaN;

  if (tipo === 'operador' && !operador) {
    showToast('Selecione o operador para a meta.', 'error');
    document.getElementById('mt-operador').focus();
    return;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    showToast('Informe um valor de meta válido.', 'error');
    document.getElementById('mt-valor').focus();
    return;
  }

  const { data, error } = await sb.from('metas')
    .insert({ tipo, operador, valor })
    .select().single();
  if (error) { showToast('Erro ao adicionar meta: ' + error.message, 'error'); return; }

  state.config.metas.push({
    id: data.id,
    tipo: data.tipo,
    operador: data.operador || '',
    valor: Number(data.valor),
  });
  document.getElementById('mt-valor').value = '';
  if (tipo === 'operador') document.getElementById('mt-operador').value = '';
  renderMetasTable();
  renderDashboard();
  showToast('Meta adicionada.');
}

async function removeMeta(id) {
  if (!sb || !id) return;
  const m = (state.config.metas || []).find(x => x.id === id);
  const label = m
    ? (m.tipo === 'geral' ? 'Meta Geral' : `Meta de ${m.operador}`)
    : 'esta meta';
  if (!confirm(`Remover ${label}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await sb.from('metas').delete().eq('id', id);
  if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
  state.config.metas = state.config.metas.filter(x => x.id !== id);
  renderMetasTable();
  renderDashboard();
}

const btnAddMeta = document.getElementById('btn-add-meta');
if (btnAddMeta) btnAddMeta.addEventListener('click', addMetaFromForm);

const mtTipoSel = document.getElementById('mt-tipo');
const mtOperadorField = document.getElementById('mt-operador-field');
if (mtTipoSel && mtOperadorField) {
  const sync = () => { mtOperadorField.style.display = mtTipoSel.value === 'operador' ? '' : 'none'; };
  mtTipoSel.addEventListener('change', sync);
  sync();
}

// ============================================================
// REGISTROS — TABELAS, EDIT, REMOVE
// ============================================================
const TABLE_META = {
  trancadeira: {
    tbodyId: 'tbody-trancadeira',
    countId: 'count-trancadeira',
    formId: 'form-trancadeira',
    tabName: 'trancadeiras',
    colspan: 8,
    rowCells: (r) => `
      <td>${escapeHtml(r.hora)}</td>
      <td>${escapeHtml(r.data)}</td>
      <td>${escapeHtml(r.tipoCaixa)}</td>
      <td>${escapeHtml(r.linha)}</td>
      <td>${escapeHtml(r.cor)}</td>
      <td>${escapeHtml(r.diametro)} mm</td>
      <td>${escapeHtml(r.peso)}</td>`,
  },
  grampeadeira: {
    tbodyId: 'tbody-grampeadeira',
    countId: 'count-grampeadeira',
    formId: 'form-grampeadeira',
    tabName: 'grampeadeiras',
    colspan: 11,
    rowCells: (r) => `
      <td>${escapeHtml(r.hora)}</td>
      <td>${escapeHtml(r.op || '—')}</td>
      <td>${escapeHtml(r.data)}</td>
      <td>${escapeHtml(r.hi)}</td>
      <td>${escapeHtml(r.hf)}</td>
      <td>${escapeHtml(r.operador)}</td>
      <td>${escapeHtml(r.qtd)}</td>
      <td>${escapeHtml(r.tam)}</td>
      <td>${escapeHtml(r.gancho)}</td>
      <td>${r.he ? 'Sim' : 'Não'}</td>`,
  },
  extensor: {
    tbodyId: 'tbody-extensor',
    countId: 'count-extensor',
    formId: 'form-extensor',
    tabName: 'extensor',
    colspan: 7,
    rowCells: (r) => `
      <td>${escapeHtml(r.hora)}</td>
      <td>${escapeHtml(r.data)}</td>
      <td>${escapeHtml(r.tipoCaixa)}</td>
      <td>${escapeHtml(r.cor)}</td>
      <td>${escapeHtml(r.diametro)} mm</td>
      <td>${escapeHtml(r.qtd)}</td>`,
  },
};

const EMPTY_MSG = 'Nenhum registro hoje. Use o formulário acima.';

function actionsCell() {
  return `<td class="row-actions">
    <button type="button" class="edit">Editar</button>
    <button type="button" class="remove">Remover</button>
  </td>`;
}

function renderTable(kind) {
  const meta = TABLE_META[kind];
  const tbody = document.getElementById(meta.tbodyId);
  const all = state.registros[kind];
  const items = applyFilter(all, state.filtros[kind]);
  tbody.innerHTML = '';
  setCountBadge(kind, items.length, all.length);
  setExportButton(kind, items.length);
  if (items.length === 0) {
    const msg = all.length === 0 ? EMPTY_MSG : 'Nenhum registro no período selecionado.';
    tbody.innerHTML = `<tr><td colspan="${meta.colspan}" class="empty-state">${msg}</td></tr>`;
    return;
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i];
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    if (state.editing[kind] === r.id) tr.classList.add('row-editing');
    tr.innerHTML = meta.rowCells(r) + actionsCell();
    tbody.appendChild(tr);
  }
}

function renderAllTables() {
  renderTable('trancadeira');
  renderTable('grampeadeira');
  renderTable('extensor');
}

function findRegistro(kind, id) {
  return state.registros[kind].find(r => r.id === id) || null;
}

async function removeRegistro(kind, id) {
  if (!sb) return;
  const r = findRegistro(kind, id);
  if (!r) return;
  const detalhe = (kind === 'grampeadeira')
    ? `da grampeadeira (${r.data} · ${r.operador || '—'} · ${r.qtd} un)`
    : (kind === 'trancadeira')
      ? `da trançadeira (${r.data} · ${r.cor || '—'} · ${r.peso}kg)`
      : `do extensor (${r.data} · ${r.cor || '—'} · ${r.qtd} un)`;
  if (!confirm(`Remover o registro ${detalhe}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await sb.from(TABLE_FOR[kind]).delete().eq('id', id);
  if (error) { showToast('Erro ao remover: ' + error.message, 'error'); return; }
  state.registros[kind] = state.registros[kind].filter(x => x.id !== id);
  if (state.editing[kind] === id) cancelEditRegistro(kind);
  renderTable(kind);
  renderDashboard();
  showToast('Registro removido.');
}

// ============================================================
// EDIT MODE DE REGISTRO
// ============================================================
function setupFormEditingUI() {
  for (const kind of Object.keys(TABLE_META)) {
    const meta = TABLE_META[kind];
    const form = document.getElementById(meta.formId);
    if (!form) continue;
    const card = form.closest('.card');
    if (!card) continue;
    const header = card.querySelector('.card-header');
    if (header && !header.querySelector('.editing-badge')) {
      const existing = header.querySelector('.badge');
      if (existing) existing.classList.add('badge-default');
      const eb = document.createElement('span');
      eb.className = 'editing-badge';
      eb.textContent = 'Editando registro';
      header.appendChild(eb);
    }
    const btnRow = form.querySelector('.btn-row');
    if (btnRow && !btnRow.querySelector('.btn-cancel-edit')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-cancel-edit';
      btn.textContent = 'Cancelar edição';
      btn.addEventListener('click', () => cancelEditRegistro(kind));
      const submit = btnRow.querySelector('button[type="submit"]');
      if (submit) btnRow.insertBefore(btn, submit);
      else btnRow.appendChild(btn);
    }
  }
}

function setEditingUI(kind, on) {
  const meta = TABLE_META[kind];
  const form = document.getElementById(meta.formId);
  if (!form) return;
  const card = form.closest('.card');
  if (card) card.classList.toggle('editing', on);
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = on ? 'Atualizar registro' : 'Salvar registro';
}

function startEditRegistro(kind, id) {
  const r = findRegistro(kind, id);
  if (!r) return;
  for (const k of Object.keys(state.editing)) {
    if (k !== kind && state.editing[k]) cancelEditRegistro(k);
  }
  state.editing[kind] = id;
  fillFormFromRegistro(kind, r);
  setEditingUI(kind, true);
  activateTab(TABLE_META[kind].tabName);
  const form = document.getElementById(TABLE_META[kind].formId);
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  renderTable(kind);
}

function cancelEditRegistro(kind) {
  state.editing[kind] = null;
  const form = document.getElementById(TABLE_META[kind].formId);
  if (form) {
    form.reset();
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heFlag.checked = false;
      heBlock.classList.remove('show');
    }
    renderDropdowns();
  }
  setEditingUI(kind, false);
  renderTable(kind);
}

function fillFormFromRegistro(kind, r) {
  if (kind === 'trancadeira') {
    document.getElementById('t-data').value = r.data || todayISO();
    fillSelect('t-tipo-caixa', state.config.caixas, r.tipoCaixa);
    fillSelect('t-linha', (state.config.linhas || []).map(l => l.nome), r.linha);
    fillSelect('t-cor', state.config.cores.map(c => c.nome), r.cor);
    fillSelect('t-diametro', state.config.diametros, r.diametro);
    document.getElementById('t-tipo-caixa').value = r.tipoCaixa || '';
    document.getElementById('t-linha').value = r.linha || '';
    document.getElementById('t-cor').value = r.cor || '';
    document.getElementById('t-diametro').value = r.diametro || '';
    document.getElementById('t-peso').value = r.peso || '';
  } else if (kind === 'grampeadeira') {
    document.getElementById('g-op').value = r.op || '';
    document.getElementById('g-data').value = r.data || todayISO();
    document.getElementById('g-hi').value = r.hi || '';
    document.getElementById('g-hf').value = r.hf || '';
    fillSelect('g-operador', (state.config.operadores || []).map(o => o.nome), r.operador);
    document.getElementById('g-operador').value = r.operador || '';
    document.getElementById('g-qtd').value = r.qtd || '';
    document.getElementById('g-tam').value = r.tam || '';
    document.getElementById('g-gancho').value = r.gancho || '';
    heFlag.checked = !!r.he;
    heBlock.classList.toggle('show', !!r.he);
    if (r.he && r.he_dados) {
      document.getElementById('g-he-hi').value = r.he_dados.hi || '';
      document.getElementById('g-he-hf').value = r.he_dados.hf || '';
      document.getElementById('g-he-tam').value = r.he_dados.tam || '';
      document.getElementById('g-he-qtd').value = r.he_dados.qtd || '';
      document.getElementById('g-he-gancho').value = r.he_dados.gancho || '';
    } else {
      ['g-he-hi','g-he-hf','g-he-tam','g-he-qtd','g-he-gancho'].forEach(id => {
        document.getElementById(id).value = '';
      });
    }
  } else if (kind === 'extensor') {
    document.getElementById('e-data').value = r.data || todayISO();
    fillSelect('e-tipo-caixa', state.config.caixas, r.tipoCaixa);
    fillSelect('e-cor', state.config.cores.map(c => c.nome), r.cor);
    fillSelect('e-diametro', state.config.diametros, r.diametro);
    document.getElementById('e-tipo-caixa').value = r.tipoCaixa || '';
    document.getElementById('e-cor').value = r.cor || '';
    document.getElementById('e-diametro').value = r.diametro || '';
    document.getElementById('e-qtd').value = r.qtd || '';
  }
}

function attachTableActionHandlers() {
  for (const kind of Object.keys(TABLE_META)) {
    const tbody = document.getElementById(TABLE_META[kind].tbodyId);
    if (!tbody || tbody.dataset.handlerAttached === '1') continue;
    tbody.dataset.handlerAttached = '1';
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-actions button');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr && tr.dataset.id;
      if (!id) return;
      if (btn.classList.contains('edit')) startEditRegistro(kind, id);
      else if (btn.classList.contains('remove')) removeRegistro(kind, id);
    });
  }
}

// ============================================================
// FORMS DE REGISTRO
// ============================================================
function buildRegistroFromForm(kind) {
  if (kind === 'trancadeira') {
    return {
      data: document.getElementById('t-data').value,
      tipoCaixa: document.getElementById('t-tipo-caixa').value,
      linha: document.getElementById('t-linha').value,
      cor: document.getElementById('t-cor').value,
      diametro: document.getElementById('t-diametro').value,
      peso: parseFloat(document.getElementById('t-peso').value).toFixed(2),
    };
  }
  if (kind === 'grampeadeira') {
    const r = {
      op: document.getElementById('g-op').value,
      data: document.getElementById('g-data').value,
      hi: document.getElementById('g-hi').value,
      hf: document.getElementById('g-hf').value,
      operador: document.getElementById('g-operador').value,
      qtd: document.getElementById('g-qtd').value,
      tam: parseFloat(document.getElementById('g-tam').value).toFixed(2),
      gancho: document.getElementById('g-gancho').value,
      he: heFlag.checked,
    };
    if (heFlag.checked) {
      r.he_dados = {
        hi: document.getElementById('g-he-hi').value,
        hf: document.getElementById('g-he-hf').value,
        tam: parseFloat(document.getElementById('g-he-tam').value).toFixed(2),
        qtd: document.getElementById('g-he-qtd').value,
        gancho: document.getElementById('g-he-gancho').value,
      };
    }
    return r;
  }
  if (kind === 'extensor') {
    return {
      data: document.getElementById('e-data').value,
      tipoCaixa: document.getElementById('e-tipo-caixa').value,
      cor: document.getElementById('e-cor').value,
      diametro: document.getElementById('e-diametro').value,
      qtd: document.getElementById('e-qtd').value,
    };
  }
  return {};
}

async function submitRegistro(kind, form) {
  if (!sb) return;
  if (kind === 'grampeadeira' && heFlag.checked) {
    const heFields = ['g-he-hi', 'g-he-hf', 'g-he-tam', 'g-he-qtd', 'g-he-gancho'];
    const empty = heFields.find(id => !document.getElementById(id).value);
    if (empty) {
      showToast('Você marcou Hora Extra. Preencha todos os campos do bloco.', 'error');
      document.getElementById(empty).focus();
      return;
    }
  }

  const data = buildRegistroFromForm(kind);
  const editingId = state.editing[kind];
  const userId = await getCurrentUserId();

  if (editingId) {
    const original = state.registros[kind].find(r => r.id === editingId);
    const dbRow = { ...TO_DB[kind](data, userId), hora: original ? original.hora : nowTime() };
    const { data: updated, error } = await sb.from(TABLE_FOR[kind])
      .update(dbRow).eq('id', editingId).select().single();
    if (error) { showToast('Erro ao atualizar: ' + error.message, 'error'); return; }
    const idx = state.registros[kind].findIndex(r => r.id === editingId);
    if (idx >= 0) state.registros[kind][idx] = FROM_DB[kind](updated);
    state.editing[kind] = null;
    setEditingUI(kind, false);
    form.reset();
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heBlock.classList.remove('show');
      heFlag.checked = false;
    }
    renderDropdowns();
    renderTable(kind);
    renderDashboard();
    showToast('Registro atualizado.');
  } else {
    const dbRow = { ...TO_DB[kind](data, userId), hora: nowTime() };
    const { data: created, error } = await sb.from(TABLE_FOR[kind])
      .insert(dbRow).select().single();
    if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
    state.registros[kind].push(FROM_DB[kind](created));
    const stickyOp = kind === 'grampeadeira' ? document.getElementById('g-op').value : '';
    const stickyGrampData = kind === 'grampeadeira' ? document.getElementById('g-data').value : '';
    const stickyLinha = kind === 'trancadeira' ? document.getElementById('t-linha').value : '';
    const stickyTrancData = kind === 'trancadeira' ? document.getElementById('t-data').value : '';
    form.reset();
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heBlock.classList.remove('show');
      heFlag.checked = false;
      document.getElementById('g-op').value = stickyOp;
      if (stickyGrampData) document.getElementById('g-data').value = stickyGrampData;
    }
    if (kind === 'trancadeira') {
      if (stickyLinha) document.getElementById('t-linha').value = stickyLinha;
      if (stickyTrancData) document.getElementById('t-data').value = stickyTrancData;
    }
    renderTable(kind);
    renderDashboard();
    showToast('Registro salvo com sucesso!');
  }
}

const heFlag = document.getElementById('g-he-flag');
const heBlock = document.getElementById('g-he-block');
heFlag.addEventListener('change', () => {
  heBlock.classList.toggle('show', heFlag.checked);
});

// Nº O.P. (grampeadeira) — somente digitos
const gOpInput = document.getElementById('g-op');
if (gOpInput) {
  gOpInput.addEventListener('input', () => {
    const onlyDigits = gOpInput.value.replace(/\D+/g, '');
    if (onlyDigits !== gOpInput.value) gOpInput.value = onlyDigits;
  });
}

document.getElementById('form-trancadeira').addEventListener('submit', (e) => {
  e.preventDefault();
  submitRegistro('trancadeira', e.target);
});
document.getElementById('form-grampeadeira').addEventListener('submit', (e) => {
  e.preventDefault();
  submitRegistro('grampeadeira', e.target);
});
document.getElementById('form-extensor').addEventListener('submit', (e) => {
  e.preventDefault();
  submitRegistro('extensor', e.target);
});

// "Limpar" durante edicao tambem deve sair do modo edit
for (const kind of Object.keys(TABLE_META)) {
  const form = document.getElementById(TABLE_META[kind].formId);
  if (!form) continue;
  form.addEventListener('reset', () => {
    if (state.editing[kind]) {
      setTimeout(() => cancelEditRegistro(kind), 0);
    }
  });
}

// ============================================================
// USER PROFILES (aprovacao por admin)
// ============================================================
async function loadMyProfile() {
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from('user_profiles').select('*').eq('id', user.id).single();
  if (error) {
    console.error('[Mave] Erro ao carregar profile:', error);
    return null;
  }
  return data;
}

async function listAllUsers() {
  const { data, error } = await sb.from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function approveUserById(userId) {
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('user_profiles').update({
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: user ? user.id : null,
  }).eq('id', userId);
  if (error) throw error;
}

async function rejectUserById(userId) {
  const { error } = await sb.from('user_profiles').update({ status: 'rejected' }).eq('id', userId);
  if (error) throw error;
}

async function setRoleById(userId, role) {
  const { error } = await sb.from('user_profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) { return iso; }
}

const STATUS_LABEL = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };
const ROLE_LABEL = { user: 'Usuário', admin: 'Administrador' };

async function renderUsersPanel() {
  if (!state.profile || state.profile.role !== 'admin') return;
  let users;
  try {
    users = await listAllUsers();
  } catch (e) {
    showToast('Erro ao carregar usuários: ' + (e.message || e), 'error');
    return;
  }

  const pending = users.filter(u => u.status === 'pending');
  const tbodyPending = document.getElementById('tbody-pending');
  const countPending = document.getElementById('count-pending');
  if (countPending) countPending.textContent = pending.length + (pending.length === 1 ? ' pendente' : ' pendentes');
  if (tbodyPending) {
    if (pending.length === 0) {
      tbodyPending.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum cadastro pendente.</td></tr>';
    } else {
      tbodyPending.innerHTML = '';
      for (const u of pending) {
        const tr = document.createElement('tr');
        tr.dataset.id = u.id;
        tr.innerHTML = `
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(fmtDate(u.created_at))}</td>
          <td class="row-actions">
            <button type="button" class="approve">Aprovar</button>
            <button type="button" class="reject">Rejeitar</button>
          </td>
        `;
        tbodyPending.appendChild(tr);
      }
    }
  }

  const tbodyUsers = document.getElementById('tbody-users');
  const countUsers = document.getElementById('count-users');
  if (countUsers) countUsers.textContent = users.length + (users.length === 1 ? ' usuário' : ' usuários');
  if (tbodyUsers) {
    if (users.length === 0) {
      tbodyUsers.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum usuário cadastrado.</td></tr>';
    } else {
      tbodyUsers.innerHTML = '';
      const myId = state.profile.id;
      for (const u of users) {
        const tr = document.createElement('tr');
        tr.dataset.id = u.id;
        const isMe = u.id === myId;
        const roleSwap = u.role === 'admin'
          ? `<button type="button" class="demote" ${isMe ? 'disabled title="Você não pode rebaixar a si mesmo"' : ''}>Tornar usuário</button>`
          : `<button type="button" class="promote">Tornar admin</button>`;
        const statusActions = u.status === 'pending'
          ? `<button type="button" class="approve">Aprovar</button><button type="button" class="reject">Rejeitar</button>`
          : (u.status === 'rejected'
              ? `<button type="button" class="approve">Aprovar</button>`
              : `<button type="button" class="reject" ${isMe ? 'disabled title="Você não pode rejeitar a si mesmo"' : ''}>Rejeitar</button>`);
        tr.innerHTML = `
          <td>${escapeHtml(u.email)}${isMe ? ' <span class="badge badge-default" style="margin-left:6px">você</span>' : ''}</td>
          <td>${escapeHtml(ROLE_LABEL[u.role] || u.role)}</td>
          <td>${escapeHtml(STATUS_LABEL[u.status] || u.status)}</td>
          <td>${escapeHtml(fmtDate(u.created_at))}</td>
          <td class="row-actions">${statusActions}${roleSwap}</td>
        `;
        tbodyUsers.appendChild(tr);
      }
    }
  }
}

function attachUsersPanelHandlers() {
  const panel = document.getElementById('panel-usuarios');
  if (!panel || panel.dataset.handlerAttached === '1') return;
  panel.dataset.handlerAttached = '1';
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const tr = btn.closest('tr');
    if (!tr || !tr.dataset.id) return;
    const userId = tr.dataset.id;
    btn.disabled = true;
    try {
      if (btn.classList.contains('approve')) {
        await approveUserById(userId);
        showToast('Usuário aprovado.');
      } else if (btn.classList.contains('reject')) {
        if (!confirm('Rejeitar este usuário? Ele perderá acesso ao sistema.')) { btn.disabled = false; return; }
        await rejectUserById(userId);
        showToast('Usuário rejeitado.');
      } else if (btn.classList.contains('promote')) {
        await setRoleById(userId, 'admin');
        showToast('Usuário promovido a administrador.');
      } else if (btn.classList.contains('demote')) {
        if (!confirm('Remover privilégios de administrador deste usuário?')) { btn.disabled = false; return; }
        await setRoleById(userId, 'user');
        showToast('Usuário rebaixado a comum.');
      }
      await renderUsersPanel();
    } catch (err) {
      showToast('Erro: ' + (err.message || err), 'error');
      btn.disabled = false;
    }
  });
}

// ============================================================
// USER CHROME (topbar)
// ============================================================
function setUserChrome(email) {
  const nameEl = document.getElementById('user-name');
  const metaEl = document.getElementById('user-meta');
  const avEl = document.getElementById('user-avatar');
  if (!nameEl || !metaEl || !avEl) return;
  if (!email) {
    nameEl.textContent = '';
    metaEl.textContent = '';
    avEl.textContent = '';
    return;
  }
  const local = email.split('@')[0] || email;
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  let initials = parts.slice(0, 2).map(s => s[0].toUpperCase()).join('');
  if (!initials) initials = local.slice(0, 2).toUpperCase();
  const display = parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') || local;
  nameEl.textContent = display;
  metaEl.textContent = email;
  avEl.textContent = initials;
}

// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {
  const today = todayISO();
  const tr = state.registros.trancadeira.filter(r => r.data === today);
  const gr = state.registros.grampeadeira.filter(r => r.data === today);
  const ex = state.registros.extensor.filter(r => r.data === today);

  const trKg = tr.reduce((s, r) => s + (parseFloat(r.peso) || 0), 0);
  const grQtd = gr.reduce((s, r) => s + (parseInt(r.qtd, 10) || 0), 0)
              + gr.reduce((s, r) => s + (r.he && r.he_dados ? (parseInt(r.he_dados.qtd, 10) || 0) : 0), 0);
  const exQtd = ex.reduce((s, r) => s + (parseInt(r.qtd, 10) || 0), 0);

  setText('kpi-trancadeira-count', tr.length);
  setText('kpi-trancadeira-sub', trKg.toFixed(2).replace('.', ',') + ' kg produzidos');
  setText('kpi-grampeadeira-count', gr.length);
  setText('kpi-grampeadeira-sub', grQtd + (grQtd === 1 ? ' unidade produzida' : ' unidades produzidas'));
  setText('kpi-extensor-count', ex.length);
  setText('kpi-extensor-sub', exQtd + (exQtd === 1 ? ' unidade produzida' : ' unidades produzidas'));

  const greeting = document.getElementById('dashboard-greeting');
  const subtitle = document.getElementById('dashboard-subtitle');
  if (greeting && state.email) {
    const local = state.email.split('@')[0];
    const first = (local.split(/[._\-+]+/).filter(Boolean)[0] || local);
    greeting.textContent = `Olá, ${first[0].toUpperCase() + first.slice(1)}`;
  }
  if (subtitle) {
    const totalHoje = tr.length + gr.length + ex.length;
    subtitle.textContent = totalHoje === 0
      ? 'Nenhum registro hoje ainda. Vamos começar?'
      : `${totalHoje} ${totalHoje === 1 ? 'registro' : 'registros'} hoje em todas as estações.`;
  }

  renderMetas(grQtd + exQtd, gr);
  renderRecentActivity();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function renderMetas(totalUnidades, grHoje) {
  const container = document.getElementById('metas-list');
  if (!container) return;
  const metas = state.config.metas || [];
  const badge = document.getElementById('metas-badge');
  if (badge) badge.textContent = metas.length + (metas.length === 1 ? ' meta' : ' metas');
  container.innerHTML = '';
  if (metas.length === 0) {
    container.innerHTML = '<div class="meta-empty">Nenhuma meta cadastrada. Adicione em Configurações.</div>';
    return;
  }
  for (const m of metas) {
    let realizado;
    let label;
    if (m.tipo === 'geral') {
      realizado = totalUnidades;
      label = 'Meta Geral';
    } else {
      realizado = grHoje
        .filter(r => r.operador && normForCompare(r.operador) === normForCompare(m.operador))
        .reduce((s, r) => s + (parseInt(r.qtd, 10) || 0)
                            + (r.he && r.he_dados ? (parseInt(r.he_dados.qtd, 10) || 0) : 0), 0);
      label = m.operador;
    }
    const pct = m.valor > 0 ? (realizado / m.valor) * 100 : 0;
    const fillPct = Math.min(100, pct);
    let barClass = 'warning';
    if (pct >= 100) barClass = 'success';
    else if (pct >= 60) barClass = '';
    const div = document.createElement('div');
    div.className = 'meta-item';
    div.innerHTML = `
      <div class="meta-item-head">
        <span class="meta-item-name">${escapeHtml(label)} · ${m.valor}/dia</span>
        <span class="meta-item-progress">${realizado} / ${m.valor} (${pct.toFixed(0)}%)</span>
      </div>
      <div class="meta-bar"><div class="meta-bar-fill ${barClass}" style="width:${fillPct}%"></div></div>
    `;
    container.appendChild(div);
  }
}

const STATION_LABEL = {
  trancadeira: 'Trançadeira',
  grampeadeira: 'Grampeadeira',
  extensor: 'Extensor',
};

function recentDetail(kind, r) {
  if (kind === 'trancadeira') return `${r.tipoCaixa || '—'} · ${r.linha || '—'} · ${r.cor || '—'} · ${r.peso || '0'} kg`;
  if (kind === 'grampeadeira') return `${r.op || '—'} · ${r.operador || '—'} · ${r.qtd || '0'} un${r.he ? ' (+ HE)' : ''}`;
  if (kind === 'extensor')    return `${r.tipoCaixa || '—'} · ${r.cor || '—'} · ${r.qtd || '0'} un`;
  return '';
}

function renderRecentActivity() {
  const tbody = document.getElementById('tbody-recent');
  const badge = document.getElementById('recent-badge');
  if (!tbody) return;
  const all = [];
  for (const r of state.registros.trancadeira) all.push({ kind: 'trancadeira', r });
  for (const r of state.registros.grampeadeira) all.push({ kind: 'grampeadeira', r });
  for (const r of state.registros.extensor) all.push({ kind: 'extensor', r });
  all.sort((a, b) => {
    const ka = (a.r.data || '') + ' ' + (a.r.hora || '');
    const kb = (b.r.data || '') + ' ' + (b.r.hora || '');
    return kb.localeCompare(ka);
  });
  if (badge) badge.textContent = all.length + (all.length === 1 ? ' registro total' : ' registros totais');
  if (all.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum registro ainda. Comece por uma das estações acima.</td></tr>';
    return;
  }
  const top = all.slice(0, 8);
  tbody.innerHTML = '';
  for (const { kind, r } of top) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.hora || '')}</td>
      <td>${escapeHtml(r.data || '')}</td>
      <td><span class="station-pill ${kind}">${STATION_LABEL[kind]}</span></td>
      <td>${escapeHtml(recentDetail(kind, r))}</td>
    `;
    tbody.appendChild(tr);
  }
}

function setupDashboardKpiClicks() {
  document.querySelectorAll('.kpi-card[data-go]').forEach(card => {
    card.addEventListener('click', () => activateTab(card.dataset.go));
  });
}

// ============================================================
// BOOTSTRAP
// ============================================================
async function enterApp(email) {
  state.email = email;
  setUserChrome(email);

  // Carrega perfil antes de qualquer coisa: gate de aprovacao
  const profile = await loadMyProfile();
  state.profile = profile;

  if (!profile) {
    showToast('Não foi possível carregar seu perfil. Tente novamente.', 'error');
    showLogin();
    return;
  }

  if (profile.status === 'pending') {
    const meta = document.getElementById('pending-email-meta');
    if (meta) meta.textContent = `Conectado como ${email}. Aguardando aprovação do administrador.`;
    showPending();
    return;
  }

  if (profile.status === 'rejected') {
    if (sb) await sb.auth.signOut();
    state.email = null;
    state.profile = null;
    setUserChrome(null);
    alertBox.textContent = 'Seu acesso foi rejeitado por um administrador. Procure o RH.';
    alertBox.style.background = 'var(--danger-bg)';
    alertBox.style.color = 'var(--danger)';
    alertBox.classList.add('show');
    showLogin();
    return;
  }

  // approved
  showApp();

  // Mostra/oculta aba Usuarios conforme role
  const adminTab = document.getElementById('tab-usuarios');
  if (adminTab) adminTab.style.display = profile.role === 'admin' ? '' : 'none';

  try {
    const [cfg, regs] = await Promise.all([dbLoadConfig(), dbLoadRegistros()]);
    state.config = cfg;
    state.registros = regs;
    state.editing = { trancadeira: null, grampeadeira: null, extensor: null };
  } catch (e) {
    console.error('[Mave] Erro ao carregar dados:', e);
    showToast('Erro ao carregar dados: ' + (e && e.message ? e.message : e), 'error');
    return;
  }

  renderDropdowns();
  renderAllConfigLists();
  renderAllTables();
  attachTableActionHandlers();
  renderDashboard();
  if (profile.role === 'admin') {
    attachUsersPanelHandlers();
    renderUsersPanel();
  }
  activateTab('dashboard');
  const t = todayISO();
  document.getElementById('t-data').value = t;
  document.getElementById('g-data').value = t;
  document.getElementById('e-data').value = t;
}

async function bootstrap() {
  // Sanity-check: avisa se o config nao foi preenchido.
  if (!sb) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:sans-serif;max-width:640px;margin:60px auto;color:#1A1814;line-height:1.5">' +
      '<h1 style="margin-top:0">Configuração do Supabase necessária</h1>' +
      '<p>Edite o arquivo <code>supabase-config.js</code> com a <strong>URL</strong> e a <strong>anon public key</strong> do seu projeto Supabase ' +
      '(Dashboard → Settings → API).</p>' +
      '<p>Depois rode o SQL de <code>supabase/schema.sql</code> no SQL Editor do projeto e recarregue a página.</p>' +
      '</div>';
    return;
  }

  setTheme(getTheme());
  setupFormEditingUI();
  setupTableToolbar();
  setupDashboardKpiClicks();

  // Sincroniza UI quando o auth muda (ex.: logout em outra aba)
  sb.auth.onAuthStateChange((event, session) => {
    console.log('[Mave][auth]', event, session ? 'com session' : 'sem session');
    if (event === 'PASSWORD_RECOVERY') {
      state.recovering = true;
      showReset();
      return;
    }
    if (event === 'SIGNED_OUT' && state.email) {
      state.email = null;
      state.registros = { trancadeira: [], grampeadeira: [], extensor: [] };
      state.editing = { trancadeira: null, grampeadeira: null, extensor: null };
      setUserChrome(null);
      showLogin();
    }
  });

  // Se chegou via link de recuperacao, mostra tela de nova senha
  // Suporta 3 formatos: hash #type=recovery (implicit), query ?token_hash=...&type=recovery
  // (modelo de e-mail moderno) e query ?code=... (PKCE).
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const qs = new URLSearchParams(search);
  console.log('[Mave][bootstrap] hash=', hash, 'search=', search);

  if (/[#&]type=recovery\b/.test(hash)) {
    // Implicit flow: a propria lib troca pelo session e dispara PASSWORD_RECOVERY
    state.recovering = true;
    showReset();
    return;
  }

  if (qs.get('type') === 'recovery' && qs.get('token_hash')) {
    state.recovering = true;
    showReset();
    const { error: vErr } = await sb.auth.verifyOtp({
      type: 'recovery',
      token_hash: qs.get('token_hash'),
    });
    try { history.replaceState({}, '', window.location.pathname); } catch (e) {}
    if (vErr) {
      alertReset.textContent = 'Link inválido ou expirado. Solicite um novo link de recuperação.';
      alertReset.classList.add('show');
    }
    return;
  }

  if (qs.get('code')) {
    // PKCE flow: troca o code por sessao; o evento PASSWORD_RECOVERY vira a seguir
    state.recovering = true;
    showReset();
    const { error: eErr } = await sb.auth.exchangeCodeForSession(qs.get('code'));
    try { history.replaceState({}, '', window.location.pathname); } catch (e) {}
    if (eErr) {
      alertReset.textContent = 'Link inválido ou expirado. Solicite um novo link de recuperação.';
      alertReset.classList.add('show');
    }
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (state.recovering) return;
  if (session && session.user) {
    if (lembrarCheckbox) lembrarCheckbox.checked = true;
    await enterApp(session.user.email);
  } else {
    showLogin();
  }
}

bootstrap();
