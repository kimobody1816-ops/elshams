// ============================================================
// BACKUP — النسخ الاحتياطي
// ============================================================
let autoBackupTimer=null;

function renderBackup() {
  updateAutoBackupStatus();
  renderBackupHistory();
}

// ── JSON Export/Import ──────────────────────────────────
async function exportJSON(){
  try{
    toast('جارٍ تجميع البيانات...','info');
    const allData={
      meta:{ exportedAt:new Date().toISOString(), version:'shams-v9', app:'الشمس' },
      settings:  S.settings||{},
      branches:  S.branches||{},
      users:     S.users||{},
      products:  S.products||{},
      categories:S.categories||{},
      suppliers: S.suppliers||{},
      purchaseOrders:S.purchaseOrders||{},
      sales:     S.sales||{},
      customers: S.customers||{},
      returns:   S.returns||{},
      cashboxes: S.cashboxes||{},
      cashboxLog:S.cashboxLog||{},
      stockTransfers:S.stockTransfers||{},
      expenses:  S.expenses||{},
      movements: S.movements||{},
    };
    const blob=new Blob([JSON.stringify(allData,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;
    a.download=`shams-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    saveBackupHistory('json');
    toast('✅ تم تصدير النسخة الاحتياطية JSON');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

async function restoreJSON(event){
  const file=event.target.files[0]; if(!file) return;
  const ok=await confirm2('⚠️ سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. هل أنت متأكد؟','استعادة نسخة احتياطية','🔄','استعادة','btn-danger');
  if(!ok){ event.target.value=''; return; }
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    if(!data.meta){ toast('الملف غير صالح','error'); return; }
    toast('جارٍ الاستعادة...','info');
    const collections=['settings','branches','users','products','categories','suppliers',
      'purchaseOrders','sales','customers','returns','cashboxes','cashboxLog',
      'stockTransfers','expenses','movements'];
    for(const col of collections){
      if(data[col]) await dbSet(col, data[col]);
    }
    toast('✅ تم استعادة النسخة الاحتياطية بنجاح — سيُعاد تحميل الصفحة');
    setTimeout(()=>location.reload(), 2000);
  }catch(e){ toast('خطأ في الاستعادة: '+e.message,'error'); }
  finally{ event.target.value=''; }
}

// ── Excel Exports ───────────────────────────────────────
function exportSalesExcel(){
  if(!xlsxReady()) return;
  const currency=S.settings?.general?.currency||'EGP';
  const wb=XLSX.utils.book_new();
  const rows=[['رقم الفاتورة','التاريخ','العميل','الفرع','نوع البيع','طريقة الدفع','الإجمالي','المدفوع','المتبقي','الحالة'],
    ...Object.entries(S.sales||{}).sort(([,a],[,b])=>new Date(b.date||0)-new Date(a.date||0))
    .map(([id,s])=>[id.slice(-5).toUpperCase(),s.date||s.createdAt?.slice(0,10),s.customer||s.custName||'نقدي',getBranchName(s.branchId)||'—',SALE_MODE_LABEL(s.saleMode),s.payMethod||s.paymentMethod||'—',+s.total||0,+s.amountPaid||+s.received||0,+s.balance||0,s.status||'—'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'المبيعات');
  XLSX.writeFile(wb,`مبيعات-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير المبيعات');
}

function exportProductsExcel(){
  if(!xlsxReady()) return;
  const wb=XLSX.utils.book_new();
  // نفس عناوين قالب الاستيراد بالضبط حتى يمكن تعديل الملف وإعادة رفعه مباشرةً
  const UNIT_AR={piece:'قطعة',kg:'كيلو',liter:'لتر',meter:'متر',box:'علبة',dozen:'دستة'};
  const rows=[['اسم المنتج *','كود المنتج','السريال نمبر','الفئة *','الفرع','اسم المخزن','الوحدة','الكمية','الحد الأدنى','سعر الشراء *','سعر البيع قطاعي *','سعر البيع جملة','وصف','الحالة'],
    ...Object.values(S.products||{}).map(p=>[
      p.name, p.code||p.barcode||'', p.serial||'',
      (S.categories||{})[p.cat||p.category]?.name||'',
      getBranchName(p.branchId||p.branch)||'',
      getWhName(p.warehouseId||p.whId)||'',
      UNIT_AR[p.unit||'piece']||'قطعة',
      +p.qty||0, +p.min||+p.minQty||0, +p.cost||0, +p.price||0,
      (+p.priceWholesale||0)>0 ? +p.priceWholesale : '',
      p.desc||'', p.status==='inactive'?'متوقف':'نشط'
    ])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'المنتجات');
  XLSX.writeFile(wb,`منتجات-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير المنتجات');
}

function exportCustomersExcel(){
  if(!xlsxReady()) return;
  const wb=XLSX.utils.book_new();
  const rows=[['الاسم','النوع','الهاتف','البريد','العنوان','الفرع','إجمالي المشتريات','الديون','تاريخ الإضافة'],
    ...Object.values(S.customers||{}).map(c=>[c.name,PRICE_MODE_LABELS[c.custType]||'قطاعي',c.phone||'—',c.email||'—',c.addr||'—',getBranchName(c.branchId)||'—',+c.totalBuy||0,+c.balance||0,c.createdAt?.slice(0,10)||'—'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'العملاء');
  XLSX.writeFile(wb,`عملاء-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير العملاء');
}

function exportPurchasesExcel(){
  if(!xlsxReady()) return;
  const wb=XLSX.utils.book_new();
  const rows=[['التاريخ','المورد','الفرع','الإجمالي','المدفوع','المتبقي','الحالة'],
    ...Object.values(S.purchaseOrders||{}).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))
    .map(p=>[p.date,p.supplierName||'—',getBranchName(p.branchId)||'—',+p.total||0,+p.amountPaid||0,+p.balance||0,p.status||'—'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'المشتريات');
  XLSX.writeFile(wb,`مشتريات-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير المشتريات');
}

function exportCashboxExcel(){
  if(!xlsxReady()) return;
  const wb=XLSX.utils.book_new();
  const cbRows=[['الخزينة','النوع','الفرع','الرصيد الحالي'],
    ...Object.values(S.cashboxes||{}).map(cb=>[cb.name,CB_TYPES[cb.type]||cb.type,getBranchName(cb.branchId)||'—',+cb.balance||0])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(cbRows),'الخزائن');
  const logRows=[['التاريخ','الخزينة','النوع','المبلغ','الرصيد بعد','الوصف','بواسطة'],
    ...Object.values(S.cashboxLog||{}).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
    .map(l=>[l.date||l.createdAt?.slice(0,10),(S.cashboxes||{})[l.cbId]?.name||l.cbName||'—',l.type,+l.amount||0,+l.balanceAfter||0,l.desc||'—',l.createdByName||'—'])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(logRows),'سجل الحركات');
  XLSX.writeFile(wb,`خزائن-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير الخزائن');
}

function exportAllExcel(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  exportAllReports();
  saveBackupHistory('excel');
}

// ── الجدولة التلقائية ───────────────────────────────────
function saveBackupHistory(type){
  const history=JSON.parse(localStorage.getItem('shams_backup_history')||'[]');
  history.unshift({type,date:new Date().toISOString(),by:CURRENT_USER?.name||'—'});
  localStorage.setItem('shams_backup_history',JSON.stringify(history.slice(0,10)));
  renderBackupHistory();
}

function renderBackupHistory(){
  const el=document.getElementById('backup-history'); if(!el) return;
  const history=JSON.parse(localStorage.getItem('shams_backup_history')||'[]');
  if(!history.length){ el.textContent='لا توجد نسخ سابقة'; return; }
  el.innerHTML=history.map(h=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border2);">
      <span><i class="fas fa-${h.type==='json'?'code':'file-excel'}" style="color:var(--accent);margin-left:6px;"></i>${h.type.toUpperCase()}</span>
      <span style="color:var(--text3);">${fDateShort(h.date)} — ${h.by}</span>
    </div>`).join('');
}

function toggleAutoBackup(enabled){
  localStorage.setItem('shams_auto_backup', enabled?'1':'0');
  updateAutoBackupStatus();
  if(enabled) scheduleAutoBackup();
  else if(autoBackupTimer){ clearTimeout(autoBackupTimer); autoBackupTimer=null; }
}

function updateAutoBackupStatus(){
  const enabled=localStorage.getItem('shams_auto_backup')==='1';
  const freq=localStorage.getItem('shams_auto_backup_freq')||'daily';
  const toggle=document.getElementById('auto-backup-toggle');
  const status=document.getElementById('auto-backup-status');
  const freqSel=document.getElementById('auto-backup-freq');
  if(toggle) toggle.checked=enabled;
  if(freqSel){ freqSel.value=freq; localStorage.setItem('shams_auto_backup_freq',freq); }
  if(status)  status.textContent=enabled?`مفعّل — ${{daily:'يومياً',weekly:'أسبوعياً',monthly:'شهرياً'}[freq]||freq}`:'غير مفعّل';
  if(status)  status.style.color=enabled?'var(--green)':'var(--text2)';
}

function updateAutoBackup(){
  const freq=document.getElementById('auto-backup-freq')?.value||'daily';
  localStorage.setItem('shams_auto_backup_freq',freq);
  updateAutoBackupStatus();
}

function scheduleAutoBackup(){
  const freq=localStorage.getItem('shams_auto_backup_freq')||'daily';
  const lastBackup=localStorage.getItem('shams_last_auto_backup')||'';
  const now=new Date();
  const last=lastBackup?new Date(lastBackup):new Date(0);
  const diffHours=(now-last)/3600000;
  const shouldBackup=(freq==='daily'&&diffHours>=24)||(freq==='weekly'&&diffHours>=168)||(freq==='monthly'&&diffHours>=720);
  if(shouldBackup){
    const type=document.getElementById('auto-backup-type')?.value||localStorage.getItem('shams_auto_backup_type')||'json';
    if(type==='json'||type==='both') exportJSON();
    if(type==='excel'||type==='both') exportAllExcel();
    localStorage.setItem('shams_last_auto_backup',now.toISOString());
    toast('✅ تم تنفيذ النسخة الاحتياطية التلقائية');
  }
}

// تشغيل الجدولة عند بدء التطبيق
function initAutoBackup(){
  if(localStorage.getItem('shams_auto_backup')==='1') scheduleAutoBackup();
}

