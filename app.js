// No external services needed - drafts are saved/loaded as local files

let state = {
  currentStep: 1,
  currentCategory: 0,
  answers: {},
  chartInstance: null,
  vendedorNombre: ''
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fecha').valueAsDate = new Date();
  loadFromStorage();
  renderCategoryTabs();
  renderQuestions(0);
  updateNavButtons();
});

// === LOCAL STORAGE ===
function saveToStorage() {
  const data = {
    datos: getDatosValues(),
    porte: getPorteValues(),
    answers: state.answers
  };
  localStorage.setItem('assessment_progress', JSON.stringify(data));
}

function loadFromStorage() {
  const saved = localStorage.getItem('assessment_progress');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    if (data.datos) {
      Object.entries(data.datos).forEach(([key, val]) => {
        const el = document.getElementById(key);
        if (el && val) el.value = val;
      });
    }
    if (data.porte) restorePorteValues(data.porte);
    if (data.answers) state.answers = data.answers;
  } catch(e) { /* ignore corrupt data */ }
}

function clearStorage() {
  if (confirm('¿Estás seguro de que querés borrar todo el progreso?')) {
    localStorage.removeItem('assessment_progress');
    location.reload();
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
    return `<div class="category-tab ${i === 0 ? 'active' : ''}" onclick="switchCategory(${i})" title="${cat.name}">${i + 1}. ${shortName}</div>`;
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
  const answered = cat.questions.filter(q => state.answers[q.id]?.calificacion).length;
  tab.classList.remove('has-answers', 'complete');
  if (answered === cat.questions.length) tab.classList.add('complete');
  else if (answered > 0) tab.classList.add('has-answers');
}

function renderQuestions(catIndex) {
  const cat = ASSESSMENT_DATA.categories[catIndex];
  const answered = cat.questions.filter(q => state.answers[q.id]?.calificacion).length;

  document.getElementById('category-progress').innerHTML = `
    <span>${cat.name} — ${answered}/${cat.questions.length} respondidas (Peso: ${Math.round(cat.weightTotal * 100)}%)</span>
    <div class="progress-fill"><div class="progress-fill-inner" style="width:${(answered/cat.questions.length)*100}%"></div></div>
  `;

  const container = document.getElementById('questions-container');
  container.innerHTML = cat.questions.map(q => {
    const answer = state.answers[q.id] || {};
    const isAnswered = answer.calificacion ? 'answered' : '';
    return `
      <div class="question-card ${isAnswered}" id="card-${q.id}">
        <div class="question-header">
          <span class="question-number">${q.id}</span>
          <span class="question-aspecto">${q.aspecto}</span>
        </div>
        <div class="question-text">${q.pregunta}</div>
        <div class="rating-options">
          <div class="rating-option bajo">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_bajo" value="bajo" ${answer.calificacion === 'bajo' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'bajo')">
            <label for="q_${q.id}_bajo">Bajo - 0%</label>
          </div>
          <div class="rating-option mediano">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_mediano" value="mediano" ${answer.calificacion === 'mediano' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'mediano')">
            <label for="q_${q.id}_mediano">Mediano - 50%</label>
          </div>
          <div class="rating-option alto">
            <input type="radio" name="q_${q.id}" id="q_${q.id}_alto" value="alto" ${answer.calificacion === 'alto' ? 'checked' : ''} onchange="setAnswer('${q.id}', 'alto')">
            <label for="q_${q.id}_alto">Alto - 100%</label>
          </div>
        </div>
        <div class="level-descriptions">
          <button class="level-toggle" onclick="toggleDetails('${q.id}')">Ver criterios de evaluación</button>
          <div class="level-details" id="details-${q.id}">
            ${renderLevelDetails(q)}
          </div>
        </div>
        <div class="obs-label">Observaciones</div>
        <textarea placeholder="Observaciones opcionales..." onblur="setObservation('${q.id}', this.value)">${answer.observaciones || ''}</textarea>
      </div>
    `;
  }).join('');
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
  state.answers[qId].calificacion = value;
  document.getElementById(`card-${qId}`).classList.add('answered');
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
  const answered = cat.questions.filter(q => state.answers[q.id]?.calificacion).length;
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

function calculateResults() {
  const results = ASSESSMENT_DATA.categories.map(cat => {
    let scoreSeccion = 0;
    let scoreTotal = 0;
    cat.questions.forEach(q => {
      const answer = state.answers[q.id];
      if (answer?.calificacion) {
        const val = getCalificacionValue(answer.calificacion);
        scoreSeccion += val * q.ponderacionCompetencia;
        scoreTotal += val * q.ponderacionTotal;
      }
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
    <p><strong>Distribuidor:</strong> ${datos.nombre_distribuidor || '-'}</p>
    <p><strong>Región:</strong> ${datos.region || '-'} | <strong>Squad:</strong> ${datos.squad || '-'}</p>
    <p><strong>Zonas:</strong> ${datos.zonas_atendidas || '-'} | <strong>Fecha:</strong> ${datos.fecha || '-'}</p>
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

// === CSV EXPORT ===
async function exportExcel() {
  const datos = getDatosValues();
  const porte = getPorteValues();
  const results = calculateResults();
  const wb = new ExcelJS.Workbook();

  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0068B4' } };
  const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00824B' } };
  const lightFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
  const borderStyle = { style: 'thin', color: { argb: 'FFE0E5EB' } };
  const borders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

  // --- SOLAPA 1: Datos ---
  const wsDatos = wb.addWorksheet('Datos');
  wsDatos.columns = [{ width: 28 }, { width: 45 }];

  const datosTitle = wsDatos.addRow(['DATOS GENERALES', '']);
  datosTitle.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0068B4' } };
  wsDatos.addRow([]);

  const datosHeader = wsDatos.addRow(['Campo', 'Valor']);
  datosHeader.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  const datosFields = [
    ['Nombre del Distribuidor', datos.nombre_distribuidor || ''],
    ['Región', datos.region || ''],
    ['Squad', datos.squad || ''],
    ['Zonas Atendidas', datos.zonas_atendidas || ''],
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
    ['Facturación total 2024 (MM)', porte.facturacion_total || ''],
    ['% Representatividad Bayer', porte.representatividad_bayer || ''],
    ['Facturación total Bayer 2024', porte.facturacion_bayer || '']
  ]);

  addPorteSection('Clientes / Área', [
    ['Total de clientes', porte.total_clientes || ''],
    ['Clientes con Bayer', porte.clientes_bayer || '']
  ]);

  addPorteSection('Empleados', [
    ['Empleados Total', porte.empleados_total || ''],
    ['Administrativo', porte.empleados_admin || ''],
    ['Asesores agronómicos', porte.empleados_asesores || ''],
    ['Gerentes/supervisores', porte.empleados_gerentes || ''],
    ['Comercial - Otros', porte.empleados_comercial_otros || ''],
    ['Otras áreas', porte.empleados_otras_areas || '']
  ]);

  addPorteSection('Flota', [
    ['Vehículos Propios', porte.vehiculos_propios || ''],
    ['Vehículos de Terceros', porte.vehiculos_terceros || '']
  ]);

  // Proveedores
  const provTitle = wsPorte.addRow(['Proveedores']);
  provTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  wsPorte.addRow(['Nro. de proveedores: ' + (porte.num_proveedores || ''), 'Nro. de SKUs: ' + (porte.num_skus || '')]);
  const provHdr = wsPorte.addRow(['Proveedor', '% Ventas', '# SKUs']);
  provHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.proveedores && porte.proveedores.length > 0) {
    porte.proveedores.forEach(p => {
      const r = wsPorte.addRow([p.nombre || '', p.pctVentas || '', p.skus || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }
  wsPorte.addRow([]);

  // Depositos
  const depTitle = wsPorte.addRow(['Depósitos']);
  depTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00824B' } };
  wsPorte.addRow([]);
  const depHdr = wsPorte.addRow(['Dirección', 'Tamaño (m²)', '# Empleados']);
  depHdr.eachCell(cell => { cell.font = headerFont; cell.fill = subHeaderFill; cell.border = borders; });
  if (porte.depositos && porte.depositos.length > 0) {
    porte.depositos.forEach(d => {
      const r = wsPorte.addRow([d.direccion || '', d.tamanoM2 || '', d.empleados || '']);
      r.eachCell(cell => { cell.border = borders; });
    });
  }

  // --- SOLAPA 3: Assessment ---
  const wsAssess = wb.addWorksheet('Assessment');
  wsAssess.columns = [{ width: 6 }, { width: 36 }, { width: 42 }, { width: 14 }, { width: 8 }, { width: 50 }];

  const assessHdr = wsAssess.addRow(['#', 'Categoría', 'Aspecto', 'Calificación', 'Valor', 'Observaciones']);
  assessHdr.eachCell(cell => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; });

  let currentCat = '';
  ASSESSMENT_DATA.categories.forEach(cat => {
    cat.questions.forEach((q, qi) => {
      const answer = state.answers[q.id] || {};
      const calLabel = answer.calificacion ? (answer.calificacion === 'bajo' ? 'Bajo' : answer.calificacion === 'mediano' ? 'Mediano' : 'Alto') : '';
      const val = answer.calificacion ? getCalificacionValue(answer.calificacion) : '';
      const r = wsAssess.addRow([q.id, cat.name, q.aspecto, calLabel, val, answer.observaciones || '']);
      r.eachCell(cell => { cell.border = borders; });

      // Color-code the calificacion cell
      if (answer.calificacion === 'bajo') {
        r.getCell(4).font = { bold: true, color: { argb: 'FFE53935' } };
      } else if (answer.calificacion === 'mediano') {
        r.getCell(4).font = { bold: true, color: { argb: 'FFFB8C00' } };
      } else if (answer.calificacion === 'alto') {
        r.getCell(4).font = { bold: true, color: { argb: 'FF43A047' } };
      }

      // Alternate category background
      if (cat.name !== currentCat) {
        currentCat = cat.name;
      }
      if (ASSESSMENT_DATA.categories.indexOf(cat) % 2 === 0) {
        r.getCell(2).fill = lightFill;
      }
    });
  });

  // --- SOLAPA 4: Resultados ---
  const wsRes = wb.addWorksheet('Resultados');
  wsRes.columns = [{ width: 42 }, { width: 22 }, { width: 24 }];

  const resTitle = wsRes.addRow(['RESULTADOS DEL ASSESSMENT', '', '']);
  resTitle.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0068B4' } };
  wsRes.addRow([]);

  const resInfo = wsRes.addRow(['Distribuidor: ' + (datos.nombre_distribuidor || ''), 'Fecha: ' + (datos.fecha || ''), '']);
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

// === SUBMIT ASSESSMENT (download Excel + backup file + clear) ===
async function submitAssessment() {
  const totalAnswered = Object.values(state.answers).filter(a => a.calificacion).length;
  const totalQuestions = ASSESSMENT_DATA.categories.reduce((sum, c) => sum + c.questions.length, 0);

  if (totalAnswered < totalQuestions) {
    if (!confirm(`Hay ${totalQuestions - totalAnswered} preguntas sin responder. ¿Querés finalizar de todas formas?`)) return;
  }

  const datos = getDatosValues();
  const porte = getPorteValues();
  const results = calculateResults();

  // 1. Download Excel
  await exportExcel();

  // 2. Download .assessment backup
  const payload = {
    status: "completado",
    vendedor: state.vendedorNombre || datos.nombre_distribuidor || '',
    timestamp: new Date().toISOString(),
    datos,
    porte,
    answers: state.answers,
    currentStep: state.currentStep,
    currentCategory: state.currentCategory,
    resultados: results
  };

  setTimeout(() => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const vendedor = (state.vendedorNombre || datos.nombre_distribuidor || 'assessment').replace(/\s+/g, '_');
    const fecha = datos.fecha || new Date().toISOString().slice(0, 10);
    link.download = `Assessment_${vendedor}_${fecha}.assessment`;
    link.click();
    URL.revokeObjectURL(url);
  }, 500);

  // 3. Clear progress
  localStorage.removeItem('assessment_progress');

  // 4. Show confirmation
  const statusEl = document.getElementById('submit-status');
  statusEl.className = 'submit-status success';
  statusEl.textContent = 'Assessment finalizado. Se descargaron el Excel y el archivo de respaldo. Podés cerrar esta página.';
}

// === HELPERS ===
function getDatosValues() {
  return {
    nombre_distribuidor: document.getElementById('nombre_distribuidor')?.value || '',
    region: document.getElementById('region')?.value || '',
    squad: document.getElementById('squad')?.value || '',
    zonas_atendidas: document.getElementById('zonas_atendidas')?.value || '',
    fecha: document.getElementById('fecha')?.value || ''
  };
}

function getPorteValues() {
  const fields = ['facturacion_total', 'representatividad_bayer', 'facturacion_bayer',
    'num_proveedores', 'num_skus', 'total_clientes', 'clientes_bayer',
    'empleados_total', 'empleados_admin', 'empleados_asesores', 'empleados_gerentes',
    'empleados_comercial_otros', 'empleados_otras_areas', 'vehiculos_propios', 'vehiculos_terceros'];

  const result = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    result[f] = el ? el.value : '';
  });

  // Proveedores table
  result.proveedores = [];
  document.querySelectorAll('#proveedores-table tbody tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      result.proveedores.push({
        nombre: inputs[0].value,
        pctVentas: inputs[1]?.value || '',
        skus: inputs[2]?.value || ''
      });
    }
  });

  // Depositos table
  result.depositos = [];
  document.querySelectorAll('#depositos-table tbody tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      result.depositos.push({
        direccion: inputs[0].value,
        tamanoM2: inputs[1]?.value || '',
        empleados: inputs[2]?.value || ''
      });
    }
  });

  return result;
}

function restorePorteValues(porte) {
  const fields = ['facturacion_total', 'representatividad_bayer', 'facturacion_bayer',
    'num_proveedores', 'num_skus', 'total_clientes', 'clientes_bayer',
    'empleados_total', 'empleados_admin', 'empleados_asesores', 'empleados_gerentes',
    'empleados_comercial_otros', 'empleados_otras_areas', 'vehiculos_propios', 'vehiculos_terceros'];

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && porte[f]) el.value = porte[f];
  });

  if (porte.proveedores) {
    const rows = document.querySelectorAll('#proveedores-table tbody tr');
    porte.proveedores.forEach((p, i) => {
      if (rows[i]) {
        const inputs = rows[i].querySelectorAll('input');
        inputs[0].value = p.nombre || '';
        inputs[1].value = p.pctVentas || '';
        inputs[2].value = p.skus || '';
      }
    });
  }

  if (porte.depositos) {
    const tbody = document.querySelector('#depositos-table tbody');
    tbody.innerHTML = '';
    porte.depositos.forEach(d => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${d.direccion || ''}"></td>
        <td><input type="number" step="any" value="${d.tamanoM2 || ''}"></td>
        <td><input type="number" value="${d.empleados || ''}"></td>
        <td><button type="button" class="btn-remove-row" onclick="removeDepositRow(this)">✕</button></td>
      `;
      tbody.appendChild(row);
    });
    if (porte.depositos.length === 0) addDepositRow();
  }
}

function addDepositRow() {
  const tbody = document.querySelector('#depositos-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text"></td>
    <td><input type="number" step="any"></td>
    <td><input type="number"></td>
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

// === DRAFT SAVE/LOAD (local file) ===
function startNew() {
  const nombre = document.getElementById('vendedor_nombre').value.trim();
  if (!nombre) {
    showWelcomeStatus('Por favor ingresá tu nombre', 'error');
    return;
  }
  state.vendedorNombre = nombre;
  document.getElementById('welcome-overlay').style.display = 'none';
}

function loadDraft() {
  const nombre = document.getElementById('vendedor_nombre').value.trim();
  if (!nombre) {
    showWelcomeStatus('Por favor ingresá tu nombre para buscar tu borrador', 'error');
    return;
  }
  state.vendedorNombre = nombre;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.assessment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showWelcomeStatus('Cargando borrador...', 'loading');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.datos) {
          Object.entries(data.datos).forEach(([key, val]) => {
            const el = document.getElementById(key);
            if (el && val) el.value = val;
          });
        }
        if (data.porte) restorePorteValues(data.porte);
        if (data.answers) state.answers = data.answers;
        if (data.currentStep) state.currentStep = data.currentStep;
        if (data.currentCategory !== undefined) state.currentCategory = data.currentCategory;
        saveToStorage();
        showWelcomeStatus('Borrador cargado correctamente.', 'success');
        setTimeout(() => {
          document.getElementById('welcome-overlay').style.display = 'none';
          renderQuestions(state.currentCategory);
          goToStep(state.currentStep);
        }, 1000);
      } catch (err) {
        showWelcomeStatus('El archivo no es válido. Seleccioná un archivo de borrador correcto.', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function saveDraft() {
  saveToStorage();
  const datos = getDatosValues();
  const porte = getPorteValues();

  const payload = {
    status: "borrador",
    vendedor: state.vendedorNombre || datos.nombre_distribuidor || 'Sin identificar',
    timestamp: new Date().toISOString(),
    datos,
    porte,
    answers: state.answers,
    currentStep: state.currentStep,
    currentCategory: state.currentCategory
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const vendedor = (state.vendedorNombre || datos.nombre_distribuidor || 'borrador').replace(/\s+/g, '_');
  const fecha = new Date().toISOString().slice(0, 10);
  link.download = `Assessment_${vendedor}_${fecha}.assessment`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Borrador descargado. Guardá el archivo para retomar después.');
}

function showWelcomeStatus(msg, type) {
  const el = document.getElementById('welcome-status');
  el.textContent = msg;
  el.className = 'welcome-status ' + type;
}

