/*! Kasir POS v1.0 | Blogger + Supabase. File ini PUBLIK: jangan taruh rahasia di sini. */
(function(){'use strict';
const CFG=window.KASIR_CONFIG||{},BASE='/p/',TZ=CFG.TZ||'Asia/Jakarta';
let sb,ME=null,SET=null,loggingOut=false;const PAGES={};

/* ---------- util ---------- */
const host=()=>document.getElementById('kasir-app')||document.body;
const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(n,d)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:d==null?3:d}).format(Number(n)||0);
const rp=n=>'Rp '+nf(n,2);
const fmt=(iso,o)=>iso?new Intl.DateTimeFormat('id-ID',Object.assign({timeZone:TZ},o)).format(new Date(iso)):'-';
const fdate=i=>fmt(i,{day:'numeric',month:'long',year:'numeric'});
const ftime=i=>fmt(i,{hour:'2-digit',minute:'2-digit'});
const fdt=i=>i?fdate(i)+', '+ftime(i):'-';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const rng=(f,t)=>[f+'T00:00:00+07:00',addDays(t,1)+'T00:00:00+07:00'];
const ini=n=>(String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('')||'?').toUpperCase();
const first=n=>String(n||'').trim().split(/\s+/)[0]||'';
const r2=n=>Math.round(n*100)/100;
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const MT={cash:'Tunai',qris:'QRIS',transfer:'Transfer Bank'};
const MV={sale:'Penjualan',adjustment:'Penyesuaian',return:'Pengembalian',opening_stock:'Stok awal'};

function fx(e){let m=(e&&e.message)||'Terjadi kesalahan',c=e&&e.code;
 if(c==='23505')m='Data duplikat: SKU, barcode, atau nama sudah digunakan.';
 else if(c==='42501'||/permission denied|row-level security/i.test(m))m='Akses ditolak.';
 else if(/Failed to fetch|NetworkError|Load failed|network/i.test(m))m='Koneksi terputus. Periksa internet Anda lalu coba lagi.';
 else if(/JWT expired/i.test(m))m='Sesi berakhir. Silakan login ulang.';
 const x=new Error(m);x.code=c;return x}
const run=async p=>{let r;try{r=await p}catch(e){throw fx(e)}if(r.error)throw fx(r.error);return r.data};
const runc=async p=>{let r;try{r=await p}catch(e){throw fx(e)}if(r.error)throw fx(r.error);return r};
async function all(mk){let out=[],i=0;for(;;){const d=await run(mk().range(i,i+999));out=out.concat(d||[]);if(!d||d.length<1000)break;i+=1000}return out}
async function getSettings(force){if(SET&&!force)return SET;
 SET=await run(sb.from('store_settings').select('*').limit(1).maybeSingle());
 SET=SET||{store_name:'Toko Saya',receipt_width:'80mm',pay_cash:true,pay_qris:true,pay_transfer:true,allow_discount:true,tax_enabled:false,tax_percentage:0,allow_negative_stock:false,invoice_prefix:'INV'};return SET}

/* ---------- komponen ---------- */
function toast(msg,type,ms){type=type||'info';let box=$('#toasts');
 if(!box){box=document.createElement('div');box.id='toasts';box.setAttribute('aria-live','polite');host().appendChild(box)}
 const t=document.createElement('div');t.className='toast '+type;
 t.innerHTML='<b>'+({success:'Berhasil',error:'Gagal',warning:'Perhatian',info:'Info'}[type])+'</b> '+esc(msg);
 box.appendChild(t);setTimeout(()=>t.remove(),ms||4500)}
function modal(o){const ov=document.createElement('div');ov.className='ov';let dirty=false;
 ov.innerHTML='<div class="modal '+(o.size||'')+'" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'"><div class="mh"><h3>'+esc(o.title)+'</h3><button class="x" data-x aria-label="Tutup">×</button></div><div class="mb">'+o.body+'</div>'+(o.footer?'<div class="mf">'+o.footer+'</div>':'')+'</div>';
 host().appendChild(ov);document.body.classList.add('noscroll');
 const m={el:ov,$:s=>$(s,ov),close(force){if(!force&&dirty&&!o.nodirty&&!confirm('Perubahan belum disimpan. Tutup formulir?'))return;ov.remove();if(!$('.ov'))document.body.classList.remove('noscroll');if(o.onClose)o.onClose()}};
 ov._m=m;ov.addEventListener('input',()=>{dirty=true});
 ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-x]'))m.close()});
 const f=$('input:not([type=hidden]),select,textarea',ov);if(f&&!o.nofocus)setTimeout(()=>f.focus(),30);
 return m}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const l=$$('.ov').pop();if(l&&l._m)l._m.close()}});
const ask=(title,msg,btn,danger)=>new Promise(res=>{let done=false;
 const m=modal({title,size:'sm',nodirty:true,nofocus:true,body:'<p>'+esc(msg)+'</p>',footer:'<button class="btn" data-x>Batal</button><button class="btn '+(danger?'danger':'primary')+'" id="ok">'+esc(btn||'Ya, lanjutkan')+'</button>',onClose:()=>{if(!done)res(false)}});
 m.$('#ok').onclick=()=>{done=true;m.close(true);res(true)}});
function busy(b,on,txt){if(!b)return;if(on){b.dataset.t=b.textContent;b.disabled=true;if(txt)b.textContent=txt}else{b.disabled=false;if(b.dataset.t)b.textContent=b.dataset.t}}
const loadingH=()=>'<div class="skel"><i></i><i></i><i></i></div>';
const emptyH=(t,a)=>'<div class="state"><div class="ico">📭</div><p>'+esc(t)+'</p>'+(a||'')+'</div>';
const errH=m=>'<div class="state err"><div class="ico">⚠️</div><p>'+esc(m)+'</p><button class="btn primary" data-retry>Coba lagi</button></div>';
async function load(el,fn){el.innerHTML=loadingH();try{await fn()}catch(e){el.innerHTML=errH(e.message);const b=$('[data-retry]',el);if(b)b.onclick=()=>load(el,fn)}}
const ph=(t,d,a)=>'<div class="ph"><div><h2>'+esc(t)+'</h2>'+(d?'<p>'+esc(d)+'</p>':'')+'</div><div class="acts">'+(a||'')+'</div></div>';
const stat=(l,v,s)=>'<div class="stat"><small>'+esc(l)+'</small><b>'+v+'</b>'+(s?'<em>'+esc(s)+'</em>':'')+'</div>';
const badge=(t,k)=>'<span class="bd '+k+'">'+esc(t)+'</span>';
const txB=s=>s==='completed'?badge('Selesai','ok'):badge('Dibatalkan','bad');
const actB=a=>a?badge('Aktif','ok'):badge('Nonaktif','mute');
const stockB=p=>{const s=+p.stock,m=+p.min_stock;return s<=0?badge('Habis','bad'):s<=m?badge('Stok Rendah','warn'):badge('Aman','ok')};
function tbl(cols,rows,empty){if(!rows.length)return emptyH(empty||'Belum ada data.');
 return '<div class="tw"><table><thead><tr>'+cols.map(c=>'<th class="'+(c.c||'')+'">'+esc(c.h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td data-l="'+esc(c.h)+'" class="'+(c.c||'')+'">'+c.f(r)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
const pager=(total,page,size)=>{const n=Math.max(1,Math.ceil(total/size));return '<div class="pager"><span>'+nf(total)+' data · Halaman '+page+' dari '+n+'</span><span><button class="btn sm" data-pg="'+(page-1)+'" '+(page<=1?'disabled':'')+'>‹ Sebelumnya</button> <button class="btn sm" data-pg="'+(page+1)+'" '+(page>=n?'disabled':'')+'>Berikutnya ›</button></span></div>'};
const bindPager=(el,fn)=>$$('[data-pg]',el).forEach(b=>b.onclick=()=>fn(+b.dataset.pg));
function bars(data,o){o=o||{};const h=170,f=o.fmt||rp;
 if(!data.length||!data.some(d=>d.v>0))return emptyH('Belum ada data pada periode ini.');
 const mx=Math.max.apply(null,data.map(d=>d.v).concat([1])),w=Math.max(data.length*44+16,300);
 return '<div class="chart"><svg viewBox="0 0 '+w+' '+(h+34)+'" width="'+w+'" height="'+(h+34)+'" role="img" aria-label="Grafik batang">'+data.map((d,i)=>{const bh=Math.max(2,Math.max(d.v,0)/mx*h),x=i*44+8;return '<g><title>'+esc(d.l)+': '+esc(f(d.v))+'</title><rect x="'+x+'" y="'+(h-bh+10)+'" width="28" height="'+bh+'" rx="4" fill="#2563EB"></rect><text x="'+(x+14)+'" y="'+(h+26)+'" text-anchor="middle" font-size="10" fill="#64748B">'+esc(d.l)+'</text></g>'}).join('')+'</svg></div>'}
const hbars=(data,f)=>data.length?'<div class="hb">'+data.map(d=>{const mx=Math.max.apply(null,data.map(x=>x.v).concat([1]));return '<div><span>'+esc(d.l)+'</span><i style="width:'+Math.max(2,d.v/mx*100)+'%"></i><b>'+esc((f||rp)(d.v))+'</b></div>'}).join('')+'</div>':emptyH('Belum ada data pada periode ini.');
const rangeHtml=(f,t)=>'<div class="fb"><label>Periode<select data-r="p"><option value="today">Hari ini</option><option value="7d">7 hari terakhir</option><option value="month">Bulan ini</option><option value="custom">Rentang khusus</option></select></label><label>Dari<input type="date" data-r="f" value="'+f+'"></label><label>Sampai<input type="date" data-r="t" value="'+t+'"></label><button class="btn primary" data-r="go">Terapkan</button></div>';
function bindRange(root,cb){const g=k=>$('[data-r="'+k+'"]',root);g('p').value='month';
 const go=()=>{const f=g('f').value,t=g('t').value;if(!f||!t||f>t)return toast('Rentang tanggal tidak valid.','warning');cb(f,t)};
 g('p').onchange=()=>{const v=g('p').value,t=today();if(v==='custom')return;
  if(v==='today'){g('f').value=t;g('t').value=t}else if(v==='7d'){g('f').value=addDays(t,-6);g('t').value=t}else{g('f').value=t.slice(0,8)+'01';g('t').value=t}go()};
 g('go').onclick=go}
const fg=(id,label,input,hint)=>'<div class="fg"><label for="'+id+'">'+label+'</label>'+input+(hint?'<small class="hint">'+hint+'</small>':'')+'<small class="fe" id="'+id+'-e"></small></div>';
const setErr=(m,id,msg)=>{const e=m.$('#'+id+'-e');if(e)e.textContent=msg||'';const i=m.$('#'+id);if(i)i.setAttribute('aria-invalid',msg?'true':'false');return !msg};
const opt=(v,t,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(t)+'</option>';

/* ---------- shell ---------- */
const NAV={admin:[['dashboard','Dashboard','speedometer2'],['pos','Transaksi POS','cart3'],['transactions','Riwayat Transaksi','receipt'],['products','Produk','box-seam'],['categories','Kategori','tags'],['inventory','Manajemen Stok','boxes'],['reports','Laporan Penjualan','graph-up'],['profit-reports','Laporan Keuntungan','cash-coin'],['users','Manajemen Kasir','people'],['shifts','Shift Kasir','clock-history'],['settings','Pengaturan Toko','gear'],['activity-logs','Log Aktivitas','journal-text'],['profile','Profil','person-circle']],
 cashier:[['cashier-dashboard','Dashboard','speedometer2'],['pos','Transaksi POS','cart3'],['transactions','Riwayat Transaksi','receipt'],['shifts','Shift Kasir','clock-history'],['profile','Profil','person-circle']]};
async function logout(){loggingOut=true;try{await sb.rpc('log_event',{p_action:'logout'})}catch(e){}try{await sb.auth.signOut()}catch(e){}location.replace(BASE+'login.html?reason=logout')}
function shell(root,page,title){
 root.innerHTML='<div class="app"><aside class="side" id="side"><div class="brand"><span>🧾</span><b>'+esc((SET&&SET.store_name)||'Kasir')+'</b></div><nav>'+NAV[ME.role].map(n=>'<a href="'+BASE+n[0]+'.html" class="'+(n[0]===page?'on':'')+'"><i class="bi bi-'+n[2]+'"></i><span>'+n[1]+'</span></a>').join('')+'<a href="#" data-logout><i class="bi bi-box-arrow-right"></i><span>Logout</span></a></nav></aside><div class="scrim" id="scrim"></div><div class="main"><header class="top"><button class="btn ghost" id="mnu" aria-label="Buka menu">☰</button><h1>'+esc(title)+'</h1><span class="sp"></span><span class="net" id="net"></span><a class="me" href="'+BASE+'profile.html"><span class="av">'+esc(ini(ME.full_name))+'</span><span class="mn">'+esc(ME.full_name)+'<small>'+(ME.role==='admin'?'Admin/Owner':'Kasir')+'</small></span></a></header><main id="view" class="view"></main></div></div>';
 const side=$('#side'),scr=$('#scrim'),tog=o=>{side.classList.toggle('open',o);scr.classList.toggle('on',o)};
 $('#mnu').onclick=()=>tog(!side.classList.contains('open'));scr.onclick=()=>tog(false);
 $('[data-logout]',root).onclick=e=>{e.preventDefault();logout()};
 const net=()=>{const n=$('#net');if(n)n.textContent=navigator.onLine?'':'⚠ Offline'};
 window.addEventListener('online',net);window.addEventListener('offline',net);net();
 return $('#view')}
const denied=()=>'<div class="state err"><div class="ico">🚫</div><p>Akses ditolak. Anda tidak memiliki izin untuk membuka halaman ini.</p><a class="btn primary" href="'+BASE+(ME&&ME.role==='admin'?'dashboard':'cashier-dashboard')+'.html">Kembali ke Dashboard</a></div>';

/* ================= LOGIN ================= */
async function goHome(id,log){const p=await run(sb.from('profiles').select('*').eq('id',id).maybeSingle());
 if(!p){await sb.auth.signOut();throw new Error('Profil akun tidak ditemukan. Hubungi Admin.')}
 if(!p.is_active){await sb.auth.signOut();throw new Error('Akun Anda dinonaktifkan. Hubungi Admin.')}
 if(log){try{await sb.rpc('log_event',{p_action:'login'})}catch(e){}}
 location.replace(BASE+(p.role==='admin'?'dashboard':'cashier-dashboard')+'.html')}
PAGES.login={pub:true,render(root){
 const q=new URLSearchParams(location.search).get('reason');
 const msg={expired:'Sesi berakhir. Silakan login kembali.',inactive:'Akun Anda dinonaktifkan. Hubungi Admin.',noprofile:'Profil akun tidak ditemukan. Hubungi Admin.',logout:'Anda telah keluar.',need:'Silakan login terlebih dahulu.'}[q];
 root.innerHTML='<div class="login"><div class="lbrand"><div><div class="logo">🧾</div><h1>Aplikasi Kasir</h1><p>Kelola penjualan toko dengan lebih mudah</p></div></div><div class="lform"><form id="lf" novalidate><h2>Masuk</h2>'+(msg?'<div class="alert '+(q==='logout'?'info':'warn')+'">'+msg+'</div>':'')+'<div id="le" class="alert bad" hidden role="alert"></div><div class="fg"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required></div><div class="fg"><label for="pw">Password</label><span class="pw"><input id="pw" type="password" autocomplete="current-password" required><button type="button" class="btn ghost" id="sh" aria-label="Tampilkan atau sembunyikan password">👁</button></span></div><button class="btn primary lg" id="go" type="submit">Masuk</button></form></div></div>';
 const err=$('#le'),btn=$('#go'),show=m=>{err.textContent=m;err.hidden=false};
 $('#sh').onclick=()=>{const i=$('#pw');i.type=i.type==='password'?'text':'password'};
 $('#lf').onsubmit=async e=>{e.preventDefault();err.hidden=true;const em=$('#em').value.trim(),pw=$('#pw').value;
  if(!em||!pw)return show('Email dan password wajib diisi.');
  busy(btn,true,'Memproses...');
  try{const r=await sb.auth.signInWithPassword({email:em,password:pw});
   if(r.error)throw new Error(/invalid/i.test(r.error.message)?'Email atau password salah.':/fetch|network/i.test(r.error.message)?'Koneksi gagal. Periksa internet Anda.':r.error.message);
   await goHome(r.data.user.id,true)}catch(x){show(x.message);busy(btn,false)}}}};

/* ================= SHIFT (dipakai Dashboard Kasir & Shift) ================= */
function openShiftModal(done){
 const m=modal({title:'Buka Shift',body:'<form id="sf" novalidate>'+fg('oc','Uang kas awal (Rp) <span class="req">*</span>','<input id="oc" type="number" min="0" step="any" inputmode="decimal" value="0">')+fg('on','Catatan (opsional)','<input id="on" maxlength="200">')+'</form>',footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Buka Shift</button>'});
 const go=async()=>{const v=m.$('#oc').value,n=Number(v);if(!setErr(m,'oc',v===''||!(n>=0)?'Kas awal wajib diisi dan tidak boleh negatif.':''))return;
  busy(m.$('#sv'),true,'Memproses...');
  try{await run(sb.rpc('open_cashier_shift',{p_opening_cash:n,p_notes:m.$('#on').value.trim()||null}));toast('Shift berhasil dibuka.','success');m.close(true);done()}
  catch(e){toast(e.message,'error');busy(m.$('#sv'),false)}};
 m.$('#sv').onclick=go;m.$('#sf').onsubmit=e=>{e.preventDefault();go()}}

PAGES.shifts={roles:['cashier','admin'],title:'Shift Kasir',async render(v){
 const draw=()=>load(v,async()=>{
  const sm=await run(sb.rpc('shift_summary'));
  v.innerHTML=ph('Shift Kasir','Kelola kas awal, kas akhir, dan selisih kas.')+'<div class="card"><h3>Status shift</h3>'+(sm?
   '<p>'+badge('Aktif','ok')+' &nbsp;'+esc(ME.full_name)+' · mulai '+esc(fdt(sm.opened_at))+' · kas awal <b>'+rp(sm.opening_cash)+'</b></p>'+
   '<div class="kpis">'+stat('Jumlah transaksi',nf(sm.tx_count))+stat('Penjualan tunai',rp(sm.cash_sales))+stat('Penjualan QRIS',rp(sm.qris_sales))+stat('Penjualan transfer',rp(sm.transfer_sales))+stat('Pengembalian tunai',rp(sm.cash_refunds))+stat('Kas yang diharapkan',rp(sm.expected_cash),'Kas awal + tunai − pengembalian')+'</div>'+
   '<h3>Tutup shift</h3><form id="cf" novalidate class="frm">'+fg('cc','Uang kas aktual (Rp) <span class="req">*</span>','<input id="cc" type="number" min="0" step="any" inputmode="decimal">')+'<div class="fg"><label>Selisih</label><div id="df" class="diff">-</div></div>'+fg('cn','Catatan (opsional)','<input id="cn" maxlength="200">')+'<button class="btn danger" id="cl" type="submit">Tutup Shift</button></form>'
   :'<p>'+badge('Belum dibuka','mute')+' Anda belum memiliki shift aktif.</p><button class="btn primary" id="op">Buka Shift</button>')+'</div><div class="card"><h3>Riwayat shift</h3><div id="hs"></div></div>';
  if(!sm)$('#op',v).onclick=()=>openShiftModal(draw);
  else{const cc=$('#cc',v),df=$('#df',v);cc.oninput=()=>{if(cc.value===''){df.textContent='-';df.className='diff';return}const d=Number(cc.value)-Number(sm.expected_cash);df.textContent=(d===0?'Sesuai':d>0?'Lebih ':'Kurang ')+(d===0?'':rp(Math.abs(d)));df.className='diff '+(d===0?'ok':d>0?'warn':'bad')};
   $('#cf',v).onsubmit=async e=>{e.preventDefault();const val=cc.value,n=Number(val);
    if(val===''||!(n>=0)){$('#cc-e',v).textContent='Kas aktual wajib diisi dan tidak boleh negatif.';return}$('#cc-e',v).textContent='';
    if(!await ask('Tutup shift?','Shift ditutup dengan kas aktual '+rp(n)+'. Setelah ditutup, shift tidak dapat menerima transaksi baru.','Ya, tutup shift',true))return;
    busy($('#cl',v),true,'Memproses...');
    try{const r=await run(sb.rpc('close_cashier_shift',{p_closing_cash:n,p_notes:$('#cn',v).value.trim()||null}));toast('Shift ditutup. Selisih kas: '+rp(r.cash_difference),'success');draw()}
    catch(x){toast(x.message,'error');busy($('#cl',v),false)}}}
  hist(1)});
 const hist=async pg=>{const z=$('#hs',v);z.innerHTML=loadingH();
  try{const r=await runc(sb.from('shifts').select('*,profiles(full_name)',{count:'exact'}).order('opened_at',{ascending:false}).range((pg-1)*15,pg*15-1));
   const df=s=>s.cash_difference==null?'-':(+s.cash_difference===0?'Sesuai':(+s.cash_difference>0?'Lebih ':'Kurang ')+rp(Math.abs(s.cash_difference)));
   z.innerHTML=tbl([{h:'Nomor',f:s=>esc(s.shift_number)},{h:'Kasir',f:s=>esc((s.profiles||{}).full_name)},{h:'Buka',f:s=>esc(fdt(s.opened_at))},{h:'Tutup',f:s=>esc(fdt(s.closed_at))},{h:'Kas awal',c:'r',f:s=>rp(s.opening_cash)},{h:'Kas diharapkan',c:'r',f:s=>s.expected_cash==null?'-':rp(s.expected_cash)},{h:'Kas aktual',c:'r',f:s=>s.closing_cash==null?'-':rp(s.closing_cash)},{h:'Selisih',c:'r',f:s=>esc(df(s))},{h:'Status',f:s=>s.status==='open'?badge('Aktif','ok'):badge('Ditutup','mute')},{h:'Aksi',f:s=>'<button class="btn sm" data-sd="'+s.id+'">Detail</button>'}],r.data,'Belum ada riwayat shift.')+pager(r.count||0,pg,15);
   bindPager(z,hist);
   $$('[data-sd]',z).forEach(b=>b.onclick=async()=>{try{const s=await run(sb.rpc('shift_summary',{p_shift_id:b.dataset.sd}));
    modal({title:'Detail Shift',nodirty:true,nofocus:true,body:'<div class="kpis">'+stat('Transaksi',nf(s.tx_count))+stat('Tunai',rp(s.cash_sales))+stat('QRIS',rp(s.qris_sales))+stat('Transfer',rp(s.transfer_sales))+stat('Pengembalian tunai',rp(s.cash_refunds))+stat('Kas diharapkan',rp(s.expected_cash))+'</div>',footer:'<button class="btn" data-x>Tutup</button>'})}catch(e){toast(e.message,'error')}})}
  catch(e){z.innerHTML=errH(e.message);$('[data-retry]',z).onclick=()=>hist(pg)}};
 draw()}};

/* ================= DASHBOARD ADMIN ================= */
PAGES.dashboard={roles:['admin'],title:'Dashboard',async render(v){
 const t=today(),f0=t.slice(0,8)+'01';
 v.innerHTML=ph('Halo, '+first(ME.full_name),fdate(new Date().toISOString()),'<a class="btn primary" href="'+BASE+'pos.html">Buka POS</a>')+rangeHtml(f0,t)+'<div id="dz"></div>';
 const z=$('#dz',v);
 const draw=(f,to)=>load(z,async()=>{
  const [s,p,prods,rec]=await Promise.all([run(sb.rpc('get_sales_summary',{p_from:f,p_to:to})),run(sb.rpc('get_profit_summary',{p_from:f,p_to:to})),all(()=>sb.from('products').select('id,product_name,sku,stock,min_stock,unit,is_active').order('product_name')),run(sb.from('transactions').select('id,invoice_number,created_at,total_amount,status,profiles!transactions_user_id_fkey(full_name)').order('created_at',{ascending:false}).limit(8))]);
  const act=prods.filter(x=>x.is_active),low=act.filter(x=>+x.stock<=+x.min_stock);
  z.innerHTML='<div class="kpis">'+stat('Total omzet',rp(s.revenue))+stat('Jumlah transaksi',nf(s.tx_count))+stat('Produk terjual',nf(s.items_sold))+stat('Keuntungan kotor',rp(p.gross_profit),'Bukan laba bersih')+stat('Produk aktif',nf(act.length))+stat('Stok rendah',nf(low.length),low.length?'Perlu restok':'Aman')+'</div>'+
  '<div class="card"><h3>Grafik penjualan</h3>'+bars((s.daily||[]).map(d=>({l:d.day.slice(8)+'/'+d.day.slice(5,7),v:+d.revenue})))+'</div>'+
  '<div class="cols"><div class="card"><h3>Transaksi terbaru</h3>'+tbl([{h:'Invoice',f:r=>esc(r.invoice_number)},{h:'Tanggal',f:r=>esc(fdt(r.created_at))},{h:'Kasir',f:r=>esc((r.profiles||{}).full_name)},{h:'Total',c:'r',f:r=>rp(r.total_amount)},{h:'Status',f:r=>txB(r.status)},{h:'Aksi',f:r=>'<a class="btn sm" href="'+BASE+'transactions.html?inv='+encodeURIComponent(r.invoice_number)+'">Lihat</a>'}],rec,'Belum ada transaksi.')+'</div>'+
  '<div class="card"><h3>Produk terlaris</h3>'+tbl([{h:'Produk',f:r=>esc(r.product_name)},{h:'Terjual',c:'r',f:r=>nf(r.qty)},{h:'Omzet',c:'r',f:r=>rp(r.revenue)}],s.top_products||[],'Belum ada penjualan pada periode ini.')+'</div></div>'+
  '<div class="card"><h3>Peringatan stok</h3>'+tbl([{h:'Produk',f:r=>esc(r.product_name)},{h:'Stok sekarang',c:'r',f:r=>nf(r.stock)+' '+esc(r.unit)},{h:'Stok minimum',c:'r',f:r=>nf(r.min_stock)},{h:'Status',f:r=>stockB(r)},{h:'Aksi',f:()=>'<a class="btn sm" href="'+BASE+'inventory.html">Kelola stok</a>'}],low,'Semua stok aman.')+'</div>'});
 bindRange(v,draw);draw(f0,t)}};

/* ================= DASHBOARD KASIR ================= */
PAGES['cashier-dashboard']={roles:['cashier','admin'],title:'Dashboard Kasir',async render(v){
 const draw=()=>load(v,async()=>{
  const t=today(),ab=rng(t,t);
  const [sm,txs,rec]=await Promise.all([run(sb.rpc('shift_summary')),run(sb.from('transactions').select('total_amount,transaction_items(quantity)').eq('user_id',ME.id).eq('status','completed').gte('created_at',ab[0]).lt('created_at',ab[1])),run(sb.from('transactions').select('id,invoice_number,created_at,total_amount,status').eq('user_id',ME.id).order('created_at',{ascending:false}).limit(8))]);
  const tot=txs.reduce((a,x)=>a+Number(x.total_amount),0),items=txs.reduce((a,x)=>a+(x.transaction_items||[]).reduce((b,i)=>b+Number(i.quantity),0),0);
  v.innerHTML=ph('Halo, '+first(ME.full_name),fdate(new Date().toISOString())+' · '+ftime(new Date().toISOString()))+
  '<div class="card"><h3>Status shift</h3>'+(sm?'<p>'+badge('Aktif','ok')+' Mulai '+esc(fdt(sm.opened_at))+' · kas awal <b>'+rp(sm.opening_cash)+'</b></p><a class="btn" href="'+BASE+'shifts.html">Lihat / Tutup Shift</a>':'<p>'+badge('Belum dibuka','mute')+' Buka shift untuk mulai bertransaksi.</p><button class="btn primary" id="os">Buka Shift</button>')+'</div>'+
  '<div class="kpis">'+stat('Transaksi hari ini',nf(txs.length))+stat('Penjualan pribadi hari ini',rp(tot))+stat('Item terjual',nf(items))+'</div>'+
  '<div class="card"><h3>Aksi cepat</h3><div class="acts"><a class="btn primary" href="'+BASE+'pos.html">Transaksi Baru</a><a class="btn" href="'+BASE+'transactions.html">Riwayat Transaksi</a><a class="btn" href="'+BASE+'shifts.html">Kelola Shift</a></div></div>'+
  '<div class="card"><h3>Transaksi terbaru</h3>'+tbl([{h:'Invoice',f:r=>esc(r.invoice_number)},{h:'Waktu',f:r=>esc(fdt(r.created_at))},{h:'Total',c:'r',f:r=>rp(r.total_amount)},{h:'Status',f:r=>txB(r.status)},{h:'Aksi',f:r=>'<a class="btn sm" href="'+BASE+'receipt.html?id='+r.id+'">Lihat struk</a>'}],rec,'Belum ada transaksi.')+'</div>';
  const o=$('#os',v);if(o)o.onclick=()=>openShiftModal(draw)});
 draw()}};

/* ================= POS ================= */
PAGES.pos={roles:['cashier','admin'],title:'Transaksi POS',async render(v){await load(v,async()=>{
 const S=await getSettings(),mk=()=>sb.from('products').select('id,category_id,sku,barcode,product_name,image_url,selling_price,stock,unit').eq('is_active',true).order('product_name');
 const [p0,cats,sm]=await Promise.all([all(mk),run(sb.from('categories').select('id,category_name').eq('is_active',true).order('category_name')),run(sb.rpc('shift_summary'))]);
 let prods=p0,PM=new Map(prods.map(p=>[p.id,p]));const cart=new Map(),st={cat:'',q:'',disc:0,idem:null},hasShift=!!sm,neg=!!S.allow_negative_stock;
 try{JSON.parse(sessionStorage.getItem('kasir_cart')||'[]').forEach(a=>{if(PM.has(a[0])&&a[1]>0)cart.set(a[0],a[1])})}catch(e){}
 const sv=()=>{try{sessionStorage.setItem('kasir_cart',JSON.stringify(Array.from(cart.entries())))}catch(e){}};
 v.innerHTML='<div class="pos"><section class="catalog"><div class="posh"><span>Kasir: <b>'+esc(ME.full_name)+'</b></span>'+(hasShift?badge('Shift Aktif','ok'):badge('Shift belum dibuka','bad'))+'<span id="clk"></span></div>'+(hasShift?'':'<div class="alert warn">Shift belum dibuka. Transaksi tidak dapat diselesaikan sebelum shift dibuka. <a href="'+BASE+'shifts.html"><b>Buka Shift</b></a></div>')+'<input id="sq" class="search" type="search" placeholder="Cari nama produk, SKU, atau scan barcode" autocomplete="off" aria-label="Cari produk"><div class="chips" id="chips"></div><div class="grid" id="grid"></div></section><aside class="cart" id="cart"><div class="ch"><h3>Keranjang</h3><button class="btn ghost sm mob" id="cx" aria-label="Tutup keranjang">✕</button></div><div id="ci" class="ci"></div><div class="cs" id="cs"><div><span>Subtotal</span><b id="st">-</b></div>'+(S.allow_discount?'<div><label for="dc">Diskon (Rp)</label><input id="dc" type="number" min="0" step="any" inputmode="decimal" placeholder="0"></div>':'')+(S.tax_enabled?'<div><span>Pajak ('+nf(S.tax_percentage)+'%)</span><b id="tx">-</b></div>':'')+'<div class="tt"><span>Total</span><b id="tt">-</b></div><div class="acts"><button class="btn" id="clr">Kosongkan</button><button class="btn primary lg" id="pay">Bayar</button></div></div></aside></div><button class="cfab" id="fab"><span id="fn">0 item</span><b id="ft">Rp 0</b><span>Lihat Keranjang ›</span></button>';
 const calc=()=>{let sub=0;cart.forEach((q,id)=>{const p=PM.get(id);if(p)sub+=q*Number(p.selling_price)});sub=r2(sub);
  const disc=S.allow_discount?Math.min(Math.max(Number(st.disc)||0,0),sub):0,tax=S.tax_enabled?r2((sub-disc)*Number(S.tax_percentage)/100):0;return{sub,disc,tax,total:r2(sub-disc+tax)}};
 const nItems=()=>{let n=0;cart.forEach(q=>{n+=q});return n};
 const sum=()=>{const c=calc();$('#st').textContent=rp(c.sub);$('#tt').textContent=rp(c.total);const t=$('#tx');if(t)t.textContent=rp(c.tax);$('#fn').textContent=nf(nItems())+' item';$('#ft').textContent=rp(c.total);$('#pay').disabled=!cart.size};
 const drawCart=()=>{st.idem=null;const z=$('#ci');
  z.innerHTML=cart.size?Array.from(cart.entries()).map(a=>{const p=PM.get(a[0]);return '<div class="it"><div class="in"><b>'+esc(p.product_name)+'</b><small>'+rp(p.selling_price)+' / '+esc(p.unit)+'</small></div><div class="qty"><button class="btn sm" data-dec="'+p.id+'" aria-label="Kurangi">−</button><input type="number" step="any" min="0" value="'+a[1]+'" data-q="'+p.id+'" aria-label="Kuantitas '+esc(p.product_name)+'"><button class="btn sm" data-inc="'+p.id+'" aria-label="Tambah">+</button></div><div class="is"><b>'+rp(a[1]*Number(p.selling_price))+'</b><button class="btn ghost sm" data-del="'+p.id+'" aria-label="Hapus">🗑</button></div></div>'}).join(''):emptyH('Keranjang masih kosong.');
  sum();sv()};
 const add=(id,d)=>{const p=PM.get(id);if(!p)return;const nq=r2((cart.get(id)||0)+d);
  if(nq<=0){cart.delete(id)}else{if(!neg&&nq>Number(p.stock)){toast('Stok '+p.product_name+' tidak cukup (tersisa '+nf(p.stock)+').','warning');return}cart.set(id,nq)}drawCart()};
 const drawGrid=()=>{const q=st.q.toLowerCase(),l=prods.filter(p=>(!st.cat||p.category_id===st.cat)&&(!q||p.product_name.toLowerCase().includes(q)||String(p.sku).toLowerCase().includes(q)||String(p.barcode||'').toLowerCase().includes(q)));
  $('#grid').innerHTML=l.length?l.map(p=>{const out=Number(p.stock)<=0&&!neg;return '<div class="pc'+(out?' out':'')+'"><div class="pi">'+(p.image_url?'<img src="'+esc(p.image_url)+'" alt="" loading="lazy">':'📦')+'</div><b>'+esc(p.product_name)+'</b><span class="pp">'+rp(p.selling_price)+'</span><small>'+(out?badge('Stok habis','bad'):'Stok: '+nf(p.stock)+' '+esc(p.unit))+'</small><button class="btn primary sm" data-add="'+p.id+'" '+(out?'disabled':'')+'>+ Tambah</button></div>'}).join(''):emptyH('Produk tidak ditemukan.')};
 $('#chips').innerHTML='<button class="chip on" data-c="">Semua</button>'+cats.map(c=>'<button class="chip" data-c="'+c.id+'">'+esc(c.category_name)+'</button>').join('');
 $('#chips').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;st.cat=b.dataset.c;$$('.chip',v).forEach(x=>x.classList.toggle('on',x===b));drawGrid()};
 $('#grid').onclick=e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add,1)};
 const sq=$('#sq');sq.oninput=()=>{st.q=sq.value.trim();drawGrid()};
 sq.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const q=sq.value.trim().toLowerCase();if(!q)return;
  let m=prods.find(p=>String(p.barcode||'').toLowerCase()===q||String(p.sku).toLowerCase()===q);
  if(!m){const l=prods.filter(p=>p.product_name.toLowerCase().includes(q));if(l.length===1)m=l[0]}
  if(m){add(m.id,1);sq.value='';st.q='';drawGrid()}else toast('Produk tidak ditemukan.','warning')};
 $('#ci').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.inc)add(b.dataset.inc,1);else if(b.dataset.dec)add(b.dataset.dec,-1);else if(b.dataset.del){cart.delete(b.dataset.del);drawCart()}};
 $('#ci').onchange=e=>{const i=e.target.closest('[data-q]');if(!i)return;const id=i.dataset.q,n=Number(i.value),p=PM.get(id);
  if(!(n>0)){toast('Kuantitas harus lebih dari nol.','warning');i.value=cart.get(id);return}
  if(!neg&&n>Number(p.stock)){toast('Stok '+p.product_name+' tidak cukup (tersisa '+nf(p.stock)+').','warning');i.value=cart.get(id);return}
  cart.set(id,n);drawCart()};
 const dc=$('#dc');if(dc)dc.oninput=()=>{st.disc=dc.value;st.idem=null;sum()};
 $('#clr').onclick=async()=>{if(cart.size&&await ask('Kosongkan keranjang?','Semua item di keranjang akan dihapus.','Ya, kosongkan',true)){cart.clear();drawCart()}};
 $('#fab').onclick=()=>$('#cart').classList.add('open');$('#cx').onclick=()=>$('#cart').classList.remove('open');
 const clk=()=>{const c=$('#clk');if(c)c.textContent=ftime(new Date().toISOString())};clk();setInterval(clk,30000);
 const refresh=async()=>{try{prods=await all(mk);PM=new Map(prods.map(p=>[p.id,p]));Array.from(cart.keys()).forEach(id=>{if(!PM.has(id))cart.delete(id)});drawGrid();drawCart();toast('Stok berubah. Silakan tinjau kembali keranjang.','warning')}catch(e){}};
 $('#pay').onclick=()=>{
  if(!cart.size)return toast('Keranjang masih kosong.','warning');
  if(!hasShift)return toast('Shift belum dibuka. Buka shift terlebih dahulu.','warning');
  const ms=[['cash',S.pay_cash],['qris',S.pay_qris],['transfer',S.pay_transfer]].filter(x=>x[1]).map(x=>x[0]);
  if(!ms.length)return toast('Tidak ada metode pembayaran aktif. Hubungi Admin.','error');
  const c=calc();st.idem=st.idem||uid();
  const m=modal({title:'Pembayaran',nodirty:true,nofocus:true,body:'<div class="sum2"><div><small>Total transaksi</small><b>'+rp(c.total)+'</b></div><div><small>Jumlah item</small><b>'+nf(nItems())+'</b></div></div><div class="meth">'+ms.map((k,i)=>'<label class="mc"><input type="radio" name="pm" value="'+k+'"'+(i?'':' checked')+'><span>'+MT[k]+'</span></label>').join('')+'</div><div id="pz"></div><div id="pe" class="alert bad" hidden role="alert"></div>',footer:'<button class="btn" data-x>Kembali</button><button class="btn primary" id="fin" disabled>Selesaikan Transaksi</button>'});
  const kind=()=>$('input[name=pm]:checked',m.el).value;
  const draw=()=>{const k=kind(),z=m.$('#pz');
   if(k==='cash'){const q=[20000,50000,100000].filter(x=>x>=c.total);
    z.innerHTML='<div class="fg"><label for="rc">Nominal diterima (Rp)</label><input id="rc" type="number" min="0" step="any" inputmode="decimal" placeholder="0"><div class="quick"><button type="button" class="btn sm" data-qa="'+c.total+'">Uang pas</button>'+q.map(x=>'<button type="button" class="btn sm" data-qa="'+x+'">'+nf(x)+'</button>').join('')+'</div></div><div class="chg">Kembalian: <b id="cg">'+rp(0)+'</b></div>';
    const i=m.$('#rc'),up=()=>{const r=Number(i.value)||0;m.$('#cg').textContent=rp(Math.max(r-c.total,0));m.$('#fin').disabled=!(r>=c.total)};
    i.oninput=up;$$('[data-qa]',z).forEach(b=>b.onclick=()=>{i.value=b.dataset.qa;up()});setTimeout(()=>i.focus(),40);up()}
   else{z.innerHTML='<div class="alert info">'+(k==='qris'?'Pelanggan membayar melalui QRIS toko yang tersedia di luar aplikasi. Periksa pembayaran melalui aplikasi merchant Anda.':'Pelanggan mentransfer ke rekening toko. Periksa mutasi melalui aplikasi bank Anda.')+' Aplikasi ini tidak memverifikasi pembayaran secara otomatis.</div>'+(k==='transfer'&&S.bank_info?'<div class="bank">'+esc(S.bank_info)+'</div>':'')+'<label class="ck"><input type="checkbox" id="cf"> Saya sudah memeriksa dan memastikan pembayaran diterima</label><div class="fg"><label for="nt">Catatan / referensi (opsional)</label><input id="nt" maxlength="200"></div>';
    const cf=m.$('#cf');m.$('#fin').disabled=true;cf.onchange=()=>{m.$('#fin').disabled=!cf.checked}}};
  $$('input[name=pm]',m.el).forEach(r=>r.onchange=draw);draw();
  m.$('#fin').onclick=async()=>{const k=kind(),b=m.$('#fin'),pe=m.$('#pe');pe.hidden=true;busy(b,true,'Memproses...');
   const note=k==='cash'?null:(m.$('#nt').value.trim()||null);
   try{const r=await run(sb.rpc('process_sale',{p_items:Array.from(cart.entries()).map(a=>({product_id:a[0],quantity:a[1]})),p_payment_method:k,p_amount_received:k==='cash'?Number(m.$('#rc').value):null,p_discount:c.disc,p_additional_fee:0,p_manual_confirmed:k!=='cash',p_note:note,p_idempotency_key:st.idem}));
    cart.clear();sv();location.href=BASE+'receipt.html?id='+encodeURIComponent(r.transaction_id)+'&from=pos'}
   catch(e){busy(b,false);pe.textContent=e.message+(/koneksi/i.test(e.message)?' Transaksi belum tentu tersimpan; coba lagi, sistem mencegah transaksi ganda.':'');pe.hidden=false;if(/stok|produk/i.test(e.message)){m.close(true);refresh()}}}};
 drawGrid();drawCart();sq.focus()})}};

/* ================= STRUK ================= */
PAGES.receipt={roles:['cashier','admin'],bare:true,async render(root){
 root.classList.add('rcpage');
 await load(root,async()=>{
  const q=new URLSearchParams(location.search),id=q.get('id');if(!id)throw new Error('ID transaksi tidak ditemukan pada alamat halaman.');
  const [tx,S]=await Promise.all([run(sb.from('transactions').select('*,transaction_items(*),payments(*),profiles!transactions_user_id_fkey(full_name)').eq('id',id).maybeSingle()),getSettings(true)]);
  if(!tx)throw new Error('Transaksi tidak ditemukan atau Anda tidak berhak melihatnya.');
  const pay=(tx.payments||[])[0]||{},fromPos=q.get('from')==='pos',w=S.receipt_width==='58mm'?'w58':'w80';
  root.innerHTML='<div class="rtool"><a class="btn" href="'+BASE+(fromPos?'pos':'transactions')+'.html">'+(fromPos?'+ Transaksi Baru':'‹ Kembali ke Riwayat')+'</a><label>Lebar struk <select id="rw"><option value="w58"'+(w==='w58'?' selected':'')+'>58 mm</option><option value="w80"'+(w==='w80'?' selected':'')+'>80 mm</option></select></label><button class="btn primary" id="pr">🖨 Cetak</button></div>'+(fromPos?'<div class="alert ok rtool">Transaksi berhasil disimpan.</div>':'')+
  '<div class="receipt '+w+'" id="rc">'+(S.logo_url?'<img class="rl" src="'+esc(S.logo_url)+'" alt="">':'')+'<h4>'+esc(S.store_name)+'</h4>'+(S.address?'<p>'+esc(S.address)+'</p>':'')+(S.phone?'<p>Telp: '+esc(S.phone)+'</p>':'')+(S.receipt_header?'<p>'+esc(S.receipt_header)+'</p>':'')+'<hr>'+(tx.status==='cancelled'?'<p class="rv"><b>*** DIBATALKAN ***</b></p>':'')+'<div class="rr"><span>Invoice</span><span>'+esc(tx.invoice_number)+'</span></div><div class="rr"><span>Tanggal</span><span>'+esc(fdt(tx.created_at))+'</span></div><div class="rr"><span>Kasir</span><span>'+esc((tx.profiles||{}).full_name)+'</span></div><hr>'+
  (tx.transaction_items||[]).map(i=>'<div class="ri"><div>'+esc(i.product_name)+'</div><div class="rr"><span>'+nf(i.quantity)+' × '+nf(i.unit_price,2)+'</span><span>'+nf(i.subtotal,2)+'</span></div></div>').join('')+'<hr>'+
  '<div class="rr"><span>Subtotal</span><span>'+rp(tx.subtotal)+'</span></div>'+(+tx.discount_amount?'<div class="rr"><span>Diskon</span><span>-'+rp(tx.discount_amount)+'</span></div>':'')+(+tx.tax_amount?'<div class="rr"><span>Pajak</span><span>'+rp(tx.tax_amount)+'</span></div>':'')+(+tx.additional_fee?'<div class="rr"><span>Biaya tambahan</span><span>'+rp(tx.additional_fee)+'</span></div>':'')+'<div class="rr tot"><span>TOTAL</span><span>'+rp(tx.total_amount)+'</span></div><hr>'+
  '<div class="rr"><span>Metode</span><span>'+esc(MT[pay.payment_method]||'-')+'</span></div><div class="rr"><span>Diterima</span><span>'+rp(pay.amount_received)+'</span></div><div class="rr"><span>Kembalian</span><span>'+rp(pay.change_amount)+'</span></div><hr><p class="rf">'+esc(S.receipt_footer||'Terima kasih telah berbelanja')+'</p></div>';
  $('#rw').onchange=e=>{$('#rc').className='receipt '+e.target.value};
  $('#pr').onclick=()=>window.print()})}};

/* ================= RIWAYAT TRANSAKSI ================= */
PAGES.transactions={roles:['cashier','admin'],title:'Riwayat Transaksi',async render(v){
 const isA=ME.role==='admin',t=today(),qs=new URLSearchParams(location.search);
 const S={f:addDays(t,-29),t:t,inv:qs.get('inv')||'',method:'',status:'',cashier:'',page:1};let cashiers=[];
 if(isA){try{cashiers=await run(sb.from('profiles').select('id,full_name').order('full_name'))}catch(e){}}
 v.innerHTML=ph('Riwayat Transaksi',isA?'Seluruh transaksi toko.':'Transaksi yang Anda proses.')+
 '<div class="fb"><label>Dari<input type="date" id="ff" value="'+S.f+'"></label><label>Sampai<input type="date" id="ft" value="'+S.t+'"></label><label>Invoice<input id="fi" placeholder="Nomor invoice" value="'+esc(S.inv)+'"></label><label>Metode<select id="fm"><option value="">Semua</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer Bank</option></select></label><label>Status<select id="fs"><option value="">Semua</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>'+(isA?'<label>Kasir<select id="fc"><option value="">Semua</option>'+cashiers.map(c=>opt(c.id,c.full_name)).join('')+'</select></label>':'')+'<button class="btn primary" id="fa">Terapkan</button></div><div id="tsum"></div><div id="tl"></div>';
 const z=$('#tl',v);
 const draw=()=>load(z,async()=>{
  const ab=rng(S.f,S.t),ap=q=>{q=q.gte('created_at',ab[0]).lt('created_at',ab[1]);if(S.inv)q=q.ilike('invoice_number','%'+S.inv+'%');if(S.status)q=q.eq('status',S.status);if(S.cashier)q=q.eq('user_id',S.cashier);if(S.method)q=q.eq('payments.payment_method',S.method);return q};
  const sel='id,invoice_number,created_at,total_amount,status,profiles!transactions_user_id_fkey(full_name),payments'+(S.method?'!inner':'')+'(payment_method)';
  const [r,tot]=await Promise.all([runc(ap(sb.from('transactions').select(sel,{count:'exact'})).order('created_at',{ascending:false}).range((S.page-1)*20,S.page*20-1)),run(sb.rpc('get_transaction_totals',{p_from:ab[0],p_to:ab[1],p_status:S.status||null,p_user:S.cashier||null,p_method:S.method||null,p_inv:S.inv||null}))]);
  $('#tsum',v).innerHTML='<div class="kpis">'+stat('Jumlah transaksi',nf(tot.count))+stat('Total omzet (selesai)',rp(tot.revenue))+stat('Transaksi dibatalkan',nf(tot.cancelled))+'</div>';
  z.innerHTML=tbl([{h:'Invoice',f:x=>esc(x.invoice_number)},{h:'Tanggal',f:x=>esc(fdt(x.created_at))}].concat(isA?[{h:'Kasir',f:x=>esc((x.profiles||{}).full_name)}]:[]).concat([{h:'Metode',f:x=>esc(MT[((x.payments||[])[0]||{}).payment_method]||'-')},{h:'Total',c:'r',f:x=>rp(x.total_amount)},{h:'Status',f:x=>txB(x.status)},{h:'Aksi',f:x=>'<button class="btn sm" data-d="'+x.id+'">Detail</button> <a class="btn sm" href="'+BASE+'receipt.html?id='+x.id+'">Struk</a>'}]),r.data,'Tidak ada transaksi yang cocok dengan filter.')+pager(r.count||0,S.page,20);
  bindPager(z,p=>{S.page=p;draw()});$$('[data-d]',z).forEach(b=>b.onclick=()=>detail(b.dataset.d))});
 const detail=async id=>{try{
  const x=await run(sb.from('transactions').select('*,transaction_items(*),payments(*),profiles!transactions_user_id_fkey(full_name),canc:profiles!transactions_cancelled_by_fkey(full_name)').eq('id',id).maybeSingle());
  if(!x)throw new Error('Transaksi tidak ditemukan.');const p=(x.payments||[])[0]||{};
  const m=modal({title:'Detail '+x.invoice_number,size:'lg',nodirty:true,nofocus:true,body:'<p>'+txB(x.status)+' · '+esc(fdt(x.created_at))+' · Kasir: <b>'+esc((x.profiles||{}).full_name)+'</b></p>'+tbl([{h:'Produk',f:i=>esc(i.product_name)+'<br><small>'+esc(i.sku||'')+'</small>'},{h:'Qty',c:'r',f:i=>nf(i.quantity)},{h:'Harga',c:'r',f:i=>rp(i.unit_price)},{h:'Subtotal',c:'r',f:i=>rp(i.subtotal)}],x.transaction_items||[])+
   '<div class="dl"><div><span>Subtotal</span><b>'+rp(x.subtotal)+'</b></div><div><span>Diskon</span><b>'+rp(x.discount_amount)+'</b></div><div><span>Pajak</span><b>'+rp(x.tax_amount)+'</b></div><div><span>Total</span><b>'+rp(x.total_amount)+'</b></div><div><span>Metode</span><b>'+esc(MT[p.payment_method]||'-')+'</b></div><div><span>Diterima</span><b>'+rp(p.amount_received)+'</b></div><div><span>Kembalian</span><b>'+rp(p.change_amount)+'</b></div><div><span>Status bayar</span><b>'+(p.payment_status==='refunded'?'Dikembalikan':'Dibayar')+'</b></div>'+(p.verified_by?'<div><span>Dikonfirmasi manual oleh kasir</span><b>Ya</b></div>':'')+(p.verification_note?'<div><span>Catatan/referensi</span><b>'+esc(p.verification_note)+'</b></div>':'')+'</div>'+
   (x.status==='cancelled'?'<div class="alert bad"><b>Dibatalkan</b> pada '+esc(fdt(x.cancelled_at))+' oleh '+esc((x.canc||{}).full_name||'-')+'.<br>Alasan: '+esc(x.cancellation_reason)+'</div>':''),
   footer:'<button class="btn" data-x>Tutup</button><a class="btn" href="'+BASE+'receipt.html?id='+x.id+'">Cetak ulang struk</a>'+(isA&&x.status==='completed'?'<button class="btn danger" id="cn">Batalkan Transaksi</button>':'')});
  const c=m.$('#cn');if(c)c.onclick=()=>{m.close(true);cancel(x)}}catch(e){toast(e.message,'error')}};
 const cancel=x=>{const m=modal({title:'Batalkan '+x.invoice_number,body:'<div class="alert warn">Transaksi tidak dihapus; statusnya menjadi Dibatalkan dan tercatat di log audit.</div>'+fg('cr','Alasan pembatalan <span class="req">*</span>','<textarea id="cr" rows="3" maxlength="300"></textarea>')+'<label class="ck"><input type="checkbox" id="rs" checked> Kembalikan stok barang ke persediaan</label>',footer:'<button class="btn" data-x>Batal</button><button class="btn danger" id="go">Batalkan Transaksi</button>'});
  m.$('#go').onclick=async()=>{const r=m.$('#cr').value.trim();if(!setErr(m,'cr',r?'':'Alasan pembatalan wajib diisi.'))return;
   if(!await ask('Yakin membatalkan transaksi?','Tindakan ini tidak dapat diurungkan.','Ya, batalkan',true))return;
   busy(m.$('#go'),true,'Memproses...');
   try{await run(sb.rpc('cancel_sale',{p_transaction_id:x.id,p_reason:r,p_restock:m.$('#rs').checked}));toast('Transaksi dibatalkan.','success');m.close(true);draw()}
   catch(e){toast(e.message,'error');busy(m.$('#go'),false)}}};
 const apply=()=>{const f=$('#ff',v).value,to=$('#ft',v).value;if(!f||!to||f>to)return toast('Rentang tanggal tidak valid.','warning');S.f=f;S.t=to;S.inv=$('#fi',v).value.trim();S.method=$('#fm',v).value;S.status=$('#fs',v).value;S.cashier=isA?$('#fc',v).value:'';S.page=1;draw()};
 $('#fa',v).onclick=apply;$('#fi',v).onkeydown=e=>{if(e.key==='Enter')apply()};
 if(S.inv)S.f=addDays(t,-365);$('#ff',v).value=S.f;draw()}};

/* ================= PRODUK ================= */
function productForm(prod,cats,done){const e=!!prod,pv=k=>esc(prod&&prod[k]!=null?prod[k]:'');
 const m=modal({title:e?'Ubah Produk':'Tambah Produk',size:'lg',body:'<form id="pf" novalidate class="fgrid">'+
  fg('pn','Nama produk <span class="req">*</span>','<input id="pn" maxlength="150" value="'+pv('product_name')+'">')+fg('sk','SKU <span class="req">*</span>','<input id="sk" maxlength="60" value="'+pv('sku')+'">','Harus unik.')+fg('bc','Barcode','<input id="bc" maxlength="60" value="'+pv('barcode')+'">','Opsional, harus unik jika diisi.')+
  fg('ct','Kategori','<select id="ct"><option value="">Tanpa kategori</option>'+cats.map(c=>opt(c.id,c.category_name+(c.is_active?'':' (nonaktif)'),prod&&prod.category_id===c.id)).join('')+'</select>')+
  fg('pp','Harga beli / HPP (Rp) <span class="req">*</span>','<input id="pp" type="number" min="0" step="any" inputmode="decimal" value="'+pv('purchase_price')+'">')+fg('sp','Harga jual (Rp) <span class="req">*</span>','<input id="sp" type="number" min="0" step="any" inputmode="decimal" value="'+pv('selling_price')+'">')+
  (e?fg('sx','Stok saat ini','<input id="sx" value="'+nf(prod.stock)+'" disabled>','Ubah stok melalui menu Manajemen Stok agar tercatat.'):fg('sx','Stok awal','<input id="sx" type="number" min="0" step="any" inputmode="decimal" value="0">'))+
  fg('ms','Stok minimum','<input id="ms" type="number" min="0" step="any" inputmode="decimal" value="'+(e?pv('min_stock'):'0')+'">')+fg('un','Satuan','<input id="un" maxlength="20" value="'+(e?pv('unit'):'pcs')+'">','Contoh: pcs, kg, botol.')+
  fg('im','Gambar produk','<input id="im" type="file" accept="image/*">',prod&&prod.image_url?'Gambar saat ini tersimpan. Pilih file baru untuk mengganti.':'Maksimal 2 MB.')+
  fg('ds','Deskripsi','<textarea id="ds" rows="2">'+pv('description')+'</textarea>')+'<label class="ck"><input type="checkbox" id="ac"'+(!e||prod.is_active?' checked':'')+'> Produk aktif</label></form>',
  footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Simpan</button>'});
 const num=id=>{const s=m.$('#'+id).value;return s===''?NaN:Number(s)};
 m.$('#sv').onclick=async()=>{
  const name=m.$('#pn').value.trim(),sku=m.$('#sk').value.trim(),pp=num('pp'),sp=num('sp'),mn=num('ms'),sx=e?0:num('sx'),f=m.$('#im').files[0];
  let ok=true;ok=setErr(m,'pn',name?'':'Nama produk wajib diisi.')&&ok;ok=setErr(m,'sk',sku?'':'SKU wajib diisi.')&&ok;
  ok=setErr(m,'pp',pp>=0?'':'Harga beli wajib diisi dan tidak boleh negatif.')&&ok;ok=setErr(m,'sp',sp>=0?'':'Harga jual wajib diisi dan tidak boleh negatif.')&&ok;
  ok=setErr(m,'ms',mn>=0?'':'Stok minimum tidak boleh negatif.')&&ok;ok=setErr(m,'sx',sx>=0?'':'Stok awal tidak boleh negatif.')&&ok;
  ok=setErr(m,'im',f&&(!/^image\//.test(f.type)||f.size>2*1024*1024)?'File harus berupa gambar maksimal 2 MB.':'')&&ok;if(!ok)return;
  busy(m.$('#sv'),true,'Menyimpan...');
  try{let url=prod?prod.image_url:null;
   if(f){const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg',path=uid()+'.'+ext,up=await sb.storage.from('product-images').upload(path,f,{contentType:f.type});if(up.error)throw fx(up.error);url=sb.storage.from('product-images').getPublicUrl(path).data.publicUrl}
   const pl={category_id:m.$('#ct').value||null,sku:sku,barcode:m.$('#bc').value.trim()||null,product_name:name,description:m.$('#ds').value.trim()||null,image_url:url,purchase_price:pp,selling_price:sp,min_stock:mn,unit:m.$('#un').value.trim()||'pcs',is_active:m.$('#ac').checked};
   if(e)await run(sb.from('products').update(pl).eq('id',prod.id));else{pl.stock=sx;await run(sb.from('products').insert(pl))}
   toast('Produk berhasil disimpan.','success');m.close(true);done()}
  catch(x){toast(x.message,'error');busy(m.$('#sv'),false)}}}

PAGES.products={roles:['admin'],title:'Produk',async render(v){
 const S={q:'',cat:'',st:'',sort:'name',page:1};
 const draw=()=>load(v,async()=>{
  const [list,cats]=await Promise.all([all(()=>sb.from('products_admin').select('*').order('product_name')),run(sb.from('categories').select('id,category_name,is_active').order('category_name'))]);
  const cn=new Map(cats.map(c=>[c.id,c.category_name]));
  v.innerHTML=ph('Produk','Kelola data produk, harga, dan stok minimum.','<button class="btn primary" id="np">+ Tambah Produk</button>')+
  '<div class="kpis">'+stat('Produk aktif',nf(list.filter(p=>p.is_active).length))+stat('Stok rendah',nf(list.filter(p=>p.is_active&&+p.stock<=+p.min_stock).length))+stat('Produk nonaktif',nf(list.filter(p=>!p.is_active).length))+'</div>'+
  '<div class="fb"><label>Cari<input id="q" placeholder="Nama, SKU, atau barcode" value="'+esc(S.q)+'"></label><label>Kategori<select id="fc"><option value="">Semua</option>'+cats.map(c=>opt(c.id,c.category_name,S.cat===c.id)).join('')+'</select></label><label>Status<select id="fs"><option value="">Semua</option>'+opt('1','Aktif',S.st==='1')+opt('0','Nonaktif',S.st==='0')+'</select></label><label>Urutkan<select id="so">'+opt('name','Nama',S.sort==='name')+opt('stock','Stok (terendah)',S.sort==='stock')+opt('price','Harga jual (tertinggi)',S.sort==='price')+'</select></label></div><div id="pl"></div>';
  const body=()=>{const q=S.q.toLowerCase();let l=list.filter(p=>(!S.cat||p.category_id===S.cat)&&(!S.st||(S.st==='1')===p.is_active)&&(!q||p.product_name.toLowerCase().includes(q)||String(p.sku).toLowerCase().includes(q)||String(p.barcode||'').toLowerCase().includes(q)));
   if(S.sort==='stock')l.sort((a,b)=>a.stock-b.stock);else if(S.sort==='price')l.sort((a,b)=>b.selling_price-a.selling_price);
   const tot=l.length,pg=l.slice((S.page-1)*15,S.page*15),z=$('#pl',v);
   z.innerHTML=tbl([{h:'Gambar',f:p=>p.image_url?'<img class="th" src="'+esc(p.image_url)+'" alt="" loading="lazy">':'<span class="th">📦</span>'},{h:'Nama',f:p=>'<b>'+esc(p.product_name)+'</b>'},{h:'SKU',f:p=>esc(p.sku)},{h:'Barcode',f:p=>esc(p.barcode||'-')},{h:'Kategori',f:p=>esc(cn.get(p.category_id)||'-')},{h:'HPP',c:'r',f:p=>rp(p.purchase_price)},{h:'Harga jual',c:'r',f:p=>rp(p.selling_price)},{h:'Stok',c:'r',f:p=>nf(p.stock)+' '+esc(p.unit)+'<br>'+stockB(p)},{h:'Status',f:p=>actB(p.is_active)},{h:'Aksi',f:p=>'<button class="btn sm" data-e="'+p.id+'">Ubah</button> <button class="btn sm '+(p.is_active?'danger':'')+'" data-t="'+p.id+'">'+(p.is_active?'Nonaktifkan':'Aktifkan')+'</button>'}],pg,'Produk tidak ditemukan. Ubah filter atau tambah produk baru.')+pager(tot,S.page,15);
   bindPager(z,n=>{S.page=n;body()});
   $$('[data-e]',z).forEach(b=>b.onclick=()=>productForm(list.find(p=>p.id===b.dataset.e),cats,draw));
   $$('[data-t]',z).forEach(b=>b.onclick=async()=>{const p=list.find(x=>x.id===b.dataset.t);
    if(p.is_active&&!await ask('Nonaktifkan produk?',p.product_name+' tidak akan muncul di POS. Riwayat transaksi tetap tersimpan.','Ya, nonaktifkan',true))return;
    try{await run(sb.from('products').update({is_active:!p.is_active}).eq('id',p.id));toast('Status produk diperbarui.','success');draw()}catch(e){toast(e.message,'error')}})};
  $('#np',v).onclick=()=>productForm(null,cats,draw);
  $('#q',v).oninput=e=>{S.q=e.target.value.trim();S.page=1;body()};
  $('#fc',v).onchange=e=>{S.cat=e.target.value;S.page=1;body()};$('#fs',v).onchange=e=>{S.st=e.target.value;S.page=1;body()};$('#so',v).onchange=e=>{S.sort=e.target.value;body()};
  body()});
 draw()}};

/* ================= KATEGORI ================= */
PAGES.categories={roles:['admin'],title:'Kategori',async render(v){
 let q='';
 const draw=()=>load(v,async()=>{
  const [cats,pr]=await Promise.all([run(sb.from('categories').select('*').order('category_name')),all(()=>sb.from('products').select('id,category_id').order('id'))]);
  const cnt={};pr.forEach(p=>{if(p.category_id)cnt[p.category_id]=(cnt[p.category_id]||0)+1});
  v.innerHTML=ph('Kategori','Kelompokkan produk agar mudah dicari di POS.','<button class="btn primary" id="nc">+ Tambah Kategori</button>')+'<div class="fb"><label>Cari kategori<input id="q" value="'+esc(q)+'" placeholder="Nama kategori"></label></div><div id="cl"></div>';
  const body=()=>{const l=cats.filter(c=>!q||c.category_name.toLowerCase().includes(q.toLowerCase())),z=$('#cl',v);
   z.innerHTML=tbl([{h:'Nama kategori',f:c=>(c.icon?esc(c.icon)+' ':'')+'<b>'+esc(c.category_name)+'</b>'},{h:'Deskripsi',f:c=>esc(c.description||'-')},{h:'Jumlah produk',c:'r',f:c=>nf(cnt[c.id]||0)},{h:'Status',f:c=>actB(c.is_active)},{h:'Aksi',f:c=>'<button class="btn sm" data-e="'+c.id+'">Ubah</button> <button class="btn sm '+(c.is_active?'danger':'')+'" data-t="'+c.id+'">'+(c.is_active?'Nonaktifkan':'Aktifkan')+'</button>'}],l,'Belum ada kategori.');
   $$('[data-e]',z).forEach(b=>b.onclick=()=>form(cats.find(c=>c.id===b.dataset.e)));
   $$('[data-t]',z).forEach(b=>b.onclick=async()=>{const c=cats.find(x=>x.id===b.dataset.t);
    if(c.is_active&&!await ask('Nonaktifkan kategori?','Kategori '+c.category_name+' tidak akan tampil sebagai filter di POS. Produk di dalamnya tidak dihapus.','Ya, nonaktifkan',true))return;
    try{await run(sb.from('categories').update({is_active:!c.is_active}).eq('id',c.id));toast('Status kategori diperbarui.','success');draw()}catch(e){toast(e.message,'error')}})};
  const form=c=>{const e=!!c,m=modal({title:e?'Ubah Kategori':'Tambah Kategori',body:'<form id="cf" novalidate>'+fg('cn','Nama kategori <span class="req">*</span>','<input id="cn" maxlength="80" value="'+esc(e?c.category_name:'')+'">')+fg('cd','Deskripsi','<textarea id="cd" rows="2">'+esc(e&&c.description?c.description:'')+'</textarea>')+fg('ci','Ikon (opsional)','<input id="ci" maxlength="4" placeholder="Contoh: 🥤" value="'+esc(e&&c.icon?c.icon:'')+'">')+'<label class="ck"><input type="checkbox" id="ca"'+(!e||c.is_active?' checked':'')+'> Kategori aktif</label></form>',footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Simpan</button>'});
   m.$('#sv').onclick=async()=>{const n=m.$('#cn').value.trim();if(!setErr(m,'cn',n?'':'Nama kategori wajib diisi.'))return;busy(m.$('#sv'),true,'Menyimpan...');
    const pl={category_name:n,description:m.$('#cd').value.trim()||null,icon:m.$('#ci').value.trim()||null,is_active:m.$('#ca').checked};
    try{if(e)await run(sb.from('categories').update(pl).eq('id',c.id));else await run(sb.from('categories').insert(pl));toast('Kategori disimpan.','success');m.close(true);draw()}
    catch(x){toast(x.code==='23505'?'Nama kategori sudah digunakan.':x.message,'error');busy(m.$('#sv'),false)}}};
  $('#nc',v).onclick=()=>form(null);$('#q',v).oninput=ev=>{q=ev.target.value.trim();body()};body()});
 draw()}};

/* ================= MANAJEMEN STOK ================= */
PAGES.inventory={roles:['admin'],title:'Manajemen Stok',async render(v){
 const S={q:'',cat:'',st:'',page:1},H={page:1,prod:''};
 const draw=()=>load(v,async()=>{
  const [list,cats]=await Promise.all([all(()=>sb.from('products_admin').select('id,category_id,sku,product_name,stock,min_stock,unit,is_active').order('product_name')),run(sb.from('categories').select('id,category_name').order('category_name'))]);
  const stt=p=>+p.stock<=0?'out':+p.stock<=+p.min_stock?'low':'ok';
  v.innerHTML=ph('Manajemen Stok','Pantau stok dan lakukan penyesuaian yang tercatat.','<button class="btn primary" id="ad">± Penyesuaian Stok</button>')+
  '<div class="kpis">'+stat('Total jenis produk',nf(list.length))+stat('Produk stok rendah',nf(list.filter(p=>stt(p)==='low').length))+stat('Produk habis',nf(list.filter(p=>stt(p)==='out').length))+'</div>'+
  '<div class="fb"><label>Cari produk<input id="q" value="'+esc(S.q)+'" placeholder="Nama atau SKU"></label><label>Kategori<select id="fc"><option value="">Semua</option>'+cats.map(c=>opt(c.id,c.category_name,S.cat===c.id)).join('')+'</select></label><label>Status stok<select id="fs"><option value="">Semua</option>'+opt('ok','Tersedia',S.st==='ok')+opt('low','Rendah',S.st==='low')+opt('out','Habis',S.st==='out')+'</select></label></div><div id="sl"></div><div class="card"><h3>Riwayat pergerakan stok</h3><div class="fb"><label>Produk<select id="hp"><option value="">Semua produk</option>'+list.map(p=>opt(p.id,p.product_name+' ('+p.sku+')',H.prod===p.id)).join('')+'</select></label></div><div id="hl"></div></div>';
  const body=()=>{const q=S.q.toLowerCase(),l=list.filter(p=>(!S.cat||p.category_id===S.cat)&&(!S.st||stt(p)===S.st)&&(!q||p.product_name.toLowerCase().includes(q)||String(p.sku).toLowerCase().includes(q))),z=$('#sl',v);
   z.innerHTML=tbl([{h:'Produk',f:p=>'<b>'+esc(p.product_name)+'</b>'},{h:'SKU',f:p=>esc(p.sku)},{h:'Stok saat ini',c:'r',f:p=>nf(p.stock)},{h:'Stok minimum',c:'r',f:p=>nf(p.min_stock)},{h:'Satuan',f:p=>esc(p.unit)},{h:'Status stok',f:p=>stockB(p)},{h:'Aksi',f:p=>'<button class="btn sm" data-a="'+p.id+'">Sesuaikan</button>'}],l.slice((S.page-1)*15,S.page*15),'Tidak ada produk yang cocok.')+pager(l.length,S.page,15);
   bindPager(z,n=>{S.page=n;body()});$$('[data-a]',z).forEach(b=>b.onclick=()=>adjust(b.dataset.a))};
  const hist=async()=>{const z=$('#hl',v);z.innerHTML=loadingH();
   try{let q=sb.from('stock_movements').select('*,products(product_name,unit),profiles(full_name)',{count:'exact'}).order('created_at',{ascending:false}).range((H.page-1)*20,H.page*20-1);if(H.prod)q=q.eq('product_id',H.prod);const r=await runc(q);
    z.innerHTML=tbl([{h:'Waktu',f:m=>esc(fdt(m.created_at))},{h:'Produk',f:m=>esc((m.products||{}).product_name)},{h:'Jenis',f:m=>esc(MV[m.movement_type]||m.movement_type)},{h:'Perubahan',c:'r',f:m=>(+m.quantity_change>0?'+':'')+nf(m.quantity_change)},{h:'Sebelum',c:'r',f:m=>nf(m.stock_before)},{h:'Sesudah',c:'r',f:m=>nf(m.stock_after)},{h:'Pengguna',f:m=>esc((m.profiles||{}).full_name||'-')},{h:'Catatan',f:m=>esc(m.notes||'-')}],r.data,'Belum ada pergerakan stok.')+pager(r.count||0,H.page,20);
    bindPager(z,n=>{H.page=n;hist()})}catch(e){z.innerHTML=errH(e.message);$('[data-retry]',z).onclick=hist}};
  const adjust=pid=>{const m=modal({title:'Penyesuaian Stok',body:'<form id="af" novalidate>'+fg('ap','Produk <span class="req">*</span>','<select id="ap"><option value="">Pilih produk</option>'+list.map(p=>opt(p.id,p.product_name+' ('+p.sku+')',p.id===pid)).join('')+'</select>')+'<p class="cur">Stok saat ini: <b id="cs">-</b></p>'+fg('at','Jenis penyesuaian','<select id="at"><option value="add">Tambah stok</option><option value="sub">Kurangi stok</option></select>')+fg('aq','Jumlah <span class="req">*</span>','<input id="aq" type="number" min="0" step="any" inputmode="decimal">')+fg('ar','Alasan <span class="req">*</span>','<textarea id="ar" rows="2" maxlength="300" placeholder="Contoh: barang masuk, stok opname, rusak"></textarea>')+'</form>',footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Simpan Penyesuaian</button>'});
   const cur=()=>list.find(p=>p.id===m.$('#ap').value);const sh=()=>{const p=cur();m.$('#cs').textContent=p?nf(p.stock)+' '+p.unit:'-'};m.$('#ap').onchange=sh;sh();
   m.$('#sv').onclick=async()=>{const p=cur(),q=Number(m.$('#aq').value),r=m.$('#ar').value.trim();let ok=true;
    ok=setErr(m,'ap',p?'':'Pilih produk.')&&ok;ok=setErr(m,'aq',q>0?'':'Jumlah harus lebih dari nol.')&&ok;ok=setErr(m,'ar',r?'':'Alasan wajib diisi.')&&ok;if(!ok)return;
    const d=m.$('#at').value==='add'?q:-q;
    if(!await ask('Simpan penyesuaian?',p.product_name+': stok '+nf(p.stock)+' menjadi '+nf(+p.stock+d)+' '+p.unit+'.','Ya, simpan'))return;
    busy(m.$('#sv'),true,'Menyimpan...');
    try{await run(sb.rpc('adjust_product_stock',{p_product_id:p.id,p_change:d,p_reason:r}));toast('Stok berhasil disesuaikan.','success');m.close(true);draw()}
    catch(e){toast(e.message,'error');busy(m.$('#sv'),false)}}};
  $('#ad',v).onclick=()=>adjust('');$('#q',v).oninput=e=>{S.q=e.target.value.trim();S.page=1;body()};$('#fc',v).onchange=e=>{S.cat=e.target.value;S.page=1;body()};$('#fs',v).onchange=e=>{S.st=e.target.value;S.page=1;body()};
  $('#hp',v).onchange=e=>{H.prod=e.target.value;H.page=1;hist()};body();hist()});
 draw()}};

/* ================= LAPORAN PENJUALAN ================= */
PAGES.reports={roles:['admin'],title:'Laporan Penjualan',async render(v){
 const t=today(),f0=t.slice(0,8)+'01';
 v.innerHTML=ph('Laporan Penjualan','Hanya transaksi berstatus Selesai yang dihitung.')+rangeHtml(f0,t)+'<div id="rz"></div>';
 const z=$('#rz',v);
 const draw=(f,to)=>load(z,async()=>{
  const s=await run(sb.rpc('get_sales_summary',{p_from:f,p_to:to}));
  z.innerHTML='<div class="kpis">'+stat('Total omzet',rp(s.revenue))+stat('Jumlah transaksi',nf(s.tx_count))+stat('Produk terjual',nf(s.items_sold))+stat('Rata-rata transaksi',rp(s.tx_count?s.revenue/s.tx_count:0))+stat('Transaksi dibatalkan',nf(s.cancelled_count),'Tidak masuk omzet')+'</div>'+
  '<div class="card"><h3>Penjualan harian</h3>'+bars((s.daily||[]).map(d=>({l:d.day.slice(8)+'/'+d.day.slice(5,7),v:+d.revenue})))+'</div>'+
  '<div class="cols"><div class="card"><h3>Berdasarkan metode pembayaran</h3>'+hbars((s.by_method||[]).map(m=>({l:MT[m.payment_method]||m.payment_method,v:+m.amount})))+'</div><div class="card"><h3>Berdasarkan kasir</h3>'+tbl([{h:'Kasir',f:r=>esc(r.full_name)},{h:'Transaksi',c:'r',f:r=>nf(r.tx_count)},{h:'Omzet',c:'r',f:r=>rp(r.revenue)}],s.by_cashier||[],'Belum ada data.')+'</div></div>'+
  '<div class="card"><h3>10 produk terlaris</h3>'+tbl([{h:'Produk',f:r=>esc(r.product_name)},{h:'SKU',f:r=>esc(r.sku||'-')},{h:'Terjual',c:'r',f:r=>nf(r.qty)},{h:'Omzet',c:'r',f:r=>rp(r.revenue)}],s.top_products||[],'Belum ada penjualan pada periode ini.')+'</div>'+
  '<div class="card"><h3>Rincian harian</h3>'+tbl([{h:'Tanggal',f:r=>esc(fdate(r.day+'T00:00:00+07:00'))},{h:'Transaksi',c:'r',f:r=>nf(r.tx_count)},{h:'Omzet',c:'r',f:r=>rp(r.revenue)}],s.daily||[],'Belum ada data.')+'</div>'});
 bindRange(v,draw);draw(f0,t)}};

/* ================= LAPORAN KEUNTUNGAN ================= */
PAGES['profit-reports']={roles:['admin'],title:'Laporan Keuntungan',async render(v){
 const t=today(),f0=t.slice(0,8)+'01';
 v.innerHTML=ph('Laporan Keuntungan','Keuntungan kotor = omzet bersih (subtotal − diskon) − HPP saat transaksi. Ini bukan laba bersih; biaya operasional belum dihitung.')+rangeHtml(f0,t)+'<div id="rz"></div>';
 const z=$('#rz',v);
 const draw=(f,to)=>load(z,async()=>{
  const p=await run(sb.rpc('get_profit_summary',{p_from:f,p_to:to})),nr=+p.net_revenue,mg=nr>0?(+p.gross_profit/nr*100):0;
  z.innerHTML='<div class="kpis">'+stat('Omzet bersih',rp(p.net_revenue))+stat('Total HPP',rp(p.cogs))+stat('Keuntungan kotor',rp(p.gross_profit))+stat('Margin kotor',nf(mg,1)+'%')+'</div>'+
  '<div class="card"><h3>Keuntungan kotor harian</h3>'+bars((p.daily||[]).map(d=>({l:d.day.slice(8)+'/'+d.day.slice(5,7),v:+d.revenue-+d.cogs})))+'<small class="hint">Hari dengan kerugian ditampilkan sebagai batang minimal; lihat angka pada tabel rincian.</small></div>'+
  '<div class="card"><h3>Keuntungan per produk</h3>'+tbl([{h:'Produk',f:r=>esc(r.product_name)},{h:'SKU',f:r=>esc(r.sku||'-')},{h:'Terjual',c:'r',f:r=>nf(r.qty)},{h:'Pendapatan',c:'r',f:r=>rp(r.revenue)},{h:'HPP',c:'r',f:r=>rp(r.cogs)},{h:'Keuntungan',c:'r',f:r=>rp(r.profit)}],p.per_product||[],'Belum ada penjualan pada periode ini.')+'<small class="hint">Diskon tingkat transaksi tidak dialokasikan per produk, sehingga jumlah kolom Pendapatan dapat berbeda dari omzet bersih.</small></div>'+
  '<div class="card"><h3>Rincian harian</h3>'+tbl([{h:'Tanggal',f:r=>esc(fdate(r.day+'T00:00:00+07:00'))},{h:'Omzet bersih',c:'r',f:r=>rp(r.revenue)},{h:'HPP',c:'r',f:r=>rp(r.cogs)},{h:'Keuntungan kotor',c:'r',f:r=>rp(+r.revenue-+r.cogs)}],p.daily||[],'Belum ada data.')+'</div>'});
 bindRange(v,draw);draw(f0,t)}};

/* ================= MANAJEMEN KASIR ================= */
PAGES.users={roles:['admin'],title:'Manajemen Kasir',async render(v){
 let q='';
 const draw=()=>load(v,async()=>{
  const list=await run(sb.from('profiles').select('*').eq('role','cashier').order('created_at',{ascending:false}));
  v.innerHTML=ph('Manajemen Kasir','Buat dan kelola akun kasir.','<button class="btn primary" id="nu">+ Tambah Kasir</button>')+'<div class="kpis">'+stat('Total kasir',nf(list.length))+stat('Kasir aktif',nf(list.filter(u=>u.is_active).length))+stat('Kasir nonaktif',nf(list.filter(u=>!u.is_active).length))+'</div><div class="fb"><label>Cari<input id="q" value="'+esc(q)+'" placeholder="Nama atau email"></label></div><div id="ul"></div>';
  const body=()=>{const l=list.filter(u=>!q||(u.full_name+' '+u.email).toLowerCase().includes(q.toLowerCase())),z=$('#ul',v);
   z.innerHTML=tbl([{h:'Nama',f:u=>'<b>'+esc(u.full_name)+'</b>'},{h:'Email',f:u=>esc(u.email)},{h:'Telepon',f:u=>esc(u.phone||'-')},{h:'Status',f:u=>actB(u.is_active)},{h:'Dibuat',f:u=>esc(fdate(u.created_at))},{h:'Aksi',f:u=>'<button class="btn sm" data-e="'+u.id+'">Ubah</button> <button class="btn sm '+(u.is_active?'danger':'')+'" data-t="'+u.id+'">'+(u.is_active?'Nonaktifkan':'Aktifkan')+'</button>'}],l,'Belum ada akun kasir.');
   $$('[data-e]',z).forEach(b=>b.onclick=()=>edit(list.find(u=>u.id===b.dataset.e)));
   $$('[data-t]',z).forEach(b=>b.onclick=async()=>{const u=list.find(x=>x.id===b.dataset.t);
    if(u.is_active&&!await ask('Nonaktifkan kasir?',u.full_name+' tidak akan dapat login atau mengakses data. Riwayat transaksinya tetap tersimpan.','Ya, nonaktifkan',true))return;
    try{await run(sb.from('profiles').update({is_active:!u.is_active}).eq('id',u.id));toast('Status kasir diperbarui.','success');draw()}catch(e){toast(e.message,'error')}})};
  const add=()=>{const m=modal({title:'Tambah Kasir',body:'<form id="uf" novalidate>'+fg('un','Nama lengkap <span class="req">*</span>','<input id="un" maxlength="100">')+fg('ue','Email <span class="req">*</span>','<input id="ue" type="email" autocomplete="off">')+fg('up','Telepon','<input id="up" maxlength="30" inputmode="tel">')+fg('upw','Password awal <span class="req">*</span>','<input id="upw" type="password" autocomplete="new-password">','Minimal 8 karakter. Sampaikan kepada kasir secara langsung.')+'</form>',footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Buat Akun</button>'});
   m.$('#sv').onclick=async()=>{const n=m.$('#un').value.trim(),e=m.$('#ue').value.trim().toLowerCase(),pw=m.$('#upw').value;let ok=true;
    ok=setErr(m,'un',n?'':'Nama wajib diisi.')&&ok;ok=setErr(m,'ue',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?'':'Format email tidak valid.')&&ok;ok=setErr(m,'upw',pw.length>=8?'':'Password minimal 8 karakter.')&&ok;if(!ok)return;
    busy(m.$('#sv'),true,'Membuat akun...');
    try{const r=await sb.functions.invoke('create-cashier',{body:{full_name:n,email:e,password:pw,phone:m.$('#up').value.trim()||null}});
     if(r.error){let msg=r.error.message;try{const j=await r.error.context.json();if(j&&j.error)msg=j.error}catch(_){}throw new Error(msg)}
     if(r.data&&r.data.error)throw new Error(r.data.error);
     toast('Akun kasir berhasil dibuat.','success');m.close(true);draw()}
    catch(x){toast(x.message,'error');busy(m.$('#sv'),false)}}};
  const edit=u=>{const m=modal({title:'Ubah Kasir',body:'<form novalidate>'+fg('un','Nama lengkap <span class="req">*</span>','<input id="un" maxlength="100" value="'+esc(u.full_name)+'">')+fg('ue','Email','<input id="ue" value="'+esc(u.email)+'" disabled>')+fg('up','Telepon','<input id="up" maxlength="30" value="'+esc(u.phone||'')+'">')+'<label class="ck"><input type="checkbox" id="ua"'+(u.is_active?' checked':'')+'> Akun aktif</label></form>',footer:'<button class="btn" data-x>Batal</button><button class="btn primary" id="sv">Simpan</button>'});
   m.$('#sv').onclick=async()=>{const n=m.$('#un').value.trim();if(!setErr(m,'un',n?'':'Nama wajib diisi.'))return;busy(m.$('#sv'),true,'Menyimpan...');
    try{await run(sb.from('profiles').update({full_name:n,phone:m.$('#up').value.trim()||null,is_active:m.$('#ua').checked}).eq('id',u.id));toast('Data kasir disimpan.','success');m.close(true);draw()}
    catch(x){toast(x.message,'error');busy(m.$('#sv'),false)}}};
  $('#nu',v).onclick=add;$('#q',v).oninput=e=>{q=e.target.value.trim();body()};body()});
 draw()}};

/* ================= AKUN (dipakai Profil & Pengaturan) ================= */
function accountForm(el){
 el.innerHTML='<div class="card"><h3>Data akun</h3><div class="prof"><span class="av lg">'+esc(ini(ME.full_name))+'</span><div><b>'+esc(ME.full_name)+'</b><br>'+badge(ME.role==='admin'?'Admin/Owner':'Kasir','ok')+'</div></div><form id="pf" novalidate class="fgrid">'+fg('pn','Nama lengkap <span class="req">*</span>','<input id="pn" maxlength="100" value="'+esc(ME.full_name)+'">')+fg('pe','Email','<input id="pe" value="'+esc(ME.email)+'" disabled>')+fg('pt','Telepon','<input id="pt" maxlength="30" value="'+esc(ME.phone||'')+'">')+fg('pr','Role','<input id="pr" value="'+(ME.role==='admin'?'Admin/Owner':'Kasir')+'" disabled>')+'<div><button class="btn primary" id="ps" type="submit">Simpan Profil</button></div></form></div>'+
 '<div class="card"><h3>Ubah password</h3><form id="pw" novalidate class="fgrid">'+fg('p1','Password baru','<input id="p1" type="password" autocomplete="new-password">','Minimal 8 karakter.')+fg('p2','Konfirmasi password baru','<input id="p2" type="password" autocomplete="new-password">')+'<div><button class="btn primary" id="pb" type="submit">Ubah Password</button></div></form></div>';
 const g=id=>$('#'+id,el),er=(id,m)=>{g(id+'-e').textContent=m||'';return !m};
 g('pf').onsubmit=async e=>{e.preventDefault();const n=g('pn').value.trim();if(!er('pn',n?'':'Nama wajib diisi.'))return;busy(g('ps'),true,'Menyimpan...');
  try{await run(sb.from('profiles').update({full_name:n,phone:g('pt').value.trim()||null}).eq('id',ME.id));ME.full_name=n;ME.phone=g('pt').value.trim()||null;toast('Profil disimpan.','success')}catch(x){toast(x.message,'error')}busy(g('ps'),false)};
 g('pw').onsubmit=async e=>{e.preventDefault();const a=g('p1').value,b=g('p2').value;let ok=er('p1',a.length>=8?'':'Password minimal 8 karakter.');ok=er('p2',a===b?'':'Konfirmasi password tidak sama.')&&ok;if(!ok)return;
  busy(g('pb'),true,'Memproses...');
  try{const r=await sb.auth.updateUser({password:a});if(r.error)throw fx(r.error);g('p1').value='';g('p2').value='';toast('Password berhasil diubah.','success')}catch(x){toast(x.message,'error')}busy(g('pb'),false)}}

PAGES.profile={roles:['cashier','admin'],title:'Profil',render(v){v.innerHTML=ph('Profil','Kelola data akun Anda.','<button class="btn danger" id="lo">Logout</button>')+'<div id="ac"></div>';accountForm($('#ac',v));$('#lo',v).onclick=logout}};

/* ================= PENGATURAN TOKO ================= */
PAGES.settings={roles:['admin'],title:'Pengaturan Toko',async render(v){
 let tab=(location.hash||'').replace('#','')||'toko';
 const TABS=[['toko','Profil Toko'],['struk','Struk'],['transaksi','Transaksi'],['bayar','Pembayaran'],['akun','Akun']];
 await load(v,async()=>{
  const S=await getSettings(true);
  const save=async(obj,btn)=>{busy(btn,true,'Menyimpan...');try{await run(sb.from('store_settings').update(obj).eq('id',S.id));Object.assign(SET,obj);toast('Pengaturan disimpan.','success')}catch(e){toast(e.message,'error')}busy(btn,false)};
  const ck=(id,l,on)=>'<label class="ck"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'> '+l+'</label>';
  const draw=()=>{
   v.innerHTML=ph('Pengaturan Toko','Berlaku untuk seluruh pengguna.')+'<div class="tabs" role="tablist">'+TABS.map(t=>'<button class="tab'+(t[0]===tab?' on':'')+'" role="tab" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><div id="tb"></div>';
   $$('[data-tab]',v).forEach(b=>b.onclick=()=>{tab=b.dataset.tab;draw()});const z=$('#tb',v);
   if(tab==='toko'){z.innerHTML='<div class="card"><form id="f" novalidate class="fgrid">'+fg('sn','Nama toko <span class="req">*</span>','<input id="sn" maxlength="100" value="'+esc(S.store_name)+'">')+fg('sp','Telepon','<input id="sp" maxlength="30" value="'+esc(S.phone||'')+'">')+fg('se','Email','<input id="se" type="email" value="'+esc(S.email||'')+'">')+fg('sa','Alamat','<textarea id="sa" rows="2">'+esc(S.address||'')+'</textarea>')+fg('sl','Logo toko','<input id="sl" type="file" accept="image/*">',S.logo_url?'Logo tersimpan. Pilih file baru untuk mengganti (maks. 2 MB).':'Maksimal 2 MB.')+'<div><button class="btn primary" id="sv">Simpan</button></div></form></div>';
    $('#f',z).onsubmit=async e=>{e.preventDefault();const n=$('#sn',z).value.trim(),f=$('#sl',z).files[0];
     if(!n)return($('#sn-e',z).textContent='Nama toko wajib diisi.');$('#sn-e',z).textContent='';
     if(f&&(!/^image\//.test(f.type)||f.size>2*1024*1024))return($('#sl-e',z).textContent='File harus berupa gambar maksimal 2 MB.');
     let url=S.logo_url;
     if(f){busy($('#sv',z),true,'Mengunggah...');const ext=(f.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png',path='logo-'+uid()+'.'+ext,up=await sb.storage.from('store-assets').upload(path,f,{contentType:f.type});if(up.error){busy($('#sv',z),false);return toast(fx(up.error).message,'error')}url=sb.storage.from('store-assets').getPublicUrl(path).data.publicUrl}
     await save({store_name:n,phone:$('#sp',z).value.trim()||null,email:$('#se',z).value.trim()||null,address:$('#sa',z).value.trim()||null,logo_url:url},$('#sv',z));draw()}}
   else if(tab==='struk'){z.innerHTML='<div class="cols"><div class="card"><form id="f" novalidate class="fgrid">'+fg('rw','Lebar kertas','<select id="rw">'+opt('58mm','58 mm',S.receipt_width==='58mm')+opt('80mm','80 mm',S.receipt_width==='80mm')+'</select>')+fg('rh','Teks header struk','<textarea id="rh" rows="2">'+esc(S.receipt_header||'')+'</textarea>')+fg('rf','Teks footer struk','<textarea id="rf" rows="2">'+esc(S.receipt_footer||'')+'</textarea>')+'<div><button class="btn primary" id="sv">Simpan</button></div></form></div><div class="card"><h3>Pratinjau</h3><div class="receipt '+(S.receipt_width==='58mm'?'w58':'w80')+'" id="pv"></div></div></div>';
    const pv=()=>{const w=$('#rw',z).value;$('#pv',z).className='receipt '+(w==='58mm'?'w58':'w80');$('#pv',z).innerHTML='<h4>'+esc(S.store_name)+'</h4>'+(S.address?'<p>'+esc(S.address)+'</p>':'')+(($('#rh',z).value)?'<p>'+esc($('#rh',z).value)+'</p>':'')+'<hr><div class="rr"><span>Contoh produk</span><span>10.000</span></div><div class="rr tot"><span>TOTAL</span><span>Rp 10.000</span></div><hr><p class="rf">'+esc($('#rf',z).value)+'</p>'};
    $$('#rw,#rh,#rf',z).forEach(i=>i.oninput=pv);pv();
    $('#f',z).onsubmit=e=>{e.preventDefault();save({receipt_width:$('#rw',z).value,receipt_header:$('#rh',z).value.trim()||null,receipt_footer:$('#rf',z).value.trim()||null},$('#sv',z))}}
   else if(tab==='transaksi'){z.innerHTML='<div class="card"><form id="f" novalidate class="fgrid">'+fg('ip','Prefix nomor invoice','<input id="ip" maxlength="10" value="'+esc(S.invoice_prefix)+'">','Hanya berlaku untuk transaksi berikutnya.')+ck('tx','Aktifkan pajak',S.tax_enabled)+fg('tp','Persentase pajak (%)','<input id="tp" type="number" min="0" max="100" step="any" value="'+esc(S.tax_percentage)+'">')+ck('ad','Izinkan diskon manual',S.allow_discount)+ck('an','Izinkan stok negatif (tidak disarankan)',S.allow_negative_stock)+'<div><button class="btn primary" id="sv">Simpan</button></div></form></div>';
    $('#f',z).onsubmit=e=>{e.preventDefault();const pre=$('#ip',z).value.trim(),tp=Number($('#tp',z).value);
     if(!pre)return($('#ip-e',z).textContent='Prefix wajib diisi.');$('#ip-e',z).textContent='';
     if(!(tp>=0&&tp<=100))return($('#tp-e',z).textContent='Pajak harus antara 0 dan 100.');$('#tp-e',z).textContent='';
     save({invoice_prefix:pre,tax_enabled:$('#tx',z).checked,tax_percentage:tp,allow_discount:$('#ad',z).checked,allow_negative_stock:$('#an',z).checked},$('#sv',z))}}
   else if(tab==='bayar'){z.innerHTML='<div class="card"><div class="alert info">Pembayaran QRIS dan transfer dikonfirmasi manual oleh kasir. Tidak ada verifikasi otomatis dan tidak ada payment gateway.</div><form id="f" novalidate class="fgrid">'+ck('pc','Tunai aktif',S.pay_cash)+ck('pq','QRIS aktif',S.pay_qris)+ck('pt','Transfer bank aktif',S.pay_transfer)+fg('bi','Informasi rekening transfer','<textarea id="bi" rows="3" placeholder="Contoh: BCA 1234567890 a.n. Toko Saya">'+esc(S.bank_info||'')+'</textarea>','Ditampilkan kepada kasir saat memilih Transfer Bank.')+'<div><button class="btn primary" id="sv">Simpan</button></div></form></div>';
    $('#f',z).onsubmit=e=>{e.preventDefault();if(!$('#pc',z).checked&&!$('#pq',z).checked&&!$('#pt',z).checked)return toast('Minimal satu metode pembayaran harus aktif.','warning');save({pay_cash:$('#pc',z).checked,pay_qris:$('#pq',z).checked,pay_transfer:$('#pt',z).checked,bank_info:$('#bi',z).value.trim()||null},$('#sv',z))}}
   else accountForm(z)};
  draw()})}};

/* ================= LOG AKTIVITAS ================= */
PAGES['activity-logs']={roles:['admin'],title:'Log Aktivitas',async render(v){
 const t=today(),S={f:addDays(t,-6),t:t,user:'',mod:'',act:'',page:1};let users=[];
 try{users=await run(sb.from('profiles').select('id,full_name').order('full_name'))}catch(e){}
 v.innerHTML=ph('Log Aktivitas','Catatan jejak audit, hanya dapat dibaca.')+'<div class="fb"><label>Dari<input type="date" id="ff" value="'+S.f+'"></label><label>Sampai<input type="date" id="ft" value="'+S.t+'"></label><label>Pengguna<select id="fu"><option value="">Semua</option>'+users.map(u=>opt(u.id,u.full_name)).join('')+'</select></label><label>Modul<select id="fm"><option value="">Semua</option>'+[['auth','Login/Logout'],['shift','Shift'],['transaction','Transaksi'],['product','Stok'],['products','Produk'],['categories','Kategori'],['store_settings','Pengaturan']].map(m=>opt(m[0],m[1])).join('')+'</select></label><label>Aksi<input id="fa" placeholder="mis. sale, login"></label><button class="btn primary" id="go">Terapkan</button></div><div id="lz"></div>';
 const z=$('#lz',v);
 const draw=()=>load(z,async()=>{const ab=rng(S.f,S.t);
  let q=sb.from('activity_logs').select('*,profiles(full_name)',{count:'exact'}).gte('created_at',ab[0]).lt('created_at',ab[1]).order('created_at',{ascending:false}).range((S.page-1)*25,S.page*25-1);
  if(S.user)q=q.eq('user_id',S.user);if(S.mod)q=q.eq('module',S.mod);if(S.act)q=q.ilike('action','%'+S.act+'%');
  const r=await runc(q);
  z.innerHTML=tbl([{h:'Waktu',f:l=>esc(fdt(l.created_at))},{h:'Pengguna',f:l=>esc((l.profiles||{}).full_name||'Sistem')},{h:'Aksi',f:l=>esc(l.action)},{h:'Modul',f:l=>esc(l.module)},{h:'Keterangan',f:l=>esc(l.description||'-')}],r.data,'Tidak ada log pada filter ini.')+pager(r.count||0,S.page,25);
  bindPager(z,n=>{S.page=n;draw()})});
 $('#go',v).onclick=()=>{const f=$('#ff',v).value,to=$('#ft',v).value;if(!f||!to||f>to)return toast('Rentang tanggal tidak valid.','warning');S.f=f;S.t=to;S.user=$('#fu',v).value;S.mod=$('#fm',v).value;S.act=$('#fa',v).value.trim();S.page=1;draw()};
 draw()}};

/* ================= BOOT ================= */
const fatal=(root,msg)=>{root.innerHTML='<div class="state err"><div class="ico">⚠️</div><p>'+esc(msg)+'</p></div>'};
async function boot(){
 const root=$('#kasir-app');if(!root)return;
 const key=root.dataset.page,page=PAGES[key];
 if(!page)return fatal(root,'Halaman tidak dikenal: "'+key+'". Periksa atribut data-page pada halaman Blogger.');
 if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY||/GANTI/.test(CFG.SUPABASE_URL+CFG.SUPABASE_ANON_KEY))return fatal(root,'Konfigurasi aplikasi belum diisi. Edit blok KASIR_CONFIG pada tema Blogger (SUPABASE_URL dan SUPABASE_ANON_KEY).');
 if(window.KASIR_LOAD_ERROR||!window.supabase)return fatal(root,'Gagal memuat library Supabase. Periksa koneksi internet lalu muat ulang halaman.');
 sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 root.innerHTML=loadingH();
 let ses;try{ses=(await sb.auth.getSession()).data.session}catch(e){return fatal(root,fx(e).message)}
 if(page.pub){if(ses){try{await goHome(ses.user.id,false);return}catch(e){}}return page.render(root)}
 if(!ses){location.replace(BASE+'login.html?reason=need');return}
 try{ME=await run(sb.from('profiles').select('*').eq('id',ses.user.id).maybeSingle())}catch(e){return fatal(root,e.message)}
 if(!ME){await sb.auth.signOut();location.replace(BASE+'login.html?reason=noprofile');return}
 if(!ME.is_active){await sb.auth.signOut();location.replace(BASE+'login.html?reason=inactive');return}
 sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&!loggingOut)location.replace(BASE+'login.html?reason=expired')});
 try{await getSettings()}catch(e){}
 if(page.roles.indexOf(ME.role)<0){shell(root,key,'Akses ditolak').innerHTML=denied();return}
 if(page.bare)return page.render(root);
 const v=shell(root,key,page.title);
 try{await page.render(v)}catch(e){v.innerHTML=errH(e.message)}}
document.addEventListener('kasir:error',()=>{const r=$('#kasir-app');if(r)fatal(r,'Gagal memuat file aplikasi. Periksa pengaturan ASSET_BASE pada tema Blogger.')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
