const MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let D={settings:{},pages:[],products:[],mecralar:[],altById:{}};
let view={type:'home',filter:null}, roll=0, cart=[];

const app=()=>document.getElementById('app');
const money=n=> typeof n==='number'? n.toLocaleString('tr-TR')+' ₺' : (n||'');
const pad=n=>String(n).padStart(2,'0');
const curYm=()=> new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const prod=id=>D.products.find(p=>String(p.id)===String(id))||{};
const mec=id=>D.mecralar.find(m=>String(m.id)===String(id));
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const vis=(o,key,has)=> ((o.visible&&o.visible[key])!==false) && has;
function perMonth(p){ const pr=p.prices||{}; if(typeof pr['1 Ay']==='number')return pr['1 Ay']; for(const v of Object.values(pr)){ if(typeof v==='number')return v; } return 0; }
function hexToRgb(h){ if(!h)return '63,111,99'; h=String(h).replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join(''); if(h.length!==6)return '63,111,99'; const n=parseInt(h,16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`; }
function gcard(onclick,title,sub,image,theme,label){ const rgb=hexToRgb(theme); const bg=image?`background-image:url('${esc(image)}')`:'';
  return `<a class="tile" href="#" onclick="${onclick};return false;" style="--tc-rgb:${rgb}">
    <div class="bg" style="${bg}"></div><div class="ov"></div>
    <div class="ct"><h3>${esc(title)}</h3>${sub?`<p class="tsub">${esc(sub)}</p>`:''}
      <div class="xp"><b>${esc(label||'Keşfet')}</b><span class="arw">→</span></div></div></a>`; }

async function load(){
  try{
    const [stg,pg,pr,mc,al,un,bk] = await Promise.all([
      sb.from('settings').select('k,v'), sb.from('pages').select('*').order('sort'),
      sb.from('products').select('*').order('sort'), sb.from('mecralar').select('*').order('sort'),
      sb.from('alt_mecralar').select('*').order('sort').order('id'),
      sb.from('units').select('*').order('sort').order('id'), sb.from('bookings').select('unit_id,ym,status')
    ]);
    const err=[stg,pg,pr,mc,al,un,bk].map(x=>x.error).find(Boolean); if(err) throw err;
    const settings={}; (stg.data||[]).forEach(r=>settings[r.k]=r.v);
    const products=pr.data||[]; const prodOf=id=>products.find(p=>String(p.id)===String(id))||{};
    const bmap={}; (bk.data||[]).forEach(b=>{(bmap[b.unit_id]=bmap[b.unit_id]||[]).push({ym:b.ym,status:b.status});});
    const uByAlt={}; (un.data||[]).forEach(u=>{u.booked=bmap[u.id]||[]; if(u.alt_mecra_id!=null)(uByAlt[u.alt_mecra_id]=uByAlt[u.alt_mecra_id]||[]).push(u);});
    const altById={}, altByMec={};
    (al.data||[]).forEach(a=>{ a.units=uByAlt[a.id]||[]; a.product=prodOf(a.product_id); altById[a.id]=a; (altByMec[a.mecra_id]=altByMec[a.mecra_id]||[]).push(a); });
    const mecralar=(mc.data||[]).map(m=>({...m, alts:altByMec[m.id]||[]}));
    D={settings, pages:pg.data||[], products, mecralar, altById};
  }catch(e){ app().innerHTML='<div class="loading">Veri yüklenemedi: '+esc(e.message||e)+'</div>'; return; }
  const s=D.settings||{};
  document.getElementById('brand').innerHTML = s.logoImage?`<img src="${esc(s.logoImage)}" style="height:30px">`:logo(s.logoText);
  if(s.catalogPdf){ const b=document.getElementById('pdfBtn'); b.href=s.catalogPdf; b.style.display='flex'; }
  buildFilter(); renderFooter(); render();
}
function logo(t){ t=t||'medyapark'; return String(t).toLowerCase().startsWith('medya')?('medya<span>'+esc(String(t).slice(5))+'</span>'):esc(t); }

function render(){ if(view.type==='home')renderHome(); else if(view.type==='mec')renderMec(); else if(view.type==='alt')renderAlt(); else renderPage(view.slug); badge(); window.scrollTo({top:0,behavior:'smooth'}); }
function goHome(){ view={type:'home',filter:view.filter||null}; const s=document.getElementById('search'); if(s)s.value=''; render(); }
function openMec(id){ view={type:'mec',id}; render(); }
function openAlt(mecId,altId){ view={type:'alt',mecId,altId,gidx:0}; roll=0; render(); }
function gPick(i){ view.gidx=i; renderAlt(); }
function gMove(d){ const a=D.altById[view.altId]; const n=(a&&Array.isArray(a.galeri)?a.galeri.length:0)||1; view.gidx=((view.gidx||0)+d+n)%n; renderAlt(); }
function openPage(slug){ view={type:'page',slug}; render(); }
function onSearch(q){ if(view.type!=='home')view={type:'home',filter:view.filter}; renderHome(q); }

/* ---- filtre (ürün türüne göre) ---- */
function buildFilter(){ const m=document.getElementById('filterMenu');
  m.innerHTML=`<a class="${!view.filter?'on':''}" onclick="setFilter(null)">Tümü</a>`+D.products.map(p=>`<a class="${String(view.filter)===String(p.id)?'on':''}" onclick="setFilter('${p.id}')">${esc(p.name)}</a>`).join(''); }
function toggleFilter(e){ e.stopPropagation(); document.getElementById('filterMenu').classList.toggle('open'); }
function setFilter(pid){ view.filter=pid; buildFilter(); document.getElementById('filterMenu').classList.remove('open'); view.type='home'; renderHome(); }

/* ---- ANASAYFA ---- */
function renderHome(q){
  q=(q||'').trim().toLowerCase();
  let list=D.mecralar.slice();
  if(view.filter) list=list.filter(m=>(m.alts||[]).some(a=>String(a.product_id)===String(view.filter)));
  if(q) list=list.filter(m=>m.name.toLowerCase().includes(q)||(m.alts||[]).some(a=>a.name.toLowerCase().includes(q)||(a.product&&a.product.name||'').toLowerCase().includes(q)));
  const h=D.settings.hero||{};
  const cards=list.map(m=>{ const sub=[m.gunluk_gosterim,m.toplam_alan].filter(Boolean).join(' · ');
    return gcard(`openMec('${m.id}')`, m.name, sub, m.image, m.theme_color, 'Keşfet');}).join('');
  app().innerHTML=`<section class="hero"><span class="eyebrow">${esc(h.eyebrow||'')}</span><h1>${esc(h.title||'')}</h1><p>${esc(h.desc||'')}</p></section>
    <div class="grid3">${cards||'<p class="muted">Sonuç yok.</p>'}</div>`;
}

/* ---- MECRA → ALT MECRALAR ---- */
function renderMec(){
  const m=mec(view.id); if(!m)return goHome();
  const cards=(m.alts||[]).map(a=>{ const p=a.product||{}; const n=(a.units||[]).length;
    const sub=[`${n} pozisyon`, a.toplam_alan].filter(Boolean).join(' · ');
    return gcard(`openAlt('${m.id}','${a.id}')`, (p.name||a.name), sub, (a.image||m.image), m.theme_color, 'Keşfet');}).join('');
  app().innerHTML=`${banner(m.kapak)}
    <div class="crumbs">Medyapark Adana / Mecralar / ${esc(m.name)}</div>
    <div class="grid3">${cards||'<p class="muted">Bu mecrada alt mecra yok.</p>'}</div>`;
}
function banner(img){ return img?`<div class="cover-banner" style="background-image:url('${esc(img)}')"></div>`
  :`<div class="cover-banner"><div class="t">KAPAK GÖRSELİ</div><div class="s">1920×400px</div></div>`; }

/* ---- ALT DETAY ---- */
function rollMonths(){ const b=new Date(); b.setDate(1); b.setMonth(b.getMonth()+roll*12);
  const arr=[]; for(let i=0;i<12;i++){ const d=new Date(b.getFullYear(),b.getMonth()+i,1); arr.push({ym:d.getFullYear()+'-'+pad(d.getMonth()+1),label:MONTHS_LONG[d.getMonth()],y:d.getFullYear()}); } return arr; }

function renderAlt(){
  const m=mec(view.mecId); if(!m)return goHome();
  const alts=m.alts||[]; const alt=alts.find(a=>String(a.id)===String(view.altId))||alts[0]; if(!alt)return renderMec();
  const p=alt.product||{}; const uList=alt.units||[];

  // galeri
  const gal=Array.isArray(alt.galeri)?alt.galeri:[]; const gi=Math.min(view.gidx||0,Math.max(0,gal.length-1));
  const galInner = gal.length?`<div class="gimg" style="background-image:url('${esc(gal[gi])}')"></div>
    ${gal.length>1?`<div class="gnav l" onclick="gMove(-1)">‹</div><div class="gnav r" onclick="gMove(1)">›</div><div class="gdots">${gal.map((_,i)=>`<i class="${i===gi?'on':''}"></i>`).join('')}</div>`:''}`
    :`<div class="gimg">GALERİ / SLIDER</div>`;
  const mapsInner = vis(alt,'maps',!!alt.maps)?alt.maps:`Google Maps`;

  // marquee
  const mq=alt.marquee||'';
  const marquee = mq?`<div class="marquee"><div class="track">${[0,1].map(()=>mq.split('*').map(x=>`<span>${esc(x.trim())}</span>`).join('')).join('')}</div></div>`:'';

  // rezervasyon tablosu
  const months=rollMonths(); const now=curYm();
  const yr = months[0].y + (months[11].y!==months[0].y?('-'+months[11].y):'');
  const head='<th class="u">ÜNİTELER</th>'+months.map(mo=>`<th>${mo.label}</th>`).join('');
  const rows=uList.map(u=>{ const mp={}; (u.booked||[]).forEach(b=>mp[b.ym]=b.status);
    const cells=months.map(mo=>{ const st=mp[mo.ym], sel=cart.some(c=>String(c.unitId)===String(u.id)&&c.ym===mo.ym), past=mo.ym<now;
      let cls='cell',txt='';
      if(sel){cls+=' sel lbl';txt='Sepette';}
      else if(st==='dolu'){cls+=' dolu';} else if(st==='rezerve'){cls+=' rezerve';}
      else if(past){cls+=' past';} else {cls+=' bos';}
      const click=(!st&&!past)?`onclick="pick('${u.id}','${mo.ym}')"`:(sel?`onclick="pick('${u.id}','${mo.ym}')"`:'');
      return `<td><span class="${cls}" ${click}>${txt}</span></td>`; }).join('');
    return `<tr><td class="u">${esc(u.name)}</td>${cells}</tr>`; }).join('');
  const table=`<div class="restable"><div class="rh"><div><span class="t">Rezervasyon Tablosu</span> &nbsp;<span class="flow">Ünite Seç › Sepete Ekle › Teklif Al</span></div><div style="display:flex;align-items:center;gap:10px"><span class="yr">${yr}</span><div class="nav"><button onclick="rollNav(-1)">‹</button><button onclick="rollNav(1)">›</button></div></div></div>
    <div class="rtwrap"><table class="rt"><thead><tr>${head}</tr></thead><tbody>${rows||'<tr><td class="u muted">Pozisyon yok</td></tr>'}</tbody></table></div>
    <div class="cal-legend" style="margin:10px 4px 4px"><span><i class="lg-bos"></i>Müsait</span><span><i class="lg-dolu"></i>Dolu</span><span><i class="lg-rez"></i>Rezerve</span><span><i class="lg-sel"></i>Sepette</span></div></div>`;

  // yan panel
  const prices=Object.entries(p.prices||{});
  const specRows=[['Ürün',p.name],['Ölçü',p.olcu],['Yüzey',p.yuzey],['Aydınlatma',p.isikli],['Baskı Malzemesi',p.baski_malzemesi],['Baskı Formatı',p.baski_format],['Yayın Formatı',p.yayin_format]].filter(x=>x[1]&&x[1]!=='—').map(x=>`<div class="spec"><span class="k">${esc(x[0])}</span><span class="v">${esc(x[1])}</span></div>`).join('');
  const side=`<div class="side-col">
    <details class="acc" open><summary>Teknik Özellikler</summary><div>${specRows||'<p class="muted">—</p>'}</div></details>
    <details class="acc" open><summary>Fiyatlar</summary><div>${prices.map(([k,v])=>`<div class="priceitem"><span class="muted">${esc(k)}</span><span class="amt">${money(v)}</span></div>`).join('')||'<p class="muted">—</p>'}<p class="muted" style="font-size:12px;margin-top:8px">Belediye vergi dahil, dijital baskı hariç · KDV hariç.</p></div></details>
    <div class="sepetbox"><h4>Sepet</h4><div id="sepetInner"></div></div></div>`;

  // ilgili
  const rel=[];
  alts.filter(a=>a.id!==alt.id).forEach(a=>{const pp=a.product||{};rel.push({onclick:`openAlt('${m.id}','${a.id}')`,title:(pp.name||a.name),sub:[`${(a.units||[]).length} pozisyon`,a.toplam_alan].filter(Boolean).join(' · '),image:(a.image||m.image),theme:m.theme_color});});
  D.mecralar.filter(x=>x.id!==m.id).forEach(x=>rel.push({onclick:`openMec('${x.id}')`,title:x.name,sub:(x.gunluk_gosterim||''),image:x.image,theme:x.theme_color}));
  const relCards=rel.map(r=>`<div class="carslide">${gcard(r.onclick,r.title,r.sub,r.image,r.theme,'Keşfet')}</div>`).join('');

  app().innerHTML=`${banner(alt.kapak||m.kapak)}
    <div class="crumbs">Medyapark Adana / Mecralar / ${esc(m.name)} / ${esc(p.name||alt.name)}</div>
    <div class="gm-row"><div class="galbox">${galInner}</div><div class="mapbox">${mapsInner}</div></div>
    ${marquee}
    <div class="res-row"><div>${table}</div>${side}</div>
    <div class="related-h">Diğer Mecralara Göz Atın</div>
    <div class="carousel"><div class="cnav l" onclick="carScroll(-1)">‹</div><div class="cartrack" id="cartrack">${relCards}</div><div class="cnav r" onclick="carScroll(1)">›</div></div>`;
  renderSepetInline();
}
function rollNav(d){ roll+=d; renderAlt(); }
function carScroll(d){ const t=document.getElementById('cartrack'); if(t)t.scrollBy({left:d*340,behavior:'smooth'}); }
function pick(uid,ym){ toggleMonth(uid,ym); }
function toggleMonth(uid,ym){
  const alt=D.altById[view.altId]; if(!alt)return; const m=mec(view.mecId);
  const u=(alt.units||[]).find(x=>String(x.id)===String(uid)); if(!u)return; const p=alt.product||{};
  const i=cart.findIndex(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  if(i>-1){ cart.splice(i,1); }
  else{ const [y,mm]=ym.split('-'); const price=perMonth(p);
    cart.push({unitId:Number(uid),mecra:m.name,alt:alt.name,unit:u.name,product:p.name,olcu:u.olcu||p.olcu||'',ym,monthLabel:MONTHS_LONG[+mm-1]+' '+y,price,priceLabel:money(price)}); }
  badge(); renderCart(); renderAlt();
}

function renderSepetInline(){
  const box=document.getElementById('sepetInner'); if(!box)return;
  if(!cart.length){ box.innerHTML='<div class="empty2">Sepetiniz boş. Tablodan müsait ay(lar) seçtikçe liste güncellenir.</div>'; return; }
  box.innerHTML=cart.map((c,i)=>`<div class="si-item"><div><b>${esc(c.unit)}</b> · ${esc(c.monthLabel)}<br><span class="muted" style="font-size:11px">${esc(c.mecra)} · ${esc(c.product)}</span></div><div style="text-align:right;white-space:nowrap">${c.priceLabel}<br><span class="x" onclick="removeItem(${i})">kaldır ×</span></div></div>`).join('')
    +`<div class="tot"><span>Toplam</span><span>${money(cartTotal())}</span></div><button class="btn btn-primary" style="width:100%" onclick="toggleCart()">Teklif Al</button>`;
}

/* ---- sayfalar ---- */
function renderPage(slug){
  const pg=(D.pages||[]).find(p=>p.slug===slug)||{}; let body=`<div class="page-body">${esc(pg.body)}</div>`;
  if(slug==='iletisim'){ const s=D.settings; body+=`<div style="margin-top:16px;font-size:15px;line-height:1.9"><b>Telefon:</b> ${esc(s.phone)}<br><b>E-Posta:</b> ${esc(s.email)}<br><b>Adres:</b> ${esc(s.address)}</div>`; }
  app().innerHTML=`<div class="crumbs" style="margin-top:26px">Medyapark Adana / ${esc(pg.title||'')}</div><div class="sechead"><h1>${esc(pg.title||'')}</h1></div>${body}`;
}

/* ---- sepet çekmecesi ---- */
function removeItem(i){ cart.splice(i,1); badge(); renderCart(); if(view.type==='alt')renderAlt(); }
function badge(){ const b=document.getElementById('cbadge'); if(!b)return; if(cart.length){b.style.display='flex';b.textContent=cart.length;}else b.style.display='none'; }
const cartTotal=()=>cart.reduce((s,c)=>s+(c.price||0),0);
function renderCart(){
  const b=document.getElementById('cartBody'), f=document.getElementById('cartFoot'); if(!b)return;
  if(!cart.length){ b.innerHTML='<div class="empty">Sepetiniz boş.<br>Bir alanın rezervasyon tablosundan müsait ay(lar) seçin.</div>'; f.innerHTML=''; return; }
  b.innerHTML=cart.map((c,i)=>`<div class="citem"><span class="rm" onclick="removeItem(${i})">×</span><div class="cl">${esc(c.unit)}</div><div class="cm">${esc(c.mecra)}${c.alt?' · '+esc(c.alt):''} · ${esc(c.product)}</div><div class="cm">Dönem: ${esc(c.monthLabel)}</div><div class="camt">${c.priceLabel}</div></div>`).join('');
  f.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:12px"><span>Tahmini toplam</span><b>${money(cartTotal())}</b></div>
    <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportPDF()">PDF</button><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportExcel()">Excel</button></div>
    <input class="inp" id="qName" placeholder="Ad Soyad" style="margin-bottom:8px"><input class="inp" id="qFirma" placeholder="Firma" style="margin-bottom:8px">
    <input class="inp" id="qTel" placeholder="Telefon" style="margin-bottom:8px"><input class="inp" id="qMail" placeholder="E-posta" style="margin-bottom:10px">
    <button class="btn btn-primary" style="width:100%" onclick="sendQuote()">Teklif Gönder</button>`;
}
function toggleCart(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); renderCart(); }
async function sendQuote(){
  if(!cart.length)return; const total=cartTotal();
  const {data:q,error}=await sb.from('quotes').insert({customer_name:val('qName'),firma:val('qFirma'),telefon:val('qTel'),eposta:val('qMail'),total}).select('id').single();
  if(error){ alert('Gönderilemedi: '+error.message); return; }
  const items=cart.map(c=>({quote_id:q.id,unit_id:c.unitId,ym:c.ym,mecra_name:(c.mecra+(c.alt?' / '+c.alt:'')),unit_name:c.unit,product_name:c.product,olcu:c.olcu,start_day:c.ym+'-01',period:c.monthLabel,price:c.price}));
  const {error:e2}=await sb.from('quote_items').insert(items); if(e2){ alert('Kalemler kaydedilemedi: '+e2.message); return; }
  cart=[]; badge(); document.getElementById('cartBody').innerHTML='<div class="empty">✓ Teklifiniz alındı.<br>Ekibimiz en kısa sürede iletişime geçecek.</div>'; document.getElementById('cartFoot').innerHTML=''; if(view.type==='alt')renderAlt();
}
const val=id=>{const e=document.getElementById(id);return e?e.value:'';};
function exportExcel(){ if(!cart.length)return; const head=['Lokasyon','Alt Mecra','Ünite','Ürün','Dönem','Fiyat'];
  const rows=cart.map(c=>[c.mecra,c.alt||'',c.unit,c.product,c.monthLabel,c.priceLabel]); rows.push(['','','','','TOPLAM',money(cartTotal())]);
  const csv='\uFEFF'+[head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n'); dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'teklif-medyapark.csv'); }
function exportPDF(){ if(!cart.length)return; const s=D.settings;
  const rows=cart.map(c=>`<tr><td>${esc(c.mecra)}${c.alt?' / '+esc(c.alt):''}</td><td>${esc(c.unit)}</td><td>${esc(c.product)}</td><td>${esc(c.monthLabel)}</td><td style="text-align:right">${c.priceLabel}</td></tr>`).join('');
  const w=window.open('','_blank'); w.document.write(`<html><head><meta charset="utf-8"><title>Teklif</title><style>body{font-family:-apple-system,Arial;padding:40px;color:#1d1d1f}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #eee;text-align:left}tfoot td{font-weight:700;border-top:2px solid #1d1d1f}</style></head><body><h1>${esc(s.logoText||'Medyapark')} — Teklif</h1><p style="color:#6e6e73">${new Date().toLocaleDateString('tr-TR')} · ${esc(s.phone||'')}</p><table><thead><tr><th>Lokasyon</th><th>Ünite</th><th>Ürün</th><th>Dönem</th><th style="text-align:right">Fiyat</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4">TOPLAM</td><td style="text-align:right">${money(cartTotal())}</td></tr></tfoot></table></body></html>`); w.document.close(); setTimeout(()=>w.print(),300); }
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);};

/* ---- footer ---- */
function renderFooter(){ const s=D.settings||{};
  const mecLinks=D.mecralar.map(m=>`<a onclick="openMec('${m.id}')">${esc(m.name)}</a>`).join('');
  const pdf=s.catalogPdf?`<a href="${esc(s.catalogPdf)}" download>PDF Katalog</a>`:`<a onclick="goHome()">PDF Katalog</a>`;
  document.getElementById('foot').innerHTML=`<div class="ftr"><div class="ftr-in">
    <div><div class="brand">${logo(s.logoText)}</div><p style="font-size:13px;color:#8a8a90;max-width:24ch">Adana açık hava reklam çözümleri.</p></div>
    <div><h5>SAYFALAR</h5><a onclick="openPage('biz-kimiz')">Biz Kimiz</a><a onclick="openPage('neler-yapiyoruz')">Neler Yapıyoruz</a>${pdf}<a onclick="openPage('referanslar')">Referanslar</a><a onclick="openPage('iletisim')">İletişim</a></div>
    <div><h5>MECRALARIMIZ</h5><div class="meccols">${mecLinks}</div></div>
    <div><h5>İLETİŞİM</h5><div class="il"><b>Adres:</b> ${esc(s.address||'')}<br><br><b>Telefon:</b> ${esc(s.phone||'')}<br><br><b>E-Posta:</b> ${esc(s.email||'')}<br><br>${esc(s.socials||'')}</div></div>
    <div class="news"><h5 style="text-align:center">Kampanya ve yeniliklerden<br>haberdar olmak için;</h5><input class="inp" placeholder="E-Posta"><button class="abone" onclick="alert('Teşekkürler! Kaydınız alındı.')">Abone Ol</button></div>
  </div><div class="ftr-bottom">Tüm hakları saklıdır. Polat Medya Tanıtım Paz. Org. San. ve Tic. Ltd. Şti.</div></div>`;
}

function toggleMenu(e){e.stopPropagation();document.getElementById('menu').classList.toggle('open');}
function closeMenu(){document.getElementById('menu').classList.remove('open');document.getElementById('filterMenu')?.classList.remove('open');}
document.addEventListener('click',closeMenu);
load();
