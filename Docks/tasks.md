# tasks.md — نقشه راه مرجع (اصلاح الگوریتم لینک‌سازی)

> ترتیب تسک‌ها اجباری است. هر تسک روی خروجی تسک قبلی تکیه دارد.
> قبل از شروع هر تسک، فایل‌های CONTEXT_FILES را بخوان.

---

## تسک ۱ — اضافه کردن ثابت‌های زمانی و فصلی

### هدف
اضافه کردن ثابت‌های لازم برای فیلتر زمانی/فصلی به فایل `categories.ts`.

### راهنمای پیاده‌سازی فنی

**فایل `src/constants/categories.ts`:**

در انتهای فایل، این موارد را اضافه کن:

```ts
// ترتیب ماه‌های شمسی برای مقایسه زمانی
export const PERSIAN_MONTHS_ORDER = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

// نگاشت ماه به فصل
export const MONTH_TO_SEASON: Record<string, string> = {
  'فروردین': 'بهار',
  'اردیبهشت': 'بهار',
  'خرداد': 'بهار',
  'تیر': 'تابستان',
  'مرداد': 'تابستان',
  'شهریور': 'تابستان',
  'مهر': 'پاییز',
  'آبان': 'پاییز',
  'آذر': 'پاییز',
  'دی': 'زمستان',
  'بهمن': 'زمستان',
  'اسفند': 'زمستان'
};

// بونوس‌های ثابت
export const ORIGIN_BONUS = 10;      // بونوس مبدای یکسان
export const DESTINATION_BONUS = 5;  // بونوس مقصد یکسان
```

همچنین وزن پیش‌فرض `شهر_یا_استان_مبدا` را به `6` تغییر بده (چون مبدا اولویت اول است).

### محدودیت‌های این تسک
- ✅ فقط اضافه کردن ثابت‌ها — هیچ منطقی تغییر نکند
- ✅ export کن تا در فایل‌های دیگر قابل استفاده باشند
- ⛔ هیچ فایل دیگری تغییر نکند

`CONTEXT_FILES: ["src/constants/categories.ts"]`

---

## تسک ۲ — بازنویسی کامل موتور امتیازدهی با منطق چندلایه

### هدف
بازنویسی فایل `scorer.ts` با منطق جدید که شامل فیلتر فصلی، بونوس مبدا/مقصد، و امتیازدهی چندلایه است.

### راهنمای پیاده‌سازی فنی

**فایل `src/utils/scorer.ts`:**

کل فایل را بازنویسی کن. ساختار جدید:

```ts
import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON, ORIGIN_BONUS, DESTINATION_BONUS } from '../constants/categories';

// اینترفیس جدید با فیلدهای بونوس
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
  origin_bonus: number;      // فیلد جدید
  destination_bonus: number; // فیلد جدید
}

/**
 * تابع ۱: فیلتر Hard فصلی/زمانی
 * 
 * قانون: اگر صفحه منبع ماه خاصی دارد (مثلاً آبان)، کاندیدا باید:
 *   - همان ماه باشد (آبان)
 *   - یا ماه بعدی باشد (آذر)
 *   - ماه‌های قبلی یا فصل‌های دیگر ❌ حذف می‌شوند
 * 
 * اگر صفحه منبع فصل دارد ولی ماه خاص ندارد، فقط همان فصل مجاز است.
 * اگر صفحه منبع نه ماه دارد نه فصل (صفحه عمومی)، همه کاندیداها مجازند.
 */
export function isValidSeasonalMatch(sourceCategories: any, candidateCategories: any): boolean {
  const sourceMonth = sourceCategories['ماه_تقویمی_برگزاری'];
  const sourceSeason = sourceCategories['فصل_برگزاری'];
  const candidateMonth = candidateCategories['ماه_تقویمی_برگزاری'];
  const candidateSeason = candidateCategories['فصل_برگزاری'];
  
  // صفحه منبع عمومی است — همه مجاز
  if (!sourceMonth && !sourceSeason) {
    return true;
  }
  
  // ۱. بررسی ماه
  if (sourceMonth) {
    const sourceIdx = PERSIAN_MONTHS_ORDER.indexOf(sourceMonth);
    
    // اگر کاندیدا ماه دارد
    if (candidateMonth) {
      const candidateIdx = PERSIAN_MONTHS_ORDER.indexOf(candidateMonth);
      // ماه باید یکی باشد یا یکی بعد (با در نظر گرفتن چرخش سال)
      const isCurrentMonth = candidateIdx === sourceIdx;
      const isNextMonth = candidateIdx === (sourceIdx + 1) % 12;
      
      if (!isCurrentMonth && !isNextMonth) {
        return false; // ماه نامعتبر — حذف
      }
    }
    // اگر کاندیدا ماه ندارد ولی فصل دارد، فصلش باید با ماه منبع هم‌خوان باشد
    else if (candidateSeason) {
      const sourceSeasonFromMonth = MONTH_TO_SEASON[sourceMonth];
      if (candidateSeason !== sourceSeasonFromMonth) {
        return false; // فصل نامعتبر — حذف
      }
    }
    // کاندیدا نه ماه دارد نه فصل — صفحه عمومی، مجاز است
  }
  
  // ۲. بررسی فصل (اگر منبع فقط فصل دارد بدون ماه خاص)
  else if (sourceSeason) {
    if (candidateSeason && candidateSeason !== sourceSeason) {
      return false; // فصل متفاوت — حذف
    }
    // اگر کاندیدا ماه دارد، بررسی کن ماهش با فصل منبع هم‌خوان باشد
    if (candidateMonth) {
      const candidateSeasonFromMonth = MONTH_TO_SEASON[candidateMonth];
      if (candidateSeasonFromMonth !== sourceSeason) {
        return false;
      }
    }
  }
  
  return true; // فیلتر پاس شد
}

/**
 * تابع ۲: محاسبه بونوس مبدا و مقصد
 * 
 * قانون اولویت:
 *   ۱. مبدا یکسان = بونوس ۱۰ (اولویت اول)
 *   ۲. مقصد یکسان = بونوس ۵ (اولویت دوم)
 */
export function calculateBonuses(sourceCategories: any, candidateCategories: any): { originBonus: number; destinationBonus: number } {
  let originBonus = 0;
  let destinationBonus = 0;
  
  // بونوس مبدا
  const sourceOrigin = sourceCategories['شهر_یا_استان_مبدا'];
  const candidateOrigin = candidateCategories['شهر_یا_استان_مبدا'];
  if (sourceOrigin && candidateOrigin && sourceOrigin === candidateOrigin) {
    originBonus = ORIGIN_BONUS;
  }
  
  // بونوس مقصد
  const sourceDestination = sourceCategories['شهر_یا_جزیره_مقصد'];
  const candidateDestination = candidateCategories['شهر_یا_جزیره_مقصد'];
  if (sourceDestination && candidateDestination && sourceDestination === candidateDestination) {
    destinationBonus = DESTINATION_BONUS;
  }
  
  return { originBonus, destinationBonus };
}

/**
 * تابع ۳: محاسبه تگ‌های مشترک (بدون تغییر)
 */
export function getMatchedTags(catA: any, catB: any): string[] {
  const matched: string[] = [];
  Object.keys(catA).forEach((field) => {
    if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
      matched.push(field);
    }
  });
  return matched;
}

/**
 * تابع ۴: محاسبه امتیاز پایه (وزن تگ‌های مشترک)
 */
export function computeBaseScore(catA: any, catB: any, weights: Record<string, number>, mode: 'linear' | 'weighted'): number {
  let score = 0;
  
  for (const field in catA) {
    if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
      if (mode === 'linear') {
        score += 1;
      } else {
        score += (weights[field] ?? 1);
      }
    }
  }
  
  return score;
}

/**
 * تابع ۵: پیدا کردن کاندیداها با منطق چندلایه
 * 
 * لایه ۱: فیلتر Hard فصلی/زمانی → حذف صفحات نامعتبر
 * لایه ۲: امتیاز پایه → وزن تگ‌های مشترک
 * لایه ۳: بونوس‌ها → مبدا و مقصد
 * لایه ۴: مرتب‌سازی → بر اساس امتیاز کل (جمع، نه میانگین!)
 */
export function findTopCandidates(
  sourcePage: any, 
  allPages: any[], 
  weights: Record<string, number>, 
  mode: 'linear' | 'weighted'
): CandidateWithTags[] {
  const sourceCat = JSON.parse(sourcePage.categories);
  
  const candidates: CandidateWithTags[] = [];
  
  for (const page of allPages) {
    // اسکیپ خود صفحه
    if (page.id === sourcePage.id) continue;
    
    const pageCat = JSON.parse(page.categories);
    
    // ────────────────────────────────────────
    // لایه ۱: فیلتر Hard فصلی/زمانی
    // ────────────────────────────────────────
    if (!isValidSeasonalMatch(sourceCat, pageCat)) {
      continue; // حذف کامل — به لیست نهایی نمی‌رود
    }
    
    // ────────────────────────────────────────
    // لایه ۲: امتیاز پایه
    // ────────────────────────────────────────
    const baseScore = computeBaseScore(sourceCat, pageCat, weights, mode);
    
    // ────────────────────────────────────────
    // لایه ۳: بونوس مبدا/مقصد
    // ────────────────────────────────────────
    const { originBonus, destinationBonus } = calculateBonuses(sourceCat, pageCat);
    
    // ────────────────────────────────────────
    // امتیاز نهایی = جمع (نه میانگین!)
    // ────────────────────────────────────────
    const totalScore = baseScore + originBonus + destinationBonus;
    
    // فقط صفحاتی که حداقل ۱ تطابق دارند
    if (totalScore > 0) {
      candidates.push({
        page_id: page.id!,
        title: page.title,
        score: totalScore,
        matched_tags: getMatchedTags(sourceCat, pageCat),
        origin_bonus: originBonus,
        destination_bonus: destinationBonus
      });
    }
  }
  
  // ────────────────────────────────────────
  // لایه ۴: مرتب‌سازی نهایی
  // ────────────────────────────────────────
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates;
}

/**
 * تابع ۶: محاسبه کاندیداها برای همه صفحات (بدون تغییر در امضا)
 */
export function computeAllCandidates(
  pages: any[], 
  weights: Record<string, number>, 
  mode: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();
  
  for (const page of pages) {
    const candidates = findTopCandidates(page, pages, weights, mode);
    map.set(page.id!, candidates);
  }
  
  return map;
}
```

### محدودیت‌های این تسک
- ✅ تمام توابع قبلی باید همچنان export شوند
- ✅ فیلتر فصلی باید **قبل** از محاسبه امتیاز انجام شود
- ✅ امتیاز نهایی = جمع (نه میانگین)
- ⛔ هیچ import جدیدی غیر از `categories.ts` اضافه نشود
- ⛔ تابع `computeAllCandidates` نباید امضایش تغییر کند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/constants/categories.ts"]`

---

## تسک ۳ — پیاده‌سازی Reactivity تنظیمات در Config

### هدف
وقتی کاربر در صفحه Config تنظیمات را تغییر می‌دهد (مثلاً از `linear` به `weighted`)، سیستم باید جدول `candidates` را پاک کند تا در ورود بعدی به `ProjectPages` مجدداً محاسبه شود.

### راهنمای پیاده‌سازی فنی

**فایل `src/pages/Config.tsx`:**

در تابع `handleStartAnalysis`، **قبل از** navigate، کاندیداهای قبلی را پاک کن:

```ts
const handleStartAnalysis = async () => {
  if (!apiKey) {
    alert('لطفاً کلید API Gemini را وارد کنید');
    return;
  }
  if (!projectId) return;

  setSaving(true);
  try {
    const id = parseInt(projectId);
    
    // ۱. ذخیره تنظیمات پروژه
    await db.projects.update(id, { scoring_mode: scoringMode, max_links: maxLinks });

    // ۲. ذخیره وزن‌ها
    const weightsToSave = Object.entries(localWeights).map(([name, val]) => ({
      project_id: id,
      category_name: name,
      weight_value: Number(val)
    }));
    await db.weights.where('project_id').equals(id).delete();
    await db.weights.bulkAdd(weightsToSave);

    // ────────────────────────────────────────
    // ۳. [جدید] پاک کردن کاندیداها برای تریگر محاسبه مجدد
    // ────────────────────────────────────────
    await db.candidates.where('project_id').equals(id).delete();
    
    // ────────────────────────────────────────
    // ۴. [جدید] ریست کردن صف پردازش (اگر قبلاً در حال پردازش بود)
    // ────────────────────────────────────────
    await db.analysisQueue.where('project_id').equals(id).delete();

    navigate(`/project/${projectId}`);
  } catch (err) {
    console.error(err);
    alert('خطا در ذخیره تنظیمات');
  } finally {
    setSaving(false);
  }
};
```

**نکته مهم:** با این تغییر، وقتی کاربر به `ProjectPages` می‌رود، `useEffect` موجود که `candidatesCount === 0` را چک می‌کند، خودکار محاسبه مجدد را تریگر می‌کند.

### محدودیت‌های این تسک
- ✅ کاندیداها باید **قبل از** navigate پاک شوند
- ✅ صف پردازش هم ریست شود
- ⛔ UI صفحه Config تغییر نکند

`CONTEXT_FILES: ["src/pages/Config.tsx", "src/db.ts"]`

---

## تسک ۴ — بهبود پرامپت AI با درک نیت کاربر

### هدف
بازنویسی تابع `buildSinglePagePrompt` در `queueProcessor.ts` با پرامپت جدید که نیت کاربر را درک می‌کند.

### راهنمای پیاده‌سازی فنی

**فایل `src/utils/queueProcessor.ts`:**

تابع `buildSinglePagePrompt` را کاملاً جایگزین کن:

```ts
export function buildSinglePagePrompt(
  sourcePage: { title: string; categories: object },
  candidates: CandidateWithTags[]
): string {
  return `
تو یک متخصص SEO و معمار لینک‌سازی داخلی برای سایت تور مسافرتی «نهال‌گشت» هستی.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 مهم‌ترین وظیفه تو: درک نیت کاربر
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

قبل از انتخاب لینک‌ها، باید به این سوالات پاسخ دهی:

۱. **چه کسی** به این صفحه می‌آید؟
   - کاربری که دنبال تور ${sourcePage.title} است

۲. **چه زمانی** می‌خواهد سفر کند؟
   - به تگ «ماه_تقویمی_برگزاری» و «فصل_برگزاری» نگاه کن
   - اگر صفحه مثلاً مال تیرماه است، کاربر برای تابستان برنامه دارد
   - پس فقط صفحات همان بازه زمانی مرتبط هستند

۳. **دغدغه اصلی** کاربر چیست؟
   - آیا دنبال مقصد خاص است؟ → صفحات همان مقصد
   - آیا از شهر خاصی می‌خواهد برود؟ → صفحات همان مبدا (اولویت بالاتر!)
   - آیا نوع خاصی از تور می‌خواهد؟ → صفحات همان نوع

۴. **سفر کاربر در سایت** چگونه تکمیل می‌شود؟
   - صفحاتی که اطلاعات **مکمل** (نه تکراری) ارائه می‌دهند
   - مثلاً: تور قشم → تور کیش (مقصد مشابه در همان فصل)
   - مثلاً: تور آنتالیا تابستان → تور مارماریس تابستان (کشور و فصل مشترک)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 قوانین انتخاب لینک
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

۱. **قانون زمانی (مهم!):**
   - صفحات با فصل متفاوت را انتخاب نکن
   - مثال: اگر صفحه منبع «تور قشم آبان» است، «تور قشم نوروز» انتخاب نشود!

۲. **قانون مبدا (اولویت اول):**
   - صفحات با مبدای یکسان بالاترین ارتباط را دارند
   - به فیلد «origin_bonus» نگاه کن — اگر ۱۰ است یعنی مبدا یکسان است

۳. **قانون مقصد (اولویت دوم):**
   - صفحات با مقصد یکسان ارتباط بالایی دارند
   - به فیلد «destination_bonus» نگاه کن — اگر ۵ است یعنی مقصد یکسان است

۴. **قانون تکمیل‌کنندگی:**
   - صفحاتی که «گزینه‌های جایگزین» ارائه می‌دهند، نه تکرار همان صفحه

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 صفحه اصلی (Source Page)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
عنوان: ${sourcePage.title}
اطلاعات طبقه‌بندی: ${JSON.stringify(sourcePage.categories, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 کاندیداها (پیش‌فیلتر شده بر اساس زمان)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${candidates.map((c, i) => `
${i + 1}. [ID: ${c.page_id}] ${c.title}
   📊 امتیاز کل: ${c.score}
   🏠 بونوس مبدا: ${c.origin_bonus > 0 ? `✅ ${c.origin_bonus}` : '—'}
   🎯 بونوس مقصد: ${c.destination_bonus > 0 ? `✅ ${c.destination_bonus}` : '—'}
   🏷️ تگ‌های مشترک: ${c.matched_tags.join(' | ')}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 فرمت خروجی
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
خروجی را **فقط** به صورت JSON خالص برگردان (بدون markdown، بدون توضیح اضافی):

{
  "user_intent": "توضیح کوتاه: کاربر این صفحه چه می‌خواهد؟",
  "selected_links": [
    { 
      "page_id": 42, 
      "title": "عنوان صفحه", 
      "reason": "دلیل انتخاب از نظر SEO و نیت کاربر"
    }
  ]
}

نکته: تعداد لینک‌ها محدودیت ندارد. فقط صفحات **واقعاً مرتبط** را انتخاب کن.
`;
}
```

### محدودیت‌های این تسک
- ✅ پرامپت باید فارسی و واضح باشد
- ✅ فیلدهای `origin_bonus` و `destination_bonus` را نمایش بده
- ✅ خروجی JSON باید شامل `user_intent` باشد
- ⛔ ساختار خروجی JSON تغییر نکند (برای backward compatibility)

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/queueProcessor.ts", "src/utils/scorer.ts"]`

---

## تسک ۵ — آپدیت کامپوننت CandidateCard برای نمایش بونوس‌ها

### هدف
نمایش بونوس مبدا و مقصد در کارت‌های کاندیدا در صفحه `PageDetail`.

### راهنمای پیاده‌سازی فنی

**فایل `src/components/CandidateCard.tsx`:**

اینترفیس props را آپدیت کن:

```ts
interface CandidateCardProps {
  title: string;
  score: number;
  matchedTags: string[];
  originBonus?: number;      // فیلد جدید
  destinationBonus?: number; // فیلد جدید
  isSelected?: boolean;
  onSelect?: () => void;
}
```

در بدنه کامپوننت، بعد از نمایش امتیاز، بونوس‌ها را نشان بده:

```tsx
{/* نمایش بونوس‌ها */}
<div className="flex gap-2 mt-2">
  {originBonus > 0 && (
    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold">
      🏠 مبدا یکسان (+{originBonus})
    </span>
  )}
  {destinationBonus > 0 && (
    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold">
      🎯 مقصد یکسان (+{destinationBonus})
    </span>
  )}
</div>
```

**فایل `src/pages/PageDetail.tsx`:**

در جایی که `CandidateCard` رندر می‌شود، props جدید را پاس بده:

```tsx
<CandidateCard
  title={candidate.title}
  score={candidate.score}
  matchedTags={candidate.matched_tags}
  originBonus={candidate.origin_bonus}
  destinationBonus={candidate.destination_bonus}
  // ... سایر props
/>
```

### محدودیت‌های این تسک
- ✅ بونوس‌ها فقط وقتی > 0 هستند نمایش داده شوند
- ✅ از آیکون‌های ساده استفاده کن (🏠 برای مبدا، 🎯 برای مقصد)
- ⛔ ساختار کلی کارت تغییر نکند

`CONTEXT_FILES: ["src/components/CandidateCard.tsx", "src/pages/PageDetail.tsx"]`

---

## تسک ۶ — تست و اطمینان از یکپارچگی

### هدف
تست کامل سیستم برای اطمینان از اینکه تمام تغییرات به درستی کار می‌کنند.

### راهنمای پیاده‌سازی فنی

یک فایل تست ساده بساز: `src/utils/scorer.test.ts`

```ts
import { isValidSeasonalMatch, calculateBonuses, findTopCandidates } from './scorer';

// تست ۱: فیلتر فصلی
console.log('--- تست فیلتر فصلی ---');

const sourceAban = { 'ماه_تقویمی_برگزاری': 'آبان', 'فصل_برگزاری': 'پاییز' };
const candidateAban = { 'ماه_تقویمی_برگزاری': 'آبان', 'فصل_برگزاری': 'پاییز' };
const candidateAzar = { 'ماه_تقویمی_برگزاری': 'آذر', 'فصل_برگزاری': 'پاییز' };
const candidateTir = { 'ماه_تقویمی_برگزاری': 'تیر', 'فصل_برگزاری': 'تابستان' };
const candidateNorooz = { 'ماه_تقویمی_برگزاری': 'فروردین', 'فصل_برگزاری': 'بهار' };

console.log('آبان → آبان:', isValidSeasonalMatch(sourceAban, candidateAban)); // true
console.log('آبان → آذر:', isValidSeasonalMatch(sourceAban, candidateAzar));  // true (ماه بعد)
console.log('آبان → تیر:', isValidSeasonalMatch(sourceAban, candidateTir));   // false
console.log('آبان → نوروز:', isValidSeasonalMatch(sourceAban, candidateNorooz)); // false

// تست ۲: بونوس مبدا/مقصد
console.log('\n--- تست بونوس‌ها ---');

const sourceWithOrigin = { 'شهر_یا_استان_مبدا': 'تهران', 'شهر_یا_جزیره_مقصد': 'کیش' };
const candidateSameOrigin = { 'شهر_یا_استان_مبدا': 'تهران', 'شهر_یا_جزیره_مقصد': 'قشم' };
const candidateSameDest = { 'شهر_یا_استان_مبدا': 'مشهد', 'شهر_یا_جزیره_مقصد': 'کیش' };

console.log('مبدا یکسان:', calculateBonuses(sourceWithOrigin, candidateSameOrigin)); // { originBonus: 10, destinationBonus: 0 }
console.log('مقصد یکسان:', calculateBonuses(sourceWithOrigin, candidateSameDest));   // { originBonus: 0, destinationBonus: 5 }

console.log('\n✅ تست‌ها تمام شد');
```

**اجرا:**
```bash
npx ts-node src/utils/scorer.test.ts
```

### محدودیت‌های این تسک
- ✅ فقط تست — هیچ کد production تغییر نکند
- ✅ تست‌ها باید pass شوند

`CONTEXT_FILES: ["src/utils/scorer.ts", "src/constants/categories.ts"]`

---

## چک‌لیست نهایی

- [ ] ثابت‌های زمانی به `categories.ts` اضافه شد
- [ ] موتور امتیازدهی با منطق چندلایه بازنویسی شد
- [ ] تغییر تنظیمات در Config باعث پاک شدن کاندیداها می‌شود
- [ ] پرامپت AI با درک نیت کاربر بهبود یافت
- [ ] بونوس مبدا/مقصد در UI نمایش داده می‌شود
- [ ] تست‌ها pass می‌شوند
