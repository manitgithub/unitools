// Node integration checks; real pdf-lib/JSZip/canvas with a minimal DOM harness.
// Browser layout, CDN loading, pdf.js rendering and Google Fonts still require Chrome.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
// Needs pdf-lib, jszip and @napi-rs/canvas (npm i); set NODE_MODULES_DIR to load them from elsewhere.
const root = process.env.NODE_MODULES_DIR ? require('path').join(process.env.NODE_MODULES_DIR, '/') : '';
const PDFLib = require(root + 'pdf-lib'), JSZip = require(root + 'jszip');
const { createCanvas, loadImage } = require(root + '@napi-rs/canvas');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.dataset = {}; this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false; this.attrs = {}; this.listeners = {}; this.className = ''; this.classList = {toggle:(name,on)=>{ const set=new Set(this.className.split(' ').filter(Boolean));on?set.add(name):set.delete(name);this.className=[...set].join(' ');}}; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  setAttribute(key,value) { this.attrs[key] = String(value); }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  click() { if (!this.disabled) { if (this.onclick) this.onclick(); if (this.listeners.click) this.listeners.click({}); } }
  focus() {} setPointerCapture() {}
  querySelectorAll(selector) { return this.children.flatMap(c => [c, ...c.querySelectorAll(selector)]).filter(c => matches(c,selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
}
function matches(e, selector) { if(selector==='[data-tab]')return !!e.dataset.tab;if(selector==='[data-key="x"]')return e.dataset.key==='x';if(selector==='[data-key="y"]')return e.dataset.key==='y';if(selector[0]==='.')return e.className.split(' ').includes(selector.slice(1));return selector.split(',').includes(e.tagName); }
function harness(html, filename) {
  const ids = {}, all = [], drops = {}, downloads = [], stored = {};
  for (const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) { const e = new Element(match[1]);e.id=match[2];ids[e.id]=e;all.push(e);const tab=match[0].match(/data-tab="([^"]+)"/);if(tab)e.dataset.tab=tab[1]; }
  function canvasElement() { const c = createCanvas(1684,1190), elem = new Element('canvas');c.style={};c.dataset={};c.setAttribute=elem.setAttribute.bind(elem);c.querySelectorAll=()=>[];c.addEventListener=elem.addEventListener.bind(elem);c.getBoundingClientRect=()=>({left:0,top:0,width:c.width,height:c.height});c.setPointerCapture=()=>{};c.listeners=elem.listeners;return c; }
  if(ids['cert-canvas'])ids['cert-canvas']=canvasElement();
  const document={getElementById:id=>ids[id],createElement:tag=>tag==='canvas'?canvasElement():new Element(tag),querySelectorAll:selector=>[...all,...all.flatMap(e=>e.querySelectorAll(selector))].filter(e=>matches(e,selector)),fonts:{load:async()=>[{}],check:()=>true}};
  const U={fmtBytes:n=>n+' B',store:{get:(k,f)=>stored[k]??f,set:(k,v)=>stored[k]=JSON.parse(JSON.stringify(v))},toast:()=>{},setupDropzone:(el,callback)=>drops[el.id]=callback,download:(blob,name)=>downloads.push({blob,name})};
  const context={document,UT:U,PDFLib,JSZip,console,Blob,Uint8Array,ArrayBuffer,Set,Number,Promise,setTimeout,clearTimeout,URL,Image:class {set src(url){fetch(url).then(r=>r.arrayBuffer()).then(b=>loadImage(Buffer.from(b))).then(image=>{this.naturalWidth=image.width;this.naturalHeight=image.height;this.image=image;this.onload();}).catch(()=>this.onerror());}},pdfjsLib:{GlobalWorkerOptions:{},getDocument:({data})=>({promise:PDFLib.PDFDocument.load(data).then(doc=>({numPages:doc.getPageCount(),getPage:async n=>({getViewport:({scale})=>({width:doc.getPage(n-1).getWidth()*scale,height:doc.getPage(n-1).getHeight()*scale}),render:()=>({promise:Promise.resolve()}),cleanup:()=>{}}),destroy:async()=>{}}))})}};
  context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(root+'pdf-lib/dist/pdf-lib.min.js','utf8'),context);vm.runInContext(fs.readFileSync(filename,'utf8'),context);
  return {ids,drops,downloads,stored,context,document};
}
const wait = ms=>new Promise(r=>setTimeout(r,ms));
async function settle(h,id){for(let i=0;i<300;i++){await wait(10);if(!h.ids[id].disabled)return;}throw Error('Timed out: '+id);}
function file(name){const bytes=fs.readFileSync(__dirname+'/'+name),blob=new Blob([bytes],{type:name.endsWith('.pdf')?'application/pdf':'image/png'});blob.name=name;return blob;}
async function downloadedPDF(h,index=-1){return PDFLib.PDFDocument.load(await h.downloads.at(index).blob.arrayBuffer());}
(async()=>{
  const h=harness(fs.readFileSync('tools/pdf.html','utf8'),'tools/js/pdf.js');
  Object.entries({'rotate-scope':'all','rotate-angle':'90','image-margin':'10','image-size':'portrait','number-start':'1','number-size':'14','number-format':'thai','number-position':'center'}).forEach(([k,v])=>h.ids[k].value=v);
  h.drops['merge-drop']([file('three-pages.pdf'),file('three-pages.pdf')]);$('merge-run');
  function $(id){return h.ids[id]}
  $('merge-run').click();await settle(h,'merge-run');assert.equal((await downloadedPDF(h)).getPageCount(),6);
  $('merge-list').children[1].children[1].click();assert.equal($('merge-list').children.length,2);
  h.drops['pages-drop']([file('three-pages.pdf')]);await settle(h,'merge-run');assert.equal($('page-thumbs').children.length,3);
  $('page-ranges').value='1-2,3-';$('select-ranges').click();assert.match($('selection-info').textContent,/3/);
  $('page-ranges').value='2-';$('select-ranges').click();$('extract-run').click();await settle(h,'extract-run');assert.equal((await downloadedPDF(h)).getPageCount(),2);
  $('delete-run').click();await settle(h,'delete-run');assert.equal((await downloadedPDF(h)).getPageCount(),1);
  $('split-run').click();await settle(h,'split-run');assert.equal(h.downloads.at(-1).name,'pages.zip', $('pdf-status').textContent);const zip=await JSZip.loadAsync(await h.downloads.at(-1).blob.arrayBuffer());assert.equal(Object.keys(zip.files).length,3);
  h.drops['rotate-drop']([file('three-pages.pdf')]);$('rotate-scope').value='selected';$('rotate-ranges').value='2';$('rotate-angle').value='270';$('rotate-run').click();await settle(h,'rotate-run');const rotated=await downloadedPDF(h);assert.equal(rotated.getPage(1).getRotation().angle,270);assert.equal(rotated.getPage(0).getRotation().angle,0);
  h.drops['number-drop']([file('three-pages.pdf')]);$('number-run').click();await settle(h,'number-run');assert.equal((await downloadedPDF(h)).getPageCount(),3);assert.match($('pdf-status').textContent,/เสร็จ/);
  $('page-ranges').value='0,5';$('select-ranges').click();assert.equal($('pdf-status').dataset.error,'true');
  // Image conversion uses a browser Image normally. Adapt native canvas to draw the decoded sample.
  const create=h.document.createElement;h.document.createElement=tag=>{const c=create(tag);if(tag==='canvas'){const get=c.getContext.bind(c);c.getContext=(...args)=>{const ctx=get(...args),draw=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...rest)=>draw(img.image||img,...rest);return ctx;};}return c;};
  h.drops['images-drop']([file('sample.png')]);$('images-run').click();await settle(h,'images-run');assert.match($('pdf-status').textContent,/เสร็จ/);assert.equal((await downloadedPDF(h)).getPageCount(),1);assert.match($('pdf-status').textContent,/เสร็จ/);
  const c=harness(fs.readFileSync('tools/certificate.html','utf8'),'tools/js/certificate.js');await wait(30);assert.match(c.ids['cert-status'].textContent,/รายชื่อ/);
  c.ids['paste-names'].value='สมชาย ใจดี\nสุดา รักเรียน';c.ids['use-names'].click();await wait(30);assert.equal(c.ids['row-indicator'].textContent,'1 / 2');c.ids['next-row'].click();await wait(30);assert.equal(c.ids['row-indicator'].textContent,'2 / 2');c.ids['prev-row'].click();await wait(30);assert.equal(c.ids['row-indicator'].textContent,'1 / 2');
  const count=c.ids['box-editors'].children.length;c.ids['add-box'].click();assert.equal(c.ids['box-editors'].children.length,count+1);c.ids['save-layout'].click();assert(Object.values(c.stored).some(v=>v.length===count+1));
  // jsPDF export orchestration: adapter records pages/images; actual jsPDF/CDN needs browser verification.
  const pdfs=[];c.context.jspdf={jsPDF:class {constructor(){this.pages=1;this.images=0;this.internal={pageSize:{getWidth:()=>297,getHeight:()=>210}};pdfs.push(this);}addPage(){this.pages++;}addImage(){this.images++;}output(type){return type==='blob'?new Blob(['test']):new Uint8Array([1,2,3]).buffer;}}};
  c.ids['export-combined'].click();await settle(c,'export-combined');assert.equal(pdfs.at(-1).pages,2);assert.equal(pdfs.at(-1).images,2);assert.equal(c.downloads.at(-1).name,'certificates.pdf');
  c.ids['export-zip'].click();await settle(c,'export-zip');const certZip=await JSZip.loadAsync(await c.downloads.at(-1).blob.arrayBuffer());assert.equal(Object.keys(certZip.files).length,2);assert(Object.keys(certZip.files).some(n=>n.includes('สมชาย')));
  // Missing dependencies must produce a visible message, without throwing out of initialization.
  for (const name of ['pdf','certificate']) {
    const nodes={};const statusId=name==='pdf'?'pdf-status':'cert-status';nodes[statusId]=new Element();nodes['cert-canvas']=createCanvas(10,10);
    const minimal={document:{getElementById:id=>nodes[id],querySelectorAll:()=>[]},window:{}};vm.createContext(minimal);vm.runInContext(fs.readFileSync('tools/js/'+name+'.js','utf8'),minimal);assert.match(nodes[statusId].textContent,/ไม่พบ/);
  }
  console.log('PASS: merge/reorder, ranges, extract/delete, split ZIP, selected rotation, canvas numbering, image PDF, invalid range; certificate canvas preview, row navigation, boxes/store, combined/ZIP orchestration.');
})().catch(error=>{console.error(error);process.exitCode=1;});
