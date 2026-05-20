# ARCHITECTURE.md — لنگرگاه سیستمی

---

## اسکیمای دیتابیس (Dexie.js / IndexedDB)

```ts
// src/db.ts
db.version(3).stores({
  projects : '++id, name, created_at',
  pages    : '++id, project_id, title',
  weights  : '++id, project_id, category_name',
  candidates: '++id, project_id, source_page_id',
  results  : '++id, project_id, source_page_id',
  analysisQueue: '++id, project_id',
  idfCache: '++id, project_id' // جدید: کش IDF برای هر پروژه
})
```

### جداول موجود (بدون تغییر ساختار)
- `projects` — پروژه‌ها
- `pages` — صفحات هر پروژه  
- `weights` — وزن تگ‌ها (پایه، قبل از IDF)
- `candidates` — لیست ۲۰ کاندیدای هر صفحه
- `results` — نتایج نهایی AI
- `analysisQueue` — صف پردازش AI

### جدول جدید `idfCache`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| idf_map | JSON string | `{ "tag_field": { "tag_value": idf_score } }` |
| computed_at | ISO string | زمان محاسبه |

**ساختار `idf_map`:**
```json
{
  "کشور_مقصد": {
    "ترکیه": 0.52,
    "امارات": 2.1,
    "آلمان": 3.8
  },
  "شهر_یا_جزیره_مقصد": {
    "آنتالیا": 1.2,
    "آلاچاتی": 4.3
  }
}
```

---

## الگوریتم امتیازدهی پیشرفته (Advanced Scoring)

### ۱. IDF (Inverse Document Frequency)

**مفهوم:** تگ‌هایی که در صفحات کمتری وجود دارند، ارزش بیشتری برای شناسایی شباهت دارند.

**فرمول:**
```
IDF(field, value) = log( totalPages / (pagesWithThisValue + 1) )
```

**پیاده‌سازی:**
1. هنگام `computeAndStoreCandidates`، ابتدا IDF را برای تمام مقادیر تگ محاسبه کن
2. IDF را در جدول `idfCache` ذخیره کن
3. در `computeScore`، به جای `weight[tag] * 1` از `weight[tag] * IDF(tag, value)` استفاده کن

**مثال:**
```
کشور: ترکیه در ۳۰۰ صفحه از ۴۰۰ → IDF = log(400/301) ≈ 0.28
شهر: کاپادوکیا در ۴ صفحه از ۴۰۰ → IDF = log(400/5) ≈ 4.38

امتیاز قبلی: weight(کشور)=4, weight(شهر)=5 → 4*1 + 5*1 = 9
امتیاز جدید: 4*0.28 + 5*4.38 = 1.12 + 21.9 = 23.02
```

---

### ۲. Partial Match برای تگ‌های زمانی

**مفهوم:** ماه‌ها و فصل‌های مجاور باید امتیاز جزئی بگیرند (نه صفر).

**نگاشت مجاورت ماه‌ها:**
```ts
const MONTH_NEIGHBORS: Record<string, string[]> = {
  'فروردین':   ['اسفند', 'اردیبهشت'],
  'اردیبهشت': ['فروردین', 'خرداد'],
  'خرداد':    ['اردیبهشت', 'تیر'],
  'تیر':      ['خرداد', 'مرداد'],
  'مرداد':    ['تیر', 'شهریور'],
  'شهریور':   ['مرداد', 'مهر'],
  'مهر':      ['شهریور', 'آبان'],
  'آبان':     ['مهر', 'آذر'],
  'آذر':      ['آبان', 'دی'],
  'دی':       ['آذر', 'بهمن'],
  'بهمن':     ['دی', 'اسفند'],
  'اسفند':    ['بهمن', 'فروردین']
};
```

**نگاشت مجاورت فصل‌ها:**
```ts
const SEASON_NEIGHBORS: Record<string, string[]> = {
  'بهار':     ['زمستان', 'تابستان'],
  'تابستان': ['بهار', 'پاییز'],
  'پاییز':    ['تابستان', 'زمستان'],
  'زمستان':  ['پاییز', 'بهار']
};
```

**امتیازدهی:**
| نوع تطابق | ضریب امتیاز |
|---|---|
| تطابق دقیق | `1.0` |
| ماه مجاور | `0.4` |
| فصل مجاور | `0.5` |
| بدون تطابق | `0.0` |

**فیلدهای زمانی:**
- `ماه_تقویمی_برگزاری` → از `MONTH_NEIGHBORS`
- `فصل_برگزاری` → از `SEASON_NEIGHBORS`

---

### ۳. Jaccard Bidirectional

**مفهوم:** تطابق باید از دید هر دو صفحه سنجیده شود، نه فقط صفحه منبع.

**مشکل قبلی:**
```
صفحه A: 5 تگ غیرnull
صفحه B: 15 تگ غیرnull
تطابق: 5 تگ

امتیاز قدیمی: 5/5 = 100% (از دید A)
اما از دید B: 5/15 = 33% (B خیلی جامع‌تر است)
```

**فرمول Jaccard:**
```
Jaccard = |intersection| / |union|
```

**یا میانگین دو دیدگاه:**
```
score = (matched/sourceTags + matched/candidateTags) / 2
```

**انتخاب:** از **Jaccard اصلی** استفاده می‌کنیم چون عادلانه‌تر است:
```ts
const intersection = matchedFields.length;
const union = nonNullSourceFields.length + nonNullCandidateFields.length - intersection;
const jaccardScore = intersection / union;
```

**ضریب نهایی:** `jaccardScore * 10` (برای مقیاس‌پذیری با امتیازات دیگر)

---

### ۴. Title Text Similarity

**مفهوم:** شباهت کلمات عنوان، سیگنال اضافی مفیدی است.

**فرمول (Jaccard روی کلمات):**
```ts
function titleSimilarity(titleA: string, titleB: string): number {
  const wordsA = new Set(normalizeTitle(titleA).split(/\s+/).filter(w => w.length > 1));
  const wordsB = new Set(normalizeTitle(titleB).split(/\s+/).filter(w => w.length > 1));
  
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  
  if (union === 0) return 0;
  return intersection / union; // 0 تا 1
}

function normalizeTitle(title: string): string {
  // حذف اعداد، علائم، و کلمات بی‌معنی
  return title
    .replace(/[۰-۹0-9]/g, '')
    .replace(/[،؛:!؟.\-_]/g, ' ')
    .trim();
}
```

**وزن:** `titleSimilarity * 1.5` (اضافه به امتیاز نهایی)

---

## فرمول امتیاز نهایی

```ts
function computeAdvancedScore(
  sourceCategories: CategoriesMap,
  candidateCategories: CategoriesMap,
  sourceTitle: string,
  candidateTitle: string,
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): { score: number; matchedTags: string[]; details: ScoreDetails } {
  
  let tagScore = 0;
  const matchedTags: string[] = [];
  
  // ۱. امتیاز تگ‌ها با IDF و Partial Match
  for (const field in sourceCategories) {
    const srcVal = sourceCategories[field];
    const candVal = candidateCategories[field];
    
    if (srcVal === null || candVal === null) continue;
    
    const baseWeight = mode === 'linear' ? 1 : (weights[field] ?? 1);
    const idfScore = idfMap[field]?.[srcVal] ?? 1;
    
    // تطابق دقیق
    if (srcVal === candVal) {
      tagScore += baseWeight * idfScore;
      matchedTags.push(field);
    }
    // Partial Match برای زمان
    else if (field === 'ماه_تقویمی_برگزاری' && isNeighborMonth(srcVal, candVal)) {
      tagScore += baseWeight * idfScore * 0.4;
      matchedTags.push(`${field}(مجاور)`);
    }
    else if (field === 'فصل_برگزاری' && isNeighborSeason(srcVal, candVal)) {
      tagScore += baseWeight * idfScore * 0.5;
      matchedTags.push(`${field}(مجاور)`);
    }
  }
  
  // ۲. Jaccard Bidirectional
  const sourceNonNull = Object.values(sourceCategories).filter(v => v !== null).length;
  const candNonNull = Object.values(candidateCategories).filter(v => v !== null).length;
  const exactMatches = matchedTags.filter(t => !t.includes('مجاور')).length;
  
  const union = sourceNonNull + candNonNull - exactMatches;
  const jaccardScore = union > 0 ? (exactMatches / union) * 10 : 0;
  
  // ۳. Title Similarity
  const titleScore = titleSimilarity(sourceTitle, candidateTitle) * 1.5;
  
  // ۴. امتیاز نهایی
  const finalScore = tagScore + jaccardScore + titleScore;
  
  return {
    score: Math.round(finalScore * 100) / 100,
    matchedTags,
    details: { tagScore, jaccardScore, titleScore }
  };
}
```

---

## جریان داده جدید

```
CSV آپلود
    │
    ▼
Dexie: pages.bulkAdd()
    │
    ▼
Config Screen: weights تعیین شود
    │
    ▼
┌─────────────────────────────────────────────────┐
│        محاسبه IDF (یکبار برای کل پروژه)        │
│  برای هر فیلد تگ:                               │
│    برای هر مقدار منحصر:                         │
│      IDF = log(totalPages / countPages + 1)     │
│  ذخیره در idfCache                              │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│      محاسبه امتیاز پیشرفته برای هر جفت صفحه    │
│  1. IDF-weighted tag matching                   │
│  2. Partial match برای ماه/فصل                  │
│  3. Jaccard bidirectional                       │
│  4. Title similarity                            │
└─────────────────────────────────────────────────┘
    │
    ▼
Dexie: candidates.bulkAdd()
    │
    ▼
[ادامه فلو همانند قبل]
```

---

## مسیرهای روتینگ (بدون تغییر)

| مسیر | کامپوننت | توضیح |
|---|---|---|
| `/` | `Home.tsx` | لیست پروژه‌ها |
| `/new` | `NewProject.tsx` | آپلود CSV |
| `/config/:projectId` | `Config.tsx` | تنظیمات امتیازدهی |
| `/project/:projectId` | `ProjectPages.tsx` | لیست صفحات پروژه + دکمه تحلیل کلی |
| `/project/:projectId/page/:pageId` | `PageDetail.tsx` | جزئیات یک صفحه + ویرایش دستی |
| `/results/:projectId` | `Results.tsx` | خروجی نهایی + export |

---

## فایل‌های تغییر یافته

```
src/
├── db.ts                         ← [ویرایش] اضافه کردن جدول idfCache + نسخه ۳
│
├── constants/
│   └── timeNeighbors.ts          ← [جدید] نگاشت مجاورت ماه‌ها و فصل‌ها
│
├── utils/
│   ├── scorer.ts                 ← [ویرایش کامل] الگوریتم پیشرفته امتیازدهی
│   ├── idfCalculator.ts          ← [جدید] محاسبه و کش IDF
│   ├── titleSimilarity.ts        ← [جدید] شباهت متنی عنوان
│   └── candidateStorage.ts       ← [ویرایش] استفاده از الگوریتم جدید
```

---

## نکات امنیتی (بدون تغییر)

- کلید Gemini API **فقط** در `localStorage` با کلید `LINKMESH_API_KEY` ذخیره می‌شود
- هیچ‌گاه API Key به Dexie یا state برنامه نوشته نمی‌شود
- هنگام export، API Key در CSV وارد نمی‌شود
