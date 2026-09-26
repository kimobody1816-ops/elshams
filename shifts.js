// ============================================================
// SHIFTS UI — صفحة إدارة الورديات وتقاريرها
// ============================================================

function setShiftRange(range){
  const now=new Date(), iso=d=>d.toISOString().slice(0,10);
  let from='', to=iso(now);
  if(range==='today') from=iso(now);
  else if(range==='week'){ const d=new Date(now); d.setDate(d.getDate()-d.getDay()); from=iso(d); }
  else if(range==='month') from=iso(now).slice(0,7)+'-01';
  else { from=''; to=''; }
  document.getElementById('sh-filter-from').value=from;
  document.getElementById('sh-filter-to').value=to;
  renderShifts();
}

// تاريخ + وقت مختصر — الوقت ضروري لتمييز وردية تعبر منتصف الليل
function fShiftMoment(iso){
  if(!iso) return '—';
  try{
    const d=new Date(iso);
    return d.toLocaleDateString('ar-EG',{day:'2-digit',month:'2-digit'})+' '+
           d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return iso; }
}

// هل تتقاطع فترة الوردية مع المدى المطلوب؟
// الوردية قد تبدأ 11 مساءً وتنتهي 3 صباحاً، فلا يصح الاكتفاء بتاريخ الفتح —
// نطابق بالتداخل: تظهر الوردية طالما كان أي جزء منها داخل المدى.
function shiftOverlapsRange(sh, from, to){
  if(!from && !to) return true;
  const start=(sh.openedAt||sh.date||'').slice(0,10);
  // الوردية المفتوحة ممتدة حتى اللحظة الحالية
  const end=(sh.closedAt ? sh.closedAt.slice(0,10) : new Date().toISOString().slice(0,10));
  if(!start) return false;
  if(from && end < from) return false;   // انتهت قبل بداية المدى
  if(to   && start > to) return false;   // بدأت بعد نهاية المدى
  return true;
}

// غير المدير العام يرى وردياته فقط
function visibleShifts(){
  const all=Object.entries(S.shifts||{});
  if(canCloseShifts()) return all;
  return all.filter(([,sh])=>sh.userId===CURRENT_USER?.id);
}

function renderShifts(){
  populateShiftFilters();
  renderMyShiftCard();

  const uF =document.getElementById('sh-filter-user')?.value||'';
  const rF =document.getElementById('sh-filter-role')?.value||'';
  const bF =document.getElementById('sh-filter-branch')?.value||'';
  const stF=document.getElementById('sh-filter-status')?.value||'';
  const from=document.getElementById('sh-filter-from')?.value||'';
  const to  =document.getElementById('sh-filter-to')?.value||'';
  const currency=S.settings?.general?.currency||'EGP';

  const rows=visibleShifts().filter(([,sh])=>{
    return (!uF||sh.userId===uF) && (!rF||sh.role===rF) && (!bF||sh.branchId===bF)
        && (!stF||sh.status===stF) && shiftOverlapsRange(sh, from, to);
  }).sort(([,a],[,b])=>(b.openedAt||'').localeCompare(a.openedAt||''));

  // إحصائيات
  const openCount  =rows.filter(([,s])=>s.status==='open').length;
  const closedCount=rows.filter(([,s])=>s.status==='closed').length;
  let salesSum=0, diffSum=0;
  rows.forEach(([id,sh])=>{
    const t=sh.status==='closed'&&sh.snapshot ? sh.snapshot : shiftTotals(id);
    salesSum+=t.salesTotal||0;
    if(sh.difference!==null&&sh.difference!==undefined) diffSum+=sh.difference;
  });
  const el=id=>document.getElementById(id);
  if(el('sh-stat-open'))   el('sh-stat-open').textContent=openCount;
  if(el('sh-stat-closed')) el('sh-stat-closed').textContent=closedCount;
  if(el('sh-stat-sales'))  el('sh-stat-sales').textContent=salesSum.toFixed(0)+' '+currency;
  if(el('sh-stat-diff')){
    el('sh-stat-diff').textContent=diffSum.toFixed(0)+' '+currency;
    el('sh-stat-diff').style.color = Math.abs(diffSum)<0.01 ? 'var(--green)' : 'var(--red)';
  }
  const closeAllBtn=el('sh-close-all-btn');
  if(closeAllBtn) closeAllBtn.style.display = (canCloseShifts()&&openCount>0) ? '' : 'none';

  const tbody=el('sh-tbl'); if(!tbody) return;
  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text2);">
      <i class="fas fa-user-clock" style="font-size:26px;opacity:.3;display:block;margin-bottom:8px;"></i>لا توجد ورديات مطابقة</td></tr>`;
    return;
  }

  tbody.innerHTML=rows.map(([id,sh])=>{
    const t=sh.status==='closed'&&sh.snapshot ? sh.snapshot : shiftTotals(id);
    const end=sh.closedAt?new Date(sh.closedAt):new Date();
    const mins=Math.max(0,Math.round((end-new Date(sh.openedAt))/60000));
    const dur=`${Math.floor(mins/60)}س ${mins%60}د`;
    const diff=sh.difference;
    return `<tr>
      <td><strong>${sh.userName||'—'}</strong></td>
      <td><span class="badge ${(ROLES[sh.role]||{}).badge||'badge-info'}">${sh.roleLabel||(ROLES[sh.role]||{}).label||'—'}</span></td>
      <td style="font-size:11px;">${sh.branchName||'مركزي'}</td>
      <td style="font-size:11px;color:var(--text2);">${fShiftMoment(sh.openedAt)}</td>
      <td style="font-size:11px;color:var(--text2);">${sh.closedAt?fShiftMoment(sh.closedAt):'—'}</td>
      <td style="font-size:11px;">${dur}</td>
      <td style="font-weight:700;color:var(--accent);">${(t.salesTotal||0).toFixed(0)}</td>
      <td style="color:var(--yellow);">${(t.expTotal||0).toFixed(0)}</td>
      <td style="font-weight:700;color:var(--green);">${(t.cashNet||0).toFixed(0)}</td>
      <td style="font-weight:700;color:${diff===null||diff===undefined?'var(--text3)':Math.abs(diff)<0.01?'var(--green)':'var(--red)'};">
        ${diff===null||diff===undefined?'—':diff.toFixed(2)}</td>
      <td><span class="badge ${sh.status==='open'?'badge-success':'badge-info'}">${SHIFT_STATUS_LABELS[sh.status]||sh.status}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-xs" onclick="openShiftReport('${id}')" title="التقرير التفصيلي"><i class="fas fa-file-alt"></i></button>
        ${sh.status==='open'&&canCloseShifts()
          ? `<button class="btn btn-danger btn-xs" onclick="openCloseShift('${id}')" title="إقفال الوردية"><i class="fas fa-lock"></i></button>`:''}
      </td>
    </tr>`;
  }).join('');
}

function populateShiftFilters(){
  const uSel=document.getElementById('sh-filter-user');
  if(uSel){
    const cur=uSel.value;
    const users=[...new Set(visibleShifts().map(([,sh])=>sh.userId))]
      .map(uid=>[uid,(S.users||{})[uid]?.name||visibleShifts().find(([,s])=>s.userId===uid)?.[1]?.userName||'—']);
    uSel.innerHTML='<option value="">كل المستخدمين</option>'+
      users.map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
    uSel.value=cur;
  }
  const bSel=document.getElementById('sh-filter-branch');
  if(bSel){
    const cur=bSel.value;
    bSel.innerHTML='<option value="">كل الفروع</option>'+
      Object.entries(S.branches||{}).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
    bSel.value=cur;
  }
}

// بطاقة "ورديتي الحالية" أعلى الصفحة
function renderMyShiftCard(){
  const el=document.getElementById('my-shift-card'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  if(!CURRENT_SHIFT){
    el.innerHTML=`<div style="display:flex;align-items:center;gap:12px;">
      <i class="fas fa-info-circle" style="color:var(--text2);font-size:18px;"></i>
      <div style="font-size:13px;color:var(--text2);">لا توجد وردية مفتوحة لك حالياً — ستُفتح تلقائياً عند بدء العمل.</div>
      <button class="btn btn-primary btn-sm" style="margin-right:auto;" onclick="ensureMyShift(true)"><i class="fas fa-play"></i> فتح وردية</button>
    </div>`;
    return;
  }
  const t=shiftTotals(CURRENT_SHIFT.id);
  const mins=Math.round((Date.now()-new Date(CURRENT_SHIFT.openedAt))/60000);
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="width:38px;height:38px;border-radius:10px;background:var(--purple-bg);color:var(--purple);display:flex;align-items:center;justify-content:center;font-size:16px;">
        <i class="fas fa-user-clock"></i>
      </div>
      <div>
        <div style="font-size:14px;font-weight:800;">ورديتي الحالية — ${CURRENT_SHIFT.userName}</div>
        <div style="font-size:11px;color:var(--text2);">
          فُتحت ${fDateShort(CURRENT_SHIFT.openedAt)} • منذ ${Math.floor(mins/60)}س ${mins%60}د • ${CURRENT_SHIFT.branchName||'مركزي'}
        </div>
      </div>
      <div style="margin-right:auto;display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm" onclick="openShiftReport('${CURRENT_SHIFT.id}')"><i class="fas fa-file-alt"></i> تقرير مفصّل</button>
        ${canCloseShifts()?`<button class="btn btn-danger btn-sm" onclick="openCloseShift('${CURRENT_SHIFT.id}')"><i class="fas fa-lock"></i> إقفال ورديتي</button>`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;">
      ${[
        {l:'فواتير',   v:t.counts.sales,                       c:'accent'},
        {l:'مبيعات',   v:t.salesTotal.toFixed(0)+' '+currency,  c:'accent'},
        {l:'محصّل نقداً',v:t.salesPaid.toFixed(0)+' '+currency,  c:'green'},
        {l:'آجل',      v:t.salesCredit.toFixed(0)+' '+currency, c:'red'},
        {l:'مصروفات',  v:t.expTotal.toFixed(0)+' '+currency,    c:'yellow'},
        {l:'مرتجعات',  v:t.retTotal.toFixed(0)+' '+currency,    c:'red'},
        {l:'صافي الخزينة',v:t.cashNet.toFixed(0)+' '+currency,  c:'green'},
        {l:'تحويلات مخزون',v:t.counts.transfers,                c:'purple'},
      ].map(s=>`<div style="background:var(--card2);border-radius:9px;padding:10px;text-align:center;">
        <div style="font-size:15px;font-weight:900;color:var(--${s.c});">${s.v}</div>
        <div style="font-size:10.5px;color:var(--text2);margin-top:2px;">${s.l}</div>
      </div>`).join('')}
    </div>`;
}

function openMyShiftReport(){
  if(!CURRENT_SHIFT){ toast('لا توجد وردية مفتوحة','info'); return; }
  openShiftReport(CURRENT_SHIFT.id);
}

// ── التقرير التفصيلي ──
function openShiftReport(shiftId){
  const sh=(S.shifts||{})[shiftId];
  if(!sh){ toast('الوردية غير موجودة','error'); return; }
  if(!canCloseShifts() && sh.userId!==CURRENT_USER?.id){ toast('لا يمكنك عرض وردية مستخدم آخر','error'); return; }

  window._shiftReportId=shiftId;
  const currency=S.settings?.general?.currency||'EGP';
  const t=sh.status==='closed'&&sh.snapshot ? sh.snapshot : shiftTotals(shiftId);
  const end=sh.closedAt?new Date(sh.closedAt):new Date();
  const mins=Math.max(0,Math.round((end-new Date(sh.openedAt))/60000));

  const money=v=>Number(v||0).toFixed(2)+' '+currency;
  const section=(title,icon,color,rows,cols)=>`
    <div style="margin-bottom:16px;">
      <div class="sec-title mb-3"><div class="sec-dot" style="background:var(--${color})"></div>${title} (${rows.length})</div>
      ${rows.length?`<div class="tbl-wrap"><table><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(([id,v])=>`<tr>${cols.map(c=>`<td style="font-size:11.5px;">${c[1](v,id)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`
      :`<div style="padding:14px;text-align:center;color:var(--text2);font-size:12px;background:var(--card2);border-radius:8px;">لا توجد ${title} في هذه الوردية</div>`}
    </div>`;

  document.getElementById('shift-report-body').innerHTML=`
    <!-- رأس التقرير -->
    <div style="background:var(--card2);border-radius:10px;padding:14px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:12.5px;">
        <div><strong>المستخدم:</strong> ${sh.userName||'—'}</div>
        <div><strong>الدور:</strong> ${sh.roleLabel||(ROLES[sh.role]||{}).label||'—'}</div>
        <div><strong>الفرع:</strong> ${sh.branchName||'مركزي'}</div>
        <div><strong>الفتح:</strong> ${fDate(sh.openedAt)}</div>
        <div><strong>الإقفال:</strong> ${sh.closedAt?fDate(sh.closedAt):'ما زالت مفتوحة'}</div>
        <div><strong>المدة:</strong> ${Math.floor(mins/60)}س ${mins%60}د</div>
        <div><strong>الحالة:</strong> <span class="badge ${sh.status==='open'?'badge-success':'badge-info'}">${SHIFT_STATUS_LABELS[sh.status]}</span></div>
        ${sh.closedByName?`<div><strong>أقفلها:</strong> ${sh.closedByName}</div>`:''}
      </div>
    </div>

    <!-- ملخص الأرقام -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px;">
      ${[
        {l:'إجمالي المبيعات', v:money(t.salesTotal), c:'accent'},
        {l:'المحصّل',        v:money(t.salesPaid),  c:'green'},
        {l:'آجل (دين)',      v:money(t.salesCredit),c:'red'},
        {l:'تكلفة المبيعات', v:money(t.salesCost),  c:'yellow'},
        {l:'مجمل الربح',     v:money(t.grossProfit),c:'green'},
        {l:'المشتريات',      v:money(t.purchTotal), c:'purple'},
        {l:'المصروفات',      v:money(t.expTotal),   c:'yellow'},
        {l:'المرتجعات',      v:money(t.retTotal),   c:'red'},
        {l:'وارد الخزائن',   v:money(t.cashIn),     c:'green'},
        {l:'منصرف الخزائن',  v:money(t.cashOut),    c:'red'},
        {l:'صافي النقدية',   v:money(t.cashNet),    c:'accent'},
        {l:'نقدية البداية',  v:money(sh.openingCash),c:'text2'},
      ].map(s=>`<div style="background:var(--card2);border-radius:9px;padding:11px;text-align:center;">
        <div style="font-size:14px;font-weight:900;color:var(--${s.c});">${s.v}</div>
        <div style="font-size:10.5px;color:var(--text2);margin-top:3px;">${s.l}</div>
      </div>`).join('')}
    </div>

    ${sh.status==='closed'?`
    <div style="background:${Math.abs(sh.difference||0)<0.01?'var(--green-bg)':'var(--red-bg)'};border:1px solid ${Math.abs(sh.difference||0)<0.01?'var(--green)':'var(--red)'};border-radius:10px;padding:12px;margin-bottom:16px;font-size:12.5px;line-height:1.9;">
      <strong>جرد الإقفال:</strong>
      المتوقع ${money(sh.expectedCash)} •
      المعدود ${sh.closingCash===null||sh.closingCash===undefined?'لم يُعد':money(sh.closingCash)} •
      الفرق <strong>${sh.difference===null||sh.difference===undefined?'—':money(sh.difference)}</strong>
      ${sh.closeNotes?`<br><strong>ملاحظات:</strong> ${sh.closeNotes}`:''}
    </div>`:''}

    ${section('المبيعات','fa-cash-register','accent', shiftRecords(shiftId,'sales'), [
      ['رقم الفاتورة', v=>v.invNumber||'—'],
      ['الوقت',       v=>new Date(v.createdAt).toLocaleTimeString('ar-EG')],
      ['العميل',      v=>v.customer||v.custName||'نقدي'],
      ['نوع البيع',   v=>SALE_MODE_LABEL(v.saleMode)],
      ['الدفع',       v=>INV_PAY_NAMES[v.payMethod]||v.payMethod||'—'],
      ['الإجمالي',    v=>money(v.total)],
      ['المتبقي',     v=>(+v.balance||0)>0?`<span style="color:var(--red);">${money(v.balance)}</span>`:'—'],
    ])}

    ${section('المشتريات','fa-shopping-cart','purple', shiftRecords(shiftId,'purchaseOrders'), [
      ['رقم الأمر',  v=>v.poNumber||'—'],
      ['المورد',     v=>(S.suppliers||{})[v.supplierId]?.name||'—'],
      ['الأصناف',    v=>(v.items||[]).length],
      ['الإجمالي',   v=>money(v.total)],
      ['الحالة',     v=>v.status||'—'],
    ])}

    ${section('المصروفات','fa-money-bill','yellow', shiftRecords(shiftId,'expenses'), [
      ['البيان',   v=>v.desc||'—'],
      ['التصنيف',  v=>v.category||'—'],
      ['المبلغ',   v=>money(v.amount)],
      ['الوقت',    v=>new Date(v.createdAt).toLocaleTimeString('ar-EG')],
    ])}

    ${section('المرتجعات','fa-undo','red', shiftRecords(shiftId,'returns'), [
      ['النوع',   v=>v.type==='sale'?'مبيعات':'مشتريات'],
      ['الطرف',   v=>v.partyName||'—'],
      ['الأصناف', v=>(v.items||[]).length],
      ['الإجمالي',v=>money(v.total)],
      ['السبب',   v=>RETURN_REASONS[v.reason]||v.reason||'—'],
    ])}

    ${section('حركات الخزائن','fa-vault','green', shiftRecords(shiftId,'cashboxLog'), [
      ['الخزينة', v=>v.cbName||'—'],
      ['النوع',   v=>v.type==='deposit'?'<span style="color:var(--green);">إيداع</span>':'<span style="color:var(--red);">صرف</span>'],
      ['المبلغ',  v=>money(v.amount)],
      ['البيان',  v=>v.desc||'—'],
      ['الرصيد بعدها', v=>money(v.balanceAfter)],
    ])}

    ${section('تحويلات المخزون','fa-truck','purple', shiftRecords(shiftId,'stockTransfers'), [
      ['من',      v=>v.fromName||'—'],
      ['إلى',     v=>v.toName||'—'],
      ['الأصناف', v=>(v.items||[]).length],
      ['الحالة',  v=>v.status||'—'],
      ['التاريخ', v=>v.date||'—'],
    ])}

    ${section('حركات المخزن','fa-boxes','accent', shiftRecords(shiftId,'movements'), [
      ['المنتج', v=>v.product||'—'],
      ['النوع',  v=>v.type==='in'?'<span style="color:var(--green);">وارد</span>':'<span style="color:var(--red);">صادر</span>'],
      ['الكمية', v=>v.qty||0],
      ['البيان', v=>v.note||'—'],
    ])}
  `;

  const closeBtn=document.getElementById('shift-report-close-btn');
  closeBtn.style.display = (sh.status==='open'&&canCloseShifts()) ? '' : 'none';
  openModal('modal-shift-report');
}

function printShiftReport(){
  const body=document.getElementById('shift-report-body');
  if(!body){ toast('لا يوجد تقرير','error'); return; }
  const sh=(S.shifts||{})[window._shiftReportId]||{};
  const g=S.settings?.general||{};
  const w=window.open('','_blank','width=1000,height=760');
  if(!w){ toast('يرجى السماح بالنوافذ المنبثقة','error'); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>تقرير وردية ${sh.userName||''}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:10mm;}
  body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;color:#111;font-size:11px;padding:12px;}
  h1{font-size:17px;margin-bottom:4px;}
  .meta{font-size:11px;color:#555;margin-bottom:14px;border-bottom:2px solid #111;padding-bottom:8px;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  th{background:#f2f2f2;border:1px solid #999;padding:5px 7px;text-align:right;font-size:10.5px;}
  td{border:1px solid #ccc;padding:4px 7px;text-align:right;font-size:10.5px;}
  .sec-title{font-weight:800;font-size:12.5px;margin:10px 0 6px;border-right:3px solid #111;padding-right:7px;}
  .sec-dot,button{display:none!important;}
  .badge{border:1px solid #999;border-radius:8px;padding:1px 6px;font-size:9.5px;}
</style></head><body>
<h1>${g.name||g.sysName||'الشمس'} — تقرير وردية</h1>
<div class="meta">${sh.userName||''} (${sh.roleLabel||''}) • ${sh.branchName||''} • طُبع ${new Date().toLocaleString('ar-EG')}</div>
${body.innerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body></html>`);
  w.document.close();
}

// ── إقفال الوردية ──
function openCloseShift(shiftId){
  if(!canCloseShifts()){ toast('إقفال الورديات من صلاحية المدير العام فقط','error'); return; }
  const sh=(S.shifts||{})[shiftId];
  if(!sh){ toast('الوردية غير موجودة','error'); return; }
  if(sh.status==='closed'){ toast('الوردية مقفلة بالفعل','info'); return; }

  window._closingShiftId=shiftId;
  const currency=S.settings?.general?.currency||'EGP';
  const t=shiftTotals(shiftId);
  const expected=(+sh.openingCash||0)+t.cashIn-t.cashOut;
  window._closingExpected=expected;

  document.getElementById('cls-summary').innerHTML=`
    <div><strong>الوردية:</strong> ${sh.userName} — ${sh.roleLabel||''} — ${sh.branchName||'مركزي'}</div>
    <div><strong>عدد الفواتير:</strong> ${t.counts.sales} • <strong>المبيعات:</strong> ${t.salesTotal.toFixed(2)} ${currency}</div>
    <div><strong>نقدية البداية:</strong> ${(+sh.openingCash||0).toFixed(2)} ${currency}</div>
    <div><strong>وارد الخزائن:</strong> ${t.cashIn.toFixed(2)} • <strong>منصرف:</strong> ${t.cashOut.toFixed(2)} ${currency}</div>
    <div style="color:var(--accent);font-weight:800;"><strong>النقدية المتوقعة:</strong> ${expected.toFixed(2)} ${currency}</div>`;
  document.getElementById('cls-counted').value='';
  document.getElementById('cls-notes').value='';
  document.getElementById('cls-diff').textContent='';
  closeModal('modal-shift-report');
  openModal('modal-close-shift');
}

function updateClsDiff(){
  const raw=(document.getElementById('cls-counted')?.value||'').trim();
  const el=document.getElementById('cls-diff'); if(!el) return;
  if(raw===''){ el.textContent=''; return; }
  const currency=S.settings?.general?.currency||'EGP';
  const diff=(parseFloat(raw)||0)-(window._closingExpected||0);
  const ok=Math.abs(diff)<0.01;
  el.textContent = ok ? 'مطابق تماماً ✅'
    : `${diff>0?'زيادة':'عجز'} ${Math.abs(diff).toFixed(2)} ${currency}`;
  el.style.color = ok?'var(--green)':'var(--red)';
}

async function confirmCloseShift(){
  const id=window._closingShiftId; if(!id) return;
  const raw=(document.getElementById('cls-counted')?.value||'').trim();
  const notes=(document.getElementById('cls-notes')?.value||'').trim();
  const btn=document.getElementById('cls-confirm-btn');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري الإقفال...';
  try{
    await closeShiftById(id,{closingCash: raw===''?null:raw, notes});
    closeModal('modal-close-shift');
    renderShifts();
    toast('تم إقفال الوردية ✅','success');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
  finally{ btn.disabled=false; btn.innerHTML='<i class="fas fa-lock"></i> تأكيد الإقفال'; }
}

// إقفال كل الورديات المفتوحة دفعة واحدة (نهاية اليوم)
async function closeAllOpenShifts(){
  if(!canCloseShifts()){ toast('إقفال الورديات من صلاحية المدير العام فقط','error'); return; }
  const open=Object.entries(S.shifts||{}).filter(([,sh])=>sh.status==='open');
  if(!open.length){ toast('لا توجد ورديات مفتوحة','info'); return; }
  const ok=await confirm2(
    `سيتم إقفال ${open.length} وردية مفتوحة بدون جرد نقدية. الورديات المقفلة لا تُفتح مرة أخرى.`,
    'إقفال كل الورديات','🔒','إقفال الكل','btn-danger');
  if(!ok) return;
  let done=0, failed=0;
  for(const [id] of open){
    try{ await closeShiftById(id,{closingCash:null,notes:'إقفال جماعي في نهاية اليوم'}); done++; }
    catch(e){ failed++; console.warn('close shift failed',id,e); }
  }
  renderShifts();
  toast(failed?`أُقفلت ${done} وردية — ${failed} فشلت`:`تم إقفال ${done} وردية ✅`, failed?'warning':'success');
}

// ── تصدير Excel ──
function exportShiftsExcel(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const currency=S.settings?.general?.currency||'EGP';
  const rows=visibleShifts().sort(([,a],[,b])=>(b.openedAt||'').localeCompare(a.openedAt||''));
  if(!rows.length){ toast('لا توجد ورديات للتصدير','warning'); return; }
  const wb=XLSX.utils.book_new();
  const head=[['المستخدم','الدور','الفرع','الفتح','الإقفال','أقفلها','الحالة',
               'فواتير','مبيعات ('+currency+')','محصّل','آجل','تكلفة','مجمل الربح',
               'مشتريات','مصروفات','مرتجعات','وارد خزائن','منصرف خزائن','صافي النقدية',
               'نقدية البداية','المتوقع','المعدود','الفرق','ملاحظات']];
  const data=rows.map(([id,sh])=>{
    const t=sh.status==='closed'&&sh.snapshot?sh.snapshot:shiftTotals(id);
    return [sh.userName||'—', sh.roleLabel||'—', sh.branchName||'مركزي',
      sh.openedAt||'', sh.closedAt||'—', sh.closedByName||'—', SHIFT_STATUS_LABELS[sh.status]||'',
      t.counts.sales, +t.salesTotal.toFixed(2), +t.salesPaid.toFixed(2), +t.salesCredit.toFixed(2),
      +t.salesCost.toFixed(2), +t.grossProfit.toFixed(2),
      +t.purchTotal.toFixed(2), +t.expTotal.toFixed(2), +t.retTotal.toFixed(2),
      +t.cashIn.toFixed(2), +t.cashOut.toFixed(2), +t.cashNet.toFixed(2),
      +(+sh.openingCash||0).toFixed(2),
      sh.expectedCash!==undefined&&sh.expectedCash!==null?+sh.expectedCash.toFixed(2):'—',
      sh.closingCash!==undefined&&sh.closingCash!==null?+sh.closingCash.toFixed(2):'—',
      sh.difference!==undefined&&sh.difference!==null?+sh.difference.toFixed(2):'—',
      sh.closeNotes||''];
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([...head,...data]),'الورديات');
  XLSX.writeFile(wb,`الورديات-الشمس-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ تم تصدير الورديات');
}

// تصدير تفصيلي لوردية واحدة — ورقة لكل نوع عملية
function exportShiftReportExcel(shiftId){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const sh=(S.shifts||{})[shiftId]; if(!sh){ toast('الوردية غير موجودة','error'); return; }
  const currency=S.settings?.general?.currency||'EGP';
  const t=sh.status==='closed'&&sh.snapshot?sh.snapshot:shiftTotals(shiftId);
  const wb=XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['تقرير وردية'],[''],
    ['المستخدم',sh.userName||'—'], ['الدور',sh.roleLabel||'—'], ['الفرع',sh.branchName||'مركزي'],
    ['الفتح',sh.openedAt||''], ['الإقفال',sh.closedAt||'ما زالت مفتوحة'],
    ['الحالة',SHIFT_STATUS_LABELS[sh.status]||''],[''],
    ['البند','القيمة ('+currency+')'],
    ['إجمالي المبيعات',+t.salesTotal.toFixed(2)],
    ['المحصّل',        +t.salesPaid.toFixed(2)],
    ['آجل (دين)',      +t.salesCredit.toFixed(2)],
    ['تكلفة المبيعات', +t.salesCost.toFixed(2)],
    ['مجمل الربح',     +t.grossProfit.toFixed(2)],
    ['المشتريات',      +t.purchTotal.toFixed(2)],
    ['المصروفات',      +t.expTotal.toFixed(2)],
    ['المرتجعات',      +t.retTotal.toFixed(2)],
    ['وارد الخزائن',   +t.cashIn.toFixed(2)],
    ['منصرف الخزائن',  +t.cashOut.toFixed(2)],
    ['صافي النقدية',   +t.cashNet.toFixed(2)],
  ]),'الملخص');

  const sheets=[
    ['المبيعات','sales',['رقم الفاتورة','الوقت','العميل','نوع البيع','الدفع','الإجمالي','المدفوع','المتبقي'],
      v=>[v.invNumber||'—',v.createdAt||'',v.customer||v.custName||'نقدي',SALE_MODE_LABEL(v.saleMode),
          v.payMethod||'—',+v.total||0,+v.amountPaid||0,+v.balance||0]],
    ['المشتريات','purchaseOrders',['رقم الأمر','المورد','الأصناف','الإجمالي','الحالة'],
      v=>[v.poNumber||'—',(S.suppliers||{})[v.supplierId]?.name||'—',(v.items||[]).length,+v.total||0,v.status||'—']],
    ['المصروفات','expenses',['البيان','التصنيف','المبلغ','الوقت'],
      v=>[v.desc||'—',v.category||'—',+v.amount||0,v.createdAt||'']],
    ['المرتجعات','returns',['النوع','الطرف','الأصناف','الإجمالي','السبب'],
      v=>[v.type==='sale'?'مبيعات':'مشتريات',v.partyName||'—',(v.items||[]).length,+v.total||0,
          RETURN_REASONS[v.reason]||v.reason||'—']],
    ['حركات الخزائن','cashboxLog',['الخزينة','النوع','المبلغ','البيان','الرصيد بعدها'],
      v=>[v.cbName||'—',v.type==='deposit'?'إيداع':'صرف',+v.amount||0,v.desc||'—',+v.balanceAfter||0]],
    ['تحويلات المخزون','stockTransfers',['من','إلى','الأصناف','الحالة','التاريخ'],
      v=>[v.fromName||'—',v.toName||'—',(v.items||[]).length,v.status||'—',v.date||'—']],
    ['حركات المخزن','movements',['المنتج','النوع','الكمية','البيان','التاريخ'],
      v=>[v.product||'—',v.type==='in'?'وارد':'صادر',+v.qty||0,v.note||'—',v.date||'']],
  ];
  sheets.forEach(([name,store,cols,mapFn])=>{
    const recs=shiftRecords(shiftId,store);
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([cols, ...recs.map(([,v])=>mapFn(v))]), name);
  });

  XLSX.writeFile(wb,`وردية-${(sh.userName||'').replace(/\s/g,'_')}-${(sh.date||'').slice(0,10)}.xlsx`);
  toast('✅ تم تصدير تقرير الوردية');
}

