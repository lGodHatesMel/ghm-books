--[[
    SD Computers integration (https://docs.samueldev.shop/resources/computers/custom-apps).

    When Config.Computers.enabled is true and sd-computers is running, a "Books" app is added to its desktop. The app
    is this resource's own NUI page (web/dist/index.html) framed by the desktop, and it reaches the server through
    sd-computers' endpoints, which call the very same handlers the in-game menus use (`Handlers`, server/main.lua).
    An endpoint only ever runs for a player signed in at a computer that has the app.
]]

local C = Config.Computers

-- ── Printing books at an sd-computers printer ───────────────────────────────────────────────────────────────
-- sd-computers' own printers only hand out its printed-page item, and its tray cannot be extended, so books use
-- its printers as places: a print job is queued here (table ghm_book_prints), and the book item is collected
-- standing at the printer. The copy number is claimed and the cost taken when the job is queued.

---@class Computers
Computers = {}

CreateThread(function()
    if not C.enabled then return end
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `ghm_book_prints` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `printer` INT NOT NULL,
            `citizenid` VARCHAR(50) NOT NULL,
            `book_id` INT UNSIGNED NOT NULL,
            `copy` INT UNSIGNED NOT NULL,
            `signed` TINYINT(1) NOT NULL DEFAULT 0,
            `inscription` VARCHAR(255) NOT NULL DEFAULT '',
            `ready_at` INT UNSIGNED NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `owner` (`citizenid`, `printer`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]])
end)

---@param a { x: number, y: number, z: number }
---@param b { x: number, y: number, z: number }
---@return number
local function distance(a, b)
    return math.sqrt((a.x - b.x) ^ 2 + (a.y - b.y) ^ 2 + (a.z - b.z) ^ 2)
end

---@param src number
---@return { x: number, y: number, z: number }|nil
local function coordsOf(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    local c = GetEntityCoords(ped)
    return { x = c.x, y = c.y, z = c.z }
end

---Every sd-computers printer: { id, label, coords }.
---@return table[]
local function allPrinters()
    local ok, list = pcall(function() return exports['sd-computers']:GetPrinters() end)
    return ok and type(list) == 'table' and list or {}
end

---Printers within range of a player, nearest first, with how many of their copies wait at each.
---@param src number
---@return table[] printers { id, label, distance, waiting }
---@return boolean none true when the server has no printers at all
function Computers.nearPrinters(src)
    local all = allPrinters()
    local me = coordsOf(src)
    local out = {}
    if me then
        for _, p in ipairs(all) do
            local d = distance(me, p.coords)
            if d <= C.printerRange then out[#out + 1] = { id = p.id, label = p.label, distance = math.floor(d + 0.5), coords = p.coords } end
        end
    end
    table.sort(out, function(a, b) return a.distance < b.distance end)
    return out, #all == 0
end

---Does the server print to a printer at all? False when there is none, so copies are handed over at once.
---@return boolean
function Computers.usesPrinters()
    return C.enabled and C.printToPrinter and #allPrinters() > 0
end

---Check a printer a player chose: it exists, is in range, and they have room in its tray.
---@param src number
---@param citizenid string
---@param printerId any
---@return table|nil printer, string|nil error
function Computers.checkPrinter(src, citizenid, printerId)
    printerId = math.tointeger(tonumber(printerId))
    if not printerId then return nil, 'Choose a printer' end
    local near = Computers.nearPrinters(src)
    local printer
    for _, p in ipairs(near) do if p.id == printerId then printer = p end end
    if not printer then return nil, 'That printer is not in range of this computer' end
    local waiting = MySQL.scalar.await('SELECT COUNT(*) FROM ghm_book_prints WHERE citizenid = ? AND printer = ?', { citizenid, printerId }) or 0
    if waiting >= C.trayLimit then return nil, 'Your tray at that printer is full. Collect your copies first.' end
    return printer
end

---Queue one copy at a printer.
---@param citizenid string
---@param printer table
---@param bookId integer
---@param copy integer
---@param opts { signed?: boolean, inscription?: string }
---@return integer seconds how long until it is out
function Computers.queue(citizenid, printer, bookId, copy, opts)
    local waiting = MySQL.scalar.await('SELECT COUNT(*) FROM ghm_book_prints WHERE printer = ?', { printer.id }) or 0
    local seconds = math.max(1, math.floor(C.secondsPerCopy * (waiting + 1)))
    MySQL.insert.await(
        'INSERT INTO ghm_book_prints (printer, citizenid, book_id, copy, signed, inscription, ready_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { printer.id, citizenid, bookId, copy, (opts.signed and 1 or 0), opts.inscription or '', os.time() + seconds })
    return seconds
end

---What a player has waiting, per printer, with where each printer stands (the client puts a prompt there).
lib.callback.register('ghm-books:printer:mine', function(src)
    Bridge.waitReady()
    local who = Bridge.fw and Bridge.fw.identity(src)
    if not who or not C.enabled then return {} end
    local rows = MySQL.query.await('SELECT printer, ready_at FROM ghm_book_prints WHERE citizenid = ?', { who.citizenid }) or {}
    if #rows == 0 then return {} end
    local now = os.time()
    local byPrinter = {}
    for _, r in ipairs(rows) do
        local entry = byPrinter[r.printer] or { id = r.printer, waiting = 0, ready = 0 }
        entry.waiting = entry.waiting + 1
        if r.ready_at <= now then entry.ready = entry.ready + 1 end
        byPrinter[r.printer] = entry
    end
    local out = {}
    for _, p in ipairs(allPrinters()) do
        local entry = byPrinter[p.id]
        if entry then
            entry.label, entry.coords = p.label, { x = p.coords.x, y = p.coords.y, z = p.coords.z }
            out[#out + 1] = entry
        end
    end
    return out
end)

local lastCollect = {}

---Take the books that are ready at a printer.
lib.callback.register('ghm-books:printer:collect', function(src, printerId)
    Bridge.waitReady()
    local who = Bridge.fw and Bridge.fw.identity(src)
    if not who then return { ok = false, message = 'No character loaded' } end
    local now = GetGameTimer()
    if lastCollect[src] and now - lastCollect[src] < 1000 then return { ok = false, pending = true } end
    lastCollect[src] = now

    printerId = math.tointeger(tonumber(printerId))
    local printer
    for _, p in ipairs(allPrinters()) do if p.id == printerId then printer = p end end
    local me = coordsOf(src)
    if not printer or not me or distance(me, printer.coords) > C.reach then
        return { ok = false, message = 'Stand at the printer to collect your books' }
    end

    local rows = MySQL.query.await(
        'SELECT j.id, j.book_id, j.copy, j.signed, j.inscription, j.ready_at, b.title, b.description, b.author_name, b.author_citizenid, b.cover, b.page_count, b.print_limit, b.anonymous '
        .. 'FROM ghm_book_prints j LEFT JOIN ghm_books b ON b.id = j.book_id WHERE j.printer = ? AND j.citizenid = ? ORDER BY j.id',
        { printerId, who.citizenid }) or {}
    if #rows == 0 then return { ok = false, message = 'Nothing of yours is waiting here' } end

    local taken, coming = 0, 0
    local nowS = os.time()
    for _, r in ipairs(rows) do
        if r.ready_at > nowS then
            coming = coming + 1
        elseif not r.title then
            -- the book was deleted while its copy waited
            MySQL.update.await('DELETE FROM ghm_book_prints WHERE id = ?', { r.id })
        else
            if not Bridge.inv.canCarry(src, Config.BookItem, 1) then
                return { ok = false, message = taken > 0 and ('Collected %d. You cannot carry any more.'):format(taken) or 'You cannot carry another book' }
            end
            local meta = ItemMetadata({
                id = r.book_id, title = r.title, description = r.description, author_name = r.author_name,
                author_citizenid = r.author_citizenid, cover = r.cover, page_count = r.page_count, print_limit = r.print_limit, anonymous = r.anonymous,
            }, { copy = r.copy, signed = r.signed == 1, inscription = r.inscription })
            if not Bridge.inv.add(src, Config.BookItem, 1, meta) then
                return { ok = false, message = 'Could not collect a book' }
            end
            MySQL.update.await('DELETE FROM ghm_book_prints WHERE id = ?', { r.id })
            taken = taken + 1
        end
    end

    if taken > 0 then
        return { ok = true, message = taken == 1 and 'You collected a book' or ('You collected %d books'):format(taken), remaining = coming }
    end
    if coming > 0 then return { ok = false, pending = true, message = 'Still printing' } end
    return { ok = false, message = 'Nothing of yours is waiting here' }
end)

AddEventHandler('playerDropped', function() lastCollect[source] = nil end)

---Plain text of a book's pages, for printing to a printer.
---@param row table
---@return string
local function bookText(row)
    local pages = json.decode(row.pages) or {}
    local out = {}
    for i, page in ipairs(pages) do
        local lines = {}
        for _, block in ipairs(page.blocks or {}) do
            if block.type == 'text' and block.text and block.text ~= '' then lines[#lines + 1] = block.text end
        end
        if #lines > 0 then
            out[#out + 1] = ('-- Page %d --\n%s'):format(i, table.concat(lines, '\n\n'))
        end
    end
    return table.concat(out, '\n\n')
end

---The endpoint for one handler: runs it for this player and answers with what it returned.
---@param name string
---@return fun(src: number, data: any): any
local function endpoint(name)
    return function(src, data)
        local fn = Handlers[name]
        if not fn then return false, 'Unknown request' end
        return fn(src, data, 'computer')
    end
end

local registered = false

---@param attempt? integer
local function register(attempt)
    if registered or not C.enabled or GetResourceState('sd-computers') ~= 'started' then return end
    attempt = attempt or 1

    local ok, result, reason = pcall(function()
        return exports['sd-computers']:AddCustomApp({
            id = C.appId,
            label = C.label,
            description = 'Write, edit, print and delete your books.',
            developer = 'GHM',
            version = GetResourceMetadata(GetCurrentResourceName(), 'version', 0),
            ui = GetCurrentResourceName() .. '/web/dist/index.html',
            icon = GetCurrentResourceName() .. '/web/dist/icon.svg',
            color = C.color,
            size = { w = 1100, h = 720 },
            groups = C.groups,
            items = C.items,
            computers = C.computers,
            styles = C.styles,
            -- (sd-computers 1.2.0 and later; older versions ignore it)
            mirror = C.mirror ~= false,
            endpoints = {
                ['printers'] = function(src)
                    local near, none = Computers.nearPrinters(src)
                    -- (coordinates stay on the server)
                    local out = {}
                    for i, p in ipairs(near) do out[i] = { id = p.id, label = p.label, distance = p.distance } end
                    return { printers = out, direct = none or not C.printToPrinter }
                end,
                ['limits'] = endpoint('limits'),
                ['save'] = endpoint('save'),
                ['mine:list'] = endpoint('mine:list'),
                ['mine:get'] = endpoint('mine:get'),
                ['mine:print'] = endpoint('mine:print'),
                ['mine:delete'] = endpoint('mine:delete'),
                ['mine:restore'] = endpoint('mine:restore'),
            },
            -- computer.print({ data = { id } }): the book's text as a printed page, handed out by a printer in the room.
            print = function(src, data)
                Bridge.waitReady()
                local who = Bridge.fw and Bridge.fw.identity(src)
                local id = type(data) == 'table' and tonumber(data.id)
                if not who or not id then return nil, 'Nothing to print' end
                local row = MySQL.single.await('SELECT title, author_name, pages FROM ghm_books WHERE id = ? AND author_citizenid = ?', { id, who.citizenid })
                if not row then return nil, 'You can only print your own books' end
                local body = bookText(row)
                if body == '' then return nil, 'This book has no text to print' end
                return { kind = 'book', title = row.title, letterhead = row.author_name, body = body:sub(1, 8000) }
            end,
        })
    end)

    if ok and result ~= false then
        registered = true
        local where = {}
        if type(C.computers) == 'table' and #C.computers > 0 then where[#where + 1] = 'computers: ' .. table.concat(C.computers, ', ') end
        if type(C.styles) == 'table' and #C.styles > 0 then where[#where + 1] = 'styles: ' .. table.concat(C.styles, ', ') end
        print(('^2[ghm-books] SD Computers: "%s" app registered (%s)^7'):format(C.label, #where > 0 and table.concat(where, '; ') or 'on every computer'))
    elseif attempt < 5 then
        -- sd-computers may still be starting up
        SetTimeout(3000, function() register(attempt + 1) end)
    else
        print(('^1[ghm-books] SD Computers: could not register the app: %s^7'):format(tostring(ok and reason or result)))
    end
end

CreateThread(function()
    Bridge.waitReady()
    register()
end)

-- sd-computers keeps its apps in memory, so a restart of it loses ours.
AddEventHandler('onResourceStart', function(resource)
    if resource == 'sd-computers' then
        registered = false
        SetTimeout(1000, register)
    end
end)
