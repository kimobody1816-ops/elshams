// ============================================================
// AUTH — الدخول باسم مستخدم وكلمة مرور من قاعدة البيانات
// ============================================================
// كلمة المرور لا تُخزَّن كما هي ولا بترميز يُفكّ. تُخزَّن بصمتها
// (SHA-256) مع «ملح» عشوائي لكل مستخدم، فمن يقرأ القاعدة يرى بصمة لا
// تدلّ على الكلمة، والملح يمنع كشف تطابق الكلمة بين مستخدمين.
// النظام السابق كان يستخدم btoa، وهو ترميز يُفكّ في لحظة لا تشفير.

function randomSalt(){
  const a=new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function hashPassword(password, salt){
  const buf=new TextEncoder().encode(salt+':'+password);
  const dig=await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// حقول كلمة المرور كما تُحفظ في سجل المستخدم
async function buildPasswordFields(password){
  const salt=randomSalt();
  return { passSalt:salt, passHash:await hashPassword(password,salt), password:null };
}

// يتحقق من كلمة المرور، ويقبل الحسابات القديمة المخزَّنة بـ btoa
// حتى لا يُقفل الباب في وجه من أُنشئ حسابه قبل هذا التغيير
async function verifyPassword(userRec, password){
  if(!userRec) return false;
  if(userRec.passHash && userRec.passSalt){
    return await hashPassword(password, userRec.passSalt) === userRec.passHash;
  }
  if(userRec.password){
    try{ return userRec.password === btoa(password); }catch(e){ return false; }
  }
  return false;
}

// يرقّي الحساب القديم إلى التجزئة بعد أول دخول ناجح
async function upgradeLegacyPassword(uid, userRec, password){
  if(userRec.passHash || !userRec.password) return;
  try{
    await dbUpdate('users/'+uid, await buildPasswordFields(password));
  }catch(e){ console.warn('تعذّرت ترقية كلمة المرور',e); }
}

// ============================================================
// AUTH — LOGIN
// ============================================================
async function doLogin(){
  if(!loginSelectedUser){ showLoginErr('اختر مستخدماً أولاً'); return; }
  const pass=document.getElementById('login-pass').value||'';
  clearLoginErr();
  if(!pass){ showLoginErr('أدخل كلمة المرور'); return; }

  const uid=loginSelectedUser.id;
  const fresh=(S.users||{})[uid];
  if(!fresh){ showLoginErr('الحساب غير موجود'); return; }
  if(fresh.status!=='active'){ showLoginErr('هذا الحساب موقوف — راجع المدير العام'); return; }

  const btn=document.querySelector('#login-step-2 .login-btn');
  if(btn){ btn.disabled=true; btn.style.opacity='.6'; }
  try{
    if(!await verifyPassword(fresh, pass)){ showLoginErr('كلمة المرور غير صحيحة'); return; }
    await upgradeLegacyPassword(uid, fresh, pass);

    CURRENT_USER={...fresh, id:uid};
    // لا نُبقي بصمة الكلمة في الجلسة ولا في التخزين المحلي
    delete CURRENT_USER.passHash; delete CURRENT_USER.passSalt; delete CURRENT_USER.password;
    localStorage.setItem('shams-user', JSON.stringify(CURRENT_USER));

    dbUpdate('users/'+uid,{ lastLogin:new Date().toISOString() }).catch(()=>{});
    showApp();
    _shiftClosedByAdmin=false;
    ensureMyShift();
    toast(`أهلاً ${fresh.name||fresh.username} 👋`,'success');
  }catch(e){
    showLoginErr('تعذّر الدخول: '+(e?.message||e));
  }finally{
    if(btn){ btn.disabled=false; btn.style.opacity='1'; }
  }
}

// ============================================================
// AUTH — LOGOUT
// ============================================================
async function doLogout(){
  const ok=await confirm2('هل تريد تسجيل الخروج من النظام؟','تسجيل الخروج','👋','خروج','btn-warning');
  if(!ok) return;
  // الوردية لا تُقفل بالخروج — يقفلها المدير العام فقط
  if(CURRENT_SHIFT) toast('ورديتك ما زالت مفتوحة — المدير العام هو من يقفلها','info');

  CURRENT_USER=null;
  CURRENT_SHIFT=null;
  localStorage.removeItem('shams-user');
  localStorage.removeItem('shams-last-page');
  document.getElementById('login-screen').style.display='flex';
  document.querySelector('.layout').style.display='none';
  // Reset login
  loginGoBack();
  document.getElementById('login-pass').value='';
}

// ============================================================
// SHOW APP
// ============================================================
function showApp(restoreLastPage=false){
  document.getElementById('login-screen').style.display='none';
  document.querySelector('.layout').style.display='flex';

  buildSidebar();
  refreshTopbar();

  // كل دور يُفتح على أول صفحة مسموح له بها حسب مصفوفة الصلاحيات
  const role = CURRENT_USER?.role;
  const fallbackPage = firstAllowedPage(role) || 'cashier';
  let lastPage = restoreLastPage ? (localStorage.getItem('shams-last-page')||fallbackPage) : fallbackPage;
  // الصفحة المحفوظة قد تكون سُحبت صلاحيتها بعد آخر دخول
  if(!hasPerm(role,lastPage)) lastPage = fallbackPage;
  nav(lastPage);

  renderHomeStats();
  loadGeneralSettings();

  // Start session timeout if configured
  const timeout=localStorage.getItem('shams-session-timeout');
  if(timeout&&timeout!=='0') startSessionTimeout(parseInt(timeout));
}

// تحديث معلومات المستخدم في شريط العنوان
function refreshTopbar(){
  const info=document.getElementById('topbar-user-info');
  if(info&&CURRENT_USER){
    const role=ROLES[CURRENT_USER.role]||ROLES.cashier;
    const initials=getAvatarInitials(CURRENT_USER.name||CURRENT_USER.username);
    const bg=getRoleAvatarBg(CURRENT_USER.role);
    const branchName=getBranchName(CURRENT_USER.branch);
    info.style.display='flex';
    info.innerHTML=`
      <div class="user-avatar" style="background:${bg};width:32px;height:32px;font-size:12px;">${initials}</div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text);">${CURRENT_USER.name||CURRENT_USER.username}</div>
        ${branchName?`<div style="font-size:10px;color:var(--text3);">${branchName}</div>`:''}
      </div>
      <span class="user-role-badge ${role.color}">${role.label}</span>`;
  }
}

// ============================================================
// SESSION CHECK
// ============================================================
function checkSession(){
  const saved=localStorage.getItem('shams-user');
  if(saved){ try{ CURRENT_USER=JSON.parse(saved); return true; }catch(e){} }
  return false;
}

// ============================================================
// SESSION TIMEOUT
// ============================================================
let sessionTimer=null;
function startSessionTimeout(minutes){
  clearTimeout(sessionTimer);
  if(!minutes) return;
  sessionTimer=setTimeout(()=>{
    toast('انتهت مدة الجلسة. سيتم تسجيل خروجك.','warning');
    setTimeout(()=>{ CURRENT_USER=null; localStorage.removeItem('shams-user'); location.reload(); },2000);
  }, minutes*60*1000);
}
function saveSessionTimeout(v){
  localStorage.setItem('shams-session-timeout',v);
  startSessionTimeout(parseInt(v));
  toast('تم حفظ إعداد الجلسة');
}

