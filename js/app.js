'use strict';
const VERSION='0.7.1';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
$('#ver').textContent=VERSION;$('#ver2').textContent=VERSION;

/* ---------- タブ ---------- */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
  for(const t of ['speed','doc','ty','admin','help'])$('#tab-'+t).hidden=(t!==b.dataset.tab);
  if(b.dataset.tab!=='ty')TY.abort();
  if(b.dataset.tab==='doc')fitAll();
});

/* ---------- 共通：編集距離 ---------- */
// T=入力側, R=基準側。semi=true のとき基準の末尾は自由（途中まで入力した場合用）
function align(T,R,semi){
  const n=T.length,m=R.length,W=m+1;
  const dp=new Uint16Array((n+1)*W);
  for(let j=0;j<=m;j++)dp[j]=j;
  for(let i=1;i<=n;i++){
    dp[i*W]=i;
    for(let j=1;j<=m;j++){
      const c=T[i-1]===R[j-1]?0:1;
      let v=dp[(i-1)*W+j-1]+c;
      const a=dp[(i-1)*W+j]+1; if(a<v)v=a;
      const b=dp[i*W+j-1]+1; if(b<v)v=b;
      dp[i*W+j]=v;
    }
  }
  let jb=m;
  if(semi){let best=1e9;for(let j=0;j<=m;j++){const v=dp[n*W+j];if(v<=best){best=v;jb=j;}}}
  const dist=dp[n*W+jb];
  const ops=[];let i=n,j=jb;
  while(i>0||j>0){
    const cur=dp[i*W+j];
    if(i>0&&j>0&&dp[(i-1)*W+j-1]+(T[i-1]===R[j-1]?0:1)===cur){
      ops.push({k:T[i-1]===R[j-1]?'m':'s',r:R[j-1],t:T[i-1]});i--;j--;
    }else if(j>0&&dp[i*W+j-1]+1===cur){ops.push({k:'d',r:R[j-1],t:''});j--;}
    else{ops.push({k:'i',r:'',t:T[i-1]});i--;}
  }
  ops.reverse();
  return {dist,ops,rEnd:jb};
}
const kanjiCount=s=>(s.match(/[一-鿿]/g)||[]).length;
function trunc(s,lim){if(s.length<=lim)return s;const i=s.lastIndexOf('。',lim-1);return i>0?s.slice(0,i+1):s.slice(0,lim);}
function fmtTime(sec){sec=Math.max(0,Math.ceil(sec));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}

/* ================= 速度部門 ================= */
const GRADES=[
  {id:'4',name:'4級',pass:200,cut:1,kmin:23,kmax:26,band:'A',lim:300},
  {id:'3',name:'3級',pass:300,cut:1,kmin:23,kmax:26,band:'A',lim:450},
  {id:'p2',name:'準2級',pass:400,cut:3,kmin:25,kmax:30,band:'B',lim:600},
  {id:'2',name:'2級',pass:500,cut:3,kmin:25,kmax:30,band:'B',lim:750},
  {id:'p1',name:'準1級',pass:600,cut:5,kmin:25,kmax:35,band:'C',lim:900},
  {id:'1',name:'1級',pass:700,cut:5,kmin:25,kmax:35,band:'C',lim:1050},
];
const SP_SEC=600;
let SP={g:null,ref:'',timer:null,endAt:0,running:false,textIdx:0};

function fillGrades(sel){sel.innerHTML=GRADES.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');}
fillGrades($('#sp-grade'));
function spCond(){
  const g=GRADES.find(x=>x.id===$('#sp-grade').value);
  $('#sp-cond').innerHTML=`<table class="cond"><tr><th>試験時間</th><th>1ミスの減字</th><th>漢字含有率</th><th>合格文字数</th></tr><tr><td>10分</td><td>${g.cut}文字減</td><td>${g.kmin}%〜${g.kmax}%</td><td>${g.pass}文字以上</td></tr></table>`;
}
/* 課題文の選択肢を、管理画面で登録された本数に合わせて作り直す */
function spTextOpts(){
  const g=GRADES.find(x=>x.id===$('#sp-grade').value);
  const sel=$('#sp-text'),old=sel.value,n=getSpeedTexts(g.band).length;
  const circ='①②③④⑤⑥⑦⑧⑨⑩';
  sel.innerHTML='<option value="r">ランダム</option>'+Array.from({length:n},(_,i)=>`<option value="${i}">課題文 ${circ[i]||(i+1)}</option>`).join('');
  sel.value=(old!=='r'&&+old<n)?old:'r';
}
$('#sp-grade').onchange=()=>{spCond();spTextOpts();};spCond();spTextOpts();

function show(ids,on){ids.forEach(i=>$(i).hidden=!on);}
function spPickText(g){
  let idx=$('#sp-text').value;
  const list=getSpeedTexts(g.band);
  if(idx==='r'||+idx>=list.length)idx=Math.floor(Math.random()*list.length);else idx=+idx;
  SP.textIdx=idx;
  return trunc(list[idx],g.lim);
}
function spStart(){
  const g=GRADES.find(x=>x.id===$('#sp-grade').value);
  SP.g=g;SP.ref=spPickText(g);
  show(['#sp-setup','#sp-result'],false);show(['#sp-exam'],true);
  show(['#sp-body'],false);show(['#sp-cd'],true);
  $('#sp-gname').textContent=g.name;$('#sp-timer').textContent=fmtTime(SP_SEC);$('#sp-count').textContent='0';
  $('#sp-finish').disabled=true;
  const ref=$('#sp-ref');ref.innerHTML='';
  for(let i=0;i<SP.ref.length;i+=40){const d=el('div','ln');d.textContent=SP.ref.slice(i,i+40);ref.appendChild(d);}
  const ta=$('#sp-input');ta.value='';ta.disabled=false;ta.style.height='';
  let n=3;$('#sp-cd').textContent=n;
  const cd=setInterval(()=>{
    n--;
    if(n>0){$('#sp-cd').textContent=n;return;}
    clearInterval(cd);
    show(['#sp-cd'],false);show(['#sp-body'],true);
    $('#sp-finish').disabled=false;
    SP.running=true;SP.endAt=Date.now()+SP_SEC*1000;
    ta.focus();
    SP.timer=setInterval(spTick,200);
  },1000);
  SP.cd=cd;
}
function spTick(){
  const rem=(SP.endAt-Date.now())/1000;
  $('#sp-timer').textContent=fmtTime(rem);
  $('#sp-timer').classList.toggle('warn',rem<=60);
  if(rem<=0)spFinish();
}
function spAbort(){
  clearInterval(SP.cd);clearInterval(SP.timer);SP.running=false;
  show(['#sp-exam','#sp-result'],false);show(['#sp-setup'],true);
}
function spFinish(){
  if(!SP.running)return;
  SP.running=false;clearInterval(SP.timer);
  const ta=$('#sp-input');ta.disabled=true;ta.blur();
  setTimeout(()=>spResult(ta.value),80);
}
function spResult(raw){
  const g=SP.g;
  const T=raw.replace(/[\r\n]/g,'');
  const r=align(T,SP.ref,true);
  const cnt={s:0,d:0,i:0};r.ops.forEach(o=>{if(o.k!=='m')cnt[o.k]++;});
  const mistakes=r.dist,cut=mistakes*g.cut,net=T.length-cut,ok=net>=g.pass;
  show(['#sp-exam'],false);show(['#sp-result'],true);
  $('#sp-rname').textContent=g.name;
  const v=$('#sp-verdict');v.textContent=ok?'合格（速度）':'不合格（速度）';v.className='verdict '+(ok?'ok':'ng');
  $('#sp-stat').innerHTML=
    `<div><small>入力文字数</small><b>${T.length}</b></div>`+
    `<div><small>ミス数</small><b>${mistakes}</b><small>誤字${cnt.s}・脱字${cnt.d}・余分${cnt.i}</small></div>`+
    `<div><small>減字（ミス×${g.cut}）</small><b>−${cut}</b></div>`+
    `<div><small>正味文字数</small><b>${net}</b></div>`+
    `<div><small>合格文字数</small><b>${g.pass}</b></div>`+
    `<div><small>課題文の漢字含有率</small><b>${(100*kanjiCount(SP.ref)/SP.ref.length).toFixed(1)}%</b></div>`;
  $('#sp-formula').textContent=`正味文字数 ${net} ＝ 入力 ${T.length} − ミス ${mistakes} × ${g.cut}。合格文字数 ${g.pass} に対して ${ok?'達成':'未達（あと '+(g.pass-net)+' 文字）'}。`;
  let a='',b='';
  for(const o of r.ops){
    if(o.k==='m'){a+=esc(o.r);b+=esc(o.t);}
    else if(o.k==='s'){a+=`<mark class="bad">${esc(o.r)}</mark>`;b+=`<mark class="bad">${esc(o.t)}</mark>`;}
    else if(o.k==='d'){a+=`<mark class="bad">${esc(o.r)}</mark>`;b+=`<mark class="gap">∧</mark>`;}
    else{b+=`<mark class="bad">${esc(o.t)}</mark>`;}
  }
  $('#sp-dref').innerHTML=a;$('#sp-dtyp').innerHTML=b||'<span class="mute">（入力なし）</span>';
}
$('#sp-start').onclick=spStart;
$('#sp-abort').onclick=spAbort;
$('#sp-finish').onclick=spFinish;
$('#sp-again').onclick=spStart;
$('#sp-back').onclick=()=>{show(['#sp-result'],false);show(['#sp-setup'],true);};
(function(){
  const ta=$('#sp-input');
  const grow=()=>{ta.style.height='auto';ta.style.height=Math.max(ta.scrollHeight,0)+'px';};
  ta.addEventListener('input',()=>{grow();$('#sp-count').textContent=ta.value.replace(/[\r\n]/g,'').length;});
  ta.addEventListener('paste',e=>e.preventDefault());
  ta.addEventListener('drop',e=>e.preventDefault());
})();

/* ================= 文書作成部門 ================= */
const P=(x,a='l',i=0)=>({t:'p',x,a,i});
const B=()=>P('');
const TB=(a,rows)=>({t:'t',a,cells:rows.map(r=>r.map(c=>{const m=/^([lcr]):(.*)$/.exec(c);return m?{x:m[2],a:m[1]}:{x:c,a:'l'};}))});
const DOCS=[
 {id:'k4a',grp:'4',title:'防災訓練の実施について',blocks:[
  P('総第123号','r'),P('令和8年11月20日','r'),B(),P('社員各位'),B(),P('総務部長','r'),B(),
  P('防災訓練の実施について','c'),B(),
  P('下記のとおり、全社一斉の防災訓練を実施します。各自の持ち場で安全を確保し、誘導に従って避難してください。','l',1),B(),
  P('記','c'),B(),P('日時　令和8年12月3日（水）午後1時30分'),P('場所　本社駐車場'),P('持ち物　ヘルメット、筆記用具'),B(),P('以上','r')]},
 {id:'k4b',grp:'4',title:'会議室使用ルールの変更について',blocks:[
  P('総務第45号','r'),P('令和8年11月18日','r'),B(),P('各部署責任者様'),B(),P('総務部長','r'),B(),
  P('会議室使用ルールの変更について','c'),B(),
  P('会議室の予約が重なる事例が増えております。つきましては、下記のとおりルールを変更いたしますので、ご協力をお願いいたします。','l',1),B(),
  P('記','c'),B(),P('予約方法　社内システムから予約する'),P('使用時間　1回につき2時間以内とする'),P('実施日　令和8年12月1日（月）から'),B(),P('以上','r')]},
 {id:'k3a',grp:'3',title:'新製品説明会のご案内（表あり）',blocks:[
  P('営第208号','r'),P('令和8年11月10日','r'),B(),P('株式会社桜山商事'),P('営業部長　山田太郎様'),B(),
  P('北斗産業株式会社','r'),P('営業部長　佐藤健','r'),B(),P('新製品説明会のご案内','c'),B(),
  P('拝啓　時下ますますご清栄のこととお慶び申し上げます。平素は格別のお引き立てを賜り、厚くお礼申し上げます。','l',1),
  P('さて、このたび新製品の説明会を下記のとおり開催いたします。ご多用中恐縮ですが、ぜひご出席くださいますようご案内申し上げます。','l',1),
  P('敬具','r'),B(),P('記','c'),B(),
  P('日時　令和8年12月8日（月）午後2時から'),P('場所　当社本社　第1会議室'),P('内容　下表のとおり'),B(),
  TB('c',[['c:時間','c:内容','c:担当'],['14:00','製品の概要','開発部'],['14:40','実演','営業部'],['15:20','質疑応答','全員']]),B(),P('以上','r')]},
 {id:'k3b',grp:'3',title:'10月度地区別売上実績について（表あり）',blocks:[
  P('営業第31号','r'),P('令和8年11月5日','r'),B(),P('各課長'),B(),P('営業企画課','r'),B(),
  P('10月度地区別売上実績について','c'),B(),
  P('10月度の地区別売上実績をまとめましたので、報告します。前月と比べて西地区が大きく伸びています。','l',1),B(),
  TB('c',[['c:地区','c:売上高（万円）','c:前月比（%）'],['東地区','r:1,250','r:102'],['西地区','r:1,480','r:118'],['南地区','r:980','r:95'],['北地区','r:760','r:99']]),B(),
  P('今後も各地区の動向を注視し、対策を進めてください。','l',1),B(),P('以上','r')]},
 {id:'k1a',grp:'1',title:'新年会開催のお知らせ（表あり・地図なし簡易版）',blocks:[
  P('総務第77号','r'),P('令和8年11月12日','r'),B(),P('全社員各位'),B(),P('厚生委員会','r'),B(),
  P('新年会開催のお知らせ','c'),B(),
  P('恒例の新年会を下記のとおり開催します。会費は下表のとおりです。出欠は同封の用紙により、12月19日（金）までにお知らせください。','l',1),B(),
  P('記','c'),B(),P('日時　令和9年1月16日（土）午後6時から'),P('場所　ホテルグランシティ　3階「桜の間」'),P('会費　下表のとおり'),B(),
  TB('c',[['c:区分','c:対象','c:会費（円）','c:備考'],['一般','社員','r:5,000','飲み放題'],['管理職','課長以上','r:7,000','同上'],['新入社員','入社1年目','r:2,000','同上'],['家族','同伴者','r:3,000','子どもは無料']]),B(),P('以上','r')]},
 {id:'k1b',grp:'1',title:'施設利用料金の改定について（表あり・地図なし簡易版）',blocks:[
  P('管第15号','r'),P('令和8年11月25日','r'),B(),P('利用者各位'),B(),P('市民文化センター','r'),P('館長　高橋一郎','r'),B(),
  P('施設利用料金の改定について','c'),B(),
  P('平素より当センターをご利用いただき、誠にありがとうございます。','l',1),
  P('このたび、施設の維持管理費の上昇に伴い、下表のとおり利用料金を改定することといたしました。皆様のご理解をお願い申し上げます。','l',1),B(),
  TB('c',[['c:施設名','c:定員（人）','c:現行料金（円）','c:改定後料金（円）'],['大ホール','r:400','r:24,000','r:26,000'],['小ホール','r:120','r:9,000','r:10,000'],['会議室A','r:40','r:3,000','r:3,500'],['会議室B','r:20','r:2,000','r:2,300']]),B(),
  P('実施日　令和9年4月1日'),B(),P('以上','r')]},
];
const DGRP=[{g:'4',label:'4級',cond:'手書き問題からビジネス文書作成（表なし）'},{g:'3',label:'3級・準2級・2級',cond:'手書き問題からビジネス文書作成（表を含む）'},{g:'1',label:'準1級・1級',cond:'手書き問題からビジネス文書作成（表を含む／地図は未対応）'}];
$('#de-grade').innerHTML=DGRP.map(x=>`<option value="${x.g}">${x.label}</option>`).join('');
function deFillProb(){
  const g=$('#de-grade').value;
  $('#de-prob').innerHTML=DOCS.filter(d=>d.grp===g).map(d=>`<option value="${d.id}">${esc(d.title)}</option>`).join('');
  const gg=DGRP.find(x=>x.g===g);
  $('#de-cond').innerHTML=`<table class="cond"><tr><th>試験時間</th><th>用紙</th><th>1ミスの減点</th><th>出題内容</th><th>合格点</th></tr><tr><td>20分</td><td>A4縦</td><td>2点減</td><td>${gg.cond}</td><td>80点以上</td></tr></table>`;
}
$('#de-grade').onchange=deFillProb;deFillProb();

/* ---- ページ描画 ---- */
const MM=96/25.4,PW=210*MM,PH=297*MM;
function cleanSetup(s){
  const n=(v,lo,hi,d)=>{v=Number(v);if(!isFinite(v))v=d;return Math.min(hi,Math.max(lo,v));};
  const o={cpl:Math.round(n(s.cpl,10,80,40)),top:n(s.top,0,120,30),bottom:n(s.bottom,0,120,30),left:n(s.left,0,100,30),right:n(s.right,0,100,30)};
  if(210-o.left-o.right<30){o.left=Math.min(o.left,90);o.right=Math.min(o.right,90);}
  if(297-o.top-o.bottom<50){o.top=Math.min(o.top,120);o.bottom=Math.min(o.bottom,120);}
  return o;
}
function buildPaper(blocks,setup,opt){
  const s=cleanSetup(setup);
  const L=s.left*MM,R=s.right*MM,Tm=s.top*MM,Bm=s.bottom*MM;
  const bw=Math.max(40,PW-L-R),bh=Math.max(40,PH-Tm-Bm),pitch=bw/s.cpl;
  const paper=el('div','paper'+(opt.draft?' draft':'')+(opt.guide?' guide':''));
  paper.style.width=PW+'px';paper.style.height=PH+'px';
  const body=el('div','pbody');
  Object.assign(body.style,{left:L+'px',top:Tm+'px',width:bw+'px',height:bh+'px',fontSize:pitch+'px'});
  const AL={l:'left',c:'center',r:'right'};
  for(const b of blocks){
    if(b.t==='p'){
      const d=el('div','pp');d.style.textAlign=AL[b.a]||'left';
      if(b.i)d.style.textIndent='1em';
      d.textContent=b.x;body.appendChild(d);
    }else{
      const tb=document.createElement('table');
      tb.style.margin=b.a==='c'?'0 auto':(b.a==='r'?'0 0 0 auto':'0 auto 0 0');
      for(const row of b.cells){
        const tr=document.createElement('tr');
        for(const c of row){const td=document.createElement('td');td.style.textAlign=AL[c.a]||'left';td.textContent=c.x;if(!c.x)td.innerHTML='&nbsp;';tr.appendChild(td);}
        tb.appendChild(tr);
      }
      body.appendChild(tb);
    }
  }
  paper.appendChild(body);
  return {paper,body};
}
function measureOverflow(blocks,setup){
  const {paper,body}=buildPaper(blocks,setup,{});
  const host=el('div');host.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden';
  host.appendChild(paper);document.body.appendChild(host);
  const over=body.scrollHeight>body.clientHeight+1;
  host.remove();return over;
}
function mountPaper(host,blocks,setup,opt){
  host.innerHTML='';
  const {paper}=buildPaper(blocks,setup,opt);
  host.appendChild(paper);host._paper=paper;fitOne(host);
}
function fitOne(host){
  const p=host._paper;if(!p)return;
  const w=host.clientWidth;if(!w)return;
  const sc=Math.min(1,w/PW);
  p.style.transform=`scale(${sc})`;host.style.height=(PH*sc)+'px';
}
function fitAll(){document.querySelectorAll('.pvwrap').forEach(fitOne);}
window.addEventListener('resize',fitAll);

/* ---- エディタ状態 ---- */
let D={prob:null,setup:{cpl:35,top:30,bottom:30,left:30,right:30},blocks:[],curId:null,focusCell:null,running:false,endAt:0,timer:null};
let UID=1;
const newP=(a='l')=>({id:UID++,t:'p',x:'',a,i:0});
const newT=()=>({id:UID++,t:'t',a:'c',cells:Array.from({length:3},()=>Array.from({length:3},()=>({x:'',a:'l'})))});
const AN={l:'左寄せ',c:'中央',r:'右寄せ'};

function updatePreview(){
  mountPaper($('#de-preview'),D.blocks,D.setup,{guide:true});
  const f=formatCheck(D.setup,D.blocks);
  $('#de-fmt').innerHTML=f.length?`<span class="fmtng">書式：${f.length}件の注意（${f.map(esc).join(' ／ ')}）</span>`:'<span class="fmtok">書式：問題なし</span>';
}
function formatCheck(setup,blocks){
  const s=cleanSetup(setup),out=[];
  if(Number(setup.cpl)!==40)out.push('1行40文字に設定されていない');
  const raw={top:Number(setup.top),bottom:Number(setup.bottom),left:Number(setup.left),right:Number(setup.right)};
  if(raw.top+raw.bottom>=297/2)out.push('上下の余白が用紙の1/2以上');
  const mx=Math.max(raw.left,raw.right),mn=Math.min(raw.left,raw.right);
  if(mx>0&&mx>=2*mn)out.push('左右の余白が反対側の2倍以上');
  if(measureOverflow(blocks,s))out.push('解答が2ページにまたがる');
  return out;
}

function autoGrow(t){t.style.height='auto';t.style.height=(t.scrollHeight+2)+'px';}
function focusBlock(id,pos){
  const t=document.querySelector(`#de-blocks textarea[data-bid="${id}"]`);
  if(t){t.focus();const p=pos==null?t.value.length:pos;t.setSelectionRange(p,p);}
}
function insertAfterCur(blk){
  const idx=D.blocks.findIndex(b=>b.id===D.curId);
  if(idx<0)D.blocks.push(blk);else D.blocks.splice(idx+1,0,blk);
  D.curId=blk.id;
}
function moveBlock(i,d){const j=i+d;if(j<0||j>=D.blocks.length)return;[D.blocks[i],D.blocks[j]]=[D.blocks[j],D.blocks[i]];renderEditor();}
function delBlock(i){if(D.blocks.length<=1){D.blocks=[newP()];}else D.blocks.splice(i,1);D.curId=null;renderEditor();}
function alBtns(cur,fn){
  const g=el('span');
  for(const a of ['l','c','r']){const b=el('button','btn sm'+(cur===a?' on':''));b.type='button';b.textContent=AN[a];b.onclick=()=>fn(a);g.appendChild(b);}
  return g;
}
function renderEditor(focusSpec){
  const host=$('#de-blocks');host.innerHTML='';
  D.blocks.forEach((b,bi)=>{
    const card=el('div','blk'+(b.id===D.curId?' cur':''));
    card.onclick=()=>{if(D.curId!==b.id){D.curId=b.id;document.querySelectorAll('#de-blocks .blk').forEach(c=>c.classList.remove('cur'));card.classList.add('cur');}};
    const bar=el('div','blkbar');
    const tag=el('span','mute');tag.textContent=b.t==='p'?(b.x===''?'空行／段落':'段落'):'表';bar.appendChild(tag);
    bar.appendChild(alBtns(b.a,a=>{b.a=a;renderEditor({bid:b.id});updatePreview();}));
    if(b.t==='p'){
      const ib=el('button','btn sm'+(b.i?' on':''));ib.type='button';ib.textContent='字下げ';ib.onclick=()=>{b.i=b.i?0:1;renderEditor({bid:b.id});updatePreview();};bar.appendChild(ib);
    }else{
      const lab=el('span','mute');lab.textContent=`表の位置／${b.cells.length}行×${b.cells[0].length}列`;bar.appendChild(lab);
      const mk=(t,fn)=>{const x=el('button','btn sm');x.type='button';x.textContent=t;x.onclick=fn;bar.appendChild(x);};
      mk('行＋',()=>{b.cells.push(b.cells[0].map(()=>({x:'',a:'l'})));renderEditor();updatePreview();});
      mk('行−',()=>{if(b.cells.length>1){b.cells.pop();renderEditor();updatePreview();}});
      mk('列＋',()=>{b.cells.forEach(r=>r.push({x:'',a:'l'}));renderEditor();updatePreview();});
      mk('列−',()=>{if(b.cells[0].length>1){b.cells.forEach(r=>r.pop());renderEditor();updatePreview();}});
    }
    const sp=el('span','sp');bar.appendChild(sp);
    const mv=(t,fn)=>{const x=el('button','btn sm');x.type='button';x.textContent=t;x.onclick=fn;bar.appendChild(x);};
    mv('↑',()=>moveBlock(bi,-1));mv('↓',()=>moveBlock(bi,1));mv('削除',()=>delBlock(bi));
    card.appendChild(bar);
    if(b.t==='p'){
      const ta=document.createElement('textarea');ta.rows=1;ta.value=b.x;ta.dataset.bid=b.id;ta.lang='ja';ta.spellcheck=false;
      ta.style.textAlign=b.a==='c'?'center':(b.a==='r'?'right':'left');
      ta.addEventListener('focus',()=>{D.curId=b.id;document.querySelectorAll('#de-blocks .blk').forEach(c=>c.classList.remove('cur'));card.classList.add('cur');});
      ta.addEventListener('input',()=>{b.x=ta.value;autoGrow(ta);updatePreview();tag.textContent=b.x===''?'空行／段落':'段落';});
      ta.addEventListener('keydown',e=>{
        if(e.isComposing||e.keyCode===229)return;
        if(e.key==='Enter'&&!e.shiftKey){
          e.preventDefault();
          const pos=ta.selectionStart;const before=ta.value.slice(0,pos),after=ta.value.slice(pos);
          b.x=before;const nb=newP(b.a);nb.x=after;
          D.blocks.splice(bi+1,0,nb);D.curId=nb.id;
          renderEditor({bid:nb.id,pos:0});updatePreview();
        }else if(e.key==='Backspace'&&ta.selectionStart===0&&ta.selectionEnd===0&&bi>0){
          const pr=D.blocks[bi-1];
          if(pr.t==='p'){
            e.preventDefault();const jp=pr.x.length;pr.x+=b.x;D.blocks.splice(bi,1);D.curId=pr.id;
            renderEditor({bid:pr.id,pos:jp});updatePreview();
          }else if(b.x===''){e.preventDefault();D.blocks.splice(bi,1);D.curId=pr.id;renderEditor();updatePreview();}
        }
      });
      card.appendChild(ta);
    }else{
      const tb=el('table','cellgrid');
      b.cells.forEach((row,r)=>{
        const tr=document.createElement('tr');
        row.forEach((c,ci)=>{
          const td=document.createElement('td');const inp=document.createElement('input');
          inp.type='text';inp.value=c.x;inp.lang='ja';inp.spellcheck=false;
          inp.dataset.bid=b.id;inp.dataset.r=r;inp.dataset.c=ci;
          inp.style.textAlign=c.a==='c'?'center':(c.a==='r'?'right':'left');
          inp.addEventListener('focus',()=>{
            D.curId=b.id;D.focusCell={bid:b.id,r,c:ci};
            document.querySelectorAll('#de-blocks .blk').forEach(x=>x.classList.remove('cur'));card.classList.add('cur');
            card.querySelectorAll('input.fc').forEach(x=>x.classList.remove('fc'));inp.classList.add('fc');
          });
          inp.addEventListener('input',()=>{c.x=inp.value;updatePreview();});
          inp.addEventListener('keydown',e=>{
            if(e.isComposing||e.keyCode===229)return;
            if(e.key==='Enter'){e.preventDefault();const nx=card.querySelector(`input[data-r="${r+1}"][data-c="${ci}"]`);if(nx)nx.focus();}
          });
          td.appendChild(inp);tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      card.appendChild(tb);
      const cb=el('div','blkbar');cb.style.marginTop='4px';
      const lab=el('span','mute');lab.textContent='選択中のセルの配置：';cb.appendChild(lab);
      for(const a of ['l','c','r']){
        const x=el('button','btn sm');x.type='button';x.textContent=AN[a];
        x.onmousedown=e=>e.preventDefault();
        x.onclick=()=>{
          const fc=D.focusCell;if(!fc||fc.bid!==b.id)return;
          b.cells[fc.r][fc.c].a=a;
          const inp=card.querySelector(`input[data-r="${fc.r}"][data-c="${fc.c}"]`);
          if(inp)inp.style.textAlign=a==='c'?'center':(a==='r'?'right':'left');
          updatePreview();
        };
        cb.appendChild(x);
      }
      card.appendChild(cb);
    }
    host.appendChild(card);
  });
  host.querySelectorAll('textarea').forEach(autoGrow);
  if(focusSpec)focusBlock(focusSpec.bid,focusSpec.pos);
}
$('#ad-p').onclick=()=>{const b=newP();insertAfterCur(b);renderEditor({bid:b.id});updatePreview();};
$('#ad-b').onclick=()=>{const b=newP();insertAfterCur(b);renderEditor({bid:b.id});updatePreview();};
$('#ad-t').onclick=()=>{insertAfterCur(newT());renderEditor();updatePreview();};
for(const k of ['cpl','top','bottom','left','right']){
  $('#ps-'+k).addEventListener('input',e=>{D.setup[k]=e.target.value===''?NaN:Number(e.target.value);updatePreview();});
}
function syncSetupInputs(){for(const k of ['cpl','top','bottom','left','right'])$('#ps-'+k).value=D.setup[k];}

function deStart(){
  const prob=DOCS.find(d=>d.id===$('#de-prob').value);
  D.prob=prob;D.setup={cpl:35,top:30,bottom:30,left:30,right:30};
  D.blocks=[newP()];D.curId=D.blocks[0].id;D.focusCell=null;
  show(['#de-setup','#de-result'],false);show(['#de-exam'],true);
  syncSetupInputs();renderEditor();
  mountPaper($('#de-draft'),prob.blocks,{cpl:40,top:30,bottom:30,left:30,right:30},{draft:true});
  updatePreview();
  D.running=true;D.endAt=Date.now()+20*60*1000;
  $('#de-timer').textContent=fmtTime(1200);
  clearInterval(D.timer);D.timer=setInterval(deTick,250);
  requestAnimationFrame(fitAll);
  focusBlock(D.blocks[0].id,0);
}
function deTick(){
  const rem=(D.endAt-Date.now())/1000;
  $('#de-timer').textContent=fmtTime(rem);$('#de-timer').classList.toggle('warn',rem<=120);
  if(rem<=0)deSubmit();
}
function deAbort(){clearInterval(D.timer);D.running=false;show(['#de-exam','#de-result'],false);show(['#de-setup'],true);}

/* ---- 採点 ---- */
const normT=s=>String(s).replace(/[ 　\t]+$/,'');
function stripBlank(a){
  a=a.slice();
  while(a.length&&a[a.length-1].t==='p'&&normT(a[a.length-1].x)==='')a.pop();
  while(a.length&&a[0].t==='p'&&normT(a[0].x)==='')a.shift();
  return a;
}
function textRuns(u,m){
  const r=align(normT(u),normT(m),false);const runs=[];let cur=null;
  for(const o of r.ops){
    if(o.k==='m'){cur=null;continue;}
    if(!cur){cur={u:'',m:''};runs.push(cur);}
    cur.u+=o.t;cur.m+=o.r;
  }
  return {dist:r.dist,runs};
}
const lab=(b)=>b.t==='t'?'表':('「'+(normT(b.x).slice(0,14)||'（空行）')+(normT(b.x).length>14?'…':'')+'」');
function pairItems(u,m){ // 1項目＝1ミス。{c:コスト, items:[...]}（照合不可は null）
  const items=[];
  if(u.t!==m.t)return null;
  if(m.t==='p'){
    const um=normT(u.x),mm=normT(m.x);
    const tr=textRuns(um,mm);
    if(um!==''||mm!==''){if(tr.dist>Math.max(um.length,mm.length)*0.5)return null;}
    tr.runs.forEach(r=>items.push(`${lab(m)}：文字の誤り（原稿「${r.m||'なし'}」→入力「${r.u||'なし'}」）`));
    if(mm!==''){
      if(u.a!==m.a)items.push(`${lab(m)}：配置の誤り（原稿は${AN[m.a]}／入力は${AN[u.a]}）`);
      if((u.i?1:0)!==(m.i?1:0))items.push(`${lab(m)}：字下げの誤り（原稿は${m.i?'字下げあり':'字下げなし'}）`);
    }
  }else{
    const ru=u.cells.length,cu=u.cells[0].length,rm=m.cells.length,cm=m.cells[0].length;
    if(ru!==rm)items.push(`表：行数の誤り（原稿${rm}行／入力${ru}行）`);
    if(cu!==cm)items.push(`表：列数の誤り（原稿${cm}列／入力${cu}列）`);
    if(u.a!==m.a)items.push(`表：位置の誤り（原稿は${AN[m.a]}／入力は${AN[u.a]}）`);
    for(let r=0;r<Math.min(ru,rm);r++)for(let c=0;c<Math.min(cu,cm);c++){
      const a=u.cells[r][c],b=m.cells[r][c],w=`表の${r+1}行${c+1}列`;
      textRuns(a.x,b.x).runs.forEach(x=>items.push(`${w}：文字の誤り（原稿「${x.m||'なし'}」→入力「${x.u||'なし'}」）`));
      if(normT(b.x)!==''&&a.a!==b.a)items.push(`${w}：配置の誤り（原稿は${AN[b.a]}／入力は${AN[a.a]}）`);
    }
  }
  return {c:items.length,items};
}
function matchBlocks(U,M){
  const n=U.length,m=M.length,W=m+1,INF=1e9;
  const pc=Array.from({length:n},()=>new Array(m));
  const dp=new Array((n+1)*W).fill(0);
  for(let j=0;j<=m;j++)dp[j]=j;
  for(let i=1;i<=n;i++){
    dp[i*W]=i;
    for(let j=1;j<=m;j++){
      const p=pairItems(U[i-1],M[j-1]);pc[i-1][j-1]=p;
      let v=Math.min(dp[(i-1)*W+j],dp[i*W+j-1])+1;
      if(p){const s=dp[(i-1)*W+j-1]+p.c;if(s<v)v=s;}
      dp[i*W+j]=v;
    }
  }
  const pairs=[];let i=n,j=m;
  while(i>0||j>0){
    const cur=dp[i*W+j];const p=(i>0&&j>0)?pc[i-1][j-1]:null;
    if(p&&dp[(i-1)*W+j-1]+p.c===cur){pairs.push({u:i-1,m:j-1,p});i--;j--;}
    else if(j>0&&dp[i*W+j-1]+1===cur){pairs.push({u:-1,m:j-1});j--;}
    else{pairs.push({u:i-1,m:-1});i--;}
  }
  return pairs.reverse();
}
function gradeDoc(prob,setup,blocks){
  const M=stripBlank(prob.blocks),U=stripBlank(blocks);
  const pairs=matchBlocks(U,M);
  const items=[];
  for(const p of pairs){
    if(p.u>=0&&p.m>=0)p.p.items.forEach(x=>items.push(x));
    else if(p.m>=0){const b=M[p.m];items.push(b.t==='t'?'表がありません':(normT(b.x)===''?'空行が不足しています':`段落が入力されていません：${lab(b)}`));}
    else{const b=U[p.u];items.push(b.t==='t'?'余分な表があります':(normT(b.x)===''?'余分な空行があります':`余分な段落があります：${lab(b)}`));}
  }
  const fmt=formatCheck(setup,blocks);
  const total=items.length+fmt.length;
  const score=Math.max(0,100-2*total);
  return {items,fmt,total,score,pass:score>=80};
}
function deSubmit(){
  if(!D.running)return;
  D.running=false;clearInterval(D.timer);
  document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
  const r=gradeDoc(D.prob,D.setup,D.blocks);
  show(['#de-exam'],false);show(['#de-result'],true);
  const v=$('#de-verdict');v.textContent=r.pass?'合格（文書作成）':'不合格（文書作成）';v.className='verdict '+(r.pass?'ok':'ng');
  $('#de-stat').innerHTML=`<div><small>得点</small><b>${r.score}点</b><small>合格は80点以上</small></div><div><small>ミス合計</small><b>${r.total}</b><small>文書${r.items.length}＋書式${r.fmt.length}</small></div><div><small>減点</small><b>−${2*r.total}</b></div>`;
  const ol=$('#de-items');ol.innerHTML='';
  r.fmt.forEach(x=>{const li=document.createElement('li');li.innerHTML=`<b>書式</b>：${esc(x)}`;ol.appendChild(li);});
  r.items.forEach(x=>{const li=document.createElement('li');li.textContent=x;ol.appendChild(li);});
  if(!r.total){const li=document.createElement('li');li.textContent='ミスはありません。満点です。';ol.appendChild(li);}
  mountPaper($('#de-rdraft'),D.prob.blocks,{cpl:40,top:30,bottom:30,left:30,right:30},{draft:true});
  mountPaper($('#de-rmine'),D.blocks,D.setup,{guide:true});
  requestAnimationFrame(fitAll);
}
$('#de-start').onclick=deStart;
$('#de-again').onclick=deStart;
$('#de-abort').onclick=deAbort;
$('#de-submit').onclick=deSubmit;
$('#de-back').onclick=()=>{show(['#de-result'],false);show(['#de-setup'],true);};

/* ================= タイピング練習（イージータイピスト） =================
   他機能と干渉しないよう即時関数で囲み、キー入力はプレイ中かつこのタブ表示中だけ処理する */
const TY=(function(){
  const g=id=>document.getElementById(id);

  /* 問題（ひらがな） */
  /* お題は texts.js の既定値、または管理画面で登録した内容（getTyWords） */

  /* ローマ字テーブル（各配列の先頭が「お手本」表記） */
  const KANA={
    "あ":["a"],"い":["i"],"う":["u"],"え":["e"],"お":["o"],
    "か":["ka"],"き":["ki"],"く":["ku"],"け":["ke"],"こ":["ko"],
    "さ":["sa"],"し":["shi","si","ci"],"す":["su"],"せ":["se"],"そ":["so"],
    "た":["ta"],"ち":["chi","ti"],"つ":["tsu","tu"],"て":["te"],"と":["to"],
    "な":["na"],"に":["ni"],"ぬ":["nu"],"ね":["ne"],"の":["no"],
    "は":["ha"],"ひ":["hi"],"ふ":["fu","hu"],"へ":["he"],"ほ":["ho"],
    "ま":["ma"],"み":["mi"],"む":["mu"],"め":["me"],"も":["mo"],
    "や":["ya"],"ゆ":["yu"],"よ":["yo"],
    "ら":["ra"],"り":["ri"],"る":["ru"],"れ":["re"],"ろ":["ro"],
    "わ":["wa"],"を":["wo"],
    "が":["ga"],"ぎ":["gi"],"ぐ":["gu"],"げ":["ge"],"ご":["go"],
    "ざ":["za"],"じ":["ji","zi"],"ず":["zu"],"ぜ":["ze"],"ぞ":["zo"],
    "だ":["da"],"ぢ":["di"],"づ":["du"],"で":["de"],"ど":["do"],
    "ば":["ba"],"び":["bi"],"ぶ":["bu"],"べ":["be"],"ぼ":["bo"],
    "ぱ":["pa"],"ぴ":["pi"],"ぷ":["pu"],"ぺ":["pe"],"ぽ":["po"],
    "ぁ":["la","xa"],"ぃ":["li","xi"],"ぅ":["lu","xu"],"ぇ":["le","xe"],"ぉ":["lo","xo"],
    "ゃ":["lya","xya"],"ゅ":["lyu","xyu"],"ょ":["lyo","xyo"],
    "っ":["ltu","xtu","ltsu"],
    "ー":["-"],"、":[","],"。":["."]
  };

  /* 拗音（2文字で1まとまり） */
  const COMBO={
    "きゃ":["kya"],"きゅ":["kyu"],"きょ":["kyo"],
    "しゃ":["sha","sya"],"しゅ":["shu","syu"],"しょ":["sho","syo"],
    "ちゃ":["cha","tya","cya"],"ちゅ":["chu","tyu","cyu"],"ちょ":["cho","tyo","cyo"],
    "にゃ":["nya"],"にゅ":["nyu"],"にょ":["nyo"],
    "ひゃ":["hya"],"ひゅ":["hyu"],"ひょ":["hyo"],
    "みゃ":["mya"],"みゅ":["myu"],"みょ":["myo"],
    "りゃ":["rya"],"りゅ":["ryu"],"りょ":["ryo"],
    "ぎゃ":["gya"],"ぎゅ":["gyu"],"ぎょ":["gyo"],
    "じゃ":["ja","jya","zya"],"じゅ":["ju","jyu","zyu"],"じょ":["jo","jyo","zyo"],
    "びゃ":["bya"],"びゅ":["byu"],"びょ":["byo"],
    "ぴゃ":["pya"],"ぴゅ":["pyu"],"ぴょ":["pyo"]
  };
  const VOWELS="aiueo";
  const uniq=a=>[...new Set(a)];

  /* かな1まとまりを読む（拗音 or 1文字） */
  function readUnit(text,i){
    if(i>=text.length)return null;
    const pair=text.substr(i,2);
    if(pair.length===2&&COMBO[pair]){
      const split=[];
      const a=KANA[pair[0]],b=KANA[pair[1]];
      if(a&&b)for(const x of a)for(const y of b)split.push(x+y);
      return {kana:pair,cands:uniq([...COMBO[pair],...split])};
    }
    const c=text[i];
    if(KANA[c])return {kana:c,cands:[...KANA[c]]};
    return {kana:c,cands:[c]};
  }

  /* お題を「まとまり」の配列に分解（各まとまりに入力候補を持たせる） */
  function parseUnits(text){
    const units=[];let i=0;
    while(i<text.length){
      const c=text[i];
      if(c==="っ"&&i+1<text.length){
        const next=readUnit(text,i+1);
        const cands=[];
        for(const r of next.cands)if(!VOWELS.includes(r[0])&&r[0]!=="n")cands.push(r[0]+r);
        for(const s of KANA["っ"])for(const r of next.cands)cands.push(s+r);
        units.push({kana:c+next.kana,cands:uniq(cands)});
        i+=1+next.kana.length;continue;
      }
      if(c==="ん"){
        const next=readUnit(text,i+1);
        const needNN=!next||next.cands.some(r=>"aiueony".includes(r[0]));
        units.push({kana:c,cands:needNN?["nn","xn"]:["nn","n","xn"]});
        i++;continue;
      }
      const u=readUnit(text,i);
      units.push(u);i+=u.kana.length;
    }
    return units;
  }

  /* ゲーム状態 */
  let state="title";           // title / play / result
  let order=[],qIndex=0,units=[],unitIdx=0,buf="",typedDone="";
  let miss=0,totalKey=0,correctKey=0,startTime=0,audioCtx=null;

  /* JIS配列キーボード（offset：段ズレpx） */
  const LAYOUT=[
    {offset:0, keys:["1","2","3","4","5","6","7","8","9","0","-","^","¥"]},
    {offset:24,keys:["q","w","e","r","t","y","u","i","o","p","@","["]},
    {offset:36,keys:["a","s","d","f","g","h","j","k","l",";",":","]"]},
    {offset:60,keys:["z","x","c","v","b","n","m",",",".","/","\\"]},
    {offset:180,keys:[" "]}
  ];
  function buildKeyboard(){
    const kb=g("ty-kb");
    for(const row of LAYOUT){
      const r=document.createElement("div");
      r.className="ty-row";r.style.paddingLeft=row.offset+"px";
      for(const k of row.keys){
        const e=document.createElement("div");
        e.className="ty-key";e.dataset.key=k;
        if(k===" "){e.classList.add("space");e.textContent="SPACE";}
        else e.textContent=k.toUpperCase();
        if(k==="f"||k==="j")e.classList.add("home");
        r.appendChild(e);
      }
      kb.appendChild(r);
    }
  }
  const keyEl=k=>g("ty-kb").querySelector('.ty-key[data-key="'+CSS.escape(k)+'"]');

  /* ミス音（AudioContextは使い回す） */
  function beep(){
    if(!audioCtx)return;
    const o=audioCtx.createOscillator(),gn=audioCtx.createGain();
    o.type="square";o.frequency.value=180;gn.gain.value=0.08;
    o.connect(gn);gn.connect(audioCtx.destination);
    o.start();o.stop(audioCtx.currentTime+0.12);
  }

  /* 入力判定（1キー）。正しいキーなら true */
  function tryKey(k){
    const u=units[unitIdx];
    const nb=buf+k;
    if(u.cands.some(c=>c.startsWith(nb))){
      buf=nb;
      const longer=u.cands.some(c=>c.length>buf.length&&c.startsWith(buf));
      if(u.cands.includes(buf)&&!longer)commit();
      return true;
    }
    // 今の入力で確定できる（例：「ん」をn1回）なら、次のまとまりで判定し直す
    if(buf&&u.cands.includes(buf)&&unitIdx+1<units.length){
      const saved={unitIdx,buf,typedDone};
      commit();
      if(tryKey(k))return true;
      unitIdx=saved.unitIdx;buf=saved.buf;typedDone=saved.typedDone;
    }
    return false;
  }
  function commit(){typedDone+=buf;buf="";unitIdx++;}

  /* 残りのお手本ローマ字 */
  function restGuide(){
    let rest="";const u=units[unitIdx];
    if(u){
      const c=u.cands.find(c=>c.startsWith(buf))||u.cands[0];
      rest+=c.slice(buf.length);
      for(let j=unitIdx+1;j<units.length;j++)rest+=units[j].cands[0];
    }
    return rest;
  }

  /* 画面更新 */
  function render(){
    const q=g("ty-q");q.innerHTML="";
    units.forEach((u,j)=>{
      const s=document.createElement("span");
      s.textContent=u.kana;if(j<unitIdx)s.className="kdone";
      q.appendChild(s);
    });
    const rest=restGuide();
    const ro=g("ty-ro");ro.innerHTML="";
    const d=document.createElement("span");d.className="done";d.textContent=typedDone+buf;
    const n=document.createElement("span");n.className="next";n.textContent=rest.charAt(0);
    const r=document.createElement("span");r.textContent=rest.slice(1);
    ro.append(d,n,r);
    g("ty-kb").querySelectorAll(".ty-key.next").forEach(e=>e.classList.remove("next"));
    const t=keyEl(rest.charAt(0));if(t)t.classList.add("next");
    g("ty-count").textContent=(qIndex+1)+" / "+order.length;
    g("ty-miss").textContent=miss;
  }
  function flashKey(k,cls){
    const e=keyEl(k);if(!e)return;
    e.classList.add(cls);setTimeout(()=>e.classList.remove(cls),150);
  }
  function shake(){
    const q=g("ty-q");q.classList.remove("ty-shake");
    void q.offsetWidth;q.classList.add("ty-shake");
  }
  function showQuestion(){
    units=parseUnits(order[qIndex]);unitIdx=0;buf="";typedDone="";render();
  }

  /* 開始 */
  function start(){
    order=[...getTyWords()];
    for(let i=order.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [order[i],order[j]]=[order[j],order[i]];
    }
    qIndex=0;miss=0;totalKey=0;correctKey=0;
    try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();}
    catch(e){audioCtx=null;}
    g("ty-start").hidden=true;g("ty-res").hidden=true;g("ty-game").hidden=false;
    g("ty-ime").style.display="none";
    state="play";startTime=Date.now();showQuestion();
  }

  /* 中止してスタート画面へ（タブ切り替え時にも呼ぶ） */
  function abort(){
    state="title";
    g("ty-game").hidden=true;g("ty-res").hidden=true;g("ty-start").hidden=false;
  }

  /* 結果の記録（localStorage）。最新から最大100件まで保存 */
  const HKEY="ictools_wordpro_ty_history";
  function loadHist(){
    try{const a=JSON.parse(localStorage.getItem(HKEY)||"[]");return Array.isArray(a)?a:[];}
    catch(e){return [];}
  }
  function saveHist(a){
    try{localStorage.setItem(HKEY,JSON.stringify(a.slice(-100)));return true;}
    catch(e){return false;}
  }
  const pad=n=>String(n).padStart(2,"0");
  function fmtDate(t){
    const d=new Date(t);
    return (d.getMonth()+1)+"/"+d.getDate()+" "+pad(d.getHours())+":"+pad(d.getMinutes());
  }
  /* 履歴の表示（ブラウザのコンソール専用）。ty.history() で全件、ty.history(10) で直近10件 */
  function showHist(n){
    const a=loadHist();
    if(!a.length){console.log("[タイピング練習] まだ記録がありません。");return;}
    const list=(n>0?a.slice(-n):a).slice().reverse();
    console.table(list.map(r=>({
      日時:new Date(r.t).toLocaleString("ja-JP"),
      "時間(秒)":+r.sec.toFixed(1),
      ミス:r.miss,
      "正確率(%)":+r.acc.toFixed(1),
      "打鍵/分":r.kpm,
      キーボード非表示:r.hideKb?"○":"",
      ローマ字非表示:r.hideRo?"○":""
    })));
    console.log("[タイピング練習] 全"+a.length+"回／最短時間 "+Math.min(...a.map(r=>r.sec)).toFixed(1)+"秒／最高正確率 "+Math.max(...a.map(r=>r.acc)).toFixed(1)+"%");
  }

  /* 終了 */
  function finish(){
    state="result";
    const sec=(Date.now()-startTime)/1000;
    const acc=totalKey>0?correctKey/totalKey*100:0;
    const kpm=correctKey/sec*60;
    // 記録を保存（非表示設定も一緒に残す）
    const h=loadHist();
    h.push({t:Date.now(),sec:sec,miss:miss,acc:acc,kpm:Math.round(kpm),
            hideKb:g("ty-game").classList.contains("hide-kb"),hideRo:g("ty-game").classList.contains("hide-ro")});
    const saved=saveHist(h);
    g("ty-game").hidden=true;
    const res=g("ty-res");res.hidden=false;
    res.innerHTML=`<h2>リザルト</h2>
      <p>時間 : ${sec.toFixed(1)} 秒</p>
      <p>ミス数 : ${miss}</p>
      <p>正確率 : ${acc.toFixed(1)} %</p>
      <p>1分あたりの打鍵数 : ${kpm.toFixed(0)}</p>
      ${saved?'':'<p class="note">※記録を保存できませんでした（ブラウザの保存が無効の可能性）</p>'}
      <div class="row" style="justify-content:center"><button class="btn pri" id="ty-retry">もう一回</button></div>`;
    g("ty-retry").onclick=start;
  }

  /* キー入力（プレイ中、かつこのタブが表示されている時だけ） */
  document.addEventListener("keydown",e=>{
    if(state!=="play"||g("tab-ty").hidden)return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key==="Process"||e.isComposing){g("ty-ime").style.display="block";return;}
    if(e.key.length!==1)return;
    e.preventDefault();           // スペースでのスクロール防止
    const k=e.key.toLowerCase();
    totalKey++;
    if(tryKey(k)){
      correctKey++;
      g("ty-ime").style.display="none";
      flashKey(k,"ok");
      if(unitIdx>=units.length){
        qIndex++;
        if(qIndex>=order.length)finish();else showQuestion();
      }else render();
    }else{
      miss++;g("ty-miss").textContent=miss;
      flashKey(k,"ng");shake();beep();
    }
  });

  /* 表示設定：キーボード／ローマ字の非表示（スタート画面とプレイ中のチェックボックスを同期） */
  function applyOpts(){
    const hk=document.querySelector("#tab-ty .ty-hk").checked;
    const hr=document.querySelector("#tab-ty .ty-hr").checked;
    g("ty-game").classList.toggle("hide-kb",hk);
    g("ty-game").classList.toggle("hide-ro",hr);
  }
  document.querySelectorAll("#tab-ty .ty-hk, #tab-ty .ty-hr").forEach(cb=>cb.addEventListener("change",()=>{
    // 同じ種類のチェックボックスを揃える
    document.querySelectorAll("#tab-ty ."+cb.className).forEach(o=>o.checked=cb.checked);
    cb.blur();   // スペースキーでチェックが切り替わらないよう、フォーカスを外す
    applyOpts();
  }));

  /* 初期化 */
  buildKeyboard();
  g("ty-startbtn").onclick=start;
  g("ty-abort").onclick=abort;

  // 判定ロジックの単体テスト用に公開
  window.ty={history:showHist};   // コンソール用コマンド：ty.history()
  /* 管理画面用：入力できない文字（ローマ字変換できない文字）の一覧を返す */
  function invalidChars(t){return [...new Set([...t].filter(c=>!KANA[c]&&c!=="ん"))];}
  return {abort,parseUnits,invalidChars,tryKey,restGuide,_set:(q)=>{units=parseUnits(q);unitIdx=0;buf="";typedDone="";},_done:()=>unitIdx>=units.length};
})();
