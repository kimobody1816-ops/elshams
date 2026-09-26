// ============================================================
// CUSTOMERS — إدارة العملاء
// ============================================================
let editingCust = null;

function renderCustomers() {
  const tbody = document.getElementById('cust-tbl'); if(!tbody) return;
  const search    = (document.getElementById('cust-search')?.value||'').toLowerCase();
  const branchF   = document.getElementById('cust-branch-filter')?.value||'';
  const debtF     = document.getElementById('cust-debt-filter')?.value||'';
  const currency  = S.settings?.general?.currency||'EGP';

  // العملاء ظاهرين لكل المستخدمين من كل الفروع (طلب الزبون) — الفواتير والديون لسه حسب الفرع
  const all = Object.entries(S.customers||{});

  // Stats
  const totalDebt  = all.reduce((s,[,c])=>s+(+c.balance||0),0);
  const totalBuy   = all.reduce((s,[,c])=>s+(+c.totalBuy||0),0);
  const debtors    = all.filter(([,c])=>(+c.balance||0)>0).length;
  const el = id => document.getElementById(id);
  if(el('cust-stat-total'))      el('cust-stat-total').textContent = all.length;
  if(el('cust-stat-debtors'))    el('cust-stat-debtors').textContent = debtors;
  if(el('cust-stat-debt-total')) el('cust-stat-debt-total').textContent = totalDebt.toFixed(0);
  if(el('cust-stat-buytotal'))   el('cust-stat-buytotal').textContent = totalBuy.toFixed(0);

  // Filter
  const rows = all.filter(([,c])=>{ // branch already filtered
    const matchSearch = !search || (c.name||'').toLowerCase().includes(search) || (c.phone||'').includes(search);
    const matchBranch = !branchF || c.branchId===branchF;
    const matchDebt   = !debtF  || (debtF==='debt'?(+c.balance||0)>0:(+c.balance||0)===0);
    return matchSearch && matchBranch && matchDebt;
  }).sort(([,a],[,b])=>(b.createdAt||'').localeCompare(a.createdAt||''));

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text2);"><i class="fas fa-users" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px;"></i>لا يوجد عملاء</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(([id,c])=>{
    const debt   = +c.balance||0;
    const branch = getBranchName(c.branchId)||'—';
    return `<tr>
      <td style="font-size:11px;color:var(--accent);font-weight:700;">${id.slice(-6).toUpperCase()}</td>
      <td>
        <div style="font-weight:700;">${c.name||'—'}</div>
        ${c.email?`<div style="font-size:10px;color:var(--text3);">${c.email}</div>`:''}
      </td>
      <td>${custTypeBadge(c.custType)}</td>
      <td>${c.phone||'—'}</td>
      <td style="font-size:11px;">${branch}</td>
      <td style="font-size:11px;color:var(--text2);">${c.addr||'—'}</td>
      <td style="color:var(--accent);font-weight:700;">${(+c.totalBuy||0).toFixed(0)} ${currency}</td>
      <td style="color:${debt>0?'var(--red)':'var(--green)'};font-weight:${debt>0?'700':'400'};">
        ${debt>0?`${debt.toFixed(2)} ${currency}`:'<i class="fas fa-check-circle" style="font-size:12px;"></i>'}
      </td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(c.createdAt)||'—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-xs" onclick="openCustProfile('${id}')" title="الملف الشامل"><i class="fas fa-id-card"></i></button>
        ${debt>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}')" title="تسديد الدين"><i class="fas fa-hand-holding-usd"></i></button>`:''}
        <button class="btn btn-ghost btn-xs" onclick="openStatement('customer','${id}')" title="كشف حساب شامل" style="color:var(--accent);border-color:var(--accent);"><i class="fas fa-file-invoice-dollar"></i></button>
        <button class="btn btn-ghost btn-xs" onclick="editCust('${id}')" title="تعديل"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="delCust('${id}')" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function openAddCustomer() {
  editingCust = null;
  document.getElementById('cust-modal-title').textContent = 'عميل جديد';
  ['cust-f-name','cust-f-phone','cust-f-email','cust-f-addr','cust-f-notes'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('cust-f-type').value = 'retail';
  document.getElementById('cust-f-name-hint').style.display  = 'none';
  document.getElementById('cust-f-phone-hint').style.display = 'none';
  populateBranchSelect('cust-f-branch', CURRENT_USER?.branch||'');
  openModal('modal-customer');
}

function editCust(id) {
  editingCust = id;
  const c = (S.customers||{})[id]; if(!c) return;
  document.getElementById('cust-modal-title').textContent = 'تعديل عميل';
  document.getElementById('cust-f-name').value  = c.name||'';
  document.getElementById('cust-f-phone').value = c.phone||'';
  document.getElementById('cust-f-email').value = c.email||'';
  document.getElementById('cust-f-addr').value  = c.addr||'';
  document.getElementById('cust-f-notes').value = c.notes||'';
  document.getElementById('cust-f-type').value  = c.custType==='wholesale'?'wholesale':'retail';
  document.getElementById('cust-f-name-hint').style.display  = 'none';
  document.getElementById('cust-f-phone-hint').style.display = 'none';
  populateBranchSelect('cust-f-branch', c.branchId||'');
  openModal('modal-customer');
}

async function saveCustomer() {
  const name  = (document.getElementById('cust-f-name')?.value||'').trim();
  const phone = (document.getElementById('cust-f-phone')?.value||'').trim();
  if(!name){ toast('يرجى إدخال اسم العميل','error'); return; }

  // تحقق تكرار الهاتف
  if(phone){
    const dup = Object.entries(S.customers||{}).find(([id,c])=>c.phone===phone&&id!==editingCust);
    if(dup){ toast('رقم الهاتف مستخدم بالفعل للعميل: '+dup[1].name,'error'); return; }
  }

  const branchId = document.getElementById('cust-f-branch')?.value||'';
  const data = {
    name, phone,
    email:    (document.getElementById('cust-f-email')?.value||'').trim(),
    addr:     (document.getElementById('cust-f-addr')?.value||'').trim(),
    notes:    (document.getElementById('cust-f-notes')?.value||'').trim(),
    custType: document.getElementById('cust-f-type')?.value==='wholesale'?'wholesale':'retail',
    branchId,
    branchName: getBranchName(branchId)||'',
    updatedAt: new Date().toISOString(),
    updatedBy: CURRENT_USER?.id||''
  };
  if(!editingCust){ data.createdAt = new Date().toISOString(); data.totalBuy=0; data.balance=0; }

  try {
    const path = editingCust ? 'customers/'+editingCust : 'customers/'+uid();
    await dbSet(path, editingCust ? {...(S.customers[editingCust]||{}), ...data} : data);
    closeModal('modal-customer');
    toast(editingCust?'تم تعديل بيانات العميل ✅':'تم إضافة العميل ✅');
    editingCust = null;
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function delCust(id) {
  const c = (S.customers||{})[id];
  const ok = await confirm2(`حذف العميل "${c?.name}"؟`,'حذف عميل','🗑️','حذف','btn-danger');
  if(!ok) return;
  try { await dbRemove('customers/'+id); toast('تم حذف العميل'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

function checkCustNameDup(val) {
  const hint = document.getElementById('cust-f-name-hint'); if(!hint) return;
  const name = (val||'').trim();
  if(!name){ hint.style.display='none'; return; }
  const dup = Object.entries(S.customers||{}).find(([id,c])=>c.name===name&&id!==editingCust);
  if(dup){ hint.textContent='⚠️ هذا الاسم موجود: '+dup[1].name+(dup[1].phone?' — '+dup[1].phone:''); hint.style.display='block'; }
  else    { hint.style.display='none'; }
}

function checkCustPhoneDup(val) {
  const hint = document.getElementById('cust-f-phone-hint'); if(!hint) return;
  const phone = (val||'').trim();
  if(!phone){ hint.style.display='none'; return; }
  const dup = Object.entries(S.customers||{}).find(([id,c])=>c.phone===phone&&id!==editingCust);
  if(dup){ hint.textContent='❌ الهاتف مستخدم للعميل: '+dup[1].name; hint.style.display='block'; }
  else    { hint.style.display='none'; }
}

function populateCustBranchFilter() {
  const sel = document.getElementById('cust-branch-filter'); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الفروع</option>' +
    Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
  sel.value = cur;
}

// ─── ملف العميل الشامل ───────────────────────────────────
function openCustomerSearch() {
  ['cs-input'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('cs-list').style.display    = 'none';
  document.getElementById('cs-list').innerHTML        = '';
  document.getElementById('cs-profile').style.display = 'none';
  document.getElementById('cs-empty').style.display   = 'block';
  document.getElementById('cs-notfound').style.display= 'none';
  openModal('modal-cust-search');
  setTimeout(()=>document.getElementById('cs-input')?.focus(), 200);
}

function openCustProfile(id) {
  openCustomerSearch();
  setTimeout(()=>{ loadCustomerProfile(id); }, 100);
}

function runCustomerSearch() {
  const q = (document.getElementById('cs-input')?.value||'').trim().toLowerCase();
  document.getElementById('cs-profile').style.display  = 'none';
  document.getElementById('cs-notfound').style.display = 'none';
  document.getElementById('cs-empty').style.display    = 'none';
  document.getElementById('cs-list').style.display     = 'none';
  if(!q){ document.getElementById('cs-empty').style.display='block'; return; }

  const matches = Object.entries(S.customers||{}).filter(([id,c])=>{
    const shortId = id.slice(-6).toUpperCase();
    return shortId===q.toUpperCase() || id.toLowerCase()===q
      || (c.name||'').toLowerCase().includes(q)
      || (c.phone||'').includes(q);
  });

  if(!matches.length){ document.getElementById('cs-notfound').style.display='block'; return; }
  if(matches.length===1){ loadCustomerProfile(matches[0][0]); return; }

  const listEl = document.getElementById('cs-list');
  listEl.innerHTML = matches.map(([id,c])=>`
    <div onclick="loadCustomerProfile('${id}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border2);display:flex;align-items:center;gap:10px;" onmouseover="this.style.background='var(--accent-bg)'" onmouseout="this.style.background=''">
      <div style="width:32px;height:32px;background:var(--accent-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;">👤</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;">${c.name||'—'}</div>
        <div style="font-size:11px;color:var(--text2);">📞 ${c.phone||'—'} | كود: <span style="color:var(--accent);font-weight:700;">${id.slice(-6).toUpperCase()}</span></div>
      </div>
      ${(+c.balance||0)>0?`<span style="background:var(--red-bg);color:var(--red);border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;">${(+c.balance).toFixed(2)} دين</span>`:''}
    </div>`).join('');
  listEl.style.display = 'block';
}

function loadCustomerProfile(id) {
  const c = (S.customers||{})[id]; if(!c){ toast('لم يُعثر على العميل','error'); return; }
  const currency = S.settings?.general?.currency||'EGP';

  document.getElementById('cs-list').style.display     = 'none';
  document.getElementById('cs-empty').style.display    = 'none';
  document.getElementById('cs-notfound').style.display = 'none';

  // بيانات العميل
  document.getElementById('cs-name').textContent       = c.name||'—';
  document.getElementById('cs-id-display').textContent = 'كود العميل: '+id.slice(-6).toUpperCase();
  document.getElementById('cs-branch-display').innerHTML = 'الفرع: '+(getBranchName(c.branchId)||'غير محدد')+' &nbsp; '+custTypeBadge(c.custType);
  document.getElementById('cs-phone').textContent      = c.phone||'لا يوجد';
  document.getElementById('cs-addr').textContent       = c.addr||'لا يوجد';
  document.getElementById('cs-email').textContent      = c.email||'لا يوجد';
  document.getElementById('cs-created').textContent    = fDateShort(c.createdAt)||'—';

  const notesRow  = document.getElementById('cs-notes-row');
  const notesText = document.getElementById('cs-notes-text');
  if(c.notes){ notesRow.style.display='block'; notesText.textContent=c.notes; }
  else        { notesRow.style.display='none'; }

  const debt = +c.balance||0;
  document.getElementById('cs-total').textContent = (+(c.totalBuy||0)).toFixed(0)+' '+currency;
  document.getElementById('cs-debt').textContent  = debt>0 ? debt.toFixed(2)+' '+currency : 'لا ديون';
  document.getElementById('cs-debt').style.color  = debt>0 ? 'var(--red)' : 'var(--green)';

  // فواتير العميل
  const custSales = filterByBranch(S.sales||{})
    .filter(([,s])=>s.customerId===id||s.custId===id)
    .sort(([,a],[,b])=>new Date(b.date||0)-new Date(a.date||0));
  document.getElementById('cs-inv-count').textContent = custSales.length;

  const invTbl = document.getElementById('cs-inv-tbl');
  invTbl.innerHTML = custSales.length ? custSales.map(([sid,s])=>{
    const bal  = +s.balance||0;
    const stMap= {paid:'<span class="badge badge-success">مدفوع</span>',partial:'<span class="badge badge-warning">جزئي</span>',unpaid:'<span class="badge badge-danger">غير مدفوع</span>'};
    return `<tr style="border-bottom:1px solid var(--border2);">
      <td style="padding:9px 12px;font-weight:700;color:var(--accent);">#${sid.slice(-5).toUpperCase()}</td>
      <td style="padding:9px 12px;color:var(--text2);font-size:11px;">${fDateShort(s.date)||'—'}</td>
      <td style="padding:9px 12px;font-size:11px;">${getBranchName(s.branchId)||s.branchName||'—'}</td>
      <td style="padding:9px 12px;font-weight:700;">${(+s.total||0).toFixed(2)} ${currency}</td>
      <td style="padding:9px 12px;color:var(--green);">${(+s.amountPaid||+s.systemAmount||0).toFixed(2)} ${currency}</td>
      <td style="padding:9px 12px;color:${bal>0?'var(--red)':'var(--text2)'};font-weight:${bal>0?'700':'400'};">${bal>0?bal.toFixed(2)+' '+currency:'—'}</td>
      <td style="padding:9px 12px;">${stMap[s.status]||stMap.unpaid}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--text2);">لا توجد فواتير</td></tr>';

  // مرتجعات العميل
  const custRets = Object.entries(S.returns||{})
    .filter(([,r])=>r.type==='sale'&&r.customerId===id)
    .sort(([,a],[,b])=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  document.getElementById('cs-ret-count').textContent = custRets.length;

  const retTbl = document.getElementById('cs-ret-tbl');
  retTbl.innerHTML = custRets.length ? custRets.map(([rid,r])=>`
    <tr style="border-bottom:1px solid var(--border2);">
      <td style="padding:9px 12px;font-weight:700;color:var(--red);">#${rid.slice(-5).toUpperCase()}</td>
      <td style="padding:9px 12px;font-size:11px;color:var(--text2);">${fDateShort(r.date)||'—'}</td>
      <td style="padding:9px 12px;font-weight:700;color:var(--red);">${(+r.total||0).toFixed(2)} ${currency}</td>
      <td style="padding:9px 12px;"><span class="badge badge-info" style="font-size:10px;">${RETURN_REASONS[r.reason]||r.reason||'—'}</span></td>
    </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;padding:14px;color:var(--text2);">لا توجد مرتجعات</td></tr>';

  // أزرار
  document.getElementById('cs-stmt-btn').onclick = ()=>{ closeModal('modal-cust-search'); openStatement('customer',id); };
  document.getElementById('cs-edit-btn').onclick = ()=>{ closeModal('modal-cust-search'); editCust(id); };
  document.getElementById('cs-ret-btn').onclick  = ()=>{ closeModal('modal-cust-search'); nav('returns'); setTimeout(()=>openAddReturn(),200); };
  const payBtn = document.getElementById('cs-pay-btn');
  if(debt>0){ payBtn.style.display=''; payBtn.onclick=()=>{ closeModal('modal-cust-search'); openPayDebt('cust',id); }; }
  else       { payBtn.style.display='none'; }

  document.getElementById('cs-profile').style.display = 'block';
}

// ─── تسديد الدين ─────────────────────────────────────────
function openPayDebt(type, refId) {
  document.getElementById('pd-type').value   = type;
  document.getElementById('pd-ref-id').value = refId;
  document.getElementById('pd-amount').value = '';
  document.getElementById('pd-notes').value  = '';
  const currency = S.settings?.general?.currency||'EGP';
  const infoEl = document.getElementById('pay-debt-info');

  if(type==='cust'){
    const c = (S.customers||{})[refId];
    const debt = +c?.balance||0;
    infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-weight:700;font-size:14px;">${c?.name||'—'}</div><div style="font-size:12px;color:var(--text2);">دين مستحق التحصيل</div></div>
      <div style="font-size:20px;font-weight:900;color:var(--red);">${debt.toFixed(2)} ${currency}</div>
    </div>`;
    document.getElementById('pd-amount').value = debt>0 ? debt.toFixed(2) : '';
  } else if(type==='sup'){
    const s = (S.suppliers||{})[refId];
    const debt = filterByBranch(S.purchaseOrders||{}).filter(([,p])=>p.supplierId===refId).reduce((ss,[,p])=>ss+(+p.balance||0),0);
    infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-weight:700;font-size:14px;">${s?.name||'—'}</div><div style="font-size:12px;color:var(--text2);">ديننا للمورد</div></div>
      <div style="font-size:20px;font-weight:900;color:var(--yellow);">${debt.toFixed(2)} ${currency}</div>
    </div>`;
    document.getElementById('pd-amount').value = debt>0 ? debt.toFixed(2) : '';
  } else if(type==='sale'){
    const sale = (S.sales||{})[refId];
    const bal  = +sale?.balance||0;
    infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:700;font-size:14px;">${sale?.customer||sale?.custName||'—'}</div>
        <div style="font-size:12px;color:var(--text2);">فاتورة #${(sale?.invNumber||refId.slice(-5)).toUpperCase()}</div>
      </div>
      <div style="font-size:20px;font-weight:900;color:var(--red);">${bal.toFixed(2)} ${currency}</div>
    </div>`;
    document.getElementById('pd-amount').value = bal>0 ? bal.toFixed(2) : '';
  }

  populatePdCashbox();
  const hint=document.getElementById('pd-cashbox-hint');
  if(hint){
    hint.innerHTML = type==='sup'
      ? '<i class="fas fa-arrow-circle-down" style="color:var(--red);"></i> سيُخصم المبلغ من الخزينة المختارة ويُسجَّل مصروفاً باسم المورد.'
      : '<i class="fas fa-arrow-circle-up" style="color:var(--green);"></i> سيُودَع المبلغ في الخزينة المختارة ويظهر في تقفيلة الوردية وكشف حساب العميل.';
  }
  openModal('modal-pay-debt');
}

// خزائن الفرع الحالي فقط (الأدمن يرى الكل)
function populatePdCashbox(){
  const el=document.getElementById('pd-cashbox'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  const myBranch=CURRENT_USER?.branch||'';
  const list=Object.entries(S.cashboxes||{}).filter(([,cb])=>
    cb.status!=='disabled' && (!myBranch||CURRENT_USER?.role==='admin'||cb.branchId===myBranch||!cb.branchId));
  el.innerHTML='<option value="">-- اختر الخزينة --</option>'+
    list.map(([id,cb])=>`<option value="${id}">${cb.name} (${(+cb.balance||0).toFixed(2)} ${currency})</option>`).join('');
  // خزينة واحدة فقط؟ نختارها تلقائياً حتى لا نُثقل الكاشير بخطوة بلا بديل
  if(list.length===1) el.value=list[0][0];
}

async function saveDebtPayment() {
  const type   = document.getElementById('pd-type').value;
  const refId  = document.getElementById('pd-ref-id').value;
  const amount = parseFloat(document.getElementById('pd-amount').value)||0;
  const notes  = document.getElementById('pd-notes').value;
  const method = document.getElementById('pd-method')?.value||'cash';
  const cbId   = document.getElementById('pd-cashbox')?.value||'';
  if(!amount||amount<=0){ toast('يرجى إدخال مبلغ صحيح','error'); return; }

  // الخزينة إلزامية: بدونها كان المبلغ يختفي — يُنقَص الدين ولا يدخل النظام قرش
  if(!cbId){
    const sel=document.getElementById('pd-cashbox');
    toast('اختر الخزينة أولاً — لا يمكن تسجيل دفعة بدون خزينة','error');
    if(sel){ sel.focus(); const p=sel.style.borderColor; sel.style.borderColor='var(--red)';
             setTimeout(()=>sel.style.borderColor=p,1800); }
    return;
  }

  const btn=document.querySelector('#modal-pay-debt .btn-success');
  if(btn){ btn.disabled=true; btn.style.opacity='.6'; }

  try {
    if(type==='cust'){
      const c = (S.customers||{})[refId]; if(!c) return;
      const debtNow = +c.balance||0;
      if(amount>debtNow+0.01){
        const ok=await confirm2(
          `المبلغ (${amount.toFixed(2)}) أكبر من الدين المستحق (${debtNow.toFixed(2)}). سيُسجَّل الفائض رصيداً للعميل.`,
          'مبلغ أكبر من الدين','⚠️','متابعة','btn-warning');
        if(!ok){ if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
      }
      const newBal = Math.max(0,debtNow-amount);
      await dbUpdate('customers/'+refId,{
        balance: newBal,
        lastDebtPaidAt: new Date().toISOString(),
        lastDebtPaidBy: CURRENT_USER?.name||''
      });
      // تسديد الفواتير المرتبطة — الأقدم أولاً، ونحتفظ بما سُدِّد لكل فاتورة
      let remaining = amount;
      const allocations=[];
      const unpaidSales = filterByBranch(S.sales||{})
        .filter(([,s])=>(s.customerId===refId||s.custId===refId)&&(+s.balance||0)>0)
        .sort(([,a],[,b])=>new Date(a.date||0)-new Date(b.date||0));
      for(const [sid,s] of unpaidSales){
        if(remaining<=0) break;
        const pay = Math.min(remaining, +s.balance||0);
        if(pay>0){
          const newSaleBal = Math.max(0,(+s.balance||0)-pay);
          await dbUpdate('sales/'+sid,{
            balance:newSaleBal,
            amountPaid:(+s.amountPaid||0)+pay,
            status: newSaleBal<=0?'paid':'partial'
          });
          allocations.push({ saleId:sid, invNumber:s.invNumber||sid.slice(-6).toUpperCase(), amount:pay });
          remaining -= pay;
        }
      }
      await recordPayment({
        kind:'cust_collect', partyType:'customer', partyId:refId, partyName:c.name||'',
        amount, cashboxId:cbId, method, notes, allocations,
        extra:{ balReduced: debtNow-newBal },   // اللي اتشال فعلاً من الدين — لإلغاء السداد
      });
      toast(`تم تحصيل ${amount.toFixed(2)} من ${c.name} وإيداعها في الخزينة ✅`);
    } else if(type==='sup'){
      // تحديث أوامر الشراء المستحقة تسلسلياً
      let remaining = amount;
      const allocations=[];
      const unpaidPOs = Object.entries(S.purchaseOrders||{})
        .filter(([,p])=>p.supplierId===refId&&(+p.balance||0)>0)
        .sort(([,a],[,b])=>new Date(a.date||0)-new Date(b.date||0));
      for(const [pid,p] of unpaidPOs){
        if(remaining<=0) break;
        const pay = Math.min(remaining, +p.balance||0);
        if(pay>0){
          const newBal = Math.max(0,(+p.balance||0)-pay);
          await dbUpdate('purchaseOrders/'+pid,{
            balance: newBal,
            amountPaid: (+p.amountPaid||0)+pay,
            // payStatus منفصل عن status (حالة الاستلام) حتى لا يمحو السدادُ حالةَ الأمر
            payStatus: newBal<=0?'completed':'partial',
            updatedAt: new Date().toISOString()
          });
          allocations.push({ poId:pid, poNumber:p.poNumber||pid.slice(-6).toUpperCase(), amount:pay });
          remaining -= pay;
        }
      }
      const supName = (S.suppliers||{})[refId]?.name||'المورد';

      const payId = await recordPayment({
        kind:'sup_settle', partyType:'supplier', partyId:refId, partyName:supName,
        amount, cashboxId:cbId, method, notes, allocations,
      });

      // يُسجَّل مصروفاً كذلك ليظهر في المالية والتقارير وتقفيلة الوردية
      await dbSet('expenses/'+uid(),{
        desc:`سداد مورد — ${supName}`,
        amount,
        category:'suppliers',
        branchId: CURRENT_USER?.branch||'',
        cashboxId: cbId,
        paymentId: payId,          // رابط بين المصروف والدفعة يمنع ازدواج القراءة
        supplierId: refId,
        autoGenerated: true,       // لم يُدخله المستخدم يدوياً
        createdBy: CURRENT_USER?.id, createdByName: CURRENT_USER?.name||'',
        createdAt: new Date().toISOString(),
        ...shiftStamp(),
      });

      toast(`تم سداد ${amount.toFixed(2)} لـ ${supName} — خُصمت من الخزينة وسُجِّلت مصروفاً ✅`);
    } else if(type==='sale'){
      const sale = (S.sales||{})[refId]; if(!sale) return;
      const newBal  = Math.max(0,(+sale.balance||0)-amount);
      const newPaid = (+sale.amountPaid||0)+amount;
      await dbUpdate('sales/'+refId,{
        balance:newBal, amountPaid:newPaid,
        status: newBal<=0?'paid':'partial'
      });
      // تحديث رصيد العميل إن وُجد
      const custId = sale.customerId||sale.custId;
      let balReduced=0;
      if(custId && (S.customers||{})[custId]){
        const c = S.customers[custId];
        const newCustBal=Math.max(0,(+c.balance||0)-amount);
        balReduced=(+c.balance||0)-newCustBal;
        await dbUpdate('customers/'+custId,{ balance: newCustBal });
      }
      await recordPayment({
        kind:'sale_collect', partyType:'customer',
        partyId: custId||'', partyName: sale.customer||sale.custName||'عميل نقدي',
        amount, cashboxId:cbId, method, notes,
        allocations:[{ saleId:refId, invNumber:sale.invNumber||refId.slice(-6).toUpperCase(), amount }],
        refId,
        extra:{ balReduced },   // اللي اتشال فعلاً من دين العميل — لإلغاء السداد
      });
      toast(`تم تحصيل ${amount.toFixed(2)} وإيداعها في الخزينة ✅`);
    }
    closeModal('modal-pay-debt');
  } catch(e){ toast('خطأ: '+e.message,'error'); }
  finally { if(btn){ btn.disabled=false; btn.style.opacity='1'; } }
}

