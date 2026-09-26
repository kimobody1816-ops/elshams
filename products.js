// ============================================================
// PRODUCTS
// ============================================================
let editingProduct=null;

function renderProducts(){
  const tbody=document.getElementById('prod-tbl'); if(!tbody) return;
  const q   =(document.getElementById('prod-search')?.value||'').toLowerCase();
  const catF=document.getElementById('prod-filter-cat')?.value||'';
  const brF =document.getElementById('prod-filter-branch')?.value||'';
  const whF =document.getElementById('prod-filter-wh')?.value||'';
  const currency=S.settings?.general?.currency||'EGP';

  let rows=Object.entries(S.products||{});
  // غير الأدمن يرى منتجات فرعه أو مخازن فرعه فقط
  if(!isAdmin()&&myBranchId()){
    const br=myBranchId(), myWhs=myWarehouseIds();
    rows=rows.filter(([,p])=>(p.branchId||p.branch||'')===br||myWhs.includes(p.warehouseId||p.whId||''));
  }
  if(q)   rows=rows.filter(([,p])=>(p.name||'').toLowerCase().includes(q)||(p.barcode||p.code||'').includes(q));
  if(catF) rows=rows.filter(([,p])=>(p.cat||p.category||'')===catF);
  if(brF)  rows=rows.filter(([,p])=>(p.branchId||p.branch||'')===brF);
  if(whF)  rows=rows.filter(([,p])=>(p.warehouseId||p.whId||'')===whF);

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="14"><div class="empty-state" style="padding:30px;"><div class="empty-state-icon">📦</div><p>لا توجد منتجات</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML=rows.map(([id,p],i)=>{
    const stock=+p.qty||0; const min=+p.minQty||+p.min||5;
    const catId=p.cat||p.category||''; const brId=p.branchId||p.branch||'';
    const whId=p.warehouseId||p.whId||'';
    const catName=(S.categories||{})[catId]?.name||'—';
    const brName=getBranchName(brId)||'مركزي';
    const whName=getWhName(whId);
    let stockBadge,stockClass;
    if(stock===0){stockBadge='badge-danger';stockClass='نفاد';}
    else if(stock<=min){stockBadge='badge-warning';stockClass='منخفض';}
    else{stockBadge='badge-success';stockClass='متوفر';}
    return `<tr>
      <td style="color:var(--text3);font-size:11px;">${i+1}</td>
      <td><div class="prod-img-placeholder">${p.emoji||'📦'}</div></td>
      <td><strong>${p.name}</strong>${p.desc?`<div style="font-size:10px;color:var(--text3);">${p.desc.substr(0,30)}...</div>`:''}</td>
      <td><code style="font-size:11px;">${p.barcode||p.code||'—'}</code></td>
      <td><span class="badge badge-info">${catName}</span></td>
      <td style="font-size:12px;">${Number(p.cost||0).toFixed(2)} ${currency}</td>
      <td style="font-size:12px;font-weight:700;color:var(--accent);">${Number(p.price||0).toFixed(2)} ${currency}</td>
      <td style="font-size:12px;font-weight:700;">${(+p.priceWholesale||0)>0
        ? `<span style="color:var(--purple);">${Number(p.priceWholesale).toFixed(2)} ${currency}</span>`
        : `<span style="color:var(--text3);" title="غير محدد — يُباع بسعر القطاعي">—</span>`}</td>
      <td><span class="badge ${stockBadge}">${stock}</span><span style="font-size:10px;color:var(--text3);margin-right:4px;">${stockClass}</span></td>
      <td style="font-size:12px;color:var(--text2);">${min}</td>
      <td style="font-size:11px;">${brName}</td>
      <td style="font-size:11px;color:var(--accent);">${whName}</td>
      <td><span class="badge ${p.status==='active'?'badge-success':'badge-danger'}">${p.status==='active'?'نشط':'متوقف'}</span></td>
      <td><div style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-xs" onclick="editProduct('${id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="delProduct('${id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  // Refresh filters
  const catSel=document.getElementById('prod-filter-cat');
  if(catSel){ const prev=catSel.value; catSel.innerHTML='<option value="">كل الفئات</option>';
    Object.entries(S.categories||{}).forEach(([id,c])=>{ const o=document.createElement('option'); o.value=id; o.textContent=c.name; if(id===prev) o.selected=true; catSel.appendChild(o); }); }
  const brSel=document.getElementById('prod-filter-branch');
  if(brSel){ const prev=brSel.value; brSel.innerHTML='<option value="">كل الفروع</option>';
    Object.entries(S.branches||{}).forEach(([id,b])=>{ const o=document.createElement('option'); o.value=id; o.textContent=b.name; if(id===prev) o.selected=true; brSel.appendChild(o); }); }
  const whSel=document.getElementById('prod-filter-wh');
  if(whSel){ const prev=whSel.value; whSel.innerHTML='<option value="">كل المخازن</option>';
    Object.entries(S.warehouses||{}).forEach(([id,wh])=>{ const o=document.createElement('option'); o.value=id; o.textContent=wh.name+(wh.branchId?' ('+getBranchName(wh.branchId)+')':''); if(id===prev) o.selected=true; whSel.appendChild(o); }); }
}

// حساب هامش الربح للسعرين — تُستدعى عند فتح النموذج ومع كل تعديل في الأسعار
function calcMargin(){
  const cost  = parseFloat(document.getElementById('pf-cost')?.value||0)||0;
  const price = parseFloat(document.getElementById('pf-price')?.value||0)||0;
  const whRaw = document.getElementById('pf-price-wholesale')?.value||'';
  const wh    = parseFloat(whRaw||0)||0;

  const fmtMargin=(sell)=>{
    if(!sell) return {txt:'—', good:true};
    const profit = sell-cost;
    const pct    = cost>0 ? (profit/cost*100) : 100;
    return {txt:`${profit.toFixed(2)} (${pct.toFixed(0)}%)`, good:profit>=0};
  };

  const m1=fmtMargin(price);
  const el1=document.getElementById('pf-margin');
  if(el1){
    el1.textContent=m1.txt;
    el1.style.background=m1.good?'var(--green-bg)':'var(--red-bg)';
    el1.style.color     =m1.good?'var(--green)'   :'var(--red)';
  }

  const m2=fmtMargin(wh);
  const el2=document.getElementById('pf-margin-wholesale');
  if(el2){
    el2.textContent=whRaw.trim()===''?'—':m2.txt;
    el2.style.background=m2.good?'var(--accent-bg)':'var(--red-bg)';
    el2.style.color     =m2.good?'var(--accent)'   :'var(--red)';
  }

  const gap=document.getElementById('pf-price-gap');
  if(gap){
    if(whRaw.trim()==='' || !price){ gap.textContent='—'; gap.style.color='var(--text2)'; }
    else{
      const diff=price-wh;
      gap.textContent=`${diff.toFixed(2)} (${price>0?(diff/price*100).toFixed(0):0}%)`;
      // سعر جملة أعلى من القطاعي غالباً خطأ إدخال
      gap.style.color = diff<0 ? 'var(--red)' : 'var(--text2)';
      gap.title = diff<0 ? 'سعر الجملة أعلى من القطاعي — تأكد من الأرقام' : '';
    }
  }
}

const PRICE_FIELDS=['pf-cost','pf-price','pf-price-wholesale'];

function openAddProduct(){
  editingProduct=null;
  document.getElementById('prod-modal-title').textContent='منتج جديد';
  ['pf-name','pf-barcode','pf-serial','pf-desc'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  PRICE_FIELDS.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('pf-qty').value='0';
  document.getElementById('pf-min-qty').value='5';
  document.getElementById('pf-status').value='active';
  populateProdCategory(); populateProdBranch(); populateProdWarehouse();
  calcMargin();
  openModal('modal-product');
}

function editProduct(id){
  const p=(S.products||{})[id]; if(!p) return;
  editingProduct=id;
  document.getElementById('prod-modal-title').textContent='تعديل منتج';
  document.getElementById('pf-name').value   =p.name||'';
  document.getElementById('pf-barcode').value=p.barcode||p.code||'';
  const serEl=document.getElementById('pf-serial'); if(serEl) serEl.value=p.serial||'';
  document.getElementById('pf-desc').value   =p.desc||'';
  document.getElementById('pf-cost').value   =p.cost||'';
  document.getElementById('pf-price').value  =p.price||'';
  document.getElementById('pf-price-wholesale').value = p.priceWholesale!==undefined&&p.priceWholesale!==''&&p.priceWholesale!==null ? p.priceWholesale : '';
  document.getElementById('pf-qty').value    =p.qty||0;
  document.getElementById('pf-min-qty').value=p.minQty||p.min||5;
  document.getElementById('pf-status').value =p.status||'active';
  document.getElementById('pf-unit').value   =p.unit||'piece';
  const brId=p.branchId||p.branch||'';
  const whId=p.warehouseId||p.whId||'';
  const catId=p.cat||p.category||'';
  populateProdCategory(catId);
  populateProdBranch(brId);
  populateProdWarehouse(brId,whId);
  calcMargin();
  openModal('modal-product');
}

async function saveProduct(){
  const name=(document.getElementById('pf-name').value||'').trim();
  const cost=parseFloat(document.getElementById('pf-cost').value||0);
  const price=parseFloat(document.getElementById('pf-price').value||0);
  const whRaw=(document.getElementById('pf-price-wholesale')?.value||'').trim();
  // سعر الجملة اختياري: فارغ = 0 = يُباع بسعر القطاعي في وضع الجملة
  const priceWholesale = whRaw==='' ? 0 : (parseFloat(whRaw)||0);
  if(!name){ toast('أدخل اسم المنتج','error'); return; }
  if(!price){ toast('أدخل سعر البيع قطاعي','error'); return; }
  if(priceWholesale>price){
    const ok=await confirm2(
      `سعر الجملة (${priceWholesale}) أعلى من سعر القطاعي (${price}). عادةً يكون أقل — تأكد من الأرقام.`,
      'سعر جملة غير معتاد','⚠️','حفظ رغم ذلك','btn-warning');
    if(!ok) return;
  }
  const brId=document.getElementById('pf-branch')?.value||'';
  const catId=document.getElementById('pf-category')?.value||'';
  const whId=document.getElementById('pf-warehouse')?.value||'';
  // الحقل يَعِد بالتوليد التلقائي لو تُرك فارغاً — ننفّذ الوعد هنا
  let barcodeVal=document.getElementById('pf-barcode').value?.trim()||'';
  if(!barcodeVal){
    barcodeVal=makeInternalBarcode();
    document.getElementById('pf-barcode').value=barcodeVal;
  }
  const data={
    name, cost, price, priceWholesale,
    barcode:barcodeVal,
    code:barcodeVal,
    serial:document.getElementById('pf-serial')?.value?.trim()||'',
    cat:catId, category:catId,
    branchId:brId, branch:brId, branchName:getBranchName(brId)||'مركزي',
    warehouseId:whId, whId:whId, warehouseName:getWhName(whId)||'',
    unit:document.getElementById('pf-unit').value||'piece',
    qty:parseInt(document.getElementById('pf-qty').value||0),
    min:parseInt(document.getElementById('pf-min-qty').value||5),
    minQty:parseInt(document.getElementById('pf-min-qty').value||5),
    status:document.getElementById('pf-status').value,
    desc:document.getElementById('pf-desc').value?.trim()||'',
    emoji:'📦', updatedAt:new Date().toISOString(),
  };
  try{
    let newId=null;
    if(editingProduct) await dbUpdate('products/'+editingProduct,data);
    else{ data.createdAt=new Date().toISOString(); newId=uid(); S.products[newId]=data; await dbSet('products/'+newId,data); }
    closeModal('modal-product'); toast(editingProduct?'تم تحديث المنتج ✅':'تم إضافة المنتج ✅');
    if(newId) _linkQuickAddedProduct(newId);
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function delProduct(id){
  const p=(S.products||{})[id];
  const ok=await confirm2(`حذف منتج "${p?.name}"؟`,'حذف منتج','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('products/'+id); toast('تم حذف المنتج'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

function populateProdCategory(sel=''){
  const el=document.getElementById('pf-category'); if(!el) return;
  el.innerHTML='<option value="">بدون فئة</option>';
  Object.entries(S.categories||{}).forEach(([id,c])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=c.name;
    if(id===sel) o.selected=true; el.appendChild(o);
  });
}

function populateProdBranch(sel=''){
  const el=document.getElementById('pf-branch'); if(!el) return;
  el.innerHTML='<option value="">مركزي (كل الفروع)</option>';
  Object.entries(S.branches||{}).forEach(([id,b])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=b.name;
    if(id===sel) o.selected=true; el.appendChild(o);
  });
}

function populateProdWarehouse(brId='', selWh=''){
  const el=document.getElementById('pf-warehouse'); if(!el) return;
  const branch=brId||document.getElementById('pf-branch')?.value||'';
  const whs=Object.entries(S.warehouses||{}).filter(([,wh])=>
    wh.status==='active'&&(branch?wh.branchId===branch:isAdmin()&&!wh.branchId));
  el.innerHTML='<option value="">-- اختر المخزن --</option>'+
    whs.map(([id,wh])=>`<option value="${id}" ${id===selWh?'selected':''}>${wh.name} (${getBranchName(wh.branchId)||'مركزي'})</option>`).join('');
  if(!selWh&&whs.length===1) el.value=whs[0][0];
}

// ============================================================
// CATEGORIES
// ============================================================
let editingCategory=null;
function renderCategories(){
  const tbody=document.getElementById('cat-tbl'); if(!tbody) return;
  const cats=Object.entries(S.categories||{});
  if(!cats.length){ tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text2);">لا توجد فئات</td></tr>`; return; }
  tbody.innerHTML=cats.map(([id,c],i)=>{
    const count=Object.values(S.products||{}).filter(p=>p.category===id).length;
    return `<tr>
      <td style="color:var(--text3);">${i+1}</td>
      <td><span style="margin-left:6px;">${c.icon||'📦'}</span><strong>${c.name}</strong></td>
      <td style="color:var(--text2);">${c.desc||'—'}</td>
      <td><span class="badge badge-info">${count} منتج</span></td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="editCategory('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delCategory('${id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddCategory(){
  editingCategory=null;
  document.getElementById('cat-modal-title').textContent='فئة جديدة';
  document.getElementById('cf-name').value='';
  document.getElementById('cf-desc').value='';
  openModal('modal-category');
}
function editCategory(id){
  const c=(S.categories||{})[id]; if(!c) return;
  editingCategory=id;
  document.getElementById('cat-modal-title').textContent='تعديل فئة';
  document.getElementById('cf-name').value=c.name||'';
  document.getElementById('cf-desc').value=c.desc||'';
  openModal('modal-category');
}
async function saveCategory(){
  const name=(document.getElementById('cf-name').value||'').trim();
  if(!name){ toast('أدخل اسم الفئة','error'); return; }
  const data={name,desc:document.getElementById('cf-desc').value?.trim()||'',updatedAt:new Date().toISOString()};
  try{
    if(editingCategory){ await dbUpdate('categories/'+editingCategory,data); }
    // الأيقونة تأتي من استيراد Excel — نضع افتراضية عند الإنشاء اليدوي فقط
    else{ data.icon='📦'; data.createdAt=new Date().toISOString(); await dbSet('categories/'+uid(),data); }
    closeModal('modal-category');
    toast(editingCategory?'تم تحديث الفئة ✅':'تم إضافة الفئة ✅');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}
async function delCategory(id){
  const c=(S.categories||{})[id];
  const count=Object.values(S.products||{}).filter(p=>p.category===id).length;
  if(count>0){ toast(`لا يمكن حذف الفئة. يوجد ${count} منتج مرتبط بها.`,'error'); return; }
  const ok=await confirm2(`حذف فئة "${c?.name}"؟`,'حذف فئة','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('categories/'+id); toast('تم حذف الفئة'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// MOVEMENTS
// ============================================================
function populateMvProduct(){
  const el=document.getElementById('mv-product'); if(!el) return;
  el.innerHTML='<option value="">-- اختر منتج --</option>';
  Object.entries(S.products||{}).forEach(([id,p])=>{
    const o=document.createElement('option'); o.value=id;
    o.textContent=`${p.name} (مخزون: ${p.qty||0})`;
    el.appendChild(o);
  });
}
async function saveMovement(){
  const prodId=document.getElementById('mv-product').value;
  const type=document.getElementById('mv-type').value;
  const qty=parseInt(document.getElementById('mv-qty').value||0);
  const note=(document.getElementById('mv-note').value||'').trim();
  if(!prodId){ toast('اختر منتجاً','error'); return; }
  if(!qty||qty<=0){ toast('أدخل كمية صحيحة','error'); return; }

  const prod=(S.products||{})[prodId];
  if(!prod){ toast('المنتج غير موجود','error'); return; }

  let newQty=prod.qty||0;
  if(type==='in') newQty+=qty;
  else if(type==='out') newQty=Math.max(0,newQty-qty);
  else if(type==='adjust') newQty=qty;
  else if(type==='transfer') newQty=Math.max(0,newQty-qty);

  const mvData={
    productId:prodId,productName:prod.name,type,qty,
    qtyBefore:prod.qty||0,qtyAfter:newQty,
    note,userId:CURRENT_USER?.id,userName:CURRENT_USER?.name||'',
    createdAt:new Date().toISOString(),
  };

  try{
    await dbUpdate('products/'+prodId,{qty:newQty});
    await dbSet('movements/'+uid(),mvData);
    document.getElementById('mv-product').value='';
    document.getElementById('mv-qty').value='';
    document.getElementById('mv-note').value='';
    toast(`تم تسجيل الحركة: ${type==='in'?'إضافة':type==='out'?'سحب':type==='adjust'?'تعديل':'تحويل'} ${qty} وحدة ✅`);
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}
function renderMovements(){
  const tbody=document.getElementById('mv-tbl'); if(!tbody) return;
  const mvs=filterByBranch(S.movements||{}).sort(([,a],[,b])=>(b.createdAt||'').localeCompare(a.createdAt));
  if(!mvs.length){ tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2);">لا توجد حركات مسجلة</td></tr>`; return; }
  const typeLabel={in:'📥 إضافة',out:'📤 سحب',transfer:'🔄 تحويل',adjust:'⚙️ تعديل'};
  const typeBadge={in:'badge-success',out:'badge-danger',transfer:'badge-info',adjust:'badge-warning'};
  tbody.innerHTML=mvs.slice(0,50).map(([id,m],i)=>`<tr>
    <td style="color:var(--text3);">${i+1}</td>
    <td style="font-size:11px;">${fDate(m.createdAt)}</td>
    <td><strong>${m.productName||'—'}</strong></td>
    <td><span class="badge ${typeBadge[m.type]||'badge-info'}">${typeLabel[m.type]||m.type}</span></td>
    <td style="font-weight:700;">${m.qty}</td>
    <td>${m.qtyAfter??'—'}</td>
    <td style="font-size:11px;color:var(--text2);">${m.userName||'—'}</td>
    <td style="font-size:11px;color:var(--text2);">${m.note||'—'}</td>
  </tr>`).join('');
}

