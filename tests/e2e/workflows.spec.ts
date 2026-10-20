import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fs from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
async function pdfText(path: string) {
  const doc = await getDocument({ data: new Uint8Array(await fs.readFile(path)), useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages: { text: string; items: { str: string; y: number }[] }[] = [];
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const content = await p.getTextContent(); const items = content.items.filter((x): x is Extract<typeof x, { str: string }> => 'str' in x).map(x => ({ str: x.str, y: x.transform[5] })); pages.push({ text: items.map(x => x.str).join('\n'), items }); }
    return pages;
  } finally { await doc.destroy(); }
}
async function exportForms(page: import('@playwright/test').Page, path: string) {
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 PDF', exact: true }).click(); const d = await wait; await d.saveAs(path); return pdfText(path);
}
function checkSheetPositions(pages: Awaited<ReturnType<typeof pdfText>>, markers: string[]) {
  expect(pages).toHaveLength(Math.ceil(markers.length / 2));
  const all = pages.map(p => p.text).join('\n');
  markers.forEach((marker, i) => { expect(all.split(marker)).toHaveLength(2); const item = pages[Math.floor(i / 2)].items.find(x => x.str.includes(marker)); expect(item, marker).toBeTruthy(); if (i % 2 === 0) expect(item!.y).toBeGreaterThan(421); else expect(item!.y).toBeLessThan(421); });
}
test('报销合计、独立单据、草稿、三种原版模板导出及手机布局', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('所属部门').fill('项目部');
  await page.getByLabel('单据名称', { exact: true }).fill('客户拜访报销');
  await page.getByLabel('第1项内容摘要').fill('客户拜访交通费');
  await page.getByLabel('第1项金额', { exact: true }).fill('128.50');
  await page.getByLabel('第1项单据张数').fill('2');
  await page.getByRole('button', { name:'添加一项报销明细' }).click();
  await page.getByLabel('第2项内容摘要').fill('项目物料采购');
  await page.getByLabel('第2项金额', { exact:true }).fill('256.80');
  await expect(page.getByTestId('total')).toHaveText('¥385.30');
  await expect(page.getByTestId('uppercase')).toHaveText('叁佰捌拾伍元叁角');
  await page.screenshot({ path:'/tmp/longun-desktop.png', fullPage:true });
  await page.getByRole('tab', { name:'第2张单据', exact:true }).click();
  await expect(page.getByLabel('所属部门')).toHaveValue('');
  await expect(page.getByLabel('第1项金额', { exact:true })).toHaveValue('');
  await page.getByLabel('所属部门').fill('创意部');
  const save = async (name: string, filename: string) => { const wait = page.waitForEvent('download'); await page.getByRole('button', { name, exact:true }).click(); const d = await wait; await d.saveAs(`/tmp/${filename}`); const pdf = await PDFDocument.load(await fs.readFile(`/tmp/${filename}`)); expect(pdf.getPageCount()).toBe(1); expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.3,0); };
  await save('导出 PDF', 'longun-expense.pdf');
  await page.reload(); await page.getByRole('tab', { name:'第2张单据', exact:true }).click(); await expect(page.getByLabel('所属部门')).toHaveValue('创意部');
  await page.getByRole('tab', { name:'支付申请单' }).click();
  await page.getByLabel('收款单位').fill('上海测试供应商有限公司'); await page.getByLabel('开户银行').fill('工商银行上海分行'); await page.getByLabel('收款账号').fill('6222000000000000000');
  await page.getByLabel('支付金额（元）').fill('5000.01'); await page.getByLabel('业务情况具体说明及立项单号').fill('项目执行费用，立项单号 LG-2026-001');
  await save('导出 PDF', 'longun-payment.pdf');
  await page.getByRole('tab', { name:'预支申请单' }).click(); await page.getByLabel('申请人', {exact:true}).fill('张三'); await page.getByLabel('立项号', {exact:true}).fill('LG-2026-001'); await page.getByLabel('预支金额（元）').fill('2500'); await page.getByLabel('用途', {exact:true}).fill('项目差旅备用金'); await page.getByLabel('供应商合同').selectOption('有合同');
  await save('导出 PDF', 'longun-advance.pdf');
  await page.setViewportSize({ width:390, height:844 });
  await page.screenshot({ path:'/tmp/longun-mobile.png', fullPage:true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('多页 PDF 与图片发票、重排旋转、持久保存和四拼导出', async ({ page }) => {
  const pdf=await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<5;i++){ const p=pdf.addPage([400,220]); p.drawRectangle({ x:10, y:10, width:380, height:200, borderWidth:2, borderColor:rgb(0.1,0.4,0.2) }); p.drawText(`INVOICE ${i+1}`,{x:30,y:160,size:30,font}); p.drawText(`TOTAL: ${100+i}.00 CNY`,{x:30,y:100,size:16,font}); if(i===2)p.setRotation(degrees(90)); }
  const bytes = Buffer.from(await pdf.save());
  await page.goto('/'); await page.getByRole('button', { name:'发票排版', exact:true }).click();
  await page.locator('input[type=file]').setInputFiles({ name:'invoices.pdf', mimeType:'application/pdf', buffer:bytes });
  await expect(page.locator('.invoice-item')).toHaveCount(5);
  await page.getByRole('button', { name:'旋转发票1',exact:true }).click(); await page.getByRole('button', {name:'后移发票1',exact:true}).click();
  const wait=page.waitForEvent('download'); await page.getByRole('button',{name:'导出发票 PDF',exact:true}).click(); const d=await wait; await d.saveAs('/tmp/longun-invoices.pdf');
  const result=await PDFDocument.load(await fs.readFile('/tmp/longun-invoices.pdf')); expect(result.getPageCount()).toBe(2); expect(result.getPage(0).getWidth()).toBeCloseTo(595.28);
  await page.screenshot({path:'/tmp/longun-invoices.png',fullPage:true});
  await page.reload(); await page.getByRole('button',{name:/^发票排版/}).click(); await expect(page.locator('.invoice-item')).toHaveCount(5);
  await page.getByRole('button',{name:'删除发票5',exact:true}).click(); await expect(page.locator('.invoice-item')).toHaveCount(4);
  await page.locator('input[type=file]').setInputFiles('/workspace/CHATGPT/public/templates/expense.png'); await expect(page.locator('.invoice-item')).toHaveCount(5);
  await page.getByRole('button',{name:'删除发票5',exact:true}).click();
});
test('独立报销逐张添加：3、4、5 张分页，单数末张留空，删除与恢复', async ({ page }) => {
  await page.goto('/');
  const select = (n: number) => page.getByRole('tab', { name: `第${n}张单据`, exact: true }).click();
  await page.getByLabel('第1项内容摘要').fill('EXP-01'); await page.getByLabel('第1项金额', { exact: true }).fill('10.01');
  await select(2); await expect(page.getByLabel('第1项内容摘要')).toHaveValue('');
  await page.getByLabel('第1项内容摘要').fill('EXP-02'); await page.getByLabel('第1项金额', { exact: true }).fill('20.02');
  await select(1); await expect(page.getByLabel('第1项金额', { exact: true })).toHaveValue('10.01');
  const markers = ['EXP-01','EXP-02'];
  for (let n = 3; n <= 5; n++) {
    await page.getByRole('button', { name: '添加一张单据', exact: true }).click();
    await expect(page.getByRole('tab', { name: `第${n}张单据`, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('第1项金额', { exact: true })).toHaveValue('');
    const marker = `EXP-0${n}`; markers.push(marker);
    await page.getByLabel('第1项内容摘要').fill(marker); await page.getByLabel('第1项金额', { exact: true }).fill(`${n * 10}.0${n}`);
    const pages = await exportForms(page, `/tmp/longun-independent-${n}.pdf`);
    checkSheetPositions(pages, markers);
    if (n % 2) expect(pages.at(-1)!.items.filter(x => x.y < 421 && /^\d{4}$/.test(x.str))).toHaveLength(0);
  }
  await expect(page.getByTestId('batch-total')).toHaveText('¥ 150.15');
  await page.reload(); await expect(page.getByRole('tab', { name: '第5张单据', exact: true })).toBeVisible();
  await select(3); await expect(page.getByLabel('第1项内容摘要')).toHaveValue('EXP-03');
  await page.getByLabel('第1项金额', { exact: true }).fill('bad');
  await select(1); await expect(page.getByTestId('total')).toHaveText('¥10.01');
  await expect(page.getByRole('button', { name: '导出 PDF', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('第 3 张单据');
  await select(3); await page.getByLabel('第1项金额', { exact: true }).fill('30.03');
  await page.getByRole('button', { name: '删除当前单据' }).click();
  await expect(page.getByRole('tab', { name: '第5张单据', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('第1项内容摘要')).toHaveValue('EXP-04');
  checkSheetPositions(await exportForms(page, '/tmp/longun-independent-deleted.pdf'), ['EXP-01','EXP-02','EXP-04','EXP-05']);
  await expect(page.getByTestId('batch-total')).toHaveText('¥ 120.12');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/longun-independent-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: '/tmp/longun-independent-desktop.png', fullPage: true });
  for (let n = 4; n > 1; n--) { await select(n); await page.getByRole('button', { name: '删除当前单据' }).click(); }
  await expect(page.getByRole('button', { name: '删除当前单据' })).toBeDisabled();
  checkSheetPositions(await exportForms(page, '/tmp/longun-independent-one.pdf'), ['EXP-01']);
});
for (const kind of ['payment','advance'] as const) test(`${kind} 逐张添加的内容和金额独立，三张自动导出两页`, async ({ page }) => {
  await page.goto('/'); await page.getByRole('tab', { name: kind === 'payment' ? '支付申请单' : '预支申请单', exact: true }).click();
  const label = kind === 'payment' ? '收款单位' : '立项号', amountLabel = kind === 'payment' ? '支付金额（元）' : '预支金额（元）';
  const markers = ['SHEET-A','SHEET-B','SHEET-C'];
  for (let i = 0; i < 3; i++) {
    if (i === 1) await page.getByRole('tab', { name: '第2张单据', exact: true }).click();
    if (i === 2) await page.getByRole('button', { name: '添加一张单据', exact: true }).click();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
    await page.getByLabel(label, { exact: true }).fill(markers[i]); await page.getByLabel(amountLabel, { exact: true }).fill(`${(i + 1) * 100}.0${i + 1}`);
  }
  await expect(page.getByTestId('batch-total')).toHaveText('¥ 600.06');
  checkSheetPositions(await exportForms(page, `/tmp/longun-independent-${kind}.pdf`), markers);
});
test('旧同步草稿自动迁移为独立单据，保留迁移备份', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('longun-drafts-v1')) return;
    const sheet = { fields: { date: '2026-10-20', department: '旧项目部' }, rows: [{ description: '旧报销', amount: '12.34', count: '1' }] };
    localStorage.setItem('longun-drafts-v1', JSON.stringify([{ id: 'legacy', kind: 'expense', title: '历史草稿', mirror: true, sheets: [sheet, { fields: {}, rows: [{ description: '', amount: '', count: '' }] }], updated: new Date().toISOString() }]));
  });
  await page.goto('/'); await page.getByRole('tab', { name: '第2张单据', exact: true }).click();
  await expect(page.getByLabel('第1项金额', { exact: true })).toHaveValue('12.34');
  await page.getByLabel('第1项金额', { exact: true }).fill('56.78');
  await page.getByRole('tab', { name: '第1张单据', exact: true }).click();
  await expect(page.getByLabel('第1项金额', { exact: true })).toHaveValue('12.34');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('longun-drafts-before-independent-v1')!)[0].mirror)).toBe(true);
});
