const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf-8');

const startStr = "function buildMarchingBand(scene: Scene) {";
const endStr = "\nbuildMarchingBand(scene);";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find start/end in src/main.ts.");
    process.exit(1);
}

const replacement = `function buildMarchingBand(scene: Scene) {
    const factory = new BandMemberFactory(scene);

    const rows = 16;
    const cols = 10;
    const spacingX = 2.0; // 2 meters between columns
    const spacingZ = 2.0; // 2 meters between rows
    const startZ = 60;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isDrumMajor = (r === 0);
            const isFlute = (r === 1);
            const isClarinet = (r === 2 || r === 3);
            const isSaxophone = (r === 4 || r === 5);
            const isTomTom = (r === 6);
            const isSnareDrum = (r === 7 || r === 8);
            const isBassDrum = (r === 9);
            const isCymbals = (r === 10);
            const isTrumpet = (r === 11);
            const isMellophone = (r === 12);
            const isEuphonium = (r === 13);
            const isTrombone = (r === 14);
            const isSousaphone = (r === 15);

            let type: InstrumentType = "DrumMajor";
            if (isFlute) type = "Flute";
            else if (isClarinet) type = "Clarinet";
            else if (isSaxophone) type = "Saxophone";
            else if (isTomTom) type = "TomTom";
            else if (isSnareDrum) type = "SnareDrum";
            else if (isBassDrum) type = "BassDrum";
            else if (isCymbals) type = "Cymbals";
            else if (isTrumpet) type = "Trumpet";
            else if (isMellophone) type = "Mellophone";
            else if (isEuphonium) type = "Euphonium";
            else if (isTrombone) type = "Trombone";
            else if (isSousaphone) type = "Sousaphone";

            const xPos = (c - cols / 2 + 0.5) * spacingX;
            const zPos = startZ + r * spacingZ;

            const memberData = factory.createMember(r, c, type, xPos, zPos);
            bandLegs.push(memberData);
        }
    }
}
buildMarchingBand(scene);`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);

const importStr = 'import { BandMemberFactory, InstrumentType } from "./bandMemberFactory";\n';
code = importStr + code;

fs.writeFileSync('src/main.ts', code);
console.log("Successfully refactored src/main.ts");
