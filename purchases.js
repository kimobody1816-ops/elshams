// ============================================================
// PURCHASE ORDERS
// ============================================================
let editingPO=null; let poItems=[];

// تكلفة الصنف بعد استلام كمية جديدة بسعر مختلف — متوسط مرجّح:
// (الكمية الموجودة × تكلفتها + الكمية الجديدة × تكلفتها) ÷ الكمية الكلية.
// كل فاتورة بيع محفوظ فيها تكلفتها وقت البيع، فالتغيير بيأثر على اللي جاي بس.
// مخزون صفر أو سالب أو تكلفة قديمة مش متسجلة → التكلفة الجديدة زي ما هي.
function weightedCost(oldQty, oldCost, addQty, addCost){
  oldQty=Math.max(0,+oldQty||0); oldCost=+oldCost||0; addQty=+addQty||0; addCost=+addCost||0;
  if(!(addQty>0) || !(addCost>0)) return oldCost;
  if(!(oldQty>0) || !(oldCost>0)) return addCost;
  return Math.round(((oldQty*oldCost + addQty*addCost)/(oldQty+addQty))*10000)/10000;
}

function renderPurchaseOrders(){
  const tbody=document.getElementById('po-tbl'); if(!tbody) return;
  const statusF=document.getElementById('po-filter-status')?.value||'';
  let rows=filterByBranch(S.purchaseOrders||{});
  if(statusF) rows=rows.filter(([,o])=>o.status===statusF);
  rows.sort(([,a],[,b])=>b.createdAt?.localeCompare(a.createdAt));
  const currency=S.settings?.general?.currency||'EGP';
  if(!rows.length){ tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2);">لا توجد أوامر شراء</td></tr>`; return; }
  const statusLabel={pending:'مسودة / قيد الانتظار',received:'مستلم',partial:'جزئي',cancelled:'ملغي'};
  const statusBadge={pending:'badge-warning',received:'badge-success',partial:'badge-info',cancelled:'badge-danger'};
  tbody.innerHTML=rows.map(([id,o],i)=>{
    const supName=(S.suppliers||{})[o.supplierId]?.name||'—';
    const brName=o.branchName||getBranchName(o.branchId)||'النظام المركزي';
    return `<tr>
      <td style="color:var(--text3);">${i+1}</td>
      <td><code style="font-size:11px;">${o.poNumber||id.substr(0,8)}</code></td>
      <td><strong>${supName}</strong></td>
      <td>${brName}</td>
      <td style="font-size:11px;">${fDateShort(o.date||o.createdAt)}</td>
      <td style="font-weight:700;color:var(--accent);">${Number(o.total||0).toFixed(2)} ${currency}</td>
      <td><span class="badge ${statusBadge[o.status]||'badge-info'}">${statusLabel[o.status]||o.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="viewPO('${id}')" title="عرض التفاصيل"><i class="fas fa-eye"></i></button>
          ${o.status==='pending'?`<button class="btn btn-primary btn-xs" onclick="openEditPO('${id}')" title="استكمال / تعديل الأمر"><i class="fas fa-edit"></i> استكمال</button>`:''}
          ${o.status==='pending'?`<button class="btn btn-danger btn-xs" onclick="cancelPO('${id}')"><i class="fas fa-times"></i></button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updatePODestLabel(){
  const val=document.getElementById('po-branch').value;
  const lbl=document.getElementById('po-dest-label');
  if(!lbl) return;
  if(!val||val==='__central__') lbl.textContent='سيُضاف المخزون إلى المستودع الرئيسي (النظام المركزي)';
  else { const br=(S.branches||{})[val]; lbl.textContent='سيُضاف المخزون إلى فرع: '+(br?.name||val); }
}

function openAddPO(){
  editingPO=null; poItems=[];
  document.getElementById('po-modal-title').textContent='أمر شراء جديد';
  document.getElementById('po-notes').value='';
  document.getElementById('po-expected-date').value='';
  // Populate supplier
  const supSel=document.getElementById('po-supplier');
  supSel.innerHTML='<option value="">-- اختر مورد --</option>';
  Object.entries(S.suppliers||{}).filter(([,s])=>s.status==='active').forEach(([id,s])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=s.name; supSel.appendChild(o);
  });
  // Populate branch - Central first then branches
  const brSel=document.getElementById('po-branch');
  brSel.innerHTML='<option value="__central__">🏢 النظام المركزي (المستودع الرئيسي)</option>';
  Object.entries(S.branches||{}).filter(([,b])=>b.status==='active').forEach(([id,b])=>{
    const o=document.createElement('option'); o.value=id; o.textContent='🏪 '+b.name; brSel.appendChild(o);
  });
  brSel.value='__central__';
  updatePODestLabel();
  document.getElementById('po-paid').value='0';
  populatePoCashbox();
  renderPOItems();
  openModal('modal-po');
}

function openEditPO(id){
  const o=(S.purchaseOrders||{})[id]; if(!o) return;
  editingPO=id;
  poItems=JSON.parse(JSON.stringify(o.items||[]));
  document.getElementById('po-modal-title').textContent='تعديل أمر الشراء: '+o.poNumber;
  document.getElementById('po-notes').value=o.notes||'';
  document.getElementById('po-expected-date').value=o.expectedDate||'';
  // Populate supplier
  const supSel=document.getElementById('po-supplier');
  supSel.innerHTML='<option value="">-- اختر مورد --</option>';
  Object.entries(S.suppliers||{}).filter(([,s])=>s.status==='active').forEach(([id,s])=>{
    const opt=document.createElement('option'); opt.value=id; opt.textContent=s.name; supSel.appendChild(opt);
  });
  supSel.value=o.supplierId||'';
  // Populate branch
  const brSel=document.getElementById('po-branch');
  brSel.innerHTML='<option value="__central__">🏢 النظام المركزي (المستودع الرئيسي)</option>';
  Object.entries(S.branches||{}).filter(([,b])=>b.status==='active').forEach(([id,b])=>{
    const opt=document.createElement('option'); opt.value=id; opt.textContent='🏪 '+b.name; brSel.appendChild(opt);
  });
  brSel.value=o.branchId||'__central__';
  updatePODestLabel();
  // عند التعديل نعرض ما سبق دفعه ولا نسمح بتكرار خصمه من الخزينة
  document.getElementById('po-paid').value=(+o.amountPaid||0).toFixed(2);
  document.getElementById('po-paid').readOnly=true;
  document.getElementById('po-paid').title='الدفعات تُدار من صفحة الديون بعد إنشاء الأمر';
  populatePoCashbox();
  renderPOItems();
  openModal('modal-po');
}

function addPOItem(){
  poItems.push({productId:'',productName:'',qty:1,cost:0});
  renderPOItems();
}
function removePOItem(i){ poItems.splice(i,1); renderPOItems(); }
function renderPOItems(){
  const elList=document.getElementById('po-items-list'); if(!elList) return;
  if(!poItems.length){
    elList.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px;background:var(--card2);border-radius:8px;border:1px dashed var(--border);">اضغط "إضافة منتج" لبدء الأمر</div>`;
    calcPOTotals(); return;
  }
  elList.innerHTML=poItems.map((item,i)=>{
    const selProd=item.productId?(S.products||{})[item.productId]:null;
    return `<div style="display:grid;grid-template-columns:1fr 100px 120px auto;gap:8px;align-items:center;background:var(--card2);padding:10px;border-radius:8px;border:1px solid var(--border);">
      <div class="prod-search-wrap" style="position:relative;">
        <input class="prod-search-input" id="po-prod-inp-${i}"
          placeholder="ابحث باسم المنتج..." value="${selProd?selProd.name:item.productName||''}"
          oninput="filterPOProductSearch(${i},this.value)"
          onkeydown="navPOSearch(event,${i})"
          autocomplete="off">
        <i class="fas fa-search prod-search-icon"></i>
        <div class="prod-search-dropdown" id="po-prod-dd-${i}"></div>
      </div>
      <input class="fc" type="number" min="1" value="${item.qty}" placeholder="الكمية"
        oninput="updatePOItem(${i},'qty',+this.value)">
      <input class="fc" type="number" min="0" step="0.01" value="${item.cost}" placeholder="سعر الشراء"
        oninput="updatePOItem(${i},'cost',+this.value)">
      <div style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-xs" onclick="openQuickAddProduct(${i})" title="إضافة منتج جديد للمخزن واختياره هنا" style="color:var(--green);border-color:var(--green);"><i class="fas fa-plus"></i></button>
        <button class="btn btn-danger btn-xs" onclick="removePOItem(${i})"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
  }).join('');
  // Close dropdowns on outside click
  calcPOTotals();
}
function updatePOItem(i,field,val){ poItems[i][field]=val; calcPOTotals(); }

// ── إضافة منتج جديد من داخل أمر الشراء ثم اختياره في نفس السطر ──
let _quickAddPOIndex = null;
function openQuickAddProduct(idx){
  _quickAddPOIndex = idx;
  openAddProduct();
  // نملأ اسم المنتج بما كُتب في خانة البحث إن وُجد
  const typed=document.getElementById('po-prod-inp-'+idx)?.value?.trim();
  if(typed) document.getElementById('pf-name').value=typed;
  document.getElementById('prod-modal-title').textContent='منتج جديد (من أمر الشراء)';
}

// بعد حفظ منتج جديد أثناء أمر شراء: نختاره تلقائياً في السطر المطلوب
function _linkQuickAddedProduct(prodId){
  if(_quickAddPOIndex===null) return;
  const idx=_quickAddPOIndex; _quickAddPOIndex=null;
  const p=(S.products||{})[prodId]; if(!p||!poItems[idx]) return;
  poItems[idx].productId  = prodId;
  poItems[idx].productName= p.name;
  poItems[idx].cost       = +p.cost||0;
  renderPOItems();
  toast(`تم ربط "${p.name}" بسطر أمر الشراء ✅`);
}
function updatePOItemCost(i,prodId){
  const p=(S.products||{})[prodId];
  if(p){ poItems[i].cost=p.cost||0; renderPOItems(); }
}

/* ── Smart Product Search helpers (PO) ── */
function filterPOProductSearch(idx, query){
  const dd=document.getElementById('po-prod-dd-'+idx); if(!dd) return;
  const q=query.trim().toLowerCase();
  if(!q){ dd.classList.remove('open'); dd.innerHTML=''; return; }
  const prods=Object.entries(S.products||{}).filter(([,p])=>p.name?.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
  if(!prods.length){
    dd.innerHTML=`<div class="prod-search-empty"><i class="fas fa-search"></i> لا توجد نتائج</div>`;
    dd.classList.add('open'); return;
  }
  dd.innerHTML=prods.slice(0,12).map(([id,p],ri)=>`
    <div class="prod-search-item" data-idx="${idx}" data-id="${id}" tabindex="-1"
      onmousedown="selectPOProduct(${idx},'${id}')"
      onmouseover="this.classList.add('focused')" onmouseout="this.classList.remove('focused')">
      <div>
        <div class="ps-name">${p.name}</div>
        <div class="ps-meta">${p.code||''}${p.code&&p.category?' · ':''}</div>
      </div>
      <span class="ps-qty${(p.qty||0)<5?' low':''}">${p.qty||0}</span>
    </div>`).join('');
  dd.classList.add('open');
}
function selectPOProduct(idx, prodId){
  const p=(S.products||{})[prodId]; if(!p) return;
  poItems[idx].productId=prodId;
  poItems[idx].productName=p.name;
  poItems[idx].cost=p.cost||0;
  const inp=document.getElementById('po-prod-inp-'+idx);
  const dd=document.getElementById('po-prod-dd-'+idx);
  if(inp) inp.value=p.name;
  if(dd){ dd.classList.remove('open'); dd.innerHTML=''; }
  calcPOTotals();
  // Move focus to qty input
  const row=inp?.closest('div[style*="grid"]');
  if(row){ const qtyInp=row.querySelectorAll('input')[1]; if(qtyInp) qtyInp.focus(); }
}
function navPOSearch(e, idx){
  const dd=document.getElementById('po-prod-dd-'+idx); if(!dd) return;
  const items=[...dd.querySelectorAll('.prod-search-item')];
  const cur=dd.querySelector('.prod-search-item.focused');
  if(e.key==='ArrowDown'){ e.preventDefault();
    const next=cur?items[items.indexOf(cur)+1]:items[0]; if(next){items.forEach(x=>x.classList.remove('focused'));next.classList.add('focused');}
  } else if(e.key==='ArrowUp'){ e.preventDefault();
    const prev=cur?items[items.indexOf(cur)-1]:items[items.length-1]; if(prev){items.forEach(x=>x.classList.remove('focused'));prev.classList.add('focused');}
  } else if(e.key==='Enter'||e.key==='Tab'){
    if(cur){ e.preventDefault(); const id=cur.getAttribute('data-id'); selectPOProduct(idx,id); }
  } else if(e.key==='Escape'){ dd.classList.remove('open'); dd.innerHTML=''; }
}
// Close all PO search dropdowns on outside click
document.addEventListener('click', function(e){
  if(!e.target.closest('.prod-search-wrap')){
    document.querySelectorAll('.prod-search-dropdown').forEach(d=>{ d.classList.remove('open'); d.innerHTML=''; });
  }
});
function calcPOTotals(){
  const vat=parseFloat(S.settings?.general?.vat||0)/100;
  const subtotal=poItems.reduce((s,it)=>s+(it.qty||0)*(it.cost||0),0);
  const tax=subtotal*vat;
  const total=subtotal+tax;
  document.getElementById('po-item-count').textContent=poItems.length;
  document.getElementById('po-subtotal').textContent=subtotal.toFixed(2);
  document.getElementById('po-tax').textContent=tax.toFixed(2);
  document.getElementById('po-total').textContent=total.toFixed(2);

  // المتبقي = الإجمالي − المدفوع، وهو ما يصير ديناً على المحل للمورد
  const paidEl=document.getElementById('po-paid');
  let paid=parseFloat(paidEl?.value||0)||0;
  if(paid<0){ paid=0; if(paidEl) paidEl.value='0'; }
  if(paid>total){ paid=total; if(paidEl) paidEl.value=total.toFixed(2); }
  const balance=Math.max(0,total-paid);
  const balEl=document.getElementById('po-balance');
  if(balEl){
    balEl.textContent=balance.toFixed(2);
    const full=balance<=0;
    balEl.style.background=full?'var(--green-bg)':'var(--red-bg)';
    balEl.style.color     =full?'var(--green)'   :'var(--red)';
  }
  return {subtotal,tax,total,paid,balance};
}

// خزائن الفرع لأمر الشراء
function populatePoCashbox(){
  const el=document.getElementById('po-cashbox'); if(!el) return;
  const cur=el.value;
  const currency=S.settings?.general?.currency||'EGP';
  const myBranch=CURRENT_USER?.branch||'';
  const list=Object.entries(S.cashboxes||{}).filter(([,cb])=>
    cb.status!=='disabled' && (!myBranch||CURRENT_USER?.role==='admin'||cb.branchId===myBranch||!cb.branchId));
  el.innerHTML='<option value="">-- اختر الخزينة --</option>'+
    list.map(([id,cb])=>`<option value="${id}">${cb.name} (${(+cb.balance||0).toFixed(2)} ${currency})</option>`).join('');
  el.value=cur;
  if(!el.value && list.length===1) el.value=list[0][0];
}

async function savePO(status){
  const supplierId=document.getElementById('po-supplier').value;
  const branchRaw=document.getElementById('po-branch').value;
  const branchId=(!branchRaw||branchRaw==='__central__')?null:branchRaw;
  if(!supplierId){ toast('اختر المورد','error'); return; }
  const validItems=poItems.filter(it=>it.productId&&it.qty>0);
  if(!validItems.length){ toast('أضف منتجاً واحداً على الأقل','error'); return; }

  const vat=parseFloat(S.settings?.general?.vat||0)/100;
  const subtotal=validItems.reduce((s,it)=>s+it.qty*it.cost,0);
  const total=subtotal*(1+vat);

  // الدفع للمورد: ما دُفع الآن، والباقي يصير ديناً على المحل
  const paidNow = editingPO ? (+(S.purchaseOrders||{})[editingPO]?.amountPaid||0)
                            : Math.min(Math.max(0,parseFloat(document.getElementById('po-paid')?.value||0)||0), total);
  const poCbId  = document.getElementById('po-cashbox')?.value||'';
  const balance = Math.max(0, total - paidNow);

  if(!editingPO && paidNow>0 && !poCbId){
    toast('اختر الخزينة التي سيُدفع منها المبلغ للمورد','error');
    document.getElementById('po-cashbox')?.focus();
    return;
  }

  const poData={
    supplierId,
    supplierName: (S.suppliers||{})[supplierId]?.name||'',
    branchId: branchId||null,
    branchName: branchId?getBranchName(branchId):'النظام المركزي',
    items:validItems,subtotal,total,
    // بدون هذه الحقول كان دين المورد يظل صفراً مهما اشترى المحل
    amountPaid: paidNow,
    balance,
    payStatus: balance<=0 ? 'completed' : (paidNow>0 ? 'partial' : 'unpaid'),
    cashboxId: poCbId||'',
    date: new Date().toISOString().slice(0,10),
    notes:document.getElementById('po-notes').value?.trim()||'',
    status,expectedDate:document.getElementById('po-expected-date').value||'',
    createdBy:CURRENT_USER?.id,
    createdByName:CURRENT_USER?.name||'',
    updatedAt:new Date().toISOString(),
    ...shiftStamp(),
  };

  try{
    let poId;
    if(editingPO){
      // Update existing draft
      poId=editingPO;
      poData.poNumber=(S.purchaseOrders||{})[editingPO]?.poNumber||('PO-'+Date.now().toString().substr(-6));
      poData.createdAt=(S.purchaseOrders||{})[editingPO]?.createdAt||new Date().toISOString();
      await dbSet('purchaseOrders/'+editingPO, poData);
    } else {
      poData.poNumber='PO-'+Date.now().toString().substr(-6);
      poData.createdAt=new Date().toISOString();
      poId=uid();
      await dbSet('purchaseOrders/'+poId, poData);

      // الدفعة المسدَّدة عند الإنشاء: تُخصم من الخزينة وتُسجَّل دفعةً ومصروفاً
      if(paidNow>0 && poCbId){
        const supName=poData.supplierName||'المورد';
        const payId=await recordPayment({
          kind:'sup_settle', partyType:'supplier', partyId:supplierId, partyName:supName,
          amount:paidNow, cashboxId:poCbId, method:'cash',
          notes:`دفعة مع أمر الشراء ${poData.poNumber}`,
          allocations:[{ poId, poNumber:poData.poNumber, amount:paidNow }],
          refId:poId,
        });
        await dbSet('expenses/'+uid(),{
          desc:`مشتريات — ${supName} (${poData.poNumber})`,
          amount:paidNow, category:'suppliers',
          branchId:branchId||'', cashboxId:poCbId,
          paymentId:payId, supplierId, autoGenerated:true,
          createdBy:CURRENT_USER?.id, createdByName:CURRENT_USER?.name||'',
          createdAt:new Date().toISOString(),
          ...shiftStamp(),
        });
      }
    }
    // If received, update stock
    if(status==='received'){
      for(const item of validItems){
        const prod=(S.products||{})[item.productId];
        let costInfo={};
        if(prod){
          const newCost=weightedCost(prod.qty, prod.cost, item.qty, item.cost);
          costInfo={costBefore:+prod.cost||0, costAfter:newCost, unitCost:+item.cost||0};
          await dbUpdate('products/'+item.productId,{
            qty:(prod.qty||0)+item.qty,
            ...(newCost!==(+prod.cost||0)?{cost:newCost, costUpdatedAt:new Date().toISOString()}:{}),
          });
        }
        // Log movement
        await dbPushMovement({date:new Date().toISOString(),product:item.productName||item.productId,type:'in',qty:item.qty,branchId:branchId||null,note:'استلام أمر شراء '+poData.poNumber,productId:item.productId,...costInfo});
      }
    }
    closeModal('modal-po');
    editingPO=null;
    toast(status==='received'?'✅ تم استلام الأمر وتحديث المخزون':status==='pending'?'💾 تم حفظ المسودة':'✅ تم حفظ أمر الشراء');
    renderPurchaseOrders(); renderPurStats();
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function cancelPO(id){
  const ok=await confirm2('إلغاء أمر الشراء هذا؟','إلغاء الأمر','❌','إلغاء الأمر','btn-danger');
  if(!ok) return;
  try{ await dbUpdate('purchaseOrders/'+id,{status:'cancelled'}); toast('تم إلغاء الأمر'); renderPurchaseOrders(); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

function viewPO(id){
  const o=(S.purchaseOrders||{})[id]; if(!o) return;
  const currency=S.settings?.general?.currency||'EGP';
  const supName=(S.suppliers||{})[o.supplierId]?.name||'—';
  const brName=o.branchName||getBranchName(o.branchId)||'النظام المركزي';
  const statusLabel={pending:'مسودة / قيد الانتظار',received:'مستلم',partial:'جزئي',cancelled:'ملغي'};
  const itemsHtml=(o.items||[]).map(it=>`
    <tr>
      <td>${(S.products||{})[it.productId]?.name||it.productName||it.productId}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:left;">${Number(it.cost||0).toFixed(2)}</td>
      <td style="text-align:left;font-weight:700;">${((it.qty||0)*(it.cost||0)).toFixed(2)}</td>
    </tr>`).join('');
  const html=`<div style="font-size:13px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <div><span style="color:var(--text2);">رقم الأمر:</span> <strong>${o.poNumber||'—'}</strong></div>
      <div><span style="color:var(--text2);">الحالة:</span> <strong>${statusLabel[o.status]||o.status}</strong></div>
      <div><span style="color:var(--text2);">المورد:</span> <strong>${supName}</strong></div>
      <div><span style="color:var(--text2);">الوجهة:</span> <strong>${brName}</strong></div>
      <div><span style="color:var(--text2);">التاريخ:</span> ${fDateShort(o.createdAt)}</div>
      ${o.notes?`<div><span style="color:var(--text2);">ملاحظات:</span> ${o.notes}</div>`:''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:var(--card2);"><th style="padding:7px;text-align:right;">المنتج</th><th style="padding:7px;text-align:center;">الكمية</th><th style="padding:7px;text-align:left;">سعر الشراء</th><th style="padding:7px;text-align:left;">الإجمالي</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="margin-top:12px;text-align:left;font-weight:700;font-size:14px;color:var(--accent);">
      الإجمالي: ${Number(o.total||0).toFixed(2)} ${currency}
    </div>
  </div>`;
  // Show in a simple alert-style modal via toast or custom approach
  const overlay=document.createElement('div');
  overlay.className='overlay'; overlay.style.cssText='display:flex;z-index:10000;';
  overlay.innerHTML=`<div class="modal" style="max-width:560px;"><div class="modal-head"><h3><i class="fas fa-file-alt" style="color:var(--accent);"></i> أمر الشراء: ${o.poNumber||'—'}</h3><button class="close-btn" onclick="this.closest('.overlay').remove()"><i class="fas fa-times"></i></button></div><div class="modal-body">${html}</div><div class="modal-foot">${o.status==='pending'?`<button class="btn btn-primary" onclick="this.closest('.overlay').remove();openEditPO('${id}')"><i class="fas fa-edit"></i> استكمال الأمر</button>`:''}<button class="btn btn-ghost" onclick="this.closest('.overlay').remove()">إغلاق</button></div></div>`;
  document.body.appendChild(overlay);
}

