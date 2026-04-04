import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { JSDOM } from 'jsdom';

const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Notation</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>`;

const dom = new JSDOM('<!DOCTYPE html><div id="osmd"></div>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLDivElement = dom.window.HTMLDivElement;

const osmd = new OpenSheetMusicDisplay(document.getElementById('osmd'), { backend: "svg" });
await osmd.load(xml);
osmd.render();

const svgContent = document.getElementById('osmd').innerHTML;
console.log(svgContent.substring(0, 2000));