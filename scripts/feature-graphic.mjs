// Generates 1024x500 Play feature graphics: node feature-graphic.mjs <app-dir> '<logo svg>' '<bg1>' '<bg2>' '<json langs>'
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const [dir, logo, bg1, bg2, langsJson] = process.argv.slice(2);
const langs = JSON.parse(langsJson);
mkdirSync(`${dir}/store/android`, {recursive:true});
const b = await chromium.launch({headless:true, executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:1024,height:500}});
for (const [l, {name, title, sub}] of Object.entries(langs)) {
  await p.setContent(`<html><body style="margin:0;width:1024px;height:500px;background:linear-gradient(135deg,${bg1},${bg2});font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff;display:flex;align-items:center;gap:52px;padding:0 70px;box-sizing:border-box">
  <div style="width:200px;height:200px;border-radius:44px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none"><div style="width:120px;height:120px">${logo.replace(/<rect[^>]*\/>/,'')}</div></div>
  <div><div style="font-size:30px;font-weight:600;opacity:.85">${name}</div><div style="font-size:56px;font-weight:800;line-height:1.1;margin:6px 0 12px;max-width:640px">${title}</div><div style="font-size:28px;opacity:.9">${sub}</div></div></body></html>`);
  await p.screenshot({path:`${dir}/store/android/feature-graphic-${l}.png`});
}
await b.close(); console.log('ok', Object.keys(langs).join(' '));
