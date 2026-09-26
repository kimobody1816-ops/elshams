// ============================================================
// STOCK TRANSFERS — نقل المخزون بين الفروع
// ============================================================
let trItems = [{prodId:'',name:'',qty:1,available:0}];

function renderTransfers() {
  renderTrStats();
  renderTrTable();
}

function renderTrStats() {
  const myBranch = CURRENT_USER?.branch||'';
  const isAdmin  = CURRENT_USER?.role==='admin';
  const myWhIds  = myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch).map(([id])=>id)
    : [];

  const all = Object.values(S.stockTransfers||{}).filter(t=>{
    if(isAdmin || !myBranch) return true;
    return t.fromBranchId===myBranch || t.toBranchId===myBranch ||
           myWhIds.includes(t.fromId) || myWhIds.includes(t.toId);
  });

  const today  = new Date().toISOString().slice(0,10);
  const done   = all.filter(t=>t.status==='completed').length;
  const pend   = all.filter(t=>t.status==='pending').length;
  const disc   = all.filter(t=>t.status==='discrepancy'||t.status==='investigating'||t.status==='counting').length;
  const todayU = all.filter(t=>(t.date||t.createdAt||'').slice(0,10)===today&&t.status==='completed')
                    .reduce((s,t)=>(t.items||[]).reduce((ss,i)=>ss+(+i.qty||0),s),0);
  const el = id=>document.getElementById(id);
  if(el('tr-stat-total'))        el('tr-stat-total').textContent        = all.length;
  if(el('tr-stat-pending'))      el('tr-stat-pending').textContent      = pend;
  if(el('tr-stat-done'))         el('tr-stat-done').textContent         = done;
  if(el('tr-stat-discrepancy'))  el('tr-stat-discrepancy').textContent  = disc;
  if(el('tr-stat-units'))        el('tr-stat-units').textContent        = todayU;
}

function renderTrTable() {
  const tbody   = document.getElementById('tr-tbl'); if(!tbody) return;
  const search  = (document.getElementById('tr-search')?.value||'').toLowerCase();
  const fromF   = document.getElementById('tr-filter-from')?.value||'';
  const toF     = document.getElementById('tr-filter-to')?.value||'';
  const statusF = document.getElementById('tr-filter-status')?.value||'';
  const fromD   = document.getElementById('tr-from-date')?.value||'';
  const toD     = document.getElementById('tr-to-date')?.value||'';

  // مدير الفرع يرى فقط ما يخص فرعه (مصدر أو وجهة)
  const myBranch   = CURRENT_USER?.branch||'';
  const isAdmin    = CURRENT_USER?.role==='admin';
  const myWarehouseIds = myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch).map(([id])=>id)
    : [];

  const rows = Object.entries(S.stockTransfers||{}).filter(([,t])=>{
    const d    = (t.date||t.createdAt||'').slice(0,10);
    const names= (t.items||[]).map(i=>i.name||'').join(' ').toLowerCase();

    // فلتر الصلاحية — غير الأدمن يرى فقط ما يخص فرعه
    if(!isAdmin && myBranch){
      const involvesMyBranch =
        t.fromBranchId===myBranch || t.toBranchId===myBranch ||
        myWarehouseIds.includes(t.fromId) || myWarehouseIds.includes(t.toId);
      if(!involvesMyBranch) return false;
    }

    return (!search  || names.includes(search)||(t.fromName||'').toLowerCase().includes(search)||(t.toName||'').toLowerCase().includes(search))
      && (!fromF   || t.fromId===fromF)
      && (!toF     || t.toId===toF)
      && (!statusF || t.status===statusF)
      && (!fromD   || d>=fromD) && (!toD || d<=toD);
  }).sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0));

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text2);">
      <i class="fas fa-truck-moving" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>
      لا توجد عمليات نقل</td></tr>`;
    return;
  }

  const stMap = {
    completed:    '<span class="badge badge-success">مكتملة ✅</span>',
    pending:      '<span class="badge badge-warning">قيد التنفيذ ⏳</span>',
    counting:     '<span class="badge badge-orange">جاري العد 🔢</span>',
    discrepancy:  '<span class="badge badge-danger">خلاف كمية ⚠️</span>',
    investigating:'<span class="badge badge-purple">تحت التحقيق 🔍</span>',
    cancelled:    '<span class="badge badge-danger">ملغاة ❌</span>',
  };

  tbody.innerHTML = rows.map(([id,t])=>{
    const totalUnits = (t.items||[]).reduce((s,i)=>s+(+i.qty||0),0);
    const prodsSummary = (t.items||[]).map(i=>`${i.name} (${i.qty})`).join(' ، ');
    return `<tr>
      <td style="color:var(--accent);font-weight:700;font-size:11px;">#${id.slice(-5).toUpperCase()}</td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(t.date||t.createdAt)}</td>
      <td>
        <div style="font-weight:600;">${t.fromName||'—'}</div>
        <div style="font-size:10px;color:var(--text3);">${getBranchName(t.fromId)||''}</div>
      </td>
      <td>
        <div style="font-weight:600;">${t.toName||'—'}</div>
        <div style="font-size:10px;color:var(--text3);">${getBranchName(t.toId)||''}</div>
      </td>
      <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${prodsSummary}">${prodsSummary||'—'}</td>
      <td style="text-align:center;"><span class="badge badge-info">${totalUnits} وحدة</span></td>
      <td>${stMap[t.status]||stMap.pending}</td>
      <td style="font-size:11px;color:var(--text2);">${t.createdByName||'—'}</td>
      <td style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.note||''}">${t.note||'—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-xs" onclick="viewTransfer('${id}')" title="عرض"><i class="fas fa-eye"></i></button>
        ${t.status==='pending'?`<button class="btn btn-success btn-xs" onclick="openReceiveCount('${id}')" title="استلام وعد الشحنة"><i class="fas fa-clipboard-check"></i> استلام</button>`:''}
        ${(t.status==='discrepancy'||t.status==='investigating')?`<button class="btn btn-warning btn-xs" onclick="openInvestigate('${id}')" title="التحقيق في الفروقات"><i class="fas fa-search"></i> تحقيق</button>`:''}
        ${t.status==='pending'?`<button class="btn btn-danger btn-xs" onclick="cancelTransfer('${id}')" title="إلغاء"><i class="fas fa-times"></i></button>`:''}
      </td>
    </tr>`;
  }).join('');
}

function populateTrFilters() {
  const myBranch = CURRENT_USER?.branch||'';
  const isAdmin  = CURRENT_USER?.role==='admin';

  // كل المخازن للفلتر
  const allWhOpts = Object.entries(S.warehouses||{}).map(([id,wh])=>
    `<option value="${id}">${wh.name} (${getBranchName(wh.branchId)||'مركزي'})</option>`
  ).join('');

  // مخازن الفرع فقط (للمصدر عند مدير الفرع)
  const myWhOpts = Object.entries(S.warehouses||{})
    .filter(([,wh])=>!myBranch||wh.branchId===myBranch)
    .map(([id,wh])=>`<option value="${id}">${wh.name}</option>`).join('');

  ['tr-filter-from','tr-filter-to'].forEach(sid=>{
    const el=document.getElementById(sid); if(!el) return;
    const cur=el.value;
    const label = sid==='tr-filter-from'?'كل مخازن المصدر':'كل مخازن الوجهة';
    // مدير الفرع في فلتر "من" يرى مخازنه فقط — في "إلى" يرى الكل لأنه قد يستقبل
    const opts = (!isAdmin && myBranch && sid==='tr-filter-from') ? myWhOpts : allWhOpts;
    el.innerHTML=`<option value="">${label}</option>${opts}`;
    el.value=cur;
  });
}

// ─── فتح مودال النقل ────────────────────────────────────
function openAddTransfer() {
  trItems = [{prodId:'',name:'',qty:1,available:0}];
  document.getElementById('tr-date').value   = new Date().toISOString().slice(0,10);
  document.getElementById('tr-note').value   = '';
  document.getElementById('tr-status').value = 'completed';

  const myBranch = CURRENT_USER?.branch||'';
  const isAdmin  = CURRENT_USER?.role==='admin';

  // قائمة المصدر: مدير الفرع يرى مخازنه فقط — الأدمن يرى الكل
  const fromWhs = Object.entries(S.warehouses||{})
    .filter(([,wh])=>wh.status==='active' && (!myBranch||isAdmin||wh.branchId===myBranch));
  const toWhs = Object.entries(S.warehouses||{})
    .filter(([,wh])=>wh.status==='active');

  document.getElementById('tr-from').innerHTML = '<option value="">-- اختر مخزن المصدر --</option>'+
    fromWhs.map(([id,wh])=>`<option value="${id}">${wh.name} — ${getBranchName(wh.branchId)||'مركزي'}</option>`).join('');
  document.getElementById('tr-to').innerHTML = '<option value="">-- اختر مخزن الوجهة --</option>'+
    toWhs.map(([id,wh])=>`<option value="${id}">${wh.name} — ${getBranchName(wh.branchId)||'مركزي'}</option>`).join('');

  // اختر أول مخزن للفرع الحالي تلقائياً
  const myWh = fromWhs.find(([,wh])=>wh.branchId===myBranch);
  if(myWh) document.getElementById('tr-from').value = myWh[0];

  onTrFromChange();
  renderTrItems();
  openModal('modal-transfer');
}

function onTrFromChange() {
  const whId = document.getElementById('tr-from')?.value||'';
  const info  = document.getElementById('tr-from-info');
  const wh    = (S.warehouses||{})[whId];
  const prodCount = Object.values(S.products||{}).filter(p=>(p.warehouseId||p.whId)===whId&&(+p.qty||0)>0).length;
  if(info) info.textContent = whId ? `${wh?.name||''} — ${prodCount} منتج متاح` : '';
  renderTrItems();
}

function onTrToChange() {
  const whId = document.getElementById('tr-to')?.value||'';
  const info  = document.getElementById('tr-to-info');
  const wh    = (S.warehouses||{})[whId];
  if(info) info.textContent = wh ? `${wh.name} (${getBranchName(wh.branchId)||'مركزي'})` : '';
}

// ── توليد باركود داخلي ──
// EAN-13 ببادئة 200 — النطاق المخصص للاستخدام الداخلي داخل المحل،
// فلا يتعارض مع باركودات المصانع، ويُقرأ على أي ماسح عادي.
function ean13CheckDigit(d12){
  let sum=0;
  for(let i=0;i<12;i++) sum += (+d12[i]) * (i%2===0?1:3);
  return String((10 - (sum%10)) % 10);
}

function makeInternalBarcode(){
  const used=new Set(Object.values(S.products||{}).map(p=>String(p.barcode||p.code||'')));
  for(let attempt=0; attempt<50; attempt++){
    const body='200'+String(Math.floor(Math.random()*1e9)).padStart(9,'0');
    const code=body+ean13CheckDigit(body);
    if(!used.has(code)) return code;
  }
  // احتياطي شديد الندرة: نرجع رقماً زمنياً فريداً
  return '200'+Date.now().toString().slice(-10);
}

function genBarcode(){
  const el=document.getElementById('pf-barcode'); if(!el) return;
  const cur=(el.value||'').trim();
  if(cur){
    // لا نمسح كوداً موجوداً بالغلط
    if(!window.confirm(`سيتم استبدال الباركود الحالي (${cur}) بآخر جديد. متابعة؟`)) return;
  }
  el.value=makeInternalBarcode();
  toast('تم توليد باركود داخلي فريد ✅');
}

function addTrItem() {
  trItems.push({prodId:'',name:'',qty:1,available:0});
  renderTrItems();
}

function removeTrItem(i) {
  trItems.splice(i,1);
  // نُبقي سطراً فارغاً واحداً على الأقل حتى لا تصبح القائمة بلا مدخل
  if(!trItems.length) trItems=[{prodId:'',name:'',qty:1,available:0}];
  renderTrItems();
}

function renderTrItems() {
  const el = document.getElementById('tr-items-list'); if(!el) return;
  const fromWhId = document.getElementById('tr-from')?.value||'';

  // منتجات المخزن المصدر فقط
  const availableProds = Object.entries(S.products||{})
    .filter(([,p])=>(!fromWhId||(p.warehouseId||p.whId)===fromWhId)&&(+p.qty||0)>0);

  el.innerHTML = trItems.map((item,i)=>{
    const afterQty   = item.qty>0 ? item.available - item.qty : item.available;
    const afterColor = afterQty<0?'var(--red)':afterQty===0?'var(--yellow)':'var(--green)';
    const selProd = item.prodId?(S.products||{})[item.prodId]:null;
    return `<div style="display:grid;grid-template-columns:1fr 90px 110px 90px 32px;gap:7px;margin-bottom:10px;align-items:center;">
      <div class="prod-search-wrap" style="position:relative;">
        <input class="prod-search-input" id="tr-prod-inp-${i}"
          placeholder="ابحث باسم المنتج..." value="${selProd?selProd.name:item.name||''}"
          oninput="filterTrProductSearch(${i},this.value,'${fromWhId}')"
          onkeydown="navTrSearch(event,${i},'${fromWhId}')"
          autocomplete="off" style="font-size:12px;">
        <i class="fas fa-search prod-search-icon"></i>
        <div class="prod-search-dropdown" id="tr-prod-dd-${i}"></div>
      </div>
      <div style="text-align:center;background:var(--card2);border:1px solid var(--border);border-radius:8px;
           padding:8px 4px;font-size:12px;color:var(--text2);" title="الكمية المتاحة في المخزن">
        ${item.available>0?item.available:'—'}
      </div>
      <input class="fc" type="number" min="1" max="${item.available||9999}"
        id="tr-qty-${i}"
        value="${item.qty||1}"
        onchange="trSetQty(${i},+this.value)"
        style="font-size:14px;text-align:center;font-weight:700;padding:8px;"
        ${!item.prodId?'disabled':''}>
      <div style="text-align:center;background:var(--card2);border:2px solid ${afterColor};border-radius:8px;
           padding:8px 4px;font-size:12px;font-weight:700;color:${afterColor};" title="الكمية بعد النقل">
        ${item.prodId?(afterQty<0?'❌':afterQty):'—'}
      </div>
      <button class="btn btn-danger btn-xs" onclick="removeTrItem(${i})" style="height:36px;"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
}

function filterTrProductSearch(idx, query, fromWhId){
  const dd=document.getElementById('tr-prod-dd-'+idx); if(!dd) return;
  const q=query.trim().toLowerCase();
  if(!q){ dd.classList.remove('open'); dd.innerHTML=''; return; }
  const prods=Object.entries(S.products||{})
    .filter(([,p])=>(!fromWhId||(p.warehouseId||p.whId)===fromWhId)&&(+p.qty||0)>0)
    .filter(([,p])=>p.name?.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
  if(!prods.length){
    dd.innerHTML=`<div class="prod-search-empty"><i class="fas fa-search"></i> لا توجد نتائج</div>`;
    dd.classList.add('open'); return;
  }
  dd.innerHTML=prods.slice(0,12).map(([id,p])=>`
    <div class="prod-search-item" onmousedown="selectTrProduct(${idx},'${id}')"
      onmouseover="this.classList.add('focused')" onmouseout="this.classList.remove('focused')">
      <div>
        <div class="ps-name">${p.name}</div>
        <div class="ps-meta">${p.code||''}</div>
      </div>
      <span class="ps-qty${(p.qty||0)<5?' low':''}">${p.qty||0}</span>
    </div>`).join('');
  dd.classList.add('open');
}
function selectTrProduct(idx, prodId){
  const p=(S.products||{})[prodId]; if(!p) return;
  trItems[idx].prodId=prodId; trItems[idx].name=p.name; trItems[idx].available=+p.qty||0;
  const inp=document.getElementById('tr-prod-inp-'+idx);
  const dd=document.getElementById('tr-prod-dd-'+idx);
  if(inp) inp.value=p.name;
  if(dd){ dd.classList.remove('open'); dd.innerHTML=''; }
  renderTrItems();
}
function navTrSearch(e,idx,fromWhId){
  const dd=document.getElementById('tr-prod-dd-'+idx); if(!dd) return;
  const items=[...dd.querySelectorAll('.prod-search-item')];
  const cur=dd.querySelector('.prod-search-item.focused');
  if(e.key==='ArrowDown'){ e.preventDefault(); const next=cur?items[items.indexOf(cur)+1]:items[0]; if(next){items.forEach(x=>x.classList.remove('focused'));next.classList.add('focused');} }
  else if(e.key==='ArrowUp'){ e.preventDefault(); const prev=cur?items[items.indexOf(cur)-1]:items[items.length-1]; if(prev){items.forEach(x=>x.classList.remove('focused'));prev.classList.add('focused');} }
  else if(e.key==='Enter'||e.key==='Tab'){ if(cur){ e.preventDefault(); const id=cur.getAttribute('data-id')||cur.querySelector('[data-id]')?.getAttribute('data-id'); if(id) selectTrProduct(idx,id); }}
  else if(e.key==='Escape'){ dd.classList.remove('open'); dd.innerHTML=''; }
}

function trSetQty(i, val) {
  const item = trItems[i]; if(!item) return;
  const newQty = Math.max(1, Math.min(val||1, item.available||9999));
  trItems[i].qty = newQty;
  // تحديث حقل الكمية فقط بدون إعادة رسم كاملة
  const input = document.getElementById('tr-qty-'+i);
  if(input) input.value = newQty;
  // تحديث حقل "بعد النقل" فقط
  const afterQty = item.available - newQty;
  const afterColor = afterQty<0?'var(--red)':afterQty===0?'var(--yellow)':'var(--green)';
  const afterEl = input?.parentElement?.children[3];
  if(afterEl){
    afterEl.textContent = afterQty<0?'❌':afterQty;
    afterEl.style.color = afterColor;
    afterEl.style.borderColor = afterColor;
  }
}

function trSelectProd(i, prodId) {
  const p = (S.products||{})[prodId];
  trItems[i] = { prodId, name:p?.name||'', qty:1, available:+(p?.qty||0) };
  renderTrItems();
}

// ─── حفظ عملية النقل (مخزن → مخزن) ────────────────────
async function saveTransfer() {
  const fromWhId = document.getElementById('tr-from')?.value||'';
  const toWhId   = document.getElementById('tr-to')?.value||'';
  const date     = document.getElementById('tr-date')?.value||new Date().toISOString().slice(0,10);
  const note     = (document.getElementById('tr-note')?.value||'').trim();
  const status   = document.getElementById('tr-status')?.value||'completed';

  if(!fromWhId) { toast('يرجى اختيار مخزن المصدر','error'); return; }
  if(!toWhId)   { toast('يرجى اختيار مخزن الوجهة','error'); return; }
  if(fromWhId===toWhId){ toast('مخزن المصدر والوجهة متماثلان','error'); return; }

  const validItems = trItems.filter(i=>i.prodId&&(+i.qty||0)>0);
  if(!validItems.length){ toast('يرجى إضافة منتج واحد على الأقل','error'); return; }

  // التحقق من الكميات
  for(const item of validItems){
    const p = (S.products||{})[item.prodId];
    if(!p){ toast(`المنتج "${item.name}" غير موجود`,'error'); return; }
    if((+p.qty||0)<item.qty){ toast(`الكمية المطلوبة لـ"${item.name}" (${item.qty}) أكبر من المتاح (${p.qty})`,'error'); return; }
    if((p.warehouseId||p.whId)!==fromWhId){ toast(`"${item.name}" ليس في مخزن المصدر`,'error'); return; }
  }

  const fromWh   = (S.warehouses||{})[fromWhId];
  const toWh     = (S.warehouses||{})[toWhId];
  const fromName = fromWh?.name||fromWhId;
  const toName   = toWh?.name||toWhId;
  const fromBrId = fromWh?.branchId||'';
  const toBrId   = toWh?.branchId||'';

  const txData = {
    fromId: fromWhId, fromName, fromBranchId: fromBrId, fromBranchName: getBranchName(fromBrId)||'مركزي',
    toId:   toWhId,   toName,   toBranchId:   toBrId,   toBranchName:   getBranchName(toBrId)||'مركزي',
    date, note, status,
    items: validItems.map(i=>({prodId:i.prodId,name:i.name,qty:i.qty})),
    createdBy:     CURRENT_USER?.id||'',
    createdByName: CURRENT_USER?.name||CURRENT_USER?.username||'',
    createdAt:     new Date().toISOString(),
    ...shiftStamp(),
  };

  try {
    const txId = uid();
    await dbSet('stockTransfers/'+txId, txData);

    if(status==='completed'){
      for(const item of validItems){
        const p   = (S.products||{})[item.prodId];
        const newQ = Math.max(0,(+p.qty||0)-item.qty);

        // خصم من مخزن المصدر
        await dbUpdate('products/'+item.prodId,{
          qty: newQ, updatedAt:new Date().toISOString()
        });

        // إضافة لمخزن الوجهة — نفس المنتج أو نسخة جديدة
        const destProd = Object.entries(S.products||{}).find(([,dp])=>
          (dp.warehouseId||dp.whId)===toWhId && dp.name===item.name
        );
        if(destProd){
          await dbUpdate('products/'+destProd[0],{
            qty:(+destProd[1].qty||0)+item.qty,
            updatedAt:new Date().toISOString()
          });
        } else {
          // إنشاء نسخة المنتج في المخزن الجديد
          const np={...p,
            warehouseId:toWhId, whId:toWhId, warehouseName:toName,
            branchId:toBrId, branch:toBrId, branchName:getBranchName(toBrId)||'مركزي',
            qty:item.qty, createdAt:new Date().toISOString()
          };
          delete np._id;
          await dbSet('products/'+uid(), np);
        }

        // سجل الحركات
        await dbPushMovement({date:new Date(date).toISOString(),product:item.name,
          type:'out',qty:item.qty,branchId:fromBrId,warehouseId:fromWhId,
          note:`نقل إلى ${toName}${note?' — '+note:''}`});
        await dbPushMovement({date:new Date(date).toISOString(),product:item.name,
          type:'in', qty:item.qty,branchId:toBrId,  warehouseId:toWhId,
          note:`نقل من ${fromName}${note?' — '+note:''}`});
      }
    }

    closeModal('modal-transfer');
    toast(status==='completed'?'✅ تم تنفيذ النقل بين المخازن':'✅ تم تسجيل أمر النقل (قيد التنفيذ)');
    viewTransfer(txId);
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ─── تأكيد استلام النقل (pending → completed) ───────────
async function confirmTransfer(txId) {
  const ok = await confirm2('تأكيد استلام هذه الشحنة؟ سيتم تحديث المخزون.','تأكيد الاستلام','✅','تأكيد','btn-success');
  if(!ok) return;
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  try{
    for(const item of (tx.items||[])){
      const p = (S.products||{})[item.prodId];
      if(p){ await dbUpdate('products/'+item.prodId,{qty:Math.max(0,(+p.qty||0)-item.qty),updatedAt:new Date().toISOString()}); }
      // الوجهة: بالمخزن
      const destProd = Object.entries(S.products||{}).find(([,dp])=>
        (dp.warehouseId||dp.whId)===tx.toId && dp.name===item.name
      );
      if(destProd){
        await dbUpdate('products/'+destProd[0],{qty:(+destProd[1].qty||0)+item.qty,updatedAt:new Date().toISOString()});
      } else if(p){
        const toWh=(S.warehouses||{})[tx.toId];
        const np={...p,warehouseId:tx.toId,whId:tx.toId,warehouseName:tx.toName,
          branchId:tx.toBranchId||toWh?.branchId||'',
          branchName:tx.toBranchName||getBranchName(toWh?.branchId)||'مركزي',
          qty:item.qty,createdAt:new Date().toISOString()};
        delete np._id; await dbSet('products/'+uid(),np);
      }
      await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'out',qty:item.qty,
        branchId:tx.fromBranchId||'',warehouseId:tx.fromId,note:`نقل إلى ${tx.toName}`});
      await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'in', qty:item.qty,
        branchId:tx.toBranchId||'',  warehouseId:tx.toId,  note:`نقل من ${tx.fromName}`});
    }
    await dbUpdate('stockTransfers/'+txId,{status:'completed',completedAt:new Date().toISOString(),completedBy:CURRENT_USER?.name||''});
    toast('✅ تم تأكيد الاستلام وتحديث المخزون');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function cancelTransfer(txId) {
  const ok = await confirm2('إلغاء هذا النقل؟','إلغاء نقل','❌','إلغاء','btn-danger');
  if(!ok) return;
  try{
    await dbUpdate('stockTransfers/'+txId,{status:'cancelled',cancelledAt:new Date().toISOString(),cancelledBy:CURRENT_USER?.name||''});
    toast('تم إلغاء النقل');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ═══════════════════════════════════════════════════════════
//  ميزة العد والاستلام والتحقيق
// ═══════════════════════════════════════════════════════════

// ─── فتح نافذة الاستلام والعد ───────────────────────────
function openReceiveCount(txId) {
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  window._recvTxId = txId;

  const itemsHtml = (tx.items||[]).map((it,i)=>`
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:14px;font-weight:700;">${it.name}</div>
        <div style="background:var(--accent-bg);color:var(--accent);border-radius:8px;padding:4px 12px;font-size:13px;font-weight:700;">
          📦 المرسَل: <strong>${it.qty}</strong> وحدة
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center;">
        <div>
          <label style="font-size:12px;color:var(--text2);font-weight:600;">الكمية المستلمة (بعد العد الفعلي)</label>
          <input type="number" class="fc" id="recv-qty-${i}"
            value="${it.qty}" min="0" max="${it.qty*2}"
            oninput="checkRecvQty(${i},${it.qty})"
            style="margin-top:5px;font-size:16px;font-weight:700;text-align:center;">
        </div>
        <div id="recv-status-${i}" style="text-align:center;padding:10px;border-radius:9px;background:var(--green-bg);color:var(--green);font-weight:700;font-size:13px;">
          ✅ متطابق
        </div>
      </div>
      <div id="recv-diff-${i}" style="display:none;margin-top:8px;background:var(--red-bg);border:1px solid var(--red);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--red);">
      </div>
    </div>
  `).join('');

  document.getElementById('tr-receive-body').innerHTML = `
    <div style="background:var(--card2);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:700;">شحنة #${txId.slice(-6).toUpperCase()}</div>
        <div style="font-size:12px;color:var(--text2);">من: ${tx.fromName} &nbsp;→&nbsp; إلى: ${tx.toName}</div>
      </div>
      <div style="font-size:12px;color:var(--text2);">${fDateShort(tx.date||tx.createdAt)}</div>
    </div>
    <div style="background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--yellow);">
      <i class="fas fa-info-circle"></i>
      <strong>تعليمات العد:</strong> قم بعد المنتجات الواردة فعلياً. إذا تطابقت الكميات → قبول تلقائي. أي فرق → يُفتح تحقيق.
    </div>
    ${itemsHtml}
    <div style="margin-top:14px;">
      <label style="font-size:12px;color:var(--text2);font-weight:600;">ملاحظات المستلم</label>
      <textarea class="fc" id="recv-note" rows="2" placeholder="أي ملاحظات على الشحنة المستلمة..." style="margin-top:5px;"></textarea>
    </div>
  `;
  openModal('modal-tr-receive');
}

function checkRecvQty(i, sent) {
  const input = document.getElementById('recv-qty-'+i);
  const statusEl = document.getElementById('recv-status-'+i);
  const diffEl = document.getElementById('recv-diff-'+i);
  const val = +input.value||0;
  const diff = val - sent;
  if(diff === 0){
    statusEl.style.background='var(--green-bg)'; statusEl.style.color='var(--green)';
    statusEl.textContent='✅ متطابق'; diffEl.style.display='none';
  } else if(diff < 0){
    statusEl.style.background='var(--red-bg)'; statusEl.style.color='var(--red)';
    statusEl.textContent=`⚠️ ناقص ${Math.abs(diff)} وحدة`;
    diffEl.style.display='block';
    diffEl.textContent=`تحذير: المستلم (${val}) أقل من المُرسَل (${sent}) بمقدار ${Math.abs(diff)} وحدة — سيُفتح تحقيق`;
  } else {
    statusEl.style.background='var(--yellow-bg)'; statusEl.style.color='var(--yellow)';
    statusEl.textContent=`⚠️ زيادة ${diff} وحدة`;
    diffEl.style.display='block';
    diffEl.style.borderColor='var(--yellow)'; diffEl.style.background='var(--yellow-bg)'; diffEl.style.color='var(--yellow)';
    diffEl.textContent=`ملاحظة: المستلم (${val}) أكثر من المُرسَل (${sent}) بمقدار ${diff} وحدة — سيُفتح تحقيق`;
  }
}

async function submitReceiveCount() {
  const txId = window._recvTxId; if(!txId) return;
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  const recvNote = (document.getElementById('recv-note')?.value||'').trim();

  const countedItems = (tx.items||[]).map((it,i)=>{
    const counted = +document.getElementById('recv-qty-'+i)?.value||0;
    return { ...it, countedQty: counted, diff: counted - it.qty };
  });

  const hasDiff = countedItems.some(ci=>ci.diff !== 0);

  if(!hasDiff){
    // كل شيء متطابق → قبول مباشر
    try{
      for(const item of countedItems){
        const p = (S.products||{})[item.prodId];
        if(p){ await dbUpdate('products/'+item.prodId,{qty:Math.max(0,(+p.qty||0)-item.qty),updatedAt:new Date().toISOString()}); }
        const destProd = Object.entries(S.products||{}).find(([,dp])=>
          (dp.warehouseId||dp.whId)===tx.toId && dp.name===item.name
        );
        if(destProd){
          await dbUpdate('products/'+destProd[0],{qty:(+destProd[1].qty||0)+item.qty,updatedAt:new Date().toISOString()});
        } else if(p){
          const toWh=(S.warehouses||{})[tx.toId];
          const np={...p,warehouseId:tx.toId,whId:tx.toId,warehouseName:tx.toName,
            branchId:tx.toBranchId||toWh?.branchId||'',
            branchName:tx.toBranchName||getBranchName(toWh?.branchId)||'مركزي',
            qty:item.qty,createdAt:new Date().toISOString()};
          delete np._id; await dbSet('products/'+uid(),np);
        }
        await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'out',qty:item.qty,
          branchId:tx.fromBranchId||'',warehouseId:tx.fromId,note:`نقل إلى ${tx.toName}`});
        await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'in',qty:item.qty,
          branchId:tx.toBranchId||'',warehouseId:tx.toId,note:`نقل من ${tx.fromName} — تأكيد العد ✅`});
      }
      await dbUpdate('stockTransfers/'+txId,{
        status:'completed', completedAt:new Date().toISOString(), completedBy:CURRENT_USER?.name||'',
        countedItems, receivedNote:recvNote, receivedBy:CURRENT_USER?.name||''
      });
      closeModal('modal-tr-receive');
      toast('✅ تم تأكيد الاستلام — الكميات متطابقة!','success');
    }catch(e){ toast('خطأ: '+e.message,'error'); }
  } else {
    // يوجد فروقات → حفظ العد وفتح تحقيق
    try{
      await dbUpdate('stockTransfers/'+txId,{
        status:'discrepancy',
        countedItems,
        receivedNote:recvNote,
        receivedBy:CURRENT_USER?.name||'',
        discrepancyAt:new Date().toISOString(),
      });
      closeModal('modal-tr-receive');
      toast('⚠️ تم تسجيل فروقات في الكميات — يُرجى فتح تحقيق','warning');
      // افتح نافذة التحقيق مباشرة
      setTimeout(()=>openInvestigate(txId),400);
    }catch(e){ toast('خطأ: '+e.message,'error'); }
  }
}

// ─── نافذة التحقيق في الفروقات ───────────────────────────
function openInvestigate(txId) {
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  window._invTxId = txId;

  const itemsHtml = (tx.countedItems||tx.items||[]).map((ci,i)=>{
    const sentQty   = ci.qty||0;
    const countedQty= ci.countedQty!=null ? ci.countedQty : sentQty;
    const diff      = countedQty - sentQty;
    const diffColor = diff===0?'var(--green)':diff<0?'var(--red)':'var(--yellow)';
    const diffLabel = diff===0?'متطابق':diff<0?`ناقص ${Math.abs(diff)}`:`زيادة ${diff}`;
    return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:9px 12px;font-weight:600;">${ci.name}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700;color:var(--accent);">${sentQty}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700;">${countedQty}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:900;color:${diffColor};">${diff===0?'✅':diff<0?'⬇️':'⬆️'} ${diffLabel}</td>
    </tr>`;
  }).join('');

  const prevNotes = tx.investigationNotes||[];
  const notesHtml = prevNotes.length ? prevNotes.map(n=>`
    <div style="background:var(--card2);border-right:3px solid var(--accent);border-radius:6px;padding:8px 12px;margin-bottom:7px;font-size:12px;">
      <div style="color:var(--text2);font-size:10px;margin-bottom:3px;">${n.by||'—'} — ${n.at?fDateShort(n.at):''}</div>
      <div>${n.text}</div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:12px;">لا توجد ملاحظات بعد</div>';

  document.getElementById('tr-investigate-body').innerHTML = `
    <div style="background:var(--card2);border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:700;">شحنة #${txId.slice(-6).toUpperCase()}</div>
        <div style="font-size:12px;color:var(--text2);">من: ${tx.fromName} → ${tx.toName}</div>
        <div style="font-size:11px;color:var(--text3);">المستلم: ${tx.receivedBy||'—'} | ${fDateShort(tx.discrepancyAt)}</div>
      </div>
      <span class="badge badge-danger">خلاف كمية ⚠️</span>
    </div>

    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="background:var(--card2);padding:9px 14px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);">
        <i class="fas fa-table"></i> جدول الفروقات
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:var(--card2);border-bottom:1px solid var(--border);">
          <th style="padding:8px 12px;text-align:right;">المنتج</th>
          <th style="padding:8px 12px;text-align:center;">المُرسَل</th>
          <th style="padding:8px 12px;text-align:center;">المستلَم (العد)</th>
          <th style="padding:8px 12px;text-align:center;">الفرق</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>

    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;"><i class="fas fa-comments"></i> سجل التحقيق</div>
      <div id="inv-notes-list">${notesHtml}</div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <textarea class="fc" id="inv-new-note" rows="2" placeholder="إضافة ملاحظة للتحقيق..." style="flex:1;"></textarea>
        <button class="btn btn-ghost btn-sm" style="align-self:flex-end;" onclick="addInvNote('${txId}')"><i class="fas fa-plus"></i> إضافة</button>
      </div>
    </div>

    <div style="background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:9px;padding:10px 14px;font-size:12px;color:var(--yellow);">
      <strong>خيارات الحل:</strong><br>
      1️⃣ <strong>المرسل يؤكد خطأ في العد</strong> → سيتم قبول الكمية المرسَلة وإغلاق التحقيق<br>
      2️⃣ <strong>تسجيل فقد / سرقة / حريق / تلف</strong> → يُخصم من المخزون ويُسجَّل في السجلات
    </div>
  `;
  openModal('modal-tr-investigate');
}

async function addInvNote(txId) {
  const txt = (document.getElementById('inv-new-note')?.value||'').trim();
  if(!txt){ toast('اكتب ملاحظة أولاً','error'); return; }
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  const notes = [...(tx.investigationNotes||[]), {
    text:txt, by:CURRENT_USER?.name||'', at:new Date().toISOString()
  }];
  try{
    await dbUpdate('stockTransfers/'+txId,{investigationNotes:notes, status:'investigating'});
    document.getElementById('inv-new-note').value='';
    toast('تم إضافة الملاحظة');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function resolveSenderConfirm(txId) {
  if(!txId) return;
  const ok = await confirm2('المرسل يؤكد أن الكميات المُرسَلة صحيحة وأن الخطأ في العد؟ سيُقبل الشحنة بالكمية الأصلية.','تأكيد المرسل','✅','تأكيد وإغلاق','btn-success');
  if(!ok) return;
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  try{
    for(const item of (tx.items||[])){
      const p = (S.products||{})[item.prodId];
      if(p){ await dbUpdate('products/'+item.prodId,{qty:Math.max(0,(+p.qty||0)-item.qty),updatedAt:new Date().toISOString()}); }
      const destProd = Object.entries(S.products||{}).find(([,dp])=>
        (dp.warehouseId||dp.whId)===tx.toId && dp.name===item.name
      );
      if(destProd){
        await dbUpdate('products/'+destProd[0],{qty:(+destProd[1].qty||0)+item.qty,updatedAt:new Date().toISOString()});
      } else if(p){
        const toWh=(S.warehouses||{})[tx.toId];
        const np={...p,warehouseId:tx.toId,whId:tx.toId,warehouseName:tx.toName,
          branchId:tx.toBranchId||toWh?.branchId||'',
          branchName:tx.toBranchName||getBranchName(toWh?.branchId)||'مركزي',
          qty:item.qty,createdAt:new Date().toISOString()};
        delete np._id; await dbSet('products/'+uid(),np);
      }
      await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'out',qty:item.qty,
        branchId:tx.fromBranchId||'',warehouseId:tx.fromId,note:`نقل إلى ${tx.toName} — تأكيد المرسل`});
      await dbPushMovement({date:new Date().toISOString(),product:item.name,type:'in',qty:item.qty,
        branchId:tx.toBranchId||'',warehouseId:tx.toId,note:`نقل من ${tx.fromName} — خطأ في العد — تأكيد المرسل`});
    }
    await dbUpdate('stockTransfers/'+txId,{
      status:'completed', completedAt:new Date().toISOString(), completedBy:CURRENT_USER?.name||'',
      resolution:'sender_confirmed', resolvedAt:new Date().toISOString()
    });
    closeModal('modal-tr-investigate');
    toast('✅ تم إغلاق التحقيق وقبول الشحنة بالكمية الأصلية','success');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ─── نافذة تسجيل الفقد / السرقة / الحريق / التلف ────────
function openLossModal(txId) {
  if(!txId) return;
  window._lossTxId = txId;
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;

  const lossItems = (tx.countedItems||tx.items||[]).map((ci,i)=>{
    const sentQty    = ci.qty||0;
    const countedQty = ci.countedQty!=null ? ci.countedQty : sentQty;
    const diffAbs    = Math.max(0, sentQty - countedQty);
    return `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:700;">${ci.name}</div>
        <div style="font-size:12px;color:var(--text2);">مُرسَل: ${sentQty} | مستلَم: ${countedQty} | <span style="color:var(--red);font-weight:700;">مفقود: ${diffAbs}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
        <div>
          <label style="font-size:11px;color:var(--text2);">كمية الفقد المُسجَّلة</label>
          <input type="number" class="fc" id="loss-qty-${i}" value="${diffAbs}" min="0" max="${sentQty}" style="margin-top:4px;">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text2);">نوع الفقد</label>
          <select class="fc" id="loss-type-${i}" style="margin-top:4px;">
            <option value="theft">سرقة 🚨</option>
            <option value="fire">حريق 🔥</option>
            <option value="damage">تلف / كسر 💔</option>
            <option value="lost">ضياع / مفقود 📦</option>
            <option value="other">أخرى</option>
          </select>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('tr-loss-body').innerHTML = `
    <div style="background:var(--red-bg);border:1px solid var(--red);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--red);">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>تحذير:</strong> سيتم خصم الكميات المسجلة من المخزون نهائياً وتسجيلها في سجل الخسائر.
    </div>
    ${lossItems}
    <div style="margin-top:10px;">
      <label style="font-size:12px;color:var(--text2);font-weight:600;">ملاحظات الفقد / محضر الحادثة</label>
      <textarea class="fc" id="loss-note" rows="3" placeholder="اكتب تفاصيل الحادثة، الشهود، تاريخ الاكتشاف..." style="margin-top:5px;"></textarea>
    </div>
  `;
  closeModal('modal-tr-investigate');
  openModal('modal-tr-loss');
}

async function submitLossRecord() {
  const txId = window._lossTxId; if(!txId) return;
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  const lossNote = (document.getElementById('loss-note')?.value||'').trim();
  const items = (tx.countedItems||tx.items||[]);

  const lossRecords = items.map((ci,i)=>{
    const lossQty  = +document.getElementById('loss-qty-'+i)?.value||0;
    const lossType = document.getElementById('loss-type-'+i)?.value||'other';
    return { prodId:ci.prodId, name:ci.name, sentQty:ci.qty||0, countedQty:ci.countedQty!=null?ci.countedQty:ci.qty, lossQty, lossType };
  }).filter(lr=>lr.lossQty>0);

  if(!lossRecords.length){ toast('لم يتم تسجيل أي كمية فقد','error'); return; }

  const lossTypeLabel = { theft:'سرقة', fire:'حريق', damage:'تلف', lost:'ضياع', other:'أخرى' };
  const now = new Date().toISOString();

  try{
    // خصم الكميات المفقودة من مخزون المصدر
    for(const lr of lossRecords){
      const p = (S.products||{})[lr.prodId];
      if(p){
        const newQty = Math.max(0,(+p.qty||0)-lr.lossQty);
        await dbUpdate('products/'+lr.prodId,{qty:newQty,updatedAt:now});
      }
      // سجّل في الحركات كـ خسارة
      await dbPushMovement({
        date:now, product:lr.name,
        type:'out', qty:lr.lossQty,
        branchId:tx.fromBranchId||'', warehouseId:tx.fromId,
        note:`${lossTypeLabel[lr.lossType]||'فقد'} — شحنة #${txId.slice(-6).toUpperCase()} — ${lossNote||''}`,
        lossType:lr.lossType, isLoss:true
      });
    }

    // تسجيل بلاغ الفقد في قسم خاص
    await dbPush('lossRecords',{
      txId, fromName:tx.fromName, toName:tx.toName,
      items:lossRecords, note:lossNote, recordedBy:CURRENT_USER?.name||'',
      recordedAt:now, status:'recorded'
    });

    // قبول باقي الكمية الصحيحة في مخزن الوجهة
    for(const item of (tx.items||[])){
      const lr = lossRecords.find(l=>l.prodId===item.prodId);
      const acceptQty = lr ? Math.max(0, item.qty - lr.lossQty) : item.qty;
      if(acceptQty<=0) continue;
      const p = (S.products||{})[item.prodId];
      const destProd = Object.entries(S.products||{}).find(([,dp])=>
        (dp.warehouseId||dp.whId)===tx.toId && dp.name===item.name
      );
      if(destProd){
        await dbUpdate('products/'+destProd[0],{qty:(+destProd[1].qty||0)+acceptQty,updatedAt:now});
      } else if(p){
        const toWh=(S.warehouses||{})[tx.toId];
        const np={...p,warehouseId:tx.toId,whId:tx.toId,warehouseName:tx.toName,
          branchId:tx.toBranchId||toWh?.branchId||'',
          branchName:tx.toBranchName||getBranchName(toWh?.branchId)||'مركزي',
          qty:acceptQty,createdAt:now};
        delete np._id; await dbSet('products/'+uid(),np);
      }
      await dbPushMovement({date:now,product:item.name,type:'in',qty:acceptQty,
        branchId:tx.toBranchId||'',warehouseId:tx.toId,
        note:`نقل من ${tx.fromName} — بعد خصم الفقد`});
    }

    await dbUpdate('stockTransfers/'+txId,{
      status:'completed', completedAt:now, completedBy:CURRENT_USER?.name||'',
      lossRecords, lossNote, resolution:'loss_recorded', resolvedAt:now
    });

    closeModal('modal-tr-loss');
    const lossNames = lossRecords.map(lr=>`${lossTypeLabel[lr.lossType]}: ${lr.name} (${lr.lossQty})`).join('، ');
    toast(`✅ تم تسجيل الفقد وإغلاق الشحنة — ${lossNames}`,'success');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ─── عرض تفاصيل النقل ───────────────────────────────────
function viewTransfer(txId) {
  const tx = (S.stockTransfers||{})[txId]; if(!tx) return;
  const st = S.settings?.general||{};
  const currency = st.currency||'EGP';
  const stLabelMap = {
    completed:'مكتملة ✅', pending:'قيد التنفيذ ⏳',
    counting:'جاري العد 🔢', discrepancy:'خلاف كمية ⚠️',
    investigating:'تحت التحقيق 🔍', cancelled:'ملغاة ❌'
  };
  const stLabel = stLabelMap[tx.status]||tx.status;

  // جدول المنتجات مع العد إن وجد
  const itemsHtml = (tx.items||[]).map((it,i)=>{
    const ci = (tx.countedItems||[])[i];
    const counted = ci?.countedQty!=null ? ci.countedQty : null;
    const diff = counted!=null ? counted - it.qty : null;
    const diffColor = diff===null?'':diff===0?'#22c55e':diff<0?'#ef233c':'#f59e0b';
    const lossItem = (tx.lossRecords||[]).find(lr=>lr.prodId===it.prodId);
    return `
    <tr style="border-bottom:1px solid #e8e0d5;background:${i%2===0?'#fff':'#fafaf8'};">
      <td style="padding:9px 14px;">${i+1}</td>
      <td style="padding:9px 14px;font-weight:600;">${it.name||'—'}</td>
      <td style="padding:9px 14px;text-align:center;font-weight:700;">${it.qty}</td>
      <td style="padding:9px 14px;text-align:center;font-weight:700;color:${diffColor};">
        ${counted!=null ? counted : '<span style="color:#9ca3af">—</span>'}
      </td>
      <td style="padding:9px 14px;text-align:center;font-weight:700;color:${diffColor};">
        ${diff===null?'—':diff===0?'✅ متطابق':diff<0?`⬇️ ناقص ${Math.abs(diff)}`:`⬆️ زيادة ${diff}`}
      </td>
      <td style="padding:9px 14px;text-align:center;">
        ${lossItem?`<span style="color:#ef233c;font-size:11px;font-weight:700;">${{theft:'🚨 سرقة',fire:'🔥 حريق',damage:'💔 تلف',lost:'📦 ضياع',other:'أخرى'}[lossItem.lossType]||'فقد'}: ${lossItem.lossQty}</span>`:'—'}
      </td>
    </tr>`;
  }).join('');

  // سجل التحقيق
  const invNotes = (tx.investigationNotes||[]).map(n=>`
    <div style="background:#f3f4f6;border-right:3px solid #6366f1;border-radius:6px;padding:7px 12px;margin-bottom:6px;font-size:11px;">
      <div style="color:#6b7280;font-size:10px;">${n.by||'—'} — ${n.at?fDateShort(n.at):''}</div>
      <div>${n.text}</div>
    </div>`).join('');

  const resolutionMap = {
    sender_confirmed:'المرسل أكد صحة الكمية — خطأ في العد',
    loss_recorded:'تم تسجيل فقد وخصم من المخزون'
  };

  const html = `
  <div style="direction:rtl;font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a2e;border:1px solid #ddd;">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:#fff;font-size:17px;font-weight:900;">${st.company||'الشمس'}</div>
        <div style="color:rgba(255,255,255,.6);font-size:11px;">أمر نقل مخزون داخلي</div>
      </div>
      <div style="text-align:left;">
        <div style="color:#7dd3fc;font-size:20px;font-weight:900;">#${txId.slice(-6).toUpperCase()}</div>
        <div style="color:rgba(255,255,255,.6);font-size:10px;">${fDateShort(tx.date||tx.createdAt)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:2px solid #1a1a2e;">
      <div style="padding:14px 20px;border-left:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:700;">المصدر</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;">${tx.fromName||'—'}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:10px;">الحالة</div>
        <div style="font-size:13px;font-weight:700;">${stLabel}</div>
        ${tx.resolution?`<div style="font-size:11px;color:#6b7280;margin-top:5px;">القرار: ${resolutionMap[tx.resolution]||tx.resolution}</div>`:''}
      </div>
      <div style="padding:14px 20px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:700;">الوجهة</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;">${tx.toName||'—'}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:10px;">بواسطة</div>
        <div style="font-size:13px;font-weight:700;">${tx.createdByName||'—'}</div>
        ${tx.receivedBy?`<div style="font-size:11px;color:#6b7280;margin-top:5px;">المستلم: ${tx.receivedBy}</div>`:''}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f3f4f6;border-bottom:2px solid #1a1a2e;">
        <th style="padding:10px 14px;text-align:right;">#</th>
        <th style="padding:10px 14px;text-align:right;">المنتج</th>
        <th style="padding:10px 14px;text-align:center;">المُرسَل</th>
        <th style="padding:10px 14px;text-align:center;">المُعَد (المستلم)</th>
        <th style="padding:10px 14px;text-align:center;">الفرق</th>
        <th style="padding:10px 14px;text-align:center;">الفقد المسجَّل</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot><tr style="background:#f3f4f6;border-top:2px solid #1a1a2e;">
        <td colspan="2" style="padding:10px 14px;font-weight:900;">الإجمالي المُرسَل</td>
        <td style="padding:10px 14px;font-weight:900;text-align:center;">${(tx.items||[]).reduce((s,i)=>s+(+i.qty||0),0)} وحدة</td>
        <td colspan="3"></td>
      </tr></tfoot>
    </table>
    ${tx.note?`<div style="padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#374151;"><strong>ملاحظات المرسل:</strong> ${tx.note}</div>`:''}
    ${tx.receivedNote?`<div style="padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#374151;"><strong>ملاحظات المستلم:</strong> ${tx.receivedNote}</div>`:''}
    ${tx.lossNote?`<div style="padding:12px 20px;border-top:1px solid #fca5a5;background:#fef2f2;font-size:12px;color:#dc2626;"><strong>📋 محضر الفقد:</strong> ${tx.lossNote}</div>`:''}
    ${invNotes?`<div style="padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;">
      <strong style="color:#6366f1;"><i class="fas fa-search"></i> سجل التحقيق:</strong>
      <div style="margin-top:8px;">${invNotes}</div>
    </div>`:''}
    <div style="background:#f9fafb;border-top:2px solid #1a1a2e;padding:10px 20px;text-align:center;font-size:10px;color:#9ca3af;">
      ${st.company||'الشمس'} — وثيقة نقل مخزون داخلية
    </div>
  </div>`;

  document.getElementById('tr-view-body').innerHTML = html;
  openModal('modal-tr-view');
}

