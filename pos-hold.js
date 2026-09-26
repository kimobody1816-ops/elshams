// ============================================================
// POS HOLD QUEUE — قائمة انتظار الكاشير
// ============================================================
let heldCarts = JSON.parse(localStorage.getItem('shams_held_carts')||'[]');

function saveHeldCarts() {
  localStorage.setItem('shams_held_carts', JSON.stringify(heldCarts));
  updateHeldBadge();
}

function updateHeldBadge() {
  const badge = document.getElementById('held-carts-count');
  if(!badge) return;
  if(heldCarts.length>0){
    badge.textContent = heldCarts.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function holdCart() {
  if(!cart.length){ toast('السلة فارغة لا يوجد ما يُعلَّق','warning'); return; }
  const custName = document.getElementById('cs-customer')?.value?.trim()||'';
  const custId   = document.getElementById('cs-customer-id')?.value||'';
  const label    = custName || `سلة #${heldCarts.length+1}`;
  heldCarts.push({
    id: uid(),
    label,
    custName, custId,
    items: cart.map(i=>({...i})),
    saleMode,
    discount: document.getElementById('ct-discount')?.value||'0',
    discountType: document.getElementById('ct-discount-type')?.value||'fixed',
    heldAt: new Date().toISOString(),
  });
  saveHeldCarts();
  clearCart();
  document.getElementById('cs-customer').value    = '';
  document.getElementById('cs-customer-id').value = '';
  document.getElementById('ct-discount').value    = '0';
  toast(`✅ تم تعليق السلة: "${label}"`);
}

function openHeldCarts() {
  const list = document.getElementById('held-carts-list'); if(!list) return;
  if(!heldCarts.length){
    list.innerHTML=`<div style="text-align:center;padding:30px;color:var(--text2);">
      <i class="fas fa-layer-group" style="font-size:30px;opacity:.3;display:block;margin-bottom:10px;"></i>
      لا توجد سلال معلقة</div>`;
  } else {
    const currency = S.settings?.general?.currency||'EGP';
    list.innerHTML = heldCarts.map((h,i)=>{
      // إجمالي بعد خصومات الأصناف، ثم خصم الفاتورة المعلَّق
      const total = h.items.reduce((s,it)=>s+lineNet(it),0);
      const disc  = parseFloat(h.discount)||0;
      const net   = Math.max(0, total - (h.discountType==='pct' ? total*Math.min(100,disc)/100 : Math.min(total,disc)));
      const timeAgo = h.heldAt ? fDateShort(h.heldAt) : '—';
      return `<div style="border:1px solid var(--border);border-radius:10px;padding:13px;margin-bottom:9px;background:var(--card2);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-size:13px;font-weight:800;">${h.label}</div>
            <div style="font-size:10px;color:var(--text3);">${timeAgo} | ${h.items.length} صنف</div>
          </div>
          <div style="font-size:16px;font-weight:900;color:var(--accent);">${net.toFixed(2)} ${currency}</div>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:10px;max-height:40px;overflow:hidden;">
          ${h.items.slice(0,3).map(it=>`${it.name} (${it.qty})`).join(' ، ')}${h.items.length>3?` وَ${h.items.length-3} أخرى`:''}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" onclick="resumeCart(${i})">
            <i class="fas fa-play-circle"></i> استئناف
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteHeld(${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }
  openModal('modal-held-carts');
}

function resumeCart(i) {
  const held = heldCarts[i]; if(!held) return;
  if(cart.length){
    // إذا السلة الحالية ليست فارغة، نعلّقها أولاً
    holdCart();
    i = heldCarts.findIndex(h=>h.id===held.id);
    if(i<0){ toast('خطأ في الاسترجاع','error'); return; }
  }
  cart = held.items.map(it=>({...it}));
  document.getElementById('cs-customer').value    = held.custName||'';
  document.getElementById('cs-customer-id').value = held.custId||'';
  document.getElementById('ct-discount').value    = held.discount||'0';
  const dtEl=document.getElementById('ct-discount-type'); if(dtEl) dtEl.value = held.discountType||'fixed';
  // نستعيد وضع البيع كما كان وقت التعليق بدون إعادة تسعير الأصناف المحفوظة
  saleMode = held.saleMode==='wholesale' ? 'wholesale' : 'retail';
  document.querySelectorAll('.sale-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===saleMode));
  searchCashierProducts(document.getElementById('cs-search')?.value||'');
  heldCarts.splice(i,1);
  saveHeldCarts();
  renderCart();
  closeModal('modal-held-carts');
  toast(`✅ تم استئناف السلة: "${held.label}"`);
}

function deleteHeld(i) {
  heldCarts.splice(i,1);
  saveHeldCarts();
  openHeldCarts();
  toast('تم حذف السلة المعلقة');
}

function clearAllHeld() {
  heldCarts = [];
  saveHeldCarts();
  closeModal('modal-held-carts');
  toast('تم مسح كل السلال المعلقة');
}

