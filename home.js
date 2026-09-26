// ============================================================
// HOME / DASHBOARD
// ============================================================
function renderHome(){
  renderHomeStats();
  renderSystemInfo();
}

// ── تنسيق الأرقام مع فواصل الآلاف ──
function fmtNum(n){ return Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0}); }

// ── فترة لوحة التحكم ──
let DASH_PERIOD='today';
const DASH_PERIOD_LABELS={today:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر',year:'هذه السنة',all:'كل الفترات',custom:'فترة مخصصة'};

function setDashPeriod(p){
  DASH_PERIOD=p;
  document.querySelectorAll('.dash-period-btn').forEach(b=>b.classList.toggle('active',b.dataset.period===p));
  const range=document.getElementById('dash-custom-range');
  if(range) range.style.display = p==='custom' ? 'flex' : 'none';
  if(p==='custom'){
    const from=document.getElementById('dash-from'), to=document.getElementById('dash-to');
    if(from&&!from.value) from.value=new Date(Date.now()-29*864e5).toISOString().slice(0,10);
    if(to&&!to.value)     to.value  =new Date().toISOString().slice(0,10);
  }
  renderHomeStats();
}

// يرجّع {from,to} كتواريخ ISO (YYYY-MM-DD)؛ null = بدون حد
function getDashDateRange(){
  const now=new Date();
  const iso=d=>d.toISOString().slice(0,10);
  switch(DASH_PERIOD){
    case 'today': return {from:iso(now), to:iso(now)};
    case 'week': {
      const d=new Date(now); d.setDate(d.getDate()-d.getDay()); // الأسبوع يبدأ الأحد
      return {from:iso(d), to:iso(now)};
    }
    case 'month': return {from:iso(now).slice(0,7)+'-01', to:iso(now)};
    case 'year':  return {from:iso(now).slice(0,4)+'-01-01', to:iso(now)};
    case 'custom':
      return {from:document.getElementById('dash-from')?.value||null,
              to:  document.getElementById('dash-to')?.value||null};
    default: return {from:null, to:null};
  }
}

function inDashRange(dateStr){
  const {from,to}=getDashDateRange();
  const d=(dateStr||'').slice(0,10);
  if(!d) return false;
  if(from && d<from) return false;
  if(to   && d>to)   return false;
  return true;
}

function renderHomeStats(){
  const el=document.getElementById('home-stats'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  const today=new Date().toISOString().slice(0,10);
  const monthKey=today.slice(0,7);
  const saleDate=s=>(s.date||s.createdAt||'').slice(0,10);

  const lblEl=document.getElementById('dash-period-label');
  if(lblEl) lblEl.textContent=DASH_PERIOD_LABELS[DASH_PERIOD]||'اليوم';

  const sales      =Object.values(S.sales||{});
  const periodSales=sales.filter(s=>inDashRange(saleDate(s)));
  const periodRev  =periodSales.reduce((t,s)=>t+(+s.total||0),0);
  const periodExp  =Object.values(S.expenses||{}).filter(e=>inDashRange(e.date||e.createdAt)).reduce((t,e)=>t+(+e.amount||0),0);
  const periodProfit=periodRev-periodExp;
  const periodLbl  =DASH_PERIOD_LABELS[DASH_PERIOD]||'اليوم';

  // مبيعات الشهر تظل ثابتة كمرجع مقارنة
  const monthSales=sales.filter(s=>saleDate(s).slice(0,7)===monthKey);
  const monthRev  =monthSales.reduce((t,s)=>t+(+s.total||0),0);

  // ── الصف الأول: المؤشرات الرئيسية ──
  el.innerHTML=[
    {label:'مبيعات '+periodLbl,  value:fmtNum(periodRev)+' '+currency,   icon:'fas fa-sun',                 color:'green',                       sub:periodSales.length+' فاتورة'},
    {label:'مبيعات الشهر',       value:fmtNum(monthRev)+' '+currency,    icon:'fas fa-calendar-alt',        color:'blue',                        sub:monthSales.length+' فاتورة هذا الشهر'},
    {label:'مصروفات '+periodLbl, value:fmtNum(periodExp)+' '+currency,   icon:'fas fa-file-invoice-dollar', color:'yellow',                      sub:'إجمالي المصروفات'},
    {label:'صافي ربح '+periodLbl,value:fmtNum(periodProfit)+' '+currency,icon:'fas fa-chart-line',          color:periodProfit>=0?'green':'red', sub:'المبيعات − المصروفات'},
  ].map(s=>`
    <div class="stat-card ${s.color}">
      <div class="stat-icon"><i class="${s.icon}"></i></div>
      <div class="stat-value" style="font-size:19px;">${s.value}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>`).join('');

  // ── الصف الثاني: مؤشرات مالية وتشغيلية (قابلة للنقر) ──
  const el2=document.getElementById('home-stats-2');
  if(el2){
    const cashTotal =Object.values(S.cashboxes||{}).reduce((t,c)=>t+(+c.balance||0),0);
    const custDebt  =Object.values(S.customers||{}).reduce((t,c)=>t+(+c.balance||0),0);
    const supDebt   =Object.values(S.purchaseOrders||{}).reduce((t,p)=>t+(+p.balance||0),0);
    const prods     =Object.values(S.products||{});
    const stockValue=prods.reduce((t,p)=>t+(+p.qty||0)*(+p.cost||0),0);
    const lowCount  =prods.filter(p=>p.status==='active'&&(+p.qty||0)>0&&(+p.qty||0)<=(+p.minQty||+p.min||5)).length;
    const outCount  =prods.filter(p=>p.status==='active'&&(+p.qty||0)===0).length;
    const unpaidInv =sales.filter(s=>(+s.balance||0)>0).length;
    const pendingTr =Object.values(S.stockTransfers||{}).filter(t=>['pending','counting','discrepancy','investigating'].includes(t.status)).length;
    const monthRet  =Object.values(S.returns||{}).filter(r=>(r.date||r.createdAt||'').slice(0,7)===monthKey).reduce((t,r)=>t+(+r.total||0),0);
    el2.innerHTML=[
      {label:'رصيد الخزائن',        value:fmtNum(cashTotal)+' '+currency,  icon:'fas fa-vault',             color:'green',  page:'cashboxes'},
      {label:'ديون العملاء (لنا)',   value:fmtNum(custDebt)+' '+currency,   icon:'fas fa-hand-holding-usd', color:'red',    page:'debts'},
      {label:'ديوننا للموردين',      value:fmtNum(supDebt)+' '+currency,    icon:'fas fa-truck',            color:'yellow', page:'debts'},
      {label:'قيمة المخزون (تكلفة)', value:fmtNum(stockValue)+' '+currency, icon:'fas fa-boxes',            color:'purple', page:'warehouse'},
      {label:'فواتير غير مسددة',     value:unpaidInv,                       icon:'fas fa-file-invoice',     color:'orange', page:'debts'},
      {label:'تنبيهات المخزون',      value:outCount+' نفاد / '+lowCount+' منخفض', icon:'fas fa-exclamation-triangle', color:(outCount||lowCount)?'red':'green', page:'warehouse'},
      {label:'مرتجعات الشهر',        value:fmtNum(monthRet)+' '+currency,   icon:'fas fa-undo-alt',         color:'red',    page:'returns'},
      {label:'تحويلات قيد التنفيذ',  value:pendingTr,                       icon:'fas fa-truck-moving',     color:pendingTr?'yellow':'blue', page:'transfers'},
    ].map(s=>`
      <div class="stat-card ${s.color}" onclick="nav('${s.page}')" style="cursor:pointer;" title="اضغط للانتقال">
        <div class="stat-icon"><i class="${s.icon}"></i></div>
        <div class="stat-value" style="font-size:15px;">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');
  }

  // ── الصف الثالث: عدادات سريعة ──
  const el3=document.getElementById('home-stats-3');
  if(el3){
    const usersCount   =Object.values(S.users||{}).filter(u=>!u.hidden).length;
    const branchesCount=Object.values(S.branches||{}).filter(b=>b.status==='active').length;
    el3.innerHTML=[
      {label:'العملاء',       value:Object.keys(S.customers||{}).length, icon:'fas fa-users',     color:'blue',   page:'customers'},
      {label:'المنتجات',      value:Object.keys(S.products||{}).length,  icon:'fas fa-box',       color:'purple', page:'warehouse'},
      {label:'الفروع النشطة', value:branchesCount,                       icon:'fas fa-building',  color:'green',  page:'branches'},
      {label:'المستخدمون',    value:usersCount,                          icon:'fas fa-users-cog', color:'yellow', page:'users'},
    ].map(s=>`
      <div class="stat-card ${s.color}" onclick="nav('${s.page}')" style="cursor:pointer;padding:13px 16px;" title="اضغط للانتقال">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="stat-icon" style="margin-bottom:0;width:34px;height:34px;font-size:14px;"><i class="${s.icon}"></i></div>
          <div>
            <div class="stat-value" style="font-size:18px;">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        </div>
      </div>`).join('');
  }

  renderHomeWeekChart(sales,currency,today);
  renderHomeTopProducts(monthSales,currency);
  renderHomeBranches(sales,currency,today,monthKey);
  renderHomeStockAlerts();
  renderHomeRecentSales(currency);
  renderHomeCashMoves(currency);
}

// ── مبيعات آخر 7 أيام (رسم أعمدة) ──
function renderHomeWeekChart(sales,currency,today){
  const el=document.getElementById('home-week-chart'); if(!el) return;
  const saleDate=s=>(s.date||s.createdAt||'').slice(0,10);
  const days=[...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
  const totals=days.map(d=>sales.filter(s=>saleDate(s)===d).reduce((t,s)=>t+(+s.total||0),0));
  const max=Math.max(...totals,1);
  el.innerHTML=days.map((d,i)=>{
    const val=totals[i];
    const h=Math.max(5,Math.round(val/max*115));
    const isToday=d===today;
    const label=new Date(d+'T12:00:00').toLocaleDateString('ar-EG',{weekday:'short'});
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%;">
      <div style="font-size:9.5px;font-weight:700;color:${isToday?'var(--accent)':'var(--text2)'};">${val>=1000?(val/1000).toFixed(1)+'k':fmtNum(val)}</div>
      <div style="width:100%;max-width:36px;height:${h}px;border-radius:7px 7px 2px 2px;background:${isToday?'var(--accent)':'var(--accent-bg)'};border:1px solid ${isToday?'var(--accent)':'var(--border)'};" title="${d} — ${val.toFixed(2)} ${currency}"></div>
      <div style="font-size:10px;font-weight:${isToday?'900':'600'};color:${isToday?'var(--accent)':'var(--text3)'};">${label}</div>
    </div>`;
  }).join('');
}

// ── أعلى المنتجات مبيعاً هذا الشهر ──
function renderHomeTopProducts(monthSales,currency){
  const el=document.getElementById('home-top-products'); if(!el) return;
  const stats={};
  monthSales.forEach(s=>(s.items||[]).forEach(i=>{
    const k=i.name||'—';
    if(!stats[k]) stats[k]={qty:0,total:0};
    stats[k].qty+=+i.qty||0;
    stats[k].total+=(+i.total||((+i.qty||0)*(+i.price||0)));
  }));
  const top=Object.entries(stats).sort(([,a],[,b])=>b.total-a.total).slice(0,5);
  if(!top.length){ el.innerHTML=`<div style="text-align:center;padding:26px;color:var(--text2);font-size:12px;">لا توجد مبيعات هذا الشهر بعد</div>`; return; }
  el.innerHTML=top.map(([name,d],i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border2);">
      <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'var(--yellow-bg)':'var(--accent-bg)'};color:${i===0?'var(--yellow)':'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;">${i+1}</div>
      <div style="flex:1;font-size:12.5px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
      <div style="font-size:11px;color:var(--text2);">${d.qty} وحدة</div>
      <div style="font-size:12px;font-weight:700;color:var(--accent);">${fmtNum(d.total)} ${currency}</div>
    </div>`).join('');
}

// ── أداء الفروع ──
function renderHomeBranches(sales,currency,today,monthKey){
  const tbody=document.getElementById('home-branches-tbl'); if(!tbody) return;
  const saleDate=s=>(s.date||s.createdAt||'').slice(0,10);
  const branches=Object.entries(S.branches||{});
  if(!branches.length){ tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;padding:22px;color:var(--text2);">لا توجد فروع</td></tr>`; return; }
  const rows=branches.map(([id,b])=>{
    const brSales=sales.filter(s=>s.branchId===id);
    const dayRev=brSales.filter(s=>saleDate(s)===today).reduce((t,s)=>t+(+s.total||0),0);
    const monRev=brSales.filter(s=>saleDate(s).slice(0,7)===monthKey).reduce((t,s)=>t+(+s.total||0),0);
    const debt=Object.values(S.customers||{}).filter(c=>c.branchId===id).reduce((t,c)=>t+(+c.balance||0),0);
    return {name:b.name,status:b.status,dayRev,monRev,debt};
  }).sort((a,b)=>b.monRev-a.monRev);
  tbody.innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.name}</strong></td>
    <td style="color:var(--green);font-weight:700;">${fmtNum(r.dayRev)} ${currency}</td>
    <td style="color:var(--accent);font-weight:700;">${fmtNum(r.monRev)} ${currency}</td>
    <td style="color:${r.debt>0?'var(--red)':'var(--text3)'};">${fmtNum(r.debt)} ${currency}</td>
    <td><span class="badge ${r.status==='active'?'badge-success':'badge-danger'}">${r.status==='active'?'نشط':'معطل'}</span></td>
  </tr>`).join('');
}

// ── تنبيهات المخزون ──
function renderHomeStockAlerts(){
  const el=document.getElementById('home-stock-alerts'); if(!el) return;
  const prods=Object.values(S.products||{}).filter(p=>p.status==='active');
  const out=prods.filter(p=>(+p.qty||0)===0);
  const low=prods.filter(p=>(+p.qty||0)>0&&(+p.qty||0)<=(+p.minQty||+p.min||5));
  const list=[...out.map(p=>({p,type:'out'})),...low.map(p=>({p,type:'low'}))];
  if(!list.length){ el.innerHTML=`<div style="text-align:center;padding:26px;color:var(--green);font-size:13px;font-weight:700;"><i class="fas fa-check-circle" style="font-size:26px;display:block;margin-bottom:8px;"></i>المخزون بحالة جيدة 🎉</div>`; return; }
  el.innerHTML=list.slice(0,8).map(({p,type})=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);">
      <div style="font-size:17px;">${p.emoji||'📦'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
        <div style="font-size:10.5px;color:var(--text3);">${getBranchName(p.branchId||p.branch)||'مركزي'}${p.warehouseName?' — '+p.warehouseName:''}</div>
      </div>
      <span class="badge ${type==='out'?'badge-danger':'badge-warning'}">${type==='out'?'نفاد':'منخفض: '+(+p.qty||0)}</span>
    </div>`).join('')
    +(list.length>8?`<div style="text-align:center;padding-top:8px;font-size:11px;color:var(--text2);">و ${list.length-8} منتج آخر يحتاج متابعة...</div>`:'');
}

// ── آخر الفواتير ──
function renderHomeRecentSales(currency){
  const el=document.getElementById('home-recent-sales'); if(!el) return;
  const rows=Object.entries(S.sales||{}).sort(([,a],[,b])=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0)).slice(0,8);
  if(!rows.length){ el.innerHTML=`<div style="text-align:center;padding:26px;color:var(--text2);font-size:12px;">لا توجد فواتير بعد</div>`; return; }
  el.innerHTML=rows.map(([id,s])=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer;" onclick="viewSaleDetail('${id}')" title="عرض الفاتورة">
      <div style="width:30px;height:30px;border-radius:8px;background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;"><i class="fas fa-${s.type==='pos'?'cash-register':'file-invoice'}"></i></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.customer||s.custName||s.customerName||'نقدي'} <span style="color:var(--text3);font-size:10px;font-weight:400;">#${String(s.invNumber||id.slice(-5)).toUpperCase()}</span></div>
        <div style="font-size:10.5px;color:var(--text3);">${s.branchName||getBranchName(s.branchId)||'مركزي'} — ${fDateShort(s.createdAt||s.date)}</div>
      </div>
      ${(+s.balance||0)>0?`<span class="badge badge-danger" style="font-size:9.5px;">متبقي ${fmtNum(s.balance)}</span>`:''}
      <div style="font-size:13px;font-weight:900;color:var(--accent);">${fmtNum(s.total)} ${currency}</div>
    </div>`).join('');
}

// ── آخر حركات الخزائن ──
function renderHomeCashMoves(currency){
  const el=document.getElementById('home-cash-moves'); if(!el) return;
  const rows=Object.values(S.cashboxLog||{}).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,6);
  if(!rows.length){ el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px;">لا توجد حركات بعد</div>`; return; }
  el.innerHTML=rows.map(l=>`
    <div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid var(--border2);">
      <span style="font-size:12px;font-weight:900;color:${l.type==='deposit'?'var(--green)':'var(--red)'};min-width:70px;">${l.type==='deposit'?'+':'-'}${fmtNum(l.amount)} ${currency}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.desc||'—'}</div>
        <div style="font-size:10px;color:var(--text3);">${(S.cashboxes||{})[l.cbId]?.name||l.cbName||'—'} — ${fDateShort(l.date||l.createdAt)}</div>
      </div>
    </div>`).join('');
}

function renderSystemInfo(){
  const el=document.getElementById('system-info-panel');
  if(!el) return;
  const settings=S.settings?.general||{};
  const items=[
    {icon:'fas fa-store',    label:'اسم المنشأة',  value:settings.name||'غير محدد'},
    {icon:'fas fa-coins',    label:'العملة',       value:settings.currency||'EGP'},
    {icon:'fas fa-percent',  label:'الضريبة (VAT)',value:(settings.vat||0)+'%'},
    {icon:'fas fa-receipt',  label:'بادئة الفاتورة',value:settings.invPrefix||'INV-'},
    {icon:'fas fa-database', label:'قاعدة البيانات',value:'Firebase متصل ✅'},
    {icon:'fas fa-user-shield',label:'الدور الحالي', value:(ROLES[CURRENT_USER?.role]||{}).label||'-'},
  ];
  el.innerHTML=items.map(i=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);">
      <i class="${i.icon}" style="color:var(--accent);width:16px;text-align:center;flex-shrink:0;"></i>
      <span style="font-size:12px;color:var(--text2);flex:1;">${i.label}</span>
      <span style="font-size:12.5px;font-weight:600;">${i.value}</span>
    </div>`).join('');
}

