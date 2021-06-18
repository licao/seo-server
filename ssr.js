const Cacheman = require('cacheman');
const md5 = require('md5-node');
const puppeteer = require('puppeteer');
const config = require('config')
const tmpDir = config.get('server.cacheDir') || './tmp'
const ttl = config.get('server.ttl') || 60 * 60 * 3;
const FilecCache = new Cacheman('htmls', {
    // 缓存3个小时
    ttl: ttl,
    engine: 'file',
    tmpDir: tmpDir
});
const MAX_WSE = config.get('browser.size');  //启动几个浏览器
let WSE_LIST = []; //存储browserWSEndpoint列表
init();
function init(){
    (async () => {
        for(var i=0;i<MAX_WSE;i++){
            const browser = await puppeteer.launch({
                dumpio:true,
                headless: true,
                ignoreHTTPSErrors: true,
                args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
            ]});
            browserWSEndpoint = await browser.wsEndpoint();
            WSE_LIST[i] = browserWSEndpoint;
        }
        console.log(WSE_LIST);
    })();
}

module.exports = async function SSR(renderUrl){

    let browser = null;
    let urlMd5 = md5(renderUrl);
    // 是否命中缓存
    var hitByCache = await FilecCache.get(urlMd5);
    if(hitByCache){
        return hitByCache;
    }
    let tmp = Math.floor(Math.random()* MAX_WSE);
    let browserWSEndpoint = WSE_LIST[tmp];
    // console.log('WSE SIT', tmp)
    if(browserWSEndpoint){
        try{
            browser = await puppeteer.connect({browserWSEndpoint});
        }catch(e){
            browserWSEndpoint = null;
            browser = null;
        }
    }

    if(!browserWSEndpoint){
        console.log('error no browser');
        browser = await puppeteer.launch({ 
            dumpio:true,
            headless: true,
            ignoreHTTPSErrors: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
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
    await page.waitFor(5000);
    let html = await page.content();
    //去除script标签 style标签
    html= html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '').replace(/<div id="oc-wrapper" style/g,'<div id="oc-wrapper" reStyle').replace(/<div class="cp-site-language-tip"/g,'<div class="cp-site-language-tip" style="display:none;').replace(/<div class="cp-cookie-tip"/g,'<div class="cp-cookie-tip" style="display:none;');
    await page.close();
    let results = {
        html
    }
    // 写入缓存
    await FilecCache.set(urlMd5, results);
    return results;
}