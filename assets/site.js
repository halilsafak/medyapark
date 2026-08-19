const MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let D={settings:{},pages:[],products:[],mecralar:[],altById:{}};
let view={type:'home',filter:null}, roll=0, cart=[];
let galImgs=[], galIdx=0, galTimer=null;

const app=()=>document.getElementById('app');
const money=n=> typeof n==='number'? n.toLocaleString('tr-TR')+' ₺' : (n||'');
const pad=n=>String(n).padStart(2,'0');
const curYm=()=> new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const prod=id=>D.products.find(p=>String(p.id)===String(id))||{};
const mec=id=>D.mecralar.find(m=>String(m.id)===String(id));
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* Görünürlük: 'both' | 'desktop' | 'mobile' | 'off'  (eski true/false ile uyumlu) */
function visMode(o,key){ const v=o&&o.visible&&o.visible[key];
  if(v===undefined||v===null||v===true) return 'both';
  if(v===false) return 'off';
  return ['both','desktop','mobile','off'].includes(v)?v:'both'; }
const vis=(o,key,has)=> !!has && visMode(o,key)!=='off';
/* bölüme eklenecek sınıf: masaüstü/mobil kısıtı */
function visCls(o,key){ const m=visMode(o,key); return m==='desktop'?' only-desk':(m==='mobile'?' only-mob':''); }
/* Arka plan görseli: mobil sürümü varsa iki katman (gizli katmanın görseli indirilmez) */
function bgLayers(desk,mob,cls,style){
  cls=cls||''; style=style||'';
  if(mob&&mob!==desk) return `<div class="${cls} only-desk" style="${style}${desk?`background-image:url('${esc(desk)}')`:''}"></div>`+
                             `<div class="${cls} only-mob" style="${style}${`background-image:url('${esc(mob)}')`}"></div>`;
  return `<div class="${cls}" style="${style}${desk?`background-image:url('${esc(desk)}')`:''}"></div>`; }
/* <img> için mobil sürüm */
function picture(desk,mob,cls,alt){
  if(mob&&mob!==desk) return `<picture><source media="(max-width:760px)" srcset="${esc(mob)}"><img class="${cls||''}" src="${esc(desk)}" alt="${esc(alt||'')}" loading="lazy"></picture>`;
  return `<img class="${cls||''}" src="${esc(desk)}" alt="${esc(alt||'')}" loading="lazy">`; }
function perMonth(p){ const pr=p.prices||{}; if(typeof pr['1 Ay']==='number')return pr['1 Ay']; for(const v of Object.values(pr)){ if(typeof v==='number')return v; } return 0; }
function hexToRgb(h){ if(!h)return '63,111,99'; h=String(h).replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join(''); if(h.length!==6)return '63,111,99'; const n=parseInt(h,16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`; }
function gcard(onclick,title,sub,image,theme,label,imageM,href){ const rgb=hexToRgb(theme);
  return `<a class="tile" href="${esc(href||'#')}" onclick="${onclick};return false;" style="--tc-rgb:${rgb}">
    ${bgLayers(image,imageM,'bg','')}<div class="ov"></div>
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
  document.getElementById('brand').innerHTML = s.logoImage?`<img class="brandimg" src="${esc(s.logoImage)}" alt="logo">`:logo(s.logoText);
  if(s.seoTitle) document.title=s.seoTitle; if(s.seoDesc){ const md=document.getElementById('metaDesc'); if(md)md.setAttribute('content',s.seoDesc); }
  if(s.catalogPdf){ const b=document.getElementById('pdfBtn'); b.href=s.catalogPdf; b.style.display='flex'; }
  buildFilter(); renderFooter(); renderMenu(); initAnalytics();
  view=pathToView(location.pathname);
  render(); pushRoute(true);
}
function logo(t){ t=t||'medyapark'; return String(t).toLowerCase().startsWith('medya')?('medya<span>'+esc(String(t).slice(5))+'</span>'):esc(t); }

function render(fromHistory){
  if(view.type==='home')renderHome(); else if(view.type==='mec')renderMec();
  else if(view.type==='alt')renderAlt(); else if(view.type==='map')renderMap();
  else renderPage(view.slug);
  badge();
  if(!fromHistory) pushRoute();
  else setMeta();
  window.scrollTo({top:0,behavior:'smooth'}); }
function goHome(){ view={type:'home',filter:view.filter||null}; const s=document.getElementById('search'); if(s)s.value=''; render(); }
function openMec(id){ view={type:'mec',id}; render(); }
function openAlt(mecId,altId){ view={type:'alt',mecId,altId,gidx:0}; roll=0; render(); }
function gPick(i){ view.gidx=i; renderAlt(); }
function gMove(d){ const a=D.altById[view.altId]; const n=(a&&Array.isArray(a.galeri)?a.galeri.length:0)||1; view.gidx=((view.gidx||0)+d+n)%n; renderAlt(); }
function openPage(slug){ view={type:'page',slug}; render(); }
function onSearch(q){ if(view.type==='map'){ mapQuery=q||''; refreshPins(); return; }
  if(view.type!=='home')view={type:'home',filter:view.filter}; renderHome(q); }

/* ---- filtre (ürün türüne göre) ---- */
function buildFilter(){ const m=document.getElementById('filterMenu');
  m.innerHTML=`<a class="${!view.filter?'on':''}" onclick="setFilter(null)">Tümü</a>`+D.products.map(p=>`<a class="${String(view.filter)===String(p.id)?'on':''}" onclick="setFilter('${p.id}')">${esc(p.name)}</a>`).join(''); }
function toggleFilter(e){ e.stopPropagation(); document.getElementById('filterMenu').classList.toggle('open'); }
function setFilter(pid){ view.filter=pid; buildFilter(); document.getElementById('filterMenu').classList.remove('open');
  if(view.type==='map'){ refreshPins(); return; }
  view.type='home'; renderHome(); }

function animateCounters(){ document.querySelectorAll('.cnt').forEach(el=>{ const to=+el.dataset.to,dur=1200,t0=performance.now();
  (function step(t){ const p=Math.min(1,(t-t0)/dur); el.textContent=Math.floor(p*to).toLocaleString('tr-TR'); if(p<1)requestAnimationFrame(step); })(t0); }); }


function galRender(){ const img=document.getElementById('galImg'); if(!img)return; img.style.backgroundImage=galImgs.length?`url('${galImgs[galIdx]}')`:''; if(galImgs.length)img.textContent=''; const dots=document.getElementById('galDots'); if(dots)[...dots.children].forEach((d,i)=>d.classList.toggle('on',i===galIdx)); }
function galGo(d){ if(galImgs.length<2)return; galIdx=(galIdx+d+galImgs.length)%galImgs.length; galRender(); resetGalTimer(); }
function galSet(i){ galIdx=i; galRender(); resetGalTimer(); }
function resetGalTimer(){ clearInterval(galTimer); if(galImgs.length>1) galTimer=setInterval(()=>{ if(view.type!=='alt'){clearInterval(galTimer);return;} galIdx=(galIdx+1)%galImgs.length; galRender(); },3000); }
function banner(obj,title,navHTML){ obj=obj||{}; const img=obj.kapak, imgM=obj.kapak_mobil;
  const h=(obj.kapak_height||600); const rgb=hexToRgb(obj.kapak_color||'#101014');
  const op=(obj.kapak_opacity!=null&&obj.kapak_opacity!==''?obj.kapak_opacity:0.4);
  const cls=img?'light':'dark';
  const layers=(img||imgM)?bgLayers(img,imgM,'cov-bg',''):'';
  const ov=img?`<div class="cov-ov" style="background:rgba(${rgb},${op})"></div>`:'';
  const ph=img?'':`<div class="cov-ph">KAPAK GÖRSELİ · ${h}px</div>`;
  return `<div class="cover-banner" style="height:${h}px">${layers}${ph}${ov}<div class="cov-inner"><nav class="cov-nav ${cls}" aria-label="Sayfa yolu">${navHTML||''}</nav></div></div>`; }
const showPrices=()=> (D.settings||{}).showPrices!==false;
/* Kapak altı: başlık + açıklama */
function introBlock(o,bare){ o=o||{};
  const t=o.intro_baslik||'', d=o.aciklama||'';
  if(!vis(o,'aciklama',!!(t||d))) return '';
  const inner=`${t?`<h1>${esc(t)}</h1>`:''}${d?`<p>${esc(d)}</p>`:''}`;
  return `<section class="intro${bare?' bare':''}${visCls(o,'aciklama')}">${inner}</section>`; }
function altPrices(alt,p){ const f=alt&&alt.fiyat; if(f&&f.baz!=null&&f.baz!==''){ const baz=+f.baz; const per=(mon,ind)=>Math.round(baz*mon*(1-(+ind||0)/100)); const rows=[]; if(f.hafta!=null&&f.hafta!=='')rows.push(['Haftalık',Math.round(+f.hafta)]); rows.push(['1 Ay',Math.round(baz)]); rows.push(['3 Ay',per(3,f.ind3)]); rows.push(['6 Ay',per(6,f.ind6)]); rows.push(['1 Yıl',per(12,f.ind12)]); return rows; } return Object.entries((p&&p.prices)||{}); }
function altPerMonth(alt,p){ const f=alt&&alt.fiyat; if(f&&f.baz!=null&&f.baz!=='')return Math.round(+f.baz); return perMonth(p); }


/* ================= ADRES YÖNETİMİ (temiz linkler) ================= */
/* Sitenin kök dizini script yolundan otomatik bulunur (alt klasörde de çalışır) */
const BASE=(function(){
  const p=location.pathname;
  const m=p.match(/^(.*?)\/(?:mecra|sayfa|harita)(?:\/|$)/);
  return m ? m[1]+'/' : p.replace(/[^\/]*$/,'');
})();

function slugify(t){ return String(t||'').toLocaleLowerCase('tr')
  .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'sayfa'; }
const mSlug=m=>(m&&m.slug)||slugify(m&&m.name);
const aSlug=a=>(a&&a.slug)||slugify((a&&a.product&&a.product.name)||(a&&a.name));

/* görünüm -> adres */
function viewPath(v){
  v=v||view;
  if(v.type==='mec'){ const m=mec(v.id); return m?`mecra/${mSlug(m)}`:''; }
  if(v.type==='alt'){ const m=mec(v.mecId), a=(D.altById||{})[v.altId];
    return (m&&a)?`mecra/${mSlug(m)}/${aSlug(a)}`:''; }
  if(v.type==='map') return 'harita';
  if(v.type==='page') return `sayfa/${v.slug}`;
  return '';
}
/* adres -> görünüm */
function pathToView(pathname){
  let p=decodeURIComponent(pathname||'');
  if(p.startsWith(BASE)) p=p.slice(BASE.length);
  p=p.replace(/^\/+|\/+$/g,'').replace(/\.html$/,'');
  if(!p) return {type:'home'};
  const seg=p.split('/');
  if(seg[0]==='harita') return {type:'map'};
  if(seg[0]==='sayfa'&&seg[1]) return {type:'page',slug:seg[1]};
  if(seg[0]==='mecra'&&seg[1]){
    const m=D.mecralar.find(x=>mSlug(x)===seg[1]);
    if(!m) return {type:'home'};
    if(seg[2]){ const a=(m.alts||[]).find(x=>aSlug(x)===seg[2]);
      if(a) return {type:'alt',mecId:m.id,altId:a.id,gidx:0}; }
    return {type:'mec',id:m.id};
  }
  return {type:'home'};
}
function pushRoute(replace){
  try{
    const url=BASE+viewPath();
    if(location.pathname!==url) history[replace?'replaceState':'pushState']({v:view},'',url);
  }catch(e){ /* file:// veya kısıtlı ortam — adres güncellenemese de site çalışır */ }
  try{ setMeta(); }catch(e){}
  gaPage();
}
window.addEventListener('popstate',()=>{ view=pathToView(location.pathname); render(true); });

/* ================= SAYFA BAŞLIĞI / META ================= */
function setMeta(){
  const st=D.settings||{}, site=st.logoText||'Medyapark Adana';
  let t=st.seoTitle||site, d=st.seoDesc||'', img=st.logoImage||'';
  if(view.type==='mec'){ const m=mec(view.id);
    if(m){ t=`${m.name} Reklam Alanları — ${site}`;
      d=(m.aciklama||'').slice(0,155)|| `${m.name} lokasyonundaki açık hava reklam alanları, pozisyonlar ve doluluk durumu.`;
      img=m.kapak||m.image||img; } }
  else if(view.type==='alt'){ const m=mec(view.mecId), a=(D.altById||{})[view.altId];
    if(m&&a){ const pn=(a.product&&a.product.name)||a.name;
      t=`${m.name} ${pn} — ${site}`;
      d=(a.aciklama||'').slice(0,155)|| `${m.name} ${pn} reklam alanları: ölçü, teknik özellik ve aylık doluluk durumu.`;
      img=a.image||a.kapak||m.image||img; } }
  else if(view.type==='map'){ t=`Reklam Alanları Haritası — ${site}`; d='Adana genelindeki tüm açık hava reklam alanlarımızı harita üzerinde inceleyin.'; }
  else if(view.type==='page'){ const pg=(D.pages||[]).find(p=>p.slug===view.slug);
    if(pg){ t=`${pg.title} — ${site}`; d=String(pg.body||'').replace(/<[^>]*>/g,'').slice(0,155); } }
  document.title=t;
  const setTag=(sel,attr,val)=>{ let el=document.head.querySelector(sel);
    if(!el){ el=document.createElement('meta');
      if(sel.includes('property')) el.setAttribute('property',sel.match(/"([^"]+)"/)[1]);
      else el.setAttribute('name',sel.match(/"([^"]+)"/)[1]);
      document.head.appendChild(el); }
    el.setAttribute(attr,val||''); };
  setTag('meta[name="description"]','content',d);
  setTag('meta[property="og:title"]','content',t);
  setTag('meta[property="og:description"]','content',d);
  setTag('meta[property="og:type"]','content','website');
  setTag('meta[property="og:image"]','content',img);
  setTag('meta[property="og:url"]','content',location.origin+BASE+viewPath());
  setTag('meta[name="twitter:card"]','content','summary_large_image');
  let cn=document.head.querySelector('link[rel="canonical"]');
  if(!cn){ cn=document.createElement('link'); cn.rel='canonical'; document.head.appendChild(cn); }
  cn.href=location.origin+BASE+viewPath();
}

/* ---- ANASAYFA ---- */
function renderHome(q){
  q=(q||'').trim().toLowerCase();
  let list=D.mecralar.slice();
  if(view.filter) list=list.filter(m=>(m.alts||[]).some(a=>String(a.product_id)===String(view.filter)));
  if(q) list=list.filter(m=>m.name.toLowerCase().includes(q)||(m.alts||[]).some(a=>a.name.toLowerCase().includes(q)||(a.product&&a.product.name||'').toLowerCase().includes(q)));
  const h=D.settings.hero||{};
  const cards=list.map(m=>{ const sub=[m.gunluk_gosterim,m.toplam_alan].filter(Boolean).join(' · ');
    return gcard(`openMec('${m.id}')`, m.name, sub, m.image, m.theme_color, 'Keşfet', m.image_mobil, BASE+'mecra/'+mSlug(m));}).join('');
  /* karşılama bölümü yalnızca filtresiz/aramasız anasayfada */
  const hero2=(!q && !view.filter) ? heroBlock() : '';
  /* karşılama bölümü varsa katalog başlığı sade olsun (başlık/sayaç tekrarı olmasın) */
  const katalog = hero2
    ? `<section class="hero compact" id="katalog"><h2>Reklam Alanlarımız</h2>${h.desc?`<p>${esc(h.desc)}</p>`:''}</section>`
    : `<section class="hero" id="katalog"><div class="counters"><span><b class="cnt" data-to="250">0</b>+ Reklam Alanı</span><span><b class="cnt" data-to="1000">0</b>+ Müşteri</span><span><b class="cnt" data-to="36">0</b>+ Yıllık Tecrübe</span></div><h1>${esc(h.title||'')}</h1><p>${esc(h.desc||'')}</p></section>`;
  app().innerHTML=`${hero2}${katalog}
    <div class="grid3">${cards||'<p class="muted">Sonuç yok.</p>'}</div>`;
  animateCounters();
  if(hero2) heroInit();
}

/* ================= KARŞILAMA BÖLÜMÜ ================= */
function heroBlock(){
  const H=(D.settings||{}).hero2||{};
  if(H.enabled===false) return '';
  const board=H.board||'', boardM=H.boardMobil||'';
  if(!board && !(H.cards||[]).length && !H.title) return '';   /* içerik yoksa hiç basma */
  const kartlar=(H.cards||[]).filter(c=>c&&c.img).slice(0,4).map((c,i)=>{
    const m=c.mecraId?mec(c.mecraId):null;
    const href=m?BASE+'mecra/'+mSlug(m):'';
    const tag=m?`onclick="openMec('${m.id}');return false;"`:'onclick="heroScroll();return false;"';
    return `<a class="h2-ph p${i+1}" href="${esc(href||'#')}" ${tag} style="--d:${i*0.9}">
      ${bgLayers(c.img,c.imgMobil,'h2-ph-i','')}
      ${c.label?`<span class="h2-ph-l">${esc(c.label)}</span>`:''}</a>`;}).join('');
  const rozet=(H.stats||[]).filter(x=>x&&(x.n||x.l)).map(x=>
    `<div class="h2-st"><b>${esc(x.n||'')}</b><span>${esc(x.l||'')}</span></div>`).join('');
  return `<section class="hero2" id="hero2">
    <div class="h2-top">
      <h1>${esc(H.title||'Adana Açık Hava Reklam Mecralarını Keşfedin')}</h1>
      ${H.sub?`<p>${esc(H.sub)}</p>`:''}
      <button class="h2-btn" onclick="heroScroll()">${esc(H.btn||'Başla')}<span class="h2-ar">↓</span></button>
    </div>
    <div class="h2-stage">
      ${kartlar}
      <div class="h2-board-wrap"><div class="h2-board">
        ${board||boardM?bgLayers(board,boardM,'h2-board-i',''):'<div class="h2-board-i ph">Pano görseli</div>'}
        <div class="h2-board-glare"></div></div>
        <div class="h2-pole"></div></div>
    </div>
    ${rozet?`<div class="h2-stats">${rozet}</div>`:''}
  </section>`;
}
function heroScroll(){
  const t=document.getElementById('katalog');
  if(!t)return;
  const y=t.getBoundingClientRect().top+window.scrollY-70;
  window.scrollTo({top:y,behavior:'smooth'});
}
function heroInit(){
  const sec=document.getElementById('hero2'); if(!sec)return;
  const az=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(az||window.innerWidth<=760) return;      /* mobilde ve hareket azaltmada efekt yok */
  let raf=null;
  sec.addEventListener('mousemove',e=>{
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      const r=sec.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-0.5, y=(e.clientY-r.top)/r.height-0.5;
      sec.style.setProperty('--mx',x.toFixed(3));
      sec.style.setProperty('--my',y.toFixed(3));
      raf=null;
    });
  });
  sec.addEventListener('mouseleave',()=>{ sec.style.setProperty('--mx',0); sec.style.setProperty('--my',0); });
}

function renderMec(){
  const m=mec(view.id); if(!m)return goHome();
  const alts=m.alts||[];
  /* tek alt mecra + tanıtım kapalı ise doğrudan alt mecraya git */
  if(alts.length===1 && m.hub===false) return openAlt(m.id,alts[0].id);

  const nav=`<a href="${BASE}" onclick="goHome();return false;">Medyapark Adana</a> <i>/</i> <span>${esc(m.name)}</span>`;

  /* --- istatistikler --- */
  const units=alts.reduce((n,a)=>n+(a.units||[]).length,0);
  const yuzey=alts.reduce((n,a)=>n+groupUnits(a.units||[]).reduce((k,g)=>k+(g.A?1:0)+(g.B?1:0),0),0);
  const urunSay=new Set(alts.map(a=>String(a.product_id))).size;
  const stats=[
    ['Reklam alanı', urunSay+' tip'],
    ['Pozisyon', units],
    ['Yüzey', yuzey],
    m.gunluk_gosterim?['Gösterim',m.gunluk_gosterim]:null,
    m.toplam_alan?['Kapsam',m.toplam_alan]:null
  ].filter(Boolean);
  const statsHTML=stats.map(x=>
    `<div class="hs-row"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');

  /* --- sidebar: bu lokasyonun alanları --- */
  const altLinks=alts.map(a=>{ const p=a.product||{}; const n=(a.units||[]).length;
    return `<a class="qi" href="${BASE}mecra/${mSlug(m)}/${aSlug(a)}" onclick="openAlt('${m.id}','${a.id}');return false;">
      <span class="qi-n">${esc(p.name||a.name)}</span><span class="qi-m">${n} pozisyon</span></a>`;}).join('');
  const others=D.mecralar.filter(x=>String(x.id)!==String(m.id)).map(x=>
    `<a class="qi sm" href="${BASE}mecra/${mSlug(x)}" onclick="openMec('${x.id}');return false;">
      <span class="qi-n">${esc(x.name)}</span><span class="qi-m">${(x.alts||[]).length} alan</span></a>`).join('');

  /* --- sidebar: mini harita (pozisyon koordinatlarının ortalaması) --- */
  const pts=[]; alts.forEach(a=>(a.units||[]).forEach(u=>{const la=parseFloat(u.lat),ln=parseFloat(u.lng);
    if(isFinite(la)&&isFinite(ln))pts.push({lat:la,lng:ln,name:u.name||''});}));
  const mapBox = pts.length && visMode(m,'maps')!=='off'
    ? `<div class="hs-map"><div id="hubMap"></div>
        <button class="hs-mapall" onclick="openMapPage()">Haritada gör →</button></div>` : '';

  const st=D.settings||{};
  const cta=`<div class="hs-sec hs-cta">
      <div class="hs-ct">Bu lokasyon için teklif alın</div>
      ${st.phone?`<a class="hs-btn" href="tel:${esc(String(st.phone).replace(/\s/g,''))}">${esc(st.phone)}</a>`:''}
      ${st.social_whatsapp?`<a class="hs-btn wa" href="${esc(st.social_whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`:''}
    </div>`;

  const logoHTML = vis(m,'logo',!!m.logo)?`<div class="hs-logo${visCls(m,'logo')}">${picture(m.logo,null,'','logo')}</div>`:'';

  const side=`<aside class="hub-side"><div class="hs-panel">
    <div class="hs-sec hs-top">
      ${logoHTML}
      <div class="hs-name">${esc(m.name)}</div>
      ${m.badge?`<span class="hs-badge">${esc(m.badge)}</span>`:''}
    </div>
    ${stats.length?`<div class="hs-sec${visCls(m,'gosterim')}">${statsHTML}</div>`:''}
    ${mapBox?`<div class="hs-sec hs-nopad${visCls(m,'maps')}">${mapBox}</div>`:''}
    ${altLinks?`<div class="hs-sec"><div class="hs-h">Bu lokasyondaki alanlar</div>${altLinks}</div>`:''}
    ${others?`<div class="hs-sec"><div class="hs-h">Diğer lokasyonlar</div>${others}</div>`:''}
    ${cta}
  </div></aside>`;

  /* --- kroki --- */
  const kroki = vis(m,'kroki',!!m.yerlesim_plani)
    ? `<section class="hub-kroki${visCls(m,'kroki')}">
        <h2>Yerleşim Krokisi</h2>
        <div class="kroki-box" onclick="lightbox('${esc(m.yerlesim_plani)}')">
          ${picture(m.yerlesim_plani,m.kroki_mobil,'kroki-img','Yerleşim krokisi')}
          <span class="kroki-zoom">Büyütmek için tıklayın</span></div></section>` : '';

  /* --- avantajlar --- */
  const adv=Array.isArray(m.avantajlar)?m.avantajlar.filter(a=>a&&(a.t||a.title)):[];
  const advHTML = vis(m,'avantajlar',adv.length>0)
    ? `<section class="hub-adv${visCls(m,'avantajlar')}">${adv.map(a=>
        `<div class="adv"><b>${esc(a.t||a.title)}</b>${(a.d||a.desc)?`<span>${esc(a.d||a.desc)}</span>`:''}</div>`).join('')}</section>` : '';

  /* --- ürün kartları --- */
  const cards=alts.map(a=>{ const p=a.product||{}; const n=(a.units||[]).length;
    const sub=[`${n} pozisyon`, a.toplam_alan].filter(Boolean).join(' · ');
    return gcard(`openAlt('${m.id}','${a.id}')`, (p.name||a.name), sub, (a.image||m.image), m.theme_color, 'Keşfet', a.image_mobil, BASE+'mecra/'+mSlug(m)+'/'+aSlug(a));}).join('');

  app().innerHTML=`${banner(m,(m.baslik||m.name),nav)}
    <div class="hub">${side}
      <div class="hub-main">
        ${introBlock(m,true)}
        ${kroki}${advHTML}
        <section class="hub-alts">
          <h2>Reklam Alanları</h2>
          <div class="grid3">${cards||'<p class="muted">Bu lokasyonda alan tanımlı değil.</p>'}</div>
        </section>
      </div></div>`;
  if(pts.length) initHubMap(pts, m.theme_color||'#0071e3');
}

/* mecra sayfasındaki mini harita */
let hubMapObj=null;
function initHubMap(pts,color){
  setTimeout(()=>{
    const el=document.getElementById('hubMap'); if(!el||typeof L==='undefined')return;
    if(hubMapObj){ try{hubMapObj.remove();}catch(e){} hubMapObj=null; }
    hubMapObj=L.map('hubMap',{scrollWheelZoom:false,zoomControl:false,dragging:false,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(hubMapObj);
    const ms=pts.map(p=>L.marker([p.lat,p.lng],{icon:pinIcon(color)}));
    const grp=L.featureGroup(ms).addTo(hubMapObj);
    try{ hubMapObj.fitBounds(grp.getBounds().pad(0.5),{maxZoom:15}); }
    catch(e){ hubMapObj.setView([pts[0].lat,pts[0].lng],14); }
    setTimeout(()=>hubMapObj.invalidateSize(),160);
  },60);
}

/* kroki büyütme */
function lightbox(src){
  if(!src)return;
  const d=document.createElement('div'); d.className='lbox';
  d.innerHTML=`<button class="lbox-x" aria-label="Kapat">×</button><img src="${esc(src)}" alt="Kroki">`;
  d.onclick=()=>d.remove();
  document.body.appendChild(d);
}

/* ---- ALT DETAY ---- */
/* "P1-A" -> {base:'P1', surf:'A'} ; eşleşmezse tek yüzey (A) sayılır */
function posParts(name){ const t=String(name||'').trim();
  const m=t.match(/^(.*[^\s._-])[\s._-]*([ABab])$/);
  if(m) return {base:m[1], surf:m[2].toUpperCase()};
  return {base:t, surf:'A'}; }
function groupUnits(list){ const map=new Map();
  (list||[]).forEach(u=>{ const p=posParts(u.name);
    if(!map.has(p.base)) map.set(p.base,{base:p.base,A:null,B:null});
    const g=map.get(p.base);
    if(!g[p.surf]) g[p.surf]=u; else if(!g.B) g.B=u; });
  return [...map.values()]; }

function rollMonths(){ const b=new Date(); b.setDate(1); b.setMonth(b.getMonth()+roll*12);
  const arr=[]; for(let i=0;i<12;i++){ const d=new Date(b.getFullYear(),b.getMonth()+i,1); arr.push({ym:d.getFullYear()+'-'+pad(d.getMonth()+1),label:MONTHS_LONG[d.getMonth()],y:d.getFullYear()}); } return arr; }

function renderAlt(){
  const m=mec(view.mecId); if(!m)return goHome();
  const alts=m.alts||[]; const alt=alts.find(a=>String(a.id)===String(view.altId))||alts[0]; if(!alt)return renderMec();
  const p=alt.product||{}; const uList=alt.units||[];

  galImgs=(Array.isArray(alt.galeri)?alt.galeri:[]).slice(); galIdx=0;
  const galInner=`<div class="gimg" id="galImg" style="${galImgs.length?`background-image:url('${esc(galImgs[0])}')`:''}">${galImgs.length?'':'GALERİ / SLIDER'}</div>
    ${galImgs.length>1?`<div class="gnav l" onclick="galGo(-1)">‹</div><div class="gnav r" onclick="galGo(1)">›</div><div class="gdots" id="galDots">${galImgs.map((_,i)=>`<i class="${i===0?'on':''}" onclick="galSet(${i})"></i>`).join('')}</div>`:''}`;
  /* Harita kutusu: bu alt mecranın işaretli pozisyonları varsa canlı mini harita,
     yoksa panele yapıştırılmış iframe, o da yoksa yer tutucu */
  const altPts=(alt.units||[]).map(u=>({lat:parseFloat(u.lat),lng:parseFloat(u.lng),name:u.name||'',konum:u.konum||''}))
                              .filter(x=>isFinite(x.lat)&&isFinite(x.lng));
  const showMapBox = vis(alt,'maps', altPts.length>0 || !!alt.maps);
  let mapsInner;
  if(!showMapBox) mapsInner='';
  else if(altPts.length) mapsInner=`<div id="altMap" class="altmap"></div>
      <button class="altmap-all" onclick="openMapPage()">Tüm alanları haritada gör →</button>`;
  else mapsInner = alt.maps || '<div class="mapph">Konum eklenmemiş</div>';

  const mq=alt.marquee||''; let marquee='';
  if(mq){ const seg=mq.split('*').map(x=>x.trim()).filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join(''); const group=seg.repeat(4); marquee=`<div class="marquee"><div class="track">${group+group}</div></div>`; }

  const months=rollMonths(); const now=curYm();
  const yr=months[0].y + (months[11].y!==months[0].y?(' – '+months[11].y):'');
  const groups=groupUnits(uList);

  const monHead=months.map(mo=>`<div class="rg-m rg-mh"><span>${esc(mo.label.slice(0,3))}</span></div>`).join('');
  const surfCell=(u,ym,past)=>{
    if(!u) return `<span class="rcell yok" title="Bu pozisyonda bu yüzey tanımlı değil">–</span>`;
    const mp={}; (u.booked||[]).forEach(b=>mp[b.ym]=b.status);
    const st=mp[ym], sel=cart.some(c=>String(c.unitId)===String(u.id)&&c.ym===ym);
    const {surf}=posParts(u.name);
    const ay=MONTHS_LONG[+ym.slice(5,7)-1]+' '+ym.slice(0,4);
    const yz=surf==='A'?'A yüzey (ön yüz)':'B yüzey (arka yüz)';
    let cls='rcell', durum;
    if(sel){cls+=' sel';durum='Sepette';}
    else if(st==='dolu'){cls+=' dolu';durum='Dolu';}
    else if(st==='rezerve'){cls+=' rezerve';durum='Rezerve';}
    else if(past){cls+=' past';durum='Geçmiş';}
    else {cls+=' bos';durum='Müsait';}
    const tik=(!st&&!past)||sel ? ` onclick="pick('${u.id}','${ym}')"` : '';
    return `<span class="${cls}" data-u="${u.id}" data-ym="${ym}"${tik} title="${esc(u.name)} · ${esc(yz)} · ${esc(ay)} — ${durum}"><i>${surf}</i></span>`;
  };
  const rows=groups.map(g=>{
    const cells=months.map(mo=>`<div class="rg-m">${surfCell(g.A,mo.ym,mo.ym<now)}${surfCell(g.B,mo.ym,mo.ym<now)}</div>`).join('');
    return `<div class="rg-row"><div class="rg-lbl" title="${esc(g.base)}">${esc(g.base)}</div>${cells}</div>`;
  }).join('');

  const table=`<div class="restable"><div class="rh">
      <div><span class="t">Rezervasyon Tablosu</span> &nbsp;<span class="flow">Yüzey Seç › Sepete Ekle › Teklif Al</span></div>
      <div style="display:flex;align-items:center;gap:10px"><span class="yr">${yr}</span><div class="nav"><button onclick="rollNav(-1)" title="Önceki yıl">‹</button><button onclick="rollNav(1)" title="Sonraki yıl">›</button></div></div></div>
    <div class="rtwrap"><div class="rgrid">
      <div class="rg-row rg-head"><div class="rg-lbl">Pozisyon</div>${monHead}</div>
      ${rows||'<div class="rg-row"><div class="rg-lbl muted">Pozisyon yok</div></div>'}
    </div></div>
    <div class="rg-legend">
      <span class="lg-surf"><b>A</b> Ön yüz</span><span class="lg-surf"><b>B</b> Arka yüz</span>
      <span class="lg-sep"></span>
      <span><i class="sw bos"></i>Müsait</span><span><i class="sw dolu"></i>Dolu</span>
      <span><i class="sw rezerve"></i>Rezerve</span><span><i class="sw sel"></i>Seçili</span>
    </div></div>`;

  const prices=altPrices(alt,p);
  const specRows=[['Ürün',p.name],['Ölçü',p.olcu],['Yüzey',p.yuzey],['Aydınlatma',p.isikli],['Baskı Malzemesi',p.baski_malzemesi],['Baskı Formatı',p.baski_format],['Yayın Formatı',p.yayin_format]].filter(x=>x[1]&&x[1]!=='—').map(x=>`<div class="spec"><span class="k">${esc(x[0])}</span><span class="v">${esc(x[1])}</span></div>`).join('');
  const teknikAcc=`<details class="acc" open><summary>Teknik Özellikler</summary><div>${specRows||'<p class="muted">—</p>'}</div></details>`;
  const fiyatAcc=!showPrices()?'':`<details class="acc" open><summary>Fiyatlar</summary><div>${prices.map(([k,v])=>`<div class="priceitem"><span class="muted">${esc(k)}</span><span class="amt">${money(v)}</span></div>`).join('')||'<p class="muted">—</p>'}<p class="muted" style="font-size:12px;margin-top:8px">Belediye vergi dahil, dijital baskı hariç · KDV hariç.</p></div></details>`;
  const sepetbox=`<div class="sepetbox"><h4>Sepet</h4><div id="sepetInner"></div></div>`;

  const rel=[];
  alts.filter(a=>a.id!==alt.id).forEach(a=>{const pp=a.product||{};rel.push({onclick:`openAlt('${m.id}','${a.id}')`,title:(pp.name||a.name),sub:[`${(a.units||[]).length} pozisyon`,a.toplam_alan].filter(Boolean).join(' · '),image:(a.image||m.image),theme:m.theme_color});});
  D.mecralar.filter(x=>x.id!==m.id).forEach(x=>rel.push({onclick:`openMec('${x.id}')`,title:x.name,sub:(x.gunluk_gosterim||''),image:x.image,theme:x.theme_color}));
  const relCards=rel.map(r=>`<div class="carslide">${gcard(r.onclick,r.title,r.sub,r.image,r.theme,'Keşfet')}</div>`).join('');

  const nav=`<a href="${BASE}" onclick="goHome();return false;">Medyapark Adana</a> <i>/</i> <a href="${BASE}mecra/${mSlug(m)}" onclick="openMec('${m.id}');return false;">${esc(m.name)}</a> <i>/</i> <span>${esc(p.name||alt.name)}</span>`;
  const bobj={kapak:(alt.kapak||m.kapak),kapak_color:(alt.kapak_color||m.kapak_color),kapak_opacity:(alt.kapak_opacity!=null?alt.kapak_opacity:m.kapak_opacity),kapak_height:(alt.kapak_height!=null?alt.kapak_height:m.kapak_height)};

  app().innerHTML=`${banner(bobj,(alt.baslik||p.name||alt.name),nav)}${introBlock(alt)}
    <div class="gm-row${mapsInner?'':' solo'}"><div class="galbox">${galInner}</div>${mapsInner?`<div class="mapbox">${mapsInner}</div>`:''}</div>
    ${marquee}
    <div class="res-row"><div class="col-l">${table}</div><div class="side-col">${teknikAcc}${fiyatAcc}${sepetbox}</div></div>
    <div class="related-h"><a onclick="goHome()">Diğer Mecralara Göz Atın</a></div>
    <div class="carousel"><div class="cnav l" onclick="carScroll(-1)">‹</div><div class="cartrack" id="cartrack">${relCards}</div><div class="cnav r" onclick="carScroll(1)">›</div></div>`;
  renderSepetInline(); resetGalTimer();
  if(altPts.length) initAltMap(altPts, m.theme_color||'#0071e3');
}

/* Alt mecra detayındaki mini harita */
let altMapObj=null;
function initAltMap(pts,color){
  setTimeout(()=>{
    const el=document.getElementById('altMap'); if(!el)return;
    if(typeof L==='undefined'){ el.innerHTML='<div class="mapph">Harita yüklenemedi</div>'; return; }
    if(altMapObj){ try{altMapObj.remove();}catch(e){} altMapObj=null; }
    altMapObj=L.map('altMap',{scrollWheelZoom:false,zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(altMapObj);
    const ms=pts.map(p=>L.marker([p.lat,p.lng],{icon:pinIcon(color),title:p.name})
      .bindPopup(`<div class="pp"><div class="pp-b"><div class="pp-t">${esc(p.name)}</div>${p.konum?`<div class="pp-k">${esc(p.konum)}</div>`:''}
        <a class="pp-ext" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Haritalar'da aç ↗</a></div></div>`,{maxWidth:240}));
    const grp=L.featureGroup(ms).addTo(altMapObj);
    try{ altMapObj.fitBounds(grp.getBounds().pad(0.35),{maxZoom:16}); }catch(e){ altMapObj.setView([pts[0].lat,pts[0].lng],15); }
    setTimeout(()=>altMapObj.invalidateSize(),200);
  },80);
}
function rollNav(d){ roll+=d; renderAlt(); }
function carScroll(d){ const t=document.getElementById('cartrack'); if(t)t.scrollBy({left:d*340,behavior:'smooth'}); }
function pick(uid,ym){ toggleMonth(uid,ym); }
function toggleMonth(uid,ym){
  const alt=D.altById[view.altId]; if(!alt)return; const m=mec(view.mecId);
  const u=(alt.units||[]).find(x=>String(x.id)===String(uid)); if(!u)return; const p=alt.product||{};
  const i=cart.findIndex(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  if(i>-1){ cart.splice(i,1); }
  else{ const [y,mm]=ym.split('-'); const price=altPerMonth(alt,p);
    cart.push({unitId:Number(uid),mecra:m.name,alt:alt.name,unit:u.name,product:p.name,olcu:u.olcu||p.olcu||'',ym,monthLabel:MONTHS_LONG[+mm-1]+' '+y,price,priceLabel:money(price)}); }
  badge(); renderCart(); updateCell(uid,ym); renderSepetInline();
}
function updateCell(uid,ym){ const el=document.querySelector(`.rcell[data-u='${uid}'][data-ym='${ym}']`); if(!el)return;
  const sel=cart.some(c=>String(c.unitId)===String(uid)&&c.ym===ym);
  el.classList.remove('sel','bos'); el.classList.add(sel?'sel':'bos');
  if(el.title) el.title=el.title.replace(/—.*$/, '— '+(sel?'Sepette':'Müsait')); }

function renderSepetInline(){ const box=document.getElementById('sepetInner'); if(!box)return;
  if(!cart.length){ box.innerHTML='<div class="empty2">Sepetiniz boş. Tablodan müsait ay seçtikçe burada güncellenir.</div>'; return; }
  box.innerHTML=cart.map((c,i)=>`<div class="si-item"><div><b>${esc(c.mecra)}</b><br><span class="muted" style="font-size:12.5px">${esc(c.product)}${c.unit?' › '+esc(c.unit):''} · ${esc(c.monthLabel)}</span></div><div style="text-align:right;white-space:nowrap">${showPrices()?c.priceLabel+'<br>':''}<span class="x" onclick="removeItem(${i})">kaldır ×</span></div></div>`).join('')
    +`${showPrices()?`<div class="tot"><span>Toplam</span><span>${money(cartTotal())}</span></div>`:'<div style="height:10px"></div>'}<button class="btn btn-primary" style="width:100%" onclick="toggleCart()">Teklif Al</button>`; }

/* ---- sayfalar ---- */
function renderBlocks(blocks){ return (blocks||[]).map(b=>{
  if(b.type==='heading')return `<h2 class="pg-h">${esc(b.text||'')}</h2>`;
  if(b.type==='text')return `<div class="pg-t">${(b.text||'').split('\n').map(p=>p.trim()?`<p>${esc(p)}</p>`:'').join('')}</div>`;
  if(b.type==='image')return `<figure class="pg-img"><img src="${esc(b.url||'')}" alt="${esc(b.caption||'')}">${b.caption?`<figcaption>${esc(b.caption)}</figcaption>`:''}</figure>`;
  if(b.type==='gallery'){ const imgs=Array.isArray(b.images)?b.images:[]; return imgs.length?`<div class="pg-gal">${imgs.map(g=>`<div class="pg-gi" style="background-image:url('${esc(g)}')"></div>`).join('')}</div>`:''; }
  if(b.type==='features'){ const it=Array.isArray(b.items)?b.items:[]; return `<div class="pg-feat">${it.map(x=>`<div class="pg-fc"><h3>${esc(x.title||'')}</h3><p>${esc(x.desc||'')}</p></div>`).join('')}</div>`; }
  if(b.type==='faq'){ const it=Array.isArray(b.items)?b.items:[]; return `<div class="pg-faq">${it.map(x=>`<details class="acc"><summary>${esc(x.q||'')}</summary><div>${esc(x.a||'')}</div></details>`).join('')}</div>`; }
  if(b.type==='cta')return `<div class="pg-cta"><h3>${esc(b.title||'')}</h3>${b.label?`<a class="btn btn-primary" href="${esc(b.link||'#')}">${esc(b.label)}</a>`:''}</div>`;
  if(b.type==='spacer')return `<div style="height:${(+b.size||40)}px"></div>`;
  return ''; }).join(''); }

function renderPage(slug){
  const pg=(D.pages||[]).find(p=>p.slug===slug)||{};
  const nav=`<a onclick="goHome()">Medyapark Adana</a> / ${esc(pg.title||'')}`;
  let inner;
  if(Array.isArray(pg.blocks)&&pg.blocks.length){ inner=`<div class="pg-wrap">${renderBlocks(pg.blocks)}</div>`; }
  else { inner=`<div class="sechead"><h1>${esc(pg.title||'')}</h1></div><div class="page-body">${esc(pg.body||'')}</div>`; }
  if(slug==='iletisim'){ const s=D.settings; inner+=`<div class="pg-contact"><div><b>Telefon:</b> ${esc(s.phone||'')}</div><div><b>E-Posta:</b> ${esc(s.email||'')}</div><div><b>Adres:</b> ${esc(s.address||'')}</div></div>`; }
  app().innerHTML=`<div class="pg-top"><div class="pg-crumb">${nav}</div><h1 class="pg-title">${esc(pg.title||'')}</h1></div>${inner}`;
}
function renderMenu(){ const el=document.getElementById('menuPages'); if(!el)return; el.innerHTML=(D.pages||[]).filter(p=>p.in_menu!==false).map(p=>`<a href="${BASE}sayfa/${esc(p.slug)}" onclick="openPage('${p.slug}');closeMenu();return false;">${esc(p.title||p.slug)}</a>`).join(''); }

/* ---- sepet çekmecesi ---- */
function removeItem(i){ const it=cart[i]; cart.splice(i,1); badge(); renderCart(); if(view.type==='alt'){ if(it)updateCell(it.unitId,it.ym); renderSepetInline(); } }
function badge(){ const b=document.getElementById('cbadge'); if(!b)return; if(cart.length){b.style.display='flex';b.textContent=cart.length;}else b.style.display='none'; }
const cartTotal=()=>cart.reduce((s,c)=>s+(c.price||0),0);
function renderCart(){
  const b=document.getElementById('cartBody'), f=document.getElementById('cartFoot'); if(!b)return;
  if(!cart.length){ b.innerHTML='<div class="empty">Sepetiniz boş.<br>Bir alanın rezervasyon tablosundan müsait ay(lar) seçin.</div>'; f.innerHTML=''; return; }
  b.innerHTML=cart.map((c,i)=>`<div class="citem"><span class="rm" onclick="removeItem(${i})">×</span><div class="cl">${esc(c.mecra)}</div><div class="cm">${esc(c.product)}${c.unit?' › '+esc(c.unit):''} · ${esc(c.monthLabel)}</div>${showPrices()?`<div class="camt">${c.priceLabel}</div>`:''}</div>`).join('');
  f.innerHTML=`${showPrices()?`<div style="display:flex;justify-content:space-between;margin-bottom:12px"><span>Tahmini toplam</span><b>${money(cartTotal())}</b></div>`:''}
    <div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportPDF()">PDF</button><button class="btn btn-outline btn-sm" style="flex:1" onclick="exportExcel()">Excel</button></div>
    <input class="inp" id="qName" placeholder="Ad Soyad" style="margin-bottom:8px"><input class="inp" id="qFirma" placeholder="Firma" style="margin-bottom:8px">
    <input class="inp" id="qTel" placeholder="Telefon" style="margin-bottom:8px"><input class="inp" id="qMail" placeholder="E-posta" style="margin-bottom:10px">
    <button class="btn btn-primary" style="width:100%" onclick="sendQuote()">Teklif Al</button>`;
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
function exportExcel(){ if(!cart.length)return; const sp=showPrices();
  const head=['Lokasyon','Alt Mecra','Ünite','Ürün','Dönem'].concat(sp?['Fiyat']:[]);
  const rows=cart.map(c=>[c.mecra,c.alt||'',c.unit,c.product,c.monthLabel].concat(sp?[c.priceLabel]:[]));
  if(sp)rows.push(['','','','','TOPLAM',money(cartTotal())]);
  const csv='\uFEFF'+[head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\r\n'); dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'teklif-medyapark.csv'); }
function exportPDF(){ if(!cart.length)return; const s=D.settings; const sp=showPrices();
  const rows=cart.map(c=>`<tr><td>${esc(c.mecra)}${c.alt?' / '+esc(c.alt):''}</td><td>${esc(c.unit)}</td><td>${esc(c.product)}</td><td>${esc(c.monthLabel)}</td>${sp?`<td style="text-align:right">${c.priceLabel}</td>`:''}</tr>`).join('');
  const w=window.open('','_blank'); w.document.write(`<html><head><meta charset="utf-8"><title>Teklif</title><style>body{font-family:-apple-system,Arial;padding:40px;color:#1d1d1f}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px;border-bottom:1px solid #eee;text-align:left}tfoot td{font-weight:700;border-top:2px solid #1d1d1f}</style></head><body><h1>${esc(s.logoText||'Medyapark')} — Teklif</h1><p style="color:#6e6e73">${new Date().toLocaleDateString('tr-TR')} · ${esc(s.phone||'')}</p><table><thead><tr><th>Lokasyon</th><th>Ünite</th><th>Ürün</th><th>Dönem</th>${sp?'<th style="text-align:right">Fiyat</th>':''}</tr></thead><tbody>${rows}</tbody>${sp?`<tfoot><tr><td colspan="4">TOPLAM</td><td style="text-align:right">${money(cartTotal())}</td></tr></tfoot>`:''}</table></body></html>`); w.document.close(); setTimeout(()=>w.print(),300); }
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);};


/* ================= HARİTA SAYFASI ================= */
const ADANA=[37.0000,35.3213];
let mapObj=null, clusterGrp=null, mapQuery='', mapPinsCache=[];
function openMapPage(){ view={type:'map',filter:view.filter||null}; mapQuery=''; const s=document.getElementById('search'); if(s)s.value=''; render(); }

/* Tüm işaretli konumları topla (koordinatı girilmiş pozisyonlar) */
function allPins(){ const out=[];
  D.mecralar.forEach(m=>{ (m.alts||[]).forEach(a=>{ const p=a.product||{};
    (a.units||[]).forEach(u=>{ const la=parseFloat(u.lat), ln=parseFloat(u.lng);
      if(!isFinite(la)||!isFinite(ln))return;
      out.push({lat:la,lng:ln,mecId:m.id,altId:a.id,mec:m.name,alt:a.name,product:p.name||'',productId:a.product_id,
        unit:u.name||'',image:(u.image||a.image||m.image||''),theme:(m.theme_color||'#0071e3'),konum:(u.konum||'')}); }); }); });
  return out; }

function pinMatches(p){
  if(view.filter && String(p.productId)!==String(view.filter)) return false;
  const q=(mapQuery||'').trim().toLowerCase(); if(!q) return true;
  return [p.mec,p.alt,p.product,p.unit,p.konum].some(x=>String(x||'').toLowerCase().includes(q)); }

function pinIcon(color){ return L.divIcon({className:'pin-wrap',iconSize:[30,40],iconAnchor:[15,38],popupAnchor:[0,-34],
  html:`<span class="pin" style="--pc:${color}"></span>`}); }

function popupHTML(p){
  const img=p.image?`<div class="pp-img" style="background-image:url('${esc(p.image)}')"></div>`:'';
  const sub=[p.product,p.unit].filter(Boolean).join(' › ');
  return `<div class="pp">${img}<div class="pp-b"><div class="pp-t">${esc(p.mec)}</div>
    <div class="pp-s">${esc(sub)}</div>${p.konum?`<div class="pp-k">${esc(p.konum)}</div>`:''}
    <button class="btn btn-primary btn-sm" style="width:100%;margin-top:10px" onclick="openAlt('${p.mecId}','${p.altId}')">Detaya Git →</button>
    <a class="pp-ext" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Haritalar'da aç ↗</a></div></div>`; }

/* ---- motor: anahtar varsa Google Maps, yoksa OpenStreetMap ---- */
let mapEngine='leaflet', gMap=null, gCluster=null, gInfo=null, gMarkers=[], gLoading=null;
function gKey(){ return String((D.settings||{}).googleMapsKey||'').trim(); }

function loadGoogle(){
  if(gLoading) return gLoading;
  gLoading=new Promise((res,rej)=>{
    const key=gKey(); if(!key) return rej(new Error('anahtar girilmemis'));
    if(window.google&&window.google.maps&&window.markerClusterer) return res();
    const t=setTimeout(()=>rej(new Error('zaman asimi')),15000);
    window.gm_authFailure=()=>{ clearTimeout(t); rej(new Error('anahtar reddedildi')); };
    window.__gmReady=()=>{
      const c=document.createElement('script');
      c.src='https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      c.onload=()=>{ clearTimeout(t); res(); };
      c.onerror=()=>{ clearTimeout(t); rej(new Error('kumeleme kutuphanesi yuklenemedi')); };
      document.head.appendChild(c);
    };
    const g=document.createElement('script');
    g.async=true;
    g.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&callback=__gmReady&language=tr&region=TR';
    g.onerror=()=>{ clearTimeout(t); rej(new Error('google maps yuklenemedi')); };
    document.head.appendChild(g);
  });
  return gLoading;
}

function gPinSvg(color){ return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">'+
  '<path d="M16 41C16 41 30 25.5 30 15A14 14 0 1 0 2 15c0 10.5 14 26 14 26z" fill="'+color+'" stroke="#fff" stroke-width="3"/>'+
  '<circle cx="16" cy="15" r="5.2" fill="#fff"/></svg>'); }

function gClusterSvg(sz){ return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="'+sz+'" height="'+sz+'">'+
  '<circle cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+(sz/2-3)+'" fill="#0071e3" stroke="rgba(255,255,255,.92)" stroke-width="3"/></svg>'); }

function setMapMeta(n){
  const c=document.getElementById('mapCount'); if(c)c.textContent=n;
  const e=document.getElementById('mapEmpty'); if(e)e.style.display=n?'none':'block'; }

function refreshPins(){
  const list=mapPinsCache.filter(pinMatches);
  setMapMeta(list.length);
  if(mapEngine==='google'){
    if(!gMap)return;
    if(gCluster)gCluster.clearMarkers();
    gMarkers.forEach(mk=>mk.setMap(null));
    gMarkers=list.map(p=>{
      const mk=new google.maps.Marker({position:{lat:p.lat,lng:p.lng},title:p.mec+' \u00b7 '+p.unit,
        icon:{url:gPinSvg(p.theme),scaledSize:new google.maps.Size(32,42),anchor:new google.maps.Point(16,41)}});
      mk.addListener('click',()=>{ gInfo.setContent(popupHTML(p)); gInfo.open({anchor:mk,map:gMap}); });
      return mk; });
    if(gCluster)gCluster.addMarkers(gMarkers);
    if(list.length){
      const b=new google.maps.LatLngBounds();
      list.forEach(p=>b.extend({lat:p.lat,lng:p.lng}));
      gMap.fitBounds(b,60);
      google.maps.event.addListenerOnce(gMap,'idle',()=>{ if(gMap.getZoom()>16)gMap.setZoom(16); });
    }
    return;
  }
  if(!clusterGrp)return;
  clusterGrp.clearLayers();
  const markers=list.map(p=>L.marker([p.lat,p.lng],{icon:pinIcon(p.theme),title:p.mec+' \u00b7 '+p.unit}).bindPopup(popupHTML(p),{maxWidth:280,minWidth:240}));
  clusterGrp.addLayers(markers);
  if(list.length){ try{ mapObj.fitBounds(L.latLngBounds(list.map(p=>[p.lat,p.lng])).pad(0.18),{maxZoom:15}); }catch(e){} }
}

function initGoogleMap(){
  gMap=new google.maps.Map(document.getElementById('mapCanvas'),{
    center:{lat:ADANA[0],lng:ADANA[1]}, zoom:12,
    mapTypeControl:true, streetViewControl:true, fullscreenControl:true,
    styles:[{featureType:'poi.business',stylers:[{visibility:'simplified'}]}]});
  gInfo=new google.maps.InfoWindow({maxWidth:280});
  gCluster=new markerClusterer.MarkerClusterer({map:gMap,markers:[],renderer:{
    render:function(o){ const count=o.count, position=o.position; const sz=count<10?38:(count<50?46:54);
      return new google.maps.Marker({position:position,zIndex:1000+count,
        label:{text:String(count),color:'#fff',fontSize:'13px',fontWeight:'700'},
        icon:{url:gClusterSvg(sz),scaledSize:new google.maps.Size(sz,sz),anchor:new google.maps.Point(sz/2,sz/2)}}); }}});
  mapEngine='google';
  refreshPins();
}

function initLeafletMap(note){
  const el=document.getElementById('mapCanvas'); if(!el)return;
  if(typeof L==='undefined'){ el.innerHTML='<div class="map-empty">Harita yuklenemedi. Baglantinizi kontrol edip sayfayi yenileyin.</div>'; return; }
  mapObj=L.map('mapCanvas',{scrollWheelZoom:true}).setView(ADANA,12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap katkida bulunanlar'}).addTo(mapObj);
  clusterGrp=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:55,spiderfyOnMaxZoom:true,
    iconCreateFunction:function(c){ const n=c.getChildCount(); const sz=n<10?36:(n<50?44:52);
      return L.divIcon({html:'<div class="cl-b" style="width:'+sz+'px;height:'+sz+'px;line-height:'+sz+'px">'+n+'</div>',className:'cl-w',iconSize:[sz,sz]}); }});
  mapObj.addLayer(clusterGrp);
  mapEngine='leaflet';
  refreshPins();
  setTimeout(function(){ mapObj.invalidateSize(); },200);
  if(note){ const w=document.getElementById('mapNote'); if(w){ w.textContent=note; w.style.display='block'; } }
}

function renderMap(){
  const nav=`<a href="${BASE}" onclick="goHome();return false;">Medyapark Adana</a> <i>/</i> <span>Harita</span>`;
  const s=D.settings||{};
  app().innerHTML=`${banner({kapak:s.mapKapak||'',kapak_color:'#101014',kapak_opacity:0.45,kapak_height:220},'',nav)}
    <div class="map-wrap">
      <div class="map-head">
        <div><h1 class="map-t">${esc(s.mapTitle||'Reklam Alanlarımız — Adana Haritası')}</h1>
        <p class="map-d">${esc(s.mapDesc||'Üstteki arama ve Filtrele menüsü haritada da çalışır. Pinlere tıklayarak alan bilgisini görebilir, detay sayfasına geçebilirsiniz.')}</p></div>
        <div class="map-cnt"><b id="mapCount">0</b> alan</div>
      </div>
      <div id="mapCanvas" class="map-canvas"></div>
      <div id="mapEmpty" class="map-empty" style="display:none">Bu arama/filtre için konumu işaretlenmiş alan bulunamadı.</div>
      <div id="mapNote" class="map-note" style="display:none"></div>
      <p class="muted" style="font-size:12.5px;margin:12px 2px 60px">Yakınlaştırdıkça gruplanmış pinler ayrışır. Sayılı daireler o bölgedeki alan sayısını gösterir.</p>
    </div>`;
  mapPinsCache=allPins();
  setTimeout(function(){
    if(gKey()){
      loadGoogle().then(function(){ initGoogleMap(); })
        .catch(function(err){
          console.warn('Google Maps kullanilamadi:',err.message);
          initLeafletMap('Google Maps yuklenemedi ('+err.message+'). Harita gecici olarak OpenStreetMap ile gosteriliyor.');
        });
    } else { initLeafletMap(); }
  },60);
}

/* ---- footer ---- */
/* footer bağlantısı: panelde seçilen türe göre adres üretir */
function ftrLink(it){
  const t=it.type||'url', v=it.value||'';
  const lbl=esc(it.label||'');
  if(t==='sayfa'){ const p=(D.pages||[]).find(x=>x.slug===v);
    return `<a href="${BASE}sayfa/${esc(v)}" onclick="openPage('${esc(v)}');return false;">${lbl||esc((p||{}).title||v)}</a>`; }
  if(t==='mecra'){ const m=mec(v); if(!m)return '';
    return `<a href="${BASE}mecra/${mSlug(m)}" onclick="openMec('${m.id}');return false;">${lbl||esc(m.name)}</a>`; }
  if(t==='harita') return `<a href="${BASE}harita" onclick="openMapPage();return false;">${lbl||'Harita'}</a>`;
  if(t==='anasayfa') return `<a href="${BASE}" onclick="goHome();return false;">${lbl||'Anasayfa'}</a>`;
  if(t==='pdf'){ const u=(D.settings||{}).catalogPdf; return u?`<a href="${esc(u)}" download>${lbl||'PDF Katalog'}</a>`:''; }
  if(t==='tel'){ const u=(D.settings||{}).phone||v; return `<a href="tel:${esc(String(u).replace(/\s/g,''))}">${lbl||esc(u)}</a>`; }
  if(!v) return '';
  const dis=/^https?:/i.test(v);
  return `<a href="${esc(v)}"${dis?' target="_blank" rel="noopener"':''}>${lbl||esc(v)}</a>`;
}
function renderFooter(){ const s=D.settings||{};
  const cfg=s.footer&&Array.isArray(s.footer.cols)&&s.footer.cols.length?s.footer:null;
  let cols;
  if(cfg){
    cols=cfg.cols.filter(c=>c&&(c.title||(c.items||[]).length)).map(c=>{
      const links=(c.items||[]).map(ftrLink).filter(Boolean).join('');
      return `<div><h5>${esc(c.title||'')}</h5>${(c.grid?`<div class="meccols">${links}</div>`:links)}</div>`;
    }).join('');
  } else {
    /* panelde ayar yoksa eski davranış */
    const mecLinks=D.mecralar.map(m=>`<a href="${BASE}mecra/${mSlug(m)}" onclick="openMec('${m.id}');return false;">${esc(m.name)}</a>`).join('');
    const pdf=s.catalogPdf?`<a href="${esc(s.catalogPdf)}" download>PDF Katalog</a>`:'';
    cols=`<div><h5>SAYFALAR</h5>${(D.pages||[]).filter(p=>p.in_menu!==false).map(p=>`<a href="${BASE}sayfa/${esc(p.slug)}" onclick="openPage('${p.slug}');return false;">${esc(p.title||p.slug)}</a>`).join('')}${pdf}</div>
      <div><h5>MECRALARIMIZ</h5><div class="meccols">${mecLinks}</div></div>`;
  }
  const iletisim=(cfg&&cfg.hideContact)?'':`<div><h5>İLETİŞİM</h5><div class="il"><b>Adres:</b> ${esc(s.address||'')}<br><br><b>Telefon:</b> ${esc(s.phone||'')}<br><br><b>E-Posta:</b> ${esc(s.email||'')}<br><br>${esc(s.socials||'')}</div></div>`;
  const bulten=(cfg&&cfg.hideNews)?'':`<div class="news"><h5 style="text-align:center">${esc(s.footer_news||"Kampanya ve yeniliklerden haberdar olmak için;")}</h5><input class="inp" placeholder="E-Posta"><button class="abone" onclick="alert('Teşekkürler! Kaydınız alındı.')">Abone Ol</button></div>`;
  document.getElementById('foot').innerHTML=`<div class="ftr"><div class="ftr-in">
    <div><div class="brand">${logo(s.logoText)}</div><p style="font-size:13px;color:#8a8a90;max-width:26ch">${esc(s.footer_about||"Adana açık hava reklam çözümleri.")}</p></div>
    ${cols}${iletisim}${bulten}
  </div><div class="ftr-bottom"><div class="inner">${esc(s.footer_note||"Tüm hakları saklıdır. Polat Medya Tanıtım Paz. Org. San. ve Tic. Ltd. Şti.")}</div></div></div>`;
}

/* ---- Google Analytics (GA4) ---- */
function initAnalytics(){
  const id=String((D.settings||{}).gaId||'').trim();
  if(!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
  if(window.__gaOn) return; window.__gaOn=true;
  const sc=document.createElement('script'); sc.async=true;
  sc.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
  document.head.appendChild(sc);
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){ window.dataLayer.push(arguments); };
  gtag('js',new Date());
  gtag('config',id,{send_page_view:false});   /* sayfa görüntülemeyi biz gönderiyoruz */
  gaPage();
}
function gaPage(){
  if(!window.gtag)return;
  try{ gtag('event','page_view',{page_title:document.title,
    page_location:location.origin+BASE+viewPath(), page_path:BASE+viewPath()}); }catch(e){}
}

function toggleMenu(e){e.stopPropagation();document.getElementById('menu').classList.toggle('open');}
function closeMenu(){document.getElementById('menu').classList.remove('open');document.getElementById('filterMenu')?.classList.remove('open');}
document.addEventListener('click',closeMenu);
load();
