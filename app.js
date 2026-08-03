// === SUPABASE CONFIG ===
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://olkqjragrvnneubzgqjd.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa3FqcmFncnZubmV1YnpncWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzE5MjksImV4cCI6MjA5NTYwNzkyOX0.5bj_dqxidWfdml0fOS0hAOr_6512XT5MOcJY9T6pu0E';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let state = {
  currentStep: 1,
  currentCategory: 0,
  currentPillar: 0,
  answers: {},
  chartInstance: null,
  chartInstancePilares: null,
  vendedorNombre: ''
};

let currentUser = null;
let currentAssessmentId = null;
let syncTimer = null;
let isPasswordRecoveryFlow = false;

const LOGIN_GUARD = {
  maxFailedAttempts: 10,
  lockMinutes: 15,
  windowMinutes: 30,
  storageKey: 'assessment_login_guard_v1'
};

function getLoginGuardMap() {
  try {
    const raw = localStorage.getItem(LOGIN_GUARD.storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLoginGuardMap(map) {
  try {
    localStorage.setItem(LOGIN_GUARD.storageKey, JSON.stringify(map));
  } catch {
    // Ignore storage errors (private mode/quota)
  }
}

function normalizeEmailForGuard(email) {
  return (email || '').trim().toLowerCase();
}

function getLoginRecord(email) {
  const now = Date.now();
  const key = normalizeEmailForGuard(email);
  const map = getLoginGuardMap();
  const rec = map[key] || { failed: 0, firstFailAt: 0, lockUntil: 0 };

  if (rec.lockUntil && now > rec.lockUntil) {
    rec.failed = 0;
    rec.firstFailAt = 0;
    rec.lockUntil = 0;
    map[key] = rec;
    setLoginGuardMap(map);
  }

  if (rec.firstFailAt && now - rec.firstFailAt > LOGIN_GUARD.windowMinutes * 60 * 1000) {
    rec.failed = 0;
    rec.firstFailAt = 0;
    rec.lockUntil = 0;
    map[key] = rec;
    setLoginGuardMap(map);
  }

  return rec;
}

function registerFailedLogin(email) {
  const now = Date.now();
  const key = normalizeEmailForGuard(email);
  const map = getLoginGuardMap();
  const rec = map[key] || { failed: 0, firstFailAt: 0, lockUntil: 0 };

  if (!rec.firstFailAt || now - rec.firstFailAt > LOGIN_GUARD.windowMinutes * 60 * 1000) {
    rec.failed = 0;
    rec.firstFailAt = now;
    rec.lockUntil = 0;
  }

  rec.failed += 1;
  if (rec.failed >= LOGIN_GUARD.maxFailedAttempts) {
    rec.lockUntil = now + LOGIN_GUARD.lockMinutes * 60 * 1000;
  }

  map[key] = rec;
  setLoginGuardMap(map);
  return rec;
}

function clearFailedLogins(email) {
  const key = normalizeEmailForGuard(email);
  const map = getLoginGuardMap();
  if (map[key]) {
    delete map[key];
    setLoginGuardMap(map);
  }
}

function formatRemainingLock(ms) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function validateStrongPassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('al menos 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('una mayúscula');
  if (!/[a-z]/.test(password)) errors.push('una minúscula');
  if (!/[0-9]/.test(password)) errors.push('un número');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('un símbolo');
  return errors;
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Supabase recovery links can return tokens in URL hash/query with type=recovery.
  // If present, force the password change screen instead of entering home directly.
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search || '');
  const flowType = hashParams.get('type') || queryParams.get('type');
  isPasswordRecoveryFlow = flowType === 'recovery';

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    if (isPasswordRecoveryFlow || !currentUser.user_metadata?.password_changed) {
      showChangePassword();
    } else {
      showHome();
    }
  } else {
    showLogin();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      isPasswordRecoveryFlow = false;
      showLogin();
    }
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecoveryFlow = true;
      currentUser = session?.user || currentUser;
      showChangePassword();
    }
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      if (isPasswordRecoveryFlow) {
        showChangePassword();
      }
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

  const rec = getLoginRecord(email);
  const now = Date.now();
  if (rec.lockUntil && rec.lockUntil > now) {
    statusEl.textContent = `Demasiados intentos fallidos. Esperá ${formatRemainingLock(rec.lockUntil - now)} antes de intentar nuevamente.`;
    statusEl.className = 'login-status error';
    return;
  }

  statusEl.textContent = 'Iniciando sesión...';
  statusEl.className = 'login-status loading';
  document.getElementById('login-btn').disabled = true;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  document.getElementById('login-btn').disabled = false;

  if (error) {
    const failRec = registerFailedLogin(email);
    if (failRec.lockUntil && failRec.lockUntil > Date.now()) {
      statusEl.textContent = `Cuenta temporalmente bloqueada por seguridad. Reintentá en ${formatRemainingLock(failRec.lockUntil - Date.now())}.`;
    } else {
      const restantes = Math.max(0, LOGIN_GUARD.maxFailedAttempts - failRec.failed);
      statusEl.textContent = `Email o contraseña incorrectos. Intentos restantes antes de bloqueo temporal: ${restantes}.`;
    }
    statusEl.className = 'login-status error';
    return;
  }

  clearFailedLogins(email);

  currentUser = data.user;
  statusEl.className = 'login-status';

  if (!currentUser.user_metadata?.password_changed) {
    showChangePassword();
  } else {
    showHome();
  }
}

function showChangePassword() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('change-password-overlay').style.display = 'flex';
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('wizard-header').style.display = 'none';
  document.getElementById('wizard-content').style.display = 'none';
  document.getElementById('wizard-footer').style.display = 'none';
}

async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById('new-password').value;
  const confirmPass = document.getElementById('confirm-password').value;
  const statusEl = document.getElementById('change-password-status');

  if (newPass !== confirmPass) {
    statusEl.textContent = 'Las contraseñas no coinciden.';
    statusEl.className = 'login-status error';
    return;
  }

  const passErrors = validateStrongPassword(newPass);
  if (passErrors.length > 0) {
    statusEl.textContent = `La contraseña debe incluir ${passErrors.join(', ')}.`;
    statusEl.className = 'login-status error';
    return;
  }

  statusEl.textContent = 'Guardando...';
  statusEl.className = 'login-status loading';
  document.getElementById('change-password-btn').disabled = true;

  const { error: passError } = await supabaseClient.auth.updateUser({ password: newPass });
  if (passError) {
    statusEl.textContent = 'Error al cambiar la contraseña. Intentá de nuevo.';
    statusEl.className = 'login-status error';
    document.getElementById('change-password-btn').disabled = false;
    return;
  }

  const { error: metaError } = await supabaseClient.auth.updateUser({
    data: { password_changed: true }
  });

  if (!metaError) {
    isPasswordRecoveryFlow = false;
    // Clean recovery params/hash after successful password change.
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  document.getElementById('change-password-btn').disabled = false;
  document.getElementById('change-password-overlay').style.display = 'none';
  showHome();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentAssessmentId = null;
  isPasswordRecoveryFlow = false;
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
  document.getElementById('change-password-overlay').style.display = 'none';
  document.getElementById('home-view').style.display = 'block';
  document.getElementById('wizard-header').style.display = 'none';
  document.getElementById('wizard-content').style.display = 'none';
  document.getElementById('wizard-footer').style.display = 'none';

  document.getElementById('user-email-display').textContent = currentUser?.email || '';
  await loadAssessmentsList();

  if (currentUser.user_metadata?.is_admin) {
    document.getElementById('admin-section').style.display = '';
    await loadAdminAssessments();
  } else {
    document.getElementById('admin-section').style.display = 'none';
  }

  initHomeTabs();
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
      : `<button class="btn-card-primary" onclick="openIndividualAiFromCard('${a.id}')">Lectura IA</button>
         <button class="btn-card-secondary" onclick="editCompletedAssessment('${a.id}')">Editar</button>
         <button class="btn-card-secondary" onclick="downloadExcelFromCloud('${a.id}')">Descargar Excel</button>
         <button class="btn-card-danger" onclick="deleteAssessment('${a.id}')">Eliminar</button>`;

    return `
      <div class="assessment-card status-${status}">
        <div class="card-distribuidor">${dashEscapeHtml(a.nombre_distribuidor || 'Sin distribuidor')}</div>
        <div class="card-meta">Fecha: ${fecha} · Actualizado: ${updated}</div>
        <div class="card-status">${status === 'borrador' ? 'En progreso' : 'Completado'}</div>
        <div class="card-actions">${actions}</div>
      </div>
    `;
  }).join('');
}

// Abre el dashboard, selecciona el distribuidor en la sub-solapa "Análisis
// Específico" y dispara la lectura ejecutiva IA. Se usa desde el botón
// "Lectura IA" de las cards de assessments completados en "Mis Assessments".
async function openIndividualAiFromCard(assessmentId) {
  try {
    switchHomeTab('dashboard');
    // switchHomeTab dispara loadDashboardData().then(renderDashboard) si no
    // estaba cargado. Esperamos a que _dashLoaded se ponga en true.
    const waitMs = 8000;
    const step = 120;
    let waited = 0;
    while (!_dashLoaded && waited < waitMs) {
      await new Promise(r => setTimeout(r, step));
      waited += step;
    }
    if (!_dashLoaded) {
      showToast('No se pudo cargar el dashboard.');
      return;
    }

    // Cambiamos a la sub-solapa Individual
    switchDashSubTab('individual');

    // Pequeña espera para que renderDashIndividual llene el select
    await new Promise(r => setTimeout(r, 60));

    const sel = document.getElementById('dash-ind-dist');
    if (!sel) return;

    // Verificamos que el ID esté en las opciones antes de setearlo
    const opt = Array.from(sel.options).find(o => o.value === assessmentId);
    if (!opt) {
      showToast('Ese distribuidor no está en el alcance actual del dashboard.');
      return;
    }
    sel.value = assessmentId;
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    // Un pequeño delay para que se renderice la card AI antes de disparar la fetch
    await new Promise(r => setTimeout(r, 120));
    // No forzamos regenerar: si hay lectura guardada vigente la usamos.
    fetchIndividualAnalysisAI(assessmentId, false);

    // Scroll a la card
    setTimeout(() => {
      document.getElementById('dash-ind-ai-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  } catch (e) {
    console.warn('openIndividualAiFromCard error:', e);
    showToast('No se pudo abrir la lectura IA.');
  }
}

// === ASSESSMENT CRUD ===
function startNewAssessment() {
  currentAssessmentId = crypto.randomUUID();
  state = { currentStep: 1, currentCategory: 0, currentPillar: 0, answers: {}, chartInstance: null, chartInstancePilares: null, vendedorNombre: currentUser?.email || '' };
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
  state.answers = migrateAnswersFormat(payload.answers || {});
  state.vendedorNombre = data.vendedor || currentUser?.email || '';
  state.currentStep = payload.currentStep || 1;
  state.currentCategory = payload.currentCategory || 0;
  state.currentPillar = (payload.currentPillar !== undefined && payload.currentPillar !== null)
    ? payload.currentPillar
    : getPilarIndexByCategoryIndex(state.currentCategory);

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
  state.answers = migrateAnswersFormat(payload.answers || {});
  state.vendedorNombre = data.vendedor || '';
  state.currentStep = 4;
  state.currentCategory = 0;
  state.currentPillar = 0;

  showWizard();
  restoreFromPayload(payload);
  initWizard();
  goToStep(4);
}

async function editCompletedAssessment(id) {
  if (!confirm('¿Querés editar este assessment? Pasará a estado borrador hasta que lo finalices nuevamente.')) return;

  const { error: updateError } = await supabaseClient.from('assessments').update({ status: 'borrador' }).eq('id', id);
  if (updateError) {
    showToast('No se pudo cambiar el estado del assessment.');
    return;
  }

  await openAssessment(id);
}

async function downloadExcelFromCloud(id) {
  const { data, error } = await supabaseClient.from('assessments').select('*').eq('id', id).single();
  if (error || !data) {
    showToast('No se pudo cargar el assessment.');
    return;
  }

  const payload = data.payload || {};
  state.answers = migrateAnswersFormat(payload.answers || {});
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
  // Al borrar cambian los KPIs de la red: invalidamos cache del dashboard.
  dashInvalidate();
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

// === ADMIN FUNCTIONS ===
let adminAssessments = [];

async function loadAdminAssessments() {
  const { data, error } = await supabaseClient.rpc('get_all_assessments');
  const container = document.getElementById('admin-content');

  const completedAssessments = (data || []).filter(a => a.status === 'completado');

  if (error || completedAssessments.length === 0) {
    container.innerHTML = '<div class="home-empty-state">No hay assessments completados de ningún usuario.</div>';
    return;
  }

  adminAssessments = completedAssessments;
  renderAdminBUs();
}

function renderAdminBUs() {
  const container = document.getElementById('admin-content');
  document.getElementById('admin-breadcrumb').innerHTML = '';

  const buGroups = {};
  adminAssessments.forEach(a => {
    const bu = a.bu || 'Sin BU';
    if (!buGroups[bu]) buGroups[bu] = [];
    buGroups[bu].push(a);
  });

  const buOrder = ['Norte', 'Centro', 'Sur'];
  const sortedBUs = buOrder.filter(b => buGroups[b]).concat(
    Object.keys(buGroups).filter(b => !buOrder.includes(b))
  );

  container.innerHTML = `<div class="admin-grid">${sortedBUs.map(bu => `
    <div class="admin-bu-card" onclick="navigateAdmin('${dashEscapeHtml(bu)}')">
      <div class="admin-bu-name">${dashEscapeHtml(bu)}</div>
      <div class="admin-bu-count">${buGroups[bu].length} assessment${buGroups[bu].length !== 1 ? 's' : ''}</div>
      <button class="btn-card-secondary" onclick="event.stopPropagation(); downloadBUZip('${dashEscapeHtml(bu)}')">Descargar BU (ZIP)</button>
    </div>
  `).join('')}</div>`;
}

function renderAdminSquads(bu) {
  const container = document.getElementById('admin-content');
  document.getElementById('admin-breadcrumb').innerHTML = `
    <span class="breadcrumb-link" onclick="renderAdminBUs()">Admin</span> &gt; <span class="breadcrumb-current">${dashEscapeHtml(bu)}</span>
  `;

  const filtered = adminAssessments.filter(a => a.bu === bu);
  const squadGroups = {};
  filtered.forEach(a => {
    const squad = a.squad || 'Sin Squad';
    if (!squadGroups[squad]) squadGroups[squad] = [];
    squadGroups[squad].push(a);
  });

  const sortedSquads = Object.keys(squadGroups).sort();

  container.innerHTML = `<div class="admin-grid">${sortedSquads.map(squad => `
    <div class="admin-bu-card" onclick="navigateAdmin('${dashEscapeHtml(bu)}', '${dashEscapeHtml(squad)}')">
      <div class="admin-bu-name">${dashEscapeHtml(squad)}</div>
      <div class="admin-bu-count">${squadGroups[squad].length} assessment${squadGroups[squad].length !== 1 ? 's' : ''}</div>
      <button class="btn-card-secondary" onclick="event.stopPropagation(); downloadSquadZip('${dashEscapeHtml(bu)}', '${dashEscapeHtml(squad)}')">Descargar Squad (ZIP)</button>
    </div>
  `).join('')}</div>`;
}

function renderAdminAssessments(bu, squad) {
  const container = document.getElementById('admin-content');
  document.getElementById('admin-breadcrumb').innerHTML = `
    <span class="breadcrumb-link" onclick="renderAdminBUs()">Admin</span> &gt;
    <span class="breadcrumb-link" onclick="renderAdminSquads('${dashEscapeHtml(bu)}')">${dashEscapeHtml(bu)}</span> &gt;
    <span class="breadcrumb-current">${dashEscapeHtml(squad)}</span>
  `;

  const filtered = adminAssessments.filter(a => a.bu === bu && a.squad === squad);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="home-empty-state">No hay assessments en este squad.</div>';
    return;
  }

  container.innerHTML = `<div class="assessment-cards">${filtered.map(a => {
    const fecha = a.fecha ? new Date(a.fecha).toLocaleDateString('es-AR') : 'Sin fecha';
    const updated = new Date(a.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="assessment-card status-completado">
        <div class="card-user-email">${dashEscapeHtml(a.user_email)}</div>
        <div class="card-distribuidor">${dashEscapeHtml(a.nombre_distribuidor || 'Sin distribuidor')}</div>
        <div class="card-meta">Fecha: ${fecha} · Actualizado: ${updated}</div>
        <div class="card-actions">
          <button class="btn-card-secondary" onclick="downloadExcelAdmin('${a.id}')">Descargar Excel</button>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function navigateAdmin(bu, squad) {
  if (squad) {
    renderAdminAssessments(bu, squad);
  } else {
    renderAdminSquads(bu);
  }
}

async function downloadExcelAdmin(id) {
  const assessment = adminAssessments.find(a => a.id === id);
  if (!assessment) {
    showToast('Assessment no encontrado.');
    return;
  }
  const { buffer, filename } = await generateExcelBuffer(assessment);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Excel descargado.');
}

async function downloadAllAdminZip() {
  if (adminAssessments.length === 0) { showToast('No hay assessments.'); return; }
  showToast('Generando ZIP con todos los assessments...');
  const zip = new JSZip();

  for (const a of adminAssessments) {
    const { buffer, filename } = await generateExcelBuffer(a);
    const bu = (a.bu || 'Sin_BU').replace(/[\/\\]/g, '-');
    const squad = (a.squad || 'Sin_Squad').replace(/[\/\\]/g, '-');
    zip.file(`${bu}/${squad}/${filename}`, buffer);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Assessments_Todos.zip';
  link.click();
  URL.revokeObjectURL(url);
  showToast('ZIP descargado.');
}

async function downloadBUZip(bu) {
  const filtered = adminAssessments.filter(a => a.bu === bu);
  if (filtered.length === 0) { showToast('No hay assessments en esta BU.'); return; }
  showToast(`Generando ZIP de ${bu}...`);
  const zip = new JSZip();

  for (const a of filtered) {
    const { buffer, filename } = await generateExcelBuffer(a);
    const squad = (a.squad || 'Sin_Squad').replace(/[\/\\]/g, '-');
    zip.file(`${squad}/${filename}`, buffer);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Assessments_${bu}.zip`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('ZIP descargado.');
}

async function downloadSquadZip(bu, squad) {
  const filtered = adminAssessments.filter(a => a.bu === bu && a.squad === squad);
  if (filtered.length === 0) { showToast('No hay assessments en este squad.'); return; }
  showToast(`Generando ZIP de ${squad}...`);
  const zip = new JSZip();

  for (const a of filtered) {
    const { buffer, filename } = await generateExcelBuffer(a);
    zip.file(filename, buffer);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Assessments_${bu}_${squad}.zip`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('ZIP descargado.');
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
  // Ensure currentPillar is consistent with currentCategory
  const derivedPilar = getPilarIndexByCategoryIndex(state.currentCategory);
  if (state.currentPillar === undefined || state.currentPillar === null) {
    state.currentPillar = derivedPilar;
  }
  // If currentCategory does not belong to currentPillar, sync it
  const catsForPilar = getCategoriesForPilar(state.currentPillar);
  if (!catsForPilar.includes(state.currentCategory)) {
    state.currentPillar = derivedPilar;
  }
  renderPilarTabs();
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
  if (payload.answers) state.answers = migrateAnswersFormat(payload.answers);
  if (payload.currentCategory !== undefined && payload.currentCategory !== null) {
    state.currentCategory = payload.currentCategory;
  }
  if (payload.currentPillar !== undefined && payload.currentPillar !== null) {
    state.currentPillar = payload.currentPillar;
  } else {
    state.currentPillar = getPilarIndexByCategoryIndex(state.currentCategory || 0);
  }
}

async function goBackToHome() {
  if (currentAssessmentId) {
    clearTimeout(syncTimer);
    await syncToSupabase();
  }
  currentAssessmentId = null;
  state = { currentStep: 1, currentCategory: 0, currentPillar: 0, answers: {}, chartInstance: null, chartInstancePilares: null, vendedorNombre: '' };
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
    currentCategory: state.currentCategory,
    currentPillar: state.currentPillar,
    currentStep: state.currentStep,
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
    if (data.answers) state.answers = migrateAnswersFormat(data.answers);
    if (data.currentCategory !== undefined && data.currentCategory !== null) {
      state.currentCategory = data.currentCategory;
    }
    if (data.currentPillar !== undefined && data.currentPillar !== null) {
      state.currentPillar = data.currentPillar;
    } else {
      state.currentPillar = getPilarIndexByCategoryIndex(state.currentCategory || 0);
    }
    if (data.currentStep !== undefined && data.currentStep !== null) {
      state.currentStep = data.currentStep;
    }
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
    currentPillar: state.currentPillar,
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
    // Guardar un borrador cambia el estado de la red: invalidamos cache del
    // dashboard para que al volver a abrirlo se traigan los datos frescos.
    dashInvalidate();
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

// === PILAR TABS & CATEGORY TABS ===
function computePilarProgress(pilarIndex) {
  const catIndexes = getCategoriesForPilar(pilarIndex);
  let totalQ = 0, answeredQ = 0;
  let completeCats = 0;
  catIndexes.forEach(ci => {
    const cat = ASSESSMENT_DATA.categories[ci];
    const ans = cat.questions.filter(q => isQuestionFullyAnswered(q)).length;
    totalQ += cat.questions.length;
    answeredQ += ans;
    if (ans === cat.questions.length) completeCats++;
  });
  return {
    totalCats: catIndexes.length,
    completeCats,
    totalQ,
    answeredQ,
    percent: totalQ === 0 ? 0 : (answeredQ / totalQ) * 100
  };
}

function renderPilarTabs() {
  const container = document.getElementById('pilar-tabs');
  if (!container) return;
  container.innerHTML = PILARES.map((p, i) => {
    const prog = computePilarProgress(i);
    const isActive = i === state.currentPillar ? 'active' : '';
    const isComplete = prog.answeredQ === prog.totalQ && prog.totalQ > 0 ? 'complete' : '';
    const borderColor = p.color;
    return `
      <div class="pilar-tab ${isActive} ${isComplete}" onclick="switchPilar(${i})" title="${p.name}" style="border-left-color:${borderColor}; ${i === state.currentPillar ? `border-color:${borderColor};` : ''}">
        <div class="pilar-tab-name">${i + 1}. ${p.name}</div>
        <div class="pilar-tab-meta">${prog.completeCats}/${prog.totalCats} competencias · ${Math.round(prog.percent)}%</div>
        <div class="pilar-tab-bar"><div class="pilar-tab-bar-fill" style="width:${prog.percent}%; background:${borderColor};"></div></div>
      </div>
    `;
  }).join('');

  const contextEl = document.getElementById('pilar-context');
  if (contextEl) {
    const p = PILARES[state.currentPillar];
    contextEl.innerHTML = p ? `<strong>Pilar activo:</strong> ${p.name}` : '';
    contextEl.style.borderLeftColor = p ? p.color : '';
  }
}

function switchPilar(pIndex) {
  if (pIndex === state.currentPillar) return;
  saveToStorage();
  state.currentPillar = pIndex;
  const cats = getCategoriesForPilar(pIndex);
  state.currentCategory = cats[0] !== undefined ? cats[0] : 0;
  renderPilarTabs();
  renderCategoryTabs();
  renderQuestions(state.currentCategory);
  window.scrollTo(0, 0);
}

function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  const catIndexes = getCategoriesForPilar(state.currentPillar);
  container.innerHTML = catIndexes.map((globalIdx, localIdx) => {
    const cat = ASSESSMENT_DATA.categories[globalIdx];
    const shortName = cat.name.length > 25 ? cat.name.substring(0, 22) + '...' : cat.name;
    const active = globalIdx === state.currentCategory ? 'active' : '';
    const answered = cat.questions.filter(q => isQuestionFullyAnswered(q)).length;
    let statusClass = '';
    if (answered === cat.questions.length) statusClass = 'complete';
    else if (answered > 0) statusClass = 'has-answers';
    return `<div class="category-tab ${active} ${statusClass}" onclick="switchCategory(${globalIdx})" title="${cat.name}">${localIdx + 1}. ${shortName}</div>`;
  }).join('');
}

function switchCategory(index) {
  saveToStorage();
  state.currentCategory = index;
  // Ensure pilar consistency
  const derivedPilar = getPilarIndexByCategoryIndex(index);
  if (derivedPilar !== state.currentPillar) {
    state.currentPillar = derivedPilar;
    renderPilarTabs();
  }
  renderCategoryTabs();
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
  return !!(answer && answer.value);
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
    const currentValue = answer.value || '';

    const preguntasHtml = subQs.map(sq => `<li>${sq}</li>`).join('');

    return `
      <div class="question-card ${isAnswered}" id="card-${q.id}">
        <div class="question-header">
          <span class="question-number">${q.id}</span>
          <span class="question-aspecto">${q.aspecto}</span>
        </div>
        <div class="preguntas-disparadoras">
          <ul>${preguntasHtml}</ul>
        </div>
        <div class="rating-options rating-options-block">
          <div class="rating-option bajo">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_bajo" value="bajo" ${currentValue === 'bajo' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'bajo')">
            <label for="q_${q.id}_bajo">Bajo - 0%</label>
          </div>
          <div class="rating-option mediano">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_mediano" value="mediano" ${currentValue === 'mediano' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'mediano')">
            <label for="q_${q.id}_mediano">Mediano - 50%</label>
          </div>
          <div class="rating-option alto">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_alto" value="alto" ${currentValue === 'alto' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'alto')">
            <label for="q_${q.id}_alto">Alto - 100%</label>
          </div>
        </div>
        <div class="level-descriptions">
          <button class="level-toggle" onclick="toggleDetails('${q.id}')">Ver criterios de evaluación</button>
          <div class="level-details" id="details-${q.id}">
            ${renderLevelDetails(q)}
          </div>
        </div>
        <div class="obs-label">Observaciones generales</div>
        <textarea placeholder="Observaciones opcionales para esta sección..." onblur="setObservation('${q.id}', this.value)">${dashEscapeHtml(answer.observaciones || '')}</textarea>
      </div>
    `;
  }).join('');

  const pilarCatIndexes = getCategoriesForPilar(state.currentPillar);
  const currentPos = pilarCatIndexes.indexOf(catIndex);
  const isFirstGlobal = state.currentPillar === 0 && currentPos === 0;
  const isLastGlobal = state.currentPillar === PILARES.length - 1 && currentPos === pilarCatIndexes.length - 1;
  const prevDisabled = isFirstGlobal ? 'disabled' : '';
  const nextLabel = isLastGlobal ? 'Ver Resultados →' : 'Siguiente Competencia →';
  container.innerHTML += `
    <div class="category-nav-buttons">
      <button type="button" class="btn-secondary" ${prevDisabled} onclick="navCategory(-1)">← Competencia Anterior</button>
      <button type="button" class="btn-primary" onclick="navCategory(1)">${nextLabel}</button>
    </div>
  `;
}

function navCategory(direction) {
  const pilarCatIndexes = getCategoriesForPilar(state.currentPillar);
  const currentPos = pilarCatIndexes.indexOf(state.currentCategory);
  const nextPos = currentPos + direction;

  if (nextPos >= 0 && nextPos < pilarCatIndexes.length) {
    switchCategory(pilarCatIndexes[nextPos]);
    window.scrollTo(0, 0);
    return;
  }

  const nextPilar = state.currentPillar + direction;
  if (nextPilar >= 0 && nextPilar < PILARES.length) {
    saveToStorage();
    state.currentPillar = nextPilar;
    const nextCats = getCategoriesForPilar(nextPilar);
    state.currentCategory = direction > 0 ? nextCats[0] : nextCats[nextCats.length - 1];
    renderPilarTabs();
    renderCategoryTabs();
    renderQuestions(state.currentCategory);
    window.scrollTo(0, 0);
    return;
  }

  if (direction > 0) nextStep();
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

function setAnswer(qId, value) {
  if (!state.answers[qId]) state.answers[qId] = {};
  state.answers[qId].value = value;

  document.getElementById(`card-${qId}`).classList.add('answered');
  updateCategoryProgress();
  renderPilarTabs();
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

  renderCategoryTabs();
  renderPilarTabs();
}

function migrateAnswersFormat(answers) {
  if (!answers) return {};
  Object.keys(answers).forEach(qId => {
    const a = answers[qId];
    if (a.sub && !a.value) {
      const values = Object.values(a.sub).map(v => v === 'alto' ? 1.0 : v === 'mediano' ? 0.5 : 0);
      if (values.length > 0) {
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        a.value = avg >= 0.75 ? 'alto' : avg >= 0.25 ? 'mediano' : 'bajo';
      }
      delete a.sub;
    }
  });
  return answers;
}

// === CALCULATIONS ===
function formatCriteriaText(level) {
  if (!level) return '';
  let text = level.titulo;
  if (level.detalles && level.detalles.length > 0) {
    text += '\n' + level.detalles.map(d => '• ' + d).join('\n');
  }
  return text;
}

function getCalificacionValue(calificacion) {
  if (calificacion === 'alto') return 1.0;
  if (calificacion === 'mediano') return 0.5;
  return 0;
}

function getQuestionAverage(q) {
  const answer = state.answers[q.id];
  if (!answer?.value) return 0;
  return getCalificacionValue(answer.value);
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

function calculatePilarResults(baseResults) {
  const results = baseResults || calculateResults();
  const pilarRows = PILARES.map(pilar => {
    const cats = ASSESSMENT_DATA.categories.filter(c => pilar.categoryKeys.includes(c.key));
    const catNames = cats.map(c => c.name);
    const matched = results.categorias.filter(r => catNames.includes(r.name));
    const pesoPilar = cats.reduce((s, c) => s + (c.weightTotal || 0), 0);
    const contribucionTotal = matched.reduce((s, r) => s + (r.scoreTotal || 0), 0);
    const scorePilar = pesoPilar > 0 ? contribucionTotal / pesoPilar : 0;
    return {
      key: pilar.key,
      name: pilar.name,
      color: pilar.color,
      colorRgba: pilar.colorRgba,
      pesoPilar,
      contribucionTotal,
      scorePilar
    };
  });
  return pilarRows;
}

// === RESULTS RENDERING ===
function renderResults() {
  const datos = getDatosValues();
  const esc = dashEscapeHtml;
  const zonasList = Array.isArray(datos.zonas_atendidas) ? datos.zonas_atendidas.join(', ') : (datos.zonas_atendidas || '-');
  document.getElementById('results-header').innerHTML = `
    <p><strong>Distribuidor:</strong> ${esc(datos.nombre_distribuidor || '-')} | <strong>CUIT:</strong> ${esc(datos.cuit || '-')}</p>
    <p><strong>BU:</strong> ${esc(datos.region || '-')} | <strong>Squad:</strong> ${esc(datos.squad || '-')}</p>
    <p><strong>Zonas:</strong> ${esc(zonasList)} | <strong>Fecha:</strong> ${esc(datos.fecha || '-')}</p>
  `;

  const results = calculateResults();
  const pilarResults = calculatePilarResults(results);
  document.getElementById('results-score').innerHTML = `
    <div class="score-label">Puntuación Total del Assessment</div>
    <div class="score-value">${Math.round(results.totalGeneral * 100)}%</div>
  `;

  const pilarBody = document.querySelector('#results-pilares-table tbody');
  pilarBody.innerHTML = pilarResults.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${Math.round(r.pesoPilar * 100)}%</td>
      <td>${Math.round(r.scorePilar * 100)}%</td>
      <td>${Math.round(r.contribucionTotal * 100)}%</td>
    </tr>
  `).join('') + `
    <tr>
      <td>TOTAL</td>
      <td>${Math.round(pilarResults.reduce((s, p) => s + p.pesoPilar, 0) * 100)}%</td>
      <td>—</td>
      <td>${Math.round(pilarResults.reduce((s, p) => s + p.contribucionTotal, 0) * 100)}%</td>
    </tr>
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

  renderRadarChartPilares(pilarResults);
  renderRadarChart(results);
}

function renderRadarChartPilares(pilarResults) {
  const canvas = document.getElementById('radarChartPilares');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (state.chartInstancePilares) state.chartInstancePilares.destroy();

  state.chartInstancePilares = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: pilarResults.map(r => r.name.length > 22 ? r.name.substring(0, 20) + '...' : r.name),
      datasets: [{
        label: 'Calificación por Pilar',
        data: pilarResults.map(r => r.scorePilar),
        backgroundColor: 'rgba(0, 145, 223, 0.18)',
        borderColor: 'rgb(0, 145, 223)',
        borderWidth: 2,
        pointBackgroundColor: pilarResults.map(r => r.color),
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
        backgroundColor: 'rgba(102, 181, 18, 0.20)',
        borderColor: 'rgb(102, 181, 18)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(16, 56, 79)',
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
  const pilarResults = calculatePilarResults(results);
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
    ['Vendedor', state.vendedorNombre || ''],
    ['Usuario', currentUser?.email || '']
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
      if (typeof f[1] === 'number' || (typeof f[1] === 'string' && /^\d+$/.test(f[1]) && f[1].length > 0)) {
        r.getCell(2).value = Number(f[1]);
        r.getCell(2).numFmt = '#,##0';
      }
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

  // --- SOLAPA 3: Assessment (Competencias) ---
  const wsAssess = wb.addWorksheet('Assessment');
  wsAssess.columns = [
    { width: 5 },   // A: #
    { width: 18 },  // B: Aspecto a evaluar
    { width: 40 },  // C: Pregunta
    { width: 14 },  // D: Calificación
    { width: 30 },  // E: Observaciones
    { width: 40 },  // F: Bajo - 0%
    { width: 40 },  // G: Mediano - 50%
    { width: 40 },  // H: Alto - 100%
    { width: 12 },  // I: Ponderación total
    { width: 12 },  // J: Ponderación competencia
    { width: 12 },  // K: Calif. ponderada sección
    { width: 12 }   // L: Calif. ponderada total
  ];
  wsAssess.views = [{ showGridLines: false }];

  const catHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00824B' } };
  const catHeaderFont = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  const colHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
  const colHeaderFont = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };

  PILARES.forEach((pilar, pIdx) => {
    const pilarRow = wsAssess.addRow([`${pIdx + 1}`, `PILAR: ${pilar.name.toUpperCase()}`, '', '', '', '', '', '', '', '', '', '']);
    pilarRow.eachCell(cell => { cell.font = { ...catHeaderFont, size: 12 }; cell.fill = headerFill; cell.border = borders; });
    wsAssess.mergeCells(pilarRow.number, 2, pilarRow.number, 12);

    const cats = pilar.categoryKeys
      .map(k => ASSESSMENT_DATA.categories.find(c => c.key === k))
      .filter(Boolean);

    cats.forEach((cat, catIdx) => {
      // Category header row
      const catRow = wsAssess.addRow([`${catIdx + 1}`, cat.name.toUpperCase(), '', '', '', '', '', '', '', '', '', '']);
      catRow.eachCell(cell => { cell.font = catHeaderFont; cell.fill = catHeaderFill; cell.border = borders; });
      wsAssess.mergeCells(catRow.number, 2, catRow.number, 12);

      // Column headers row
      const colHdr = wsAssess.addRow(['#', 'Aspecto a evaluar', 'Pregunta', 'Calificación', 'Observaciones', 'Bajo - 0%', 'Mediano - 50%', 'Alto - 100%', 'Ponderación total', 'Ponderación competencia', 'Calificación ponderada sección', 'Calificación ponderada total']);
      colHdr.eachCell(cell => { cell.font = colHeaderFont; cell.fill = colHeaderFill; cell.border = borders; cell.alignment = { wrapText: true, vertical: 'middle' }; });

      // Data rows
      cat.questions.forEach(q => {
        const answer = state.answers[q.id] || {};
        const val = answer.value ? getCalificacionValue(answer.value) : null;
        const calLabel = answer.value ? (answer.value === 'bajo' ? 'Bajo - 0%' : answer.value === 'mediano' ? 'Mediano - 50%' : 'Alto - 100%') : '';
        const pondTotal = q.ponderacionTotal;
        const pondComp = q.ponderacionCompetencia;
        const califPondSeccion = val !== null ? val * pondComp : '';
        const califPondTotal = val !== null ? val * pondTotal : '';

        const r = wsAssess.addRow([
          q.id,
          q.aspecto,
          q.pregunta.replace(/\n/g, '\n'),
          calLabel,
          answer.observaciones || '',
          formatCriteriaText(q.bajo),
          formatCriteriaText(q.mediano),
          formatCriteriaText(q.alto),
          pondTotal,
          pondComp,
          califPondSeccion,
          califPondTotal
        ]);

        r.eachCell(cell => { cell.border = borders; cell.alignment = { wrapText: true, vertical: 'top' }; });
        r.getCell(1).font = { bold: true };
        r.getCell(2).font = { bold: true };
        r.getCell(9).numFmt = '0%';
        r.getCell(10).numFmt = '0%';
        if (califPondSeccion !== '') r.getCell(11).numFmt = '0%';
        if (califPondTotal !== '') r.getCell(12).numFmt = '0%';

        if (answer.value === 'bajo') r.getCell(4).font = { color: { argb: 'FFE53935' }, bold: true };
        else if (answer.value === 'mediano') r.getCell(4).font = { color: { argb: 'FFFB8C00' }, bold: true };
        else if (answer.value === 'alto') r.getCell(4).font = { color: { argb: 'FF43A047' }, bold: true };
      });

      wsAssess.addRow([]);
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

  wsRes.addRow([]);
  const pTitle = wsRes.addRow(['RESULTADOS POR PILAR', '', '']);
  pTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0068B4' } };
  wsRes.addRow([]);
  const pHdr = wsRes.addRow(['Pilar', 'Peso', 'Score del Pilar']);
  pHdr.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  pilarResults.forEach((r, i) => {
    const row = wsRes.addRow([r.name, r.pesoPilar, r.scorePilar]);
    row.eachCell(cell => { cell.border = borders; });
    row.getCell(2).numFmt = '0%';
    row.getCell(3).numFmt = '0%';
    if (i % 2 === 0) row.getCell(1).fill = lightFill;
  });

  const pTotalRow = wsRes.addRow([
    'TOTAL PILARES',
    pilarResults.reduce((s, p) => s + p.pesoPilar, 0),
    ''
  ]);
  pTotalRow.getCell(1).font = { bold: true };
  pTotalRow.getCell(2).font = { bold: true };
  pTotalRow.getCell(2).numFmt = '0%';
  pTotalRow.eachCell(cell => { cell.border = borders; });

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

  const radarPilarCanvas = document.getElementById('radarChartPilares');
  if (radarPilarCanvas) {
    try {
      const radarBase64 = radarPilarCanvas.toDataURL('image/png').split(',')[1];
      const imageId = wb.addImage({ base64: radarBase64, extension: 'png' });
      const chartStartRow = wsRes.rowCount + 2;
      wsRes.addImage(imageId, {
        tl: { col: 8, row: chartStartRow - 1 },
        ext: { width: 420, height: 420 }
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

async function generateExcelBuffer(assessment) {
  const payload = assessment.payload || {};
  const datos = payload.datos || {};
  const porte = payload.porte || {};
  const answers = migrateAnswersFormat(payload.answers || {});
  const userEmail = assessment.user_email || assessment.vendedor || '';

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
    ['Vendedor', assessment.vendedor || ''],
    ['Usuario', userEmail]
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

  function addPorteSectionBuf(title, fields) {
    const titleRow = wsPorte.addRow([title]);
    titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
    wsPorte.addRow([]);
    const hdr = wsPorte.addRow(['Campo', 'Valor']);
    hdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
    fields.forEach(f => {
      const r = wsPorte.addRow(f);
      r.eachCell(cell => { cell.border = borders; });
      if (typeof f[1] === 'number' || (typeof f[1] === 'string' && /^\d+$/.test(f[1]) && f[1].length > 0)) {
        r.getCell(2).value = Number(f[1]);
        r.getCell(2).numFmt = '#,##0';
      }
    });
    wsPorte.addRow([]);
  }

  addPorteSectionBuf('Performance', [
    ['Facturación total 2025 (USD)', porte.facturacion_total || ''],
    ['% Representatividad Bayer', porte.representatividad_bayer || ''],
    ['Facturación total Agrobayer 2025 (USD)', porte.facturacion_bayer || '']
  ]);
  addPorteSectionBuf('Clientes', [
    ['Cantidad total de clientes', porte.total_clientes || ''],
    ['Cantidad clientes con Bayer', porte.clientes_bayer || '']
  ]);
  const empleadosFields = [
    ['Cantidad Gerentes', porte.empleados_gerentes || ''],
    ['Cantidad Administrativos', porte.empleados_admin || ''],
    ['Cantidad Asesores', porte.empleados_asesores || '']
  ];
  if (porte.otras_areas && porte.otras_areas.length > 0) {
    porte.otras_areas.forEach(a => { empleadosFields.push([a.nombre || 'Otra área', a.cantidad || '']); });
  }
  addPorteSectionBuf('Empleados', empleadosFields);
  addPorteSectionBuf('Flota', [
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

  const depTitleRow = wsPorte.addRow(['Depósitos']);
  depTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
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

  const pvTitleRow = wsPorte.addRow(['Puntos de Venta']);
  pvTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  const pvHdr = wsPorte.addRow(['Tipo', 'Dirección', 'Cantidad Empleados']);
  pvHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.puntos_venta && porte.puntos_venta.length > 0) {
    porte.puntos_venta.forEach(pv => {
      const r = wsPorte.addRow([pv.tipo || '', pv.direccion || '', pv.empleados || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }

  // --- SOLAPA 3: Assessment (Competencias) ---
  const wsAssess = wb.addWorksheet('Assessment');
  wsAssess.columns = [
    { width: 5 },   // A: #
    { width: 18 },  // B: Aspecto a evaluar
    { width: 40 },  // C: Pregunta
    { width: 14 },  // D: Calificación
    { width: 30 },  // E: Observaciones
    { width: 40 },  // F: Bajo - 0%
    { width: 40 },  // G: Mediano - 50%
    { width: 40 },  // H: Alto - 100%
    { width: 12 },  // I: Ponderación total
    { width: 12 },  // J: Ponderación competencia
    { width: 12 },  // K: Calif. ponderada sección
    { width: 12 }   // L: Calif. ponderada total
  ];
  wsAssess.views = [{ showGridLines: false }];

  const catHeaderFillBuf = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00824B' } };
  const catHeaderFontBuf = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  const colHeaderFillBuf = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
  const colHeaderFontBuf = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };

  PILARES.forEach((pilar, pIdx) => {
    const pilarRow = wsAssess.addRow([`${pIdx + 1}`, `PILAR: ${pilar.name.toUpperCase()}`, '', '', '', '', '', '', '', '', '', '']);
    pilarRow.eachCell(cell => { cell.font = { ...catHeaderFontBuf, size: 12 }; cell.fill = headerFill; cell.border = borders; });
    wsAssess.mergeCells(pilarRow.number, 2, pilarRow.number, 12);

    const cats = pilar.categoryKeys
      .map(k => ASSESSMENT_DATA.categories.find(c => c.key === k))
      .filter(Boolean);

    cats.forEach((cat, catIdx) => {
      const catRow = wsAssess.addRow([`${catIdx + 1}`, cat.name.toUpperCase(), '', '', '', '', '', '', '', '', '', '']);
      catRow.eachCell(cell => { cell.font = catHeaderFontBuf; cell.fill = catHeaderFillBuf; cell.border = borders; });
      wsAssess.mergeCells(catRow.number, 2, catRow.number, 12);

      const colHdr = wsAssess.addRow(['#', 'Aspecto a evaluar', 'Pregunta', 'Calificación', 'Observaciones', 'Bajo - 0%', 'Mediano - 50%', 'Alto - 100%', 'Ponderación total', 'Ponderación competencia', 'Calificación ponderada sección', 'Calificación ponderada total']);
      colHdr.eachCell(cell => { cell.font = colHeaderFontBuf; cell.fill = colHeaderFillBuf; cell.border = borders; cell.alignment = { wrapText: true, vertical: 'middle' }; });

      cat.questions.forEach(q => {
        const answer = answers[q.id] || {};
        const val = answer.value ? getCalificacionValue(answer.value) : null;
        const calLabel = answer.value ? (answer.value === 'bajo' ? 'Bajo - 0%' : answer.value === 'mediano' ? 'Mediano - 50%' : 'Alto - 100%') : '';
        const pondTotal = q.ponderacionTotal;
        const pondComp = q.ponderacionCompetencia;
        const califPondSeccion = val !== null ? val * pondComp : '';
        const califPondTotal = val !== null ? val * pondTotal : '';

        const r = wsAssess.addRow([
          q.id,
          q.aspecto,
          q.pregunta.replace(/\n/g, '\n'),
          calLabel,
          answer.observaciones || '',
          formatCriteriaText(q.bajo),
          formatCriteriaText(q.mediano),
          formatCriteriaText(q.alto),
          pondTotal,
          pondComp,
          califPondSeccion,
          califPondTotal
        ]);

        r.eachCell(cell => { cell.border = borders; cell.alignment = { wrapText: true, vertical: 'top' }; });
        r.getCell(1).font = { bold: true };
        r.getCell(2).font = { bold: true };
        r.getCell(9).numFmt = '0%';
        r.getCell(10).numFmt = '0%';
        if (califPondSeccion !== '') r.getCell(11).numFmt = '0%';
        if (califPondTotal !== '') r.getCell(12).numFmt = '0%';

        if (answer.value === 'bajo') r.getCell(4).font = { color: { argb: 'FFE53935' }, bold: true };
        else if (answer.value === 'mediano') r.getCell(4).font = { color: { argb: 'FFFB8C00' }, bold: true };
        else if (answer.value === 'alto') r.getCell(4).font = { color: { argb: 'FF43A047' }, bold: true };
      });

      wsAssess.addRow([]);
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

  const bufResults = calculateResultsFromAnswers(answers);
  bufResults.categorias.forEach((r, i) => {
    const row = wsRes.addRow([r.name, r.scoreTotal, r.scoreCategoria]);
    row.eachCell(cell => { cell.border = borders; });
    row.getCell(2).numFmt = '0%';
    row.getCell(3).numFmt = '0%';
    if (i % 2 === 0) row.getCell(1).fill = lightFill;
  });

  wsRes.addRow([]);
  const totalRow = wsRes.addRow(['TOTAL GENERAL', bufResults.totalGeneral, '']);
  totalRow.getCell(1).font = { bold: true, size: 12 };
  totalRow.getCell(2).font = { bold: true, size: 12 };
  totalRow.getCell(2).numFmt = '0%';
  totalRow.eachCell(cell => { cell.border = borders; });
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };

  const bufPilarResults = calculatePilarResults(bufResults);
  wsRes.addRow([]);
  const pTitle = wsRes.addRow(['RESULTADOS POR PILAR', '', '']);
  pTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0068B4' } };
  wsRes.addRow([]);
  const pHdr = wsRes.addRow(['Pilar', 'Peso', 'Score del Pilar']);
  pHdr.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  bufPilarResults.forEach((r, i) => {
    const row = wsRes.addRow([r.name, r.pesoPilar, r.scorePilar]);
    row.eachCell(cell => { cell.border = borders; });
    row.getCell(2).numFmt = '0%';
    row.getCell(3).numFmt = '0%';
    if (i % 2 === 0) row.getCell(1).fill = lightFill;
  });

  const pTotalRow = wsRes.addRow(['TOTAL PILARES', bufPilarResults.reduce((s, p) => s + p.pesoPilar, 0), '']);
  pTotalRow.getCell(1).font = { bold: true };
  pTotalRow.getCell(2).font = { bold: true };
  pTotalRow.getCell(2).numFmt = '0%';
  pTotalRow.eachCell(cell => { cell.border = borders; });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `Assessment_${(datos.nombre_distribuidor || 'sin_nombre').replace(/\s+/g, '_')}_${datos.fecha || 'sin_fecha'}.xlsx`;
  return { buffer, filename };
}

function calculateResultsFromAnswers(answers) {
  const results = ASSESSMENT_DATA.categories.map(cat => {
    let scoreSeccion = 0;
    let scoreTotal = 0;
    cat.questions.forEach(q => {
      const answer = answers[q.id] || {};
      const val = answer.value ? getCalificacionValue(answer.value) : 0;
      scoreTotal += val * q.ponderacionTotal;
      scoreSeccion += val * q.ponderacionCompetencia;
    });
    return { name: cat.name, scoreTotal, scoreCategoria: scoreSeccion };
  });
  const totalGeneral = results.reduce((sum, r) => sum + r.scoreTotal, 0);
  return { categorias: results, totalGeneral };
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
    currentPillar: state.currentPillar,
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
    // Finalizar un assessment recalcula todos los KPIs de red: invalidamos
    // el cache del dashboard para que al volver se refresque sin tocar el botón.
    dashInvalidate();
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
        <td><input type="text" value="${dashEscapeHtml(p.nombre || '')}"></td>
        <td><input type="number" step="any" value="${dashEscapeHtml(p.pctVentas || '')}"></td>
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
        <td><input type="text" value="${dashEscapeHtml(d.direccion || '')}"></td>
        <td><input type="number" step="any" value="${dashEscapeHtml(d.tamanoM2 || '')}"></td>
        <td><input type="number" value="${dashEscapeHtml(d.empleados || '')}"></td>
        <td><input type="text" placeholder="Ej: Lun-Vie 8 a 17" value="${dashEscapeHtml(d.horario || '')}"></td>
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
        <td><input type="text" value="${dashEscapeHtml(pv.direccion || '')}"></td>
        <td><input type="number" min="0" value="${dashEscapeHtml(pv.empleados || '')}"></td>
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
    <input type="text" class="zona-input" placeholder="Nombre del área" value="${dashEscapeHtml(nombre || '')}">
    <input type="number" class="zona-input" style="max-width:100px" placeholder="Cantidad" min="0" value="${dashEscapeHtml(cantidad || '')}">
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

// === DASHBOARD TAB MODULE ===

const DASH_CATEGORY_ORDER = [
  "Visión Estratégica/Gerencial",
  "Cobertura y Acceso al Mercado",
  "Gestión Comercial y Estructura",
  "Generación de Demanda y Gestión de Portafólio",
  "Recursos Humanos",
  "Competencia Financiera",
  "Digitalización",
  "Logística y Operaciones",
  "Seguridad, Higiene y Sustentabilidad"
];

const DASH_CATEGORY_LABEL_SHORT = {
  "Visión Estratégica/Gerencial": "Visión Estratégica / Gerencial",
  "Cobertura y Acceso al Mercado": "Cobertura y Acceso al Mercado",
  "Gestión Comercial y Estructura": "Gestión Comercial y Estructura",
  "Generación de Demanda y Gestión de Portafólio": "Generación de Demanda y Portfolio",
  "Recursos Humanos": "Recursos Humanos",
  "Competencia Financiera": "Competencia Financiera",
  "Digitalización": "Digitalización",
  "Logística y Operaciones": "Logística y Operaciones",
  "Seguridad, Higiene y Sustentabilidad": "Seguridad, Higiene y Sust."
};

const DASH_CATEGORY_RADAR_LABEL = {
  "Visión Estratégica/Gerencial": "Gerencial",
  "Cobertura y Acceso al Mercado": "Cobertura",
  "Gestión Comercial y Estructura": "Comercial",
  "Generación de Demanda y Gestión de Portafólio": "Demanda",
  "Recursos Humanos": "RR.HH.",
  "Competencia Financiera": "Financiera",
  "Digitalización": "Digital",
  "Logística y Operaciones": "Logística",
  "Seguridad, Higiene y Sustentabilidad": "Seguridad"
};

const DASH_COMPETENCE_WEIGHTS = {
  "Visión Estratégica/Gerencial": 20,
  "Cobertura y Acceso al Mercado": 20,
  "Gestión Comercial y Estructura": 20,
  "Generación de Demanda y Gestión de Portafólio": 15,
  "Recursos Humanos": 5,
  "Competencia Financiera": 5,
  "Digitalización": 5,
  "Logística y Operaciones": 5,
  "Seguridad, Higiene y Sustentabilidad": 5
};

// =============================================================
// Pilares (agrupación superior de las 9 competencias en 4 bloques
// estratégicos). El score de un pilar es el promedio ponderado
// de las competencias que lo integran (peso = DASH_COMPETENCE_WEIGHTS).
// =============================================================
const DASH_PILARES = [
  { id: "ec",  name: "Excelencia Comercial",        short: "Excelencia Comercial",   radar: "Comercial",   color: "#0068B4" },
  { id: "eo",  name: "Excelencia Operacional",      short: "Excelencia Operacional", radar: "Operacional", color: "#00824B" },
  { id: "dig", name: "Digitalización y NMDN",       short: "Digital y NMDN",         radar: "Digital",     color: "#7B1FA2" }
];

const DASH_PILAR_CATEGORIES = {
  ec:  ["Visión Estratégica/Gerencial", "Cobertura y Acceso al Mercado", "Gestión Comercial y Estructura", "Generación de Demanda y Gestión de Portafólio"],
  eo:  ["Recursos Humanos", "Competencia Financiera", "Logística y Operaciones", "Seguridad, Higiene y Sustentabilidad"],
  dig: ["Digitalización"]
};

function dashGetPilarScore(row, pilarId) {
  const cats = DASH_PILAR_CATEGORIES[pilarId] || [];
  let sumW = 0, sumWV = 0;
  cats.forEach(cat => {
    const s = dashGetCategoryScore(row, cat);
    const w = DASH_COMPETENCE_WEIGHTS[cat] || 0;
    if (Number.isFinite(s) && w > 0) {
      sumW += w;
      sumWV += s * w;
    }
  });
  return sumW ? Math.round(sumWV / sumW) : 0;
}

function dashPilarWeightPct(pilarId) {
  const cats = DASH_PILAR_CATEGORIES[pilarId] || [];
  return cats.reduce((acc, c) => acc + (DASH_COMPETENCE_WEIGHTS[c] || 0), 0);
}

// Estado del toggle competencias/pilares (persistido en localStorage)
let _dashViewMode = 'comp'; // 'comp' | 'pilar'
try { _dashViewMode = localStorage.getItem('dashViewMode') === 'pilar' ? 'pilar' : 'comp'; } catch (_) {}

// Adaptador único para que cada render sepa qué dimensiones usar
// (9 competencias o 3 pilares) sin tener 2 versiones de cada función.
function dashDimensions() {
  if (_dashViewMode === 'pilar') {
    return {
      mode: 'pilar',
      order:    DASH_PILARES.map(p => p.id),
      nameOf:   (id) => DASH_PILARES.find(p => p.id === id)?.name || id,
      shortOf:  (id) => DASH_PILARES.find(p => p.id === id)?.short || id,
      radarOf:  (id) => DASH_PILARES.find(p => p.id === id)?.radar || id,
      weightOf: (id) => dashPilarWeightPct(id),
      scoreOf:  (row, id) => dashGetPilarScore(row, id),
      colorOf:  (id) => DASH_PILARES.find(p => p.id === id)?.color || '#0068B4',
      unitLabel: 'pilar',
      unitPlural: 'pilares'
    };
  }
  return {
    mode: 'comp',
    order:    DASH_CATEGORY_ORDER.slice(),
    nameOf:   (n) => n,
    shortOf:  (n) => DASH_CATEGORY_LABEL_SHORT[n] || n,
    radarOf:  (n) => DASH_CATEGORY_RADAR_LABEL[n] || n,
    weightOf: (n) => DASH_COMPETENCE_WEIGHTS[n] || 0,
    scoreOf:  (row, n) => dashGetCategoryScore(row, n),
    colorOf:  (_)     => '#0068B4',
    unitLabel: 'competencia',
    unitPlural: 'competencias'
  };
}

// Actualiza los títulos y bajadas de las tarjetas para reflejar el toggle
function dashUpdateDynamicTitles() {
  const isPilar = _dashViewMode === 'pilar';
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('dash-title-desempeno', isPilar ? 'Desempeño promedio por pilar' : 'Desempeño promedio por competencia');
  set('dash-title-squad-hm',  isPilar ? 'Promedio de pilares por squad' : 'Promedio de competencias por squad');
  set('dash-sub-squad-hm',    isPilar
    ? 'Heatmap de los 3 pilares estratégicos por squad, con cantidad de distribuidores evaluados. Ordenado por total desc.'
    : 'Heatmap de las 9 competencias por squad, con cantidad de distribuidores evaluados. Ordenado por total desc.');
  set('dash-title-matriz',    isPilar ? 'Matriz comparativa · Distribuidor × Pilar' : 'Matriz comparativa · Distribuidor × Competencia');
  set('dash-sub-matriz',      isPilar
    ? 'Vista tabular de todos los distribuidores del alcance con su score total y por pilar. Buscá por nombre y ordená a gusto.'
    : 'Vista tabular de todos los distribuidores del alcance con su score total y por competencia. Buscá por nombre y ordená a gusto.');
  set('dash-title-lideres',   isPilar ? 'Líderes por pilar' : 'Líderes por competencia');
}

let _dashInitialized = false;
let _dashLoaded = false;
// Timestamp de la última carga desde Supabase. Se usa para auto-refresh:
// al reentrar al tab Dashboard o al recuperar foco de la ventana, si pasaron
// más de DASH_STALE_MS milisegundos se recarga silenciosamente.
let _dashLoadedAt = 0;
const DASH_STALE_MS = 30_000;

// Marca el cache del dashboard como stale. Se llama después de guardar/eliminar
// assessments propios, así la próxima vez que se muestre el dashboard vuelve a
// pedir los datos frescos.
function dashInvalidate() {
  _dashLoaded = false;
  _dashLoadedAt = 0;
}

// Helpers de rotulado del "conjunto de referencia" contra el que se compara.
// - Admin: ve toda la red, así que los rótulos hablan de "la red completa".
// - Usuario común: solo ve sus propios assessments, por lo que las comparaciones
//   son contra el promedio de esos assessments propios y así lo rotulamos para
//   no confundir con datos de otros vendedores que no está viendo.
function dashIsAdminUser() {
  return !!currentUser?.user_metadata?.is_admin;
}
function dashNetShort() {
  return dashIsAdminUser() ? 'la red' : 'tus assessments';
}
function dashNetLabel() {
  return dashIsAdminUser() ? 'Red completa' : 'Todos tus assessments';
}
function dashNetAvgLabel() {
  return dashIsAdminUser() ? 'Promedio red completa' : 'Promedio de tus assessments';
}
function dashNetAvgShort(mode) {
  const base = dashIsAdminUser() ? 'Promedio red' : 'Promedio propio';
  return mode === 'pilar' ? `${base} · Pilares` : base;
}
let _dashRawAssessments = [];
let _dashCompleted = [];
let _dashCharts = { covBu: null, covDonut: null, radar: null, indRadar: null, squadCompare: null, compSquad: null, compQuestions: null };
let _dashStrategicCtx = null;

function initHomeTabs() {
  if (_dashInitialized) return;
  _dashInitialized = true;

  const tabs = document.querySelectorAll('#home-tabs .home-tab');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => switchHomeTab(btn.dataset.tab));
  });

  const buSel = document.getElementById('dash-bu');
  const squadSel = document.getElementById('dash-squad');
  const refreshBtn = document.getElementById('dash-refresh');
  const regenBtn = document.getElementById('dash-regenerate-strategic');

  buSel?.addEventListener('change', () => {
    refreshDashSquadOptions();
    renderDashboard();
  });
  squadSel?.addEventListener('change', renderDashboard);
  refreshBtn?.addEventListener('click', async () => {
    _dashLoaded = false;
    await loadDashboardData();
    renderDashboard();
  });
  regenBtn?.addEventListener('click', () => {
    if (_dashStrategicCtx) renderDashStrategicWithAI(_dashStrategicCtx, true);
  });

  // Auto-refresh: si el usuario vuelve a la pestaña del navegador o le da foco
  // a la ventana y el dashboard está activo con datos viejos (> DASH_STALE_MS),
  // recargamos silenciosamente para reflejar cargas de otros usuarios.
  const maybeAutoRefresh = () => {
    if (document.hidden) return;
    const dashPanel = document.getElementById('tab-panel-dashboard');
    const dashActive = dashPanel && dashPanel.classList.contains('active');
    if (!dashActive) return;
    const stale = !_dashLoaded || (Date.now() - _dashLoadedAt) > DASH_STALE_MS;
    if (!stale) return;
    loadDashboardData().then(renderDashboard).catch(err => {
      console.warn('Auto-refresh del dashboard falló:', err);
    });
  };
  document.addEventListener('visibilitychange', maybeAutoRefresh);
  window.addEventListener('focus', maybeAutoRefresh);

  // Toggle Competencias / Pilares — cambia la dimensión con la que se
  // muestran las tarjetas (radar, barras, heatmap, matriz, líderes).
  const viewToggle = document.getElementById('dash-view-toggle');
  if (viewToggle) {
    // Refleja el estado persistido al arrancar
    viewToggle.querySelectorAll('button[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === _dashViewMode);
    });
    viewToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      const next = btn.dataset.view === 'pilar' ? 'pilar' : 'comp';
      if (next === _dashViewMode) return;
      _dashViewMode = next;
      try { localStorage.setItem('dashViewMode', next); } catch (_) {}
      viewToggle.querySelectorAll('button[data-view]').forEach(b => {
        b.classList.toggle('active', b.dataset.view === next);
      });
      // Re-render completo del dashboard con el nuevo modo
      renderDashboard();
    });
  }

  // Sub-tabs dentro del panel Dashboard
  document.querySelectorAll('#dash-subtabs .dash-subtab').forEach(btn => {
    btn.addEventListener('click', () => switchDashSubTab(btn.dataset.subtab));
  });

  // Análisis Específico
  const indSel = document.getElementById('dash-ind-dist');
  const indAiBtn = document.getElementById('dash-ind-ai-btn');

  indSel?.addEventListener('change', () => {
    _dashIndSelectedId = indSel.value;
    _dashIndAiCache = null; // se reinicia al cambiar de distribuidor
    renderDashIndividualDetail();
  });
  indAiBtn?.addEventListener('click', () => {
    if (_dashIndSelectedId && _dashIndSelectedId !== '__all__') fetchIndividualAnalysisAI(_dashIndSelectedId, true);
  });

  // Matriz Comparativa
  const matSearch = document.getElementById('dash-mat-search');
  const matSort = document.getElementById('dash-mat-sort');
  matSearch?.addEventListener('input', () => {
    _dashMatSearch = matSearch.value || '';
    renderDashMatrixTable();
  });
  matSort?.addEventListener('change', () => {
    _dashMatSort = matSort.value || 'total_desc';
    renderDashMatrixTable();
  });

  // Competencias
  const compSel = document.getElementById('dash-comp-select');
  const compDist = document.getElementById('dash-comp-dist');
  compSel?.addEventListener('change', () => {
    _dashCompSelected = compSel.value;
    // Al cambiar de competencia se reordena el listado de distribuidores y
    // se resetea la elección puntual para evitar mostrar un score irrelevante.
    _dashCompDistId = '__all__';
    renderDashCompetencias(dashRowsInScope());
  });
  compDist?.addEventListener('change', () => {
    _dashCompDistId = compDist.value || '__all__';
    renderDashCompetenciaDetail();
  });
}

function switchHomeTab(tab) {
  document.querySelectorAll('#home-tabs .home-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.home-tab-panel').forEach(p => {
    const active = p.id === `tab-panel-${tab}`;
    p.classList.toggle('active', active);
    p.style.display = active ? '' : 'none';
  });

  const container = document.getElementById('home-container');
  if (tab === 'dashboard') {
    container?.classList.add('home-container-wide');
    document.getElementById('home-title').textContent = 'Dashboard';
    const stale = !_dashLoaded || (Date.now() - _dashLoadedAt) > DASH_STALE_MS;
    if (stale) {
      loadDashboardData().then(renderDashboard);
    } else {
      renderDashboard();
    }
  } else {
    container?.classList.remove('home-container-wide');
    document.getElementById('home-title').textContent = 'Mis Assessments';
  }
}

async function loadDashboardData() {
  const isAdmin = !!currentUser?.user_metadata?.is_admin;
  let data = [];
  try {
    if (isAdmin) {
      const { data: rpcData, error } = await supabaseClient.rpc('get_all_assessments');
      if (error) throw error;
      data = rpcData || [];
    } else {
      const { data: mine, error } = await supabaseClient
        .from('assessments')
        .select('id, user_id, status, nombre_distribuidor, cuit, bu, squad, updated_at, payload')
        .eq('user_id', currentUser.id);
      if (error) throw error;
      data = mine || [];
    }
  } catch (e) {
    console.error('Error cargando dashboard:', e);
    data = [];
  }

  _dashRawAssessments = data;
  _dashCompleted = data.filter(a => a.status === 'completado');
  _dashLoaded = true;
  _dashLoadedAt = Date.now();
  populateDashFilters();
}

function dashNormalizeCuit(cuit) {
  return String(cuit || '').replace(/\D/g, '');
}

function dashDedupeByCuit(list) {
  const map = new Map();
  list.forEach(a => {
    const key = dashNormalizeCuit(a.cuit);
    if (!key) return;
    const prev = map.get(key);
    if (!prev || new Date(a.updated_at) > new Date(prev.updated_at)) {
      map.set(key, { ...a, cuit: key });
    }
  });
  return Array.from(map.values());
}

function dashPadron() {
  return (typeof DISTRIBUIDORES !== 'undefined' ? DISTRIBUIDORES : []).map(d => ({
    cuit: dashNormalizeCuit(d.cuit),
    nombre: d.razonSocial,
    bu: d.bu,
    squad: d.squad
  }));
}

function dashUnique(arr) {
  return Array.from(new Set(arr));
}

function dashAvg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function populateDashFilters() {
  const isAdmin = !!currentUser?.user_metadata?.is_admin;
  const padron = dashPadron();
  const sourceBu = isAdmin
    ? padron
    : dashDedupeByCuit(_dashRawAssessments);

  const bus = dashUnique(sourceBu.map(r => r.bu).filter(Boolean)).sort();
  const buSel = document.getElementById('dash-bu');
  const prevBu = buSel.value;
  buSel.innerHTML = '<option value="">Todas</option>' + bus.map(b => `<option value="${b}">${b}</option>`).join('');
  if (bus.includes(prevBu)) buSel.value = prevBu;

  refreshDashSquadOptions();
}

function refreshDashSquadOptions() {
  const isAdmin = !!currentUser?.user_metadata?.is_admin;
  const buSel = document.getElementById('dash-bu');
  const squadSel = document.getElementById('dash-squad');
  const prevSquad = squadSel.value;

  const padron = dashPadron();
  const source = isAdmin ? padron : dashDedupeByCuit(_dashRawAssessments);
  const filtered = buSel.value ? source.filter(r => r.bu === buSel.value) : source;
  const squads = dashUnique(filtered.map(r => r.squad).filter(Boolean)).sort();

  squadSel.innerHTML = '<option value="">Todos</option>' + squads.map(s => `<option value="${s}">${s}</option>`).join('');
  if (squads.includes(prevSquad)) squadSel.value = prevSquad;
}

function dashPadronInScope() {
  const isAdmin = !!currentUser?.user_metadata?.is_admin;
  const buSel = document.getElementById('dash-bu').value;
  const squadSel = document.getElementById('dash-squad').value;
  const padron = dashPadron();
  if (isAdmin) {
    return padron.filter(p => (!buSel || p.bu === buSel) && (!squadSel || p.squad === squadSel));
  }
  const dedup = dashDedupeByCuit(_dashRawAssessments);
  return dedup
    .filter(u => (!buSel || u.bu === buSel) && (!squadSel || u.squad === squadSel))
    .map(u => ({
      cuit: u.cuit,
      nombre: u.nombre_distribuidor,
      bu: u.bu,
      squad: u.squad,
      _status: u.status
    }));
}

function dashRowsInScope() {
  const buSel = document.getElementById('dash-bu').value;
  const squadSel = document.getElementById('dash-squad').value;
  let rows = dashDedupeByCuit(_dashCompleted);
  if (buSel) rows = rows.filter(r => r.bu === buSel);
  if (squadSel) rows = rows.filter(r => r.squad === squadSel);
  return rows;
}

function dashGetResultTotal(row) {
  const v = row?.payload?.resultados?.totalGeneral || 0;
  return Math.round(v * 100);
}

function dashGetCategoryScore(row, name) {
  const cats = row?.payload?.resultados?.categorias || [];
  const c = cats.find(x => x.name === name);
  return c ? Math.round((c.scoreCategoria || 0) * 100) : 0;
}

function renderDashboard() {
  if (!_dashLoaded) return;
  const rows = dashRowsInScope();
  const scope = dashPadronInScope();
  const body = document.getElementById('dash-body');
  const empty = document.getElementById('dash-empty');

  if (!scope.length) {
    body.style.display = 'none';
    empty.style.display = '';
    return;
  }
  body.style.display = '';
  empty.style.display = 'none';

  // Actualiza los títulos según la vista (Competencia vs Pilar)
  dashUpdateDynamicTitles();

  const isAdmin = !!currentUser?.user_metadata?.is_admin;
  const completedCuits = new Set(rows.map(r => dashNormalizeCuit(r.cuit)));
  const totalScope = scope.length;
  const conScope = scope.filter(p => completedCuits.has(dashNormalizeCuit(p.cuit))).length;
  const sinScope = Math.max(totalScope - conScope, 0);
  const coverage = totalScope ? Math.round((conScope / totalScope) * 100) : 0;

  const totalLabel = isAdmin ? 'Distribuidores en padrón 2026' : 'Distribuidores que cargaste';
  const sinLabel = isAdmin ? 'Sin assessment (pendientes)' : 'En borrador / pendientes';
  const roleText = isAdmin
    ? 'Modo admin: red completa'
    : `Modo usuario: distribuidores que cargaste (${currentUser?.email || ''})`;

  document.getElementById('dash-coverage-intro').textContent =
    `Cobertura real de análisis cruzando assessments completados y padrón. ${roleText}. En alcance: ${rows.length} evaluados. Pendientes: ${sinScope}.`;

  document.getElementById('dash-kpis').innerHTML = `
    <div class="dash-kpi"><div class="v">${totalScope}</div><div class="l">${totalLabel}</div></div>
    <div class="dash-kpi green"><div class="v">${conScope}</div><div class="l">Con assessment</div></div>
    <div class="dash-kpi red"><div class="v">${sinScope}</div><div class="l">${sinLabel}</div></div>
    <div class="dash-kpi"><div class="v">${coverage}%</div><div class="l">Cobertura actual</div></div>
  `;

  // Chart: cobertura por BU (stacked)
  const buGroups = {};
  scope.forEach(p => {
    const bu = p.bu || 'Sin BU';
    if (!buGroups[bu]) buGroups[bu] = { total: 0, con: 0, sin: 0 };
    buGroups[bu].total += 1;
    if (completedCuits.has(dashNormalizeCuit(p.cuit))) buGroups[bu].con += 1;
    else buGroups[bu].sin += 1;
  });
  const buLabels = Object.keys(buGroups).sort((a, b) => {
    const order = ['Sur', 'Centro', 'Norte'];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  if (_dashCharts.covBu) _dashCharts.covBu.destroy();
  _dashCharts.covBu = new Chart(document.getElementById('dash-chart-cov-bu'), {
    type: 'bar',
    data: {
      labels: buLabels,
      datasets: [
        { label: 'Con assessment', data: buLabels.map(b => buGroups[b].con), backgroundColor: '#66B512' },
        { label: 'Sin assessment', data: buLabels.map(b => buGroups[b].sin), backgroundColor: '#C62828' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });

  if (_dashCharts.covDonut) _dashCharts.covDonut.destroy();
  _dashCharts.covDonut = new Chart(document.getElementById('dash-chart-cov-donut'), {
    type: 'doughnut',
    data: {
      labels: ['Con assessment', 'Sin assessment'],
      datasets: [{ data: [conScope, sinScope], backgroundColor: ['#66B512', '#C62828'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  // Tabla cobertura por Squad
  const groups = {};
  scope.forEach(p => {
    const key = `${p.bu}||${p.squad}`;
    if (!groups[key]) groups[key] = { bu: p.bu, squad: p.squad, total: 0, con: 0 };
    groups[key].total += 1;
    if (completedCuits.has(dashNormalizeCuit(p.cuit))) groups[key].con += 1;
  });
  const rowsCov = Object.values(groups)
    .map(g => ({ ...g, sin: g.total - g.con, pct: g.total ? Math.round((g.con / g.total) * 100) : 0 }))
    .sort((a, b) => b.sin - a.sin || a.bu.localeCompare(b.bu));

  const totCov = rowsCov.reduce((s, r) => s + r.total, 0);
  const totCon = rowsCov.reduce((s, r) => s + r.con, 0);
  const totSin = rowsCov.reduce((s, r) => s + r.sin, 0);
  const totPct = totCov ? Math.round((totCon / totCov) * 100) : 0;

  document.getElementById('dash-coverage-table').innerHTML = `
    <thead>
      <tr><th>BU</th><th>Squad</th><th>Centros del squad</th><th>Con assessment</th><th>Sin assessment</th><th>% cobertura</th></tr>
    </thead>
    <tbody>
      ${rowsCov.map(r => `<tr>
        <td>${dashEscapeHtml(r.bu || '')}</td><td>${dashEscapeHtml(r.squad || '')}</td><td>${r.total}</td>
        <td class="cov-con">${r.con}</td><td class="cov-sin">${r.sin}</td><td class="cov-pct">${r.pct}%</td>
      </tr>`).join('')}
      <tr class="total-row"><td>TOTAL</td><td></td><td>${totCov}</td><td>${totCon}</td><td>${totSin}</td><td>${totPct}%</td></tr>
    </tbody>
  `;

  // Panorama
  const avgTotal = rows.length ? Math.round(dashAvg(rows.map(dashGetResultTotal))) : 0;
  const highCount = rows.filter(r => dashGetResultTotal(r) >= 80).length;
  const lowCount = rows.filter(r => dashGetResultTotal(r) <= 69).length;
  const buCount = dashUnique(rows.map(r => r.bu)).length;
  const squadCount = dashUnique(rows.map(r => r.squad)).length;

  document.getElementById('dash-network-kpis').innerHTML = `
    <div class="dash-kpi"><div class="v">${rows.length}</div><div class="l">Distribuidores evaluados</div></div>
    <div class="dash-kpi"><div class="v">${avgTotal}%</div><div class="l">Score general de red</div></div>
    <div class="dash-kpi green"><div class="v">${highCount}</div><div class="l">Distribuidores &gt;= 80%</div></div>
    <div class="dash-kpi red"><div class="v">${lowCount}</div><div class="l">Distribuidores &lt;= 69%</div></div>
    <div class="dash-kpi"><div class="v">${buCount} / ${squadCount}</div><div class="l">BUs / Squads</div></div>
  `;

  // Competencias / Pilares — según el toggle del dashboard
  const dims = dashDimensions();
  const compRows = dims.order.map(key => {
    const vals = rows.map(r => dims.scoreOf(r, key)).filter(v => Number.isFinite(v));
    return {
      key,
      name: dims.nameOf(key),
      short: dims.shortOf(key),
      radar: dims.radarOf(key),
      avg: vals.length ? Math.round(dashAvg(vals)) : 0,
      weight: dims.weightOf(key),
      color: dims.colorOf(key)
    };
  });

  if (_dashCharts.radar) _dashCharts.radar.destroy();
  const radarCanvas = document.getElementById('dash-chart-comp-radar');
  // En modo pilar hay sólo 4 dimensiones: agrandamos el contenedor del radar y las
  // barras para aprovechar mejor el espacio disponible en el card.
  const radarBox = radarCanvas?.parentElement;
  if (radarBox) radarBox.style.height = dims.mode === 'pilar' ? '440px' : '320px';
  _dashCharts.radar = new Chart(radarCanvas, {
    type: 'radar',
    data: {
      labels: compRows.map(c => c.radar),
      datasets: [{
        label: dashNetAvgShort(dims.mode),
        data: compRows.map(c => c.avg),
        backgroundColor: 'rgba(0, 145, 223, 0.20)',
        borderColor: '#0091DF',
        borderWidth: 2,
        pointBackgroundColor: '#10384F'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
      plugins: { legend: { display: false } }
    }
  });

  const barsEl = document.getElementById('dash-comp-bars');
  barsEl.setAttribute('data-view-mode', dims.mode);
  barsEl.innerHTML = compRows.map(c => {
    const cls = c.avg >= 80 ? '' : (c.avg >= 70 ? 'mid' : 'bad');
    return `
      <div class="dash-bar">
        <div class="lab" title="${dashEscapeHtml(c.name)}">${dashEscapeHtml(c.short)}</div>
        <div class="track"><div class="fill ${cls}" style="width:${c.avg}%"></div></div>
        <div><strong>${c.avg}%</strong> <span style="color:var(--medium-text)">(${c.weight}%)</span></div>
      </div>
    `;
  }).join('');

  // Lectura estratégica IA (Edge Function + fallback local)
  const sortedComp = compRows.slice().sort((a, b) => b.avg - a.avg);
  renderDashStrategicWithAI({
    rows, rowsCov, totalCov: totCov, totalCon: totCon, totalSin: totSin, totalPct: totPct,
    avgTotal, highCount, lowCount, buCount, squadCount, compRows, sortedComp
  });

  // Panel Análisis Específico:
  // La referencia SIEMPRE es el promedio de toda la red completada (sin filtro),
  // no del scope actual. Así se puede filtrar y comparar contra un mismo baseline.
  const fullRedRows = dashDedupeByCuit(_dashCompleted);
  _dashIndNetworkAvg = DASH_CATEGORY_ORDER.reduce((acc, name) => {
    const vals = fullRedRows.map(r => dashGetCategoryScore(r, name));
    acc[name] = vals.length ? Math.round(dashAvg(vals)) : 0;
    return acc;
  }, {});
  _dashIndNetworkPilarAvg = DASH_PILARES.reduce((acc, p) => {
    const vals = fullRedRows.map(r => dashGetPilarScore(r, p.id));
    acc[p.id] = vals.length ? Math.round(dashAvg(vals)) : 0;
    return acc;
  }, {});
  _dashIndNetworkTotalAvg = fullRedRows.length
    ? Math.round(dashAvg(fullRedRows.map(dashGetResultTotal)))
    : 0;
  renderDashIndividual(rows);
  renderDashMatrix(rows);
  renderDashRankings(rows);
  renderDashCompetencias(rows);
  renderDashHallazgos(rows);
}

function dashEscapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// =============================================================
// Combobox con búsqueda (typeahead). Mantiene el <select> nativo
// (oculto) para preservar el .value y los listeners de 'change'
// que ya usa el resto del código.
// =============================================================
function enhanceSearchableSelect(sel, opts = {}) {
  if (!sel) return;
  if (sel.dataset.searchableEnhanced === '1') {
    if (typeof sel._searchableSync === 'function') sel._searchableSync();
    return;
  }
  sel.dataset.searchableEnhanced = '1';
  const placeholder = opts.placeholder || 'Buscar…';

  const wrap = document.createElement('div');
  wrap.className = 'searchable-select';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('searchable-select__native');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'searchable-select__input';
  input.placeholder = placeholder;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  wrap.appendChild(input);

  const chev = document.createElement('span');
  chev.className = 'searchable-select__chev';
  chev.textContent = '▾';
  wrap.appendChild(chev);

  const menu = document.createElement('ul');
  menu.className = 'searchable-select__menu';
  menu.setAttribute('role', 'listbox');
  wrap.appendChild(menu);

  let highlighted = -1;
  let filter = '';
  let open = false;
  let typing = false;

  function currentOptions() {
    return Array.from(sel.options).map(o => ({ value: o.value, label: o.textContent }));
  }

  function filteredOptions() {
    const f = filter.trim().toLowerCase();
    const list = currentOptions();
    if (!f) return list;
    return list.filter(o => o.label.toLowerCase().includes(f));
  }

  function renderMenu() {
    const list = filteredOptions();
    if (!list.length) {
      menu.innerHTML = '<li class="searchable-select__empty">Sin coincidencias</li>';
      return;
    }
    menu.innerHTML = list.map((o, i) => {
      const isHi = i === highlighted;
      const isSel = o.value === sel.value;
      const cls = 'searchable-select__opt'
        + (isHi ? ' is-highlighted' : '')
        + (isSel ? ' is-selected' : '');
      const val = String(o.value).replace(/"/g, '&quot;');
      return `<li class="${cls}" data-value="${val}" role="option">${dashEscapeHtml(o.label)}</li>`;
    }).join('');
  }

  function updateInputFromValue() {
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    input.value = opt ? opt.textContent : '';
  }

  function openMenu() {
    if (open) return;
    open = true;
    wrap.classList.add('is-open');
    filter = '';
    highlighted = -1;
    typing = false;
    // Mostramos la etiqueta actual pero seleccionada para que al tipear se reemplace
    input.select();
    renderMenu();
  }

  function closeMenu() {
    open = false;
    typing = false;
    wrap.classList.remove('is-open');
    updateInputFromValue();
  }

  function commit(value) {
    if (sel.value !== value) {
      sel.value = value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeMenu();
  }

  function scrollHighlighted() {
    const li = menu.querySelector('.is-highlighted');
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', openMenu);
  input.addEventListener('click', () => { if (!open) openMenu(); });
  chev.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (open) closeMenu();
    else { input.focus(); openMenu(); }
  });

  input.addEventListener('input', () => {
    typing = true;
    filter = input.value;
    highlighted = filteredOptions().length ? 0 : -1;
    if (!open) openMenu();
    renderMenu();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openMenu();
      const list = filteredOptions();
      highlighted = Math.min(list.length - 1, highlighted + 1);
      renderMenu(); scrollHighlighted();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(0, highlighted - 1);
      renderMenu(); scrollHighlighted();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const list = filteredOptions();
      if (highlighted >= 0 && list[highlighted]) commit(list[highlighted].value);
      else if (list.length === 1) commit(list[0].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  });

  menu.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.searchable-select__opt');
    if (!li) return;
    e.preventDefault();
    commit(li.dataset.value);
  });

  document.addEventListener('mousedown', (e) => {
    if (!open) return;
    if (!wrap.contains(e.target)) closeMenu();
  });

  sel._searchableSync = () => {
    updateInputFromValue();
    if (open) renderMenu();
  };

  updateInputFromValue();
}

function buildDashStrategicPayload(ctx) {
  // Calcula el promedio ponderado de cada uno de los 3 pilares
  // usando el promedio ya calculado de cada competencia (ctx.compRows).
  // Peso del pilar = suma de pesos de las competencias que lo integran.
  const pilares = DASH_PILARES.map(p => {
    const cats = DASH_PILAR_CATEGORIES[p.id] || [];
    let sumW = 0, sumWV = 0;
    cats.forEach(catName => {
      const c = ctx.compRows.find(x => x.name === catName);
      const w = DASH_COMPETENCE_WEIGHTS[catName] || 0;
      if (c && Number.isFinite(c.avg) && w > 0) {
        sumW += w;
        sumWV += c.avg * w;
      }
    });
    return {
      id: p.id,
      name: p.name,
      avg: sumW ? Math.round(sumWV / sumW) : 0,
      weight: sumW
    };
  });

  return {
    totalPadron: ctx.totalCov,
    conAssessment: ctx.totalCon,
    sinAssessment: ctx.totalSin,
    coverage: ctx.totalPct,
    evaluados: ctx.rows.length,
    avgScore: ctx.avgTotal,
    highCount: ctx.highCount,
    lowCount: ctx.lowCount,
    buCount: ctx.buCount,
    squadCount: ctx.squadCount,
    competencias: ctx.compRows.map(c => ({ name: c.name, avg: c.avg, weight: c.weight })),
    pilares,
    squadsMejores: ctx.rowsCov.slice().sort((a, b) => b.pct - a.pct).slice(0, 3).map(s => ({ squad: s.squad, pct: s.pct })),
    squadsPeores: ctx.rowsCov.slice().sort((a, b) => a.pct - b.pct).slice(0, 3).map(s => ({ squad: s.squad, pct: s.pct }))
  };
}

// =============================================================
// PERSISTENCIA DE LECTURAS IA (tabla public.ai_analyses)
// -------------------------------------------------------------
// Guarda cada generación como una fila nueva (histórico) y al
// leer trae la más reciente que coincida con el payload_hash del
// contexto actual. Si el hash no coincide → el input cambió y
// hay que regenerar.
// =============================================================

// Hash estable (djb2) sobre un string cualquiera. Sólo necesitamos
// que sea determinístico + baratísimo, no criptográfico.
function aiHashString(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  // Base36 sin signo — queda cortito para logs / debugging.
  return (h >>> 0).toString(36);
}

function aiHashPayload(payload) {
  try {
    return aiHashString(JSON.stringify(payload));
  } catch (_e) {
    return aiHashString(String(payload));
  }
}

// Trae la lectura persistida más reciente para (kind, scope_key). Si
// se pasa expectedHash, además exige que payload_hash coincida — así
// evitamos servir una lectura vieja cuando los datos ya cambiaron.
async function loadPersistedAiAnalysis(kind, scopeKey, expectedHash) {
  if (!currentUser || !kind || !scopeKey) return null;
  try {
    let query = supabaseClient
      .from('ai_analyses')
      .select('id, sections, model, generated_at, payload_hash, user_id')
      .eq('kind', kind)
      .eq('scope_key', scopeKey)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (expectedHash) query = query.eq('payload_hash', expectedHash);

    const { data, error } = await query;
    if (error) {
      console.warn('loadPersistedAiAnalysis error:', error.message || error);
      return null;
    }
    return (data && data.length) ? data[0] : null;
  } catch (e) {
    console.warn('loadPersistedAiAnalysis exception:', e);
    return null;
  }
}

async function savePersistedAiAnalysis({ kind, scopeKey, sections, model, hash, assessmentId }) {
  if (!currentUser || !kind || !scopeKey || !Array.isArray(sections) || !sections.length) return null;
  try {
    const { data, error } = await supabaseClient
      .from('ai_analyses')
      .insert({
        user_id: currentUser.id,
        kind,
        scope_key: scopeKey,
        assessment_id: assessmentId || null,
        payload_hash: hash || 'nohash',
        sections,
        model: model || null
      })
      .select('id, generated_at')
      .single();

    if (error) {
      console.warn('savePersistedAiAnalysis error:', error.message || error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('savePersistedAiAnalysis exception:', e);
    return null;
  }
}

// Formatea "hace X" para el meta ("cache · hace 3 h") cuando servimos
// una lectura persistida en vez de una recién generada.
function aiFormatRelativeAge(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? '' : 'es'}`;
}

function applyStrategicSections(sections, generatedAt, model, sourceLabel) {
  const notesEl = document.getElementById('dash-strategic-notes');
  const metaEl = document.getElementById('dash-strategic-meta');
  if (!notesEl) return;
  notesEl.innerHTML = sections.map(s =>
    `<p><strong>${dashEscapeHtml(s.title)}.</strong> ${dashEscapeHtml(s.content)}</p>`
  ).join('');
  if (metaEl) {
    const when = generatedAt ? new Date(generatedAt) : new Date();
    const whenStr = when.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const source = sourceLabel || (model ? `IA (${model})` : 'IA');
    metaEl.textContent = ` · ${source} · ${whenStr}`;
  }
}

async function renderDashStrategicWithAI(ctx, forceRefresh = false) {
  _dashStrategicCtx = ctx;
  const notesEl = document.getElementById('dash-strategic-notes');
  const metaEl = document.getElementById('dash-strategic-meta');
  if (!notesEl) return;

  const payload = buildDashStrategicPayload(ctx);
  const buSel = document.getElementById('dash-bu')?.value || '';
  const sqSel = document.getElementById('dash-squad')?.value || '';
  const scopeKey = `${buSel}||${sqSel}`;
  const hash = aiHashPayload(payload);

  // 1) Lectura persistida en Supabase (si el hash del input sigue vigente)
  if (!forceRefresh) {
    const persisted = await loadPersistedAiAnalysis('strategic', scopeKey, hash);
    if (persisted && Array.isArray(persisted.sections) && persisted.sections.length) {
      const age = aiFormatRelativeAge(persisted.generated_at);
      applyStrategicSections(
        persisted.sections,
        persisted.generated_at,
        persisted.model,
        `IA (${persisted.model || 'gpt-4o-mini'}) · guardada${age ? ' · ' + age : ''}`
      );
      return;
    }
  }

  notesEl.innerHTML = '<p style="color:var(--medium-text)">Generando análisis con IA...</p>';
  if (metaEl) metaEl.textContent = '';

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-strategic-analysis', { body: payload });
    if (error) throw error;
    if (!data || !Array.isArray(data.sections) || !data.sections.length) {
      throw new Error('IA no devolvió secciones');
    }
    applyStrategicSections(data.sections, data.generated_at, data.model);
    // Persistimos la generación para próximas lecturas.
    savePersistedAiAnalysis({
      kind: 'strategic',
      scopeKey,
      sections: data.sections,
      model: data.model,
      hash
    });
  } catch (e) {
    console.warn('Fallback a lectura local (IA no disponible):', e);
    renderDashStrategicAI(ctx);
    if (metaEl) {
      metaEl.textContent = (metaEl.textContent || '') + ' · IA no disponible, usando motor local';
    }
  }
}

function renderDashStrategicAI(ctx) {
  _dashStrategicCtx = ctx;
  const compByName = (n) => ctx.compRows.find(c => c.name === n)?.avg || 0;

  const digital = compByName('Digitalización');
  const gerencial = compByName('Visión Estratégica/Gerencial');
  const cobertura = compByName('Cobertura y Acceso al Mercado');
  const comercial = compByName('Gestión Comercial y Estructura');
  const demanda = compByName('Generación de Demanda y Gestión de Portafólio');
  const seguridad = compByName('Seguridad, Higiene y Sustentabilidad');
  const financiera = compByName('Competencia Financiera');
  const logistica = compByName('Logística y Operaciones');
  const rrhh = compByName('Recursos Humanos');

  const top = ctx.sortedComp.slice(0, 2);
  const bot = ctx.sortedComp.slice(-2).reverse();
  const worstSquads = ctx.rowsCov.slice().sort((a, b) => a.pct - b.pct).slice(0, 3);
  const bestSquads = ctx.rowsCov.slice().sort((a, b) => b.pct - a.pct).slice(0, 2);

  const openers = [
    'El análisis del alcance actual muestra',
    'Sobre el conjunto de distribuidores evaluados se observa',
    'La lectura del corte vigente indica',
    'En base a los assessments consolidados se detecta'
  ];
  const bridges = ['En paralelo', 'Al mismo tiempo', 'Como contracara', 'En el otro extremo'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const bloques = [];

  bloques.push(
    `<p><strong>Panorámica general.</strong> ${pick(openers)} un score promedio ponderado de <strong>${ctx.avgTotal}%</strong> ` +
    `sobre <strong>${ctx.rows.length}</strong> distribuidores evaluados en <strong>${ctx.buCount}</strong> BU y <strong>${ctx.squadCount}</strong> squads. ` +
    `Del padrón total (${ctx.totalCov} centros), <strong>${ctx.totalCon}</strong> tienen assessment cargado (<strong>${ctx.totalPct}%</strong> de cobertura) ` +
    `y quedan <strong>${ctx.totalSin}</strong> pendientes.</p>`
  );

  if (bestSquads.length && worstSquads.length) {
    const worstTxt = worstSquads.map(s => `${s.squad} (${s.pct}%)`).join(', ');
    const bestTxt = bestSquads.map(s => `${s.squad} (${s.pct}%)`).join(' y ');
    bloques.push(
      `<p><strong>Cobertura territorial.</strong> Los squads con mayor avance son <strong>${bestTxt}</strong>. ` +
      `${pick(bridges)}, los squads con mayor deuda de carga son <strong>${worstTxt}</strong>, ` +
      `lo que sugiere priorizar visitas y seguimiento comercial para cerrar el gap de assessment antes de comparar performance.</p>`
    );
  }

  if (top.length && bot.length) {
    bloques.push(
      `<p><strong>Fortalezas y brechas.</strong> Las competencias con mejor desempeño son ` +
      `<strong>${top.map(c => `${c.name} (${c.avg}%)`).join(' y ')}</strong>, ` +
      `mientras que las más débiles son <strong>${bot.map(c => `${c.name} (${c.avg}%)`).join(' y ')}</strong>. ` +
      `Estas brechas concentran el mayor potencial de mejora del score total ponderado.</p>`
    );
  }

  const digDx = digital >= 70 ? 'un buen punto de partida' : digital >= 55 ? 'un nivel intermedio con margen claro' : 'un rezago estructural';
  bloques.push(
    `<p><strong>Digitalización.</strong> El promedio de ${dashNetShort()} es <strong>${digital}%</strong>, ${digDx}. ` +
    `Los ejes con mayor palanca son CRM, FieldView y adopción de rutinas digitales; ` +
    `avanzar en estos frentes acelera el score comercial-digital y la calidad del dato para próximas rondas.</p>`
  );

  const comercialAvg = Math.round((gerencial + cobertura + comercial + demanda) / 4);
  bloques.push(
    `<p><strong>Recomendación comercial.</strong> El bloque Gerencial + Cobertura + Comercial + Demanda promedia <strong>${comercialAvg}%</strong> ` +
    `y representa el 75% del peso del score. ` +
    `Se sugiere articular planes de acción específicos con los <strong>${ctx.lowCount}</strong> distribuidores por debajo del 70% y ` +
    `capitalizar las prácticas de los <strong>${ctx.highCount}</strong> distribuidores por encima del 80% como referencia interna.</p>`
  );

  const opsAvg = Math.round((logistica + seguridad + financiera + rrhh) / 4);
  bloques.push(
    `<p><strong>Soporte operativo.</strong> Logística, Seguridad, Financiera y RR.HH. promedian <strong>${opsAvg}%</strong>. ` +
    `Aunque su peso ponderado es menor, actuar sobre estas competencias reduce riesgos operativos y sostiene las mejoras comerciales.</p>`
  );

  document.getElementById('dash-strategic-notes').innerHTML = bloques.join('');
  const metaEl = document.getElementById('dash-strategic-meta');
  if (metaEl) {
    const now = new Date();
    metaEl.textContent = ` · Análisis generado ${now.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} sobre ${ctx.rows.length} assessments`;
  }
}

// =============================================================
// DASHBOARD · SUB-TAB "ANÁLISIS ESPECÍFICO"
// =============================================================

let _dashIndSelectedId = null;
let _dashIndNetworkAvg = {};       // { competencia: avg RED COMPLETA (todos los completados) }
let _dashIndNetworkPilarAvg = {};  // { pilarId: avg RED COMPLETA }
let _dashIndNetworkTotalAvg = 0;   // Promedio total de la red completa
let _dashIndAiCache = null;        // { id, sections, model, generated_at }

// Estado de la sub-tab "Matriz Comparativa"
let _dashMatSearch = '';
let _dashMatSort = 'total_desc';
let _dashMatRowsCache = [];        // última proyección de filas del scope actual

// Estado de la sub-tab "Competencias"
let _dashCompSelected = null;      // nombre de la competencia elegida
let _dashCompDistId = '__all__';   // '__all__' o id de assessment

function switchDashSubTab(sub) {
  document.querySelectorAll('#dash-subtabs .dash-subtab').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === sub);
  });
  document.querySelectorAll('.dash-subpanel').forEach(p => {
    p.classList.toggle('active', p.id === `dash-subpanel-${sub}`);
  });
}

function dashScoreClass(v) {
  if (v >= 80) return 'high';
  if (v >= 70) return 'mid';
  return 'low';
}

function renderDashIndividual(rows) {
  const sel = document.getElementById('dash-ind-dist');
  const emptyBox = document.getElementById('dash-ind-empty');
  const detailBox = document.getElementById('dash-ind-detail');
  const aiCard = document.getElementById('dash-ind-ai-card');
  if (!sel || !detailBox) return;

  // Los cards squad-level se rinden siempre (independientes del distribuidor)
  renderDashSquadCompare(rows);
  renderDashSquadHeatmap(rows);

  const sorted = rows.slice().sort((a, b) => dashGetResultTotal(b) - dashGetResultTotal(a));

  if (!sorted.length) {
    sel.innerHTML = '';
    if (typeof sel._searchableSync === 'function') sel._searchableSync();
    detailBox.innerHTML = '';
    if (emptyBox) emptyBox.style.display = '';
    if (aiCard) aiCard.style.display = 'none';
    _dashIndSelectedId = null;
    if (_dashCharts.indRadar) { _dashCharts.indRadar.destroy(); _dashCharts.indRadar = null; }
    return;
  }
  if (emptyBox) emptyBox.style.display = 'none';

  // Primera opción: agregado del alcance (BU/Squad filtrados o red completa)
  const buSelVal = document.getElementById('dash-bu')?.value || '';
  const squadSelVal = document.getElementById('dash-squad')?.value || '';
  let allLabel = 'Todos los distribuidores';
  if (squadSelVal) allLabel = `Todos los distribuidores del squad ${squadSelVal}`;
  else if (buSelVal) allLabel = `Todos los distribuidores de BU ${buSelVal}`;
  else allLabel = 'Todos los distribuidores de la red';

  const prev = _dashIndSelectedId || sel.value;
  const options = [`<option value="__all__">${dashEscapeHtml(allLabel)} (${sorted.length})</option>`]
    .concat(sorted.map(r => {
      const nombre = r.nombre_distribuidor || r.nombre || 'Sin nombre';
      return `<option value="${r.id}">${dashEscapeHtml(nombre)}</option>`;
    }));
  sel.innerHTML = options.join('');

  // Preserva selección previa si sigue siendo válida; si no, arranca en "__all__".
  if (prev === '__all__' || sorted.some(r => r.id === prev)) {
    sel.value = prev;
  } else {
    sel.value = '__all__';
  }
  _dashIndSelectedId = sel.value;

  // Convierte el <select> en un combobox con búsqueda (o re-sincroniza si ya lo era)
  enhanceSearchableSelect(sel, { placeholder: 'Buscá un distribuidor…' });

  // La card de IA queda SIEMPRE visible; en modo agregado muestra un placeholder informativo.
  if (aiCard) aiCard.style.display = '';

  renderDashIndividualDetail();
}

function renderDashIndividualDetail() {
  const detailBox = document.getElementById('dash-ind-detail');
  const aiNotes = document.getElementById('dash-ind-ai-notes');
  const aiMeta = document.getElementById('dash-ind-ai-meta');
  if (!detailBox) return;

  const rows = dashRowsInScope();
  const isAll = _dashIndSelectedId === '__all__';
  const dims = dashDimensions();
  const netAvg = dims.mode === 'pilar' ? _dashIndNetworkPilarAvg : _dashIndNetworkAvg;

  // Construye "sujeto" del detalle: distribuidor único o agregado del scope
  let subject;
  if (isAll) {
    const buSelVal = document.getElementById('dash-bu')?.value || '';
    const squadSelVal = document.getElementById('dash-squad')?.value || '';
    let scopeLabel;
    if (squadSelVal) scopeLabel = `Squad ${squadSelVal}${buSelVal ? ' · BU ' + buSelVal : ''}`;
    else if (buSelVal) scopeLabel = `BU ${buSelVal}`;
    else scopeLabel = dashNetLabel();

    const totales = rows.map(r => dashGetResultTotal(r));
    const total = totales.length ? Math.round(dashAvg(totales)) : 0;
    subject = {
      isAggregate: true,
      nombre: `Promedio · ${scopeLabel}`,
      metaBits: [
        `${rows.length} distribuidores evaluados`,
        `BU: ${buSelVal || 'Todas'} · Squad: ${squadSelVal || 'Todos'}`
      ],
      total,
      cats: dims.order.map(key => {
        const vals = rows.map(r => dims.scoreOf(r, key));
        return {
          key,
          name: dims.nameOf(key),
          score: vals.length ? Math.round(dashAvg(vals)) : 0,
          avgRed: Math.round(netAvg[key] || 0),
          weight: dims.weightOf(key)
        };
      })
    };
  } else {
    const row = rows.find(r => r.id === _dashIndSelectedId);
    if (!row) {
      detailBox.innerHTML = '';
      if (_dashCharts.indRadar) { _dashCharts.indRadar.destroy(); _dashCharts.indRadar = null; }
      return;
    }
    const isAdmin = !!currentUser?.user_metadata?.is_admin;
    const nombre = row.nombre_distribuidor || row.nombre || 'Distribuidor';
    const fecha = row.fecha ? new Date(row.fecha).toLocaleDateString('es-AR')
      : (row.updated_at ? new Date(row.updated_at).toLocaleDateString('es-AR') : 's/f');
    const cargadoPor = row.user_email || row.vendedor || '';
    const metaBits = [
      `CUIT ${dashEscapeHtml(row.cuit || 's/d')}`,
      `BU ${dashEscapeHtml(row.bu || 's/d')} · Squad ${dashEscapeHtml(row.squad || 's/d')}`,
      `Assessment ${dashEscapeHtml(fecha)}`
    ];
    if (isAdmin && cargadoPor) metaBits.push(`Cargado por ${dashEscapeHtml(cargadoPor)}`);
    subject = {
      isAggregate: false,
      nombre,
      metaBits,
      total: dashGetResultTotal(row),
      cats: dims.order.map(key => ({
        key,
        name: dims.nameOf(key),
        score: dims.scoreOf(row, key),
        avgRed: Math.round(netAvg[key] || 0),
        weight: dims.weightOf(key)
      }))
    };
  }

  const totalClass = dashScoreClass(subject.total);
  const sortedCats = subject.cats.slice().sort((a, b) => b.score - a.score);
  // Evitamos que una misma dimensión aparezca en Fortalezas y en Brechas:
  // en modo pilar hay 3 dimensiones (top 2, bottom 1); en competencias hay 9 (top 3, bottom 3).
  const nDims = sortedCats.length;
  const topN_ct = dims.mode === 'pilar' ? Math.ceil(nDims / 2) : 3;
  const bottomN_ct = dims.mode === 'pilar' ? Math.max(0, nDims - topN_ct) : 3;
  const topN = sortedCats.slice(0, topN_ct);
  const bottomN = bottomN_ct > 0 ? sortedCats.slice(-bottomN_ct).reverse() : [];

  const barRow = (c) => {
    const cls = dashScoreClass(c.score);
    const short = dims.radarOf(c.key);
    const d = c.score - c.avgRed;
    const dCls = d >= 3 ? 'pos' : d <= -3 ? 'neg' : 'neu';
    const dText = d > 0 ? `+${d}` : `${d}`;
    return `
      <div class="dash-comp-row">
        <div class="lab" title="${dashEscapeHtml(c.name)}">${dashEscapeHtml(short)}</div>
        <div class="track"><div class="fill ${cls}" style="width:${Math.max(c.score, 8)}%">${c.score}%</div></div>
        <div class="val">${c.score}%</div>
        <div class="delta ${dCls}">${dText}</div>
      </div>
    `;
  };

  const bulletItem = (c) => `<li><strong>${dashEscapeHtml(c.name)}:</strong> ${c.score}%</li>`;

  const totalLabel = subject.isAggregate ? 'Promedio' : 'Total';
  const seriesLabel = subject.isAggregate ? 'Promedio alcance' : subject.nombre;

  detailBox.innerHTML = `
    <div class="dash-ind-header">
      <div>
        <div class="dash-ind-name">${dashEscapeHtml(subject.nombre)}</div>
        <div class="dash-ind-meta">${subject.metaBits.join(' · ')}</div>
      </div>
      <div class="dash-ind-pill ${totalClass}">${totalLabel} ${subject.total}%</div>
    </div>

    <div class="dash-ind-body" data-view-mode="${dims.mode}">
      <div class="dash-ind-radar-box"><canvas id="dash-ind-radar"></canvas></div>
      <div>
        <div class="dash-comp-list">
          ${subject.cats.map(barRow).join('')}
        </div>
        <div class="dash-comp-list-foot">Δ vs. promedio de ${dashNetShort()} (${_dashIndNetworkTotalAvg}%)</div>
      </div>
    </div>

    <div class="dash-ind-highlights">
      <div class="dash-side-card strengths">
        <h3>Fortalezas</h3>
        <ul>${topN.map(bulletItem).join('')}</ul>
      </div>
      <div class="dash-side-card gaps">
        <h3>Brechas / foco</h3>
        <ul>${bottomN.map(bulletItem).join('')}</ul>
      </div>
    </div>
  `;

  // Radar Chart: sujeto vs promedio red completa
  if (_dashCharts.indRadar) _dashCharts.indRadar.destroy();
  const radarLabels = dims.order.map(k => dims.radarOf(k));
  const radarSubj = dims.order.map(k => subject.cats.find(c => c.key === k)?.score || 0);
  const radarRed = dims.order.map(k => Math.round(netAvg[k] || 0));
  _dashCharts.indRadar = new Chart(document.getElementById('dash-ind-radar'), {
    type: 'radar',
    data: {
      labels: radarLabels,
      datasets: [
        {
          label: seriesLabel,
          data: radarSubj,
          backgroundColor: 'rgba(0, 145, 223, 0.20)',
          borderColor: 'rgba(0, 145, 223, 0.95)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(16, 56, 79, 1)',
          pointRadius: 3
        },
        {
          label: dashNetAvgShort(),
          data: radarRed,
          backgroundColor: 'rgba(102, 181, 18, 0.10)',
          borderColor: 'rgba(102, 181, 18, 0.9)',
          borderWidth: 2,
          borderDash: [4, 4],
          pointBackgroundColor: 'rgba(102, 181, 18, 1)',
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${i.parsed.r}%` } }
      },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 20, font: { size: 10 }, color: '#888' },
          pointLabels: { font: { size: 11 }, color: '#555' }
        }
      }
    }
  });

  // Estado de la card de IA por distribuidor
  const aiBtn = document.getElementById('dash-ind-ai-btn');
  if (aiNotes && aiMeta) {
    if (subject.isAggregate) {
      aiNotes.innerHTML = '<p style="color:var(--medium-text)">La lectura ejecutiva de IA aplica sobre un distribuidor específico. Elegí uno en el selector de arriba para generar el análisis individual. Para una lectura del conjunto usá la solapa <strong>General</strong>.</p>';
      aiMeta.textContent = '';
      if (aiBtn) aiBtn.disabled = true;
    } else {
      if (aiBtn) aiBtn.disabled = false;
      if (_dashIndAiCache && _dashIndAiCache.id === _dashIndSelectedId) {
        applyIndividualSections(_dashIndAiCache.sections, _dashIndAiCache.generated_at, _dashIndAiCache.model, `IA (${_dashIndAiCache.model}) · cache`);
      } else {
        aiNotes.innerHTML = '<p style="color:var(--medium-text)">Buscando lectura guardada o presioná <strong>Generar</strong>...</p>';
        aiMeta.textContent = '';
        // Intento cargar la última lectura persistida para este distribuidor
        // (con validación de hash del payload) sin disparar el edge function.
        const idAtStart = _dashIndSelectedId;
        (async () => {
          try {
            const rowSel = dashRowsInScope().find(r => r.id === idAtStart);
            if (!rowSel) return;
            const cats = DASH_CATEGORY_ORDER.map(name => ({
              name,
              score: dashGetCategoryScore(rowSel, name),
              avgRed: Math.round(_dashIndNetworkAvg[name] || 0),
              weight: DASH_COMPETENCE_WEIGHTS[name] || 0
            }));
            const payload = buildIndividualPayload(rowSel, cats, _dashIndNetworkTotalAvg);
            const hash = aiHashPayload(payload);
            const persisted = await loadPersistedAiAnalysis('individual', idAtStart, hash);
            // Si el usuario cambió de distribuidor mientras esperábamos, no pisamos la vista
            if (_dashIndSelectedId !== idAtStart) return;
            if (persisted && Array.isArray(persisted.sections) && persisted.sections.length) {
              _dashIndAiCache = {
                id: idAtStart,
                sections: persisted.sections,
                model: persisted.model,
                generated_at: persisted.generated_at
              };
              const age = aiFormatRelativeAge(persisted.generated_at);
              applyIndividualSections(
                persisted.sections,
                persisted.generated_at,
                persisted.model,
                `IA (${persisted.model || 'gpt-4o-mini'}) · guardada${age ? ' · ' + age : ''}`
              );
            } else {
              aiNotes.innerHTML = '<p style="color:var(--medium-text)">Presioná <strong>Generar</strong> para obtener una lectura ejecutiva de este distribuidor en particular.</p>';
            }
          } catch (_e) {
            if (_dashIndSelectedId === idAtStart) {
              aiNotes.innerHTML = '<p style="color:var(--medium-text)">Presioná <strong>Generar</strong> para obtener una lectura ejecutiva de este distribuidor en particular.</p>';
            }
          }
        })();
      }
    }
  }
}

function _dashBuildSquadAggregates(rows) {
  const dims = dashDimensions();
  const map = new Map();
  rows.forEach(r => {
    const key = `${r.bu || 's/d'}||${r.squad || 's/d'}`;
    if (!map.has(key)) {
      map.set(key, {
        bu: r.bu || 's/d',
        squad: r.squad || 's/d',
        rows: []
      });
    }
    map.get(key).rows.push(r);
  });
  return Array.from(map.values()).map(g => {
    const totales = g.rows.map(r => dashGetResultTotal(r));
    const total = totales.length ? Math.round(dashAvg(totales)) : 0;
    const comp = {};
    dims.order.forEach(key => {
      const vals = g.rows.map(r => dims.scoreOf(r, key));
      comp[key] = vals.length ? Math.round(dashAvg(vals)) : 0;
    });
    return { bu: g.bu, squad: g.squad, count: g.rows.length, total, comp };
  }).sort((a, b) => b.total - a.total);
}

function renderDashSquadCompare(rows) {
  const canvas = document.getElementById('dash-chart-squad-compare');
  const box = document.getElementById('dash-squad-compare-box');
  const sub = document.getElementById('dash-squad-compare-sub');
  if (!canvas || !box) return;

  const groups = _dashBuildSquadAggregates(rows);
  if (!groups.length) {
    box.style.display = 'none';
    if (sub) sub.textContent = 'Sin distribuidores evaluados en el alcance actual.';
    if (_dashCharts.squadCompare) { _dashCharts.squadCompare.destroy(); _dashCharts.squadCompare = null; }
    return;
  }
  box.style.display = '';
  if (sub) sub.textContent = 'Promedio total de cada squad en el alcance actual. Verde ≥ 80%, amarillo 70-79%, rojo < 70%.';

  const labels = groups.map(g => `${g.squad} (${g.bu})`);
  const values = groups.map(g => g.total);
  const bg = values.map(v => v >= 80 ? '#2e7d32' : v >= 70 ? '#f9a825' : '#d32f2f');

  if (_dashCharts.squadCompare) _dashCharts.squadCompare.destroy();
  _dashCharts.squadCompare = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Promedio total',
        data: values,
        backgroundColor: bg,
        borderRadius: 4,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (i) => `${i.parsed.x}%` } }
      },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: v => `${v}` }, grid: { color: '#eee' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function renderDashSquadHeatmap(rows) {
  const table = document.getElementById('dash-squad-heatmap');
  if (!table) return;

  const dims = dashDimensions();
  const groups = _dashBuildSquadAggregates(rows);
  if (!groups.length) {
    table.innerHTML = '<tbody><tr><td class="hm-empty" style="padding:16px; text-align:center;">Sin datos para el alcance actual.</td></tr></tbody>';
    return;
  }

  const cellClass = (v) => {
    if (!v) return 'hm-empty';
    if (v >= 80) return 'hm-high';
    if (v >= 70) return 'hm-mid';
    return 'hm-low';
  };

  const head = `
    <colgroup>
      <col class="hm-col-squad" />
      <col class="hm-col-bu" />
      <col class="hm-col-count" />
      <col class="hm-col-total" />
      ${dims.order.map(() => `<col class="hm-col-comp" />`).join('')}
    </colgroup>
    <thead>
      <tr>
        <th>Squad</th>
        <th>BU</th>
        <th>#</th>
        <th>Total</th>
        ${dims.order.map(k => `<th title="${dashEscapeHtml(dims.nameOf(k))}">${dashEscapeHtml(dims.radarOf(k))}</th>`).join('')}
      </tr>
    </thead>
  `;

  const body = `
    <tbody>
      ${groups.map(g => `
        <tr>
          <td class="name">${dashEscapeHtml(g.squad)}</td>
          <td class="bu">${dashEscapeHtml(g.bu)}</td>
          <td class="count">${g.count}</td>
          <td class="${cellClass(g.total)}">${g.total}</td>
          ${dims.order.map(k => {
            const v = g.comp[k];
            return `<td class="${cellClass(v)}">${v}</td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  table.innerHTML = head + body;
}

// =============================================================
// DASHBOARD · SUB-TAB "MATRIZ COMPARATIVA"
// =============================================================

function dashNormalizeText(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderDashMatrix(rows) {
  _dashMatRowsCache = Array.isArray(rows) ? rows.slice() : [];
  renderDashMatrixTable();
}

function renderDashMatrixTable() {
  const table = document.getElementById('dash-matrix-table');
  const emptyBox = document.getElementById('dash-mat-empty');
  const countEl = document.getElementById('dash-mat-count');
  if (!table) return;

  const dims = dashDimensions();

  const q = dashNormalizeText(_dashMatSearch);
  let list = _dashMatRowsCache.slice().filter(r => {
    if (!q) return true;
    const nombre = dashNormalizeText(r.nombre_distribuidor || r.nombre);
    const cuit = dashNormalizeText(r.cuit);
    return nombre.includes(q) || cuit.includes(q);
  });

  const sortKey = _dashMatSort || 'total_desc';
  const nameOf = r => r.nombre_distribuidor || r.nombre || '';
  if (sortKey === 'name_asc') {
    list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));
  } else if (sortKey === 'name_desc') {
    list.sort((a, b) => nameOf(b).localeCompare(nameOf(a), 'es'));
  } else if (sortKey === 'total_asc') {
    list.sort((a, b) => dashGetResultTotal(a) - dashGetResultTotal(b));
  } else {
    list.sort((a, b) => dashGetResultTotal(b) - dashGetResultTotal(a));
  }

  if (countEl) {
    const total = _dashMatRowsCache.length;
    countEl.textContent = q
      ? `${list.length} de ${total} distribuidor${total === 1 ? '' : 'es'}`
      : `${total} distribuidor${total === 1 ? '' : 'es'}`;
  }

  if (!list.length) {
    table.innerHTML = '';
    if (emptyBox) emptyBox.style.display = '';
    return;
  }
  if (emptyBox) emptyBox.style.display = 'none';

  const pillClass = (v) => {
    if (!v && v !== 0) return 'empty';
    if (v >= 80) return 'high';
    if (v >= 70) return 'mid';
    return 'low';
  };

  const head = `
    <colgroup>
      <col class="mx-col-name" />
      <col class="mx-col-bu" />
      <col class="mx-col-total" />
      ${dims.order.map(() => `<col class="mx-col-comp" />`).join('')}
    </colgroup>
    <thead>
      <tr>
        <th>Distribuidor</th>
        <th>BU / Squad</th>
        <th>Total</th>
        ${dims.order.map(k => `<th title="${dashEscapeHtml(dims.nameOf(k))}">${dashEscapeHtml(dims.radarOf(k))}</th>`).join('')}
      </tr>
    </thead>
  `;

  const body = `
    <tbody>
      ${list.map(r => {
        const nombre = dashEscapeHtml(nameOf(r) || 'Sin nombre');
        const bu = dashEscapeHtml(r.bu || 's/d');
        const squad = dashEscapeHtml(r.squad || 's/d');
        const total = dashGetResultTotal(r);
        const totalPill = `<span class="mx-pill ${pillClass(total)}">${total}%</span>`;
        const cats = dims.order.map(k => {
          const v = dims.scoreOf(r, k);
          return `<td><span class="mx-pill ${pillClass(v)}">${v}%</span></td>`;
        }).join('');
        return `
          <tr>
            <td class="mx-name">${nombre}</td>
            <td class="mx-bu">${bu} / ${squad}</td>
            <td>${totalPill}</td>
            ${cats}
          </tr>
        `;
      }).join('')}
    </tbody>
  `;

  table.innerHTML = head + body;
}

// =============================================================
// DASHBOARD · SUB-TAB "RANKINGS"
// =============================================================

function renderDashRankings(rows) {
  const topBox = document.getElementById('dash-rank-top');
  const botBox = document.getElementById('dash-rank-bot');
  const topSub = document.getElementById('dash-rank-top-sub');
  const botSub = document.getElementById('dash-rank-bot-sub');
  const leadersTable = document.getElementById('dash-rank-leaders');
  if (!topBox || !botBox || !leadersTable) return;

  const list = Array.isArray(rows) ? rows.slice() : [];
  if (!list.length) {
    topBox.innerHTML = '<div class="dash-empty" style="padding:12px;">Sin datos en el alcance actual.</div>';
    botBox.innerHTML = '<div class="dash-empty" style="padding:12px;">Sin datos en el alcance actual.</div>';
    leadersTable.innerHTML = '';
    if (topSub) topSub.textContent = 'Mayor score total del alcance actual.';
    if (botSub) botSub.textContent = 'Menor score total del alcance actual. Foco de acompañamiento.';
    return;
  }

  const sorted = list.slice().sort((a, b) => dashGetResultTotal(b) - dashGetResultTotal(a));
  const top = sorted.slice(0, 10);
  const bot = sorted.slice(-10).reverse(); // peor primero
  const totalN = sorted.length;
  const topN = top.length;
  const botN = bot.length;

  if (topSub) topSub.textContent = totalN <= 10
    ? `Ranking completo de los ${totalN} distribuidores del alcance actual.`
    : `Los mejores ${topN} de ${totalN} distribuidores del alcance actual.`;
  if (botSub) botSub.textContent = totalN <= 10
    ? `Los mismos ${totalN} distribuidores, ordenados de menor a mayor.`
    : `Los ${botN} distribuidores con menor score de un total de ${totalN}. Foco de acompañamiento.`;

  const rowCard = (r, pos) => {
    const total = dashGetResultTotal(r);
    const cls = dashScoreClass(total);
    const nombre = dashEscapeHtml(r.nombre_distribuidor || r.nombre || 'Sin nombre');
    const bu = dashEscapeHtml(r.bu || 's/d');
    const squad = dashEscapeHtml(r.squad || 's/d');
    return `
      <div class="dash-rank-row">
        <div class="rk-pos">#${pos}</div>
        <div>
          <div class="rk-name">${nombre}</div>
          <div class="rk-meta">${bu} · ${squad}</div>
        </div>
        <div class="rk-pill ${cls}">${total}%</div>
      </div>
    `;
  };

  topBox.innerHTML = top.map((r, i) => rowCard(r, i + 1)).join('');
  botBox.innerHTML = bot.map((r, i) => rowCard(r, totalN - i)).join('');

  // Líderes por competencia (o por pilar, según el toggle)
  const dims = dashDimensions();
  const leaders = dims.order.map(key => {
    const best = sorted.slice().sort((a, b) => dims.scoreOf(b, key) - dims.scoreOf(a, key))[0];
    return { key, name: dims.nameOf(key), short: dims.shortOf(key), best, score: best ? dims.scoreOf(best, key) : 0 };
  });

  leadersTable.innerHTML = `
    <thead>
      <tr>
        <th>${dims.mode === 'pilar' ? 'Pilar' : 'Competencia'}</th>
        <th>Líder</th>
        <th>Score</th>
        <th>BU / Squad</th>
      </tr>
    </thead>
    <tbody>
      ${leaders.map(l => {
        if (!l.best) return '';
        const cls = dashScoreClass(l.score);
        const nombre = dashEscapeHtml(l.best.nombre_distribuidor || l.best.nombre || 'Sin nombre');
        const bu = dashEscapeHtml(l.best.bu || 's/d');
        const squad = dashEscapeHtml(l.best.squad || 's/d');
        return `
          <tr>
            <td class="ld-comp" title="${dashEscapeHtml(l.name)}">${dashEscapeHtml(l.short)}</td>
            <td class="ld-name">${nombre}</td>
            <td class="ld-score"><span class="ld-pill ${cls}">${l.score}%</span></td>
            <td class="ld-bu">${bu} / ${squad}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
}

// =============================================================
// DASHBOARD · SUB-TAB "COMPETENCIAS"
// =============================================================

function renderDashCompetencias(rows) {
  const sel = document.getElementById('dash-comp-select');
  const selDist = document.getElementById('dash-comp-dist');
  const emptyBox = document.getElementById('dash-comp-empty');
  const detailBox = document.getElementById('dash-comp-detail');
  if (!sel || !selDist || !detailBox) return;

  // Poblar select de competencias una sola vez (o cuando esté vacío)
  if (!sel.options.length) {
    sel.innerHTML = DASH_CATEGORY_ORDER.map(name => {
      const short = DASH_CATEGORY_RADAR_LABEL[name] || name;
      return `<option value="${dashEscapeHtml(name)}">${dashEscapeHtml(short)}</option>`;
    }).join('');
  }
  // Selección persistida o default a la primera
  if (!_dashCompSelected || !DASH_CATEGORY_ORDER.includes(_dashCompSelected)) {
    _dashCompSelected = DASH_CATEGORY_ORDER[0];
  }
  sel.value = _dashCompSelected;

  const list = Array.isArray(rows) ? rows.slice() : [];

  if (!list.length) {
    selDist.innerHTML = '<option value="__all__">Sin distribuidores</option>';
    if (typeof selDist._searchableSync === 'function') selDist._searchableSync();
    if (emptyBox) emptyBox.style.display = '';
    detailBox.innerHTML = '';
    if (_dashCharts.compSquad) { _dashCharts.compSquad.destroy(); _dashCharts.compSquad = null; }
    const findingsEl = document.getElementById('dash-comp-findings');
    if (findingsEl) findingsEl.innerHTML = '<p style="color:var(--medium-text)">Sin datos en el alcance actual.</p>';
    return;
  }
  if (emptyBox) emptyBox.style.display = 'none';

  // Poblar select de distribuidor (opcional): "Todos" + lista ordenada por score de la competencia elegida
  const sortedByComp = list.slice().sort((a, b) =>
    dashGetCategoryScore(b, _dashCompSelected) - dashGetCategoryScore(a, _dashCompSelected)
  );
  const buSelVal = document.getElementById('dash-bu')?.value || '';
  const squadSelVal = document.getElementById('dash-squad')?.value || '';
  let allLabel = 'Todos los distribuidores';
  if (squadSelVal) allLabel = `Todos los distribuidores del squad ${squadSelVal}`;
  else if (buSelVal) allLabel = `Todos los distribuidores de BU ${buSelVal}`;
  else allLabel = 'Todos los distribuidores de la red';

  const prevDist = _dashCompDistId;
  selDist.innerHTML = [`<option value="__all__">${dashEscapeHtml(allLabel)} (${sortedByComp.length})</option>`]
    .concat(sortedByComp.map(r => {
      const nombre = r.nombre_distribuidor || r.nombre || 'Sin nombre';
      return `<option value="${r.id}">${dashEscapeHtml(nombre)}</option>`;
    })).join('');
  if (prevDist === '__all__' || sortedByComp.some(r => r.id === prevDist)) {
    selDist.value = prevDist;
  } else {
    selDist.value = '__all__';
  }
  _dashCompDistId = selDist.value;

  enhanceSearchableSelect(selDist, { placeholder: 'Buscá un distribuidor…' });

  renderDashCompetenciaDetail();
}

function renderDashCompetenciaDetail() {
  const detailBox = document.getElementById('dash-comp-detail');
  if (!detailBox) return;

  const rows = dashRowsInScope();
  const compName = _dashCompSelected;
  if (!compName || !rows.length) {
    detailBox.innerHTML = '';
    if (_dashCharts.compSquad) { _dashCharts.compSquad.destroy(); _dashCharts.compSquad = null; }
    return;
  }

  const compShort = DASH_CATEGORY_RADAR_LABEL[compName] || compName;
  const compWeight = DASH_COMPETENCE_WEIGHTS[compName] || 0;
  const isSingle = _dashCompDistId && _dashCompDistId !== '__all__';
  const singleRow = isSingle ? rows.find(r => r.id === _dashCompDistId) : null;

  const scores = rows.map(r => dashGetCategoryScore(r, compName));
  const scopeAvg = scores.length ? Math.round(dashAvg(scores)) : 0;
  const netAvg = Math.round(_dashIndNetworkAvg[compName] || 0);
  const highCount = scores.filter(v => v >= 80).length;
  const midCount = scores.filter(v => v >= 70 && v < 80).length;
  const lowCount = scores.filter(v => v < 70).length;
  const maxCount = Math.max(highCount, midCount, lowCount, 1);

  // Header: si hay distribuidor puntual, mostrar su nombre y score en esta competencia;
  // si no, mostrar promedio del scope.
  let headerHtml;
  if (singleRow) {
    const nombre = dashEscapeHtml(singleRow.nombre_distribuidor || singleRow.nombre || 'Distribuidor');
    const bu = dashEscapeHtml(singleRow.bu || 's/d');
    const squad = dashEscapeHtml(singleRow.squad || 's/d');
    const sVal = dashGetCategoryScore(singleRow, compName);
    const cls = dashScoreClass(sVal);
    headerHtml = `
      <div class="dash-comp-header">
        <div>
          <div class="cph-name">${nombre} · ${dashEscapeHtml(compShort)}</div>
          <div class="cph-meta">BU ${bu} · Squad ${squad} · peso ${compWeight}%</div>
        </div>
        <div class="cph-pill ${cls}">${sVal}%</div>
      </div>
    `;
  } else {
    const buSelVal = document.getElementById('dash-bu')?.value || '';
    const squadSelVal = document.getElementById('dash-squad')?.value || '';
    let scopeLabel;
    if (squadSelVal) scopeLabel = `Squad ${squadSelVal}${buSelVal ? ' · BU ' + buSelVal : ''}`;
    else if (buSelVal) scopeLabel = `BU ${buSelVal}`;
    else scopeLabel = dashNetLabel();
    const cls = dashScoreClass(scopeAvg);
    headerHtml = `
      <div class="dash-comp-header">
        <div>
          <div class="cph-name">${dashEscapeHtml(compShort)} · ${dashEscapeHtml(scopeLabel)}</div>
          <div class="cph-meta">${rows.length} distribuidores evaluados · peso ${compWeight}%</div>
        </div>
        <div class="cph-pill ${cls}">${scopeAvg}%</div>
      </div>
    `;
  }

  // KPIs: promedio scope, promedio red, delta, alta/media/baja
  const focusVal = singleRow ? dashGetCategoryScore(singleRow, compName) : scopeAvg;
  const diff = focusVal - netAvg;
  const dCls = diff >= 3 ? 'pos' : diff <= -3 ? 'neg' : 'neu';
  const dText = diff > 0 ? `+${diff}` : `${diff}`;
  const kpisHtml = `
    <div class="dash-comp-kpis">
      <div class="kpi-tile">
        <div class="v">${focusVal}%</div>
        <div class="l">${singleRow ? 'Score del distribuidor' : 'Promedio del alcance'}</div>
        <div class="d ${dCls}">${dText} pts vs. ${dashNetShort()}</div>
      </div>
      <div class="kpi-tile">
        <div class="v">${netAvg}%</div>
        <div class="l">${dashNetAvgLabel()}</div>
        <div class="d neu">Baseline</div>
      </div>
      <div class="kpi-tile">
        <div class="v">${highCount}</div>
        <div class="l">Alta (≥ 80)</div>
        <div class="d neu">de ${rows.length} distribuidores</div>
      </div>
      <div class="kpi-tile">
        <div class="v">${lowCount}</div>
        <div class="l">Baja (&lt; 70)</div>
        <div class="d neu">requieren foco</div>
      </div>
    </div>
  `;

  // Distribución de madurez
  const bucketBar = (label, val, cls) => `
    <div class="dash-comp-bucket">
      <div class="b-lab">${label}</div>
      <div class="b-track"><div class="b-fill ${cls}" style="width:${Math.round((val / maxCount) * 100)}%"></div></div>
      <div class="b-val">${val}</div>
    </div>
  `;
  const bucketsHtml = `
    <div class="dash-comp-side">
      <h3>Distribución de madurez</h3>
      ${bucketBar('Alta (≥80)', highCount, 'high')}
      ${bucketBar('Media (70-79)', midCount, 'mid')}
      ${bucketBar('Baja (&lt;70)', lowCount, 'low')}
    </div>
  `;

  // Ranking en la competencia: top y bottom del scope. Repartimos los slots
  // para que "Mejores" y "A mejorar" nunca se pisen: si hay 3 distribuidores,
  // top=2 y bottom=1; con 4, 2 y 2; con 10, 5 y 5.
  const sortedRows = rows.slice().sort((a, b) => dashGetCategoryScore(b, compName) - dashGetCategoryScore(a, compName));
  const nRanked = sortedRows.length;
  const topN = Math.min(5, Math.ceil(nRanked / 2));
  const bottomN = Math.min(5, Math.max(0, nRanked - topN));
  const top5 = sortedRows.slice(0, topN);
  const bottom5 = sortedRows.slice(nRanked - bottomN).reverse();
  const rankRow = (r, pos) => {
    const v = dashGetCategoryScore(r, compName);
    const cls = dashScoreClass(v);
    return `
      <div class="dash-comp-rank-row">
        <div class="crr-pos">#${pos}</div>
        <div>
          <div class="crr-name">${dashEscapeHtml(r.nombre_distribuidor || r.nombre || 'Sin nombre')}</div>
          <div class="crr-meta">${dashEscapeHtml(r.bu || 's/d')} · ${dashEscapeHtml(r.squad || 's/d')}</div>
        </div>
        <div class="crr-pill ${cls}">${v}%</div>
      </div>
    `;
  };
  const topHtml = top5.length ? `
    <div class="dash-comp-side">
      <h3>Mejores en ${dashEscapeHtml(compShort)}</h3>
      <div class="dash-comp-rank">${top5.map((r, i) => rankRow(r, i + 1)).join('')}</div>
    </div>
  ` : '';
  const bottomHtml = bottom5.length ? `
    <div class="dash-comp-side">
      <h3>A mejorar</h3>
      <div class="dash-comp-rank">${bottom5.map((r, i) => rankRow(r, nRanked - i)).join('')}</div>
    </div>
  ` : '';

  detailBox.innerHTML = `
    ${headerHtml}
    ${kpisHtml}
    ${bucketsHtml}
    <div class="dash-comp-two dash-comp-rankings">
      ${topHtml}
      ${bottomHtml}
    </div>
  `;

  renderDashCompetenciaSquadChart(rows, compName);
  renderDashCompetenciaQuestions(rows, compName, singleRow);
  renderDashCompetenciaFindings(rows, compName);
}

function renderDashCompetenciaSquadChart(rows, compName) {
  const canvas = document.getElementById('dash-chart-comp-squad');
  const sub = document.getElementById('dash-comp-squad-sub');
  if (!canvas) return;

  // Agrupar por squad + calcular promedio de la competencia
  const map = new Map();
  rows.forEach(r => {
    const key = `${r.bu || 's/d'}||${r.squad || 's/d'}`;
    if (!map.has(key)) map.set(key, { bu: r.bu || 's/d', squad: r.squad || 's/d', vals: [] });
    map.get(key).vals.push(dashGetCategoryScore(r, compName));
  });
  const groups = Array.from(map.values()).map(g => ({
    bu: g.bu,
    squad: g.squad,
    count: g.vals.length,
    avg: g.vals.length ? Math.round(dashAvg(g.vals)) : 0
  })).sort((a, b) => b.avg - a.avg);

  const compShort = DASH_CATEGORY_RADAR_LABEL[compName] || compName;
  if (sub) sub.textContent = `Promedio de "${compShort}" por squad en el alcance actual. Verde ≥ 80%, amarillo 70-79%, rojo < 70%.`;

  if (_dashCharts.compSquad) _dashCharts.compSquad.destroy();
  if (!groups.length) return;

  const labels = groups.map(g => `${g.squad} (${g.bu})`);
  const values = groups.map(g => g.avg);
  const bg = values.map(v => v >= 80 ? '#2e7d32' : v >= 70 ? '#f9a825' : '#d32f2f');

  _dashCharts.compSquad = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: compShort,
        data: values,
        backgroundColor: bg,
        borderRadius: 4,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (i) => `${i.parsed.x}%` } }
      },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: v => `${v}` }, grid: { color: '#eee' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// Devuelve la categoría de ASSESSMENT_DATA que corresponde al nombre de la
// competencia usado en el dashboard (comparación tolerante a espacios).
function dashFindCategoryDef(compName) {
  if (typeof ASSESSMENT_DATA === 'undefined' || !ASSESSMENT_DATA.categories) return null;
  const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  const target = norm(compName);
  return ASSESSMENT_DATA.categories.find(c => norm(c.name) === target) || null;
}

// Traduce 'alto'/'mediano'/'bajo' → objeto de estilo/etiqueta.
function dashCqLevelInfo(level) {
  if (level === 'alto')    return { cls: 'high',  label: 'Alto',    val: 1.0 };
  if (level === 'mediano') return { cls: 'mid',   label: 'Mediano', val: 0.5 };
  if (level === 'bajo')    return { cls: 'low',   label: 'Bajo',    val: 0.0 };
  return { cls: 'empty', label: 'Sin dato', val: null };
}

function renderDashCompetenciaQuestions(rows, compName, singleRow) {
  const canvas = document.getElementById('dash-chart-comp-questions');
  const empty = document.getElementById('dash-comp-questions-empty');
  const box = document.getElementById('dash-comp-questions-box');
  const sub = document.getElementById('dash-comp-questions-sub');
  const obsCard = document.getElementById('dash-comp-obs-card');
  if (!canvas) return;

  const cat = dashFindCategoryDef(compName);
  if (!cat || !Array.isArray(cat.questions) || !cat.questions.length) {
    if (_dashCharts.compQuestions) { _dashCharts.compQuestions.destroy(); _dashCharts.compQuestions = null; }
    if (box) box.style.display = 'none';
    if (empty) { empty.style.display = 'block'; empty.textContent = 'No se encontraron preguntas definidas para esta competencia.'; }
    if (sub) sub.textContent = '';
    if (obsCard) obsCard.style.display = 'none';
    return;
  }

  const compShort = DASH_CATEGORY_RADAR_LABEL[compName] || compName;
  const questions = cat.questions;

  // Baseline: SIEMPRE contra el promedio de la red completa (todos los completados)
  const fullRed = dashDedupeByCuit(_dashCompleted);

  // Promedio por pregunta ignorando respuestas vacías (val ∈ {0, 0.5, 1} → %)
  function avgPct(list, qid) {
    let sum = 0, n = 0;
    list.forEach(r => {
      const answers = migrateAnswersFormat((r.payload && r.payload.answers) || {});
      const v = answers[qid]?.value;
      if (v === 'alto')    { sum += 100; n++; }
      else if (v === 'mediano') { sum += 50; n++; }
      else if (v === 'bajo')    { sum += 0;  n++; }
    });
    return n ? Math.round(sum / n) : null;
  }

  // Valor puntual (0/50/100) del distribuidor para una pregunta
  function singleValue(row, qid) {
    const answers = migrateAnswersFormat((row.payload && row.payload.answers) || {});
    const v = answers[qid]?.value;
    if (v === 'alto') return 100;
    if (v === 'mediano') return 50;
    if (v === 'bajo') return 0;
    return null;
  }

  // Calcular valores por pregunta (preservando null como "sin dato")
  const perQuestion = questions.map(q => ({
    q,
    scope: singleRow ? singleValue(singleRow, q.id) : avgPct(rows, q.id),
    red: avgPct(fullRed, q.id)
  }));

  // Ordenar: rojos arriba, verdes abajo. Los "sin dato" (null) van al final.
  // Chart.js con indexAxis='y' pone el primer label arriba.
  perQuestion.sort((a, b) => {
    const av = a.scope == null ? Infinity : a.scope;
    const bv = b.scope == null ? Infinity : b.scope;
    return av - bv;
  });

  const labels = perQuestion.map(p => p.q.aspecto || p.q.id);
  const redVals = perQuestion.map(p => p.red);
  const scopeVals = perQuestion.map(p => p.scope);

  let scopeLabel;
  if (singleRow) {
    const nombre = singleRow.nombre_distribuidor || singleRow.nombre || 'Distribuidor';
    scopeLabel = nombre;
    if (sub) sub.textContent = `Respuestas de ${nombre} vs promedio de ${dashNetShort()} en cada pregunta de "${compShort}" (ordenado de peor a mejor).`;
  } else {
    scopeLabel = `Alcance actual (${rows.length} distribuidor${rows.length === 1 ? '' : 'es'})`;
    if (sub) sub.textContent = `Promedio del alcance vs ${dashNetShort()} en cada pregunta de "${compShort}" (ordenado de peor a mejor).`;
  }

  if (box) box.style.display = '';
  if (empty) empty.style.display = 'none';

  // Altura dinámica: 40px por pregunta, mínimo 300
  if (box) box.style.height = `${Math.max(300, questions.length * 46)}px`;

  if (_dashCharts.compQuestions) _dashCharts.compQuestions.destroy();
  _dashCharts.compQuestions = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: scopeLabel,
          data: scopeVals,
          backgroundColor: scopeVals.map(v =>
            v == null ? '#cfd8dc' : v >= 80 ? '#2e7d32' : v >= 70 ? '#f9a825' : '#d32f2f'
          ),
          borderRadius: 4,
          barPercentage: 0.9,
          categoryPercentage: 0.55
        },
        {
          label: dashNetAvgLabel(),
          data: redVals,
          backgroundColor: '#90a4ae',
          borderRadius: 4,
          barPercentage: 0.9,
          categoryPercentage: 0.55
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (i) => {
              const raw = i.dataset.data[i.dataIndex];
              if (raw == null) return `${i.dataset.label}: sin dato`;
              if (i.datasetIndex === 0) {
                const red = redVals[i.dataIndex];
                if (red == null) return `${i.dataset.label}: ${raw}%`;
                const diff = raw - red;
                const sign = diff > 0 ? `+${diff}` : `${diff}`;
                return `${i.dataset.label}: ${raw}%  (${sign} pts vs red)`;
              }
              return `${i.dataset.label}: ${raw}%`;
            }
          }
        }
      },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: v => `${v}` }, grid: { color: '#eee' } },
        y: {
          ticks: {
            font: { size: 11 },
            callback: function (val) {
              const label = this.getLabelForValue(val);
              return label.length > 55 ? label.slice(0, 52) + '…' : label;
            }
          },
          grid: { display: false }
        }
      }
    }
  });

  // Card de observaciones sólo cuando hay distribuidor puntual
  renderDashCompetenciaObservations(compName, singleRow);
}

function renderDashCompetenciaObservations(compName, singleRow) {
  const card = document.getElementById('dash-comp-obs-card');
  const sumEl = document.getElementById('dash-comp-obs-summary');
  const metaEl = document.getElementById('dash-comp-obs-meta');
  const btn = document.getElementById('dash-comp-obs-btn');
  if (!card) return;

  if (!singleRow) {
    card.style.display = 'none';
    return;
  }

  const cat = dashFindCategoryDef(compName);
  if (!cat) { card.style.display = 'none'; return; }

  const answers = migrateAnswersFormat((singleRow.payload && singleRow.payload.answers) || {});
  const items = cat.questions.map(q => {
    const a = answers[q.id] || {};
    const info = dashCqLevelInfo(a.value);
    return {
      id: q.id,
      aspecto: q.aspecto || q.id,
      nivel: info.label,
      nivelCls: info.cls,
      observaciones: (a.observaciones || '').trim()
    };
  });

  const conObs = items.filter(x => x.observaciones);
  card.style.display = '';

  // Reset resumen IA al cambiar de contexto
  if (sumEl) {
    if (conObs.length) {
      sumEl.innerHTML = '<p style="color:var(--medium-text)">Presioná <strong>Generar resumen IA</strong> para sintetizar las observaciones cargadas.</p>';
    } else {
      sumEl.innerHTML = '<p style="color:var(--medium-text)">Este distribuidor no cargó observaciones para las preguntas de esta competencia.</p>';
    }
  }
  if (metaEl) metaEl.textContent = '';

  if (btn) {
    btn.disabled = !conObs.length;
    btn.onclick = () => fetchObservationsSummaryAI(singleRow, compName, conObs);
  }
}

async function fetchObservationsSummaryAI(row, compName, obsItems) {
  const sumEl = document.getElementById('dash-comp-obs-summary');
  const metaEl = document.getElementById('dash-comp-obs-meta');
  const btn = document.getElementById('dash-comp-obs-btn');
  if (!sumEl) return;

  const compShort = DASH_CATEGORY_RADAR_LABEL[compName] || compName;
  const payload = {
    distribuidor: {
      nombre: row.nombre_distribuidor || row.nombre || 'Distribuidor',
      bu: row.bu || 's/d',
      squad: row.squad || 's/d'
    },
    competencia: compShort,
    observaciones: obsItems.map(x => ({
      id: x.id,
      aspecto: x.aspecto,
      nivel: x.nivel,
      texto: x.observaciones
    }))
  };

  sumEl.innerHTML = '<p style="color:var(--medium-text)">Generando síntesis con IA...</p>';
  if (metaEl) metaEl.textContent = '';
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-observations-summary', { body: payload });
    if (error) throw error;
    if (!data || !data.summary) throw new Error('IA no devolvió síntesis');
    applyObservationsSummary(data.summary, data.generated_at, data.model);
  } catch (e) {
    console.warn('Fallback resumen observaciones local:', e);
    applyObservationsSummary(buildObservationsFallback(payload), new Date().toISOString(), 'motor local', 'motor local · IA no disponible');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function applyObservationsSummary(summary, generatedAt, model, sourceLabel) {
  const sumEl = document.getElementById('dash-comp-obs-summary');
  const metaEl = document.getElementById('dash-comp-obs-meta');
  if (!sumEl) return;
  const paragraphs = String(summary || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  sumEl.innerHTML = paragraphs.length
    ? paragraphs.map(p => `<p>${dashEscapeHtml(p)}</p>`).join('')
    : `<p>${dashEscapeHtml(summary || '')}</p>`;
  if (metaEl) {
    const when = generatedAt ? new Date(generatedAt) : new Date();
    const whenStr = when.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const source = sourceLabel || (model ? `IA (${model})` : 'IA');
    metaEl.textContent = ` · ${source} · ${whenStr}`;
  }
}

function buildObservationsFallback(p) {
  const n = p.observaciones.length;
  if (!n) return 'El distribuidor no cargó observaciones en esta competencia.';
  const porNivel = { Alto: 0, Mediano: 0, Bajo: 0, 'Sin dato': 0 };
  p.observaciones.forEach(o => { porNivel[o.nivel] = (porNivel[o.nivel] || 0) + 1; });
  const preview = p.observaciones.slice(0, 3).map(o => `${o.aspecto}: "${o.texto.slice(0, 140)}${o.texto.length > 140 ? '…' : ''}"`).join(' | ');
  return `${p.distribuidor.nombre} cargó ${n} observación${n === 1 ? '' : 'es'} en la competencia ${p.competencia} (Alto ${porNivel.Alto} · Mediano ${porNivel.Mediano} · Bajo ${porNivel.Bajo}).\n\nComentarios destacados: ${preview}`;
}

function renderDashCompetenciaFindings(rows, compName) {
  const box = document.getElementById('dash-comp-findings');
  const subEl = document.getElementById('dash-comp-findings-sub');
  if (!box) return;

  const compShort = DASH_CATEGORY_RADAR_LABEL[compName] || compName;
  const scores = rows.map(r => dashGetCategoryScore(r, compName));
  const scopeAvg = scores.length ? Math.round(dashAvg(scores)) : 0;
  const netAvg = Math.round(_dashIndNetworkAvg[compName] || 0);
  const diff = scopeAvg - netAvg;
  const highCount = scores.filter(v => v >= 80).length;
  const lowCount = scores.filter(v => v < 70).length;
  const totalCount = scores.length;
  const pctLow = totalCount ? Math.round((lowCount / totalCount) * 100) : 0;
  const pctHigh = totalCount ? Math.round((highCount / totalCount) * 100) : 0;

  const sorted = rows.slice().sort((a, b) => dashGetCategoryScore(b, compName) - dashGetCategoryScore(a, compName));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Comparar squads: identificar el squad más rezagado
  const squadMap = new Map();
  rows.forEach(r => {
    const key = `${r.bu || 's/d'}||${r.squad || 's/d'}`;
    if (!squadMap.has(key)) squadMap.set(key, { bu: r.bu || 's/d', squad: r.squad || 's/d', vals: [] });
    squadMap.get(key).vals.push(dashGetCategoryScore(r, compName));
  });
  const squadStats = Array.from(squadMap.values()).map(g => ({
    bu: g.bu, squad: g.squad, count: g.vals.length,
    avg: g.vals.length ? Math.round(dashAvg(g.vals)) : 0
  })).sort((a, b) => a.avg - b.avg);
  const worstSquad = squadStats[0];
  const bestSquad = squadStats[squadStats.length - 1];

  if (subEl) subEl.textContent = `Insights automáticos sobre "${compShort}" en el alcance actual (${totalCount} distribuidor${totalCount === 1 ? '' : 'es'}).`;

  const findings = [];

  // 1) Posicionamiento de la competencia
  // Si el alcance no es toda la red (hay filtro) => comparar scope vs red completa.
  // Si el alcance es toda la red => comparar la competencia vs el promedio general de las 9 competencias del alcance
  //    (evita tautologías del tipo "66% en línea con la red (66%)").
  const scopeIsFullRed = rows.length === dashDedupeByCuit(_dashCompleted).length;
  const scopeAllComp = (() => {
    const all = [];
    DASH_CATEGORY_ORDER.forEach(n => rows.forEach(r => all.push(dashGetCategoryScore(r, n))));
    return all.length ? Math.round(dashAvg(all)) : 0;
  })();
  const compVsAvg = scopeAvg - scopeAllComp;
  const scopeLabel = scopeIsFullRed
    ? (dashIsAdminUser() ? 'La red' : 'Tu conjunto de assessments')
    : 'El alcance actual';

  let posClass, posText;
  if (!scopeIsFullRed && Math.abs(diff) >= 3) {
    posClass = diff >= 3 ? 'ok' : 'warn';
    posText = diff >= 3
      ? `El alcance promedia ${scopeAvg}% en ${compShort}, ${diff} pts por encima de ${dashNetShort()} (${netAvg}%). Buen posicionamiento relativo.`
      : `El alcance promedia ${scopeAvg}% en ${compShort}, ${Math.abs(diff)} pts por debajo de ${dashNetShort()} (${netAvg}%). Hay margen de mejora estructural.`;
  } else {
    posClass = compVsAvg >= 3 ? 'ok' : compVsAvg <= -3 ? 'warn' : 'mid';
    posText = compVsAvg >= 3
      ? `${scopeLabel} promedia ${scopeAvg}% en ${compShort}, ${compVsAvg} pts por encima del promedio general de las 9 competencias (${scopeAllComp}%). Es una fortaleza relativa.`
      : compVsAvg <= -3
      ? `${scopeLabel} promedia ${scopeAvg}% en ${compShort}, ${Math.abs(compVsAvg)} pts por debajo del promedio general de las 9 competencias (${scopeAllComp}%). Es una brecha relativa a atender.`
      : `${scopeLabel} promedia ${scopeAvg}% en ${compShort}, en línea con el promedio general de las 9 competencias (${scopeAllComp}%). No se destaca ni como fortaleza ni como brecha.`;
  }
  findings.push({ cls: posClass, title: 'Posicionamiento de la competencia', text: posText });

  // 2) Distribución de madurez
  const madClass = pctLow >= 40 ? 'warn' : pctHigh >= 50 ? 'ok' : 'mid';
  const madText = totalCount === 0
    ? 'Sin distribuidores para evaluar madurez.'
    : `${highCount} distribuidor${highCount === 1 ? '' : 'es'} (${pctHigh}%) alcanzan nivel alto (≥80%) y ${lowCount} (${pctLow}%) están en nivel bajo (<70%). ` +
      (pctLow >= 40 ? 'El grupo de baja madurez es amplio: conviene un plan colectivo de nivelación.'
       : pctHigh >= 50 ? 'La mayoría del scope opera con buen nivel; foco en sostener resultados.'
       : 'Distribución mixta: combinar iniciativas de nivelación con casos ejemplares.');
  findings.push({ cls: madClass, title: 'Distribución de madurez', text: madText });

  // 3) Squad más rezagado y líder
  if (squadStats.length >= 2 && worstSquad && bestSquad) {
    findings.push({
      cls: 'mid',
      title: 'Brecha entre squads',
      text: `El squad ${worstSquad.squad} (${worstSquad.bu}) promedia ${worstSquad.avg}% en esta competencia, ` +
            `${bestSquad.avg - worstSquad.avg} pts por debajo del squad líder ${bestSquad.squad} (${bestSquad.bu}, ${bestSquad.avg}%). ` +
            `Recomendación: transferir prácticas del squad líder al rezagado.`
    });
  }

  // 4) Caso destacado y a acompañar
  if (best && worst && best.id !== worst.id) {
    findings.push({
      cls: 'ok',
      title: 'Caso destacado',
      text: `${best.nombre_distribuidor || best.nombre || 'Sin nombre'} (${best.squad || 's/d'}) es referente en ${compShort} con ${dashGetCategoryScore(best, compName)}%. ` +
            `Puede ser aliado para replicar buenas prácticas.`
    });
    findings.push({
      cls: 'warn',
      title: 'A acompañar',
      text: `${worst.nombre_distribuidor || worst.nombre || 'Sin nombre'} (${worst.squad || 's/d'}) presenta la brecha más marcada en ${compShort} con ${dashGetCategoryScore(worst, compName)}%. ` +
            `Priorizar plan de acción específico para elevar su score.`
    });
  }

  if (!findings.length) {
    box.innerHTML = '<p style="color:var(--medium-text)">Sin datos suficientes para generar hallazgos.</p>';
    return;
  }

  box.innerHTML = `
    <div class="dash-comp-findings-list">
      ${findings.map(f => `
        <div class="dash-comp-finding ${f.cls}">
          <h4>${dashEscapeHtml(f.title)}</h4>
          <p>${dashEscapeHtml(f.text)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function buildIndividualPayload(row, cats, netTotalAvg) {
  // Extraemos preguntas clave y observaciones desde el payload del assessment
  const answers = (row?.payload?.answers) || {};
  const catDefs = (typeof ASSESSMENT_DATA !== 'undefined' && ASSESSMENT_DATA.categories) || [];

  const fortalezas = [];
  const brechas = [];
  const observaciones = [];

  catDefs.forEach(cat => {
    (cat.questions || []).forEach(q => {
      const ans = answers[q.id];
      if (!ans) return;
      const pond = Math.round((q.ponderacionTotal || 0) * 100);
      const item = {
        competencia: cat.name,
        aspecto: q.aspecto || q.id,
        ponderacion: pond
      };
      if (ans.value === 'alto') fortalezas.push(item);
      else if (ans.value === 'bajo') brechas.push(item);

      const obsTexto = (ans.observaciones || '').toString().trim();
      if (obsTexto) {
        observaciones.push({
          competencia: cat.name,
          aspecto: q.aspecto || q.id,
          texto: obsTexto.length > 240 ? obsTexto.slice(0, 237) + '…' : obsTexto
        });
      }
    });
  });

  // Ordenamos por peso descendente y limitamos para controlar el budget del prompt
  fortalezas.sort((a, b) => b.ponderacion - a.ponderacion);
  brechas.sort((a, b) => b.ponderacion - a.ponderacion);

  return {
    distribuidor: {
      nombre: row.nombre_distribuidor || row.nombre || 'Distribuidor',
      bu: row.bu || 's/d',
      squad: row.squad || 's/d'
    },
    scoreTotal: dashGetResultTotal(row),
    avgRed: netTotalAvg,
    competencias: cats.map(c => ({
      name: c.name,
      score: c.score,
      weight: c.weight,
      avgRed: c.avgRed
    })),
    pilares: DASH_PILARES.map(p => ({
      id: p.id,
      name: p.name,
      score: dashGetPilarScore(row, p.id),
      avgRed: Math.round(_dashIndNetworkPilarAvg[p.id] || 0),
      weight: dashPilarWeightPct(p.id)
    })),
    fortalezasClave: fortalezas.slice(0, 5),
    brechasClave: brechas.slice(0, 6),
    observaciones: observaciones.slice(0, 15)
  };
}

function applyIndividualSections(sections, generatedAt, model, sourceLabel) {
  const notesEl = document.getElementById('dash-ind-ai-notes');
  const metaEl = document.getElementById('dash-ind-ai-meta');
  if (!notesEl) return;
  notesEl.innerHTML = sections.map(s =>
    `<p><strong>${dashEscapeHtml(s.title)}.</strong> ${dashEscapeHtml(s.content)}</p>`
  ).join('');
  if (metaEl) {
    const when = generatedAt ? new Date(generatedAt) : new Date();
    const whenStr = when.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const source = sourceLabel || (model ? `IA (${model})` : 'IA');
    metaEl.textContent = ` · ${source} · ${whenStr}`;
  }
}

async function fetchIndividualAnalysisAI(assessmentId, forceRefresh = false) {
  const rows = dashRowsInScope();
  const row = rows.find(r => r.id === assessmentId);
  if (!row) return;

  const notesEl = document.getElementById('dash-ind-ai-notes');
  const metaEl = document.getElementById('dash-ind-ai-meta');
  const btn = document.getElementById('dash-ind-ai-btn');
  if (!notesEl) return;

  if (!forceRefresh && _dashIndAiCache && _dashIndAiCache.id === assessmentId) {
    applyIndividualSections(_dashIndAiCache.sections, _dashIndAiCache.generated_at, _dashIndAiCache.model, `IA (${_dashIndAiCache.model}) · cache`);
    return;
  }

  const cats = DASH_CATEGORY_ORDER.map(name => ({
    name,
    score: dashGetCategoryScore(row, name),
    avgRed: Math.round(_dashIndNetworkAvg[name] || 0),
    weight: DASH_COMPETENCE_WEIGHTS[name] || 0
  }));

  const payload = buildIndividualPayload(row, cats, _dashIndNetworkTotalAvg);
  const hash = aiHashPayload(payload);

  // 1) Lectura persistida: usamos assessmentId como scope_key
  if (!forceRefresh) {
    const persisted = await loadPersistedAiAnalysis('individual', assessmentId, hash);
    if (persisted && Array.isArray(persisted.sections) && persisted.sections.length) {
      _dashIndAiCache = {
        id: assessmentId,
        sections: persisted.sections,
        model: persisted.model,
        generated_at: persisted.generated_at
      };
      const age = aiFormatRelativeAge(persisted.generated_at);
      applyIndividualSections(
        persisted.sections,
        persisted.generated_at,
        persisted.model,
        `IA (${persisted.model || 'gpt-4o-mini'}) · guardada${age ? ' · ' + age : ''}`
      );
      return;
    }
  }

  notesEl.innerHTML = '<p style="color:var(--medium-text)">Generando lectura ejecutiva con IA...</p>';
  if (metaEl) metaEl.textContent = '';
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-individual-analysis', { body: payload });
    if (error) throw error;
    if (!data || !Array.isArray(data.sections) || !data.sections.length) {
      throw new Error('IA no devolvió secciones');
    }
    _dashIndAiCache = { id: assessmentId, sections: data.sections, model: data.model, generated_at: data.generated_at };
    applyIndividualSections(data.sections, data.generated_at, data.model);
    savePersistedAiAnalysis({
      kind: 'individual',
      scopeKey: assessmentId,
      sections: data.sections,
      model: data.model,
      hash,
      assessmentId
    });
  } catch (e) {
    console.warn('Fallback lectura individual local:', e);
    const fb = buildIndividualFallback(payload);
    applyIndividualSections(fb, new Date().toISOString(), 'motor local', 'motor local · IA no disponible');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function buildIndividualFallback(p) {
  const total = p.scoreTotal;
  const netAvg = p.avgRed;
  const diff = total - netAvg;
  const sortedComp = p.competencias.slice().sort((a, b) => b.score - a.score);
  const top = sortedComp.slice(0, 2).map(c => c.name).join(' y ');
  const bot = sortedComp.slice(-2).map(c => c.name).join(' y ');
  const posicion = diff >= 5
    ? `por encima del promedio de ${dashNetShort()} (${netAvg}%)`
    : diff <= -5
    ? `por debajo del promedio de ${dashNetShort()} (${netAvg}%)`
    : `en línea con el promedio de ${dashNetShort()} (${netAvg}%)`;

  const fortalezasTxt = (p.fortalezasClave && p.fortalezasClave.length)
    ? ` Aspectos puntuales bien evaluados: ${p.fortalezasClave.slice(0, 3).map(f => `${f.aspecto} (${f.competencia})`).join(', ')}.`
    : '';
  const brechasTxt = (p.brechasClave && p.brechasClave.length)
    ? ` Puntos débiles concretos: ${p.brechasClave.slice(0, 3).map(b => `${b.aspecto} (${b.competencia})`).join(', ')}.`
    : '';

  const sections = [
    {
      title: 'Diagnóstico general',
      content: `${p.distribuidor.nombre} obtuvo un score total de ${total}%, ${posicion}. Opera en la BU ${p.distribuidor.bu} · squad ${p.distribuidor.squad}.`
    },
    {
      title: 'Fortalezas destacadas',
      content: `Las competencias con mayor puntaje relativo son ${top}, con desempeño claramente superior a las demás dimensiones evaluadas.${fortalezasTxt}`
    },
    {
      title: 'Prioridades de mejora',
      content: `Las brechas más marcadas aparecen en ${bot}. Ahí conviene concentrar el plan de acción de corto plazo para elevar el score total.${brechasTxt}`
    }
  ];

  if (p.observaciones && p.observaciones.length) {
    const cantCompsConObs = new Set(p.observaciones.map(o => o.competencia)).size;
    const primera = p.observaciones[0];
    sections.push({
      title: 'Lectura de las observaciones',
      content: `Se registraron ${p.observaciones.length} observaciones cubriendo ${cantCompsConObs} competencia${cantCompsConObs === 1 ? '' : 's'}. Aportan contexto cualitativo relevante para complementar los scores. Ejemplo: "${primera.texto}" (${primera.aspecto} · ${primera.competencia}).`
    });
  }

  const bot1 = sortedComp[sortedComp.length - 1]?.name || bot;
  const bot2 = sortedComp[sortedComp.length - 2]?.name || bot;
  const primerFoco = (p.brechasClave && p.brechasClave[0]) ? p.brechasClave[0].aspecto : bot1;
  const segundoFoco = (p.brechasClave && p.brechasClave[1]) ? p.brechasClave[1].aspecto : bot2;
  sections.push({
    title: 'Acciones sugeridas',
    content: `Diseñar un plan trimestral de trabajo focalizado en ${primerFoco} con hitos mensuales verificables. Programar una revisión conjunta con el equipo comercial sobre ${segundoFoco} para nivelar prácticas. Definir 2 métricas de seguimiento por competencia rezagada y revisarlas contra el promedio de la red cada 30 días.`
  });

  return sections;
}

// =============================================================
// DASHBOARD · SUB-TAB "HALLAZGOS IA"
// =============================================================

let _dashHzAiCache = null; // { scopeKey, sections, model, generated_at }

function dashHzScopeKey(rows) {
  const bu = document.getElementById('dash-bu')?.value || '';
  const sq = document.getElementById('dash-squad')?.value || '';
  return `${bu}||${sq}||${rows.length}`;
}

function renderDashHallazgos(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  renderDashHzOutliers(list);
  renderDashHzGaps(list);
  renderDashHzCorrelations(list);

  // Preparar botón IA (reset al cambiar de scope)
  const btn = document.getElementById('dash-hz-ai-btn');
  const notes = document.getElementById('dash-hz-ai-notes');
  const meta = document.getElementById('dash-hz-ai-meta');
  if (!btn) return;

  const disabled = list.length < 3;
  btn.disabled = disabled;
  const currentKey = dashHzScopeKey(list);

  if (disabled) {
    if (notes) notes.innerHTML = '<p style="color:var(--medium-text)">Se necesitan al menos 3 distribuidores en el alcance actual para generar insights de red.</p>';
    if (meta) meta.textContent = '';
    btn.onclick = null;
    return;
  }

  // Si tenemos cache del mismo scope, mostrar directamente
  if (_dashHzAiCache && _dashHzAiCache.scopeKey === currentKey) {
    applyNetworkFindings(_dashHzAiCache.sections, _dashHzAiCache.generated_at, _dashHzAiCache.model, `IA (${_dashHzAiCache.model}) · cache`);
  } else {
    if (notes) notes.innerHTML = '<p style="color:var(--medium-text)">Buscando lectura guardada o presioná <strong>Generar</strong>...</p>';
    if (meta) meta.textContent = '';
    // Intento traer una lectura persistida vigente para este scope
    // (mismo hash de payload). Si no hay, dejamos el mensaje de "Generar".
    (async () => {
      try {
        const payload = buildNetworkFindingsPayload(list);
        const hash = aiHashPayload(payload);
        const persisted = await loadPersistedAiAnalysis('network_findings', currentKey, hash);
        if (persisted && Array.isArray(persisted.sections) && persisted.sections.length
            && dashHzScopeKey(list) === currentKey) {
          _dashHzAiCache = {
            scopeKey: currentKey,
            sections: persisted.sections,
            model: persisted.model,
            generated_at: persisted.generated_at
          };
          const age = aiFormatRelativeAge(persisted.generated_at);
          applyNetworkFindings(
            persisted.sections,
            persisted.generated_at,
            persisted.model,
            `IA (${persisted.model || 'gpt-4o-mini'}) · guardada${age ? ' · ' + age : ''}`
          );
        } else if (notes && !_dashHzAiCache) {
          notes.innerHTML = '<p style="color:var(--medium-text)">Presioná <strong>Generar</strong> para obtener insights ejecutivos sobre la red.</p>';
        }
      } catch (_e) {
        if (notes) notes.innerHTML = '<p style="color:var(--medium-text)">Presioná <strong>Generar</strong> para obtener insights ejecutivos sobre la red.</p>';
      }
    })();
  }

  btn.onclick = () => fetchNetworkFindingsAI(list, currentKey);
}

function renderDashHzOutliers(rows) {
  const box = document.getElementById('dash-hz-outliers');
  const sub = document.getElementById('dash-hz-out-sub');
  if (!box) return;

  const netAvg = _dashIndNetworkTotalAvg || 0;
  const list = rows
    .map(r => ({
      row: r,
      total: dashGetResultTotal(r),
      diff: dashGetResultTotal(r) - netAvg
    }))
    .filter(x => Math.abs(x.diff) >= 10);

  const ups = list.filter(x => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
  const downs = list.filter(x => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);

  if (sub) sub.textContent = `Distribuidores con al menos ±10 pts de diferencia respecto al promedio de ${dashNetShort()} (${netAvg}%).`;

  if (!ups.length && !downs.length) {
    box.innerHTML = `<p style="color:var(--medium-text)">No hay distribuidores con diferencias significativas (±10 pts) respecto al promedio de ${dashNetShort()} en el alcance actual.</p>`;
    return;
  }

  const itemHtml = (x, dir) => `
    <div class="dash-hz-out-item ${dir}">
      <div class="hz-pos">${dir === 'up' ? '▲' : '▼'}</div>
      <div>
        <div class="hz-name">${dashEscapeHtml(x.row.nombre_distribuidor || x.row.nombre || 'Sin nombre')}</div>
        <div class="hz-meta">${dashEscapeHtml(x.row.bu || 's/d')} · ${dashEscapeHtml(x.row.squad || 's/d')} · total ${x.total}%</div>
      </div>
      <div class="hz-delta">${x.diff > 0 ? '+' : ''}${x.diff} pts</div>
    </div>
  `;

  box.innerHTML = `
    <div class="dash-hz-out-list">
      ${ups.length ? `<h3 style="margin:0 0 6px 0;font-size:13px;color:var(--medium-text);">Por encima del promedio</h3>${ups.map(x => itemHtml(x, 'up')).join('')}` : ''}
      ${downs.length ? `<h3 style="margin:14px 0 6px 0;font-size:13px;color:var(--medium-text);">Por debajo del promedio</h3>${downs.map(x => itemHtml(x, 'down')).join('')}` : ''}
    </div>
  `;
}

function renderDashHzGaps(rows) {
  const box = document.getElementById('dash-hz-gaps');
  const sub = document.getElementById('dash-hz-gap-sub');
  if (!box) return;

  if (sub) sub.textContent = `Diferencia entre el promedio del alcance actual (${rows.length} distribuidor${rows.length === 1 ? '' : 'es'}) y el promedio de ${dashNetShort()} por competencia.`;

  if (!rows.length) {
    box.innerHTML = '<p style="color:var(--medium-text)">Sin distribuidores en el alcance.</p>';
    return;
  }

  const gaps = DASH_CATEGORY_ORDER.map(name => {
    const scopeAvg = Math.round(dashAvg(rows.map(r => dashGetCategoryScore(r, name))));
    const redAvg = Math.round(_dashIndNetworkAvg[name] || 0);
    return {
      name,
      short: DASH_CATEGORY_RADAR_LABEL[name] || name,
      weight: DASH_COMPETENCE_WEIGHTS[name] || 0,
      scopeAvg,
      redAvg,
      diff: scopeAvg - redAvg
    };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const deltaCell = (d) => {
    const cls = d >= 3 ? 'pos' : d <= -3 ? 'neg' : 'neu';
    const sign = d > 0 ? '+' : '';
    return `<td class="delta ${cls}">${sign}${d} pts</td>`;
  };

  box.innerHTML = `
    <table class="dash-hz-gap-table">
      <thead>
        <tr>
          <th>Competencia</th>
          <th style="text-align:right;">Peso</th>
          <th style="text-align:right;">Alcance</th>
          <th style="text-align:right;">${dashNetLabel()}</th>
          <th style="text-align:right;">Delta</th>
        </tr>
      </thead>
      <tbody>
        ${gaps.map(g => `
          <tr>
            <td>${dashEscapeHtml(g.short)}</td>
            <td class="num">${g.weight}%</td>
            <td class="num">${g.scopeAvg}%</td>
            <td class="num">${g.redAvg}%</td>
            ${deltaCell(g.diff)}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderDashHzCorrelations(rows) {
  const box = document.getElementById('dash-hz-corr');
  const sub = document.getElementById('dash-hz-corr-sub');
  if (!box) return;

  if (rows.length < 3) {
    if (sub) sub.textContent = 'Se necesitan al menos 3 distribuidores para detectar patrones.';
    box.innerHTML = '<p style="color:var(--medium-text)">Alcance insuficiente para calcular correlaciones.</p>';
    return;
  }

  const buSel = document.getElementById('dash-bu')?.value || '';
  const sqSel = document.getElementById('dash-squad')?.value || '';
  const esRedCompleta = !buSel && !sqSel;
  const universoStr = esRedCompleta ? 'la red' : 'el alcance';
  const universoDe  = esRedCompleta ? 'de la red' : 'del alcance';

  if (sub) {
    sub.textContent = esRedCompleta
      ? `Patrones detectados sobre los ${rows.length} distribuidores de la red.`
      : `Patrones detectados sobre los ${rows.length} distribuidores del alcance.`;
  }

  // Ordenar por total (mejor a peor)
  const sorted = rows.slice().sort((a, b) => dashGetResultTotal(b) - dashGetResultTotal(a));
  const half = Math.ceil(sorted.length / 2);
  const topHalf = sorted.slice(0, half);
  const botHalf = sorted.slice(-half);

  const nombreDe = r => r.nombre_distribuidor || r.nombre || 'Sin nombre';

  const findings = [];

  // 1) Diferenciador clave: competencia con mayor gap entre top y bottom half
  const diffs = DASH_CATEGORY_ORDER.map(name => {
    const t = Math.round(dashAvg(topHalf.map(r => dashGetCategoryScore(r, name))));
    const b = Math.round(dashAvg(botHalf.map(r => dashGetCategoryScore(r, name))));
    return { name, short: DASH_CATEGORY_RADAR_LABEL[name] || name, t, b, delta: t - b };
  });
  const maxDiff = diffs.slice().sort((a, b) => b.delta - a.delta)[0];

  if (maxDiff && maxDiff.delta >= 10) {
    // Traer ejemplos concretos: el mejor y el peor en esa competencia
    const rankedInComp = rows.slice().sort(
      (a, b) => dashGetCategoryScore(b, maxDiff.name) - dashGetCategoryScore(a, maxDiff.name)
    );
    const mejor = rankedInComp[0];
    const peor = rankedInComp[rankedInComp.length - 1];
    const mejorScore = Math.round(dashGetCategoryScore(mejor, maxDiff.name));
    const peorScore  = Math.round(dashGetCategoryScore(peor,  maxDiff.name));

    findings.push({
      cls: 'ok',
      title: `${maxDiff.short}: la competencia que más separa a los líderes de los rezagados`,
      text: `Los distribuidores del top 50% ${universoDe} promedian ${maxDiff.t}% en ${maxDiff.short}, contra ${maxDiff.b}% del bottom 50% (una brecha de ${maxDiff.delta} pts). Ejemplo: ${nombreDe(mejor)} lidera con ${mejorScore}% y ${nombreDe(peor)} queda con ${peorScore}%. Trabajar esta dimensión es la palanca con mayor impacto para nivelar hacia arriba.`
    });
  }

  // 2) Competencia donde todos parecen similares (baja discriminación)
  const minAbs = diffs.filter(d => Math.abs(d.delta) < 5).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
  if (minAbs) {
    const nivelStr = minAbs.t >= 75
      ? `funciona como una fortaleza generalizada en ${universoStr}`
      : minAbs.t < 55
      ? `se comporta como una brecha estructural común en ${universoStr}`
      : `es una capacidad instalada de manera homogénea en ${universoStr}`;
    findings.push({
      cls: 'warn',
      title: `${minAbs.short}: desempeño parejo entre todos`,
      text: `Top 50% ${minAbs.t}% vs bottom 50% ${minAbs.b}% (sólo ${Math.abs(minAbs.delta)} pts de diferencia). ${nivelStr.charAt(0).toUpperCase() + nivelStr.slice(1)}, con lo cual las acciones acá deberían ser transversales.`
    });
  }

  // 3) Perfiles desbalanceados: distribuidores con mucha variación entre competencias
  const desbalanceados = rows.map(r => {
    const scores = DASH_CATEGORY_ORDER.map(n => ({
      name: n,
      short: DASH_CATEGORY_RADAR_LABEL[n] || n,
      score: dashGetCategoryScore(r, n)
    }));
    const sortedScores = scores.slice().sort((a, b) => b.score - a.score);
    const max = sortedScores[0];
    const min = sortedScores[sortedScores.length - 1];
    return { row: r, spread: max.score - min.score, max, min };
  }).filter(x => x.spread >= 40)
    .sort((a, b) => b.spread - a.spread);

  if (desbalanceados.length) {
    const pct = Math.round((desbalanceados.length / rows.length) * 100);
    const ejemplos = desbalanceados.slice(0, 2).map(d =>
      `${nombreDe(d.row)} (fuerte en ${d.max.short} ${Math.round(d.max.score)}%, débil en ${d.min.short} ${Math.round(d.min.score)}%)`
    ).join('; ');

    findings.push({
      cls: desbalanceados.length >= rows.length / 3 ? 'warn' : '',
      title: `${desbalanceados.length} distribuidor${desbalanceados.length === 1 ? '' : 'es'} con perfil desbalanceado (${pct}% ${universoDe})`,
      text: `Presentan más de 40 pts de diferencia entre su mejor y su peor competencia. Ejemplos: ${ejemplos}. Estos casos necesitan planes de acción específicos para nivelar la dimensión rezagada en vez de un plan uniforme.`
    });
  }

  // 4) Comparación scope vs red completa — sólo si hay filtro (si no, es tautológico)
  if (!esRedCompleta) {
    const scopeTotal = Math.round(dashAvg(rows.map(dashGetResultTotal)));
    const netTotal = Math.round(_dashIndNetworkTotalAvg || 0);
    const totalDiff = scopeTotal - netTotal;
    if (Math.abs(totalDiff) >= 3) {
      findings.push({
        cls: totalDiff >= 0 ? 'ok' : 'warn',
        title: totalDiff >= 0 ? `El alcance supera al promedio de ${dashNetShort()}` : `El alcance está por debajo de ${dashNetShort()}`,
        text: `El alcance actual promedia ${scopeTotal}% total, ${Math.abs(totalDiff)} pts ${totalDiff >= 0 ? 'por encima' : 'por debajo'} de ${dashNetShort()} (${netTotal}%).`
      });
    }
  } else {
    // En red completa: reemplazamos el "scope vs red" por un patrón de concentración de valor
    const totalsSorted = rows.map(dashGetResultTotal).sort((a, b) => b - a);
    const nTop = Math.max(1, Math.round(rows.length * 0.2));
    const nBot = Math.max(1, Math.round(rows.length * 0.2));
    const topAvg = Math.round(dashAvg(totalsSorted.slice(0, nTop)));
    const botAvg = Math.round(dashAvg(totalsSorted.slice(-nBot)));
    const gap = topAvg - botAvg;
    if (gap >= 15) {
      findings.push({
        cls: gap >= 30 ? 'warn' : '',
        title: `Brecha entre el 20% top y el 20% bottom de la red`,
        text: `El top 20% (${nTop} distribuidor${nTop === 1 ? '' : 'es'}) promedia ${topAvg}% total, mientras que el bottom 20% (${nBot} distribuidor${nBot === 1 ? '' : 'es'}) promedia ${botAvg}% (${gap} pts). ${gap >= 30 ? 'Es una red muy heterogénea, conviene diseñar programas segmentados en vez de un plan único.' : 'Existe margen para nivelar hacia arriba con acompañamiento focalizado en los rezagados.'}`
      });
    }
  }

  if (!findings.length) {
    box.innerHTML = '<p style="color:var(--medium-text)">No se detectaron patrones destacados en el alcance actual.</p>';
    return;
  }

  box.innerHTML = `
    <div class="dash-hz-corr-list">
      ${findings.map(f => `
        <div class="dash-hz-corr-item ${f.cls || ''}">
          <h4>${dashEscapeHtml(f.title)}</h4>
          <p>${dashEscapeHtml(f.text)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function buildNetworkFindingsPayload(rows) {
  const buSel = document.getElementById('dash-bu')?.value || '';
  const sqSel = document.getElementById('dash-squad')?.value || '';
  const esRedCompleta = !buSel && !sqSel;
  const scope = sqSel ? `Squad ${sqSel}` : buSel ? `BU ${buSel}` : 'Red completa (sin filtros)';

  const scopeTotal = rows.length ? Math.round(dashAvg(rows.map(dashGetResultTotal))) : 0;

  const competencias = DASH_CATEGORY_ORDER.map(name => {
    const perDistScores = rows.map(r => dashGetCategoryScore(r, name));
    const scopeAvg = perDistScores.length ? Math.round(dashAvg(perDistScores)) : 0;
    const redAvg = Math.round(_dashIndNetworkAvg[name] || 0);
    const min = perDistScores.length ? Math.min(...perDistScores) : 0;
    const max = perDistScores.length ? Math.max(...perDistScores) : 0;
    return {
      name: DASH_CATEGORY_RADAR_LABEL[name] || name,
      scopeAvg,
      redAvg,
      diff: scopeAvg - redAvg,
      weight: DASH_COMPETENCE_WEIGHTS[name] || 0,
      min,
      max,
      gap: max - min
    };
  });

  // Outliers vs promedio del alcance actual (para que tenga sentido incluso en red completa)
  const totalsArr = rows.map(dashGetResultTotal);
  const baseAvg = totalsArr.length ? Math.round(dashAvg(totalsArr)) : 0;
  const outliers = rows.map(r => ({
    nombre: r.nombre_distribuidor || r.nombre || 'Sin nombre',
    bu: r.bu || 's/d',
    squad: r.squad || 's/d',
    total: dashGetResultTotal(r),
    diff: dashGetResultTotal(r) - baseAvg
  }));
  const outUp = outliers.filter(x => x.diff >= 10).sort((a, b) => b.diff - a.diff).slice(0, 3);
  const outDown = outliers.filter(x => x.diff <= -10).sort((a, b) => a.diff - b.diff).slice(0, 3);

  const payload = {
    esRedCompleta,
    alcance: {
      descripcion: scope,
      distribuidores: rows.length,
      totalPromedio: scopeTotal,
      totalPromedioRed: Math.round(_dashIndNetworkTotalAvg || 0)
    },
    competencias,
    pilares: DASH_PILARES.map(p => {
      const perDist = rows.map(r => dashGetPilarScore(r, p.id));
      const scopeAvg = perDist.length ? Math.round(dashAvg(perDist)) : 0;
      const redAvg = Math.round(_dashIndNetworkPilarAvg[p.id] || 0);
      return {
        id: p.id,
        name: p.name,
        scopeAvg,
        redAvg,
        diff: scopeAvg - redAvg,
        weight: dashPilarWeightPct(p.id)
      };
    }),
    outliersArriba: outUp,
    outliersAbajo: outDown
  };

  // Contexto extra sólo cuando el alcance ES la red completa,
  // para poder producir insights internos (dispersión, comparación entre BUs, referentes).
  if (esRedCompleta) {
    const highCount = totalsArr.filter(v => v >= 80).length;
    const midCount  = totalsArr.filter(v => v >= 70 && v < 80).length;
    const lowCount  = totalsArr.filter(v => v < 70).length;
    const min = totalsArr.length ? Math.min(...totalsArr) : 0;
    const max = totalsArr.length ? Math.max(...totalsArr) : 0;
    const mean = totalsArr.length ? totalsArr.reduce((s, v) => s + v, 0) / totalsArr.length : 0;
    const stddev = totalsArr.length
      ? Math.round(Math.sqrt(totalsArr.reduce((s, v) => s + (v - mean) ** 2, 0) / totalsArr.length))
      : 0;

    // Agregado por BU
    const buMap = new Map();
    rows.forEach(r => {
      const key = r.bu || 's/d';
      if (!buMap.has(key)) buMap.set(key, []);
      buMap.get(key).push(dashGetResultTotal(r));
    });
    const buSummary = Array.from(buMap.entries())
      .map(([bu, arr]) => ({
        bu,
        count: arr.length,
        avg: Math.round(dashAvg(arr))
      }))
      .sort((a, b) => b.avg - a.avg);

    const compsBySpread = competencias.slice().sort((a, b) => b.gap - a.gap);
    const compsByAvg    = competencias.slice().sort((a, b) => b.scopeAvg - a.scopeAvg);

    const sortedByTotal = rows
      .map(r => ({
        nombre: r.nombre_distribuidor || r.nombre || 'Sin nombre',
        bu: r.bu || 's/d',
        squad: r.squad || 's/d',
        total: dashGetResultTotal(r)
      }))
      .sort((a, b) => b.total - a.total);

    payload.resumenRed = {
      madurez: {
        alta: highCount,
        media: midCount,
        baja: lowCount,
        pctAlta:  totalsArr.length ? Math.round((highCount / totalsArr.length) * 100) : 0,
        pctMedia: totalsArr.length ? Math.round((midCount  / totalsArr.length) * 100) : 0,
        pctBaja:  totalsArr.length ? Math.round((lowCount  / totalsArr.length) * 100) : 0
      },
      dispersion: { min, max, gap: max - min, stddev },
      buSummary,
      competenciaMasFuerte: compsByAvg[0]  ? { name: compsByAvg[0].name,               avg: compsByAvg[0].scopeAvg } : null,
      competenciaMasDebil:  compsByAvg[compsByAvg.length - 1]
                                            ? { name: compsByAvg[compsByAvg.length - 1].name, avg: compsByAvg[compsByAvg.length - 1].scopeAvg } : null,
      competenciaMayorDispersion: compsBySpread[0] ? {
        name: compsBySpread[0].name,
        min: compsBySpread[0].min,
        max: compsBySpread[0].max,
        gap: compsBySpread[0].gap
      } : null,
      topDistribuidores:    sortedByTotal.slice(0, 3),
      bottomDistribuidores: sortedByTotal.slice(-3).reverse()
    };
  }

  return payload;
}

async function fetchNetworkFindingsAI(rows, scopeKey) {
  const notes = document.getElementById('dash-hz-ai-notes');
  const meta = document.getElementById('dash-hz-ai-meta');
  const btn = document.getElementById('dash-hz-ai-btn');
  if (!notes) return;

  const payload = buildNetworkFindingsPayload(rows);
  const hash = aiHashPayload(payload);

  // 1) Intento traer la última generación persistida con el mismo hash
  const persisted = await loadPersistedAiAnalysis('network_findings', scopeKey, hash);
  if (persisted && Array.isArray(persisted.sections) && persisted.sections.length) {
    _dashHzAiCache = {
      scopeKey,
      sections: persisted.sections,
      model: persisted.model,
      generated_at: persisted.generated_at
    };
    const age = aiFormatRelativeAge(persisted.generated_at);
    applyNetworkFindings(
      persisted.sections,
      persisted.generated_at,
      persisted.model,
      `IA (${persisted.model || 'gpt-4o-mini'}) · guardada${age ? ' · ' + age : ''}`
    );
    return;
  }

  notes.innerHTML = '<p style="color:var(--medium-text)">Generando insights de red con IA...</p>';
  if (meta) meta.textContent = '';
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-network-findings', { body: payload });
    if (error) throw error;
    if (!data || !Array.isArray(data.sections) || !data.sections.length) {
      throw new Error('IA no devolvió secciones');
    }
    _dashHzAiCache = { scopeKey, sections: data.sections, model: data.model, generated_at: data.generated_at };
    applyNetworkFindings(data.sections, data.generated_at, data.model);
    savePersistedAiAnalysis({
      kind: 'network_findings',
      scopeKey,
      sections: data.sections,
      model: data.model,
      hash
    });
  } catch (e) {
    console.warn('Fallback insights de red local:', e);
    const fb = buildNetworkFindingsFallback(payload);
    applyNetworkFindings(fb, new Date().toISOString(), 'motor local', 'motor local · IA no disponible');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function applyNetworkFindings(sections, generatedAt, model, sourceLabel) {
  const notes = document.getElementById('dash-hz-ai-notes');
  const meta = document.getElementById('dash-hz-ai-meta');
  if (!notes) return;
  notes.innerHTML = sections.map(s =>
    `<p><strong>${dashEscapeHtml(s.title)}.</strong> ${dashEscapeHtml(s.content)}</p>`
  ).join('');
  if (meta) {
    const when = generatedAt ? new Date(generatedAt) : new Date();
    const whenStr = when.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const source = sourceLabel || (model ? `IA (${model})` : 'IA');
    meta.textContent = ` · ${source} · ${whenStr}`;
  }
}

function buildNetworkFindingsFallback(p) {
  // Modo red completa: insights internos, sin comparar contra sí misma
  if (p.esRedCompleta && p.resumenRed) {
    const r = p.resumenRed;
    const bestBU = r.buSummary[0];
    const worstBU = r.buSummary[r.buSummary.length - 1];
    const buGap = bestBU && worstBU ? bestBU.avg - worstBU.avg : 0;
    return [
      {
        title: 'Panorama general de la red',
        content: `La red evaluada agrupa ${p.alcance.distribuidores} distribuidores con un score promedio de ${p.alcance.totalPromedio}%. La distribución de madurez muestra ${r.madurez.alta} distribuidores en alto (${r.madurez.pctAlta}%), ${r.madurez.media} en medio (${r.madurez.pctMedia}%) y ${r.madurez.baja} en bajo (${r.madurez.pctBaja}%), con una dispersión de ${r.dispersion.gap} pts entre el mejor (${r.dispersion.max}%) y el peor (${r.dispersion.min}%).`
      },
      {
        title: 'Fortaleza principal',
        content: r.competenciaMasFuerte
          ? `${r.competenciaMasFuerte.name} es la competencia más consolidada de la red con ${r.competenciaMasFuerte.avg}% promedio. ${r.topDistribuidores[0] ? `Referentes como ${r.topDistribuidores[0].nombre} (${r.topDistribuidores[0].bu}/${r.topDistribuidores[0].squad}, ${r.topDistribuidores[0].total}%) marcan el estándar.` : ''}`.trim()
          : 'Sin datos suficientes para identificar la fortaleza principal.'
      },
      {
        title: 'Brechas y alertas',
        content: [
          r.competenciaMasDebil
            ? `${r.competenciaMasDebil.name} es la competencia más rezagada con ${r.competenciaMasDebil.avg}% promedio.`
            : '',
          r.competenciaMayorDispersion
            ? `${r.competenciaMayorDispersion.name} presenta la mayor heterogeneidad interna (${r.competenciaMayorDispersion.gap} pts entre el peor y el mejor), señal de que hay prácticas dispares que se pueden nivelar.`
            : '',
          buGap >= 5 && bestBU && worstBU
            ? `Entre BUs, ${bestBU.bu} lidera con ${bestBU.avg}% y ${worstBU.bu} queda con ${worstBU.avg}% (${buGap} pts de brecha).`
            : ''
        ].filter(Boolean).join(' ')
      },
      {
        title: 'Oportunidades y recomendaciones',
        content: [
          r.competenciaMasDebil ? `Priorizar un programa transversal para elevar ${r.competenciaMasDebil.name}.` : '',
          r.competenciaMayorDispersion ? `En ${r.competenciaMayorDispersion.name} conviene replicar prácticas del referente hacia los rezagados.` : '',
          r.bottomDistribuidores.length ? `Acompañamiento cercano para ${r.bottomDistribuidores.map(d => d.nombre).join(', ')} que están en el fondo del ranking.` : ''
        ].filter(Boolean).join(' ')
      }
    ];
  }

  // Modo alcance filtrado (BU/Squad): comparación scope vs red completa
  const sortedByDelta = p.competencias.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const biggestGap = sortedByDelta[0];
  const strongest = p.competencias.slice().sort((a, b) => b.scopeAvg - a.scopeAvg)[0];
  const weakest = p.competencias.slice().sort((a, b) => a.scopeAvg - b.scopeAvg)[0];
  const totalDiff = p.alcance.totalPromedio - p.alcance.totalPromedioRed;
  return [
    {
      title: 'Posicionamiento del alcance',
      content: `${p.alcance.descripcion} promedia ${p.alcance.totalPromedio}% de score total sobre ${p.alcance.distribuidores} distribuidores, ${totalDiff >= 0 ? `${totalDiff} pts por encima` : `${Math.abs(totalDiff)} pts por debajo`} del promedio de la red completa (${p.alcance.totalPromedioRed}%).`
    },
    {
      title: 'Fortaleza principal',
      content: `${strongest.name} es la competencia con mejor desempeño del alcance con ${strongest.scopeAvg}% promedio (red ${strongest.redAvg}%). Conviene apalancar buenas prácticas de esa dimensión hacia el resto del equipo.`
    },
    {
      title: 'Brecha crítica',
      content: `${weakest.name} es la dimensión más rezagada con ${weakest.scopeAvg}% (red ${weakest.redAvg}%). Es el foco prioritario del plan de mejora del alcance.`
    },
    {
      title: 'Recomendación',
      content: `Concentrar el plan trimestral en ${weakest.name} y capitalizar las capacidades demostradas en ${strongest.name}. ${p.outliersAbajo.length ? `Acompañar prioritariamente a ${p.outliersAbajo.map(o => o.nombre).join(', ')} que están significativamente por debajo del promedio.` : 'Continuar el monitoreo mensual del progreso contra la red completa.'}`
    }
  ];
}
