const express = require('express');
const app = express();
const server = require('http').createServer(app);
const config = require('config')
const SSR = require('./ssr.js');
const title = config.get('title')
app.use((req, res, next)=>{
    // 生成本地访问链接
    const requestUrl = config.get('server.targetUrl') + req.url;
    (async () => {
    try{
        const results = await SSR(requestUrl);
        res.send(results.html);
    }catch(e){
        console.log('ssr failed', e);
        res.status(500).send('Server error');
    }
    })();
});
const port = config.get('server.port') || 8080;
server.listen(port,() => {
    console.log('========== Support SEO Server (v1.0) started on port ' + port + ' ==========')
    console.log('========== ' + title + ' ==========')
    console.log('Listen Domain: ' + config.get('server.targetUrl'))
    console.log('Cache File Dir: ' + config.get('server.cacheDir'))
    console.log('Cache time: ' + (config.get('server.ttl')/3600) + ' h')
    console.log('NODE_ENV: ' + process.env.NODE_ENV)
});