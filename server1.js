const http = require('http');
const puppeteer = require('puppeteer');

let conf = {
   // 是否使用https访问API
   useHttps: true,
   // 是否检测IP，防止伪造UA
   checkIp: false,
   // 可以访问的蜘蛛IP地址
   allowIpList: [],

   launchOption: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
   }
};

/**
 * 获取IP地址
 *
 * @param req
 * @returns {*|string}
 */
function getIp (req) {
   return req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress || '';
}

/**
 * 检测ip是否合法
 *
 * @param ip
 * @returns {boolean}
 */
function checkIP(ip) {
   //也可以使用别的规则校验
   return conf.checkIp ? conf.allowIpList.includes(ip) : true;
}


// 载入浏览器
puppeteer.launch(conf.launchOption).then(async browser => {
    const server = http.createServer();
    server.on('request', function(request, response){
        let url = 'https://support.oppo.com'+ request.url;
        let ip = getIp(request);
console.log('url==>',url);
        // 检测ip地址
        if (checkIP(ip)) {
         browser.newPage().then(async page => {

            // 访问url
            await page.goto(url);
            let content= await page.content();

            // 关闭页面，返回数据
            await page.close();
            response.end(content);
         })
      } else {
         response.statusCode = 404;
         response.end("404 NOT Found");
      }
    })

    server.on('close', function(){
        browser.close();
    })

    server.listen(3000, '127.0.0.1', function () {
        console.log('puppeteer server listening on port 3000!');
    });
});