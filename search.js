// ============================================================
// GLOBAL PRODUCT SEARCH — البحث الشامل في كل الفروع
// ============================================================
let gsCurrentProdId = ''; // المنتج المحدد في البحث الشامل

function openGlobalSearch() {
  const searchEl = document.getElementById('gs-input');
  // نقل نص البحث الحالي من كاشير البحث
  const currentSearch = document.getElementById('cs-search')?.value||'';
  if(searchEl) searchEl.value = currentSearch;
  // إخفاء/إظهار الأقسام
  document.getElementById('gs-empty').style.display     = 'block';
  document.getElementById('gs-notfound').style.display  = 'none';
  document.getElementById('gs-results').style.display   = 'none';
  gsCurrentProdId = '';
  openModal('modal-global-search');
  setTimeout(()=>{ document.getElementById('gs-input')?.focus(); if(currentSearch) runGlobalSearch(); }, 200);
}

function runGlobalSearch() {
  const q = (document.getElementById('gs-input')?.value||'').trim().toLowerCase();

  const emptyEl    = document.getElementById('gs-empty');
  const notfoundEl = document.getElementById('gs-notfound');
  const resultsEl  = document.getElementById('gs-results');

  if(q.length < 2) {
    emptyEl.style.display    = 'block';
    notfoundEl.style.display = 'none';
    resultsEl.style.display  = 'none';
    return;
  }

  // البحث في كل المنتجات بغض النظر عن الفرع
  const matches = Object.entries(S.products||{}).filter(([,p])=>
    p.status==='active' && (
      (p.name||'').toLowerCase().includes(q) ||
      (p.barcode||p.code||'').toLowerCase().includes(q) ||
      (p.desc||'').toLowerCase().includes(q)
    )
  );

  if(!matches.length) {
    emptyEl.style.display    = 'none';
    notfoundEl.style.display = 'block';
    resultsEl.style.display  = 'none';
    gsCurrentProdId = '';
    return;
  }

  // إذا كان هناك أكثر من منتج — عرض أول نتيجة وعرض قائمة
  emptyEl.style.display    = 'none';
  notfoundEl.style.display = 'none';
  resultsEl.style.display  = 'block';

  // تجميع المنتجات بالاسم (نفس المنتج في فروع مختلفة)
  const productGroups = {};
  matches.forEach(([id,p])=>{
    const key = p.name?.trim().toLowerCase();
    if(!productGroups[key]) productGroups[key] = [];
    productGroups[key].push([id,p]);
  });

  // إذا أكثر من مجموعة — عرض القائمة أولاً
  const groups = Object.values(productGroups);
  if(groups.length > 1) {
    // عرض قائمة اختيار
    const currency = S.settings?.general?.currency||'EGP';
    document.getElementById('gs-product-card').innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;">
        وُجد ${groups.length} منتج — اختر الذي تريده:
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${groups.map(g=>{
          const p = g[0][1];
          const totalQty = g.reduce((s,[,pp])=>s+(+pp.qty||0),0);
          return `<div onclick="gsSelectProduct('${g[0][0]}')"
            style="padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:9px;
                   cursor:pointer;display:flex;justify-content:space-between;align-items:center;"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <div>
              <div style="font-weight:700;">${p.name}</div>
              <div style="font-size:11px;color:var(--text2);">${p.barcode||p.code||''}</div>
            </div>
            <div style="text-align:left;">
              <div style="font-size:13px;font-weight:700;color:var(--accent);">${Number(p.price||0).toFixed(2)} ${currency}</div>
              <div style="font-size:10px;color:${totalQty>0?'var(--green)':'var(--red)'};">إجمالي المخزون: ${totalQty}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    document.getElementById('gs-branches-grid').innerHTML = '';
    document.getElementById('gs-all-zero').style.display = 'none';
    document.getElementById('gs-add-wrap').style.display = 'none';
    return;
  }

  // منتج واحد — عرض تفاصيله
  gsSelectProduct(matches[0][0]);
}

function gsSelectProduct(prodId) {
  gsCurrentProdId = prodId;
  const currency = S.settings?.general?.currency||'EGP';

  // جمع كل نسخ هذا المنتج في كل الفروع (نفس الاسم)
  const baseProd = (S.products||{})[prodId]; if(!baseProd) return;
  const allVersions = Object.entries(S.products||{}).filter(([,p])=>
    p.name?.trim().toLowerCase() === baseProd.name?.trim().toLowerCase() && p.status==='active'
  );

  // بطاقة المنتج
  const catName = (S.categories||{})[baseProd.cat||baseProd.category]?.name||'—';
  document.getElementById('gs-emoji').textContent       = baseProd.emoji||'📦';
  document.getElementById('gs-prod-name').textContent   = baseProd.name||'—';
  document.getElementById('gs-prod-cat').textContent    = catName;
  document.getElementById('gs-prod-code').textContent   = baseProd.barcode||baseProd.code?`الباركود: ${baseProd.barcode||baseProd.code}`:'';
  document.getElementById('gs-prod-price').textContent  = Number(baseProd.price||0).toFixed(2)+' '+currency;

  // بناء شبكة الفروع
  const grid     = document.getElementById('gs-branches-grid');
  const myBranch = CURRENT_USER?.branch||'';
  const myWhs    = myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch).map(([id])=>id)
    : [];

  // تجميع الكميات بالفرع/المخزن
  const branchMap = {};
  allVersions.forEach(([id,p])=>{
    const brId = p.branchId||p.branch||'__main__';
    const whId = p.warehouseId||p.whId||'';
    const key  = brId+'||'+whId;
    if(!branchMap[key]) branchMap[key] = {brId,whId,qty:0,prodId:id};
    branchMap[key].qty += +p.qty||0;
  });

  const totalQty = Object.values(branchMap).reduce((s,v)=>s+v.qty,0);
  let hasMyBranch = false;
  let myBranchProdId = '';

  grid.innerHTML = Object.entries(branchMap)
    .sort(([,a],[,b])=>b.qty-a.qty)
    .map(([,entry])=>{
      const {brId,whId,qty,prodId:pid} = entry;
      const isMyBranch  = brId===myBranch || myWhs.includes(whId);
      if(isMyBranch && qty>0) { hasMyBranch=true; myBranchProdId=pid; }

      const branchName = brId==='__main__' ? 'المخزن الرئيسي' : (getBranchName(brId)||'غير محدد');
      const whName     = whId ? (getWhName(whId)||'') : '';
      const isAvailable= qty>0;
      const isLow      = qty>0 && qty<=5;
      const borderColor= isMyBranch?'var(--accent)':isAvailable?'var(--green)':'var(--border)';
      const bgColor    = isMyBranch?'var(--accent-bg)':isAvailable?'rgba(63,185,80,.06)':'var(--card2)';
      const qtyColor   = qty===0?'var(--red)':isLow?'var(--yellow)':'var(--green)';

      return `<div style="border:2px solid ${borderColor};background:${bgColor};border-radius:12px;padding:13px;position:relative;">
        ${isMyBranch?`<div style="position:absolute;top:8px;left:8px;background:var(--accent);color:#fff;border-radius:6px;font-size:9px;font-weight:700;padding:2px 7px;">فرعك</div>`:''}
        <div style="font-size:13px;font-weight:800;margin-bottom:4px;">${branchName}</div>
        ${whName?`<div style="font-size:10px;color:var(--text3);margin-bottom:8px;"><i class="fas fa-warehouse" style="color:var(--accent);"></i> ${whName}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;color:var(--text2);">الكمية المتاحة</div>
            <div style="font-size:22px;font-weight:900;color:${qtyColor};">${qty}</div>
          </div>
          <div style="font-size:22px;">${qty===0?'❌':isLow?'⚠️':'✅'}</div>
        </div>
        ${isAvailable&&!isMyBranch?`<div style="font-size:10px;color:var(--text2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border2);"><i class="fas fa-truck" style="color:var(--accent);"></i> يمكن طلب النقل من هذا الفرع</div>`:''}
        ${!isAvailable?`<div style="font-size:10px;color:var(--red);margin-top:4px;font-weight:700;">نفاد المخزون</div>`:''}
      </div>`;
    }).join('');

  // إظهار تحذير نفاد الكل
  document.getElementById('gs-all-zero').style.display = totalQty===0?'block':'none';

  // إظهار زر الإضافة للسلة
  const addWrap = document.getElementById('gs-add-wrap');
  const addBtn  = document.getElementById('gs-add-btn');
  if(hasMyBranch && myBranchProdId) {
    addWrap.style.display = 'block';
    addBtn.setAttribute('data-id', myBranchProdId);
    const myQty = branchMap[Object.keys(branchMap).find(k=>{
      const v=branchMap[k];
      return v.brId===myBranch||myWhs.includes(v.whId);
    })]?.qty||0;
    addBtn.innerHTML = `<i class="fas fa-cart-plus"></i> إضافة للسلة من مخزنك (متاح: ${myQty})`;
    addBtn.disabled = myQty===0;
  } else {
    addWrap.style.display = 'none';
  }
}

function gsAddToCart() {
  const btn    = document.getElementById('gs-add-btn');
  const prodId = btn?.getAttribute('data-id')||gsCurrentProdId;
  if(!prodId) return;
  addToCart(prodId);
  closeModal('modal-global-search');
  toast('✅ تم إضافة المنتج للسلة');
}

