'use strict';
// Bilingual dictionary (Arabic default, English). Engine returns language-neutral codes;
// all user-facing wording lives here.

const I18N = {
  ar: {
    dir: 'rtl',
    brand: 'صقر',
    brand_sub: 'منصة مجتمعية لكشف الاحتيال',
    nav_scan: 'افحص', nav_report: 'بلّغ', nav_registry: 'السجل', nav_tips: 'احمِ نفسك', nav_dashboard: 'لوحة الجهات',
    lang_toggle: 'English',
    hero_title: 'افحص قبل ما تضغط',
    hero_sub: 'الصق رسالة أو رابط أو رقم هاتف، وصقر يحللها خلال ثانية بدون ما يفتح الرابط وبدون ما يحفظ اللي تكتبه.',
    input_ph: 'الصق الرسالة أو الرابط أو الرقم هنا…',
    type_auto: 'تلقائي', type_message: 'رسالة', type_url: 'رابط', type_phone: 'رقم',
    scan_btn: 'افحص الآن', scanning: 'جاري الفحص…',
    try_example: 'جرّب مثال:',
    ex_fine: 'مخالفة مزيفة', ex_bank: 'موظف بنك', ex_link: 'رابط مشبوه', ex_safe: 'رسالة عادية',
    privacy_line: 'خصوصيتك أولاً: الفحص يتم على خوادم صقر فقط، لا نفتح الروابط ولا نخزن النص.',
    stat_verified: 'مؤشر احتيال موثّق', stat_reports: 'بلاغ من المجتمع', stat_scans: 'عملية فحص',
    risk_score: 'درجة الخطورة', detected_as: 'نوع المُدخل',
    level_safe: 'يبدو آمناً', level_suspicious: 'مشبوه', level_dangerous: 'خطير — احتيال مرجّح',
    level_safe_d: 'ما لقينا مؤشرات احتيال واضحة، لكن خلك منتبه دائماً.',
    level_suspicious_d: 'فيه علامات تستدعي الحذر. تأكد من الجهة عبر قنواتها الرسمية قبل أي خطوة.',
    level_dangerous_d: 'هذا يطابق أساليب احتيال معروفة. لا تضغط، لا ترد، ولا تشارك أي بيانات.',
    why: 'ليش هذا الحكم؟', inside: 'ما وجدناه داخل الرسالة', what_to_do: 'وش تسوي الحين؟',
    report_this: 'بلّغ عن هذا', scan_another: 'افحص شي ثاني',
    // reasons
    r_ml_scam_language: 'نموذج الذكاء الاصطناعي يرى أن الصياغة تشبه رسائل الاحتيال بنسبة {pct}٪{terms_part}',
    r_ml_normal_language: 'الصياغة تشبه الرسائل العادية بنسبة {pct}٪',
    terms_part: ' (كلمات مثل: {terms})',
    r_tactic_credentials: 'تطلب رمز تحقق أو رقم سري أو بيانات بطاقة ({terms}) — الجهات الرسمية لا تطلبها أبداً',
    r_tactic_personal_data: 'تطلب تحديث أو إرسال بياناتك الشخصية ({terms})',
    r_tactic_urgency: 'تضغط عليك بالاستعجال ({terms})',
    r_tactic_threat: 'تهديد بإيقاف أو حظر أو إجراء قانوني ({terms})',
    r_tactic_prize: 'وعد بجائزة أو ربح مفاجئ ({terms})',
    r_tactic_payment: 'تطلب دفع رسوم أو غرامة أو تحويل ({terms})',
    r_tactic_impersonation: 'تدّعي أنها من جهة رسمية أو شركة معروفة ({terms})',
    r_tactic_parcel: 'تتكلم عن شحنة أو توصيل ({terms})',
    r_tactic_investment: 'وعود استثمار وأرباح مضمونة ({terms})',
    r_tactic_job: 'عرض وظيفة سهل بدخل عالي ({terms})',
    r_tactic_off_platform: 'تطلب التواصل عبر تطبيقات دردشة خاصة ({terms})',
    r_tactic_new_number: 'شخص يدّعي إنه قريب لك برقم جديد ({terms})',
    r_contains_link: 'تحتوي على {count} رابط',
    r_contains_risky_link: 'تحتوي على رابط خطير',
    r_contains_phone: 'تحتوي على {count} رقم هاتف',
    r_contains_risky_phone: 'تحتوي على رقم هاتف مشبوه',
    r_combo_impersonation: 'انتحال جهة رسمية + طلب دفع أو بيانات أو رابط: هذا النمط الأشهر للاحتيال',
    r_combo_official_personal_number: 'جهة "رسمية" تطلب التواصل على رقم جوال شخصي أو دولي',
    r_contains_verified_indicator: 'تحتوي على رابط أو رقم موثّق كاحتيال في سجل صقر',
    r_url_invalid: 'الرابط غير صالح أو مشوّه',
    r_official_domain: 'نطاق حكومي رسمي ({domain})',
    r_trusted_domain: 'نطاق موثوق معروف ({domain})',
    r_no_https: 'الرابط غير مشفّر (http)',
    r_ip_host: 'الرابط يستخدم عنوان IP بدل اسم موقع',
    r_punycode: 'الرابط يستخدم حروفاً مخادعة تشبه الحروف اللاتينية',
    r_gov_spoof: 'يتظاهر بأنه نطاق حكومي gov.ae وهو ليس كذلك ({domain})',
    r_authority_unofficial: 'يستخدم اسم جهة رسمية "{name}" على نطاق غير رسمي ({domain})',
    r_brand_unofficial: 'يستخدم اسم "{name}" على نطاق لا يتبع الشركة ({domain})',
    r_lookalike_domain: 'نطاق مقلّد يشبه "{name}" ({domain})',
    r_suspicious_tld: 'امتداد نطاق شائع في الاحتيال (.{tld})',
    r_shortener: 'رابط مختصر يخفي الوجهة الحقيقية ({domain})',
    r_free_hosting: 'مستضاف على خدمة استضافة مجانية ({domain})',
    r_at_symbol: 'الرابط يحتوي على @ لإخفاء الوجهة الحقيقية',
    r_many_subdomains: 'عدد كبير من النطاقات الفرعية ({count})',
    r_many_hyphens: 'اسم نطاق طويل بشرطات كثيرة',
    r_long_url: 'رابط طويل بشكل غير طبيعي',
    r_odd_port: 'منفذ غير معتاد ({port})',
    r_phish_words: 'كلمات تصيّد في الرابط ({terms})',
    r_registry_verified: 'موثّق كاحتيال في سجل صقر ({reports} بلاغ)',
    r_registry_reported: 'بلّغ عنه {reports} شخص من المجتمع (قيد المراجعة)',
    r_phone_invalid: 'صيغة الرقم غير صحيحة',
    r_official_emergency: 'رقم طوارئ رسمي ({service})',
    r_uae_service_number: 'رقم خدمة إماراتي (800/600)',
    r_uae_mobile: 'رقم جوال إماراتي — الجهات الرسمية لا تتصل من أرقام جوال شخصية',
    r_uae_landline: 'رقم أرضي إماراتي',
    r_premium_range: 'نطاق دولي مرتفع التكلفة يُستغل في احتيال المكالمات الفائتة ({prefix})',
    r_international: 'رقم دولي ({prefix}) — انتبه إذا ادّعى أنه جهة محلية',
    svc_police: 'الشرطة', svc_ambulance: 'الإسعاف', svc_civil_defence: 'الدفاع المدني', svc_coast_guard: 'خفر السواحل',
    // advice
    advice_stay_alert: 'خلك منتبه: أي طلب لرمز التحقق أو الرقم السري احتيال حتى لو بدا رسمياً.',
    advice_official_channels: 'تعامل مع الجهات عبر تطبيقاتها ومواقعها الرسمية فقط.',
    advice_dont_click: 'لا تضغط على الروابط ولا ترد على الرسالة.',
    advice_verify_official: 'تأكد بنفسك عبر الرقم أو التطبيق الرسمي للجهة، مو عبر الرقم اللي بالرسالة.',
    advice_never_share_otp: 'لا تشارك رمز التحقق (OTP) أو الرقم السري مع أي أحد، حتى لو قال إنه من البنك أو الشرطة.',
    advice_report: 'بلّغ عنها في صقر عشان تحمي غيرك.',
    advice_block: 'احظر المرسل واحذف الرسالة بعد التبليغ.',
    advice_if_paid: 'إذا دفعت أو شاركت بياناتك: اتصل بالبنك فوراً عبر الرقم خلف بطاقتك لإيقافها، وتواصل مع الشرطة.',
    // report
    report_title: 'بلّغ عن احتيال',
    report_sub: 'بلاغك يحمي غيرك. ما نطلب اسمك ولا رقمك، ونحذف بياناتك الشخصية من النص تلقائياً.',
    f_type: 'نوع البلاغ', f_value_message: 'نص الرسالة', f_value_url: 'الرابط', f_value_phone: 'رقم المحتال',
    f_category: 'نوع الاحتيال', f_channel: 'وصلك عن طريق', f_emirate: 'الإمارة (اختياري)', f_amount: 'المبلغ المفقود بالدرهم (اختياري)',
    f_desc: 'وصف مختصر (اختياري)', f_choose: 'اختر…', f_none: 'أفضّل عدم الذكر',
    submit_report: 'أرسل البلاغ', sending: 'جاري الإرسال…',
    report_ok: 'تم استلام بلاغك، شكراً لك 🦅',
    report_ok_d: 'سيظهر في السجل بعد مراجعة الجهات المختصة أو بعد تكرار البلاغ من أكثر من شخص.',
    report_redacted: 'حذفنا بيانات شخصية من النص قبل الحفظ (مثل رقم بطاقة أو هوية أو رمز).',
    report_another: 'بلاغ جديد',
    privacy_title: 'كيف نحمي خصوصيتك',
    privacy_1: 'بدون حساب، بدون اسم، بدون رقم هاتفك.',
    privacy_2: 'نحذف تلقائياً أرقام البطاقات والهوية والآيبان والإيميل والرموز من النص.',
    privacy_3: 'نحفظ بصمة مشفّرة تتغيّر يومياً فقط لمنع التكرار، ولا يمكن ربطها بك.',
    // registry
    registry_title: 'سجل الاحتيال المجتمعي',
    registry_sub: 'روابط وأرقام ورسائل وثّقتها الجهات المختصة أو بلّغ عنها أكثر من شخص.',
    search_ph: 'ابحث برقم أو رابط…', all_types: 'الكل', search_btn: 'بحث',
    st_verified: 'موثّق', st_reported: 'مُبلّغ عنه', reports_n: '{n} بلاغ', last_seen: 'آخر ظهور',
    no_results: 'ما فيه نتائج. هذا لا يعني إنه آمن — افحصه أولاً.',
    prev: 'السابق', next: 'التالي', page_of: 'صفحة {p} من {t}',
    // tips
    tips_title: 'احمِ نفسك وأهلك',
    tip1_t: 'الجهات الرسمية ما تطلب الرمز', tip1_d: 'لا الشرطة ولا البنك ولا أي جهة حكومية تطلب منك رمز التحقق أو الرقم السري. أي طلب لهم = احتيال.',
    tip2_t: 'المخالفات تُدفع من التطبيق الرسمي', tip2_d: 'إذا وصلك رابط لدفع مخالفة، افتح التطبيق الرسمي بنفسك وتأكد. لا تدفع من رابط رسالة.',
    tip3_t: 'افحص النطاق قبل ما تضغط', tip3_d: 'المواقع الحكومية تنتهي بـ gov.ae. انتبه للمواقع المقلدة مثل gov-ae أو أسماء جهات على نطاقات غريبة.',
    tip4_t: 'الاستعجال علامة خطر', tip4_d: '"خلال 24 ساعة" و"سيتم إيقاف حسابك" أساليب ضغط عشان ما تفكر.',
    tip5_t: 'قريبك برقم جديد؟ اتصل عليه', tip5_d: 'قبل ما تحوّل لأي أحد يقول إنه قريبك برقم جديد، اتصل على رقمه القديم أو اسأل العائلة.',
    tip6_t: 'إذا وقعت في الفخ', tip6_d: 'اتصل بالبنك فوراً لإيقاف البطاقة، غيّر كلمات المرور، وتواصل مع الشرطة (999 في الطوارئ)، وبلّغ في صقر.',
    footer: 'صقر — نموذج أولي لمسابقة الابتكار في مكافحة الجريمة الإلكترونية. البيانات المعروضة تجريبية.',
    // enums
    cat_fake_fine: 'مخالفة/غرامة مزيفة', cat_bank_otp: 'انتحال بنك / سرقة رمز', cat_parcel: 'شحنة وتوصيل', cat_prize: 'جوائز وسحوبات',
    cat_investment: 'استثمار وعملات رقمية', cat_job: 'وظائف وهمية', cat_impersonation: 'انتحال جهة رسمية', cat_family_emergency: 'قريب برقم جديد',
    cat_shopping: 'متجر وهمي', cat_other: 'أخرى',
    ch_sms: 'رسالة نصية', ch_whatsapp: 'واتساب', ch_call: 'مكالمة', ch_email: 'بريد إلكتروني', ch_social: 'وسائل التواصل', ch_website: 'موقع إلكتروني', ch_other: 'أخرى',
    em_abu_dhabi: 'أبوظبي', em_dubai: 'دبي', em_sharjah: 'الشارقة', em_ajman: 'عجمان', em_umm_al_quwain: 'أم القيوين', em_ras_al_khaimah: 'رأس الخيمة', em_fujairah: 'الفجيرة', em_unknown: 'غير محدد',
    t_message: 'رسالة', t_url: 'رابط', t_phone: 'رقم',
    // errors
    e_empty_value: 'اكتب أو الصق شي عشان نفحصه.', e_too_long: 'النص طويل جداً.', e_rate_limited: 'طلبات كثيرة، حاول بعد شوي.',
    e_already_reported: 'سبق وبلّغت عن هذا اليوم. شكراً لك!', e_invalid_value: 'القيمة غير صالحة.', e_invalid_category: 'اختر نوع الاحتيال.',
    e_invalid_channel: 'اختر كيف وصلك.', e_invalid_amount: 'المبلغ غير صحيح.', e_server_error: 'صار خطأ، حاول مرة ثانية.', e_network: 'تعذر الاتصال بالخادم.',
    e_invalid_credentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    // dashboard
    dash_title: 'لوحة الجهات المختصة', login_title: 'دخول الجهات المختصة', username: 'اسم المستخدم', password: 'كلمة المرور', login: 'دخول', logout: 'خروج',
    k_reports: 'إجمالي البلاغات', k_pending: 'بانتظار المراجعة', k_verified: 'مؤشرات موثّقة', k_scans: 'عمليات الفحص', k_dangerous: 'فحوصات خطيرة', k_lost: 'خسائر مُبلّغ عنها',
    k_week: 'آخر 7 أيام', vs_prev: 'مقارنة بالأسبوع السابق',
    ch_trend: 'البلاغات اليومية — آخر 30 يوم', ch_scans: 'عمليات الفحص اليومية', ch_category: 'حسب نوع الاحتيال', ch_emirate: 'حسب الإمارة', ch_channel: 'حسب القناة',
    queue: 'قائمة المراجعة', tab_pending: 'قيد المراجعة', tab_verified: 'موثّق', tab_rejected: 'مرفوض',
    col_indicator: 'المؤشر', col_category: 'النوع', col_reports: 'البلاغات', col_score: 'الخطورة', col_last: 'آخر ظهور', col_actions: 'الإجراء',
    a_verify: 'توثيق', a_reject: 'رفض', a_reset: 'إرجاع للمراجعة', a_details: 'التفاصيل',
    export_csv: 'تصدير القائمة الموثّقة (CSV)', export_hint: 'لمشاركتها مع مزودي الاتصالات والبنوك لحظر المؤشرات.',
    model_title: 'نموذج الكشف', model_samples: 'عينات التدريب', model_vocab: 'المفردات', model_learned: 'تعلّم من البلاغات', model_trained: 'آخر تدريب',
    model_note: 'عند توثيق أو رفض رسالة، يُعاد تدريب النموذج تلقائياً ليتعلم من المجتمع.',
    audit_title: 'سجل التدقيق', learned_toast: 'تم التحديث وإعادة تدريب النموذج', updated_toast: 'تم التحديث',
    recent_reports: 'آخر البلاغات', no_items: 'لا توجد عناصر.', amount: '{n} درهم',
  },
  en: {
    dir: 'ltr',
    brand: 'Saqr',
    brand_sub: 'Community fraud detection',
    nav_scan: 'Scan', nav_report: 'Report', nav_registry: 'Registry', nav_tips: 'Stay safe', nav_dashboard: 'Authorities',
    lang_toggle: 'العربية',
    hero_title: 'Check before you click',
    hero_sub: 'Paste a message, link or phone number. Saqr analyses it in a second — without opening the link and without storing what you type.',
    input_ph: 'Paste the message, link or number here…',
    type_auto: 'Auto', type_message: 'Message', type_url: 'Link', type_phone: 'Number',
    scan_btn: 'Scan now', scanning: 'Scanning…',
    try_example: 'Try an example:',
    ex_fine: 'Fake fine', ex_bank: 'Bank caller', ex_link: 'Suspicious link', ex_safe: 'Normal message',
    privacy_line: 'Privacy first: scans run on Saqr servers only. We never open links or store your text.',
    stat_verified: 'verified fraud indicators', stat_reports: 'community reports', stat_scans: 'scans',
    risk_score: 'Risk score', detected_as: 'Detected as',
    level_safe: 'Looks safe', level_suspicious: 'Suspicious', level_dangerous: 'Dangerous — likely fraud',
    level_safe_d: 'No clear fraud indicators found, but always stay alert.',
    level_suspicious_d: 'There are warning signs. Verify with the organisation through its official channels first.',
    level_dangerous_d: 'This matches known fraud tactics. Do not click, do not reply, do not share any data.',
    why: 'Why this verdict?', inside: 'What we found inside the message', what_to_do: 'What to do now',
    report_this: 'Report this', scan_another: 'Scan something else',
    r_ml_scam_language: 'The AI model finds the wording {pct}% similar to scam messages{terms_part}',
    r_ml_normal_language: 'Wording is {pct}% similar to normal messages',
    terms_part: ' (words like: {terms})',
    r_tactic_credentials: 'Asks for a verification code, PIN or card details ({terms}) — official bodies never ask for these',
    r_tactic_personal_data: 'Asks you to update or send personal data ({terms})',
    r_tactic_urgency: 'Pressures you to act fast ({terms})',
    r_tactic_threat: 'Threatens suspension, blocking or legal action ({terms})',
    r_tactic_prize: 'Promises a surprise prize or win ({terms})',
    r_tactic_payment: 'Asks you to pay a fee, fine or transfer ({terms})',
    r_tactic_impersonation: 'Claims to be an authority or well-known company ({terms})',
    r_tactic_parcel: 'Talks about a parcel or delivery ({terms})',
    r_tactic_investment: 'Promises guaranteed investment profit ({terms})',
    r_tactic_job: 'Easy job offer with high income ({terms})',
    r_tactic_off_platform: 'Asks you to move to a private chat app ({terms})',
    r_tactic_new_number: 'Someone claiming to be a relative on a new number ({terms})',
    r_contains_link: 'Contains {count} link(s)',
    r_contains_risky_link: 'Contains a dangerous link',
    r_contains_phone: 'Contains {count} phone number(s)',
    r_contains_risky_phone: 'Contains a suspicious phone number',
    r_combo_impersonation: 'Impersonation + payment, data request or link: the most common fraud pattern',
    r_combo_official_personal_number: 'An "official" body asking you to contact a personal mobile or international number',
    r_contains_verified_indicator: 'Contains a link or number verified as fraud in the Saqr registry',
    r_url_invalid: 'The link is invalid or malformed',
    r_official_domain: 'Official government domain ({domain})',
    r_trusted_domain: 'Known trusted domain ({domain})',
    r_no_https: 'The link is not encrypted (http)',
    r_ip_host: 'The link uses an IP address instead of a site name',
    r_punycode: 'The link uses deceptive look-alike characters',
    r_gov_spoof: 'Pretends to be a gov.ae domain but is not ({domain})',
    r_authority_unofficial: 'Uses the authority name "{name}" on an unofficial domain ({domain})',
    r_brand_unofficial: 'Uses the name "{name}" on a domain the company does not own ({domain})',
    r_lookalike_domain: 'Look-alike domain imitating "{name}" ({domain})',
    r_suspicious_tld: 'Domain extension common in fraud (.{tld})',
    r_shortener: 'Shortened link hides the real destination ({domain})',
    r_free_hosting: 'Hosted on a free hosting service ({domain})',
    r_at_symbol: 'The link contains @ to hide the real destination',
    r_many_subdomains: 'Unusually many subdomains ({count})',
    r_many_hyphens: 'Long domain name with many hyphens',
    r_long_url: 'Unusually long link',
    r_odd_port: 'Unusual port ({port})',
    r_phish_words: 'Phishing words in the link ({terms})',
    r_registry_verified: 'Verified as fraud in the Saqr registry ({reports} reports)',
    r_registry_reported: 'Reported by {reports} community members (under review)',
    r_phone_invalid: 'Invalid number format',
    r_official_emergency: 'Official emergency number ({service})',
    r_uae_service_number: 'UAE service number (800/600)',
    r_uae_mobile: 'UAE mobile number — official bodies do not call from personal mobiles',
    r_uae_landline: 'UAE landline number',
    r_premium_range: 'High-cost international range abused in missed-call fraud ({prefix})',
    r_international: 'International number ({prefix}) — be careful if it claims to be local',
    svc_police: 'Police', svc_ambulance: 'Ambulance', svc_civil_defence: 'Civil Defence', svc_coast_guard: 'Coast Guard',
    advice_stay_alert: 'Stay alert: any request for a verification code or PIN is fraud, even if it looks official.',
    advice_official_channels: 'Deal with organisations only through their official apps and websites.',
    advice_dont_click: 'Do not click links or reply to the message.',
    advice_verify_official: 'Verify yourself via the organisation’s official number or app — not the one in the message.',
    advice_never_share_otp: 'Never share your OTP or PIN with anyone, even if they say they are the bank or police.',
    advice_report: 'Report it on Saqr to protect others.',
    advice_block: 'Block the sender and delete the message after reporting.',
    advice_if_paid: 'If you paid or shared data: call your bank immediately via the number on your card to block it, and contact the police.',
    report_title: 'Report a scam',
    report_sub: 'Your report protects others. We do not ask for your name or number, and we automatically remove personal data from the text.',
    f_type: 'Report type', f_value_message: 'Message text', f_value_url: 'Link', f_value_phone: 'Scammer’s number',
    f_category: 'Type of fraud', f_channel: 'How it reached you', f_emirate: 'Emirate (optional)', f_amount: 'Amount lost in AED (optional)',
    f_desc: 'Short description (optional)', f_choose: 'Choose…', f_none: 'Prefer not to say',
    submit_report: 'Send report', sending: 'Sending…',
    report_ok: 'Report received — thank you 🦅',
    report_ok_d: 'It will appear in the registry after review by the authorities, or once several people report it.',
    report_redacted: 'We removed personal data from the text before saving (such as a card, ID or code).',
    report_another: 'New report',
    privacy_title: 'How we protect your privacy',
    privacy_1: 'No account, no name, no phone number of yours.',
    privacy_2: 'Card numbers, Emirates ID, IBAN, emails and codes are removed from the text automatically.',
    privacy_3: 'We keep only a daily-rotating encrypted fingerprint to stop duplicates; it cannot be linked to you.',
    registry_title: 'Community fraud registry',
    registry_sub: 'Links, numbers and messages verified by the authorities or reported by several people.',
    search_ph: 'Search a number or link…', all_types: 'All', search_btn: 'Search',
    st_verified: 'Verified', st_reported: 'Reported', reports_n: '{n} reports', last_seen: 'Last seen',
    no_results: 'No results. That does not mean it is safe — scan it first.',
    prev: 'Previous', next: 'Next', page_of: 'Page {p} of {t}',
    tips_title: 'Protect yourself and your family',
    tip1_t: 'Authorities never ask for codes', tip1_d: 'Neither the police, your bank nor any government body will ask for your OTP or PIN. Any such request is fraud.',
    tip2_t: 'Pay fines in the official app', tip2_d: 'Got a link to pay a fine? Open the official app yourself and check. Never pay from a message link.',
    tip3_t: 'Check the domain before you click', tip3_d: 'Government sites end with gov.ae. Watch for fakes like gov-ae or authority names on strange domains.',
    tip4_t: 'Urgency is a red flag', tip4_d: '“Within 24 hours” and “your account will be suspended” are pressure tactics so you don’t think.',
    tip5_t: 'Relative on a new number? Call them', tip5_d: 'Before sending money to someone claiming to be family on a new number, call their old number or ask the family.',
    tip6_t: 'If you fell for it', tip6_d: 'Call your bank immediately to block the card, change your passwords, contact the police (999 in emergencies) and report on Saqr.',
    footer: 'Saqr — prototype for the cybercrime prevention innovation competition. Data shown is demo data.',
    cat_fake_fine: 'Fake fine', cat_bank_otp: 'Bank impersonation / OTP theft', cat_parcel: 'Parcel & delivery', cat_prize: 'Prizes & draws',
    cat_investment: 'Investment & crypto', cat_job: 'Fake jobs', cat_impersonation: 'Authority impersonation', cat_family_emergency: 'Relative on new number',
    cat_shopping: 'Fake shop', cat_other: 'Other',
    ch_sms: 'SMS', ch_whatsapp: 'WhatsApp', ch_call: 'Phone call', ch_email: 'Email', ch_social: 'Social media', ch_website: 'Website', ch_other: 'Other',
    em_abu_dhabi: 'Abu Dhabi', em_dubai: 'Dubai', em_sharjah: 'Sharjah', em_ajman: 'Ajman', em_umm_al_quwain: 'Umm Al Quwain', em_ras_al_khaimah: 'Ras Al Khaimah', em_fujairah: 'Fujairah', em_unknown: 'Not specified',
    t_message: 'Message', t_url: 'Link', t_phone: 'Number',
    e_empty_value: 'Type or paste something to scan.', e_too_long: 'The text is too long.', e_rate_limited: 'Too many requests, try again shortly.',
    e_already_reported: 'You already reported this today. Thank you!', e_invalid_value: 'Invalid value.', e_invalid_category: 'Choose the type of fraud.',
    e_invalid_channel: 'Choose how it reached you.', e_invalid_amount: 'Invalid amount.', e_server_error: 'Something went wrong, please try again.', e_network: 'Could not reach the server.',
    e_invalid_credentials: 'Incorrect username or password.',
    dash_title: 'Authority dashboard', login_title: 'Authority sign-in', username: 'Username', password: 'Password', login: 'Sign in', logout: 'Sign out',
    k_reports: 'Total reports', k_pending: 'Awaiting review', k_verified: 'Verified indicators', k_scans: 'Scans', k_dangerous: 'Dangerous scans', k_lost: 'Reported losses',
    k_week: 'Last 7 days', vs_prev: 'vs previous week',
    ch_trend: 'Daily reports — last 30 days', ch_scans: 'Daily scans', ch_category: 'By fraud type', ch_emirate: 'By emirate', ch_channel: 'By channel',
    queue: 'Review queue', tab_pending: 'Pending', tab_verified: 'Verified', tab_rejected: 'Rejected',
    col_indicator: 'Indicator', col_category: 'Type', col_reports: 'Reports', col_score: 'Risk', col_last: 'Last seen', col_actions: 'Action',
    a_verify: 'Verify', a_reject: 'Reject', a_reset: 'Back to review', a_details: 'Details',
    export_csv: 'Export verified list (CSV)', export_hint: 'Share with telecom operators and banks to block indicators.',
    model_title: 'Detection model', model_samples: 'Training samples', model_vocab: 'Vocabulary', model_learned: 'Learned from reports', model_trained: 'Last trained',
    model_note: 'Verifying or rejecting a message retrains the model automatically so it learns from the community.',
    audit_title: 'Audit log', learned_toast: 'Updated and model retrained', updated_toast: 'Updated',
    recent_reports: 'Recent reports', no_items: 'No items.', amount: 'AED {n}',
  },
};

const LangStore = {
  get() { try { return localStorage.getItem('saqr_lang') || 'ar'; } catch { return 'ar'; } },
  set(l) { try { localStorage.setItem('saqr_lang', l); } catch { /* ignore */ } },
};
let LANG = LangStore.get();

function t(key, params = {}) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.ar[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (Array.isArray(v)) return v.join(LANG === 'ar' ? '، ' : ', ');
    return v ?? '';
  });
}

function reasonText(r) {
  const p = { ...(r.params || {}) };
  if (r.code === 'ml_scam_language') p.terms_part = p.terms && p.terms.length ? t('terms_part', { terms: p.terms }) : '';
  if (r.code === 'official_emergency' && p.service) p.service = t('svc_' + p.service);
  return t('r_' + r.code, p);
}

function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  document.documentElement.dir = I18N[LANG].dir;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

function toggleLang() {
  LANG = LANG === 'ar' ? 'en' : 'ar';
  LangStore.set(LANG);
  applyI18n();
  document.dispatchEvent(new CustomEvent('langchange'));
}

function fmtNum(n) { return new Intl.NumberFormat(LANG === 'ar' ? 'ar-AE' : 'en-AE').format(n); }
function fmtDate(iso) { return new Intl.DateTimeFormat(LANG === 'ar' ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw Object.assign(new Error('network'), { code: 'network' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'server_error'), { code: data.error || 'server_error', status: res.status });
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
