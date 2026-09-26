// ============================================================
// DEBTS — إدارة الديون
// ============================================================
function renderDebts() {
  renderDebtsStats();
  renderDebtsCust();
  renderDebtsSup();
  renderDebtsUnpaidSales();
  renderDebtsBranchReport();
  populateDebtsFilters();
}

function debtsTab(tab) {
  ['cust','sup','sales','report'].forEach(t=>{
    document.getElementById('dbt-tab-'+t)?.classList.toggle('active', t===tab);
    document.getElementById('dbt-panel-'+t)?.classList.toggle('active', t===tab);
  });
}

function populateDebtsFilters() {
  const branches = '<option value="">كل الفروع</option>' +
    Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
  ['dbt-cust-branch','dbt-sup-branch','dbt-sales-branch'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    const cur = el.value;
    el.innerHTML = branches;
    el.value = cur;
  });
}

function renderDebtsStats() {
  const currency = S.settings?.general?.currency||'EGP';
  const custDebt = filterByBranch(S.customers||{}).reduce((s,[,c])=>s+(+c.balance||0),0);
  const supDebt  = filterByBranch(S.purchaseOrders||{}).reduce((s,[,p])=>s+(+p.balance||0),0);
  const net      = custDebt - supDebt;
  const unpaidCount = filterByBranch(S.sales||{}).filter(([,s])=>(+s.balance||0)>0).length;

  const el = id => document.getElementById(id);
  if(el('debts-cust-total'))   { el('debts-cust-total').textContent   = custDebt.toFixed(0)+' '+currency; }
  if(el('debts-sup-total'))    { el('debts-sup-total').textContent    = supDebt.toFixed(0)+' '+currency; }
  if(el('debts-net-total'))    {
    el('debts-net-total').textContent  = net.toFixed(0)+' '+currency;
    el('debts-net-total').style.color  = net>=0?'var(--green)':'var(--red)';
  }
  if(el('debts-unpaid-count')) { el('debts-unpaid-count').textContent = unpaidCount; }
}

function renderDebtsCust() {
  const tbody   = document.getElementById('debts-cust-tbl'); if(!tbody) return;
  const currency= S.settings?.general?.currency||'EGP';
  const search  = (document.getElementById('dbt-cust-search')?.value||'').toLowerCase();
  const branchF = document.getElementById('dbt-cust-branch')?.value||'';
  const sort    = document.getElementById('dbt-cust-sort')?.value||'amount';

  // حساب عدد الفواتير وآخر تاريخ لكل عميل
  const custMeta = {};
  Object.values(S.sales||{}).filter(s=>(+s.balance||0)>0).forEach(s=>{
    const k = s.customerId||s.custId; if(!k) return;
    if(!custMeta[k]) custMeta[k] = { count:0, lastDate:'' };
    custMeta[k].count++;
    if(!custMeta[k].lastDate || s.date > custMeta[k].lastDate) custMeta[k].lastDate = s.date;
  });

  let rows = filterByBranch(S.customers||{}).filter(([,c])=>(+c.balance||0)>0).filter(([id,c])=>{
    return (!search || (c.name||'').toLowerCase().includes(search) || (c.phone||'').includes(search))
      && (!branchF || c.branchId===branchF);
  });

  // ترتيب
  if(sort==='amount') rows.sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0));
  else if(sort==='name') rows.sort(([,a],[,b])=>(a.name||'').localeCompare(b.name||''));
  else rows.sort(([a],[b])=>{
    const da = custMeta[a]?.lastDate||''; const db = custMeta[b]?.lastDate||'';
    return da.localeCompare(db);
  });

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--green);">
      <i class="fas fa-check-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
      لا توجد ديون للعملاء 🎉</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(([id,c])=>{
    const meta   = custMeta[id]||{count:0,lastDate:''};
    const branch = getBranchName(c.branchId)||'—';
    const debt   = +c.balance||0;
    // نسبة الخطورة بالألوان
    const debtColor = debt>5000?'var(--red)': debt>1000?'var(--yellow)':'var(--accent)';
    return `<tr>
      <td>
        <div style="font-weight:700;">${c.name||'—'}</div>
        <div style="font-size:10px;color:var(--text3);">${id.slice(-6).toUpperCase()}</div>
      </td>
      <td style="font-size:11px;">${branch}</td>
      <td>${c.phone||'—'}</td>
      <td>
        <div style="font-size:16px;font-weight:900;color:${debtColor};">${debt.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text3);">${currency}</div>
      </td>
      <td style="text-align:center;">
        <span class="badge badge-warning">${meta.count||0} فاتورة</span>
      </td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(meta.lastDate)||'—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-success btn-sm" onclick="openPayDebt('cust','${id}')">
          <i class="fas fa-hand-holding-usd"></i> تحصيل
        </button>
        <button class="btn btn-ghost btn-xs" onclick="openStatement('customer','${id}')" title="كشف حساب شامل" style="margin-right:4px;color:var(--accent);border-color:var(--accent);">
          <i class="fas fa-file-invoice-dollar"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="openCustProfile('${id}')" title="الملف الشامل" style="margin-right:4px;">
          <i class="fas fa-id-card"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderDebtsSup() {
  const tbody   = document.getElementById('debts-sup-tbl'); if(!tbody) return;
  const currency= S.settings?.general?.currency||'EGP';
  const search  = (document.getElementById('dbt-sup-search')?.value||'').toLowerCase();
  const branchF = document.getElementById('dbt-sup-branch')?.value||'';

  // تجميع الديون بالمورد
  const supMap = {};
  filterByBranch(S.purchaseOrders||{}).filter(([,p])=>(+p.balance||0)>0).forEach(([id,p])=>{
    const k = p.supplierId||id;
    if(!supMap[k]) supMap[k] = {
      name: p.supplierName||'—', debt:0,
      count:0, lastDate:'',
      phone: (S.suppliers||{})[p.supplierId]?.phone||'',
      branchId: p.branchId||'',
    };
    supMap[k].debt  += +p.balance||0;
    supMap[k].count++;
    if(!supMap[k].lastDate||p.date>supMap[k].lastDate) supMap[k].lastDate=p.date;
    if((S.suppliers||{})[p.supplierId]?.phone) supMap[k].phone=(S.suppliers||{})[p.supplierId].phone;
  });

  let rows = Object.entries(supMap).filter(([,d])=>{
    return (!search||(d.name||'').toLowerCase().includes(search)||(d.phone||'').includes(search))
      && (!branchF||d.branchId===branchF);
  }).sort(([,a],[,b])=>b.debt-a.debt);

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--green);">
      <i class="fas fa-check-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
      لا توجد ديون للموردين 🎉</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(([k,d])=>{
    const branch = getBranchName(d.branchId)||'—';
    const debtColor = d.debt>5000?'var(--red)': d.debt>1000?'var(--yellow)':'var(--accent)';
    return `<tr>
      <td><strong>${d.name||'—'}</strong></td>
      <td style="font-size:11px;">${branch}</td>
      <td>${d.phone||'—'}</td>
      <td>
        <div style="font-size:16px;font-weight:900;color:${debtColor};">${d.debt.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text3);">${currency}</div>
      </td>
      <td style="text-align:center;"><span class="badge badge-warning">${d.count} أمر</span></td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(d.lastDate)||'—'}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="openPayDebt('sup','${k}')">
          <i class="fas fa-hand-holding-usd"></i> سداد
        </button>
        <button class="btn btn-ghost btn-xs" onclick="openStatement('supplier','${k}')" title="كشف حساب شامل" style="margin-right:4px;color:var(--accent);border-color:var(--accent);">
          <i class="fas fa-file-invoice-dollar"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderDebtsUnpaidSales() {
  const tbody   = document.getElementById('debts-sales-tbl'); if(!tbody) return;
  const currency= S.settings?.general?.currency||'EGP';
  const search  = (document.getElementById('dbt-sales-search')?.value||'').toLowerCase();
  const from    = document.getElementById('dbt-sales-from')?.value||'';
  const to      = document.getElementById('dbt-sales-to')?.value||'';
  const branchF = document.getElementById('dbt-sales-branch')?.value||'';
  const statusF = document.getElementById('dbt-sales-status')?.value||'';

  const rows = filterByBranch(S.sales||{}).filter(([,s])=>{
    if(!(+s.balance||0)>0) return false;
    const d = (s.date||s.createdAt||'').slice(0,10);
    const cust = (s.customer||s.custName||s.customerName||'').toLowerCase();
    return (!search||cust.includes(search)||(s.invNumber||'').toLowerCase().includes(search))
      && (!from||d>=from) && (!to||d<=to)
      && (!branchF||s.branchId===branchF)
      && (!statusF||s.status===statusF);
  }).sort(([,a],[,b])=>new Date(b.date||0)-new Date(a.date||0));

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--green);">
      <i class="fas fa-check-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>
      جميع الفواتير مسددة 🎉</td></tr>`;
    return;
  }

  const stMap = {
    partial: '<span class="badge badge-warning">جزئي</span>',
    unpaid:  '<span class="badge badge-danger">غير مدفوع</span>',
  };

  tbody.innerHTML = rows.map(([id,s])=>{
    const bal    = +s.balance||0;
    const paid   = +s.amountPaid||+s.systemAmount||0;
    const branch = getBranchName(s.branchId)||s.branchName||'—';
    return `<tr>
      <td style="color:var(--accent);font-weight:700;">#${(s.invNumber||id.slice(-5)).toUpperCase()}</td>
      <td style="font-size:11px;color:var(--text2);">${fDateShort(s.date||s.createdAt)||'—'}</td>
      <td>
        <div style="font-weight:600;">${s.customer||s.custName||s.customerName||'نقدي'}</div>
        ${s.customerId?`<div style="font-size:10px;color:var(--text3);">${s.customerId.slice(-6).toUpperCase()}</div>`:''}
      </td>
      <td style="font-size:11px;">${branch}</td>
      <td style="font-weight:700;">${(+s.total||0).toFixed(2)} ${currency}</td>
      <td style="color:var(--green);">${paid.toFixed(2)} ${currency}</td>
      <td style="color:var(--red);font-weight:700;">${bal.toFixed(2)} ${currency}</td>
      <td>${stMap[s.status]||stMap.unpaid}</td>
      <td>
        <button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}')">
          <i class="fas fa-hand-holding-usd"></i> تحصيل
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderDebtsBranchReport() {
  const tbody   = document.getElementById('debts-branch-tbl'); if(!tbody) return;
  const currency= S.settings?.general?.currency||'EGP';

  // تجميع بيانات كل فرع
  const map = {};
  // ديون عملاء
  filterByBranch(S.customers||{}).map(([,v])=>v).filter(c=>(+c.balance||0)>0).forEach(c=>{
    const k = c.branchId||'__none__';
    if(!map[k]) map[k]={ custDebt:0, supDebt:0, debtors:0 };
    map[k].custDebt += +c.balance||0;
    map[k].debtors++;
  });
  // ديون موردين
  filterByBranch(S.purchaseOrders||{}).map(([,v])=>v).filter(p=>(+p.balance||0)>0).forEach(p=>{
    const k = p.branchId||'__none__';
    if(!map[k]) map[k]={ custDebt:0, supDebt:0, debtors:0 };
    map[k].supDebt += +p.balance||0;
  });

  if(!Object.keys(map).length){
    tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--green);">لا توجد ديون في أي فرع 🎉</td></tr>`;
    return;
  }

  tbody.innerHTML = Object.entries(map).sort(([,a],[,b])=>b.custDebt-a.custDebt).map(([bid,d])=>{
    const branchName = bid==='__none__'?'غير محدد':getBranchName(bid)||bid;
    const net = d.custDebt - d.supDebt;
    return `<tr>
      <td><strong>${branchName}</strong></td>
      <td style="color:var(--red);font-weight:700;">${d.custDebt.toFixed(2)} ${currency}</td>
      <td style="color:var(--yellow);font-weight:700;">${d.supDebt.toFixed(2)} ${currency}</td>
      <td style="color:${net>=0?'var(--green)':'var(--red)'};font-weight:700;">${net.toFixed(2)} ${currency}</td>
      <td style="text-align:center;"><span class="badge badge-danger">${d.debtors}</span></td>
    </tr>`;
  }).join('');
}

