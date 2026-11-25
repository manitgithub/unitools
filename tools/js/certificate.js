/* UniTools certificate studio — Thai text is shaped by the browser canvas. */
(() => {
  'use strict';
  function fitText(ctx, box, text, width, height, scale) {
    const x = box.x * width, y = box.y * height, margin = 24 * scale;
    const available = Math.max(0, box.align === 'center' ? 2 * Math.min(x - margin, width - margin - x) : box.align === 'right' ? x - margin : width - margin - x);
    let size = box.size, lines = text.split('\n');
    const measure = line => ctx.measureText(line).width;
    const font = () => { ctx.font = `${size * scale}px "${box.font}"`; };
    font();
    const minimum = Math.min(size, 6);
    while (size > minimum && lines.some(line => measure(line) > available)) { size = Math.max(minimum, size - 1); font(); }
    if (lines.some(line => measure(line) > available)) {
      const wrapped = [], segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
      for (const line of lines) {
        let part = '';
        for (const { segment } of segmenter.segment(line)) {
          if (part && measure(part + segment) > available) { wrapped.push(part); part = ''; }
          part += segment;
        }
        wrapped.push(part);
      }
      lines = wrapped;
    }
    const px = size * scale, lineHeight = px * 1.55;
    const overflow = lines.length > 2 || lines.some(line => measure(line) > available) || y - px * .8 < margin || y + (lines.length - 1) * lineHeight + px * .8 > height - margin;
    return { px, lines, lineHeight, overflow, width: Math.max(12, ...lines.map(measure)) };
  }
  if (typeof module === 'object' && module.exports) module.exports = { fitText };
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id), canvas = $('cert-canvas'), ctx = canvas.getContext('2d');
  const status = (text, error = false) => { $('cert-status').textContent = text; $('cert-status').dataset.error = String(error); };
  if (!window.UT) { status('ไม่พบส่วนช่วยของเว็บไซต์ กรุณาโหลดหน้าใหม่เมื่อเว็บไซต์พร้อม', true); document.querySelectorAll('button').forEach(b => b.disabled = true); return; }
  const U = window.UT, KEY = 'unitools-certificate-layout-v1', fonts = ['Sarabun', 'Kanit', 'Charm'];
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const defaults = () => [
    { text: 'เกียรติบัตร', font: 'Charm', size: 48, color: '#72571e', align: 'center', x: .5, y: .20 },
    { text: 'ขอมอบเกียรติบัตรฉบับนี้เพื่อแสดงว่า', font: 'Sarabun', size: 20, color: '#253d49', align: 'center', x: .5, y: .34 },
    { text: '{ชื่อ}', font: 'Sarabun', size: 34, color: '#193f52', align: 'center', x: .5, y: .46 },
    { text: 'ได้เข้าร่วมกิจกรรมและผ่านการอบรมเป็นที่เรียบร้อยแล้ว', font: 'Sarabun', size: 20, color: '#253d49', align: 'center', x: .5, y: .59 },
    { text: 'ขอให้ประสบความสำเร็จในการศึกษาและการทำงาน', font: 'Sarabun', size: 18, color: '#253d49', align: 'center', x: .5, y: .68 },
    { text: 'ผู้รับรอง / ประธานโครงการ', font: 'Sarabun', size: 16, color: '#253d49', align: 'center', x: .5, y: .86 }
  ];
  function validBoxes(value) {
    return Array.isArray(value) && value.length <= 50 && value.every(b => b && typeof b.text === 'string' && b.text.length <= 10000 && fonts.includes(b.font) && Number.isFinite(b.size) && b.size >= 6 && b.size <= 160 && /^#[0-9a-f]{6}$/i.test(b.color) && ['left', 'center', 'right'].includes(b.align) && Number.isFinite(b.x) && b.x >= 0 && b.x <= 1 && Number.isFinite(b.y) && b.y >= 0 && b.y <= 1);
  }
  const stored = U.store.get(KEY, null);
  let boxes = validBoxes(stored) ? stored : defaults(), rows = [], columns = ['ชื่อ'], current = 0, nameColumn = 'ชื่อ', background = null, workbook = null, active = 2, busy = false, previewVersion = 0, hits = [], drag = null;
  const need = key => { if (!window[key]) throw new Error('โหลดไลบรารีไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและโหลดหน้าใหม่'); return window[key]; };
  const pause = () => new Promise(r => setTimeout(r, 0));
  function persist() { return U.store.set(KEY, boxes); }
  function replace(template, row) { return template.replace(/\{([^{}]+)\}/g, (_, key) => String((key === 'ชื่อ' ? row[nameColumn] : row[key]) ?? '')); }
  async function readyFonts() {
    const families = [...new Set(['Sarabun', ...boxes.map(b => b.font)])];
    const loaded = await Promise.all(families.map(font => document.fonts.load(`40px "${font}"`, 'เกียรติบัตร ชื่อ')));
    if (loaded.some(faces => !faces.length) || families.some(font => !document.fonts.check(`40px "${font}"`, 'เกียรติบัตร'))) throw new Error('โหลดฟอนต์ไทยไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  function base() {
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (background) { const s = Math.min(canvas.width / background.width, canvas.height / background.height); ctx.drawImage(background, (canvas.width - background.width * s) / 2, (canvas.height - background.height * s) / 2, background.width * s, background.height * s); return; }
    const w = canvas.width, h = canvas.height;
    ctx.strokeStyle = '#947638'; ctx.lineWidth = 5; ctx.strokeRect(42, 42, w - 84, h - 84); ctx.lineWidth = 1.5; ctx.strokeRect(56, 56, w - 112, h - 112);
    for (const [x, y, sx, sy] of [[76, 76, 1, 1], [w - 76, 76, -1, 1], [76, h - 76, 1, -1], [w - 76, h - 76, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * 45); ctx.lineTo(x, y); ctx.lineTo(x + sx * 80, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(w * .40, h * .79); ctx.lineTo(w * .60, h * .79); ctx.stroke();
  }
  function draw(row) {
    base(); hits = []; let overflowing = false; const scale = canvas.width / (canvas.width > canvas.height ? 841.89 : 595.28);
    boxes.forEach((box, i) => {
      const x = box.x * canvas.width, y = box.y * canvas.height;
      const { px, lines, lineHeight, width, overflow } = fitText(ctx, box, replace(box.text, row), canvas.width, canvas.height, scale);
      if (overflow) overflowing = true;
      ctx.fillStyle = box.color; ctx.textAlign = box.align; ctx.textBaseline = 'middle';
      lines.slice(0, 2).forEach((line, k) => ctx.fillText(line, x, y + k * lineHeight));
      hits.push({ i, x: x - (box.align === 'center' ? width / 2 : box.align === 'right' ? width : 0) - 8, y: y - px * .8, w: width + 16, h: lineHeight * (lines.length - 1) + px * 1.6 });
    });
    return overflowing;
  }
  function highlight() { const hit = hits.find(h => h.i === active); if (!hit) return; ctx.save(); ctx.strokeStyle = '#14795e'; ctx.lineWidth = 2; ctx.setLineDash([10, 7]); ctx.strokeRect(hit.x, hit.y, hit.w, hit.h); ctx.restore(); }
  function sampleRow() { return rows[current] || { [nameColumn]: 'สมชาย ใจดี' }; }
  async function preview() {
    const version = ++previewVersion;
    try { await readyFonts(); if (version !== previewVersion || busy) return; const overflow = draw(sampleRow()); highlight(); $('row-indicator').textContent = rows.length ? `${current + 1} / ${rows.length}` : 'ตัวอย่าง'; $('prev-row').disabled = current === 0; $('next-row').disabled = !rows.length || current >= rows.length - 1; status(overflow ? 'ข้อความล้นกรอบ กรุณาลดข้อความหรือปรับตำแหน่งก่อนส่งออก' : rows.length ? 'พร้อมส่งออก ' + rows.length + ' ใบ' : 'เพิ่มรายชื่อเพื่อสร้างเกียรติบัตร'); }
    catch (e) { if (version === previewVersion) { base(); status(e.message, true); } }
  }
  function editor() {
    const parent = $('box-editors'); parent.replaceChildren();
    boxes.forEach((b, i) => {
      const panel = document.createElement('div'); panel.className = 'box-editor' + (active === i ? ' selected' : ''); panel.dataset.index = i;
      const heading = document.createElement('div'); heading.className = 'box-heading'; const title = document.createElement('h3'); title.textContent = `ข้อความ ${i + 1}`;
      const remove = document.createElement('button'); remove.className = 'btn ghost'; remove.textContent = 'ลบ'; remove.setAttribute('aria-label', `ลบข้อความ ${i + 1}`); remove.onclick = () => { if (busy) return; boxes.splice(i, 1); active = Math.min(i, boxes.length - 1); persist(); editor(); preview(); }; heading.append(title, remove); panel.append(heading);
      function field(labelText, key, type, choices) {
        const label = document.createElement('label'); label.textContent = labelText; const input = document.createElement(type === 'textarea' ? 'textarea' : choices ? 'select' : 'input');
        if (choices) choices.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); });
        else if (type !== 'textarea') input.type = type;
        if (type === 'textarea') { input.rows = 2; input.maxLength = 10000; }
        if (type === 'number') { input.min = key === 'size' ? 6 : 0; input.max = key === 'size' ? 160 : 100; input.step = key === 'size' ? 1 : .1; }
        input.value = key === 'x' || key === 'y' ? (b[key] * 100).toFixed(1) : b[key]; input.dataset.key = key;
        input.addEventListener('input', () => { if (busy) return; let value = input.value; if (type === 'number') { if (!input.value || !input.validity.valid) return; value = Number(value); if (key === 'x' || key === 'y') value /= 100; } b[key] = value; active = i; parent.querySelectorAll('.box-editor').forEach((p, j) => p.classList.toggle('selected', j === i)); persist(); preview(); }); label.append(input); return label;
      }
      panel.append(field('ข้อความ / ตัวแปร', 'text', 'textarea'));
      const row1 = document.createElement('div'); row1.className = 'row'; row1.append(field('ฟอนต์', 'font', '', fonts.map(f => [f, f])), field('ขนาด (pt)', 'size', 'number')); panel.append(row1);
      const row2 = document.createElement('div'); row2.className = 'row'; row2.append(field('สี', 'color', 'color'), field('จัดแนว', 'align', '', [['left', 'ซ้าย'], ['center', 'กลาง'], ['right', 'ขวา']])); panel.append(row2);
      const row3 = document.createElement('div'); row3.className = 'row'; row3.append(field('ตำแหน่ง X (%)', 'x', 'number'), field('ตำแหน่ง Y (%)', 'y', 'number')); panel.append(row3); parent.append(panel);
    });
  }
  function setRows(data) {
    rows = data.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)]))).filter(row => Object.values(row).some(v => v.trim()));
    columns = [...new Set(rows.flatMap(row => Object.keys(row)))]; if (!columns.length) columns = ['ชื่อ'];
    nameColumn = columns.includes(nameColumn) ? nameColumn : columns[0]; current = 0;
    $('name-column').replaceChildren(...columns.map(c => { const option = document.createElement('option'); option.value = c; option.textContent = c; return option; })); $('name-column').value = nameColumn;
    $('column-help').textContent = 'ตัวแปรที่ใช้ได้: ' + [...new Set(['ชื่อ', ...columns])].map(c => '{' + c + '}').join(' ');
    $('data-info').textContent = `${rows.length} รายชื่อ · ${columns.length} คอลัมน์`; preview();
  }
  function readSheet() { const sheet = workbook.Sheets[$('data-sheet').value]; setRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })); }
  async function action(work, done) {
    if (busy) return; busy = true; ++previewVersion;
    const controls = [...document.querySelectorAll('button,input,select,textarea')].filter(e => !e.disabled); controls.forEach(e => e.disabled = true); status('กำลังประมวลผล…');
    let error = null;
    try { await work(); } catch (e) { error = e; }
    finally { busy = false; controls.forEach(e => e.disabled = false); $('cert-progress').hidden = true; await preview(); if (error) status('ไม่สำเร็จ: ' + error.message, true); else if (done) status(done); }
  }
  function dropzone(id, callback, accept) { const el = $(id); U.setupDropzone(el, files => { if (!busy && files.length) callback(files[0]); }, { accept }); }
  dropzone('background-drop', file => action(async () => {
    let source;
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      need('pdfjsLib'); const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      try { const page = await doc.getPage(1), original = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: 2000 / Math.max(original.width, original.height) }); source = document.createElement('canvas'); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height); await page.render({ canvasContext: source.getContext('2d'), viewport }).promise; } finally { await doc.destroy(); }
    } else {
      const url = URL.createObjectURL(file);
      try { const img = new Image(); await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('อ่านรูปพื้นหลังไม่ได้')); img.src = url; }); source = document.createElement('canvas'); const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)); source.width = Math.round(img.naturalWidth * s); source.height = Math.round(img.naturalHeight * s); source.getContext('2d').drawImage(img, 0, 0, source.width, source.height); } finally { URL.revokeObjectURL(url); }
    }
    background = source; const landscape = source.width >= source.height; canvas.width = landscape ? 1684 : 1190; canvas.height = landscape ? 1190 : 1684;
    $('background-info').textContent = `${file.name} · ${U.fmtBytes(file.size)} · A4 ${landscape ? 'แนวนอน' : 'แนวตั้ง'}`;
  }), '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf');
  dropzone('data-drop', file => action(async () => {
    need('XLSX'); if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('กรุณาเลือก .xlsx หรือ .csv');
    const imported = XLSX.read(/\.csv$/i.test(file.name) ? await file.text() : await file.arrayBuffer(), { type: /\.csv$/i.test(file.name) ? 'string' : 'array', raw: true });
    if (!imported.SheetNames.length) throw new Error('ไม่พบแผ่นงาน'); workbook = imported;
    $('data-sheet').replaceChildren(...workbook.SheetNames.map(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; return option; })); $('sheet-label').hidden = workbook.SheetNames.length < 2; readSheet();
    $('data-info').textContent += ` · ${file.name} · ${U.fmtBytes(file.size)}`;
  }), '.xlsx,.csv');
  $('data-sheet').onchange = () => { if (!busy) readSheet(); };
  $('use-names').onclick = () => { if (busy) return; const names = $('paste-names').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); if (!names.length) { status('กรุณาวางรายชื่ออย่างน้อยหนึ่งชื่อ', true); return; } workbook = null; $('sheet-label').hidden = true; setRows(names.map(ชื่อ => ({ ชื่อ }))); };
  $('name-column').onchange = () => { nameColumn = $('name-column').value; preview(); };
  $('use-template').onclick = () => { if (busy) return; background = null; canvas.width = 1684; canvas.height = 1190; $('background-info').textContent = 'แม่แบบมหาวิทยาลัย · A4 แนวนอน'; preview(); };
  $('prev-row').onclick = () => { if (busy) return; current = Math.max(0, current - 1); preview(); };
  $('next-row').onclick = () => { if (busy) return; current = Math.min(rows.length - 1, current + 1); preview(); };
  $('add-box').onclick = () => { if (busy) return; if (boxes.length >= 50) { status('เพิ่มข้อความได้สูงสุด 50 กล่อง', true); return; } boxes.push({ text: 'ข้อความใหม่', font: 'Sarabun', size: 20, color: '#253d49', align: 'center', x: .5, y: .75 }); active = boxes.length - 1; persist(); editor(); preview(); };
  $('save-layout').onclick = () => { if (persist()) { U.toast('บันทึกแบบแล้ว'); status('บันทึกข้อความ ตำแหน่ง และฟอนต์แล้ว'); } else status('แบบอยู่ในหน้านี้เท่านั้น บันทึกในเบราว์เซอร์ไม่ได้', true); };
  $('reset-layout').onclick = () => { if (busy) return; boxes = defaults(); active = 2; persist(); editor(); preview(); };
  const point = event => { const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * canvas.width, y: (event.clientY - r.top) / r.height * canvas.height }; };
  canvas.addEventListener('pointerdown', event => {
    if (busy) return; const p = point(event), hit = [...hits].reverse().find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (!hit) return; event.preventDefault(); active = hit.i; const b = boxes[active]; drag = { dx: p.x - b.x * canvas.width, dy: p.y - b.y * canvas.height }; canvas.setPointerCapture(event.pointerId); editor(); draw(sampleRow()); highlight();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || busy) return; const p = point(event), b = boxes[active]; b.x = Math.max(0, Math.min(1, (p.x - drag.dx) / canvas.width)); b.y = Math.max(0, Math.min(1, (p.y - drag.dy) / canvas.height));
    const panel = $('box-editors').children[active]; for (const key of ['x', 'y']) panel.querySelector(`[data-key="${key}"]`).value = (b[key] * 100).toFixed(1); draw(sampleRow()); highlight();
  });
  function endDrag() { if (drag) { drag = null; persist(); } }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
  function makePDF() { need('jspdf'); return new jspdf.jsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true }); }
  function addCanvas(pdf) { pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST'); }
  async function exportAll(zipMode) {
    if (!rows.length) { status('กรุณาเพิ่มรายชื่อก่อนส่งออก', true); return; }
    await action(async () => {
      await readyFonts(); const overflowRows = [];
      for (let i = 0; i < rows.length; i++) { if (draw(rows[i])) overflowRows.push(i + 1); if (i % 20 === 0) await pause(); }
      if (overflowRows.length) throw new Error('ข้อความล้นกรอบในแถวที่ ' + overflowRows.join(', ') + ' กรุณาลดข้อความหรือปรับตำแหน่งก่อนส่งออก');
      need('jspdf'); if (zipMode) need('JSZip'); const zip = zipMode ? new JSZip() : null, pdf = zipMode ? null : makePDF(); $('cert-progress').hidden = false;
      for (let i = 0; i < rows.length; i++) {
        status(`กำลังสร้าง ${i + 1} / ${rows.length} ใบ…`); draw(rows[i]); const target = zipMode ? makePDF() : pdf; if (!zipMode && i > 0) target.addPage(); addCanvas(target);
        if (zipMode) { const name = String(rows[i][nameColumn] || 'certificate').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'certificate'; zip.file(`${String(i + 1).padStart(3, '0')}-${name}.pdf`, target.output('arraybuffer')); }
        $('cert-progress').value = (i + 1) / rows.length * 100; await pause();
      }
      if (zipMode) { status('กำลังบีบอัดไฟล์ ZIP…'); U.download(await zip.generateAsync({ type: 'blob' }), 'certificates.zip'); }
      else U.download(pdf.output('blob'), 'certificates.pdf');
    }, `สร้างและดาวน์โหลดแล้ว ${rows.length} ใบ`);
  }
  $('export-combined').onclick = () => exportAll(false); $('export-zip').onclick = () => exportAll(true);
  editor(); preview();
})();
