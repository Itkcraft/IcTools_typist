/* 入力文（課題文・タイピングのお題）の保存と取得。
   既定値は texts.js、管理画面で編集した内容はブラウザの localStorage に保存する。
   カスタムが空の項目は既定値にもどる。 */
const CUSTOM_KEY='ictools_wordpro_custom';
const BANDS=['A','B','C'];
function loadCustom(){
  try{
    const o=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'{}');
    return (o&&typeof o==='object')?o:{};
  }catch(e){return {};}
}
function saveCustom(o){
  try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(o));return true;}catch(e){return false;}
}
const cleanList=a=>Array.isArray(a)?a.map(s=>String(s).replace(/[\r\n]/g,'').trim()).filter(Boolean):[];
/* 速度部門：帯(A/B/C)ごとの課題文リスト。カスタムが空なら既定値 */
function getSpeedTexts(band){
  const c=cleanList((loadCustom().speed||{})[band]);
  return c.length?c:TEXTS[band];
}
/* タイピング練習：お題リスト。カスタムが空なら既定値 */
function getTyWords(){
  const c=cleanList(loadCustom().typing);
  return c.length?c:TY_WORDS;
}
