/* UniTools PDF — local processing only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = (message, error = false) => { $('pdf-status').textContent = message; $('pdf-status').dataset.error = String(error); };
  if (!window.UT) { status('ไม่พบส่วนช่วยของเว็บไซต์ กรุณาโหลดหน้าใหม่เมื่อเว็บไซต์พร้อม', true); document.querySelectorAll('button').forEach(b => b.disabled = true); return; }
  const U = window.UT;
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const files = { merge: [], images: [], pages: null, rotate: null, number: null };
  let pageBytes = null, pageCount = 0, selected = new Set(), busy = false, generation = 0;
  const need = name => { if (!window[name]) throw new Error('โหลดไลบรารีไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและโหลดหน้าใหม่'); return window[name]; };
  const tick = () => new Promise(r => setTimeout(r, 0));
  const progress = (n, total) => { $('pdf-progress').value = total ? n / total * 100 : 0; };
  async function run(action) {
    if (busy) return;
    busy = true; const controls = [...document.querySelectorAll('button,input,select')].filter(e => !e.disabled);
    controls.forEach(e => e.disabled = true); $('pdf-progress').hidden = false; progress(0, 1); status('กำลังประมวลผล…');
    try { await action(); progress(1, 1); status('เสร็จแล้ว · ไฟล์ดาวน์โหลดพร้อมใช้งาน'); }
    catch (e) { status('ไม่สำเร็จ: ' + (e.message || 'ไม่สามารถอ่านไฟล์นี้ได้'), true); }
    finally { busy = false; controls.forEach(e => e.disabled = false); $('pdf-progress').hidden = true; }
  }
  const load = async file => { need('PDFLib'); if (!file) throw new Error('กรุณาเลือก PDF ก่อน'); return PDFLib.PDFDocument.load(await file.arrayBuffer()); };
  const save = async (doc, filename) => U.download(new Blob([await doc.save()], { type: 'application/pdf' }), filename);
  function numeric(id, min, max) { const n = Number($(id).value); if (!$(id).value.trim() || !Number.isFinite(n) || n < min || n > max) throw new Error('ค่าตัวเลขอยู่นอกช่วงที่กำหนด'); return n; }
  function parseRanges(value, count) {
    if (!count) throw new Error('กรุณาเลือก PDF ก่อน');
    if (!value.trim()) throw new Error('กรุณาระบุช่วงหน้า');
    const result = new Set();
    for (const part of value.split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d*))?$/);
      if (!m) throw new Error('ช่วงหน้าไม่ถูกต้อง ใช้รูปแบบ 1-3,5,8-');
      const a = Number(m[1]), b = m[2] === undefined ? a : m[2] === '' ? count : Number(m[2]);
      if (a < 1 || b > count || a > b) throw new Error('ช่วงหน้าต้องอยู่ระหว่าง 1 ถึง ' + count);
      for (let i = a; i <= b; i++) result.add(i - 1);
    }
    return [...result].sort((a, b) => a - b);
  }
  document.querySelectorAll('[data-tab]').forEach((button, index, buttons) => {
    button.addEventListener('click', () => {
      if (busy) return;
      buttons.forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-selected', active); b.tabIndex = active ? 0 : -1; $('panel-' + b.dataset.tab).hidden = !active; });
    });
    button.addEventListener('keydown', e => { let n; if (e.key === 'ArrowRight') n = (index + 1) % buttons.length; if (e.key === 'ArrowLeft') n = (index + buttons.length - 1) % buttons.length; if (e.key === 'Home') n = 0; if (e.key === 'End') n = buttons.length - 1; if (n !== undefined) { e.preventDefault(); buttons[n].click(); buttons[n].focus(); } });
  });
  function showList(kind) {
    const list = $(kind + '-list'); list.replaceChildren();
    files[kind].forEach((file, i) => {
      const li = document.createElement('li'), name = document.createElement('span'); name.className = 'filename'; name.textContent = `${i + 1}. ${file.name} · ${U.fmtBytes(file.size)}`; li.append(name);
      for (const [text, delta] of [['↑', -1], ['↓', 1], ['ลบ', 0]]) {
        const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = text; b.setAttribute('aria-label', `${text === 'ลบ' ? 'ลบ' : delta === -1 ? 'เลื่อนขึ้น' : 'เลื่อนลง'} ${file.name}`);
        b.disabled = delta !== 0 && (i + delta < 0 || i + delta >= files[kind].length);
        b.onclick = () => { if (busy) return; if (delta === 0) files[kind].splice(i, 1); else [files[kind][i], files[kind][i + delta]] = [files[kind][i + delta], files[kind][i]]; showList(kind); }; li.append(b);
      }
      list.append(li);
    });
  }
  function selectionUI() {
    $('selection-info').textContent = `เลือกแล้ว ${selected.size} จาก ${pageCount} หน้า`;
    document.querySelectorAll('.page-thumb').forEach(b => b.setAttribute('aria-pressed', selected.has(Number(b.dataset.page))));
  }
  async function thumbnails(file) {
    need('pdfjsLib'); need('PDFLib'); const id = ++generation;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    try {
      if (id !== generation) return;
      pageBytes = bytes; pageCount = doc.numPages; selected = new Set(); $('page-thumbs').replaceChildren(); selectionUI();
      for (let i = 0; i < pageCount; i++) {
        const p = await doc.getPage(i + 1), viewport = p.getViewport({ scale: 140 / p.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        if (id !== generation) return;
        const button = document.createElement('button'); button.className = 'page-thumb'; button.dataset.page = i; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', 'เลือกหน้า ' + (i + 1));
        const label = document.createElement('span'); label.textContent = 'หน้า ' + (i + 1); button.append(canvas, label);
        button.onclick = () => { if (busy) return; selected.has(i) ? selected.delete(i) : selected.add(i); selectionUI(); }; $('page-thumbs').append(button); progress(i + 1, pageCount); p.cleanup();
      }
    } finally { await doc.destroy(); }
  }
  ['merge', 'pages', 'rotate', 'images', 'number'].forEach(kind => {
    const drop = $(kind + '-drop');
    U.setupDropzone(drop, incoming => {
      if (busy) return;
      const valid = incoming.filter(f => kind === 'images' ? f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name) : /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
      if (!valid.length) { status('กรุณาเลือกชนิดไฟล์ที่รองรับ', true); return; }
      if (kind === 'merge' || kind === 'images') { files[kind].push(...valid); showList(kind); status(`เพิ่มแล้ว ${valid.length} ไฟล์`); }
      else {
        if (kind === 'pages') { pageBytes = null; pageCount = 0; selected.clear(); $('page-thumbs').replaceChildren(); selectionUI(); }
        files[kind] = valid[0]; $(kind + '-info').textContent = `${valid[0].name} · ${U.fmtBytes(valid[0].size)}${valid.length > 1 ? ' · ใช้ไฟล์แรกเท่านั้น' : ''}`;
        if (kind === 'pages') run(() => thumbnails(valid[0])); else status('เลือกไฟล์แล้ว');
      }
    }, { accept: kind === 'images' ? 'image/*' : '.pdf,application/pdf' });
  });
  $('merge-run').onclick = () => run(async () => {
    need('PDFLib'); if (!files.merge.length) throw new Error('กรุณาเพิ่ม PDF อย่างน้อยหนึ่งไฟล์');
    const out = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.merge.length; i++) { const doc = await load(files.merge[i]); (await out.copyPages(doc, doc.getPageIndices())).forEach(p => out.addPage(p)); progress(i + 1, files.merge.length); await tick(); }
    await save(out, 'merged.pdf');
  });
  $('select-ranges').onclick = () => { try { selected = new Set(parseRanges($('page-ranges').value, pageCount)); selectionUI(); status('เลือกหน้าตามช่วงแล้ว'); } catch (e) { status(e.message, true); } };
  $('select-all').onclick = () => { selected = new Set(Array.from({ length: pageCount }, (_, i) => i)); selectionUI(); };
  $('select-none').onclick = () => { selected.clear(); selectionUI(); };
  async function selectedOutput(remove) {
    need('PDFLib'); if (!pageBytes) throw new Error('กรุณาเลือก PDF ก่อน'); if (!selected.size) throw new Error('กรุณาเลือกหน้าอย่างน้อยหนึ่งหน้า');
    const doc = await PDFLib.PDFDocument.load(pageBytes), indices = doc.getPageIndices().filter(i => remove ? !selected.has(i) : selected.has(i));
    if (!indices.length) throw new Error('ต้องเหลืออย่างน้อยหนึ่งหน้าใน PDF');
    const out = await PDFLib.PDFDocument.create(); (await out.copyPages(doc, indices)).forEach(p => out.addPage(p)); await save(out, remove ? 'deleted-pages.pdf' : 'selected-pages.pdf');
  }
  $('extract-run').onclick = () => run(() => selectedOutput(false)); $('delete-run').onclick = () => run(() => selectedOutput(true));
  $('split-run').onclick = () => run(async () => {
    need('PDFLib'); need('JSZip'); if (!pageBytes) throw new Error('กรุณาเลือก PDF ก่อน');
    const doc = await PDFLib.PDFDocument.load(pageBytes), zip = new JSZip();
    for (let i = 0; i < doc.getPageCount(); i++) { const out = await PDFLib.PDFDocument.create(); const [p] = await out.copyPages(doc, [i]); out.addPage(p); zip.file(`page-${String(i + 1).padStart(3, '0')}.pdf`, await out.save()); progress(i + 1, doc.getPageCount()); await tick(); }
    U.download(await zip.generateAsync({ type: 'blob' }), 'pages.zip');
  });
  $('rotate-scope').onchange = () => { $('rotate-ranges').disabled = $('rotate-scope').value === 'all'; };
  $('rotate-run').onclick = () => run(async () => {
    const doc = await load(files.rotate), indices = $('rotate-scope').value === 'all' ? doc.getPageIndices() : parseRanges($('rotate-ranges').value, doc.getPageCount());
    indices.forEach(i => { const p = doc.getPage(i); p.setRotation(PDFLib.degrees((p.getRotation().angle + Number($('rotate-angle').value)) % 360)); }); await save(doc, 'rotated.pdf');
  });
  async function imageCanvas(file) {
    const url = URL.createObjectURL(file), img = new Image();
    try { await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('อ่านรูปไม่ได้: ' + file.name)); img.src = url; }); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c; } finally { URL.revokeObjectURL(url); }
  }
  $('images-run').onclick = () => run(async () => {
    need('PDFLib'); if (!files.images.length) throw new Error('กรุณาเพิ่มรูปก่อน');
    const margin = numeric('image-margin', 0, 80) * 72 / 25.4, mode = $('image-size').value, out = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.images.length; i++) {
      const canvas = await imageCanvas(files.images[i]), image = await out.embedPng(canvas.toDataURL('image/png'));
      const size = mode === 'fit' ? [canvas.width * .75 + margin * 2, canvas.height * .75 + margin * 2] : mode === 'landscape' ? [841.89, 595.28] : [595.28, 841.89];
      const scale = Math.min((size[0] - 2 * margin) / image.width, (size[1] - 2 * margin) / image.height); if (scale <= 0) throw new Error('ขอบกระดาษใหญ่เกินไป');
      const page = out.addPage(size); page.drawImage(image, { x: (size[0] - image.width * scale) / 2, y: (size[1] - image.height * scale) / 2, width: image.width * scale, height: image.height * scale }); progress(i + 1, files.images.length); await tick();
    } await save(out, 'images.pdf');
  });
  $('number-run').onclick = () => run(async () => {
    const doc = await load(files.number), start = numeric('number-start', 0, 999999), size = numeric('number-size', 6, 72); if (!Number.isInteger(start)) throw new Error('เลขเริ่มต้นต้องเป็นจำนวนเต็ม');
    const loaded = await document.fonts.load(`${size * 3}px Sarabun`, 'หน้า 0123456789'); if (!loaded.length || !document.fonts.check(`${size * 3}px Sarabun`, 'หน้า')) throw new Error('โหลดฟอนต์ Sarabun ไม่สำเร็จ กรุณาเชื่อมต่ออินเทอร์เน็ต');
    for (let i = 0; i < doc.getPageCount(); i++) {
      const label = ($('number-format').value === 'thai' ? 'หน้า ' : '') + (start + i), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      ctx.font = `${size * 3}px Sarabun`; canvas.width = Math.ceil(ctx.measureText(label).width + size * 3); canvas.height = Math.ceil(size * 6); ctx.font = `${size * 3}px Sarabun`; ctx.fillStyle = '#222222'; ctx.textBaseline = 'middle'; ctx.fillText(label, size * 1.5, canvas.height / 2);
      const image = await doc.embedPng(canvas.toDataURL('image/png')), page = doc.getPage(i), { x: cx, y: cy, width: cw, height: ch } = page.getCropBox();
      // Map visual coordinates back into the page's unrotated coordinate system.
      const angle = ((page.getRotation().angle % 360) + 360) % 360, visualWidth = angle % 180 ? ch : cw, w = canvas.width / 3, h = canvas.height / 3;
      const x = $('number-position').value === 'right' ? visualWidth - w - 18 : (visualWidth - w) / 2, y = 12;
      const origin = angle === 90 ? [cw - y, x] : angle === 180 ? [cw - x, ch - y] : angle === 270 ? [y, ch - x] : [x, y];
      page.drawImage(image, { x: cx + origin[0], y: cy + origin[1], width: w, height: h, rotate: PDFLib.degrees(angle) }); progress(i + 1, doc.getPageCount()); await tick();
    } await save(doc, 'numbered.pdf');
  });
})();
