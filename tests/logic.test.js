'use strict';
const assert=require('node:assert/strict');
const {bahtText,cases}=require('../tools/js/baht-text.js');
const {promptPay,crc16}=require('../tools/js/qr.js');
for(const [input,expected] of cases)assert.equal(bahtText(input),expected,input);
for(const [input,expected] of [['-0.004','ศูนย์บาทถ้วน'],['-0.005','ลบศูนย์บาทหนึ่งสตางค์'],['1,234.50','หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์'],['1000000000000000000','หนึ่งล้านล้านล้านบาทถ้วน'],['2000000000000','สองล้านล้านบาทถ้วน']])assert.equal(bahtText(input),expected,input);
for(const value of ['','NaN','1e4','1.2.3'])assert.throws(()=>bahtText(value));
assert.equal(crc16('123456789'),'29B1');
const phone='00020101021129370016A000000677010111011300668123456785802TH530376463045D82';
assert.equal(promptPay('0812345678'),phone);
assert.equal(promptPay('081-234-5678'),phone);
assert.equal(promptPay('0812345678','100.00'),'00020101021229370016A000000677010111011300668123456785802TH53037645406100.006304BB8A');
// Independent bitwise CRC implementation validates payload checksums.
function referenceCRC(s){let crc=65535;for(const ch of Buffer.from(s)){for(let bit=7;bit>=0;bit--){const xor=((crc>>>15)^((ch>>>bit)&1))&1;crc=(crc*2)&65535;if(xor)crc^=4129}}return crc.toString(16).toUpperCase().padStart(4,'0')}
function tags(s){const out={};for(let i=0;i<s.length;){const tag=s.slice(i,i+2),n=Number(s.slice(i+2,i+4));assert.ok(Number.isInteger(n));out[tag]=s.slice(i+4,i+4+n);assert.equal(out[tag].length,n);i+=4+n}return out}
for(const id of ['0812345678','1234567890123'])for(const amount of ['','0.01','1234.50']){const p=promptPay(id,amount),t=tags(p);assert.equal(t['00'],'01');assert.equal(t['01'],amount?'12':'11');assert.equal(t['58'],'TH');assert.equal(t['53'],'764');assert.equal(t['63'],referenceCRC(p.slice(0,-4)));const merchant=tags(t['29']);assert.equal(merchant['00'],'A000000677010111');assert.equal(merchant[id.length===10?'01':'02'],id.length===10?'0066812345678':id);if(amount)assert.equal(t['54'],Number(amount).toFixed(2))}
for(const id of ['123','081234567','08123456789','abcdefghijklm'])assert.throws(()=>promptPay(id));
for(const amount of ['0','-1','1.001','NaN','10000000000'])assert.throws(()=>promptPay('0812345678',amount));
console.log('PASS: baht 21 cases + invalid inputs; PromptPay known vectors, TLV fields, independent CRC, invalid inputs');
