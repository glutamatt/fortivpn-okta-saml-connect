const puppeteer = require("puppeteer");

const timeoutSec = 15

const debugPrint = process.argv.indexOf("--debug") > 0 ? (...args) => console.log(...args) : () => {}

debugPrint("Let's log with timeout sec " + timeoutSec)

const flags = ["-g", "-u", "-p", "-s"]

const [gateway, username, password, secret] = flags.map(f => {
    const i = process.argv.indexOf(f)
    if (i > 0) return process.argv[i + 1]
    return false
})

if (!(username && secret && password && gateway)) {
    console.log("provide gateway username password secret with flags " + flags)
    process.exit(1)
}

const timer = setTimeout(() => {
    debugPrint("Timeout: unable to log in seconds " + timeoutSec)
    process.exit(1)
}, timeoutSec * 1000);

(async () => {
    const browser = await puppeteer.launch({
        pipe: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const pageUrl = 'https://' + gateway + '/remote/saml/start'
    debugPrint("Go to page url", pageUrl)
    await page.goto(pageUrl);
    debugPrint("Waiting for #okta-signin-username")
    await page.waitForSelector('#okta-signin-username');
    await page.type('#okta-signin-username', username);
    await page.type('#okta-signin-password', password);
    await page.keyboard.press('Enter');
    debugPrint("Waiting for Secret question")
    await page.waitForSelector('.password-with-toggle')
    await page.type('.password-with-toggle', secret);
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
