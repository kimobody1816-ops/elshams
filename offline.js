// ============================================================
// OFFLINE MODE — نسخة محلية (IndexedDB) + طابور العمليات المعلقة
// ============================================================

const IDB = {
  // v2: مخزن shifts — v3: مخزن payments.
  // رفع الرقم ضروري ليعمل onupgradeneeded على الأجهزة التي فتحت البرنامج سابقاً
  db:null, DB_NAME:'shams_offline', DB_VERSION:3,
  STORES:['users','branches','settings','returns','customers','cashboxes','cashboxLog',
          'stockTransfers','lossRecords','warehouses','products','categories','suppliers',
          'purchaseOrders','sales','expenses','movements','shifts','payments','pending_queue'],
  open(){
    return new Promise((resolve,reject)=>{
      if(this.db){ resolve(this.db); return; }
      const req=indexedDB.open(this.DB_NAME,this.DB_VERSION);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        this.STORES.forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'_key'}); });
      };
      req.onsuccess=e=>{ this.db=e.target.result; resolve(this.db); };
      req.onerror =e=>reject(e.target.error);
    });
  },
  async saveStore(name,data){
    try{
      const db=await this.open();
      const tx=db.transaction(name,'readwrite');
      const st=tx.objectStore(name);
      st.clear();
      if(name==='settings'){
        st.put({_key:'__cfg__', _json:JSON.stringify(data||{})});
      }else{
        Object.entries(data||{}).forEach(([k,v])=>{
          st.put({_key:k, _json:JSON.stringify(v)});
        });
      }
      return new Promise((res,rej)=>{ tx.oncomplete=()=>res(true); tx.onerror=e=>rej(e); });
    }catch(e){ console.warn('IDB.saveStore',name,e); }
  },
  async getStore(name){
    try{
      const db=await this.open();
      const tx=db.transaction(name,'readonly');
      const req=tx.objectStore(name).getAll();
      return new Promise((res)=>{
        req.onsuccess=()=>{
          const rows=req.result||[];
          if(name==='settings'){
            try{ res(JSON.parse(rows[0]?._json||'{}')); }catch(e){ res({}); }
          }else{
            const o={};
            rows.forEach(r=>{ try{ o[r._key]=JSON.parse(r._json); }catch(e){} });
            res(o);
          }
        };
        req.onerror=()=>res({});
      });
    }catch(e){ return {}; }
  },
  async enqueue(op){
    try{
      const db=await this.open();
      const tx=db.transaction('pending_queue','readwrite');
      const k='q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      tx.objectStore('pending_queue').put({_key:k, _json:JSON.stringify({...op, ts:Date.now()})});
      return new Promise((res,rej)=>{ tx.oncomplete=()=>res(k); tx.onerror=e=>rej(e); });
    }catch(e){ console.warn('IDB.enqueue',e); }
  },
  async getQueue(){
    const data=await this.getStore('pending_queue');
    // نُرفق مفتاح كل عملية حتى نستطيع حذفها منفردة بعد رفعها بنجاح
    return Object.entries(data).map(([k,v])=>({...v,_key:k})).sort((a,b)=>(a.ts||0)-(b.ts||0));
  },
  async delQueueItem(key){
    try{
      const db=await this.open();
      const tx=db.transaction('pending_queue','readwrite');
      tx.objectStore('pending_queue').delete(key);
      return new Promise((res)=>{ tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); });
    }catch(e){}
  },
  async clearQueue(){
    try{
      const db=await this.open();
      const tx=db.transaction('pending_queue','readwrite');
      tx.objectStore('pending_queue').clear();
      return new Promise((res)=>{ tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); });
    }catch(e){}
  },
};

const OP_LABELS={
  customers:'عميل', products:'منتج', sales:'فاتورة', purchaseOrders:'أمر شراء',
  expenses:'مصروف', suppliers:'مورد', warehouses:'مخزن', cashboxes:'خزينة',
  cashboxLog:'حركة خزينة', movements:'حركة مخزن', categories:'فئة', users:'مستخدم',
  settings:'إعدادات', returns:'مرتجع', branches:'فرع', stockTransfers:'تحويل مخزون',
};
const TYPE_LABELS={set:'حفظ',push:'إضافة',update:'تعديل',remove:'حذف'};
const TYPE_ICONS ={set:'fa-save',push:'fa-plus',update:'fa-edit',remove:'fa-trash'};
const TYPE_COLORS={set:'var(--accent)',push:'var(--green)',update:'var(--yellow)',remove:'var(--red)'};

async function openQueuePanel(){
  const queue=await IDB.getQueue();
  const list=document.getElementById('queue-list');
  const syncBtn=document.getElementById('sync-now-btn');
  const clrBtn =document.getElementById('queue-clear-btn');
  if(syncBtn) syncBtn.style.display = (OM.isOnline && queue.length) ? '' : 'none';
  if(clrBtn)  clrBtn.style.display  = queue.length ? '' : 'none';

  if(!queue.length){
    list.innerHTML=`<div style="text-align:center;padding:32px;color:var(--text2);">
      <i class="fas fa-check-circle" style="font-size:32px;color:var(--green);margin-bottom:10px;display:block;"></i>
      لا توجد عمليات معلقة</div>`;
  }else{
    list.innerHTML=queue.map((op,i)=>{
      const store=(op.path||'').split('/')[0];
      const color=TYPE_COLORS[op.type]||'var(--text2)';
      const name =op.data?.name||op.data?.customer||op.data?.invNumber||'';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;background:var(--card2);margin-bottom:8px;">
        <div style="width:34px;height:34px;border-radius:8px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas ${TYPE_ICONS[op.type]||'fa-circle'}" style="color:${color};font-size:13px;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;">${TYPE_LABELS[op.type]||op.type} ${OP_LABELS[store]||store} ${name?'— '+name:''}</div>
          <div style="font-size:11px;color:var(--text2);">${op.ts?new Date(op.ts).toLocaleString('ar-EG'):''}</div>
        </div>
        <div style="font-size:10px;color:var(--text3);background:var(--card);padding:2px 8px;border-radius:12px;">#${i+1}</div>
      </div>`;
    }).join('');
  }
  openModal('modal-queue');
}

async function clearPendingQueue(){
  if(!confirm('سيتم حذف كل العمليات المعلقة نهائياً ولن تُرفع للسحابة. متأكد؟')) return;
  await IDB.clearQueue();
  updateQueueBadge(0);
  openQueuePanel();
  toast('تم حذف الطابور','warning');
}

function updateQueueBadge(count){
  const btn=document.getElementById('queue-btn');
  const cnt=document.getElementById('queue-count');
  if(btn&&cnt){
    btn.style.display = count>0 ? '' : 'none';
    cnt.textContent   = count;
  }
  const badge=document.getElementById('offline-badge');
  const ops  =document.getElementById('badge-ops');
  if(ops){
    ops.style.display = count>0 ? 'inline-block' : 'none';
    ops.textContent   = count+' عملية معلقة';
  }
  if(badge) badge.classList.toggle('show', !OM.isOnline);
}

// ── مدير الأوفلاين ──
const OM = {
  isOnline: navigator.onLine,
  syncing : false,
  pending : 0,

  init(){
    window.addEventListener('online', ()=>this.goOnline());
    window.addEventListener('offline',()=>this.goOffline());
    IDB.open().then(async()=>{
      const q=await IDB.getQueue();
      this.pending=q.length;
      updateQueueBadge(q.length);
    }).catch(e=>console.warn('IndexedDB unavailable',e));
    this.updateUI();
  },

  goOnline(){
    this.isOnline=true;
    this.updateUI();
    document.getElementById('offline-badge')?.classList.remove('show');
    if(this.pending>0){
      toast('عاد الإنترنت — جاري رفع العمليات المعلقة...','info');
      setTimeout(()=>this.flushQueue(),1500);
    }
  },

  goOffline(){
    this.isOnline=false;
    this.updateUI();
    document.getElementById('offline-badge')?.classList.add('show');
    toast('انقطع الإنترنت — النظام يعمل أوف لاين والعمليات تُحفظ محلياً','warning');
  },

  updateUI(){
    setConnState(this.isOnline);
    const ind=document.getElementById('conn-indicator');
    if(ind){
      if(this.isOnline){
        ind.title='متصل بالإنترنت'; ind.style.cursor='default'; ind.onclick=null;
        const d=document.getElementById('conn-dot'); if(d) d.style.animation='none';
        const t=document.getElementById('conn-text'); if(t) t.textContent='متصل';
      }else{
        ind.style.background='var(--yellow-bg)';
        ind.style.borderColor='var(--yellow)';
        ind.style.color='var(--yellow)';
        const d=document.getElementById('conn-dot'); if(d){ d.style.background='var(--yellow)'; d.style.animation='_pulse 1s infinite'; }
        const t=document.getElementById('conn-text'); if(t) t.textContent='أوف لاين';
        ind.title='لا يوجد اتصال — البيانات تُحفظ محلياً';
        ind.style.cursor='pointer';
        ind.onclick=()=>openQueuePanel();
      }
    }
    const sb=document.getElementById('conn-status');
    if(sb){ sb.textContent=this.isOnline?'متصل':'أوف لاين'; sb.classList.toggle('offline',!this.isOnline); }
    document.getElementById('offline-badge')?.classList.toggle('show', !this.isOnline);
  },

  // حفظ نسخة من كل البيانات في IndexedDB
  async syncToIDB(){
    const stores=['users','branches','returns','customers','cashboxes','cashboxLog',
                  'stockTransfers','lossRecords','warehouses','products','categories',
                  'suppliers','purchaseOrders','sales','expenses','movements','shifts','payments'];
    // كل مستمع بيحط كائن جديد في S[st] مع أي تغيير، فلو المرجع هو هو يبقى
    // مفيش جديد من آخر حفظ — منعيدش كتابة آلاف الفواتير كل دقيقتين على الفاضي
    const saved=this._savedRefs||(this._savedRefs={});
    for(const st of stores){
      if(S[st]&&Object.keys(S[st]).length&&saved[st]!==S[st]){
        const ref=S[st];
        if(await IDB.saveStore(st,ref).catch(()=>{})) saved[st]=ref;
      }
    }
    if(S.settings&&Object.keys(S.settings).length&&saved.settings!==S.settings){
      const ref=S.settings;
      if(await IDB.saveStore('settings',ref).catch(()=>{})) saved.settings=ref;
    }
    try{ localStorage.setItem('shams-idb-last', new Date().toISOString()); }catch(e){}
  },

  // تحميل آخر نسخة محلية عند تعذّر الاتصال بالسحابة
  async loadFromIDB(){
    const stores=['users','branches','returns','customers','cashboxes','cashboxLog',
                  'stockTransfers','lossRecords','warehouses','products','categories',
                  'suppliers','purchaseOrders','sales','expenses','movements','shifts','payments'];
    let found=false;
    for(const st of stores){
      const d=await IDB.getStore(st);
      if(Object.keys(d).length){ S[st]=d; found=true; }
    }
    const cfg=await IDB.getStore('settings');
    if(cfg&&Object.keys(cfg).length){ S.settings=cfg; }
    return found;
  },

  // تسجيل عملية في الطابور (لما نكون أوف لاين)
  async enqueue(type,path,data){
    await IDB.enqueue({type,path,data});
    const q=await IDB.getQueue();
    this.pending=q.length;
    updateQueueBadge(q.length);
  },

  // تسجيل تغيير مخزون كـ "دلتا" (± كمية) بدل قيمة نهائية.
  // عند المزامنة يُطبَّق بـ transaction فتتراكم خصومات كل الأجهزة بدل أن يمحو بعضها بعضاً.
  async enqueueStockDelta(productId, delta){
    // نطبّقه على النسخة المحلية فوراً حتى تعكس الواجهة الكمية الصحيحة
    S.products = S.products||{};
    if(S.products[productId]){
      S.products[productId] = {...S.products[productId], qty:(+S.products[productId].qty||0)+delta};
      IDB.saveStore('products',S.products).catch(()=>{});
      _rerenderStore('products');
    }
    await this.enqueue('stockDelta','products/'+productId+'/qty',{delta, at:new Date().toISOString(), by:CURRENT_USER?.id||''});
  },

  // رفع الطابور للسحابة — الأحدث يفوز عند التعارض
  async flushQueue(){
    if(this.syncing||!this.isOnline||!window._fbAvailable) return;
    this.syncing=true;
    const skipped=[];
    const touchedProducts=new Set(); // منتجات تغيّر مخزونها أثناء الأوفلاين — تُفحص بعد الرفع
    let uploaded=0, failed=0;
    try{
      const queue=await IDB.getQueue();
      if(!queue.length){ this.syncing=false; return; }
      toast(`جاري مراجعة ${queue.length} عملية معلقة...`,'info');

      for(const op of queue){
        try{
          if(op.type==='push')  { await _fbPush(op.path,op.data);  uploaded++; await IDB.delQueueItem(op._key); continue; }
          if(op.type==='remove'){ await _fbRemove(op.path);        uploaded++; await IDB.delQueueItem(op._key); continue; }

          // تغيير مخزون: يُطبَّق كـ transaction على القيمة الحالية في السحابة
          // فتتراكم خصومات كل الأجهزة، ولو زادت عن المتاح تظهر الكمية بالسالب — وهذا ما نرصده بعد المزامنة.
          if(op.type==='stockDelta'){
            const pid=op.path.split('/')[1];
            await window.$runTransaction(dbRef(op.path), cur=>(cur||0)+(+op.data?.delta||0));
            touchedProducts.add(pid);
            uploaded++; await IDB.delQueueItem(op._key); continue;
          }

          const localTs   = new Date(op.data?.updatedAt||op.data?.createdAt||op.data?.date||0).getTime();
          const localUser = op.data?.updatedBy||op.data?.createdBy||'';
          const key       = op.path.split('/')[1];

          if(key && localTs>0){
            const cloudVal = await new Promise(res=>{
              try{
                window.$onValue(dbRef(op.path), s=>res(s.val()), {onlyOnce:true});
                setTimeout(()=>res(null),4000);
              }catch(e){ res(null); }
            });
            if(cloudVal){
              const cloudTs   = new Date(cloudVal.updatedAt||cloudVal.createdAt||cloudVal.date||0).getTime();
              const cloudUser = cloudVal.updatedBy||cloudVal.createdBy||'';
              const cloudNewer = cloudTs>localTs ||
                                 (cloudTs===localTs && cloudUser && localUser && cloudUser!==localUser);
              if(cloudNewer){
                // السحابة أحدث — نتجاهل العملية ونحذفها من الطابور
                skipped.push({path:op.path,localUser,cloudUser});
                await IDB.delQueueItem(op._key);
                continue;
              }
            }
          }
          if(op.type==='set') await _fbSet(op.path,op.data);
          else                await _fbUpdate(op.path,op.data);
          uploaded++;
          await IDB.delQueueItem(op._key);
        }catch(e){
          // العملية فشلت — تبقى في الطابور لمحاولة لاحقة
          failed++;
          console.warn('flush op failed:',op.type,op.path,e);
        }
      }

      const left=await IDB.getQueue();
      this.pending=left.length;
      updateQueueBadge(left.length);
      if(failed){
        toast(`رُفعت ${uploaded} عملية — ${failed} فشلت وستبقى في الطابور للمحاولة لاحقاً`,'warning');
      }else if(skipped.length){
        console.table(skipped);
        toast(`المزامنة اكتملت — ${uploaded} عملية رُفعت، ${skipped.length} تُجوهلت (السحابة أحدث)`,'info');
      }else{
        toast(`تمت المزامنة — ${uploaded} عملية رُفعت بنجاح`,'success');
      }

      // بعد رفع مبيعات الأوفلاين: نفحص هل تجاوز البيع المخزون المتاح فعلياً
      if(touchedProducts.size) setTimeout(()=>checkNegativeStock([...touchedProducts],true),2500);
    }catch(e){
      toast('خطأ في المزامنة','error');
      console.error('flushQueue error',e);
    }
    this.syncing=false;
  },
};

// ============================================================
// فحص عجز المخزون بعد مزامنة مبيعات الأوفلاين
// ============================================================

// يرجّع المنتجات ذات الكمية بالسالب. ids فارغة = افحص كل المنتجات.
function findNegativeStock(ids=null){
  const entries = ids?.length
    ? ids.map(id=>[id,(S.products||{})[id]]).filter(([,p])=>p)
    : Object.entries(S.products||{});
  return entries
    .filter(([,p])=>(+p.qty||0) < 0)
    .map(([id,p])=>({
      id, name:p.name||'—',
      code:p.barcode||p.code||'',
      qty:+p.qty||0,
      shortage:Math.abs(+p.qty||0),
      branch:getBranchName(p.branchId||p.branch)||'مركزي',
      warehouse:getWhName(p.warehouseId||p.whId)||'—',
    }))
    .sort((a,b)=>b.shortage-a.shortage);
}

// afterSync=true تعني أن الفحص جاء تلقائياً بعد المزامنة (لا نزعج المستخدم إن كان كل شيء سليماً)
function checkNegativeStock(ids=null, afterSync=false){
  const neg=findNegativeStock(ids);
  if(!neg.length){
    if(!afterSync) toast('لا يوجد عجز في المخزون ✅','success');
    return neg;
  }
  const currency=S.settings?.general?.currency||'EGP';
  const totalCost=neg.reduce((t,p)=>t+p.shortage*(+((S.products||{})[p.id]?.cost)||0),0);
  document.getElementById('neg-stock-summary').innerHTML=
    `تم بيع كميات أكبر من المتاح في <strong>${neg.length}</strong> صنف — إجمالي العجز
     <strong>${neg.reduce((t,p)=>t+p.shortage,0)}</strong> وحدة
     بتكلفة تقريبية <strong>${totalCost.toFixed(2)} ${currency}</strong>.`;
  document.getElementById('neg-stock-tbl').innerHTML=neg.map(p=>`
    <tr>
      <td>${p.name}</td>
      <td><code style="font-size:11px;">${p.code||'—'}</code></td>
      <td>${p.branch}</td>
      <td>${p.warehouse}</td>
      <td style="color:var(--red);font-weight:800;">${p.qty}</td>
      <td style="color:var(--red);font-weight:800;">${p.shortage}</td>
    </tr>`).join('');
  openModal('modal-neg-stock');
  return neg;
}

// شريط تحذير دائم أعلى صفحة المخزن
function renderNegStockBanner(){
  const el=document.getElementById('neg-stock-banner'); if(!el) return;
  const neg=findNegativeStock();
  if(!neg.length){ el.style.display='none'; return; }
  el.style.display='flex';
  el.querySelector('#neg-stock-banner-text').innerHTML=
    `<strong>${neg.length}</strong> صنف بكمية بالسالب — غالباً بيع تم أثناء انقطاع الإنترنت تجاوز المتاح.`;
}


// ── اعتراض دوال الكتابة: أوفلاين ← الطابور، أونلاين ← السحابة ──
const _fbSet    = dbSet;
const _fbPush   = dbPush;
const _fbUpdate = dbUpdate;
const _fbRemove = dbRemove;

function isOffline(){ return !OM.isOnline || !window._fbAvailable; }

window.dbSet = async function(path,data){
  if(isOffline()){ await OM.enqueue('set',path,data); _applyLocal('set',path,data); return; }
  return _fbSet(path,data);
};
window.dbUpdate = async function(path,data){
  if(isOffline()){ await OM.enqueue('update',path,data); _applyLocal('update',path,data); return; }
  return _fbUpdate(path,data);
};
window.dbPush = async function(path,data){
  if(isOffline()){ await OM.enqueue('push',path,data); _applyLocal('push',path,data); return; }
  return _fbPush(path,data);
};
window.dbRemove = async function(path){
  if(isOffline()){ await OM.enqueue('remove',path,null); _applyLocal('remove',path,null); return; }
  return _fbRemove(path);
};

// تطبيق العملية على الحالة المحلية فوراً حتى تظهر في الواجهة قبل المزامنة
function _applyLocal(type,path,data){
  const [store,key,...rest]=path.split('/');
  if(!store||!(store in S)) return;
  if(type==='push'){
    S[store]=S[store]||{};
    S[store]['local_'+Date.now().toString(36)]=data;
  }else if(type==='remove'){
    if(key&&S[store]) delete S[store][key];
  }else if(key){
    S[store]=S[store]||{};
    if(rest.length){
      // مسار متداخل مثل products/<id>/qty
      let node=S[store][key]=S[store][key]||{};
      for(let i=0;i<rest.length-1;i++) node=node[rest[i]]=node[rest[i]]||{};
      node[rest[rest.length-1]]=data;
    }else{
      S[store][key] = type==='set' ? data : {...(S[store][key]||{}), ...data};
    }
  }else{
    S[store] = type==='set' ? data : {...(S[store]||{}), ...data};
  }
  _rerenderStore(store);
  IDB.saveStore(store,S[store]).catch(()=>{});
}

function _rerenderStore(store){
  try{
    const map={
      customers:()=>{renderCustomers?.();},
      products :()=>{renderWarehouse?.();renderCashier?.();},
      sales    :()=>{renderInvoices?.();renderFinance?.();},
      purchaseOrders:()=>{renderPurchases?.();},
      expenses :()=>{renderFinance?.();},
      suppliers:()=>{renderPurchases?.();},
      cashboxes:()=>{renderCashboxes?.();},
      returns  :()=>{renderReturns?.();},
      users    :()=>{renderUsers?.();},
    };
    map[store]?.();
    renderHomeStats?.();
  }catch(e){}
}

// شريط الأوفلاين — أعلى الشاشة فوق الشريط العلوي.
// كان شارة عائمة أسفل الشاشة (position:fixed) فتغطي شريط إجراءات الكاشير
// وما تحته. الآن شريط ممتد داخل تدفّق الصفحة: يدفع المحتوى لأسفل بدل أن
// يغطيه، ولا يشغل أي مساحة حين يكون النظام متصلاً.
(function(){
  const s=document.createElement('style');
  s.textContent=`
    @keyframes _pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
    /* الأنيميشن على الشفافية والإزاحة فقط — أي تحريك للارتفاع يترك
       max-height عالقاً على قيمة النهاية فيُضغط الشريط ويُقصّ نصّه */
    @keyframes _slideDown{from{opacity:0;transform:translateY(-100%);}to{opacity:1;transform:translateY(0);}}
    #offline-badge{
      display:none;align-items:center;justify-content:center;gap:10px;
      background:var(--yellow);color:#111;padding:10px 18px;
      font-family:'Cairo',sans-serif;font-size:12.5px;font-weight:700;line-height:1.5;
      cursor:pointer;text-align:center;flex-wrap:wrap;
      border-bottom:1px solid rgba(0,0,0,.18);
      animation:_slideDown .25s ease;
      flex:0 0 auto;
    }
    #offline-badge.show{display:flex;}
    #offline-badge:hover{filter:brightness(1.06);}
    #offline-badge .dot{width:9px;height:9px;border-radius:50%;background:#111;animation:_pulse 1s infinite;flex-shrink:0;}
    #offline-badge .badge-count{background:rgba(0,0,0,.18);border-radius:12px;padding:1px 9px;font-size:11px;}
    @media(max-width:768px){ #offline-badge{font-size:11.5px;padding:8px 12px;} }
  `;
  document.head.appendChild(s);

  const badge=document.createElement('div');
  badge.id='offline-badge';
  badge.innerHTML='<div class="dot"></div>'+
    '<span>غير متصل بالإنترنت — العمليات تُحفظ على الجهاز وتُرفع تلقائياً عند عودة الاتصال</span>'+
    '<span class="badge-count" id="badge-ops" style="display:none;">0</span>';
  badge.title='اضغط لعرض العمليات المعلقة';
  badge.onclick=()=>openQueuePanel();

  // يُوضع أول عنصر داخل <main> أي فوق الشريط العلوي مباشرة
  const main=document.querySelector('.main');
  if(main) main.insertBefore(badge, main.firstChild);
  else document.body.appendChild(badge);   // احتياطي لو تغيّرت البنية
})();

OM.init();

// نسخ البيانات محلياً بعد الاتصال وبشكل دوري
window.addEventListener('fbReady',()=>{
  setTimeout(()=>OM.syncToIDB(),6000);
  setInterval(()=>{ if(OM.isOnline&&window._fbAvailable) OM.syncToIDB(); },120000);
  setTimeout(()=>{ if(OM.pending>0) OM.flushQueue(); },8000);
},{once:true});

// عند فشل الاتصال بالسحابة: نحمّل آخر نسخة محلية بدل شاشة الخطأ
window.addEventListener('fbOffline', async ()=>{
  OM.isOnline=false;
  OM.updateUI();
  const found=await OM.loadFromIDB();
  if(found){
    document.getElementById('offline-badge')?.classList.add('show');
    buildUserGrid(S.users||{});
    toast('تم تحميل آخر نسخة محفوظة على الجهاز — وضع أوف لاين','warning');
    // الورديات جاءت من النسخة المحلية — نستعيد وردية المستخدم بدل فتح واحدة جديدة
    _shiftsLoaded=true;
    if(CURRENT_USER) ensureMyShift();
  }
});

