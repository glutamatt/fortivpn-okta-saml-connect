const puppeteer = require("puppeteer");
const otplib = require("otplib");

const timeoutSec = 15

const debugPrint = process.argv.indexOf("--debug") > 0 ? (...args) => console.log(...args) : () => { }

debugPrint("Let's log with timeout sec " + timeoutSec)

const flags = ["-g", "-u", "-p", "-k"]

const [gateway, username, password, totpkey] = flags.map(f => {
    const i = process.argv.indexOf(f)
    return (i > 0) ? process.argv[i + 1] : false
})

const exit = (message) => { debugPrint(message); process.exit(1) };

if (!(username && totpkey && password && gateway)) exit("provide gateway username password totpkey with flags " + flags)

const hr = "\n-------------------------------\n";

(async () => {
    const browser = await puppeteer.launch({ pipe: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const debugAllContent = () => page.$eval('*', (el) => el.innerText).then(i => `Current page content${hr + i + hr}`)
    const waitThen = async (selector, cb) => {
        const selected = await page.waitForSelector(selector)
        return await cb(selected, selector)
    }
    const timer = setTimeout(() => debugAllContent().then(c => `${c}\ntimeout: unable to log after ${timeoutSec} seconds`).then(exit), timeoutSec * 1000);
    const pageUrl = 'https://' + gateway + '/remote/saml/start'
    debugPrint("Go to page url", pageUrl)
    await page.goto(pageUrl);
    debugPrint("Waiting for username password inputs")
    await waitThen('#okta-signin-username', (_, s) => page.type(s, username))
    await waitThen('#okta-signin-password', (_, s) => page.type(s, password))
    await waitThen('#okta-signin-password', s => s.press('Enter'))
    debugPrint("Selecting Google Authenticator")
    await waitThen('.factors-dropdown-wrap', s => s.evaluate(b => b.click()))
    await waitThen('.mfa-google-auth-30', s => s.evaluate(b => b.click()))
    debugPrint("Waiting for Google Authenticator input")
    await waitThen('.o-form-input-name-answer input[type="tel"][name="answer"]', (_, s) => page.type(s, otplib.authenticator.generate(totpkey)))
    await page.keyboard.press('Enter');
    debugPrint("Waiting for fortinet redirection")
    await page.waitForSelector('.fortinet-grid-icon')
    debugPrint("Let's look for SVPNCOOKIE")
    const cookies = await page.cookies()
    const vpnCookie = cookies.filter(c => c.name == "SVPNCOOKIE").map(c => "SVPNCOOKIE=" + c.value)
    console.log(vpnCookie.length ? vpnCookie[0] : "SVPNCOOKIE_COOKIE_NOT_FOUND")

    await browser.close();
    clearTimeout(timer)
})();
