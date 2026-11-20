'use strict';
// Awareness training: "scam or safe?" questions. Explanations come from the live
// detection engine, so the game teaches exactly what Saqr looks for.
// All domains and numbers are fictional.

const BANK = {
  ar: [
    { text: 'شرطة دبي: عليك مخالفة 600 درهم غير مدفوعة، ادفعها خلال 24 ساعة لتجنب حجز السيارة dxbpolice-fines.top', scam: true },
    { text: 'تم خصم 89 درهم من بطاقتك المنتهية بـ 4417 لدى لولو. إذا لم تقم بالعملية اتصل بالرقم خلف البطاقة', scam: false },
    { text: 'هلا اخوي، أنا من خدمة العملاء في البنك، وصلك كود على جوالك؟ عطني اياه عشان نوقف العملية المشبوهة', scam: true },
    { text: 'رمز التحقق الخاص بك هو 731904. لا تشاركه مع أي أحد بما في ذلك موظفي البنك', scam: false },
    { text: 'بريد الإمارات: طردك موقوف لعدم اكتمال العنوان، ادفع 7 دراهم لإعادة التوصيل emiratespost-ae.click', scam: true },
    { text: 'تم شحن طلبك رقم 88213 وسيصلك خلال يومين عمل، تقدر تتابعه من التطبيق', scam: false },
    { text: 'مبروك! رقمك فاز بسيارة في سحب اليوم الوطني، تواصل واتساب لاستلام الجائزة ودفع رسوم التسجيل', scam: true },
    { text: 'يمه هذا رقمي الجديد، تلفوني طاح وانكسر، حولي لي 1200 درهم ضروري الحين وبرجعهم بكرة', scam: true },
    { text: 'تذكير: موعدك في المستشفى يوم الأحد الساعة 9 صباحاً، يرجى الحضور قبل الموعد بربع ساعة', scam: false },
    { text: 'استثمر 2000 درهم في منصتنا للعملات الرقمية واربح 10000 خلال أسبوع، أرباح مضمونة بدون مخاطرة', scam: true },
    { text: 'وظيفة من البيت براتب 900 درهم يومياً، بس تسوي لايكات للفيديوهات، بدون خبرة', scam: true },
    { text: 'تم تجديد رخصة القيادة بنجاح، تقدر تحمل النسخة الرقمية من التطبيق الرسمي', scam: false },
    { text: 'icp-uae.gov-ae.info/update تحديث الهوية الإماراتية إلزامي خلال 48 ساعة وإلا سيتم إيقافها', scam: true },
    { text: 'الاجتماع اليوم الساعة 4 في المكتب، لا تنسى الملف', scam: false },
    { text: 'اتصالات: ربحت 100 جيجا مجاناً، ادخل بيانات بطاقتك في الرابط للتفعيل', scam: true },
    { text: 'هلا والله، وصلت البيت؟ طمني عليك', scam: false },
  ],
  en: [
    { text: 'Dubai Police: unpaid fine AED 600. Pay within 24 hours to avoid vehicle impound: dxbpolice-fines.top', scam: true },
    { text: 'AED 89.00 spent on your card ending 4417 at Lulu. If this was not you, call the number on the back of your card', scam: false },
    { text: 'Hi, this is your bank’s customer service. You received a code just now, please share it so we can stop a suspicious transaction', scam: true },
    { text: 'Your verification code is 731904. Never share it with anyone, including bank staff', scam: false },
    { text: 'Emirates Post: your parcel is on hold due to an incomplete address. Pay AED 7 for redelivery: emiratespost-ae.click', scam: true },
    { text: 'Your order #88213 has shipped and will arrive within 2 business days. Track it in the app', scam: false },
    { text: 'Congratulations! Your number won a car in the National Day draw. Contact us on WhatsApp and pay the registration fee', scam: true },
    { text: 'Hi mum, this is my new number, my phone broke. Can you transfer me AED 1200 urgently, I will return it tomorrow', scam: true },
    { text: 'Reminder: your hospital appointment is on Sunday at 9 AM. Please arrive 15 minutes early', scam: false },
    { text: 'Invest AED 2000 on our crypto platform and earn 10000 in a week. Guaranteed profit, no risk', scam: true },
    { text: 'Part time job from home: earn AED 900 daily just by liking videos, no experience needed', scam: true },
    { text: 'Your driving licence has been renewed. Download the digital copy from the official app', scam: false },
    { text: 'icp-uae.gov-ae.info/update Emirates ID update is mandatory within 48 hours or it will be suspended', scam: true },
    { text: 'Meeting today at 4pm in the office, don’t forget the file', scam: false },
    { text: 'You won 100GB free data! Enter your card details at the link to activate', scam: true },
    { text: 'Did you get home safely?', scam: false },
  ],
};

function makeTraining(engine, registry) {
  function questions(lang = 'ar', n = 8) {
    const bank = BANK[lang] || BANK.ar;
    const pool = bank.map((q, i) => ({ ...q, i })).sort(() => Math.random() - 0.5).slice(0, Math.min(n, bank.length));
    return pool.map((q) => {
      const a = engine.analyze({ type: 'auto', value: q.text }, registry);
      return {
        id: `${lang}-${q.i}`,
        text: q.text,
        answer: q.scam ? 'scam' : 'safe',
        analysis: { score: a.score, level: a.level, reasons: a.reasons, entities: (a.entities || []).map((e) => ({ type: e.type, input: e.input, level: e.level, reasons: e.reasons })) },
      };
    });
  }
  return { questions };
}

module.exports = { makeTraining, BANK };
