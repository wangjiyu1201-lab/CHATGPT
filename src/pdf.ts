import { PDFDocument, PDFImage, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { type Draft, overlays, layout, validate, titles } from './model';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export interface Invoice { id: string; name: string; bytes: Uint8Array; type: 'pdf' | 'png' | 'jpg'; page: number; thumbnail: string; rotation: number }
export async function formPdf(draft: Draft): Promise<Uint8Array> {
  validate(draft);
  const [template, font] = await Promise.all([fetch(`/templates/${draft.kind}.pdf`).then(r => { if (!r.ok) throw Error('模板加载失败'); return r.arrayBuffer(); }), fetch('/fonts/LongunFormSans.ttf').then(r => { if (!r.ok) throw Error('中文字体加载失败'); return r.arrayBuffer(); })]);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const source = await PDFDocument.load(template);
  const background = await pdf.embedPage(source.getPage(0));
  const chinese = await pdf.embedFont(font, { subset: false });
  for (let start = 0; start < draft.sheets.length; start += 2) {
    const page = pdf.addPage([background.width, background.height]);
    page.drawPage(background);
    // Only existing sheets receive data; an odd final sheet leaves the lower template unfilled.
    for (let i = 0; i < 2 && start + i < draft.sheets.length; i++) for (const o of overlays(draft.kind, draft.sheets[start + i], !!i)) {
      const { lines, size, top } = layout(o);
      lines.forEach((line, index) => { const x = o.align === 'center' ? o.x + (o.w - chinese.widthOfTextAtSize(line, size)) / 2 : o.x + 2; page.drawText(line, { x, y: page.getHeight() - top - index * size * 1.35, size, font: chinese, color: rgb(0.06, 0.09, 0.08) }); });
    }
  }
  pdf.setTitle(titles[draft.kind]); pdf.setAuthor('朗冠（上海）广告有限公司');
  return pdf.save();
}
export function download(bytes: Uint8Array, name: string) { const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
export async function readInvoice(file: File): Promise<Invoice[]> {
  if (file.size > 30 * 1024 * 1024) throw Error(`${file.name} 超过 30 MB，请压缩后上传`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    try { if (doc.numPages > 80) throw Error('单个 PDF 最多支持 80 页'); const out: Invoice[] = [];
      for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const v = p.getViewport({ scale: Math.min(1.4, 900 / p.getViewport({ scale: 1 }).width) }); const canvas = document.createElement('canvas'); canvas.width = v.width; canvas.height = v.height; await p.render({ canvasContext: canvas.getContext('2d')!, viewport: v }).promise; out.push({ id: crypto.randomUUID(), name: doc.numPages > 1 ? `${file.name} · 第 ${i} 页` : file.name, bytes, type: 'pdf', page: i - 1, thumbnail: canvas.toDataURL('image/jpeg', 0.85), rotation: 0 }); } return out;
    } finally { await doc.destroy(); }
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error(`${file.name} 格式不支持，请使用 PDF、JPG、PNG 或 WebP`);
  const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height)); canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('图片读取失败')), 'image/jpeg', 0.95));
  return [{ id: crypto.randomUUID(), name: file.name, bytes: new Uint8Array(await blob.arrayBuffer()), type: 'jpg', page: 0, thumbnail: canvas.toDataURL('image/jpeg', 0.7), rotation: 0 }];
}
export async function invoicePdf(invoices: Invoice[]) {
  if (!invoices.length) throw Error('请先上传发票');
  const pdf = await PDFDocument.create();
  for (let i = 0; i < invoices.length; i += 4) {
    const page = pdf.addPage([595.28, 841.89]); const margin = 22, gap = 14, w = (595.28 - margin * 2 - gap) / 2, h = (841.89 - margin * 2 - gap) / 2;
    for (let j = 0; j < 4 && i + j < invoices.length; j++) {
      const inv = invoices[i + j]; let embedded, sourceRotation = 0;
      if (inv.type === 'pdf') { const doc = await PDFDocument.load(inv.bytes); const source = doc.getPage(inv.page); sourceRotation = source.getRotation().angle;
        const crop = source.getCropBox();
        embedded = await pdf.embedPage(source, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
      } else embedded = inv.type === 'png' ? await pdf.embedPng(inv.bytes) : await pdf.embedJpg(inv.bytes);
      const rotation = ((360 - inv.rotation - sourceRotation) % 360 + 360) % 360, swap = rotation % 180 !== 0;
      const ew = swap ? embedded.height : embedded.width, eh = swap ? embedded.width : embedded.height;
      const s = Math.min(w / ew, h / eh); const dw = embedded.width * s, dh = embedded.height * s;
      const x = margin + (j % 2) * (w + gap) + (w - ew * s) / 2, y = 841.89 - margin - (Math.floor(j / 2) + 1) * h - Math.floor(j / 2) * gap + (h - eh * s) / 2;
      const options = { x: x + (rotation === 90 || rotation === 180 ? (swap ? dh : dw) : 0), y: y + (rotation === 180 || rotation === 270 ? (swap ? dw : dh) : 0), width: dw, height: dh, rotate: degrees(rotation) };
      if (embedded instanceof PDFImage) page.drawImage(embedded, options); else page.drawPage(embedded, options);
    }
  }
  pdf.setTitle('朗冠 · 发票四拼排版'); return pdf.save();
}
