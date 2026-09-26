// ============================================================
// SUPPLIERS
// ============================================================
let editingSupplier=null;
function renderPurchases(){ renderPurStats(); renderPurchaseOrders(); renderSuppliers(); }
function renderPurStats(){
  const el=document.getElementById('pur-stats'); if(!el) return;
  const orders=filterByBranch(S.purchaseOrders||{}).map(([,v])=>v);
  const pending=orders.filter(o=>o.status==='pending').length;
  const totalSpent=orders.filter(o=>o.status==='received').reduce((s,o)=>s+(o.total||0),0);
  const supCount=Object.keys(S.suppliers||{}).length;
  const currency=S.settings?.general?.currency||'EGP';
  el.innerHTML=[
    {label:'أوامر الشراء',value:orders.length,icon:'fas fa-clipboard-list',color:'blue'},
    {label:'قيد الانتظار',value:pending,icon:'fas fa-clock',color:'yellow'},
    {label:'الموردون',value:supCount,icon:'fas fa-industry',color:'purple'},
    {label:'إجمالي المشتريات',value:totalSpent.toFixed(0)+' '+currency,icon:'fas fa-coins',color:'green'},
  ].map(s=>`<div class="stat-card ${s.color}"><div class="stat-icon"><i class="${s.icon}"></i></div><div class="stat-value" style="font-size:18px;">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}
function purTab(t){
  document.querySelectorAll('#pg-purchases .tab-btn').forEach((b,i)=>b.classList.toggle('active',['orders','suppliers'][i]===t));
  document.querySelectorAll('#pg-purchases .tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('purt-'+t)?.classList.add('active');
  if(t==='orders') renderPurchaseOrders();
  if(t==='suppliers') renderSuppliers();
}

function renderSuppliers(){
  const tbody=document.getElementById('sup-tbl'); if(!tbody) return;
  const sups=Object.entries(S.suppliers||{});
  if(!sups.length){ tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text2);">لا يوجد موردون. أضف أول مورد!</td></tr>`; return; }
  const currency=S.settings?.general?.currency||'EGP';
  tbody.innerHTML=sups.map(([id,s],i)=>`<tr>
    <td style="color:var(--text3);">${i+1}</td>
    <td><strong>${s.name}</strong>${s.contact?`<div style="font-size:10px;color:var(--text2);">${s.contact}</div>`:''}</td>
    <td>${s.phone||'—'}</td>
    <td>${s.email||'—'}</td>
    <td style="font-weight:700;color:${(s.balance||0)>=0?'var(--green)':'var(--red)'};">${Number(s.balance||0).toFixed(2)} ${currency}</td>
    <td><span class="badge ${s.status==='active'?'badge-success':'badge-danger'}">${s.status==='active'?'نشط':'متوقف'}</span></td>
    <td>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-xs" onclick="openStatement('supplier','${id}')" title="كشف حساب شامل" style="color:var(--accent);border-color:var(--accent);"><i class="fas fa-file-invoice-dollar"></i></button>
        <button class="btn btn-ghost btn-xs" onclick="editSupplier('${id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="delSupplier('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    </td>
  </tr>`).join('');
}

function openAddSupplier(){
  editingSupplier=null;
  document.getElementById('sup-modal-title').textContent='مورد جديد';
  ['sf-name','sf-contact','sf-phone','sf-email','sf-address','sf-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('sf-balance').value='0';
  document.getElementById('sf-status').value='active';
  const w=document.getElementById('sf-dup-warn'); if(w) w.style.display='none';
  openModal('modal-supplier');
}
function editSupplier(id){
  const s=(S.suppliers||{})[id]; if(!s) return;
  editingSupplier=id;
  document.getElementById('sup-modal-title').textContent='تعديل مورد';
  document.getElementById('sf-name').value=s.name||'';
  document.getElementById('sf-contact').value=s.contact||'';
  document.getElementById('sf-phone').value=s.phone||'';
  document.getElementById('sf-email').value=s.email||'';
  document.getElementById('sf-address').value=s.address||'';
  document.getElementById('sf-notes').value=s.notes||'';
  document.getElementById('sf-balance').value=s.balance||0;
  document.getElementById('sf-status').value=s.status||'active';
  const w=document.getElementById('sf-dup-warn'); if(w) w.style.display='none';
  openModal('modal-supplier');
}
// تحذير فوري عند كتابة اسم أو هاتف مورد موجود بالفعل
function checkSupDup(){
  const name =(document.getElementById('sf-name')?.value||'').trim().toLowerCase();
  const phone=(document.getElementById('sf-phone')?.value||'').trim();
  const warnEl=document.getElementById('sf-dup-warn'); if(!warnEl) return;
  const dup=Object.entries(S.suppliers||{}).find(([id,s])=>
    id!==editingSupplier && (
      (name  && (s.name||'').trim().toLowerCase()===name) ||
      (phone && (s.phone||'').trim()===phone)
    ));
  if(dup){
    const byName=(dup[1].name||'').trim().toLowerCase()===name;
    warnEl.style.display='block';
    warnEl.innerHTML=`<i class="fas fa-exclamation-triangle"></i> يوجد مورد بنفس ${byName?'الاسم':'رقم الهاتف'}: <strong>${dup[1].name||'—'}</strong>${dup[1].phone?` — 📞 ${dup[1].phone}`:''}`;
  }else{
    warnEl.style.display='none';
  }
}

async function saveSupplier(){
  const name=(document.getElementById('sf-name').value||'').trim();
  if(!name){ toast('أدخل اسم المورد','error'); return; }
  const phone=(document.getElementById('sf-phone').value||'').trim();
  const dup=Object.entries(S.suppliers||{}).find(([id,s])=>
    id!==editingSupplier && (
      (s.name||'').trim().toLowerCase()===name.toLowerCase() ||
      (phone && (s.phone||'').trim()===phone)
    ));
  if(dup){
    const ok=await confirm2(
      `يوجد مورد بنفس الاسم أو الهاتف: "${dup[1].name||'—'}". هل تريد الحفظ رغم ذلك؟`,
      'مورد مكرر','⚠️','حفظ رغم التكرار','btn-warning');
    if(!ok) return;
  }
  const data={
    name,contact:document.getElementById('sf-contact').value?.trim()||'',
    phone:document.getElementById('sf-phone').value?.trim()||'',
    email:document.getElementById('sf-email').value?.trim()||'',
    address:document.getElementById('sf-address').value?.trim()||'',
    notes:document.getElementById('sf-notes').value?.trim()||'',
    balance:parseFloat(document.getElementById('sf-balance').value||0),
    status:document.getElementById('sf-status').value,
    updatedAt:new Date().toISOString(),
  };
  try{
    if(editingSupplier){ await dbUpdate('suppliers/'+editingSupplier,data); }
    else{ data.createdAt=new Date().toISOString(); await dbSet('suppliers/'+uid(),data); }
    closeModal('modal-supplier');
    toast(editingSupplier?'تم تحديث المورد ✅':'تم إضافة المورد ✅');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}
async function delSupplier(id){
  const s=(S.suppliers||{})[id];
  const ok=await confirm2(`حذف مورد "${s?.name}"؟`,'حذف مورد','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('suppliers/'+id); toast('تم حذف المورد'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

