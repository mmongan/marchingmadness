#!/usr/bin/env node
/**
 * Generate MusicXML brass/wind/percussion marching band arrangements
 * of public domain songs for the Marching Madness game.
 *
 * All melodies are public domain (composed before 1900).
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");

// Part definitions matching the band's 15 rows (row 0 = DrumMajor, no music part)
const PARTS = [
  // id, name, abbreviation, midiChannel, midiProgram, clef, transpose, percClef
  { id: "P1",  name: "Flute",         abbr: "Fl.",   ch: 1,  prog: 74, clef: "G", transpose: null },
  { id: "P2",  name: "B♭ Clarinet",   abbr: "Cl.",   ch: 2,  prog: 72, clef: "G", transpose: { d: -1, c: -2 } },
  { id: "P3",  name: "Alto Saxophone", abbr: "A.Sx.", ch: 3,  prog: 66, clef: "G", transpose: { d: -5, c: -9 } },
  { id: "P4",  name: "Mellophone",     abbr: "Mell.", ch: 4,  prog: 61, clef: "G", transpose: { d: -4, c: -7 } },
  { id: "P5",  name: "B♭ Trumpet 1",  abbr: "Tpt.1", ch: 5,  prog: 57, clef: "G", transpose: { d: -1, c: -2 } },
  { id: "P6",  name: "B♭ Trumpet 2",  abbr: "Tpt.2", ch: 6,  prog: 57, clef: "G", transpose: { d: -1, c: -2 } },
  { id: "P7",  name: "Trombone",       abbr: "Tbn.",  ch: 7,  prog: 58, clef: "F", transpose: null },
  { id: "P8",  name: "Euphonium",      abbr: "Euph.", ch: 8,  prog: 59, clef: "F", transpose: null },
  { id: "P9",  name: "Tuba",           abbr: "Tuba",  ch: 9,  prog: 59, clef: "F", transpose: null },
  { id: "P10", name: "Glockenspiel",   abbr: "Glock.",ch: 11, prog: 10, clef: "G", transpose: null },
  { id: "P11", name: "Snare Drum",     abbr: "S.D.",  ch: 10, prog: 1,  clef: "percussion", transpose: null },
  { id: "P12", name: "Tom Toms",       abbr: "T.T.",  ch: 10, prog: 1,  clef: "percussion", transpose: null },
  { id: "P13", name: "Bass Drum",      abbr: "B.D.",  ch: 10, prog: 1,  clef: "percussion", transpose: null },
  { id: "P14", name: "Cymbals",        abbr: "Cym.",  ch: 10, prog: 1,  clef: "percussion", transpose: null },
];

// Note name to MIDI mapping (concert pitch, octave 4 = middle)
const NOTE_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiToXml(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi % 12;
  const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
  const alters = [0,   1,   0,   1,   0,   0,   1,   0,   1,   0,   1,   0];
  return { step: names[pc], alter: alters[pc], octave };
}

// Duration: 1=16th, 2=8th, 4=quarter, 8=half, 16=whole (divisions=4)
function durationType(dur) {
  if (dur <= 1) return "16th";
  if (dur <= 2) return "eighth";
  if (dur <= 4) return "quarter";
  if (dur <= 8) return "half";
  return "whole";
}

function noteXml(midi, duration, isRest = false, dot = false) {
  if (isRest) {
    return `        <note>\n          <rest/>\n          <duration>${duration}</duration>\n          <voice>1</voice>\n          <type>${durationType(duration)}</type>\n${dot ? "          <dot/>\n" : ""}        </note>`;
  }
  const { step, alter, octave } = midiToXml(midi);
  let xml = `        <note>\n          <pitch>\n            <step>${step}</step>\n${alter ? `            <alter>${alter}</alter>\n` : ""}            <octave>${octave}</octave>\n          </pitch>\n          <duration>${duration}</duration>\n          <voice>1</voice>\n          <type>${durationType(duration)}</type>\n${dot ? "          <dot/>\n" : ""}        </note>`;
  return xml;
}

function percNoteXml(displayStep, displayOctave, duration, isRest = false) {
  if (isRest) {
    return `        <note>\n          <rest/>\n          <duration>${duration}</duration>\n          <voice>1</voice>\n          <type>${durationType(duration)}</type>\n        </note>`;
  }
  return `        <note>\n          <unpitched>\n            <display-step>${displayStep}</display-step>\n            <display-octave>${displayOctave}</display-octave>\n          </unpitched>\n          <duration>${duration}</duration>\n          <voice>1</voice>\n          <type>${durationType(duration)}</type>\n        </note>`;
}

function buildPartList() {
  return PARTS.map(p => {
    let xml = `    <score-part id="${p.id}">\n      <part-name>${p.name}</part-name>\n      <part-abbreviation>${p.abbr}</part-abbreviation>\n      <score-instrument id="${p.id}-I1">\n        <instrument-name>${p.name}</instrument-name>\n      </score-instrument>\n      <midi-device id="${p.id}-I1" port="1"></midi-device>\n      <midi-instrument id="${p.id}-I1">\n        <midi-channel>${p.ch}</midi-channel>\n        <midi-program>${p.prog}</midi-program>\n        <volume>80</volume>\n        <pan>0</pan>\n      </midi-instrument>\n    </score-part>`;
    return xml;
  }).join("\n");
}

function buildAttributes(part, beats, beatType, divisions) {
  let xml = `      <attributes>\n        <divisions>${divisions}</divisions>\n        <key>\n          <fifths>0</fifths>\n        </key>\n        <time>\n          <beats>${beats}</beats>\n          <beat-type>${beatType}</beat-type>\n        </time>\n`;
  if (part.clef === "percussion") {
    xml += `        <clef>\n          <sign>percussion</sign>\n        </clef>\n`;
  } else if (part.clef === "F") {
    xml += `        <clef>\n          <sign>F</sign>\n          <line>4</line>\n        </clef>\n`;
  } else {
    xml += `        <clef>\n          <sign>G</sign>\n          <line>2</line>\n        </clef>\n`;
  }
  if (part.transpose) {
    xml += `        <transpose>\n          <diatonic>${part.transpose.d}</diatonic>\n          <chromatic>${part.transpose.c}</chromatic>\n        </transpose>\n`;
  }
  xml += `      </attributes>`;
  return xml;
}

function buildScore(title, composer, tempo, beats, beatType, divisions, partNotesFunc) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="3.1">\n  <work>\n    <work-title>${title}</work-title>\n  </work>\n  <identification>\n    <creator type="composer">${composer}</creator>\n    <rights>Public Domain</rights>\n    <encoding>\n      <encoding-date>2026-04-08</encoding-date>\n    </encoding>\n  </identification>\n  <part-list>\n${buildPartList()}\n  </part-list>\n`;

  for (let pi = 0; pi < PARTS.length; pi++) {
    const part = PARTS[pi];
    const measures = partNotesFunc(pi, part);
    xml += `  <part id="${part.id}">\n`;
    for (let mi = 0; mi < measures.length; mi++) {
      xml += `    <measure number="${mi + 1}">\n`;
      if (mi === 0) {
        xml += buildAttributes(part, beats, beatType, divisions) + "\n";
        xml += `      <direction placement="above">\n        <direction-type>\n          <metronome>\n            <beat-unit>quarter</beat-unit>\n            <per-minute>${tempo}</per-minute>\n          </metronome>\n        </direction-type>\n        <sound tempo="${tempo}"/>\n      </direction>\n`;
      }
      xml += measures[mi].join("\n") + "\n";
      xml += `    </measure>\n`;
    }
    xml += `  </part>\n`;
  }

  xml += `</score-partwise>\n`;
  return xml;
}

// ============================================================
// SONG 1: "When the Saints Go Marching In" (Traditional, Public Domain)
// Key of Bb concert (written in C for Bb instruments)
// 4/4 time, tempo 120 (upbeat march)
// ============================================================

function generateSaints() {
  // Concert pitch melody (MIDI numbers) - Bb major
  // "Oh when the saints go marching in" etc.
  // Written in Bb concert: Bb=58, C=60, D=62, Eb=63, F=65, G=67, A=69
  
  // Each measure is an array of [midi, duration] pairs
  // divisions=4, so quarter=4, eighth=2, half=8, whole=16, dotted half=12
  const melodyMeasures = [
    // Pickup feel: "Oh when the"
    [[58,2],[60,2],[62,2],[65,2],[0,8]], // Bb C D F | half rest
    [[58,2],[60,2],[62,2],[65,2],[0,8]],
    [[58,2],[60,2],[62,2],[65,8],[62,4]],
    [[60,8],[62,4],[60,4]],
    [[58,8],[60,4],[58,4]], // Bb.. C Bb
    [[60,4],[58,4],[60,8]],
    [[62,12],[60,4]],
    [[58,8],[60,8]],
    // Repeat with variation
    [[58,2],[60,2],[62,2],[65,2],[0,8]],
    [[58,2],[60,2],[62,2],[65,2],[0,8]],
    [[58,2],[60,2],[62,2],[65,8],[62,4]],
    [[60,8],[62,4],[60,4]],
    [[65,4],[63,4],[62,4],[60,4]],
    [[58,4],[60,4],[62,8]],
    [[60,12],[58,4]],
    [[58,16]],
  ];

  // Harmony: simple thirds/fifths below melody
  const harmonyMeasures = melodyMeasures.map(m => 
    m.map(([midi, dur]) => [midi > 0 ? midi - 4 : 0, dur])
  );

  // Horn: held notes on chord tones
  const hornMeasures = [
    [[65,16]], [[65,16]], [[65,16]], [[63,16]],
    [[62,16]], [[60,16]], [[62,16]], [[58,16]],
    [[65,16]], [[65,16]], [[65,16]], [[63,16]],
    [[65,16]], [[62,16]], [[60,16]], [[58,16]],
  ];

  // Trombone: bass line
  const tboneMeasures = [
    [[46,4],[53,4],[46,4],[53,4]], [[46,4],[53,4],[46,4],[53,4]],
    [[46,4],[53,4],[46,4],[53,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[46,4],[53,4],[46,4],[53,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[50,4],[46,4],[50,4],[46,4]], [[46,4],[53,4],[46,4],[53,4]],
    [[46,4],[53,4],[46,4],[53,4]], [[46,4],[53,4],[46,4],[53,4]],
    [[46,4],[53,4],[46,4],[53,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[53,4],[51,4],[50,4],[48,4]], [[46,4],[48,4],[50,4],[46,4]],
    [[48,4],[46,4],[48,8]], [[46,16]],
  ];

  // Euphonium: similar to trombone but higher register
  const euphMeasures = tboneMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  // Tuba: root notes, simple
  const tubaMeasures = [
    [[34,8],[41,8]], [[34,8],[41,8]], [[34,8],[41,8]], [[36,8],[43,8]],
    [[34,8],[41,8]], [[36,8],[43,8]], [[38,8],[34,8]], [[34,8],[41,8]],
    [[34,8],[41,8]], [[34,8],[41,8]], [[34,8],[41,8]], [[36,8],[43,8]],
    [[41,8],[39,8]], [[34,8],[38,8]], [[36,8],[34,8]], [[34,16]],
  ];

  // Glockenspiel: melody doubled up an octave
  const glockMeasures = melodyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  // Alto sax: harmony part (concert pitch, will need transposition display)
  const saxMeasures = harmonyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  // Percussion patterns: standard march beat
  const snarePattern = [[0,0,4],[0,0,2],[0,0,2],[0,0,4],[0,0,4]]; // q e e q q
  const tomPattern = [[0,0,4],[0,0,4],[0,0,4],[0,0,4]];
  const bdPattern = [[0,0,4],[0,0,8],[0,0,4]]; // q h q on beats 1,3  
  const cymPattern = [[0,0,8],[0,0,8]]; // half notes

  const numMeasures = melodyMeasures.length;

  return buildScore(
    "When the Saints Go Marching In",
    "Traditional (Public Domain)",
    120, 4, 4, 4,
    (partIndex, part) => {
      const measures = [];
      for (let mi = 0; mi < numMeasures; mi++) {
        const notes = [];
        let src;
        switch(partIndex) {
          case 0: src = melodyMeasures[mi]; break;          // Flute: melody
          case 1: src = harmonyMeasures[mi]; break;         // Clarinet: harmony
          case 2: src = saxMeasures[mi]; break;             // Alto Sax: harmony high
          case 3: src = hornMeasures[mi]; break;            // Mellophone: sustained
          case 4: src = melodyMeasures[mi]; break;          // Trumpet 1: melody
          case 5: src = harmonyMeasures[mi]; break;         // Trumpet 2: harmony
          case 6: src = tboneMeasures[mi]; break;           // Trombone: bass line
          case 7: src = euphMeasures[mi]; break;            // Euphonium
          case 8: src = tubaMeasures[mi]; break;            // Tuba: roots
          case 9: src = glockMeasures[mi]; break;           // Glockenspiel: melody +8va
          default: src = null;
        }

        if (src) {
          for (const [midi, dur] of src) {
            notes.push(noteXml(midi, dur, midi === 0));
          }
        } else {
          // Percussion parts
          switch(partIndex) {
            case 10: // Snare: q e e q q
              notes.push(percNoteXml("C", 5, 4));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 4));
              notes.push(percNoteXml("C", 5, 4));
              break;
            case 11: // Toms: quarter notes
              notes.push(percNoteXml("D", 5, 4));
              notes.push(percNoteXml("E", 5, 4));
              notes.push(percNoteXml("D", 5, 4));
              notes.push(percNoteXml("E", 5, 4));
              break;
            case 12: // Bass drum: beats 1 & 3
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              break;
            case 13: // Cymbals: half notes
              notes.push(percNoteXml("A", 5, 8));
              notes.push(percNoteXml("A", 5, 8));
              break;
          }
        }
        measures.push(notes);
      }
      return measures;
    }
  );
}

// ============================================================
// SONG 2: "Stars and Stripes Forever" - Main Strain
// John Philip Sousa, 1896 (Public Domain)
// Key of Bb concert, 2/2 time (cut time), tempo 120
// ============================================================

function generateStarsAndStripes() {
  // Famous piccolo obbligato / main melody in Bb concert
  // Simplified main strain, 16 measures
  // MIDI: Bb=58, C=60, D=62, Eb=63, F=65, G=67, A=69, Bb=70
  
  const melodyMeasures = [
    [[65,4],[65,2],[63,2],[62,4],[60,4]],   // F F Eb D C Bb
    [[58,4],[58,4],[62,4],[65,4]],           // Bb Bb D F
    [[67,4],[65,4],[63,4],[62,4]],           // G F Eb D
    [[60,16]],                               // C whole
    [[62,4],[62,2],[60,2],[58,4],[60,4]],   // D D C Bb C
    [[62,4],[65,4],[67,4],[69,4]],           // D F G A
    [[70,4],[69,4],[67,4],[65,4]],           // Bb A G F
    [[67,16]],                               // G whole
    [[65,4],[65,2],[63,2],[62,4],[60,4]],
    [[58,4],[58,4],[62,4],[65,4]],
    [[67,4],[65,4],[63,4],[62,4]],
    [[60,16]],
    [[70,4],[69,4],[67,4],[65,4]],
    [[63,4],[62,4],[60,4],[62,4]],
    [[58,8],[62,8]],
    [[58,16]],
  ];

  // Counter melody (trumpet 2 / clarinets)
  const counterMeasures = [
    [[58,4],[58,4],[58,4],[58,4]],
    [[55,4],[55,4],[58,4],[62,4]],
    [[63,4],[62,4],[60,4],[58,4]],
    [[55,16]],
    [[58,4],[58,4],[55,4],[58,4]],
    [[58,4],[62,4],[63,4],[65,4]],
    [[67,4],[65,4],[63,4],[62,4]],
    [[63,16]],
    [[58,4],[58,4],[58,4],[58,4]],
    [[55,4],[55,4],[58,4],[62,4]],
    [[63,4],[62,4],[60,4],[58,4]],
    [[55,16]],
    [[67,4],[65,4],[63,4],[62,4]],
    [[60,4],[58,4],[55,4],[58,4]],
    [[55,8],[58,8]],
    [[55,16]],
  ];

  const hornMeasures = [
    [[62,8],[65,8]], [[58,8],[62,8]], [[63,8],[62,8]], [[60,16]],
    [[62,8],[60,8]], [[62,8],[65,8]], [[67,8],[65,8]], [[63,16]],
    [[62,8],[65,8]], [[58,8],[62,8]], [[63,8],[62,8]], [[60,16]],
    [[67,8],[65,8]], [[60,8],[58,8]], [[55,8],[58,8]], [[55,16]],
  ];

  const tboneMeasures = [
    [[46,4],[53,4],[46,4],[53,4]], [[46,4],[53,4],[50,4],[53,4]],
    [[51,4],[50,4],[48,4],[46,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[46,4],[50,4],[46,4],[48,4]], [[50,4],[53,4],[55,4],[53,4]],
    [[58,4],[57,4],[55,4],[53,4]], [[55,4],[48,4],[55,4],[48,4]],
    [[46,4],[53,4],[46,4],[53,4]], [[46,4],[53,4],[50,4],[53,4]],
    [[51,4],[50,4],[48,4],[46,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[58,4],[57,4],[55,4],[53,4]], [[51,4],[50,4],[48,4],[50,4]],
    [[46,8],[50,8]], [[46,16]],
  ];

  const euphMeasures = tboneMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const tubaMeasures = [
    [[34,4],[0,4],[41,4],[0,4]], [[34,4],[0,4],[38,4],[0,4]],
    [[39,4],[0,4],[34,4],[0,4]], [[36,4],[0,4],[43,4],[0,4]],
    [[34,4],[0,4],[38,4],[0,4]], [[38,4],[0,4],[41,4],[0,4]],
    [[46,4],[0,4],[41,4],[0,4]], [[43,4],[0,4],[36,4],[0,4]],
    [[34,4],[0,4],[41,4],[0,4]], [[34,4],[0,4],[38,4],[0,4]],
    [[39,4],[0,4],[34,4],[0,4]], [[36,4],[0,4],[43,4],[0,4]],
    [[46,4],[0,4],[41,4],[0,4]], [[39,4],[0,4],[36,4],[0,4]],
    [[34,8],[38,8]], [[34,16]],
  ];

  const glockMeasures = melodyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const saxMeasures = counterMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const numMeasures = melodyMeasures.length;

  return buildScore(
    "Stars and Stripes Forever",
    "John Philip Sousa (1896, Public Domain)",
    120, 4, 4, 4,
    (partIndex, part) => {
      const measures = [];
      for (let mi = 0; mi < numMeasures; mi++) {
        const notes = [];
        let src;
        switch(partIndex) {
          case 0: src = melodyMeasures[mi]; break;
          case 1: src = counterMeasures[mi]; break;
          case 2: src = saxMeasures[mi]; break;
          case 3: src = hornMeasures[mi]; break;
          case 4: src = melodyMeasures[mi]; break;
          case 5: src = counterMeasures[mi]; break;
          case 6: src = tboneMeasures[mi]; break;
          case 7: src = euphMeasures[mi]; break;
          case 8: src = tubaMeasures[mi]; break;
          case 9: src = glockMeasures[mi]; break;
          default: src = null;
        }

        if (src) {
          for (const [midi, dur] of src) {
            notes.push(noteXml(midi, dur, midi === 0));
          }
        } else {
          // March percussion
          switch(partIndex) {
            case 10: // Snare: standard march
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 4));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 4));
              break;
            case 11: // Toms
              notes.push(percNoteXml("D", 5, 4));
              notes.push(percNoteXml("E", 5, 4));
              notes.push(percNoteXml("D", 5, 4));
              notes.push(percNoteXml("E", 5, 4));
              break;
            case 12: // Bass: 1 and 3
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              break;
            case 13: // Cymbals: beats 2 and 4
              notes.push(percNoteXml("A", 5, 4, true));
              notes.push(percNoteXml("A", 5, 4));
              notes.push(percNoteXml("A", 5, 4, true));
              notes.push(percNoteXml("A", 5, 4));
              break;
          }
        }
        measures.push(notes);
      }
      return measures;
    }
  );
}

// ============================================================
// SONG 3: "Battle Hymn of the Republic" (Public Domain, 1861)
// Key of Bb concert, 4/4 time, tempo 108 (stately march)
// ============================================================

function generateBattleHymn() {
  // "Mine eyes have seen the glory..."
  // Bb major concert: Bb=58, C=60, D=62, Eb=63, F=65, G=67, A=69, Bb=70
  
  const melodyMeasures = [
    [[58,2],[58,2],[58,4],[60,4]],           // Bb Bb Bb C (pickup feel)
    [[62,4],[62,4],[60,4],[58,4]],           // D D C Bb
    [[58,4],[60,4],[62,4],[62,4]],           // Bb C D D
    [[60,16]],                               // C whole
    [[60,2],[60,2],[60,4],[62,4]],           // C C C D
    [[63,4],[63,4],[62,4],[60,4]],           // Eb Eb D C
    [[58,4],[60,4],[62,4],[60,4]],           // Bb C D C
    [[58,16]],                               // Bb whole
    // Chorus: "Glory glory hallelujah"
    [[65,8],[65,8]],                          // F... F...
    [[63,8],[62,8]],                          // Eb... D...
    [[62,4],[60,4],[58,4],[60,4]],           // D C Bb C
    [[62,16]],                               // D whole
    [[65,8],[65,8]],
    [[63,8],[62,8]],
    [[60,8],[58,8]],
    [[58,16]],
  ];

  const harmonyMeasures = melodyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi - 3 : 0, dur])
  );

  const hornMeasures = [
    [[58,16]], [[62,16]], [[58,16]], [[60,16]],
    [[60,16]], [[63,16]], [[58,16]], [[55,16]],
    [[65,16]], [[63,16]], [[62,16]], [[62,16]],
    [[65,16]], [[63,16]], [[60,16]], [[58,16]],
  ];

  const tboneMeasures = [
    [[46,4],[53,4],[46,4],[48,4]], [[50,4],[50,4],[48,4],[46,4]],
    [[46,4],[48,4],[50,4],[50,4]], [[48,4],[55,4],[48,4],[55,4]],
    [[48,4],[55,4],[48,4],[50,4]], [[51,4],[51,4],[50,4],[48,4]],
    [[46,4],[48,4],[50,4],[48,4]], [[46,4],[53,4],[46,4],[53,4]],
    [[53,4],[46,4],[53,4],[46,4]], [[51,4],[50,4],[51,4],[50,4]],
    [[50,4],[48,4],[46,4],[48,4]], [[50,4],[46,4],[50,4],[46,4]],
    [[53,4],[46,4],[53,4],[46,4]], [[51,4],[50,4],[51,4],[50,4]],
    [[48,4],[46,4],[48,4],[46,4]], [[46,4],[53,4],[46,16-8]],
  ];

  const euphMeasures = tboneMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const tubaMeasures = [
    [[34,8],[41,8]], [[38,8],[34,8]], [[34,8],[38,8]], [[36,8],[43,8]],
    [[36,8],[43,8]], [[39,8],[36,8]], [[34,8],[36,8]], [[34,8],[41,8]],
    [[41,8],[34,8]], [[39,8],[38,8]], [[38,8],[34,8]], [[38,8],[34,8]],
    [[41,8],[34,8]], [[39,8],[38,8]], [[36,8],[34,8]], [[34,16]],
  ];

  const glockMeasures = melodyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const saxMeasures = harmonyMeasures.map(m =>
    m.map(([midi, dur]) => [midi > 0 ? midi + 12 : 0, dur])
  );

  const numMeasures = melodyMeasures.length;

  return buildScore(
    "Battle Hymn of the Republic",
    "Traditional (1861, Public Domain)",
    108, 4, 4, 4,
    (partIndex, part) => {
      const measures = [];
      for (let mi = 0; mi < numMeasures; mi++) {
        const notes = [];
        let src;
        switch(partIndex) {
          case 0: src = melodyMeasures[mi]; break;
          case 1: src = harmonyMeasures[mi]; break;
          case 2: src = saxMeasures[mi]; break;
          case 3: src = hornMeasures[mi]; break;
          case 4: src = melodyMeasures[mi]; break;
          case 5: src = harmonyMeasures[mi]; break;
          case 6: src = tboneMeasures[mi]; break;
          case 7: src = euphMeasures[mi]; break;
          case 8: src = tubaMeasures[mi]; break;
          case 9: src = glockMeasures[mi]; break;
          default: src = null;
        }

        if (src) {
          for (const [midi, dur] of src) {
            notes.push(noteXml(midi, dur, midi === 0));
          }
        } else {
          switch(partIndex) {
            case 10: // Snare
              notes.push(percNoteXml("C", 5, 4));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 2));
              notes.push(percNoteXml("C", 5, 4));
              notes.push(percNoteXml("C", 5, 4));
              break;
            case 11: // Toms
              notes.push(percNoteXml("D", 5, 8));
              notes.push(percNoteXml("E", 5, 8));
              break;
            case 12: // Bass drum
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              notes.push(percNoteXml("F", 4, 4));
              notes.push(percNoteXml("F", 4, 4, true));
              break;
            case 13: // Cymbals
              notes.push(percNoteXml("A", 5, 4));
              notes.push(percNoteXml("A", 5, 4, true));
              notes.push(percNoteXml("A", 5, 4));
              notes.push(percNoteXml("A", 5, 4, true));
              break;
          }
        }
        measures.push(notes);
      }
      return measures;
    }
  );
}

// Generate and write all scores
writeFileSync(join(ASSETS, "saints.xml"), generateSaints(), "utf-8");
console.log("✓ Generated assets/saints.xml  (When the Saints Go Marching In)");

writeFileSync(join(ASSETS, "stars_and_stripes.xml"), generateStarsAndStripes(), "utf-8");
console.log("✓ Generated assets/stars_and_stripes.xml  (Stars and Stripes Forever)");

writeFileSync(join(ASSETS, "battle_hymn.xml"), generateBattleHymn(), "utf-8");
console.log("✓ Generated assets/battle_hymn.xml  (Battle Hymn of the Republic)");
