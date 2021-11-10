const puppeteer = require("puppeteer");

const timeoutSec = 10

//console.log("Let's log with timeout sec " + timeoutSec)

const flags = ["-u", "-p", "-s"]

const [username, password, secret] = flags.map(f => {
    const i = process.argv.indexOf(f)
    if (i > 0) return process.argv[i + 1]
    return false
})

if (!(username && secret && password)) {
    //console.log("provide username password secret with flags " + flags)
    process.exit(1)
}

const timer = setTimeout(() => {
    //console.log("Timeout: unable to log in seconds " + timeoutSec)
    process.exit(1)
}, timeoutSec * 1000);

(async () => {
    //console.log("Let's log")
    const browser = await puppeteer.launch({
        pipe: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    //console.log("Opening page")
    const page = await browser.newPage();
    //console.log("Go to auth")
    await page.goto('https://vpn-paris.dzrcorp.net:10443/remote/saml/start');
    //console.log("Waiting form")
    await page.waitForNavigation();
    //console.log("Waiting for #okta-signin-username")
    await page.waitForFunction('document.getElementById("okta-signin-username") === document.activeElement');
    await page.type('#okta-signin-username', username);
    await page.type('#okta-signin-password', password);
    await page.keyboard.press('Enter');
    //console.log("Waiting for Secret question")
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
