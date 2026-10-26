--[[
    Picture hosting. A picture added to a book is sent from the server to a picture host when the book is saved, and
    the book keeps only the link. Config.Upload.provider chooses the host:
      'fivemanage'  Fivemanage Media (server.cfg: set fivemanage_key_media "token")
      'qbox'        Qbox CDN          (server.cfg: set sd_qbox_cdn_key "token")
      'r2'          Cloudflare R2 or any S3-compatible bucket (server.cfg: ghm_books_r2_key_id / ghm_books_r2_secret)
      'database'    no hosting: pictures are stored inside the book
    A host with no token set falls back to 'database' and the console says so. Qbox and R2 go through server/upload.js.
]]

local U = Config.Upload or {}

local FIVEMANAGE_URL = 'https://api.fivemanage.com/api/v3/file/base64'
local TIMEOUT_MS = 30000

---@class Uploads
Uploads = {}

-- Hosts whose links are always accepted, even when Config.ImageHosts is a shorter list, so a book keeps saving after
-- its pictures were hosted. Hosts a successful upload came back from are added as they are seen.
local trusted = { ['fivemanage.com'] = true, ['fmfile.com'] = true }

---@param url any
---@return string|nil host
local function hostOf(url)
    local host = type(url) == 'string' and url:match('^https?://([^/:?#]+)')
    return host and host:lower() or nil
end

local function convar(name, fallback)
    return GetConvar(name, fallback or '') or ''
end

---@return table
local function r2Config()
    local r2 = U.r2 or {}
    local account = tostring(r2.accountId or '')
    local endpoint = r2.endpoint
    if (not endpoint or endpoint == '') and account ~= '' then endpoint = account .. '.r2.cloudflarestorage.com' end
    return {
        endpoint = endpoint or '', bucket = tostring(r2.bucket or ''), region = tostring(r2.region or 'auto'),
        publicUrl = tostring(r2.publicUrl or ''),
        keyId = convar('ghm_books_r2_key_id'), secret = convar('ghm_books_r2_secret'),
    }
end

do
    local host = hostOf(r2Config().publicUrl)
    if host then trusted[host] = true end
end

---Why the chosen provider cannot be used, or nil when it can.
---@return string|nil
local function missing()
    if U.provider == 'fivemanage' then
        if convar('fivemanage_key_media', convar('sd_fivemanage_key')) == '' then return 'no Fivemanage token (set fivemanage_key_media "..." in server.cfg)' end
    elseif U.provider == 'qbox' then
        if convar('sd_qbox_cdn_key') == '' then return 'no Qbox CDN token (set sd_qbox_cdn_key "..." in server.cfg)' end
    elseif U.provider == 'r2' then
        local c = r2Config()
        if c.endpoint == '' or c.bucket == '' or c.publicUrl == '' then return 'R2 is not configured (Config.Upload.r2: accountId, bucket and publicUrl)' end
        if c.keyId == '' or c.secret == '' then return 'no R2 keys (set ghm_books_r2_key_id and ghm_books_r2_secret in server.cfg)' end
    else
        return 'provider is not a hosting provider'
    end
end

---@return boolean
function Uploads.enabled()
    return missing() == nil
end

---Largest picture the editor may send (after it compresses it).
---@return integer
function Uploads.maxImageBytes()
    return (Uploads.enabled() and tonumber(U.maxImageBytes)) or Config.Limits.maxImageBytes
end

---Is this host one that pictures are served from?
---@param host string lower-case
---@return boolean
function Uploads.trustedHost(host)
    while host and host ~= '' do
        if trusted[host] then return true end
        host = host:match('^[^.]+%.(.+)$')
    end
    return false
end

---@type table<string, table> pending Node-helper uploads by ticket
local waiting = {}
local nextTicket = 0

AddEventHandler('ghm-books:server:upload:done', function(ticket, url, err)
    local p = waiting[tostring(ticket)]
    if not p then return end
    waiting[tostring(ticket)] = nil
    p:resolve({ url = url, err = err })
end)

---@param p table a promise
---@return any
local function await(p)
    return Citizen.Await(p)
end

---Wait for the Node helper to answer a ticket.
---@param start fun(ticket: string): boolean
---@return string|nil url, string|nil reason
local function viaHelper(start)
    nextTicket = nextTicket + 1
    local ticket = tostring(nextTicket)
    local p = promise.new()
    waiting[ticket] = p
    local ok = pcall(start, ticket)
    if not ok then
        waiting[ticket] = nil
        return nil, 'the upload helper (server/upload.js) did not load'
    end
    SetTimeout(TIMEOUT_MS, function()
        if waiting[ticket] then
            waiting[ticket] = nil
            p:resolve({ err = 'the host did not answer in time' })
        end
    end)
    local res = await(p)
    return res and res.url or nil, res and res.err or 'no answer'
end

---Fivemanage takes JSON, so the server's own HTTP client is enough.
---@return string|nil url, string|nil reason
local function viaFivemanage(dataUrl, filename)
    local p, done = promise.new(), false
    local function finish(value)
        if done then return end
        done = true
        p:resolve(value)
    end
    PerformHttpRequest(FIVEMANAGE_URL, function(status, body) finish({ status = status, body = body }) end, 'POST',
        json.encode({ base64 = dataUrl, filename = filename }), {
            ['Content-Type'] = 'application/json',
            ['Authorization'] = convar('fivemanage_key_media', convar('sd_fivemanage_key')),
        })
    SetTimeout(TIMEOUT_MS, function() finish(nil) end)

    local res = await(p)
    if not res then return nil, 'Fivemanage did not answer in time' end
    if res.status ~= 200 and res.status ~= 201 then
        return nil, ('Fivemanage rejected the upload: HTTP %s %s'):format(tostring(res.status), tostring(res.body))
    end
    local ok, decoded = pcall(json.decode, res.body or '')
    local url = ok and type(decoded) == 'table' and type(decoded.data) == 'table' and decoded.data.url or nil
    return url, (not url) and 'Fivemanage returned no link' or nil
end

---Send one picture (a data URL) to the chosen host. Yields until it is answered.
---@param dataUrl string
---@param filename string
---@return string|nil url, string|nil reason
function Uploads.store(dataUrl, filename)
    local why = missing()
    if why then return nil, why end

    local url, reason
    if U.provider == 'fivemanage' then
        url, reason = viaFivemanage(dataUrl, filename)
    elseif U.provider == 'qbox' then
        url, reason = viaHelper(function(ticket)
            exports[GetCurrentResourceName()]:uploadQbox(ticket, convar('sd_qbox_cdn_key'), dataUrl, filename)
        end)
    else
        local cfg = r2Config()
        url, reason = viaHelper(function(ticket)
            exports[GetCurrentResourceName()]:uploadS3(ticket, cfg, dataUrl, filename)
        end)
    end

    if type(url) ~= 'string' or not url:match('^https://[^%s"\'<>]+$') or #url > Config.Limits.maxUrlLength then
        return nil, reason or 'the host returned no usable link'
    end
    local host = hostOf(url)
    if host then trusted[host] = true end
    return url
end

CreateThread(function()
    if U.provider == 'database' or U.provider == nil then return end
    local why = missing()
    if why then
        print(('^3[ghm-books] Config.Upload.provider is "%s" but %s. Pictures will be stored in the database instead.^7'):format(tostring(U.provider), why))
    else
        print(('^2[ghm-books] Pictures are uploaded to %s^7'):format(({ fivemanage = 'Fivemanage', qbox = 'the Qbox CDN', r2 = 'R2 storage' })[U.provider]))
    end
end)
