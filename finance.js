// ============================================================
// FINANCE
// ============================================================
function renderFinance(){ renderFinStats(); renderSalesHistory(); renderExpenses(); renderFinReport(); populateFinBranches(); }
function finTab(t){
  document.querySelectorAll('#pg-finance .tab-btn').forEach((b,i)=>b.classList.toggle('active',['sales','expenses','report'][i]===t));
  document.querySelectorAll('#pg-finance .tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('fint-'+t)?.classList.add('active');
  if(t==='sales') renderSalesHistory();
  if(t==='expenses'){renderExpenses();populateExpBranch();}
  if(t==='report') renderFinReport();
}
function populateFinBranches(){
  ['fin-branch-filter','exp-branch'].forEach(selId=>{
    const el=document.getElementById(selId); if(!el) return;
    el.innerHTML='<option value="">كل الفروع</option>';
    Object.entries(S.branches||{}).forEach(([id,b])=>{
      const o=document.createElement('option'); o.value=id; o.textContent=b.name; el.appendChild(o);
    });
  });
}
function populateExpBranch(){
  const el=document.getElementById('exp-branch');
  if(el){
    el.innerHTML='<option value="">كل الفروع</option>';
    Object.entries(S.branches||{}).forEach(([id,b])=>{
      const o=document.createElement('option'); o.value=id; o.textContent=b.name; el.appendChild(o);
    });
  }
  populateExpCashbox();
}

// خزائن الفرع الحالي (الأدمن يرى الكل) مع أرصدتها
function populateExpCashbox(){
  const el=document.getElementById('exp-cashbox'); if(!el) return;
  const cur=el.value;
  const currency=S.settings?.general?.currency||'EGP';
  const myBranch=CURRENT_USER?.branch||'';
  const list=Object.entries(S.cashboxes||{}).filter(([,cb])=>
    cb.status!=='disabled' && (!myBranch||CURRENT_USER?.role==='admin'||cb.branchId===myBranch||!cb.branchId));
  el.innerHTML='<option value="">-- اختر الخزينة --</option>'+
    list.map(([id,cb])=>`<option value="${id}">${cb.name} (${(+cb.balance||0).toFixed(2)} ${currency})</option>`).join('');
  el.value=cur;
  if(!el.value && list.length===1) el.value=list[0][0];
}

function renderFinStats(){
  const el=document.getElementById('fin-stats'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  const sales=filterByBranch(S.sales||{}).map(([,v])=>v);
  const today=new Date().toDateString();
  const todaySales=sales.filter(s=>new Date(s.createdAt).toDateString()===today);
  const todayRevenue=todaySales.reduce((s,o)=>s+(o.total||0),0);
  const monthSales=sales.filter(s=>{
    const d=new Date(s.createdAt);
    const now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  const monthRevenue=monthSales.reduce((s,o)=>s+(o.total||0),0);
  const expenses=filterByBranch(S.expenses||{}).map(([,v])=>v);
  const monthExpenses=expenses.filter(e=>{
    const d=new Date(e.createdAt);
    const now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).reduce((s,e)=>s+(e.amount||0),0);
  const netProfit=monthRevenue-monthExpenses;
  el.innerHTML=[
    {label:'مبيعات اليوم',value:todayRevenue.toFixed(0)+' '+currency,icon:'fas fa-sun',color:'green',sub:`${todaySales.length} فاتورة`},
    {label:'مبيعات الشهر',value:monthRevenue.toFixed(0)+' '+currency,icon:'fas fa-calendar',color:'blue',sub:`${monthSales.length} فاتورة`},
    {label:'مصروفات الشهر',value:monthExpenses.toFixed(0)+' '+currency,icon:'fas fa-file-invoice-dollar',color:'yellow',sub:''},
    {label:'صافي الربح',value:netProfit.toFixed(0)+' '+currency,icon:'fas fa-chart-line',color:netProfit>=0?'green':'red',sub:'هذا الشهر'},
  ].map(s=>`<div class="stat-card ${s.color}"><div class="stat-icon"><i class="${s.icon}"></i></div><div class="stat-value" style="font-size:16px;">${s.value}</div><div class="stat-label">${s.label}</div><div class="stat-sub">${s.sub}</div></div>`).join('');
}

function renderSalesHistory(){
  const tbody=document.getElementById('sales-tbl'); if(!tbody) return;
  const currency=S.settings?.general?.currency||'EGP';
  const brF=document.getElementById('fin-branch-filter')?.value||'';
  const dateFrom=document.getElementById('fin-date-from')?.value||'';
  const dateTo=document.getElementById('fin-date-to')?.value||'';
  let rows=filterByBranch(S.sales||{}).sort(([,a],[,b])=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(brF) rows=rows.filter(([,s])=>s.branchId===brF);
  if(dateFrom) rows=rows.filter(([,s])=>s.createdAt>=dateFrom);
  if(dateTo)   rows=rows.filter(([,s])=>s.createdAt<=dateTo+'T23:59:59');
  if(!rows.length){ tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text2);">لا توجد مبيعات</td></tr>`; return; }
  const payLabel={cash:'نقدي 💵',card:'بطاقة 💳',transfer:'تحويل 🏦',credit:'آجل ⏳'};
  tbody.innerHTML=rows.slice(0,100).map(([id,s],i)=>`<tr>
    <td style="color:var(--text3);">${i+1}</td>
    <td><code style="font-size:11px;">${s.invNumber||id.substr(0,8)}</code></td>
    <td style="font-size:11px;">${fDate(s.createdAt)}</td>
    <td style="font-size:11px;">${s.cashierName||'—'}</td>
    <td style="font-size:11px;">${s.branchName||'مركزي'}</td>
    <td style="font-size:11px;">${(s.items||[]).length} منتج</td>
    <td style="font-weight:700;color:var(--accent);">${Number(s.total||0).toFixed(2)} ${currency}</td>
    <td><span class="badge badge-info">${payLabel[s.payMethod]||s.payMethod||'نقدي'}</span></td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-xs" onclick="viewSaleDetail('${id}')" title="عرض"><i class="fas fa-eye"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="openReturnFromInvoice('${id}')" title="إنشاء مرتجع لهذه الفاتورة" style="color:var(--red);border-color:var(--red);"><i class="fas fa-undo-alt"></i></button>
    </td>
  </tr>`).join('');
}

function viewSaleDetail(id){
  const s=(S.sales||{})[id]; if(!s) return;
  const currency=S.settings?.general?.currency||'EGP';
  const el=document.getElementById('sale-detail-content');
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;font-size:12.5px;">
      <div><strong>رقم الفاتورة:</strong> ${s.invNumber}</div>
      <div><strong>التاريخ:</strong> ${fDate(s.createdAt)}</div>
      <div><strong>الكاشير:</strong> ${s.cashierName||'—'}</div>
      <div><strong>الفرع:</strong> ${s.branchName||'مركزي'}</div>
      <div><strong>العميل:</strong> ${s.customer||'عميل نقدي'}</div>
      <div><strong>الدفع:</strong> ${s.payMethod||'نقدي'}</div>
      ${s.saleMode?`<div><strong>نوع البيع:</strong> ${SALE_MODE_LABEL(s.saleMode)}</div>`:''}
    </div>
    <div class="tbl-wrap" style="margin-bottom:14px;">
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${(s.items||[]).map(i=>`<tr>
          <td>${i.name}${i.priceMode?` <span class="badge ${i.priceMode==='wholesale'?'badge-purple':'badge-info'}" style="font-size:9px;">${PRICE_MODE_LABELS[i.priceMode]}</span>`:''}</td><td>${i.qty}</td>
          <td>${Number(i.price||0).toFixed(2)} ${currency}</td>
          <td>${Number(i.total||0).toFixed(2)} ${currency}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="background:var(--card2);border-radius:8px;padding:12px;font-size:13px;">
      <div class="cart-total-row"><span>المجموع</span><span>${Number(s.subtotal||0).toFixed(2)} ${currency}</span></div>
      ${s.discount>0?`<div class="cart-total-row"><span>الخصم</span><span>-${Number(s.discount||0).toFixed(2)} ${currency}</span></div>`:''}
      ${s.vat>0?`<div class="cart-total-row"><span>الضريبة</span><span>${Number(s.vat||0).toFixed(2)} ${currency}</span></div>`:''}
      <div class="cart-total-row grand"><span>الإجمالي</span><span>${Number(s.total||0).toFixed(2)} ${currency}</span></div>
    </div>`;
  window._printSale=s;
  window._printSaleId=id;
  openModal('modal-sale-detail');
}

function exportSalesCSV(){
  const rows=filterByBranch(S.sales||{}).map(([,v])=>v);
  if(!rows.length){ toast('لا توجد مبيعات للتصدير','warning'); return; }
  const headers='رقم الفاتورة,التاريخ,الكاشير,الفرع,العميل,الإجمالي,الدفع\n';
  const csv=headers+rows.map(s=>`${s.invNumber||''},${s.createdAt||''},${s.cashierName||''},${s.branchName||''},${s.customer||''},${s.total||0},${s.payMethod||''}`).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='sales_export.csv'; a.click();
  toast('تم تصدير المبيعات ✅');
}

// Expenses
let editingExpense=null;
function renderExpenses(){
  const tbody=document.getElementById('exp-tbl'); if(!tbody) return;
  const currency=S.settings?.general?.currency||'EGP';
  const rows=filterByBranch(S.expenses||{}).sort(([,a],[,b])=>(b.createdAt||'').localeCompare(a.createdAt));
  if(!rows.length){ tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text2);">لا توجد مصروفات</td></tr>`; return; }
  const catLabel={operational:'تشغيلي',rent:'إيجار',salary:'رواتب',utility:'مرافق',other:'أخرى'};
  tbody.innerHTML=rows.slice(0,50).map(([id,e],i)=>`<tr>
    <td style="color:var(--text3);">${i+1}</td>
    <td style="font-size:11px;">${fDateShort(e.createdAt)}</td>
    <td><strong>${e.desc}</strong></td>
    <td><span class="badge badge-purple">${catLabel[e.category]||e.category||'—'}</span></td>
    <td style="font-weight:700;color:var(--red);">${Number(e.amount||0).toFixed(2)} ${currency}</td>
    <td style="font-size:11px;">${getBranchName(e.branchId)||'مركزي'}</td>
    <td style="font-size:11px;color:var(--text2);">${e.createdByName||'—'}</td>
    <td><button class="btn btn-danger btn-xs" onclick="delExpense('${id}')"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('');
}
async function saveExpense(){
  const desc=(document.getElementById('exp-desc')?.value||'').trim();
  const amount=parseFloat(document.getElementById('exp-amount')?.value||0);
  const cbId=document.getElementById('exp-cashbox')?.value||'';
  if(!desc){ toast('أدخل بيان المصروف','error'); return; }
  if(!amount||amount<=0){ toast('أدخل مبلغاً صحيحاً','error'); return; }

  // بدون خزينة كان المصروف يُسجَّل ورقياً بينما رصيد الخزينة لا يتحرك،
  // فيظهر فرق في الجرد آخر الوردية بلا سبب ظاهر
  if(!cbId){
    const sel=document.getElementById('exp-cashbox');
    toast('اختر الخزينة التي سيُصرف منها المبلغ','error');
    if(sel){ sel.focus(); const p=sel.style.borderColor; sel.style.borderColor='var(--red)';
             setTimeout(()=>sel.style.borderColor=p,1800); }
    return;
  }

  const cb=(S.cashboxes||{})[cbId];
  if(cb && (+cb.balance||0) < amount){
    const ok=await confirm2(
      `رصيد «${cb.name}» (${(+cb.balance||0).toFixed(2)}) أقل من قيمة المصروف (${amount.toFixed(2)}).`,
      'رصيد غير كافٍ','⚠️','صرف رغم ذلك','btn-warning');
    if(!ok) return;
  }

  const data={
    desc,amount,
    category:document.getElementById('exp-cat')?.value||'other',
    branchId:document.getElementById('exp-branch')?.value||'',
    cashboxId:cbId,
    createdBy:CURRENT_USER?.id,createdByName:CURRENT_USER?.name||'',
    createdAt:new Date().toISOString(),
    ...shiftStamp(),
  };
  try{
    const expId=uid();
    await dbSet('expenses/'+expId,data);
    await addCashboxEntry(cbId, amount, 'withdraw', `مصروف — ${desc}`, expId);
    document.getElementById('exp-desc').value='';
    document.getElementById('exp-amount').value='';
    toast('تم تسجيل المصروف وخصمه من الخزينة ✅');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}
async function delExpense(id){
  const ok=await confirm2('حذف هذا المصروف؟','حذف مصروف','🗑️','حذف','btn-danger');
  if(!ok) return;
  try{ await dbRemove('expenses/'+id); toast('تم حذف المصروف'); }
  catch(e){ toast('خطأ: '+e.message,'error'); }
}

function renderFinReport(){
  const el=document.getElementById('fin-summary'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  const sales=filterByBranch(S.sales||{}).map(([,v])=>v);
  const expenses=Object.values(S.expenses||{});
  const totalRevenue=sales.reduce((s,o)=>s+(o.total||0),0);
  const totalExpenses=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const netProfit=totalRevenue-totalExpenses;
  el.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;padding:10px;background:var(--green-bg);border-radius:8px;border:1px solid var(--green);">
        <span style="font-size:13px;color:var(--green);">إجمالي الإيرادات</span>
        <strong style="color:var(--green);">${totalRevenue.toFixed(2)} ${currency}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px;background:var(--red-bg);border-radius:8px;border:1px solid var(--red);">
        <span style="font-size:13px;color:var(--red);">إجمالي المصروفات</span>
        <strong style="color:var(--red);">${totalExpenses.toFixed(2)} ${currency}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px;background:var(--${netProfit>=0?'accent':'red'}-bg);border-radius:8px;border:1px solid var(--${netProfit>=0?'accent':'red'});">
        <span style="font-size:13px;color:var(--${netProfit>=0?'accent':'red'});">صافي الربح</span>
        <strong style="color:var(--${netProfit>=0?'accent':'red'});">${netProfit.toFixed(2)} ${currency}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;color:var(--text2);font-size:12px;">
        <span>إجمالي الفواتير</span><strong>${sales.length}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;color:var(--text2);font-size:12px;">
        <span>متوسط قيمة الفاتورة</span>
        <strong>${sales.length?( totalRevenue/sales.length).toFixed(2):0} ${currency}</strong>
      </div>
    </div>`;

  // Top products
  const topEl=document.getElementById('fin-top-products'); if(!topEl) return;
  const prodSales={};
  sales.forEach(s=>(s.items||[]).forEach(i=>{ if(!prodSales[i.name]) prodSales[i.name]={qty:0,total:0}; prodSales[i.name].qty+=i.qty||0; prodSales[i.name].total+=i.total||0; }));
  const sorted=Object.entries(prodSales).sort(([,a],[,b])=>b.total-a.total).slice(0,5);
  topEl.innerHTML=sorted.length?sorted.map(([name,d],i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border2);">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</div>
      <div style="flex:1;font-size:12.5px;font-weight:600;">${name}</div>
      <div style="font-size:11px;color:var(--text2);">${d.qty} وحدة</div>
      <div style="font-size:12px;font-weight:700;color:var(--accent);">${d.total.toFixed(0)} ${currency}</div>
    </div>`).join('')
    :`<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px;">لا توجد مبيعات بعد</div>`;

  // Branches report
  const brEl=document.getElementById('fin-branches-report'); if(!brEl) return;
  const brSales={};
  sales.forEach(s=>{ const k=s.branchName||'مركزي'; if(!brSales[k]) brSales[k]=0; brSales[k]+=s.total||0; });
  brEl.innerHTML=Object.entries(brSales).length?`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:4px 0;">
      ${Object.entries(brSales).map(([br,total])=>`
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
          <div><i class="fas fa-building" style="color:var(--accent);margin-left:6px;"></i><strong>${br}</strong></div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);">${total.toFixed(0)} ${currency}</div>
        </div>`).join('')}
    </div>`
    :`<div style="text-align:center;padding:20px;color:var(--text2);font-size:12px;">لا توجد بيانات فروع</div>`;
}

