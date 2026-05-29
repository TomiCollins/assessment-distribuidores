// === SUPABASE CONFIG ===
const SUPABASE_URL = 'https://olkqjragrvnneubzgqjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa3FqcmFncnZubmV1YnpncWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzE5MjksImV4cCI6MjA5NTYwNzkyOX0.5bj_dqxidWfdml0fOS0hAOr_6512XT5MOcJY9T6pu0E';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let state = {
  currentStep: 1,
  currentCategory: 0,
  answers: {},
  chartInstance: null,
  vendedorNombre: ''
};

let currentUser = null;
let currentAssessmentId = null;
let syncTimer = null;

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    showHome();
  } else {
    showLogin();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLogin();
    }
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
    }
  });
}

// === AUTH FUNCTIONS ===
function showLogin() {
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('wizard-header').style.display = 'none';
  document.getElementById('wizard-content').style.display = 'none';
  document.getElementById('wizard-footer').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const statusEl = document.getElementById('login-status');

  statusEl.textContent = 'Iniciando sesión...';
  statusEl.className = 'login-status loading';
  document.getElementById('login-btn').disabled = true;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  document.getElementById('login-btn').disabled = false;

  if (error) {
    statusEl.textContent = 'Email o contraseña incorrectos.';
    statusEl.className = 'login-status error';
    return;
  }

  currentUser = data.user;
  statusEl.className = 'login-status';
  showHome();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentAssessmentId = null;
  showLogin();
}

async function handlePasswordReset() {
  const email = document.getElementById('login-email').value.trim();
  const statusEl = document.getElementById('login-status');

  if (!email) {
    statusEl.textContent = 'Ingresá tu email arriba para recibir el link de recuperación.';
    statusEl.className = 'login-status error';
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://assessment-distribuidores.vercel.app'
  });
  if (error) {
    statusEl.textContent = 'No se pudo enviar el email. Verificá la dirección.';
    statusEl.className = 'login-status error';
  } else {
    statusEl.textContent = 'Se envió un email con instrucciones para restablecer tu contraseña.';
    statusEl.className = 'login-status success';
  }
}

// === HOME / DASHBOARD ===
async function showHome() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('home-view').style.display = 'block';
  document.getElementById('wizard-header').style.display = 'none';
  document.getElementById('wizard-content').style.display = 'none';
  document.getElementById('wizard-footer').style.display = 'none';

  document.getElementById('user-email-display').textContent = currentUser?.email || '';
  await loadAssessmentsList();
}

async function loadAssessmentsList() {
  const { data, error } = await supabaseClient
    .from('assessments')
    .select('id, status, nombre_distribuidor, fecha, vendedor, updated_at')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  if (error) {
    document.getElementById('cards-en-progreso').innerHTML = '<div class="home-empty-state">Error al cargar assessments.</div>';
    return;
  }

  const borradores = data.filter(a => a.status === 'borrador');
  const completados = data.filter(a => a.status === 'completado');

  renderAssessmentCards(borradores, 'cards-en-progreso', 'borrador');
  renderAssessmentCards(completados, 'cards-completados', 'completado');

  const btnAll = document.getElementById('btn-download-all');
  btnAll.style.display = completados.length > 0 ? '' : 'none';
}

function renderAssessmentCards(assessments, containerId, status) {
  const container = document.getElementById(containerId);

  if (assessments.length === 0) {
    container.innerHTML = `<div class="home-empty-state">${
      status === 'borrador' ? 'No tenés assessments en progreso.' : 'Todavía no finalizaste ningún assessment.'
    }</div>`;
    return;
  }

  container.innerHTML = assessments.map(a => {
    const fecha = a.fecha ? new Date(a.fecha).toLocaleDateString('es-AR') : 'Sin fecha';
    const updated = new Date(a.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

    const actions = status === 'borrador'
      ? `<button class="btn-card-primary" onclick="openAssessment('${a.id}')">Continuar</button>
         <button class="btn-card-danger" onclick="deleteAssessment('${a.id}')">Eliminar</button>`
      : `<button class="btn-card-primary" onclick="viewCompletedAssessment('${a.id}')">Ver</button>
         <button class="btn-card-secondary" onclick="downloadExcelFromCloud('${a.id}')">Descargar Excel</button>`;

    return `
      <div class="assessment-card status-${status}">
        <div class="card-distribuidor">${a.nombre_distribuidor || 'Sin distribuidor'}</div>
        <div class="card-meta">Fecha: ${fecha} · Actualizado: ${updated}</div>
        <div class="card-status">${status === 'borrador' ? 'En progreso' : 'Completado'}</div>
        <div class="card-actions">${actions}</div>
      </div>
    `;
  }).join('');
}

// === ASSESSMENT CRUD ===
function startNewAssessment() {
  currentAssessmentId = crypto.randomUUID();
  state = { currentStep: 1, currentCategory: 0, answers: {}, chartInstance: null, vendedorNombre: currentUser?.email || '' };
  showWizard();
  resetWizardForm();
  initWizard();
}

async function openAssessment(id) {
  const { data, error } = await supabaseClient.from('assessments').select('*').eq('id', id).single();
  if (error || !data) {
    showToast('No se pudo cargar el assessment.');
    return;
  }

  currentAssessmentId = id;
  const payload = data.payload || {};
  state.answers = payload.answers || {};
  state.vendedorNombre = data.vendedor || currentUser?.email || '';
  state.currentStep = payload.currentStep || 1;
  state.currentCategory = payload.currentCategory || 0;

  showWizard();
  restoreFromPayload(payload);
  initWizard();
  goToStep(state.currentStep);
}

async function viewCompletedAssessment(id) {
  const { data, error } = await supabaseClient.from('assessments').select('*').eq('id', id).single();
  if (error || !data) {
    showToast('No se pudo cargar el assessment.');
    return;
  }

  currentAssessmentId = id;
  const payload = data.payload || {};
  state.answers = payload.answers || {};
  state.vendedorNombre = data.vendedor || '';
  state.currentStep = 4;
  state.currentCategory = 0;

  showWizard();
  restoreFromPayload(payload);
  initWizard();
  goToStep(4);
}

async function downloadExcelFromCloud(id) {
  const { data, error } = await supabaseClient.from('assessments').select('*').eq('id', id).single();
  if (error || !data) {
    showToast('No se pudo cargar el assessment.');
    return;
  }

  const payload = data.payload || {};
  state.answers = payload.answers || {};
  state.vendedorNombre = data.vendedor || '';

  const savedDatos = getDatosValues();
  if (payload.datos) {
    Object.entries(payload.datos).forEach(([key, val]) => {
      if (key === 'zonas_atendidas') return;
      const el = document.getElementById(key);
      if (el && val) el.value = val;
    });
  }

  await exportExcel();

  Object.entries(savedDatos).forEach(([key, val]) => {
    if (key === 'zonas_atendidas') return;
    const el = document.getElementById(key);
    if (el) el.value = val || '';
  });
}

async function deleteAssessment(id) {
  if (!confirm('¿Estás seguro de que querés eliminar este assessment?')) return;

  const { error } = await supabaseClient.from('assessments').delete().eq('id', id);
  if (error) {
    showToast('No se pudo eliminar.');
    return;
  }

  const storageKey = `assessment_${currentUser.id}_${id}`;
  localStorage.removeItem(storageKey);
  showToast('Assessment eliminado.');
  await loadAssessmentsList();
}

async function downloadAllCompleted() {
  showToast('Descargando assessments...');
  const { data, error } = await supabaseClient
    .from('assessments')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'completado');

  if (error || !data || data.length === 0) {
    showToast('No hay assessments completados para descargar.');
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const payload = a.payload || {};
    state.answers = payload.answers || {};
    state.vendedorNombre = a.vendedor || '';

    if (payload.datos) {
      Object.entries(payload.datos).forEach(([key, val]) => {
        if (key === 'zonas_atendidas') return;
        const el = document.getElementById(key);
        if (el) el.value = val || '';
      });
    }

    await exportExcel();

    if (i < data.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  showToast(`${data.length} Excel(s) descargados.`);
}

// === WIZARD DISPLAY ===
function showWizard() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('wizard-header').style.display = 'block';
  document.getElementById('wizard-content').style.display = 'block';
  document.getElementById('wizard-footer').style.display = 'block';
}

function initWizard() {
  document.getElementById('fecha').valueAsDate = document.getElementById('fecha').valueAsDate || new Date();
  renderCategoryTabs();
  renderQuestions(state.currentCategory);
  updateNavButtons();
  initAutocomplete();
  toggleProveedoresTable();
}

function resetWizardForm() {
  document.getElementById('nombre_distribuidor').value = '';
  document.getElementById('cuit').value = '';
  document.getElementById('region').value = '';
  document.getElementById('squad').value = '';
  document.getElementById('fecha').valueAsDate = new Date();
  const zonasContainer = document.getElementById('zonas-container');
  zonasContainer.innerHTML = '<div class="zona-row"><input type="text" class="zona-input" placeholder="Zona atendida"></div>';

  ['facturacion_total', 'representatividad_bayer', 'facturacion_bayer',
    'num_proveedores', 'total_clientes', 'clientes_bayer',
    'empleados_admin', 'empleados_asesores', 'empleados_gerentes',
    'vehiculos_propios', 'vehiculos_terceros'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });

  document.querySelector('#proveedores-table tbody').innerHTML = `
    <tr><td><input type="text"></td><td><input type="number" step="any"></td><td><button type="button" class="btn-remove-row" onclick="removeProveedorRow(this)">✕</button></td></tr>
    <tr><td><input type="text"></td><td><input type="number" step="any"></td><td><button type="button" class="btn-remove-row" onclick="removeProveedorRow(this)">✕</button></td></tr>
    <tr><td><input type="text"></td><td><input type="number" step="any"></td><td><button type="button" class="btn-remove-row" onclick="removeProveedorRow(this)">✕</button></td></tr>
  `;
  document.querySelector('#depositos-table tbody').innerHTML = `
    <tr><td><input type="text"></td><td><input type="number" step="any"></td><td><input type="number"></td><td><input type="text" placeholder="Ej: Lun-Vie 8 a 17"></td><td><button type="button" class="btn-remove-row" onclick="removeDepositRow(this)">✕</button></td></tr>
  `;
  document.querySelector('#puntos-venta-table tbody').innerHTML = `
    <tr><td><select><option value="">Seleccionar...</option><option value="Casa Central">Casa Central</option><option value="Punto de Venta">Punto de Venta</option><option value="Casa Central y Punto de Venta">Casa Central y Punto de Venta</option></select></td><td><input type="text"></td><td><input type="number" min="0"></td><td><button type="button" class="btn-remove-row" onclick="removePuntoVentaRow(this)">✕</button></td></tr>
  `;
  document.getElementById('otras-areas-container').innerHTML = '';

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
}

function restoreFromPayload(payload) {
  if (payload.datos) {
    Object.entries(payload.datos).forEach(([key, val]) => {
      if (key === 'zonas_atendidas') return;
      const el = document.getElementById(key);
      if (el && val) el.value = val;
    });
    if (payload.datos.zonas_atendidas && Array.isArray(payload.datos.zonas_atendidas)) {
      restoreZonas(payload.datos.zonas_atendidas);
    }
  }
  if (payload.porte) restorePorteValues(payload.porte);
  if (payload.answers) state.answers = payload.answers;
}

async function goBackToHome() {
  if (currentAssessmentId) {
    clearTimeout(syncTimer);
    await syncToSupabase();
  }
  currentAssessmentId = null;
  state = { currentStep: 1, currentCategory: 0, answers: {}, chartInstance: null, vendedorNombre: '' };
  showHome();
}

// === AUTOCOMPLETE DISTRIBUIDOR ===
function initAutocomplete() {
  const input = document.getElementById('nombre_distribuidor');
  const list = document.getElementById('autocomplete-list');
  let activeIndex = -1;

  input.removeEventListener('input', input._autocompleteHandler);
  input._autocompleteHandler = () => {
    const val = input.value.trim().toLowerCase();
    list.innerHTML = '';
    activeIndex = -1;
    if (val.length < 2) { list.classList.remove('visible'); return; }

    const matches = DISTRIBUIDORES.filter(d => d.razonSocial.toLowerCase().includes(val));
    if (matches.length === 0) { list.classList.remove('visible'); return; }

    matches.slice(0, 10).forEach((d, i) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = d.razonSocial;
      item.addEventListener('click', () => selectDistribuidor(d));
      list.appendChild(item);
    });
    list.classList.add('visible');
  };
  input.addEventListener('input', input._autocompleteHandler);

  input.removeEventListener('keydown', input._autocompleteKeyHandler);
  input._autocompleteKeyHandler = (e) => {
    const items = list.querySelectorAll('.autocomplete-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        const match = DISTRIBUIDORES.find(d => d.razonSocial === items[activeIndex].textContent);
        if (match) selectDistribuidor(match);
      }
    }
  };
  input.addEventListener('keydown', input._autocompleteKeyHandler);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      list.classList.remove('visible');
    }
  });
}

function selectDistribuidor(dist) {
  document.getElementById('nombre_distribuidor').value = dist.razonSocial;
  document.getElementById('cuit').value = dist.cuit;
  document.getElementById('region').value = dist.bu;
  document.getElementById('squad').value = dist.squad;
  document.getElementById('autocomplete-list').classList.remove('visible');
  saveToStorage();
}

// === ZONAS ATENDIDAS ===
function addZona() {
  const container = document.getElementById('zonas-container');
  const row = document.createElement('div');
  row.className = 'zona-row';
  row.innerHTML = `
    <input type="text" class="zona-input" placeholder="Zona atendida">
    <button type="button" class="btn-remove-zona" onclick="removeZona(this)">✕</button>
  `;
  container.appendChild(row);
}

function removeZona(btn) {
  const container = document.getElementById('zonas-container');
  if (container.children.length > 1) {
    btn.closest('.zona-row').remove();
  }
}

function getZonasValues() {
  return Array.from(document.querySelectorAll('.zona-input'))
    .map(input => input.value.trim())
    .filter(v => v);
}

function restoreZonas(zonas) {
  const container = document.getElementById('zonas-container');
  container.innerHTML = '';
  if (zonas.length === 0) zonas = [''];
  zonas.forEach((z, i) => {
    const row = document.createElement('div');
    row.className = 'zona-row';
    row.innerHTML = `
      <input type="text" class="zona-input" placeholder="Zona atendida" value="${z}">
      ${i > 0 ? '<button type="button" class="btn-remove-zona" onclick="removeZona(this)">✕</button>' : ''}
    `;
    container.appendChild(row);
  });
}

// === LOCAL STORAGE (scoped per user + assessment) ===
function getStorageKey() {
  if (!currentUser || !currentAssessmentId) return null;
  return `assessment_${currentUser.id}_${currentAssessmentId}`;
}

function saveToStorage() {
  const key = getStorageKey();
  if (!key) return;
  const data = {
    datos: getDatosValues(),
    porte: getPorteValues(),
    answers: state.answers,
    timestamp: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(data));
  debouncedSync();
}

function loadFromStorage() {
  const key = getStorageKey();
  if (!key) return;
  const saved = localStorage.getItem(key);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    if (data.datos) {
      Object.entries(data.datos).forEach(([key, val]) => {
        if (key === 'zonas_atendidas') return;
        const el = document.getElementById(key);
        if (el && val) el.value = val;
      });
      if (data.datos.zonas_atendidas && Array.isArray(data.datos.zonas_atendidas)) {
        restoreZonas(data.datos.zonas_atendidas);
      }
    }
    if (data.porte) restorePorteValues(data.porte);
    if (data.answers) state.answers = data.answers;
  } catch(e) { /* ignore corrupt data */ }
}

// === SUPABASE SYNC ===
function debouncedSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncToSupabase(), 10000);
}

async function syncToSupabase() {
  if (!currentUser || !currentAssessmentId) return;

  const datos = getDatosValues();
  const porte = getPorteValues();
  const payload = {
    datos,
    porte,
    answers: state.answers,
    currentStep: state.currentStep,
    currentCategory: state.currentCategory,
    vendedor: state.vendedorNombre
  };

  const { error } = await supabaseClient.from('assessments').upsert({
    id: currentAssessmentId,
    user_id: currentUser.id,
    status: 'borrador',
    nombre_distribuidor: datos.nombre_distribuidor || null,
    cuit: datos.cuit || null,
    bu: datos.region || null,
    squad: datos.squad || null,
    fecha: datos.fecha || null,
    vendedor: state.vendedorNombre || null,
    payload: payload
  });

  if (!error) {
    showToast('Guardado en la nube');
  }
}

// === NAVIGATION ===
function goToStep(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  document.querySelectorAll('.progress-step').forEach(s => {
    const sNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sNum === step) s.classList.add('active');
    else if (sNum < step) s.classList.add('completed');
  });
  state.currentStep = step;
  updateNavButtons();
  if (step === 4) renderResults();
  window.scrollTo(0, 0);
}

function nextStep() {
  if (state.currentStep === 1 && !validateDatos()) return;
  saveToStorage();
  if (state.currentStep < 4) goToStep(state.currentStep + 1);
}

function prevStep() {
  saveToStorage();
  if (state.currentStep > 1) goToStep(state.currentStep - 1);
}

function updateNavButtons() {
  document.getElementById('btn-prev').disabled = state.currentStep === 1;
  const btnNext = document.getElementById('btn-next');
  if (state.currentStep === 4) {
    btnNext.style.display = 'none';
  } else {
    btnNext.style.display = '';
    btnNext.textContent = state.currentStep === 3 ? 'Ver Resultados →' : 'Siguiente →';
  }
}

function validateDatos() {
  const required = ['nombre_distribuidor', 'region', 'squad', 'fecha'];
  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = 'var(--error-red)';
      valid = false;
    } else {
      el.style.borderColor = '';
    }
  });
  if (!valid) showToast('Por favor completá los campos obligatorios');
  return valid;
}

// === CATEGORY TABS & QUESTIONS ===
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  container.innerHTML = ASSESSMENT_DATA.categories.map((cat, i) => {
    const shortName = cat.name.length > 25 ? cat.name.substring(0, 22) + '...' : cat.name;
    return `<div class="category-tab ${i === state.currentCategory ? 'active' : ''}" onclick="switchCategory(${i})" title="${cat.name}">${i + 1}. ${shortName}</div>`;
  }).join('');
}

function switchCategory(index) {
  saveToStorage();
  state.currentCategory = index;
  document.querySelectorAll('.category-tab').forEach((tab, i) => {
    tab.classList.remove('active');
    if (i === index) tab.classList.add('active');
    updateTabStatus(tab, i);
  });
  renderQuestions(index);
}

function updateTabStatus(tab, catIndex) {
  const cat = ASSESSMENT_DATA.categories[catIndex];
  const answered = cat.questions.filter(q => isQuestionFullyAnswered(q)).length;
  tab.classList.remove('has-answers', 'complete');
  if (answered === cat.questions.length) tab.classList.add('complete');
  else if (answered > 0) tab.classList.add('has-answers');
}

function getSubQuestions(q) {
  return q.pregunta.split('\n').map(s => s.trim()).filter(s => s);
}

function isQuestionFullyAnswered(q) {
  const answer = state.answers[q.id];
  if (!answer || !answer.sub) return false;
  const subQs = getSubQuestions(q);
  return subQs.every((_, i) => answer.sub[i]);
}

function renderQuestions(catIndex) {
  const cat = ASSESSMENT_DATA.categories[catIndex];
  const answered = cat.questions.filter(q => isQuestionFullyAnswered(q)).length;

  document.getElementById('category-progress').innerHTML = `
    <span>${cat.name} — ${answered}/${cat.questions.length} respondidas (Peso: ${Math.round(cat.weightTotal * 100)}%)</span>
    <div class="progress-fill"><div class="progress-fill-inner" style="width:${(answered/cat.questions.length)*100}%"></div></div>
  `;

  const container = document.getElementById('questions-container');
  container.innerHTML = cat.questions.map(q => {
    const answer = state.answers[q.id] || {};
    const subQs = getSubQuestions(q);
    const isAnswered = isQuestionFullyAnswered(q) ? 'answered' : '';
    const answeredCount = subQs.filter((_, i) => answer.sub?.[i]).length;

    let subQuestionsHtml = subQs.map((sq, i) => {
      const subVal = answer.sub?.[i] || '';
      return `
        <div class="sub-question">
          <div class="sub-question-text">${sq}</div>
          <div class="rating-options rating-options-inline">
            <div class="rating-option bajo">
              <input type="radio" name="q_${q.id}_${i}" id="q_${q.id}_${i}_bajo" value="bajo" ${subVal === 'bajo' ? 'checked' : ''} onchange="setSubAnswer('${q.id}', ${i}, 'bajo')">
              <label for="q_${q.id}_${i}_bajo">Bajo - 0%</label>
            </div>
            <div class="rating-option mediano">
              <input type="radio" name="q_${q.id}_${i}" id="q_${q.id}_${i}_mediano" value="mediano" ${subVal === 'mediano' ? 'checked' : ''} onchange="setSubAnswer('${q.id}', ${i}, 'mediano')">
              <label for="q_${q.id}_${i}_mediano">Mediano - 50%</label>
            </div>
            <div class="rating-option alto">
              <input type="radio" name="q_${q.id}_${i}" id="q_${q.id}_${i}_alto" value="alto" ${subVal === 'alto' ? 'checked' : ''} onchange="setSubAnswer('${q.id}', ${i}, 'alto')">
              <label for="q_${q.id}_${i}_alto">Alto - 100%</label>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="question-card ${isAnswered}" id="card-${q.id}">
        <div class="question-header">
          <span class="question-number">${q.id}</span>
          <span class="question-aspecto">${q.aspecto}</span>
          <span class="question-progress-badge">${answeredCount}/${subQs.length}</span>
        </div>
        <div class="level-descriptions">
          <button class="level-toggle" onclick="toggleDetails('${q.id}')">Ver criterios de evaluación</button>
          <div class="level-details" id="details-${q.id}">
            ${renderLevelDetails(q)}
          </div>
        </div>
        <div class="sub-questions-container">
          ${subQuestionsHtml}
        </div>
        <div class="obs-label">Observaciones generales</div>
        <textarea placeholder="Observaciones opcionales para esta sección..." onblur="setObservation('${q.id}', this.value)">${answer.observaciones || ''}</textarea>
      </div>
    `;
  }).join('');

  const totalCats = ASSESSMENT_DATA.categories.length;
  const prevDisabled = catIndex === 0 ? 'disabled' : '';
  const nextLabel = catIndex === totalCats - 1 ? 'Ver Resultados →' : 'Siguiente Competencia →';
  container.innerHTML += `
    <div class="category-nav-buttons">
      <button type="button" class="btn-secondary" ${prevDisabled} onclick="navCategory(-1)">← Competencia Anterior</button>
      <button type="button" class="btn-primary" onclick="navCategory(1)">${nextLabel}</button>
    </div>
  `;
}

function navCategory(direction) {
  const totalCats = ASSESSMENT_DATA.categories.length;
  const newIndex = state.currentCategory + direction;
  if (newIndex >= 0 && newIndex < totalCats) {
    switchCategory(newIndex);
    window.scrollTo(0, 0);
  } else if (newIndex >= totalCats) {
    nextStep();
  }
}

function renderLevelDetails(q) {
  let html = '';
  ['bajo', 'mediano', 'alto'].forEach(level => {
    const data = q[level];
    const levelLabel = level === 'bajo' ? 'Bajo (0%)' : level === 'mediano' ? 'Mediano (50%)' : 'Alto (100%)';
    html += `<div class="level-detail-item ${level}-detail"><h5>${levelLabel}: ${data.titulo}</h5>`;
    if (data.detalles.length > 0) {
      html += '<ul>' + data.detalles.map(d => `<li>${d}</li>`).join('') + '</ul>';
    }
    html += '</div>';
  });
  return html;
}

function toggleDetails(qId) {
  const el = document.getElementById(`details-${qId}`);
  el.classList.toggle('visible');
}

function setSubAnswer(qId, subIndex, value) {
  if (!state.answers[qId]) state.answers[qId] = {};
  if (!state.answers[qId].sub) state.answers[qId].sub = {};
  state.answers[qId].sub[subIndex] = value;

  const q = ASSESSMENT_DATA.categories.flatMap(c => c.questions).find(q => q.id === qId);
  if (q && isQuestionFullyAnswered(q)) {
    document.getElementById(`card-${qId}`).classList.add('answered');
  }
  const subQs = getSubQuestions(q);
  const answeredCount = subQs.filter((_, i) => state.answers[qId].sub[i]).length;
  const badge = document.querySelector(`#card-${qId} .question-progress-badge`);
  if (badge) badge.textContent = `${answeredCount}/${subQs.length}`;

  updateCategoryProgress();
  saveToStorage();
}

function setObservation(qId, value) {
  if (!state.answers[qId]) state.answers[qId] = {};
  state.answers[qId].observaciones = value;
  saveToStorage();
}

function updateCategoryProgress() {
  const cat = ASSESSMENT_DATA.categories[state.currentCategory];
  const answered = cat.questions.filter(q => isQuestionFullyAnswered(q)).length;
  const progressEl = document.getElementById('category-progress');
  progressEl.querySelector('span').textContent = `${cat.name} — ${answered}/${cat.questions.length} respondidas (Peso: ${Math.round(cat.weightTotal * 100)}%)`;
  progressEl.querySelector('.progress-fill-inner').style.width = `${(answered/cat.questions.length)*100}%`;

  document.querySelectorAll('.category-tab').forEach((tab, i) => updateTabStatus(tab, i));
}

// === CALCULATIONS ===
function getCalificacionValue(calificacion) {
  if (calificacion === 'alto') return 1.0;
  if (calificacion === 'mediano') return 0.5;
  return 0;
}

function getQuestionAverage(q) {
  const answer = state.answers[q.id];
  if (!answer?.sub) return 0;
  const subQs = getSubQuestions(q);
  let sum = 0;
  let count = 0;
  subQs.forEach((_, i) => {
    if (answer.sub[i]) {
      sum += getCalificacionValue(answer.sub[i]);
      count++;
    }
  });
  return count > 0 ? sum / count : 0;
}

function calculateResults() {
  const results = ASSESSMENT_DATA.categories.map(cat => {
    let scoreSeccion = 0;
    let scoreTotal = 0;
    cat.questions.forEach(q => {
      const avg = getQuestionAverage(q);
      scoreSeccion += avg * q.ponderacionCompetencia;
      scoreTotal += avg * q.ponderacionTotal;
    });
    return {
      name: cat.name,
      scoreTotal: scoreTotal,
      scoreCategoria: scoreSeccion
    };
  });
  const totalGeneral = results.reduce((sum, r) => sum + r.scoreTotal, 0);
  return { categorias: results, totalGeneral };
}

// === RESULTS RENDERING ===
function renderResults() {
  const datos = getDatosValues();
  document.getElementById('results-header').innerHTML = `
    <p><strong>Distribuidor:</strong> ${datos.nombre_distribuidor || '-'} | <strong>CUIT:</strong> ${datos.cuit || '-'}</p>
    <p><strong>BU:</strong> ${datos.region || '-'} | <strong>Squad:</strong> ${datos.squad || '-'}</p>
    <p><strong>Zonas:</strong> ${Array.isArray(datos.zonas_atendidas) ? datos.zonas_atendidas.join(', ') : (datos.zonas_atendidas || '-')} | <strong>Fecha:</strong> ${datos.fecha || '-'}</p>
  `;

  const results = calculateResults();
  document.getElementById('results-score').innerHTML = `
    <div class="score-label">Puntuación Total del Assessment</div>
    <div class="score-value">${Math.round(results.totalGeneral * 100)}%</div>
  `;

  const tbody = document.querySelector('#results-table tbody');
  tbody.innerHTML = results.categorias.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${Math.round(r.scoreTotal * 100)}%</td>
      <td>${Math.round(r.scoreCategoria * 100)}%</td>
    </tr>
  `).join('') + `
    <tr>
      <td>TOTAL</td>
      <td>${Math.round(results.totalGeneral * 100)}%</td>
      <td>—</td>
    </tr>
  `;

  renderRadarChart(results);
}

function renderRadarChart(results) {
  const ctx = document.getElementById('radarChart').getContext('2d');
  if (state.chartInstance) state.chartInstance.destroy();

  state.chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: results.categorias.map(r => {
        const name = r.name;
        return name.length > 20 ? name.substring(0, 18) + '...' : name;
      }),
      datasets: [{
        label: 'Calificación por Categoría',
        data: results.categorias.map(r => r.scoreCategoria),
        backgroundColor: 'rgba(0, 130, 75, 0.2)',
        borderColor: 'rgb(0, 130, 75)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(0, 130, 75)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: {
            stepSize: 0.25,
            callback: v => Math.round(v * 100) + '%',
            font: { size: 10 }
          },
          pointLabels: { font: { size: 9 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => Math.round(ctx.raw * 100) + '%'
          }
        }
      }
    }
  });
}

// === EXCEL EXPORT ===
async function exportExcel() {
  const datos = getDatosValues();
  const porte = getPorteValues();
  const results = calculateResults();
  const wb = new ExcelJS.Workbook();

  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0068B4' } };
  const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00824B' } };
  const lightFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  const borderStyle = { style: 'thin', color: { argb: 'FFE0E5EB' } };
  const borders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

  // --- SOLAPA 1: Datos ---
  const wsDatos = wb.addWorksheet('Datos');
  wsDatos.columns = [{ width: 28 }, { width: 45 }];
  wsDatos.views = [{ showGridLines: false }];

  const datosTitle = wsDatos.addRow(['DATOS GENERALES', '']);
  datosTitle.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0068B4' } };
  wsDatos.addRow([]);

  const datosHeader = wsDatos.addRow(['Campo', 'Valor']);
  datosHeader.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  const zonasStr = Array.isArray(datos.zonas_atendidas) ? datos.zonas_atendidas.join(', ') : (datos.zonas_atendidas || '');
  const datosFields = [
    ['Razón Social', datos.nombre_distribuidor || ''],
    ['CUIT', datos.cuit || ''],
    ['BU', datos.region || ''],
    ['Squad', datos.squad || ''],
    ['Zonas Atendidas', zonasStr],
    ['Fecha', datos.fecha || ''],
    ['Vendedor', state.vendedorNombre || '']
  ];
  datosFields.forEach((row, i) => {
    const r = wsDatos.addRow(row);
    r.eachCell(cell => { cell.border = borders; });
    if (i % 2 === 0) r.getCell(1).fill = lightFill;
  });

  // --- SOLAPA 2: Porte ---
  const wsPorte = wb.addWorksheet('Porte');
  wsPorte.columns = [{ width: 32 }, { width: 22 }, { width: 16 }];
  wsPorte.views = [{ showGridLines: false }];

  function addPorteSection(title, fields) {
    const titleRow = wsPorte.addRow([title]);
    titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
    wsPorte.addRow([]);
    const hdr = wsPorte.addRow(['Campo', 'Valor']);
    hdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
    fields.forEach(f => {
      const r = wsPorte.addRow(f);
      r.eachCell(cell => { cell.border = borders; });
    });
    wsPorte.addRow([]);
  }

  addPorteSection('Performance', [
    ['Facturación total 2025 (USD)', porte.facturacion_total || ''],
    ['% Representatividad Bayer', porte.representatividad_bayer || ''],
    ['Facturación total Agrobayer 2025 (USD)', porte.facturacion_bayer || '']
  ]);

  addPorteSection('Clientes', [
    ['Cantidad total de clientes', porte.total_clientes || ''],
    ['Cantidad clientes con Bayer', porte.clientes_bayer || '']
  ]);

  const empleadosFields = [
    ['Cantidad Gerentes', porte.empleados_gerentes || ''],
    ['Cantidad Administrativos', porte.empleados_admin || ''],
    ['Cantidad Asesores', porte.empleados_asesores || '']
  ];
  if (porte.otras_areas && porte.otras_areas.length > 0) {
    porte.otras_areas.forEach(a => {
      empleadosFields.push([a.nombre || 'Otra área', a.cantidad || '']);
    });
  }
  addPorteSection('Empleados', empleadosFields);

  addPorteSection('Flota', [
    ['Cantidad Vehículos Propios', porte.vehiculos_propios || ''],
    ['Cantidad Vehículos de Terceros', porte.vehiculos_terceros || '']
  ]);

  const provTitle = wsPorte.addRow(['Proveedores']);
  provTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  wsPorte.addRow(['Cantidad de proveedores: ' + (porte.num_proveedores || '')]);
  const provHdr = wsPorte.addRow(['Proveedor', '% Ventas']);
  provHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.proveedores && porte.proveedores.length > 0) {
    porte.proveedores.forEach(p => {
      const r = wsPorte.addRow([p.nombre || '', p.pctVentas || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }
  wsPorte.addRow([]);

  const depTitle = wsPorte.addRow(['Depósitos']);
  depTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  const depHdr = wsPorte.addRow(['Dirección', 'Tamaño (m²)', 'Cantidad Empleados', 'Horario de Atención']);
  depHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.depositos && porte.depositos.length > 0) {
    porte.depositos.forEach(d => {
      const r = wsPorte.addRow([d.direccion || '', d.tamanoM2 || '', d.empleados || '', d.horario || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }
  wsPorte.addRow([]);

  const pvTitle = wsPorte.addRow(['Puntos de Venta']);
  pvTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  const pvHdr = wsPorte.addRow(['Tipo', 'Dirección', 'Cantidad Empleados']);
  pvHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.puntos_venta && porte.puntos_venta.length > 0) {
    porte.puntos_venta.forEach(pv => {
      const r = wsPorte.addRow([pv.tipo || '', pv.direccion || '', pv.empleados || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }

  // --- SOLAPA 3: Assessment ---
  const wsAssess = wb.addWorksheet('Assessment');
  wsAssess.columns = [{ width: 6 }, { width: 36 }, { width: 50 }, { width: 14 }, { width: 10 }, { width: 50 }];
  wsAssess.views = [{ showGridLines: false }];

  const assessHdr = wsAssess.addRow(['#', 'Categoría / Aspecto', 'Pregunta', 'Puntuación', 'Valor', 'Observaciones']);
  assessHdr.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  ASSESSMENT_DATA.categories.forEach(cat => {
    cat.questions.forEach(q => {
      const answer = state.answers[q.id] || {};
      const subQs = getSubQuestions(q);
      const avg = getQuestionAverage(q);

      const sectionRow = wsAssess.addRow([q.id, cat.name + ' — ' + q.aspecto, '', '', avg || '', answer.observaciones || '']);
      sectionRow.getCell(1).font = { bold: true };
      sectionRow.getCell(2).font = { bold: true };
      sectionRow.getCell(5).numFmt = '0%';
      sectionRow.eachCell(cell => { cell.border = borders; cell.fill = lightFill; });

      subQs.forEach((sq, i) => {
        const subVal = answer.sub?.[i] || '';
        const calLabel = subVal ? (subVal === 'bajo' ? 'Bajo' : subVal === 'mediano' ? 'Mediano' : 'Alto') : '';
        const numVal = subVal ? getCalificacionValue(subVal) : '';
        const r = wsAssess.addRow(['', '', sq, calLabel, numVal, '']);
        r.eachCell(cell => { cell.border = borders; });
        if (subVal === 'bajo') r.getCell(4).font = { color: { argb: 'FFE53935' } };
        else if (subVal === 'mediano') r.getCell(4).font = { color: { argb: 'FFFB8C00' } };
        else if (subVal === 'alto') r.getCell(4).font = { color: { argb: 'FF43A047' } };
      });
    });
  });

  // --- SOLAPA 4: Resultados ---
  const wsRes = wb.addWorksheet('Resultados');
  wsRes.columns = [{ width: 42 }, { width: 22 }, { width: 24 }];
  wsRes.views = [{ showGridLines: false }];

  const resTitle = wsRes.addRow(['RESULTADOS DEL ASSESSMENT', '', '']);
  resTitle.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0068B4' } };
  wsRes.addRow([]);

  const resInfo = wsRes.addRow(['Distribuidor: ' + (datos.nombre_distribuidor || ''), 'CUIT: ' + (datos.cuit || ''), 'Fecha: ' + (datos.fecha || '')]);
  resInfo.getCell(1).font = { bold: true };
  wsRes.addRow([]);

  const resHdr = wsRes.addRow(['Competencia', 'Score sobre Total', 'Score por Categoría']);
  resHdr.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  results.categorias.forEach((r, i) => {
    const row = wsRes.addRow([r.name, r.scoreTotal, r.scoreCategoria]);
    row.eachCell(cell => { cell.border = borders; });
    row.getCell(2).numFmt = '0%';
    row.getCell(3).numFmt = '0%';
    if (i % 2 === 0) row.getCell(1).fill = lightFill;
  });

  wsRes.addRow([]);
  const totalRow = wsRes.addRow(['TOTAL GENERAL', results.totalGeneral, '']);
  totalRow.getCell(1).font = { bold: true, size: 12 };
  totalRow.getCell(2).font = { bold: true, size: 12 };
  totalRow.getCell(2).numFmt = '0%';
  totalRow.eachCell(cell => { cell.border = borders; });
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };

  // --- Radar chart as image ---
  const radarCanvas = document.getElementById('radarChart');
  if (radarCanvas) {
    try {
      const radarBase64 = radarCanvas.toDataURL('image/png').split(',')[1];
      const imageId = wb.addImage({ base64: radarBase64, extension: 'png' });
      wsRes.addRow([]);
      wsRes.addRow([]);
      const chartStartRow = wsRes.rowCount + 1;
      wsRes.addImage(imageId, {
        tl: { col: 0, row: chartStartRow - 1 },
        ext: { width: 480, height: 480 }
      });
    } catch(e) { /* skip chart if capture fails */ }
  }

  // --- Download ---
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Assessment_${(datos.nombre_distribuidor || 'sin_nombre').replace(/\s+/g, '_')}_${datos.fecha || 'sin_fecha'}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Excel descargado correctamente');
}

// === SUBMIT ASSESSMENT (finalize → download → sync → home) ===
async function submitAssessment() {
  // Validate all competency questions are answered
  const incomplete = [];
  ASSESSMENT_DATA.categories.forEach(cat => {
    const unanswered = cat.questions.filter(q => !isQuestionFullyAnswered(q));
    if (unanswered.length > 0) {
      incomplete.push({ name: cat.name, missing: unanswered.length, total: cat.questions.length });
    }
  });

  if (incomplete.length > 0) {
    const detail = incomplete.map(c => `• ${c.name}: faltan ${c.missing} de ${c.total}`).join('\n');
    alert(`No podés finalizar sin completar todas las competencias.\n\nSecciones incompletas:\n${detail}`);
    return;
  }

  const datos = getDatosValues();
  const porte = getPorteValues();
  const results = calculateResults();

  // 1. Download Excel
  await exportExcel();

  // 2. Sync to Supabase as completed
  const payload = {
    status: "completado",
    vendedor: state.vendedorNombre || currentUser?.email || '',
    timestamp: new Date().toISOString(),
    datos,
    porte,
    answers: state.answers,
    currentStep: state.currentStep,
    currentCategory: state.currentCategory,
    resultados: results
  };

  if (currentUser && currentAssessmentId) {
    await supabaseClient.from('assessments').upsert({
      id: currentAssessmentId,
      user_id: currentUser.id,
      status: 'completado',
      nombre_distribuidor: datos.nombre_distribuidor || null,
      cuit: datos.cuit || null,
      bu: datos.region || null,
      squad: datos.squad || null,
      fecha: datos.fecha || null,
      vendedor: state.vendedorNombre || currentUser.email || null,
      payload: payload
    });
  }

  // 3. Clear localStorage for this assessment
  const key = getStorageKey();
  if (key) localStorage.removeItem(key);

  // 4. Show confirmation and redirect to home
  showToast('Assessment finalizado. Excel descargado.');
  setTimeout(() => {
    currentAssessmentId = null;
    showHome();
  }, 2000);
}

// === SAVE DRAFT (sync to Supabase immediately) ===
async function saveDraft() {
  saveToStorage();
  clearTimeout(syncTimer);
  await syncToSupabase();
  showToast('Borrador guardado en la nube.');
}

// === HELPERS ===
function getDatosValues() {
  return {
    nombre_distribuidor: document.getElementById('nombre_distribuidor')?.value || '',
    cuit: document.getElementById('cuit')?.value || '',
    region: document.getElementById('region')?.value || '',
    squad: document.getElementById('squad')?.value || '',
    zonas_atendidas: getZonasValues(),
    fecha: document.getElementById('fecha')?.value || ''
  };
}

function getPorteValues() {
  const fields = ['facturacion_total', 'representatividad_bayer', 'facturacion_bayer',
    'num_proveedores', 'total_clientes', 'clientes_bayer',
    'empleados_admin', 'empleados_asesores', 'empleados_gerentes',
    'vehiculos_propios', 'vehiculos_terceros'];

  const result = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    result[f] = el ? el.value : '';
  });

  result.proveedores = [];
  document.querySelectorAll('#proveedores-table tbody tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      result.proveedores.push({
        nombre: inputs[0].value,
        pctVentas: inputs[1]?.value || ''
      });
    }
  });

  result.otras_areas = [];
  document.querySelectorAll('.otra-area-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      result.otras_areas.push({
        nombre: inputs[0].value,
        cantidad: inputs[1]?.value || ''
      });
    }
  });

  result.depositos = [];
  document.querySelectorAll('#depositos-table tbody tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      result.depositos.push({
        direccion: inputs[0].value,
        tamanoM2: inputs[1]?.value || '',
        empleados: inputs[2]?.value || '',
        horario: inputs[3]?.value || ''
      });
    }
  });

  result.puntos_venta = [];
  document.querySelectorAll('#puntos-venta-table tbody tr').forEach(row => {
    const select = row.querySelector('select');
    const inputs = row.querySelectorAll('input');
    if (select?.value || inputs[0]?.value) {
      result.puntos_venta.push({
        tipo: select?.value || '',
        direccion: inputs[0]?.value || '',
        empleados: inputs[1]?.value || ''
      });
    }
  });

  return result;
}

function restorePorteValues(porte) {
  const fields = ['facturacion_total', 'representatividad_bayer', 'facturacion_bayer',
    'num_proveedores', 'total_clientes', 'clientes_bayer',
    'empleados_admin', 'empleados_asesores', 'empleados_gerentes',
    'vehiculos_propios', 'vehiculos_terceros'];

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && porte[f]) el.value = porte[f];
  });

  if (porte.proveedores && porte.proveedores.length > 0) {
    const tbody = document.querySelector('#proveedores-table tbody');
    tbody.innerHTML = '';
    porte.proveedores.forEach(p => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${p.nombre || ''}"></td>
        <td><input type="number" step="any" value="${p.pctVentas || ''}"></td>
        <td><button type="button" class="btn-remove-row" onclick="removeProveedorRow(this)">✕</button></td>
      `;
      tbody.appendChild(row);
    });
  }

  if (porte.otras_areas && porte.otras_areas.length > 0) {
    porte.otras_areas.forEach(a => addOtraArea(a.nombre, a.cantidad));
  }

  if (porte.num_proveedores) toggleProveedoresTable();

  if (porte.depositos) {
    const tbody = document.querySelector('#depositos-table tbody');
    tbody.innerHTML = '';
    porte.depositos.forEach(d => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${d.direccion || ''}"></td>
        <td><input type="number" step="any" value="${d.tamanoM2 || ''}"></td>
        <td><input type="number" value="${d.empleados || ''}"></td>
        <td><input type="text" placeholder="Ej: Lun-Vie 8 a 17" value="${d.horario || ''}"></td>
        <td><button type="button" class="btn-remove-row" onclick="removeDepositRow(this)">✕</button></td>
      `;
      tbody.appendChild(row);
    });
    if (porte.depositos.length === 0) addDepositRow();
  }

  if (porte.puntos_venta) {
    const tbody = document.querySelector('#puntos-venta-table tbody');
    tbody.innerHTML = '';
    porte.puntos_venta.forEach(pv => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <select>
            <option value="">Seleccionar...</option>
            <option value="Casa Central" ${pv.tipo === 'Casa Central' ? 'selected' : ''}>Casa Central</option>
            <option value="Punto de Venta" ${pv.tipo === 'Punto de Venta' ? 'selected' : ''}>Punto de Venta</option>
            <option value="Casa Central y Punto de Venta" ${pv.tipo === 'Casa Central y Punto de Venta' ? 'selected' : ''}>Casa Central y Punto de Venta</option>
          </select>
        </td>
        <td><input type="text" value="${pv.direccion || ''}"></td>
        <td><input type="number" min="0" value="${pv.empleados || ''}"></td>
        <td><button type="button" class="btn-remove-row" onclick="removePuntoVentaRow(this)">✕</button></td>
      `;
      tbody.appendChild(row);
    });
    if (porte.puntos_venta.length === 0) addPuntoVentaRow();
  }
}

function addDepositRow() {
  const tbody = document.querySelector('#depositos-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text"></td>
    <td><input type="number" step="any"></td>
    <td><input type="number"></td>
    <td><input type="text" placeholder="Ej: Lun-Vie 8 a 17"></td>
    <td><button type="button" class="btn-remove-row" onclick="removeDepositRow(this)">✕</button></td>
  `;
  tbody.appendChild(row);
}

function removeDepositRow(btn) {
  const tbody = btn.closest('tbody');
  if (tbody.children.length > 1) {
    btn.closest('tr').remove();
  }
}

function addPuntoVentaRow() {
  const tbody = document.querySelector('#puntos-venta-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select>
        <option value="">Seleccionar...</option>
        <option value="Casa Central">Casa Central</option>
        <option value="Punto de Venta">Punto de Venta</option>
        <option value="Casa Central y Punto de Venta">Casa Central y Punto de Venta</option>
      </select>
    </td>
    <td><input type="text"></td>
    <td><input type="number" min="0"></td>
    <td><button type="button" class="btn-remove-row" onclick="removePuntoVentaRow(this)">✕</button></td>
  `;
  tbody.appendChild(row);
}

function removePuntoVentaRow(btn) {
  const tbody = btn.closest('tbody');
  if (tbody.children.length > 1) {
    btn.closest('tr').remove();
  }
}

function toggleProveedoresTable() {
  const num = parseInt(document.getElementById('num_proveedores').value) || 0;
  const section = document.getElementById('proveedores-section');
  section.style.display = num > 0 ? '' : 'none';
}

function addProveedorRow() {
  const tbody = document.querySelector('#proveedores-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text"></td>
    <td><input type="number" step="any"></td>
    <td><button type="button" class="btn-remove-row" onclick="removeProveedorRow(this)">✕</button></td>
  `;
  tbody.appendChild(row);
}

function removeProveedorRow(btn) {
  const tbody = btn.closest('tbody');
  if (tbody.children.length > 1) {
    btn.closest('tr').remove();
  }
}

function addOtraArea(nombre, cantidad) {
  const container = document.getElementById('otras-areas-container');
  const row = document.createElement('div');
  row.className = 'otra-area-row zona-row';
  row.innerHTML = `
    <input type="text" class="zona-input" placeholder="Nombre del área" value="${nombre || ''}">
    <input type="number" class="zona-input" style="max-width:100px" placeholder="Cantidad" min="0" value="${cantidad || ''}">
    <button type="button" class="btn-remove-zona" onclick="removeOtraArea(this)">✕</button>
  `;
  container.appendChild(row);
}

function removeOtraArea(btn) {
  btn.closest('.otra-area-row').remove();
}

function dismissBanner() {
  document.getElementById('info-banner').classList.add('hidden');
  document.getElementById('info-help-btn').classList.remove('hidden');
}

function showBanner() {
  document.getElementById('info-banner').classList.remove('hidden');
  document.getElementById('info-help-btn').classList.add('hidden');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

// Allow clicking progress steps
document.querySelectorAll('.progress-step').forEach(step => {
  step.addEventListener('click', () => {
    const num = parseInt(step.dataset.step);
    if (num <= state.currentStep || num === state.currentStep + 1) {
      saveToStorage();
      goToStep(num);
    }
  });
});
