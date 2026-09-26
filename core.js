// ============================================================
const S = { users:{}, branches:{}, settings:{}, returns:{}, customers:{}, cashboxes:{}, cashboxLog:{}, stockTransfers:{}, lossRecords:{}, warehouses:{}, products:{}, categories:{}, suppliers:{}, purchaseOrders:{}, sales:{}, expenses:{}, movements:{}, shifts:{}, payments:{} };

// ============================================================
// CURRENCY — عرض العملة المختارة برمزها العربي في كل الشاشات
// يُحفَظ كود العملة (EGP...) في قاعدة البيانات، ويُعرض الرمز العربي (ج.م...)
// ============================================================
const CURRENCY_LABELS = {
  EGP:'ج.م', SAR:'ر.س', AED:'د.إ', KWD:'د.ك',
  BHD:'د.ب', QAR:'ر.ق', OMR:'ر.ع', USD:'$',
};
function applyCurrencyLabel(){
  const g = S.settings?.general; if(!g) return;
  // إذا كانت القيمة المخزنة كوداً معروفاً نستخدمها، وإلا نرجع للكود المحفوظ أو EGP
  const code = CURRENCY_LABELS[g.currency]!==undefined ? g.currency : (g.currencyCode||'EGP');
  g.currencyCode = code;                       // الكود الفعلي للإعدادات والحفظ
  g.currency     = CURRENCY_LABELS[code]||code; // الرمز المعروض بجوار كل المبالغ
  // تحديث وحدة الخصم في الكاشير حسب العملة المختارة
  const opt = document.querySelector('#ct-discount-type option[value="fixed"]');
  if(opt) opt.textContent = g.currency;
}

// ============================================================
// PERMISSION HELPERS — فلتر الصلاحيات المركزي
// ============================================================
function isAdmin() {
  return CURRENT_USER?.role==='admin';
}
function myBranchId() {
  return CURRENT_USER?.branch||'';
}
function myWarehouseIds() {
  const br = myBranchId();
  if(!br) return [];
  return Object.entries(S.warehouses||{})
    .filter(([,wh])=>wh.branchId===br)
    .map(([id])=>id);
}
// هل سجل ينتمي لفرعي؟
function belongsToMyBranch(record={}) {
  if(isAdmin()) return true;
  const br = myBranchId(); if(!br) return true;
  const myWhs = myWarehouseIds();
  return (
    record.branchId===br ||
    record.branch===br ||
    record.fromBranchId===br ||
    record.toBranchId===br ||
    myWhs.includes(record.warehouseId) ||
    myWhs.includes(record.whId) ||
    myWhs.includes(record.fromId) ||
    myWhs.includes(record.toId) ||
    myWhs.includes(record.cashboxBranchId)
    // السجلات بدون فرع → للأدمن فقط
  );
}
// هل مخزن ينتمي لفرعي؟
function myWarehouseFilter(wh) {
  if(isAdmin()) return true;
  const br = myBranchId();
  if(!br) return true;
  return wh.branchId === br;
}
// فلتر أي مجموعة بيانات
function filterByBranch(obj={}) {
  if(isAdmin()) return Object.entries(obj);
  return Object.entries(obj).filter(([,v])=>belongsToMyBranch(v));
}
let CURRENT_USER  = null;

// ============================================================
// SHIFTS — نظام الورديات
// ============================================================
// كل مستخدم (بأي دور) تُفتح له وردية عند الدخول، وتظل مفتوحة حتى يقفلها المدير العام.
// كل عملية في النظام تُختم برقم الوردية، فيكون تقرير الوردية شاملاً لكل ما تم فيها.
let CURRENT_SHIFT = null;     // كائن الوردية المفتوحة للمستخدم الحالي {id,...}
let _shiftOpening = false;    // منع فتح وردية مرتين في نفس اللحظة
let _shiftsLoaded = false;    // هل وصلت بيانات الورديات؟ قبلها لا نفتح وردية جديدة
let _shiftClosedByAdmin = false; // أقفل المدير ورديتنا — لا نفتح بديلة إلا بدخول جديد

const SHIFT_STATUS_LABELS={open:'مفتوحة', closed:'مقفلة'};
// الوردية قد تعبر منتصف الليل، فالتنبيه يعتمد على عدد الساعات لا على تغيّر اليوم
const SHIFT_STALE_HOURS = 20;

// المدير العام فقط هو من يقفل الورديات
function canCloseShifts(){ return CURRENT_USER?.role==='admin'; }

// الوردية المفتوحة لمستخدم معيّن (أحدث واحدة)
function findOpenShift(userId){
  const rows=Object.entries(S.shifts||{})
    .filter(([,sh])=>sh.userId===userId && sh.status==='open')
    .sort(([,a],[,b])=>(b.openedAt||'').localeCompare(a.openedAt||''));
  return rows.length ? {id:rows[0][0], ...rows[0][1]} : null;
}

function currentShiftId(){ return CURRENT_SHIFT?.id||''; }

// كل حركات المخزن تمر من هنا لتُختم بالوردية تلقائياً
function dbPushMovement(data){
  return dbPush('movements', {...data, createdAt:data.createdAt||new Date().toISOString(), ...shiftStamp()});
}

// الختم الذي يُضاف لكل عملية — يربطها بالوردية ومن نفّذها
function shiftStamp(){
  return {
    shiftId:       currentShiftId(),
    shiftUserId:   CURRENT_SHIFT?.userId||CURRENT_USER?.id||'',
    shiftUserName: CURRENT_SHIFT?.userName||CURRENT_USER?.name||'',
  };
}

// فتح وردية جديدة للمستخدم الحالي
async function openShift(openingCash=0){
  if(!CURRENT_USER) return null;
  const now=new Date();
  const data={
    userId:    CURRENT_USER.id,
    userName:  CURRENT_USER.name||CURRENT_USER.username||'',
    role:      CURRENT_USER.role||'cashier',
    roleLabel: (ROLES[CURRENT_USER.role]||{}).label||'',
    branchId:  CURRENT_USER.branch||'',
    branchName:getBranchName(CURRENT_USER.branch)||'مركزي',
    openingCash:+openingCash||0,     // يبدأ من الصفر افتراضياً — لا تُرحَّل حصيلة الأمس
    status:    'open',
    date:      now.toISOString().slice(0,10),
    openedAt:  now.toISOString(),
  };
  const id=uid();
  S.shifts=S.shifts||{}; S.shifts[id]=data;   // تحديث محلي فوري
  CURRENT_SHIFT={id,...data};
  await dbSet('shifts/'+id, data);
  renderShiftIndicator();
  return CURRENT_SHIFT;
}

// يضمن وجود وردية مفتوحة للمستخدم الحالي — يُستدعى بعد الدخول وبعد تحميل الورديات
// force=true فقط من زر «فتح وردية» اليدوي
async function ensureMyShift(force=false){
  if(!CURRENT_USER || _shiftOpening) return;
  const existing=findOpenShift(CURRENT_USER.id);

  // لا نفتح وردية جديدة قبل أن تصل بيانات الورديات من السحابة.
  // بدون هذا الشرط كان كل refresh يفتح وردية جديدة، لأن استعادة الجلسة
  // تسبق وصول listen('shifts') فتبدو القائمة فارغة.
  if(!existing && !_shiftsLoaded && !force) return;

  // أقفل المدير العام ورديتك؟ لا نفتح بديلة تلقائياً — تُفتح عند الدخول التالي فقط
  if(!existing && _shiftClosedByAdmin && !force) return;

  if(existing){
    _shiftClosedByAdmin=false;
    CURRENT_SHIFT=existing;
    renderShiftIndicator();
    // الوردية قد تمتد لما بعد منتصف الليل، فلا نحكم عليها بتغيّر التاريخ.
    // التنبيه يعتمد على طول الوردية فعلياً — أطول من SHIFT_STALE_HOURS يعني غالباً نُسي إقفالها.
    const hours=(Date.now()-new Date(existing.openedAt).getTime())/3600000;
    if(hours>=SHIFT_STALE_HOURS && !existing._warned){
      existing._warned=true;
      toast(`ورديتك مفتوحة منذ ${Math.floor(hours)} ساعة ولم يقفلها المدير العام — كل العمليات ما زالت تُسجَّل عليها`,'warning');
    }
    return;
  }
  _shiftOpening=true;
  try{ await openShift(0); toast('تم فتح ورديتك — بالتوفيق 👋','success'); }
  catch(e){ console.warn('openShift failed',e); }
  finally{ _shiftOpening=false; }
}

// إقفال وردية (المدير العام فقط)
async function closeShiftById(shiftId, {closingCash=null, notes=''}={}){
  const sh=(S.shifts||{})[shiftId];
  if(!sh) throw new Error('الوردية غير موجودة');
  if(sh.status==='closed') throw new Error('الوردية مقفلة بالفعل');
  const t=shiftTotals(shiftId);
  const expected=(+sh.openingCash||0)+t.cashIn-t.cashOut;
  const counted =closingCash===null||closingCash==='' ? null : (+closingCash||0);
  const data={
    status:'closed',
    closedAt:new Date().toISOString(),
    closedBy:CURRENT_USER?.id||'',
    closedByName:CURRENT_USER?.name||'',
    closingCash: counted,
    expectedCash: expected,
    difference:  counted===null ? null : (counted-expected),
    closeNotes:  notes||'',
    // لقطة من الأرقام وقت الإقفال حتى لا تتغير لو عُدِّلت السجلات لاحقاً
    snapshot: t,
    updatedAt:new Date().toISOString(),
  };
  S.shifts[shiftId]={...sh,...data};
  await dbUpdate('shifts/'+shiftId, data);
  if(CURRENT_SHIFT?.id===shiftId){ CURRENT_SHIFT=null; renderShiftIndicator(); }
  return data;
}

// تجميع كل عمليات الوردية من السجلات المختومة برقمها
function shiftTotals(shiftId){
  const pick=(store)=>Object.entries(S[store]||{}).filter(([,v])=>v.shiftId===shiftId);

  const sales     = pick('sales');
  const purchases = pick('purchaseOrders');
  const expenses  = pick('expenses');
  const returns   = pick('returns');
  const cashLog   = pick('cashboxLog');
  const transfers = pick('stockTransfers');
  const movements = pick('movements');

  const sum=(rows,f)=>rows.reduce((t,[,v])=>t+(+f(v)||0),0);

  const salesTotal   = sum(sales,     v=>v.total);
  const salesPaid    = sum(sales,     v=>v.amountPaid!==undefined?v.amountPaid:v.received);
  const salesCredit  = sum(sales,     v=>v.balance);
  const salesCost    = sales.reduce((t,[,s])=>t+(s.items||[]).reduce((x,i)=>x+(+i.cost||0)*(+i.qty||0),0),0);
  const purchTotal   = sum(purchases, v=>v.total);
  const purchPaid    = sum(purchases, v=>v.amountPaid);
  const expTotal     = sum(expenses,  v=>v.amount);
  const retTotal     = sum(returns,   v=>v.total);
  const cashIn       = cashLog.filter(([,v])=>v.type==='deposit') .reduce((t,[,v])=>t+(+v.amount||0),0);
  const cashOut      = cashLog.filter(([,v])=>v.type!=='deposit').reduce((t,[,v])=>t+(+v.amount||0),0);

  return {
    counts:{ sales:sales.length, purchases:purchases.length, expenses:expenses.length,
             returns:returns.length, cashLog:cashLog.length, transfers:transfers.length,
             movements:movements.length },
    salesTotal, salesPaid, salesCredit, salesCost,
    grossProfit: salesTotal-salesCost,
    purchTotal, purchPaid, expTotal, retTotal,
    cashIn, cashOut, cashNet: cashIn-cashOut,
  };
}

// سجلات وردية معيّنة من مخزن معيّن (للتقرير التفصيلي)
function shiftRecords(shiftId, store){
  return Object.entries(S[store]||{})
    .filter(([,v])=>v.shiftId===shiftId)
    .sort(([,a],[,b])=>(b.createdAt||b.date||'').localeCompare(a.createdAt||a.date||''));
}

// مؤشر الوردية في الشريط العلوي
function renderShiftIndicator(){
  const el=document.getElementById('shift-indicator'); if(!el) return;
  if(!CURRENT_SHIFT){ el.style.display='none'; return; }
  el.style.display='flex';
  const opened=new Date(CURRENT_SHIFT.openedAt);
  const hrs=Math.floor((Date.now()-opened.getTime())/3600000);
  const mins=Math.floor(((Date.now()-opened.getTime())%3600000)/60000);
  document.getElementById('shift-ind-text').textContent =
    `وردية ${hrs>0?hrs+'س ':''}${mins}د`;
  el.title=`وردية مفتوحة منذ ${opened.toLocaleString('ar-EG')} — اضغط لعرض تقريرها`;
}
setInterval(renderShiftIndicator, 60000);

let editingUser   = null;
let editingBranch = null;
let loginSelectedUser = null;
let allLoginUsers = [];
let confirmCb = null;
// المصدر الوحيد لهذه القيم هو SHAMS_CONFIG أعلى الملف
const DB_PATH = window.SHAMS_CONFIG?.dbPath || 'shams_v1';

// ============================================================
// ROLES CONFIG
// ============================================================
const ROLES = {
  admin:      { label:'مدير عام',      color:'role-admin',      badge:'badge-danger',  icon:'fas fa-crown',        avatarBg:'#f85149' },
  branch_mgr: { label:'مدير فرع',     color:'role-branch_mgr', badge:'badge-orange',  icon:'fas fa-building',     avatarBg:'#f0883e' },
  cashier:    { label:'كاشير',         color:'role-cashier',    badge:'badge-success', icon:'fas fa-cash-register',avatarBg:'#3fb950' },
  accountant: { label:'محاسب',         color:'role-accountant', badge:'badge-purple',  icon:'fas fa-calculator',   avatarBg:'#a371f7' },
  warehouse:  { label:'مشرف مخازن',   color:'role-warehouse',  badge:'badge-warning', icon:'fas fa-warehouse',    avatarBg:'#d29922' },
};

// Sidebar menu per role
const MENU = {
  admin: [
    { section:'القائمة الرئيسية', items:[
      { page:'home',      icon:'fas fa-home',               label:'الرئيسية' },
      { page:'cashier',   icon:'fas fa-cash-register',      label:'الكاشير' },
      { page:'invoices',  icon:'fas fa-file-invoice',       label:'الفواتير' },
      { page:'customers', icon:'fas fa-users',              label:'العملاء' },
      { page:'debts',     icon:'fas fa-hand-holding-usd',   label:'الديون' },
      { page:'cashboxes', icon:'fas fa-vault',               label:'الخزائن' },
      { page:'returns',   icon:'fas fa-undo-alt',           label:'المرتجعات' },
      { page:'warehouse', icon:'fas fa-boxes',              label:'المخازن' },
      { page:'transfers', icon:'fas fa-truck-moving',       label:'نقل المخزون' },
      { page:'purchases', icon:'fas fa-shopping-cart',      label:'المشتريات' },
      { page:'finance',   icon:'fas fa-chart-line',         label:'المالية' },
    ]},
    { section:'الإدارة', items:[
      { page:'branches',  icon:'fas fa-building',           label:'الفروع' },
      { page:'users',     icon:'fas fa-users-cog',          label:'المستخدمون' },
      { page:'reports',   icon:'fas fa-chart-bar',          label:'التقارير' },
      { page:'import',    icon:'fas fa-file-excel',         label:'استيراد Excel' },
      { page:'backup',    icon:'fas fa-database',           label:'النسخ الاحتياطي' },
      { page:'shifts',    icon:'fas fa-user-clock',         label:'إدارة الورديات' },
      { page:'settings',  icon:'fas fa-cog',                label:'الإعدادات' },
      { page:'inv-settings', icon:'fas fa-file-invoice-dollar', label:'تصميم الفاتورة' },
    ]},
  ],
  branch_mgr: [
    { section:'القائمة', items:[
      { page:'cashier',   icon:'fas fa-cash-register',      label:'الكاشير' },
      { page:'invoices',  icon:'fas fa-file-invoice',       label:'الفواتير' },
      { page:'customers', icon:'fas fa-users',              label:'العملاء' },
      { page:'debts',     icon:'fas fa-hand-holding-usd',   label:'الديون' },
      { page:'cashboxes', icon:'fas fa-vault',               label:'الخزائن' },
      { page:'returns',   icon:'fas fa-undo-alt',           label:'المرتجعات' },
      { page:'warehouse', icon:'fas fa-boxes',              label:'المخازن' },
      { page:'transfers', icon:'fas fa-truck-moving',       label:'نقل المخزون' },
      { page:'purchases', icon:'fas fa-shopping-cart',      label:'المشتريات' },
      { page:'shifts',    icon:'fas fa-user-clock',         label:'ورديتي' },
    ]},
  ],
  cashier: [
    { section:'القائمة', items:[
      { page:'cashier',   icon:'fas fa-cash-register',      label:'الكاشير' },
      { page:'invoices',  icon:'fas fa-file-invoice',       label:'الفواتير' },
      { page:'cashboxes', icon:'fas fa-vault',               label:'الخزائن' },
      { page:'returns',   icon:'fas fa-undo-alt',           label:'المرتجعات' },
      { page:'shifts',    icon:'fas fa-user-clock',         label:'ورديتي' },
    ]},
  ],
  accountant: [
    { section:'القائمة', items:[
      { page:'finance',   icon:'fas fa-chart-line',         label:'المالية' },
      { page:'reports',   icon:'fas fa-chart-bar',          label:'التقارير' },
      { page:'invoices',  icon:'fas fa-file-invoice',       label:'الفواتير' },
      { page:'cashboxes', icon:'fas fa-vault',               label:'الخزائن' },
      { page:'customers', icon:'fas fa-users',              label:'العملاء' },
      { page:'debts',     icon:'fas fa-hand-holding-usd',   label:'الديون' },
      { page:'returns',   icon:'fas fa-undo-alt',           label:'المرتجعات' },
      { page:'purchases', icon:'fas fa-shopping-cart',      label:'المشتريات' },
      { page:'shifts',    icon:'fas fa-user-clock',         label:'ورديتي' },
    ]},
  ],
  warehouse: [
    { section:'القائمة', items:[
      { page:'warehouse', icon:'fas fa-boxes',              label:'المخازن' },
      { page:'transfers', icon:'fas fa-truck-moving',       label:'نقل المخزون' },
      { page:'purchases', icon:'fas fa-shopping-cart',      label:'المشتريات' },
      { page:'import',    icon:'fas fa-file-excel',         label:'استيراد Excel' },
      { page:'shifts',    icon:'fas fa-user-clock',         label:'ورديتي' },
    ]},
  ],
};

// ============================================================
// PERMISSIONS — صلاحيات قابلة للتعديل من الإعدادات
// ============================================================
// كتالوج كل صفحات النظام. هو المصدر الوحيد لبناء القائمة الجانبية
// ومصفوفة الصلاحيات، فأي صفحة جديدة تُضاف هنا تظهر في الاثنين تلقائياً.
const PAGE_CATALOG = [
  { page:'home',         section:'العمليات', icon:'fas fa-home',                label:'الرئيسية' },
  { page:'cashier',      section:'العمليات', icon:'fas fa-cash-register',       label:'الكاشير' },
  { page:'invoices',     section:'العمليات', icon:'fas fa-file-invoice',        label:'الفواتير' },
  { page:'customers',    section:'العمليات', icon:'fas fa-users',               label:'العملاء' },
  { page:'debts',        section:'العمليات', icon:'fas fa-hand-holding-usd',    label:'الديون' },
  { page:'cashboxes',    section:'العمليات', icon:'fas fa-vault',                label:'الخزائن' },
  { page:'returns',      section:'العمليات', icon:'fas fa-undo-alt',            label:'المرتجعات' },
  { page:'warehouse',    section:'العمليات', icon:'fas fa-boxes',               label:'المخازن' },
  { page:'transfers',    section:'العمليات', icon:'fas fa-truck-moving',        label:'نقل المخزون' },
  { page:'purchases',    section:'العمليات', icon:'fas fa-shopping-cart',       label:'المشتريات' },
  { page:'finance',      section:'العمليات', icon:'fas fa-chart-line',          label:'المالية' },
  { page:'shifts',       section:'العمليات', icon:'fas fa-user-clock',          label:'الورديات' },
  { page:'branches',     section:'الإدارة',  icon:'fas fa-building',            label:'الفروع' },
  { page:'users',        section:'الإدارة',  icon:'fas fa-users-cog',           label:'المستخدمون' },
  { page:'reports',      section:'الإدارة',  icon:'fas fa-chart-bar',           label:'التقارير' },
  { page:'import',       section:'الإدارة',  icon:'fas fa-file-excel',          label:'استيراد Excel' },
  { page:'backup',       section:'الإدارة',  icon:'fas fa-database',            label:'النسخ الاحتياطي' },
  { page:'settings',     section:'الإدارة',  icon:'fas fa-cog',                 label:'الإعدادات' },
  { page:'inv-settings', section:'الإدارة',  icon:'fas fa-file-invoice-dollar', label:'تصميم الفاتورة' },
];

const PERM_ROLES = ['admin','branch_mgr','cashier','accountant','warehouse'];

// إجراءات حساسة جوه الصفحات — مش صفحات، فمبتظهرش في القائمة الجانبية.
// بتتحفظ في نفس settings/permissions[role][key] وبتتقرا بنفس hasPerm.
// defaults = الأدوار المسموح لها قبل ما المدير يعدّل حاجة (المدير العام دايماً مسموح).
const ACTION_CATALOG = [
  { page:'act-edit-price',      icon:'fas fa-tag',      label:'تعديل سعر البيع في الفاتورة', defaults:['branch_mgr'] },
  { page:'act-reverse-payment', icon:'fas fa-rotate-left', label:'إلغاء سداد / تحصيل دين',   defaults:[] },
];

// الافتراضيات = نفس توزيع MENU الحالي، فلا يتغيّر سلوك النظام قبل أن يعدّل الأدمن شيئاً
const PERM_DEFAULTS = (()=>{
  const out={};
  PERM_ROLES.forEach(role=>{
    const allowed=new Set((MENU[role]||[]).flatMap(sec=>sec.items.map(i=>i.page)));
    out[role]={};
    PAGE_CATALOG.forEach(p=>{ out[role][p.page]=allowed.has(p.page); });
    ACTION_CATALOG.forEach(a=>{ out[role][a.page]=a.defaults.includes(role); });
  });
  return out;
})();

// المدير العام يملك كل شيء دائماً — بلا هذا القيد يستطيع أن يسحب من نفسه
// صلاحية الإعدادات أو المستخدمين فيُغلق الباب خلفه بلا طريق للرجوع.
function hasPerm(role, page){
  if(role==='admin') return true;
  const saved=S.settings?.permissions?.[role];
  if(saved && saved[page]!==undefined) return !!saved[page];
  return !!PERM_DEFAULTS[role]?.[page];
}

// صفحات دور معيّن مرتّبة حسب الكتالوج
function rolePages(role){
  return PAGE_CATALOG.filter(p=>hasPerm(role,p.page));
}

const PAGE_TITLES = {
  home:'الرئيسية', cashier:'الكاشير', warehouse:'المخازن',
  purchases:'المشتريات', finance:'المالية', branches:'إدارة الفروع',
  users:'إدارة المستخدمين', settings:'الإعدادات', returns:'المرتجعات',
  customers:'إدارة العملاء', debts:'إدارة الديون', cashboxes:'إدارة الخزائن',
  import:'استيراد Excel', transfers:'نقل المخزون', invoices:'الفواتير',
  reports:'التقارير الشاملة', backup:'النسخ الاحتياطي',
  'inv-settings':'تصميم الفاتورة', shifts:'إدارة الورديات',
};
const PAGE_ICONS = {
  home:'fas fa-home', cashier:'fas fa-cash-register', warehouse:'fas fa-boxes',
  purchases:'fas fa-shopping-cart', finance:'fas fa-chart-line', branches:'fas fa-building',
  users:'fas fa-users-cog', settings:'fas fa-cog', returns:'fas fa-undo-alt',
  customers:'fas fa-users', debts:'fas fa-hand-holding-usd', cashboxes:'fas fa-vault',
  import:'fas fa-file-excel', transfers:'fas fa-truck-moving', invoices:'fas fa-file-invoice',
  reports:'fas fa-chart-bar', backup:'fas fa-database',
  'inv-settings':'fas fa-file-invoice-dollar', shifts:'fas fa-user-clock',
};

// ============================================================
// FIREBASE HELPERS
// ============================================================
function dbRef(path)        { return window.$ref(window.$db, DB_PATH+'/'+path); }
function dbUpdate(path,data){ return window.$update(dbRef(path),data); }
function dbSet(path,data)   { return window.$set(dbRef(path),data); }
function dbPush(path,data)  { return window.$push(dbRef(path),data); }
function dbRemove(path)     { return window.$remove(dbRef(path)); }
function uid()              { return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }

function listen(path, cb) {
  window.$onValue(dbRef(path), snap => cb(snap.val() || {}));
}

// المجموعات (الفواتير، الحركات، الخزائن…) بتتقرا بأحداث الأبناء بدل onValue.
// onValue كان مع كل تغيير — ولو فاتورة واحدة — بيبني المجموعة كلها من أول وجديد
// (20 ألف فاتورة = 20 ألف كائن مع كل بيعة من أي جهاز). هنا كل تغيير بيوصل لوحده
// ويتحط في مكانه، والمستمع بياخد نفس الشكل اللي كان بياخده بالظبط: كائن كامل.
//  - أول تحميل: الأبناء بيتجمّعوا والمستمع بيتنده مرة واحدة لما يخلصوا.
//  - بعد كده: بيتنده فوراً (متزامن) مع كل تغيير — زي onValue — لأن فيه كود بيكتب
//    ويقرا S على طول (رصيد الخزينة في addCashboxEntry مثلاً).
//  - كائن جديد مع كل تغيير: مزامنة الأوفلاين بتعرف التغيير من تغيّر المرجع.
function listenCollection(path, cb) {
  if(!window.$onChildAdded){ listen(path, cb); return; }   // احتياطي
  const r=dbRef(path);
  let data={}, ready=false;
  const emit=()=>{ if(ready){ data={...data}; cb(data); } };
  window.$onChildAdded  (r, s=>{ data[s.key]=s.val(); emit(); });
  window.$onChildChanged(r, s=>{ data[s.key]=s.val(); emit(); });
  window.$onChildRemoved(r, s=>{ delete data[s.key]; emit(); });
  // Firebase بيضمن إن value بييجي بعد كل child_added بتوع أول تحميل — ومن غير تحميل تاني
  window.$onValue(r, ()=>{ if(!ready){ ready=true; data={...data}; cb(data); } }, {onlyOnce:true});
}

// ============================================================
// CLOCK
// ============================================================
setInterval(()=>{
  const el=document.getElementById('clock');
  if(el) el.textContent=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
},1000);

