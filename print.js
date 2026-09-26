// ============================================================
// طباعة نظيفة — تطبع محتوى عنصر واحد في نافذة مستقلة
// ============================================================
// window.print() على الصفحة نفسها كان يطبع القائمة الجانبية والأزرار
// وإطار المودال. هنا نأخذ محتوى العنصر فقط وننظّفه من عناصر الواجهة.
function printNodeClean(elId, title='طباعة'){
  const src=document.getElementById(elId);
  if(!src || !src.innerHTML.trim()){ toast('لا يوجد محتوى للطباعة','error'); return; }

  // نسخة معزولة ننظّف منها كل ما لا يُطبع
  const clone=src.cloneNode(true);
  clone.querySelectorAll('button, .btn, .close-btn, input, select, textarea, .modal-foot, canvas')
       .forEach(n=>n.remove());

  const g=S.settings?.general||{};
  const w=window.open('','_blank','width=900,height=760');
  if(!w){ toast('يرجى السماح بالنوافذ المنبثقة','error'); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:12mm;}
  body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;color:#111;font-size:12px;padding:10px;}
  h1{font-size:17px;margin-bottom:3px;}
  .print-meta{font-size:11px;color:#555;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  th{background:#f2f2f2;border:1px solid #999;padding:6px 8px;text-align:right;font-size:11px;}
  td{border:1px solid #ccc;padding:5px 8px;text-align:right;font-size:11px;}
  tr{page-break-inside:avoid;}
  /* عناصر الواجهة لا تُطبع */
  button,.btn,.close-btn,input,select,textarea,.modal-foot{display:none!important;}
  .badge{border:1px solid #999;border-radius:8px;padding:1px 6px;font-size:10px;}
</style></head><body>
<h1>${g.name||g.sysName||'الشمس'} — ${title}</h1>
<div class="print-meta">طُبع ${new Date().toLocaleString('ar-EG')} • بواسطة ${CURRENT_USER?.name||'—'}</div>
${clone.innerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body></html>`);
  w.document.close();
}

function printSaleDetail(){
  printNodeClean('sale-detail-content','تفاصيل الفاتورة');
}

