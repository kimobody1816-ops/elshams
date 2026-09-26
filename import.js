// ============================================================
// EXCEL IMPORT — استيراد Excel
// ============================================================
function xlsxReady(){ return typeof XLSX!=='undefined'; }

// يحدد موضع عمود من عنوانه. الأولوية للمطابقة من بداية العنوان ثم للاحتواء،
// وبترتيب الكلمات المُمرَّرة — حتى لا يختطف عمود «وصف الفئة» دورَ «اسم الفئة».
function xlColIdx(hdr, needles, fallback=-1){
  for(const n of needles){ const i=hdr.findIndex(h=>h.startsWith(n)); if(i>=0) return i; }
  for(const n of needles){ const i=hdr.findIndex(h=>h.includes(n));   if(i>=0) return i; }
  return fallback;
}

// Excel يخزّن التواريخ كأرقام تسلسلية (مثل 45678) وليس نصاً.
// هذه الدالة تُرجّع دائماً YYYY-MM-DD أياً كانت صيغة الخلية.
function xlDate(v){
  if(v===''||v===null||v===undefined) return '';
  if(typeof v==='number'&&isFinite(v)){
    // الرقم التسلسلي في Excel يبدأ من 1900-01-00 مع خلل الكبيسة المعروف
    const ms = Math.round((v-25569)*86400*1000);
    const d  = new Date(ms);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }
  const s=String(v).trim(); if(!s) return '';
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // صيغة يوم/شهر/سنة الشائعة عربياً — نفسّرها يوماً أولاً لا شهراً
  const dmy=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if(dmy){
    const [,d1,m1,y1]=dmy;
    return `${y1}-${String(m1).padStart(2,'0')}-${String(d1).padStart(2,'0')}`;
  }
  const d=new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0,10);
}

function showImportResult(elId, added, updated, errors, label='') {
  const el = document.getElementById(elId); if(!el) return;
  const hasErrors = errors.length>0;
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:${hasErrors?'var(--yellow-bg)':'rgba(63,185,80,.08)'};border:1px solid ${hasErrors?'var(--yellow)':'var(--green)'};border-radius:9px;padding:12px 16px;">
      <div style="font-size:13px;font-weight:700;color:${hasErrors?'var(--yellow)':'var(--green)'};">
        <i class="fas fa-${hasErrors?'exclamation-triangle':'check-circle'}"></i>
        ${label} — تمّ الاستيراد
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">
        ✅ ${added} مضاف | 🔄 ${updated} محدَّث ${hasErrors?`| ⚠️ ${errors.length} تنبيه`:''}
      </div>
      ${hasErrors?`<div style="margin-top:8px;font-size:11px;color:var(--red);max-height:80px;overflow-y:auto;">${errors.slice(0,5).join('<br>')}</div>`:''}
    </div>`;
}

// ── تنزيل / استيراد الفئات ──────────────────────────────
function downloadCatTemplate(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة، انتظر لحظة','error'); return; }
  const wb = XLSX.utils.book_new();
  const headers = [['اسم الفئة *','أيقونة (Emoji)','وصف الفئة']];
  const examples = [
    ['منتجات','🛍️','المنتجات الرئيسية'],
    ['خدمات','🔧','الخدمات المقدمة'],
    ['مواد خام','📦','المواد الأساسية'],
    ['إكسسوارات','✨','الملحقات والإضافات'],
    ['عروض','🎯','العروض والحزم الخاصة'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols'] = [{wch:25},{wch:12},{wch:35}];
  XLSX.utils.book_append_sheet(wb,ws,'الفئات');
  const info = [
    ['تعليمات استيراد الفئات'],[''],
    ['الحقل','إلزامي؟','الوصف'],
    ['اسم الفئة','✅ نعم','اسم الفئة — يجب أن يكون فريداً'],
    ['أيقونة','اختياري','رمز تعبيري مثل 📦'],
    ['وصف','اختياري','وصف مختصر'],
    [''],['- لا تحذف الصف الأول'],['- الفئات الموجودة تُحدَّث تلقائياً'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{wch:20},{wch:12},{wch:40}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'تعليمات');
  XLSX.writeFile(wb,'نموذج-استيراد-الفئات.xlsx');
  toast('✅ تم تنزيل قالب الفئات');
}

async function importCatsFromExcel(event){
  const file = event.target.files[0]; if(!file) return;
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  toast('جارٍ قراءة الملف...','info');
  try{
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data,{type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    const hdr = (rows[0]||[]).map(h=>String(h||'').trim());
    const colIdx = (needles, fallback=-1)=>xlColIdx(hdr, needles, fallback);
    const C = { name:colIdx(['اسم الفئة','الفئة'],0), icon:colIdx(['أيقونة','ايقونة','Emoji'],1), desc:colIdx(['وصف'],2) };
    const val = (row,i)=> i>=0 ? (row[i] ?? '') : '';

    const dataRows = rows.slice(1).filter(r=>String(val(r,C.name)).trim());
    if(!dataRows.length){ toast('لا توجد بيانات في الملف — تأكد من وجود عمود «اسم الفئة»','error'); return; }
    let added=0,updated=0,errors=[];
    for(const row of dataRows){
      const name = String(val(row,C.name)).trim(); if(!name) continue;
      const icon = String(val(row,C.icon)).trim()||'📦';
      const desc = String(val(row,C.desc)).trim();
      const existing = Object.entries(S.categories||{}).find(([,c])=>c.name?.toLowerCase()===name.toLowerCase());
      try{
        if(existing){ await dbUpdate('categories/'+existing[0],{name,icon,desc,updatedAt:new Date().toISOString()}); updated++; }
        else        { await dbSet('categories/'+uid(),{name,icon,desc,createdAt:new Date().toISOString()}); added++; }
      }catch(e){ errors.push(name+': '+e.message); }
    }
    showImportResult('import-cat-result',added,updated,errors,'الفئات');
  }catch(e){ toast('خطأ في قراءة الملف: '+e.message,'error'); }
  finally{ event.target.value=''; }
}

// ── تنزيل / استيراد المنتجات ────────────────────────────
function downloadProductTemplate(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const catNames = Object.values(S.categories||{}).map(c=>c.name).join(', ')||'أضف فئات أولاً';
  const branchNames = Object.values(S.branches||{}).map(b=>b.name).join(', ')||'الفرع الرئيسي';
  const whNames   = Object.values(S.warehouses||{}).map(w=>w.name).join(', ')||'المخزن الرئيسي';
  const headers = [['اسم المنتج *','كود المنتج','السريال نمبر','الفئة *','الفرع','اسم المخزن','الوحدة','الكمية','الحد الأدنى','سعر الشراء *','سعر البيع قطاعي *','سعر البيع جملة','وصف','الحالة']];
  const c0 = Object.values(S.categories||{})[0]?.name||'عام';
  const b0 = Object.values(S.branches||{})[0]?.name||'';
  const w0 = Object.values(S.warehouses||{})[0]?.name||'';
  const examples = [
    ['منتج أول','PRD-001','SN-2026-0001',c0,b0,w0,'قطعة',10,3,50,100,85,'وصف اختياري','نشط'],
    ['منتج ثاني','PRD-002','',c0,b0,w0,'قطعة',5,2,80,150,'','','نشط'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols'] = [{wch:28},{wch:18},{wch:20},{wch:18},{wch:18},{wch:22},{wch:12},{wch:10},{wch:12},{wch:16},{wch:18},{wch:16},{wch:35},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,'المنتجات');
  const info = [
    ['تعليمات استيراد المنتجات'],[''],
    ['الحقل','إلزامي؟','الوصف'],
    ['اسم المنتج','✅ نعم','اسم المنتج كما سيظهر في النظام'],
    ['كود المنتج','اختياري','كود/باركود فريد — يُستخدم للتعرف على المنتج عند التحديث'],
    ['السريال نمبر','اختياري','رقم تسلسلي للجهاز — يظهر في عمود «المسلسلات» بالفاتورة المصممة'],
    ['الفئة','✅ نعم','اسم الفئة — الفئات المتاحة: '+catNames],
    ['الفرع','اختياري','اسم الفرع — المتاحة: '+branchNames],
    ['اسم المخزن','اختياري','اسم المخزن الذي يُحفظ فيه المنتج — المتاحة: '+whNames],
    ['الوحدة','اختياري','قطعة / كيلو / لتر / متر / علبة / دستة — الافتراضي: قطعة'],
    ['الكمية','اختياري','الكمية الابتدائية (رقم) — عند التحديث تحل محل الكمية الحالية'],
    ['الحد الأدنى','اختياري','حد التنبيه بنقص المخزون'],
    ['سعر الشراء','✅ نعم','سعر شراء الوحدة (التكلفة)'],
    ['سعر البيع قطاعي','✅ نعم','سعر البيع للزبون العادي'],
    ['سعر البيع جملة','اختياري','سعر بيع الجملة — اتركه فارغاً ليُباع بسعر القطاعي'],
    ['وصف','اختياري','وصف مختصر — يظهر تحت اسم الصنف في الفاتورة'],
    ['الحالة','اختياري','نشط / متوقف — الافتراضي: نشط'],
    [''],['- المنتجات الموجودة (بنفس الكود أو الاسم) تُحدَّث تلقائياً'],
    ['- إذا لم يُحدَّد المخزن، يُضاف تلقائياً لأول مخزن في الفرع المحدد'],
    ['- ترتيب الأعمدة غير مهم — النظام يتعرّف عليها من عناوينها'],
    ['- أي عمود تحذفه من الملف تبقى قيمته القديمة كما هي دون مسح'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{wch:20},{wch:12},{wch:70}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'تعليمات');
  XLSX.writeFile(wb,'نموذج-استيراد-المنتجات.xlsx');
  toast('✅ تم تنزيل قالب المنتجات');
}

async function importProductsFromExcel(event){
  const file = event.target.files[0]; if(!file) return;
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  toast('جارٍ قراءة الملف...','info');
  try{
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data,{type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});

    // كل الأعمدة تُحدَّد من عناوينها، مع رجوع لموضع ثابت لو العنوان غير مفهوم.
    // النتيجة: ترتيب الأعمدة غير مهم، والملفات القديمة تظل تعمل.
    const hdr = (rows[0]||[]).map(h=>String(h||'').trim());
    const colIdx = (needles, fallback=-1)=>xlColIdx(hdr, needles, fallback);
    const C = {
      name:   colIdx(['اسم المنتج','الصنف'], 0),
      code:   colIdx(['كود','باركود','SKU'], 1),
      serial: colIdx(['سريال','مسلسل','Serial'], -1),
      cat:    colIdx(['الفئة','التصنيف'], 2),
      branch: colIdx(['الفرع'], 3),
      wh:     colIdx(['مخزن','المستودع'], 4),
      unit:   colIdx(['الوحدة'], -1),
      qty:    colIdx(['الكمية'], 5),
      min:    colIdx(['الحد الأدنى','حد التنبيه'], 6),
      cost:   colIdx(['سعر الشراء','التكلفة'], 7),
      price:  hdr.some(h=>h.includes('قطاعي')) ? colIdx(['قطاعي'],8) : colIdx(['سعر البيع'],8),
      // يُقبل فقط لو العنوان يذكر «جملة» صراحةً — وإلا فالعمود غير موجود في الملف
      wholesale: colIdx(['جملة'], -1),
      desc:   colIdx(['وصف'], 9),
      status: colIdx(['الحالة'], -1),
    };
    // قيمة عمود قد يكون غير موجود في الملف.
    // نستخدم ?? لا || حتى لا يتحول الرقم 0 إلى قيمة فارغة
    const val = (row,i)=> i>=0 ? (row[i] ?? '') : '';

    // الصفوف الصالحة = التي بها اسم منتج، أياً كان موضع عمود الاسم
    const dataRows = rows.slice(1).filter(r=>String(val(r,C.name)).trim());
    if(!dataRows.length){ toast('لا توجد بيانات في الملف — تأكد من وجود عمود «اسم المنتج»','error'); return; }

    // خريطة الوحدات: من الاسم العربي إلى كود النظام
    const UNIT_MAP = {'قطعة':'piece','كيلو':'kg','كجم':'kg','لتر':'liter','متر':'meter','علبة':'box','دستة':'dozen',
                      'piece':'piece','kg':'kg','liter':'liter','meter':'meter','box':'box','dozen':'dozen'};

    // خرائط البحث — بالاسم واللوركيس
    const catMap={}, branchMap={}, whMap={};
    Object.entries(S.categories||{}).forEach(([id,c])=>{ if(c.name) catMap[c.name.trim().toLowerCase()]=id; });
    Object.entries(S.branches||{}).forEach(([id,b])=>{ if(b.name) branchMap[b.name.trim().toLowerCase()]=id; });
    Object.entries(S.warehouses||{}).forEach(([id,wh])=>{ if(wh.name) whMap[wh.name.trim().toLowerCase()]=id; });

    const findCatId = name=>{
      if(!name) return '';
      const k=name.trim().toLowerCase();
      if(catMap[k]) return catMap[k];
      const fuzzy=Object.keys(catMap).find(c=>c.includes(k)||k.includes(c));
      return fuzzy?catMap[fuzzy]:'';
    };
    const findWhId = (brId, whName)=>{
      if(whName){
        const k=whName.trim().toLowerCase();
        if(whMap[k]) return whMap[k];
      }
      // اختر أول مخزن للفرع
      const match=Object.entries(S.warehouses||{}).find(([,wh])=>wh.branchId===brId&&wh.status==='active');
      return match?match[0]:'';
    };

    let added=0,updated=0,errors=[];
    for(const row of dataRows){
      const name    = String(val(row,C.name)||'').trim(); if(!name) continue;
      const code    = String(val(row,C.code)||'').trim();
      const serial  = String(val(row,C.serial)||'').trim();
      const catName = String(val(row,C.cat)||'').trim();
      const brName  = String(val(row,C.branch)||'').trim();
      const whName  = String(val(row,C.wh)||'').trim();   // عمود اسم المخزن
      const unitRaw = String(val(row,C.unit)||'').trim();
      const qty     = parseInt(val(row,C.qty))||0;
      const min     = parseInt(val(row,C.min))||0;
      const cost    = parseFloat(val(row,C.cost))||0;
      const price   = parseFloat(val(row,C.price))||0;
      const priceWholesale = C.wholesale>=0 ? (parseFloat(row[C.wholesale])||0) : 0;
      const desc    = String(val(row,C.desc)||'').trim();
      const statRaw = String(val(row,C.status)||'').trim();

      const catId   = findCatId(catName);
      const branchId= brName?(branchMap[brName.toLowerCase()]||''):(CURRENT_USER?.branch||'');
      const whId    = findWhId(branchId, whName);
      const whNameFinal  = whId?getWhName(whId):'';

      if(catName&&!catId) errors.push(`"${name}": الفئة "${catName}" غير موجودة — تم الإضافة بدون فئة`);
      if(whName&&!whId)   errors.push(`"${name}": المخزن "${whName}" غير موجود — تم اختيار أول مخزن متاح`);
      if(!price)          errors.push(`"${name}": سعر البيع فارغ أو غير رقمي`);

      // حقول موحدة — كلا الـ naming conventions
      const prodData = {
        name, code, barcode:code,
        cat:catId, category:catId,
        branchId, branch:branchId, branchName:getBranchName(branchId)||'مركزي',
        warehouseId:whId, whId, warehouseName:whNameFinal,
        qty, min, minQty:min, cost, price, desc,
        updatedAt:new Date().toISOString()
      };
      // الأعمدة الاختيارية تُكتب فقط لو كانت موجودة في الملف،
      // وإلا فاستيراد ملف ناقص عمود كان سيمسح القيمة المحفوظة
      if(C.wholesale>=0) prodData.priceWholesale = priceWholesale;
      if(C.serial>=0)    prodData.serial = serial;
      if(C.unit>=0&&unitRaw) prodData.unit = UNIT_MAP[unitRaw.toLowerCase()]||UNIT_MAP[unitRaw]||'piece';
      if(C.status>=0&&statRaw) prodData.status = /متوقف|غير نشط|inactive/i.test(statRaw) ? 'inactive' : 'active';
      try{
        const existing = code
          ? Object.entries(S.products||{}).find(([,p])=>(p.code||p.barcode)===code)
          : Object.entries(S.products||{}).find(([,p])=>p.name?.toLowerCase()===name.toLowerCase());
        if(existing){
          await dbUpdate('products/'+existing[0], prodData); updated++;
        } else {
          // القيم الافتراضية تُكتب عند الإنشاء فقط حتى لا يدهس التحديث تعديلات المستخدم
          prodData.status = prodData.status||'active';
          prodData.unit   = prodData.unit||'piece';
          prodData.emoji  = '📦';
          prodData.createdAt = new Date().toISOString();
          await dbSet('products/'+uid(), prodData);
          if(qty>0) await dbPushMovement({
            date:new Date().toISOString(),product:name,type:'in',
            qty,branchId,warehouseId:whId,note:'استيراد Excel'
          });
          added++;
        }
      }catch(e){ errors.push(name+': '+e.message); }
    }
    showImportResult('import-prod-result',added,updated,errors,'المنتجات');
  }catch(e){ toast('خطأ في قراءة الملف: '+e.message,'error'); }
  finally{ event.target.value=''; }
}

// ── تنزيل / استيراد فواتير الشراء ──────────────────────
function downloadPurchaseTemplate(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const supNames  = Object.values(S.suppliers||{}).map(s=>s.name).join(', ')||'مورد أول';
  const prodNames = Object.values(S.products||{}).slice(0,3).map(p=>p.name).join(', ')||'اسم المنتج';
  const today = new Date().toISOString().slice(0,10);
  const headers = [['اسم المورد *','الفرع','التاريخ (YYYY-MM-DD)','اسم المنتج *','الكمية *','سعر الشراء *','طريقة الدفع','المبلغ المدفوع','ملاحظات']];
  const examples = [
    ['مورد أول',Object.values(S.branches||{})[0]?.name||'',today,Object.values(S.products||{})[0]?.name||'منتج أول',5,100,'cash',500,''],
    ['مورد أول',Object.values(S.branches||{})[0]?.name||'',today,Object.values(S.products||{})[1]?.name||'منتج ثاني',3,200,'cash',0,'آجل'],
    ['مورد ثاني',Object.values(S.branches||{})[0]?.name||'',today,Object.values(S.products||{})[0]?.name||'منتج أول',2,150,'transfer',300,''],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols'] = [{wch:22},{wch:18},{wch:18},{wch:26},{wch:10},{wch:14},{wch:14},{wch:16},{wch:28}];
  XLSX.utils.book_append_sheet(wb,ws,'فواتير الشراء');
  const info = [
    ['تعليمات استيراد فواتير الشراء'],[''],
    ['الحقل','إلزامي؟','ملاحظات'],
    ['اسم المورد','✅ نعم','يُنشأ تلقائياً إن لم يكن موجوداً — المتاحون: '+supNames],
    ['الفرع','اختياري','اسم الفرع'],
    ['التاريخ','اختياري','صيغة YYYY-MM-DD — مثال: '+today],
    ['اسم المنتج','✅ نعم','يجب أن يكون موجوداً — المتاحون: '+prodNames],
    ['الكمية','✅ نعم','عدد صحيح'],
    ['سعر الشراء','✅ نعم','سعر الوحدة'],
    ['طريقة الدفع','اختياري','cash / card / transfer / credit'],
    ['المبلغ المدفوع','اختياري','0 = آجل كامل'],
    [''],['⚠️ الصفوف المتتالية لنفس المورد في نفس اليوم تُجمع في فاتورة واحدة'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{wch:20},{wch:12},{wch:60}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'تعليمات');
  XLSX.writeFile(wb,'نموذج-استيراد-المشتريات.xlsx');
  toast('✅ تم تنزيل قالب المشتريات');
}

async function importPurchasesFromExcel(event){
  const file = event.target.files[0]; if(!file) return;
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  toast('جارٍ قراءة الملف...','info');
  try{
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data,{type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    // تحديد الأعمدة من عناوينها — ترتيب الأعمدة غير مهم
    const hdr = (rows[0]||[]).map(h=>String(h||'').trim());
    const colIdx = (needles, fallback=-1)=>xlColIdx(hdr, needles, fallback);
    const C = {
      sup:    colIdx(['المورد'], 0),
      branch: colIdx(['الفرع'], 1),
      date:   colIdx(['التاريخ'], 2),
      prod:   colIdx(['اسم المنتج','الصنف'], 3),
      qty:    colIdx(['الكمية'], 4),
      price:  colIdx(['سعر الشراء','التكلفة'], 5),
      pay:    colIdx(['طريقة الدفع'], 6),
      paid:   colIdx(['المبلغ المدفوع','المدفوع'], 7),
      notes:  colIdx(['ملاحظات'], 8),
    };
    const val = (row,i)=> i>=0 ? (row[i] ?? '') : '';

    const dataRows = rows.slice(1).filter(r=>String(val(r,C.sup)).trim()&&String(val(r,C.prod)).trim());
    if(!dataRows.length){ toast('لا توجد بيانات صالحة — تأكد من عمودَي «اسم المورد» و«اسم المنتج»','error'); return; }

    const branchMap={}, prodMap={}, supMap={};
    Object.entries(S.branches||{}).forEach(([id,b])=>{ if(b.name) branchMap[b.name.trim().toLowerCase()]=id; });
    Object.entries(S.products||{}).forEach(([id,p])=>{ if(p.name) prodMap[p.name.trim().toLowerCase()]=id; });
    Object.entries(S.suppliers||{}).forEach(([id,s])=>{ if(s.name) supMap[s.name.trim().toLowerCase()]=id; });

    // تجميع الصفوف في فواتير (نفس المورد + نفس اليوم = فاتورة واحدة)
    let added=0,errors=[];
    const groups={};
    for(const row of dataRows){
      const supName   = String(val(row,C.sup)).trim();
      const brName    = String(val(row,C.branch)).trim();
      // التاريخ قد يأتي كرقم تسلسلي من Excel — نحوّله لصيغة YYYY-MM-DD
      const dateVal   = xlDate(val(row,C.date)) || new Date().toISOString().slice(0,10);
      const prodName  = String(val(row,C.prod)).trim();
      const qty       = parseInt(val(row,C.qty))||1;
      const price     = parseFloat(val(row,C.price))||0;
      const payMethod = String(val(row,C.pay)||'cash').trim()||'cash';
      const paid      = parseFloat(val(row,C.paid))||0;
      const notes     = String(val(row,C.notes)).trim();
      if(!supName||!prodName||!price){
        if(supName&&prodName&&!price) errors.push(`"${prodName}" للمورد "${supName}": سعر الشراء فارغ — تم تخطي السطر`);
        continue;
      }
      const key = supName.toLowerCase()+'||'+dateVal;
      if(!groups[key]) groups[key]={ supName,brName,date:dateVal,payMethod,paid,notes,items:[] };
      groups[key].paid = Math.max(groups[key].paid,paid);
      groups[key].items.push({prodName,qty,price});
    }

    for(const inv of Object.values(groups)){
      try{
        // المورد
        let supId = supMap[inv.supName.toLowerCase()];
        if(!supId){
          supId=uid();
          await dbSet('suppliers/'+supId,{name:inv.supName,phone:'',createdAt:new Date().toISOString()});
          supMap[inv.supName.toLowerCase()]=supId;
        }
        const branchId = inv.brName ? (branchMap[inv.brName.toLowerCase()]||CURRENT_USER?.branch||'') : (CURRENT_USER?.branch||'');
        // بنود الفاتورة
        const items=[]; let subtotal=0;
        for(const it of inv.items){
          const prodId = prodMap[it.prodName.toLowerCase()];
          if(!prodId){ errors.push(`منتج غير موجود: "${it.prodName}" — تم تخطي هذا السطر`); continue; }
          // أسماء الحقول نفسها المستخدمة في شاشة أوامر الشراء (savePO)
          // حتى تُقرأ الفاتورة المستوردة في العرض والمرتجعات والتقارير بلا اختلاف
          items.push({
            productId:prodId, productName:it.prodName,
            prodId,           name:it.prodName,
            qty:it.qty, cost:it.price
          });
          subtotal += it.qty*it.price;
          const p = (S.products||{})[prodId];
          let costInfo={};
          if(p){
            const newCost=weightedCost(p.qty, p.cost, it.qty, it.price);   // متوسط مرجّح زي استلام أمر الشراء
            costInfo={productId:prodId, costBefore:+p.cost||0, costAfter:newCost, unitCost:+it.price||0};
            await dbUpdate('products/'+prodId,{qty:Math.max(0,(+p.qty||0)+it.qty),updatedAt:new Date().toISOString(),
              ...(newCost!==(+p.cost||0)?{cost:newCost, costUpdatedAt:new Date().toISOString()}:{})});
          }
          await dbPushMovement({date:new Date(inv.date).toISOString(),product:it.prodName,type:'in',qty:it.qty,branchId,note:'استيراد مشتريات Excel',...costInfo});
        }
        if(!items.length) continue;
        const vat   = parseFloat(S.settings?.general?.vat||0)/100;
        const total = subtotal*(1+vat);
        const amtPaid = Math.min(inv.paid||0,total);
        const balance = total-amtPaid;
        // البضاعة دخلت المخزن فعلاً ⇒ الحالة "received" كما في savePO
        await dbSet('purchaseOrders/'+uid(),{
          poNumber:'PO-'+Date.now().toString().substr(-6)+'-'+(added+1),
          supplierId:supId, supplierName:inv.supName,
          branchId: branchId||null, branchName:getBranchName(branchId)||'النظام المركزي',
          date:inv.date, items, subtotal, total,
          amountPaid:amtPaid, balance,
          status:'received',
          payStatus: balance<=0?'completed':amtPaid>0?'partial':'pending',
          paymentMethod:inv.payMethod, notes:inv.notes,
          importedFromExcel:true,
          createdBy:CURRENT_USER?.id||'', createdByName:CURRENT_USER?.name||'',
          createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
          ...shiftStamp(),
        });
        added++;
      }catch(e){ errors.push(inv.supName+': '+e.message); }
    }
    showImportResult('import-pur-result',added,0,errors,'فواتير الشراء');
  }catch(e){ toast('خطأ في قراءة الملف: '+e.message,'error'); }
  finally{ event.target.value=''; }
}

// ── تنزيل / استيراد العملاء ─────────────────────────────
function downloadCustomerTemplate(){
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const headers = [['الاسم *','رقم الهاتف','البريد الإلكتروني','العنوان','الفرع','نوع العميل','رصيد افتتاحي (دين)','ملاحظات']];
  const b0 = Object.values(S.branches||{})[0]?.name||'';
  const examples = [
    ['أحمد محمد','01012345678','ahmed@email.com','القاهرة — مدينة نصر',b0,'قطاعي',0,'عميل مميز'],
    ['سارة خالد','01098765432','','الجيزة — الدقي',b0,'جملة',1500,'دين سابق'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols'] = [{wch:22},{wch:16},{wch:28},{wch:30},{wch:18},{wch:14},{wch:20},{wch:28}];
  XLSX.utils.book_append_sheet(wb,ws,'العملاء');
  const info = [
    ['تعليمات استيراد العملاء'],[''],
    ['الحقل','إلزامي؟','الوصف'],
    ['الاسم','✅ نعم','اسم العميل'],
    ['رقم الهاتف','اختياري','يُستخدم للتعرف على العميل عند التحديث وللإرسال على واتساب'],
    ['البريد الإلكتروني','اختياري',''],
    ['العنوان','اختياري',''],
    ['الفرع','اختياري','اسم الفرع — المتاح: '+(Object.values(S.branches||{}).map(b=>b.name).join(', ')||'—')],
    ['نوع العميل','اختياري','قطاعي أو جملة — يحدد السعر الافتراضي له في الكاشير. الافتراضي: قطاعي'],
    ['رصيد افتتاحي','اختياري','دين سابق على العميل — يُسجَّل عند الإضافة فقط ولا يُعدَّل عند التحديث'],
    ['ملاحظات','اختياري',''],
    [''],['- العملاء الموجودون (بنفس الهاتف أو الاسم) تُحدَّث بياناتهم'],
    ['- الرصيد وإجمالي المشتريات لا يُمسّان عند التحديث'],
    ['- ترتيب الأعمدة غير مهم — النظام يتعرّف عليها من عناوينها'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{wch:20},{wch:12},{wch:70}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'تعليمات');
  XLSX.writeFile(wb,'نموذج-استيراد-العملاء.xlsx');
  toast('✅ تم تنزيل قالب العملاء');
}

async function importCustomersFromExcel(event){
  const file = event.target.files[0]; if(!file) return;
  if(!xlsxReady()){ toast('مكتبة Excel غير محملة','error'); return; }
  toast('جارٍ قراءة الملف...','info');
  try{
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data,{type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});

    const branchMap={};
    Object.entries(S.branches||{}).forEach(([id,b])=>{ if(b.name) branchMap[b.name.trim().toLowerCase()]=id; });

    // تحديد الأعمدة من عناوينها مع رجوع لموضع ثابت
    const hdr = (rows[0]||[]).map(h=>String(h||'').trim());
    const colIdx = (needles, fallback=-1)=>xlColIdx(hdr, needles, fallback);
    const C = {
      name:    colIdx(['الاسم','اسم العميل'], 0),
      phone:   colIdx(['هاتف','جوال','موبايل'], 1),
      email:   colIdx(['بريد','ايميل','إيميل'], 2),
      addr:    colIdx(['العنوان'], 3),
      branch:  colIdx(['الفرع'], 4),
      type:    colIdx(['نوع العميل','النوع'], -1),
      balance: colIdx(['رصيد','دين'], -1),
      notes:   colIdx(['ملاحظات'], 5),
    };
    // ?? لا || حتى لا يتحول الرقم 0 إلى قيمة فارغة فيُحذف الصف
    const val = (row,i)=> i>=0 ? (row[i] ?? '') : '';

    // الصفوف الصالحة = التي بها اسم عميل، أياً كان موضع عمود الاسم
    const dataRows = rows.slice(1).filter(r=>String(val(r,C.name)).trim());
    if(!dataRows.length){ toast('لا توجد بيانات — تأكد من وجود عمود «الاسم»','error'); return; }

    let added=0,updated=0,errors=[];
    for(const row of dataRows){
      const name  = String(val(row,C.name)||'').trim(); if(!name) continue;
      const phone = String(val(row,C.phone)||'').trim();
      const email = String(val(row,C.email)||'').trim();
      const addr  = String(val(row,C.addr)||'').trim();
      const brName= String(val(row,C.branch)||'').trim();
      const notes = String(val(row,C.notes)||'').trim();
      const typeRaw = String(val(row,C.type)||'').trim();
      const openBal = parseFloat(val(row,C.balance))||0;
      const branchId = brName ? (branchMap[brName.toLowerCase()]||'') : (CURRENT_USER?.branch||'');
      if(brName&&!branchMap[brName.toLowerCase()]) errors.push(`"${name}": الفرع "${brName}" غير موجود`);

      const data2 = { name,phone,email,addr,notes,branchId,
        branchName:getBranchName(branchId)||'',
        updatedAt:new Date().toISOString(), updatedBy:CURRENT_USER?.id||'' };
      // نوع العميل يحدد سعره الافتراضي في الكاشير — يُكتب فقط لو العمود موجود
      if(C.type>=0&&typeRaw) data2.custType = /جملة|wholesale/i.test(typeRaw) ? 'wholesale' : 'retail';

      try{
        const existing = phone
          ? Object.entries(S.customers||{}).find(([,c])=>c.phone===phone)
          : Object.entries(S.customers||{}).find(([,c])=>c.name?.toLowerCase()===name.toLowerCase());
        if(existing){
          // الرصيد وإجمالي المشتريات لا يُمسّان عند التحديث حتى لا تُمحى ديون قائمة
          await dbUpdate('customers/'+existing[0],data2); updated++;
        } else {
          await dbSet('customers/'+uid(),{
            ...data2,
            custType: data2.custType||'retail',
            totalBuy:0, balance:openBal,
            createdAt:new Date().toISOString(), createdBy:CURRENT_USER?.id||''
          });
          added++;
        }
      }catch(e){ errors.push(name+': '+e.message); }
    }
    showImportResult('import-cust-result',added,updated,errors,'العملاء');
  }catch(e){ toast('خطأ في قراءة الملف: '+e.message,'error'); }
  finally{ event.target.value=''; }
}

