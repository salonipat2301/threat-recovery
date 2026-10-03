from pathlib import Path
import textwrap

OUT = Path(__file__).resolve().parents[1] / "docs" / "threat-recovery-presentation.pdf"
W, H = 960, 540
NAVY = (0.043, 0.078, 0.125)
PANEL = (0.067, 0.122, 0.180)
EDGE = (0.16, 0.24, 0.32)
WHITE = (0.91, 0.95, 0.98)
MUTED = (0.67, 0.75, 0.82)
TEAL = (0.33, 0.84, 0.75)
AMBER = (1.0, 0.72, 0.48)


def color(c):
    return " ".join(f"{v:.3f}" for v in c)


def esc(s):
    s = s.encode("ascii", "replace").decode("ascii")
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class Canvas:
    def __init__(self):
        self.ops = []

    def rect(self, x, y, w, h, fill, stroke=None, radius=0):
        self.ops.append("q")
        if fill:
            self.ops.append(f"{color(fill)} rg")
        if stroke:
            self.ops.append(f"{color(stroke)} RG 1 w")
        if radius:
            # Rounded-looking cards use a clean square-corner PDF path for portability.
            pass
        self.ops.append(f"{x} {y} {w} {h} re " + ("B" if fill and stroke else "f" if fill else "S"))
        self.ops.append("Q")

    def line(self, x1, y1, x2, y2, stroke):
        self.ops.extend(["q", f"{color(stroke)} RG 1 w", f"{x1} {y1} m {x2} {y2} l S", "Q"])

    def text(self, x, y, value, size=12, fill=WHITE, bold=False):
        font = "F2" if bold else "F1"
        self.ops.extend(["BT", f"{color(fill)} rg", f"/{font} {size} Tf", f"1 0 0 1 {x} {y} Tm", f"({esc(value)}) Tj", "ET"])

    def para(self, x, y, value, width, size=11, leading=15, fill=MUTED, bold=False):
        max_chars = max(18, int(width / (size * 0.52)))
        lines = []
        for paragraph in value.split("\n"):
            lines.extend(textwrap.wrap(paragraph, max_chars) or [""])
        for line in lines:
            self.text(x, y, line, size, fill, bold)
            y -= leading
        return y

    def card(self, x, y, w, h, eyebrow, title, body, title_size=15):
        self.rect(x, y, w, h, PANEL, EDGE)
        self.text(x + 16, y + h - 23, eyebrow.upper(), 8, TEAL, True)
        self.text(x + 16, y + h - 48, title, title_size, WHITE, True)
        self.para(x + 16, y + h - 68, body, w - 32, 10, 13, MUTED)

    def bytes(self):
        return ("\n".join(self.ops)).encode("latin-1", "replace")


def base_page(number, label, timing):
    c = Canvas()
    c.rect(0, 0, W, H, NAVY)
    c.rect(0, H - 5, W, 5, TEAL)
    c.text(44, 510, "T  THREAT RECOVERY", 10, WHITE, True)
    c.text(690, 510, label.upper(), 8, MUTED, True)
    c.line(44, 493, 916, 493, EDGE)
    c.line(44, 36, 916, 36, EDGE)
    c.text(44, 19, "7-minute presentation + 3-minute Q&A", 8, MUTED)
    c.text(844, 19, f"{number:02d} / 08   {timing}", 8, MUTED, True)
    return c


def heading(c, kicker, title, subtitle=None):
    c.text(48, 459, kicker.upper(), 9, TEAL, True)
    c.text(48, 421, title, 27, WHITE, True)
    if subtitle:
        c.para(50, 397, subtitle, 830, 12, 16, MUTED)


def notes(c, time, narration):
    c.rect(44, 47, 872, 94, (0.055, 0.105, 0.155), EDGE)
    c.text(58, 122, f"SPEAKER NOTES  |  {time}", 8, TEAL, True)
    c.para(58, 103, narration, 838, 9, 12, MUTED)


pages = []

# 1 - Track, problem, solution.
c = base_page(1, "Presentation opening", "0:00-0:45")
c.text(48, 448, "CYBER DEFENSE  /  PROJECT PRESENTATION", 9, TEAL, True)
c.text(48, 397, "When someone continues,", 32, WHITE, True)
c.text(48, 357, "the security story should not disappear.", 29, WHITE, True)
c.para(50, 325, "Threat Recovery assesses risky pages, warns before exposure, and keeps a local incident record if a user continues through its warning.", 800, 14, 19, MUTED)
c.card(48, 174, 270, 104, "Track / category", "Cybersecurity - Cyber Defense", "Browser protection and post-warning recovery.")
c.card(345, 174, 270, 104, "Problem", "Warnings disappear", "After continuing, people can lose the risk context and the next steps.")
c.card(642, 174, 270, 104, "Solution", "Assess -> warn -> recover", "Turn a one-time interruption into an actionable local record.")
notes(c, "0:00-0:45", "Our track is Cyber Defense. We worked on what happens after someone sees a risky-site warning and continues anyway. The warning can disappear, leaving the person unsure what was detected or what to do next. Threat Recovery adds an assessment and a recovery record: it explains the risk before continuing, then preserves context and suggested actions if the user proceeds through our warning.")
pages.append(c)

# 2 - Problem.
c = base_page(2, "The user problem", "0:45-1:25")
heading(c, "The gap", "Detection is only the first moment.", "A person who continues may still need to understand what was exposed and what to do next.")
c.card(48, 225, 400, 112, "Before", "This page may be risky.", "A warning interrupts, but may not explain how to recover later.")
c.card(512, 225, 400, 112, "After", "What happened, and what now?", "The decision and its context can vanish when the warning closes.")
c.rect(48, 169, 864, 36, (0.055, 0.15, 0.18), EDGE)
c.text(62, 183, "DESIGN GOAL  Preserve useful evidence locally; never collect what the person types.", 10, TEAL, True)
notes(c, "0:45-1:25", "We focused on the gap after detection. A person may continue because they need the site or do not understand the warning. Once they do, they can lose the reason for the warning and any chance to review it. We are not claiming to prevent every unsafe action. We want to make risk understandable and keep a useful follow-up record when someone chooses to continue through our warning.")
pages.append(c)

# 3 - Approach.
c = base_page(3, "Approach and solution", "1:25-2:25")
heading(c, "One connected flow", "Signals become a choice, then a recovery plan.")
steps = [(48, "01 OBSERVE", "URL, field types,\npermission states"), (224, "02 ASSESS", "Local heuristics +\noptional Safe Browsing"), (400, "03 WARN", "Explain reasons;\noffer a choice"), (576, "04 RECORD", "Continue -> local\nunresolved incident"), (752, "05 RECOVER", "Review exposure\nand suggested actions")]
for x, title, body in steps:
    c.rect(x, 278, 160, 76, PANEL, EDGE)
    c.text(x + 10, 334, title, 9, TEAL, True)
    c.para(x + 10, 313, body.replace("\n", " "), 140, 9, 12, WHITE)
c.card(48, 166, 410, 84, "Privacy", "Signal types, not values", "Detects password, username, OTP, payment and file-upload fields; does not read their contents.")
c.card(502, 166, 410, 84, "Threat intelligence", "Optional URL lookup", "Google Safe Browsing can add known-threat matches when configured.")
notes(c, "1:25-2:25", "The extension collects page signal types, not field values. It combines local heuristics with an optional Google Safe Browsing lookup. When the assessment should warn, it uses an in-page warning when content-script access is available, and an extension-owned warning page when it is not. Leaving ends the flow without an incident. Continuing through our warning saves a local incident, which the dashboard turns into a review and action checklist.")
pages.append(c)

# 4 - Current code evidence.
c = base_page(4, "What the code does", "2:25-3:20")
heading(c, "Current source behavior", "Storage and heuristics are present in the current commit.")
c.card(48, 233, 270, 105, "Local heuristic", "+45 threat-term host", "A hostname containing terms such as malware or phishing receives a risk signal.")
c.card(345, 233, 270, 105, "Threat lookup", "+70 Safe Browsing match", "A configured match adds weight and triggers a warning.")
c.card(642, 233, 270, 105, "Persistent storage", "Chrome local storage", "Incidents and pending warning state are stored; incident writes are serialized.")
c.rect(48, 170, 864, 42, (0.11, 0.10, 0.08), (0.40, 0.30, 0.19))
c.text(62, 193, "EXAMPLE  HTTPS malware.wicar.org -> 45 / medium from keyword heuristic; warning-eligible.", 10, AMBER, True)
c.text(62, 178, "A Safe Browsing match adds 70 more. HTTP also adds transport risk.", 9, MUTED)
notes(c, "2:25-3:20", "Here is what current source says. Local rules add 45 points when a hostname contains a term like malware. On HTTPS malware.wicar.org, that local signal alone is 45, or medium, and the elevated-risk rule makes it warning-eligible. A Safe Browsing match adds 70 points and forces a warning. Incidents and pending warning details use Chrome local extension storage. Incident writes are serialized. This is code evidence; it does not prove the installed browser bundle is current until we run it there.")
pages.append(c)

# 5 - Demo warning.
c = base_page(5, "Product demo - warning", "3:20-4:35")
heading(c, "Live product demo · part 1", "Show the warning and the user's choice.", "Use the bundled local page with inert username and password fields; it does not submit or save entries.")
c.rect(48, 220, 864, 128, PANEL, EDGE)
c.text(65, 328, "LOCAL DEMO  |  127.0.0.1:4173  |  SAFE TEST FORM", 8, MUTED, True)
c.line(64, 313, 895, 313, EDGE)
c.rect(68, 253, 39, 39, (0.30, 0.15, 0.10), (0.56, 0.31, 0.18))
c.text(82, 265, "!", 19, AMBER, True)
c.text(125, 284, "Pause before continuing", 17, WHITE, True)
c.para(125, 264, "Risk indicators found on this page. Review the reasons before proceeding.", 600, 10, 13, MUTED)
c.rect(125, 230, 125, 22, PANEL, EDGE)
c.text(141, 238, "Leave this site", 9, WHITE, True)
c.rect(262, 230, 152, 22, (0.43, 0.20, 0.12), (0.62, 0.30, 0.18))
c.text(276, 238, "Continue anyway", 9, WHITE, True)
c.card(48, 158, 414, 45, "Demo setup", "Start extension + local demo", "Run npm run demo and open the local demo page.", 12)
c.card(498, 158, 414, 45, "Narrate", "No real credentials", "Point out the detected types and the leave / continue choice.", 12)
notes(c, "3:20-4:35", "I am using the local demo page rather than a live malware sample. It is bundled with the project and the form is inert: it will not send or save anything. The extension sees a username and password field and warns because the page is plain HTTP and contains sensitive field types. Notice the options: leave, or continue anyway. I will choose continue to demonstrate what happens next. Action: click Continue anyway.")
pages.append(c)

# 6 - Incident dashboard.
c = base_page(6, "Product demo - recovery", "4:35-5:50")
heading(c, "Live product demo · part 2", "Continue creates a record you can act on.")
for x, title, body in [(48, "DECISION", "Continue anyway"), (267, "INCIDENT", "Unresolved + risk evidence"), (486, "DASHBOARD", "Reasons + exposure"), (705, "NEXT STEPS", "Checklist + resolve")]:
    c.rect(x, 286, 195, 70, PANEL, EDGE)
    c.text(x + 12, 333, title, 8, TEAL, True)
    c.para(x + 12, 312, body, 168, 11, 14, WHITE, True)
c.card(48, 168, 410, 88, "On screen", "Open dashboard -> Unresolved", "Show the new incident, reason, potential exposure, recommended action and resolve control.")
c.card(502, 168, 410, 88, "If the demo fails", "Report it honestly", "Check the service-worker console for SECURITY_INCIDENT; do not claim the save succeeded.")
notes(c, "4:35-5:50", "Now I will open the dashboard. The incident should show the domain, time, severity, reasons, possible exposure and suggested actions. I can review the checklist and mark it resolved. The record is local to this browser profile. This happens when someone continues through Threat Recovery's warning; it does not detect a bypass of Chrome's separate interstitial. If the record does not appear, I will show the background console and say which step failed rather than imply success.")
pages.append(c)

# 7 - Limits and takeaway.
c = base_page(7, "Takeaway and limits", "5:50-7:00")
heading(c, "A practical boundary", "Support recovery without claiming certainty.")
c.card(48, 232, 270, 103, "Local by default", "History + incidents", "Stored in extension storage. Email is off unless the user configures a relay.")
c.card(345, 232, 270, 103, "Data boundary", "No form values", "Optional Safe Browsing lookup sends the page URL to Google.")
c.card(642, 232, 270, 103, "Known limits", "Not a file scanner", "Heuristics are indicators, not proof; Chrome warning bypass is not observed.")
c.rect(48, 167, 864, 43, (0.055, 0.15, 0.18), EDGE)
c.text(68, 183, "ASSESS  ->  WARN  ->  RECORD  ->  RECOVER", 16, TEAL, True)
notes(c, "5:50-7:00", "Threat Recovery is a support layer, not a guarantee that every threat will be detected. Local heuristics can be wrong. Safe Browsing is optional and receives the URL when enabled. We do not scan downloaded files or observe bypasses of Chrome's own warning. History and incidents stay in local extension storage by default. Optional email needs a user-configured relay and is off by default. Our outcome is simple: assess, warn, record the choice, and give the person something useful to do next. Thank you.")
pages.append(c)

# 8 - Q&A.
c = base_page(8, "Q&A", "7:00-10:00")
heading(c, "Three-minute Q&A", "Answers to likely questions.")
qa = [
    (48, 324, "Is storage persistent?", "Current source uses chrome.storage.local for incidents and pending warnings. Confirm the installed build in a fresh browser run."),
    (492, 324, "Why did WICAR show low / 25?", "That does not match current source. The old screenshot alone cannot tell whether Chrome had an old bundle or stale assessment."),
    (48, 233, "Does every warning create an incident?", "No. Only Continue anyway on Threat Recovery's warning saves an incident. Leave does not."),
    (492, 233, "Does Safe Browsing always warn on a match?", "Yes. Current assessment adds 70 and sets shouldWarn when there is a match."),
    (48, 142, "Are form values collected?", "No. It detects field types, not what a person enters. Safe Browsing receives the URL when enabled."),
    (492, 142, "What is not covered?", "Downloaded-file scanning, Chrome interstitial bypass detection, and a built-in email relay."),
]
for x, y, q, a in qa:
    c.rect(x, y, 420, 76, PANEL, EDGE)
    c.text(x + 12, y + 55, q, 10, WHITE, True)
    c.para(x + 12, y + 37, a, 394, 8, 10, MUTED)
notes(c, "7:00-10:00", "Use these answers as guardrails. If asked whether the live demo was tested, distinguish code inspection from a fresh browser run. A hostname heuristic is a risk indicator, not proof that a site is malicious. If the demo has a problem, describe the failed step accurately.")
pages.append(c)


def make_pdf(canvases):
    objects = []
    def add(obj):
        objects.append(obj if isinstance(obj, bytes) else obj.encode("latin-1"))
        return len(objects)

    catalog_id = add(b"")
    pages_id = add(b"")
    font_regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    font_bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    page_ids = []
    for canvas in canvases:
        data = canvas.bytes()
        stream = b"<< /Length " + str(len(data)).encode() + b" >>\nstream\n" + data + b"\nendstream"
        stream_id = add(stream)
        page_id = add(f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R >> >> /Contents {stream_id} 0 R >>")
        page_ids.append(page_id)
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode())
        out.extend(obj)
        out.extend(b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode())
    out.extend(f"trailer\n<< /Size {len(objects)+1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(out)


OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(make_pdf(pages))
print(f"Wrote {OUT} ({len(pages)} pages)")
