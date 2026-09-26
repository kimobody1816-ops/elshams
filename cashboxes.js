// ============================================================
// CASHBOXES — إدارة الخزائن
// ============================================================
const CB_TYPES = { cash:'نقدي 💵', bank:'بنكي 🏦', transfer:'تحويل 📲', card:'بطاقة 💳' };
let editingCb = null;

function renderCashboxes() {
  renderCbStats();
  renderCbGrid();
  renderCashboxLog();
  populateCbLogFilter();
}

function renderCbStats() {
  const currency = S.settings?.general?.currency||'EGP';
  const cbs = Object.values(S.cashboxes||{});
  const total = cbs.reduce((s,c)=>s+(+c.balance||0),0);
  const bank  = cbs.filter(c=>c.type==='bank').reduce((s,c)=>s+(+c.balance||0),0);
  const today = new Date().toISOString().slice(0,10);
  const todayMoves = Object.values(S.cashboxLog||{}).filter(l=>(l.date||l.createdAt||'').slice(0,10)===today).length;

  const el = id=>document.getElementById(id);
  if(el('cb-stat-count')) el('cb-stat-count').textContent = cbs.length;
  if(el('cb-stat-total')) el('cb-stat-total').textContent = total.toFixed(0)+' '+currency;
  if(el('cb-stat-bank'))  el('cb-stat-bank').textContent  = bank.toFixed(0)+' '+currency;
  if(el('cb-stat-moves')) el('cb-stat-moves').textContent = todayMoves;
}

function renderCbGrid() {
  const grid = document.getElementById('cashbox-grid'); if(!grid) return;
  const currency = S.settings?.general?.currency||'EGP';
  const cbs = filterByBranch(S.cashboxes||{});
  if(!cbs.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2);">
      <i class="fas fa-vault" style="font-size:40px;opacity:.3;display:block;margin-bottom:12px;"></i>
      لا توجد خزائن — أضف خزينة جديدة</div>`;
    return;
  }
  grid.innerHTML = cbs.map(([id,cb])=>{
    const bal = +cb.balance||0;
    const typeClass = cb.type==='bank'?'type-bank':cb.type==='card'?'type-card':cb.type==='transfer'?'type-transfer':'';
    // آخر 3 حركات لهذه الخزينة
    const lastMoves = Object.values(S.cashboxLog||{})
      .filter(l=>l.cbId===id)
      .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
      .slice(0,3);
    const movesHtml = lastMoves.length ? lastMoves.map(l=>`
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2);padding:2px 0;border-top:1px solid var(--border2);">
        <span style="color:${l.type==='deposit'?'var(--green)':'var(--red)'};">${l.type==='deposit'?'+':'-'}${(+l.amount||0).toFixed(0)}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;">${l.desc||'—'}</span>
        <span>${(l.date||l.createdAt||'').slice(5,10)}</span>
      </div>`).join('') : '';
    return `<div class="cashbox-card ${typeClass}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div>
          <div class="cashbox-name">${cb.name}</div>
          <div class="cashbox-type"><span class="badge badge-info">${CB_TYPES[cb.type]||cb.type||'نقدي'}</span>
          ${cb.branchId?`<span class="badge" style="background:var(--accent-bg);color:var(--accent);margin-right:4px;">${getBranchName(cb.branchId)||''}</span>`:''}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="openCashboxTx('deposit','${id}')" title="إيداع"><i class="fas fa-plus" style="color:var(--green);"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="openCashboxTx('withdraw','${id}')" title="صرف"><i class="fas fa-minus" style="color:var(--red);"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="editCb('${id}')" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delCb('${id}')" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="cashbox-balance ${bal<0?'negative':''}">${bal.toFixed(2)} ${currency}</div>
      ${cb.notes?`<div style="font-size:11px;color:var(--text2);margin-bottom:6px;">${cb.notes}</div>`:''}
      ${movesHtml?`<div style="margin-top:6px;">${movesHtml}</div>`:''}
    </div>`;
  }).join('');
}

function renderCashboxLog() {
  const tbody = document.getElementById('cashbox-log'); if(!tbody) return;
  const currency  = S.settings?.general?.currency||'EGP';
  const cbFilter  = document.getElementById('cblog-filter-cb')?.value||'';
  const typeFilter= document.getElementById('cblog-filter-type')?.value||'';
  const from      = document.getElementById('cblog-from')?.value||'';
  const to        = document.getElementById('cblog-to')?.value||'';

  const rows = filterByBranch(S.cashboxLog||{}).filter(([,l])=>{
    const d = (l.date||l.createdAt||'').slice(0,10);
    return (!cbFilter  || l.cbId===cbFilter)
      && (!typeFilter || l.type===typeFilter)
      && (!from || d>=from) && (!to || d<=to);
  }).sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0)).slice(0,100);

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2);">لا توجد حركات</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(([,l])=>{
    const typeMap = {
      deposit:  `<span class="badge badge-success">إيداع</span>`,
      withdraw: `<span class="badge badge-danger">صرف</span>`,
      transfer: `<span class="badge badge-purple">تحويل</span>`,
    };
    const amtColor = l.type==='deposit'?'var(--green)':'var(--red)';
    const amtSign  = l.type==='deposit'?'+':'-';
    const cbName   = (S.cashboxes||{})[l.cbId]?.name || l.cbName || '—';
    const branch   = getBranchName((S.cashboxes||{})[l.cbId]?.branchId)||'—';
    return `<tr>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(l.date||l.createdAt)||'—'}</td>
      <td><strong>${cbName}</strong></td>
      <td style="font-size:11px;">${branch}</td>
      <td>${typeMap[l.type]||typeMap.deposit}</td>
      <td style="color:${amtColor};font-weight:700;">${amtSign}${(+l.amount||0).toFixed(2)} ${currency}</td>
      <td style="color:var(--text2);font-size:11px;">${l.balanceAfter!=null?(+l.balanceAfter).toFixed(2)+' '+currency:'—'}</td>
      <td style="font-size:12px;">${l.desc||'—'}</td>
      <td style="font-size:11px;color:var(--text2);">${l.createdByName||l.createdBy||'—'}</td>
    </tr>`;
  }).join('');
}

function populateCbLogFilter() {
  const sel = document.getElementById('cblog-filter-cb'); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الخزائن</option>' +
    Object.entries(S.cashboxes||{}).map(([id,cb])=>`<option value="${id}">${cb.name}</option>`).join('');
  sel.value = cur;
}

function openAddCashbox() {
  editingCb = null;
  document.getElementById('cb-modal-title').textContent = 'خزينة جديدة';
  document.getElementById('cbf-name').value    = '';
  document.getElementById('cbf-type').value    = 'cash';
  document.getElementById('cbf-balance').value = '0';
  document.getElementById('cbf-notes').value   = '';
  populateBranchSelect('cbf-branch', CURRENT_USER?.branch||'');
  openModal('modal-cashbox');
}

function editCb(id) {
  editingCb = id;
  const cb = (S.cashboxes||{})[id]; if(!cb) return;
  document.getElementById('cb-modal-title').textContent = 'تعديل خزينة';
  document.getElementById('cbf-name').value    = cb.name||'';
  document.getElementById('cbf-type').value    = cb.type||'cash';
  document.getElementById('cbf-balance').value = cb.balance||0;
  document.getElementById('cbf-notes').value   = cb.notes||'';
  populateBranchSelect('cbf-branch', cb.branchId||'');
  openModal('modal-cashbox');
}

async function saveCashbox() {
  const name = (document.getElementById('cbf-name')?.value||'').trim();
  if(!name){ toast('يرجى إدخال اسم الخزينة','error'); return; }
  const branchId = document.getElementById('cbf-branch')?.value||'';
  const data = {
    name,
    type:     document.getElementById('cbf-type').value,
    balance:  parseFloat(document.getElementById('cbf-balance').value)||0,
    notes:    document.getElementById('cbf-notes').value.trim(),
    branchId,
    branchName: getBranchName(branchId)||'',
    updatedAt: new Date().toISOString(),
  };
  try {
    if(editingCb){ await dbUpdate('cashboxes/'+editingCb, data); }
    else { data.createdAt=new Date().toISOString(); await dbSet('cashboxes/'+uid(), data); }
    closeModal('modal-cashbox');
    toast(editingCb?'تم تعديل الخزينة ✅':'تم إضافة الخزينة ✅');
    editingCb = null;
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function delCb(id) {
  const cb = (S.cashboxes||{})[id];
  const ok = await confirm2(`حذف الخزينة "${cb?.name}"؟ سيُحذف سجل حركاتها أيضاً.`,'حذف خزينة','🗑️','حذف','btn-danger');
  if(!ok) return;
  try {
    await dbRemove('cashboxes/'+id);
    // حذف الحركات المرتبطة
    const logEntries = Object.entries(S.cashboxLog||{}).filter(([,l])=>l.cbId===id);
    for(const [lid] of logEntries) await dbRemove('cashboxLog/'+lid);
    toast('تم حذف الخزينة');
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

function openCashboxTx(type, cbId='') {
  document.getElementById('cbtx-type').value = type;
  const isDeposit = type==='deposit';
  document.getElementById('cbtx-title').innerHTML =
    `<i class="fas fa-${isDeposit?'plus':'minus'}-circle" style="color:var(--${isDeposit?'green':'red'})"></i> ${isDeposit?'إيداع في خزينة':'صرف من خزينة'}`;
  const btn = document.getElementById('cbtx-btn');
  btn.className = `btn btn-${isDeposit?'success':'danger'}`;
  btn.innerHTML = `<i class="fas fa-save"></i> ${isDeposit?'إيداع':'صرف'}`;

  const sel = document.getElementById('cbtx-cb');
  sel.innerHTML = Object.entries(S.cashboxes||{}).map(([id,cb])=>
    `<option value="${id}" ${id===cbId?'selected':''}>${cb.name} — ${(+cb.balance||0).toFixed(2)}</option>`).join('');
  document.getElementById('cbtx-amount').value = '';
  document.getElementById('cbtx-desc').value   = '';
  document.getElementById('cbtx-date').value   = new Date().toISOString().slice(0,10);
  updateCbtxBalance();
  openModal('modal-cashbox-tx');
}

function updateCbtxBalance() {
  const cbId = document.getElementById('cbtx-cb')?.value;
  const cb   = (S.cashboxes||{})[cbId];
  const info = document.getElementById('cbtx-balance-info');
  const balEl= document.getElementById('cbtx-cur-balance');
  const currency = S.settings?.general?.currency||'EGP';
  if(cb && info && balEl){
    info.style.display = 'block';
    balEl.textContent  = (+(cb.balance||0)).toFixed(2)+' '+currency;
    balEl.style.color  = (+cb.balance||0)>=0?'var(--green)':'var(--red)';
  } else if(info){ info.style.display='none'; }
}

async function saveCashboxTx() {
  const cbId   = document.getElementById('cbtx-cb')?.value;
  const amount = parseFloat(document.getElementById('cbtx-amount')?.value)||0;
  const type   = document.getElementById('cbtx-type')?.value||'deposit';
  const desc   = (document.getElementById('cbtx-desc')?.value||'').trim();
  const date   = document.getElementById('cbtx-date')?.value||new Date().toISOString().slice(0,10);
  if(!cbId)    { toast('يرجى اختيار خزينة','error'); return; }
  if(amount<=0){ toast('يرجى إدخال مبلغ صحيح','error'); return; }
  const cb = (S.cashboxes||{})[cbId];
  if(!cb){ toast('الخزينة غير موجودة','error'); return; }
  if(type==='withdraw'&&(+cb.balance||0)<amount){ toast('رصيد الخزينة غير كافٍ','error'); return; }
  try {
    const newBal = (+cb.balance||0) + (type==='deposit'?amount:-amount);
    await dbUpdate('cashboxes/'+cbId, { balance:newBal, updatedAt:new Date().toISOString() });
    await dbPush('cashboxLog', {
      cbId, cbName:cb.name, type, amount, desc, date,
      balanceAfter: newBal,
      branchId: cb.branchId||'',
      createdAt: new Date().toISOString(),
      createdBy:     CURRENT_USER?.id||'',
      createdByName: CURRENT_USER?.name||CURRENT_USER?.username||'',
    });
    closeModal('modal-cashbox-tx');
    toast(type==='deposit'?'تم الإيداع بنجاح ✅':'تم الصرف بنجاح ✅');
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

// ─── تحويل بين خزينتين ───────────────────────────────────
function openTransferBetween() {
  const cbs = filterByBranch(S.cashboxes||{});
  if(cbs.length<2){ toast('يجب وجود خزينتين على الأقل','warning'); return; }
  const opts = cbs.map(([id,cb])=>`<option value="${id}">${cb.name}</option>`).join('');
  document.getElementById('cbt-from').innerHTML = opts;
  document.getElementById('cbt-to').innerHTML   = opts;
  // اختار خزينة مختلفة للوجهة
  if(cbs.length>=2) document.getElementById('cbt-to').value = cbs[1][0];
  document.getElementById('cbt-amount').value = '';
  document.getElementById('cbt-notes').value  = '';
  updateTransferBalances();
  openModal('modal-cb-transfer');
}

function updateTransferBalances() {
  const currency = S.settings?.general?.currency||'EGP';
  const fromId = document.getElementById('cbt-from')?.value;
  const toId   = document.getElementById('cbt-to')?.value;
  const fromBal= document.getElementById('cbt-from-bal');
  const toBal  = document.getElementById('cbt-to-bal');
  if(fromBal) fromBal.textContent = ((+(S.cashboxes||{})[fromId]?.balance||0)).toFixed(2)+' '+currency;
  if(toBal)   toBal.textContent   = ((+(S.cashboxes||{})[toId]?.balance||0)).toFixed(2)+' '+currency;
}

async function saveCbTransfer() {
  const fromId = document.getElementById('cbt-from')?.value;
  const toId   = document.getElementById('cbt-to')?.value;
  const amount = parseFloat(document.getElementById('cbt-amount')?.value)||0;
  const notes  = (document.getElementById('cbt-notes')?.value||'').trim();
  if(!fromId||!toId){ toast('يرجى اختيار الخزينتين','error'); return; }
  if(fromId===toId)  { toast('لا يمكن التحويل لنفس الخزينة','error'); return; }
  if(amount<=0)      { toast('يرجى إدخال مبلغ صحيح','error'); return; }
  const cbFrom = (S.cashboxes||{})[fromId];
  const cbTo   = (S.cashboxes||{})[toId];
  if(!cbFrom||!cbTo){ toast('خزينة غير موجودة','error'); return; }
  if((+cbFrom.balance||0)<amount){ toast('رصيد الخزينة المصدر غير كافٍ','error'); return; }
  try {
    const newFrom = (+cbFrom.balance||0) - amount;
    const newTo   = (+cbTo.balance||0)   + amount;
    const now = new Date().toISOString();
    const today2 = now.slice(0,10);
    const desc = notes || `تحويل من ${cbFrom.name} إلى ${cbTo.name}`;
    await dbUpdate('cashboxes/'+fromId, { balance:newFrom, updatedAt:now });
    await dbUpdate('cashboxes/'+toId,   { balance:newTo,   updatedAt:now });
    await dbPush('cashboxLog', { cbId:fromId, cbName:cbFrom.name, type:'transfer', amount, desc:`تحويل إلى: ${cbTo.name} — ${desc}`, date:today2, balanceAfter:newFrom, createdAt:now, createdByName:CURRENT_USER?.name||'' });
    await dbPush('cashboxLog', { cbId:toId,   cbName:cbTo.name,   type:'deposit',  amount, desc:`تحويل من: ${cbFrom.name} — ${desc}`, date:today2, balanceAfter:newTo,   createdAt:now, createdByName:CURRENT_USER?.name||'' });
    closeModal('modal-cb-transfer');
    toast(`تم تحويل ${amount.toFixed(2)} من "${cbFrom.name}" إلى "${cbTo.name}" ✅`);
  } catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function addCashboxEntry(cbId, amount, type, desc, ref='') {
  if(!cbId) return;
  const cb = (S.cashboxes||{})[cbId]; if(!cb) return;
  const newBal = (+cb.balance||0) + (type==='deposit'?amount:-amount);
  await dbUpdate('cashboxes/'+cbId, { balance:Math.max(0,newBal), updatedAt:new Date().toISOString() });
  await dbPush('cashboxLog', {
    cbId, cbName:cb.name, type, amount, desc, ref,
    branchId:     cb.branchId||'',
    balanceAfter: Math.max(0,newBal),
    date:         new Date().toISOString().slice(0,10),
    createdAt:    new Date().toISOString(),
    createdByName:CURRENT_USER?.name||'',
    ...shiftStamp(),
  });
}

