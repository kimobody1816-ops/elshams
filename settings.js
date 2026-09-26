// ============================================================
// SETTINGS
// ============================================================
function switchSettingsPanel(panel){
  document.querySelectorAll('.settings-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(i=>i.classList.remove('active'));
  document.getElementById('sp-'+panel)?.classList.add('active');
  document.querySelector(`.settings-nav-item[data-panel="${panel}"]`)?.classList.add('active');
  if(panel==='general')     loadGeneralSettings();
  if(panel==='appearance')  renderPaletteGrids();
  if(panel==='permissions') renderPermMatrix();
}

// ============================================================
// PERMISSIONS MATRIX — تعديل الصلاحيات من الواجهة
// ============================================================
// مسوّدة التعديلات قبل الحفظ — لا تُطبَّق على النظام حتى يضغط الأدمن حفظ
let permDraft = null;

function permDraftInit(){
  permDraft={};
  PERM_ROLES.forEach(role=>{
    permDraft[role]={};
    PAGE_CATALOG.forEach(p=>{ permDraft[role][p.page]=hasPerm(role,p.page); });
    ACTION_CATALOG.forEach(a=>{ permDraft[role][a.page]=hasPerm(role,a.page); });
  });
}

function renderPermMatrix(){
  const tbody=document.getElementById('perm-tbody'); if(!tbody) return;
  if(!permDraft) permDraftInit();

  let html='';
  ['العمليات','الإدارة','إجراءات'].forEach(section=>{
    const pages=section==='إجراءات' ? ACTION_CATALOG : PAGE_CATALOG.filter(p=>p.section===section);
    if(!pages.length) return;
    html+=`<tr><td colspan="6" style="background:var(--card2);font-weight:800;font-size:11.5px;color:var(--text2);padding:7px 12px;">${section}</td></tr>`;
    pages.forEach(p=>{
      html+=`<tr><td style="text-align:right;"><i class="${p.icon}" style="color:var(--accent);width:16px;"></i> ${p.label}</td>`;
      PERM_ROLES.forEach(role=>{
        const locked = role==='admin';   // المدير العام دائماً كامل الصلاحية
        const on = locked ? true : !!permDraft[role][p.page];
        html+=`<td>
          <input type="checkbox" ${on?'checked':''} ${locked?'disabled':''}
            onchange="togglePerm('${role}','${p.page}',this.checked)"
            title="${locked?'صلاحيات المدير العام مثبّتة':''}"
            style="width:17px;height:17px;cursor:${locked?'not-allowed':'pointer'};accent-color:var(--accent);${locked?'opacity:.55;':''}">
        </td>`;
      });
      html+='</tr>';
    });
  });
  tbody.innerHTML=html;
  markPermDirty(false);
}

function togglePerm(role,page,val){
  if(role==='admin') return;
  if(!permDraft) permDraftInit();
  permDraft[role][page]=!!val;
  markPermDirty(true);
}

function markPermDirty(dirty){
  const note=document.getElementById('perm-dirty-note');
  if(note) note.style.display=dirty?'block':'none';
  const btn=document.getElementById('perm-save-btn');
  if(btn) btn.classList.toggle('btn-warning',!!dirty);
}

async function savePermissions(){
  if(CURRENT_USER?.role!=='admin'){ toast('تعديل الصلاحيات من صلاحية المدير العام فقط','error'); return; }
  if(!permDraft) permDraftInit();

  // نحذّر من دور بلا أي صفحة — سيدخل صاحبه ولا يجد ما يفتحه
  const empty=PERM_ROLES.filter(r=>r!=='admin' && !PAGE_CATALOG.some(p=>permDraft[r][p.page]));
  if(empty.length){
    const names=empty.map(r=>(ROLES[r]||{}).label||r).join('، ');
    const ok=await confirm2(
      `الأدوار التالية بلا أي صفحة: ${names}. من يدخل بها لن يجد شيئاً ليفتحه. حفظ رغم ذلك؟`,
      'دور بلا صلاحيات','⚠️','حفظ','btn-warning');
    if(!ok) return;
  }

  const btn=document.getElementById('perm-save-btn');
  if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; }
  try{
    // المدير العام لا يُخزَّن — hasPerm تمنحه كل شيء دائماً
    const data={};
    PERM_ROLES.filter(r=>r!=='admin').forEach(r=>{ data[r]={...permDraft[r]}; });
    data.updatedAt=new Date().toISOString();
    data.updatedBy=CURRENT_USER?.name||'';
    await dbSet('settings/permissions', data);
    S.settings.permissions=data;
    buildSidebar();
    markPermDirty(false);
    toast('تم حفظ الصلاحيات — سارية على كل الأجهزة ✅','success');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
  finally{
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> حفظ الصلاحيات'; }
  }
}

async function resetPermissions(){
  if(CURRENT_USER?.role!=='admin'){ toast('تعديل الصلاحيات من صلاحية المدير العام فقط','error'); return; }
  const ok=await confirm2(
    'سترجع صلاحيات كل الأدوار للتوزيع الافتراضي الأصلي، وتُلغى كل تعديلاتك.',
    'استعادة الصلاحيات الافتراضية','↩️','استعادة','btn-warning');
  if(!ok) return;
  try{
    await dbRemove('settings/permissions');
    delete S.settings.permissions;
    permDraftInit();
    renderPermMatrix();
    buildSidebar();
    toast('تمت استعادة الصلاحيات الافتراضية ✅','success');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

function loadGeneralSettings(){
  const g=S.settings?.general||{};
  // قائمة الإعدادات تعرض كود العملة (EGP...) وليس الرمز المعروض (ج.م)
  const curCode = CURRENCY_LABELS[g.currency]!==undefined ? g.currency : (g.currencyCode||'EGP');
  const fields={
    'gs-name':g.name||'','gs-sys-name':g.sysName||'',
    'gs-phone':g.phone||'','gs-email':g.email||'',
    'gs-address':g.address||'','gs-currency':curCode,
    'gs-vat':g.vat||'15','gs-inv-prefix':g.invPrefix||'INV-',
    'gs-inv-start':g.invStart||'1001','gs-inv-notes':g.invNotes||'',
  };
  Object.entries(fields).forEach(([id,val])=>{ const el=document.getElementById(id); if(el)el.value=val; });
  const st=localStorage.getItem('shams-session-timeout')||'0';
  const stEl=document.getElementById('session-timeout');
  if(stEl) stEl.value=st;
}

async function saveGeneralSettings(){
  const data={
    name:document.getElementById('gs-name')?.value?.trim()||'',
    sysName:document.getElementById('gs-sys-name')?.value?.trim()||'',
    phone:document.getElementById('gs-phone')?.value?.trim()||'',
    email:document.getElementById('gs-email')?.value?.trim()||'',
    address:document.getElementById('gs-address')?.value?.trim()||'',
    currency:document.getElementById('gs-currency')?.value||'EGP',
    vat:document.getElementById('gs-vat')?.value||'15',
    invPrefix:document.getElementById('gs-inv-prefix')?.value?.trim()||'INV-',
    invStart:document.getElementById('gs-inv-start')?.value||'1001',
    invNotes:document.getElementById('gs-inv-notes')?.value?.trim()||'',
    updatedAt:new Date().toISOString(),
  };
  try{
    await dbSet('settings/general',data);
    toast('تم حفظ الإعدادات ✅');
    renderHomeStats();
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function changeMyPassword(){
  const oldP=document.getElementById('sec-old-pass').value;
  const newP=document.getElementById('sec-new-pass').value;
  const confP=document.getElementById('sec-confirm-pass').value;

  if(!oldP||!newP||!confP){ toast('أكمل جميع الحقول','error'); return; }
  if(newP.length<6){ toast('كلمة المرور الجديدة 6 أحرف على الأقل','error'); return; }
  if(newP!==confP){ toast('كلمتا المرور غير متطابقتين','error'); return; }

  const fresh=(S.users||{})[CURRENT_USER?.id];
  if(!fresh){ toast('تعذّر العثور على حسابك','error'); return; }

  try{
    if(!await verifyPassword(fresh, oldP)){ toast('كلمة المرور الحالية غير صحيحة','error'); return; }
    await dbUpdate('users/'+CURRENT_USER.id, {
      ...(await buildPasswordFields(newP)),
      updatedAt:new Date().toISOString(),
    });
    ['sec-old-pass','sec-new-pass','sec-confirm-pass'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    toast('تم تغيير كلمة المرور بنجاح ✅');
  }catch(e){ toast('خطأ: '+(e?.message||e),'error'); }
}

// ============================================================
// PASSWORD TOGGLE
// ============================================================
function togglePass(inputId,btn){
  const input=document.getElementById(inputId);
  if(!input) return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  btn.innerHTML=`<i class="fas fa-${show?'eye-slash':'eye'}"></i>`;
}

// ============================================================
// INIT DEFAULT DATA
// ============================================================
async function initDefaultData(){
  // Admin user
  const users=S.users||{};
  // حساب المدير العام الافتراضي — يُزرع مرة واحدة على قاعدة فارغة.
  // كلمة المرور تُخزَّن مجزَّأة كغيرها، ويجب تغييرها قبل التسليم.
  const adminExists=Object.values(users).some(u=>u.role==='admin');
  if(!adminExists){
    try{
      await dbSet('users/admin-root',{
        username:'admin',
        name:'المدير العام',
        role:'admin',
        status:'active',
        hidden:false,
        branch:null,
        ...(await buildPasswordFields(window.SHAMS_CONFIG?.defaultAdminPassword||'admin1234')),
        mustChangePassword:true,   // نُذكّر المالك بتغييرها عند أول دخول
        createdAt:new Date().toISOString(),
        lastLogin:null,
      });
    }catch(e){ console.warn('تعذّر زرع حساب المدير',e); }
  }

  // Main branch
  const branches=S.branches||{};
  const mainBranchExists=Object.values(branches).some(b=>b.code==='HQ');
  if(!mainBranchExists){
    await dbSet('branches/main-hq',{
      name:'الفرع الرئيسي',
      code:'HQ',
      address:'',
      phone:'',
      email:'',
      status:'active',
      createdAt:new Date().toISOString(),
    });
  }
}

// ============================================================
// SCROLL TO TOP
// ============================================================
document.querySelector('.main')?.addEventListener('scroll',function(){
  const btn=document.getElementById('scroll-top');
  if(btn) btn.classList.toggle('show',this.scrollTop>300);
});

