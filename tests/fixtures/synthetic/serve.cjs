const http=require('http'),fs=require('fs'),path=require('path');const root=process.argv[2];
const types={'.html':'text/html','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0])==='/'?'index.html':decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});s.end(d);});}).listen(8765,()=>console.log('up'));
