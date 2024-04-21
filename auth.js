const puppeteer = require("puppeteer");
const otplib = require("otplib");

const timeoutSec = 10

const debugPrint = process.argv.indexOf("--debug") > 0 ? (...args) => console.log(...args) : () => { }

debugPrint("Let's log with timeout sec " + timeoutSec)

const flags = ["-g", "-u", "-p", "-k"]

const [gateway, username, password, totpkey] = flags.map(f => {
    const i = process.argv.indexOf(f)
    return (i > 0) ? process.argv[i + 1] : false
})

const exit = (message) => { debugPrint(message); process.exit(1) };

if (process.argv.indexOf("--totp") > 0) { console.log(otplib.authenticator.generate(totpkey)); process.exit() }

if (!(username && totpkey && password && gateway)) exit("provide gateway username password totpkey with flags " + flags)

const hr = "\n-------------------------------\n";

(async () => {
    const browser = await puppeteer.launch({ pipe: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const debugAllContent = () => page.$eval('*', (el) => el.innerText).then(i => `Current page content${hr + i + hr}`)
    const waitThen = async (selector, cb) => {
        await page.screenshot({ path: `/tmp/pupeeter_okta_wait_start.png` });
        const selected = await page.waitForSelector(selector, { visible: true })
        return await cb(selected, selector)
    }
    const timer = setTimeout(() => page.screenshot({ path: `/tmp/pupeeter_okta_timeout.png` }).then(debugAllContent).then(c => `${c}\ntimeout: unable to log after ${timeoutSec} seconds`).then(exit), timeoutSec * 1000);
    const pageUrl = 'https://' + gateway + '/remote/saml/start'

    debugPrint("Go to page url", pageUrl)
    await page.goto(pageUrl);

    const userPass = async () => {
        debugPrint("Waiting for username password inputs")
        await waitThen('input[name="identifier"]', (_, s) => page.type(s, username))
        await waitThen('input[name="credentials.passcode"][type="password"]', (_, s) => page.type(s, password))
        await waitThen('[type="submit"]', s => s.evaluate(b => b.click()))
    }
    const googleAuth = async () => { // 2FA step may be skipped
        debugPrint("Selecting Google Authenticator")
        await waitThen('div[data-se="google_otp"] a', s => s.evaluate(b => b.click()))
        debugPrint("Waiting for Google Authenticator input")
        await waitThen('input[type="text"][name="credentials.passcode"]', (_, s) => page.type(s, otplib.authenticator.generate(totpkey)))
        page.keyboard.press('Enter');
    }

    userPass().catch(() => { })
    googleAuth().catch(() => { })

    debugPrint("Waiting for fortinet redirection")
    await waitThen('div.message-content span.ng-binding', () => { })
    debugPrint("Let's look for SVPNCOOKIE")
    const cookies = await page.cookies()
    const vpnCookie = cookies.filter(c => c.name == "SVPNCOOKIE").map(c => "SVPNCOOKIE=" + c.value)
    console.log(vpnCookie.length ? vpnCookie[0] : "SVPNCOOKIE_COOKIE_NOT_FOUND")
    await browser.close();
    clearTimeout(timer)
})();
