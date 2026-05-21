# tasks.md — نقشه راه مرجع (سیستم جدید بررسی لینک‌ها)

> ترتیب تسک‌ها اجباری است. هر تسک روی خروجی تسک قبلی تکیه دارد.
> قبل از شروع هر تسک، فایل‌های CONTEXT_FILES را بخوان.

---

## تسک ۱ — به‌روزرسانی اسکیمای دیتابیس

### هدف
اضافه کردن دو جدول جدید به Dexie: `candidates` (برای ذخیره ۲۰ کاندیدای هر صفحه) و `analysisQueue` (برای مدیریت صف پردازش AI).

### راهنمای پیاده‌سازی فنی

1. **`src/db.ts`**: نسخه دیتابیس را از 1 به 2 تغییر بده و دو جدول جدید اضافه کن:

   ```ts
   // جدول candidates — ۲۰ کاندیدای هر صفحه (قبل از AI)
   export interface Candidate {
     id?: number;
     project_id: number;
     source_page_id: number;
     candidate_list: string; // JSON آرایه: [{ page_id, title, score, matched_tags }]
     computed_at: string;
   }

   // جدول analysisQueue — صف پردازش AI
   export interface AnalysisQueue {
     id?: number;
     project_id: number;
     status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
     current_page_index: number;
     total_pages: number;
     error_message: string | null;
     started_at: string;
     updated_at: string;
   }
   ```

2. اسکیمای Dexie را آپدیت کن:
   ```ts
   this.version(2).stores({
     projects: '++id, name, created_at',
     pages: '++id, project_id, title',
     weights: '++id, project_id, category_name',
     candidates: '++id, project_id, source_page_id',
     results: '++id, project_id, source_page_id',
     analysisQueue: '++id, project_id'
   });
   ```

3. فیلد `is_manual_edit` را به interface `Result` اضافه کن.

### محدودیت‌های این تسک
- ✅ فقط تغییرات schema — هیچ منطق بیزینسی جدید
- ✅ از `upgrade()` برای migration استفاده نکن؛ این یک fresh install است
- ⛔ هیچ کامپوننت UI تغییر نکند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts"]`

---

## تسک ۲ — آپدیت موتور امتیازدهی برای نمایش تگ‌های مشترک

### هدف
تغییر در `scorer.ts` برای برگرداندن لیست تگ‌های مشترک علاوه بر امتیاز. این اطلاعات به کاربر نشان داده می‌شود و به AI هم برای تحلیل بهتر ارسال می‌شود.

### راهنمای پیاده‌سازی فنی

1. **`src/utils/scorer.ts`**:

   **تغییر در interface `Candidate`:**
   ```ts
   export interface CandidateWithTags {
     page_id: number;
     title: string;
     score: number;
     matched_tags: string[]; // فیلد جدید — نام تگ‌های مشترک
   }
   ```

   **اضافه کردن تابع جدید `getMatchedTags`:**
   ```ts
   // برگرداندن لیست تگ‌هایی که بین دو صفحه مشترک هستند
   export function getMatchedTags(catA: CategoriesMap, catB: CategoriesMap): string[] {
     const matched: string[] = [];
     Object.keys(catA).forEach((field) => {
       if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
         matched.push(field);
       }
     });
     return matched;
   }
   ```

   **تغییر در `findTopCandidates`:**
   - خروجی را از `Candidate[]` به `CandidateWithTags[]` تغییر بده
   - در map، علاوه بر score، فیلد `matched_tags` را هم با صدا زدن `getMatchedTags` پر کن

   **تغییر در `computeAllCandidates`:**
   - نوع خروجی Map را به `Map<number, CandidateWithTags[]>` تغییر بده

2. مطمئن شو که توابع موجود به درستی کار می‌کنند و هیچ چیز خراب نشود.

### محدودیت‌های این تسک
- ✅ توابع قبلی باید همچنان کار کنند (backward compatible)
- ✅ `matched_tags` باید نام فارسی فیلدها باشد (مثلاً `"کشور_مقصد"`)
- ⛔ هیچ side effect نباشد
- ⛔ هیچ import جدید لازم نیست

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/constants/categories.ts"]`

---

## تسک ۳ — ساخت تابع ذخیره‌سازی کاندیداها و Route جدید

### هدف
ساختن یک تابع که امتیازدهی الگوریتمی را اجرا کند و نتایج را در جدول `candidates` ذخیره کند. همچنین اضافه کردن route‌های جدید به App.tsx.

### راهنمای پیاده‌سازی فنی

1. **`src/utils/candidateStorage.ts`** (فایل جدید):
   ```ts
   // این تابع برای یک پروژه:
   // 1. تمام pages را بخوان
   // 2. computeAllCandidates را صدا بزن
   // 3. نتایج را در جدول candidates ذخیره کن
   
   export async function computeAndStoreCandidates(
     projectId: number,
     pages: Page[],
     weights: Record<string, number>,
     mode: 'linear' | 'weighted'
   ): Promise<void> {
     // کاندیداهای قبلی این پروژه را پاک کن
     await db.candidates.where('project_id').equals(projectId).delete();
     
     // محاسبه کاندیداها
     const candidatesMap = computeAllCandidates(pages, weights, mode);
     
     // آماده‌سازی برای bulk insert
     const now = new Date().toISOString();
     const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
       project_id: projectId,
       source_page_id: pageId,
       candidate_list: JSON.stringify(list),
       computed_at: now
     }));
     
     // ذخیره یکجا
     await db.candidates.bulkAdd(records);
   }
   ```

2. **`src/App.tsx`**: دو route جدید اضافه کن:
   ```tsx
   <Route path="/project/:projectId" element={<ProjectPages />} />
   <Route path="/project/:projectId/page/:pageId" element={<PageDetail />} />
   ```
   فعلاً برای کامپوننت‌ها placeholder بگذار (یک div ساده).

3. **`src/pages/ProjectPages.tsx`** (فایل جدید — placeholder):
   ```tsx
   export default function ProjectPages() {
     return <div>صفحه لیست صفحات پروژه — در تسک بعدی ساخته می‌شود</div>;
   }
   ```

4. **`src/pages/PageDetail.tsx`** (فایل جدید — placeholder):
   ```tsx
   export default function PageDetail() {
     return <div>صفحه جزئیات — در تسک بعدی ساخته می‌شود</div>;
   }
   ```

### محدودیت‌های این تسک
- ✅ تابع `computeAndStoreCandidates` باید transaction-safe باشد
- ✅ قبل از insert، رکوردهای قبلی پاک شوند
- ⛔ هنوز UI نمایش کاندیداها ساخته نشود

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts", "src/utils/scorer.ts", "src/App.tsx"]`

---

## تسک ۴ — صفحه لیست صفحات پروژه (ProjectPages)

### هدف
ساختن صفحه‌ای که تمام صفحات یک پروژه را نشان می‌دهد. هر صفحه قابل کلیک است. دکمه «تحلیل هوشمند همه صفحات» در بالا قرار دارد.

### یوزر فلو
1. کاربر از صفحه Home روی پروژه کلیک می‌کند و به این صفحه می‌رسد
2. می‌بیند: لیست تمام صفحات، وضعیت هر صفحه (تحلیل‌شده/نشده)، دکمه تحلیل کلی
3. می‌تواند روی هر صفحه کلیک کند تا به PageDetail برود
4. می‌تواند دکمه «تحلیل هوشمند همه صفحات» را بزند

### راهنمای پیاده‌سازی فنی

1. **`src/pages/ProjectPages.tsx`**:
   
   **Header:**
   - نام پروژه
   - دکمه «تحلیل هوشمند همه صفحات» (با آیکون Brain یا Sparkles)
   - دکمه «مشاهده نتایج نهایی» (لینک به Results)
   - دکمه «تنظیمات» (لینک به Config)

   **بخش وضعیت:**
   - اگر `analysisQueue` برای این پروژه وجود دارد و status=processing:
     - نمایش نوار پیشرفت: `current_page_index / total_pages`
     - دکمه «توقف موقت»
   - اگر status=paused:
     - نمایش «پردازش متوقف شده» + دکمه «ادامه»
   - اگر status=failed:
     - نمایش پیام خطا + دکمه «تلاش مجدد از ادامه»

   **لیست صفحات:**
   - یک جدول یا گرید از کارت‌ها
   - هر آیتم: عنوان صفحه، تعداد کاندیدا، وضعیت (آیکون چک اگر result دارد)
   - کلیک روی هر آیتم: navigate به `/project/:projectId/page/:pageId`

   **جستجو:**
   - یک input برای فیلتر کردن صفحات بر اساس عنوان

2. **داده‌خوانی:**
   ```ts
   const pages = useLiveQuery(() => db.pages.where('project_id').equals(projectId).toArray());
   const results = useLiveQuery(() => db.results.where('project_id').equals(projectId).toArray());
   const queue = useLiveQuery(() => db.analysisQueue.where('project_id').equals(projectId).first());
   ```

3. **منطق دکمه «تحلیل هوشمند همه صفحات»:**
   - اگر queue وجود ندارد یا status=completed/failed: یک queue جدید بساز و navigate به حالت پردازش
   - این دکمه فقط queue را می‌سازد — پردازش واقعی در تسک بعدی پیاده می‌شود

### محدودیت‌های این تسک
- ✅ از `useLiveQuery` برای reactive data استفاده کن
- ✅ UI باید responsive باشد (موبایل و دسکتاپ)
- ⛔ پردازش واقعی AI در این تسک پیاده نمی‌شود — فقط UI
- ⛔ دکمه تحلیل کلی فقط queue بسازد، نه اجرا

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts", "src/hooks/useProject.ts", "src/pages/Home.tsx", "src/components/ui/Button.tsx"]`

---

## تسک ۵ — صفحه جزئیات صفحه (PageDetail)

### هدف
ساختن صفحه‌ای که جزئیات یک صفحه خاص را نشان می‌دهد: اطلاعات صفحه، ۲۰ کاندیدا، لینک‌های انتخاب‌شده، و امکان ویرایش دستی.

### یوزر فلو
1. کاربر از ProjectPages روی یک صفحه کلیک می‌کند
2. می‌بیند: اطلاعات صفحه، لیست ۲۰ کاندیدا، لینک‌های پیشنهادی AI (اگر وجود دارد)
3. می‌تواند دکمه «بررسی با هوش مصنوعی» را بزند (فقط این صفحه)
4. می‌تواند لینک‌ها را دستی ویرایش کند: اضافه، حذف، تغییر اولویت

### راهنمای پیاده‌سازی فنی

1. **`src/pages/PageDetail.tsx`**:

   **Header:**
   - breadcrumb: نام پروژه > نام صفحه
   - دکمه «برگشت به لیست»
   - دکمه «بررسی با هوش مصنوعی» (فقط این صفحه)

   **بخش اطلاعات صفحه:**
   - عنوان صفحه (H1)
   - جدول تگ‌ها: نمایش ۱۸ فیلد دسته‌بندی که مقدار غیرnull دارند
   - نمایش زیبا با Badge برای هر تگ

   **بخش کاندیداها (۲۰ صفحه مشابه):**
   - عنوان: «صفحات مشابه (امتیازدهی الگوریتمی)»
   - لیست ۲۰ کاندیدا از جدول `candidates`
   - هر آیتم: عنوان، امتیاز، تگ‌های مشترک (به شکل Badge)
   - **قابلیت انتخاب دستی:** چک‌باکس کنار هر کاندیدا برای اضافه کردن به لینک‌های نهایی

   **بخش لینک‌های پیشنهادی (نتیجه AI یا دستی):**
   - عنوان: «لینک‌های انتخاب‌شده»
   - اگر result برای این صفحه وجود دارد: نمایش لینک‌ها با reason
   - اگر نه: «هنوز تحلیل نشده»
   - **قابلیت ویرایش:**
     - drag & drop برای تغییر اولویت
     - دکمه حذف برای هر لینک
     - اضافه کردن از لیست کاندیداها با چک‌باکس
   - دکمه «ذخیره تغییرات» که `is_manual_edit: true` ست می‌کند

2. **داده‌خوانی:**
   ```ts
   const page = useLiveQuery(() => db.pages.get(pageId));
   const candidate = useLiveQuery(() => db.candidates.where('source_page_id').equals(pageId).first());
   const result = useLiveQuery(() => db.results.where('source_page_id').equals(pageId).first());
   ```

3. **منطق دکمه «بررسی با هوش مصنوعی»:**
   - این دکمه فقط این یک صفحه را بررسی می‌کند (نه کل پروژه)
   - در تسک بعدی پیاده‌سازی می‌شود — فعلاً placeholder

### محدودیت‌های این تسک
- ✅ ویرایش دستی باید `is_manual_edit: true` بگذارد
- ✅ UI برای drag & drop می‌تواند ساده باشد (دکمه بالا/پایین کافی است)
- ⛔ پردازش AI در این تسک پیاده نمی‌شود
- ⛔ از کتابخانه drag & drop استفاده نکن — دستی پیاده کن

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts", "src/pages/ProjectPages.tsx", "src/components/ui/Badge.tsx", "src/components/ui/Button.tsx"]`

---

## تسک ۶ — پردازش AI تکی (یک صفحه)

### هدف
پیاده‌سازی منطق دکمه «بررسی با هوش مصنوعی» که فقط یک صفحه و ۲۰ کاندیدایش را به AI می‌فرستد.

### راهنمای پیاده‌سازی فنی

1. **`src/utils/gemini.ts`** — اضافه کردن تابع جدید:

   **تابع `buildSinglePagePrompt`:**
   ```ts
   export function buildSinglePagePrompt(
     sourcePage: { title: string; categories: object },
     candidates: CandidateWithTags[]
   ): string {
     // پرامپت مخصوص یک صفحه — بدون محدودیت تعداد
     return `
   SYSTEM:
   تو یک متخصص SEO هستی. وظیفه‌ات انتخاب بهترین لینک‌های داخلی است.

   USER:
   یک صفحه از سایت و ${candidates.length} صفحه کاندیدا برای لینک‌سازی داده شده.
   از بین کاندیداها، **هر صفحه‌ای که واقعاً از نظر معنایی مرتبط است را انتخاب کن**.
   تعداد مهم نیست — فقط کیفیت و ارتباط واقعی مهم است.
   اگر همه ۲۰ کاندیدا مرتبط هستند، همه را انتخاب کن.
   اگر فقط ۳ تا مرتبط هستند، فقط ۳ تا را انتخاب کن.

   معیار: شباهت معنایی، ارتباط موضوعی، و تکمیل‌کنندگی سفر کاربر.

   صفحه اصلی:
   - عنوان: ${sourcePage.title}
   - ویژگی‌ها: ${JSON.stringify(sourcePage.categories)}

   کاندیداها:
   ${candidates.map((c, i) => `${i + 1}. ${c.title} — امتیاز: ${c.score} — تگ‌های مشترک: ${c.matched_tags.join(', ')}`).join('\n')}

   خروجی را فقط به صورت JSON خالص بده (بدون markdown):
   {
     "selected_links": [
       { "page_id": 42, "title": "...", "reason": "..." }
     ]
   }
     `;
   }
   ```

2. **`src/pages/PageDetail.tsx`** — پیاده‌سازی دکمه AI:
   ```ts
   const handleAIAnalysis = async () => {
     setLoading(true);
     setError(null);
     
     try {
       const apiKey = localStorage.getItem('LINKMESH_API_KEY');
       if (!apiKey) throw new Error('کلید API وارد نشده است.');
       
       // گرفتن کاندیداها
       const candidateRecord = await db.candidates.where('source_page_id').equals(pageId).first();
       if (!candidateRecord) throw new Error('ابتدا امتیازدهی الگوریتمی انجام دهید.');
       
       const candidateList = JSON.parse(candidateRecord.candidate_list);
       const categories = JSON.parse(page.categories);
       
       // ساخت پرامپت — بدون محدودیت تعداد
       const prompt = buildSinglePagePrompt({ title: page.title, categories }, candidateList);
       
       // فراخوانی AI
       const response = await callGemini(prompt, apiKey);
       
       // ذخیره نتیجه
       await db.results.where('source_page_id').equals(pageId).delete();
       await db.results.add({
         project_id: projectId,
         source_page_id: pageId,
         recommended_links: JSON.stringify(response.selected_links),
         is_manual_edit: false,
         generated_at: new Date().toISOString()
       });
       
     } catch (err) {
       setError(err.message);
     } finally {
       setLoading(false);
     }
   };
   ```

### محدودیت‌های این تسک
- ✅ فقط یک صفحه + کاندیداهایش ارسال می‌شود
- ✅ نتیجه بلافاصله در `results` ذخیره می‌شود
- ✅ قبل از ذخیره، result قبلی این صفحه پاک شود
- ⛔ اگر API Key نبود، پیام خطا نشان بده

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/gemini.ts", "src/pages/PageDetail.tsx", "src/db.ts"]`

---

## تسک ۷ — سیستم صف پردازش AI (تحلیل کلی)

### هدف
پیاده‌سازی سیستم صفی که صفحات را یکی‌یکی به AI می‌فرستد، نتیجه هر کدام را فوراً ذخیره می‌کند، و در صورت قطع شدن، از همان جا ادامه می‌دهد.

### قوانین حیاتی
1. **هرگز همه صفحات یکجا ارسال نشوند** — فقط یک صفحه در هر call
2. **ذخیره دانه‌به‌دانه** — بلافاصله بعد از دریافت جواب هر صفحه، در Dexie ذخیره شود
3. **مکث بین درخواست‌ها** — ۲ ثانیه بین هر call (برای جلوگیری از rate limit)
4. **قابلیت resume** — اگر وسط کار قطع شد، از آخرین index ادامه دهد

### راهنمای پیاده‌سازی فنی

1. **`src/hooks/useAnalysisQueue.ts`** (فایل جدید):
   ```ts
   export function useAnalysisQueue(projectId: number) {
     const queue = useLiveQuery(() => db.analysisQueue.where('project_id').equals(projectId).first());
     
     // شروع پردازش جدید
     const startQueue = async (totalPages: number) => {
       // پاک کردن queue قبلی
       await db.analysisQueue.where('project_id').equals(projectId).delete();
       
       // ساخت queue جدید
       await db.analysisQueue.add({
         project_id: projectId,
         status: 'pending',
         current_page_index: 0,
         total_pages: totalPages,
         error_message: null,
         started_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       });
     };
     
     // ادامه پردازش متوقف‌شده
     const resumeQueue = async () => { ... };
     
     // توقف موقت
     const pauseQueue = async () => { ... };
     
     return { queue, startQueue, resumeQueue, pauseQueue };
   }
   ```

2. **`src/utils/queueProcessor.ts`** (فایل جدید):
   ```ts
   export async function processQueue(projectId: number) {
     const apiKey = localStorage.getItem('LINKMESH_API_KEY');
     if (!apiKey) throw new Error('کلید API وارد نشده است.');
     
     const queue = await db.analysisQueue.where('project_id').equals(projectId).first();
     if (!queue || queue.status === 'completed') return;
     
     // آپدیت status به processing
     await db.analysisQueue.update(queue.id!, { status: 'processing' });
     
     const pages = await db.pages.where('project_id').equals(projectId).toArray();
     const project = await db.projects.get(projectId);
     
     // شروع از current_page_index
     for (let i = queue.current_page_index; i < pages.length; i++) {
       // چک کردن آیا pause شده
       const currentQueue = await db.analysisQueue.get(queue.id!);
       if (currentQueue?.status === 'paused') break;
       
       const page = pages[i];
       
       try {
         // گرفتن کاندیداها
         const candidateRecord = await db.candidates.where('source_page_id').equals(page.id!).first();
         if (!candidateRecord) continue;
         
         const candidateList = JSON.parse(candidateRecord.candidate_list);
         const categories = JSON.parse(page.categories);
         
         // ساخت پرامپت — بدون محدودیت تعداد
         const prompt = buildSinglePagePrompt({ title: page.title, categories }, candidateList);
         
         // فراخوانی AI
         const response = await callGemini(prompt, apiKey);
         
         // ذخیره فوری
         await db.transaction('rw', db.results, db.analysisQueue, async () => {
           await db.results.where('source_page_id').equals(page.id!).delete();
           await db.results.add({
             project_id: projectId,
             source_page_id: page.id!,
             recommended_links: JSON.stringify(response.selected_links || []),
             is_manual_edit: false,
             generated_at: new Date().toISOString()
           });
           
           // آپدیت index
           await db.analysisQueue.update(queue.id!, {
             current_page_index: i + 1,
             updated_at: new Date().toISOString()
           });
         });
         
         // مکث ۲ ثانیه
         await new Promise(resolve => setTimeout(resolve, 2000));
         
       } catch (err) {
         // ذخیره خطا و توقف
         await db.analysisQueue.update(queue.id!, {
           status: 'failed',
           error_message: err.message,
           updated_at: new Date().toISOString()
         });
         throw err;
       }
     }
     
     // تکمیل موفق
     await db.analysisQueue.update(queue.id!, {
       status: 'completed',
       updated_at: new Date().toISOString()
     });
   }
   ```

3. **`src/components/QueueProgress.tsx`** (فایل جدید):
   - نوار پیشرفت visual
   - نمایش: «صفحه ۱۵ از ۱۲۰ در حال پردازش...»
   - دکمه‌های pause/resume/retry

### محدودیت‌های این تسک
- ✅ ذخیره بعد از هر صفحه — نه در انتها
- ✅ مکث ۲ ثانیه بین هر call
- ✅ از transaction برای ذخیره atomic استفاده کن
- ⛔ هرگز بیش از یک صفحه در هر call نفرستی
- ⛔ queue processor باید در یک useEffect اجرا شود، نه background worker

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts", "src/utils/gemini.ts", "src/pages/ProjectPages.tsx"]`

---

## تسک ۸ — اتصال کامپوننت‌های UI به سیستم صف

### هدف
اتصال صفحه ProjectPages به سیستم صف: نمایش پیشرفت، دکمه‌های کنترل، و اجرای پردازش.

### راهنمای پیاده‌سازی فنی

1. **`src/pages/ProjectPages.tsx`**:
   
   **اضافه کردن state و logic:**
   ```ts
   const { queue, startQueue, pauseQueue, resumeQueue } = useAnalysisQueue(projectId);
   const [isProcessing, setIsProcessing] = useState(false);
   
   // اجرای پردازش
   useEffect(() => {
     if (queue?.status === 'pending' || queue?.status === 'processing') {
       setIsProcessing(true);
       processQueue(projectId)
         .catch(console.error)
         .finally(() => setIsProcessing(false));
     }
   }, [queue?.status]);
   ```

   **دکمه «تحلیل هوشمند همه صفحات»:**
   ```tsx
   <Button
     onClick={async () => {
       // اول امتیازدهی الگوریتمی
       await computeAndStoreCandidates(projectId, pages, weightsRecord, project.scoring_mode);
       // شروع صف
       await startQueue(pages.length);
     }}
     disabled={isProcessing}
   >
     {isProcessing ? 'در حال پردازش...' : 'تحلیل هوشمند همه صفحات'}
   </Button>
   ```

   **بخش نمایش پیشرفت:**
   ```tsx
   {queue && queue.status !== 'completed' && (
     <QueueProgress
       current={queue.current_page_index}
       total={queue.total_pages}
       status={queue.status}
       error={queue.error_message}
       onPause={pauseQueue}
       onResume={resumeQueue}
     />
   )}
   ```

2. **آپدیت کردن وضعیت هر صفحه در لیست:**
   - اگر برای آن صفحه result وجود دارد: آیکون چک سبز
   - اگر در حال پردازش است (index فعلی): آیکون spinner
   - اگر هنوز نشده: بدون آیکون

### محدودیت‌های این تسک
- ✅ پردازش در useEffect باشد
- ✅ UI باید real-time آپدیت شود (با useLiveQuery)
- ⛔ پردازش نباید صفحه را block کند
- ⛔ اگر کاربر صفحه را ببندد و برگردد، باید وضعیت درست نمایش داده شود

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/ProjectPages.tsx", "src/hooks/useAnalysisQueue.ts", "src/utils/queueProcessor.ts", "src/components/QueueProgress.tsx"]`

---

## تسک ۹ — آپدیت صفحات Home و Results

### هدف
آپدیت کردن صفحات موجود برای کار با سیستم جدید: تغییر لینک‌ها، نمایش وضعیت پردازش، و اطمینان از یکپارچگی UX.

### راهنمای پیاده‌سازی فنی

1. **`src/pages/Home.tsx`**:
   - تغییر دکمه «مشاهده نتایج»: ابتدا به `/project/:id` برود (لیست صفحات)
   - اضافه کردن نمایش وضعیت پردازش اگر queue فعال است
   - اضافه کردن لینک مستقیم به Results (خروجی نهایی)

2. **`src/pages/Results.tsx`**:
   - حذف منطق `?analyze=true` — تحلیل در صفحه جدید انجام می‌شود
   - این صفحه فقط نمایش نتایج نهایی است
   - اضافه کردن لینک برگشت به ProjectPages

3. **`src/pages/Config.tsx`**:
   - تغییر دکمه «شروع تحلیل»: به جای Results، به ProjectPages برود
   - اضافه کردن دکمه «محاسبه کاندیداها» (اجرای امتیازدهی الگوریتمی)

4. **`src/App.tsx` — Sidebar**:
   - بررسی و اطمینان از درست بودن لینک‌ها

### محدودیت‌های این تسک
- ✅ UX باید روان و قابل فهم باشد
- ✅ کاربر نباید گیج شود بین صفحات مختلف
- ⛔ منطق پردازش AI از Results حذف شود

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/Home.tsx", "src/pages/Results.tsx", "src/pages/Config.tsx", "src/App.tsx"]`

---

## تسک ۱۰ — تست نهایی و رفع باگ

### هدف
تست کامل سیستم جدید و اطمینان از عملکرد صحیح تمام قسمت‌ها.

### چک‌لیست تست

**فلوی اصلی:**
- [ ] آپلود CSV و ساخت پروژه جدید
- [ ] تنظیم وزن‌ها و ذخیره
- [ ] محاسبه کاندیداها (امتیازدهی الگوریتمی)
- [ ] مشاهده لیست صفحات و کاندیداهای هر کدام
- [ ] تحلیل تکی یک صفحه با AI
- [ ] تحلیل کلی همه صفحات با صف
- [ ] توقف و ادامه دادن صف
- [ ] ویرایش دستی لینک‌های یک صفحه
- [ ] مشاهده نتایج نهایی
- [ ] Export به CSV

**سناریوهای edge-case:**
- [ ] قطع شدن اینترنت وسط پردازش
- [ ] تمام شدن توکن API وسط پردازش
- [ ] پروژه بدون هیچ result
- [ ] صفحه بدون هیچ کاندیدای مشابه (تمام تگ‌ها null)

**عملکرد:**
- [ ] پردازش ۱۰۰ صفحه بدون هنگ کردن UI
- [ ] صف به درستی resume می‌شود

### محدودیت‌های این تسک
- ✅ تمام console.log‌های debug حذف شوند
- ✅ تمام متن‌های UI فارسی باشند
- ⛔ هیچ تغییر ساختاری جدید — فقط رفع باگ

`CONTEXT_FILES: ["Docks/PROJECT.md", "Docks/ARCHITECTURE.md", "src/App.tsx"]`

---

---

## تسک ۱۱ — آپدیت موتور امتیازدهی به الگوریتم هوشمند چند لایه

### هدف
جایگزینی الگوریتم ساده وزن‌دار با سیستم امتیازدهی پنج‌لایه که منطق تخصصی تور مسافرتی را درک می‌کند.

### خلاصه الگوریتم (برای AI کدنویس)
الگوریتم جدید یک سیستم **امتیازدهی چند لایه** است:
1. **Pillar Rule**: اگر کاندیدا صفحه دسته‌ی ۱ مقصد است → **امتیاز ۱۰۰۰** (همیشه رتبه اول)
2. **وزن‌های پایه**: مقصد=+100، زمان ماه=+60، فصل=+30، مبدأ=+50، هتل=+30، کشور مشترک=+20
3. **ماتریس زمان**: ماه بعد=+40، همان فصل=+25، آخر فصل→فصل بعد=+20
4. **ماتریس جغرافیایی**: مقصد متفاوت + کشور مشترک + زمان مشابه → +45
5. **ماتریس بودجه**: ارزان↔لوکس = جریمه -50؛ هم‌کلاس = بونوس +20
6. **ماتریس هتل Fallback**: هتل خاص داری ولی match نشد → ستاره‌ای=+15، هتل دیگر=+5
7. **ماتریس مبدأ**: تطابق مبدأ = +50؛ تفاوت وسیله نقلیه **هیچ جریمه‌ای** ندارد

### وضعیت
✅ **پیاده‌سازی شده** — `src/utils/scorer.ts` بازنویسی شد.

### فایل‌های تغییر یافته
- `src/utils/scorer.ts` — بازنویسی کامل با توابع ماتریس مستقل

### نکات مهم backward compatibility
- `computeScore` همان signature را دارد اما پارامترهای `weights` و `mode` دیگر استفاده نمی‌شوند (نگه داشته شده‌اند تا کد قدیمی crash نکند)
- `findTopCandidates` و `computeAllCandidates` و `CandidateWithTags` بدون تغییر هستند
- پارامتر `sourceTitle` و `candidateTitle` به `computeScore` اضافه شده برای تشخیص مبدأ از عنوان

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/scorer.ts", "src/constants/categories.ts"]`

---

## خلاصه تغییرات نسبت به سیستم قبلی

| قبلی | جدید |
|---|---|
| همه صفحات یکجا به AI | صفحه‌به‌صفحه با صف |
| ذخیره در انتها | ذخیره دانه‌به‌دانه |
| بدون قابلیت resume | از همان جا ادامه |
| بدون ویرایش دستی | ویرایش دستی کامل |
| یک صفحه Results | صفحه جزئیات هر صفحه |
| بدون نمایش تگ مشترک | نمایش تگ‌های مشترک |
| امتیازدهی ساده وزن‌دار | الگوریتم چند لایه با Pillar Rule و ماتریس‌های هوشمند |
