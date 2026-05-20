# tasks.md — نقشه راه ارتقای الگوریتم امتیازدهی

> **هدف:** پیشرفته‌سازی الگوریتم داخلی با افزودن IDF، Partial Match زمانی، Jaccard دوطرفه، و شباهت عنوان.
> 
> ترتیب تسک‌ها اجباری است. هر تسک روی خروجی تسک قبلی تکیه دارد.
> قبل از شروع هر تسک، فایل‌های CONTEXT_FILES را بخوان.

---

## تسک ۱ — ساخت Constants مجاورت زمانی

### هدف
ایجاد یک فایل ثابت که نگاشت مجاورت ماه‌ها و فصل‌های شمسی را تعریف کند.

### راهنمای پیاده‌سازی فنی

1. **`src/constants/timeNeighbors.ts`** (فایل جدید) بساز با این محتوا:

```ts
// نگاشت ماه‌های شمسی و همسایه‌هایشان
export const MONTH_NEIGHBORS: Record<string, string[]> = {
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

// نگاشت فصل‌ها و همسایه‌هایشان
export const SEASON_NEIGHBORS: Record<string, string[]> = {
  'بهار':     ['زمستان', 'تابستان'],
  'تابستان': ['بهار', 'پاییز'],
  'پاییز':    ['تابستان', 'زمستان'],
  'زمستان':  ['پاییز', 'بهار']
};

// تابع کمکی: آیا دو ماه همسایه هستند؟
export function isNeighborMonth(monthA: string, monthB: string): boolean {
  const neighbors = MONTH_NEIGHBORS[monthA];
  return neighbors ? neighbors.includes(monthB) : false;
}

// تابع کمکی: آیا دو فصل همسایه هستند؟
export function isNeighborSeason(seasonA: string, seasonB: string): boolean {
  const neighbors = SEASON_NEIGHBORS[seasonA];
  return neighbors ? neighbors.includes(seasonB) : false;
}

// ضرایب امتیازدهی Partial Match
export const PARTIAL_MATCH_COEFFICIENTS = {
  EXACT: 1.0,          // تطابق دقیق
  NEIGHBOR_MONTH: 0.4, // ماه مجاور
  NEIGHBOR_SEASON: 0.5 // فصل مجاور
};
```

### محدودیت‌های این تسک
- ✅ فقط constants و توابع pure — هیچ side effect ندارد
- ✅ توابع helper باید null-safe باشند
- ⛔ هیچ فایل دیگری تغییر نکند
- ⛔ هیچ import از فایل‌های پروژه نباشد

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md"]`

---

## تسک ۲ — ساخت ماژول Title Similarity

### هدف
ایجاد یک ماژول برای محاسبه شباهت متنی بین دو عنوان با استفاده از Jaccard روی کلمات.

### راهنمای پیاده‌سازی فنی

1. **`src/utils/titleSimilarity.ts`** (فایل جدید) بساز:

```ts
// کلمات بی‌معنی که از مقایسه حذف می‌شوند
const STOP_WORDS = new Set([
  'تور', 'به', 'از', 'در', 'با', 'و', 'یا', 'که', 'را', 'این', 'آن', 'برای'
]);

// نرمال‌سازی عنوان
function normalizeTitle(title: string): string {
  return title
    // حذف اعداد فارسی و انگلیسی
    .replace(/[۰-۹0-9]/g, '')
    // حذف علائم نگارشی
    .replace(/[،؛:!؟.\-_«»()]/g, ' ')
    // حذف فاصله‌های اضافی
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// استخراج کلمات معنادار
function extractWords(title: string): Set<string> {
  const normalized = normalizeTitle(title);
  const words = normalized.split(' ').filter(w => 
    w.length > 1 && !STOP_WORDS.has(w)
  );
  return new Set(words);
}

// محاسبه شباهت Jaccard بین دو عنوان
export function titleSimilarity(titleA: string, titleB: string): number {
  const wordsA = extractWords(titleA);
  const wordsB = extractWords(titleB);
  
  // اگر یکی از دو مجموعه خالی بود
  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }
  
  // محاسبه اشتراک
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  
  // محاسبه اجتماع
  const union = new Set([...wordsA, ...wordsB]).size;
  
  // Jaccard
  return union > 0 ? intersection / union : 0;
}

// وزن ثابت برای اضافه شدن به امتیاز نهایی
export const TITLE_SIMILARITY_WEIGHT = 1.5;
```

**چرا این کد؟**
- `STOP_WORDS`: کلماتی مثل «تور» که در همه عناوین هست و تفاوت‌ساز نیست
- `normalizeTitle`: برای یکسان‌سازی قبل از مقایسه
- `extractWords`: تبدیل عنوان به مجموعه کلمات معنادار
- `titleSimilarity`: فرمول Jaccard خالص
- `TITLE_SIMILARITY_WEIGHT`: برای تنظیم تأثیر در امتیاز نهایی

### محدودیت‌های این تسک
- ✅ تابع باید pure باشد (بدون side effect)
- ✅ خروجی عددی بین ۰ و ۱ باشد
- ⛔ از هیچ کتابخانه خارجی استفاده نشود
- ⛔ هیچ فایل دیگری تغییر نکند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md"]`

---

## تسک ۳ — ساخت ماژول محاسبه IDF

### هدف
ایجاد ماژولی که IDF را برای تمام مقادیر تگ در یک پروژه محاسبه کند.

### چرا IDF؟
اگر ۳۰۰ صفحه تگ «کشور: ترکیه» داشته باشند و فقط ۲ صفحه تگ «شهر: آلاچاتی» داشته باشند، تطابق روی آلاچاتی باید امتیاز بیشتری بگیرد چون نادرتر است.

### راهنمای پیاده‌سازی فنی

1. **`src/utils/idfCalculator.ts`** (فایل جدید) بساز:

```ts
import { type Page } from '../db';

// ساختار خروجی IDF: هر فیلد → هر مقدار → امتیاز IDF
export type IDFMap = Record<string, Record<string, number>>;

// محاسبه IDF برای تمام صفحات یک پروژه
export function computeIDFMap(pages: Page[]): IDFMap {
  const totalPages = pages.length;
  
  // شمارش تعداد صفحات برای هر مقدار هر فیلد
  // ساختار: { field: { value: count } }
  const valueCounts: Record<string, Record<string, number>> = {};
  
  // مرحله ۱: شمارش
  for (const page of pages) {
    const categories = JSON.parse(page.categories) as Record<string, string | null>;
    
    for (const [field, value] of Object.entries(categories)) {
      if (value === null) continue;
      
      if (!valueCounts[field]) {
        valueCounts[field] = {};
      }
      
      if (!valueCounts[field][value]) {
        valueCounts[field][value] = 0;
      }
      
      valueCounts[field][value]++;
    }
  }
  
  // مرحله ۲: محاسبه IDF
  const idfMap: IDFMap = {};
  
  for (const [field, values] of Object.entries(valueCounts)) {
    idfMap[field] = {};
    
    for (const [value, count] of Object.entries(values)) {
      // فرمول IDF با smoothing برای جلوگیری از صفر شدن
      // IDF = log(totalPages / (count + 1))
      // +1 در مخرج برای جلوگیری از division by zero
      idfMap[field][value] = Math.log(totalPages / (count + 1));
    }
  }
  
  return idfMap;
}

// گرفتن IDF یک مقدار خاص (با fallback به ۱)
export function getIDF(idfMap: IDFMap, field: string, value: string): number {
  return idfMap[field]?.[value] ?? 1;
}
```

**توضیح فرمول:**
- `totalPages = 400`، `count = 300` (ترکیه) → IDF = log(400/301) ≈ 0.28 (کم‌ارزش)
- `totalPages = 400`، `count = 2` (آلاچاتی) → IDF = log(400/3) ≈ 4.89 (پرارزش)

### محدودیت‌های این تسک
- ✅ تابع باید pure باشد
- ✅ باید با JSON.parse روی categories کار کند
- ✅ از smoothing (+1) استفاده شود
- ⛔ IDF نباید منفی شود (Math.log روی عدد بزرگتر از ۱ همیشه مثبت است)
- ⛔ هنوز ذخیره در دیتابیس نشود — فقط محاسبه

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts"]`

---

## تسک ۴ — آپدیت دیتابیس برای کش IDF

### هدف
اضافه کردن جدول `idfCache` برای ذخیره نتایج محاسبه IDF و جلوگیری از محاسبه تکراری.

### راهنمای پیاده‌سازی فنی

1. **`src/db.ts`** را ویرایش کن:

**اضافه کردن interface جدید (قبل از class):**
```ts
// جدول کش IDF
export interface IDFCacheRecord {
  id?: number;
  project_id: number;
  idf_map: string; // JSON.stringify شده از IDFMap
  computed_at: string;
}
```

**آپدیت class برای جدول جدید:**
```ts
export class LinkMeshDB extends Dexie {
  projects!: Table<Project>;
  pages!: Table<Page>;
  weights!: Table<Weight>;
  candidates!: Table<CandidateRecord>;
  results!: Table<Result>;
  analysisQueue!: Table<AnalysisQueue>;
  idfCache!: Table<IDFCacheRecord>; // اضافه شد

  constructor() {
    super('LinkMeshDB');
    // ارتقا به نسخه ۳
    this.version(3).stores({
      projects: '++id, name, created_at',
      pages: '++id, project_id, title',
      weights: '++id, project_id, category_name',
      candidates: '++id, project_id, source_page_id',
      results: '++id, project_id, source_page_id',
      analysisQueue: '++id, project_id',
      idfCache: '++id, project_id'  // اضافه شد
    });
  }
}
```

**نکته مهم:** نسخه دیتابیس را از `2` به `3` تغییر بده.

### محدودیت‌های این تسک
- ✅ فقط تغییر schema — هیچ منطق جدید
- ✅ نسخه ۳ دیتابیس
- ⛔ کد‌های موجود نباید خراب شوند (backward compatible)
- ⛔ هیچ کامپوننت UI تغییر نکند

`CONTEXT_FILES: ["src/db.ts"]`

---

## تسک ۵ — بازنویسی کامل scorer.ts

### هدف
بازنویسی الگوریتم امتیازدهی با افزودن تمام قابلیت‌های جدید: IDF، Partial Match، Jaccard، Title Similarity.

### راهنمای پیاده‌سازی فنی

**`src/utils/scorer.ts`** را کاملاً بازنویسی کن:

```ts
import { PARTIAL_MATCH_COEFFICIENTS, isNeighborMonth, isNeighborSeason } from '../constants/timeNeighbors';
import { titleSimilarity, TITLE_SIMILARITY_WEIGHT } from './titleSimilarity';
import { type IDFMap, getIDF } from './idfCalculator';

// ساختار خروجی هر کاندیدا
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matchedTags: string[];
  scoreDetails: {
    tagScore: number;
    jaccardScore: number;
    titleScore: number;
  };
}

// نوع categories
type CategoriesMap = Record<string, string | null>;

// فیلدهایی که Partial Match دارند
const MONTH_FIELD = 'ماه_تقویمی_برگزاری';
const SEASON_FIELD = 'فصل_برگزاری';

// محاسبه امتیاز یک جفت صفحه
export function computeAdvancedScore(
  sourceCat: CategoriesMap,
  candidateCat: CategoriesMap,
  sourceTitle: string,
  candidateTitle: string,
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): { score: number; matchedTags: string[]; details: CandidateWithTags['scoreDetails'] } {
  
  let tagScore = 0;
  const matchedTags: string[] = [];
  
  // شمارش فیلدهای غیرnull برای Jaccard
  const sourceNonNullFields: string[] = [];
  const candidateNonNullFields: string[] = [];
  let exactMatchCount = 0;
  
  // ۱. امتیاز تگ‌ها با IDF و Partial Match
  for (const field of Object.keys(sourceCat)) {
    const srcVal = sourceCat[field];
    const candVal = candidateCat[field];
    
    // شمارش فیلدهای غیرnull
    if (srcVal !== null) sourceNonNullFields.push(field);
    if (candVal !== null) candidateNonNullFields.push(field);
    
    // اگر یکی null بود، skip
    if (srcVal === null || candVal === null) continue;
    
    const baseWeight = mode === 'linear' ? 1 : (weights[field] ?? 1);
    const idf = getIDF(idfMap, field, srcVal);
    
    // تطابق دقیق
    if (srcVal === candVal) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.EXACT;
      matchedTags.push(field);
      exactMatchCount++;
    }
    // Partial Match برای ماه
    else if (field === MONTH_FIELD && isNeighborMonth(srcVal, candVal)) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.NEIGHBOR_MONTH;
      matchedTags.push(`${field}(مجاور)`);
    }
    // Partial Match برای فصل
    else if (field === SEASON_FIELD && isNeighborSeason(srcVal, candVal)) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.NEIGHBOR_SEASON;
      matchedTags.push(`${field}(مجاور)`);
    }
  }
  
  // ۲. Jaccard Bidirectional
  const union = new Set([...sourceNonNullFields, ...candidateNonNullFields]).size;
  const jaccardScore = union > 0 ? (exactMatchCount / union) * 10 : 0;
  
  // ۳. Title Similarity
  const titleScore = titleSimilarity(sourceTitle, candidateTitle) * TITLE_SIMILARITY_WEIGHT;
  
  // ۴. امتیاز نهایی
  const finalScore = tagScore + jaccardScore + titleScore;
  
  return {
    score: Math.round(finalScore * 100) / 100,
    matchedTags,
    details: { tagScore, jaccardScore, titleScore }
  };
}

// پیدا کردن بهترین کاندیداها برای یک صفحه
export function findTopCandidates(
  sourcePage: { id: number; title: string; categories: string },
  allPages: { id: number; title: string; categories: string }[],
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): CandidateWithTags[] {
  
  const sourceCat = JSON.parse(sourcePage.categories) as CategoriesMap;
  
  return allPages
    // خود صفحه را حذف کن
    .filter(p => p.id !== sourcePage.id)
    // امتیاز هر کاندیدا را حساب کن
    .map(p => {
      const pCat = JSON.parse(p.categories) as CategoriesMap;
      const { score, matchedTags, details } = computeAdvancedScore(
        sourceCat, pCat,
        sourcePage.title, p.title,
        weights, idfMap, mode
      );
      
      return {
        page_id: p.id,
        title: p.title,
        score,
        matchedTags,
        scoreDetails: details
      };
    })
    // فقط کسانی که امتیاز مثبت دارند
    .filter(c => c.score > 0)
    // مرتب‌سازی نزولی بر اساس امتیاز
    .sort((a, b) => b.score - a.score);
}

// محاسبه کاندیداها برای تمام صفحات
export function computeAllCandidates(
  pages: { id: number; title: string; categories: string }[],
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  
  const map = new Map<number, CandidateWithTags[]>();
  
  for (const page of pages) {
    const candidates = findTopCandidates(page, pages, weights, idfMap, mode);
    map.set(page.id!, candidates);
  }
  
  return map;
}
```

### نکات مهم برای کدنویس
1. **ترتیب import‌ها:** اول constants، بعد utils
2. **`exactMatchCount`:** فقط برای Jaccard استفاده می‌شود (Partial Matchها شامل نمی‌شوند)
3. **`scoreDetails`:** برای نمایش در UI مفید است
4. **Type Safety:** تمام types باید صریح باشند

### محدودیت‌های این تسک
- ✅ توابع قبلی باید جایگزین شوند (نه اضافه)
- ✅ signature توابع اصلی عوض شده — مصرف‌کننده‌ها در تسک بعدی آپدیت می‌شوند
- ⛔ هیچ فایل دیگری در این تسک تغییر نکند
- ⛔ تست‌ها در این تسک نوشته نمی‌شوند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/constants/timeNeighbors.ts", "src/utils/titleSimilarity.ts", "src/utils/idfCalculator.ts"]`

---

## تسک ۶ — آپدیت candidateStorage.ts

### هدف
تطبیق فایل `candidateStorage.ts` با الگوریتم جدید: محاسبه IDF، ذخیره کش، و استفاده از توابع جدید scorer.

### راهنمای پیاده‌سازی فنی

**`src/utils/candidateStorage.ts`** را ویرایش کن:

```ts
import { db, type Page } from '../db';
import { computeAllCandidates } from './scorer';
import { computeIDFMap, type IDFMap } from './idfCalculator';

// محاسبه و ذخیره کاندیداهای برتر برای تمام صفحات یک پروژه
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): Promise<void> {
  
  // ۱. محاسبه IDF برای کل پروژه
  const idfMap = computeIDFMap(pages);
  
  // ۲. ذخیره IDF در کش
  await db.idfCache.where('project_id').equals(projectId).delete();
  await db.idfCache.add({
    project_id: projectId,
    idf_map: JSON.stringify(idfMap),
    computed_at: new Date().toISOString()
  });
  
  // ۳. حذف کاندیداهای قبلی پروژه
  await db.candidates.where('project_id').equals(projectId).delete();
  
  // ۴. تبدیل pages به فرمت مورد نیاز scorer
  const pagesWithId = pages.map(p => ({
    id: p.id!,
    title: p.title,
    categories: p.categories
  }));
  
  // ۵. محاسبه کاندیداها با الگوریتم پیشرفته
  const candidatesMap = computeAllCandidates(pagesWithId, weights, idfMap, mode);
  
  // ۶. آماده‌سازی رکوردها
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));
  
  // ۷. ذخیره یکجا در دیتابیس
  await db.candidates.bulkAdd(records);
}

// خواندن IDF کش‌شده برای یک پروژه
export async function getCachedIDF(projectId: number): Promise<IDFMap | null> {
  const record = await db.idfCache.where('project_id').equals(projectId).first();
  if (!record) return null;
  return JSON.parse(record.idf_map) as IDFMap;
}
```

### نکات مهم
1. **ترتیب عملیات:** اول IDF، بعد کش، بعد حذف قبلی‌ها، بعد محاسبه جدید
2. **Transaction نیست:** چون عملیات‌ها مستقل هستند
3. **`getCachedIDF`:** برای استفاده در تحلیل تکی AI

### محدودیت‌های این تسک
- ✅ تابع `computeAndStoreCandidates` باید همان signature را نگه دارد (برای backward compatibility)
- ✅ IDF باید کش شود برای استفاده‌های بعدی
- ⛔ تغییر در فایل‌های دیگر فقط در صورت خطای compile

`CONTEXT_FILES: ["src/utils/candidateStorage.ts", "src/utils/scorer.ts", "src/utils/idfCalculator.ts", "src/db.ts"]`

---

## تسک ۷ — تست دستی و رفع باگ

### هدف
اجرای برنامه، آپلود یک CSV کوچک، و تأیید اینکه الگوریتم جدید درست کار می‌کند.

### راهنمای پیاده‌سازی فنی

1. **برنامه را اجرا کن** (`npm run dev`)

2. **یک پروژه جدید بساز** با CSV تستی (حداقل ۱۰ صفحه)

3. **بررسی کن:**
   - آیا IDF محاسبه و کش شده؟ (در DevTools → Application → IndexedDB → idfCache)
   - آیا امتیازات منطقی هستند؟ (تگ‌های نادر امتیاز بیشتر)
   - آیا Partial Match کار می‌کند؟ (ماه‌های مجاور امتیاز می‌گیرند)
   - آیا scoreDetails در خروجی هست؟

4. **اگر خطا بود:**
   - خطای console را بخوان
   - فایل مربوطه را پیدا و رفع کن
   - دوباره تست کن

### خروجی مورد انتظار
- کاندیداها با امتیازات جدید ذخیره شوند
- صفحات با تگ‌های نادر مشترک امتیاز بالاتری بگیرند
- ماه‌های مجاور (مثل فروردین-اردیبهشت) امتیاز جزئی بگیرند

### محدودیت‌های این تسک
- ✅ فقط تست و رفع باگ
- ⛔ ویژگی جدید اضافه نشود
- ⛔ اگر همه چیز کار کرد، هیچ تغییری لازم نیست

`CONTEXT_FILES: ["src/utils/scorer.ts", "src/utils/candidateStorage.ts", "src/utils/idfCalculator.ts"]`

---

## تسک ۸ — آپدیت UI برای نمایش جزئیات امتیاز

### هدف
نمایش `scoreDetails` در کامپوننت‌های UI برای شفافیت بیشتر.

### راهنمای پیاده‌سازی فنی

1. **`src/components/CandidateCard.tsx`** را ویرایش کن:

```tsx
// اضافه کردن نمایش breakdown امتیاز
<div className="text-xs text-gray-500 mt-1">
  {candidate.scoreDetails && (
    <span>
      تگ: {candidate.scoreDetails.tagScore.toFixed(1)} | 
      جکارد: {candidate.scoreDetails.jaccardScore.toFixed(1)} | 
      عنوان: {candidate.scoreDetails.titleScore.toFixed(1)}
    </span>
  )}
</div>
```

2. **`src/pages/PageDetail.tsx`**: مطمئن شو که `matchedTags` شامل "(مجاور)" را هم نشان می‌دهد

3. **تولتیپ:** برای هر بخش امتیاز توضیح کوتاه اضافه کن (اختیاری)

### محدودیت‌های این تسک
- ✅ فقط تغییرات UI
- ✅ اطلاعات جدید باید خوانا و فارسی باشند
- ⛔ منطق امتیازدهی تغییر نکند

`CONTEXT_FILES: ["src/components/CandidateCard.tsx", "src/pages/PageDetail.tsx"]`

---

## خلاصه تغییرات

| فایل | عملیات | توضیح |
|---|---|---|
| `src/constants/timeNeighbors.ts` | جدید | نگاشت مجاورت ماه و فصل |
| `src/utils/titleSimilarity.ts` | جدید | شباهت متنی عنوان |
| `src/utils/idfCalculator.ts` | جدید | محاسبه IDF |
| `src/db.ts` | ویرایش | اضافه کردن جدول idfCache |
| `src/utils/scorer.ts` | بازنویسی | الگوریتم پیشرفته |
| `src/utils/candidateStorage.ts` | ویرایش | استفاده از IDF و scorer جدید |
| `src/components/CandidateCard.tsx` | ویرایش | نمایش جزئیات امتیاز |
| `src/pages/PageDetail.tsx` | ویرایش | نمایش تگ‌های مجاور |
