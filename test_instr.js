import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import fs from 'fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="osmd"></div>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLDivElement = dom.window.HTMLDivElement;

const xml = fs.readFileSync('./public/assets/score.xml', 'utf8');
const osmd = new OpenSheetMusicDisplay(document.getElementById('osmd'), { backend: 'svg' });
await osmd.load(xml);

const names = osmd.Sheet.Instruments.map((inst, idx) => `${idx}: ` + (inst.NameLabel ? inst.NameLabel.text : inst.name));
console.log("Instruments:", names);