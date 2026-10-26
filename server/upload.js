// Picture uploads that need a real HTTPS client (a binary form upload, or a signed request): Qbox CDN and
// S3-compatible storage such as Cloudflare R2. Lua asks through the exports below and hears the outcome on the
// `ghm-books:server:upload:done` event. Fivemanage needs none of this and is called from server/uploads.lua.
//
// Every .js in a resource shares one V8 scope, so this file keeps its own.
(() => {

const https = require('node:https');
const crypto = require('node:crypto');

// FiveM's JS runtime injects `exports` as the registration function; plain CommonJS binds it to the module's exports.
const registerExport = typeof exports === 'function' ? exports : global.exports;

const QBOX_HOST = 'api.qbox.re';
const QBOX_PATH = '/v1/file';
const MAX_BYTES = 20 * 1024 * 1024;

/** Hands an outcome to the Lua caller waiting on this ticket. */
function announce(ticket, url, err) {
    const send = typeof emit === 'function' ? emit : TriggerEvent;
    send('ghm-books:server:upload:done', ticket, url, err);
}

/** Splits a base64 data URL into its media type and bytes. */
function decode(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl === '') return null;
    const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(dataUrl);
    if (!match) return null;
    try {
        const bytes = Buffer.from(match[2], 'base64');
        return bytes.length > 0 ? { bytes, mime: match[1] || 'application/octet-stream' } : null;
    } catch {
        return null;
    }
}

/** A file name that cannot break out of a header or a path. */
function safeName(name, fallback) {
    const cleaned = String(name ?? '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 100);
    return cleaned === '' ? fallback : cleaned;
}

function request(options, body, done) {
    const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(res.statusCode, Buffer.concat(chunks).toString('utf8')));
    });
    req.setTimeout(25000, () => req.destroy(new Error('timed out')));
    req.on('error', (err) => done(0, String(err?.message ?? err)));
    req.end(body);
}

// ── Qbox CDN ───────────────────────────────────────────────────────────────────────────────────────────────

function uploadQbox(ticket, key, dataUrl, filename) {
    if (typeof key !== 'string' || key === '') return announce(ticket, null, 'No Qbox CDN key is set');
    const file = decode(dataUrl);
    if (!file) return announce(ticket, null, 'Unreadable picture');
    if (file.bytes.length > MAX_BYTES) return announce(ticket, null, 'Picture too large');

    const name = safeName(filename, 'ghm-books-upload');
    const boundary = `ghmbooks${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${file.mime}\r\n\r\n`),
        file.bytes,
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${name}\r\n--${boundary}--\r\n`),
    ]);

    request({
        host: QBOX_HOST, path: QBOX_PATH, method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`, Accept: 'application/json',
            'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length,
        },
    }, body, (status, text) => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { parsed = null; }
        if (status < 200 || status > 299) {
            return announce(ticket, null, `Qbox CDN rejected the upload: HTTP ${status} ${text}`.slice(0, 300));
        }
        const url = parsed?.data?.url;
        announce(ticket, typeof url === 'string' && url !== '' ? url : null, url ? null : 'Qbox CDN returned no link');
    });
}

// ── S3-compatible storage (Cloudflare R2) ──────────────────────────────────────────────────────────────────

const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/**
 * AWS Signature Version 4. `headers` are the ones to sign (lower-case names); returns the Authorization value.
 * @param {{ method: string, path: string, query?: string, headers: Record<string,string>, payloadHash: string,
 *           amzDate: string, region: string, service: string, keyId: string, secret: string }} p
 */
function signV4(p) {
    const names = Object.keys(p.headers).sort();
    const canonicalHeaders = names.map((n) => `${n}:${String(p.headers[n]).trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalRequest = [p.method, p.path, p.query || '', canonicalHeaders, signedHeaders, p.payloadHash].join('\n');
    const day = p.amzDate.slice(0, 8);
    const scope = `${day}/${p.region}/${p.service}/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', p.amzDate, scope, sha256hex(canonicalRequest)].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${p.secret}`, day), p.region), p.service), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');
    return `AWS4-HMAC-SHA256 Credential=${p.keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/**
 * @param {string} ticket
 * @param {{ endpoint: string, bucket: string, region: string, publicUrl: string, keyId: string, secret: string }} cfg
 * @param {string} dataUrl
 * @param {string} filename
 */
function uploadS3(ticket, cfg, dataUrl, filename) {
    if (!cfg || !cfg.endpoint || !cfg.bucket || !cfg.publicUrl || !cfg.keyId || !cfg.secret) {
        return announce(ticket, null, 'R2 storage is not fully set up');
    }
    const file = decode(dataUrl);
    if (!file) return announce(ticket, null, 'Unreadable picture');
    if (file.bytes.length > MAX_BYTES) return announce(ticket, null, 'Picture too large');

    const host = String(cfg.endpoint).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const objectKey = `books/${safeName(filename, `picture-${Date.now()}`)}`;
    const path = `/${encodeURIComponent(cfg.bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
    const payloadHash = sha256hex(file.bytes);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

    const signed = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    const authorization = signV4({
        method: 'PUT', path, headers: signed, payloadHash, amzDate,
        region: cfg.region || 'auto', service: 's3', keyId: cfg.keyId, secret: cfg.secret,
    });

    request({
        host, path, method: 'PUT',
        headers: {
            Host: host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization,
            'Content-Type': file.mime, 'Content-Length': file.bytes.length,
        },
    }, file.bytes, (status, text) => {
        if (status < 200 || status > 299) return announce(ticket, null, `R2 rejected the upload: HTTP ${status} ${text}`.slice(0, 300));
        announce(ticket, `${String(cfg.publicUrl).replace(/\/+$/, '')}/${objectKey}`, null);
    });
}

registerExport('uploadReady', () => {
    try {
        return typeof Buffer === 'function' && typeof https.request === 'function' && typeof crypto.createHmac === 'function';
    } catch {
        return false;
    }
});

registerExport('uploadQbox', (ticket, key, dataUrl, filename) => {
    uploadQbox(String(ticket), key, dataUrl, filename);
    return true;
});

registerExport('uploadS3', (ticket, cfg, dataUrl, filename) => {
    uploadS3(String(ticket), cfg, dataUrl, filename);
    return true;
});

// (for the self-test only)
registerExport('signV4ForTest', (p) => signV4(p));

})();
