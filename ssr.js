const Cacheman = require('cacheman');
const md5 = require('md5-node');
const puppeteer = require('puppeteer');
const FilecCache = new Cacheman('htmls', {
    // 缓存3个小时
    ttl: 60 * 60 * 3,
    engine: 'file',
});

let browserWSEndpoint = null;

module.exports = async function SSR(renderUrl){

    let browser = null;
    let urlMd5 = md5(renderUrl);
    // 是否命中缓存
    var hitByCache = await FilecCache.get(urlMd5);
    if(hitByCache){
        return hitByCache;
    }
    if(browserWSEndpoint){
        try{
            browser = await puppeteer.connect({browserWSEndpoint});
        }catch(e){
            browserWSEndpoint = null;
            browser = null;
        }
    }

    if(!browserWSEndpoint){
        browser = await puppeteer.launch({ 
            dumpio:true,
            headless: true,
            ignoreHTTPSErrors: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox'
            ]
        });

        browserWSEndpoint = await browser.wsEndpoint();
    }
    const viewConfig = {
        width: 1440,
        height: 300,
    };
    const page = await browser.newPage();
    // 1. 监听网络请求
    await page.setRequestInterception(true);

    page.on('request', req => {
        // 2. 忽略不必要的请求，如图片，视频样式等等
        // console.log(req.resourceType());
        // const whitelist = ['document', 'script', 'xhr', 'fetch'];
        const blackList = ['font','image','stylesheet'];
        if (blackList.includes(req.resourceType())) {
            return req.abort();
        }
        // if (!whitelist.includes(req.resourceType())) {
        //     // return req.abort();
        //     console.log(req.resourceType());
        // }

        // // 3. 其它请求正常继续
        req.continue();
    });
    page.setViewport(viewConfig);
    await page.goto(renderUrl, {waitUntil: 'networkidle2'});
    // await page.waitFor(10000);
    let html = await page.content();
    html= html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    await page.close();
    let results = {
        html
    }
    // 写入缓存
    await FilecCache.set(urlMd5, results);
    return results;
}