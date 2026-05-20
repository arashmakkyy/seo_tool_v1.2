# ARCHITECTURE.md — لنگرگاه سیستمی

---

## اسکیمای دیتابیس (Dexie.js / IndexedDB)

```ts
// src/db.ts
db.version(2).stores({
  projects : '++id, name, created_at',
  pages    : '++id, project_id, title',
  weights  : '++id, project_id, category_name',
  candidates: '++id, project_id, source_page_id',
  results  : '++id, project_id, source_page_id',
  analysisQueue: '++id, project_id'
})
```

### جدول `projects`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| name | string | نام پروژه — مثلاً «نهال‌گشت ۱۴۰۵» |
| created_at | ISO string | تاریخ ساخت |
| scoring_mode | `'linear'` یا `'weighted'` | روش امتیازدهی |

### جدول `pages`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| title | string | مقدار ستون `عنوان_H1` از CSV |
| categories | JSON string | آبجکت حاوی ۱۸ فیلد دسته‌بندی |

**ساختار `categories` (JSON.stringify شده):**
```json
{
  "قاره_یا_منطقه": "اوراسیا",
  "کشور_مقصد": "ترکیه",
  "جهت_در_منطقه": "مدیترانه",
  "شهر_یا_جزیره_مقصد": "کوش آداسی",
  "شهر_یا_استان_مبدا": null,
  "نوع_تور": "تک مقصد",
  "فصل_برگزاری": "تابستان",
  "ماه_تقویمی_برگزاری": "تیر",
  "تعطیلات_خاص_تقویمی": null,
  "رویداد_یا_مناسبت_خاص": null,
  "تم_یا_هدف_سفر": null,
  "نوع_وسیله_نقلیه": "هوایی",
  "نام_دقیق_هتل": null,
  "تعداد_ستاره_هتل": null,
  "برچسب_کلاسی_تور": null,
  "پرسونای_مخاطب": null,
  "وضعیت_ویزا": "بدون ویزا",
  "نوع_سفر": "تفریحی، استراحت و ریلکسیشن"
}
```

### جدول `weights`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| category_name | string | نام ستون دسته‌بندی |
| weight_value | float (1-5) | وزن اختصاص‌داده‌شده |

**وزن‌های پیش‌فرض (بازنگری شده):**
```ts
{
  'شهر_یا_استان_مبدا'   : 6, // ⬆️ افزایش — مبدا اولویت اول
  'شهر_یا_جزیره_مقصد'   : 5, // مقصد اولویت دوم
  'کشور_مقصد'           : 4,
  'ماه_تقویمی_برگزاری'  : 4, // ⬆️ افزایش — زمان مهم است
  'فصل_برگزاری'         : 4, // ⬆️ افزایش — فصل مهم است
  'نوع_تور'             : 3,
  'قاره_یا_منطقه'       : 2,
  'جهت_در_منطقه'        : 2,
  'تم_یا_هدف_سفر'       : 2,
  'نوع_سفر'             : 2,
  'تعطیلات_خاص_تقویمی'  : 1,
  'رویداد_یا_مناسبت_خاص': 1,
  'نوع_وسیله_نقلیه'     : 1,
  'نام_دقیق_هتل'        : 1,
  'تعداد_ستاره_هتل'     : 1,
  'برچسب_کلاسی_تور'     : 1,
  'پرسونای_مخاطب'       : 1,
  'وضعیت_ویزا'          : 1,
}
```

### جدول `candidates` (لیست کاندیدای هر صفحه)
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| source_page_id | int FK → pages.id | صفحه‌ای که کاندیداها برایش محاسبه شده |
| candidate_list | JSON string | آرایه کاندیداها (بعد از فیلتر زمانی) |
| computed_at | ISO string | زمان محاسبه |

**ساختار `candidate_list`:**
```json
[
  { 
    "page_id": 42, 
    "title": "تور مارماریس تابستان", 
    "score": 15, 
    "matched_tags": ["کشور_مقصد", "فصل_برگزاری"],
    "origin_bonus": 5,
    "destination_bonus": 0
  }
]
```

### جدول `results` (نتایج نهایی AI)
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| source_page_id | int FK → pages.id | صفحه‌ای که لینک‌ها برایش پیشنهاد شده |
| recommended_links | JSON string | آرایه لینک‌های پیشنهادی از AI |
| is_manual_edit | boolean | آیا کاربر دستی ویرایش کرده؟ |
| generated_at | ISO string | زمان تولید |

### جدول `analysisQueue` (صف پردازش AI)
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| status | `'pending'` / `'processing'` / `'completed'` / `'failed'` / `'paused'` | وضعیت صف |
| current_page_index | int | ایندکس آخرین صفحه پردازش‌شده |
| total_pages | int | تعداد کل صفحات |
| error_message | string / null | پیام خطا اگر fail شد |
| selected_model | string | مدل AI انتخاب شده |
| started_at | ISO string | زمان شروع |
| updated_at | ISO string | آخرین به‌روزرسانی |

---

## جریان داده (Data Flow)

```
                          ┌─────────────────────────────────────────────────────────────┐
                          │                    User Flow                                 │
                          └─────────────────────────────────────────────────────────────┘

CSV آپلود
    │
    ▼
Papa Parse → آرایه ردیف‌ها
    │
    ▼
Dexie: projects.add() + pages.bulkAdd()
    │
    ▼
Config Screen: scoring_mode + weights → Dexie: weights.bulkAdd()
    │                                                
    │  ⚠️ نکته مهم: هر تغییر در Config باید:
    │  1. جدول candidates را پاک کند
    │  2. محاسبه مجدد امتیازدهی را تریگر کند
    │
    ▼
[مرحله اول: امتیازدهی داخلی - بدون AI]
    │
    ▼
scorer.ts → computeAllCandidates()
    │
    ├── فیلتر فصلی/زمانی (حذف صفحات نامرتبط زمانی)
    ├── محاسبه امتیاز پایه (وزن تگ‌های مشترک)
    ├── بونوس مبدا (origin_bonus)
    └── بونوس مقصد (destination_bonus)
    │
    ▼
Dexie: candidates.bulkAdd()
    │
    └───────────────────────────────────────────────────────────────────┐
                                                                        │
                          ┌─────────────────────────────────────────────▼─────────────┐
                          │              مرحله دوم: پردازش AI                          │
                          └─────────────────────────────────────────────────────────────┘

                    ┌───────────────────┐         ┌───────────────────┐
                    │   دکمه تکی        │         │   دکمه کلی        │
                    │   (یک صفحه)       │         │   (همه صفحات)     │
                    └────────┬──────────┘         └────────┬──────────┘
                             │                             │
                             ▼                             ▼
                    فقط همان صفحه +               ایجاد analysisQueue
                    کاندیداهایش                   با status='pending'
                             │                             │
                             ▼                             ▼
                    gemini.ts:                       صف‌پردازی:
                    buildSinglePagePrompt()     ┌──────────────────────────┐
                    (با پرامپت جدید که          │  برای هر صفحه:          │
                    نیت کاربر را درک کند)       │  1. صفحه i را بگیر       │
                             │                   │  2. کاندیداها بفرست     │
                             ▼                   │  3. جواب بگیر            │
                    callGemini()                │  4. ذخیره در results     │
                             │                   │  5. مکث ۲ ثانیه          │
                             ▼                   │  6. update queue index   │
                    ذخیره در results            │  7. تکرار تا آخر         │
                                                 └──────────────────────────┘
```

---

## منطق الگوریتم امتیازدهی (`scorer.ts`) — تغییرات جدید

### ۱. ترتیب ماه‌های شمسی (برای فیلتر زمانی)
```ts
const PERSIAN_MONTHS_ORDER = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];
```

### ۲. تابع جدید `isValidSeasonalMatch` (فیلتر Hard)
```ts
// بررسی می‌کند آیا کاندیدا از نظر زمانی مجاز است یا خیر
function isValidSeasonalMatch(sourceCategories: any, candidateCategories: any): boolean {
  const sourceMonth = sourceCategories['ماه_تقویمی_برگزاری'];
  const sourceSeason = sourceCategories['فصل_برگزاری'];
  const candidateMonth = candidateCategories['ماه_تقویمی_برگزاری'];
  const candidateSeason = candidateCategories['فصل_برگزاری'];
  
  // اگر منبع ماه خاصی ندارد، همه مجاز هستند
  if (!sourceMonth && !sourceSeason) return true;
  
  // اگر منبع ماه دارد، کاندیدا باید همان ماه یا ماه بعدی باشد
  if (sourceMonth && candidateMonth) {
    const sourceIdx = PERSIAN_MONTHS_ORDER.indexOf(sourceMonth);
    const candidateIdx = PERSIAN_MONTHS_ORDER.indexOf(candidateMonth);
    // ماه همان یا یکی بعد (با چرخش سال)
    const isValid = candidateIdx === sourceIdx || 
                    candidateIdx === (sourceIdx + 1) % 12;
    if (!isValid) return false;
  }
  
  // اگر منبع فصل دارد، کاندیدا باید همان فصل باشد
  if (sourceSeason && candidateSeason && sourceSeason !== candidateSeason) {
    return false;
  }
  
  return true;
}
```

### ۳. تابع جدید `calculateBonuses` (بونوس مبدا/مقصد)
```ts
function calculateBonuses(sourceCategories: any, candidateCategories: any): { originBonus: number, destinationBonus: number } {
  let originBonus = 0;
  let destinationBonus = 0;
  
  // بونوس مبدا — اولویت اول
  if (sourceCategories['شهر_یا_استان_مبدا'] && 
      sourceCategories['شهر_یا_استان_مبدا'] === candidateCategories['شهر_یا_استان_مبدا']) {
    originBonus = 10; // بونوس قابل توجه
  }
  
  // بونوس مقصد — اولویت دوم
  if (sourceCategories['شهر_یا_جزیره_مقصد'] && 
      sourceCategories['شهر_یا_جزیره_مقصد'] === candidateCategories['شهر_یا_جزیره_مقصد']) {
    destinationBonus = 5;
  }
  
  return { originBonus, destinationBonus };
}
```

### ۴. تغییر در `findTopCandidates` — منطق چندلایه
```ts
export function findTopCandidates(sourcePage: any, allPages: any[], weights: Record<string, number>, mode: 'linear' | 'weighted'): CandidateWithTags[] {
  const sourceCat = JSON.parse(sourcePage.categories);
  
  return allPages
    .filter(p => p.id !== sourcePage.id)
    .map(p => {
      const pCat = JSON.parse(p.categories);
      
      // لایه ۱: فیلتر Hard فصلی/زمانی
      if (!isValidSeasonalMatch(sourceCat, pCat)) {
        return null; // حذف کامل
      }
      
      // لایه ۲: امتیاز پایه
      const baseScore = computeScore(sourceCat, pCat, weights, mode);
      
      // لایه ۳: بونوس‌ها
      const { originBonus, destinationBonus } = calculateBonuses(sourceCat, pCat);
      
      // امتیاز نهایی = پایه + بونوس (نه میانگین!)
      const totalScore = baseScore + originBonus + destinationBonus;
      
      return {
        page_id: p.id!,
        title: p.title,
        score: totalScore,
        matched_tags: getMatchedTags(sourceCat, pCat),
        origin_bonus: originBonus,
        destination_bonus: destinationBonus
      };
    })
    .filter(c => c !== null && c.score > 0)
    .sort((a, b) => b!.score - a!.score);
}
```

---

## ساختار پرامپت بهبودیافته برای Gemini

```
SYSTEM:
تو یک متخصص SEO و معمار لینک‌سازی داخلی برای سایت تور مسافرتی هستی.

مهم‌ترین وظیفه تو: **درک نیت کاربر** از بازدید صفحه منبع.

قبل از انتخاب لینک‌ها، باید به این سوالات پاسخ دهی:
1. عنوان صفحه چیست و کاربر چرا به این صفحه آمده؟
2. بازه سفر کاربر چه زمانی است؟ (اگر صفحه مربوط به تیرماه است، کاربر احتمالاً برای تابستان برنامه دارد)
3. دغدغه کاربر چیست؟ (قیمت؟ مقصد؟ زمان؟ نوع تور؟)
4. کدام صفحات می‌توانند سفر کاربر در سایت را تکمیل کنند؟

قوانین انتخاب لینک:
1. **قانون زمانی:** اگر صفحه منبع ماه خاصی دارد، فقط صفحات همان ماه یا ماه بعدی مجاز هستند. صفحات فصل‌های دیگر را انتخاب نکن.
2. **قانون مبدا:** صفحات با مبدای یکسان اولویت اول هستند.
3. **قانون مقصد:** صفحات با مقصد یکسان اولویت دوم هستند.
4. **قانون تکمیل‌کنندگی:** صفحاتی که اطلاعات مکمل (نه تکراری) ارائه می‌دهند.

USER:
صفحه اصلی:
- عنوان: ${sourcePage.title}
- ویژگی‌ها: ${JSON.stringify(sourcePage.categories)}

کاندیداها (پیش‌فیلتر شده بر اساس زمان و مرتب بر اساس امتیاز):
${candidates.map((c, i) => `${i + 1}. [ID: ${c.page_id}] ${c.title}
   امتیاز: ${c.score} | بونوس مبدا: ${c.origin_bonus} | بونوس مقصد: ${c.destination_bonus}
   تگ‌های مشترک: ${c.matched_tags.join(', ')}`).join('\n\n')}

خروجی را فقط به صورت JSON خالص بده:
{
  "user_intent": "توضیح کوتاه نیت کاربر",
  "selected_links": [
    { "page_id": 42, "title": "...", "reason": "..." }
  ]
}
```

---

## مسیرهای روتینگ

| مسیر | کامپوننت | توضیح |
|---|---|---|
| `/` | `Home.tsx` | لیست پروژه‌ها |
| `/new` | `NewProject.tsx` | آپلود CSV |
| `/config/:projectId` | `Config.tsx` | تنظیمات امتیازدهی |
| `/project/:projectId` | `ProjectPages.tsx` | لیست صفحات پروژه + دکمه تحلیل کلی |
| `/project/:projectId/page/:pageId` | `PageDetail.tsx` | جزئیات یک صفحه + ویرایش دستی |
| `/results/:projectId` | `Results.tsx` | خروجی نهایی + export |

---

## نکات امنیتی

- کلید Gemini API **فقط** در `localStorage` با کلید `LINKMESH_API_KEY` ذخیره می‌شود
- هیچ‌گاه API Key به Dexie یا state برنامه نوشته نمی‌شود
- هنگام export، API Key در CSV وارد نمی‌شود
