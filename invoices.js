// ============================================================
// MANUAL INVOICES — الفواتير
// ============================================================
let miItems = [{name:'',desc:'',qty:1,price:0,prodId:''}];

function renderInvoices() {
  renderInvStats();
  renderInvTable();
}

function renderInvStats() {
  const currency = S.settings?.general?.currency||'EGP';
  const allSales = filterByBranch(S.sales||{}).map(([,v])=>v).filter(s=>s.type==='manual'||s.type==='pos');
  const paid     = allSales.filter(s=>s.status==='paid').length;
  const unpaid   = allSales.filter(s=>s.status!=='paid').length;
  const revenue  = allSales.reduce((s,v)=>s+(+v.total||0),0);
  const posCount = allSales.filter(s=>s.type==='pos').length;
  const el = id=>document.getElementById(id);
  if(el('inv-stat-total'))   el('inv-stat-total').textContent   = allSales.length;
  if(el('inv-stat-paid'))    el('inv-stat-paid').textContent    = paid;
  if(el('inv-stat-unpaid'))  el('inv-stat-unpaid').textContent  = unpaid;
  if(el('inv-stat-revenue')) el('inv-stat-revenue').textContent = revenue.toFixed(0)+' '+currency;
  // Update subtitle to show POS count if exists
  const subEl = document.getElementById('inv-subtitle');
  if(subEl && posCount > 0) subEl.textContent = `جميع الفواتير ونقاط البيع (${posCount} من الكاشير)`;
  else if(subEl) subEl.textContent = 'جميع الفواتير ونقاط البيع';
}

function renderInvTable() {
  const tbody   = document.getElementById('inv-tbl'); if(!tbody) return;
  const currency= S.settings?.general?.currency||'EGP';
  const search  = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const statusF = document.getElementById('inv-filter-status')?.value||'';
  const branchF = document.getElementById('inv-filter-branch')?.value||'';
  const typeF   = document.getElementById('inv-filter-type')?.value||'';
  const from    = document.getElementById('inv-from')?.value||'';
  const to      = document.getElementById('inv-to')?.value||'';

  const rows = filterByBranch(S.sales||{}).filter(([,s])=>s.type==='manual'||s.type==='pos').filter(([id,s])=>{
    const d = (s.date||s.createdAt||'').slice(0,10);
    return (!search || (s.custName||s.customerName||s.customer||'').toLowerCase().includes(search) || id.slice(-5).toLowerCase().includes(search))
      && (!statusF || s.status===statusF)
      && (!branchF || s.branchId===branchF)
      && (!typeF   || s.type===typeF)
      && (!from || d>=from) && (!to || d<=to);
  }).sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0));

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text2);">
      <i class="fas fa-file-invoice" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>
      لا توجد فواتير</td></tr>`;
    return;
  }

  const stMap = {
    paid:    '<span class="badge badge-success">مدفوعة</span>',
    partial: '<span class="badge badge-warning">جزئية</span>',
    unpaid:  '<span class="badge badge-danger">غير مدفوعة</span>',
  };

  const typeBadgeMap = {
    manual: '<span class="badge badge-purple" title="فاتورة يدوية"><i class="fas fa-file-invoice"></i> يدوية</span>',
    pos:    '<span class="badge badge-info" title="فاتورة كاشير"><i class="fas fa-cash-register"></i> كاشير</span>',
  };

  tbody.innerHTML = rows.map(([id,s])=>{
    const bal       = +s.balance||0;
    const paid      = +s.amountPaid||+s.systemAmount||0;
    const branchName= getBranchName(s.branchId)||'—';
    const custName  = s.custName||s.customerName||s.customer||'نقدي';
    const itemCount = (s.items||[]).length;
    const saleType  = s.type||'manual';
    return `<tr>
      <td style="color:var(--accent);font-weight:700;font-size:11px;">#${id.slice(-6).toUpperCase()}</td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(s.date||s.createdAt)}</td>
      <td>${typeBadgeMap[saleType]||typeBadgeMap.manual}${
        s.saleMode==='wholesale'?' <span class="badge badge-purple" title="بيع بسعر الجملة"><i class="fas fa-boxes"></i> جملة</span>':
        s.saleMode==='mixed'    ?' <span class="badge badge-warning" title="أصناف بسعر قطاعي وأخرى بالجملة"><i class="fas fa-random"></i> مختلط</span>':''
      }${s.offlineCreated?' <span class="badge badge-warning" title="فاتورة تمت أثناء انقطاع الإنترنت"><i class="fas fa-wifi"></i> أوف لاين</span>':''}</td>
      <td><strong>${custName}</strong></td>
      <td style="font-size:11px;">${branchName}</td>
      <td style="text-align:center;"><span class="badge badge-info">${itemCount} بند</span></td>
      <td style="font-weight:700;">${(+s.total||0).toFixed(2)} ${currency}</td>
      <td style="color:var(--green);">${paid.toFixed(2)} ${currency}</td>
      <td style="color:${bal>0?'var(--red)':'var(--text2)'};font-weight:${bal>0?'700':'400'};">${bal>0?bal.toFixed(2)+' '+currency:'—'}</td>
      <td>${stMap[s.status]||stMap.unpaid}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-xs" onclick="viewManualInvoice('${id}')" title="عرض الفاتورة (طباعة / Word / صورة)"><i class="fas fa-eye"></i></button>
        <button class="btn btn-ghost btn-xs" onclick="openReturnFromInvoice('${id}')" title="إنشاء مرتجع لهذه الفاتورة" style="color:var(--red);border-color:var(--red);"><i class="fas fa-undo-alt"></i></button>
        ${bal>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}')" title="تحصيل"><i class="fas fa-hand-holding-usd"></i></button>`:''}
        ${saleType==='manual'?`<button class="btn btn-danger btn-xs" onclick="delManualInvoice('${id}')" title="حذف"><i class="fas fa-trash"></i></button>`:''}
      </td>
    </tr>`;
  }).join('');
}

function populateInvBranchFilter() {
  const sel = document.getElementById('inv-filter-branch'); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الفروع</option>' +
    Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
  sel.value = cur;
}

// ─── فتح مودال الفاتورة اليدوية ─────────────────────────
function openManualInvoice() {
  miItems = [{name:'',desc:'',qty:1,price:0,prodId:''}];
  document.getElementById('mi-date').value  = new Date().toISOString().slice(0,10);
  document.getElementById('mi-disc').value  = '0';
  document.getElementById('mi-tax').value   = '0';
  document.getElementById('mi-paid').value  = '0';
  document.getElementById('mi-notes').value = '';
  document.getElementById('mi-cust-name').value = '';
  document.getElementById('mi-cust-id').value   = '';
  document.getElementById('mi-pay').value        = 'cash';
  document.getElementById('mi-paid-wrap').style.display = '';
  populateBranchSelect('mi-branch', CURRENT_USER?.branch||'');
  // populate cashboxes
  const cbSel = document.getElementById('mi-cashbox');
  if(cbSel){
    cbSel.innerHTML = '<option value="">-- بدون خزينة --</option>' +
      Object.entries(S.cashboxes||{}).map(([id,cb])=>`<option value="${id}">${cb.name}</option>`).join('');
  }
  renderMiItems();
  calcMi();
  openModal('modal-manual');
}

function clearMiCust(){ document.getElementById('mi-cust-id').value=''; }

function pickMiCustomer() {
  const q = (document.getElementById('mi-cust-name')?.value||'').trim().toLowerCase();
  const matches = Object.entries(S.customers||{}).filter(([,c])=>
    !q||(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)).slice(0,8);
  if(!matches.length){ toast('لا يوجد عملاء مطابقون','info'); return; }
  if(matches.length===1){
    document.getElementById('mi-cust-name').value = matches[0][1].name;
    document.getElementById('mi-cust-id').value   = matches[0][0];
    return;
  }
  // قائمة مؤقتة
  let drop = document.getElementById('mi-cust-drop');
  if(drop) drop.remove();
  const wrap = document.getElementById('mi-cust-name')?.parentElement;
  if(!wrap) return;
  drop = document.createElement('div');
  drop.id='mi-cust-drop';
  drop.style.cssText='position:absolute;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);max-height:200px;overflow-y:auto;width:100%;margin-top:2px;';
  drop.innerHTML = matches.map(([id,c])=>`
    <div onclick="selectMiCust('${id}','${(c.name||'').replace(/'/g,"\\'")}');" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border2);font-size:12px;" onmouseover="this.style.background='var(--accent-bg)'" onmouseout="this.style.background=''">
      <strong>${c.name}</strong> <span style="color:var(--text2);">${c.phone||''}</span>
    </div>`).join('');
  wrap.style.position='relative';
  wrap.appendChild(drop);
  setTimeout(()=>document.addEventListener('click',()=>drop.remove(),{once:true}),100);
}

function selectMiCust(id,name){
  document.getElementById('mi-cust-name').value=name;
  document.getElementById('mi-cust-id').value=id;
  document.getElementById('mi-cust-drop')?.remove();
}

function addMiItem(){ miItems.push({name:'',desc:'',qty:1,price:0,prodId:''}); renderMiItems(); }

function addMiItemFromStock(){
  // فتح قائمة منسدلة لاختيار منتج من المخزون
  const q = '';
  const prods = Object.entries(S.products||{}).filter(([,p])=>p.status==='active'&&(+p.qty||0)>0).slice(0,20);
  if(!prods.length){ toast('لا توجد منتجات في المخزون','warning'); return; }
  let drop = document.getElementById('mi-stock-drop');
  if(drop) drop.remove();
  const btn = document.querySelector('[onclick="addMiItemFromStock()"]');
  if(!btn) return;
  drop = document.createElement('div');
  drop.id='mi-stock-drop';
  drop.style.cssText='position:fixed;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-height:240px;overflow-y:auto;width:280px;';
  const rect=btn.getBoundingClientRect();
  drop.style.top=(rect.bottom+6)+'px';
  drop.style.right=(window.innerWidth-rect.right)+'px';
  const currency=S.settings?.general?.currency||'EGP';
  drop.innerHTML = prods.map(([id,p])=>`
    <div onclick="addMiItemProd('${id}')" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border2);display:flex;justify-content:space-between;font-size:12px;" onmouseover="this.style.background='var(--accent-bg)'" onmouseout="this.style.background=''">
      <div><strong>${p.name}</strong><div style="font-size:10px;color:var(--text3);">متاح: ${p.qty}</div></div>
      <div style="color:var(--accent);font-weight:700;">${(+p.price||0).toFixed(0)} ${currency}</div>
    </div>`).join('');
  document.body.appendChild(drop);
  setTimeout(()=>document.addEventListener('click',()=>drop.remove(),{once:true}),100);
}

function addMiItemProd(prodId){
  const p=(S.products||{})[prodId]; if(!p) return;
  // نستخدم سعر نوع العميل المختار في الفاتورة اليدوية (قطاعي افتراضياً)
  const cid  = document.getElementById('mi-cust-id')?.value||'';
  const mode = (S.customers||{})[cid]?.custType==='wholesale' ? 'wholesale' : 'retail';
  const price= productPrice(p,mode);
  miItems.push({name:p.name,desc:p.desc||'',qty:1,price,prodId,priceMode:mode});
  renderMiItems();
  document.getElementById('mi-stock-drop')?.remove();
  if(mode==='wholesale') toast(`"${p.name}" أُضيف بسعر الجملة (${price.toFixed(2)})`,'info');
}

function removeMiItem(i){ miItems.splice(i,1); if(!miItems.length) miItems=[{name:'',desc:'',qty:1,price:0,prodId:''}]; renderMiItems(); }

function renderMiItems(){
  const el=document.getElementById('mi-items-list'); if(!el) return;
  el.innerHTML=miItems.map((item,i)=>`
    <div style="display:grid;grid-template-columns:1.5fr 1fr 80px 100px 90px 32px;gap:6px;margin-bottom:7px;align-items:center;">
      <input class="fc" placeholder="اسم الصنف / الخدمة *" value="${item.name}" oninput="miItems[${i}].name=this.value;calcMi()" style="font-size:12px;font-weight:600;">
      <input class="fc" placeholder="الوصف (اختياري)" value="${item.desc||''}" oninput="miItems[${i}].desc=this.value" style="font-size:11px;">
      <input class="fc" type="number" min="1" value="${item.qty}" oninput="miItems[${i}].qty=Math.max(1,+this.value);calcMi()" style="font-size:12px;text-align:center;">
      <input class="fc" type="number" min="0" step="0.01" value="${item.price}" oninput="miItems[${i}].price=+this.value;calcMi()" style="font-size:12px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:var(--accent);text-align:center;background:var(--card2);border-radius:7px;padding:8px 4px;">${((item.qty||0)*(item.price||0)).toFixed(2)}</div>
      <button class="btn btn-danger btn-xs" onclick="removeMiItem(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
  calcMi();
}

function calcMi(){
  const sub     = miItems.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);
  const disc    = parseFloat(document.getElementById('mi-disc')?.value)||0;
  const tax     = parseFloat(document.getElementById('mi-tax')?.value)||0;
  const discAmt = sub*disc/100;
  const taxAmt  = (sub-discAmt)*tax/100;
  const total   = sub-discAmt+taxAmt;
  const paidInput = parseFloat(document.getElementById('mi-paid')?.value)||0;
  const payMethod = document.getElementById('mi-pay')?.value||'cash';
  const paid      = payMethod==='credit'?0:paidInput;
  const bal       = Math.max(0,total-paid);
  const currency  = S.settings?.general?.currency||'EGP';
  const el=id=>document.getElementById(id);
  if(el('mi-subtotal'))     el('mi-subtotal').textContent     = sub.toFixed(2)+' '+currency;
  if(el('mi-disc-val'))     el('mi-disc-val').textContent     = '-'+discAmt.toFixed(2)+' '+currency;
  if(el('mi-tax-val'))      el('mi-tax-val').textContent      = '+'+taxAmt.toFixed(2)+' '+currency;
  if(el('mi-total'))        el('mi-total').textContent        = total.toFixed(2)+' '+currency;
  if(el('mi-paid-display')) el('mi-paid-display').textContent = paid.toFixed(2)+' '+currency;
  if(el('mi-balance'))      el('mi-balance').textContent      = bal.toFixed(2)+' '+currency;
  if(el('mi-balance'))      el('mi-balance').style.color      = bal>0?'var(--red)':'var(--green)';
  return {sub,discAmt,taxAmt,total,paid,bal};
}

function onMiPayChange(){
  const method = document.getElementById('mi-pay')?.value;
  const wrap   = document.getElementById('mi-paid-wrap');
  if(wrap) wrap.style.display = method==='credit'?'none':'';
  if(method==='credit' && document.getElementById('mi-paid'))
    document.getElementById('mi-paid').value='0';
  calcMi();
}

async function saveManualInvoice(){
  const validItems = miItems.filter(i=>(i.name||'').trim()&&(+i.qty||0)>0);
  if(!validItems.length){ toast('يرجى إضافة بند واحد على الأقل','error'); return; }
  const {sub,discAmt,taxAmt,total,paid,bal} = calcMi();
  if(total<=0){ toast('إجمالي الفاتورة يجب أن يكون أكبر من صفر','error'); return; }

  const custId   = document.getElementById('mi-cust-id')?.value||'';
  const custName = (document.getElementById('mi-cust-name')?.value||'').trim()||'عميل نقدي';
  const branchId = document.getElementById('mi-branch')?.value||CURRENT_USER?.branch||'';
  const cbId     = document.getElementById('mi-cashbox')?.value||'';
  const payMethod= document.getElementById('mi-pay')?.value||'cash';
  const notes    = document.getElementById('mi-notes')?.value||'';

  const saleData = {
    type:         'manual',
    date:         document.getElementById('mi-date')?.value||new Date().toISOString().slice(0,10),
    custName, customerId:custId,
    branchId,     branchName: getBranchName(branchId)||'',
    items:        validItems,
    saleMode:     validItems.some(i=>i.priceMode==='wholesale')
                    ? (validItems.every(i=>i.priceMode==='wholesale') ? 'wholesale' : 'mixed')
                    : 'retail',
    subtotal:sub, discount:discAmt, tax:taxAmt, total,
    amountPaid:   paid,
    balance:      bal,
    paymentMethod:payMethod,
    cashboxId:    cbId,
    notes,
    status:       bal<=0?'paid':paid>0?'partial':'unpaid',
    createdBy:    CURRENT_USER?.id||'',
    createdByName:CURRENT_USER?.name||'',
    createdAt:    new Date().toISOString(),
    ...shiftStamp(),
  };

  try{
    const saleId = uid();
    await dbSet('sales/'+saleId, saleData);

    // تحديث العميل
    if(custId && (S.customers||{})[custId]){
      const c=S.customers[custId];
      await dbUpdate('customers/'+custId,{
        totalBuy:(+c.totalBuy||0)+total,
        balance: (+c.balance||0)+bal,
        lastVisit: new Date().toISOString(),
      });
    }

    // إيداع في الخزينة
    if(cbId && paid>0 && payMethod!=='credit'){
      await addCashboxEntry(cbId, paid, 'deposit', `فاتورة يدوية — ${custName}`, saleId);
    }

    closeModal('modal-manual');
    toast('✅ تم حفظ الفاتورة بنجاح');
    viewManualInvoice(saleId);
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

function viewManualInvoice(saleId){
  const s=(S.sales||{})[saleId]; if(!s){ toast('الفاتورة غير موجودة','error'); return; }
  // نعرض الفاتورة بقالب المصمم نفسه حتى ينعكس أي تعديل في «تصميم الفاتورة»
  // هنا وفي الطباعة و Word والصورة. القالب القديم كان بألوان مكتوبة في الكود
  // وكان يُعرض داخل مودال المرتجعات فيظهر عنوانه "تفاصيل المرتجع" فوق فاتورة بيع.
  showInvoice(s);
}

async function delManualInvoice(id){
  const ok=await confirm2('حذف هذه الفاتورة؟','حذف فاتورة','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('sales/'+id); toast('تم حذف الفاتورة'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

