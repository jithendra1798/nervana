from playwright.sync_api import sync_playwright
import requests, sys
API, WEB = "http://localhost:8000", "http://localhost:5173"
SHOTS = "/private/tmp/claude-501/-Users-jithendra-Projects-nervana/a47ba30c-5e02-4e9c-b91d-62d7a1ca2f48/scratchpad/shots"
ok, fail = [], []
def check(name, cond, detail=""):
    (ok if cond else fail).append(f"{name} {detail}".strip())

requests.post(f"{API}/v1/demo/reset", timeout=10)
requests.put(f"{API}/v1/patients/SYN-0142/profile", timeout=10, json={
  "triggers":["Fireworks","Sirens"],"helps":["Noise-cancelling headphones","Calling someone"],
  "home":{"air_conditioning":True,"quiet_room":True},"support_person":"my sister Dana",
  "safe_places":["the library on Jackson Ave"],"share_with_care_team":True})

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1340,"height":1150}, color_scheme="dark")
    errs=[]; ctx.on("weberror", lambda e: errs.append(str(e)[:150]))
    care = ctx.new_page(); phone = ctx.new_page(); phone.set_viewport_size({"width":460,"height":1200})

    # 1-2 map
    care.goto(f"{WEB}/map", wait_until="networkidle"); care.wait_for_timeout(2000)
    check("map draws zips", care.locator("path.leaflet-interactive").count() > 100, f"({care.locator('path.leaflet-interactive').count()} shapes)")
    check("fullscreen button", care.locator(".map-full-btn").count() == 1)

    # 3-4 inbox and team filter
    care.goto(f"{WEB}/", wait_until="networkidle"); care.wait_for_timeout(1800)
    tiles = care.locator(".tile-value").first.inner_text()
    check("inbox act count", tiles.strip() == "23", f"(shows {tiles.strip()})")
    care.select_option("select >> nth=1", label="LIC ACT Team 2 (1)")
    care.wait_for_timeout(700)
    check("team filter", care.locator("tbody tr").count() == 1, f"({care.locator('tbody tr').count()} rows)")

    # 5-7 detail, vitals, outreach
    care.locator("tbody tr").first.click(); care.wait_for_timeout(2500)
    check("why flagged", care.locator("text=noise complaints in ZIP 11101").count() > 0)
    check("confidence caveats", care.locator("text=over a year ago").count() > 0)
    check("vitals card", care.locator("h2:has-text('Vitals and conditions')").count() == 1)
    check("client answers used", care.locator("text=They tell us noise-cancelling headphones").count() > 0)
    care.get_by_role("button", name="Log outreach").click(); care.wait_for_timeout(1200)
    check("outreach logged", care.locator("text=Outreach logged").count() > 0)
    care.screenshot(path=f"{SHOTS}/r-detail.png")

    # 8-9 client asks for help
    phone.goto(f"{WEB}/me/SYN-0142", wait_until="networkidle"); phone.wait_for_timeout(1500)
    check("plan grouped", phone.locator("h3:has-text('Yours')").count() == 1)
    phone.get_by_role("button", name="I need help").click(); phone.wait_for_timeout(600)
    check("crisis row", phone.locator(".crisis-row a").count() == 3)
    phone.fill("textarea", "The bangs started early tonight and I cannot settle.")
    phone.get_by_text("Share this and today's conditions").click()
    phone.get_by_role("button", name="Send", exact=True).click()
    phone.wait_for_selector("text=Sent to LIC ACT Team 2", timeout=20000)
    check("request sent", True)

    # 10-11 clinician reads bundle and replies
    care.goto(f"{WEB}/help-requests", wait_until="networkidle"); care.wait_for_timeout(2500)
    check("bundle vitals", care.locator("h2:has-text('Vitals and conditions')").count() == 1)
    check("correlation stated", care.locator("text=Heart rate tracks").count() > 0)
    care.get_by_role("button", name="Start from a suggestion").click()
    care.get_by_role("button", name="Send to client").click()
    care.wait_for_selector("text=Saved to the client's plan", timeout=20000)
    check("reply saved", True)
    care.screenshot(path=f"{SHOTS}/r-help.png")

    # 12 client sees it
    phone.reload(wait_until="networkidle"); phone.wait_for_timeout(2000)
    check("client sees reply", phone.locator("h3:has-text('From your team')").count() == 1)
    phone.screenshot(path=f"{SHOTS}/r-client.png", full_page=True)

    # 13 EHR
    care.goto(f"{WEB}/integration", wait_until="networkidle"); care.wait_for_timeout(2000)
    check("cds card", care.locator("text=CDS Hooks card").count() == 1)
    check("audit trail", care.locator("text=escalation answered").count() > 0)
    care.screenshot(path=f"{SHOTS}/r-ehr.png")

    # 14 report
    care.goto(f"{WEB}/patients/SYN-0142/report", wait_until="networkidle"); care.wait_for_timeout(2200)
    check("report sections", care.locator(".report h2").count() >= 7, f"({care.locator('.report h2').count()} sections)")
    check("report history", care.locator("text=alert action").count() > 0)
    care.screenshot(path=f"{SHOTS}/r-report.png", full_page=True)
    b.close()

print("PASS:", len(ok)); [print("   +", x) for x in ok]
if fail:
    print("FAIL:", len(fail)); [print("   -", x) for x in fail]
print("page errors:", errs or "none")
sys.exit(1 if fail else 0)
