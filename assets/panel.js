/* ============ MEDYAPARK PANEL — Supabase sürümü ============ */
const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const MONTHS_SHORT=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=n=>{const x=Number(n);return isFinite(x)?x.toLocaleString('tr-TR')+' ₺':(n||'');};
const gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
const pad=n=>String(n).padStart(2,'0');

/* ---- Storage yükleme ---- */
async function uploadFile(f){
  const ext=(f.name.split('.').pop()||'bin').toLowerCase();
  const path='u/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
  const {error}=await sb.storage.from('media').upload(path,f,{upsert:false,contentType:f.type||undefined});
  if(error)throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
function pickUpload(accept, cb){ const inp=document.createElement('input'); inp.type='file'; inp.accept=accept;
  inp.onchange=async()=>{ const f=inp.files[0]; if(!f)return; try{ const url=await uploadFile(f); cb(url); }catch(e){ alert('Yükleme hatası: '+(e.message||e)); } }; inp.click(); }

/* ---- Veri katmanı köprüsü: eski api(action,body) -> Supabase ---- */
const DELMAP={product_delete:'products',mecra_delete:'mecralar',alt_delete:'alt_mecralar',unit_delete:'units',customer_delete:'customers',team_delete:'team',note_delete:'notes',quote_delete:'quotes',job_delete:'jobs'};
async function saveRow(table, body){ const id=body.id; const row={...body}; delete row.id;
  if(id){ const {error}=await sb.from(table).update(row).eq('id',id); if(error)throw error; return {id}; }
  const {data,error}=await sb.from(table).insert(row).select('id').single(); if(error)throw error; return {id:data.id}; }

async function api(action, body){
  const parts=action.split('&'); const act=parts[0]; const q={};
  parts.slice(1).forEach(kv=>{ const i=kv.indexOf('='); if(i>=0)q[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1)); });
  const ok=(d)=>d;

  if(act.endsWith('_delete')){ const {error}=await sb.from(DELMAP[act]).delete().eq('id',q.id); if(error)throw error; return ok(); }

  switch(act){
    case 'dashboard_stats':{
      const y=new Date().getFullYear();
      const [uc,mc,jc,qc,bc,rq]=await Promise.all([
        sb.from('units').select('*',{count:'exact',head:true}),
        sb.from('mecralar').select('*',{count:'exact',head:true}),
        sb.from('jobs').select('*',{count:'exact',head:true}).neq('status','arsiv'),
        sb.from('quotes').select('*',{count:'exact',head:true}).eq('status','yeni'),
        sb.from('bookings').select('*',{count:'exact',head:true}).like('ym',y+'-%'),
        sb.from('quotes').select('*').order('created_at',{ascending:false}).limit(6)
      ]);
      const units=uc.count||0, mecra=mc.count||0;
      return ok({doluluk:Math.round((bc.count||0)*100/Math.max(1,units*12)),activeJobs:jc.count||0,newQuotes:qc.count||0,mecra,units,recentQuotes:rq.data||[]});
    }
    case 'jobs_list':{ const {data,error}=await sb.from('jobs').select('*').order('sort').order('id'); if(error)throw error; return ok(data); }
    case 'job_move':{ const {error}=await sb.from('jobs').update({status:body.status}).eq('id',body.id); if(error)throw error; return ok(); }
    case 'job_save': return ok(await saveRow('jobs',body));

    case 'products_list':{ const {data,error}=await sb.from('products').select('*').order('sort').order('id'); if(error)throw error; return ok(data); }
    case 'product_save': return ok(await saveRow('products',body));

    case 'mecra_list':{
      const [ms,us]=await Promise.all([ sb.from('mecralar').select('*').order('sort').order('id'), sb.from('units').select('*').order('sort').order('id') ]);
      if(ms.error)throw ms.error; if(us.error)throw us.error;
      ms.data.forEach(m=>m.units=us.data.filter(u=>u.mecra_id===m.id)); return ok(ms.data);
    }
    case 'mecra_save': return ok(await saveRow('mecralar',body));
    case 'unit_save': return ok(await saveRow('units',body));
    case 'alt_all':{ const {data,error}=await sb.from('alt_mecralar').select('id,mecra_id,name,product_id').order('sort').order('id'); if(error)throw error; return ok(data); }
    case 'alt_list':{ const {data,error}=await sb.from('alt_mecralar').select('*').eq('mecra_id',q.mecra_id).order('sort').order('id'); if(error)throw error; return ok(data); }
    case 'alt_save': return ok(await saveRow('alt_mecralar',body));
    case 'unit_list':{ const {data,error}=await sb.from('units').select('*').eq('alt_mecra_id',q.alt_id).order('sort').order('id'); if(error)throw error; return ok(data); }
    case 'bookings_all':{ const {data,error}=await sb.from('bookings').select('unit_id,ym,status,customer_id'); if(error)throw error; return ok(data); }

    case 'booking_list':{ const {data,error}=await sb.from('bookings').select('ym,status').eq('unit_id',q.unit_id); if(error)throw error; return ok(data); }
    case 'booking_toggle':{
      if(body.status==='bos'){ const {error}=await sb.from('bookings').delete().eq('unit_id',body.unit_id).eq('ym',body.ym); if(error)throw error; }
      else { const {error}=await sb.from('bookings').upsert({unit_id:body.unit_id,ym:body.ym,status:body.status,customer_id:(body.customer_id!==undefined?body.customer_id:null)},{onConflict:'unit_id,ym'}); if(error)throw error; }
      return ok();
    }

    case 'customers_list':{ const {data,error}=await sb.from('customers').select('*').order('id',{ascending:false}); if(error)throw error; return ok(data); }
    case 'customer_save': return ok(await saveRow('customers',body));

    case 'quotes_list':{ const {data,error}=await sb.from('quotes').select('*').order('created_at',{ascending:false}); if(error)throw error; return ok(data); }
    case 'quote_get':{
      const [qr,ir]=await Promise.all([ sb.from('quotes').select('*').eq('id',q.id).single(), sb.from('quote_items').select('*').eq('quote_id',q.id) ]);
      if(qr.error)throw qr.error; if(ir.error)throw ir.error; return ok({quote:qr.data,items:ir.data});
    }
    case 'quote_status':{
      if(body.status==='onaylandi'){ const {data,error}=await sb.rpc('approve_quote',{p_quote_id:body.id}); if(error)throw error; return ok(data); }
      const {error}=await sb.from('quotes').update({status:body.status}).eq('id',body.id); if(error)throw error; return ok(null);
    }

    case 'team_list':{ const {data,error}=await sb.from('team').select('*').order('id'); if(error)throw error; return ok(data); }
    case 'team_save': return ok(await saveRow('team',body));

    case 'notes_list':{ const {data,error}=await sb.from('notes').select('*').order('created_at',{ascending:false}); if(error)throw error; return ok(data); }
    case 'note_save': return ok(await saveRow('notes',body));

    case 'pages_list':{ const {data,error}=await sb.from('pages').select('*').order('sort'); if(error)throw error; return ok(data); }
    case 'page_save':{ const row={slug:body.slug}; ['title','body','blocks','in_menu','sort'].forEach(k=>{ if(body[k]!==undefined)row[k]=body[k]; }); const {error}=await sb.from('pages').upsert(row,{onConflict:'slug'}); if(error)throw error; return ok(); }
    case 'page_delete':{ const {error}=await sb.from('pages').delete().eq('slug',q.slug); if(error)throw error; return ok(); }

    case 'settings_get':{ const {data,error}=await sb.from('settings').select('k,v'); if(error)throw error; const o={}; data.forEach(r=>o[r.k]=r.v); return ok(o); }
    case 'settings_save':{ const rows=Object.entries(body).map(([k,v])=>({k,v})); const {error}=await sb.from('settings').upsert(rows,{onConflict:'k'}); if(error)throw error; return ok(); }

    case 'password_change':{ const {error}=await sb.auth.updateUser({password:body.password}); if(error)throw error; return ok(); }
  }
  throw new Error('Bilinmeyen işlem: '+act);
}

let ui={section:'dashboard'}, calData={};
const root=()=>document.getElementById('root');

/* ---- Kimlik doğrulama (Supabase Auth) ---- */
async function boot(){ const {data}=await sb.auth.getSession(); if(data.session) showApp(); else showLogin(); }
function showLogin(err){
  root().innerHTML=`<div class="login"><div class="box"><div class="lg">medya<span>park</span></div>
    <p class="muted">Yönetim Paneli</p>
    <div class="field"><input class="inp" id="lu" type="email" placeholder="E-posta" autocomplete="username"></div>
    <div class="field"><input class="inp" id="lp" type="password" placeholder="Şifre" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn btn-primary" style="width:100%" onclick="doLogin()">Giriş Yap</button>
    ${err?`<p class="muted" style="color:var(--clay);margin:12px 0 0">${esc(err)}</p>`:''}</div></div>`;
}
async function doLogin(){ const {error}=await sb.auth.signInWithPassword({email:gv('lu'),password:gv('lp')}); if(error){ showLogin(error.message); } else { showApp(); } }
async function logout(){ await sb.auth.signOut(); showLogin(); }

const NAV=[['dashboard','◱ Dashboard'],['is-takibi','◷ İş Takibi'],['urunler','◇ Ürünler'],['mecralar','▤ Mecralar'],['listeler','☰ Listeler'],['musteriler','◔ Müşteriler'],['teklifler','▦ Teklifler'],['ekip','◕ Ekip'],['sayfalar','▭ Sayfalar'],['notlar','✎ Notlar'],['ayarlar','⚙ Ayarlar']];
const TITLES={dashboard:'Dashboard','is-takibi':'İş Takibi',urunler:'Ürünler',mecralar:'Mecralar',listeler:'Listeler',musteriler:'Müşteriler',teklifler:'Teklifler',ekip:'Ekip',sayfalar:'Sayfalar',notlar:'Notlar',ayarlar:'Ayarlar'};
function showApp(){
  root().innerHTML=`<div class="app">
    <nav class="side"><div class="lg">medya<span>park</span></div>
      ${NAV.map(n=>`<div class="navi" data-s="${n[0]}" onclick="go('${n[0]}')"><span class="ico">${n[1].split(' ')[0]}</span>${n[1].split(' ').slice(1).join(' ')}</div>`).join('')}
      <div class="navi logout" onclick="logout()"><span class="ico">⎋</span>Çıkış</div>
    </nav>
    <div class="main"><div class="topbar"><h2 id="ttl">Dashboard</h2>
      <a class="btn btn-outline btn-sm" href="index.html" target="_blank">Siteyi Aç</a></div>
      <div class="content" id="content"></div></div></div>`;
  go('dashboard');
}
function go(s){ ui.section=s; document.querySelectorAll('.navi').forEach(n=>n.classList.toggle('on',n.dataset.s===s));
  document.getElementById('ttl').textContent=TITLES[s]||''; renderSection(); }

async function renderSection(){
  const c=document.getElementById('content'); c.innerHTML='<p class="muted">Yükleniyor…</p>';
  try{
    if(ui.section==='dashboard') return dashboard(c);
    if(ui.section==='is-takibi') return isTakibi(c);
    if(ui.section==='urunler') return urunler(c);
    if(ui.section==='mecralar') return mecralar(c);
    if(ui.section==='listeler') return listeler(c);
    if(ui.section==='musteriler') return musteriler(c);
    if(ui.section==='teklifler') return teklifler(c);
    if(ui.section==='ekip') return ekip(c);
    if(ui.section==='sayfalar') return sayfalar(c);
    if(ui.section==='notlar') return notlar(c);
    if(ui.section==='ayarlar') return ayarlar(c);
  }catch(e){ c.innerHTML='<div class="banner">Hata: '+esc(e.message||e)+'</div>'; }
}

/* modal */
function modal(html){ document.getElementById('modal').innerHTML=html; document.getElementById('modalBg').classList.add('open'); }
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

/* ---------- DASHBOARD ---------- */
async function dashboard(c){
  const s=await api('dashboard_stats');
  const rq=(s.recentQuotes||[]).map(q=>`<tr><td>#${q.id}</td><td>${esc(q.customer_name||q.firma||'-')}</td><td>${money(q.total)}</td><td><span class="badge-st st-${q.status}">${q.status}</span></td><td>${(q.created_at||'').slice(0,10)}</td></tr>`).join('');
  c.innerHTML=`<div class="kpi">
    <div class="k teal"><div class="n">%${s.doluluk}</div><div class="l">Bu ay mecra doluluk</div></div>
    <div class="k sand"><div class="n">${s.activeJobs}</div><div class="l">Devam eden iş</div></div>
    <div class="k clay"><div class="n">${s.newQuotes}</div><div class="l">Yeni teklif</div></div>
    <div class="k plain"><div class="n">${s.mecra}</div><div class="l">Mecra / ${s.units} ünite</div></div>
  </div>
  <div class="sec-card"><div class="sec-head"><h3>Son Teklifler</h3><button class="btn btn-ghost btn-sm" onclick="go('teklifler')">Tümü</button></div>
    ${rq?`<table class="tbl"><thead><tr><th>#</th><th>Müşteri</th><th>Tutar</th><th>Durum</th><th>Tarih</th></tr></thead><tbody>${rq}</tbody></table>`:'<p class="muted">Henüz teklif yok.</p>'}</div>`;
}

/* ---------- İŞ TAKİBİ (kanban) ---------- */
const JOBST=[['tasarim','Tasarımda'],['baski','Baskıda'],['montaj','Montajda'],['yayin','Yayında'],['arsiv','Arşiv']];
async function isTakibi(c){
  const jobs=await api('jobs_list');
  const cols=JOBST.map(([st,lbl])=>{
    const items=jobs.filter(j=>j.status===st).map(j=>{
      const idx=JOBST.findIndex(x=>x[0]===st);
      return `<div class="kcard"><div class="t">${esc(j.title)}</div><div class="m">${esc(j.note||'')}</div>
      <div class="acts">${idx>0?`<button onclick="jobMove(${j.id},'${JOBST[idx-1][0]}')">‹</button>`:''}
      ${idx<4?`<button onclick="jobMove(${j.id},'${JOBST[idx+1][0]}')">›</button>`:''}
      <button onclick="jobDelete(${j.id})">sil</button></div></div>`;}).join('');
    return `<div class="kcol"><h4>${lbl}<span>${jobs.filter(j=>j.status===st).length}</span></h4>${items}</div>`;
  }).join('');
  c.innerHTML=`<div class="sec-head"><h3>İş Akışı</h3><button class="btn btn-primary btn-sm" onclick="jobForm()">+ Yeni İş</button></div><div class="kanban">${cols}</div>`;
}
async function jobMove(id,status){ await api('job_move',{id,status}); renderSection(); }
async function jobDelete(id){ if(confirm('Silinsin mi?')){ await api('job_delete&id='+id); renderSection(); } }
function jobForm(){ modal(`<h3 style="margin:0 0 14px">Yeni İş</h3>
  <div class="field"><label class="flabel">Başlık</label><input class="inp" id="jt"></div>
  <div class="field"><label class="flabel">Not</label><textarea class="inp" id="jn"></textarea></div>
  <div class="field"><label class="flabel">Durum</label><select class="inp" id="js">${JOBST.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></div>
  <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary btn-sm" onclick="jobSave()">Kaydet</button></div>`); }
async function jobSave(){ await api('job_save',{title:gv('jt'),note:gv('jn'),status:gv('js')}); closeModal(); renderSection(); }

/* ---------- ÜRÜNLER ---------- */
async function urunler(c){
  const list=await api('products_list');
  ui._products=list;
  const rows=list.map(p=>`<div class="list-item"><div class="nm">${esc(p.name)}</div><div class="meta">${esc(p.olcu||'')}</div>
    <button class="btn btn-outline btn-sm" onclick="prodEdit(${p.id})">Düzenle</button><button class="btn btn-danger btn-sm" onclick="prodDel(${p.id})">Sil</button></div>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Ürünler (çekirdek)</h3><button class="btn btn-primary btn-sm" onclick="prodEdit(0)">+ Ürün ekle</button></div>${rows||'<p class="muted">Ürün yok.</p>'}<div id="prodEd"></div>`;
}
function prodEdit(id){ const p=(ui._products||[]).find(x=>x.id===id)||{prices:{}};
  const priceText=Object.entries(p.prices||{}).map(([k,v])=>`${k} = ${v}`).join('\n');
  document.getElementById('prodEd').innerHTML=`<div class="sec-card" style="margin-top:16px"><h3 style="margin:0 0 14px;font-size:16px">${id?'Ürünü Düzenle':'Yeni Ürün'}</h3>
    <input type="hidden" id="pid" value="${id||0}">
    <div class="row2"><div class="field"><label class="flabel">İsim</label><input class="inp" id="pname" value="${esc(p.name)}"></div>
    <div class="field"><label class="flabel">Ölçü</label><input class="inp" id="polcu" value="${esc(p.olcu)}"></div></div>
    <div class="row3"><div class="field"><label class="flabel">Yüzey</label><input class="inp" id="pyuzey" value="${esc(p.yuzey)}"></div>
    <div class="field"><label class="flabel">Aydınlatma</label><input class="inp" id="pisikli" value="${esc(p.isikli)}"></div>
    <div class="field"><label class="flabel">Baskı Malzemesi</label><input class="inp" id="pbm" value="${esc(p.baski_malzemesi)}"></div></div>
    <div class="row3"><div class="field"><label class="flabel">Baskı Formatı</label><input class="inp" id="pbf" value="${esc(p.baski_format)}"></div>
    <div class="field"><label class="flabel">Yayın Formatı</label><input class="inp" id="pyf" value="${esc(p.yayin_format)}"></div>
    <div class="field"><label class="flabel">Baskı Ücreti</label><input class="inp" id="pbu" value="${esc(p.baski_ucreti)}"></div></div>
    <div class="row2"><div class="field"><label class="flabel">Montaj Ücreti</label><input class="inp" id="pmu" value="${esc(p.montaj_ucreti)}"></div>
    <div class="field"><label class="flabel">Extra Değişim</label><input class="inp" id="pex" value="${esc(p.extra_ucret)}"></div></div>
    <div class="field"><label class="flabel">Fiyatlar (Etiket = Değer)</label><textarea class="inp" id="pprices" placeholder="1 Ay = 40000">${esc(priceText)}</textarea></div>
    <button class="btn btn-primary btn-sm" onclick="prodSave()">Kaydet</button></div>`;
  document.getElementById('prodEd').scrollIntoView({behavior:'smooth'});
}
function parsePrices(v){ const o={}; v.split('\n').forEach(l=>{const x=l.indexOf('=');if(x<0)return;const k=l.slice(0,x).trim();let val=l.slice(x+1).trim();const n=val.replace(/[.\s₺]/g,'');if(/^\d+$/.test(n))val=Number(n);if(k)o[k]=val;}); return o; }
async function prodSave(){ await api('product_save',{id:+gv('pid'),name:gv('pname'),olcu:gv('polcu'),yuzey:gv('pyuzey'),isikli:gv('pisikli'),baski_malzemesi:gv('pbm'),baski_format:gv('pbf'),yayin_format:gv('pyf'),baski_ucreti:gv('pbu'),montaj_ucreti:gv('pmu'),extra_ucret:gv('pex'),prices:parsePrices(gv('pprices'))}); renderSection(); }
async function prodDel(id){ if(confirm('Ürün silinsin mi?')){ await api('product_delete&id='+id); renderSection(); } }

/* ---------- MECRALAR ---------- */
async function mecralar(c){
  const list=await api('mecra_list'); ui._mecralar=list; ui._products=await api('products_list');
  const alls=await api('alt_all'); const cnt={}; alls.forEach(a=>cnt[a.mecra_id]=(cnt[a.mecra_id]||0)+1);
  const rows=list.map(m=>`<div class="list-item"><span class="dot" style="background:${esc(m.theme_color)}"></span><div class="nm">${esc(m.name)}</div><div class="meta">${cnt[m.id]||0} alt mecra</div>
    <button class="btn btn-outline btn-sm" onclick="mecReorder(${m.id},-1)" title="Yukarı">↑</button><button class="btn btn-outline btn-sm" onclick="mecReorder(${m.id},1)" title="Aşağı">↓</button><button class="btn btn-outline btn-sm" onclick="mecEdit(${m.id})">Düzenle</button><button class="btn btn-danger btn-sm" onclick="mecDel(${m.id})">Sil</button></div>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Mecralar</h3><button class="btn btn-primary btn-sm" onclick="mecEdit(0)">+ Mecra ekle</button></div>${rows||'<p class="muted">Mecra yok.</p>'}<div id="mecEd"></div>`;
}

function mecEdit(id){ const m=(ui._mecralar||[]).find(x=>x.id===id)||{theme_color:'#0071e3'};
  document.getElementById('mecEd').innerHTML=`<div class="sec-card" style="margin-top:16px"><h3 style="margin:0 0 14px;font-size:16px">${id?'Mecrayı Düzenle':'Yeni Mecra'}</h3>
    <input type="hidden" id="mid" value="${id||0}">
    <div class="row2"><div class="field"><label class="flabel">İsim (kart başlığı)</label><input class="inp" id="mname" value="${esc(m.name)}"></div>
    <div class="field"><label class="flabel">Tema rengi</label><div class="colorwrap"><input type="color" id="mcolor" value="${esc(m.theme_color||'#0071e3')}" oninput="document.getElementById('mcolor2').value=this.value"><input class="inp" id="mcolor2" value="${esc(m.theme_color)}" oninput="document.getElementById('mcolor').value=this.value"></div></div></div>
    <div class="row2"><div class="field"><label class="flabel">Günlük gösterim</label><input class="inp" id="mgg" value="${esc(m.gunluk_gosterim)}" placeholder="≈ 250.000 gösterim"></div>
    <div class="field"><label class="flabel">Toplam reklam alanı</label><input class="inp" id="mta" value="${esc(m.toplam_alan)}" placeholder="3 alt mecra"></div></div>
    <div class="field"><label class="flabel">Kart görseli (yükle veya URL)</label><div style="display:flex;gap:8px"><input class="inp" id="mimage" value="${esc(m.image)}" placeholder="https://..."><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('mimage').value=u;})">Yükle</button></div></div>
    <div class="field"><label class="flabel">Kapak görseli (1920×400 — mecra sayfası üstü)</label><div style="display:flex;gap:8px"><input class="inp" id="mkapak" value="${esc(m.kapak)}"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('mkapak').value=u;})">Yükle</button></div></div>
    <div class="row2"><div class="field"><label class="flabel">Kapak kaplama rengi</label><input type="color" id="mkcolor" value="${esc(m.kapak_color||'#101014')}"></div><div class="field"><label class="flabel">Kapak opasite (0–1)</label><input class="inp" type="number" min="0" max="1" step="0.05" id="mkop" value="${m.kapak_opacity!=null?m.kapak_opacity:0.4}"></div></div>
    <div class="field"><label class="flabel">Kapak yüksekliği (px)</label><input class="inp" type="number" id="mkh" value="${m.kapak_height!=null?m.kapak_height:600}"></div>
    <div class="field"><label class="flabel">Açıklama</label><textarea class="inp" id="macik">${esc(m.aciklama)}</textarea></div>
    <button class="btn btn-primary btn-sm" onclick="mecSave()">Mecrayı Kaydet</button>
    ${id?`<hr style="border:0;border-top:1px solid var(--line2);margin:18px 0"><div class="sec-head"><h3 style="font-size:15px">Alt Mecralar</h3><button class="btn btn-primary btn-sm" onclick="altAdd(${id})">+ Alt Mecra</button></div><div id="altList">Yükleniyor…</div>`:'<p class="muted" style="margin-top:12px">Alt mecraları, mecrayı kaydettikten sonra ekleyebilirsiniz.</p>'}
    </div>`;
  document.getElementById('mecEd').scrollIntoView({behavior:'smooth'});
  if(id) loadAltList(id);
}
async function mecSave(){ const id=+gv('mid');
  const r=await api('mecra_save',{id,name:gv('mname'),theme_color:gv('mcolor'),gunluk_gosterim:gv('mgg'),toplam_alan:gv('mta'),image:gv('mimage'),kapak:gv('mkapak'),kapak_color:gv('mkcolor'),kapak_opacity:parseFloat(gv('mkop')||'0.4'),kapak_height:parseInt(gv('mkh')||'600',10),aciklama:gv('macik')});
  ui._mecralar=await api('mecra_list'); mecEdit(id||(r&&r.id)||0); }
async function mecDel(id){ if(confirm('Mecra, alt mecraları ve üniteleri silinsin mi?')){ await api('mecra_delete&id='+id); renderSection(); } }
async function mecReorder(id,dir){ let list=(ui._mecralar||[]).slice(); const idx=list.findIndex(x=>x.id===id); const j=idx+dir; if(idx<0||j<0||j>=list.length)return; [list[idx],list[j]]=[list[j],list[idx]]; for(let k=0;k<list.length;k++){ if((list[k].sort||0)!==k) await api('mecra_save',{id:list[k].id,sort:k}); } ui._mecralar=await api('mecra_list'); renderSection(); }

async function loadAltList(mid){ const alts=await api('alt_list&mecra_id='+mid); ui._alts=alts;
  const box=document.getElementById('altList'); if(!box)return;
  box.innerHTML = alts.length? alts.map(a=>`<div class="list-item"><div class="nm">${esc(a.name)}</div><div class="meta">${esc((ui._products.find(p=>p.id==a.product_id)||{}).name||'ürün?')}</div>
    <button class="btn btn-outline btn-sm" onclick="altEdit(${a.id},${mid})">Düzenle</button><button class="btn btn-danger btn-sm" onclick="altDel(${a.id},${mid})">Sil</button></div>`).join('') : '<p class="muted">Alt mecra yok.</p>';
}
async function altAdd(mid){ const pid=(ui._products[0]||{}).id||null; const r=await api('alt_save',{mecra_id:mid,product_id:pid,name:'Yeni Alt Mecra'}); ui._alts=await api('alt_list&mecra_id='+mid); altEdit(r.id,mid); }
async function altDel(id,mid){ if(confirm('Alt mecra ve üniteleri silinsin mi?')){ await api('alt_delete&id='+id); loadAltList(mid); } }

async function altEdit(id,mid){
  const alts=await api('alt_list&mecra_id='+mid); ui._alts=alts; const a=alts.find(x=>x.id===id)||{visible:{},avantajlar:[],galeri:[]};
  const vis=a.visible||{}; const adv=Array.isArray(a.avantajlar)?a.avantajlar:[]; const gal=Array.isArray(a.galeri)?a.galeri:[];
  const advInputs=[0,1,2,3].map(i=>{const x=adv[i]||{};return `<div class="row2"><div class="field"><input class="inp" id="av${i}t" value="${esc(x.t||x.title||'')}" placeholder="Avantaj ${i+1} başlık"></div><div class="field"><input class="inp" id="av${i}d" value="${esc(x.d||x.desc||'')}" placeholder="Açıklama"></div></div>`;}).join('');
  const galRows = gal.map((g,i)=>`<div class="list-item"><div class="nm" style="font-size:12px;word-break:break-all">${esc(g)}</div><button class="btn btn-danger btn-sm" onclick="altGalDel(${id},${mid},${i})">Sil</button></div>`).join('');
  const tog=(key,label)=>`<label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;margin:6px 0"><input type="checkbox" id="vis_${key}" ${vis[key]!==false?'checked':''}> ${label} ön yüzde göster</label>`;

  document.getElementById('mecEd').innerHTML=`<div class="sec-card" style="margin-top:16px">
    <button class="btn btn-outline btn-sm" onclick="mecEdit(${mid})">‹ Mecraya dön</button>
    <h3 style="margin:14px 0;font-size:16px">Alt Mecra</h3>
    <input type="hidden" id="aid" value="${id}"><input type="hidden" id="amid" value="${mid}">
    <div class="row2"><div class="field"><label class="flabel">Alt mecra adı</label><input class="inp" id="aname" value="${esc(a.name)}"></div>
      <div class="field"><label class="flabel">Ürün Seç</label><select class="inp" id="aprod">${ui._products.map(p=>`<option value="${p.id}" ${p.id==a.product_id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label class="flabel">Başlık</label><input class="inp" id="abaslik" value="${esc(a.baslik)}"><br>${tog('baslik','Başlığı')}</div>
    <div class="field"><label class="flabel">Açıklama</label><textarea class="inp" id="aacik">${esc(a.aciklama)}</textarea>${tog('aciklama','Açıklamayı')}</div>
    <div class="row2"><div class="field"><label class="flabel">Günlük gösterim</label><input class="inp" id="agg" value="${esc(a.gunluk_gosterim)}"></div>
      <div class="field"><label class="flabel">Toplam alan</label><input class="inp" id="ata" value="${esc(a.toplam_alan)}"></div></div>
    <div class="field"><label class="flabel">Kart görseli</label><div style="display:flex;gap:8px"><input class="inp" id="aimage" value="${esc(a.image)}"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('aimage').value=u;})">Yükle</button></div></div>
    <div class="field"><label class="flabel">Kapak görseli (1920×400 — detay üstü)</label><div style="display:flex;gap:8px"><input class="inp" id="akapak" value="${esc(a.kapak)}"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('akapak').value=u;})">Yükle</button></div></div>
    <div class="row2"><div class="field"><label class="flabel">Kapak kaplama rengi</label><input type="color" id="akcolor" value="${esc(a.kapak_color||'#101014')}"></div><div class="field"><label class="flabel">Kapak opasite (0–1)</label><input class="inp" type="number" min="0" max="1" step="0.05" id="akop" value="${a.kapak_opacity!=null?a.kapak_opacity:0.4}"></div></div>
    <div class="field"><label class="flabel">Kapak yüksekliği (px)</label><input class="inp" type="number" id="akh" value="${a.kapak_height!=null?a.kapak_height:600}"></div>
    <div class="field"><label class="flabel">Galeri görselleri</label>${galRows||'<p class="muted" style="font-size:12px">Henüz yok.</p>'}<div><button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="pickUpload('image/*',u=>altGalAdd(${id},${mid},u))">+ Galeri görseli ekle</button></div></div>
    <div class="field"><label class="flabel">Yerleşim planı görseli</label><div style="display:flex;gap:8px"><input class="inp" id="ayerlesim" value="${esc(a.yerlesim_plani)}"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('ayerlesim').value=u;})">Yükle</button></div></div>
    <div class="field"><label class="flabel">Marquee (kayan şerit — * ile ayır)</label><input class="inp" id="amarquee" value="${esc(a.marquee)}" placeholder="200+ Mağaza * 15M Ziyaretçi * ..."></div>
    <div class="field"><label class="flabel">Google Maps (iframe kodu)</label><textarea class="inp" id="amaps">${esc(a.maps)}</textarea>${tog('maps','Haritayı')}</div>
    <div class="field"><label class="flabel">Avantajlar (4 mini kart)</label>${advInputs}${tog('avantajlar','Avantajları')}</div>
    <div class="field"><label class="flabel">Fiyatlandırma — Aylık baz (₺) + otomatik indirim %</label>
      <div class="row2"><input class="inp" id="afbaz" type="number" placeholder="Aylık baz ₺" value="${(a.fiyat&&a.fiyat.baz!=null)?a.fiyat.baz:''}"><input class="inp" id="afhafta" type="number" placeholder="Haftalık ₺ (ops)" value="${(a.fiyat&&a.fiyat.hafta!=null)?a.fiyat.hafta:''}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px"><input class="inp" id="afind3" type="number" placeholder="3 Ay indirim %" value="${(a.fiyat&&a.fiyat.ind3!=null)?a.fiyat.ind3:''}"><input class="inp" id="afind6" type="number" placeholder="6 Ay indirim %" value="${(a.fiyat&&a.fiyat.ind6!=null)?a.fiyat.ind6:''}"><input class="inp" id="afind12" type="number" placeholder="1 Yıl indirim %" value="${(a.fiyat&&a.fiyat.ind12!=null)?a.fiyat.ind12:''}"></div>
      <p class="muted" style="font-size:12px;margin-top:6px">Boş bırakılırsa ürünün kendi fiyatları kullanılır. 3 Ay = baz×3×(1−%) · 1 Yıl = baz×12×(1−%). Pozisyonlar ve doluluk artık <b>Listeler</b> bölümünden yönetilir.</p></div>
    <button class="btn btn-primary btn-sm" onclick="altSave()">Alt Mecrayı Kaydet</button>
    </div>`;
  document.getElementById('mecEd').scrollIntoView({behavior:'smooth'});
}
async function altSave(){ const id=+gv('aid'), mid=+gv('amid');
  const adv=[0,1,2,3].map(i=>({t:gv('av'+i+'t'),d:gv('av'+i+'d')})).filter(x=>x.t||x.d);
  const visible={baslik:document.getElementById('vis_baslik').checked, aciklama:document.getElementById('vis_aciklama').checked, maps:document.getElementById('vis_maps').checked, avantajlar:document.getElementById('vis_avantajlar').checked};
  const bz=gv('afbaz'); const fiyat = bz!==''? {baz:+bz, hafta:(gv('afhafta')!==''?+gv('afhafta'):null), ind3:+gv('afind3')||0, ind6:+gv('afind6')||0, ind12:+gv('afind12')||0} : null;
  await api('alt_save',{id,name:gv('aname'),product_id:+gv('aprod'),baslik:gv('abaslik'),aciklama:gv('aacik'),gunluk_gosterim:gv('agg'),toplam_alan:gv('ata'),image:gv('aimage'),kapak:gv('akapak'),kapak_color:gv('akcolor'),kapak_opacity:parseFloat(gv('akop')||'0.4'),kapak_height:parseInt(gv('akh')||'600',10),marquee:gv('amarquee'),yerlesim_plani:gv('ayerlesim'),maps:gv('amaps'),avantajlar:adv,fiyat,visible});
  alert('Alt mecra kaydedildi.'); altEdit(id,mid); }
async function altGalAdd(id,mid,url){ const alts=await api('alt_list&mecra_id='+mid); const a=alts.find(x=>x.id===id)||{}; const gal=Array.isArray(a.galeri)?a.galeri:[]; gal.push(url); await api('alt_save',{id,galeri:gal}); altEdit(id,mid); }
async function altGalDel(id,mid,idx){ const alts=await api('alt_list&mecra_id='+mid); const a=alts.find(x=>x.id===id)||{}; const gal=Array.isArray(a.galeri)?a.galeri:[]; gal.splice(idx,1); await api('alt_save',{id,galeri:gal}); altEdit(id,mid); }

async function unitAdd(altId,mid){ const alt=(ui._alts||await api('alt_list&mecra_id='+mid)).find(x=>x.id===altId)||{};
  await api('unit_save',{alt_mecra_id:altId,mecra_id:mid,product_id:alt.product_id,name:'Yeni Pozisyon'}); altEdit(altId,mid); }
async function unitSave(id,field,value){ const body={id}; body[field]=value; await api('unit_save',body); }
async function unitDel(id,altId,mid){ if(confirm('Pozisyon silinsin mi?')){ await api('unit_delete&id='+id); altEdit(altId,mid); } }
async function loadUnitCal(uid){ try{ const bk=await api('booking_list&unit_id='+uid); const map={}; bk.forEach(b=>map[b.ym]=b.status);
  calData[uid]={map, y:new Date().getFullYear()}; drawUnitCal(uid); }catch(e){} }
function drawUnitCal(uid){ const box=document.getElementById('cal-'+uid); if(!box)return; const st=calData[uid]; const y=st.y;
  const cells=MONTHS_SHORT.map((mo,i)=>{ const ym=y+'-'+pad(i+1), s=st.map[ym]||'bos';
    return `<div class="ycell sm ${s}" onclick="cycleMonth(${uid},'${ym}')"><span class="ml">${mo}</span><span class="ms">${s==='dolu'?'Dolu':s==='rezerve'?'Rez':'Boş'}</span></div>`; }).join('');
  box.innerHTML=`<div class="year-nav"><button onclick="calMove(${uid},-1)">‹</button><span class="yr">${y}</span><button onclick="calMove(${uid},1)">›</button></div><div class="year-strip">${cells}</div>`;
}
function calMove(uid,d){ calData[uid].y+=d; drawUnitCal(uid); }
async function cycleMonth(uid,ym){ const st=calData[uid]; const cur=st.map[ym]; const next=cur==='dolu'?'rezerve':(cur==='rezerve'?'bos':'dolu');
  if(next==='bos')delete st.map[ym]; else st.map[ym]=next; drawUnitCal(uid); await api('booking_toggle',{unit_id:uid,ym,status:next}); }

/* ---------- LİSTELER ---------- */
async function listeler(c){
  if(!ui._lyear) ui._lyear=new Date().getFullYear();
  const y=ui._lyear;
  const [mlist,alts,prods,custs,bks]=await Promise.all([api('mecra_list'),api('alt_all'),api('products_list'),api('customers_list'),api('bookings_all')]);
  const cmap={}; custs.forEach(x=>cmap[x.id]=x.firma||x.ilgili_kisi||('#'+x.id)); window.__lcmap=cmap;
  const pmap={}; prods.forEach(p=>pmap[p.id]=p.name);
  const uByAlt={}; mlist.forEach(m=>(m.units||[]).forEach(u=>{ if(u.alt_mecra_id!=null)(uByAlt[u.alt_mecra_id]=uByAlt[u.alt_mecra_id]||[]).push(u); }));
  const altByMec={}; alts.forEach(a=>(altByMec[a.mecra_id]=altByMec[a.mecra_id]||[]).push(a));
  const bmap={}; bks.forEach(b=>{(bmap[b.unit_id]=bmap[b.unit_id]||{})[b.ym]={s:b.status,c:b.customer_id};}); window.__lbmap=bmap;
  const head='<th class="unit">Pozisyon</th>'+MONTHS_SHORT.map(mo=>`<th>${mo}</th>`).join('');
  let html='';
  for(const m of mlist){ const as=altByMec[m.id]||[];
    html+=`<details class="sec-card lgrp" open><summary>${esc(m.name)}</summary>`;
    if(!as.length){ html+='<p class="muted">Alt mecra yok.</p></details>'; continue; }
    for(const a of as){ const us=uByAlt[a.id]||[];
      html+=`<div class="sec-head" style="margin-top:10px"><h4 style="font-size:14px;margin:0">${esc(a.name)} <span class="muted">· ${esc(pmap[a.product_id]||'')}</span></h4><button class="btn btn-outline btn-sm" onclick="lAddPos(${a.id},${m.id},${a.product_id})">+ Pozisyon</button></div>`;
      if(!us.length){ html+='<p class="muted" style="font-size:12px">Pozisyon yok.</p>'; continue; }
      html+=`<div style="overflow-x:auto"><table class="matrix"><thead><tr>${head}</tr></thead><tbody>`;
      for(const u of us){ const um=bmap[u.id]||{};
        const cells=MONTHS_SHORT.map((mo,i)=>{ const ym=y+'-'+pad(i+1); const rec=um[ym]; const st=rec?rec.s:'bos'; const who=rec&&rec.c?cmap[rec.c]:'';
          const lbl= st==='bos'?'·':(who?esc(String(who).slice(0,3)).toLocaleUpperCase('tr'):(st==='dolu'?'D':'R'));
          const tip=who?` title="Kiralayan: ${esc(who)}"`:'';
          return `<td><span class="mx ${st}" data-u="${u.id}" data-ym="${ym}" onclick="lCycle(${u.id},'${ym}')"${tip}>${lbl}</span></td>`; }).join('');
        html+=`<tr><td class="unit">${esc(u.name)}</td>${cells}</tr>`; }
      html+='</tbody></table></div>';
    }
    html+='</details>';
  }
  const custOpts=custs.map(x=>`<option value="${x.id}">${esc(x.firma||x.ilgili_kisi||('#'+x.id))}</option>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Doluluk / Kiralama</h3>
    <div class="year-nav" style="margin:0"><button onclick="lYear(-1)">‹</button><span class="yr">${y}</span><button onclick="lYear(1)">›</button></div></div>
    <div class="banner">Hücreye tıkla: Boş → Dolu → Rezerve → Boş. Dolu/Rezerve yaparken aşağıda seçili müşteri atanır ve anında kaydedilir. Ön yüzde müşteri görünmez; ziyaretçi yalnızca boş/dolu görür.</div>
    <div class="field" style="max-width:380px"><label class="flabel">Atanacak müşteri (dolu/rezerve için)</label><select class="inp" id="lcust"><option value="">— müşteri atama —</option>${custOpts}</select></div>
    ${html||'<p class="muted">Mecra yok.</p>'}`;
}
function lCycle(uid,ym){ const cur=(window.__lbmap[uid]||{})[ym]; const s=cur?cur.s:'bos'; const next=s==='bos'?'dolu':(s==='dolu'?'rezerve':'bos');
  const sel=document.getElementById('lcust'); const cid= next==='bos'? null : (sel&&sel.value?+sel.value:null);
  window.__lbmap[uid]=window.__lbmap[uid]||{}; if(next==='bos')delete window.__lbmap[uid][ym]; else window.__lbmap[uid][ym]={s:next,c:cid};
  const el=document.querySelector(`.mx[data-u='${uid}'][data-ym='${ym}']`);
  if(el){ el.className='mx '+(next==='bos'?'bos':next); const who=cid?window.__lcmap[cid]:''; el.textContent= next==='bos'?'·':(who?String(who).slice(0,3).toLocaleUpperCase('tr'):(next==='dolu'?'D':'R')); if(who)el.title='Kiralayan: '+who; else el.removeAttribute('title'); }
  api('booking_toggle',{unit_id:uid,ym,status:next,customer_id:cid});
}
async function lAddPos(altId,mid,pid){ const nm=prompt('Pozisyon adı (ör. P1-A):','P'); if(nm===null)return; await api('unit_save',{alt_mecra_id:altId,mecra_id:mid,product_id:pid,name:(nm||'Yeni Pozisyon')}); renderSection(); }
function lYear(d){ ui._lyear=(ui._lyear||new Date().getFullYear())+d; renderSection(); }

/* ---------- MÜŞTERİLER ---------- */
async function musteriler(c){
  const list=await api('customers_list'); ui._cust=list;
  const rows=list.map(x=>`<div class="list-item"><div class="nm">${esc(x.firma)}</div><div class="meta">${esc(x.ilgili_kisi||'')} · ${esc(x.telefon||'')}</div>
    <button class="btn btn-outline btn-sm" onclick="custForm(${x.id})">Düzenle</button><button class="btn btn-danger btn-sm" onclick="custDel(${x.id})">Sil</button></div>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Müşteriler</h3><button class="btn btn-primary btn-sm" onclick="custForm(0)">+ Müşteri</button></div>${rows||'<p class="muted">Müşteri yok.</p>'}`;
}
function custForm(id){ const x=(ui._cust||[]).find(c=>c.id===id)||{};
  modal(`<h3 style="margin:0 0 14px">${id?'Müşteri Düzenle':'Yeni Müşteri'}</h3><input type="hidden" id="cid" value="${id||0}">
    <div class="row2"><div class="field"><label class="flabel">Firma</label><input class="inp" id="cf" value="${esc(x.firma)}"></div>
    <div class="field"><label class="flabel">İlgili Kişi</label><input class="inp" id="cik" value="${esc(x.ilgili_kisi)}"></div></div>
    <div class="row2"><div class="field"><label class="flabel">Telefon</label><input class="inp" id="ct" value="${esc(x.telefon)}"></div>
    <div class="field"><label class="flabel">E-posta</label><input class="inp" id="ce" value="${esc(x.eposta)}"></div></div>
    <div class="field"><label class="flabel">Adres</label><input class="inp" id="ca" value="${esc(x.adres)}"></div>
    <div class="row3"><div class="field"><label class="flabel">Vergi No</label><input class="inp" id="cv" value="${esc(x.vergi_no)}"></div>
    <div class="field"><label class="flabel">Vergi Dairesi</label><input class="inp" id="cvd" value="${esc(x.vergi_dairesi)}"></div>
    <div class="field"><label class="flabel">Puan (0-5)</label><input class="inp" id="cp" type="number" min="0" max="5" value="${esc(x.puan||0)}"></div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary btn-sm" onclick="custSave()">Kaydet</button></div>`);
}
async function custSave(){ await api('customer_save',{id:+gv('cid'),firma:gv('cf'),ilgili_kisi:gv('cik'),telefon:gv('ct'),eposta:gv('ce'),adres:gv('ca'),vergi_no:gv('cv'),vergi_dairesi:gv('cvd'),puan:+gv('cp')}); closeModal(); renderSection(); }
async function custDel(id){ if(confirm('Silinsin mi?')){ await api('customer_delete&id='+id); renderSection(); } }

/* ---------- TEKLİFLER ---------- */
async function teklifler(c){
  const list=await api('quotes_list');
  const rows=list.map(q=>`<tr><td>#${q.id}</td><td>${esc(q.customer_name||'-')}<br><span class="muted" style="font-size:12px">${esc(q.firma||'')}</span></td>
    <td>${esc(q.telefon||'')}</td><td>${money(q.total)}</td><td><span class="badge-st st-${q.status}">${q.status}</span></td><td>${(q.created_at||'').slice(0,10)}</td>
    <td><button class="btn btn-outline btn-sm" onclick="quoteView(${q.id})">Aç</button> <button class="btn btn-danger btn-sm" onclick="quoteDel(${q.id})">Sil</button></td></tr>`).join('');
  c.innerHTML=`<div class="sec-card"><div class="sec-head"><h3>Gelen Teklifler</h3></div>
    ${rows?`<table class="tbl"><thead><tr><th>#</th><th>Müşteri</th><th>Telefon</th><th>Tutar</th><th>Durum</th><th>Tarih</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:'<p class="muted">Henüz teklif yok.</p>'}</div>`;
}
async function quoteView(id){ const d=await api('quote_get&id='+id); const q=d.quote;
  const items=d.items.map(i=>`<tr><td>${esc(i.mecra_name)} — ${esc(i.unit_name)}</td><td>${esc(i.period)}</td><td>${esc(i.start_day||'-')}</td><td style="text-align:right">${money(i.price)}</td></tr>`).join('');
  modal(`<h3 style="margin:0 0 4px">Teklif #${q.id}</h3><p class="muted" style="margin:0 0 14px">${esc(q.customer_name||'')} · ${esc(q.firma||'')} · ${esc(q.telefon||'')} · ${esc(q.eposta||'')}</p>
    <table class="tbl"><thead><tr><th>Alan</th><th>Dönem</th><th>Başlangıç</th><th style="text-align:right">Fiyat</th></tr></thead><tbody>${items}</tbody></table>
    <div style="display:flex;justify-content:space-between;margin:14px 0;font-weight:700"><span>Toplam</span><span>${money(q.total)}</span></div>
    <div class="field"><label class="flabel">Durum</label><select class="inp" id="qs">${['yeni','gorusuldu','onaylandi','iptal'].map(s=>`<option value="${s}" ${q.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Kapat</button><button class="btn btn-primary btn-sm" onclick="quoteStatus(${q.id})">Durumu Kaydet</button></div>`);
}
async function quoteStatus(id){ const r=await api('quote_status',{id,status:gv('qs')}); closeModal();
  if(r && r.reserved!==undefined){ let msg='✓ '+r.reserved+' ay rezerve edildi (dolu işaretlendi). Müşteri ve İş Takibi kartı oluşturuldu.';
    if(r.conflicts && r.conflicts.length){ msg+='\n\n⚠ Çakışma (bu aylar başka müşteride dolu, atlandı):\n· '+r.conflicts.join('\n· '); }
    alert(msg); }
  renderSection(); }
async function quoteDel(id){ if(confirm('Teklif silinsin mi?')){ await api('quote_delete&id='+id); renderSection(); } }

/* ---------- EKİP ---------- */
async function ekip(c){
  const list=await api('team_list'); ui._team=list;
  const rows=list.map(x=>`<div class="list-item"><div class="nm">${esc(x.name)}</div><div class="meta">${esc(x.role||'')} · ${esc(x.yetki||'')}</div>
    <button class="btn btn-outline btn-sm" onclick="teamForm(${x.id})">Düzenle</button><button class="btn btn-danger btn-sm" onclick="teamDel(${x.id})">Sil</button></div>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Ekip</h3><button class="btn btn-primary btn-sm" onclick="teamForm(0)">+ Kişi</button></div>${rows||'<p class="muted">Kişi yok.</p>'}`;
}
function teamForm(id){ const x=(ui._team||[]).find(t=>t.id===id)||{};
  modal(`<h3 style="margin:0 0 14px">${id?'Kişi Düzenle':'Yeni Kişi'}</h3><input type="hidden" id="tid" value="${id||0}">
    <div class="row2"><div class="field"><label class="flabel">Ad Soyad</label><input class="inp" id="tn" value="${esc(x.name)}"></div>
    <div class="field"><label class="flabel">Görev</label><input class="inp" id="tr" value="${esc(x.role)}"></div></div>
    <div class="row2"><div class="field"><label class="flabel">Yetki</label><input class="inp" id="ty" value="${esc(x.yetki)}"></div>
    <div class="field"><label class="flabel">Telefon</label><input class="inp" id="tt" value="${esc(x.telefon)}"></div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary btn-sm" onclick="teamSave()">Kaydet</button></div>`);
}
async function teamSave(){ await api('team_save',{id:+gv('tid'),name:gv('tn'),role:gv('tr'),yetki:gv('ty'),telefon:gv('tt')}); closeModal(); renderSection(); }
async function teamDel(id){ if(confirm('Silinsin mi?')){ await api('team_delete&id='+id); renderSection(); } }

/* ---------- SAYFALAR ---------- */
async function sayfalar(c){
  const st=await api('settings_get'); const pages=await api('pages_list'); ui._pages=pages;
  const hero=st.hero||{};
  const pageRows=pages.map(p=>`<div class="list-item"><div class="nm">${esc(p.title||p.slug)}</div><div class="meta">/${esc(p.slug)} · ${(p.blocks||[]).length} blok${p.in_menu===false?' · menüde değil':''}</div>
    <button class="btn btn-outline btn-sm" onclick="pageEdit('${p.slug}')">Düzenle</button>${['biz-kimiz','neler-yapiyoruz','iletisim','referanslar'].includes(p.slug)?'':`<button class="btn btn-danger btn-sm" onclick="pageDel('${p.slug}')">Sil</button>`}</div>`).join('');
  c.innerHTML=`<div class="sec-card"><h3 style="margin:0 0 14px;font-size:16px">Logo & Anasayfa</h3>
    <div class="row2"><div class="field"><label class="flabel">Logo metni</label><input class="inp" id="logoText" value="${esc(st.logoText||'')}"></div>
    <div class="field"><label class="flabel">Üst etiket (sayaç yerine)</label><input class="inp" id="hEye" value="${esc(hero.eyebrow||'')}"></div></div>
    <div class="field"><label class="flabel">Logo görseli (yüklenirse metin yerine görsel)</label>
      <div style="display:flex;gap:8px"><input class="inp" id="logoImg" value="${esc(st.logoImage||'')}" placeholder="uploads/logo.png">
      <button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('logoImg').value=u;})">Yükle</button></div></div>
    <div class="field"><label class="flabel">Anasayfa başlığı</label><input class="inp" id="hTitle" value="${esc(hero.title||'')}"></div>
    <div class="field"><label class="flabel">Anasayfa açıklaması</label><textarea class="inp" id="hDesc">${esc(hero.desc||'')}</textarea></div>
    <button class="btn btn-primary btn-sm" onclick="saveHero()">Kaydet</button></div>

    <div class="sec-card"><div class="sec-head"><h3>Sayfalar</h3><button class="btn btn-primary btn-sm" onclick="pageNew()">+ Yeni Sayfa</button></div>
    ${pageRows||'<p class="muted">Sayfa yok.</p>'}<div id="pageEd"></div></div>`;
}
async function saveHero(){ await api('settings_save',{logoText:gv('logoText'),logoImage:gv('logoImg'),hero:{eyebrow:gv('hEye'),title:gv('hTitle'),desc:gv('hDesc')}}); alert('Kaydedildi.'); }

function pageEdit(slug){ const p=(ui._pages||[]).find(x=>x.slug===slug)||{slug,blocks:[]}; ui._pageSlug=slug; ui._blocks=JSON.parse(JSON.stringify(p.blocks||[])); ui._pageTitle=p.title||''; ui._pageMenu=p.in_menu!==false; renderPageEd(); document.getElementById('pageEd').scrollIntoView({behavior:'smooth'}); }
function blkLabel(t){ return {heading:'Başlık',text:'Metin',image:'Görsel',gallery:'Galeri',features:'Özellikler',faq:'S.S.S.',cta:'Çağrı (CTA)',spacer:'Boşluk'}[t]||t; }
function renderPageEd(){ const blocks=ui._blocks; const box=document.getElementById('pageEd'); if(!box)return;
  const blk=blocks.map((b,i)=>blockEditor(b,i)).join('');
  box.innerHTML=`<div class="sec-card" style="margin-top:14px">
    <button class="btn btn-outline btn-sm" onclick="renderSection()">‹ Sayfalara dön</button>
    <div class="row2" style="margin-top:12px"><div class="field"><label class="flabel">Sayfa başlığı</label><input class="inp" id="pgTitle" value="${esc(ui._pageTitle)}"></div>
    <div class="field"><label class="flabel">Menüde göster</label><select class="inp" id="pgMenu"><option value="1" ${ui._pageMenu?'selected':''}>Evet</option><option value="0" ${!ui._pageMenu?'selected':''}>Hayır</option></select></div></div>
    <h4 style="margin:10px 0 8px">Bloklar</h4>${blk||'<p class="muted">Henüz blok yok. Aşağıdan ekleyin.</p>'}
    <div class="addbar"><span class="muted" style="align-self:center;font-size:12px">Blok ekle:</span>
      <button onclick="blkAdd('heading')">Başlık</button><button onclick="blkAdd('text')">Metin</button><button onclick="blkAdd('image')">Görsel</button><button onclick="blkAdd('gallery')">Galeri</button><button onclick="blkAdd('features')">Özellikler</button><button onclick="blkAdd('faq')">SSS</button><button onclick="blkAdd('cta')">CTA</button><button onclick="blkAdd('spacer')">Boşluk</button></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="pageSaveBlocks()">Sayfayı Kaydet</button></div></div>`;
}
function blockEditor(b,i){
  const head=`<div class="blk-head"><span class="bt">${blkLabel(b.type)}</span><button class="btn btn-outline btn-sm" onclick="blkMove(${i},-1)">↑</button><button class="btn btn-outline btn-sm" onclick="blkMove(${i},1)">↓</button><button class="btn btn-danger btn-sm" onclick="blkDel(${i})">Sil</button></div>`;
  let body='';
  if(b.type==='heading') body=`<input class="inp" id="blk${i}_text" value="${esc(b.text||'')}" placeholder="Başlık metni">`;
  else if(b.type==='text') body=`<textarea class="inp" id="blk${i}_text" style="min-height:90px" placeholder="Paragraf metni">${esc(b.text||'')}</textarea>`;
  else if(b.type==='image') body=`<div style="display:flex;gap:8px"><input class="inp" id="blk${i}_url" value="${esc(b.url||'')}" placeholder="Görsel URL"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('image/*',u=>{document.getElementById('blk${i}_url').value=u;})">Yükle</button></div><input class="inp" id="blk${i}_caption" value="${esc(b.caption||'')}" placeholder="Alt yazı (ops)" style="margin-top:8px">`;
  else if(b.type==='gallery'){ const imgs=Array.isArray(b.images)?b.images:[]; body=`${imgs.map((g,k)=>`<div class="list-item" style="padding:8px 10px"><div class="nm" style="font-size:12px;word-break:break-all">${esc(g)}</div><button class="btn btn-danger btn-sm" onclick="blkGalDel(${i},${k})">Sil</button></div>`).join('')||'<p class="muted" style="font-size:12px">Görsel yok.</p>'}<button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="pickUpload('image/*',u=>blkGalAdd(${i},u))">+ Görsel ekle</button>`; }
  else if(b.type==='features'){ const items=Array.isArray(b.items)?b.items:[]; body=`<textarea class="inp" id="blk${i}_items" style="min-height:100px" placeholder="Her satır: Başlık | Açıklama">${esc(items.map(x=>`${x.title||''} | ${x.desc||''}`).join('\n'))}</textarea><p class="muted" style="font-size:11px">Her satıra bir özellik: <b>Başlık | Açıklama</b></p>`; }
  else if(b.type==='faq'){ const items=Array.isArray(b.items)?b.items:[]; body=`<textarea class="inp" id="blk${i}_items" style="min-height:120px" placeholder="Her satır: Soru | Cevap">${esc(items.map(x=>`${x.q||''} | ${x.a||''}`).join('\n'))}</textarea><p class="muted" style="font-size:11px">Her satıra bir S.S.S.: <b>Soru | Cevap</b></p>`; }
  else if(b.type==='cta') body=`<input class="inp" id="blk${i}_title" value="${esc(b.title||'')}" placeholder="Başlık" style="margin-bottom:8px"><div class="row2"><input class="inp" id="blk${i}_label" value="${esc(b.label||'')}" placeholder="Buton yazısı"><input class="inp" id="blk${i}_link" value="${esc(b.link||'')}" placeholder="Link (tel: / https:)"></div>`;
  else if(b.type==='spacer') body=`<input class="inp" id="blk${i}_size" type="number" value="${b.size||40}" placeholder="Yükseklik px">`;
  return `<div class="blk">${head}${body}</div>`;
}
function readBlocks(){ return ui._blocks.map((b,i)=>{ const g=id=>{const e=document.getElementById('blk'+i+'_'+id);return e?e.value:'';};
  if(b.type==='heading')return {type:'heading',text:g('text')};
  if(b.type==='text')return {type:'text',text:g('text')};
  if(b.type==='image')return {type:'image',url:g('url'),caption:g('caption')};
  if(b.type==='gallery')return {type:'gallery',images:(Array.isArray(b.images)?b.images:[])};
  if(b.type==='features')return {type:'features',items:g('items').split('\n').map(l=>l.split('|')).filter(a=>a[0]&&a[0].trim()).map(a=>({title:(a[0]||'').trim(),desc:(a[1]||'').trim()}))};
  if(b.type==='faq')return {type:'faq',items:g('items').split('\n').map(l=>l.split('|')).filter(a=>a[0]&&a[0].trim()).map(a=>({q:(a[0]||'').trim(),a:(a[1]||'').trim()}))};
  if(b.type==='cta')return {type:'cta',title:g('title'),label:g('label'),link:g('link')};
  if(b.type==='spacer')return {type:'spacer',size:+g('size')||40};
  return b; }); }
function syncBlocks(){ if(document.getElementById('pageEd')&&ui._blocks) ui._blocks=readBlocks(); }
function blkAdd(t){ syncBlocks(); const def={heading:{type:'heading',text:'Başlık'},text:{type:'text',text:''},image:{type:'image',url:'',caption:''},gallery:{type:'gallery',images:[]},features:{type:'features',items:[]},faq:{type:'faq',items:[]},cta:{type:'cta',title:'',label:'',link:''},spacer:{type:'spacer',size:40}}[t]; ui._blocks.push(def); renderPageEd(); }
function blkMove(i,d){ syncBlocks(); const j=i+d; if(j<0||j>=ui._blocks.length)return; [ui._blocks[i],ui._blocks[j]]=[ui._blocks[j],ui._blocks[i]]; renderPageEd(); }
function blkDel(i){ syncBlocks(); ui._blocks.splice(i,1); renderPageEd(); }
function blkGalAdd(i,url){ syncBlocks(); ui._blocks[i].images=ui._blocks[i].images||[]; ui._blocks[i].images.push(url); renderPageEd(); }
function blkGalDel(i,k){ syncBlocks(); ui._blocks[i].images.splice(k,1); renderPageEd(); }
async function pageSaveBlocks(){ syncBlocks(); await api('page_save',{slug:ui._pageSlug,title:gv('pgTitle'),in_menu:gv('pgMenu')==='1',blocks:ui._blocks}); ui._pages=await api('pages_list'); alert('Sayfa kaydedildi.'); }
async function pageDel(slug){ if(confirm('Sayfa silinsin mi?')){ await api('page_delete&slug='+encodeURIComponent(slug)); renderSection(); } }
function pageNew(){ const t=prompt('Yeni sayfa başlığı:'); if(!t)return; const slug=t.trim().toLowerCase().replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||('sayfa-'+Date.now()); api('page_save',{slug,title:t,blocks:[],in_menu:true,sort:9}).then(async()=>{ ui._pages=await api('pages_list'); pageEdit(slug); }); }


/* ---------- NOTLAR ---------- */
async function notlar(c){
  const list=await api('notes_list'); ui._notes=list;
  const rows=list.map(n=>`<div class="list-item"><div class="nm">${esc(n.konu)}</div><div class="meta">${esc(n.ilgili_kisi||'')} · ${esc(n.tarih||'')}</div>
    <button class="btn btn-outline btn-sm" onclick="noteForm(${n.id})">Aç</button><button class="btn btn-danger btn-sm" onclick="noteDel(${n.id})">Sil</button></div>`).join('');
  c.innerHTML=`<div class="sec-head"><h3>Notlar</h3><button class="btn btn-primary btn-sm" onclick="noteForm(0)">+ Not</button></div>${rows||'<p class="muted">Not yok.</p>'}`;
}
function noteForm(id){ const n=(ui._notes||[]).find(x=>x.id===id)||{};
  modal(`<h3 style="margin:0 0 14px">${id?'Not':'Yeni Not'}</h3><input type="hidden" id="nid" value="${id||0}">
    <div class="field"><label class="flabel">Konu</label><input class="inp" id="nk" value="${esc(n.konu)}"></div>
    <div class="row2"><div class="field"><label class="flabel">İlgili Kişi</label><input class="inp" id="nik" value="${esc(n.ilgili_kisi)}"></div>
    <div class="field"><label class="flabel">Tarih</label><input class="inp" id="nt" type="date" value="${esc(n.tarih)}"></div></div>
    <div class="field"><label class="flabel">İçerik</label><textarea class="inp" style="min-height:120px" id="nb">${esc(n.body)}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary btn-sm" onclick="noteSave()">Kaydet</button></div>`);
}
async function noteSave(){ await api('note_save',{id:+gv('nid'),konu:gv('nk'),ilgili_kisi:gv('nik'),tarih:gv('nt')||null,body:gv('nb')}); closeModal(); renderSection(); }
async function noteDel(id){ if(confirm('Silinsin mi?')){ await api('note_delete&id='+id); renderSection(); } }

/* ---------- AYARLAR ---------- */
async function ayarlar(c){
  const st=await api('settings_get');
  c.innerHTML=`
  <div class="sec-card"><h3 style="margin:0 0 14px;font-size:16px">Ajans Bilgileri</h3>
    <div class="row2"><div class="field"><label class="flabel">Site adı</label><input class="inp" id="sName" value="${esc(st.siteName||'')}"></div>
    <div class="field"><label class="flabel">Telefon</label><input class="inp" id="sPhone" value="${esc(st.phone||'')}"></div></div>
    <div class="row2"><div class="field"><label class="flabel">E-posta</label><input class="inp" id="sMail" value="${esc(st.email||'')}"></div>
    <div class="field"><label class="flabel">Adres</label><input class="inp" id="sAddr" value="${esc(st.address||'')}"></div></div>
    <div class="field"><label class="flabel">Katalog PDF (yükle veya yol)</label><div style="display:flex;gap:8px"><input class="inp" id="sPdf" value="${esc(st.catalogPdf||'')}"><button class="btn btn-outline btn-sm" style="flex:0 0 auto" onclick="pickUpload('application/pdf',u=>{document.getElementById('sPdf').value=u;})">Yükle</button></div></div>
    <button class="btn btn-primary btn-sm" onclick="saveSettings()">Kaydet</button></div>

  <div class="sec-card"><h3 style="margin:0 0 12px;font-size:16px">Sosyal Medya Linkleri</h3>
    <div class="row2"><div class="field"><label class="flabel">WhatsApp</label><input class="inp" id="soWa" value="${esc(st.social_whatsapp||'')}"></div>
    <div class="field"><label class="flabel">Instagram</label><input class="inp" id="soIg" value="${esc(st.social_instagram||'')}"></div></div>
    <div class="row2"><div class="field"><label class="flabel">LinkedIn</label><input class="inp" id="soLi" value="${esc(st.social_linkedin||'')}"></div>
    <div class="field"><label class="flabel">Facebook</label><input class="inp" id="soFb" value="${esc(st.social_facebook||'')}"></div></div>
    <button class="btn btn-primary btn-sm" onclick="saveSocial()">Kaydet</button></div>

  <div class="sec-card"><h3 style="margin:0 0 12px;font-size:16px">SEO Meta Etiketleri</h3>
    <div class="field"><label class="flabel">Başlık (title)</label><input class="inp" id="seoT" value="${esc(st.seoTitle||'')}"></div>
    <div class="field"><label class="flabel">Açıklama (description)</label><textarea class="inp" id="seoD">${esc(st.seoDesc||'')}</textarea></div>
    <div class="field"><label class="flabel">Anahtar kelimeler</label><input class="inp" id="seoK" value="${esc(st.seoKeywords||'')}"></div>
    <button class="btn btn-primary btn-sm" onclick="saveSeo()">Kaydet</button></div>

  <div class="sec-card"><h3 style="margin:0 0 10px;font-size:16px">Yedek</h3>
    <p class="muted" style="font-size:13px;margin:0 0 12px">Tüm verilerin (mecralar, alt mecralar, doluluk, teklifler, müşteriler…) JSON yedeğini indir.</p>
    <button class="btn btn-outline btn-sm" onclick="exportBackup()">Yedek indir (JSON)</button></div>

  <div class="sec-card"><h3 style="margin:0 0 12px;font-size:16px">Footer</h3>
    <div class="field"><label class="flabel">Hakkımızda (logo altı kısa metin)</label><textarea class="inp" id="fAbout">${esc(st.footer_about||'')}</textarea></div>
    <div class="field"><label class="flabel">Bülten başlığı</label><input class="inp" id="fNews" value="${esc(st.footer_news||'')}"></div>
    <div class="field"><label class="flabel">Alt telif metni</label><input class="inp" id="fNote" value="${esc(st.footer_note||'')}"></div>
    <button class="btn btn-primary btn-sm" onclick="saveFooter()">Kaydet</button></div>
  <div class="sec-card"><h3 style="margin:0 0 8px;font-size:16px">Panel Şifresi</h3>
    <div class="row2"><div class="field"><input class="inp" id="npw" type="password" placeholder="Yeni şifre"></div>
    <div class="field"><button class="btn btn-primary" onclick="changePw()">Şifreyi Güncelle</button></div></div></div>`;
}
async function saveSettings(){ await api('settings_save',{siteName:gv('sName'),phone:gv('sPhone'),email:gv('sMail'),address:gv('sAddr'),catalogPdf:gv('sPdf')}); alert('Kaydedildi.'); }
async function saveSocial(){ await api('settings_save',{social_whatsapp:gv('soWa'),social_instagram:gv('soIg'),social_linkedin:gv('soLi'),social_facebook:gv('soFb')}); alert('Kaydedildi.'); }
async function saveSeo(){ await api('settings_save',{seoTitle:gv('seoT'),seoDesc:gv('seoD'),seoKeywords:gv('seoK')}); alert('Kaydedildi.'); }
async function saveFooter(){ await api('settings_save',{footer_about:gv('fAbout'),footer_news:gv('fNews'),footer_note:gv('fNote')}); alert('Kaydedildi.'); }
async function exportBackup(){ const tables=['settings','pages','products','mecralar','alt_mecralar','units','bookings','customers','quotes','quote_items','jobs','team','notes','suppliers'];
  const out={_exported:new Date().toISOString()}; for(const t of tables){ try{ const {data}=await sb.from(t).select('*'); out[t]=data||[]; }catch(e){ out[t]='HATA'; } }
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='medyapark-yedek-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); URL.revokeObjectURL(a.href); }
async function changePw(){ const p=gv('npw'); if(p.length<4){alert('En az 4 karakter.');return;} await api('password_change',{password:p}); alert('Şifre güncellendi.'); }

boot();
