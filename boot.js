// ============================================================
// FIREBASE EVENTS
// ============================================================
// ── مؤشر حالة الاتصال في الشريط العلوي ──
function setConnState(online){
  const ind=document.getElementById('conn-indicator');
  const dot=document.getElementById('conn-dot');
  const txt=document.getElementById('conn-text');
  if(!ind) return;
  const c = online ? 'green' : 'red';
  ind.style.background   = `var(--${c}-bg)`;
  ind.style.borderColor  = `var(--${c})`;
  ind.style.color        = `var(--${c})`;
  if(dot) dot.style.background = `var(--${c})`;
  if(txt) txt.textContent = online ? 'متصل' : 'غير متصل';
}
window.addEventListener('online', ()=>setConnState(true));
window.addEventListener('offline',()=>setConnState(false));

// ============================================================
// الإقلاع بعد المصادقة
// ============================================================
// القواعد تمنع أي قراءة قبل تسجيل الدخول، لذلك لا تُربط مستمعات البيانات
// إلا بعد نجاح المصادقة. الجلسة الآن هي جلسة Firebase نفسها لا localStorage،
// فلم يعد تعديل التخزين المحلي كافياً لانتحال أي دور.
let _listenersAttached=false;

function attachUsersListener(){
  return new Promise(resolve=>{
    let first=true;
    listen('users',v=>{
      S.users=v||{};
      buildUserGrid(S.users);
      renderIf('users',renderUsers);
      if(CURRENT_USER) renderIf('home',renderHomeStats);
      initDefaultData();
      if(first){ first=false; resolve(); }
    });
  });
}

window.addEventListener('fbReady',()=>{
  const cs=document.getElementById('conn-status');
  if(cs){ cs.textContent='متصل'; cs.classList.remove('offline'); }
  setConnState(navigator.onLine);

  // الجلسة المجهولة تُفتح صامتةً في طبقة Firebase، فنربط المستمعات مباشرة
  // ثم نقرّر: جلسة محفوظة نستأنفها، أو شاشة دخول.
  (async()=>{
    try{
      await attachDataListeners();
      document.getElementById('loading').classList.add('out');

      if(!CURRENT_USER && checkSession()){
        const fresh=(S.users||{})[CURRENT_USER?.id];
        if(fresh && fresh.status==='active'){
          CURRENT_USER={...fresh, id:CURRENT_USER.id};
          delete CURRENT_USER.passHash; delete CURRENT_USER.passSalt; delete CURRENT_USER.password;
          showApp(true);            // true = استعادة آخر صفحة
          ensureMyShift();
          return;
        }
        // الحساب حُذف أو أُوقف بعد آخر دخول
        localStorage.removeItem('shams-user');
        localStorage.removeItem('shams-last-page');
        CURRENT_USER=null;
      }
      if(!CURRENT_USER){
        document.getElementById('login-screen').style.display='flex';
        document.querySelector('.layout').style.display='none';
      }
    }catch(e){
      console.warn('تعذّر الإقلاع',e);
      document.getElementById('loading').classList.add('out');
      document.getElementById('login-screen').style.display='flex';
    }
  })();
});

// كل مستمعات البيانات في مكان واحد — تُربط مرة واحدة بعد المصادقة
async function attachDataListeners(){
  if(_listenersAttached) return;
  _listenersAttached=true;

  await attachUsersListener();   // ننتظر وصول المستخدمين لنعرف من الداخل

  // Listen: branches
  listen('branches',v=>{
    S.branches=v||{};
    renderIf('branches',renderBranches,renderBranchStats);
    renderIf('home',renderHomeStats,renderSystemInfo);
    populateBranchSelect('uf-branch', document.getElementById('uf-branch')?.value);
    populateTrFilters();
    populateInvBranchFilter();
    // إعادة بناء الـ sidebar والـ topbar بعد تحميل الفروع
    // لأنها تحمل بعد showApp فيكون اسم الفرع صحيحاً
    if(CURRENT_USER){
      buildSidebar();
      refreshTopbar();
    }
  });

  // Listen: settings
  listen('settings',v=>{
    const prevPerms=JSON.stringify(S.settings?.permissions||{});
    S.settings=v||{};
    applyCurrencyLabel(); // تحويل كود العملة للرمز العربي قبل أي عرض
    loadGeneralSettings();
    if(document.getElementById('pg-inv-settings')?.classList.contains('active')) loadInvSettingsUI();

    // تغيّرت الصلاحيات من جهاز آخر → نعيد بناء القائمة، وننقل المستخدم
    // إن كان واقفاً على صفحة سُحبت منه للتو
    if(CURRENT_USER && JSON.stringify(S.settings?.permissions||{})!==prevPerms){
      permDraft=null;
      buildSidebar();
      if(document.getElementById('sp-permissions')?.classList.contains('active')) renderPermMatrix();
      const cur=document.querySelector('.page.active')?.id?.replace(/^pg-/,'');
      if(cur && !hasPerm(CURRENT_USER.role,cur)){
        toast('تم تعديل صلاحياتك من قِبل المدير العام','warning');
        const fb=firstAllowedPage(CURRENT_USER.role);
        if(fb) nav(fb);
      }
    }

    renderIf('home',renderHomeStats,renderSystemInfo);
  });

  attachRemainingListeners();
}

window.addEventListener('fbOffline',()=>{
  const cs=document.getElementById('conn-status');
  if(cs){ cs.textContent='غير متصل'; cs.classList.add('offline'); }
  setConnState(false);
  document.getElementById('loading').classList.add('out');
  document.getElementById('login-screen').style.display='flex';
  toast('تعذّر الاتصال بقاعدة البيانات','error');
});

// Enter on password field
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const ls=document.getElementById('login-screen');
    if(ls?.style.display!=='none'){
      const step2=document.getElementById('login-step-2');
      if(step2?.style.display!=='none') doLogin();
    }
  }
});

