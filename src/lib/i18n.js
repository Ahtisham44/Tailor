// ============================================================================
// Full-platform Urdu translation layer (Tailor side)
// ----------------------------------------------------------------------------
// Two parts work together:
//   1. UR_PHRASES — an English→Urdu phrase dictionary covering (ideally) every
//      visible string on the tailor side. Used by both tr() lookups and the
//      runtime DOM translator.
//   2. A runtime translator (translateTree / observeAndTranslate) that walks
//      the live DOM and swaps English text/placeholders/titles for Urdu when
//      the active language is "ur". This is the safety net that guarantees
//      nothing is left in English, even strings rendered dynamically (modals,
//      toasts, charts labels, etc.) that were never routed through tr().
//
// The Backstage (admin) page is intentionally excluded — see shouldSkip().
// ============================================================================

// ── English → Urdu phrase dictionary ────────────────────────────────────────
// Keys are matched case-insensitively against trimmed text. Keep the longest /
// most specific phrases here; single words too. Anything not found is left as-is.
export const UR_PHRASES = {
  // ── Nav / sections ──
  "Dashboard": "ڈیش بورڈ",
  "Customers": "گاہک",
  "Orders": "آرڈر",
  "Rates": "ریٹس",
  "Karigar": "کاریگر",
  "Karigars": "کاریگر",
  "Reports": "رپورٹس",
  "Reports & Analytics": "رپورٹس اور تجزیات",
  "Reports &amp; Analytics": "رپورٹس اور تجزیات",
  "Reports & analytics": "رپورٹس اور تجزیات",
  "Subscription": "سبسکرپشن",
  "Shop Profile": "دکان پروفائل",
  "Profile": "پروفائل",
  "Billing": "بلنگ",
  "Pricing": "قیمتیں",

  // ── Common actions / buttons ──
  "Save": "محفوظ کریں",
  "Cancel": "منسوخ کریں",
  "Close": "بند کریں",
  "Delete": "حذف کریں",
  "Edit": "ترمیم",
  "Remove": "ہٹائیں",
  "Add": "شامل کریں",
  "Added": "شامل ہو گیا",
  "Update": "اپڈیٹ",
  "Save Customer": "گاہک محفوظ کریں",
  "Save Order": "آرڈر محفوظ کریں",
  "Save Rate": "ریٹ محفوظ کریں",
  "Save Profile": "پروفائل محفوظ کریں",
  "Edit Customer": "گاہک میں ترمیم",
  "Edit Order": "آرڈر میں ترمیم",
  "Delete Customer": "گاہک حذف کریں",
  "Delete Karigar": "کاریگر حذف کریں",
  "New Order": "نیا آرڈر",
  "+ New Order": "+ نیا آرڈر",
  "+ Add Customer": "+ گاہک شامل کریں",
  "+ Add Rate": "+ ریٹ شامل کریں",
  "+ Add Karigar": "+ کاریگر شامل کریں",
  "Add Customer": "گاہک شامل کریں",
  "Add Rate": "ریٹ شامل کریں",
  "Add Karigar": "کاریگر شامل کریں",
  "Confirm": "تصدیق کریں",
  "Yes": "ہاں",
  "No": "نہیں",
  "Back": "واپس",
  "Next": "اگلا",
  "Done": "مکمل",
  "Skip": "چھوڑیں",
  "All": "تمام",
  "None": "کوئی نہیں",
  "Preview": "جھلک",
  "Print": "پرنٹ",
  "Export": "برآمد کریں",
  "Print this version": "یہ ورژن پرنٹ کریں",
  "Print / Download PDF": "پرنٹ / PDF ڈاؤن لوڈ",
  "Manage": "نظم کریں",
  "Upgrade to add more": "مزید شامل کرنے کے لیے اپ گریڈ کریں",
  "Upgrade your plan": "اپنا پلان اپ گریڈ کریں",
  "Renew or change your plan": "اپنا پلان تجدید یا تبدیل کریں",
  "Renew now": "ابھی تجدید کریں",

  // ── Status / generic ──
  "Status": "حیثیت",
  "Active": "فعال",
  "Current": "حالیہ",
  "current": "حالیہ",
  "remaining": "باقی",
  "Loading...": "لوڈ ہو رہا ہے...",
  "Loading…": "لوڈ ہو رہا ہے...",
  "Not found": "نہیں ملا",
  "Free": "مفت",
  "Actions": "اعمال",
  "Amount": "رقم",
  "Date": "تاریخ",
  "Name": "نام",
  "Phone": "فون",
  "Email": "ای میل",
  "Password": "پاس ورڈ",
  "Notes": "نوٹس",
  "Notes (optional)": "نوٹس (اختیاری)",
  "Notes (internal)": "نوٹس (اندرونی)",
  "Gender": "جنس",
  "Male": "مرد",
  "Female": "عورت",
  "Other": "دیگر",
  "Item": "آئٹم",
  "Items": "اشیاء",
  "No items": "کوئی آئٹم نہیں",
  "No items added yet": "ابھی کوئی آئٹم شامل نہیں",
  "Qty": "تعداد",
  "Price": "قیمت",
  "Price Rs": "قیمت روپے",
  "Price (Rs)": "قیمت (روپے)",
  "Total": "کل",
  "Subtotal": "ذیلی قیمت",
  "Grand Total": "کل قیمت",
  "Total Payable": "قابل ادائیگی کل",
  "Discount": "ڈسکاؤنٹ",
  "Discount (Rs)": "ڈسکاؤنٹ (روپے)",
  "Category": "قسم",
  "Label": "لیبل",
  "From": "سے",
  "To": "تک",
  "to": "تا",
  "Period": "مدت",
  "Joined": "شامل ہوئے",
  "Joining Date": "شمولیت کی تاریخ",
  "Booking": "بکنگ",
  "Booking Date": "بکنگ کی تاریخ",
  "Delivery": "ڈلیوری",
  "Delivery Date": "ڈلیوری کی تاریخ",

  // ── Customers ──
  "Full Name": "پورا نام",
  "Full Name *": "پورا نام *",
  "Customer #": "گاہک نمبر",
  "Customer #1042": "گاہک نمبر 1042",
  "All Customers": "تمام گاہک",
  "No customers found": "کوئی گاہک نہیں ملا",
  "No customers yet": "ابھی کوئی گاہک نہیں",
  "Add your first customer": "اپنا پہلا گاہک شامل کریں",
  "Customer saved": "گاہک محفوظ ہو گیا",
  "Customer deleted": "گاہک حذف ہو گیا",
  "Full name is required": "پورا نام ضروری ہے",
  "Name is required": "نام ضروری ہے",
  "Select Customer": "گاہک منتخب کریں",
  "Select at least one customer": "کم از کم ایک گاہک منتخب کریں",
  "Select at least one customer first": "پہلے کم از کم ایک گاہک منتخب کریں",
  "Signed in as": "بطور سائن ان",

  // ── Measurements ──
  "Measurements": "پیمائشات",
  "Measurement Receipt": "پیمائش رسید",
  "Measurements by Item": "آئٹم کے حساب سے پیمائش",
  "No measurements": "کوئی پیمائش نہیں",
  "No measurements yet": "ابھی کوئی پیمائش نہیں",
  "No measurements on file": "کوئی پیمائش درج نہیں",
  "No measurements on file for this customer.": "اس گاہک کی کوئی پیمائش درج نہیں۔",
  "Select an item above to add measurements": "پیمائش شامل کرنے کے لیے اوپر آئٹم منتخب کریں",
  "Select an item type to add its measurements:": "پیمائش شامل کرنے کے لیے آئٹم کی قسم منتخب کریں:",
  "Style Details": "اسٹائل تفصیلات",
  "Gala Style": "گلا اسٹائل",
  "Version History": "ورژن ہسٹری",

  // ── Orders ──
  "Order #": "آرڈر نمبر",
  "Order Number": "آرڈر نمبر",
  "Order Info": "آرڈر معلومات",
  "Order Ledger": "آرڈر کھاتہ",
  "Orders Ledger": "آرڈر کھاتہ",
  "Order History": "آرڈر ہسٹری",
  "All Statuses": "تمام حیثیتیں",
  "No orders found": "کوئی آرڈر نہیں ملا",
  "No orders in this period": "اس مدت میں کوئی آرڈر نہیں",
  "No order data in this period": "اس مدت میں آرڈر کا کوئی ڈیٹا نہیں",
  "Order deleted": "آرڈر حذف ہو گیا",
  "Order number required": "آرڈر نمبر ضروری ہے",
  "Open an order first": "پہلے کوئی آرڈر کھولیں",
  "Pick a category first": "پہلے قسم منتخب کریں",
  "Select a category": "قسم منتخب کریں",
  "Invoice": "انوائس",
  "INVOICE": "انوائس",

  // ── Order statuses ──
  "Pending": "زیر التواء",
  "In Progress": "جاری",
  "Ready": "تیار",
  "Delivered": "ڈلیور",
  "Cancelled": "منسوخ",

  // ── Rates ──
  "Per-Piece Rates": "فی پیس ریٹ",
  "Per-Piece Rates *": "فی پیس ریٹ *",
  "Agreed Rate (Rs)": "طے شدہ ریٹ (روپے)",
  "Rate": "ریٹ",
  "No rates yet": "ابھی کوئی ریٹ نہیں",
  "Add your first rate": "اپنا پہلا ریٹ شامل کریں",
  "Rate saved": "ریٹ محفوظ ہو گیا",
  "Rate deleted": "ریٹ حذف ہو گیا",
  "Rate label required": "ریٹ لیبل ضروری ہے",
  "Rate label required.": "ریٹ لیبل ضروری ہے۔",
  "At least one per-piece rate required": "کم از کم ایک فی پیس ریٹ ضروری ہے",
  "Expense Price (Rs)": "خرچ قیمت (روپے)",
  "Category Expenses": "قسم کے اخراجات",
  "Category Expense": "قسم کا خرچ",
  "Base expense per category (used in revenue reports)": "فی قسم بنیادی خرچ (آمدنی رپورٹس میں استعمال)",
  "Expense saved": "خرچ محفوظ ہو گیا",
  "Expense removed": "خرچ ہٹا دیا گیا",
  "Expenses": "اخراجات",
  "Expense": "خرچ",
  "+ Add Expense": "+ خرچ شامل کریں",
  "Add Expense": "خرچ شامل کریں",
  "Edit Expense": "خرچ میں ترمیم",
  "Save Expense": "خرچ محفوظ کریں",
  "Edit Rate": "ریٹ میں ترمیم",
  "DS Reshmi Price (Rs)": "ڈبل سلائی ریشمی قیمت (روپے)",
  "DS Jaali Pancha Price (Rs)": "ڈبل سلائی جالی پانچہ قیمت (روپے)",
  "DS Sada Price (Rs)": "ڈبل سلائی سادہ قیمت (روپے)",

  // ── Karigar ──
  "Manage your tailors and craftsmen": "اپنے درزیوں اور کاریگروں کا نظم کریں",
  "No karigars found": "کوئی کاریگر نہیں ملا",
  "Add your first karigar to get started": "شروع کرنے کے لیے اپنا پہلا کاریگر شامل کریں",
  "Assign Karigar/s": "کاریگر تفویض کریں",
  "Assignments": "تفویضات",
  "Assigned Orders": "تفویض شدہ آرڈر",
  "Karigar Assignment Summary": "کاریگر تفویض خلاصہ",
  "No karigar assignments in this period": "اس مدت میں کوئی کاریگر تفویض نہیں",
  "Monthly Base": "ماہانہ بنیاد",
  "Monthly Base Salary (Rs) *": "ماہانہ بنیادی تنخواہ (روپے) *",
  "Pay Type": "ادائیگی کی قسم",
  "Karigar assignments added": "کاریگر تفویضات شامل ہو گئیں",
  "Karigar assignments saved": "کاریگر تفویضات محفوظ ہو گئیں",
  "Add at least one karigar with a rate": "ریٹ کے ساتھ کم از کم ایک کاریگر شامل کریں",
  "Monthly base salary required and must be > 0": "ماہانہ بنیادی تنخواہ ضروری ہے اور 0 سے زیادہ ہونی چاہیے",
  "Upgrade to assign karigar": "کاریگر تفویض کے لیے اپ گریڈ کریں",

  // ── Reports ──
  "Earnings": "آمدنی",
  "Earnings — Last 6 Months": "آمدنی — آخری 6 ماہ",
  "Sales": "فروخت",
  "Overview": "جائزہ",
  "This Week": "اس ہفتے",
  "This Month": "اس ماہ",
  "View insights and export reports for any date range": "کسی بھی تاریخ کی حد کے لیے بصیرت دیکھیں اور رپورٹس برآمد کریں",
  "No item data for this period": "اس مدت کے لیے آئٹم کا کوئی ڈیٹا نہیں",
  "Karigar Performance": "کاریگر کارکردگی",
  "Monthly Revenue Trend (Last 6 Months)": "ماہانہ آمدنی رجحان (آخری 6 ماہ)",
  "Order Status Funnel (All Time)": "آرڈر حیثیت فنل (تمام وقت)",
  "Revenue by Item Category": "آئٹم قسم کے حساب سے آمدنی",
  "Revenue vs Expenses vs Pending": "آمدنی بمقابلہ اخراجات بمقابلہ زیر التواء",
  "Top 5 Customers by Order Value": "آرڈر مالیت کے لحاظ سے سرفہرست 5 گاہک",
  "Upgrade to unlock this report": "یہ رپورٹ کھولنے کے لیے اپ گریڈ کریں",

  // ── Dashboard ──
  "Total Customers": "کل گاہک",
  "Total Orders": "کل آرڈر",
  "New This Month": "اس ماہ نئے",
  "Pending Orders": "زیر التواء آرڈر",
  "Customer Growth (Last 6 Months)": "گاہک کی نمو (آخری 6 ماہ)",
  "Recent Customers": "حالیہ گاہک",
  "Recent Orders": "حالیہ آرڈر",
  "Item Breakdown": "اشیاء کی تفصیل",
  "New Customers": "نئے گاہک",

  // ── Payments / Billing ──
  "Payments": "ادائیگیاں",
  "Payment Type": "ادائیگی کی قسم",
  "Payment Type *": "ادائیگی کی قسم *",
  "Payment receipt": "ادائیگی رسید",
  "Payment under review": "ادائیگی زیر جائزہ",
  "Date Paid": "ادائیگی کی تاریخ",
  "Pay using": "ادائیگی بذریعہ",
  "Pay Using": "ادائیگی بذریعہ",
  "No payment records": "کوئی ادائیگی ریکارڈ نہیں",
  "Transaction reference / ID": "ٹرانزیکشن حوالہ / آئی ڈی",
  "Enter the transaction reference / ID": "ٹرانزیکشن حوالہ / آئی ڈی درج کریں",
  "Tap to attach a screenshot or PDF": "اسکرین شاٹ یا PDF منسلک کرنے کے لیے ٹیپ کریں",
  "Marked as paid": "ادا شدہ کے طور پر نشان زد",
  "Bank Transfer": "بینک ٹرانسفر",
  "Choose a plan": "ایک پلان منتخب کریں",
  "Choose a password": "پاس ورڈ منتخب کریں",
  "Your current plan": "آپ کا موجودہ پلان",
  "Unlimited customers": "لامحدود گاہک",
  "Karigar management": "کاریگر نظم",
  "Branding": "برانڈنگ",
  "Upgrade to unlock": "کھولنے کے لیے اپ گریڈ کریں",

  // ── Profile ──
  "Shop Name": "دکان کا نام",
  "Shop Logo": "دکان کا لوگو",
  "Logo URL": "لوگو URL",
  "Paste a hosted image link (PNG/JPG/SVG).": "ہوسٹ کردہ تصویر کا لنک پیسٹ کریں (PNG/JPG/SVG)۔",
  "Shop name is required": "دکان کا نام ضروری ہے",
  "Profile updated": "پروفائل اپڈیٹ ہو گیا",
  "Logo URL must start with http:// or https://": "لوگو URL کو http:// یا https:// سے شروع ہونا چاہیے",

  // ── Login ──
  "Welcome back": "خوش آمدید",
  "Sign in": "سائن ان",
  "Sign in to your shop dashboard": "اپنے دکان ڈیش بورڈ میں سائن ان کریں",
  "Signing in...": "سائن ان ہو رہا ہے...",
  "Create account": "اکاؤنٹ بنائیں",
  "Create your account": "اپنا اکاؤنٹ بنائیں",
  "Creating account...": "اکاؤنٹ بن رہا ہے...",
  "Verify & create account": "تصدیق کریں اور اکاؤنٹ بنائیں",
  "Email or mobile number": "ای میل یا موبائل نمبر",
  "WhatsApp mobile number": "واٹس ایپ موبائل نمبر",
  "Your name / shop name": "آپ کا نام / دکان کا نام",
  "Forgot password?": "پاس ورڈ بھول گئے؟",
  "Reset password": "پاس ورڈ ری سیٹ کریں",
  "Send reset email": "ری سیٹ ای میل بھیجیں",
  "Send WhatsApp code": "واٹس ایپ کوڈ بھیجیں",
  "Sending code...": "کوڈ بھیجا جا رہا ہے...",
  "Sending...": "بھیجا جا رہا ہے...",
  "Resend code": "کوڈ دوبارہ بھیجیں",
  "Check WhatsApp": "واٹس ایپ چیک کریں",
  "Enter the code and choose a password": "کوڈ درج کریں اور پاس ورڈ منتخب کریں",
  "Enter your email to receive a reset link": "ری سیٹ لنک حاصل کرنے کے لیے اپنا ای میل درج کریں",
  "Enter your email.": "اپنا ای میل درج کریں۔",
  "Enter your email/phone and password.": "اپنا ای میل/فون اور پاس ورڈ درج کریں۔",
  "Enter the 6-digit code from WhatsApp.": "واٹس ایپ سے 6 ہندسوں کا کوڈ درج کریں۔",
  "Enter a valid mobile number, e.g. 0300 1234567": "درست موبائل نمبر درج کریں، مثلاً 0300 1234567",
  "Password must be at least 8 characters.": "پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے۔",
  "Account created! Sign in with your phone number.": "اکاؤنٹ بن گیا! اپنے فون نمبر سے سائن ان کریں۔",
  "Reset email sent. Check your inbox.": "ری سیٹ ای میل بھیج دی گئی۔ اپنا ان باکس چیک کریں۔",
  "Reset failed": "ری سیٹ ناکام",
  "Wrong credentials. Check and try again.": "غلط معلومات۔ چیک کریں اور دوبارہ کوشش کریں۔",
  "This user is disabled. Contact your admin for assistance.": "یہ صارف غیر فعال ہے۔ مدد کے لیے اپنے ایڈمن سے رابطہ کریں۔",
  "Daily sales, pending work and earnings, all in one place.": "روزانہ فروخت، زیر التواء کام اور آمدنی، سب ایک جگہ۔",
  "Digital measurement book": "ڈیجیٹل پیمائش بک",
  "Hand your customer a clean measurement slip in seconds.": "اپنے گاہک کو چند سیکنڈ میں صاف پیمائش پرچی دیں۔",
  "From booking to delivery — see status at a glance.": "بکنگ سے ڈلیوری تک — حیثیت ایک نظر میں دیکھیں۔",
  "Track every order": "ہر آرڈر ٹریک کریں",
  "Know your numbers": "اپنے اعداد جانیں",
  "Print Urdu receipts": "اردو رسیدیں پرنٹ کریں",
  "Sign in to your shop dashboard": "اپنے دکان ڈیش بورڈ میں سائن ان کریں",

  // ── Misc / offline / feature lock ──
  "You are offline — app is running from cache": "آپ آف لائن ہیں — ایپ کیشے سے چل رہی ہے",
  "Server connected": "سرور متصل",
  "DB error": "ڈیٹابیس کی خرابی",
  "This feature isn’t included in your current plan.": "یہ خصوصیت آپ کے موجودہ پلان میں شامل نہیں ہے۔",
  "This feature isn't included in your current plan.": "یہ خصوصیت آپ کے موجودہ پلان میں شامل نہیں ہے۔",
  "Logout": "لاگ آؤٹ",
  "Sign out": "سائن آؤٹ",
  "PDF exported!": "PDF برآمد ہو گیا!",
  "PDF export failed": "PDF برآمدگی ناکام",
  "Please allow popups to print.": "پرنٹ کرنے کے لیے پاپ اپ کی اجازت دیں۔",
  "Thank you for choosing Tailor CRM": "Tailor CRM منتخب کرنے کا شکریہ",

  // ── Placeholders ──
  "Search customers...": "گاہک تلاش کریں...",
  "Search by name or phone...": "نام یا فون سے تلاش کریں...",
  "Search name or phone...": "نام یا فون سے تلاش کریں...",
  "Search order number...": "آرڈر نمبر تلاش کریں...",
  "Full name": "پورا نام",
  "Phone number": "فون نمبر",
  "Internal notes...": "اندرونی نوٹس...",
  "Notes...": "نوٹس...",
  "Order notes...": "آرڈر نوٹس...",
  "Auto-generated": "خودکار تیار شدہ",
  "you@example.com": "you@example.com",
  "you@example.com or 0300 1234567": "you@example.com یا 0300 1234567",

  // ── Plan / feature words ──
  "Plan": "پلان",
  "Upgrade": "اپ گریڈ",
  "Tailor": "درزی",
  "Craftsman": "کاریگر",

  // ── Sort / filter options + remaining examples ──
  "Name A-Z": "نام الف-ی",
  "Newest": "تازہ ترین",
  "Oldest": "قدیم ترین",
  "You’ve used all": "آپ نے سب استعمال کر لیے",
  "You've used all": "آپ نے سب استعمال کر لیے",
  "e.g. 150": "مثلاً 150",
  "e.g. Coat": "مثلاً کوٹ",
  "e.g. Electricity, Gas, Shop Rent": "مثلاً بجلی، گیس، دکان کا کرایہ",
  "e.g. Ahmad Raza": "مثلاً احمد رضا",
  "e.g. Saifi Tailors": "مثلاً سیفی ٹیلرز",
  "e.g. Shalwar Qameez Basic": "مثلاً شلوار قمیض بنیادی",
  "e.g. TXN-839201": "مثلاً TXN-839201",
  "e.g. Thread, buttons, lining...": "مثلاً دھاگہ، بٹن، استر...",
  "e.g. rush job": "مثلاً جلدی کام",

  // ── Measurement group titles ──
  "Upper Body": "اوپری جسم",
  "Shalwar / Trouser": "شلوار / پتلون",
  "Stitching Details": "سلائی تفصیلات",
  "Gala Style": "گلا اسٹائل",
  "Style Details": "اسٹائل تفصیلات",

  // ── Measurement field labels (group .label forms) ──
  "Lambai (Length)": "لمبائی",
  "Lambai (Length)": "لمبائی",
  "Lambai Qamees (Length)": "لمبائی قمیض",
  "Baazu (Sleeve)": "بازو",
  "Baazu": "بازو",
  "Teera": "تیرہ",
  "Gala (Collar)": "گلا",
  "Gala": "گلا",
  "Chaati (Chest)": "چھاتی",
  "Kamar (Waist)": "کمر",
  "Gehra (Depth)": "گہرہ",
  "Ghera": "گھیرا",
  "Painchhay": "پائنچے",
  "Shalwar Pocket": "شلوار پاکٹ",
  "Hip": "ہپ",
  "Thigh": "ران",
  "Goda (Knees)": "گوڈا (گھٹنا)",
  "Karhai Number": "کڑھائی نمبر",
  "Kalar Nok": "کالر نوک",
  "Kaf Chorai": "کف چوڑائی",
  "Parri Chorai": "پڑی چوڑائی",
  "Front Pocket": "سامنے پاکٹ",
  "Side Pocket": "سائیڈ پاکٹ",

  // ── Measurement field labels (labelize() forms from snake_case keys) ──
  "Lambai Qamees": "لمبائی قمیض",
  "Chaati": "چھاتی",
  "Kamar": "کمر",
  "Gehra": "گہرہ",
  "Goda": "گوڈا",
  "Shalwar Lambai": "شلوار لمبائی",
  "Trouser Lambai": "پتلون لمبائی",
  "Sq Baazu Style": "بازو اسٹائل",
  "Sq Gala Style": "گلا اسٹائل",
  "Sq Ghera Style": "گھیرا اسٹائل",

  // ── Style option values ──
  "Gol Gala": "گول گلا",
  "V Gala": "وی گلا",
  "Ban": "بین",
  "Kaf": "کف",
  "Gol": "گول",
  "Kollar": "کالر",
  "Choras": "چورس",

  // ── Misc dialog text ──
  "Profile": "پروفائل",
  "Customer": "گاہک",
  "Saving...": "محفوظ ہو رہا ہے...",

  // ── Order creation flow ──
  "Open Measurements": "پیمائش کھولیں",
  "Open measurements": "پیمائش کھولیں",
  "Karigar Assignment": "کاریگر تفویض",
  "Edit Assignments": "تفویضات میں ترمیم",
  "Next: Order Details →": "اگلا: آرڈر تفصیلات →",
  "Next: Order Details": "اگلا: آرڈر تفصیلات",
  "← Back": "→ واپس",
  "Back": "واپس",
  "Next": "اگلا",
  "+ Add Item": "+ آئٹم شامل کریں",
  "-- Pick item to add --": "-- شامل کرنے کے لیے آئٹم منتخب کریں --",
  "Adding…": "شامل ہو رہا ہے…",
  "DS Reshmi": "ڈبل سلائی ریشمی",
  "DS Jaali Pancha": "ڈبل سلائی جالی پانچہ",
  "DS Sada": "ڈبل سلائی سادہ",
  "Double salai": "ڈبل سلائی",
  "Double Salai": "ڈبل سلائی",
  "Qty": "تعداد",
  "Price Rs": "قیمت روپے",

  // ── View order / receipt ──
  "Receipt / PDF": "رسید / PDF",
  "Receipt/PDF": "رسید / PDF",
  "Receipt": "رسید",

  // ── Subscription submit ──
  "I’ve paid — submit": "میں نے ادائیگی کر دی — جمع کریں",
  "I've paid — submit": "میں نے ادائیگی کر دی — جمع کریں",
  "Submitting…": "جمع ہو رہا ہے…",
  "Your plan activates once we confirm the payment, usually within a few hours.":
    "ادائیگی کی تصدیق کے بعد آپ کا پلان فعال ہو جائے گا، عموماً چند گھنٹوں میں۔",

  // ── Reports total widgets ──
  "Total Revenue": "کل آمدنی",
  "Total Earnings": "کل آمدنی",
  "Total Expenses": "کل اخراجات",
  "Total Sales": "کل فروخت",
  "Total Pending": "کل زیر التواء",
  "Pending Amount": "زیر التواء رقم",
  "Net Profit": "خالص منافع",
  "Revenue": "آمدنی",
  "Profit": "منافع",
  "Paid": "ادا شدہ",
  "Unpaid": "غیر ادا شدہ",
  "Completed": "مکمل",

  // ── Reports KPI labels (exact) ──
  "Period:": "مدت:",
  "Total Invoiced": "کل انوائس شدہ",
  "Income": "آمدنی",
  "Total Orders": "کل آرڈر",
  "Paid": "ادا شدہ",
  "Total Value": "کل مالیت",
  "Total Customers": "کل گاہک",
  "New This Period": "اس مدت میں نئے",
  "Active Karigars": "فعال کاریگر",
  // ── Reports KPI subs ──
  "All expenses": "تمام اخراجات",
  "Revenue − Expenses": "آمدنی − اخراجات",
  "in selected period": "منتخب مدت میں",
  "all statuses": "تمام حیثیتیں",
  "all time": "تمام وقت",
  "joined in range": "حد میں شامل ہوئے",
  "with assignments": "تفویضات کے ساتھ",
  "based on agreed rates": "طے شدہ ریٹس کی بنیاد پر",
}

// ── Pattern phrases ──
// Strings with interpolated values (plan names, counts) that can't be matched
// literally. Each entry: a regex over the trimmed English text → Urdu builder.
const UR_PATTERNS = [
  // "I've paid for Pro — submit"  /  "I've paid for Standard — submit"
  [/^I[’']ve paid for (.+?) — submit$/i, (m) => `میں نے ${m[1]} کے لیے ادائیگی کر دی — جمع کریں`],
  // "Payment submitted — we'll verify and activate Pro shortly."
  [/^Payment submitted — we[’']ll verify and activate (.+?) shortly\.$/i,
    (m) => `ادائیگی جمع ہو گئی — ہم تصدیق کر کے ${m[1]} جلد فعال کر دیں گے۔`],
  // Reports KPI count subs
  [/^(\d+) active orders$/i,    (m) => `${m[1]} فعال آرڈر`],
  [/^(\d+) delivered orders$/i, (m) => `${m[1]} ڈلیور شدہ آرڈر`],
  [/^Karigar (.+?) \+ Category (.+)$/i, (m) => `کاریگر ${m[1]} + قسم ${m[2]}`],
  // Order count subs commonly seen elsewhere
  [/^(\d+) active orders?$/i,    (m) => `${m[1]} فعال آرڈر`],
]

// Lowercased lookup map for case-insensitive matching.
const LC_MAP = (() => {
  const m = Object.create(null)
  for (const k in UR_PHRASES) m[k.toLowerCase()] = UR_PHRASES[k]
  return m
})()

// Translate a single chunk of text. Returns the Urdu string if a full-phrase
// match exists, otherwise the original.
export function urText(raw) {
  if (!raw) return raw
  const trimmed = raw.trim()
  if (!trimmed) return raw
  const lead = raw.match(/^\s*/)[0]
  const tail = raw.match(/\s*$/)[0]
  const hit = LC_MAP[trimmed.toLowerCase()]
  if (hit != null) return lead + hit + tail
  // Try interpolated-value patterns (plan names, counts, etc.).
  for (const [re, build] of UR_PATTERNS) {
    const m = trimmed.match(re)
    if (m) return lead + build(m) + tail
  }
  return raw
}

// ── Runtime DOM translator ───────────────────────────────────────────────────

// Skip translating inside elements we must leave untouched: script/style, code,
// inputs the user is typing into, anything explicitly opted out, and the
// Backstage admin route content.
function shouldSkip(node) {
  let el = node.nodeType === 3 ? node.parentElement : node
  while (el) {
    const tag = el.tagName
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "CODE" || tag === "PRE") return true
    if (el.getAttribute && el.getAttribute("data-no-ur") != null) return true
    if (el.getAttribute && el.getAttribute("translate") === "no") return true
    el = el.parentElement
  }
  return false
}

function isAdminPath() {
  return window.location.pathname.startsWith("/backstage")
}

// Walk text nodes + key attributes under root and translate them.
export function translateTree(root) {
  if (!root || isAdminPath()) return

  // Text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      if (shouldSkip(n)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const texts = []
  let t
  while ((t = walker.nextNode())) texts.push(t)
  for (const n of texts) {
    const next = urText(n.nodeValue)
    if (next !== n.nodeValue) n.nodeValue = next
  }

  // Attributes: placeholder, title, aria-label, value (buttons/submit), alt
  const elRoot = root.nodeType === 1 ? root : document.body
  const all = elRoot.querySelectorAll("[placeholder],[title],[aria-label],[alt]")
  const list = root.nodeType === 1 && root.matches("[placeholder],[title],[aria-label],[alt]")
    ? [root, ...all] : [...all]
  for (const el of list) {
    if (shouldSkip(el)) continue
    for (const attr of ["placeholder", "title", "aria-label", "alt"]) {
      const v = el.getAttribute(attr)
      if (v) {
        const nv = urText(v)
        if (nv !== v) el.setAttribute(attr, nv)
      }
    }
    if ((el.tagName === "INPUT") && (el.type === "button" || el.type === "submit") && el.value) {
      const nv = urText(el.value)
      if (nv !== el.value) el.value = nv
    }
  }
}

// ── Global RTL stylesheet ────────────────────────────────────────────────────
// document dir=rtl flips block layout, but a lot of UI uses inline styles
// (textAlign, flexDirection:"row", marginLeft, etc.) that don't auto-mirror.
// This stylesheet forces a consistent right-to-left presentation everywhere
// when Urdu is active. It's scoped to html[dir="rtl"] so it only applies then.
const RTL_CSS = `
html[dir="rtl"] body { direction: rtl; }
html[dir="rtl"] * { text-align: inherit; }
html[dir="rtl"] body,
html[dir="rtl"] .content,
html[dir="rtl"] .dg,
html[dir="rtl"] .dblk,
html[dir="rtl"] .dr,
html[dir="rtl"] .mgrp,
html[dir="rtl"] .mv,
html[dir="rtl"] .topbar,
html[dir="rtl"] [class*="Dialog"],
html[dir="rtl"] [role="dialog"] { direction: rtl; text-align: right; }
/* Inputs and textareas read right-to-left */
html[dir="rtl"] input,
html[dir="rtl"] textarea,
html[dir="rtl"] select { text-align: right; direction: rtl; }
/* Keep phone numbers, amounts and codes legible (LTR digits) */
html[dir="rtl"] input[type="tel"],
html[dir="rtl"] input[type="email"],
html[dir="rtl"] input[type="number"],
html[dir="rtl"] .dv,
html[dir="rtl"] a[href^="tel:"] { direction: ltr; unicode-bidi: plaintext; }
/* Mirror simple horizontal margins used for spacing/auto-push */
html[dir="rtl"] [style*="margin-left: auto"] { margin-left: 0 !important; margin-right: auto !important; }
/* Dialog footers / button rows flow from the right */
html[dir="rtl"] [class*="DialogFooter"],
html[dir="rtl"] .sb-foot,
html[dir="rtl"] .tb-right { flex-direction: row-reverse; }

/* ── Targeted fixes ─────────────────────────────────────────────────── */

/* Customer card: keep the call button pinned to the right edge.
   .cct is a flex row [ name-block(flex:1) , call-link ]. Under RTL the call
   link would land on the left; pin it back to the right with order + margin. */
html[dir="rtl"] .cct { flex-direction: row; }
html[dir="rtl"] .cct > a[href^="tel:"] { order: 2; margin-right: auto; margin-left: 0; }
html[dir="rtl"] .cct > div:first-child { order: 1; }

/* Radix Dialog close button (top-right "X") → move to top-left. */
html[dir="rtl"] [role="dialog"] .absolute.right-4 {
  right: auto !important;
  left: 1rem !important;
}

/* Date / number inputs: show their value right-aligned but keep the digits
   themselves left-to-right so dates read correctly. */
html[dir="rtl"] input[type="date"],
html[dir="rtl"] input[type="number"] {
  text-align: right;
  direction: ltr;
}

/* Toggle switches must behave exactly like the English version (thumb slides
   the same way). The Switch itself is dir="ltr" in markup; nothing here should
   mirror it. */
html[dir="rtl"] [role="switch"] { direction: ltr !important; }

/* DS rows: lay out right-to-left as [toggle] → [DS text] → [+Rs price].
   DOM order is [Switch, label]; row-reverse renders the toggle on the right
   and the label (text then price) to its left. Keep the label LTR-flowing so
   "DS text" stays before "+Rs price". */
html[dir="rtl"] .ds-row { flex-direction: row-reverse; justify-content: flex-end; }
html[dir="rtl"] .ds-row label { direction: rtl; text-align: right; unicode-bidi: plaintext; }
html[dir="rtl"] .ds-row label > span { unicode-bidi: plaintext; }

/* Tables (dashboard + reports): headers and cells align to the right. */
html[dir="rtl"] table { direction: rtl; }
html[dir="rtl"] th,
html[dir="rtl"] td { text-align: right; }

/* All buttons: center their label text when Urdu is active. */
html[dir="rtl"] button,
html[dir="rtl"] .lg-btn,
html[dir="rtl"] [class*="Button"],
html[dir="rtl"] a[role="button"] {
  text-align: center;
  justify-content: center;
}
`

export function applyRtlStyles(on) {
  let el = document.getElementById("ur-rtl-style")
  if (on) {
    if (!el) {
      el = document.createElement("style")
      el.id = "ur-rtl-style"
      el.textContent = RTL_CSS
      document.head.appendChild(el)
    }
  } else if (el) {
    el.remove()
  }
}

let observer = null

// Start observing the whole document and translating into Urdu. Idempotent.
export function startUrduObserver() {
  if (observer) return
  translateTree(document.body)
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) translateTree(n)
          else if (n.nodeType === 3) {
            const nv = urText(n.nodeValue)
            if (nv !== n.nodeValue && !shouldSkip(n)) n.nodeValue = nv
          }
        })
      } else if (m.type === "characterData") {
        if (m.target.nodeType === 3 && !shouldSkip(m.target)) {
          const nv = urText(m.target.nodeValue)
          if (nv !== m.target.nodeValue) m.target.nodeValue = nv
        }
      }
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

export function stopUrduObserver() {
  if (observer) { observer.disconnect(); observer = null }
}
