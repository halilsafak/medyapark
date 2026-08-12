/* ============ MEDYAPARK — ÖN YÜZ (wireframe) ============ */
const MONTHS_SHORT=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let D={settings:{},pages:[],products:[],mecralar:[]};
let view={type:'home'}, calYear=new Date().getFullYear(), cart=[];

const app=()=>document.getElementById('app');
const money=n=>{const x=Number(n);return isFinite(x)&&n!==''&&n!=null?x.toLocaleString('tr-TR')+' ₺':(n||'');};
const pad=n=>String(n).padStart(2,'0');
const curYm=()=> new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const prod=id=>D.products.find(p=>String(p.id)===String(id))||{};
const mec=id=>D.mecralar.find(m=>String(m.id)===String(id));
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* İçerik varsa VE visible[key] açıkça false değilse göster */
const vis=(m,key,has)=> !!has && ((m.visible&&m.visible[key])!==false);
function perMonth(p){ const pr=p.prices||{}; if(typeof pr['1 Ay']==='number')return pr['1 Ay'];
  for(const v of Object.values(pr)){ if(typeof v==='number')return v; } return 0; }

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

  const s=D.settings||{};
  const brandHTML = s.logoImage ? `<img src="${esc(s.logoImage)}" alt="logo" style="height:26px;display:block">` : logo(s.logoText);
  document.getElementById('brand').innerHTML = brandHTML;
  document.getElementById('footBrand').innerHTML = brandHTML;
  if(s.phone){ const p=document.getElementById('footPhone'); p.textContent=s.phone; p.href='tel:'+String(s.phone).replace(/\s/g,''); }
  if(s.email){ const e=document.getElementById('footMail'); e.textContent=s.email; e.href='mailto:'+s.email; }
  if(s.catalogPdf){ const b=document.getElementById('pdfBtn'); b.href=s.catalogPdf; b.style.display='flex'; }
  render();
}
function logo(t){ t=t||'medyapark'; return String(t).toLowerCase().startsWith('medya')?('medya<span>'+esc(String(t).slice(5))+'</span>'):esc(t); }

function render(){ if(view.type==='home')renderHome(); else if(view.type==='mec')renderMec(); else renderPage(view.slug); window.scrollTo({top:0,behavior:'smooth'}); }
function goHome(){ view={type:'home'}; const s=document.getElementById('search'); if(s)s.value=''; render(); }
function openMec(id){ view={type:'mec',id, tab:null, gsub:null, gidx:0}; calYear=new Date().getFullYear(); render(); }
function openMecTab(pid){ view.tab=pid; renderMec(); }
function gSub(s){ view.gsub=s; view.gidx=0; renderMec(); }
function gPick(i){ view.gidx=i; renderMec(); }
function openPage(slug){ view={type:'page',slug}; render(); }
function onSearch(q){ view={type:'home'}; renderHome(q); }

/* ---------- ANASAYFA ---------- */
function renderHome(q){
  q=(q||'').trim().toLowerCase();
  const list=D.mecralar.filter(m=>!q||m.name.toLowerCase().includes(q)||(m.units||[]).some(u=>u.name.toLowerCase().includes(q)));
  const h=D.settings.hero||{};
  const tiles=list.map(m=>{
    const bg=m.image?`background-image:url('${esc(m.image)}')`:`background:linear-gradient(140deg,${esc(m.theme_color||'#3f6f63')}2e,${esc(m.theme_color||'#3f6f63')}0d)`;
    const showGos=vis(m,'gosterim', !!(m.gunluk_gosterim||m.toplam_alan));
    const stat=showGos ? [m.gunluk_gosterim,m.toplam_alan].filter(Boolean).map(esc).join('<br>') : esc(m.stats||'');
    return `<a class="tile" href="#" onclick="openMec('${m.id}');return false;">
      <div class="media" style="${bg}">${m.badge?`<span class="badge">${esc(m.badge)}</span>`:''}</div>
      <div class="body"><h3>${esc(m.name)}</h3><p class="tsub">${stat}</p>
      <span class="cta">Keşfet <span class="arw">›</span></span></div></a>`;}).join('');
  app().innerHTML=`<section class="hero"><span class="eyebrow">${esc(h.eyebrow||'')}</span>
    <h1>${esc(h.title||'')}</h1><p>${esc(h.desc||'')}</p></section>
    <div class="grid">${tiles||'<p class="muted">Sonuç yok.</p>'}</div>`;
}

/* ---------- MECRA DETAY (tek sayfa) ---------- */
function renderMec(){
  const m=mec(view.id); if(!m)return goHome();
  const units=m.units||[];
  const pids=[]; units.forEach(u=>{ const k=String(u.product_id); if(!pids.includes(k))pids.push(k); });
  let selId=view.tab!=null?String(view.tab):(pids[0]||null);
  if(!pids.includes(selId)) selId=pids[0]||null;
  const selP=prod(selId);
  const uOfP=units.filter(u=>String(u.product_id)===String(selId));
  const short=(m.name||'').split(' ')[0];

  const tabs=pids.map(id=>{const p=prod(id);
    return `<button class="mtab ${id===String(selId)?'on':''}" onclick="openMecTab('${id}')">${esc(p.name||'')}</button>`;}).join('');

  /* Galeri / Yerleşim — görünürlüğe saygı */
  const gal=Array.isArray(m.galeri)?m.galeri:[];
  const showGal=vis(m,'galeri', gal.length>0);
  const showYer=vis(m,'yerlesim', !!m.yerlesim_plani);
  const subs=[]; if(showGal)subs.push('galeri'); if(showYer)subs.push('yerlesim');
  let gsub=view.gsub; if(!subs.includes(gsub)) gsub=subs[0]||null;
  let media;
  if(gsub==='yerlesim'){ media=`<div class="gmain" style="background-image:url('${esc(m.yerlesim_plani)}')"></div>`; }
  else if(gsub==='galeri'){ const gidx=Math.min(view.gidx||0,Math.max(0,gal.length-1));
    media=`<div class="gmain" style="background-image:url('${esc(gal[gidx])}')"></div>
      ${gal.length>1?`<div class="gthumbs">${gal.map((g,i)=>`<div class="gth ${i===gidx?'on':''}" style="background-image:url('${esc(g)}')" onclick="gPick(${i})"></div>`).join('')}</div>`:''}`; }
  else { media=`<div class="gmain muted">Görsel eklenmemiş</div>`; }
  const subtabsHTML=subs.length>1?`<div class="subtabs">${subs.map(s=>`<button class="${s===gsub?'on':''}" onclick="gSub('${s}')">${s==='galeri'?'Galeri':'Yerleşim Planı'}</button>`).join('')}</div>`:'';
  const galBlock=`<div class="panel-b" style="padding:14px">${subtabsHTML}${media}</div>`;

  /* Maps + Avantajlar */
  const showMaps=vis(m,'maps', !!m.maps);
  const mapsBlock = showMaps ? `<div class="mapbox">${m.maps}</div>` : '';
  const adv=(Array.isArray(m.avantajlar)?m.avantajlar:[]).slice(0,4);
  const advBlock = vis(m,'avantajlar',adv.length>0) ? `<div class="adv-grid">${adv.map(a=>`<div class="adv"><b>${esc(a.t||a.title||'')}</b><span>${esc(a.d||a.desc||'')}</span></div>`).join('')}</div>` : '';
  const rightCol = (mapsBlock||advBlock) ? `<div>${mapsBlock}${advBlock}</div>` : '<div></div>';

  /* Fiyatlar + Teknik açılırlar */
  const prices=Object.entries(selP.prices||{});
  const priceAcc=`<details class="acc" open><summary>Fiyatlar</summary><div>${prices.map(([k,v])=>`<div class="priceitem"><span class="muted">${esc(k)}</span><span class="amt">${money(v)}</span></div>`).join('')||'<p class="muted">—</p>'}
    <p class="muted" style="font-size:12px;margin-top:8px">Belediye vergi/harç dahil, dijital baskı hariç · KDV hariç.</p></div></details>`;
  const specRows=[['Ürün',selP.name],['Ölçü',selP.olcu],['Yüzey',selP.yuzey],['Aydınlatma',selP.isikli],['Baskı Malzemesi',selP.baski_malzemesi],['Baskı Formatı',selP.baski_format],['Yayın Formatı',selP.yayin_format],['Baskı Ücreti',selP.baski_ucreti],['Montaj Ücreti',selP.montaj_ucreti]]
    .filter(x=>x[1]&&x[1]!=='—').map(x=>`<div class="spec"><span class="k">${esc(x[0])}</span><span class="v">${esc(x[1])}</span></div>`).join('');
  const specAcc=`<details class="acc"><summary>Teknik Özellikler</summary><div>${specRows||'<p class="muted">—</p>'}</div></details>`;

  const showLogo=vis(m,'logo', !!m.logo);
  const logoBlock = showLogo ? `<img class="mlogo" src="${esc(m.logo)}" alt="logo">` : '';
  const baslik = vis(m,'baslik',!!(m.baslik||m.name))?`<h1>${esc(m.baslik||m.name)}</h1>`:'';
  const aciklama = vis(m,'aciklama',!!m.aciklama)?`<p class="muted" style="max-width:760px">${esc(m.aciklama)}</p>`:'';

  const related=D.mecralar.filter(x=>x.id!==m.id).map(x=>`<a class="rcard" href="#" onclick="openMec('${x.id}');return false;">${esc(x.name)}<span class="arw">›</span></a>`).join('');

  app().innerHTML=`
    <div class="crumbs"><a href="#" onclick="goHome();return false;">Katalog</a> › <span>${esc(m.name)}</span></div>
    <div class="sechead" style="align-items:center;gap:14px">${logoBlock}<div>${baslik}${aciklama}</div></div>
    ${tabs?`<div class="mtabs">${tabs}</div>`:''}
    <div class="u-grid">${galBlock}${rightCol}</div>
    <div style="margin-top:14px">${priceAcc}${specAcc}</div>
    <div class="book" style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0">${esc(m.name)} — Doluluk Durumu</h4>
        <div class="year-nav" style="margin:0"><button onclick="yearNav(-1)">‹</button><span class="yr">${calYear}</span><button onclick="yearNav(1)">›</button></div>
      </div>
      <p class="muted" style="font-size:13px;margin:0 0 12px">Müsait bir aya tıklayarak teklif sepetine ekleyin (aylık: <b>${money(perMonth(selP))}</b>).</p>
      <div style="overflow-x:auto">${matrixHTML(selP.name||'Pozisyon', uOfP)}</div>
    </div>
    ${related?`<p class="related-h">Diğer Lokasyonlar</p><div class="related">${related}</div>`:''}`;
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
      const click=(!st&&!past)?`onclick="toggleMonth('${u.id}','${ym}')"`:'';
      return `<td><span class="${cls}" ${click}>${txt}</span></td>`;
    }).join('');
    return `<tr><td class="unit">${esc(u.name)}</td>${cells}</tr>`;
  }).join('');
  return `<table class="matrix wide"><thead><tr>${head}</tr></thead><tbody>${rows||'<tr><td class="unit muted">Ünite yok</td></tr>'}</tbody></table>`;
}
function yearNav(d){ calYear+=d; renderMec(); }
function toggleMonth(uid,ym){
  const m=mec(view.id); const u=(m.units||[]).find(x=>String(x.id)===String(uid)); if(!u)return; const p=prod(u.product_id);
  const i=cart.findIndex(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  if(i>-1){ cart.splice(i,1); }
  else{ const [y,mm]=ym.split('-'); const price=perMonth(p);
    cart.push({unitId:u.id,mecra:m.name,unit:u.name,product:p.name,olcu:u.olcu||p.olcu||'',ym,
      monthLabel:MONTHS_LONG[+mm-1]+' '+y, price, priceLabel:money(price)}); }
  badge(); renderCart(); renderMec();
}

function renderPage(slug){
  const pg=(D.pages||[]).find(p=>p.slug===slug)||{};
  let body=`<div class="page-body">${esc(pg.body)}</div>`;
  if(slug==='iletisim'){ const s=D.settings; body+=`<div class="panel-b" style="max-width:420px;margin-top:16px;padding:16px">
    <div class="spec"><span class="k">Telefon</span><span class="v">${esc(s.phone)}</span></div>
    <div class="spec"><span class="k">E-posta</span><span class="v">${esc(s.email)}</span></div>
    <div class="spec"><span class="k">Adres</span><span class="v">${esc(s.address)}</span></div></div>`; }
  app().innerHTML=`<div class="crumbs"><a href="#" onclick="goHome();return false;">Katalog</a> › <span>${esc(pg.title||'')}</span></div>
    <div class="sechead"><h1>${esc(pg.title||'')}</h1></div>${body}`;
}

/* ---------- sepet ---------- */
function removeItem(i){ cart.splice(i,1); badge(); renderCart(); if(view.type==='mec')renderMec(); }
function badge(){ const b=document.getElementById('cbadge'); if(cart.length){b.style.display='flex';b.textContent=cart.length;}else b.style.display='none'; }
const cartTotal=()=>cart.reduce((s,c)=>s+(c.price||0),0);
function renderCart(){
  const b=document.getElementById('cartBody'), f=document.getElementById('cartFoot');
  if(!cart.length){ b.innerHTML='<div class="empty">Sepetiniz boş.<br>Bir alanın doluluk matrisinden müsait ay(lar) seçin.</div>'; f.innerHTML=''; return; }
  b.innerHTML=cart.map((c,i)=>`<div class="citem"><button class="rm" onclick="removeItem(${i})">×</button>
    <div class="cl">${esc(c.unit)}</div><div class="cm">${esc(c.mecra)} · ${esc(c.product)}</div>
    <div class="cm">Dönem: ${esc(c.monthLabel)}</div><div class="camt">${c.priceLabel}</div></div>`).join('');
  f.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:12px"><span>Tahmini toplam</span><b>${money(cartTotal())}</b></div>
    <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportPDF()">PDF</button><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportExcel()">Excel</button></div>
    <input class="inp" id="qName" placeholder="Ad Soyad" style="margin-bottom:8px">
    <input class="inp" id="qFirma" placeholder="Firma" style="margin-bottom:8px">
    <input class="inp" id="qTel" placeholder="Telefon" style="margin-bottom:8px">
    <input class="inp" id="qMail" placeholder="E-posta" style="margin-bottom:10px">
    <button class="btn btn-primary" style="width:100%" onclick="sendQuote()">Teklif Gönder</button>`;
}
function toggleCart(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); renderCart(); }
async function sendQuote(){
  if(!cart.length)return;
  const total=cartTotal();
  const {data:q,error}=await sb.from('quotes').insert({customer_name:val('qName'),firma:val('qFirma'),telefon:val('qTel'),eposta:val('qMail'),total}).select('id').single();
  if(error){ alert('Gönderilemedi: '+error.message); return; }
  const items=cart.map(c=>({quote_id:q.id,unit_id:c.unitId,ym:c.ym,mecra_name:c.mecra,unit_name:c.unit,product_name:c.product,olcu:c.olcu,start_day:c.ym+'-01',period:c.monthLabel,price:c.price}));
  const {error:e2}=await sb.from('quote_items').insert(items);
  if(e2){ alert('Kalemler kaydedilemedi: '+e2.message); return; }
  cart=[]; badge();
  document.getElementById('cartBody').innerHTML='<div class="empty">✓ Teklifiniz alındı.<br>Ekibimiz en kısa sürede iletişime geçecek.</div>';
  document.getElementById('cartFoot').innerHTML='';
}
const val=id=>{const e=document.getElementById(id);return e?e.value:'';};

function exportExcel(){
  if(!cart.length)return;
  const head=['Lokasyon','Ünite','Ürün','Ölçü','Dönem (Ay)','Fiyat'];
  const rows=cart.map(c=>[c.mecra,c.unit,c.product,c.olcu,c.monthLabel,c.priceLabel]);
  rows.push(['','','','','TOPLAM',money(cartTotal())]);
  const csv='\uFEFF'+[head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'teklif-medyapark.csv');
}
function exportPDF(){
  if(!cart.length)return; const s=D.settings;
  const rows=cart.map(c=>`<tr><td>${esc(c.mecra)}</td><td>${esc(c.unit)}</td><td>${esc(c.product)}</td><td>${esc(c.olcu)}</td><td>${esc(c.monthLabel)}</td><td style="text-align:right">${c.priceLabel}</td></tr>`).join('');
  const w=window.open('','_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>Teklif</title><style>body{font-family:-apple-system,Inter,Arial;padding:40px;color:#25302b}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #eee;text-align:left}th{color:#6b746f;font-size:11px;text-transform:uppercase}tfoot td{font-weight:700;border-top:2px solid #25302b}</style></head><body>
    <h1>${esc(s.logoText||'Medyapark')} — Teklif Listesi</h1><p style="color:#6b746f">${new Date().toLocaleDateString('tr-TR')} · ${esc(s.phone||'')}</p>
    <table><thead><tr><th>Lokasyon</th><th>Ünite</th><th>Ürün</th><th>Ölçü</th><th>Dönem</th><th style="text-align:right">Fiyat</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="5">TOPLAM</td><td style="text-align:right">${money(cartTotal())}</td></tr></tfoot></table></body></html>`);
  w.document.close(); setTimeout(()=>w.print(),300);
}
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);};
function toggleMenu(e){e.stopPropagation();document.getElementById('menu').classList.toggle('open');}
function closeMenu(){document.getElementById('menu').classList.remove('open');}
document.addEventListener('click',closeMenu);
load();
