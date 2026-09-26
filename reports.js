// ============================================================
// REPORTS — التقارير الشاملة
// ============================================================
function renderReports() {
  populateRepBranchFilter();
  const tab = document.querySelector('#pg-reports .tab-btn.active')?.id?.replace('rep-tab-','') || 'sales';
  repTab(tab, false);
}

function repTab(tab, updateActive=true) {
  if(updateActive){
    document.querySelectorAll('#pg-reports .tab-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('rep-tab-'+tab)?.classList.add('active');
    document.querySelectorAll('#pg-reports .tab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('rep-panel-'+tab)?.classList.add('active');
  }
  const {from,to,branchId} = getRepFilters();
  if(tab==='sales')     renderRepSales(from,to,branchId);
  if(tab==='products')  renderRepProducts(from,to,branchId);
  if(tab==='customers') renderRepCustomers(from,to,branchId);
  if(tab==='purchases') renderRepPurchases(from,to,branchId);
  if(tab==='cashboxes') renderRepCashboxes(from,to,branchId);
  if(tab==='branches')  renderRepBranches(from,to);
}

function getRepFilters() {
  return {
    from:     document.getElementById('rep-from')?.value||'',
    to:       document.getElementById('rep-to')?.value||'',
    branchId: document.getElementById('rep-branch')?.value||'',
  };
}

function setRepRange(range) {
  const now  = new Date();
  const pad  = n=>String(n).padStart(2,'0');
  const fmt  = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  let from='', to=fmt(now);
  if(range==='week'){
    const d=new Date(now); d.setDate(d.getDate()-d.getDay());
    from=fmt(d);
  } else if(range==='month'){
    from=`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
  } else if(range==='year'){
    from=`${now.getFullYear()}-01-01`;
  } else { from=''; to=''; }
  const elF=document.getElementById('rep-from'); const elT=document.getElementById('rep-to');
  if(elF) elF.value=from; if(elT) elT.value=to;
  renderReports();
}

function populateRepBranchFilter() {
  const sel=document.getElementById('rep-branch'); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">كل الفروع</option>'+
    Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
  sel.value=cur;
}

function filterByDate(arr, dateKey, from, to) {
  return arr.filter(([,v])=>{
    const d=(v[dateKey]||v.createdAt||'').slice(0,10);
    return (!from||d>=from)&&(!to||d<=to);
  });
}

// ── تقرير المبيعات ─────────────────────────────────────
function renderRepSales(from,to,branchId) {
  const currency=S.settings?.general?.currency||'EGP';
  let rows=filterByDate(Object.entries(S.sales||{}),'date',from,to)
    .filter(([,s])=>!branchId||s.branchId===branchId)
    .sort(([,a],[,b])=>new Date(b.date||b.createdAt||0)-new Date(a.date||a.createdAt||0));

  const totalRev  = rows.reduce((s,[,v])=>s+(+v.total||0),0);
  const totalUnpd = rows.reduce((s,[,v])=>s+(+v.balance||0),0);
  const avgInv    = rows.length ? totalRev/rows.length : 0;

  const el=id=>document.getElementById(id);
  if(el('rp-inv-count')) el('rp-inv-count').textContent = rows.length;
  if(el('rp-revenue'))   el('rp-revenue').textContent   = totalRev.toFixed(0)+' '+currency;
  if(el('rp-avg-inv'))   el('rp-avg-inv').textContent   = avgInv.toFixed(0)+' '+currency;
  if(el('rp-unpaid'))    el('rp-unpaid').textContent     = totalUnpd.toFixed(0)+' '+currency;

  const stMap={paid:'<span class="badge badge-success">مدفوعة</span>',partial:'<span class="badge badge-warning">جزئية</span>',unpaid:'<span class="badge badge-danger">غير مدفوعة</span>'};
  const tbody=document.getElementById('rp-sales-tbl'); if(!tbody) return;
  tbody.innerHTML=rows.length ? rows.map(([id,s])=>`<tr>
    <td style="font-size:11px;color:var(--text2);">${fDateShort(s.date||s.createdAt)}</td>
    <td style="color:var(--accent);font-weight:700;font-size:11px;">#${id.slice(-5).toUpperCase()}</td>
    <td>${s.customer||s.custName||'نقدي'}</td>
    <td style="font-size:11px;">${getBranchName(s.branchId)||'—'}</td>
    <td style="text-align:center;">${(s.items||[]).length}</td>
    <td style="font-weight:700;">${(+s.total||0).toFixed(2)} ${currency}</td>
    <td style="color:var(--green);">${(+s.amountPaid||+s.received||+s.systemAmount||0).toFixed(2)} ${currency}</td>
    <td style="color:${(+s.balance||0)>0?'var(--red)':'var(--text3)'};">${(+s.balance||0).toFixed(2)} ${currency}</td>
    <td>${stMap[s.status]||stMap.unpaid}</td>
  </tr>`).join('')
  : '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text2);">لا توجد مبيعات في هذه الفترة</td></tr>';
}

// ── تقرير المنتجات ─────────────────────────────────────
function renderRepProducts(from,to,branchId) {
  const currency=S.settings?.general?.currency||'EGP';
  // حساب المبيعات من فواتير الفترة
  const salesRows=filterByDate(Object.entries(S.sales||{}),'date',from,to)
    .filter(([,s])=>!branchId||s.branchId===branchId);
  const prodStats={};
  salesRows.forEach(([,s])=>(s.items||[]).forEach(it=>{
    const k=it.productId||it.prodId||it.name;
    if(!prodStats[k]) prodStats[k]={name:it.name||'—',soldQty:0,revenue:0};
    prodStats[k].soldQty += +it.qty||0;
    prodStats[k].revenue += (+it.qty||0)*(+it.price||0);
  }));

  const tbody=document.getElementById('rp-prod-tbl'); if(!tbody) return;
  const allProds=Object.entries(S.products||{}).filter(([,p])=>!branchId||p.branchId===branchId);
  const rows=allProds.map(([id,p])=>{
    const stats=prodStats[id]||prodStats[p.name]||{soldQty:0,revenue:0};
    return {id,p,soldQty:stats.soldQty,revenue:stats.revenue};
  }).sort((a,b)=>b.soldQty-a.soldQty);

  tbody.innerHTML=rows.length ? rows.map(({id,p,soldQty,revenue})=>{
    const catName=(S.categories||{})[p.cat]?.name||'—';
    const stockStatus = (+p.qty||0)<=0
      ? '<span class="badge badge-danger">نفد</span>'
      : (+p.qty||0)<=(+p.min||3)
        ? '<span class="badge badge-warning">منخفض</span>'
        : '<span class="badge badge-success">متوفر</span>';
    return `<tr>
      <td><strong>${p.name}</strong>${p.code?`<div style="font-size:10px;color:var(--text3);">${p.code}</div>`:''}</td>
      <td style="font-size:11px;">${catName}</td>
      <td style="text-align:center;font-weight:700;color:var(--accent);">${soldQty}</td>
      <td style="color:var(--green);font-weight:700;">${revenue.toFixed(2)} ${currency}</td>
      <td style="text-align:center;font-weight:700;">${+p.qty||0}</td>
      <td style="text-align:center;color:var(--text2);">${+p.min||0}</td>
      <td>${stockStatus}</td>
    </tr>`;
  }).join('')
  : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text2);">لا توجد بيانات</td></tr>';
}

// ── تقرير العملاء ──────────────────────────────────────
function renderRepCustomers(from,to,branchId) {
  const currency=S.settings?.general?.currency||'EGP';
  const salesRows=filterByDate(Object.entries(S.sales||{}),'date',from,to)
    .filter(([,s])=>!branchId||s.branchId===branchId);
  const custStats={};
  salesRows.forEach(([,s])=>{
    const k=s.customerId||s.custId; if(!k) return;
    if(!custStats[k]) custStats[k]={count:0,total:0,lastDate:''};
    custStats[k].count++;
    custStats[k].total += +s.total||0;
    if(!custStats[k].lastDate||s.date>custStats[k].lastDate) custStats[k].lastDate=s.date||s.createdAt||'';
  });

  const rows=Object.entries(S.customers||{})
    .filter(([,c])=>!branchId||c.branchId===branchId)
    .map(([id,c])=>({id,c,stats:custStats[id]||{count:0,total:0,lastDate:''}}))
    .filter(r=>r.stats.count>0)
    .sort((a,b)=>b.stats.total-a.stats.total);

  const tbody=document.getElementById('rp-cust-tbl'); if(!tbody) return;
  tbody.innerHTML=rows.length ? rows.map(({id,c,stats})=>`<tr>
    <td><strong>${c.name}</strong>${c.phone?`<div style="font-size:10px;color:var(--text3);">${c.phone}</div>`:''}</td>
    <td style="font-size:11px;">${getBranchName(c.branchId)||'—'}</td>
    <td style="text-align:center;"><span class="badge badge-info">${stats.count}</span></td>
    <td style="font-weight:700;color:var(--accent);">${stats.total.toFixed(2)} ${currency}</td>
    <td style="color:${(+c.balance||0)>0?'var(--red)':'var(--green)'};font-weight:${(+c.balance||0)>0?'700':'400'};">
      ${(+c.balance||0)>0?(+c.balance).toFixed(2)+' '+currency:'<i class="fas fa-check-circle"></i>'}
    </td>
    <td style="font-size:11px;color:var(--text2);">${fDateShort(c.lastVisit||stats.lastDate)||'—'}</td>
  </tr>`).join('')
  : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2);">لا توجد بيانات في هذه الفترة</td></tr>';
}

// ── تقرير المشتريات ────────────────────────────────────
function renderRepPurchases(from,to,branchId) {
  const currency=S.settings?.general?.currency||'EGP';
  const rows=filterByDate(Object.entries(S.purchaseOrders||{}),'date',from,to)
    .filter(([,p])=>!branchId||p.branchId===branchId)
    .sort(([,a],[,b])=>new Date(b.date||0)-new Date(a.date||0));

  const total = rows.reduce((s,[,p])=>s+(+p.total||0),0);
  const debt  = rows.reduce((s,[,p])=>s+(+p.balance||0),0);
  const el=id=>document.getElementById(id);
  if(el('rp-pur-count')) el('rp-pur-count').textContent = rows.length;
  if(el('rp-pur-total')) el('rp-pur-total').textContent = total.toFixed(0)+' '+currency;
  if(el('rp-pur-debt'))  el('rp-pur-debt').textContent  = debt.toFixed(0)+' '+currency;

  const stMap={completed:'<span class="badge badge-success">مكتمل</span>',pending:'<span class="badge badge-warning">معلق</span>',partial:'<span class="badge badge-info">جزئي</span>'};
  const tbody=document.getElementById('rp-pur-tbl'); if(!tbody) return;
  tbody.innerHTML=rows.length ? rows.map(([id,p])=>`<tr>
    <td style="font-size:11px;color:var(--text2);">${fDateShort(p.date)}</td>
    <td><strong>${p.supplierName||'—'}</strong></td>
    <td style="font-size:11px;">${getBranchName(p.branchId)||'—'}</td>
    <td style="text-align:center;">${(p.items||[]).length}</td>
    <td style="font-weight:700;">${(+p.total||0).toFixed(2)} ${currency}</td>
    <td style="color:var(--green);">${(+p.amountPaid||0).toFixed(2)} ${currency}</td>
    <td style="color:${(+p.balance||0)>0?'var(--red)':'var(--text3)'};">${(+p.balance||0).toFixed(2)} ${currency}</td>
    <td>${stMap[p.status]||stMap.pending}</td>
  </tr>`).join('')
  : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2);">لا توجد مشتريات في هذه الفترة</td></tr>';
}

// ── تقرير الخزائن ──────────────────────────────────────
function renderRepCashboxes(from,to,branchId) {
  const currency=S.settings?.general?.currency||'EGP';
  const logRows=filterByDate(Object.entries(S.cashboxLog||{}),'date',from,to);
  const cbStats={};
  logRows.forEach(([,l])=>{
    const k=l.cbId; if(!k) return;
    if(!cbStats[k]) cbStats[k]={deposits:0,withdrawals:0};
    if(l.type==='deposit') cbStats[k].deposits += +l.amount||0;
    else                   cbStats[k].withdrawals += +l.amount||0;
  });

  const tbody=document.getElementById('rp-cb-tbl'); if(!tbody) return;
  const rows=Object.entries(S.cashboxes||{}).filter(([,cb])=>!branchId||cb.branchId===branchId);
  tbody.innerHTML=rows.length ? rows.map(([id,cb])=>{
    const stats=cbStats[id]||{deposits:0,withdrawals:0};
    const net=stats.deposits-stats.withdrawals;
    return `<tr>
      <td><strong>${cb.name}</strong></td>
      <td style="font-size:11px;">${getBranchName(cb.branchId)||'—'}</td>
      <td style="font-weight:700;color:${(+cb.balance||0)>=0?'var(--green)':'var(--red)'};">${(+cb.balance||0).toFixed(2)} ${currency}</td>
      <td style="color:var(--green);">${stats.deposits.toFixed(2)} ${currency}</td>
      <td style="color:var(--red);">${stats.withdrawals.toFixed(2)} ${currency}</td>
      <td style="font-weight:700;color:${net>=0?'var(--green)':'var(--red)'};">${net.toFixed(2)} ${currency}</td>
    </tr>`;
  }).join('')
  : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2);">لا توجد خزائن</td></tr>';
}

// ── تقرير الفروع ───────────────────────────────────────
function renderRepBranches(from,to) {
  const currency=S.settings?.general?.currency||'EGP';
  const salesByBranch={}, purByBranch={};
  filterByDate(Object.entries(S.sales||{}),'date',from,to).forEach(([,s])=>{
    const k=s.branchId||'__none__';
    if(!salesByBranch[k]) salesByBranch[k]=0;
    salesByBranch[k] += +s.total||0;
  });
  filterByDate(Object.entries(S.purchaseOrders||{}),'date',from,to).forEach(([,p])=>{
    const k=p.branchId||'__none__';
    if(!purByBranch[k]) purByBranch[k]=0;
    purByBranch[k] += +p.total||0;
  });

  const allKeys=new Set([...Object.keys(salesByBranch),...Object.keys(purByBranch),...Object.keys(S.branches||{})]);
  const tbody=document.getElementById('rp-branch-tbl'); if(!tbody) return;
  const rows=[...allKeys].map(k=>{
    const sales=salesByBranch[k]||0, purch=purByBranch[k]||0, profit=sales-purch;
    const custCount=Object.values(S.customers||{}).filter(c=>c.branchId===k).length;
    const custDebt=Object.values(S.customers||{}).filter(c=>c.branchId===k).reduce((s,c)=>s+(+c.balance||0),0);
    const supDebt=Object.values(S.purchaseOrders||{}).filter(p=>p.branchId===k).reduce((s,p)=>s+(+p.balance||0),0);
    const name=k==='__none__'?'غير محدد':getBranchName(k)||k;
    return {name,sales,purch,profit,custCount,custDebt,supDebt};
  }).sort((a,b)=>b.sales-a.sales);

  tbody.innerHTML=rows.length ? rows.map(r=>`<tr>
    <td><strong>${r.name}</strong></td>
    <td style="color:var(--green);font-weight:700;">${r.sales.toFixed(0)} ${currency}</td>
    <td style="color:var(--red);">${r.purch.toFixed(0)} ${currency}</td>
    <td style="color:${r.profit>=0?'var(--accent)':'var(--red)'};font-weight:700;">${r.profit.toFixed(0)} ${currency}</td>
    <td style="text-align:center;">${r.custCount}</td>
    <td style="color:${r.custDebt>0?'var(--red)':'var(--text3)'};">${r.custDebt.toFixed(0)} ${currency}</td>
    <td style="color:${r.supDebt>0?'var(--yellow)':'var(--text3)'};">${r.supDebt.toFixed(0)} ${currency}</td>
  </tr>`).join('')
  : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text2);">لا توجد بيانات</td></tr>';
}

// ── تصدير Excel الشامل للتقارير ───────────────────────
// ── تصدير الديون Excel (عملاء + موردين + فواتير غير مسددة) ──
function exportDebtsExcel(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const currency=S.settings?.general?.currency||'EGP';
  const wb=XLSX.utils.book_new();

  const custRows=[['العميل','الهاتف','الفرع','الدين المستحق ('+currency+')','إجمالي المشتريات','آخر زيارة'],
    ...Object.entries(S.customers||{})
      .filter(([,c])=>(+c.balance||0)>0)
      .sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0))
      .map(([,c])=>[c.name||'—', c.phone||'—', getBranchName(c.branchId)||'مركزي',
                    +c.balance||0, +c.totalBuy||0, (c.lastVisit||'').slice(0,10)||'—'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(custRows),'ديون العملاء');

  const supDebt={};
  Object.values(S.purchaseOrders||{}).forEach(p=>{
    const bal=+p.balance||0; if(bal<=0) return;
    const id=p.supplierId||'—';
    supDebt[id]=(supDebt[id]||0)+bal;
  });
  const supRows=[['المورد','الهاتف','المستحق علينا ('+currency+')'],
    ...Object.entries(supDebt).sort((a,b)=>b[1]-a[1]).map(([id,bal])=>{
      const s=(S.suppliers||{})[id]||{};
      return [s.name||'—', s.phone||'—', bal];
    })];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(supRows),'ديون الموردين');

  const invRows=[['رقم الفاتورة','التاريخ','العميل','الفرع','الإجمالي','المدفوع','المتبقي','الحالة'],
    ...Object.values(S.sales||{})
      .filter(s=>(+s.balance||0)>0)
      .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
      .map(s=>[s.invNumber||'—', (s.date||s.createdAt||'').slice(0,10),
               s.customer||s.custName||'—', s.branchName||'مركزي',
               +s.total||0, +s.amountPaid||0, +s.balance||0, s.status||'unpaid'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(invRows),'فواتير غير مسددة');

  XLSX.writeFile(wb,`الديون-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير الديون');
}

// ── تصدير المرتجعات Excel ──
function exportReturnsExcel(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const currency=S.settings?.general?.currency||'EGP';
  const rows=Object.values(S.returns||{}).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!rows.length){ toast('لا توجد مرتجعات للتصدير','warning'); return; }

  const wb=XLSX.utils.book_new();
  const head=[['التاريخ','النوع','الطرف','الفرع','السبب','طريقة الاسترداد','عدد الأصناف','الإجمالي ('+currency+')','الفاتورة الأصلية','بواسطة','ملاحظات']];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...head,
    ...rows.map(r=>[
      (r.date||r.createdAt||'').slice(0,10),
      r.type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات',
      r.partyName||'—', r.branchName||'مركزي',
      RETURN_REASONS[r.reason]||r.reason||'—',
      REFUND_METHODS[r.refundMethod]||r.refundMethod||'—',
      (r.items||[]).length, +r.total||0,
      (S.sales||{})[r.invoiceId]?.invNumber||'—',
      r.createdByName||'—', r.notes||'—',
    ])]),'المرتجعات');

  // ورقة تفصيل الأصناف
  const itemRows=[['التاريخ','النوع','الطرف','الصنف','الكمية','السعر','الإجمالي']];
  rows.forEach(r=>(r.items||[]).forEach(i=>itemRows.push([
    (r.date||r.createdAt||'').slice(0,10),
    r.type==='sale'?'مبيعات':'مشتريات',
    r.partyName||'—', i.name||'—', +i.qty||0, +i.price||0, (+i.qty||0)*(+i.price||0)
  ])));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(itemRows),'أصناف المرتجعات');

  XLSX.writeFile(wb,`المرتجعات-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير المرتجعات');
}

// ── طباعة التقرير المعروض حالياً ──
function printReports(){
  const panel=document.querySelector('#pg-reports .tab-panel.active');
  if(!panel){ toast('لا يوجد تقرير معروض','error'); return; }
  const g=S.settings?.general||{};
  const {from,to}=getRepFilters();
  const title=document.querySelector('#pg-reports .tab-btn.active')?.textContent?.trim()||'تقرير';
  const w=window.open('','_blank','width=1000,height=760');
  if(!w){ toast('يرجى السماح بالنوافذ المنبثقة','error'); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 landscape;margin:10mm;}
  body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;color:#111;font-size:11px;padding:12px;}
  h1{font-size:18px;margin-bottom:4px;}
  .meta{font-size:11px;color:#555;margin-bottom:14px;border-bottom:2px solid #111;padding-bottom:8px;}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;}
  th{background:#f2f2f2;border:1px solid #999;padding:6px 8px;text-align:right;font-size:11px;}
  td{border:1px solid #ccc;padding:5px 8px;text-align:right;font-size:11px;}
  .stat-card,.card{border:1px solid #ccc;border-radius:6px;padding:8px;margin-bottom:8px;display:inline-block;min-width:150px;}
  button,.btn,input,select,canvas{display:none!important;}
</style></head><body>
<h1>${g.name||g.sysName||'الشمس'} — ${title}</h1>
<div class="meta">الفترة: ${from||'البداية'} إلى ${to||'اليوم'} &nbsp;|&nbsp; تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')} &nbsp;|&nbsp; بواسطة: ${CURRENT_USER?.name||'—'}</div>
${panel.innerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body></html>`);
  w.document.close();
}

// ── مسح كل بيانات النظام (أدمن فقط + تحقق مزدوج) ──
const CLEARABLE_STORES=['products','customers','sales','purchaseOrders','expenses',
                        'suppliers','movements','categories','cashboxes','cashboxLog',
                        'returns','warehouses','stockTransfers','lossRecords','payments'];

function openClearAllModal(){
  if(CURRENT_USER?.role!=='admin'){ toast('هذه العملية متاحة للأدمن فقط','error'); return; }
  document.getElementById('ca-pass').value='';
  document.getElementById('ca-confirm').value='';
  document.getElementById('ca-err').style.display='none';
  openModal('modal-clear-all');
  setTimeout(()=>document.getElementById('ca-pass')?.focus(),200);
}

async function verifyClearAll(){
  const err=document.getElementById('ca-err');
  const fail=m=>{ err.textContent=m; err.style.display='block'; };
  err.style.display='none';

  if(CURRENT_USER?.role!=='admin'){ fail('هذه العملية متاحة للأدمن فقط'); return; }
  const pass=document.getElementById('ca-pass')?.value||'';
  const conf=(document.getElementById('ca-confirm').value||'').trim();
  if(!pass){ fail('أدخل كلمة مرور حسابك'); return; }
  if(conf!=='مسح نهائي'){ fail('اكتب عبارة «مسح نهائي» بالضبط للتأكيد'); return; }

  // تحقق مزدوج: كلمة مرور الأدمن نفسه + عبارة التأكيد
  const me=(S.users||{})[CURRENT_USER?.id];
  if(!await verifyPassword(me, pass)){ fail('كلمة المرور غير صحيحة'); return; }

  if(!OM.isOnline || !window._fbAvailable){ fail('لا يمكن تنفيذ المسح وأنت أوف لاين — اتصل بالإنترنت أولاً'); return; }

  const btn=document.getElementById('ca-btn');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري المسح...';
  let done=0, failed=0;
  for(const store of CLEARABLE_STORES){
    try{ await _fbRemove(store); done++; }
    catch(e){ failed++; console.warn('clear failed',store,e); }
  }
  btn.disabled=false; btn.innerHTML='<i class="fas fa-trash-alt"></i> تأكيد المسح النهائي';
  closeModal('modal-clear-all');
  if(failed) toast(`تم مسح ${done} قسم — ${failed} فشل`,'warning');
  else       toast(`تم مسح كل البيانات (${done} قسم) ✅`,'success');
}

function exportAllReports() {
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const {from,to,branchId}=getRepFilters();
  const currency=S.settings?.general?.currency||'EGP';
  const wb=XLSX.utils.book_new();

  // ورقة المبيعات
  const salesRows=filterByDate(Object.entries(S.sales||{}),'date',from,to)
    .filter(([,s])=>!branchId||s.branchId===branchId)
    .sort(([,a],[,b])=>new Date(b.date||0)-new Date(a.date||0));
  const salesData=[['رقم الفاتورة','التاريخ','العميل','الفرع','الإجمالي','المدفوع','المتبقي','الحالة'],
    ...salesRows.map(([id,s])=>[id.slice(-5).toUpperCase(),s.date||s.createdAt?.slice(0,10),s.customer||s.custName||'نقدي',getBranchName(s.branchId)||'—',+s.total||0,+s.amountPaid||0,+s.balance||0,s.status||'unpaid'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(salesData),'المبيعات');

  // ورقة المشتريات
  const purRows=filterByDate(Object.entries(S.purchaseOrders||{}),'date',from,to)
    .filter(([,p])=>!branchId||p.branchId===branchId);
  const purData=[['التاريخ','المورد','الفرع','الإجمالي','المدفوع','المتبقي','الحالة'],
    ...purRows.map(([,p])=>[p.date,p.supplierName||'—',getBranchName(p.branchId)||'—',+p.total||0,+p.amountPaid||0,+p.balance||0,p.status||'pending'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(purData),'المشتريات');

  // ورقة المنتجات
  const prodData=[['المنتج','الكود','الفئة','الفرع','سعر الشراء','سعر البيع','المخزون','الحد الأدنى'],
    ...Object.entries(S.products||{}).filter(([,p])=>!branchId||p.branchId===branchId)
      .map(([,p])=>[p.name,p.code||'—',(S.categories||{})[p.cat]?.name||'—',getBranchName(p.branchId)||'—',+p.cost||0,+p.price||0,+p.qty||0,+p.min||0])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(prodData),'المنتجات');

  // ورقة العملاء
  const custData=[['الاسم','الهاتف','الفرع','إجمالي المشتريات','الديون'],
    ...Object.values(S.customers||{}).filter(c=>!branchId||c.branchId===branchId)
      .map(c=>[c.name,c.phone||'—',getBranchName(c.branchId)||'—',+c.totalBuy||0,+c.balance||0])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(custData),'العملاء');

  const fname=`تقرير-الشمس-${from||'الكل'}-${to||new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  toast('✅ تم تصدير التقرير الشامل');
}

