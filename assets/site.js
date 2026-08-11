const MONTHS_SHORT=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let D={settings:{},pages:[],products:[],mecralar:[]};
let view={type:'home'}, calYear=new Date().getFullYear(), cart=[];

const app=()=>document.getElementById('app');
const money=n=> typeof n==='number'? n.toLocaleString('tr-TR')+' ₺' : (n||'');
const pad=n=>String(n).padStart(2,'0');
const curYm=()=> new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const prod=id=>D.products.find(p=>String(p.id)===String(id))||{};
const mec=id=>D.mecralar.find(m=>String(m.id)===String(id));
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function perMonth(p){ const pr=p.prices||{}; if(typeof pr['1 Ay']==='number')return pr['1 Ay'];
  for(const v of Object.values(pr)){ if(typeof v==='number')return v; } return 0; }

async function load(){
  try{
    const [stg,pg,pr,mc,un,bk] = await Promise.all([
      sb.from('settings').select('k,v'),
      sb.from('pages').select('*').order('sort'),
      sb.from('products').select('*').order('sort'),
      sb.from('mecralar').select('*').order('sort'),
      sb.from('units').select('*').order('sort'),
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

function render(){ if(view.type==='home')renderHome(); else if(view.type==='mec')renderMec(); else if(view.type==='unit')renderUnit(); else renderPage(view.slug); window.scrollTo({top:0,behavior:'smooth'}); }
function goHome(){ view={type:'home'}; const s=document.getElementById('search'); if(s)s.value=''; render(); }
function openMec(id){ view={type:'mec',id}; render(); }
function openUnit(id){ view={type:'unit',mecId:view.id,id}; calYear=new Date().getFullYear(); render(); }
function openPage(slug){ view={type:'page',slug}; render(); }
function onSearch(q){ view={type:'home'}; renderHome(q); }

function renderHome(q){
  q=(q||'').trim().toLowerCase();
  const list=D.mecralar.filter(m=>!q||m.name.toLowerCase().includes(q)||(m.units||[]).some(u=>u.name.toLowerCase().includes(q)));
  const h=D.settings.hero||{};
  const tiles=list.map(m=>{
    const bg=m.image?`background-image:url('${esc(m.image)}')`:`background:linear-gradient(140deg,${esc(m.theme_color)}2e,${esc(m.theme_color)}0d)`;
    return `<a class="tile" href="#" onclick="openMec('${m.id}');return false;">
      <div class="media" style="${bg}">${m.badge?`<span class="badge">${esc(m.badge)}</span>`:''}</div>
      <div class="body"><h3>${esc(m.name)}</h3><p class="tsub">${esc(m.stats)}</p>
      <span class="cta">Keşfet <span class="arw">›</span></span></div></a>`;}).join('');
  app().innerHTML=`<section class="hero"><span class="eyebrow">${esc(h.eyebrow||'')}</span>
    <h1>${esc(h.title||'')}</h1><p>${esc(h.desc||'')}</p></section>
    <div class="grid">${tiles||'<p class="muted">Sonuç yok.</p>'}</div>`;
}
function renderMec(){
  const m=mec(view.id); if(!m)return goHome();
  const tiles=(m.units||[]).map(u=>{ const p=prod(u.product_id);
    const bg=u.image?`background-image:url('${esc(u.image)}')`:`background:linear-gradient(140deg,${esc(m.theme_color)}2e,${esc(m.theme_color)}0d)`;
    return `<a class="tile" href="#" onclick="openUnit('${u.id}');return false;">
      <div class="media" style="${bg}"><span class="badge">${esc(p.name||'Ürün')}</span></div>
      <div class="body"><h3>${esc(u.name)}</h3><p class="tsub">${esc(p.name||'')}${u.olcu?' · '+esc(u.olcu):''}</p>
      <span class="cta">Takvim & detay <span class="arw">›</span></span></div></a>`;}).join('');
  app().innerHTML=`<div class="crumbs"><a href="#" onclick="goHome();return false;">Katalog</a> › <span>${esc(m.name)}</span></div>
    <div class="sechead"><h1>${esc(m.name)}</h1><p>${esc(m.aciklama)}</p></div>
    <div class="grid">${tiles||'<p class="muted">Ünite yok.</p>'}</div>`;
}
function renderUnit(){
  const m=mec(view.mecId), u=(m.units||[]).find(x=>String(x.id)===String(view.id)); if(!u)return renderMec();
  const p=prod(u.product_id), olcu=u.olcu||p.olcu||'';
  const specs=[['Ürün',p.name],['Ölçü',olcu],['Yüzey',p.yuzey],['Aydınlatma',p.isikli],['Baskı Malzemesi',p.baski_malzemesi],['Baskı Formatı',p.baski_format],['Yayın Formatı',p.yayin_format],['Baskı Ücreti',p.baski_ucreti],['Montaj Ücreti',p.montaj_ucreti]]
    .filter(x=>x[1]&&x[1]!=='—').map(x=>`<div class="spec"><span class="k">${esc(x[0])}</span><span class="v">${esc(x[1])}</span></div>`).join('');
  const prices=Object.entries(p.prices||{}).map(([k,vv])=>`<div class="priceitem"><span class="muted">${esc(k)}</span><span class="amt">${money(vv)}</span></div>`).join('');
  const bg=u.image?`background-image:url('${esc(u.image)}')`:`background:linear-gradient(140deg,${esc(m.theme_color)}2e,${esc(m.theme_color)}0d)`;
  app().innerHTML=`<div class="crumbs"><a href="#" onclick="goHome();return false;">Katalog</a> › <a href="#" onclick="openMec('${m.id}');return false;">${esc(m.name)}</a> › <span>${esc(u.name)}</span></div>
    <div class="sechead"><h1>${esc(u.name)}</h1></div>
    <div class="u-grid">
      <div><div class="u-media" style="${bg}"></div>
        <div class="panel-b"><h4 style="margin:0 0 6px">Teknik Özellikler</h4>${specs}</div>
        <div class="panel-b"><h4 style="margin:0 0 6px">Fiyatlar</h4>${prices}
          <p class="muted" style="font-size:12.5px;margin:12px 0 0">Belediye vergi/harç dahil, dijital baskı hariç · KDV hariç.</p></div>
      </div>
      <div><div class="book"><h4 style="margin:0 0 4px">Yıllık Doluluk Takvimi</h4>
        <p class="muted" style="font-size:13px;margin:0 0 14px">Boş bir aya tıklayarak teklif sepetine ekleyin (aylık: <b>${money(perMonth(p))}</b>).</p>
        <div id="calBox">${yearHTML(u)}</div></div></div>
    </div>
    <p class="related-h">Diğer Lokasyonlar</p>
    <div class="related">${D.mecralar.filter(x=>x.id!==m.id).map(x=>`<a class="rcard" href="#" onclick="openMec('${x.id}');return false;">${esc(x.name)}<span class="arw">›</span></a>`).join('')}</div>`;
}
function yearHTML(u){
  const map={}; (u.booked||[]).forEach(b=>map[b.ym]=b.status);
  const inCart=ym=>cart.some(c=>String(c.unitId)===String(u.id)&&c.ym===ym);
  const now=curYm();
  const cells=MONTHS_SHORT.map((mo,i)=>{
    const ym=calYear+'-'+pad(i+1), st=map[ym], past=ym<now, sep=inCart(ym);
    let cls='ycell'; if(sep)cls+=' sepette'; else if(st)cls+=' '+st; else cls+=' bos';
    if(past&&!st&&!sep)cls+=' past';
    const clickable=!st&&!past;
    return `<div class="${cls}" ${clickable?`onclick="toggleMonth('${u.id}','${ym}')"`:''}>
      <span class="ml">${mo}</span><span class="ms">${sep?'Sepette':(st==='dolu'?'Dolu':st==='rezerve'?'Rezerve':(past?'—':'Boş'))}</span></div>`;
  }).join('');
  return `<div class="year-nav"><button onclick="yearNav(-1)">‹</button><span class="yr">${calYear}</span><button onclick="yearNav(1)">›</button></div>
    <div class="year-grid">${cells}</div>
    <div class="cal-legend"><span><i class="lg-bos"></i>Boş</span><span><i class="lg-dolu"></i>Dolu</span><span><i class="lg-rez"></i>Rezerve</span><span><i class="lg-sel"></i>Sepette</span></div>`;
}
function yearNav(d){ calYear+=d; renderUnit(); }
function toggleMonth(uid,ym){
  const m=mec(view.mecId), u=(m.units).find(x=>String(x.id)===String(uid)), p=prod(u.product_id);
  const i=cart.findIndex(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  if(i>-1){ cart.splice(i,1); }
  else{ const [y,mm]=ym.split('-'); const price=perMonth(p);
    cart.push({unitId:Number(uid),mecra:m.name,unit:u.name,product:p.name,olcu:u.olcu||p.olcu||'',ym,
      monthLabel:MONTHS_LONG[+mm-1]+' '+y, price, priceLabel:money(price)}); }
  badge(); renderCart(); renderUnit();
}

function renderPage(slug){
  const pg=(D.pages||[]).find(p=>p.slug===slug)||{};
  let body=`<div class="page-body">${esc(pg.body)}</div>`;
  if(slug==='iletisim'){ const s=D.settings; body+=`<div class="panel-b" style="max-width:420px">
    <div class="spec"><span class="k">Telefon</span><span class="v">${esc(s.phone)}</span></div>
    <div class="spec"><span class="k">E-posta</span><span class="v">${esc(s.email)}</span></div>
    <div class="spec"><span class="k">Adres</span><span class="v">${esc(s.address)}</span></div></div>`; }
  app().innerHTML=`<div class="crumbs"><a href="#" onclick="goHome();return false;">Katalog</a> › <span>${esc(pg.title||'')}</span></div>
    <div class="sechead"><h1>${esc(pg.title||'')}</h1></div>${body}`;
}

/* ---- sepet ---- */
function removeItem(i){ cart.splice(i,1); badge(); renderCart(); if(view.type==='unit')renderUnit(); }
function badge(){ const b=document.getElementById('cbadge'); if(cart.length){b.style.display='flex';b.textContent=cart.length;}else b.style.display='none'; }
const cartTotal=()=>cart.reduce((s,c)=>s+(c.price||0),0);
function renderCart(){
  const b=document.getElementById('cartBody'), f=document.getElementById('cartFoot');
  if(!cart.length){ b.innerHTML='<div class="empty">Sepetiniz boş.<br>Bir alanın yıllık takviminden boş ay(lar) seçin.</div>'; f.innerHTML=''; return; }
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
