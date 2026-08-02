import { test, expect } from '@playwright/test';

/**
 * 🎭 Playwright UI Load Tests
 * اختبار تجربة المستخدم الفعلية تحت الضغط
 * كيف تشغله: npx playwright test tests/playwright/ui-load.spec.ts --workers=20
 */

const APP_URL = 'http://localhost:3000';

// ────────────────────────────────────────────────────────
// اختبار 1: تحميل الصفحة الرئيسية
// ────────────────────────────────────────────────────────
test('تحميل الصفحة الرئيسية بسرعة', async ({ page }) => {
  const startTime = Date.now();

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  const loadTime = Date.now() - startTime;

  // يجب أن تتحمل الصفحة في أقل من 3 ثواني
  expect(loadTime).toBeLessThan(3000);

  // التحقق من ظهور عناصر أساسية
  await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });
});

// ────────────────────────────────────────────────────────
// اختبار 2: عرض تفاصيل الوظيفة
// ────────────────────────────────────────────────────────
test('فتح تفاصيل وظيفة بسرعة', async ({ page }) => {
  await page.goto(APP_URL);

  // النقر على تبويب الوظائف (المسمى الفعلي يعتمد على الـ UI)
  const jobsTab = page.getByText('الوظائف').first();
  if (await jobsTab.isVisible()) {
    await jobsTab.click();
  }

  // انتظار ظهور أول بطاقة وظيفة
  const firstJobCard = page.locator('[class*="rounded"][class*="cursor-pointer"]').first();
  await expect(firstJobCard).toBeVisible({ timeout: 8000 });

  // قياس وقت فتح تفاصيل الوظيفة
  const start = Date.now();
  await firstJobCard.click();

  // التحقق من ظهور نافذة التفاصيل
  await expect(page.locator('text=التطبيق').or(page.locator('text=وصف').or(page.locator('text=تقديم')))).toBeVisible({ timeout: 5000 });

  const openTime = Date.now() - start;
  expect(openTime).toBeLessThan(2000); // يجب أن تفتح في أقل من 2 ثانية
});

// ────────────────────────────────────────────────────────
// اختبار 3: فحص أداء الصفحة (Core Web Vitals)
// ────────────────────────────────────────────────────────
test('قياس Core Web Vitals', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  // قياس LCP (Largest Contentful Paint)
  const lcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      
      // timeout بعد 5 ثواني
      setTimeout(() => resolve(5000), 5000);
    });
  });

  console.log(`📊 LCP: ${lcp.toFixed(0)}ms`);

  // LCP يجب أن يكون أقل من 2.5 ثانية (معيار Google)
  expect(lcp).toBeLessThan(2500);

  // قياس CLS (Cumulative Layout Shift)
  const cls = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        resolve(clsValue);
      }).observe({ type: 'layout-shift', buffered: true });
      
      setTimeout(() => resolve(clsValue), 3000);
    });
  });

  console.log(`📊 CLS: ${cls.toFixed(3)}`);
  // CLS يجب أن يكون أقل من 0.1 (معيار Google)
  expect(cls).toBeLessThan(0.1);
});

// ────────────────────────────────────────────────────────
// اختبار 4: التحقق من الاستجابة على الموبايل
// ────────────────────────────────────────────────────────
test('تجربة الموبايل (iPhone 12)', async ({ browser }) => {
  const iPhone12 = {
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  };

  const context = await browser.newContext(iPhone12);
  const page = await context.newPage();

  const start = Date.now();
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  const loadTime = Date.now() - start;

  console.log(`📱 Mobile Load Time: ${loadTime}ms`);
  expect(loadTime).toBeLessThan(4000); // موبايل أبطأ قليلاً

  // التحقق من ظهور شريط التنقل السفلي
  const mobileNav = page.locator('[class*="fixed"][class*="bottom"]').first();
  await expect(mobileNav).toBeVisible({ timeout: 5000 });

  await context.close();
});

// ────────────────────────────────────────────────────────
// اختبار 5: فحص طلبات الشبكة
// ────────────────────────────────────────────────────────
test('فحص طلبات الشبكة للصفحة الرئيسية', async ({ page }) => {
  const apiCalls: { url: string; duration: number; status: number }[] = [];

  // مراقبة جميع طلبات API
  page.on('response', async (response) => {
    if (response.url().includes('supabase')) {
      const timing = response.request().timing();
      apiCalls.push({
        url: response.url().replace(/.*\/rest\/v1\//, '').split('?')[0],
        duration: timing.responseEnd - timing.requestStart,
        status: response.status(),
      });
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  // فحص أن لا يوجد طلبات فاشلة
  const failedCalls = apiCalls.filter((c) => c.status >= 400);
  console.log(`\n📡 API Calls (${apiCalls.length} total):`);
  apiCalls.forEach((c) => console.log(`  ${c.status === 200 ? '✅' : '❌'} ${c.url}: ${c.duration.toFixed(0)}ms`));

  expect(failedCalls.length).toBe(0);

  // التحقق من أن كل طلب يستجيب في أقل من 3 ثواني
  const slowCalls = apiCalls.filter((c) => c.duration > 3000);
  if (slowCalls.length > 0) {
    console.warn(`⚠️ Slow API calls: ${slowCalls.map((c) => c.url).join(', ')}`);
  }
  expect(slowCalls.length).toBe(0);
});
