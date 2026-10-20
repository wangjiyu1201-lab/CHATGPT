export type Kind = 'expense' | 'payment' | 'advance';
export type Row = { description: string; amount: string; count: string };
export interface Sheet { fields: Record<string, string>; rows: Row[] }
export interface Draft { id: string; kind: Kind; title: string; sheets: Sheet[]; updated: string }
export const titles: Record<Kind, string> = { expense: '现金报销单', payment: '支付申请单', advance: '预支申请单' };
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function blankSheet(): Sheet { return { fields: { date: today(), method: '网银', contract: '', invoiceType: '' }, rows: [{ description: '', amount: '', count: '' }] }; }
export function newDraft(kind: Kind): Draft { return { id: crypto.randomUUID(), kind, title: '', sheets: [blankSheet(), blankSheet()], updated: new Date().toISOString() }; }
export function restoreDraft(value: unknown): Draft | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Draft & { mirror?: boolean };
  if (typeof d.id !== 'string' || !Object.hasOwn(titles, d.kind) || !Array.isArray(d.sheets) || !d.sheets.length) return null;
  if (!d.sheets.every(s => s && typeof s.fields === 'object' && s.fields && Object.values(s.fields).every(v => typeof v === 'string') && Array.isArray(s.rows) && s.rows.length > 0 && s.rows.length <= 5 && s.rows.every(r => r && typeof r.description === 'string' && typeof r.amount === 'string' && typeof r.count === 'string'))) return null;
  // Materialize the old synchronized copy before switching to independent sheets.
  // The browser retains the original legacy data separately before saving this version.
  const sheets = structuredClone(d.sheets);
  if (d.mirror === true && sheets.length === 2) sheets[1] = structuredClone(sheets[0]);
  return { id: d.id, kind: d.kind, title: typeof d.title === 'string' ? d.title : '', sheets, updated: typeof d.updated === 'string' ? d.updated : new Date().toISOString() };
}
export function cents(value: string): number {
  if (!value) return 0;
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(value)) throw new Error('金额须为 0–999,999.99，最多两位小数');
  const [a, b = ''] = value.split('.'); return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export function total(sheet: Sheet) { return sheet.rows.reduce((s, r) => s + cents(r.amount), 0); }
export function money(n: number) { return (n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function uppercase(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n > 99999999999) throw new Error('金额超出支持范围');
  if (!n) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const part = (v: number) => { let s = '', z = false; for (let i = 3; i >= 0; i--) { const d = Math.floor(v / 10 ** i) % 10; if (d) { if (z) s += '零'; s += digits[d] + ['', '拾', '佰', '仟'][i]; z = false; } else if (s) z = true; } return s; };
  const whole = Math.floor(n / 100), high = Math.floor(whole / 10000), low = whole % 10000;
  let out = whole ? (high ? part(high) + '万' + (low && low < 1000 ? '零' : '') : '') + part(low) + '元' : '零元';
  const j = Math.floor(n / 10) % 10, f = n % 10;
  if (j) out += digits[j] + '角'; else if (f && whole) out += '零';
  if (f) out += digits[f] + '分';
  return out + (!j && !f ? '整' : '');
}
export function validateSheet(kind: Kind, sheet: Sheet) {
  if (kind === 'expense') { if (total(sheet) > 99999999) throw new Error('报销总额不能超过模板的六位整数金额栏（999,999.99 元）'); for (const r of sheet.rows) if (r.count && !/^\d{1,3}$/.test(r.count)) throw new Error('单据张数须为 0–999 的整数'); }
  else cents(sheet.fields.amount || '');
}
export function validate(draft: Draft) {
  if (!draft.sheets.length) throw new Error('请至少保留一张单据');
  draft.sheets.forEach((sheet, i) => { try { validateSheet(draft.kind, sheet); } catch (e) { throw new Error(`第 ${i + 1} 张单据：${(e as Error).message}`); } });
}
export function batchTotal(draft: Draft) { return draft.sheets.reduce((sum, sheet) => sum + (draft.kind === 'expense' ? total(sheet) : cents(sheet.fields.amount || '')), 0); }
export type Overlay = { text: string; x: number; y: number; w: number; h: number; size?: number; align?: 'left' | 'center' };
export function overlays(kind: Kind, sheet: Sheet, second = false): Overlay[] {
  const a: Overlay[] = [], f = sheet.fields;
  const put = (text: string | undefined, x: number, y: number, w: number, h: number, size = 10, align: 'left' | 'center' = 'left') => { if (text) a.push({ text, x, y, w, h, size, align }); };
  const date = (f.date || '').split('-');
  if (kind === 'expense') {
    const off = second ? 412.2 : 0;
    put(f.department, 183, 103.5 + off, 68, 14);
    if (date.length === 3) { put(date[0], 363, 104 + off, 27, 14, 9, 'center'); put(date[1], 402, 104 + off, 14, 14, 9, 'center'); put(date[2], 429, 104 + off, 13, 14, 9, 'center'); }
    const bounds = [377.5, 396.2, 413.8, 431.8, 451.4, 467.8, 485.8, 503.8, 521.8];
    const amount = (v: number, y: number, h: number) => { const str = String(v).padStart(3, '0').padStart(8, ' '); [...str].forEach((ch, i) => put(ch.trim(), bounds[i] + 1, y, bounds[i + 1] - bounds[i] - 2, h, 11, 'center')); };
    sheet.rows.forEach((r, i) => { const y = 155.4 + i * 23.45 + off; put(r.description, 46, y, 326, 23); if (r.amount) amount(cents(r.amount), y, 23); put(r.count, 524, y, 31, 23, 10, 'center'); });
    const ty = second ? 684.8 : 272.8, th = second ? 36 : 33;
    const t = total(sheet); if (sheet.rows.some(r => r.amount)) { put(uppercase(t), 106, ty, 266, th, 11); amount(t, ty, th); }
    const count = sheet.rows.reduce((n, r) => n + (Number(r.count) || 0), 0); if (count) put(String(count), 524, ty, 31, th, 10, 'center');
    const sy = second ? 721.5 : 307, sy2 = second ? 753.8 : 342;
    [['agent', 92, 101], ['manager', 277, 100], ['vice', 454, 100]].forEach(([key, x, w]) => put(f[key as string], Number(x), sy, Number(w), second ? 31 : 34));
    [['cashier', 92, 101], ['finance', 277, 100], ['director', 454, 100]].forEach(([key, x, w]) => put(f[key as string], Number(x), sy2, Number(w), second ? 30 : 34));
  } else if (kind === 'payment') {
    const y = second ? 518.9 : 115.8, h = second ? 98 : 91;
    put([f.payee, f.bank, f.account].filter(Boolean).join('\n'), 156, y + 4, 118, h - 8, 10);
    put([f.date && `申请：${f.date}`, f.payDate && `打款：${f.payDate}`].filter(Boolean).join('\n'), 416, y + 4, 101, h - 8, 9);
    put('×', second ? 223 : 224.5, second ? (f.method === '现金' ? 618 : 637) : (f.method === '现金' ? 207.7 : 226.7), 11, 18, 12, 'center');
    const cy = second ? 654 : 243.5; put(f.contract, 156, cy, 117, 28, 10); put(f.invoiceType, 416, cy, 101, 28, 10);
    put(f.description, 265, second ? 684 : 273, 251, second ? 32 : 31, 9);
    if (f.amount) { put(uppercase(cents(f.amount)), 216, second ? 718 : 306, second ? 122 : 125, 33, 9); put(money(cents(f.amount)), 432, second ? 718 : 306, 85, 33, 11); }
    const sy = second ? 752.6 : 340.6, sy2 = second ? 782.3 : 374.4;
    [['agent', 133, 65], ['manager', 282, 58], ['vice', 431, 86]].forEach(([key, x, w]) => put(f[key as string], Number(x), sy, Number(w), 28, 9));
    [['cashier', 133, 65], ['finance', 282, 58], ['director', 431, 86]].forEach(([key, x, w]) => put(f[key as string], Number(x), sy2, Number(w), 28, 9));
  } else {
    const o = second ? 355.7 : 0;
    put(f.agent, 153, 92.5 + o, 190, 17, 9); put(f.date, 397, 92.5 + o, 138, 17, 9);
    put(f.project, 233, 110.5 + o, 302, 17, 9);
    if (f.amount) { put(money(cents(f.amount)), 233, 128.5 + o, 110, 17, 9); put(uppercase(cents(f.amount)), 397, 128.5 + o, 138, 17, 9); }
    put(f.quote, 233, 146.5 + o, 302, 17, 9); put(f.margin && f.margin + '%', 233, 164.5 + o, 302, 17, 9);
    put(f.purpose, 153, 182.5 + o, 382, 17, 9);
    if (f.contract) put('○', 231, (f.contract === '有合同' ? 200.3 : 218.3) + o, 16, 17, 17, 'center');
    put(f.tax && f.tax + '%', 397, 200.5 + o, 138, 17, 9); put(f.invoiceType, 397, 218.5 + o, 138, 17, 9);
    put(f.payDate, 153, 236.5 + o, 93, 17, 8); put(f.repayDate, 351, 236.5 + o, 184, 17, 9);
    put(f.leader, 153, 254.5 + o, 382, 17, 9); put(f.alan, 153, 272.5 + o, 382, 17, 9); put(f.finance, 153, 290.5 + o, 382, 17, 9);
  }
  return a;
}
export function layout(o: Overlay) {
  let size = o.size || 10;
  const measure = (s: string) => [...s].reduce((n, c) => n + (/[\x00-\xff]/.test(c) ? 0.56 : 1), 0) * size;
  let lines: string[] = [];
  const wrap = () => { lines = []; for (const p of o.text.split('\n')) { let line = ''; for (const c of p) { if (line && measure(line + c) > o.w - 4) { lines.push(line); line = ''; } line += c; } lines.push(line); } };
  wrap(); while (lines.length * size * 1.35 > o.h - 2 && size > 4) { size -= 0.25; wrap(); }
  return { lines, size, top: o.y + (o.h - lines.length * size * 1.35) / 2 + size * 0.95 };
}
