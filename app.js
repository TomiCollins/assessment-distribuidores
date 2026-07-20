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
      : `<button class="btn-card-primary" onclick="editCompletedAssessment('${a.id}')">Editar</button>
         <button class="btn-card-secondary" onclick="downloadExcelFromCloud('${a.id}')">Descargar Excel</button>
         <button class="btn-card-danger" onclick="deleteAssessment('${a.id}')">Eliminar</button>`;

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
    <div class="admin-bu-card" onclick="navigateAdmin('${bu}')">
      <div class="admin-bu-name">${bu}</div>
      <div class="admin-bu-count">${buGroups[bu].length} assessment${buGroups[bu].length !== 1 ? 's' : ''}</div>
      <button class="btn-card-secondary" onclick="event.stopPropagation(); downloadBUZip('${bu}')">Descargar BU (ZIP)</button>
    </div>
  `).join('')}</div>`;
}

function renderAdminSquads(bu) {
  const container = document.getElementById('admin-content');
  document.getElementById('admin-breadcrumb').innerHTML = `
    <span class="breadcrumb-link" onclick="renderAdminBUs()">Admin</span> &gt; <span class="breadcrumb-current">${bu}</span>
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
    <div class="admin-bu-card" onclick="navigateAdmin('${bu}', '${squad}')">
      <div class="admin-bu-name">${squad}</div>
      <div class="admin-bu-count">${squadGroups[squad].length} assessment${squadGroups[squad].length !== 1 ? 's' : ''}</div>
      <button class="btn-card-secondary" onclick="event.stopPropagation(); downloadSquadZip('${bu}', '${squad}')">Descargar Squad (ZIP)</button>
    </div>
  `).join('')}</div>`;
}

function renderAdminAssessments(bu, squad) {
  const container = document.getElementById('admin-content');
  document.getElementById('admin-breadcrumb').innerHTML = `
    <span class="breadcrumb-link" onclick="renderAdminBUs()">Admin</span> &gt;
    <span class="breadcrumb-link" onclick="renderAdminSquads('${bu}')">${bu}</span> &gt;
    <span class="breadcrumb-current">${squad}</span>
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
        <div class="card-user-email">${a.user_email}</div>
        <div class="card-distribuidor">${a.nombre_distribuidor || 'Sin distribuidor'}</div>
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
        <textarea placeholder="Observaciones opcionales para esta sección..." onblur="setObservation('${q.id}', this.value)">${answer.observaciones || ''}</textarea>
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
  document.getElementById('results-header').innerHTML = `
    <p><strong>Distribuidor:</strong> ${datos.nombre_distribuidor || '-'} | <strong>CUIT:</strong> ${datos.cuit || '-'}</p>
    <p><strong>BU:</strong> ${datos.region || '-'} | <strong>Squad:</strong> ${datos.squad || '-'}</p>
    <p><strong>Zonas:</strong> ${Array.isArray(datos.zonas_atendidas) ? datos.zonas_atendidas.join(', ') : (datos.zonas_atendidas || '-')} | <strong>Fecha:</strong> ${datos.fecha || '-'}</p>
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
        backgroundColor: 'rgba(0, 104, 180, 0.18)',
        borderColor: 'rgb(0, 104, 180)',
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
