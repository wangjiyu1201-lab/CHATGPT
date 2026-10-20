import { describe, expect, it } from 'vitest';
import { cents, uppercase, total, newDraft, validate, overlays } from '../src/model';
describe('精确金额与人民币大写', () => {
  it('以分求和，避免浮点误差', () => { expect(cents('0.10') + cents('0.20')).toBe(30); expect(cents('123.4')).toBe(12340); expect(cents('')).toBe(0); });
  it.each([['-1'], ['1.001'], ['1e3'], ['abc'], ['1000000'], ['1,000']])('拒绝无效金额 %s', value => expect(() => cents(value)).toThrow());
  it.each([[0,'零元整'], [1,'零元壹分'], [10,'零元壹角'], [101,'壹元零壹分'], [123456,'壹仟贰佰叁拾肆元伍角陆分'], [1000000,'壹万元整'], [1000100,'壹万零壹元整'], [10010000,'壹拾万零壹佰元整'], [100010000,'壹佰万零壹佰元整'], [99999999,'玖拾玖万玖仟玖佰玖拾玖元玖角玖分']])('大写金额 %s', (n, expected) => expect(uppercase(n as number)).toBe(expected));
  it('合计溢出必须阻止导出', () => { const d = newDraft('expense'); d.sheets[0].rows = [{ description:'a', amount:'999999.99', count:'1' }, { description:'b', amount:'0.01', count:'1' }]; expect(total(d.sheets[0])).toBe(100000000); expect(() => validate(d)).toThrow('六位'); });
  it('只验证启用的单据，但独立模式验证两张', () => { const d = newDraft('expense'); d.sheets[1].rows[0].amount='bad'; expect(() => validate(d)).not.toThrow(); d.mirror=false; expect(() => validate(d)).toThrow(); });
  it('两联填写内容均位于原始页面范围内', () => { for (const k of ['expense','payment','advance'] as const) { const d = newDraft(k); d.sheets[0].fields = { date:'2026-10-20', agent:'张三', amount:'123.45', payee:'测试公司', contract:'有合同', method:'网银', purpose:'项目差旅' }; d.sheets[0].rows[0]={ description:'交通费', amount:'123.45', count:'2' }; for (const second of [false,true]) for (const o of overlays(k,d.sheets[0],second)) { expect(o.x).toBeGreaterThanOrEqual(0); expect(o.x+o.w).toBeLessThan(595.5); expect(o.y+o.h).toBeLessThan(842); } } });
});
