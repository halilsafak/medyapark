/* ============ MEDYAPARK — ÖN YÜZ (zengin tasarım + fiyatsız) ============ */
const MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let D={settings:{},pages:[],products:[],mecralar:[]};
let view={type:'home'}, calYear=new Date().getFullYear(), cart=[], filterPid=null, searchQ='';

const app=()=>document.getElementById('app');
const pad=n=>String(n).padStart(2,'0');
const curYm=()=> new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const prod=id=>D.products.find(p=>String(p.id)===String(id))||{};
const mec=id=>D.mecralar.find(m=>String(m.id)===String(id));
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const setHTML=(id,h)=>{const e=document.getElementById(id); if(e)e.innerHTML=h;};
/* İçerik varsa VE visible[key] açıkça false değilse göster */
const vis=(m,key,has)=> !!has && ((m.visible&&m.visible[key])!==false);
const hex2rgb=h=>{h=(h||'#3f6f63').replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255].join(',');};

async function load(){
  try{
    const [stg,pg,pr,mc,un,bk] = await Promise.all([
      sb.from('settings').select('k,v'),
      sb.from('pages').select('*').order('sort'),
      sb.from('products').select('*').order('sort'),
      sb.from('mecralar').select('*').order('sort'),
      sb.from('units').select('*').order('sort').order('id'),
      sb.from('bookings').select('unit_id,ym,status')
    ]);
    const err=stg.error||pg.error||pr.error||mc.error||un.error||bk.error;
    if(err) throw err;
    const settings={}; (stg.data||[]).forEach(r=>settings[r.k]=r.v);
    const bmap={}; (bk.data||[]).forEach(b=>{(bmap[b.unit_id]=bmap[b.unit_id]||[]).push({ym:b.ym,status:b.status});});
    const umap={}; (un.data||[]).forEach(u=>{u.booked=bmap[u.id]||[]; (umap[u.mecra_id]=umap[u.mecra_id]||[]).push(u);});
    const mecralar=(mc.data||[]).map(m=>({...m, units:umap[m.id]||[]}));
    D={settings, pages:pg.data||[], products:pr.data||[], mecralar};
  }catch(e){ app().innerHTML='<div class="loading">Veri yüklenemedi: '+esc(e.message||e)+'</div>'; return; }
  chrome(); render();
}
function logo(t){ t=t||'medyapark'; return String(t).toLowerCase().startsWith('medya')?('medya<span style="color:var(--teal)">'+esc(String(t).slice(5))+'</span>'):esc(t); }

/* Nav + footer + menüler (index'teki iskeleti doldurur) */
function chrome(){
  const s=D.settings||{};
  const brandHTML = s.logoImage ? `<img class="brandimg" src="${esc(s.logoImage)}" alt="logo">` : logo(s.logoText);
  setHTML('brand', brandHTML);
  const pdf=document.getElementById('pdfBtn');
  if(pdf){ if(s.catalogPdf){pdf.href=s.catalogPdf;pdf.style.display='flex';} else pdf.style.display='none'; }
  const soc={socWa:s.whatsapp,socIg:s.instagram,socLi:s.linkedin};
  Object.entries(soc).forEach(([id,url])=>{const e=document.getElementById(id); if(e&&url)e.href=url;});
  setHTML('menuPages',(D.pages||[]).map(p=>`<a href="#" onclick="openPage('${esc(p.slug)}');closeMenu();return false;">${esc(p.title)}</a>`).join(''));
  setHTML('filterMenu',[`<a class="${filterPid==null?'on':''}" onclick="setFilter(null)">Tümü</a>`]
    .concat(D.products.map(p=>`<a class="${String(filterPid)===String(p.id)?'on':''}" onclick="setFilter('${p.id}')">${esc(p.name)}</a>`)).join(''));
  const foot=document.getElementById('foot'); if(!foot)return;
  foot.innerHTML=`<div class="ftr"><div class="ftr-in">
    <div><div class="brand">${brandHTML}</div><p style="font-size:13.5px;line-height:1.7;margin:0">${esc((s.hero||{}).desc||'Adana açık hava reklam alanları.')}</p></div>
    <div><h5>KURUMSAL</h5><a onclick="goHome()">Katalog</a>${(D.pages||[]).map(p=>`<a onclick="openPage('${esc(p.slug)}')">${esc(p.title)}</a>`).join('')}</div>
    <div><h5>MECRALAR</h5><div class="meccols">${D.mecralar.map(m=>`<a onclick="openMec('${m.id}')">${esc(m.name)}</a>`).join('')}</div></div>
    <div><h5>İLETİŞİM</h5><div class="il">${s.phone?`<b>Tel:</b> ${esc(s.phone)}<br>`:''}${s.email?`<b>E-posta:</b> ${esc(s.email)}<br>`:''}${s.address?`<b>Adres:</b> ${esc(s.address)}`:''}</div></div>
    <div class="news"><h5>BÜLTEN</h5><input class="inp" id="nlMail" placeholder="E-posta adresiniz"><button class="abone" onclick="var e=document.getElementById('nlMail');if(e&&e.value){e.value='';this.textContent='✓ Teşekkürler';}">Abone Ol</button></div>
  </div><div class="ftr-bottom"><div class="inner">© ${new Date().getFullYear()} ${esc(s.logoText||'Medyapark')} · Tüm hakları saklıdır.</div></div></div>`;
}

function render(){ if(view.type==='home')renderHome(); else if(view.type==='mec')renderMec(); else renderPage(view.slug); window.scrollTo({top:0,behavior:'smooth'}); }
function goHome(){ view={type:'home'}; searchQ=''; const s=document.getElementById('search'); if(s)s.value=''; render(); }
function openMec(id){ view={type:'mec',id, tab:null, gsub:null, gidx:0}; calYear=new Date().getFullYear(); render(); }
function openMecTab(pid){ view.tab=pid; renderMec(); }
function gSub(s){ view.gsub=s; view.gidx=0; renderMec(); }
function gPick(i){ view.gidx=i; renderMec(); }
function gNav(d,len){ view.gidx=((view.gidx||0)+d+len)%len; renderMec(); }
function openPage(slug){ view={type:'page',slug}; render(); }
function onSearch(q){ searchQ=(q||''); view={type:'home'}; renderHome(); }
function toggleFilter(e){ e.stopPropagation(); document.getElementById('filterMenu').classList.toggle('open'); }
function setFilter(pid){ filterPid=pid; chrome(); view={type:'home'}; renderHome(); }

/* ---------- ANASAYFA ---------- */
function renderHome(){
  const q=searchQ.trim().toLowerCase();
  const list=D.mecralar.filter(m=>{
    const okQ=!q||m.name.toLowerCase().includes(q)||(m.units||[]).some(u=>(u.name||'').toLowerCase().includes(q));
    const okF=filterPid==null||(m.units||[]).some(u=>String(u.product_id)===String(filterPid));
    return okQ&&okF; });
  const h=D.settings.hero||{};
  const totUnits=D.mecralar.reduce((s,m)=>s+(m.units||[]).length,0);
  const cards=list.map(m=>{
    const rgb=hex2rgb(m.theme_color);
    const showGos=vis(m,'gosterim', !!(m.gunluk_gosterim||m.toplam_alan));
    const top=[m.badge, showGos?m.gunluk_gosterim:null, showGos?m.toplam_alan:null, !showGos?m.stats:null].filter(Boolean).map(esc).join('<br>');
    const cover=!!m.image;
    return `<a class="pcard ${cover?'cover':'txt'}" href="#" onclick="openMec('${m.id}');return false;" style="--tc-rgb:${rgb}">
      <div class="img" style="${cover?`background-image:url('${esc(m.image)}')`:''}"></div>
      ${cover?'<div class="scrim"></div>':''}
      ${cover?'':`<div class="ph"></div>`}
      <div class="top">${top}</div>
      <div class="bot"><h3>${esc(m.name)}</h3><span class="kf">Keşfet <span class="arw">›</span></span></div></a>`;}).join('');
  app().innerHTML=`<div class="wrap"><section class="hero">
    <span class="eyebrow">${esc(h.eyebrow||'')}</span>
    <div class="counters"><span><b>${D.mecralar.length}</b> Mecra</span><span><b>${totUnits}</b> Reklam Alanı</span><span><b>${D.products.length}</b> Ürün Tipi</span></div>
    <h1>${esc(h.title||'')}</h1><p>${esc(h.desc||'')}</p></section>
    <div class="grid3">${cards||'<p class="muted">Sonuç bulunamadı.</p>'}</div></div>`;
}

/* ---------- MECRA DETAY ---------- */
function renderMec(){
  const m=mec(view.id); if(!m)return goHome();
  const units=m.units||[];
  const pids=[]; units.forEach(u=>{ const k=String(u.product_id); if(!pids.includes(k))pids.push(k); });
  let selId=view.tab!=null?String(view.tab):(pids[0]||null);
  if(!pids.includes(selId)) selId=pids[0]||null;
  const selP=prod(selId);
  const uOfP=units.filter(u=>String(u.product_id)===String(selId));

  const cover=`<div class="cover-banner" style="${m.image?`background-image:url('${esc(m.image)}')`:''}">
    ${m.image?'<div class="cov-ov" style="background:linear-gradient(to top,rgba(0,0,0,.5),rgba(0,0,0,.1))"></div>':''}
    <div class="cov-inner"><h1 class="cov-title ${m.image?'light':'dark'}">${vis(m,'baslik',!!(m.baslik||m.name))?esc(m.baslik||m.name):esc(m.name)}</h1>
    <div class="cov-nav ${m.image?'light':'dark'}"><a onclick="goHome()">Katalog</a> › ${esc(m.name)}</div></div></div>`;

  const showLogo=vis(m,'logo', !!m.logo);
  const head=`<div class="sechead" style="display:flex;gap:16px;align-items:center">
    ${showLogo?`<img class="mlogo" src="${esc(m.logo)}" alt="logo">`:''}
    <div>${vis(m,'gosterim',!!(m.gunluk_gosterim||m.toplam_alan))?`<div class="counters" style="margin-bottom:4px">${m.gunluk_gosterim?`<span><b>${esc(m.gunluk_gosterim)}</b></span>`:''}${m.toplam_alan?`<span>${esc(m.toplam_alan)}</span>`:''}</div>`:''}
    ${vis(m,'aciklama',!!m.aciklama)?`<p style="margin:0">${esc(m.aciklama)}</p>`:''}</div></div>`;

  const tabs=pids.length>1?`<div class="mtabs">${pids.map(id=>{const p=prod(id);
    return `<button class="mtab ${id===String(selId)?'on':''}" onclick="openMecTab('${id}')">${esc(p.name||'')}</button>`;}).join('')}</div>`:'';

  /* Galeri / Yerleşim */
  const gal=Array.isArray(m.galeri)?m.galeri:[];
  const showGal=vis(m,'galeri', gal.length>0);
  const showYer=vis(m,'yerlesim', !!m.yerlesim_plani);
  const subs=[]; if(showGal)subs.push('galeri'); if(showYer)subs.push('yerlesim');
  let gsub=view.gsub; if(!subs.includes(gsub)) gsub=subs[0]||null;
  let galInner;
  if(gsub==='yerlesim'){ galInner=`<div class="gimg" style="background-image:url('${esc(m.yerlesim_plani)}');background-size:contain;background-repeat:no-repeat;background-color:#fff"></div>`; }
  else if(gsub==='galeri'){ const gidx=Math.min(view.gidx||0,Math.max(0,gal.length-1));
    galInner=`<div class="gimg" style="background-image:url('${esc(gal[gidx])}')"></div>
      ${gal.length>1?`<div class="gnav l" onclick="gNav(-1,${gal.length})">‹</div><div class="gnav r" onclick="gNav(1,${gal.length})">›</div>
      <div class="gdots">${gal.map((_,i)=>`<i class="${i===gidx?'on':''}" onclick="gPick(${i})"></i>`).join('')}</div>`:''}`; }
  else { galInner=`<div class="gimg">Görsel eklenmemiş</div>`; }
  const subtabsHTML=subs.length>1?`<div class="subtabs">${subs.map(s=>`<button class="${s===gsub?'on':''}" onclick="gSub('${s}')">${s==='galeri'?'Galeri':'Yerleşim Planı'}</button>`).join('')}</div>`:'';

  /* Sağ kolon: Maps + Avantajlar */
  const showMaps=vis(m,'maps', !!m.maps);
  const adv=(Array.isArray(m.avantajlar)?m.avantajlar:[]).slice(0,4);
  const advBlock = vis(m,'avantajlar',adv.length>0) ? `<div class="adv-grid">${adv.map(a=>`<div class="adv"><b>${esc(a.t||a.title||'')}</b><span>${esc(a.d||a.desc||'')}</span></div>`).join('')}</div>` : '';
  const sideCol=`<div class="side-col">${showMaps?`<div class="mapbox">${m.maps}</div>`:''}${advBlock}</div>`;

  /* Teknik özellikler */
  const specRows=[['Ürün',selP.name],['Ölçü',selP.olcu],['Yüzey',selP.yuzey],['Aydınlatma',selP.isikli],['Baskı Malzemesi',selP.baski_malzemesi],['Baskı Formatı',selP.baski_format],['Yayın Formatı',selP.yayin_format]]
    .filter(x=>x[1]&&x[1]!=='—').map(x=>`<div class="spec"><span class="k">${esc(x[0])}</span><span class="v">${esc(x[1])}</span></div>`).join('');
  const specAcc=specRows?`<details class="acc" open style="margin-top:26px"><summary>Teknik Özellikler</summary><div>${specRows}</div></details>`:'';

  const related=D.mecralar.filter(x=>x.id!==m.id);
  const relBlock=related.length?`<p class="related-h">Diğer Lokasyonlar</p><div class="rgrid">${related.map(x=>`<a class="rcard" href="#" onclick="openMec('${x.id}');return false;">${esc(x.name)}<span class="arw">›</span></a>`).join('')}</div>`:'';

  app().innerHTML=`${cover}<div class="wrap">
    ${head}${tabs}
    <div class="gm-row"><div class="galbox">${subtabsHTML?`<div style="position:absolute;top:12px;left:14px;right:14px;z-index:3">${subtabsHTML}</div>`:''}${galInner}</div>${sideCol}</div>
    ${specAcc}
    <div class="book" style="margin-top:30px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
        <h3 style="margin:0;font-size:19px;font-weight:600">Doluluk Durumu</h3>
        <div class="year-nav" style="margin:0"><button onclick="yearNav(-1)">‹</button><span class="yr">${calYear}</span><button onclick="yearNav(1)">›</button></div>
      </div>
      <p style="color:var(--ink2);font-size:14px;margin:0 0 14px">Müsait bir aya tıklayarak teklif sepetine ekleyin; ekibimiz size özel teklif hazırlasın.</p>
      <div style="overflow-x:auto">${matrixHTML(selP.name||'Pozisyon', uOfP)}</div>
    </div>
    ${relBlock}</div>`;
}

function matrixHTML(corner, units){
  const now=curYm();
  const head='<th class="unit">'+esc(corner)+'</th>'+MONTHS_LONG.map(x=>`<th>${esc(x.slice(0,3))}</th>`).join('');
  const rows=units.map(u=>{
    const map={}; (u.booked||[]).forEach(b=>map[b.ym]=b.status);
    const cells=MONTHS_LONG.map((_,i)=>{
      const ym=calYear+'-'+pad(i+1), st=map[ym], past=ym<now, sep=cart.some(c=>String(c.unitId)===String(u.id)&&c.ym===ym);
      let cls='mx', txt;
      if(sep){cls+=' sel';txt='Sepette';}
      else if(st==='dolu'){cls+=' dolu';txt='Dolu';}
      else if(st==='rezerve'){cls+=' rezerve';txt='Rezerve';}
      else if(past){cls+=' past';txt='—';}
      else {cls+=' bos';txt='Müsait';}
      const click=((!st&&!past)||sep)?`onclick="toggleMonth('${u.id}','${ym}')"`:'';
      return `<td><span class="${cls}" ${click}>${txt}</span></td>`;
    }).join('');
    return `<tr><td class="unit">${esc(u.name)}</td>${cells}</tr>`;
  }).join('');
  return `<table class="matrix wide"><thead><tr>${head}</tr></thead><tbody>${rows||'<tr><td class="unit" style="color:var(--ink3)">Ünite yok</td></tr>'}</tbody></table>`;
}
function yearNav(d){ calYear+=d; renderMec(); }
function toggleMonth(uid,ym){
  const m=mec(view.id); const u=(m.units||[]).find(x=>String(x.id)===String(uid)); if(!u)return; const p=prod(u.product_id);
  const i=cart.findIndex(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  if(i>-1){ cart.splice(i,1); }
  else{ const [y,mm]=ym.split('-');
    cart.push({unitId:u.id,mecra:m.name,unit:u.name,product:p.name,olcu:u.olcu||p.olcu||'',ym,
      monthLabel:MONTHS_LONG[+mm-1]+' '+y}); }
  badge(); renderCart(); renderMec();
}

function renderPage(slug){
  const pg=(D.pages||[]).find(p=>p.slug===slug)||{};
  let body=`<div class="page-body">${esc(pg.body)}</div>`;
  if(slug==='iletisim'){ const s=D.settings; body+=`<div style="max-width:420px;margin-top:20px">
    ${s.phone?`<div class="spec"><span class="k">Telefon</span><span class="v">${esc(s.phone)}</span></div>`:''}
    ${s.email?`<div class="spec"><span class="k">E-posta</span><span class="v">${esc(s.email)}</span></div>`:''}
    ${s.address?`<div class="spec"><span class="k">Adres</span><span class="v">${esc(s.address)}</span></div>`:''}</div>`; }
  app().innerHTML=`<div class="wrap"><div class="crumbs" style="margin-top:22px"><a href="#" onclick="goHome();return false;">Katalog</a> › <span>${esc(pg.title||'')}</span></div>
    <div class="sechead"><h1>${esc(pg.title||'')}</h1></div>${body}</div>`;
}

/* ---------- sepet ---------- */
function removeItem(i){ cart.splice(i,1); badge(); renderCart(); if(view.type==='mec')renderMec(); }
function badge(){ const b=document.getElementById('cbadge'); if(!b)return; if(cart.length){b.style.display='flex';b.textContent=cart.length;}else b.style.display='none'; }
function renderCart(){
  const b=document.getElementById('cartBody'), f=document.getElementById('cartFoot'); if(!b||!f)return;
  if(!cart.length){ b.innerHTML='<div class="empty">Sepetiniz boş.<br>Bir alanın doluluk tablosundan müsait ay(lar) seçin.</div>'; f.innerHTML=''; return; }
  b.innerHTML=cart.map((c,i)=>`<div class="citem"><button class="rm" onclick="removeItem(${i})">×</button>
    <div class="cl">${esc(c.unit)}</div><div class="cm">${esc(c.mecra)} · ${esc(c.product)}</div>
    <div class="cm">Dönem: ${esc(c.monthLabel)}</div></div>`).join('');
  f.innerHTML=`<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportPDF()">PDF</button><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportExcel()">Excel</button></div>
    <input class="inp" id="qName" placeholder="Ad Soyad" style="margin-bottom:8px">
    <input class="inp" id="qFirma" placeholder="Firma" style="margin-bottom:8px">
    <input class="inp" id="qTel" placeholder="Telefon" style="margin-bottom:8px">
    <input class="inp" id="qMail" placeholder="E-posta" style="margin-bottom:10px">
    <button class="btn btn-primary" style="width:100%" onclick="sendQuote()">Teklif Al</button>`;
}
function toggleCart(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); renderCart(); }
async function sendQuote(){
  if(!cart.length)return;
  const {data:q,error}=await sb.from('quotes').insert({customer_name:val('qName'),firma:val('qFirma'),telefon:val('qTel'),eposta:val('qMail')}).select('id').single();
  if(error){ alert('Gönderilemedi: '+error.message); return; }
  const items=cart.map(c=>({quote_id:q.id,unit_id:c.unitId,ym:c.ym,mecra_name:c.mecra,unit_name:c.unit,product_name:c.product,olcu:c.olcu,start_day:c.ym+'-01',period:c.monthLabel}));
  const {error:e2}=await sb.from('quote_items').insert(items);
  if(e2){ alert('Kalemler kaydedilemedi: '+e2.message); return; }
  cart=[]; badge(); if(view.type==='mec')renderMec();
  document.getElementById('cartBody').innerHTML='<div class="empty">✓ Talebiniz alındı.<br>Ekibimiz en kısa sürede size özel teklifle dönecek.</div>';
  document.getElementById('cartFoot').innerHTML='';
}
const val=id=>{const e=document.getElementById(id);return e?e.value:'';};

function exportExcel(){
  if(!cart.length)return;
  const head=['Lokasyon','Ünite','Ürün','Ölçü','Dönem (Ay)'];
  const rows=cart.map(c=>[c.mecra,c.unit,c.product,c.olcu,c.monthLabel]);
  const csv='\uFEFF'+[head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'teklif-talebi-medyapark.csv');
}
function exportPDF(){
  if(!cart.length)return; const s=D.settings;
  const rows=cart.map(c=>`<tr><td>${esc(c.mecra)}</td><td>${esc(c.unit)}</td><td>${esc(c.product)}</td><td>${esc(c.olcu)}</td><td>${esc(c.monthLabel)}</td></tr>`).join('');
  const w=window.open('','_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>Teklif Talebi</title><style>body{font-family:-apple-system,Inter,Arial;padding:40px;color:#25302b}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #eee;text-align:left}th{color:#6b746f;font-size:11px;text-transform:uppercase}</style></head><body>
    <h1>${esc(s.logoText||'Medyapark')} — Teklif Talebi</h1><p style="color:#6b746f">${new Date().toLocaleDateString('tr-TR')} · ${esc(s.phone||'')}</p>
    <table><thead><tr><th>Lokasyon</th><th>Ünite</th><th>Ürün</th><th>Ölçü</th><th>Dönem</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
  w.document.close(); setTimeout(()=>w.print(),300);
}
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);};
function toggleMenu(e){e.stopPropagation();document.getElementById('menu').classList.toggle('open');}
function closeMenu(){const m=document.getElementById('menu');if(m)m.classList.remove('open');const f=document.getElementById('filterMenu');if(f)f.classList.remove('open');}
document.addEventListener('click',closeMenu);
load();
