# 安亲班功课检查 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个完全免费、无需登录、同时适用于 Android 与 iPhone 的 PWA，把一至三年级全科活动本答案 PDF 与一至六年级数学拍照圈错整合在同一个网站。

**Architecture:** 在 `homework-checker/` 建立 React + TypeScript 静态 PWA。答案资料库读取版本化 JSON 清单和站内 PDF；数学检查器在浏览器中通过 Web Worker 执行图像预处理与 Tesseract.js OCR，再由确定性数学解析器检查答案，最后用 Canvas 覆盖层把结果画回原图。站点不含登录、数据库、照片上传或远程推理 API。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、Playwright、vite-plugin-pwa、Tesseract.js、decimal.js、fraction.js、Canvas API、Web Worker

## Global Constraints

- 不收取订阅费或按次扫描费用。
- 不依赖 Mac、电脑或其他本地主机。
- 不要求老师注册或登录。
- Android 与 iPhone 使用同一个 HTTPS 链接。
- 学生照片不得上传服务器或写入日志。
- 一至三年级全科活动本答案与数学拍照检查位于同一个网站。
- OCR、数学检查与圈错全部在当前手机浏览器执行。
- 红框只用于高信心且可唯一计算的错误；其余疑点使用橙框。
- 第一版应用题只检查学生已经写出的算式、结果和单位。
- 每个模块保持单一职责；禁止使用 `eval` 或执行 OCR 产生的任意代码。

---

## Planned File Map

```text
homework-checker/
├── index.html                         # Vite HTML 入口
├── package.json                       # 构建、测试与 PWA 依赖
├── vite.config.ts                     # React、Vitest 与 PWA 配置
├── playwright.config.ts               # iPhone Safari 等效与 Android Chrome 浏览器测试
├── public/
│   ├── pdf/                           # 12 份活动本答案 PDF
│   ├── ocr/                           # eng、msa、chi_tra traineddata.gz
│   ├── icons/                         # PWA 图标
│   └── samples/                       # 去识别化测试照片
├── src/
│   ├── app/App.tsx                    # 首页与两个主要入口
│   ├── app/routes.ts                  # 站内轻量路由类型与路径
│   ├── answer-library/catalog.ts      # 答案资料清单与查询接口
│   ├── answer-library/AnswerLibrary.tsx
│   ├── answer-library/AnswerCard.tsx
│   ├── scanner/MathScanner.tsx        # 拍照、进度与结果流程
│   ├── scanner/imagePipeline.ts       # 缩放、方向、对比度、坐标映射
│   ├── scanner/ocr.types.ts           # OCR Worker 消息与结果类型
│   ├── scanner/ocr.worker.ts          # 浏览器内 Tesseract OCR
│   ├── scanner/questionSegmenter.ts   # OCR 行分题和空间分组
│   ├── math/tokenize.ts               # 安全数学词法分析
│   ├── math/parser.ts                 # 受控表达式解析
│   ├── math/checkers.ts               # 数值、分数、小数、单位检查器
│   ├── math/analyzeQuestions.ts       # 分题结果到批改标注
│   ├── annotation/AnnotationCanvas.tsx
│   ├── annotation/annotationModel.ts  # 标注状态、撤销与局部重算
│   ├── privacy/sessionAssets.ts        # Object URL 和 Canvas 释放
│   ├── styles/tokens.css
│   ├── styles/app.css
│   └── main.tsx
├── tests/
│   ├── catalog.test.ts
│   ├── imagePipeline.test.ts
│   ├── questionSegmenter.test.ts
│   ├── parser.test.ts
│   ├── checkers.test.ts
│   ├── analyzeQuestions.test.ts
│   ├── annotationModel.test.ts
│   └── app.test.tsx
└── e2e/
    ├── answer-library.spec.ts
    ├── scanner.spec.ts
    └── offline.spec.ts
```

---

### Task 1: 建立 PWA 外壳与答案资料库

**Files:**
- Create: `homework-checker/package.json`
- Create: `homework-checker/vite.config.ts`
- Create: `homework-checker/index.html`
- Create: `homework-checker/src/main.tsx`
- Create: `homework-checker/src/app/App.tsx`
- Create: `homework-checker/src/app/routes.ts`
- Create: `homework-checker/src/answer-library/catalog.ts`
- Create: `homework-checker/src/answer-library/AnswerLibrary.tsx`
- Create: `homework-checker/src/answer-library/AnswerCard.tsx`
- Create: `homework-checker/src/styles/tokens.css`
- Create: `homework-checker/src/styles/app.css`
- Copy: `output/pdf/*.pdf` to `homework-checker/public/pdf/`
- Test: `homework-checker/tests/catalog.test.ts`
- Test: `homework-checker/tests/app.test.tsx`

**Interfaces:**
- Produces: `type Grade = 1 | 2 | 3`
- Produces: `type Subject = "华文" | "国语" | "数学" | "科学"`
- Produces: `type AnswerResource = { id: string; grade: Grade; subject: Subject; pdfPath: string; videos: VideoLink[] }`
- Produces: `getResources(filters: { grade?: Grade; subject?: Subject }): AnswerResource[]`
- Produces: routes `"/" | "/answers" | "/scan"`

- [ ] **Step 1: 写答案资料清单失败测试**

```ts
import { describe, expect, it } from "vitest";
import { ANSWER_RESOURCES, getResources } from "../src/answer-library/catalog";

describe("answer catalog", () => {
  it("contains exactly 12 grade-subject PDFs", () => {
    expect(ANSWER_RESOURCES).toHaveLength(12);
    expect(new Set(ANSWER_RESOURCES.map((item) => item.pdfPath)).size).toBe(12);
  });

  it("filters grade 2 mathematics to one resource", () => {
    expect(getResources({ grade: 2, subject: "数学" })).toMatchObject([
      { grade: 2, subject: "数学" },
    ]);
  });
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `cd homework-checker && npm test -- tests/catalog.test.ts`

Expected: FAIL，提示无法解析 `answer-library/catalog`。

- [ ] **Step 3: 建立项目并实现资料清单**

建立 Vite React TypeScript 项目，配置 `npm run dev`、`npm run build`、`npm test` 和 `npm run test:e2e`。在 `catalog.ts` 明确列出 12 份现有 PDF 与先前核实的 YouTube 影片 ID，不从网页运行时抓取 YouTube。

```ts
export type Grade = 1 | 2 | 3;
export type Subject = "华文" | "国语" | "数学" | "科学";
export type VideoLink = { label: string; duration: string; videoId: string };
export type AnswerResource = {
  id: string;
  grade: Grade;
  subject: Subject;
  pdfPath: string;
  videos: VideoLink[];
};

export const getResources = (filters: {
  grade?: Grade;
  subject?: Subject;
}) =>
  ANSWER_RESOURCES.filter(
    (item) =>
      (filters.grade === undefined || item.grade === filters.grade) &&
      (filters.subject === undefined || item.subject === filters.subject),
  );
```

- [ ] **Step 4: 实现首页和答案筛选界面**

首页显示 `快速查答案` 和 `拍照检查数学` 两个大按钮。`AnswerLibrary` 提供年级与科目筛选；每张卡显示 `打开 PDF`、`下载 PDF` 和答案影片按钮。所有按钮具备可读的 `aria-label`，触控高度不少于 44px。

- [ ] **Step 5: 加入页面行为测试**

```tsx
it("opens grade 1 mathematics from the answer library", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: "快速查答案" }));
  await userEvent.click(screen.getByRole("button", { name: "一年级" }));
  await userEvent.click(screen.getByRole("button", { name: "数学" }));
  expect(screen.getByRole("link", { name: "打开一年级数学 PDF" }))
    .toHaveAttribute("href", "/pdf/1年级_数学_活动本答案影片索引.pdf");
});
```

- [ ] **Step 6: 运行单元测试和构建**

Run: `cd homework-checker && npm test && npm run build`

Expected: 所有测试通过，`dist/pdf/` 包含 12 份 PDF。

- [ ] **Step 7: 提交**

```bash
git add homework-checker
git commit -m "feat: add mobile answer library pwa"
```

---

### Task 2: 图像导入、预处理与隐私会话

**Files:**
- Create: `homework-checker/src/scanner/MathScanner.tsx`
- Create: `homework-checker/src/scanner/imagePipeline.ts`
- Create: `homework-checker/src/privacy/sessionAssets.ts`
- Test: `homework-checker/tests/imagePipeline.test.ts`

**Interfaces:**
- Consumes: route `"/scan"`
- Produces: `type Point = { x: number; y: number }`
- Produces: `type Rect = { x: number; y: number; width: number; height: number }`
- Produces: `type PreparedImage = { bitmap: ImageBitmap; width: number; height: number; toOriginal: (rect: Rect) => Rect }`
- Produces: `prepareImage(file: File, maxSide?: number): Promise<PreparedImage>`
- Produces: `createSessionAsset(file: File): { url: string; release(): void }`

- [ ] **Step 1: 写坐标与缩放失败测试**

```ts
it("maps OCR coordinates back to the original image", async () => {
  const prepared = await prepareImage(testImageFile(2400, 3200), 1600);
  expect(prepared.width).toBe(1200);
  expect(prepared.height).toBe(1600);
  expect(prepared.toOriginal({ x: 60, y: 80, width: 120, height: 40 }))
    .toEqual({ x: 120, y: 160, width: 240, height: 80 });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd homework-checker && npm test -- tests/imagePipeline.test.ts`

Expected: FAIL，提示 `prepareImage` 不存在。

- [ ] **Step 3: 实现图像预处理**

使用 `createImageBitmap` 读取照片；根据 EXIF/浏览器方向结果取得正确朝向；长边限制为 1600px；Canvas 应用灰阶、局部对比度和轻度锐化。第一版不自动猜测不可靠的纸张四角；保留可扩展的透视接口，并在 UI 提供重新拍摄。

- [ ] **Step 4: 实现会话资源释放**

`createSessionAsset` 必须集中管理 `URL.createObjectURL` 与 `URL.revokeObjectURL`。`MathScanner` 在更换照片、清除任务和卸载时调用 `release()`，不把图片写入 localStorage、IndexedDB 或网络请求。

- [ ] **Step 5: 实现拍照与相册入口**

使用一个 `accept="image/*"`、`capture="environment"` 的拍照输入和一个不含 `capture` 的相册输入。选择文件后显示预览、`重新拍摄`、`开始检查` 与“照片只在此手机处理”说明。

- [ ] **Step 6: 运行测试与构建**

Run: `cd homework-checker && npm test -- tests/imagePipeline.test.ts && npm run build`

Expected: PASS，构建无 TypeScript 错误。

- [ ] **Step 7: 提交**

```bash
git add homework-checker/src/scanner homework-checker/src/privacy homework-checker/tests/imagePipeline.test.ts
git commit -m "feat: add private on-device image preparation"
```

---

### Task 3: 浏览器 OCR Worker 与自动分题

**Files:**
- Create: `homework-checker/src/scanner/ocr.types.ts`
- Create: `homework-checker/src/scanner/ocr.worker.ts`
- Create: `homework-checker/src/scanner/questionSegmenter.ts`
- Add: `homework-checker/public/ocr/eng.traineddata.gz`
- Add: `homework-checker/public/ocr/msa.traineddata.gz`
- Add: `homework-checker/public/ocr/chi_tra.traineddata.gz`
- Test: `homework-checker/tests/questionSegmenter.test.ts`

**Interfaces:**
- Consumes: `PreparedImage`
- Produces: `type OcrLine = { text: string; confidence: number; box: Rect }`
- Produces: Worker requests `{ type: "recognize"; image: ImageData; languages: string[] }`
- Produces: Worker events `{ type: "progress"; stage: string; progress: number } | { type: "result"; lines: OcrLine[] } | { type: "error"; message: string }`
- Produces: `type QuestionRegion = { id: string; lines: OcrLine[]; box: Rect; confidence: number }`
- Produces: `segmentQuestions(lines: OcrLine[]): QuestionRegion[]`

- [ ] **Step 1: 写分题失败测试**

```ts
it("groups a numbered question and its answer line", () => {
  const lines = [
    line("1. 47 + 28 =", 0, 0, 240, 40),
    line("65", 250, 0, 70, 40),
    line("2. 90 - 36 =", 0, 80, 240, 40),
    line("54", 250, 80, 70, 40),
  ];
  expect(segmentQuestions(lines).map((q) => q.lines.map((l) => l.text))).toEqual([
    ["1. 47 + 28 =", "65"],
    ["2. 90 - 36 =", "54"],
  ]);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd homework-checker && npm test -- tests/questionSegmenter.test.ts`

Expected: FAIL，提示 `segmentQuestions` 不存在。

- [ ] **Step 3: 实现 OCR Worker**

在 Worker 内初始化一次 Tesseract worker，`langPath` 指向 `/ocr`，使用 `eng+msa+chi_tra`。把 Tesseract 输出立即投影为 `OcrLine[]`，不返回内部大对象。进度事件按 `读取模型`、`识别文字` 两阶段映射到 0–1。

- [ ] **Step 4: 实现自动分题**

先按 `box.y` 聚类成视觉行，再用题号模式 `/^\s*(\d{1,3})[.)、]\s*/` 开始新题；同一视觉行且水平距离小于平均字高的 8 倍时合并。没有题号时按垂直间距大于中位字高 1.8 倍分组。

- [ ] **Step 5: 处理 OCR 失败与手动单题框选**

Worker 错误转换为用户可读状态。若 `segmentQuestions` 返回空数组，`MathScanner` 进入单题框选模式：老师在图上拖出一个矩形，系统只对该区域重跑 OCR。

- [ ] **Step 6: 运行测试与构建**

Run: `cd homework-checker && npm test -- tests/questionSegmenter.test.ts && npm run build`

Expected: PASS，Worker 作为独立 chunk 生成。

- [ ] **Step 7: 提交**

```bash
git add homework-checker/src/scanner homework-checker/public/ocr homework-checker/tests/questionSegmenter.test.ts
git commit -m "feat: add offline ocr and question segmentation"
```

---

### Task 4: 安全数学解析与确定性检查器

**Files:**
- Create: `homework-checker/src/math/tokenize.ts`
- Create: `homework-checker/src/math/parser.ts`
- Create: `homework-checker/src/math/checkers.ts`
- Test: `homework-checker/tests/parser.test.ts`
- Test: `homework-checker/tests/checkers.test.ts`

**Interfaces:**
- Consumes: normalized OCR text
- Produces: `type ParsedEquation = { expression: ExprNode; studentAnswer: NumericValue; unit?: UnitCode }`
- Produces: `type NumericValue = { kind: "decimal"; value: Decimal } | { kind: "fraction"; value: Fraction }`
- Produces: `parseEquation(text: string): Result<ParsedEquation, ParseError>`
- Produces: `checkEquation(parsed: ParsedEquation): CheckResult`
- Produces: `type CheckResult = { status: "correct" | "incorrect" | "uncertain"; expected?: string; reason: string; confidence: number }`

- [ ] **Step 1: 写解析器失败测试**

```ts
it.each([
  ["47 + 28 = 65", "75"],
  ["3/4 + 1/8 = 7/8", "7/8"],
  ["RM 12.50 - RM 3.20 = RM 9.30", "RM 9.30"],
])("parses and computes %s", (input, expected) => {
  const parsed = unwrap(parseEquation(input));
  expect(checkEquation(parsed).expected).toBe(expected);
});

it("rejects executable text", () => {
  expect(parseEquation("alert(1)")).toMatchObject({ ok: false });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd homework-checker && npm test -- tests/parser.test.ts tests/checkers.test.ts`

Expected: FAIL，提示数学模块不存在。

- [ ] **Step 3: 实现允许列表 tokenizer**

只接受数字、`.`、`,`、`+ - × x * ÷ / ( ) =`、分数斜线与已知单位。标准化 Unicode 数学符号和 OCR 常见混淆，例如独立运算符位置的 `x` → `×`；不得把任意字母串转换为运算符。

- [ ] **Step 4: 实现递归下降 parser**

文法固定为：

```text
equation   := expression "=" value unit?
expression := term (("+" | "-") term)*
term       := factor (("*" | "/") factor)*
factor     := ("+" | "-") factor | value | "(" expression ")"
value      := integer | decimal | fraction
```

解析失败返回结构化 `ParseError`，不抛出含学生原文的遥测日志。

- [ ] **Step 5: 实现精确计算和单位白名单**

整数与有限小数使用 `decimal.js`；分数使用 `fraction.js`。单位白名单包含 `mm/cm/m/km`、`g/kg`、`ml/l`、`sen/RM`、`s/min/h/day`。只有单位维度相同才可换算；未知单位返回 `uncertain`。

- [ ] **Step 6: 加入一至六年级代表性测试**

至少覆盖进位、借位、乘除、混合运算、分数约分、小数位、百分比、货币、时间进位、长度换算、周长和面积公式结果。每类包含正确、错误和无法判断样本。

- [ ] **Step 7: 运行测试**

Run: `cd homework-checker && npm test -- tests/parser.test.ts tests/checkers.test.ts`

Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add homework-checker/src/math homework-checker/tests/parser.test.ts homework-checker/tests/checkers.test.ts
git commit -m "feat: add deterministic primary math checker"
```

---

### Task 5: 分析编排、信心门槛与局部重算

**Files:**
- Create: `homework-checker/src/math/analyzeQuestions.ts`
- Create: `homework-checker/src/annotation/annotationModel.ts`
- Test: `homework-checker/tests/analyzeQuestions.test.ts`
- Test: `homework-checker/tests/annotationModel.test.ts`

**Interfaces:**
- Consumes: `QuestionRegion[]`, `parseEquation`, `checkEquation`
- Produces: `type Annotation = { id: string; questionId: string; box: Rect; severity: "error" | "review" | "pass"; recognized: string; expected?: string; reason: string; confidence: number; dismissed: boolean }`
- Produces: `analyzeQuestions(regions: QuestionRegion[]): Annotation[]`
- Produces: `updateRecognizedText(state: AnnotationState, id: string, text: string): AnnotationState`
- Produces: `dismissAnnotation(state: AnnotationState, id: string): AnnotationState`

- [ ] **Step 1: 写红框门槛失败测试**

```ts
it("uses red only when OCR, parsing and math are all confident", () => {
  expect(analyzeQuestions([region("47 + 28 = 65", 0.96)])[0].severity).toBe("error");
  expect(analyzeQuestions([region("47 + 28 = 65", 0.61)])[0].severity).toBe("review");
});

it("does not guess an application problem without a student equation", () => {
  expect(analyzeQuestions([region("小明有 47 粒糖，又买 28 粒。", 0.95)])[0])
    .toMatchObject({ severity: "review", expected: undefined });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd homework-checker && npm test -- tests/analyzeQuestions.test.ts`

Expected: FAIL，提示 `analyzeQuestions` 不存在。

- [ ] **Step 3: 实现信心规则**

`error` 必须满足 OCR ≥ 0.85、区域信心 ≥ 0.80、解析成功、结果唯一且答案不同。解析失败、未知单位、缺少等号或 OCR < 0.85 均为 `review`。正确且 OCR ≥ 0.85 为 `pass`。

- [ ] **Step 4: 实现老师修正与局部重算**

`updateRecognizedText` 只重新解析指定标注。保留 `originalRecognized`，允许恢复。`dismissAnnotation` 只改变 `dismissed`，不得删除审计所需的当前会话信息。

- [ ] **Step 5: 运行全部数学与状态测试**

Run: `cd homework-checker && npm test -- tests/analyzeQuestions.test.ts tests/annotationModel.test.ts tests/parser.test.ts tests/checkers.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add homework-checker/src/math/analyzeQuestions.ts homework-checker/src/annotation homework-checker/tests
git commit -m "feat: add confidence-aware homework analysis"
```

---

### Task 6: 圈错 Canvas 与完整扫描体验

**Files:**
- Create: `homework-checker/src/annotation/AnnotationCanvas.tsx`
- Modify: `homework-checker/src/scanner/MathScanner.tsx`
- Modify: `homework-checker/src/styles/app.css`
- Test: `homework-checker/tests/app.test.tsx`
- Test: `homework-checker/e2e/scanner.spec.ts`

**Interfaces:**
- Consumes: `PreparedImage`, `Annotation[]`
- Produces: `AnnotationCanvas({ imageUrl, width, height, annotations, onSelect })`
- Produces: `exportAnnotatedImage(image: CanvasImageSource, annotations: Annotation[]): Promise<Blob>`

- [ ] **Step 1: 写扫描流程失败测试**

```tsx
it("shows analysis stages and an editable result", async () => {
  render(<MathScanner workerFactory={() => fakeOcrWorker("47 + 28 = 65")} />);
  await selectImage(screen.getByLabelText("从相册选择"), "math-page.jpg");
  await userEvent.click(screen.getByRole("button", { name: "开始检查" }));
  expect(await screen.findByText("发现 1 个确定错误")).toBeVisible();
  expect(screen.getByRole("button", { name: "查看第 1 题错误" })).toBeVisible();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd homework-checker && npm test -- tests/app.test.tsx`

Expected: FAIL，结果界面尚未实现。

- [ ] **Step 3: 实现响应式标注 Canvas**

以原图自然尺寸作为 Canvas 坐标系，CSS 只负责缩放显示。红框使用 `#D92D20`，橙框使用 `#F79009`，绿色使用低对比 `#12B76A`。每个框在 DOM 中有对应可聚焦按钮，不能只依赖颜色。

- [ ] **Step 4: 实现结果详情和编辑**

底部抽屉显示识别内容、原因、建议答案、`系统读错了`、`取消标记` 和 `恢复`。数字修正提交后调用 `updateRecognizedText` 并刷新单题框。

- [ ] **Step 5: 实现批改图导出**

使用离屏 Canvas 按原始照片分辨率绘制当前未取消的标注。导出 JPEG 品质 0.92；文件名 `数学批改-YYYYMMDD-HHmm.jpg`。导出只由老师点击触发。

- [ ] **Step 6: 加入 E2E 流程**

`scanner.spec.ts` 使用固定去识别化样本，验证上传、阶段进度、红／橙标记、修改 OCR 文字、取消标记和下载事件。不要把 OCR 模型性能作为 E2E 断言；在浏览器测试中注入固定 Worker 结果。

- [ ] **Step 7: 运行测试与构建**

Run: `cd homework-checker && npm test && npm run build`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add homework-checker/src homework-checker/tests homework-checker/e2e/scanner.spec.ts
git commit -m "feat: add photo annotation and correction workflow"
```

---

### Task 7: 离线缓存、安装体验与答案资料 E2E

**Files:**
- Modify: `homework-checker/vite.config.ts`
- Create: `homework-checker/public/manifest.webmanifest`
- Add: `homework-checker/public/icons/icon-192.png`
- Add: `homework-checker/public/icons/icon-512.png`
- Create: `homework-checker/playwright.config.ts`
- Create: `homework-checker/e2e/answer-library.spec.ts`
- Create: `homework-checker/e2e/offline.spec.ts`

**Interfaces:**
- Consumes: built `dist/`
- Produces: installable PWA with cached app shell, OCR models and 12 PDFs

- [ ] **Step 1: 写答案资料浏览器测试**

```ts
test("opens a grade 3 science PDF in three choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "快速查答案" }).click();
  await page.getByRole("button", { name: "三年级" }).click();
  await page.getByRole("button", { name: "科学" }).click();
  await expect(page.getByRole("link", { name: "打开三年级科学 PDF" }))
    .toHaveAttribute("href", "/pdf/3年级_科学_活动本答案影片索引.pdf");
});
```

- [ ] **Step 2: 配置 PWA 缓存**

使用 `vite-plugin-pwa` 的 `injectManifest` 策略。预缓存应用外壳和 PDF；OCR traineddata 使用 CacheFirst，缓存名称带应用版本。不得缓存学生上传的 `blob:` URL。

- [ ] **Step 3: 实现离线测试**

首次在线访问并等待 Service Worker 就绪，切换离线后重新打开首页和一份已缓存 PDF。断言答案资料库可用；YouTube 按钮显示“影片需要联网”。

- [ ] **Step 4: 配置手机浏览器项目**

Playwright 至少包含：

- `webkit`，视口 390×844，模拟 iPhone Safari
- `chromium`，视口 412×915，模拟 Android Chrome

- [ ] **Step 5: 运行完整验证**

Run: `cd homework-checker && npm test && npm run build && npm run test:e2e`

Expected: 单元测试、生产构建及两个手机浏览器项目全部通过。

- [ ] **Step 6: 提交**

```bash
git add homework-checker
git commit -m "feat: make homework checker installable offline"
```

---

### Task 8: 真实样本校准、隐私审计与发布准备

**Files:**
- Add: `homework-checker/public/samples/grade1-addition.jpg`
- Add: `homework-checker/public/samples/grade3-units.jpg`
- Add: `homework-checker/public/samples/grade6-fractions.jpg`
- Create: `homework-checker/tests/fixtures/expected-annotations.json`
- Create: `homework-checker/README.md`
- Modify: `homework-checker/src/math/analyzeQuestions.ts`
- Modify: `homework-checker/src/scanner/questionSegmenter.ts`

**Interfaces:**
- Consumes: three consented or synthetic de-identified calibration images
- Produces: documented launch thresholds and reproducible local validation

- [ ] **Step 1: 建立去识别化校准集**

只使用合成或明确获准且已经移除姓名、班级和学校资料的照片。`expected-annotations.json` 为每个样本列出题目框、期望严重程度和允许的坐标误差。

- [ ] **Step 2: 运行真实 OCR 校准**

对三张样本执行实际 Worker，记录：

- OCR 关键字符正确率
- 题目分割成功率
- 红框误判数
- 橙框数量
- 单页处理时间

第一版发布门槛：测试集中红框不得误判正确答案；无法满足时提高红框信心阈值，宁可转为橙框。

- [ ] **Step 3: 执行隐私网络审计**

在浏览器开发工具或 Playwright request 监听中上传样本，断言网络请求只包含站点静态资源、OCR 模型和用户主动点击的 YouTube 导航；不得出现图片二进制、base64、blob 内容或 OCR 文字。

- [ ] **Step 4: 完成 README**

说明：

- 本地开发与构建
- OCR 模型来源和许可证
- 12 份 PDF 的来源性质
- 支持与不支持题型
- 照片只在设备处理
- Android/iPhone 添加到主画面的步骤
- 如何添加新年级或科目

- [ ] **Step 5: 最终验证**

Run: `cd homework-checker && npm test && npm run build && npm run test:e2e`

Expected: 全部 PASS；`dist/` 包含 PWA、12 份 PDF、OCR 模型和图标。

- [ ] **Step 6: 提交**

```bash
git add homework-checker
git commit -m "test: calibrate and document homework checker"
```

