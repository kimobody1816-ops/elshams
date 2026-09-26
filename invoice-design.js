// ============================================================
// INVOICE DESIGNER — تصميم الفاتورة وطباعتها وتصديرها
// ============================================================

// القيم الافتراضية لكل إعداد — أي إعداد غير محفوظ يرجع لقيمته هنا
const INV_DEFAULTS = {
  'inv-title-text':'فاتورة بيع',
  'inv-title-sub':'SALES INVOICE',
  'inv-header-icon':'📦',
  'inv-header-bg':'#ffffff',
  'inv-header-color':'#000000',
  'inv-paper-size':'a4',
  'inv-orientation':'portrait',
  'inv-margin':'10',
  'inv-font-size':'12',
  'inv-logo-size':'70',
  'inv-table-head-bg':'#ffffff',
  'inv-table-head-color':'#000000',
  'inv-row-even':'#ffffff',
  'inv-row-odd':'#faf6f1',
  'inv-total-bg':'#ffffff',
  'inv-total-color':'#000000',
  'inv-footer-bg':'#ffffff',
  'inv-footer-color':'#000000',
  'inv-body-text-color':'#000000',
  'inv-label-color':'#000000',
  'inv-border-color':'#000000',
  'inv-row-text-color':'#000000',
  'inv-summary-text-color':'#000000',
  'inv-paid-color':'#000000',
  'inv-warranty-months':'3',
  'inv-warranty-text':'نقدم ضماناً ضد عيوب التصنيع أو الأعطال الناتجة عن عيوب في المواد أو التركيب',
  'inv-return-text':'يمكنكم استرجاع الجهاز خلال 14 يوم من تاريخ الشراء في حالة وجود عيب صناعي، دون خصم أي نسبة من المبلغ المدفوع',
  'inv-nowarranty-text':'الكسر أو التلف المادي — التعرض للسوائل — الحروق أو التلف الحراري — التعديلات غير المصرح بها — الأعطال الناتجة عن الفيروسات أو البرمجيات',
  'inv-footer-text':'شكراً لتعاملكم معنا',
  'inv-footer-extra':'',
  'inv-salesman':'',
  'inv-bill-to-label':'فاتورة إلى:',
  'inv-terms-label':'شروط البيع:',
  'inv-summary-label':'إجمالي الأمر',
  'inv-payment-label':'الدفع المقترح',
  'inv-grandtotal-label':'إجمالي الفاتورة',
  'inv-col-name-label':'الوصف',
  'inv-col-qty-label':'الكمية',
  'inv-col-price-label':'السعر',
  'inv-bank':'', 'inv-account':'', 'inv-swift':'',
};
const INV_CHECKBOXES = {
  'inv-col-seq':true, 'inv-col-name':true, 'inv-col-wh':true, 'inv-col-qty':true,
  'inv-col-price':true, 'inv-col-total':true, 'inv-col-disc':true, 'inv-col-serial':false,
  'inv-show-warranty':true, 'inv-show-bank':true, 'inv-show-salesman':true, 'inv-show-notes':true,
};

const INV_PAY_NAMES = { cash:'نقدي', card:'بطاقة', transfer:'تحويل بنكي', credit:'آجل' };

// قراءة إعداد فاتورة (من قاعدة البيانات أو الافتراضي)
function ivGet(key){
  const c = S.settings?.invoice || {};
  return c[key]!==undefined && c[key]!=='' ? c[key] : INV_DEFAULTS[key];
}
function ivBool(key){
  const c = S.settings?.invoice || {};
  return c[key]!==undefined ? !!c[key] : INV_CHECKBOXES[key];
}
function invMoney(v){ return Number(v||0).toFixed(2); }

// ── تحميل قيم الإعدادات في واجهة التصميم ──
function loadInvSettingsUI(){
  const c = S.settings?.invoice || {};
  Object.keys(INV_DEFAULTS).forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.value = (c[id]!==undefined && c[id]!=='') ? c[id] : INV_DEFAULTS[id];
  });
  Object.keys(INV_CHECKBOXES).forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.checked = c[id]!==undefined ? !!c[id] : INV_CHECKBOXES[id];
  });
  const szLbl=document.getElementById('inv-logo-size-lbl');
  if(szLbl) szLbl.textContent = ivGet('inv-logo-size')+'px';
  const fsLbl=document.getElementById('inv-font-size-lbl');
  if(fsLbl) fsLbl.textContent = ivGet('inv-font-size')+'px';

  const prev=document.getElementById('inv-logo-preview');
  if(prev){
    prev.innerHTML = c.invLogo
      ? `<img src="${c.invLogo}" style="max-width:100%;max-height:100%;object-fit:contain;">`
      : '<i class="fas fa-image" style="font-size:24px;color:var(--text3);"></i>';
  }
}

function previewLogo(event){
  const file=event.target.files[0]; if(!file) return;
  if(file.size > 400*1024){ toast('حجم اللوجو كبير — اختر صورة أقل من 400KB','error'); return; }
  const reader=new FileReader();
  reader.onload=e=>{
    S.settings.invoice = {...(S.settings.invoice||{}), invLogo:e.target.result};
    const prev=document.getElementById('inv-logo-preview');
    if(prev) prev.innerHTML=`<img src="${e.target.result}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    toast('تم تحميل اللوجو — اضغط حفظ لتثبيته','info');
  };
  reader.readAsDataURL(file);
}

function clearLogo(){
  S.settings.invoice = {...(S.settings.invoice||{}), invLogo:''};
  const prev=document.getElementById('inv-logo-preview');
  if(prev) prev.innerHTML='<i class="fas fa-image" style="font-size:24px;color:var(--text3);"></i>';
}

async function saveInvSettings(){
  const cfg={};
  Object.keys(INV_DEFAULTS).forEach(id=>{
    const el=document.getElementById(id);
    cfg[id] = el ? el.value : INV_DEFAULTS[id];
  });
  Object.keys(INV_CHECKBOXES).forEach(id=>{
    const el=document.getElementById(id);
    cfg[id] = el ? el.checked : INV_CHECKBOXES[id];
  });
  cfg.invLogo   = S.settings?.invoice?.invLogo || '';
  cfg.updatedAt = new Date().toISOString();
  try{
    await dbSet('settings/invoice', cfg);
    S.settings.invoice = cfg;
    toast('تم حفظ إعدادات الفاتورة ✅');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

function previewInvoiceSample(){
  const currency = S.settings?.general?.currency||'EGP';
  showInvoice({
    invNumber:'PREVIEW-001',
    createdAt:new Date().toISOString(),
    customer:'عميل تجريبي',
    customerId:'',
    branchName:'الفرع الرئيسي',
    items:[
      {name:'منتج تجريبي أول', qty:2, price:1500, total:3000},
      {name:'منتج تجريبي ثانٍ', qty:1, price:750,  total:750},
    ],
    subtotal:3750, discount:250, vat:0, tax:0, total:3500,
    amountPaid:2000, balance:1500, payMethod:'cash',
    cashierName:CURRENT_USER?.name||'',
    notes:'هذه معاينة للفاتورة فقط',
    _currency:currency,
  });
}

// فتح الفاتورة المصممة لفاتورة محفوظة
function showInvoiceFor(saleId){
  const s=(S.sales||{})[saleId];
  if(!s){ toast('لم يتم العثور على الفاتورة','error'); return; }
  closeModal('modal-sale-detail');
  showInvoice(s);
}

// ── بناء قالب الفاتورة ──
function buildInvoiceHTML(sale){
  const g = S.settings?.general || {};
  const currency = sale._currency || g.currency || 'EGP';

  const fontSize   = ivGet('inv-font-size')+'px';
  const logoSize   = ivGet('inv-logo-size')+'px';
  const logoSrc    = S.settings?.invoice?.invLogo || '';
  const headerBg   = ivGet('inv-header-bg');
  const headerCol  = ivGet('inv-header-color');
  const thBg       = ivGet('inv-table-head-bg');
  const thCol      = ivGet('inv-table-head-color');
  const rowEven    = ivGet('inv-row-even');
  const rowOdd     = ivGet('inv-row-odd');
  const rowTextCol = ivGet('inv-row-text-color');
  const totBg      = ivGet('inv-total-bg');
  const totCol     = ivGet('inv-total-color');
  const ftBg       = ivGet('inv-footer-bg');
  const ftCol      = ivGet('inv-footer-color');
  const bodyCol    = ivGet('inv-body-text-color');
  const lblCol     = ivGet('inv-label-color');
  const bdCol      = ivGet('inv-border-color');
  const sumCol     = ivGet('inv-summary-text-color');
  const paidCol    = ivGet('inv-paid-color');

  const showSeq    = ivBool('inv-col-seq');
  const showName   = ivBool('inv-col-name');
  const showWh     = ivBool('inv-col-wh');
  const showQty    = ivBool('inv-col-qty');
  const showPrice  = ivBool('inv-col-price');
  const showTotal  = ivBool('inv-col-total');
  const showDisc   = ivBool('inv-col-disc');
  const showSerial = ivBool('inv-col-serial');
  const showWarr   = ivBool('inv-show-warranty');
  const showBank   = ivBool('inv-show-bank');
  const showSales  = ivBool('inv-show-salesman');
  const showNotes  = ivBool('inv-show-notes');

  const colNameLbl = ivGet('inv-col-name-label');
  const colQtyLbl  = ivGet('inv-col-qty-label');
  const colPriceLbl= ivGet('inv-col-price-label');

  const invNum  = sale.invNumber || '------';
  const dateStr = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('ar-EG') : '';
  const whName  = sale.branchName || 'مركزي';
  const salesman= ivGet('inv-salesman') || sale.cashierName || '';

  const cust    = sale.customerId ? (S.customers||{})[sale.customerId] : null;
  const custName= sale.customer || sale.custName || 'عميل نقدي';
  const custCode= sale.customerId ? sale.customerId.slice(-6).toUpperCase() : '—';
  const custPhone= cust?.phone || '—';

  const items   = (sale.items||[]).map(it=>{
    const p = (S.products||{})[it.productId] || {};
    return {...it, desc: it.desc!==undefined?it.desc:(p.desc||''), serial: it.serial!==undefined?it.serial:(p.serial||'')};
  });

  const subtotal = +sale.subtotal || +sale.total || 0;
  const discount = +sale.discount || 0;
  // خصم الأصناف يظهر في عمود كل سطر، والباقي هو خصم الفاتورة العام الموزَّع تناسبياً
  const itemsDisc    = sale.itemsDiscount!==undefined
                       ? (+sale.itemsDiscount||0)
                       : (sale.items||[]).reduce((s,it)=>s+(+it.discAmt||0),0);
  const invLevelDisc = sale.invDiscount!==undefined
                       ? (+sale.invDiscount||0)
                       : Math.max(0, discount-itemsDisc);
  const taxAmt   = +sale.vat || +sale.tax || 0;
  const paid     = sale.amountPaid!==undefined ? (+sale.amountPaid||0) : (+sale.received||0);
  const balance  = +sale.balance || 0;

  const th = (label,width) =>
    `<th style="padding:9px 12px;text-align:right;font-weight:700;${width?`width:${width};`:''}background:${thBg};color:${thCol};border-bottom:2px solid ${bdCol};border-top:1px solid ${bdCol};">${label}</th>`;
  const thCols = [
    showSeq    && th('تسلسل','50px'),
    showName   && th(colNameLbl),
    showWh     && th('المخزن','90px'),
    showQty    && th(colQtyLbl,'60px'),
    showPrice  && th(colPriceLbl,'100px'),
    showTotal  && th('الإجمالي','110px'),
    showDisc   && th('قيمة الخصم','100px'),
    showSerial && th('المسلسلات','80px'),
  ].filter(Boolean).join('');

  const td = (content,extra='') =>
    `<td style="padding:8px 12px;border-bottom:1px solid ${bdCol}33;color:${rowTextCol};${extra}">${content}</td>`;

  return `
  <div id="inv-content" style="direction:rtl;font-family:'Cairo',Arial,sans-serif;background:#fff;color:${bodyCol};font-size:${fontSize};max-width:820px;margin:0 auto;border:1px solid ${bdCol}44;">

    <div style="background:${headerBg};color:${headerCol};padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${bdCol};">
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;">
        ${logoSrc
          ? `<img src="${logoSrc}" style="width:${logoSize};height:${logoSize};object-fit:contain;border-radius:8px;display:block;">`
          : `<div style="width:${logoSize};height:${logoSize};border:2px solid ${bdCol};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(parseInt(logoSize)*0.5)}px;">${ivGet('inv-header-icon')}</div>`}
        <div>
          <div style="font-size:15px;font-weight:900;">${g.name||g.sysName||'الشمس'}</div>
          <div style="font-size:10px;">${g.email||''} ${g.phone?'&nbsp;|&nbsp; 📞 '+g.phone:''}</div>
        </div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:22px;font-weight:900;">${ivGet('inv-title-text')}</div>
        <div style="font-size:10px;">${ivGet('inv-title-sub')}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid ${bdCol};">
      <div style="padding:12px 20px;border-left:1px solid ${bdCol}44;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:${lblCol};padding:2px 0;width:130px;">اسم الشركة:</td><td style="font-weight:700;">${g.name||g.sysName||'الشمس'}</td></tr>
          <tr><td style="color:${lblCol};padding:2px 0;">عنوان الشركة:</td><td>${g.address||'—'}</td></tr>
          <tr><td style="color:${lblCol};padding:2px 0;">هاتف الشركة:</td><td>${g.phone||'—'}</td></tr>
        </table>
      </div>
      <div style="padding:12px 20px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:${lblCol};padding:2px 0;width:100px;">${ivGet('inv-bill-to-label')}</td><td style="font-weight:700;">${custName}</td></tr>
          <tr><td style="color:${lblCol};padding:2px 0;">رقم العميل:</td><td>${custCode}</td></tr>
          <tr><td style="color:${lblCol};padding:2px 0;">هاتف العميل:</td><td style="font-weight:700;">📞 ${custPhone}</td></tr>
        </table>
      </div>
    </div>

    <div style="background:${rowOdd};padding:8px 20px;border-bottom:1px solid ${bdCol}44;">
      <table style="width:100%;font-size:10.5px;border-collapse:collapse;">
        <tr>
          <td style="padding:2px 8px 2px 0;"><span style="color:${lblCol};">الفرع: </span><strong>${whName}</strong></td>
          <td style="padding:2px 8px;"><span style="color:${lblCol};">رقم الفاتورة: </span><strong>${invNum}</strong></td>
          <td style="padding:2px 8px;"><span style="color:${lblCol};">التاريخ: </span><strong>${dateStr}</strong></td>
          <td style="padding:2px 0 2px 8px;"><span style="color:${lblCol};">العملة: </span><strong>${currency}</strong></td>
        </tr>
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead style="display:table-header-group;"><tr>${thCols}</tr></thead>
      <tbody>
        ${items.map((it,i)=>{
          const lineTotal=+it.gross || (+it.price||0)*(+it.qty||0);
          // خصم الصنف المسجَّل صراحةً + نصيب السطر من خصم الفاتورة العام
          const ownDisc  = +it.discAmt||0;
          const genDisc  = invLevelDisc>0 && subtotal>0 ? (lineTotal/subtotal*invLevelDisc) : 0;
          const lineDisc = ownDisc + genDisc;
          return `<tr style="background:${i%2===0?rowEven:rowOdd};page-break-inside:avoid;">
            ${showSeq   ? td(i+1) : ''}
            ${showName  ? td(`${it.name||''}${sale.saleMode==='mixed'&&it.priceMode?` <span style="font-weight:400;font-size:9px;color:${lblCol};">(${PRICE_MODE_LABELS[it.priceMode]})</span>`:''}${it.desc?`<br><span style="font-weight:400;font-size:10px;color:${lblCol};">${it.desc}</span>`:''}`,'font-weight:600;') : ''}
            ${showWh    ? td(whName) : ''}
            ${showQty   ? td(it.qty||0) : ''}
            ${showPrice ? td(`${invMoney(it.price)} ${currency}`) : ''}
            ${showTotal ? td(`${invMoney(lineTotal)} ${currency}`,'font-weight:700;') : ''}
            ${showDisc  ? td(lineDisc>0?`- ${invMoney(lineDisc)} ${currency}`:'—','color:#c00;') : ''}
            ${showSerial? td(it.serial||'—','font-size:10px;') : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:2px solid ${bdCol};page-break-inside:avoid;">
      <div style="padding:14px 20px;border-left:1px solid ${bdCol}44;">
        ${showSales?`<div style="font-size:11px;margin-bottom:5px;"><span style="color:${lblCol};">مسؤول البيع: </span><strong>${salesman||'—'}</strong></div>`:''}
        <div style="font-size:11px;margin-bottom:5px;"><span style="color:${lblCol};">طريقة الدفع: </span><strong>${INV_PAY_NAMES[sale.payMethod]||sale.payMethod||'—'}</strong></div>
        ${sale.saleMode?`<div style="font-size:11px;margin-bottom:5px;"><span style="color:${lblCol};">نوع البيع: </span><strong>${SALE_MODE_LABEL(sale.saleMode)}</strong></div>`:''}
        ${showNotes&&sale.notes?`<div style="font-size:11px;margin-bottom:5px;">ملاحظات: ${sale.notes}</div>`:''}
        ${showBank?`<div style="margin-top:8px;font-size:10.5px;">
          <div style="font-weight:700;margin-bottom:3px;">${ivGet('inv-terms-label')}</div>
          <div>البنك: ${ivGet('inv-bank')||'—'}</div>
          <div>سويفت كود: ${ivGet('inv-swift')||'—'}</div>
          <div>حساب البنك: ${ivGet('inv-account')||'—'}</div>
        </div>`:''}
      </div>
      <div style="padding:14px 20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:${rowOdd};border-radius:8px;padding:10px;border:1px solid ${bdCol}44;color:${sumCol};">
            <div style="font-size:11px;font-weight:700;margin-bottom:6px;">${ivGet('inv-summary-label')}</div>
            <div style="font-size:11px;margin-bottom:2px;">الإجمالي: <strong>${invMoney(subtotal)}</strong></div>
            ${itemsDisc>0?`<div style="font-size:11px;margin-bottom:2px;color:#c00;">خصم الأصناف: <strong>- ${invMoney(itemsDisc)}</strong></div>`:''}
            ${invLevelDisc>0?`<div style="font-size:11px;margin-bottom:2px;color:#c00;">خصم الفاتورة: <strong>- ${invMoney(invLevelDisc)}</strong></div>`:''}
            <div style="font-size:11px;margin-bottom:2px;color:#c00;">إجمالي الخصم: <strong>- ${invMoney(discount)}</strong></div>
            <div style="font-size:11px;margin-bottom:2px;">بعد الخصم: <strong>${invMoney(subtotal-discount)}</strong></div>
            <div style="font-size:11px;margin-bottom:2px;">الضريبة: <strong>+ ${invMoney(taxAmt)}</strong></div>
            <div style="font-size:11px;font-weight:700;">بعد الضريبة: <strong>${invMoney(sale.total)}</strong></div>
          </div>
          <div style="background:${rowOdd};border-radius:8px;padding:10px;border:1px solid ${bdCol}44;color:${sumCol};">
            <div style="font-size:11px;font-weight:700;margin-bottom:6px;">${ivGet('inv-payment-label')}</div>
            <div style="font-size:11px;margin-bottom:2px;">المدفوع: <strong style="color:${paidCol};">${invMoney(paid)} ${currency}</strong></div>
            <div style="font-size:11px;">المتبقي: <strong>${invMoney(balance)} ${currency}</strong></div>
          </div>
        </div>
        <div style="background:${totBg};color:${totCol};border:2px solid ${bdCol};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;">${ivGet('inv-grandtotal-label')}</div>
          <div style="font-size:22px;font-weight:900;">${invMoney(sale.total)} ${currency}</div>
        </div>
      </div>
    </div>

    ${showWarr?`<div style="border-top:2px solid ${bdCol};padding:12px 20px;background:${rowOdd};page-break-inside:avoid;">
      <div style="font-size:11px;font-weight:700;margin-bottom:6px;">شروط الضمان</div>
      <div style="font-size:10px;line-height:1.9;">
        <strong>مدة الضمان:</strong> ${ivGet('inv-warranty-text')} — مدة ${ivGet('inv-warranty-months')} أشهر<br>
        <strong>ضمان الاسترجاع:</strong> ${ivGet('inv-return-text')}<br>
        <strong>ما لا يشمله الضمان:</strong> ${ivGet('inv-nowarranty-text')}
      </div>
    </div>`:''}

    <div style="border-top:2px solid ${bdCol};background:${ftBg};color:${ftCol};padding:10px 20px;text-align:center;font-size:10.5px;page-break-inside:avoid;">
      <strong>${ivGet('inv-footer-text')}</strong> &nbsp;|&nbsp; ${g.name||g.sysName||'الشمس'} ${g.phone?'&nbsp;|&nbsp; 📞 '+g.phone:''}
      ${ivGet('inv-bank')?`<br>البنك: ${ivGet('inv-bank')} | SWIFT: ${ivGet('inv-swift')||'—'} | حساب: ${ivGet('inv-account')||'—'}`:''}
      ${ivGet('inv-footer-extra')?`<br>${ivGet('inv-footer-extra')}`:''}
    </div>
  </div>`;
}

function showInvoice(sale){
  window._invSale = sale;
  document.getElementById('inv-view-body').innerHTML = buildInvoiceHTML(sale);
  openModal('modal-inv-view');
}

// طباعة الفاتورة في نافذة منفصلة (تحترم مقاس الورق والاتجاه والهوامش)
function printInvoiceDoc(){
  const sale = window._invSale;
  if(!sale){ toast('لا توجد فاتورة','error'); return; }
  const sizeMap={a4:'A4',a5:'A5',letter:'Letter',thermal80:'80mm auto'};
  const pageSize = sizeMap[ivGet('inv-paper-size')]||'A4';
  const orient   = ivGet('inv-orientation')==='landscape'?' landscape':' portrait';
  const margin   = (parseInt(ivGet('inv-margin'))||0)+'mm';
  const html=`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>فاتورة ${sale.invNumber||''}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:${pageSize}${pageSize==='80mm auto'?'':orient};margin:${margin};}
  body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;}
  table{page-break-inside:auto;} thead{display:table-header-group;} tr{page-break-inside:avoid;}
</style></head><body>${buildInvoiceHTML(sale)}
<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body></html>`;
  const w=window.open('','_blank','width=900,height=760');
  if(!w){ toast('يرجى السماح بالنوافذ المنبثقة','error'); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
// تصدير الفاتورة صورة PNG
// ============================================================
// html2canvas كان يرسم الحروف واحداً واحداً على الكانفس فيكسر تشكيل
// العربية المتصلة («فاتورة بيع» تخرج «فتاورقيع»). البديل هنا يلفّ الفاتورة
// داخل <foreignObject> في SVG، فيرسمها المتصفح بمحرّك النصوص الحقيقي
// بتشكيل عربي سليم، ثم نرسم الناتج على كانفس بدقة مضاعفة.

async function exportInvImage(){
  const content=document.getElementById('inv-content');
  if(!content){ toast('لا توجد فاتورة','error'); return; }
  if(typeof html2canvas!=='function'){ toast('مكتبة الصور غير محمّلة — تأكد من الاتصال بالإنترنت','error'); return; }

  // ملاحظة: بديل SVG + foreignObject يرسم العربية بشكل مثالي، لكن كروم
  // يلوّث الكانفس عند رسم foreignObject فيرفض toDataURL. لذلك نبقى على
  // html2canvas بعد إزالة سبب تكسير الحروف (تباعد الأحرف).
  toast('جاري تصدير الصورة...','info');
  try{
    const canvas=await html2canvas(content,{
      scale:3,                 // دقة عالية تكفي للطباعة والإرسال على واتساب
      useCORS:true,
      backgroundColor:'#ffffff',
      logging:false,
      allowTaint:false,
      // ضمانة إضافية داخل النسخة التي يرسمها html2canvas
      onclone:doc=>{
        doc.querySelectorAll('#inv-content, #inv-content *').forEach(el=>{
          el.style.letterSpacing='normal';
          el.style.textTransform='none';
        });
      },
    });
    const link=document.createElement('a');
    link.download='فاتورة-'+(window._invSale?.invNumber||Date.now())+'.png';
    link.href=canvas.toDataURL('image/png');
    link.click();
    toast('تم تصدير الفاتورة كصورة ✅');
  }catch(e){
    console.warn('فشل تصدير الصورة',e);
    toast('تعذّر تصدير الصورة: '+e.message+' — يمكنك استخدام «طباعة / PDF»','error');
  }
}

