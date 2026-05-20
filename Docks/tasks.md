# tasks.md — نقشه راه ریفکتورینگ UI/UX و الگوریتم

> ترتیب تسک‌ها اجباری است. هر تسک روی خروجی تسک قبلی تکیه دارد.
> قبل از شروع هر تسک، فایل‌های CONTEXT_FILES را بخوان.
> **قانون طلایی**: هیچ تسکی نباید همزمان فایل یکسانی را بنویسد.

---

## فاز A: زیرساخت کامپوننت‌ها (Foundation Layer)

---

### تسک A1 — ساخت سیستم Toast شناور

**هدف:**
جایگزینی پیام‌های خطا/موفقیت inline با سیستم Toast شناور که Layout Shift ایجاد نکند.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/contexts/ToastContext.tsx`** (فایل جدید):
   - یک Context برای مدیریت لیست Toast ها
   - هر Toast دارای: `id`، `type` (success/error/warning/info)، `message`، `duration`
   - تابع `showToast()` برای اضافه کردن Toast جدید
   - Toast ها بعد از `duration` میلی‌ثانیه خودکار حذف شوند
   - **مهم**: از `setTimeout` با cleanup در `useEffect` استفاده کن تا Memory Leak نداشته باشیم

۲. **`src/components/ui/Toast.tsx`** (فایل جدید):
   - کامپوننت نمایش یک Toast
   - موقعیت: **گوشه پایین-چپ** (`fixed bottom-4 left-4`)
   - استایل بر اساس type:
     - success: `bg-green-50 border-green-200 text-green-800`
     - error: `bg-red-50 border-red-200 text-red-800`
     - warning: `bg-amber-50 border-amber-200 text-amber-800`
     - info: `bg-blue-50 border-blue-200 text-blue-800`
   - آیکون مناسب برای هر type (CheckCircle, AlertCircle, AlertTriangle, Info)
   - انیمیشن ورود: `animate-in slide-in-from-bottom-4 duration-200`
   - انیمیشن خروج: `animate-out fade-out duration-150`

۳. **`src/hooks/useToast.ts`** (فایل جدید):
   ```ts
   export function useToast() {
     const context = useContext(ToastContext);
     if (!context) throw new Error('useToast must be used within ToastProvider');
     return context;
   }
   ```

۴. **`src/App.tsx`** — اضافه کردن ToastProvider به root:
   ```tsx
   <ToastProvider>
     <BrowserRouter>
       ...
     </BrowserRouter>
   </ToastProvider>
   ```

**محدودیت‌های این تسک:**
- ✅ Toast ها stack شوند (چند Toast همزمان)
- ✅ حداکثر ۳ Toast همزمان نمایش داده شود
- ✅ کلیک روی Toast آن را ببندد
- ⛔ هنوز در صفحات استفاده نشود — فقط زیرساخت

`CONTEXT_FILES: ["Docks/PROJECT.md", "Docks/ARCHITECTURE.md", "src/App.tsx"]`

---

### تسک A2 — ساخت مودال و ConfirmDialog استاندارد

**هدف:**
ساختن کامپوننت Modal با Focus Trap و ConfirmDialog برای جایگزینی `confirm()` مرورگر.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/components/ui/Modal.tsx`** (فایل جدید):
   - Props: `isOpen`, `onClose`, `title`, `size` (sm/md/lg), `children`
   - Backdrop: `bg-gray-900/60 backdrop-blur-sm`
   - کلید `Escape` مودال را ببندد
   - کلیک روی Backdrop مودال را ببندد
   - **Focus Trap**: اولین عنصر focusable را focus کن
   - آیکون بستن: **فقط `X`** (نه Zap یا هر چیز دیگر)
   - انیمیشن: `scale-95 → scale-100` با `duration-200`

۲. **`src/components/ConfirmDialog.tsx`** (فایل جدید):
   - استفاده از Modal به عنوان base
   - Props: `isOpen`, `onConfirm`, `onCancel`, `title`, `message`, `confirmText`, `confirmType` (danger/warning/normal), `requireTyping?`
   - اگر `requireTyping` داده شده: input برای تایپ کلمه تایید
   - دکمه تایید غیرفعال تا کلمه درست تایپ شود
   - رنگ دکمه بر اساس `confirmType`:
     - danger: `bg-red-600 hover:bg-red-700`
     - warning: `bg-amber-500 hover:bg-amber-600`
     - normal: `bg-blue-600 hover:bg-blue-700`

**محدودیت‌های این تسک:**
- ✅ Modal قابل استفاده مجدد باشد
- ✅ ConfirmDialog برای عملیات مخرب (حذف پروژه) آماده باشد
- ⛔ هنوز در صفحات استفاده نشود

`CONTEXT_FILES: ["Docks/PROJECT.md", "src/components/ui/Button.tsx"]`

---

### تسک A3 — ساخت کامپوننت‌های Input و EmptyState

**هدف:**
ساختن کامپوننت‌های UI استاندارد برای فرم‌ها و وضعیت‌های خالی.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/components/ui/Input.tsx`** (فایل جدید):
   - Props: `label?`, `placeholder`, `value`, `onChange`, `error?`, `helperText?`, `type`, `disabled`
   - استایل پایه: `w-full px-4 py-3 rounded-xl border`
   - Focus: `focus:ring-2 focus:ring-blue-500 focus:border-blue-500`
   - Error: `border-red-300 focus:ring-red-500`
   - Label: `text-sm font-medium text-gray-700 mb-1.5`
   - Error message: `text-xs text-red-600 mt-1.5`
   - Helper text: `text-xs text-gray-500 mt-1.5`

۲. **`src/components/ui/EmptyState.tsx`** (فایل جدید):
   - Props: `icon`, `title`, `description`, `action?` (دکمه CTA)
   - طراحی: آیکون بزرگ (۶۴px) در مرکز، عنوان bold، توضیح gray-500
   - Padding: `py-16`
   - اگر action داده شده: Button زیر توضیح

۳. **`src/components/ui/Badge.tsx`** — اضافه کردن className prop:
   ```tsx
   interface BadgeProps {
     children: React.ReactNode;
     variant?: 'blue' | 'gray' | 'green' | 'red' | 'amber';
     className?: string;  // اضافه شود
   }
   ```

**محدودیت‌های این تسک:**
- ✅ Input باید RTL-friendly باشد
- ✅ EmptyState برای جستجوی بدون نتیجه قابل استفاده باشد
- ⛔ هنوز در صفحات استفاده نشود

`CONTEXT_FILES: ["Docks/PROJECT.md", "src/components/ui/Badge.tsx", "src/components/ui/Button.tsx"]`

---

### تسک A4 — ساخت Breadcrumb و هوک useDebounce

**هدف:**
ساختن کامپوننت ناوبری و هوک debounce برای جستجو.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/components/Breadcrumb.tsx`** (فایل جدید):
   - Props: `items: Array<{ label: string, href?: string }>`
   - آخرین آیتم href ندارد و bold است
   - جداکننده: `/` یا `>`
   - لینک‌ها با hover:text-blue-600

۲. **`src/hooks/useDebounce.ts`** (فایل جدید):
   ```ts
   export function useDebounce<T>(value: T, delay: number = 300): T {
     const [debouncedValue, setDebouncedValue] = useState(value);
     
     useEffect(() => {
       const timer = setTimeout(() => setDebouncedValue(value), delay);
       return () => clearTimeout(timer);
     }, [value, delay]);
     
     return debouncedValue;
   }
   ```

۳. **`src/constants/theme.ts`** (فایل جدید):
   ```ts
   // رنگ‌های یکپارچه برای کل اپلیکیشن
   export const COLORS = {
     primary: 'blue-600',
     primaryHover: 'blue-700',
     success: 'green-600',
     error: 'red-600',
     warning: 'amber-500',
   } as const;
   
   // max-width یکپارچه برای تمام صفحات
   export const CONTAINER_WIDTH = 'max-w-6xl';
   ```

**محدودیت‌های این تسک:**
- ✅ useDebounce با cleanup صحیح
- ✅ Breadcrumb با RTL support
- ⛔ هنوز در صفحات استفاده نشود

`CONTEXT_FILES: ["Docks/PROJECT.md"]`

---

## فاز B: بهبود الگوریتم امتیازدهی

---

### تسک B1 — سیستم امتیازدهی ۱-۱۰

**هدف:**
تغییر سیستم امتیازدهی از «تعداد تگ‌های مشترک» به «امتیاز نرمالایز شده ۱-۱۰» برای رتبه‌بندی بهتر کاندیداها.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/utils/scorer.ts`** — بازنویسی کامل:

   **Interface جدید:**
   ```ts
   export interface CandidateWithTags {
     page_id: number;
     title: string;
     score: number;           // امتیاز ۱-۱۰ (با یک رقم اعشار)
     matched_tags: string[];  // نام تگ‌های مشترک
     matched_count: number;   // تعداد تگ‌های مشترک
   }
   ```

   **تابع جدید `computeNormalizedScore`:**
   ```ts
   function computeNormalizedScore(
     sourceCategories: Record<string, string | null>,
     candidateCategories: Record<string, string | null>,
     weights: Record<string, number>,
     mode: 'linear' | 'weighted'
   ): { score: number; matchedTags: string[]; matchedCount: number } {
     
     const matchedTags: string[] = [];
     
     // یافتن تگ‌های مشترک
     Object.keys(sourceCategories).forEach(key => {
       const sourceVal = sourceCategories[key];
       const candidateVal = candidateCategories[key];
       if (sourceVal && candidateVal && sourceVal === candidateVal) {
         matchedTags.push(key);
       }
     });
     
     const matchedCount = matchedTags.length;
     
     // شمارش تگ‌های غیرنال صفحه منبع
     const nonNullSourceTags = Object.values(sourceCategories).filter(v => v !== null).length;
     
     let score: number;
     
     if (mode === 'linear') {
       // خطی: نسبت ساده
       score = (matchedCount / Math.max(nonNullSourceTags, 1)) * 10;
     } else {
       // وزن‌دار: مجموع وزن‌های مشترک / مجموع وزن‌های صفحه منبع
       let matchedWeight = 0;
       let totalWeight = 0;
       
       matchedTags.forEach(tag => {
         matchedWeight += weights[tag] || 1;
       });
       
       Object.keys(sourceCategories).forEach(key => {
         if (sourceCategories[key] !== null) {
           totalWeight += weights[key] || 1;
         }
       });
       
       score = (matchedWeight / Math.max(totalWeight, 1)) * 10;
     }
     
     // گرد کردن به یک رقم اعشار
     score = Math.round(score * 10) / 10;
     
     return { score, matchedTags, matchedCount };
   }
   ```

   **تغییر در `findTopCandidates`:**
   - فیلتر: فقط کاندیداهایی که `score >= 1.0` دارند
   - مرتب‌سازی: اول بر اساس `score` نزولی، سپس بر اساس `matched_count` نزولی
   - خروجی: آرایه با ساختار جدید

۲. **تست دستی:**
   - صفحه‌ای با ۱۰ تگ غیرنال داریم
   - کاندیدایی با ۵ تگ مشترک باید امتیاز `5.0` بگیرد (حالت linear)
   - کاندیدایی با ۱۰ تگ مشترک باید امتیاز `10.0` بگیرد

**محدودیت‌های این تسک:**
- ✅ توابع قبلی (`getMatchedTags`, `computeScore`) حذف شوند
- ✅ Type ها دقیق باشند (نه `any`)
- ⛔ صفحات UI هنوز تغییر نکنند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/constants/categories.ts"]`

---

### تسک B2 — بروزرسانی candidateStorage و gemini.ts

**هدف:**
تطبیق دادن توابع ذخیره‌سازی و پرامپت AI با سیستم امتیازدهی جدید.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/utils/candidateStorage.ts`** — بروزرسانی:
   - استفاده از `CandidateWithTags` جدید
   - ذخیره `matched_count` در `candidate_list`

۲. **`src/utils/gemini.ts`** — تغییر پرامپت:
   ```ts
   export function buildSinglePagePrompt(
     sourcePage: { title: string; categories: object },
     candidates: CandidateWithTags[]  // حداکثر ۳۰ تا
   ): string {
     
     // فقط ۳۰ کاندیدای برتر به AI ارسال می‌شود
     const top30 = candidates.slice(0, 30);
     
     return `
   تو یک متخصص SEO و معمار محتوا هستی. وظیفه تو انتخاب ۱۵ لینک داخلی برتر از بین ۳۰ کاندیدای پیشنهادی است.

   استراتژی انتخاب:
   1. اولویت اول: کاندیداهایی با امتیاز بالاتر (نزدیک‌تر به ۱۰)
   2. اولویت دوم: تعداد تگ‌های مشترک بیشتر
   3. اولویت سوم: ارتباط معنایی و تکمیل‌کنندگی سفر کاربر

   دستورالعمل حیاتی:
   - دقیقاً ۱۵ لینک انتخاب کن (نه کمتر، نه بیشتر)
   - لینک‌ها را به ترتیب اولویت شماره‌گذاری کن (۱ = مهم‌ترین)
   - برای هر لینک یک دلیل ۱ خطی بنویس

   خروجی را فقط به صورت JSON معتبر برگردان:
   {
     "selected_links": [
       { "rank": 1, "page_id": 12, "title": "...", "reason": "..." },
       { "rank": 2, "page_id": 45, "title": "...", "reason": "..." }
     ]
   }

   --- صفحه اصلی ---
   عنوان: ${sourcePage.title}
   اطلاعات: ${JSON.stringify(sourcePage.categories)}

   --- ۳۰ کاندیدای برتر (به ترتیب امتیاز) ---
   ${top30.map((c, i) => `${i + 1}. [ID: ${c.page_id}] ${c.title} | امتیاز: ${c.score}/10 | تگ‌های مشترک: ${c.matched_count} (${c.matched_tags.join(', ')})`).join('\n')}
   `;
   }
   ```

۳. **`src/utils/queueProcessor.ts`** — رفع Race Condition:
   - اضافه کردن `processingRef` برای جلوگیری از اجرای همزمان
   - بهبود error handling

**محدودیت‌های این تسک:**
- ✅ AI حداکثر ۳۰ کاندیدا دریافت کند
- ✅ AI دقیقاً ۱۵ لینک برگرداند
- ✅ لینک‌ها شماره‌گذاری شوند (rank)
- ⛔ صفحات UI هنوز تغییر نکنند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/utils/gemini.ts", "src/utils/candidateStorage.ts", "src/utils/queueProcessor.ts"]`

---

## فاز C: اصلاحات صفحات اصلی

---

### تسک C1 — اصلاح Home.tsx

**هدف:**
جایگزینی `confirm()` با ConfirmDialog و بهبود کارت‌های پروژه.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/pages/Home.tsx`**:
   - اضافه کردن state برای `deleteDialogOpen` و `projectToDelete`
   - جایگزینی `confirm()` با `ConfirmDialog`:
     ```tsx
     <ConfirmDialog
       isOpen={deleteDialogOpen}
       onConfirm={handleConfirmDelete}
       onCancel={() => setDeleteDialogOpen(false)}
       title="حذف پروژه"
       message={`آیا از حذف پروژه "${projectToDelete?.name}" و تمام داده‌های آن مطمئن هستید؟`}
       confirmText="Delete"
       confirmType="danger"
       requireTyping="Delete"
     />
     ```
   - استفاده از Toast برای نمایش نتیجه حذف

۲. **`src/components/ProjectCard.tsx`**:
   - جداسازی بصری دکمه حذف از سایر دکمه‌ها
   - دکمه حذف: آیکون کوچکتر، رنگ خاکستری، hover:red
   - دکمه‌های اصلی: رنگ آبی، بزرگتر

**محدودیت‌های این تسک:**
- ✅ هیچ `confirm()` باقی نماند
- ✅ Toast برای نتیجه عملیات
- ⛔ منطق حذف تغییر نکند

`CONTEXT_FILES: ["src/pages/Home.tsx", "src/components/ProjectCard.tsx", "src/components/ConfirmDialog.tsx", "src/hooks/useToast.ts"]`

---

### تسک C2 — اصلاح ProjectPages.tsx (بخش اول: UI)

**هدف:**
رفع مشکلات UI شامل آیکون Zap، دکمه‌های Radio، و Layout یکپارچه.

**راهنمای پیاده‌سازی فنی:**

۱. **آیکون بستن مودال:**
   - جایگزینی `<Zap />` با `<X />` برای بستن مودال Setup

۲. **انتخاب نوع تحلیل (دامنه پردازش):**
   - جایگزینی دکمه‌های رنگی با Radio Group:
     ```tsx
     <div className="space-y-2">
       <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-gray-50">
         <input type="radio" name="analysisMode" checked={analysisMode === 'pending'} onChange={() => setAnalysisMode('pending')} />
         <div>
           <span className="font-medium">فقط صفحات بررسی نشده</span>
           <p className="text-xs text-gray-500">ادامه از جایی که متوقف شده</p>
         </div>
       </label>
       <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-gray-50">
         <input type="radio" name="analysisMode" checked={analysisMode === 'all'} onChange={() => setAnalysisMode('all')} />
         <div>
           <span className="font-medium">بررسی مجدد همه صفحات</span>
           <p className="text-xs text-gray-500">نتایج قبلی پاک می‌شود</p>
         </div>
       </label>
     </div>
     ```

۳. **یکپارچه‌سازی Container Width:**
   - جایگزینی `max-w-7xl` یا هر چیز دیگر با `max-w-6xl`

۴. **اضافه کردن Breadcrumb:**
   ```tsx
   <Breadcrumb items={[
     { label: 'داشبورد', href: '/' },
     { label: project.name }
   ]} />
   ```

۵. **بهبود جستجو با Debounce:**
   ```tsx
   const debouncedSearchTerm = useDebounce(searchTerm, 300);
   const filteredPages = useMemo(() => {
     if (!pages) return [];
     return pages.filter(p => p.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
   }, [pages, debouncedSearchTerm]);
   ```

**محدودیت‌های این تسک:**
- ✅ آیکون Zap حذف شود
- ✅ Radio Group جایگزین دکمه‌های رنگی شود
- ✅ Debounce برای جستجو
- ⛔ منطق پردازش تغییر نکند

`CONTEXT_FILES: ["src/pages/ProjectPages.tsx", "src/components/Breadcrumb.tsx", "src/hooks/useDebounce.ts"]`

---

### تسک C3 — اصلاح ProjectPages.tsx (بخش دوم: منطق)

**هدف:**
حذف autoScore خودکار و اضافه کردن Pagination.

**راهنمای پیاده‌سازی فنی:**

۱. **حذف autoScore از useEffect:**
   - کامنت یا حذف کامل بلاک `useEffect` که `autoScore` را اجرا می‌کند
   - امتیازدهی الگوریتمی **فقط** با دکمه "تحلیل هوشمند" اجرا شود

۲. **رفع Race Condition در processQueue:**
   - اضافه کردن ref برای track کردن اجرای فعلی:
     ```tsx
     const isProcessingRef = useRef(false);
     
     useEffect(() => {
       if (queue?.status === 'processing' && !isProcessingRef.current) {
         isProcessingRef.current = true;
         processQueue(id)
           .catch(console.error)
           .finally(() => {
             isProcessingRef.current = false;
             setIsProcessing(false);
           });
       }
     }, [queue?.status, id]);
     ```

۳. **اضافه کردن Pagination:**
   ```tsx
   const ITEMS_PER_PAGE = 50;
   const [currentPage, setCurrentPage] = useState(1);
   
   const paginatedPages = useMemo(() => {
     const start = (currentPage - 1) * ITEMS_PER_PAGE;
     return filteredPages.slice(start, start + ITEMS_PER_PAGE);
   }, [filteredPages, currentPage]);
   
   const totalPagesCount = Math.ceil(filteredPages.length / ITEMS_PER_PAGE);
   ```
   
   UI Pagination:
   ```tsx
   {totalPagesCount > 1 && (
     <div className="flex justify-center gap-2 py-4">
       <Button variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
         قبلی
       </Button>
       <span className="px-4 py-2 text-sm text-gray-600">
         صفحه {currentPage} از {totalPagesCount}
       </span>
       <Button variant="secondary" disabled={currentPage === totalPagesCount} onClick={() => setCurrentPage(p => p + 1)}>
         بعدی
       </Button>
     </div>
   )}
   ```

۴. **بهبود Empty State:**
   ```tsx
   {filteredPages.length === 0 && (
     <EmptyState
       icon={<Search size={48} />}
       title="صفحه‌ای یافت نشد"
       description="عبارت جستجو را تغییر دهید یا فیلترها را بردارید."
     />
   )}
   ```

**محدودیت‌های این تسک:**
- ✅ autoScore خودکار حذف شود
- ✅ Race Condition رفع شود
- ✅ Pagination کار کند
- ⛔ UI کارت‌ها تغییر نکند

`CONTEXT_FILES: ["src/pages/ProjectPages.tsx", "src/components/ui/EmptyState.tsx"]`

---

### تسک C4 — اصلاح PageDetail.tsx (بخش اول: UI)

**هدف:**
یکپارچه‌سازی تم، رفع مشکل آیکون Trash، و بهبود Layout.

**راهنمای پیاده‌سازی فنی:**

۱. **یکپارچه‌سازی Container Width:**
   - جایگزینی `max-w-[1400px]` با `max-w-6xl`

۲. **رفع تم دارک در ستون سمت راست (Page Attributes):**
   - جایگزینی `bg-gray-900` با `bg-white border border-gray-200`
   - متن‌ها: `text-gray-900` بجای `text-white`
   - زیرعنوان‌ها: `text-gray-500` بجای `text-gray-400`

۳. **جایگزینی آیکون Trash2 با X برای deselect:**
   ```tsx
   <button onClick={() => setSelectedLinks(selectedLinks.filter(l => l.page_id !== link.page_id))}>
     <X size={18} />  {/* بجای Trash2 */}
   </button>
   ```

۴. **حذف tracking-widest از متن فارسی:**
   - جستجو و حذف `tracking-widest` از تمام عناصر متنی فارسی

۵. **اضافه کردن Breadcrumb:**
   ```tsx
   <Breadcrumb items={[
     { label: 'داشبورد', href: '/' },
     { label: project?.name || '', href: `/project/${pId}` },
     { label: page.title }
   ]} />
   ```

۶. **بهبود انیمیشن‌ها:**
   - جایگزینی `duration-500` و `duration-700` با `duration-200` یا `duration-300`

**محدودیت‌های این تسک:**
- ✅ تم یکپارچه شود
- ✅ آیکون Trash2 با X جایگزین شود
- ✅ tracking-widest حذف شود
- ⛔ منطق ذخیره تغییر نکند

`CONTEXT_FILES: ["src/pages/PageDetail.tsx", "src/components/Breadcrumb.tsx"]`

---

### تسک C5 — اصلاح PageDetail.tsx (بخش دوم: Toast و Unsaved)

**هدف:**
جایگزینی پیام‌های inline با Toast و اضافه کردن نشانگر Unsaved Changes.

**راهنمای پیاده‌سازی فنی:**

۱. **جایگزینی پیام خطا/موفقیت با Toast:**
   - حذف متغیر `error` و UI مربوط به آن
   - استفاده از `showToast`:
     ```tsx
     const { showToast } = useToast();
     
     // در handleAIAnalysis:
     showToast({ type: 'success', message: 'تحلیل هوشمند با موفقیت انجام شد' });
     // یا
     showToast({ type: 'error', message: err.message });
     
     // در handleSaveManual:
     showToast({ type: 'success', message: 'تغییرات ذخیره شد' });
     ```

۲. **رفع Memory Leak در setTimeout:**
   - حذف `setTimeout(() => setError(null), 3000)`
   - Toast خودش Timeout دارد

۳. **اضافه کردن نشانگر Unsaved Changes:**
   ```tsx
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   
   // هر وقت selectedLinks تغییر کرد:
   useEffect(() => {
     if (result) {
       const originalLinks = JSON.parse(result.recommended_links);
       const isChanged = JSON.stringify(originalLinks) !== JSON.stringify(selectedLinks);
       setHasUnsavedChanges(isChanged);
     }
   }, [selectedLinks, result]);
   
   // نمایش در UI:
   {hasUnsavedChanges && (
     <Badge variant="amber" className="animate-pulse">
       تغییرات ذخیره نشده
     </Badge>
   )}
   ```

۴. **Confirmation قبل از ترک صفحه:**
   ```tsx
   useEffect(() => {
     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
       if (hasUnsavedChanges) {
         e.preventDefault();
         e.returnValue = '';
       }
     };
     window.addEventListener('beforeunload', handleBeforeUnload);
     return () => window.removeEventListener('beforeunload', handleBeforeUnload);
   }, [hasUnsavedChanges]);
   ```

**محدودیت‌های این تسک:**
- ✅ پیام‌های inline حذف شوند
- ✅ Toast جایگزین شود
- ✅ Memory Leak رفع شود
- ✅ Unsaved indicator کار کند

`CONTEXT_FILES: ["src/pages/PageDetail.tsx", "src/hooks/useToast.ts"]`

---

### تسک C6 — اصلاح Results.tsx

**هدف:**
جدول ریسپانسیو و بهبود Empty State.

**راهنمای پیاده‌سازی فنی:**

۱. **جدول ریسپانسیو:**
   - در موبایل: جدول به کارت تبدیل شود
   ```tsx
   {/* Desktop */}
   <div className="hidden md:block overflow-x-auto">
     <table>...</table>
   </div>
   
   {/* Mobile */}
   <div className="md:hidden space-y-4">
     {filteredResults.map(result => (
       <div className="bg-white p-4 rounded-xl border space-y-3">
         <h4 className="font-bold">{result.source_title}</h4>
         <div className="flex gap-2">
           <Badge>{links.length} لینک</Badge>
           <Badge>{result.is_manual_edit ? 'دستی' : 'هوشمند'}</Badge>
         </div>
         {/* expandable links */}
       </div>
     ))}
   </div>
   ```

۲. **یکپارچه‌سازی Container Width:**
   - اضافه کردن `max-w-6xl mx-auto` به container اصلی

۳. **بهبود Empty State:**
   - استفاده از کامپوننت `EmptyState`

۴. **اضافه کردن Breadcrumb:**
   ```tsx
   <Breadcrumb items={[
     { label: 'داشبورد', href: '/' },
     { label: project?.name || '', href: `/project/${projectId}` },
     { label: 'نتایج نهایی' }
   ]} />
   ```

**محدودیت‌های این تسک:**
- ✅ جدول در موبایل کارت شود
- ✅ Breadcrumb اضافه شود
- ⛔ منطق export تغییر نکند

`CONTEXT_FILES: ["src/pages/Results.tsx", "src/components/Breadcrumb.tsx", "src/components/ui/EmptyState.tsx"]`

---

### تسک C7 — اصلاح Config.tsx و NewProject.tsx

**هدف:**
یکپارچه‌سازی Layout و بهبود UX فرم‌ها.

**راهنمای پیاده‌سازی فنی:**

۱. **`src/pages/Config.tsx`**:
   - جایگزینی `max-w-4xl` با `max-w-6xl`
   - اضافه کردن Breadcrumb
   - استفاده از کامپوننت Input استاندارد برای API Key
   - Toast برای ذخیره موفق

۲. **`src/pages/NewProject.tsx`**:
   - جایگزینی `max-w-3xl` با `max-w-6xl`
   - اضافه کردن Breadcrumb
   - **محدودیت حجم فایل:**
     ```tsx
     const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
     
     if (selectedFile.size > MAX_FILE_SIZE) {
       showToast({ type: 'error', message: 'حداکثر حجم فایل ۵ مگابایت است' });
       return;
     }
     ```
   - بهبود Spinner برای پردازش CSV
   - Toast برای نتیجه عملیات

**محدودیت‌های این تسک:**
- ✅ Layout یکپارچه شود
- ✅ محدودیت حجم فایل اضافه شود
- ⛔ منطق پارس CSV تغییر نکند

`CONTEXT_FILES: ["src/pages/Config.tsx", "src/pages/NewProject.tsx", "src/components/Breadcrumb.tsx", "src/hooks/useToast.ts"]`

---

## فاز D: امنیت و بهینه‌سازی

---

### تسک D1 — بهبود امنیت و Type Safety

**هدف:**
رفع مشکلات امنیتی و بهبود TypeScript types.

**راهنمای پیاده‌سازی فنی:**

۱. **Sanitize داده‌های CSV:**
   - در `src/utils/csvParser.ts`:
     ```ts
     function sanitizeString(str: string): string {
       return str
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#39;');
     }
     
     // استفاده در پارس CSV:
     rows.push({
       title: sanitizeString(row['عنوان_H1'] || ''),
       categories: JSON.stringify(sanitizedCategories)
     });
     ```

۲. **Safe JSON.parse:**
   - ساخت utility function:
     ```ts
     // src/utils/safeJson.ts
     export function safeJsonParse<T>(str: string, fallback: T): T {
       try {
         return JSON.parse(str);
       } catch {
         console.error('Failed to parse JSON:', str);
         return fallback;
       }
     }
     ```
   - جایگزینی `JSON.parse` های مستقیم با `safeJsonParse`

۳. **حذف any:**
   - در `src/components/ProjectCard.tsx`: تعریف interface `ProjectCardProps`
   - در `src/utils/scorer.ts`: تایپ دقیق برای categories
   - در `src/hooks/useProject.ts`: handle `undefined` projectId

۴. **بهبود Badge:**
   - اضافه کردن `className` prop که در تسک A3 تعریف شد

**محدودیت‌های این تسک:**
- ✅ XSS prevention
- ✅ Safe JSON parsing
- ✅ Type safety
- ⛔ رفتار برنامه تغییر نکند

`CONTEXT_FILES: ["src/utils/csvParser.ts", "src/utils/scorer.ts", "src/components/ProjectCard.tsx", "src/hooks/useProject.ts"]`

---

### تسک D2 — بهبود Performance

**هدف:**
رفع مشکلات عملکردی شامل JSON.parse در useMemo و کوئری‌های اضافی.

**راهنمای پیاده‌سازی فنی:**

۱. **کش کردن JSON.parse در Results.tsx:**
   ```tsx
   const parsedResults = useMemo(() => {
     if (!results) return [];
     return results.map(r => ({
       ...r,
       links: safeJsonParse(r.recommended_links, [])
     }));
   }, [results]);
   
   // استفاده در stats:
   const stats = useMemo(() => {
     if (parsedResults.length === 0) return null;
     const totalLinks = parsedResults.reduce((sum, r) => sum + r.links.length, 0);
     return { ... };
   }, [parsedResults]);
   ```

۲. **بهبود کوئری ProjectCard:**
   - در `src/pages/Home.tsx`:
     ```tsx
     // یک کوئری برای همه page counts
     const pageCounts = useLiveQuery(async () => {
       const counts = new Map<number, number>();
       if (!projects) return counts;
       for (const p of projects) {
         counts.set(p.id!, await db.pages.where('project_id').equals(p.id!).count());
       }
       return counts;
     }, [projects]);
     
     // پاس دادن count به ProjectCard
     <ProjectCard project={project} pageCount={pageCounts?.get(project.id!) || 0} />
     ```

۳. **کاهش انیمیشن‌ها برای لیست‌های بزرگ:**
   - در ProjectPages: غیرفعال کردن `whileHover={{ y: -5 }}` اگر تعداد صفحات > ۵۰

**محدودیت‌های این تسک:**
- ✅ JSON.parse فقط یک بار اجرا شود
- ✅ کوئری‌های Dexie کاهش یابد
- ⛔ UI تغییر نکند

`CONTEXT_FILES: ["src/pages/Results.tsx", "src/pages/Home.tsx", "src/components/ProjectCard.tsx", "src/pages/ProjectPages.tsx"]`

---

### تسک D3 — تست نهایی و Cleanup

**هدف:**
بررسی نهایی، حذف کدهای اضافی، و تست کامل.

**راهنمای پیاده‌سازی فنی:**

۱. **چک‌لیست بررسی نهایی:**
   - [ ] هیچ `confirm()` باقی نمانده
   - [ ] هیچ `tracking-widest` روی متن فارسی نیست
   - [ ] هیچ آیکون `Zap` برای بستن مودال نیست
   - [ ] هیچ آیکون `Trash2` برای deselect نیست
   - [ ] تمام صفحات `max-w-6xl` دارند
   - [ ] تمام صفحات Breadcrumb دارند
   - [ ] تمام جستجوها Debounce دارند
   - [ ] Toast ها کار می‌کنند
   - [ ] Modal ها با Escape بسته می‌شوند
   - [ ] امتیازدهی ۱-۱۰ درست کار می‌کند
   - [ ] AI ۳۰ کاندیدا می‌گیرد و ۱۵ برمی‌گرداند

۲. **حذف کدهای اضافی:**
   - حذف `console.log` های debug
   - حذف کامنت‌های TODO قدیمی
   - حذف import های استفاده نشده

۳. **بررسی Accessibility:**
   - اضافه کردن `aria-label` به دکمه‌های آیکونی
   - اضافه کردن `role` به المان‌های interactive

**محدودیت‌های این تسک:**
- ✅ تمام آیتم‌های چک‌لیست تایید شوند
- ✅ کدهای اضافی حذف شوند
- ⛔ هیچ فیچر جدید اضافه نشود

`CONTEXT_FILES: ["Docks/PROJECT.md", "Docks/ARCHITECTURE.md"]`

---

## خلاصه وابستگی‌ها

```
A1 (Toast) ─────────────────────────────────────────┐
A2 (Modal) ─────────────────────────────────────────┤
A3 (Input/Empty) ───────────────────────────────────┼──► C1, C2, C3, C4, C5, C6, C7
A4 (Breadcrumb/Debounce) ───────────────────────────┤
                                                    │
B1 (Scorer) ───────────────────────────────────────┬┤
B2 (Gemini/Queue) ─────────────────────────────────┘│
                                                    │
C1 (Home) ──────────────────────────────────────────┤
C2 (ProjectPages UI) ───────────────────────────────┤
C3 (ProjectPages Logic) ────────────────────────────┼──► D1, D2, D3
C4 (PageDetail UI) ─────────────────────────────────┤
C5 (PageDetail Toast) ──────────────────────────────┤
C6 (Results) ───────────────────────────────────────┤
C7 (Config/New) ────────────────────────────────────┘
```

**توالی اجرا:**
1. فاز A (تسک‌های ۱-۴) — موازی قابل اجرا
2. فاز B (تسک‌های ۱-۲) — بعد از A، موازی قابل اجرا
3. فاز C (تسک‌های ۱-۷) — بعد از A و B
4. فاز D (تسک‌های ۱-۳) — بعد از C
