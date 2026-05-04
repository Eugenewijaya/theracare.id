import http from 'http';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('./clinic-db.json');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/store') {
        if (req.method === 'GET') {
            if (fs.existsSync(DB_FILE)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(DB_FILE));
            } else {
                res.writeHead(404);
                res.end();
            }
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                fs.writeFileSync(DB_FILE, body);
                res.writeHead(200);
                res.end('OK');
            });
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(4000, () => {
    console.log('Sync Store Server running on port 4000');
});
