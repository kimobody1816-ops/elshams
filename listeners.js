// ============================================================
// STUB FUNCTIONS (to prevent errors from listener callbacks)
// ============================================================
function renderLowStock(){ /* stub - called by products listener */ }
function populateCbProducts(){ /* stub - called by products listener */ }
function populateProductSelects(){ /* stub - called by products/categories listeners */ }
function renderSalesCharts(){ /* stub - called by sales listener */ }
function renderCashierReport(){ /* stub - called by sales listener */ }
function renderWarehouses(){ /* stub - called by warehouses listener */ }

// ============================================================
// إعادة الرسم عند تغيّر البيانات — للصفحة الظاهرة فقط، ومرة واحدة لكل دفعة تغييرات
// ============================================================
// كل تغيير في أي مجموعة كان بيعيد رسم صفحات كتير مش ظاهرة (الرئيسية والمالية
// والفواتير والديون…) — وبيعة واحدة بتلمس الفواتير والمنتجات والعملاء والخزينة،
// فكانت بتعمل عشرات إعادة رسم لكل الفواتير. الصفحات المخفية بتترسم لما تتفتح
// أصلاً (nav يستدعي render<Page>)، فمفيش داعي نرسمها وهي مش باينة.
function pageOn(page){ return !!document.getElementById('pg-'+page)?.classList.contains('active'); }

// setTimeout مش requestAnimationFrame: الأخير بيقف لو النافذة متصغّرة فالشاشة متتحدّثش
const _renderQueue=new Set();
let _renderFrame=0;
function renderIf(page, ...fns){
  if(!pageOn(page)) return;
  fns.forEach(f=>_renderQueue.add(f));
  if(_renderFrame) return;
  _renderFrame=setTimeout(()=>{
    _renderFrame=0;
    const list=[..._renderQueue]; _renderQueue.clear();
    list.forEach(f=>{ try{ f(); }catch(e){ console.warn('render',f.name,e); } });
  },30);
}

// ============================================================
// FIREBASE — extend listeners for new collections
// ============================================================
function attachRemainingListeners(){
  listenCollection('products',v=>{ S.products=v||{}; renderIf('warehouse',renderProducts,renderWhStats,renderWarehouseList); renderIf('finance',renderFinStats); renderIf('home',renderHomeStats); renderIf('cashier',renderCashier); });
  listenCollection('warehouses',v=>{ S.warehouses=v||{}; renderWarehouseList(); renderWhStats(); populateProdWarehouse(); renderIf('transfers',renderTransfers); });
  listenCollection('categories',v=>{ S.categories=v||{}; renderCategories(); });
  listenCollection('movements',v=>{ S.movements=v||{}; renderMovements(); });
  listenCollection('suppliers',v=>{ S.suppliers=v||{}; renderIf('purchases',renderSuppliers,renderPurStats); });
  listenCollection('purchaseOrders',v=>{ S.purchaseOrders=v||{}; renderIf('purchases',renderPurchaseOrders,renderPurStats); renderIf('debts',renderDebts); renderIf('reports',renderReports); });
  listenCollection('sales',v=>{ S.sales=v||{}; renderIf('finance',renderSalesHistory,renderFinStats,renderFinReport); renderIf('home',renderHomeStats); renderIf('invoices',renderInvoices); renderIf('debts',renderDebts); renderIf('reports',renderReports); });
  listenCollection('expenses',v=>{ S.expenses=v||{}; renderIf('finance',renderExpenses,renderFinStats,renderFinReport); renderIf('home',renderHomeStats); });
  listenCollection('returns',v=>{ S.returns=v||{}; populateRetBranchFilter(); renderIf('home',renderHomeStats); renderIf('returns',renderReturns); });
  listenCollection('customers',v=>{ S.customers=v||{}; populateCustBranchFilter(); renderIf('home',renderHomeStats); renderIf('customers',renderCustomers); renderIf('debts',renderDebts); });
  listenCollection('cashboxes',v=>{ S.cashboxes=v||{}; populateCsCashbox(payMethod||'cash'); populateRetCashbox(); populateExpCashbox(); renderIf('home',renderHomeStats); renderIf('cashboxes',renderCashboxes); });
  listenCollection('cashboxLog',v=>{ S.cashboxLog=v||{}; renderIf('home',renderHomeStats); renderIf('cashboxes',renderCbStats,renderCashboxLog); });
  listenCollection('stockTransfers',v=>{ S.stockTransfers=v||{}; renderIf('home',renderHomeStats); renderIf('transfers',renderTransfers); });
  listenCollection('lossRecords',v=>{ S.lossRecords=v||{}; });
  listenCollection('payments',v=>{
    S.payments=v||{};
    renderIf('home',renderHomeStats);
    renderIf('debts',renderDebts);
  });
  listenCollection('shifts',v=>{
    S.shifts=v||{};
    _shiftsLoaded=true;   // من الآن يجوز فتح وردية جديدة عند الحاجة
    // نُحدّث مرجع الوردية الحالية لو أقفلها المدير العام من جهاز آخر
    if(CURRENT_SHIFT && S.shifts[CURRENT_SHIFT.id]?.status==='closed'){
      toast('تم إقفال ورديتك من قبل المدير العام','warning');
      CURRENT_SHIFT=null;
      _shiftClosedByAdmin=true;   // لا نفتح بديلة تلقائياً في نفس الجلسة
    }
    ensureMyShift();
    renderShiftIndicator();
    if(document.getElementById('pg-shifts')?.classList.contains('active')) renderShifts();
  });
  // تشغيل النسخ الاحتياطي التلقائي
  initAutoBackup();
}

