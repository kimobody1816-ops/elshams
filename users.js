// ============================================================
// USERS PAGE
// ============================================================
function renderUsers(){
  const tbody  = document.getElementById('users-tbl');
  if(!tbody) return;
  const users  = S.users||{};
  const q      = (document.getElementById('users-search')?.value||'').trim().toLowerCase();
  const roleF  = document.getElementById('users-filter-role')?.value||'';

  let rows=Object.entries(users).filter(([,u])=>!u.hidden);
  if(q)    rows=rows.filter(([,u])=>(u.username||'').includes(q)||(u.name||'').toLowerCase().includes(q));
  if(roleF)rows=rows.filter(([,u])=>u.role===roleF);

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state" style="padding:30px;"><div class="empty-state-icon">👤</div><p>لا يوجد مستخدمون</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML=rows.map(([id,u],i)=>{
    const role=ROLES[u.role]||{label:u.role,badge:'badge-info'};
    const initials=getAvatarInitials(u.name||u.username);
    const bg=getRoleAvatarBg(u.role);
    const branchName=getBranchName(u.branch)||'—';
    return `<tr>
      <td style="color:var(--text3);font-size:11px;">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="user-avatar" style="background:${bg};width:28px;height:28px;font-size:10px;">${initials}</div>
          <code style="font-size:12px;">${u.username}</code>
        </div>
      </td>
      <td><strong>${u.name||'-'}</strong></td>
      <td><span class="badge ${role.badge}">${role.label}</span></td>
      <td><span style="font-size:12px;color:var(--text2);">${branchName}</span></td>
      <td><span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status==='active'?'نشط':'معطل'}</span></td>
      <td style="font-size:11px;color:var(--text2);">${u.lastLogin?fDate(u.lastLogin):'-'}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="editUser('${id}')" title="تعديل"><i class="fas fa-edit"></i></button>
          ${id!==CURRENT_USER?.id?`<button class="btn btn-danger btn-xs" onclick="delUser('${id}')" title="حذف"><i class="fas fa-trash"></i></button>`:'<span class="badge badge-info" style="font-size:10px;">أنت</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddUser(){
  editingUser=null;
  document.getElementById('user-modal-title').textContent='مستخدم جديد';
  ['uf-username','uf-name','uf-pass'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  document.getElementById('uf-username').disabled=false;
  document.getElementById('uf-role').value='cashier';
  document.getElementById('uf-status').value='active';
  document.getElementById('lbl-pass-req').style.display='inline';
  document.getElementById('lbl-pass-hint').textContent='';
  populateBranchSelect('uf-branch');
  toggleBranchField();
  openModal('modal-user');
}

function editUser(id){
  const u=(S.users||{})[id];
  if(!u||u.hidden){ toast('لا يمكن تعديل هذا الحساب','error'); return; }
  editingUser=id;
  document.getElementById('user-modal-title').textContent='تعديل مستخدم';
  document.getElementById('uf-username').value    =u.username||'';
  document.getElementById('uf-username').disabled =true;
  document.getElementById('uf-name').value        =u.name||'';
  document.getElementById('uf-pass').value        ='';
  document.getElementById('uf-role').value        =u.role||'cashier';
  document.getElementById('uf-status').value      =u.status||'active';
  document.getElementById('lbl-pass-req').style.display='none';
  document.getElementById('lbl-pass-hint').textContent='اتركها فارغة إن لم تريد تغييرها';
  populateBranchSelect('uf-branch',u.branch);
  toggleBranchField();
  openModal('modal-user');
}

function toggleBranchField(){
  const role=document.getElementById('uf-role').value;
  const wrap=document.getElementById('uf-branch-wrap');
  wrap.style.display=role==='admin'?'none':'flex';
}

async function saveUser(){
  const username=(document.getElementById('uf-username').value||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  const name    =(document.getElementById('uf-name').value||'').trim();
  const pass    = document.getElementById('uf-pass').value;
  const role    = document.getElementById('uf-role').value;
  const status  = document.getElementById('uf-status').value;
  const branch  = document.getElementById('uf-branch').value;

  if(!username){ toast('يرجى إدخال اسم المستخدم','error'); return; }
  if(!name)    { toast('يرجى إدخال الاسم الكامل','error'); return; }
  if(!editingUser&&!pass){ toast('يرجى إدخال كلمة المرور','error'); return; }
  if(pass&&pass.length<6){ toast('كلمة المرور 6 أحرف على الأقل','error'); return; }

  const dup=Object.entries(S.users||{}).find(([id,u])=>u.username===username&&id!==editingUser);
  if(dup){ toast('اسم المستخدم مستخدم مسبقاً','error'); return; }

  const data={username,name,role,status,branch:branch||null,updatedAt:new Date().toISOString()};

  try{
    if(editingUser){
      // كلمة مرور جديدة عند التعديل؟ تُجزَّأ وتُستبدل
      if(pass) Object.assign(data, await buildPasswordFields(pass));
      await dbUpdate('users/'+editingUser,data);
    } else {
      Object.assign(data, await buildPasswordFields(pass));
      data.createdAt =new Date().toISOString();
      data.lastLogin =null;
      await dbSet('users/'+uid(),data);
    }
    closeModal('modal-user');
    toast(editingUser
      ? (pass?'تم تحديث المستخدم وكلمة المرور ✅':'تم تحديث المستخدم ✅')
      : 'تم إنشاء الحساب ✅');
  }catch(e){ toast('خطأ: '+(e?.message||e),'error'); }
}

async function delUser(id){
  if(id===CURRENT_USER?.id){ toast('لا يمكن حذف حسابك الحالي','error'); return; }
  const u=(S.users||{})[id];
  if(u?.hidden){ toast('لا يمكن حذف هذا الحساب','error'); return; }
  const ok=await confirm2(
    `حذف المستخدم "${u?.name||u?.username}"؟ لن يستطيع الدخول بعدها إطلاقاً.`,
    'حذف مستخدم','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{
    await dbRemove('users/'+id);
    toast('تم حذف المستخدم — لم يعد يستطيع الدخول');
  }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

