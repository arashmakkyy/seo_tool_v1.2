
// =============================================================
// scorer.ts — موتور امتیازدهی هوشمند LinkMesh
// =============================================================
// خلاصه الگوریتم برای AI کدنویس:
//
// این الگوریتم یک سیستم امتیازدهی چند لایه است، نه یک جمع ساده وزن‌دار.
// برای هر صفحه کاندیدا، مراحل زیر به ترتیب اجرا می‌شود:
//
// ۱. PILLAR RULE: اگر کاندیدا صفحه دسته‌ی ۱ (عمومی) مقصد است → +1000 (پادشاه)
// ۲. وزن‌های پایه: مقصد=100، زمان=60، مبدأ=50، هتل=30
// ۳. ماتریس زمان: ماه بعد=+40، همان فصل=+25، اگر آخر فصل و کاندیدا فصل بعد=+20
// ۴. ماتریس جغرافیایی: مقصد متفاوت ولی همان کشور + همان ماه/فصل → +45 (جبرانی)
// ۵. ماتریس بودجه: صفحه ارزان↔ هتل لوکس = جریمه -50 و بالعکس
// ۶. ماتریس هتل Fallback: اگر هتل خاص دارد ولی match نشد → ستاره‌ای=+15، هتل دیگر=+5
// ۷. ماتریس مبدأ: تطابق مبدأ کافی است؛ تفاوت وسیله نقلیه جریمه ندارد
// =============================================================

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
}

// نگاشت فارسی ماه‌ها به شماره (برای منطق ماه بعد / آخر فصل)
const MONTH_ORDER: Record<string, number> = {
  'فروردین': 1, 'اردیبهشت': 2, 'خرداد': 3,
  'تیر': 4, 'مرداد': 5, 'شهریور': 6,
  'مهر': 7, 'آبان': 8, 'آذر': 9,
  'دی': 10, 'بهمن': 11, 'اسفند': 12,
};

// آخرین ماه هر فصل
const LAST_MONTH_OF_SEASON: Record<string, string> = {
  'بهار': 'خرداد',
  'تابستان': 'شهریور',
  'پاییز': 'آذر',
  'زمستان': 'اسفند',
};

// نگاشت فصل بعدی
const NEXT_SEASON: Record<string, string> = {
  'بهار': 'تابستان',
  'تابستان': 'پاییز',
  'پاییز': 'زمستان',
  'زمستان': 'بهار',
};

// آیا یک ماه، ماه بعد از ماه دیگری است؟
function isNextMonth(current: string, candidate: string): boolean {
  const curr = MONTH_ORDER[current];
  const cand = MONTH_ORDER[candidate];
  if (!curr || !cand) return false;
  // ماه بعدی — اسفند → فروردین هم پوشش می‌دهد
  return (cand === curr + 1) || (curr === 12 && cand === 1);
}

// آیا دو ماه در یک فصل هستند؟
function isSameSeason(monthA: string, monthB: string): boolean {
  const a = MONTH_ORDER[monthA];
  const b = MONTH_ORDER[monthB];
  if (!a || !b) return false;
  return Math.ceil(a / 3) === Math.ceil(b / 3);
}

// آیا یک ماه، آخرین ماه فصل خودش است؟
function isLastMonthOfSeason(month: string): boolean {
  return Object.values(LAST_MONTH_OF_SEASON).includes(month);
}

// فصل یک ماه را برمی‌گرداند
function getSeasonOfMonth(month: string): string | null {
  const m = MONTH_ORDER[month];
  if (!m) return null;
  if (m <= 3) return 'بهار';
  if (m <= 6) return 'تابستان';
  if (m <= 9) return 'پاییز';
  return 'زمستان';
}

// -------------------------------------------------------------------
// تشخیص نوع موجودیت‌های صفحه (Entity Parsing)
// -------------------------------------------------------------------

// آیا صفحه مبدأ دارد؟ (باید " از " با فاصله از هر دو طرف در عنوان باشد)
function hasOrigin(title: string): boolean {
  return / از /.test(title);
}

// آیا صفحه ترکیبی (multi-destination) است؟ از طریق نوع_تور
function isComboTour(cat: any): boolean {
  return cat['نوع_تور'] === 'ترکیبی' || cat['نوع_تور'] === 'چند مقصد';
}

// آیا صفحه هتل خاص دارد؟ (نام هتل در عنوان یا فیلد نام_دقیق_هتل)
function hasSpecificHotel(cat: any): boolean {
  return cat['نام_دقیق_هتل'] !== null && cat['نام_دقیق_هتل'] !== undefined && cat['نام_دقیق_هتل'] !== '';
}

// آیا صفحه فیلتر ستاره‌ای است؟ (تعداد_ستاره_هتل مقدار دارد ولی نام هتل خاص ندارد)
function isStarFilter(cat: any): boolean {
  return cat['تعداد_ستاره_هتل'] !== null && !hasSpecificHotel(cat);
}

// کلاس بودجه صفحه را برمی‌گرداند
function getBudgetClass(title: string, cat: any): 'cheap' | 'luxury' | 'none' {
  const label = (cat['برچسب_کلاسی_تور'] || '').toLowerCase();
  const t = title;
  if (t.includes('ارزان') || label.includes('ارزان') || label.includes('بودجه')) return 'cheap';
  if (t.includes('لوکس') || label.includes('لوکس') || cat['تعداد_ستاره_هتل'] === '5') return 'luxury';
  return 'none';
}

// -------------------------------------------------------------------
// ماتریس ۱: Pillar Rule — صفحه دسته ۱ مقصد
// -------------------------------------------------------------------
// صفحه دسته ۱ یعنی: همان مقصد دارد، مبدأ ندارد، هتل خاص ندارد، زمان خاص ندارد
function isPillarPage(sourceCat: any, candidateCat: any, candidateTitle: string): boolean {
  const sameDestination =
    sourceCat['شهر_یا_جزیره_مقصد'] !== null &&
    sourceCat['شهر_یا_جزیره_مقصد'] === candidateCat['شهر_یا_جزیره_مقصد'];

  const noOriginInCandidate = !hasOrigin(candidateTitle);
  const noSpecificHotel = !hasSpecificHotel(candidateCat);
  const noSpecificMonth = candidateCat['ماه_تقویمی_برگزاری'] === null;

  return sameDestination && noOriginInCandidate && noSpecificHotel && noSpecificMonth;
}

// -------------------------------------------------------------------
// ماتریس ۲: وزن‌های پایه
// -------------------------------------------------------------------
function computeBaseScore(sourceCat: any, candidateCat: any): number {
  let score = 0;

  // تطابق مقصد (مهم‌ترین)
  if (
    sourceCat['شهر_یا_جزیره_مقصد'] !== null &&
    sourceCat['شهر_یا_جزیره_مقصد'] === candidateCat['شهر_یا_جزیره_مقصد']
  ) {
    score += 100;
  } else if (
    // اگر مقصد شهری متفاوت ولی کشور یکی است — کمتر از مقصد کامل
    sourceCat['کشور_مقصد'] !== null &&
    sourceCat['کشور_مقصد'] === candidateCat['کشور_مقصد']
  ) {
    score += 20; // بونوس پایه کشور مشترک (ماتریس جغرافیایی بعداً بونوس جبرانی می‌دهد)
  }

  // تطابق زمان — ماه دقیق
  if (
    sourceCat['ماه_تقویمی_برگزاری'] !== null &&
    sourceCat['ماه_تقویمی_برگزاری'] === candidateCat['ماه_تقویمی_برگزاری']
  ) {
    score += 60;
  } else if (
    // تطابق فصل (اگر ماه دقیق تطابق نداشت)
    sourceCat['فصل_برگزاری'] !== null &&
    sourceCat['فصل_برگزاری'] === candidateCat['فصل_برگزاری']
  ) {
    score += 30;
  }

  // تطابق مبدأ — فقط اگر مبدأ وجود دارد
  if (
    sourceCat['شهر_یا_استان_مبدا'] !== null &&
    sourceCat['شهر_یا_استان_مبدا'] === candidateCat['شهر_یا_استان_مبدا']
  ) {
    score += 50;
  }

  // تطابق هتل — وزن پایین
  if (
    sourceCat['نام_دقیق_هتل'] !== null &&
    sourceCat['نام_دقیق_هتل'] === candidateCat['نام_دقیق_هتل']
  ) {
    score += 30;
  }

  return score;
}

// -------------------------------------------------------------------
// ماتریس ۳: زمان هوشمند
// -------------------------------------------------------------------
function computeTimeBonus(sourceCat: any, candidateCat: any): number {
  const sourceMonth = sourceCat['ماه_تقویمی_برگزاری'];
  const candidateMonth = candidateCat['ماه_تقویمی_برگزاری'];
  const sourceSeason = sourceCat['فصل_برگزاری'];
  const candidateSeason = candidateCat['فصل_برگزاری'];

  // این ماتریس فقط زمانی فعال است که صفحه فعلی ماه خاص دارد
  if (!sourceMonth) return 0;

  // اگر ماه‌ها یکسان‌اند — وزن پایه قبلاً داده شد، بونوس اضافه نمی‌دهیم
  if (sourceMonth === candidateMonth) return 0;

  // بونوس ماه بعد: همان تور ماه بعدی
  if (candidateMonth && isNextMonth(sourceMonth, candidateMonth)) {
    return 40;
  }

  // بونوس همان فصل (ماه‌های دیگر)
  if (candidateMonth && isSameSeason(sourceMonth, candidateMonth)) {
    return 25;
  }

  // قانون ماه آخر فصل: اگر صفحه فعلی آخرین ماه فصل است، فصل بعدی بونوس می‌گیرد
  if (isLastMonthOfSeason(sourceMonth)) {
    const currentSeasonOfSource = getSeasonOfMonth(sourceMonth);
    if (currentSeasonOfSource && candidateSeason === NEXT_SEASON[currentSeasonOfSource]) {
      return 20;
    }
  }

  return 0;
}

// -------------------------------------------------------------------
// ماتریس ۴: جغرافیایی (Geo Expansion)
// -------------------------------------------------------------------
function computeGeoBonus(sourceCat: any, candidateCat: any): number {
  // فقط اگر مقصدها متفاوت هستند ولی کشور یکی است
  const diffDestination =
    sourceCat['شهر_یا_جزیره_مقصد'] !== candidateCat['شهر_یا_جزیره_مقصد'];
  const sameCountry =
    sourceCat['کشور_مقصد'] !== null &&
    sourceCat['کشور_مقصد'] === candidateCat['کشور_مقصد'];

  if (!diffDestination || !sameCountry) return 0;

  // اگر ماه یا فصل هم یکسان است، بونوس جبرانی می‌دهیم
  const sameMonth =
    sourceCat['ماه_تقویمی_برگزاری'] !== null &&
    sourceCat['ماه_تقویمی_برگزاری'] === candidateCat['ماه_تقویمی_برگزاری'];
  const sameSeason =
    sourceCat['فصل_برگزاری'] !== null &&
    sourceCat['فصل_برگزاری'] === candidateCat['فصل_برگزاری'];

  if (sameMonth || sameSeason) {
    return 45;
  }

  return 0;
}

// -------------------------------------------------------------------
// ماتریس ۵: بودجه و کلاس
// -------------------------------------------------------------------
function computeBudgetScore(sourceTitle: string, sourceCat: any, candidateCat: any): number {
  const sourceBudget = getBudgetClass(sourceTitle, sourceCat);
  if (sourceBudget === 'none') return 0;

  const candidateStars = candidateCat['تعداد_ستاره_هتل'];
  const candidateLabel = (candidateCat['برچسب_کلاسی_تور'] || '').toLowerCase();
  const isCandidateLuxury = candidateStars === '5' || candidateLabel.includes('لوکس');
  const isCandidateCheap = candidateStars === '3' || candidateLabel.includes('ارزان');

  if (sourceBudget === 'cheap') {
    if (isCandidateCheap) return 20;
    if (isCandidateLuxury) return -50;
  }

  if (sourceBudget === 'luxury') {
    if (isCandidateLuxury) return 20;
    if (isCandidateCheap) return -50;
  }

  return 0;
}

// -------------------------------------------------------------------
// ماتریس ۶: هتل Fallback
// -------------------------------------------------------------------
function computeHotelFallbackBonus(sourceCat: any, candidateCat: any): number {
  // این ماتریس فقط زمانی فعال است که صفحه فعلی هتل خاص دارد
  if (!hasSpecificHotel(sourceCat)) return 0;

  // اگر هتل دقیق match شد — وزن پایه قبلاً داده شد
  if (sourceCat['نام_دقیق_هتل'] === candidateCat['نام_دقیق_هتل']) return 0;

  // اولویت اول: کاندیدا از نوع فیلتر ستاره‌ای است (مثلاً «تور کیش هتل‌های ۵ ستاره»)
  if (isStarFilter(candidateCat)) return 15;

  // اولویت دوم: کاندیدا هتل دیگری در همان مقصد دارد
  if (
    hasSpecificHotel(candidateCat) &&
    sourceCat['شهر_یا_جزیره_مقصد'] === candidateCat['شهر_یا_جزیره_مقصد']
  ) {
    return 5;
  }

  return 0;
}

// -------------------------------------------------------------------
// تابع اصلی: محاسبه امتیاز کل برای یک جفت صفحه
// -------------------------------------------------------------------
export function computeScore(
  sourceCat: any,
  candidateCat: any,
  sourceTitle: string,
  candidateTitle: string,
  _weights: Record<string, number>, // نگه داشته شده برای backward compatibility
  _mode: 'linear' | 'weighted'      // نگه داشته شده برای backward compatibility
): number {
  // مرحله ۲: Pillar Rule
  if (isPillarPage(sourceCat, candidateCat, candidateTitle)) {
    return 1000;
  }

  // مرحله ۳: وزن‌های پایه
  let total = computeBaseScore(sourceCat, candidateCat);

  // مرحله ۴ — الف: ماتریس زمان
  total += computeTimeBonus(sourceCat, candidateCat);

  // مرحله ۴ — ب: ماتریس جغرافیایی
  total += computeGeoBonus(sourceCat, candidateCat);

  // مرحله ۴ — ج: ماتریس بودجه
  total += computeBudgetScore(sourceTitle, sourceCat, candidateCat);

  // مرحله ۴ — د: ماتریس هتل Fallback
  total += computeHotelFallbackBonus(sourceCat, candidateCat);

  // توجه: ماتریس مبدأ (هـ) در وزن پایه پوشش داده شده؛
  // تغییر وسیله نقلیه هیچ جریمه‌ای ندارد (عمداً کد نمی‌شود)

  return total;
}

// -------------------------------------------------------------------
// تابع کمکی: تگ‌های مشترک (برای نمایش به کاربر و ارسال به AI)
// -------------------------------------------------------------------
export function getMatchedTags(catA: any, catB: any): string[] {
  const matched: string[] = [];
  Object.keys(catA).forEach((field) => {
    if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
      matched.push(field);
    }
  });
  return matched;
}

// -------------------------------------------------------------------
// findTopCandidates — رتبه‌بندی نهایی (مرحله ۵: Summation & Sorting)
// -------------------------------------------------------------------
export function findTopCandidates(
  sourcePage: any,
  allPages: any[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): CandidateWithTags[] {
  const sourceCat = JSON.parse(sourcePage.categories);

  return allPages
    .filter(p => p.id !== sourcePage.id)
    .map(p => {
      const pCat = JSON.parse(p.categories);
      return {
        page_id: p.id!,
        title: p.title,
        score: computeScore(sourceCat, pCat, sourcePage.title, p.title, weights, mode),
        matched_tags: getMatchedTags(sourceCat, pCat),
      };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score); // نزولی — بیشترین امتیاز اول
}

// -------------------------------------------------------------------
// computeAllCandidates — اجرا برای همه صفحات پروژه
// -------------------------------------------------------------------
export function computeAllCandidates(
  pages: any[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();

  pages.forEach(p => {
    map.set(p.id!, findTopCandidates(p, pages, weights, mode));
  });

  return map;
}
