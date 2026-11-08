/* 入力文の管理画面（課題文・タイピングのお題）。
   編集内容はこのブラウザの localStorage に保存。js/texts.js 書き出しで全員向けに公開できる。 */
(function(){
  const BAND_INFO={
    A:{name:'4級・3級',kmin:23,kmax:26,need:450},
    B:{name:'準2級・2級',kmin:25,kmax:30,need:750},
    C:{name:'準1級・1級',kmin:25,kmax:35,need:1050}
  };
  let band='A';
  let draft=[];   // 編集中の課題文（保存前）

  const msg=(id,t,ng)=>{const e=$(id);e.textContent=t;e.className=ng?'fmtng':'fmtok';};
  function download(name,text,type){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));
    a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  /* ---------- 速度部門 ---------- */
  function loadDraft(){draft=[...getSpeedTexts(band)];renderSp();}
  function statOf(t){
    const info=BAND_INFO[band],n=t.length,k=n?Math.round(kanjiCount(t)/n*1000)/10:0;
    const w=[];
    if(!t.trim())w.push('空です');
    if(n&&(k<info.kmin||k>info.kmax))w.push(`漢字含有率が目安（${info.kmin}〜${info.kmax}%）の外`);
    if(n&&n<info.need)w.push(`${info.name}の最長（${info.need}字）に足りない`);
    return {text:`${n}字／漢字 ${k}%`,warn:w};
  }
  function renderSp(){
    const box=$('#ad-sp-list');box.innerHTML='';
    draft.forEach((t,i)=>{
      const b=el('div','blk');
      const bar=el('div','blkbar');
      const title=el('b');title.textContent='課題文 '+(i+1);
      const st=el('span','mute');
      const sp=el('span','sp');
      const del=el('button','btn sm');del.textContent='削除';
      del.onclick=()=>{draft.splice(i,1);renderSp();};
      bar.append(title,st,sp,del);
      const ta=el('textarea');ta.value=t;ta.rows=4;
      const warn=el('div','fmtng');
      const upd=()=>{
        const s=statOf(ta.value);
        st.textContent=s.text;warn.textContent=s.warn.join(' ／ ');
      };
      ta.oninput=()=>{draft[i]=ta.value;upd();};
      b.append(bar,ta,warn);box.appendChild(b);
      upd();
      ta.style.height=Math.max(80,ta.scrollHeight)+'px';
    });
    if(!draft.length){const p=el('p','note');p.textContent='課題文がありません。このまま保存すると既定の課題文にもどります。';box.appendChild(p);}
  }
  $('#ad-band').onchange=e=>{band=e.target.value;msg('#ad-sp-msg','');loadDraft();};
  $('#ad-sp-add').onclick=()=>{draft.push('');renderSp();};
  $('#ad-sp-save').onclick=()=>{
    const list=cleanList(draft),c=loadCustom();
    c.speed=c.speed||{};c.speed[band]=list;
    if(!saveCustom(c)){msg('#ad-sp-msg','保存に失敗しました（ブラウザの保存が無効かも）',true);return;}
    draft=list.length?list:[...TEXTS[band]];renderSp();spTextOpts();
    msg('#ad-sp-msg',list.length?`保存しました（${list.length}本）`:'空なので既定の課題文にもどしました');
  };
  $('#ad-sp-reset').onclick=()=>{
    if(!confirm(BAND_INFO[band].name+'の課題文を既定値にもどします。いい？'))return;
    const c=loadCustom();if(c.speed)delete c.speed[band];saveCustom(c);
    loadDraft();spTextOpts();msg('#ad-sp-msg','既定値にもどしました');
  };

  /* ---------- タイピング練習 ---------- */
  function checkTy(){
    const lines=$('#ad-ty-text').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const bad=[];
    lines.forEach((l,i)=>{const c=TY.invalidChars(l);if(c.length)bad.push(`${i+1}行目「${l}」の ${c.map(x=>'「'+x+'」').join('')}`);});
    $('#ad-ty-info').textContent=`${lines.length}問`;
    $('#ad-ty-bad').innerHTML=bad.length?'入力できない文字があります（ひらがなと「ー、。」だけ使えます）：<br>'+bad.map(esc).join('<br>'):'';
    return {lines,ok:!bad.length};
  }
  function loadTy(){$('#ad-ty-text').value=getTyWords().join('\n');checkTy();}
  $('#ad-ty-text').oninput=checkTy;
  $('#ad-ty-save').onclick=()=>{
    const r=checkTy();
    if(!r.ok){msg('#ad-ty-msg','入力できない文字を直してから保存してね',true);return;}
    const c=loadCustom();c.typing=r.lines;
    if(!saveCustom(c)){msg('#ad-ty-msg','保存に失敗しました',true);return;}
    loadTy();msg('#ad-ty-msg',r.lines.length?`保存しました（${r.lines.length}問）`:'空なので既定のお題にもどしました');
  };
  $('#ad-ty-reset').onclick=()=>{
    if(!confirm('タイピングのお題を既定値にもどします。いい？'))return;
    const c=loadCustom();delete c.typing;saveCustom(c);loadTy();msg('#ad-ty-msg','既定値にもどしました');
  };

  /* ---------- バックアップ・公開用 ---------- */
  const effective=()=>({speed:{A:getSpeedTexts('A'),B:getSpeedTexts('B'),C:getSpeedTexts('C')},typing:getTyWords()});
  $('#ad-export').onclick=()=>download('ictools_wordpro_texts.json',JSON.stringify(effective(),null,2),'application/json');
  $('#ad-export-js').onclick=()=>{
    const e=effective();
    download('texts.js','const TEXTS='+JSON.stringify(e.speed)+';\nconst TY_WORDS='+JSON.stringify(e.typing)+';\n','text/javascript');
  };
  $('#ad-import').onchange=ev=>{
    const f=ev.target.files[0];ev.target.value='';
    if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const o=JSON.parse(rd.result),c=loadCustom();
        if(!o.speed&&!o.typing)throw new Error('形式が違います');
        if(o.speed&&typeof o.speed==='object'){c.speed=c.speed||{};for(const b of BANDS)if(o.speed[b])c.speed[b]=cleanList(o.speed[b]);}
        if(o.typing)c.typing=cleanList(o.typing);
        if(!saveCustom(c))throw new Error('保存に失敗');
        loadDraft();loadTy();spTextOpts();msg('#ad-io-msg','読み込みました');
      }catch(e){msg('#ad-io-msg','読み込めませんでした：'+e.message,true);}
    };
    rd.readAsText(f,'utf-8');
  };
  $('#ad-clear').onclick=()=>{
    if(!confirm('管理画面で保存した内容をすべて消して、既定値にもどします。いい？'))return;
    try{localStorage.removeItem(CUSTOM_KEY);}catch(e){}
    loadDraft();loadTy();spTextOpts();msg('#ad-io-msg','すべて既定値にもどしました');
  };

  /* 管理タブを開いた時に最新状態を読み込む */
  document.querySelector('nav button[data-tab="admin"]').addEventListener('click',()=>{loadDraft();loadTy();});
  loadDraft();loadTy();
})();
