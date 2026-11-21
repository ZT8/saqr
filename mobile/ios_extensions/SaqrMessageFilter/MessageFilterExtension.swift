// Saqr — iOS SMS filter extension (IdentityLookup).
// iOS hands messages from UNKNOWN senders to this extension; scam-like ones are moved to the
// "Junk" folder before the user sees them. It runs fully on the device: the message never leaves
// the phone (Apple does not allow the extension to share it with the app or save it).
//
// Add it in Xcode: File > New > Target > "Message Filter Extension", name it SaqrMessageFilter,
// replace the generated MessageFilterExtension.swift with this file, then on the phone enable:
// Settings > Apps > Messages > Unknown & Spam > SMS Filtering > Saqr.

import Foundation
import IdentityLookup

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling, ILMessageFilterCapabilitiesQueryHandling {

    func handle(_ capabilitiesQueryRequest: ILMessageFilterCapabilitiesQueryRequest,
                context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterCapabilitiesQueryResponse) -> Void) {
        completion(ILMessageFilterCapabilitiesQueryResponse())
    }

    func handle(_ queryRequest: ILMessageFilterQueryRequest,
                context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterQueryResponse) -> Void) {
        let response = ILMessageFilterQueryResponse()
        let score = SaqrRules.score(sender: queryRequest.sender ?? "", body: queryRequest.messageBody ?? "")
        response.action = score >= SaqrRules.junkThreshold ? .junk : .none
        completion(response)
    }
}

/// A compact, offline port of Saqr's explainable rules (the same tactic families as the server engine).
enum SaqrRules {
    static let junkThreshold = 55

    struct Tactic { let points: Int; let floor: Int; let words: [String] }

    static let tactics: [Tactic] = [
        // credentials
        Tactic(points: 26, floor: 55, words: ["رمز التحقق", "رمز التفعيل", "الرقم السري", "الرمز السري", "كلمه المرور", "عطني الكود", "ارسل الكود", "الكود اللي وصلك", "الرمز اللي وصلك", "رقم البطاقه", "رقم بطاقتك", "بيانات البطاقه", "otp", "cvv", "pin", "password", "verification code", "card number", "send me the code"]),
        // threat / account suspension
        Tactic(points: 16, floor: 35, words: ["ايقاف", "موقوف", "معلق", "تعليق حسابك", "بينقفل", "سيتم اغلاق", "حجز المركبه", "الاجراءات القانونيه", "انتهت صلاحيه", "نشاط غير معتاد", "suspended", "blocked", "locked", "legal action", "unusual activity", "expired"]),
        // prize
        Tactic(points: 18, floor: 40, words: ["ربحت", "فزت", "جايزه", "الفايز", "السحب", "you won", "winner", "prize", "reward", "claim your"]),
        // payment
        Tactic(points: 10, floor: 0, words: ["ادفع", "رسوم", "سداد", "غرامه", "مخالفه", "الجمارك", "حول لي", "pay now", "fee", "fine", "customs", "transfer"]),
        // personal data
        Tactic(points: 14, floor: 40, words: ["تحديث بياناتك", "حدث بياناتك", "صوره الهويه", "الهويه من الوجهين", "تاكيد هويتك", "update your details", "confirm your identity", "bank details"]),
        // investment / loans
        Tactic(points: 18, floor: 40, words: ["ارباح مضمونه", "ربح مضمون", "دبل فلوسك", "قرض بدون فوايد", "قرض فوري", "العملات الرقميه", "guaranteed profit", "double your money", "instant loan", "crypto"]),
        // urgency
        Tactic(points: 12, floor: 0, words: ["عاجل", "فورا", "خلال 24 ساعه", "خلال ساعه", "اخر فرصه", "urgent", "immediately", "within 24 hours", "last chance"]),
        // call to action
        Tactic(points: 10, floor: 0, words: ["اضغط على الرابط", "اضغط هنا", "ادخل على الرابط", "عبر الرابط", "click here", "tap the link", "verify now", "login to"]),
        // relative on a new number
        Tactic(points: 14, floor: 40, words: ["رقمي الجديد", "تلفوني خربان", "new number", "my phone broke"]),
    ]

    static let authorities = ["adpolice", "dubaipolice", "police", "moi", "icp", "uaepass", "tamm", "rta", "mohre", "customs", "gov"]
    static let brands = ["emiratesnbd", "adcb", "bankfab", "mashreq", "adib", "rakbank", "etisalat", "emiratespost", "aramex", "dhl", "dewa", "salik", "noon", "amazon"]
    static let officialDomains = ["emiratesnbd.com", "adcb.com", "bankfab.com", "mashreq.com", "adib.ae", "rakbank.ae", "etisalat.ae", "eand.com", "emiratespost.ae", "aramex.com", "dhl.com", "salik.ae", "noon.com", "amazon.ae", "amazon.com", "uaepass.ae", "rta.ae"]
    static let riskyTLDs: Set<String> = ["xyz", "top", "icu", "click", "live", "shop", "buzz", "rest", "cfd", "sbs", "monster", "tk", "ml", "ga", "cf", "gq", "work", "support", "online", "site", "vip"]

    /// Same normalisation as the server: diacritics, alef forms, taa marbuta, Arabic-Indic digits.
    static func normalize(_ s: String) -> String {
        var t = s.lowercased()
        let map: [Character: Character] = ["أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
                                           "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"]
        t = String(t.compactMap { ch -> Character? in
            if let s = ch.unicodeScalars.first, (0x064B...0x065F).contains(s.value) || s.value == 0x0640 || s.value == 0x0670 { return nil }
            return map[ch] ?? ch
        })
        return t
    }

    static func score(sender: String, body: String) -> Int {
        let text = normalize(body)
        var points = 0, floor = 0, hits = 0
        for tactic in tactics where tactic.words.contains(where: { text.contains(normalize($0)) }) {
            points += tactic.points
            floor = max(floor, tactic.floor)
            hits += 1
        }
        var score = min(points, 60)
        if hits >= 2 { score = max(score, 55 + 8 * (hits - 2)) }
        score = max(score, floor)
        score = max(score, linkScore(text))
        return min(score, 100)
    }

    /// Links that put an authority or bank name on an unofficial domain, or use risky extensions.
    static func linkScore(_ text: String) -> Int {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return 0 }
        var best = 0
        for m in detector.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let host = m.url?.host?.lowercased() else { continue }
            if host.hasSuffix(".gov.ae") || host.hasSuffix(".abudhabi") || host.hasSuffix(".dubai") { continue }
            if officialDomains.contains(where: { host == $0 || host.hasSuffix("." + $0) }) { continue }
            let tokens = host.split(whereSeparator: { $0 == "." || $0 == "-" }).map(String.init)
            var s = 20
            if authorities.contains(where: { tokens.contains($0) || ($0.count >= 6 && host.contains($0)) }) { s += 45 }
            if brands.contains(where: { tokens.contains($0) || ($0.count >= 5 && host.contains($0)) }) { s += 40 }
            if let tld = tokens.last, riskyTLDs.contains(tld) { s += 18 }
            best = max(best, s)
        }
        return best
    }
}
