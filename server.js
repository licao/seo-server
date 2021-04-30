var express = require('express');
var app = express();
var server = require('http').createServer(app);
var history = require('connect-history-api-fallback');
var SSR = require('./ssr.js');
var listenPort = 8088;

const staticFileMiddleware = express.static('dist');

app.use(function(req, res, next){
    // 生成本地访问链接
    var requestUrl = 'https://support.oppo.com'+ req.url;
    (async () => {
    try{
        var results = await SSR(requestUrl);
        res.send(results.html);
    }catch(e){
        console.log('ssr failed', e);
        res.status(500).send('Server error');
    }
    })();
    next();
});


// 先
app.use(staticFileMiddleware);

// 如果资源没命中会继续、经过history rewirte后
app.use(history({
  disableDotRule: true,
  verbose: true
}));

// 再次处理
app.use(staticFileMiddleware);
server.listen(listenPort);