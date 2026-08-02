# ============================================================
# 🚀 ProLink — سكربت اختبار الحمل الشامل
# ============================================================
# الاستخدام:
#   .\tests\load\run-tests.ps1                  (الاختبار الكامل)
#   .\tests\load\run-tests.ps1 -Test smoke      (اختبار خفيف)
#   .\tests\load\run-tests.ps1 -Test load       (اختبار الحمل)
#   .\tests\load\run-tests.ps1 -Test stress     (اختبار الضغط)
#   .\tests\load\run-tests.ps1 -SeedFirst       (ضخ بيانات ثم اختبار)
#   .\tests\load\run-tests.ps1 -AnalyzeOnly     (تحليل النتائج فقط)
# ============================================================

param(
    [ValidateSet('smoke','load','stress','soak','all')]
    [string]$Test = 'smoke',
    [switch]$SeedFirst,
    [switch]$AnalyzeOnly,
    [switch]$DryRun
)

# ── الألوان ──────────────────────────────────────────────
function Write-Header($text) {
    Write-Host "`n$('═' * 60)" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "$('═' * 60)" -ForegroundColor Cyan
}

function Write-Step($text) {
    Write-Host "`n▶ $text" -ForegroundColor Yellow
}

function Write-Success($text) {
    Write-Host "  ✅ $text" -ForegroundColor Green
}

function Write-Warn($text) {
    Write-Host "  ⚠️  $text" -ForegroundColor DarkYellow
}

function Write-Fail($text) {
    Write-Host "  ❌ $text" -ForegroundColor Red
}

# ── التحقق من الأدوات ────────────────────────────────────
Write-Header "فحص المتطلبات"

$k6Path = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6Path) {
    Write-Fail "k6 غير مثبّت!"
    Write-Host "`n  لتثبيت k6 على Windows:" -ForegroundColor White
    Write-Host "  winget install k6" -ForegroundColor Gray
    Write-Host "  أو: https://dl.k6.io/msi/k6-latest-amd64.msi`n" -ForegroundColor Gray
    Write-Warn "سيتم تخطي اختبارات k6 والانتقال للتحليل فقط..."
    $k6Available = $false
} else {
    $k6Ver = (k6 version 2>&1)
    Write-Success "k6 متاح: $k6Ver"
    $k6Available = $true
}

$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    # ابحث عن node.exe المحلي
    if (Test-Path ".\node.exe") {
        $nodeCmd = ".\node.exe"
        Write-Success "node.exe موجود محلياً"
    } else {
        Write-Fail "Node.js غير موجود"
        exit 1
    }
} else {
    $nodeCmd = "node"
    Write-Success "Node.js متاح: $(node --version)"
}

# ── إنشاء مجلد التقارير ──────────────────────────────────
if (-not (Test-Path "tests\load\reports")) {
    New-Item -ItemType Directory -Path "tests\load\reports" -Force | Out-Null
    Write-Success "تم إنشاء مجلد: tests\load\reports"
} else {
    Write-Success "مجلد التقارير موجود"
}

# ── وضع التحليل فقط ──────────────────────────────────────
if ($AnalyzeOnly) {
    Write-Header "تحليل نتائج الاختبارات"
    $reports = Get-ChildItem "tests\load\reports\*.json" -ErrorAction SilentlyContinue
    if ($reports.Count -eq 0) {
        Write-Fail "لا توجد تقارير JSON في tests\load\reports\"
        Write-Host "  شغّل الاختبار أولاً:`n  k6 run tests\load\smoke-test.js`n" -ForegroundColor White
        exit 1
    }
    Write-Host "`n  تحليل $($reports.Count) تقرير..." -ForegroundColor White
    & $nodeCmd "tests\load\analyze-results.js" "--all"
    exit 0
}

# ── خطوة ضخ البيانات ─────────────────────────────────────
if ($SeedFirst) {
    Write-Header "ضخ بيانات الاختبار"
    Write-Step "تشغيل seed-data.js..."

    $seedArgs = "tests\load\seed-data.js"
    if ($DryRun) { $seedArgs += " --dry-run" }

    & $nodeCmd $seedArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "فشل ضخ البيانات — تحقق من إعدادات Supabase"
        Write-Warn "هل أضفت SUPABASE_SERVICE_KEY في البيئة؟"
        Write-Host "  مثال: `$env:SUPABASE_SERVICE_KEY = 'your_key'" -ForegroundColor Gray
        # لا نوقف التنفيذ — نكمل بالاختبار
    } else {
        Write-Success "تم ضخ البيانات بنجاح"
    }
}

# ── تشغيل الاختبارات ─────────────────────────────────────
if ($k6Available) {
    $testFiles = @{
        'smoke'  = @{ file = 'tests\load\smoke-test.js';  label = 'اختبار الدخان (50 مستخدم)' }
        'load'   = @{ file = 'tests\load\load-test.js';   label = 'اختبار الحمل (1000 مستخدم)' }
        'stress' = @{ file = 'tests\load\stress-test.js'; label = 'اختبار الضغط (10,000 مستخدم)' }
        'soak'   = @{ file = 'tests\load\soak-test.js';   label = 'اختبار الديمومة (6 ساعات)' }
    }

    $toRun = if ($Test -eq 'all') { @('smoke','load','stress') } else { @($Test) }

    foreach ($t in $toRun) {
        $info = $testFiles[$t]
        Write-Header $info.label
        Write-Step "تشغيل: k6 run $($info.file)"

        $startTime = Get-Date
        k6 run $info.file
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

        if ($LASTEXITCODE -eq 0) {
            Write-Success "اكتمل الاختبار في $elapsed ثانية"
        } else {
            Write-Warn "انتهى الاختبار بتحذيرات/فشل (رمز: $LASTEXITCODE)"
        }

        # انتظر قليلاً بين الاختبارات
        if ($toRun.Count -gt 1 -and $t -ne $toRun[-1]) {
            Write-Host "`n  ⏳ انتظار 10 ثواني قبل الاختبار التالي..." -ForegroundColor Gray
            Start-Sleep -Seconds 10
        }
    }

    # ── التحليل التلقائي ──────────────────────────────────
    Write-Header "تحليل النتائج"
    $reports = Get-ChildItem "tests\load\reports\*.json" -ErrorAction SilentlyContinue
    if ($reports.Count -gt 0) {
        & $nodeCmd "tests\load\analyze-results.js" "--all"
    } else {
        Write-Warn "لا توجد تقارير للتحليل بعد"
    }
} else {
    Write-Warn "k6 غير متاح — تخطي تشغيل الاختبارات"
    Write-Host "`n  لتثبيت k6 وتشغيل الاختبارات:" -ForegroundColor White
    Write-Host "  1. winget install k6" -ForegroundColor Gray
    Write-Host "  2. ثم أعد تشغيل: .\tests\load\run-tests.ps1`n" -ForegroundColor Gray
}

Write-Header "اكتمل!"
Write-Host "  📁 التقارير: tests\load\reports\`n" -ForegroundColor White
