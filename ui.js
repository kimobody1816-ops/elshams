// ============================================================
// THEME — فاتح (الافتراضي، زي نسخة لارافل) أو داكن
// ============================================================
// لوحات الألوان القديمة (Pearl/Ocean/…) اتشالت: التصميم بقى واحد والألوان
// كلها في style.css. المفتاح اتغيّر لـ shams-theme-v2 لأن النسخة القديمة
// كانت بتحفظ «داكن» تلقائياً على كل جهاز، فمن غير كده الكل هيفتح داكن.
const THEME_KEY='shams-theme-v2';

// بقايا اللوحات القديمة كانت بتتكتب inline على <html> — نشيلها
['shams-palette-dark','shams-palette-light','shams-theme'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });

function renderPaletteGrids(){ /* اللوحات اتشالت — مستدعاة من إعدادات المظهر */ }

function setTheme(t) {
  if(t!=='dark') t='light';
  document.documentElement.setAttribute('data-theme',t);
  const icon=document.getElementById('theme-icon');
  if(icon) icon.className = t==='dark'?'fas fa-moon':'fas fa-sun';
  try{ localStorage.setItem(THEME_KEY,t); }catch(e){}
  const od=document.getElementById('opt-dark'), ol=document.getElementById('opt-light');
  if(od) od.style.borderColor = t==='dark'  ? 'var(--accent)' : 'var(--border)';
  if(ol) ol.style.borderColor = t==='light' ? 'var(--accent)' : 'var(--border)';
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur==='dark'?'light':'dark');
}
(function(){
  let t='light';
  try{ t=localStorage.getItem(THEME_KEY)||'light'; }catch(e){}
  document.documentElement.setAttribute('data-theme',t);
  document.addEventListener('DOMContentLoaded',()=>setTheme(t));
})();

function changeFontSize(v) {
  document.body.style.fontSize = v+'px';
  localStorage.setItem('shams-font-size',v);
}
(function(){
  const fs = localStorage.getItem('shams-font-size');
  if(fs){ document.body.style.fontSize=fs+'px'; const el=document.getElementById('font-size-select'); if(el)el.value=fs; }
})();

// ============================================================
// TOAST
// ============================================================
let _toastT=null;
function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.className=`toast toast-${type}`;
  el.innerHTML=`<i class="fas fa-${type==='error'?'times-circle':type==='warning'?'exclamation-triangle':type==='info'?'info-circle':'check-circle'}"></i> ${msg}`;
  el.classList.add('show');
  clearTimeout(_toastT);
  _toastT=setTimeout(()=>el.classList.remove('show'),3200);
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function confirm2(msg,title='تأكيد العملية',icon='⚠️',btnLabel='تأكيد',btnClass='btn-danger'){
  return new Promise(resolve=>{
    confirmCb=resolve;
    document.getElementById('confirm-icon').textContent=icon;
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-msg').textContent=msg;
    document.getElementById('confirm-ok-btn').className=`btn ${btnClass}`;
    document.getElementById('confirm-ok-btn').textContent=btnLabel;
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
function confirmResolve(val){
  document.getElementById('confirm-overlay').classList.remove('open');
  if(confirmCb){ confirmCb(val); confirmCb=null; }
}

// ============================================================
// MODAL
// ============================================================
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }

// ============================================================
// DATE FORMAT
// ============================================================
function fDate(iso){
  if(!iso) return '-';
  try{ return new Date(iso).toLocaleString('ar-EG',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch(e){ return iso; }
}
function fDateShort(iso){
  if(!iso) return '-';
  try{ return new Date(iso).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}); }
  catch(e){ return iso; }
}

// ============================================================
// AVATAR HELPERS
// ============================================================
function getAvatarInitials(name){ return name?name.trim().split(' ').map(w=>w[0]).join('').substr(0,2).toUpperCase():'?'; }
function getRoleAvatarBg(role){ return (ROLES[role]||{}).avatarBg||'#8b949e'; }

// ============================================================
// NAVIGATION
// ============================================================
function nav(page){
  // حارس الصلاحيات — يمنع الوصول حتى لو جاء من صفحة محفوظة في localStorage
  const role=CURRENT_USER?.role;
  if(role && !hasPerm(role,page)){
    const fallback=firstAllowedPage(role);
    toast('لا تملك صلاحية الوصول لهذه الصفحة','error');
    if(fallback && fallback!==page) nav(fallback);
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
  document.getElementById('pg-'+page)?.classList.add('active');
  document.querySelector(`.sb-item[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('pg-title').textContent = PAGE_TITLES[page]||'';
  document.getElementById('pg-icon').className    = PAGE_ICONS[page]||'fas fa-home';
  const fn = window['render'+page.charAt(0).toUpperCase()+page.slice(1)];
  if(typeof fn==='function') fn();
  if(page==='inv-settings' && typeof loadInvSettingsUI==='function') loadInvSettingsUI();
  // حفظ الصفحة الحالية لاستعادتها عند الـ refresh
  try{ localStorage.setItem('shams-last-page', page); }catch(e){}
}

// ============================================================
// BUILD SIDEBAR
// ============================================================
function buildSidebar(){
  const role  = CURRENT_USER?.role||'cashier';
  const pages = rolePages(role);

  // نجمّع الصفحات المسموح بها تحت أقسامها، ونتخطى أي قسم فارغ
  let html='';
  ['العمليات','الإدارة'].forEach(section=>{
    const items=pages.filter(p=>p.section===section);
    if(!items.length) return;
    html+=`<div class="sb-section"><div class="sb-label">${section}</div>`;
    items.forEach(item=>{
      // الورديات: المدير العام يديرها للجميع، وغيره يرى ورديته فقط
      const label = item.page==='shifts'
        ? (role==='admin' ? 'إدارة الورديات' : 'ورديتي')
        : item.label;
      html+=`<div class="sb-item" data-page="${item.page}" onclick="nav('${item.page}')">
        <i class="${item.icon}"></i> ${label}
      </div>`;
    });
    html+='</div>';
  });
  document.getElementById('sb-nav').innerHTML=html;

  // Branch name in sidebar
  const branchName = getBranchName(CURRENT_USER?.branch);
  document.getElementById('sb-branch-name').textContent = branchName || 'النظام المركزي';

  // أزرار الشريط العلوي — تظهر حسب الصفحات المتاحة للدور
  const posBtn  = document.getElementById('tb-pos-btn');
  const custBtn = document.getElementById('tb-cust-search-btn');
  if(posBtn)  posBtn.style.display  = hasPerm(role,'cashier') ? '' : 'none';
  if(custBtn) custBtn.style.display = (hasPerm(role,'customers')||hasPerm(role,'cashier')) ? '' : 'none';
}

// أول صفحة متاحة للدور — يُرجَع إليها عند منع الوصول أو عند الدخول
function firstAllowedPage(role){
  return rolePages(role)[0]?.page || null;
}

function getBranchName(branchId){
  if(!branchId) return null;
  return (S.branches[branchId]||{}).name||null;
}

// ============================================================
// LOGIN — Autocomplete username system
// ============================================================
let acFocusedIdx = -1;
let acFiltered   = [];

function buildUserGrid(users){
  allLoginUsers = Object.entries(users)
    .filter(([,u])=>u.status==='active'&&!u.hidden)
    .map(([id,u])=>({id,...u}));
}

// Called on every keystroke in username input
function onUsernameInput(val){
  clearLoginErr();
  acFocusedIdx = -1;
  const q = val.trim().toLowerCase();

  if(!q){
    closeAcDropdown();
    return;
  }

  // Filter: match username OR full name
  acFiltered = allLoginUsers.filter(u=>
    (u.username||'').toLowerCase().includes(q) ||
    (u.name||'').toLowerCase().includes(q)
  );

  if(!acFiltered.length){
    closeAcDropdown();
    return;
  }

  renderAcDropdown(acFiltered, q);
  openAcDropdown();
}

function onUsernameFocus(){
  const val = document.getElementById('login-username').value.trim();
  if(val) onUsernameInput(val);
}

function onUsernameKeydown(e){
  const dd = document.getElementById('ac-dropdown');
  const isOpen = dd.classList.contains('open');

  if(e.key==='ArrowDown'){
    e.preventDefault();
    if(!isOpen && document.getElementById('login-username').value.trim()) onUsernameInput(document.getElementById('login-username').value);
    acFocusedIdx = Math.min(acFocusedIdx+1, acFiltered.length-1);
    updateAcFocus();
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    acFocusedIdx = Math.max(acFocusedIdx-1, 0);
    updateAcFocus();
  } else if(e.key==='Enter'){
    e.preventDefault();
    if(isOpen && acFocusedIdx>=0 && acFiltered[acFocusedIdx]){
      selectAcUser(acFiltered[acFocusedIdx]);
    } else {
      loginNext();
    }
  } else if(e.key==='Escape'){
    closeAcDropdown();
  }
}

function updateAcFocus(){
  document.querySelectorAll('.ac-item').forEach((el,i)=>{
    el.classList.toggle('focused', i===acFocusedIdx);
    if(i===acFocusedIdx) el.scrollIntoView({block:'nearest'});
  });
}

function renderAcDropdown(users, q){
  const dd = document.getElementById('ac-dropdown');
  dd.innerHTML = users.slice(0,8).map((u,i)=>{
    const role   = ROLES[u.role]||ROLES.cashier;
    const initials = getAvatarInitials(u.name||u.username);
    const bg     = getRoleAvatarBg(u.role);
    // Highlight matching chars in name and username
    const hl = str => str.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<span class="ac-highlight">$1</span>');
    return `<div class="ac-item" data-idx="${i}" onclick="selectAcUser(acFiltered[${i}])">
      <div class="ac-avatar" style="background:${bg};">${initials}</div>
      <div class="ac-info">
        <div class="ac-name">${hl(u.name||u.username)}</div>
        <div class="ac-username">${hl(u.username)}</div>
      </div>
      <span class="badge ${role.badge} ac-role">${role.label}</span>
    </div>`;
  }).join('');
}

function openAcDropdown(){
  document.getElementById('ac-dropdown').classList.add('open');
}
function closeAcDropdown(){
  document.getElementById('ac-dropdown').classList.remove('open');
  acFocusedIdx = -1;
}

function selectAcUser(u){
  if(!u) return;
  loginSelectedUser = u;
  document.getElementById('login-username').value = u.username;
  closeAcDropdown();
  goToPasswordStep();
}

// "التالي" button click
function loginNext(){
  const val = (document.getElementById('login-username').value||'').trim().toLowerCase();
  if(!val){ showLoginErr('أدخل اسم المستخدم'); return; }

  // Exact match first, then partial
  let found = allLoginUsers.find(u=>u.username===val);
  if(!found) found = allLoginUsers.find(u=>u.username.includes(val)||(u.name||'').toLowerCase().includes(val));

  if(!found){ showLoginErr('اسم المستخدم غير موجود أو الحساب غير نشط'); return; }

  loginSelectedUser = found;
  closeAcDropdown();
  goToPasswordStep();
}

function goToPasswordStep(){
  const u = loginSelectedUser;
  if(!u) return;
  const role     = ROLES[u.role]||ROLES.cashier;
  const initials = getAvatarInitials(u.name||u.username);
  const bg       = getRoleAvatarBg(u.role);
  const branchName = getBranchName(u.branch)||'النظام المركزي';

  // Fill selected card
  const avatar = document.getElementById('login-sel-avatar');
  avatar.style.background = bg;
  avatar.textContent = initials;
  document.getElementById('login-sel-name').textContent = u.name||u.username;
  document.getElementById('login-sel-meta').innerHTML =
    `<span class="badge ${role.badge}" style="font-size:10px;">${role.label}</span>
     &nbsp;·&nbsp; ${branchName}`;

  // Switch steps
  document.getElementById('login-step-1').style.display='none';
  document.getElementById('login-step-2').style.display='block';
  document.getElementById('step-dot-1').classList.remove('active');
  document.getElementById('step-dot-1').classList.add('done');
  document.getElementById('step-dot-2').classList.add('active');

  setTimeout(()=>document.getElementById('login-pass').focus(), 80);
}

function loginGoBack(){
  document.getElementById('login-step-2').style.display='none';
  document.getElementById('login-step-1').style.display='block';
  document.getElementById('step-dot-2').classList.remove('active');
  document.getElementById('step-dot-1').classList.remove('done');
  document.getElementById('step-dot-1').classList.add('active');
  document.getElementById('login-pass').value='';
  clearLoginErr();
  loginSelectedUser=null;
  setTimeout(()=>{
    const inp=document.getElementById('login-username');
    inp.focus(); inp.select();
  },80);
}

function toggleLoginPass(){
  const inp = document.getElementById('login-pass');
  const ico = document.getElementById('pass-eye-icon');
  const show = inp.type==='password';
  inp.type  = show?'text':'password';
  ico.className = `fas fa-${show?'eye-slash':'eye'}`;
}

function clearLoginErr(){ document.getElementById('login-err').classList.remove('show'); }
function showLoginErr(msg){
  document.getElementById('login-err-msg').textContent=msg;
  document.getElementById('login-err').classList.add('show');
}

// Close dropdown when clicking outside
document.addEventListener('click',e=>{
  if(!document.getElementById('ac-wrap')?.contains(e.target)) closeAcDropdown();
});

