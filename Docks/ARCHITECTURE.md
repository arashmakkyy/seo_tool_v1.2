# ARCHITECTURE.md — لنگرگاه سیستمی (بازنگری شده)

---

## اسکیمای دیتابیس (Dexie.js / IndexedDB)

```ts
// src/db.ts
db.version(2).stores({
  projects      : '++id, name, created_at',
  pages         : '++id, project_id, title',
  weights       : '++id, project_id, category_name',
  candidates    : '++id, project_id, source_page_id',
  results       : '++id, project_id, source_page_id',
  analysisQueue : '++id, project_id'
})
```

### جدول `projects`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| name | string | نام پروژه — مثلاً «نهال‌گشت ۱۴۰۵» |
| created_at | ISO string | تاریخ ساخت |
| scoring_mode | `'linear'` یا `'weighted'` | روش امتیازدهی |
| max_links | number | حذف شده — AI تصمیم می‌گیرد |

### جدول `pages`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| title | string | مقدار ستون `عنوان_H1` از CSV |
| categories | JSON string | آبجکت حاوی ۱۸ فیلد دسته‌بندی |

### جدول `weights`
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| category_name | string | نام ستون دسته‌بندی |
| weight_value | float (1-5) | وزن اختصاص‌داده‌شده |

### جدول `candidates` (لیست کاندیدای هر صفحه)
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| source_page_id | int FK → pages.id | صفحه‌ای که کاندیداها برایش محاسبه شده |
| candidate_list | JSON string | آرایه کاندیداها با امتیاز ۱-۱۰ |
| computed_at | ISO string | زمان محاسبه |

**ساختار جدید `candidate_list`:**
```json
[
  { 
    "page_id": 42, 
    "title": "تور مارماریس تابستان", 
    "score": 8.5,           // امتیاز ۱-۱۰ (نه تعداد تگ)
    "matched_tags": ["کشور_مقصد", "فصل_برگزاری"],
    "matched_count": 5       // تعداد تگ‌های مشترک
  }
]
```

### جدول `results` (نتایج نهایی AI)
| فیلد | نوع | توضیح |
|---|---|---|
| id | auto int PK | |
| project_id | int FK → projects.id | |
| source_page_id | int FK → pages.id | صفحه‌ای که لینک‌ها برایش پیشنهاد شده |
| source_title | string | عنوان صفحه منبع |
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
| selected_model | string | مدل انتخابی AI |
| started_at | ISO string | زمان شروع |
| updated_at | ISO string | آخرین به‌روزرسانی |

---

## سیستم امتیازدهی بهبود‌یافته (۱-۱۰)

### فرمول جدید
```ts
// scorer.ts - منطق جدید
function computeNormalizedScore(
  matchedCount: number,    // تعداد تگ‌های مشترک
  totalTags: number,       // کل تگ‌های غیرنال صفحه منبع
  weights: Record<string, number>,
  matchedTags: string[],
  mode: 'linear' | 'weighted'
): number {
  
  if (mode === 'linear') {
    // خطی ساده: نسبت تگ‌های مشترک به کل
    const ratio = matchedCount / Math.max(totalTags, 1);
    return Math.round(ratio * 10 * 10) / 10; // امتیاز ۰.۰ تا ۱۰.۰
  }
  
  // وزن‌دار: مجموع وزن‌های تگ‌های مشترک تقسیم بر مجموع وزن‌های کل
  let matchedWeight = 0;
  let totalWeight = 0;
  
  matchedTags.forEach(tag => {
    matchedWeight += weights[tag] || 1;
  });
  
  Object.keys(weights).forEach(tag => {
    totalWeight += weights[tag];
  });
  
  const ratio = matchedWeight / Math.max(totalWeight, 1);
  return Math.round(ratio * 10 * 10) / 10; // امتیاز ۰.۰ تا ۱۰.۰
}
```

### وزن‌های پیش‌فرض (Priority Weights)
```ts
const DEFAULT_WEIGHTS: Record<string, number> = {
  'شهر_یا_جزیره_مقصد'   : 5,   // بالاترین اهمیت
  'کشور_مقصد'           : 4,
  'نوع_تور'             : 3,
  'ماه_تقویمی_برگزاری'  : 3,
  'فصل_برگزاری'         : 3,
  'قاره_یا_منطقه'       : 2,
  'جهت_در_منطقه'        : 2,
  'تم_یا_هدف_سفر'       : 2,
  'نوع_سفر'             : 2,
  'شهر_یا_استان_مبدا'   : 1,   // کمترین اهمیت
  'تعطیلات_خاص_تقویمی'  : 1,
  'رویداد_یا_مناسبت_خاص': 1,
  'نوع_وسیله_نقلیه'     : 1,
  'نام_دقیق_هتل'        : 1,
  'تعداد_ستاره_هتل'     : 1,
  'برچسب_کلاسی_تور'     : 1,
  'پرسونای_مخاطب'       : 1,
  'وضعیت_ویزا'          : 1,
};
```

---

## جریان داده AI (بازنگری شده)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     جریان پیشنهاد لینک                              │
└─────────────────────────────────────────────────────────────────────┘

۱. کاربر دکمه "تحلیل هوشمند" را می‌زند
            │
            ▼
۲. امتیازدهی الگوریتمی (scorer.ts)
   - برای هر صفحه: یافتن تمام کاندیداها
   - محاسبه امتیاز ۱-۱۰ برای هر کاندیدا
   - مرتب‌سازی بر اساس امتیاز (نزولی)
   - ذخیره در جدول candidates
            │
            ▼
۳. فیلتر برای AI
   - انتخاب ۳۰ کاندیدای برتر (بر اساس امتیاز)
   - ارسال به Gemini API
            │
            ▼
۴. پردازش AI (gemini.ts)
   - AI از ۳۰ کاندیدا، ۱۵ مرتبط‌ترین را انتخاب می‌کند
   - برای هر کدام دلیل ۱ خطی می‌نویسد
   - شماره‌گذاری به ترتیب اولویت (۱ تا ۱۵)
            │
            ▼
۵. ذخیره نتیجه (results table)
   - ذخیره فوری بعد از هر صفحه
   - اگر خطا: ثبت در queue و توقف
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

## درخت فایل (ساختار هدف بعد از ریفکتور)

```
src/
├── App.tsx                      ← [ویرایش] یکسان‌سازی max-width، اضافه کردن ToastProvider
├── main.tsx
├── db.ts                        ← [ویرایش] بهبود تایپ‌ها
│
├── components/
│   ├── ui/
│   │   ├── Badge.tsx            ← [ویرایش] اضافه کردن className prop
│   │   ├── Button.tsx
│   │   ├── Spinner.tsx
│   │   ├── Input.tsx            ← [جدید] کامپوننت Input یکپارچه
│   │   ├── Toast.tsx            ← [جدید] سیستم Toast شناور
│   │   ├── Modal.tsx            ← [جدید] مودال با Focus Trap
│   │   └── EmptyState.tsx       ← [جدید] کامپوننت Empty State
│   │
│   ├── CandidateCard.tsx        ← [ویرایش] بهبود استایل
│   ├── ProjectCard.tsx          ← [ویرایش] حذف آیکون Trash برای deselect
│   ├── ProjectEmptyState.tsx
│   ├── QueueProgress.tsx
│   ├── Breadcrumb.tsx           ← [جدید] ناوبری
│   └── ConfirmDialog.tsx        ← [جدید] جایگزین confirm()
│
├── hooks/
│   ├── useAnalysisQueue.ts
│   ├── useProject.ts
│   ├── useToast.ts              ← [جدید] مدیریت Toast
│   └── useDebounce.ts           ← [جدید] debounce برای جستجو
│
├── pages/
│   ├── Home.tsx                 ← [ویرایش] جایگزینی confirm() با ConfirmDialog
│   ├── NewProject.tsx           ← [ویرایش] بهبود آپلود فایل
│   ├── Config.tsx               ← [ویرایش] یکسان‌سازی max-width
│   ├── ProjectPages.tsx         ← [ویرایش] بهبود عمده UI/UX
│   ├── PageDetail.tsx           ← [ویرایش] بهبود عمده UI/UX
│   └── Results.tsx              ← [ویرایش] جدول ریسپانسیو
│
├── utils/
│   ├── scorer.ts                ← [ویرایش] سیستم امتیازدهی ۱-۱۰
│   ├── gemini.ts                ← [ویرایش] پرامپت جدید (۳۰→۱۵)
│   ├── queueProcessor.ts        ← [ویرایش] رفع race condition
│   ├── candidateStorage.ts
│   └── csvParser.ts             ← [ویرایش] اضافه کردن sanitization
│
├── contexts/
│   └── ToastContext.tsx         ← [جدید] Context برای Toast
│
└── constants/
    ├── categories.ts
    └── theme.ts                 ← [جدید] رنگ‌ها و تم یکپارچه
```

---

## نکات امنیتی

- کلید Gemini API از طریق **سرور پروکسی** (`/api/gemini`) ارسال می‌شود
- در صورت نیاز به تنظیم دستی، فقط در `localStorage` با کلید `LINKMESH_API_KEY` ذخیره می‌شود
- هیچ‌گاه API Key در Dexie یا state برنامه نوشته نمی‌شود
- داده‌های CSV قبل از ذخیره **sanitize** می‌شوند (XSS Prevention)
- حداکثر حجم فایل CSV: **5MB**

---

## کامپوننت‌های UI استاندارد (API Reference)

### Toast
```tsx
// استفاده در هر کامپوننت
const { showToast } = useToast();

showToast({
  type: 'success' | 'error' | 'warning' | 'info',
  message: 'پیام برای کاربر',
  duration?: 3000 // پیش‌فرض
});
```

### Modal
```tsx
<Modal
  isOpen={boolean}
  onClose={() => void}
  title="عنوان مودال"
  size="sm" | "md" | "lg"
>
  {children}
</Modal>
```

### ConfirmDialog
```tsx
<ConfirmDialog
  isOpen={boolean}
  onConfirm={() => void}
  onCancel={() => void}
  title="حذف پروژه"
  message="این عمل قابل بازگشت نیست."
  confirmText="حذف"        // یا "Delete" برای عملیات خطرناک
  confirmType="danger"     // رنگ قرمز
  requireTyping="Delete"   // کاربر باید تایپ کند (اختیاری)
/>
```

### Input
```tsx
<Input
  label="نام پروژه"
  placeholder="مثال: نهال‌گشت ۱۴۰۵"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  error="پیام خطا"  // اختیاری
  helperText="توضیح کمکی"  // اختیاری
/>
```
