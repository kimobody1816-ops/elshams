// ============================================================
// BRANCHES PAGE
// ============================================================
function renderBranches(){
  renderBranchStats();
  const grid=document.getElementById('branches-grid');
  if(!grid) return;
  const branches=S.branches||{};
  const rows=Object.entries(branches);

  if(!rows.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;padding:60px 20px;">
      <div class="empty-state-icon">🏢</div>
      <h3>لا توجد فروع</h3>
      <p>أضف أول فرع للبدء</p>
    </div>`;
    return;
  }

  grid.innerHTML=rows.map(([id,b])=>{
    const isActive=b.status==='active';
    const usersInBranch=Object.values(S.users||{}).filter(u=>u.branch===id).length;
    return `<div class="branch-card ${isActive?'':'inactive'}">
      <div class="branch-header">
        <div>
          <div class="branch-name">${b.name}</div>
          <div class="branch-id"><i class="fas fa-tag"></i> ${b.code||id.substr(0,8)}</div>
        </div>
        <span class="badge ${isActive?'badge-success':'badge-danger'}">${isActive?'نشط':'معطل'}</span>
      </div>
      <div class="branch-meta">
        ${b.address?`<div class="branch-meta-item"><i class="fas fa-map-marker-alt"></i> ${b.address}</div>`:''}
        ${b.phone?`<div class="branch-meta-item"><i class="fas fa-phone"></i> ${b.phone}</div>`:''}
        <div class="branch-meta-item"><i class="fas fa-users"></i> ${usersInBranch} مستخدم</div>
        <div class="branch-meta-item"><i class="fas fa-calendar-plus"></i> ${fDateShort(b.createdAt)}</div>
      </div>
      <div class="branch-actions">
        <button class="btn btn-ghost btn-xs" style="flex:1;" onclick="editBranch('${id}')"><i class="fas fa-edit"></i> تعديل</button>
        <button class="btn btn-${isActive?'warning':'success'} btn-xs" onclick="toggleBranchStatus('${id}','${b.status}')">
          <i class="fas fa-${isActive?'pause':'play'}"></i> ${isActive?'تعطيل':'تفعيل'}
        </button>
        <button class="btn btn-danger btn-xs" onclick="delBranch('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderBranchStats(){
  const el=document.getElementById('branches-stats');
  if(!el) return;
  const all=Object.values(S.branches||{});
  const active=all.filter(b=>b.status==='active').length;
  const stats=[
    {label:'إجمالي الفروع',value:all.length,  icon:'fas fa-building',color:'blue'},
    {label:'الفروع النشطة', value:active,       icon:'fas fa-check-circle',color:'green'},
    {label:'الفروع المعطلة',value:all.length-active,icon:'fas fa-pause-circle',color:'yellow'},
  ];
  el.innerHTML=stats.map(s=>`
    <div class="stat-card ${s.color}">
      <div class="stat-icon"><i class="${s.icon}"></i></div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

function openAddBranch(){
  editingBranch=null;
  document.getElementById('branch-modal-title').textContent='فرع جديد';
  ['bf-name','bf-code','bf-address','bf-phone','bf-email'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  document.getElementById('bf-status').value='active';
  openModal('modal-branch');
}

function editBranch(id){
  const b=(S.branches||{})[id];
  if(!b){ toast('الفرع غير موجود','error'); return; }
  editingBranch=id;
  document.getElementById('branch-modal-title').textContent='تعديل فرع';
  document.getElementById('bf-name').value   =b.name||'';
  document.getElementById('bf-code').value   =b.code||'';
  document.getElementById('bf-address').value=b.address||'';
  document.getElementById('bf-phone').value  =b.phone||'';
  document.getElementById('bf-email').value  =b.email||'';
  document.getElementById('bf-status').value =b.status||'active';
  openModal('modal-branch');
}

async function saveBranch(){
  const name   =(document.getElementById('bf-name').value||'').trim();
  const code   =(document.getElementById('bf-code').value||'').trim().toUpperCase();
  const address=(document.getElementById('bf-address').value||'').trim();
  const phone  =(document.getElementById('bf-phone').value||'').trim();
  const email  =(document.getElementById('bf-email').value||'').trim();
  const status = document.getElementById('bf-status').value;

  if(!name){ toast('أدخل اسم الفرع','error'); return; }
  if(!code){ toast('أدخل رمز الفرع','error'); return; }

  // Check duplicate code
  const dup=Object.entries(S.branches||{}).find(([id,b])=>b.code===code&&id!==editingBranch);
  if(dup){ toast('رمز الفرع مستخدم مسبقاً','error'); return; }

  const data={name,code,address,phone,email,status,updatedAt:new Date().toISOString()};
  try{
    if(editingBranch){
      await dbUpdate('branches/'+editingBranch,data);
    } else {
      data.createdAt=new Date().toISOString();
      await dbSet('branches/'+uid(),data);
    }
    closeModal('modal-branch');
    toast(editingBranch?'تم تحديث الفرع ✅':'تم إضافة الفرع ✅');
    renderBranches();
    renderHomeStats();
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function toggleBranchStatus(id,currentStatus){
  const newStatus=currentStatus==='active'?'inactive':'active';
  const label=newStatus==='inactive'?'تعطيل':'تفعيل';
  const b=(S.branches||{})[id];
  const ok=await confirm2(`هل تريد ${label} فرع "${b?.name}"؟`,label+' فرع','🏢',label,'btn-warning');
  if(!ok) return;
  try{ await dbUpdate('branches/'+id,{status:newStatus}); toast(`تم ${label} الفرع`); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function delBranch(id){
  const b=(S.branches||{})[id];
  const usersCount=Object.values(S.users||{}).filter(u=>u.branch===id).length;
  if(usersCount>0){ toast(`لا يمكن حذف الفرع. يوجد ${usersCount} مستخدم مرتبط به. قم بنقلهم أولاً.`,'error'); return; }
  const ok=await confirm2(`حذف فرع "${b?.name}" نهائياً؟`,'حذف فرع','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('branches/'+id); toast('تم حذف الفرع'); renderBranches(); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// POPULATE BRANCH SELECT
// ============================================================
function populateBranchSelect(selectId, selected=''){
  const el=document.getElementById(selectId);
  if(!el) return;
  const branches=Object.entries(S.branches||{}).filter(([,b])=>b.status==='active');
  el.innerHTML='<option value="">-- كل الفروع (مركزي) --</option>';
  branches.forEach(([id,b])=>{
    const opt=document.createElement('option');
    opt.value=id; opt.textContent=b.name;
    if(id===selected) opt.selected=true;
    el.appendChild(opt);
  });
}

