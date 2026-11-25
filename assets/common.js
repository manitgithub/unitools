(function(){'use strict';
const UT=window.UT={};
UT.toast=msg=>{document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),3500)};
UT.copy=async text=>{try{await navigator.clipboard.writeText(String(text));UT.toast('คัดลอกแล้ว')}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();UT.toast(ok?'คัดลอกแล้ว':'คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกเอง')}};
UT.download=(data,name)=>{const url=typeof data==='string'?data:URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();if(typeof data!=='string')setTimeout(()=>URL.revokeObjectURL(url),10000)};
UT.fmtBytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
UT.store={get(k,f){try{const v=localStorage.getItem('unitools:'+k);return v===null?f:JSON.parse(v)}catch{return f}},set(k,v){try{localStorage.setItem('unitools:'+k,JSON.stringify(v))}catch{UT.toast('บันทึกในเบราว์เซอร์ไม่ได้')}}};
UT.setupDropzone=(el,onFiles,{accept=''}={})=>{const pick=document.createElement('input');pick.type='file';pick.accept=accept;pick.multiple=true;pick.hidden=true;el.append(pick);el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('click',e=>{if(e.target!==pick)pick.click()});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick.click()}});pick.onchange=()=>{onFiles(Array.from(pick.files));pick.value=''};el.ondragover=e=>{e.preventDefault();el.classList.add('over')};el.ondragleave=()=>el.classList.remove('over');el.ondrop=e=>{e.preventDefault();el.classList.remove('over');onFiles(Array.from(e.dataTransfer.files))}};
UT.randomInt=n=>{if(!Number.isSafeInteger(n)||n<1||n>4294967296)throw Error('ช่วงสุ่มไม่ถูกต้อง');const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n};
UT.shuffle=items=>{const a=items.slice();for(let i=a.length-1;i>0;i--){const j=UT.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
UT.fullscreen=async el=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(el.requestFullscreen)await el.requestFullscreen();else UT.toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ')}catch{UT.toast('เปิดเต็มจอไม่ได้')}};
// Theme is read synchronously in the head, before the stylesheet paints.
UT.applyTheme=theme=>{if(document.documentElement&&(theme==='light'||theme==='dark'))document.documentElement.setAttribute('data-theme',theme)};
UT.applyTheme(UT.store.get('theme',null));
UT.setupAppearance=()=>{
 const toggle=document.querySelector('.theme-toggle');
 const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark'||(!document.documentElement.getAttribute('data-theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 const label=()=>{if(toggle){toggle.setAttribute('aria-label',isDark()?'เปลี่ยนเป็นธีมสว่าง':'เปลี่ยนเป็นธีมมืด');toggle.setAttribute('title',isDark()?'เปลี่ยนเป็นธีมสว่าง':'เปลี่ยนเป็นธีมมืด');toggle.setAttribute('aria-pressed',String(isDark()))}};
 if(toggle){toggle.addEventListener('click',()=>{const theme=isDark()?'light':'dark';UT.applyTheme(theme);UT.store.set('theme',theme);label()});label();window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',label)}
 const search=document.getElementById('search');
 if(search)document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
  if((e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!typing&&!e.metaKey&&!e.ctrlKey&&!e.altKey)){e.preventDefault();search.focus()}
 });
};
document.addEventListener('DOMContentLoaded',UT.setupAppearance);
})();
