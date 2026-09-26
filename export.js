// ============================================================
// EXCEL — زرار «Excel» فوق كل جدول رئيسي
// ============================================================
// بيصدّر الجدول زي ما هو ظاهر (بالفلتر والبحث الحاليين): نفس العناوين ونفس
// الصفوف، من غير أعمدة الأزرار (إجراءات/الصورة). الأرقام بتطلع أرقام في Excel
// مش نص، عشان تتجمع وتتفلتر. الزرار بيتضاف تلقائياً فوق كل جدول في القائمة دي.
const EXCEL_TABLES = {
  'prod-tbl':        'المنتجات',
  'wh-tbl':          'المخازن',
  'cat-tbl':         'الفئات',
  'po-tbl':          'أوامر الشراء',
  'sup-tbl':         'الموردين',
  'sales-tbl':       'سجل المبيعات',
  'exp-tbl':         'المصروفات',
  'ret-tbl':         'المرتجعات',
  'inv-tbl':         'الفواتير',
  'tr-tbl':          'نقل المخزون',
  'cashbox-log':     'حركات الخزائن',
  'debts-cust-tbl':  'ديون العملاء',
  'debts-sup-tbl':   'ديون الموردين',
  'debts-sales-tbl': 'فواتير غير مسددة',
  'debts-branch-tbl':'الديون حسب الفرع',
  'cust-tbl':        'العملاء',
  'users-tbl':       'المستخدمين',
  'sh-tbl':          'الورديات',
  'rp-sales-tbl':    'تقرير المبيعات',
  'rp-prod-tbl':     'تقرير المنتجات',
  'rp-cust-tbl':     'تقرير العملاء',
  'rp-pur-tbl':      'تقرير المشتريات',
  'rp-cb-tbl':       'تقرير الخزائن',
  'rp-branch-tbl':   'تقرير الفروع',
};
const EXCEL_SKIP_COLS = ['إجراءات','إجراء','الصورة',''];

// "1,250.00 EGP" / "EGP 1,250" / "-35.5" → رقم؛ غير كده يفضل نص.
// بنشيل رموز العملة المعروفة بس — «INV-123» تفضل نص، والباركود والتليفون
// (أرقام طويلة أو بتبدأ بصفر) يفضلوا نص عشان Excel ميبوّظهمش.
function _excelCell(txt){
  const t=(txt||'').replace(/\s+/g,' ').trim();
  const cur=[S.settings?.general?.currency, ...Object.keys(CURRENCY_LABELS), ...Object.values(CURRENCY_LABELS), '$']
             .filter(Boolean).sort((a,b)=>b.length-a.length);   // الأطول الأول («ج.م» قبل «م»)
  let bare=t; cur.forEach(c=>{ bare=bare.split(c).join(''); });
  bare=bare.replace(/,/g,'').trim().replace(/^\+/,'');   // «+100.00» في حركات الخزينة
  if(!/^-?\d+(\.\d+)?$/.test(bare)) return t;
  if(/^-?0\d/.test(bare)) return t;                          // تليفون / كود
  if(!bare.includes('.') && !t.includes(',') && bare.replace('-','').length>=9) return t;   // باركود
  return +bare;
}

function exportTableExcel(tbodyId, title){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة — تأكد من الإنترنت','error'); return; }
  const tbody=document.getElementById(tbodyId);
  const table=tbody?.closest('table');
  if(!table){ toast('الجدول غير موجود','error'); return; }

  const headCells=[...(table.tHead?.rows[table.tHead.rows.length-1]?.cells||[])];
  const keep=headCells.map(th=>!EXCEL_SKIP_COLS.includes(th.innerText.replace(/\s+/g,' ').trim()));
  const header=headCells.filter((_,i)=>keep[i]).map(th=>th.innerText.replace(/\s+/g,' ').trim());

  const rows=[...tbody.rows]
    .filter(tr=>tr.style.display!=='none')                                    // صفوف مخفية بالفلتر تتساب
    .filter(tr=>!(tr.cells.length===1 && tr.cells[0].colSpan>1))              // «لا توجد بيانات»
    .map(tr=>[...tr.cells].filter((_,i)=>keep[i]).map(td=>{
      // خانة فيها رقم + شارة (المخزون «2 منخفض») → الرقم لوحده
      const parts=[...td.childNodes].map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
      if(parts.length>1){ const first=_excelCell(parts[0]); if(typeof first==='number') return first; return parts.join(' '); }
      return _excelCell(td.innerText);
    }));

  if(!rows.length){ toast('مفيش بيانات في الجدول للتصدير','warning'); return; }

  const ws=XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols']=header.map((h,i)=>({wch:Math.min(45,Math.max(h.length,...rows.map(r=>String(r[i]??'').length))+2)}));
  ws['!views']=[{RTL:true}];
  const wb=XLSX.utils.book_new();
  wb.Workbook={Views:[{RTL:true}]};
  XLSX.utils.book_append_sheet(wb,ws,title.slice(0,31));
  XLSX.writeFile(wb,`${title}-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`✅ تم تصدير ${title} (${rows.length} صف)`);
}

// زرار صغير فوق كل جدول — مرة واحدة عند التحميل (الجداول نفسها ثابتة في index.html)
function attachExcelButtons(){
  Object.entries(EXCEL_TABLES).forEach(([id,title])=>{
    const wrap=document.getElementById(id)?.closest('.tbl-wrap, table');
    if(!wrap || wrap.previousElementSibling?.classList.contains('tbl-tools')) return;
    const bar=document.createElement('div');
    bar.className='tbl-tools';
    bar.innerHTML=`<button class="btn btn-ghost btn-xs" type="button" title="تصدير الجدول زي ما هو ظاهر">
      <i class="fas fa-file-excel" style="color:#16a34a;"></i> Excel</button>`;
    bar.firstElementChild.onclick=()=>exportTableExcel(id,title);
    wrap.parentNode.insertBefore(bar,wrap);
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',attachExcelButtons);
else attachExcelButtons();
