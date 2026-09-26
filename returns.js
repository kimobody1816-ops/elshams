// ============================================================
// RETURNS — المرتجعات
// ============================================================
const RETURN_REASONS = {
  defective:'منتج معيب / تالف',
  wrong_item:'منتج خاطئ',
  customer_change:'تغيير رأي العميل',
  expired:'منتهي الصلاحية',
  quality:'مشكلة في الجودة',
  other:'أخرى'
};
const REFUND_METHODS = {
  cash:'استرداد نقدي',
  credit:'رصيد لدى المتجر',
  exchange:'استبدال بمنتج آخر',
  none:'بدون استرداد'
};

let retItems = [{prodId:'',name:'',qty:1,price:0}];

function renderReturns() {
  const tbody = document.getElementById('ret-tbl'); if(!tbody) return;
  const search = (document.getElementById('ret-search')?.value||'').toLowerCase();
  const from   = document.getElementById('ret-from')?.value||'';
  const to     = document.getElementById('ret-to')?.value||'';
  const typeF  = document.getElementById('ret-type-filter')?.value||'';
  const branchF= document.getElementById('ret-branch-filter')?.value||'';
  const currency = S.settings?.general?.currency||'EGP';

  const rows = filterByBranch(S.returns||{}).filter(([,r])=>{
    const d = (r.date||'').slice(0,10);
    const party = (r.partyName||'').toLowerCase();
    return (!search || party.includes(search) || (r.reason||'').toLowerCase().includes(search))
      && (!from || d>=from) && (!to || d<=to)
      && (!typeF  || r.type===typeF)
      && (!branchF || r.branchId===branchF);
  }).sort(([,a],[,b])=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date));

  // stats
  const all = filterByBranch(S.returns||{}).map(([,v])=>v);
  const totalVal   = all.reduce((s,r)=>s+(+r.total||0),0);
  const saleCount  = all.filter(r=>r.type==='sale').length;
  const purCount   = all.filter(r=>r.type==='purchase').length;
  const el = id => document.getElementById(id);
  if(el('ret-total-count')) el('ret-total-count').textContent = all.length;
  if(el('ret-sale-count'))  el('ret-sale-count').textContent  = saleCount;
  if(el('ret-purchase-count')) el('ret-purchase-count').textContent = purCount;
  if(el('ret-total-val'))   el('ret-total-val').textContent   = totalVal.toFixed(2);

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text2);"><i class="fas fa-undo-alt" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px;"></i>لا توجد مرتجعات</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(([id,r])=>{
    const typeBadge = r.type==='sale'
      ?'<span class="badge badge-warning"><i class="fas fa-shopping-cart"></i> مبيعات</span>'
      :'<span class="badge badge-purple"><i class="fas fa-cart-plus"></i> مشتريات</span>';
    const refundBadge = {
      cash:'<span class="badge badge-success">نقدي</span>',
      credit:'<span class="badge badge-info">رصيد</span>',
      exchange:'<span class="badge badge-purple">استبدال</span>',
      none:`<span class="badge" style="background:var(--border);color:var(--text2);">بدون</span>`
    }[r.refundMethod]||'';
    const itemsSummary = (r.items||[]).map(i=>`${i.name} (${i.qty})`).join(' ، ');
    const branchName   = getBranchName(r.branchId)||'مركزي';
    const origInvLink  = r.invoiceId
      ?`<span style="color:var(--accent);font-size:11px;font-weight:700;">#${r.invoiceId.slice(-5).toUpperCase()}</span>`
      :'<span style="color:var(--text3);font-size:11px;">—</span>';
    return `<tr>
      <td style="color:var(--red);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
      <td style="font-size:11px;">${fDateShort(r.date)}</td>
      <td>${typeBadge}</td>
      <td style="font-size:11px;">${branchName}</td>
      <td><strong>${r.partyName||'—'}</strong></td>
      <td>${origInvLink}</td>
      <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemsSummary}">${itemsSummary||'—'}</td>
      <td style="color:var(--red);font-weight:700;">${(+r.total||0).toFixed(2)} ${currency}</td>
      <td>${refundBadge}</td>
      <td><span class="badge badge-info" style="font-size:10px;">${RETURN_REASONS[r.reason]||r.reason||'—'}</span></td>
      <td style="font-size:11px;color:var(--text2);">${r.createdByName||'—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-xs" onclick="viewReturn('${id}')" title="عرض"><i class="fas fa-eye"></i></button>
        <button class="btn btn-danger btn-xs" onclick="delReturn('${id}')" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function openAddReturn() {
  retItems = [];
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('retf-date').value        = today;
  document.getElementById('retf-notes').value       = '';
  document.getElementById('retf-reason').value      = 'defective';
  document.getElementById('retf-refund-method').value = 'cash';
  // reset party display
  document.getElementById('retf-party-name').textContent = 'سيُملأ تلقائياً من الفاتورة';
  document.getElementById('retf-party-id').value = '';
  // populate branch
  populateBranchSelect('retf-branch', CURRENT_USER?.branch||'');
  // populate cashboxes
  populateRetCashbox();
  // reset invoice
  onReturnTypeChange();
  // reset items
  renderReturnItems();
  // hide invoice card
  document.getElementById('retf-inv-card').style.display = 'none';
  openModal('modal-return');
}

function populateRetCashbox() {
  const sel = document.getElementById('retf-cashbox'); if(!sel) return;
  const currency = S.settings?.general?.currency||'EGP';
  sel.innerHTML = '<option value="">-- بدون خزينة --</option>' +
    Object.entries(S.cashboxes||{}).map(([id,cb])=>
      `<option value="${id}">${cb.name} (${(+cb.balance||0).toFixed(0)} ${currency})</option>`
    ).join('');
}

function onRefundMethodChange() {
  const method  = document.getElementById('retf-refund-method')?.value||'cash';
  const req     = document.getElementById('retf-cashbox-req');
  const hint    = document.getElementById('retf-cashbox-hint');
  if(req)  req.textContent  = method==='cash' ? '*' : '';
  if(hint) hint.textContent = method==='cash'
    ? 'الاسترداد نقدي: سيُخصم المبلغ من الخزينة المختارة'
    : method==='credit' ? 'رصيد: سيُضاف للعميل بدون خصم من الخزينة'
    : method==='exchange' ? 'استبدال: لا يوجد تأثير على الخزينة' : 'لا يوجد استرداد';
  calcReturnTotal(); // تحديث توزيع الدين/النقد فوراً
}

function onReturnTypeChange() {
  const type     = document.getElementById('retf-type')?.value||'sale';
  const invLabel = document.getElementById('retf-invoice-label');
  const invReq   = document.getElementById('retf-inv-req');
  const partyLbl = document.getElementById('retf-party-label');
  const invSel   = document.getElementById('retf-invoice-id');
  const cbLabel  = document.getElementById('retf-cashbox-label');

  if(invLabel) invLabel.childNodes[0].textContent = type==='sale'
    ? 'رقم فاتورة البيع الأصلية '
    : 'رقم أمر الشراء الأصلي ';
  if(invReq)   invReq.style.display = type==='sale' ? 'inline' : 'inline';
  if(partyLbl) partyLbl.textContent = type==='sale' ? 'العميل' : 'المورد';
  if(cbLabel)  cbLabel.childNodes[0].textContent = type==='sale'
    ? 'الخزينة (للاسترداد النقدي) '
    : 'الخزينة (للدفع للمورد) ';

  if(invSel) {
    if(type==='sale') {
      invSel.innerHTML = '<option value="">-- اختر فاتورة البيع --</option>' +
        filterByBranch(S.sales||{})
          .filter(([,s])=>s.type!=='manual'||(s.type==='manual'))
          .sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0))
          .map(([id,s])=>{
            const custName = s.customer||s.custName||s.customerName||'نقدي';
            const total    = (+s.total||0).toFixed(0);
            const date     = fDateShort(s.date||s.createdAt)||'';
            return `<option value="${id}">#${id.slice(-6).toUpperCase()} — ${custName} — ${total} — ${date}</option>`;
          }).join('');
    } else {
      invSel.innerHTML = '<option value="">-- اختر أمر الشراء --</option>' +
        Object.entries(S.purchaseOrders||{})
          .sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0))
          .map(([id,p])=>`<option value="${id}">#${id.slice(-6).toUpperCase()} — ${p.supplierName||'-'} — ${(+p.total||0).toFixed(0)} — ${fDateShort(p.date)}</option>`).join('');
    }
  }
  // reset items and card
  retItems = [];
  renderReturnItems();
  document.getElementById('retf-inv-card').style.display = 'none';
  document.getElementById('retf-party-name').textContent = 'سيُملأ تلقائياً من الفاتورة';
  document.getElementById('retf-party-id').value = '';
}

function onReturnInvoiceSelect() {
  const type  = document.getElementById('retf-type')?.value||'sale';
  const invId = document.getElementById('retf-invoice-id')?.value||'';
  const card  = document.getElementById('retf-inv-card');
  const currency = S.settings?.general?.currency||'EGP';

  if(!invId) {
    retItems = [];
    renderReturnItems();
    if(card) card.style.display = 'none';
    document.getElementById('retf-party-name').textContent = 'سيُملأ تلقائياً من الفاتورة';
    document.getElementById('retf-party-id').value = '';
    return;
  }

  if(type==='sale') {
    const sale = (S.sales||{})[invId]; if(!sale) return;
    const custName = sale.customer||sale.custName||sale.customerName||'عميل نقدي';
    const custId   = sale.customerId||sale.custId||'';

    // تعبئة بيانات العميل تلقائياً
    document.getElementById('retf-party-name').textContent = custName;
    document.getElementById('retf-party-id').value = custId;

    // بطاقة الفاتورة
    if(card) {
      card.style.display = 'block';
      document.getElementById('retf-inv-card-num').textContent  = '#'+invId.slice(-6).toUpperCase();
      document.getElementById('retf-inv-card-info').textContent =
        `${custName} | ${fDateShort(sale.date||sale.createdAt)||'—'} | ${getBranchName(sale.branchId)||'—'}`;
      document.getElementById('retf-inv-card-total').textContent =
        (+(sale.total||0)).toFixed(2)+' '+currency;
    }

    // تعبئة الأصناف من الفاتورة مع الكمية الأصلية
    retItems = (sale.items||[]).map(it=>({
      prodId:   it.productId||it.prodId||'',
      name:     it.name||'',
      origQty:  it.qty||1,
      qty:      it.qty||1,   // كمية مقترحة = الكاملة، يعدل المستخدم
      price:    it.price||0,
    }));

    // ضبط الفرع والخزينة من الفاتورة
    if(sale.branchId) {
      const brSel = document.getElementById('retf-branch');
      if(brSel) brSel.value = sale.branchId;
    }
    if(sale.cashboxId) {
      const cbSel = document.getElementById('retf-cashbox');
      if(cbSel) cbSel.value = sale.cashboxId;
    }
  } else {
    const po = (S.purchaseOrders||{})[invId]; if(!po) return;
    document.getElementById('retf-party-name').textContent = po.supplierName||'مورد غير محدد';
    document.getElementById('retf-party-id').value = po.supplierId||'';
    if(card) {
      card.style.display = 'block';
      document.getElementById('retf-inv-card-num').textContent  = '#'+invId.slice(-6).toUpperCase();
      document.getElementById('retf-inv-card-info').textContent =
        `${po.supplierName||'—'} | ${fDateShort(po.date)||'—'} | ${getBranchName(po.branchId)||'—'}`;
      document.getElementById('retf-inv-card-total').textContent =
        (+(po.total||0)).toFixed(2)+' '+currency;
    }
    retItems = (po.items||[]).map(it=>({
      prodId:  it.prodId||'',
      name:    it.name||it.productName||'',
      origQty: it.qty||1,
      qty:     it.qty||1,
      price:   it.cost||it.price||0,
    }));
  }

  if(!retItems.length) retItems = [{prodId:'',name:'',origQty:0,qty:1,price:0}];
  renderReturnItems();
}

function clearReturnInvoice() {
  const invSel = document.getElementById('retf-invoice-id');
  if(invSel) invSel.value = '';
  retItems = [];
  renderReturnItems();
  document.getElementById('retf-inv-card').style.display = 'none';
  document.getElementById('retf-party-name').textContent = 'سيُملأ تلقائياً من الفاتورة';
  document.getElementById('retf-party-id').value = '';
}

function addReturnItem() {
  retItems.push({prodId:'',name:'',origQty:0,qty:1,price:0});
  renderReturnItems();
}

function removeReturnItem(i) {
  retItems.splice(i,1);
  if(!retItems.length) retItems = [{prodId:'',name:'',origQty:0,qty:1,price:0}];
  renderReturnItems();
}

function renderReturnItems() {
  const el = document.getElementById('retf-items-list'); if(!el) return;
  const currency = S.settings?.general?.currency||'EGP';

  if(!retItems.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px;">
      <i class="fas fa-arrow-up" style="display:block;margin-bottom:6px;"></i>
      اختر الفاتورة أولاً لتُعبَّأ الأصناف تلقائياً</div>`;
    calcReturnTotal();
    return;
  }

  el.innerHTML = retItems.map((item,i)=>{
    const lineTotal = (item.qty||0)*(item.price||0);
    const overQty   = item.origQty>0 && item.qty > item.origQty;
    return `<div style="display:grid;grid-template-columns:1.5fr 80px 110px 80px 32px;gap:7px;margin-bottom:8px;align-items:center;">
      <div>
        <div style="font-size:12px;font-weight:700;">${item.name||'—'}</div>
        ${item.prodId?`<div style="font-size:10px;color:var(--text3);">${(S.products||{})[item.prodId]?.code||''}</div>`:''}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--text2);background:var(--card2);border-radius:7px;padding:7px 4px;">
        ${item.origQty>0?item.origQty:'—'}
      </div>
      <div>
        <input class="fc" type="number" min="1" max="${item.origQty>0?item.origQty:9999}"
          value="${item.qty||1}"
          oninput="retItems[${i}].qty=Math.max(1,+this.value);calcReturnTotal();checkRetQty(${i},this)"
          style="font-size:13px;text-align:center;${overQty?'border-color:var(--red);':''}"
          title="الكمية المرتجعة (الحد: ${item.origQty>0?item.origQty:'غير محدد'})">
        ${overQty?`<div style="font-size:10px;color:var(--red);">تجاوز كمية الفاتورة</div>`:''}
      </div>
      <div style="text-align:center;font-size:12px;font-weight:700;color:var(--red);">${lineTotal.toFixed(2)}</div>
      <button class="btn btn-danger btn-xs" onclick="removeReturnItem(${i})"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
  calcReturnTotal();
}

function checkRetQty(i, input) {
  const item = retItems[i]; if(!item) return;
  if(item.origQty>0 && item.qty > item.origQty) {
    input.style.borderColor = 'var(--red)';
  } else {
    input.style.borderColor = '';
  }
}

function calcReturnTotal() {
  const total = retItems.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);
  const currency = S.settings?.general?.currency||'EGP';
  const el = document.getElementById('retf-total-val');
  if(el) el.textContent = total.toFixed(2) + ' ' + currency;
  renderReturnSplit(total);
  return total;
}

// ============================================================
// توزيع قيمة المرتجع: يُخصم أولاً من دين العميل على الفاتورة، والباقي يُرد نقداً
// - فاتورة آجلة بالكامل + مرتجع جزئي  → كله خصم من الدين
// - فاتورة آجلة جزئياً + مرتجع كامل   → يُلغى باقي الدين ويُرد ما دفعه نقداً
// - فاتورة مدفوعة بالكامل             → كله استرداد نقدي
// ============================================================
function calcReturnSplit(total){
  const type   = document.getElementById('retf-type')?.value||'sale';
  const method = document.getElementById('retf-refund-method')?.value||'cash';
  const invId  = document.getElementById('retf-invoice-id')?.value||'';
  const sale   = type==='sale' ? (S.sales||{})[invId] : null;
  const saleDebt = Math.max(0, +sale?.balance||0);

  // مرتجع مشتريات أو استبدال أو بدون استرداد: لا خصم دين ولا نقد
  if(type!=='sale' || method==='exchange' || method==='none'){
    return {saleDebt, debtCut:0, cashBack:0, storeCredit:0};
  }
  const debtCut  = Math.min(total, saleDebt);       // ما يُطفأ من دين هذه الفاتورة
  const rest     = Math.max(0, total-debtCut);      // ما تبقى بعد إطفاء الدين
  if(method==='credit'){
    // رصيد لدى المتجر: الباقي يُضاف كرصيد دائن للعميل بدل النقد
    return {saleDebt, debtCut, cashBack:0, storeCredit:rest};
  }
  return {saleDebt, debtCut, cashBack:rest, storeCredit:0};
}

function renderReturnSplit(total){
  const box=document.getElementById('retf-split-box'); if(!box) return;
  const type  = document.getElementById('retf-type')?.value||'sale';
  const invId = document.getElementById('retf-invoice-id')?.value||'';
  if(type!=='sale' || !invId || !(total>0)){ box.style.display='none'; return; }

  const currency = S.settings?.general?.currency||'EGP';
  const sp = calcReturnSplit(total);
  const method = document.getElementById('retf-refund-method')?.value||'cash';
  box.style.display='block';
  document.getElementById('retf-sale-debt').textContent = sp.saleDebt.toFixed(2)+' '+currency;
  document.getElementById('retf-debt-cut').textContent  = sp.debtCut.toFixed(2)+' '+currency;
  const cashLbl = document.getElementById('retf-cash-lbl');
  const cashVal = document.getElementById('retf-cash-back');
  if(method==='credit'){
    cashLbl.textContent = 'يُضاف رصيداً للعميل:';
    cashVal.textContent = sp.storeCredit.toFixed(2)+' '+currency;
    cashVal.style.color = 'var(--purple)';
  } else {
    cashLbl.textContent = 'يُرد نقداً من الخزينة:';
    cashVal.textContent = sp.cashBack.toFixed(2)+' '+currency;
    cashVal.style.color = 'var(--red)';
  }
  const hint=document.getElementById('retf-split-hint');
  if(hint){
    if(method==='exchange'||method==='none'){
      hint.textContent='لا يوجد أي أثر مالي — استبدال / بدون استرداد.';
    } else if(sp.debtCut>0 && (sp.cashBack>0||sp.storeCredit>0)){
      hint.textContent='المرتجع يفوق دين العميل — يُطفأ الدين بالكامل والباقي يُرَد له.';
    } else if(sp.debtCut>0){
      hint.textContent='قيمة المرتجع كلها تُخصم من دين العميل — لا يخرج نقد من الخزينة.';
    } else {
      hint.textContent='لا يوجد دين على هذه الفاتورة — تُرَد القيمة كاملة.';
    }
  }
}

async function saveReturn() {
  const type         = document.getElementById('retf-type')?.value||'sale';
  const date         = document.getElementById('retf-date')?.value||new Date().toISOString().split('T')[0];
  const reason       = document.getElementById('retf-reason')?.value||'other';
  const refundMethod = document.getElementById('retf-refund-method')?.value||'cash';
  const notes        = (document.getElementById('retf-notes')?.value||'').trim();
  const branchId     = document.getElementById('retf-branch')?.value||'';
  const cbId         = document.getElementById('retf-cashbox')?.value||'';
  const invId        = document.getElementById('retf-invoice-id')?.value||'';
  const partyName    = document.getElementById('retf-party-name')?.textContent?.trim()||'';
  const partyId      = document.getElementById('retf-party-id')?.value||'';

  // التحقق من الفاتورة — إلزامية لمرتجع المبيعات
  if(type==='sale' && !invId) {
    toast('يجب اختيار فاتورة البيع الأصلية — المرتجع لا يُقبل بدون فاتورة','error');
    return;
  }
  const validItems = retItems.filter(i=>(i.name||'').trim()&&(+i.qty||0)>0);
  if(!validItems.length) { toast('يرجى إضافة صنف واحد على الأقل','error'); return; }

  // التحقق من عدم تجاوز الكميات
  for(const item of validItems) {
    if(item.origQty>0 && item.qty > item.origQty) {
      toast(`كمية "${item.name}" المرتجعة (${item.qty}) تتجاوز ما تم شراؤه (${item.origQty})`,'error');
      return;
    }
  }

  const total      = validItems.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);
  const branchName = getBranchName(branchId)||'مركزي';

  // توزيع القيمة: خصم من الدين أولاً، ثم استرداد نقدي/رصيد بالباقي
  const split = calcReturnSplit(total);
  // الخزينة مطلوبة فقط إذا كان هناك مبلغ نقدي سيخرج فعلياً
  if(split.cashBack>0 && !cbId) {
    toast('يجب اختيار الخزينة التي سيُصرف منها مبلغ الاسترداد','error');
    return;
  }

  const retData = {
    type, date, reason, refundMethod, notes,
    debtCut:     split.debtCut,     // ما خُصم من دين العميل
    cashBack:    split.cashBack,    // ما خرج نقداً من الخزينة
    storeCredit: split.storeCredit, // ما أُضيف كرصيد دائن للعميل
    branchId, branchName,
    partyName: partyName||( type==='sale'?'عميل نقدي':'مورد غير محدد' ),
    partyId:   partyId||'',
    customerId:type==='sale'?partyId:'',
    items:     validItems.map(i=>({prodId:i.prodId,name:i.name,qty:i.qty,price:i.price})),
    ...shiftStamp(),
    total,
    invoiceId:  invId||'',
    cashboxId:  cbId||'',
    cashboxName:(S.cashboxes||{})[cbId]?.name||'',
    createdBy:     CURRENT_USER?.id||'',
    createdByName: CURRENT_USER?.name||CURRENT_USER?.username||'',
    createdAt:     new Date().toISOString(),
  };

  try {
    const retId = uid();
    await dbSet('returns/'+retId, retData);

    // 1. تعديل المخزون
    for(const item of validItems) {
      if(!item.prodId) continue;
      const p = (S.products||{})[item.prodId]; if(!p) continue;
      const newQty = type==='sale'
        ? (+p.qty||0)+item.qty    // مرتجع مبيعات → يرجع للمخزن
        : Math.max(0,(+p.qty||0)-item.qty); // مرتجع مشتريات → يخرج من المخزن
      await dbUpdate('products/'+item.prodId,{qty:newQty,updatedAt:new Date().toISOString()});
      await dbPushMovement({
        date:    new Date().toISOString(),
        product: item.name,
        type:    type==='sale'?'in':'out',
        qty:     item.qty,
        branchId,
        note:   (type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات')+' #'+retId.slice(-6).toUpperCase(),
      });
    }

    // 2. خصم من الخزينة بقيمة الجزء النقدي فقط (بعد إطفاء الدين)
    if(split.cashBack>0 && cbId) {
      await addCashboxEntry(
        cbId, split.cashBack, 'withdraw',
        `استرداد مرتجع مبيعات #${retId.slice(-6).toUpperCase()} — ${partyName||'عميل نقدي'}`,
        retId
      );
    }

    // 3. تحديث الفاتورة الأصلية: إنقاص الإجمالي، وإطفاء الدين، وتعديل المدفوع
    if(type==='sale' && invId && (S.sales||{})[invId]) {
      const sale    = S.sales[invId];
      const saleNew = Math.max(0,(+sale.total||0)-total);
      const newBal  = Math.max(0,(+sale.balance||0)-split.debtCut);
      const newPaid = Math.max(0,(+sale.amountPaid||0)-split.cashBack);
      await dbUpdate('sales/'+invId,{
        returnedAmount: (+sale.returnedAmount||0)+total,
        total:          saleNew,
        balance:        newBal,
        amountPaid:     newPaid,
        status:         newBal<=0 ? 'paid' : (newPaid>0?'partial':'unpaid'),
        updatedAt:      new Date().toISOString(),
      });
    }

    // 4. تحديث إحصائيات العميل ورصيد ديونه
    if(type==='sale' && partyId && (S.customers||{})[partyId]) {
      const c = S.customers[partyId];
      const custUpd = {
        totalBuy:  Math.max(0,(+c.totalBuy||0)-total),
        updatedAt: new Date().toISOString(),
      };
      // الدين المخصوم + الرصيد الدائن (رصيد المتجر يُسجَّل كرصيد سالب لصالح العميل)
      const balCut = split.debtCut + split.storeCredit;
      if(balCut>0){
        const raw = (+c.balance||0) - balCut;
        custUpd.balance = refundMethod==='credit' ? raw : Math.max(0,raw);
      }
      await dbUpdate('customers/'+partyId,custUpd);
    }

    closeModal('modal-return');
    const currency=S.settings?.general?.currency||'EGP';
    let msg='✅ تم حفظ المرتجع';
    if(split.debtCut>0)     msg+=` — خُصم ${split.debtCut.toFixed(2)} ${currency} من دين العميل`;
    if(split.cashBack>0)    msg+=` — رُد ${split.cashBack.toFixed(2)} ${currency} نقداً`;
    if(split.storeCredit>0) msg+=` — أُضيف ${split.storeCredit.toFixed(2)} ${currency} رصيداً للعميل`;
    toast(msg);
    viewReturn(retId);
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}


function viewReturn(retId) {
  const r = (S.returns||{})[retId]; if(!r) return;
  const st = S.settings?.general||{};
  const currency = st.currency||'EGP';
  const typeLabel = r.type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات';
  const partyLabel= r.type==='sale'?'العميل:':'المورد:';
  const branchName= getBranchName(r.branchId)||r.branchName||'مركزي';

  const itemsHtml = (r.items||[]).map((it,i)=>`
    <tr style="background:${i%2===0?'#fff':'#faf6f1'};border-bottom:1px solid #e0d5c8;">
      <td style="padding:8px 12px;">${i+1}</td>
      <td style="padding:8px 12px;font-weight:600;">${it.name||'—'}</td>
      <td style="padding:8px 12px;">${it.qty||0}</td>
      <td style="padding:8px 12px;">${(+it.price||0).toFixed(2)} ${currency}</td>
      <td style="padding:8px 12px;font-weight:700;color:#c00;">${((it.qty||0)*(it.price||0)).toFixed(2)} ${currency}</td>
    </tr>`).join('');

  const html = `
  <div style="direction:rtl;font-family:'Cairo',Arial,sans-serif;background:#fff;color:#000;padding:0;font-size:13px;border:1px solid #ddd;">
    <div style="background:#fff;border-bottom:3px solid #c00;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:16px;font-weight:900;">${st.company||'الشمس'}</div>
        <div style="font-size:10px;color:#555;">${st.phone?'📞 '+st.phone:''} | ${branchName}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:20px;font-weight:900;color:#c00;">${typeLabel}</div>
        <div style="font-size:10px;color:#555;">#${retId.slice(-6).toUpperCase()}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #000;">
      <div style="padding:12px 20px;border-left:1px solid #ddd;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#555;padding:3px 0;width:130px;">الشركة:</td><td style="font-weight:700;">${st.company||'الشمس'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">الفرع:</td><td>${branchName}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">طريقة الاسترداد:</td><td style="font-weight:700;">${REFUND_METHODS[r.refundMethod]||r.refundMethod||'—'}</td></tr>
          ${r.cashboxName?`<tr><td style="color:#555;padding:3px 0;">الخزينة:</td><td style="font-weight:700;color:#c00;">${r.cashboxName}</td></tr>`:''}
          ${r.invoiceId?`<tr><td style="color:#555;padding:3px 0;">فاتورة البيع:</td><td style="font-weight:700;color:#1a7abf;">#${r.invoiceId.slice(-6).toUpperCase()}</td></tr>`:''}
          <tr><td style="color:#555;padding:3px 0;">بواسطة:</td><td>${r.createdByName||'—'}</td></tr>
        </table>
      </div>
      <div style="padding:12px 20px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#555;padding:3px 0;width:130px;">${partyLabel}</td><td style="font-weight:700;">${r.partyName||'—'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">التاريخ:</td><td>${fDateShort(r.date)}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">سبب الإرجاع:</td><td style="font-weight:700;">${RETURN_REASONS[r.reason]||r.reason||'—'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">الفاتورة الأصلية:</td><td>${r.invoiceId?('#'+r.invoiceId.slice(-5).toUpperCase()):'—'}</td></tr>
          ${+r.debtCut>0?`<tr><td style="color:#555;padding:3px 0;">خُصم من الدين:</td><td style="font-weight:700;color:#0a7;">${(+r.debtCut).toFixed(2)} ${currency}</td></tr>`:''}
          ${+r.cashBack>0?`<tr><td style="color:#555;padding:3px 0;">رُد نقداً:</td><td style="font-weight:700;color:#c00;">${(+r.cashBack).toFixed(2)} ${currency}</td></tr>`:''}
          ${+r.storeCredit>0?`<tr><td style="color:#555;padding:3px 0;">رصيد للعميل:</td><td style="font-weight:700;color:#70a;">${(+r.storeCredit).toFixed(2)} ${currency}</td></tr>`:''}
        </table>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#fff;border-bottom:2px solid #000;border-top:1px solid #000;">
        <th style="padding:9px 12px;text-align:right;">#</th>
        <th style="padding:9px 12px;text-align:right;">الصنف</th>
        <th style="padding:9px 12px;text-align:right;">الكمية</th>
        <th style="padding:9px 12px;text-align:right;">سعر الوحدة</th>
        <th style="padding:9px 12px;text-align:right;">الإجمالي</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="border-top:2px solid #000;padding:14px 20px;display:flex;justify-content:flex-end;">
      <div style="background:#fff0f0;border:2px solid #c00;border-radius:8px;padding:12px 24px;text-align:center;min-width:200px;">
        <div style="font-size:11px;color:#555;">إجمالي قيمة المرتجع</div>
        <div style="font-size:22px;font-weight:900;color:#c00;">${(+r.total||0).toFixed(2)} ${currency}</div>
      </div>
    </div>
    ${r.notes?`<div style="border-top:1px solid #ddd;padding:10px 20px;font-size:11px;color:#333;">ملاحظات: ${r.notes}</div>`:''}
    <div style="border-top:2px solid #000;padding:10px 20px;text-align:center;font-size:10px;color:#555;">
      ${st.company||'الشمس'} ${st.phone?'| 📞 '+st.phone:''}
    </div>
  </div>`;

  const body = document.getElementById('ret-view-body');
  if(body) body.innerHTML = html;
  openModal('modal-ret-view');
}

async function delReturn(id) {
  const ok = await confirm2('حذف هذا المرتجع؟ لن يتم التراجع عن تعديلات المخزون.','حذف مرتجع','🗑️','حذف','btn-danger');
  if(!ok) return;
  try { await dbRemove('returns/'+id); toast('تم حذف المرتجع'); }
  catch(e) { toast('خطأ: '+e.message,'error'); }
}

function populateRetBranchFilter() {
  const sel = document.getElementById('ret-branch-filter'); if(!sel) return;
  sel.innerHTML = '<option value="">كل الفروع</option>' +
    Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
}

