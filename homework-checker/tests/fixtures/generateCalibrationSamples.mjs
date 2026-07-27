import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const samples = [
  {
    name: "grade1-addition",
    grade: "GRADE 1 ADDITION",
    rows: ["1) 8 + 5 = 13", "2. 12 + 7 = 19", "3、 9 + 6 = 15"],
    variant: "typed",
  },
  {
    name: "grade2-arithmetic",
    grade: "GRADE 2 ARITHMETIC",
    rows: ["1) 8 + 5 = 12", "2. 9 + 6 = 15", "3、 4 x 3 = 12"],
    variant: "typed",
  },
  {
    name: "grade3-units",
    grade: "GRADE 3 UNITS",
    rows: ["1) 2 m + 30 cm = 230 cm", "2. 3 kg - 500 g = 2500 g", "3、 1 l + 250 ml = 1250 ml"],
    variant: "typed",
  },
  {
    name: "grade4-decimals",
    grade: "GRADE 4 DECIMALS — CAMERA ANGLE",
    rows: ["1) 1.5 + 2.5 = 4", "2. 1,000 + 500 = 1,500", "3、 RM 10 / 3 = RM 3.33"],
    variant: "camera",
  },
  {
    name: "grade5-equations",
    grade: "GRADE 5 EQUATIONS — HANDWRITING STYLE",
    rows: ["1) x + 3 = 7, x = 4", "2. x × x = 4, x = 2", "3、 1 / 3 = 0.33"],
    variant: "handwriting",
  },
  {
    name: "grade6-fractions",
    grade: "GRADE 6 FRACTIONS",
    rows: ["1) 1/2 + 1/4 = 3/4", "2. 5/6 - 1/3 = 1/2", "3、 2/3 x 3/5 = 2/5"],
    variant: "typed",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1 });

for (const sample of samples) {
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; } body { margin: 0; background: #ece8df; color: #1b2638; font-family: Arial, sans-serif; }
    main { width: 920px; height: 1320px; margin: 40px; padding: 78px 82px; background: #fffef9; border: 4px solid #1b2638; }
    main.camera { transform: perspective(1400px) rotateY(-1.8deg) rotateZ(-.6deg); box-shadow: 24px 18px 34px rgb(27 38 56 / 22%); }
    .synthetic { color: #9b1c1c; font-size: 24px; font-weight: 700; letter-spacing: 1px; }
    h1 { margin: 52px 0 20px; font-size: 44px; } p { font-size: 26px; line-height: 1.5; }
    .rule { border-top: 3px solid #1b2638; margin: 32px 0; } ol { margin: 36px 0; padding: 0; list-style: none; }
    li { min-height: 145px; padding: 34px 16px; border-bottom: 2px solid #b7c0cc; font-family: "Courier New", monospace; font-size: 46px; font-weight: 700; }
    main.handwriting li { font-family: "Comic Sans MS", "Bradley Hand", cursive; font-style: italic; font-weight: 600; letter-spacing: 2px; }
    main.handwriting li:first-child { font-family: Arial, sans-serif; font-style: normal; font-weight: 700; letter-spacing: 0; }
    footer { margin-top: 160px; color: #526171; font-size: 20px; }
  </style></head><body><main class="${sample.variant}"><div class="synthetic">SYNTHETIC SAMPLE — NO PERSONAL DATA</div><h1>${sample.grade}</h1><p>Local OCR calibration worksheet.</p><div class="rule"></div><ol>${sample.rows.map((row) => `<li>${row}</li>`).join("")}</ol><footer>Created only for offline calibration. Contains no student, school, class, or identity information.</footer></main></body></html>`);
  await page.screenshot({
    path: fileURLToPath(new URL(`../../public/samples/${sample.name}.jpg`, import.meta.url)),
    type: "jpeg",
    quality: 92,
  });
}

await browser.close();
