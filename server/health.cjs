const http = require('node:http')

const port = Number(process.env.PORT || 3000)
http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end('ok')
    return
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  res.end('Not found')
}).listen(port, '0.0.0.0', () => console.log(`Health listener ready on ${port}`))
