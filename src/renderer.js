const UI_FEEDBACK_TIMEOUT = 2000;
const ERROR_MESSAGE_TIMEOUT = 2000;

const el = (id) => document.getElementById(id);

function setStatus(text) {
  const s = el('status'); if (s) s.textContent = `Status: ${text}`;
}

function setProgress(v) {
  const p = el('progressBar'); if (p) p.style.width = `${Math.max(0, Math.min(100, v))}%`;
}

let scoresheetPath = null;
let attendanceReportPath = null;
let students = [];
const selected = new Map();
const languages = new Map();
let sortKey = 'name';
let sortDir = 1;

let settingsLoadPromise = null;
let cachedSettings = null;

async function apiCall(method, ...args) {
  console.log(`[apiCall] Calling ${method} with args:`, args); // Add this line
  try {
    if (!window.api?.[method]) {
      throw new Error(`API method ${method} not available`);
    }
    const res = await window.api[method](...args);
    if (res && typeof res === 'object' && 'ok' in res) {
      if (!res.ok) {
        throw new Error(res.error || `${method} failed`);
      }
      return res.data;
    }
    return res;
  } catch (err) {
    console.error(`[API ${method}] Failed:`, err);
    throw err;
  }
}

async function loadSettings() {
  if (settingsLoadPromise) {
    return settingsLoadPromise;
  }
  
  if (cachedSettings) {
    return cachedSettings;
  }

  settingsLoadPromise = (async () => {
    try {
      cachedSettings = await apiCall('loadSettings') || {};
      return cachedSettings;
    } catch (err) {
      cachedSettings = {};
      return cachedSettings;
    } finally {
      settingsLoadPromise = null;
    }
  })();

  return settingsLoadPromise;
}

function invalidateSettings() {
  cachedSettings = null;
  settingsLoadPromise = null;
}

async function saveSettings(settings) {
  await apiCall('saveSettings', settings);
  invalidateSettings();
}

function getDefaultLogo() {
  try {
    if (window.api?.assetUrl) return window.api.assetUrl('assets/logo.png');
    return new URL('assets/logo.png', window.location.href).toString();
  } catch (err) {
    console.error('[getDefaultLogo] Failed to resolve logo path:', err);
    return '';
  }
}

function getSettings() {
  return {
    teacher_name: el('teacherName').value.trim(),
    teacher_email: el('teacherEmail').value.trim(),
    class_name: el('className').value.trim(),
    default_language: el('defaultLang')?.value || 'es',
    grade_cutoff: el('gradeCutoff')?.value.trim() || '',
    custom_message: el('customMessage').value.trim(),
    school_name: (el('editSchoolName')?.value || el('schoolName')?.textContent || '').trim(),
    school_address: (el('editSchoolAddress')?.value || '').trim(),
    school_logo_dataurl: (window.__customLogoDataURL ?? null),
  };
}

function showModal(show) {
  const m = el('editModal');
  if (!m) return;
  m.classList.toggle('hidden', !show);
  document.body.classList.toggle('overflow-hidden', show);
}

function populateModal(settings) {
  const prev = el('editLogoPreview');
  const name = el('editSchoolName');
  const addr = el('editSchoolAddress');

  const currentLogoSrc = () =>
    settings.school_logo_dataurl || el('schoolLogo')?.getAttribute('src') || getDefaultLogo();

  const src = currentLogoSrc();
  if (prev && src) {
    prev.src = src;
  }
  if (name) name.value = settings.school_name || (el('schoolName')?.textContent || '');
  if (addr && !addr.value) addr.value = (settings.school_address ?? settings.schoolAddress ?? '');
}

function setFileUI(hasFile) {
  el('btnGenerateSelected').disabled = !hasFile;

  const pick = el('btnPick');
  const fileLabel = el('fileLabel');

  if (!hasFile) {
    pick.className = [
      'w-full rounded-2xl',
      'bg-gradient-to-r from-fuchsia-500 to-indigo-600',
      'text-white font-semibold',
      'px-5 py-4 text-left',
      'shadow-lg hover:shadow-xl hover:scale-[1.01]',
      'ring-2 ring-fuchsia-300/60 focus:ring-4 focus:ring-fuchsia-300/70 focus:outline-none',
      'transition',
      'animate-pulse'
    ].join(' ');
    pick.textContent = 'Select a scoresheet…';
    pick.setAttribute('aria-label', 'Select a scoresheet');
    fileLabel.textContent = 'No file selected';
  } else {
    pick.className = [
      'w-full rounded-xl',
      'border border-indigo-300',
      'bg-white hover:bg-indigo-50',
      'text-indigo-700 font-medium',
      'px-4 py-2 text-left',
      'focus:outline-none focus:ring-2 focus:ring-indigo-300',
      'transition'
    ].join(' ');
    pick.textContent = 'Select different file';
    pick.setAttribute('aria-label', 'Select a different scoresheet');
  }
}

function setAttendanceFileUI(hasFile) {
  const pick = el('btnPickAttendance');
  const fileLabel = el('attendanceFileLabel');

  if (!pick || !fileLabel) return;

  if (!hasFile) {
    pick.className = [
      'w-full rounded-2xl',
      'bg-gradient-to-r from-emerald-500 to-teal-600',
      'text-white font-semibold',
      'px-5 py-4 text-left',
      'shadow-lg hover:shadow-xl hover:scale-[1.01]',
      'ring-2 ring-emerald-300/60 focus:ring-4 focus:ring-emerald-300/70 focus:outline-none',
      'transition',
      'animate-pulse'
    ].join(' ');
    
    pick.style.background = 'linear-gradient(to right, #059669, #0d9488)'; 
    pick.style.color = 'white';
    pick.style.fontWeight = 'bold';
    pick.style.padding = '16px 20px';
    pick.style.borderRadius = '16px';
    pick.style.width = '100%';
    pick.style.textAlign = 'left';
    pick.style.border = 'none';
    pick.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    
    pick.textContent = 'Select attendance report… (Optional)';
    pick.setAttribute('aria-label', 'Select an attendance report');
    fileLabel.textContent = 'No file selected';
  } else {
    pick.removeAttribute('style');
    pick.style.cssText = '';
    
    pick.className = [
      'w-full rounded-xl',
      'border border-emerald-300',
      'bg-white hover:bg-emerald-50',
      'text-emerald-700 font-medium',
      'px-4 py-2 text-left',
      'focus:outline-none focus:ring-2 focus:ring-emerald-300',
      'transition'
    ].join(' ');
    
    pick.style.background = 'white';
    pick.style.color = '#047857';
    pick.style.border = '1px solid #6ee7b7';
    pick.style.fontWeight = '500';
    pick.style.padding = '8px 16px';
    pick.style.borderRadius = '12px';
    pick.style.width = '100%';
    pick.style.textAlign = 'left';
    
    pick.textContent = 'Select different file';
    pick.setAttribute('aria-label', 'Select a different attendance report');
  }
}

function styleAttendanceHelpButton() {
  setTimeout(() => {
    const helpButton = el('btnAttendanceHelp');
    if (helpButton) {
      helpButton.className = [
        'absolute right-2 top-1/2 -translate-y-1/2 z-10',
        'h-8 w-8 grid place-items-center rounded-full',
        'bg-white/90 text-emerald-700 ring-1 ring-emerald-300 shadow-sm',
        'hover:bg-emerald-50 hover:ring-emerald-400 focus:outline-none',
        'focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400'
      ].join(' ');
      helpButton.innerHTML = '<span class="font-bold text-sm leading-none">?</span>';
      
      helpButton.style.cssText = '';
    }
    
    const attendanceButton = el('btnPickAttendance');
    if (attendanceButton) {
      
      attendanceButton.className = '';
      
      attendanceButton.className = [
        'w-full rounded-2xl',
        'bg-gradient-to-r from-emerald-500 to-teal-600',
        'text-white font-semibold',
        'px-5 py-4 text-left',
        'shadow-lg hover:shadow-xl hover:scale-[1.01]',
        'ring-2 ring-emerald-300/60 focus:ring-4 focus:ring-emerald-300/70 focus:outline-none',
        'transition',
        'animate-pulse'
      ].join(' ');
      
      attendanceButton.textContent = 'Select attendance report… (Optional)';
      
      attendanceButton.style.background = 'linear-gradient(to right, rgb(16 185 129), rgb(20 184 166))';
      attendanceButton.style.color = 'white';
      attendanceButton.style.fontWeight = 'bold';
      attendanceButton.style.padding = '16px 20px';
      attendanceButton.style.borderRadius = '16px';
      attendanceButton.style.width = '100%';
      attendanceButton.style.textAlign = 'left';      
    }
  }, 200);
}

async function loadFile(fileTypes) {
  console.log('[loadFile] Called with fileTypes:', fileTypes);
  console.log('[loadFile] About to call apiCall with:', {dataTypes: fileTypes});
  const result = await apiCall('selectFile', {dataTypes: fileTypes});
  console.log('[loadFile] API result:', result);
  return result;
}

async function selectFile(extensions = ['csv', 'xlsx']) {
  const chosen = await loadFile(['csv', 'xlsx']);

  if (!chosen) {
    scoresheetPath = null;
    students = [];
    selected.clear();
    languages.clear();
    renderTable();
    setStatus('Ready');
    setProgress(0);
    setFileUI(false);
    return;
  }

  scoresheetPath = chosen;
  el('fileLabel').textContent = chosen;
  setStatus('Loading students…');
  setProgress(0);

  try {
    students = await apiCall('listStudents', {inputPath: scoresheetPath, settingsObj: getSettings()});
    students = students.map((s, i) => ({ ...s, __orig: i }));
    selected.clear();
    languages.clear();
    students.forEach(s => selected.set(s.name, true));
    renderTable();
    setStatus(`Loaded ${students.length} students`);
    setFileUI(true);
  } catch (e) {
    console.error('[selectFile] Error loading students:', e);
    setStatus('Error loading students: ' + e.message);
    setFileUI(false);   
  }
}

async function selectAttendanceFile() {
  try {
    const chosen = await loadFile(['pdf']);
  
    if (!chosen) {
      attendanceReportPath = null;
      setAttendanceFileUI(false);
      setStatus('Attendance file cleared');
      return;
    }
  
    attendanceReportPath = chosen;
    el('attendanceFileLabel').textContent = chosen;
    setStatus('Attendance file selected');
    setAttendanceFileUI(true);
  } catch (error) {
    console.error('[selectAttendanceFile] Error:', error);
    setStatus('Error selecting attendance file: ' + error.message);
  }
}

function setAttendanceFileUI(hasFile) {
  const pick = el('btnPickAttendance');
  const fileLabel = el('attendanceFileLabel');

  if (!pick || !fileLabel) return;

  if (!hasFile) {
    pick.className = [
      'w-full rounded-xl border-2 border-dashed border-emerald-400',
      'bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 pr-12',
      'text-left text-emerald-700 font-medium',
      'animate-pulse'
    ].join(' ');
    pick.textContent = 'Select attendance report… (Optional)';
    pick.setAttribute('aria-label', 'Select an attendance report');
    fileLabel.textContent = 'No file selected';
  } else {
    pick.className = [
      'w-full rounded-xl',
      'border border-emerald-300',
      'bg-white hover:bg-emerald-50',
      'text-emerald-700 font-medium',
      'px-4 py-2.5 pr-12 text-left',
      'focus:outline-none focus:ring-2 focus:ring-emerald-300',
      'transition'
    ].join(' ');
    pick.textContent = 'Select different attendance file';
    pick.setAttribute('aria-label', 'Select a different attendance report');
  }
}

async function generateReports() {
  if (!scoresheetPath) {
    console.warn('[generateReports] No file selected');
    setStatus('Pick a scoresheet first.');
    return;
  }
  
  const selection = {
    selected: Object.fromEntries([...selected.entries()]),
    languages: Object.fromEntries([...languages.entries()]),
  };
  
  setStatus('Generating…');
  setProgress(0);

  try {
    await apiCall('generateSelected', {
      inputPath: scoresheetPath, 
      selectionObj: selection, 
      settingsObj: getSettings(),
      attendancePath: attendanceReportPath
    });
    setStatus('Done. File saved to Downloads.');
    setProgress(100);
  } catch (e) {
    console.error('[generateReports] Generation failed:', e);
    setStatus('Generation failed.');
    setProgress(0);
  }
}

async function pickLogo() {
  try {
    const picked = await apiCall('pickLogo');
    if (picked?.dataUrl) {
      window.__customLogoDataURL = picked.dataUrl;
      const prev = el('editLogoPreview');
      if (prev) prev.src = picked.dataUrl;
      return true;
    }
    return false;
  } catch (e) {
    console.error('[pickLogo] API failed:', e);
    return false;
  }
}

function initHelpModal() {
  const openBtn = el('btnScoreHelp');
  const modal = el('scoresheetHelpModal');
  const backdrop = modal ? modal.firstElementChild : null;
  const closeBtn = el('helpClose');
  const prevBtn = el('helpPrev');
  const nextBtn = el('helpNext');
  const slides = Array.from(document.querySelectorAll('.help-slide'));
  const pageIndicatorContainer = el('helpDots');

  if (!openBtn || !modal || !slides.length) return;

  pageIndicatorContainer.innerHTML = slides.map((_, idx) =>
    `<button data-idx="${idx}" class="h-2.5 w-2.5 rounded-full bg-slate-300"></button>`
  ).join('');
  const pageIndicatorDots = Array.from(pageIndicatorContainer.querySelectorAll('button'));

  let i = 0;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((el, idx) => el.classList.toggle('hidden', idx !== i));
    pageIndicatorDots.forEach((d, idx) => {
      d.classList.toggle('bg-indigo-600', idx === i);
      d.classList.toggle('bg-slate-300', idx !== i);
    });
  };

  const open = () => { modal.classList.remove('hidden'); show(i); };
  const close = () => { modal.classList.add('hidden'); };

  openBtn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  prevBtn?.addEventListener('click', () => show(i - 1));
  nextBtn?.addEventListener('click', () => show(i + 1));
  
  pageIndicatorContainer.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idx]');
    if (b) show(parseInt(b.dataset.idx, 10));
  });

  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
}

function initAttendanceHelpModal() {
  const openBtn = el('btnAttendanceHelp');
  const modal = el('attendanceHelpModal');
  const backdrop = modal ? modal.firstElementChild : null;
  const closeBtn = el('attendanceHelpClose');
  const prevBtn = el('attendanceHelpPrev');
  const nextBtn = el('attendanceHelpNext');
  const slides = Array.from(document.querySelectorAll('.attendance-help-slide'));
  const pageIndicatorContainer = el('attendanceHelpDots');

  if (!openBtn || !modal || !slides.length) {
    console.warn('Attendance help modal elements not found');
    return;
  }

  pageIndicatorContainer.innerHTML = slides.map((_, idx) =>
    `<button data-idx="${idx}" class="h-2.5 w-2.5 rounded-full bg-slate-300"></button>`
  ).join('');
  const pageIndicatorDots = Array.from(pageIndicatorContainer.querySelectorAll('button'));

  let currentSlide = 0;
  
  const showSlide = (slideIndex) => {
    currentSlide = (slideIndex + slides.length) % slides.length;
    
    slides.forEach((slide, idx) => {
      slide.classList.toggle('hidden', idx !== currentSlide);
    });
    
    pageIndicatorDots.forEach((dot, idx) => {
      dot.classList.toggle('bg-emerald-600', idx === currentSlide);
      dot.classList.toggle('bg-slate-300', idx !== currentSlide);
    });
  };

  const openModal = () => { 
    modal.classList.remove('hidden'); 
    showSlide(currentSlide); 
  };
  
  const closeModal = () => { 
    modal.classList.add('hidden'); 
  };

  openBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    openModal(); 
  });
  
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  prevBtn?.addEventListener('click', () => showSlide(currentSlide - 1));
  nextBtn?.addEventListener('click', () => showSlide(currentSlide + 1));
  
  pageIndicatorContainer.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-idx]');
    if (button) {
      showSlide(parseInt(button.dataset.idx, 10));
    }
  });

  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showSlide(currentSlide - 1);
    if (e.key === 'ArrowRight') showSlide(currentSlide + 1);
  });
}

function initTabSwitching() {
  const tabScoresheet = el('tabScoresheet');
  const tabAttendance = el('tabAttendance');
  const scoresheetContent = el('scoresheetContent');
  const attendanceContent = el('attendanceContent');

  tabScoresheet.addEventListener('click', function() {
    tabScoresheet.className = 'px-2 py-1 text-xs font-medium rounded transition-colors bg-white text-slate-900 shadow-sm';
    tabAttendance.className = 'px-2 py-1 text-xs font-medium rounded transition-colors text-slate-600 hover:text-slate-900';
    
    scoresheetContent.classList.remove('hidden');
    attendanceContent.classList.add('hidden');
  });

  tabAttendance.addEventListener('click', function() {
    tabAttendance.className = 'px-2 py-1 text-xs font-medium rounded transition-colors bg-white text-slate-900 shadow-sm';
    tabScoresheet.className = 'px-2 py-1 text-xs font-medium rounded transition-colors text-slate-600 hover:text-slate-900';
    
    attendanceContent.classList.remove('hidden');
    scoresheetContent.classList.add('hidden');
  });
}

function setSort(key) {
  if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
  renderTable();
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('[data-arrow]').forEach(el => (el.textContent = ''));

  const active = document.querySelector(`[data-arrow="${sortKey}"]`);
  if (active) active.textContent = sortDir === 1 ? '▲' : '▼';

  document.querySelectorAll('[data-hover]').forEach(el => {
    const key = el.getAttribute('data-hover');
    if (key === sortKey) {
      el.style.opacity = 0;
    } else {
      el.style.opacity = '';
    }
  });
}

function renderTable() {
  const tbody = el('studentsBody');
  if (!tbody) return;
  const noData = el('noData');
  const defLang = (el('defaultLang')?.value || 'es');
  const langOf = (name) => languages.get(name) || defLang;

  tbody.innerHTML = '';

  function pctVal(x) {
    if (x == null) return -Infinity;
    const v = parseFloat(String(x).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(v) ? v : -Infinity;
  }

  const rows = [...students].sort((a, b) => {
    const dir = sortDir;
    switch (sortKey) {
      case 'name':
        return sortDir * ((a.__orig ?? 0) - (b.__orig ?? 0));
      case 'percent':
        return dir * (pctVal(a.percent) - pctVal(b.percent));
      case 'grade':
        return dir * String(a.grade || '').localeCompare(String(b.grade || ''), undefined, { sensitivity: 'base' });
      case 'language':
        return dir * langOf(a.name).localeCompare(langOf(b.name), undefined, { sensitivity: 'base' });
      case 'selected': {
        const av = !!selected.get(a.name), bv = !!selected.get(b.name);
        return dir * (Number(av) - Number(bv));
      }
      default: return 0;
    }
  });

  const frag = document.createDocumentFragment();
  let selectedCount = 0;

  rows.forEach((s) => {
    const tr = document.createElement('tr');
    tr.className = 'border-t hover:bg-slate-50';

    const tdChk = document.createElement('td');
    tdChk.className = 'p-3 text-center align-middle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'h-4 w-4';
    cb.checked = !!selected.get(s.name);
    if (cb.checked) selectedCount++;
    cb.addEventListener('change', () => {
      if (cb.checked) selected.set(s.name, true);
      else selected.delete(s.name);
      const total = rows.length;
      const cur = [...selected.values()].filter(Boolean).length;
      const selAll = el('selectAll');
      if (selAll) {
        selAll.indeterminate = cur > 0 && cur < total;
        selAll.checked = cur === total;
      }
    });
    tdChk.appendChild(cb);
    tr.appendChild(tdChk);

    const tdName = document.createElement('td');
    tdName.className = 'p-3 align-middle';
    tdName.textContent = s.name || '';
    tr.appendChild(tdName);

    const tdPct = document.createElement('td');
    tdPct.className = 'p-3 text-right align-middle';
    tdPct.textContent = (s.percent ?? '') + '';
    tr.appendChild(tdPct);

    const tdGrade = document.createElement('td');
    tdGrade.className = 'p-3 text-center align-middle';
    tdGrade.textContent = s.grade ?? '';
    tr.appendChild(tdGrade);

    const tdLang = document.createElement('td');
    tdLang.className = 'p-3 align-middle truncate';
    const sel = document.createElement('select');
    sel.className = 'w-full max-w-[9.5rem] rounded-lg border border-slate-300 px-2 py-1';
    const current = langOf(s.name);

    [['en','English'], ['es','Spanish'], ['ar','Arabic']].forEach(([v, label]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = label;
      if (v === current) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      const v = sel.value;
      if (v === defLang) languages.delete(s.name);
      else languages.set(s.name, v);
    });

    tdLang.appendChild(sel);
    tr.appendChild(tdLang);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);

  if (noData) noData.style.display = rows.length ? 'none' : 'block';

  const selAll = el('selectAll');
  if (selAll) {
    selAll.indeterminate = selectedCount > 0 && selectedCount < rows.length;
    selAll.checked = rows.length > 0 && selectedCount === rows.length;
  }

  if (typeof updateSortIndicators === 'function') updateSortIndicators();
}

window.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  window.__customLogoDataURL = settings.school_logo_dataurl ?? null;
  
  const headerLogo = el('schoolLogo');
  if (headerLogo) {
    headerLogo.src = settings.school_logo_dataurl || headerLogo.src || getDefaultLogo();
  }
  
  const headerName = el('schoolName');
  if (headerName && settings.school_name) {
    headerName.textContent = settings.school_name;
  }
  
  const defaultLang = el('defaultLang');
  if (defaultLang) defaultLang.value = settings.default_language || 'en';
  
  const cutoff = el('gradeCutoff');
  if (cutoff) cutoff.value = settings.grade_cutoff || '';

  const className = el('className');
  if (className) className.value = settings.class_name || '';

  const teacherName = el('teacherName');
  if (teacherName) teacherName.value = settings.teacher_name || '';

  const teacherEmail = el('teacherEmail');
  if (teacherEmail) teacherEmail.value = settings.teacher_email || '';

  const customMessage = el('customMessage');
  if (customMessage) customMessage.value = settings.custom_message || '';

  const nm = el('editSchoolName');
  if (nm && !nm.value) nm.value = settings.school_name || '';

  const addr = el('editSchoolAddress');
  if (addr) addr.value = (settings.school_address ?? settings.schoolAddress ?? '');

  const logoPreview = el('editLogoPreview');
  if (logoPreview) {
    if (!logoPreview.src) logoPreview.src = settings.school_logo_dataurl || headerLogo?.src || getDefaultLogo();
    logoPreview.addEventListener('error', function() {
      this.src = getDefaultLogo();
    });
  }

  setFileUI(false);
  setAttendanceFileUI(false);
  initTabSwitching();
  styleAttendanceHelpButton();

  el('editModal')?.classList.add('hidden');
  students.forEach(s => selected.set(s.name, true));
  el('selectAll').checked = false;
  renderTable();

  el('btnEditLogo')?.addEventListener('click', async () => { 
    populateModal(cachedSettings || await loadSettings()); 
    showModal(true); 
  });
  el('btnCloseModal')?.addEventListener('click', () => showModal(false));
  el('btnCancelEdit')?.addEventListener('click', () => showModal(false));
  document.querySelector('#editModal [data-backdrop]')?.addEventListener('click', () => showModal(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showModal(false); });

  el('btnPick').addEventListener('click', selectFile);
  el('btnPickAttendance')?.addEventListener('click', selectAttendanceFile);
  el('btnGenerateSelected').addEventListener('click', generateReports);
  
  el('selectAll').addEventListener('change', (e) => {
    const v = e.target.checked;
    students.forEach(s => selected.set(s.name, v));
    renderTable();
  });

  const handleSort = (e) => setSort(e.currentTarget.dataset.sort);
  ['thName', 'thPct', 'thGrade', 'thLang'].forEach(id => {
    el(id)?.addEventListener('click', handleSort);
  });

  const thSel = el('thSel');
  thSel?.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    setSort('selected');
  });

  updateSortIndicators();

  window.api?.onProgress?.(({ value }) => setProgress(value));

  initHelpModal();
  initAttendanceHelpModal();
});

el('btnUploadLogo')?.addEventListener('click', async () => {
  const success = await pickLogo();
  if (success) return;

  let input = el('hiddenLogoFileInput');
  if (input) {
    input.remove(); 
  }
  input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
  input.id = 'hiddenLogoFileInput';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      window.__customLogoDataURL = reader.result;
      const prev = el('editLogoPreview');
      if (prev) prev.src = reader.result;
    };
    reader.readAsDataURL(f);
    input.value = '';
  };
  input.click();
}); 

el('btnSaveEdit')?.addEventListener('click', async () => {
  try {
    const settings = await loadSettings();
    settings.school_name = (el('editSchoolName')?.value || '').trim();
    settings.school_address = (el('editSchoolAddress')?.value || '').trim();
    if (window.__customLogoDataURL) settings.school_logo_dataurl = window.__customLogoDataURL;

    await saveSettings(settings);

    if (el('schoolName')) el('schoolName').textContent = settings.school_name || 'Western International HS';
    if (el('schoolLogo')) el('schoolLogo').src = settings.school_logo_dataurl || el('schoolLogo').src;

    el('editModal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  } catch (err) {
    console.error('[btnSaveEdit] Failed to save settings:', err);
  }
});

el('btnSaveDefaults')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    const settings = await loadSettings();
    const updated = { ...settings, ...getSettings() };
    await saveSettings(updated);
    
    setStatus('Defaults saved.');

    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.disabled = true;
    btn.classList.add('opacity-80');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.classList.remove('opacity-80');
    }, UI_FEEDBACK_TIMEOUT);
  } catch (err) {
    console.error('[btnSaveDefaults] Save defaults failed:', err);
    setStatus('Error saving defaults.');
  }
});

el('btnApplyAllLang')?.addEventListener('click', () => {
  const lang = el('defaultLang').value;
  
  languages.clear();
  if (lang !== 'es') {
    students.forEach(s => languages.set(s.name, lang));
  }
  
  renderTable();
});

el('btnApplyGradeFilter')?.addEventListener('click', () => {
  const cutoffInput = el('gradeCutoff');
  const errorSpan = el('gradeCutoffError');

  const cutoffValue = parseFloat(cutoffInput.value);
  if (isNaN(cutoffValue)) {
    console.warn('[btnApplyGradeFilter] Invalid cutoff value:', cutoffInput.value);
    errorSpan.classList.remove('hidden');
    setTimeout(() => errorSpan.classList.add('hidden'), ERROR_MESSAGE_TIMEOUT);
    return;
  }

  errorSpan.classList.add('hidden');

  students.forEach(s => {
    const pct = parseFloat(String(s.percent).replace(/[^0-9.+-]/g, ''));
    if (isNaN(pct) || pct >= cutoffValue) {
      selected.delete(s.name);
    } else {
      selected.set(s.name, true);
    }
  });

  renderTable();
});