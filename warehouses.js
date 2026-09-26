// ============================================================
// WAREHOUSE — TABS
// ============================================================
function whTab(t){
  ['products','warehouses','categories'].forEach(tab=>{
    document.getElementById('wh-tab-'+tab)?.classList.toggle('active',tab===t);
    document.getElementById('wht-'+tab)?.classList.toggle('active',tab===t);
  });
  if(t==='products')   { renderWhStats(); renderProducts(); }
  if(t==='warehouses') { renderWarehouseList(); }
  if(t==='categories') { renderCategories(); }
}

function renderWarehouse(){ renderWhStats(); renderProducts(); renderNegStockBanner(); }

function renderWhStats(){
  const el=document.getElementById('wh-stats'); if(!el) return;
  // الأدمن يرى كل المنتجات، غير الأدمن يرى منتجات فرعه
  let prods;
  if(isAdmin()){
    prods = Object.values(S.products||{});
  } else {
    const br=myBranchId(), myWhs=myWarehouseIds();
    prods = Object.values(S.products||{}).filter(p=>
      (p.branchId||p.branch||'')===br || myWhs.includes(p.warehouseId||p.whId||'')
    );
  }
  const total=prods.length;
  const low=prods.filter(p=>p.status==='active'&&(+p.qty||0)<=(+p.minQty||5)&&(+p.qty||0)>0).length;
  const outOf=prods.filter(p=>(+p.qty||0)===0).length;
  const whCount = isAdmin()
    ? Object.keys(S.warehouses||{}).length
    : Object.values(S.warehouses||{}).filter(wh=>wh.branchId===myBranchId()).length;
  el.innerHTML=[
    {label:isAdmin()?'إجمالي المنتجات (كل المخازن)':'منتجات مخزنك',value:total,icon:'fas fa-boxes',color:'blue'},
    {label:'منخفضة المخزون',value:low,icon:'fas fa-exclamation-triangle',color:'yellow'},
    {label:'نفاد المخزون',value:outOf,icon:'fas fa-times-circle',color:'red'},
    {label:isAdmin()?'المخازن النشطة':'مخازن فرعك',value:whCount,icon:'fas fa-warehouse',color:'purple'},
  ].map(s=>`<div class="stat-card ${s.color}">
    <div class="stat-icon"><i class="${s.icon}"></i></div>
    <div class="stat-value">${s.value}</div>
    <div class="stat-label">${s.label}</div>
  </div>`).join('');
}

// ============================================================
// WAREHOUSES — إدارة المخازن
// ============================================================
let editingWarehouse = null;

function getWhName(whId){ return (S.warehouses||{})[whId]?.name||'—'; }
function getWhBranchId(whId){ return (S.warehouses||{})[whId]?.branchId||''; }

function renderWarehouseList(){
  const tbody=document.getElementById('wh-tbl'); if(!tbody) return;
  // الأدمن يرى كل المخازن، غير الأدمن يرى مخازن فرعه فقط
  const whs = isAdmin()
    ? Object.entries(S.warehouses||{})
    : Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranchId());
  if(!whs.length){
    tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2);">
      <i class="fas fa-warehouse" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>
      ${isAdmin()?'لا توجد مخازن':'لا توجد مخازن مرتبطة بفرعك'}</td></tr>`;
    return;
  }
  const typeMap={main:'رئيسي 🏭',branch:'فرع 🏪',transit:'عبور 🚚',returns:'مرتجعات 🔄'};
  tbody.innerHTML=whs.map(([id,wh],i)=>{
    const prodCount =Object.values(S.products||{}).filter(p=>(p.warehouseId||p.whId)===id).length;
    const totalUnits=Object.values(S.products||{}).filter(p=>(p.warehouseId||p.whId)===id).reduce((s,p)=>s+(+p.qty||0),0);
    const canEdit = isAdmin() || wh.branchId===myBranchId();
    return `<tr>
      <td style="color:var(--text3);font-size:11px;">${i+1}</td>
      <td><strong>${wh.name}</strong>${wh.notes?`<div style="font-size:10px;color:var(--text3);">${wh.notes}</div>`:''}</td>
      <td><span class="badge badge-info">${getBranchName(wh.branchId)||'مركزي'}</span></td>
      <td style="font-size:12px;">${typeMap[wh.type]||wh.type||'—'}</td>
      <td style="text-align:center;font-weight:700;">${prodCount}</td>
      <td style="text-align:center;color:var(--accent);font-weight:700;">${totalUnits}</td>
      <td><span class="badge ${wh.status==='active'?'badge-success':'badge-danger'}">${wh.status==='active'?'نشط':'متوقف'}</span></td>
      <td style="white-space:nowrap;">
        ${canEdit?`<button class="btn btn-ghost btn-xs" onclick="editWarehouse('${id}')"><i class="fas fa-edit"></i></button>`:''}
        ${isAdmin()?`<button class="btn btn-danger btn-xs" onclick="delWarehouse('${id}')"><i class="fas fa-trash"></i></button>`:''}
      </td>
    </tr>`;
  }).join('');
}

function openAddWarehouse(){
  editingWarehouse=null;
  document.getElementById('wh-modal-title').textContent='مخزن جديد';
  document.getElementById('whf-name').value='';
  document.getElementById('whf-type').value='branch';
  document.getElementById('whf-status').value='active';
  document.getElementById('whf-notes').value='';
  // غير الأدمن → فرعه مقفل
  const branchSel = document.getElementById('whf-branch');
  populateBranchSelect('whf-branch', CURRENT_USER?.branch||'');
  if(!isAdmin() && CURRENT_USER?.branch) {
    if(branchSel) branchSel.disabled = true;
  } else {
    if(branchSel) branchSel.disabled = false;
  }
  openModal('modal-warehouse');
}

function editWarehouse(id){
  editingWarehouse=id;
  const wh=(S.warehouses||{})[id]; if(!wh) return;
  document.getElementById('wh-modal-title').textContent='تعديل مخزن';
  document.getElementById('whf-name').value  =wh.name||'';
  document.getElementById('whf-type').value  =wh.type||'branch';
  document.getElementById('whf-status').value=wh.status||'active';
  document.getElementById('whf-notes').value =wh.notes||'';
  populateBranchSelect('whf-branch',wh.branchId||'');
  openModal('modal-warehouse');
}

async function saveWarehouse(){
  const name=(document.getElementById('whf-name')?.value||'').trim();
  const branchId=document.getElementById('whf-branch')?.value||'';
  if(!name){ toast('يرجى إدخال اسم المخزن','error'); return; }
  const data={name,branchId,branchName:getBranchName(branchId)||'مركزي',
    type:document.getElementById('whf-type').value,
    status:document.getElementById('whf-status').value,
    notes:document.getElementById('whf-notes').value.trim(),
    updatedAt:new Date().toISOString()};
  try{
    if(editingWarehouse) await dbUpdate('warehouses/'+editingWarehouse,data);
    else{ data.createdAt=new Date().toISOString(); await dbSet('warehouses/'+uid(),data); }
    closeModal('modal-warehouse'); toast(editingWarehouse?'تم تعديل المخزن ✅':'تم إضافة المخزن ✅');
    editingWarehouse=null;
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function delWarehouse(id){
  const wh=(S.warehouses||{})[id];
  const prodCount=Object.values(S.products||{}).filter(p=>(p.warehouseId||p.whId)===id).length;
  if(prodCount>0){ toast(`لا يمكن الحذف — المخزن يحتوي على ${prodCount} منتج`,'error'); return; }
  const ok=await confirm2(`حذف مخزن "${wh?.name}"؟`,'حذف مخزن','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('warehouses/'+id); toast('تم حذف المخزن'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

