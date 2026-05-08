console.log('[Mave] Script carregado.');

// ============================================================
// STORAGE
// ============================================================
// Protótipo: tudo em localStorage. Em produção, isto vira API.
const STORAGE_KEYS = {
  USERS: 'mave_usuarios',
  SESSION: 'mave_sessao',
  CONFIG: 'mave_config',
};
const registrosKey = (email) => `mave_registros_${email}`;

const DEFAULT_CONFIG = {
  cores: [
    { nome: 'Preto', hex: '#1A1814' },
    { nome: 'Branco', hex: '#FFFFFF' },
    { nome: 'Azul', hex: '#2563EB' },
    { nome: 'Vermelho', hex: '#DC2626' },
  ],
  diametros: ['2.5', '3.0', '4.0', '5.0'],
  caixas: ['Caixa 1Kg', 'Caixa 3.5Kg'],
  linhas: ['Linha 1', 'Linha 2', 'Linha 3'],
  turnos: ['Turno A · 06:00 às 14:00', 'Turno B · 14:00 às 22:00', 'Turno C · 22:00 às 06:00'],
  operadores: ['João Silva (12345)', 'Maria Souza (12346)', 'Pedro Lima (12347)'],
  metas: ['Meta Geral · 1000/dia', 'João Silva · 350/dia'],
};
const COR_HEX_FALLBACK = '#8A857C';

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return clone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw);
    return { ...clone(DEFAULT_CONFIG), ...parsed };
  } catch (err) {
    console.error('[Mave] Erro ao ler config:', err);
    return clone(DEFAULT_CONFIG);
  }
}
function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
}

function loadRegistros(email) {
  const empty = { trancadeira: [], grampeadeira: [], extensor: [] };
  try {
    const raw = localStorage.getItem(registrosKey(email));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    const result = {
      trancadeira: parsed.trancadeira || [],
      grampeadeira: parsed.grampeadeira || [],
      extensor: parsed.extensor || [],
    };
    // Migration: registros antigos podem nao ter id. Garante id estavel.
    let migrated = false;
    for (const kind of Object.keys(result)) {
      for (const r of result[kind]) {
        if (!r.id) { r.id = newId(); migrated = true; }
      }
    }
    if (migrated) localStorage.setItem(registrosKey(email), JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('[Mave] Erro ao ler registros:', err);
    return empty;
  }
}
function saveRegistros(email, regs) {
  localStorage.setItem(registrosKey(email), JSON.stringify(regs));
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '{}');
  } catch (err) {
    console.error('[Mave] Erro ao ler usuários:', err);
    return {};
  }
}
function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getSession() { return localStorage.getItem(STORAGE_KEYS.SESSION); }
function setSession(email) { localStorage.setItem(STORAGE_KEYS.SESSION, email); }
function clearSession() { localStorage.removeItem(STORAGE_KEYS.SESSION); }

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
  config: loadConfig(),
  email: null,
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
const screenApp = document.getElementById('screen-app');

function showLogin() {
  screenLogin.classList.remove('hidden');
  screenSignup.classList.add('hidden');
  screenApp.style.display = 'none';
  window.scrollTo(0, 0);
}
function showSignup() {
  screenLogin.classList.add('hidden');
  screenSignup.classList.remove('hidden');
  screenApp.style.display = 'none';
  window.scrollTo(0, 0);
}
function showApp() {
  screenLogin.classList.add('hidden');
  screenSignup.classList.add('hidden');
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

// ============================================================
// LOGIN
// ============================================================
const loginForm = document.getElementById('loginForm');
const alertBox = document.getElementById('alert');
const btnLogin = loginForm.querySelector('.btn-login');
const lembrarCheckbox = document.getElementById('lembrar');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const senha = senhaInput.value;
  if (!email || !senha) {
    alertBox.textContent = 'Preencha e-mail e senha.';
    alertBox.classList.add('show');
    return;
  }
  const users = getUsers();
  if (!users[email]) {
    alertBox.textContent = 'E-mail não cadastrado. Crie uma conta primeiro.';
    alertBox.classList.add('show');
    return;
  }
  if (users[email].senha !== senha) {
    alertBox.textContent = 'E-mail ou senha incorretos. Tente novamente.';
    alertBox.classList.add('show');
    senhaInput.value = '';
    senhaInput.focus();
    return;
  }
  alertBox.classList.remove('show');
  btnLogin.textContent = 'Entrando...';
  btnLogin.disabled = true;
  setTimeout(() => {
    btnLogin.textContent = 'Entrar';
    btnLogin.disabled = false;
    if (lembrarCheckbox && lembrarCheckbox.checked) setSession(email);
    enterApp(email);
  }, 400);
});

// ============================================================
// CADASTRO
// ============================================================
const signupForm = document.getElementById('signupForm');
const alertSignup = document.getElementById('alertSignup');
const btnSignup = signupForm.querySelector('.btn-login');

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();
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
  const users = getUsers();
  if (users[email]) {
    alertSignup.textContent = 'Este e-mail já está cadastrado. Faça login.';
    alertSignup.classList.add('show');
    return;
  }
  users[email] = { senha: senha, criado_em: new Date().toISOString() };
  saveUsers(users);
  alertSignup.classList.remove('show');
  btnSignup.textContent = 'Criando conta...';
  btnSignup.disabled = true;
  setTimeout(() => {
    btnSignup.textContent = 'Criar conta';
    btnSignup.disabled = false;
    signupForm.reset();
    document.getElementById('email').value = email;
    senhaInput.focus();
    alertBox.textContent = 'Conta criada! Agora faça login.';
    alertBox.style.background = 'var(--success-bg)';
    alertBox.style.color = 'var(--success)';
    alertBox.style.borderColor = '#B5DCC4';
    alertBox.classList.add('show');
    showLogin();
    setTimeout(() => {
      alertBox.style.background = '';
      alertBox.style.color = '';
      alertBox.style.borderColor = '';
    }, 3000);
  }, 500);
});

// ============================================================
// LOGOUT
// ============================================================
document.getElementById('btnTema').addEventListener('click', toggleTheme);

document.getElementById('btnLogout').addEventListener('click', () => {
  clearSession();
  state.email = null;
  state.registros = { trancadeira: [], grampeadeira: [], extensor: [] };
  state.editing = { trancadeira: null, grampeadeira: null, extensor: null };
  setUserChrome(null);
  loginForm.reset();
  alertBox.classList.remove('show');
  showLogin();
});

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
// HELPERS GERAIS
// ============================================================
const toast = document.getElementById('toast');
function showToast(msg = 'Registro salvo com sucesso!', kind = 'success') {
  toast.textContent = msg;
  toast.classList.toggle('toast-error', kind === 'error');
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), kind === 'error' ? 3500 : 2500);
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function nowTime() { return new Date().toTimeString().slice(0, 5); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
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
  // Mais antigos primeiro no CSV (oposto da tabela), pra ficar cronologico ao abrir
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
    o.value = op;
    o.textContent = op;
    sel.appendChild(o);
  }
  // Se o operador filtrado foi removido da config, mantem como option temp
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
  // Garante que um valor especifico (vindo de registro antigo, p.ex.) continue selecionavel
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
  fillSelect('t-linha', cfg.linhas);
  fillSelect('t-cor', corNomes);
  fillSelect('t-diametro', cfg.diametros);
  fillSelect('g-operador', cfg.operadores);
  fillSelect('e-tipo-caixa', cfg.caixas);
  fillSelect('e-cor', corNomes);
  fillSelect('e-diametro', cfg.diametros);
  renderOperatorFilter();
}

// ============================================================
// CONFIGURAÇÕES (listas editáveis)
// ============================================================
const CONFIG_LISTS = [
  { listId: 'list-cores',      key: 'cores',      isCor: true,  inputId: 'input-cor' },
  { listId: 'list-diametros',  key: 'diametros',  isCor: false, inputId: 'input-diametro' },
  { listId: 'list-caixas',     key: 'caixas',     isCor: false, inputId: 'input-caixa' },
  { listId: 'list-linhas',     key: 'linhas',     isCor: false, inputId: 'input-linha' },
  { listId: 'list-turnos',     key: 'turnos',     isCor: false, inputId: 'input-turno' },
  { listId: 'list-operadores', key: 'operadores', isCor: false, inputId: 'input-operador' },
  { listId: 'list-metas',      key: 'metas',      isCor: false, inputId: 'input-meta' },
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
    if (meta.isCor) {
      const hex = item.hex || COR_HEX_FALLBACK;
      li.innerHTML =
        `<span class="item-text"><span class="color-dot" style="background:${escapeHtml(hex)};"></span>${escapeHtml(item.nome)}</span>` +
        `<span class="item-actions"><button class="edit">Editar</button><button class="remove">Remover</button></span>`;
    } else {
      li.innerHTML =
        `<span class="item-text">${escapeHtml(item)}</span>` +
        `<span class="item-actions"><button class="edit">Editar</button><button class="remove">Remover</button></span>`;
    }
    ul.appendChild(li);
  });
}

function renderAllConfigLists() {
  for (const meta of CONFIG_LISTS) renderConfigList(meta);
  attachConfigActionHandlers();
}

window.addItem = function(listId, inputId) {
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (!value) return;
  const meta = metaForListId(listId);
  if (!meta) return;
  if (meta.isCor) {
    state.config[meta.key].push({ nome: value, hex: COR_HEX_FALLBACK });
  } else {
    state.config[meta.key].push(value);
  }
  saveConfig(state.config);
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
  if (meta.isCor) {
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = state.config[meta.key][idx].hex || COR_HEX_FALLBACK;
    newSpan.appendChild(dot);
  }
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

function saveConfigEdit(li) {
  const input = li.querySelector('.edit-input');
  const newValue = input.value.trim();
  if (!newValue) { input.focus(); return; }
  const meta = metaForListId(li.parentElement.id);
  const idx = Number(li.dataset.index);
  if (meta.isCor) {
    state.config[meta.key][idx].nome = newValue;
  } else {
    state.config[meta.key][idx] = newValue;
  }
  saveConfig(state.config);
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

function removeConfigItem(li) {
  const meta = metaForListId(li.parentElement.id);
  const idx = Number(li.dataset.index);
  state.config[meta.key].splice(idx, 1);
  saveConfig(state.config);
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
      <td>${escapeHtml(r.op)}</td>
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

function persistRegistros() {
  if (state.email) saveRegistros(state.email, state.registros);
  renderDashboard();
}

function removeRegistro(kind, id) {
  const r = findRegistro(kind, id);
  if (!r) return;
  if (!confirm('Remover este registro?')) return;
  state.registros[kind] = state.registros[kind].filter(x => x.id !== id);
  if (state.editing[kind] === id) cancelEditRegistro(kind);
  persistRegistros();
  renderTable(kind);
  showToast('Registro removido.');
}

// ============================================================
// EDIT MODE DE REGISTRO
// ============================================================
function setupFormEditingUI() {
  // Para cada form, monta na .card-header um badge "Editando" e marca o badge
  // existente pra esconder em modo edit; e injeta um botao "Cancelar edicao".
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
      // Insere antes do submit
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
  // Garante que nao ha outro form em edit (cancela os outros pra evitar UI confusa)
  for (const k of Object.keys(state.editing)) {
    if (k !== kind && state.editing[k]) cancelEditRegistro(k);
  }
  state.editing[kind] = id;
  fillFormFromRegistro(kind, r);
  setEditingUI(kind, true);
  // Vai pra aba certa, scrolla pro form
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
    // Restaura data padrao = hoje nos campos de data conhecidos
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heFlag.checked = false;
      heBlock.classList.remove('show');
    }
    // Restaura dropdowns sem ensureValue
    renderDropdowns();
  }
  setEditingUI(kind, false);
  renderTable(kind);
}

function fillFormFromRegistro(kind, r) {
  if (kind === 'trancadeira') {
    document.getElementById('t-data').value = r.data || todayISO();
    fillSelect('t-tipo-caixa', state.config.caixas, r.tipoCaixa);
    fillSelect('t-linha', state.config.linhas, r.linha);
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
    fillSelect('g-operador', state.config.operadores, r.operador);
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

function submitRegistro(kind, form) {
  // Validacao especifica de hora extra
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
  if (editingId) {
    const idx = state.registros[kind].findIndex(r => r.id === editingId);
    if (idx >= 0) {
      // Mantem id e hora original; substitui o resto
      const original = state.registros[kind][idx];
      state.registros[kind][idx] = { id: original.id, hora: original.hora, ...data };
    }
    state.editing[kind] = null;
    setEditingUI(kind, false);
    persistRegistros();
    form.reset();
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heBlock.classList.remove('show');
      heFlag.checked = false;
    }
    renderDropdowns();
    renderTable(kind);
    showToast('Registro atualizado.');
  } else {
    const novo = { id: newId(), hora: nowTime(), ...data };
    state.registros[kind].push(novo);
    persistRegistros();
    form.reset();
    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = todayISO();
    if (kind === 'grampeadeira') {
      heBlock.classList.remove('show');
      heFlag.checked = false;
    }
    renderTable(kind);
    showToast('Registro salvo com sucesso!');
  }
}

const heFlag = document.getElementById('g-he-flag');
const heBlock = document.getElementById('g-he-block');
heFlag.addEventListener('change', () => {
  heBlock.classList.toggle('show', heFlag.checked);
});

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
      // O reset roda antes de qualquer setTimeout; deixa o reset acontecer e
      // depois sai do modo edit (que tambem chama form.reset, mas nao tem efeito).
      setTimeout(() => cancelEditRegistro(kind), 0);
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
  // Iniciais a partir das partes separadas por . _ -, ate 2 letras
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  let initials = parts.slice(0, 2).map(s => s[0].toUpperCase()).join('');
  if (!initials) initials = local.slice(0, 2).toUpperCase();
  // Nome amigavel: capitaliza partes
  const display = parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') || local;
  nameEl.textContent = display;
  metaEl.textContent = email;
  avEl.textContent = initials;
}

// ============================================================
// DASHBOARD
// ============================================================
function parseMeta(s) {
  // Formatos aceitos: "Nome · X/dia" ou "Nome - X/dia"
  const m = String(s).match(/^(.+?)\s*[·\-]\s*(\d+)\s*\/\s*dia\s*$/i);
  if (!m) return null;
  return { nome: m[1].trim(), valor: parseInt(m[2], 10) };
}

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

  // Saudacao no header
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
  for (const raw of metas) {
    const m = parseMeta(raw);
    if (!m) {
      const div = document.createElement('div');
      div.className = 'meta-item';
      div.innerHTML =
        `<div class="meta-item-head"><span class="meta-item-name">${escapeHtml(raw)}</span>` +
        `<span class="meta-item-progress">formato inválido — use "Nome · X/dia"</span></div>`;
      container.appendChild(div);
      continue;
    }
    let realizado;
    if (/^meta\s*geral/i.test(m.nome)) {
      realizado = totalUnidades;
    } else {
      realizado = grHoje
        .filter(r => r.operador && r.operador.startsWith(m.nome))
        .reduce((s, r) => s + (parseInt(r.qtd, 10) || 0)
                            + (r.he && r.he_dados ? (parseInt(r.he_dados.qtd, 10) || 0) : 0), 0);
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
        <span class="meta-item-name">${escapeHtml(m.nome)} · ${m.valor}/dia</span>
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
function enterApp(email) {
  state.email = email;
  state.registros = loadRegistros(email);
  state.editing = { trancadeira: null, grampeadeira: null, extensor: null };
  setUserChrome(email);
  renderDropdowns();
  renderAllConfigLists();
  renderAllTables();
  attachTableActionHandlers();
  renderDashboard();
  // Sempre comeca na aba Dashboard ao entrar
  activateTab('dashboard');
  const t = todayISO();
  document.getElementById('t-data').value = t;
  document.getElementById('g-data').value = t;
  document.getElementById('e-data').value = t;
  showApp();
}

function bootstrap() {
  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) saveConfig(state.config);
  setTheme(getTheme()); // sincroniza label do botao com o tema ja aplicado pelo script inline
  setupFormEditingUI();
  setupTableToolbar();
  setupDashboardKpiClicks();
  renderAllConfigLists();
  renderDropdowns();
  attachTableActionHandlers();
  const sessionEmail = getSession();
  if (sessionEmail && getUsers()[sessionEmail]) {
    if (lembrarCheckbox) lembrarCheckbox.checked = true;
    enterApp(sessionEmail);
  } else {
    showLogin();
  }
}

bootstrap();
