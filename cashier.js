// ============================================================
// CASHIER
// ============================================================
let cart=[]; let payMethod='cash';

// ============================================================
// نظام البيع بالجملة والقطاعي
// ============================================================
// وضع البيع الحالي للسلة كلها. يتغيّر بالزر أو تلقائياً حسب نوع العميل.
let saleMode='retail';

const PRICE_MODE_LABELS={retail:'قطاعي', wholesale:'جملة'};
const SALE_MODE_LABEL = m => m==='mixed' ? 'مختلط (قطاعي وجملة)' : (PRICE_MODE_LABELS[m]||'قطاعي');

// سعر المنتج حسب الوضع. سعر الجملة اختياري — لو غير محدد نرجع لسعر القطاعي.
function productPrice(p, mode=saleMode){
  if(!p) return 0;
  const retail=+p.price||0;
  if(mode!=='wholesale') return retail;
  const wh=+p.priceWholesale||0;
  return wh>0 ? wh : retail;
}

// هل للمنتج سعر جملة حقيقي مختلف عن القطاعي؟
function hasWholesalePrice(p){ return (+p?.priceWholesale||0)>0; }

function custTypeBadge(type){
  return type==='wholesale'
    ? '<span class="badge badge-purple" title="يُباع له بسعر الجملة"><i class="fas fa-boxes"></i> جملة</span>'
    : '<span class="badge badge-info" title="يُباع له بسعر القطاعي"><i class="fas fa-user"></i> قطاعي</span>';
}

// تبديل وضع البيع للسلة كلها (زر قطاعي/جملة)
function setSaleMode(mode, opts={}){
  const prev=saleMode;
  saleMode = mode==='wholesale' ? 'wholesale' : 'retail';
  document.querySelectorAll('.sale-mode-btn').forEach(b=>
    b.classList.toggle('active', b.dataset.mode===saleMode));

  // إعادة تسعير أصناف السلة — عدا التي غيّرها الكاشير يدوياً
  let repriced=0;
  cart.forEach(item=>{
    if(item.priceLocked) return;
    const p=(S.products||{})[item.productId];
    if(!p) return;
    const np=productPrice(p,saleMode);
    if(np!==item.price){ item.price=np; repriced++; }
    item.priceMode=saleMode;
  });

  renderCart(); calcCart();
  searchCashierProducts(document.getElementById('cs-search')?.value||'');
  updateSaleModeHint();

  if(!opts.silent && prev!==saleMode){
    const locked=cart.filter(i=>i.priceLocked).length;
    toast(`وضع البيع: ${PRICE_MODE_LABELS[saleMode]}`+
          (repriced?` — تم تحديث ${repriced} صنف`:'')+
          (locked?` (${locked} صنف بسعر يدوي لم يتغيّر)`:''), 'info');
  }
}

function updateSaleModeHint(){
  const el=document.getElementById('sale-mode-hint'); if(!el) return;
  const locked=cart.filter(i=>i.priceLocked).length;
  el.innerHTML = locked
    ? `<i class="fas fa-lock" style="color:var(--yellow);"></i> ${locked} صنف بسعر مثبّت يدوياً`
    : '';
}

// تبديل سعر صنف واحد في السلة (يدوياً) — يتجاهل تغيير الوضع العام بعد كده
function toggleItemPriceMode(idx){
  const item=cart[idx]; if(!item) return;
  const p=(S.products||{})[item.productId];
  if(!p){ toast('المنتج لم يعد موجوداً','error'); return; }
  const next = item.priceMode==='wholesale' ? 'retail' : 'wholesale';
  if(next==='wholesale' && !hasWholesalePrice(p)){
    toast(`"${p.name}" ليس له سعر جملة — أضفه من صفحة المخزن`,'warning');
    return;
  }
  item.priceMode  = next;
  item.price      = productPrice(p,next);
  item.priceEdited= false; delete item.listPrice;   // التبديل بيرجّع سعر الكتالوج
  item.priceLocked= (next!==saleMode); // مثبّت فقط لو خالف الوضع العام
  renderCart(); calcCart(); updateSaleModeHint();
  toast(`"${item.name}" → سعر ${PRICE_MODE_LABELS[next]}`,'info');
}

// عند اختيار عميل: نحوّل الوضع لنوعه تلقائياً
function applyCustomerPriceMode(custId){
  const c=(S.customers||{})[custId]; if(!c) return;
  const mode=c.custType==='wholesale'?'wholesale':'retail';
  if(mode===saleMode) return;
  setSaleMode(mode,{silent:true});
  toast(`العميل "${c.name}" ${PRICE_MODE_LABELS[mode]} — تم تحويل الأسعار تلقائياً`,'info');
}

function renderCashier(){
  // فلتر المنتجات حسب فرع المستخدم ومخزنه
  const myBranch = CURRENT_USER?.branch||'';
  const myWarehouses = myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch&&wh.status==='active').map(([id])=>id)
    : [];

  const prods = Object.entries(S.products||{})
    .filter(([,p])=>{
      if(p.status!=='active') return false;
      // Admin أو بدون فرع → يرى كل المنتجات
      if(!myBranch || CURRENT_USER?.role==='admin') return true;
      // غير ذلك → فقط منتجات فرعه أو مخازنه
      const pBranch = p.branchId||p.branch||'';
      const pWh     = p.warehouseId||p.whId||'';
      return pBranch===myBranch || myWarehouses.includes(pWh) || (!pBranch&&!pWh);
    })
    .map(([id,p])=>({...p,id}));

  renderCashierProducts(prods);
  populateCsCatFilter();
  populateCsWhFilter();
  populateCsCashbox(payMethod||'cash');
  updateHeldBadge();
  syncCsBarHeight();
}

// ============================================================
// يزامن ارتفاع الشريط السفلي الفعلي مع متغير --csbar-h
// حتى لا تختبئ شبكة المنتجات أو السلة خلفه مهما تغيّر محتواه
// ============================================================
function syncCsBarHeight(){
  const bar = document.getElementById('cashier-bottombar');
  const pg  = document.getElementById('pg-cashier');
  if(!bar||!pg) return;
  // في الشاشات الصغيرة يصير الشريط ضمن تدفق الصفحة فلا حاجة للحساب
  if(getComputedStyle(bar).position!=='fixed'){ pg.style.removeProperty('--csbar-h'); return; }
  const h = Math.ceil(bar.getBoundingClientRect().height);
  if(h>0) pg.style.setProperty('--csbar-h', h+'px');
}

// يراقب أي تغيّر في محتوى الشريط (ظهور خانة الدفع المقدم، لف العناصر...) ويعيد الحساب
(function watchCsBar(){
  const bar=document.getElementById('cashier-bottombar');
  if(!bar) return;
  if(window.ResizeObserver) new ResizeObserver(()=>syncCsBarHeight()).observe(bar);
  window.addEventListener('resize',syncCsBarHeight);
  setTimeout(syncCsBarHeight,300);
})();

// مخازن الفرع الحالي فقط (الأدمن يرى الكل)
function populateCsWhFilter(){
  const el=document.getElementById('cs-wh-filter'); if(!el) return;
  const cur=el.value;
  const myBranch=CURRENT_USER?.branch||'';
  const whs=Object.entries(S.warehouses||{}).filter(([,wh])=>
    wh.status==='active' && (!myBranch||CURRENT_USER?.role==='admin'||wh.branchId===myBranch));
  el.innerHTML='<option value="">كل المخازن</option>'+
    whs.map(([id,wh])=>`<option value="${id}">${wh.name}</option>`).join('');
  el.value=cur;
}

function populateCsCatFilter(){
  const el=document.getElementById('cs-cat-filter'); if(!el) return;
  el.innerHTML='<option value="">كل الفئات</option>';
  Object.entries(S.categories||{}).forEach(([id,c])=>{
    const o=document.createElement('option'); o.value=id; o.textContent=c.name; el.appendChild(o);
  });
}

function searchCashierProducts(q=''){
  const catF     = document.getElementById('cs-cat-filter')?.value||'';
  const whF      = document.getElementById('cs-wh-filter')?.value||'';
  const myBranch = CURRENT_USER?.branch||'';
  const myWarehouses = myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch&&wh.status==='active').map(([id])=>id)
    : [];

  let prods = Object.entries(S.products||{})
    .filter(([,p])=>{
      if(p.status!=='active') return false;
      if(!myBranch || CURRENT_USER?.role==='admin') return true;
      const pBranch = p.branchId||p.branch||'';
      const pWh     = p.warehouseId||p.whId||'';
      return pBranch===myBranch || myWarehouses.includes(pWh) || (!pBranch&&!pWh);
    })
    .map(([id,p])=>({...p,id}));

  if(q)    prods = prods.filter(p=>(p.name||'').toLowerCase().includes(q.toLowerCase())||(p.barcode||p.code||'').includes(q));
  if(catF) prods = prods.filter(p=>(p.cat||p.category||'')===catF);
  if(whF)  prods = prods.filter(p=>(p.warehouseId||p.whId||'')===whF);
  renderCashierProducts(prods);

  // ── دعم قارئ الباركود: تطابق تام مع الباركود ← إضافة فورية للسلة ──
  if(q&&q.trim().length>=4){
    const code=q.trim();
    const exact=prods.find(p=>(p.barcode||p.code||'')===code&&(+p.qty||0)>0);
    if(exact){
      clearTimeout(window._csScanT);
      window._csScanT=setTimeout(()=>{
        const inp=document.getElementById('cs-search');
        if(inp&&inp.value.trim()===code){
          addToCart(exact.id);
          inp.value='';
          searchCashierProducts('');
          inp.focus();
        }
      },250);
    }
  }
}

// زر Enter في حقل البحث/الباركود — يضيف أول نتيجة مطابقة للسلة
function csScanKeydown(e){
  if(e.key!=='Enter') return;
  const inp=document.getElementById('cs-search');
  const q=(inp?.value||'').trim(); if(!q) return;
  const myBranch=CURRENT_USER?.branch||'';
  const myWarehouses=myBranch
    ? Object.entries(S.warehouses||{}).filter(([,wh])=>wh.branchId===myBranch&&wh.status==='active').map(([id])=>id)
    : [];
  const prods=Object.entries(S.products||{})
    .filter(([,p])=>{
      if(p.status!=='active') return false;
      if(!myBranch||CURRENT_USER?.role==='admin') return true;
      const pBranch=p.branchId||p.branch||'';
      const pWh=p.warehouseId||p.whId||'';
      return pBranch===myBranch||myWarehouses.includes(pWh)||(!pBranch&&!pWh);
    })
    .map(([id,p])=>({...p,id}));
  const exact=prods.find(p=>(p.barcode||p.code||'')===q&&(+p.qty||0)>0);
  const byName=prods.find(p=>(p.name||'').toLowerCase().includes(q.toLowerCase())&&(+p.qty||0)>0);
  const hit=exact||byName;
  if(hit){ addToCart(hit.id); inp.value=''; searchCashierProducts(''); inp.focus(); }
  else toast('لا يوجد منتج مطابق متاح','warning');
}

function renderCashierProducts(prods){
  const grid=document.getElementById('cs-products-grid'); if(!grid) return;
  const currency=S.settings?.general?.currency||'EGP';
  if(!prods.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2);">
      <div style="font-size:32px;margin-bottom:8px;">🔍</div>
      <div style="font-size:14px;font-weight:700;">لا توجد منتجات</div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">تحقق من المخزن أو الفئة</div>
    </div>`;
    return;
  }
  grid.innerHTML=prods.map(p=>{
    const prodId     = p.id||p._id||'';
    const stock      = +p.qty||0;
    const outOfStock = stock===0;
    const lowStock   = stock>0&&stock<=(+p.minQty||+p.min||5);
    const catName    = (S.categories||{})[p.cat||p.category]?.name||'';
    return `<div class="cs-product-card${outOfStock?' out-of-stock':''}"
      onclick="${outOfStock?`toast('نفاد المخزون','warning')`:`addToCart('${prodId}')`}"
      style="cursor:${outOfStock?'not-allowed':'pointer'}">
      ${lowStock?`<div class="stock-badge low-stock-badge">منخفض ${stock}</div>`:''}
      ${outOfStock?`<div class="stock-badge" style="background:var(--red-bg);color:var(--red);font-weight:700;">نفاد</div>`:''}
      <div class="cs-product-img">${p.emoji||'📦'}</div>
      <div class="cs-product-name">${p.name}</div>
      ${catName?`<div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${catName}</div>`:''}
      <div class="cs-product-price" style="${saleMode==='wholesale'?'color:var(--purple);':''}">
        ${Number(productPrice(p,saleMode)).toFixed(2)} ${currency}
      </div>
      ${hasWholesalePrice(p)
        ? `<div style="font-size:9.5px;color:var(--text3);margin-bottom:2px;">${
            saleMode==='wholesale'
              ? `قطاعي: ${Number(p.price||0).toFixed(2)}`
              : `جملة: ${Number(p.priceWholesale).toFixed(2)}`}</div>`
        : (saleMode==='wholesale'
            ? `<div style="font-size:9.5px;color:var(--text3);margin-bottom:2px;">بسعر القطاعي</div>`
            : '')}
      <div class="cs-product-stock" style="color:${outOfStock?'var(--red)':lowStock?'var(--yellow)':'var(--text3)'};">المخزون: ${stock}</div>
    </div>`;
  }).join('');
}

function addToCart(productId){
  const p=(S.products||{})[productId]; if(!p) return;
  const existing=cart.find(i=>i.productId===productId);
  if(existing){
    if(existing.qty>=p.qty){ toast('لا يوجد مخزون كافٍ','warning'); return; }
    existing.qty++;
  } else {
    cart.push({
      productId, name:p.name,
      price:productPrice(p,saleMode),   // السعر حسب وضع البيع الحالي
      priceMode:saleMode,
      priceLocked:false,                // يتبع الوضع العام حتى يغيّره الكاشير يدوياً
      disc:0, discType:'fixed',         // خصم خاص بهذا الصنف (قيمة ثابتة أو نسبة)
      serial:p.serial||'', desc:p.desc||'',  // يُنقلان للفاتورة المصممة
      cost:+p.cost||0, qty:1, maxQty:p.qty, emoji:p.emoji||'📦',
    });
  }
  renderCart(); calcCart();
}

function updateCartQty(idx,delta){
  const item=cart[idx]; if(!item) return;
  const newQty=item.qty+delta;
  if(newQty<=0){ cart.splice(idx,1); }
  else if(newQty>item.maxQty){ toast('لا يوجد مخزون كافٍ','warning'); return; }
  else { item.qty=newQty; }
  renderCart(); calcCart();
}

function removeFromCart(idx){ cart.splice(idx,1); renderCart(); calcCart(); }
function clearCart(){ cart=[]; renderCart(); calcCart(); }

// ── خصم لكل صنف على حِدة ──
// قيمة الخصم للصنف الواحد (بالعملة) — محسوبة على إجمالي السطر ومحدودة به
function lineGross(item){ return (+item.price||0)*(+item.qty||0); }
function lineDiscount(item){
  const gross=lineGross(item);
  let d=+item.disc||0;
  if(!(d>0)) return 0;
  if((item.discType||'fixed')==='pct'){ d=Math.min(100,d); return gross*d/100; }
  return Math.min(gross,d);
}
function lineNet(item){ return Math.max(0, lineGross(item)-lineDiscount(item)); }

function updateCartItemDisc(idx,val){
  const item=cart[idx]; if(!item) return;
  let v=parseFloat(val); if(!(v>=0)) v=0;
  if((item.discType||'fixed')==='pct') v=Math.min(100,v);
  item.disc=v;
  renderCart(); calcCart();
}
function toggleCartItemDiscType(idx){
  const item=cart[idx]; if(!item) return;
  item.discType=(item.discType||'fixed')==='fixed'?'pct':'fixed';
  if(item.discType==='pct') item.disc=Math.min(100,+item.disc||0);
  renderCart(); calcCart();
}

// ── تعديل سعر الصنف في السلة (صلاحية «تعديل سعر البيع» من مصفوفة الصلاحيات) ──
// الفاتورة بتطلع بالسعر الجديد عادي من غير أي إشارة للتعديل (طلب الزبون)،
// والسعر الأصلي بيتحفظ في بند الفاتورة (listPrice/priceEdited) للمراجعة بس.
function canEditPrice(){ return !!CURRENT_USER && hasPerm(CURRENT_USER.role,'act-edit-price'); }

async function updateCartItemPrice(idx,val){
  const item=cart[idx]; if(!item) return;
  if(!canEditPrice()){ toast('ليس لديك صلاحية تعديل السعر','error'); renderCart(); return; }
  const v=Math.round((parseFloat(val)||0)*100)/100;
  if(!(v>0)){ toast('أدخل سعراً صحيحاً','error'); renderCart(); return; }
  const p=(S.products||{})[item.productId];
  const listPrice = item.listPrice ?? productPrice(p,item.priceMode||saleMode);
  if(v<(+item.cost||0)){
    const ok=await confirm2(`السعر الجديد (${v.toFixed(2)}) أقل من تكلفة الصنف (${(+item.cost).toFixed(2)}) — هتبيع بخسارة.`,
      'سعر أقل من التكلفة','⚠️','متابعة','btn-warning');
    if(!ok){ renderCart(); return; }
  }
  item.price=v;
  item.listPrice=listPrice;
  item.priceEdited = Math.abs(v-listPrice)>0.001;
  item.priceLocked = item.priceEdited || (item.priceMode!==saleMode);   // تبديل قطاعي/جملة ميمسحش التعديل
  renderCart(); calcCart();
}

function renderCart(){
  const el=document.getElementById('cart-items'); if(!el) return;
  const currency=S.settings?.general?.currency||'EGP';
  if(!cart.length){
    el.innerHTML=`<div class="cart-empty"><div style="font-size:36px;margin-bottom:8px;">🛒</div><div style="font-size:12px;color:var(--text2);">السلة فارغة</div></div>`;
    return;
  }
  el.innerHTML=cart.map((item,i)=>{
    const mode=item.priceMode||'retail';
    const p=(S.products||{})[item.productId];
    const canToggle=hasWholesalePrice(p)||mode==='wholesale';
    const dType=item.discType||'fixed';
    const dAmt =lineDiscount(item);
    const gross=lineGross(item);
    return `
    <div class="cart-item">
      <div style="font-size:18px;">${item.emoji}</div>
      <div class="cart-item-name">
        ${item.name}
        <div class="cart-item-price">
          ${canEditPrice()
            ? `<input class="cart-price-input${item.priceEdited?' edited':''}" type="number" min="0" step="0.01"
                      value="${Number(item.price).toFixed(2)}" onchange="updateCartItemPrice(${i},this.value)"
                      onfocus="this.select()"
                      title="${item.priceEdited?'السعر الأصلي: '+Number(item.listPrice).toFixed(2):'اكتب سعراً جديداً لهذا الصنف'}">`
            : Number(item.price).toFixed(2)} ${currency} / وحدة
          <button class="cart-price-mode ${mode}" onclick="toggleItemPriceMode(${i})"
                  title="${canToggle?'اضغط للتبديل بين سعر القطاعي والجملة':'لا يوجد سعر جملة لهذا الصنف'}"
                  ${canToggle?'':'disabled style="opacity:.5;cursor:not-allowed;"'}>
            ${PRICE_MODE_LABELS[mode]}${item.priceLocked?' 🔒':''}
          </button>
        </div>
        <div class="cart-item-disc">
          <span class="lbl">خصم</span>
          <input class="cart-disc-input" type="number" min="0" ${dType==='pct'?'max="100"':''}
                 value="${+item.disc||0}"
                 onchange="updateCartItemDisc(${i},this.value)"
                 title="خصم خاص بهذا الصنف">
          <button class="cart-disc-type ${dAmt>0?'on':''}" onclick="toggleCartItemDiscType(${i})"
                  title="اضغط للتبديل بين خصم بقيمة ثابتة أو بنسبة مئوية">
            ${dType==='pct'?'%':currency}
          </button>
          ${dAmt>0?`<span style="font-size:10.5px;color:var(--red);font-weight:700;">- ${dAmt.toFixed(2)}</span>`:''}
        </div>
      </div>
      <div class="cart-qty-wrap">
        <button class="cart-qty-btn" onclick="updateCartQty(${i},-1)">−</button>
        <span class="cart-qty-val">${item.qty}</span>
        <button class="cart-qty-btn" onclick="updateCartQty(${i},1)">+</button>
      </div>
      <div class="cart-item-total">
        ${lineNet(item).toFixed(2)}
        ${dAmt>0?`<div class="cart-item-oldprice">${gross.toFixed(2)}</div>`:''}
      </div>
      <i class="fas fa-times cart-item-del" onclick="removeFromCart(${i})"></i>
    </div>`;
  }).join('');
  updateSaleModeHint();
}

function calcCart(){
  const currency=S.settings?.general?.currency||'EGP';
  const vat=parseFloat(S.settings?.general?.vat||0)/100;
  const subtotal=cart.reduce((s,i)=>s+lineGross(i),0);
  // 1) خصومات الأصناف تُخصم أولاً من إجمالي كل سطر
  const itemsDiscount=cart.reduce((s,i)=>s+lineDiscount(i),0);
  const afterItems=Math.max(0,subtotal-itemsDiscount);
  // 2) خصم الفاتورة يُطبَّق على المتبقي بعد خصومات الأصناف
  let discountVal=parseFloat(document.getElementById('ct-discount')?.value||0);
  if(!(discountVal>=0)) discountVal=0; // منع القيم السالبة (بترفع الإجمالي بدل ما تخصم منه)
  const discountType=document.getElementById('ct-discount-type')?.value||'fixed';
  if(discountType==='pct') discountVal=Math.min(100,discountVal); // منع أكتر من 100%
  const invDiscount=Math.min(afterItems, discountType==='pct'?afterItems*discountVal/100:discountVal);
  const discount=itemsDiscount+invDiscount;          // إجمالي الخصم المسجَّل على الفاتورة
  const afterDiscount=Math.max(0,afterItems-invDiscount);
  const vatAmt=afterDiscount*vat;
  const total=afterDiscount+vatAmt;

  document.getElementById('ct-subtotal').textContent=subtotal.toFixed(2)+' '+currency;
  const idWrap=document.getElementById('ct-items-disc-wrap');
  if(idWrap){
    idWrap.style.display=itemsDiscount>0?'flex':'none';
    const el=document.getElementById('ct-items-disc');
    if(el) el.textContent='-'+itemsDiscount.toFixed(2)+' '+currency;
  }
  const ivWrap=document.getElementById('ct-inv-disc-wrap');
  if(ivWrap){
    ivWrap.style.display=invDiscount>0?'flex':'none';
    const el=document.getElementById('ct-inv-disc');
    if(el) el.textContent='-'+invDiscount.toFixed(2)+' '+currency;
  }
  document.getElementById('ct-vat-pct').textContent=(vat*100).toFixed(0);
  document.getElementById('ct-vat').textContent=vatAmt.toFixed(2)+' '+currency;
  document.getElementById('ct-total').textContent=total.toFixed(2)+' '+currency;
  calcChange();
  calcCreditRemain();
  return{subtotal,discount,itemsDiscount,invDiscount,vatAmt,total};
}

// المتبقي ديناً في البيع الآجل = الإجمالي − الدفعة المقدمة
function calcCreditRemain(){
  const wrap=document.getElementById('credit-paid-wrap');
  if(!wrap||wrap.style.display==='none') return 0;
  const currency=S.settings?.general?.currency||'EGP';
  const total=parseFloat(document.getElementById('ct-total')?.textContent||0)||0;
  let paid=parseFloat(document.getElementById('ct-credit-paid')?.value||0);
  if(!(paid>=0)) paid=0;
  const remain=Math.max(0,total-Math.min(paid,total));
  const box=document.getElementById('credit-remain-wrap');
  if(box){
    const full=remain<=0;
    box.style.background =full?'var(--green-bg)':'var(--red-bg)';
    box.style.borderColor=full?'var(--green)'   :'var(--red)';
    box.style.color      =full?'var(--green)'   :'var(--red)';
    // نُحدّث نص العنصر الثابت فقط — بدون إعادة بناء innerHTML حتى لا يتكرر المعرّف
    const lbl=document.getElementById('ct-credit-remain-lbl');
    const val=document.getElementById('ct-credit-remain');
    if(lbl) lbl.textContent = full ? 'مدفوعة بالكامل — لا يوجد دين' : 'المتبقي ديناً: ';
    if(val){
      val.style.display = full ? 'none' : '';
      val.textContent   = remain.toFixed(2)+' '+currency;
    }
  }
  return remain;
}

function calcChange(){
  const currency=S.settings?.general?.currency||'EGP';
  const total=parseFloat(document.getElementById('ct-total')?.textContent||0);
  const received=parseFloat(document.getElementById('ct-received')?.value||0);
  const change=received-total;
  const wrap=document.getElementById('cart-change-wrap');
  if(wrap&&payMethod==='cash'&&received>0){
    wrap.style.display='block';
    document.getElementById('ct-change').textContent=(Math.max(0,change)).toFixed(2)+' '+currency;
    wrap.style.borderColor=change<0?'var(--red)':'var(--green)';
    wrap.style.background=change<0?'var(--red-bg)':'var(--green-bg)';
    wrap.style.color=change<0?'var(--red)':'var(--green)';
  } else if(wrap){ wrap.style.display='none'; }
}

function selectPayMethod(btn,method){
  payMethod=method;
  document.querySelectorAll('.pay-method-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const cashWrap=document.getElementById('cash-received-wrap');
  const changeWrap=document.getElementById('cart-change-wrap');
  const credWrap=document.getElementById('credit-paid-wrap');
  if(cashWrap) cashWrap.style.display=method==='cash'?'block':'none';
  if(changeWrap) changeWrap.style.display='none';
  // البيع الآجل: تظهر خانة "المدفوع مقدماً" — لو دفع جزءاً يُودَع في الخزينة والباقي دين
  if(credWrap) credWrap.style.display=method==='credit'?'flex':'none';
  const cbSel=document.getElementById('cs-cashbox');
  if(cbSel){ cbSel.disabled=false; cbSel.style.opacity='1'; }
  populateCsCashbox(method==='credit'?'cash':method);
  if(method==='credit'){
    const pEl=document.getElementById('ct-credit-paid');
    if(pEl) pEl.value='0';
    calcCreditRemain();
  }
}

function populateCsCashbox(preferType='cash') {
  const sel = document.getElementById('cs-cashbox'); if(!sel) return;
  const cbs = filterByBranch(S.cashboxes||{});
  const currency = S.settings?.general?.currency||'EGP';
  sel.innerHTML = '<option value="">-- بدون خزينة --</option>' +
    cbs.map(([id,cb])=>`<option value="${id}" data-type="${cb.type||'cash'}">${cb.name} (${(+cb.balance||0).toFixed(0)} ${currency})</option>`).join('');
  const typeMap = { cash:'cash', card:'card', transfer:'transfer' };
  const match = cbs.find(([,cb])=>cb.type===(typeMap[preferType]||'cash'));
  if(match) sel.value = match[0];
}

function searchCustomer(){ toast('بحث العملاء سيتم إضافته في مرحلة قادمة','info'); }

// يخصم كمية صنف واحد بأمان عبر Firebase transaction، بحيث لو جهاز/كاشير تاني
// باع نفس الصنف في نفس اللحظة، الاتنين ميعديوش على المخزون الفعلي.
async function deductStockSafely(productId, qty){
  // أوف لاين: نخصم من النسخة المحلية ونسجّل "مقدار الخصم" (دلتا) في الطابور.
  // نسجّل دلتا وليس الكمية النهائية حتى لا يمحو جهازٌ خصمَ جهاز آخر عند المزامنة.
  if(isOffline()){
    const cur=+((S.products||{})[productId]?.qty)||0;
    if(cur < qty) return {ok:false};
    await OM.enqueueStockDelta(productId, -qty);
    return {ok:true};
  }
  const stockRef = dbRef('products/'+productId+'/qty');
  let insufficient = false;
  const res = await window.$runTransaction(stockRef, (cur)=>{
    cur = cur||0;
    if(cur < qty){ insufficient = true; return; } // undefined = إلغاء الـ transaction بدون تعديل
    return cur - qty;
  });
  if(insufficient || !res.committed) return {ok:false};
  return {ok:true};
}

async function restoreStock(productId, qty){
  if(isOffline()){
    await OM.enqueueStockDelta(productId, +qty);
    return;
  }
  const stockRef = dbRef('products/'+productId+'/qty');
  await window.$runTransaction(stockRef, (cur)=>(cur||0)+qty);
}

async function completeSale(){
  if(!cart.length){ toast('السلة فارغة','warning'); return; }
  const totals=calcCart();
  const isCredit=payMethod==='credit';
  const received=parseFloat(document.getElementById('ct-received')?.value||0);
  if(payMethod==='cash'&&received<totals.total){ toast('المبلغ المستلم أقل من الإجمالي','error'); return; }

  const settings=S.settings?.general||{};
  const invPrefix=settings.invPrefix||'INV-';
  const invNum=invPrefix+Date.now().toString().substr(-6);
  const change=payMethod==='cash'?Math.max(0,received-totals.total):0;

  const custId   = document.getElementById('cs-customer-id')?.value||'';
  const custName = document.getElementById('cs-customer')?.value?.trim()||'عميل نقدي';
  // البيع الآجل يتطلب عميلاً مسجلاً لتسجيل الدين عليه
  if(isCredit&&!custId){ toast('البيع الآجل يتطلب اختيار عميل مسجل من القائمة (زر البحث أو +)','error'); return; }

  // ── البيع الآجل الجزئي: العميل يدفع جزءاً الآن والباقي يُسجَّل ديناً عليه ──
  let creditPaid=0;
  if(isCredit){
    creditPaid=parseFloat(document.getElementById('ct-credit-paid')?.value||0);
    if(!(creditPaid>0)) creditPaid=0;
    creditPaid=Math.min(creditPaid,totals.total);
  }
  // المبلغ الذي يدخل الخزينة فعلياً في هذه العملية
  const paidNow = isCredit ? creditPaid : totals.total;
  const cbId = document.getElementById('cs-cashbox')?.value||'';

  // الخزينة إلزامية في كل بيع — حتى البيع الآجل بلا دفعة مقدّمة، حتى تُنسب
  // الفاتورة لخزينة معلومة عند التحصيل لاحقاً ولا تضيع في تقفيلة الوردية.
  if(!cbId){
    const sel=document.getElementById('cs-cashbox');
    toast('اختر الخزينة أولاً — لا يمكن إتمام بيع بدون خزينة','error');
    if(sel){
      sel.focus();
      // وميض أحمر يلفت النظر لمكان الخانة في الشريط السفلي
      const prev=sel.style.borderColor;
      sel.style.borderColor='var(--red)';
      sel.style.boxShadow='0 0 0 3px var(--red-bg)';
      setTimeout(()=>{ sel.style.borderColor=prev; sel.style.boxShadow=''; },1800);
    }
    return;
  }
  const balanceDue = Math.max(0, totals.total - paidNow);

  const saleData={
    type:'pos',
    invNumber:invNum,
    items:cart.map(i=>({productId:i.productId,name:i.name,qty:i.qty,price:i.price,cost:+i.cost||0,
                        priceMode:i.priceMode||'retail',
                        // خصم الصنف: القيمة المدخلة، نوعها، وقيمتها المحسوبة بالعملة
                        disc:+i.disc||0, discType:i.discType||'fixed', discAmt:lineDiscount(i),
                        // السريال والوصف يُثبَّتان وقت البيع حتى لو تغيّر المنتج لاحقاً
                        serial:i.serial||(S.products||{})[i.productId]?.serial||'',
                        desc:i.desc||(S.products||{})[i.productId]?.desc||'',
                        gross:lineGross(i), total:lineNet(i),
                        // سعر اتعدّل يدوياً: الأصلي للمراجعة بس — مبيظهرش في الفاتورة
                        ...(i.priceEdited?{listPrice:+i.listPrice||0, priceEdited:true}:{})})),
    // وضع البيع العام للفاتورة، و"mixed" لو فيها أصناف بالسعرين معاً
    saleMode: cart.every(i=>(i.priceMode||'retail')===(cart[0].priceMode||'retail'))
              ? (cart[0].priceMode||'retail') : 'mixed',
    subtotal:totals.subtotal,
    discount:totals.discount,               // إجمالي الخصم (أصناف + فاتورة)
    itemsDiscount:totals.itemsDiscount||0,  // مجموع خصومات الأصناف
    invDiscount:totals.invDiscount||0,      // خصم على مستوى الفاتورة
    tax:totals.vatAmt,
    vat:totals.vatAmt,
    total:totals.total,
    payMethod,
    paymentMethod:payMethod,
    received:isCredit?creditPaid:(payMethod==='cash'?received:totals.total),
    amountPaid:paidNow,
    change:isCredit?0:change,
    balance:balanceDue,
    status: balanceDue<=0 ? 'paid' : (paidNow>0?'partial':'unpaid'),
    customer:  custName,
    custName:  custName,
    customerId:custId||'',
    notes:     document.getElementById('cs-notes')?.value?.trim()||'',
    // فاتورة تمت أثناء انقطاع الإنترنت — مخزونها خُصم محلياً وتُراجَع بعد المزامنة
    offlineCreated: isOffline(),
    cashboxId: cbId||'',
    cashboxName:(S.cashboxes||{})[cbId]?.name||'',
    cashierId:  CURRENT_USER?.id,
    cashierName:CURRENT_USER?.name||'',
    createdBy:  CURRENT_USER?.id,
    createdByName:CURRENT_USER?.name||'',
    branchId:   CURRENT_USER?.branch||'',
    branchName: getBranchName(CURRENT_USER?.branch)||'مركزي',
    date:       new Date().toISOString().slice(0,10),
    createdAt:  new Date().toISOString(),
    ...shiftStamp(),
  };

  // خصم المخزون أولاً وبأمان (transaction لكل صنف)، قبل تسجيل الفاتورة نهائيًا.
  // لو أي صنف نفد فعليًا وقت التنفيذ، نرجّع اللي اتخصم ونلغي العملية كلها.
  const deducted=[];
  for(const item of cart){
    const r = await deductStockSafely(item.productId, item.qty);
    if(!r.ok){
      for(const d of deducted) await restoreStock(d.productId, d.qty);
      toast(`الكمية المتاحة من "${item.name}" لم تعد كافية الآن. تم إلغاء عملية البيع، من فضلك حدّث السلة.`,'error');
      return;
    }
    deducted.push(item);
  }

  try{
    const saleId = uid();
    await dbSet('sales/'+saleId, saleData);

    // تحديث بيانات العميل (البيع الآجل يضيف ديناً على العميل)
    if(custId && (S.customers||{})[custId]){
      const c = S.customers[custId];
      const custUpdate={
        totalBuy:  (+c.totalBuy||0) + totals.total,
        lastVisit: new Date().toISOString(),
      };
      // الدين المضاف = الجزء غير المدفوع فقط (يدعم البيع الآجل الجزئي)
      if(balanceDue>0) custUpdate.balance=(+c.balance||0)+balanceDue;
      await dbUpdate('customers/'+custId,custUpdate);
    }

    // إيداع المبلغ المُحصَّل فعلياً في الخزينة المختارة
    if(cbId&&paidNow>0){
      await addCashboxEntry(
        cbId,
        paidNow,
        'deposit',
        balanceDue>0
          ? `دفعة مقدمة — فاتورة آجلة ${invNum}`
          : `مبيعات — فاتورة ${invNum}`,
        saleId
      );
    }

    // عرض الإيصال
    showReceipt(saleData);
    renderCashier(); // إعادة تحميل الكاشير مع فلتر الفرع الصحيح
  }catch(e){
    // فشل تسجيل الفاتورة بعد ما اتخصم المخزون فعليًا -> نرجّعه زي ما كان
    for(const d of deducted) await restoreStock(d.productId, d.qty);
    toast('خطأ: '+e.message,'error');
  }
}

function showReceipt(sale){
  const currency=S.settings?.general?.currency||'EGP';
  const line='─'.repeat(32);
  const center=str=>str.padStart(Math.floor((32+str.length)/2)).padEnd(32);
  let txt=`${center('☀️ الشمس | Shams ☀️')}\n${center(sale.branchName)}\n${line}\n`;
  txt+=`رقم الفاتورة: ${sale.invNumber}\n`;
  txt+=`التاريخ: ${new Date(sale.createdAt).toLocaleString('ar-EG')}\n`;
  txt+=`الكاشير: ${sale.cashierName}\n`;
  if(sale.customer&&sale.customer!=='عميل نقدي') txt+=`العميل: ${sale.customer}\n`;
  if(sale.saleMode) txt+=`نوع البيع: ${SALE_MODE_LABEL(sale.saleMode)}\n`;
  txt+=`${line}\n`;
  sale.items.forEach(i=>{
    const tag = sale.saleMode==='mixed' && i.priceMode ? ` [${PRICE_MODE_LABELS[i.priceMode]}]` : '';
    const gross = +i.gross || (+i.price||0)*(+i.qty||0);
    txt+=`${i.name}${tag}\n  ${i.qty} × ${(+i.price).toFixed(2)} = ${gross.toFixed(2)} ${currency}\n`;
    if(+i.discAmt>0) txt+=`  خصم الصنف: -${(+i.discAmt).toFixed(2)} ${currency} → ${(+i.total).toFixed(2)} ${currency}\n`;
  });
  txt+=`${line}\n`;
  txt+=`المجموع: ${sale.subtotal.toFixed(2)} ${currency}\n`;
  if(+sale.itemsDiscount>0) txt+=`خصم الأصناف: -${(+sale.itemsDiscount).toFixed(2)} ${currency}\n`;
  if(+sale.invDiscount>0)   txt+=`خصم الفاتورة: -${(+sale.invDiscount).toFixed(2)} ${currency}\n`;
  if(sale.discount>0 && !(+sale.itemsDiscount>0||+sale.invDiscount>0))
    txt+=`الخصم: -${sale.discount.toFixed(2)} ${currency}\n`;
  if(sale.vat>0) txt+=`الضريبة: ${sale.vat.toFixed(2)} ${currency}\n`;
  txt+=`الإجمالي: ${sale.total.toFixed(2)} ${currency}\n`;
  if(sale.payMethod==='cash'){
    txt+=`المدفوع: ${sale.received.toFixed(2)} ${currency}\n`;
    txt+=`الباقي: ${sale.change.toFixed(2)} ${currency}\n`;
  }
  // بيع آجل: نوضّح المسدَّد والمتبقي ديناً على العميل
  if(+sale.balance>0){
    txt+=`المدفوع الآن: ${(+sale.amountPaid||0).toFixed(2)} ${currency}\n`;
    txt+=`المتبقي (دين): ${(+sale.balance).toFixed(2)} ${currency}\n`;
  }
  txt+=`${line}\n${center('شكراً لتسوقكم معنا!')}`;
  document.getElementById('receipt-content').textContent=txt;
  window._lastSale=sale;
  openModal('modal-receipt');
}

function printReceipt(){
  const content=document.getElementById('receipt-content')?.textContent||'';
  const w=window.open('','_blank','width=400,height=600');
  w.document.write(`<html><head><title>فاتورة</title><style>body{font-family:monospace;font-size:13px;white-space:pre;direction:rtl;padding:20px;}</style></head><body>${content}</body></html>`);
  w.document.close(); w.print();
}

// ============================================================
// WHATSAPP — إرسال الفاتورة كنص مباشرةً على واتساب العميل
// ============================================================

// مفتاح الدولة الافتراضي (مصر) — يمكن تغييره من إعدادات النظام لاحقاً
function waCountryCode(){
  return String(S.settings?.general?.waCountry||'20').replace(/\D/g,'')||'20';
}

// تحويل أي صيغة رقم محلية إلى الصيغة الدولية التي يقبلها واتساب
// 01012345678 → 201012345678 | +20 101 234 5678 → 201012345678 | 00201... → 201...
function normalizeWaPhone(raw){
  let d=String(raw||'').replace(/[^\d]/g,'');
  if(!d) return '';
  const cc=waCountryCode();
  if(d.startsWith('00')) d=d.slice(2);
  // الرقم دولي بالفعل
  if(d.startsWith(cc)&&d.length>=cc.length+9) return d;
  if(d.startsWith('0')) d=d.replace(/^0+/,'');
  return cc+d;
}

// نص الفاتورة بصيغة واتساب (يدعم *عريض*)
function buildWhatsAppText(sale){
  const g=S.settings?.general||{};
  const currency=g.currency||'EGP';
  const m=n=>Number(n||0).toFixed(2);
  const L=[];
  L.push(`*${g.name||g.sysName||'الشمس'}*${sale.branchName?` — ${sale.branchName}`:''}`);
  L.push('━━━━━━━━━━━━━━━');
  L.push(`*فاتورة رقم:* ${sale.invNumber||'—'}`);
  L.push(`*التاريخ:* ${new Date(sale.createdAt||Date.now()).toLocaleString('ar-EG')}`);
  if(sale.customer&&sale.customer!=='عميل نقدي') L.push(`*العميل:* ${sale.customer}`);
  if(sale.cashierName) L.push(`*الكاشير:* ${sale.cashierName}`);
  L.push('━━━━━━━━━━━━━━━');
  (sale.items||[]).forEach((it,i)=>{
    const gross=+it.gross||(+it.price||0)*(+it.qty||0);
    L.push(`${i+1}. ${it.name||''}`);
    let ln=`   ${it.qty} × ${m(it.price)} = ${m(gross)} ${currency}`;
    if(+it.discAmt>0) ln+=`\n   خصم: -${m(it.discAmt)} ← *${m(it.total)} ${currency}*`;
    L.push(ln);
  });
  L.push('━━━━━━━━━━━━━━━');
  L.push(`المجموع: ${m(sale.subtotal)} ${currency}`);
  if(+sale.itemsDiscount>0) L.push(`خصم الأصناف: -${m(sale.itemsDiscount)} ${currency}`);
  if(+sale.invDiscount>0)   L.push(`خصم الفاتورة: -${m(sale.invDiscount)} ${currency}`);
  if(+sale.discount>0&&!(+sale.itemsDiscount>0||+sale.invDiscount>0))
    L.push(`الخصم: -${m(sale.discount)} ${currency}`);
  if(+sale.vat>0||+sale.tax>0) L.push(`الضريبة: ${m(sale.vat||sale.tax)} ${currency}`);
  L.push(`*الإجمالي: ${m(sale.total)} ${currency}*`);
  if(+sale.balance>0){
    L.push(`المدفوع: ${m(sale.amountPaid)} ${currency}`);
    L.push(`*المتبقي (دين): ${m(sale.balance)} ${currency}*`);
  }
  L.push('━━━━━━━━━━━━━━━');
  if(g.phone) L.push(`📞 ${g.phone}`);
  L.push('شكراً لتسوقكم معنا 🌟');
  return L.join('\n');
}

// يفتح محادثة واتساب العميل ومعها نص الفاتورة جاهزاً للإرسال
function openWhatsAppWith(phone, text){
  const p=normalizeWaPhone(phone);
  if(!p){ toast('رقم واتساب غير صالح','error'); return false; }
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`,'_blank');
  return true;
}

// الزر الرئيسي: يستخدم رقم العميل المحفوظ، وإلا يطلب الرقم
function sendSaleWhatsApp(saleArg){
  const sale=saleArg||window._lastSale;
  if(!sale){ toast('لا توجد فاتورة','error'); return; }
  const cust=sale.customerId?(S.customers||{})[sale.customerId]:null;
  const phone=cust?.phone||cust?.mobile||'';
  if(phone&&normalizeWaPhone(phone)){
    if(openWhatsAppWith(phone,buildWhatsAppText(sale)))
      toast('تم فتح واتساب — اضغط إرسال داخل المحادثة','success');
    return;
  }
  // لا يوجد رقم محفوظ → نطلبه من الكاشير
  window._waPendingSale=sale;
  const hint=document.getElementById('wa-phone-hint');
  if(hint) hint.textContent = cust
    ? `العميل "${cust.name||sale.customer}" ليس له رقم محفوظ — أدخل رقم واتساب لإرسال الفاتورة عليه.`
    : 'فاتورة بدون عميل مسجّل — أدخل رقم واتساب لإرسال الفاتورة عليه.';
  const saveWrap=document.getElementById('wa-save-phone');
  if(saveWrap){
    saveWrap.checked=!!cust;
    saveWrap.closest('label').style.display=cust?'flex':'none';
  }
  const inp=document.getElementById('wa-phone-input');
  if(inp) inp.value='';
  previewWaPhone();
  openModal('modal-wa-phone');
  setTimeout(()=>inp?.focus(),120);
}

function previewWaPhone(){
  const raw=document.getElementById('wa-phone-input')?.value||'';
  const p=normalizeWaPhone(raw);
  const el=document.getElementById('wa-phone-preview');
  if(el) el.innerHTML = p
    ? `سيُرسل إلى: <strong style="color:#25D366;">+${p}</strong>`
    : 'سيُرسل إلى: —';
}

async function confirmWaPhone(){
  const sale=window._waPendingSale;
  if(!sale){ closeModal('modal-wa-phone'); return; }
  const raw=document.getElementById('wa-phone-input')?.value||'';
  const p=normalizeWaPhone(raw);
  if(!p||p.length<10){ toast('أدخل رقم واتساب صحيح','error'); return; }

  // حفظ الرقم في ملف العميل لو مطلوب
  const custId=sale.customerId;
  if(document.getElementById('wa-save-phone')?.checked && custId && (S.customers||{})[custId]){
    try{
      await dbUpdate('customers/'+custId,{phone:raw.trim(),updatedAt:new Date().toISOString()});
      toast('تم حفظ الرقم في ملف العميل ✅','info');
    }catch(e){ console.warn('save wa phone',e); }
  }
  closeModal('modal-wa-phone');
  if(openWhatsAppWith(p,buildWhatsAppText(sale)))
    toast('تم فتح واتساب — اضغط إرسال داخل المحادثة','success');
  window._waPendingSale=null;
}

// ============================================================
// بحث ذكي عن العميل داخل الكاشير — قائمة حيّة أثناء الكتابة
// ============================================================
let csCustMatches = [];   // النتائج المعروضة حالياً
let csCustFocus   = -1;   // العنصر المحدَّد بالكيبورد

// ترتيب النتائج: مطابقة بداية الاسم أولاً، ثم الأحدث زيارةً
function findCustomerMatches(q){
  const qq = (q||'').trim().toLowerCase();
  const digits = qq.replace(/\D/g,'');
  let list = Object.entries(S.customers||{});   // كل العملاء من كل الفروع
  if(qq){
    list = list.filter(([,c])=>{
      const name=(c.name||'').toLowerCase();
      const phone=String(c.phone||'').replace(/\D/g,'');
      return name.includes(qq) || (digits && phone.includes(digits));
    });
    list.sort(([,a],[,b])=>{
      const an=(a.name||'').toLowerCase().startsWith(qq)?0:1;
      const bn=(b.name||'').toLowerCase().startsWith(qq)?0:1;
      if(an!==bn) return an-bn;
      return new Date(b.lastVisit||0)-new Date(a.lastVisit||0);
    });
  } else {
    list.sort(([,a],[,b])=>new Date(b.lastVisit||0)-new Date(a.lastVisit||0));
  }
  return list.slice(0,8);
}

function hlMatch(text,q){
  const t=String(text||''); const qq=(q||'').trim();
  if(!qq) return t;
  const i=t.toLowerCase().indexOf(qq.toLowerCase());
  if(i<0) return t;
  return t.slice(0,i)+`<mark style="background:var(--accent-bg);color:var(--accent);padding:0 1px;border-radius:3px;">${t.slice(i,i+qq.length)}</mark>`+t.slice(i+qq.length);
}

function closeCustDrop(){
  document.getElementById('cust-picker-drop')?.remove();
  csCustFocus=-1;
}

function renderCustDrop(q){
  const input = document.getElementById('cs-customer'); if(!input) return;
  // الحقل انتقل من الشريط السفلي إلى أعلى السلة، فنتعلّق بالحاوية الجديدة
  const wrap  = input.closest('.cart-customer') || input.parentElement; if(!wrap) return;
  wrap.style.position = 'relative';
  closeCustDrop();
  csCustMatches = findCustomerMatches(q);

  const drop = document.createElement('div');
  drop.id = 'cust-picker-drop';
  // تأخذ عرض الحاوية كاملاً بدل عرض ثابت، فلا تخرج عن السلة على الشاشات الصغيرة
  drop.style.cssText = 'position:absolute;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-height:230px;overflow-y:auto;left:16px;right:16px;margin-top:2px;';

  if(!csCustMatches.length){
    drop.innerHTML = `
      <div style="padding:11px 12px;font-size:12px;color:var(--text2);text-align:center;">
        لا يوجد عميل مطابق
      </div>
      <div onmousedown="event.preventDefault();closeCustDrop();togglePosAddCust();"
           style="padding:10px 12px;cursor:pointer;border-top:1px solid var(--border2);font-size:12px;color:var(--green);font-weight:700;text-align:center;">
        <i class="fas fa-user-plus"></i> إضافة "${(q||'').trim()||'عميل جديد'}" كعميل جديد
      </div>`;
  } else {
    drop.innerHTML = csCustMatches.map(([id,c],i)=>`
      <div class="cust-drop-item" data-i="${i}"
           onmousedown="event.preventDefault();selectCustomerFromPicker('${id}')"
           onmouseover="csCustFocus=${i};updateCustDropFocus()"
           style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border2);font-size:12px;">
        <strong>${hlMatch(c.name||'—',q)}</strong>
        <span style="color:var(--text2);margin-right:6px;">${hlMatch(c.phone||'',q)}</span>
        ${(+c.balance||0)>0?`<span style="color:var(--red);font-size:10px;"> — دين: ${(+c.balance).toFixed(0)}</span>`:''}
        ${(+c.balance||0)<0?`<span style="color:var(--purple);font-size:10px;"> — رصيد له: ${Math.abs(+c.balance).toFixed(0)}</span>`:''}
      </div>`).join('');
  }

  wrap.style.position='relative';
  wrap.appendChild(drop);
  csCustFocus = csCustMatches.length ? 0 : -1;
  updateCustDropFocus();
}

function updateCustDropFocus(){
  document.querySelectorAll('#cust-picker-drop .cust-drop-item').forEach((el,i)=>{
    const on = i===csCustFocus;
    el.style.background = on ? 'var(--accent-bg)' : '';
    if(on) el.scrollIntoView({block:'nearest'});
  });
}

// يُستدعى مع كل حرف: يلغي الاختيار السابق ويحدّث القائمة فوراً
function onCsCustomerInput(val){
  clearSelectedCustomer();
  renderCustDrop(val);
}

function onCsCustomerFocus(){
  const input=document.getElementById('cs-customer');
  input?.focus();
  renderCustDrop(input?.value||'');
}

function onCsCustomerKeydown(e){
  const open = !!document.getElementById('cust-picker-drop');
  if(e.key==='ArrowDown'){
    e.preventDefault();
    if(!open){ onCsCustomerFocus(); return; }
    csCustFocus=Math.min(csCustMatches.length-1,csCustFocus+1); updateCustDropFocus();
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    csCustFocus=Math.max(0,csCustFocus-1); updateCustDropFocus();
  } else if(e.key==='Enter'){
    if(open && csCustFocus>=0 && csCustMatches[csCustFocus]){
      e.preventDefault();
      selectCustomerFromPicker(csCustMatches[csCustFocus][0]);
    }
  } else if(e.key==='Escape'){
    closeCustDrop();
  }
}

// زر البحث: يعرض كل العملاء (أو نتائج ما هو مكتوب)
function pickCustomerForSale(){
  onCsCustomerFocus();
}

function selectCustomerFromPicker(id,name){
  const c=(S.customers||{})[id];
  const nm=name||c?.name||'';
  document.getElementById('cs-customer').value    = nm;
  document.getElementById('cs-customer-id').value = id;
  closeCustDrop();
  applyCustomerPriceMode(id);
  toast('تم اختيار العميل: '+nm,'success');
}

function clearSelectedCustomer(){
  document.getElementById('cs-customer-id').value = '';
}

// إغلاق القائمة عند الضغط خارجها
document.addEventListener('click',e=>{
  const drop=document.getElementById('cust-picker-drop');
  if(!drop) return;
  if(e.target.closest('#cust-picker-drop')||e.target.closest('#cs-customer')||e.target.closest('#cs-cust-search-btn')) return;
  closeCustDrop();
});

// ── إضافة عميل سريعة من داخل الكاشير ──
function togglePosAddCust(){
  let pop=document.getElementById('pos-add-cust-pop');
  if(pop){ pop.remove(); return; }
  // الحاوية صارت أعلى السلة، والنافذة تنسدل لأسفل الحقل بدل أن تطلع فوقه
  const wrap=document.getElementById('cs-customer')?.closest('.cart-customer')||document.body;
  wrap.style.position='relative';
  pop=document.createElement('div');
  pop.id='pos-add-cust-pop';
  pop.style.cssText='position:absolute;top:calc(100% - 6px);left:16px;right:16px;background:var(--card);border:1px solid var(--accent);border-radius:12px;padding:12px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:7px;';
  pop.innerHTML=`
    <div style="font-size:12px;font-weight:700;color:var(--accent);"><i class="fas fa-user-plus"></i> إضافة عميل جديد</div>
    <input class="fc" id="pos-new-cust-name" placeholder="اسم العميل *" style="font-size:12px;">
    <input class="fc" id="pos-new-cust-phone" placeholder="رقم الهاتف" style="font-size:12px;">
    <select class="fc" id="pos-new-cust-type" style="font-size:12px;">
      <option value="retail">عميل قطاعي</option>
      <option value="wholesale">عميل جملة</option>
    </select>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-success btn-xs" style="flex:1;justify-content:center;" onclick="savePosNewCust()"><i class="fas fa-save"></i> حفظ واختيار</button>
      <button class="btn btn-ghost btn-xs" style="flex:1;justify-content:center;" onclick="togglePosAddCust()">إلغاء</button>
    </div>`;
  wrap.appendChild(pop);
  setTimeout(()=>document.getElementById('pos-new-cust-name')?.focus(),50);
}

async function savePosNewCust(){
  const name=(document.getElementById('pos-new-cust-name')?.value||'').trim();
  if(!name){ toast('يرجى إدخال اسم العميل','error'); return; }
  const phone=(document.getElementById('pos-new-cust-phone')?.value||'').trim();
  if(phone){
    const dup=Object.values(S.customers||{}).find(c=>c.phone===phone);
    if(dup){ toast('رقم الهاتف مستخدم بالفعل للعميل: '+dup.name,'error'); return; }
  }
  const branchId=CURRENT_USER?.branch||'';
  const custType=document.getElementById('pos-new-cust-type')?.value==='wholesale'?'wholesale':'retail';
  const data={name,phone,email:'',addr:'',notes:'',custType,branchId,branchName:getBranchName(branchId)||'',totalBuy:0,balance:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  try{
    const key=uid();
    await dbSet('customers/'+key,data);
    document.getElementById('cs-customer').value=name;
    document.getElementById('cs-customer-id').value=key;
    S.customers=S.customers||{}; S.customers[key]=data;
    applyCustomerPriceMode(key);
    togglePosAddCust();
    toast('تم إضافة العميل واختياره ✅');
  }catch(e){ toast('خطأ: '+e.message,'error'); }
}

function newSale(){
  clearCart();
  document.getElementById('cs-customer').value    = '';
  document.getElementById('cs-customer-id').value = '';
  document.getElementById('ct-discount').value    = '0';
  document.getElementById('ct-received').value    = '0';
  const cpEl=document.getElementById('ct-credit-paid'); if(cpEl) cpEl.value='0';
  calcCreditRemain();
  const nEl=document.getElementById('cs-notes'); if(nEl) nEl.value='';
  populateCsCashbox(payMethod||'cash');
  closeModal('modal-receipt');
  toast('جاهز لبيع جديد ✅');
}

// إنشاء مرتجع مباشرةً من فاتورة محددة — يملأ البيانات تلقائياً
function openReturnFromInvoice(saleId){
  nav('returns');
  setTimeout(()=>{
    openAddReturn();
    setTimeout(()=>{
      const sel=document.getElementById('retf-invoice-id');
      if(sel){ sel.value=saleId; onReturnInvoiceSelect(); }
      toast('تم تحميل بيانات الفاتورة — راجع الأصناف والكميات ثم احفظ','info');
    },250);
  },150);
}

