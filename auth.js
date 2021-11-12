const puppeteer = require("puppeteer");

const timeoutSec = 10

const debugPrint = process.argv.indexOf("--debug") > 0 ? (...args) => console.log(...args) : () => {}

debugPrint("Let's log with timeout sec " + timeoutSec)

const flags = ["-g", "-u", "-p", "-s"]

const [gateway, username, password, secret] = flags.map(f => {
    const i = process.argv.indexOf(f)
    if (i > 0) return process.argv[i + 1]
    return false
})

if (!(username && secret && password && gateway)) {
    debugPrint("provide gateway username password secret with flags " + flags)
    process.exit(1)
}

const timer = setTimeout(() => {
    debugPrint("Timeout: unable to log in seconds " + timeoutSec)
    process.exit(1)
}, timeoutSec * 1000);

(async () => {
    debugPrint("Let's log")
    const browser = await puppeteer.launch({
        pipe: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    debugPrint("Opening page")
    const page = await browser.newPage();
    debugPrint("Go to auth")
    await page.goto('https://' + gateway + '/remote/saml/start');
    debugPrint("Waiting form")
    await page.waitForNavigation();
    debugPrint("Waiting for #okta-signin-username")
    await page.waitForFunction('document.getElementById("okta-signin-username") === document.activeElement');
    await page.type('#okta-signin-username', username);
    await page.type('#okta-signin-password', password);
    await page.keyboard.press('Enter');
    debugPrint("Waiting for Secret question")
    await page.waitForNavigation();
    await page.type('.password-with-toggle', secret);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000))
    await page.waitForNavigation();

    const cookies = await page.cookies()
    const vpnCookie = cookies.filter(c => c.name == "SVPNCOOKIE").map(c => "SVPNCOOKIE=" + c.value)
    console.log(vpnCookie.length ? vpnCookie[0] : "SVPNCOOKIE FAILURE")

    await browser.close();
    clearTimeout(timer)
})();
