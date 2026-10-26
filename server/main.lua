local L = Config.Limits

local COVERS, PAPERS = {}, {}
for _, c in ipairs(Config.Covers) do COVERS[c] = true end
for _, p in ipairs(Config.Papers) do PAPERS[p] = true end

local PAGE_FONTS = {}
for _, f in ipairs(Config.PageFonts) do PAGE_FONTS[f] = true end
local FONTS = { serif = true, display = true, sans = true, mono = true, hand = true, old = true }
local TEXTURES = { plain = true, cloth = true, leather = true, linen = true }
local FRAMES = { none = true, line = true, double = true, corners = true }

local STYLES = { body = true, heading = true, quote = true }
local ALIGNS = { left = true, center = true, right = true }

CreateThread(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `ghm_books` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `title` VARCHAR(80) NOT NULL,
            `description` VARCHAR(200) NOT NULL DEFAULT '',
            `author_name` VARCHAR(80) NOT NULL,
            `author_citizenid` VARCHAR(50) NOT NULL,
            `cover` VARCHAR(24) NOT NULL DEFAULT 'oxblood',
            `page_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `image_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `pages` LONGTEXT NOT NULL,
            `paper` VARCHAR(16) NOT NULL DEFAULT 'blank',
            `font` VARCHAR(12) NOT NULL DEFAULT 'serif',
            `dedication` VARCHAR(255) NOT NULL DEFAULT '',
            `print_limit` INT UNSIGNED NOT NULL DEFAULT 0,
            `copies` INT UNSIGNED NOT NULL DEFAULT 0,
            `shared` TINYINT(1) NOT NULL DEFAULT 0,
            `published` TINYINT(1) NOT NULL DEFAULT 0,
            `anonymous` TINYINT(1) NOT NULL DEFAULT 0,
            `revision` INT UNSIGNED NOT NULL DEFAULT 1,
            `last_editor` VARCHAR(80) NOT NULL DEFAULT '',
            `backup_pages` LONGTEXT NULL,
            `cover_design` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `author_citizenid` (`author_citizenid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]])

    -- Upgrade tables created before paper types and custom covers existed.
    local function addColumn(name, definition)
        local exists = MySQL.scalar.await(
            'SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
            { 'ghm_books', name })
        if (exists or 0) == 0 then MySQL.query.await(('ALTER TABLE ghm_books ADD COLUMN `%s` %s'):format(name, definition)) end
    end
    addColumn('paper', "VARCHAR(16) NOT NULL DEFAULT 'blank'")
    addColumn('font', "VARCHAR(12) NOT NULL DEFAULT 'serif'")
    addColumn('dedication', "VARCHAR(255) NOT NULL DEFAULT ''")
    addColumn('print_limit', 'INT UNSIGNED NOT NULL DEFAULT 0')
    addColumn('copies', 'INT UNSIGNED NOT NULL DEFAULT 0')
    addColumn('shared', 'TINYINT(1) NOT NULL DEFAULT 0')
    addColumn('published', 'TINYINT(1) NOT NULL DEFAULT 0')
    addColumn('anonymous', 'TINYINT(1) NOT NULL DEFAULT 0')
    addColumn('revision', 'INT UNSIGNED NOT NULL DEFAULT 1')
    addColumn('last_editor', "VARCHAR(80) NOT NULL DEFAULT ''")
    addColumn('backup_pages', 'LONGTEXT NULL')
    addColumn('cover_design', 'LONGTEXT NULL')
end)

---@param v any
---@param max integer
---@return string
local function cleanString(v, max)
    if type(v) ~= 'string' then return '' end
    v = v:gsub('%c', function(c) return (c == '\n') and c or '' end)
    if #v <= max then return v end
    -- cut at a character boundary: never leave half of a multi-byte character at the end
    local cut = max
    while cut > 0 do
        local byte = v:byte(cut + 1)
        if not byte or byte < 0x80 or byte >= 0xC0 then break end
        cut = cut - 1
    end
    return v:sub(1, cut)
end

---Picture links already stored in the book being edited: they stay valid whatever Config.ImageHosts says now. Set
---around one synchronous sanitize call.
---@type table<string, boolean>
local knownLinks = {}

---@param pages string|nil encoded pages
---@param design string|nil encoded cover design
---@return table<string, boolean>
local function linksIn(pages, design)
    local set = {}
    for _, text in ipairs({ pages or '', design or '' }) do
        for url in text:gmatch('"src"%s*:%s*"(https?://[^"]+)"') do set[url:gsub('\\/', '/')] = true end
    end
    return set
end

---@param src any
---@return boolean
local function validImageSrc(src)
    if type(src) ~= 'string' or src == '' then return false end
    if src:sub(1, 11) == 'data:image/' then
        if #src > Uploads.maxImageBytes() then return false end
        return src:match('^data:image/jpeg;base64,[%w+/=]+$') ~= nil
            or src:match('^data:image/png;base64,[%w+/=]+$') ~= nil
            or src:match('^data:image/webp;base64,[%w+/=]+$') ~= nil
    end
    if #src > L.maxUrlLength then return false end
    if not src:match('^https?://[^%s"\'<>]+$') then return false end
    local hosts = Config.ImageHosts
    if type(hosts) ~= 'table' or #hosts == 0 or knownLinks[src] then return true end
    -- only the listed hosts (and their subdomains) may be linked
    local host = src:match('^https?://([^/:?#]+)')
    host = host and host:lower()
    if not host then return false end
    if Uploads.enabled() and Uploads.trustedHost(host) then return true end
    for _, allowed in ipairs(hosts) do
        allowed = tostring(allowed):lower()
        if host == allowed or host:sub(-(#allowed + 1)) == '.' .. allowed then return true end
    end
    return false
end

---@param v any
---@param min number
---@param max number
---@param default number
---@return number
local function clampNum(v, min, max, default)
    v = tonumber(v)
    if not v then return default end
    return math.max(min, math.min(max, v))
end

---@param v any
---@param default string
---@return string
local function hexColor(v, default)
    if type(v) == 'string' and v:match('^#%x%x%x%x%x%x$') then return v end
    return default
end

---Validates a custom cover design. nil design means "use the automatic cover".
---@param c any
---@return table|nil design, integer images, string|nil reason
local function sanitizeCover(c)
    if type(c) ~= 'table' then return nil, 0 end

    local design = {
        bg = hexColor(c.bg, '#6e2430'),
        frameColor = hexColor(c.frameColor, '#f1e9d6'),
        texture = TEXTURES[c.texture] and c.texture or 'plain',
        frame = FRAMES[c.frame] and c.frame or 'none',
        elements = {},
    }

    local raw = type(c.elements) == 'table' and c.elements or {}
    if #raw > L.maxCoverElements then return nil, 0, ('Too many cover elements (max %d)'):format(L.maxCoverElements) end

    local images = 0
    for _, e in ipairs(raw) do
        if type(e) ~= 'table' then goto continue end
        if e.type == 'text' then
            local text = cleanString(e.text, L.maxCoverText)
            if text ~= '' then
                design.elements[#design.elements + 1] = {
                    type = 'text', text = text,
                    font = FONTS[e.font] and e.font or 'serif',
                    size = clampNum(e.size, 2, 24, 8),
                    color = hexColor(e.color, '#f1e9d6'),
                    bold = e.bold == true, italic = e.italic == true,
                    x = clampNum(e.x, 0, 100, 50), y = clampNum(e.y, 0, 100, 50),
                }
            end
        elseif e.type == 'image' then
            if not validImageSrc(e.src) then return nil, 0, 'A cover image is invalid, too large or from a site that is not allowed' end
            images = images + 1
            if images > L.maxCoverImages then return nil, 0, ('Too many cover images (max %d)'):format(L.maxCoverImages) end
            design.elements[#design.elements + 1] = {
                type = 'image', src = e.src,
                w = clampNum(e.w, 5, 100, 50),
                x = clampNum(e.x, 0, 100, 50), y = clampNum(e.y, 0, 100, 50),
            }
        end
        ::continue::
    end

    return design, images
end

---Validates and normalises an editor payload. Returns nil + reason on rejection.
---@param p table
---@return table|nil clean, string|nil reason
local function sanitize(p)
    if type(p) ~= 'table' then return nil, 'Invalid book' end

    local title = cleanString(p.title, L.maxTitle):gsub('\n', ' '):match('^%s*(.-)%s*$')
    if title == '' then return nil, 'Give the book a title' end

    local cover = COVERS[p.cover] and p.cover or Config.Covers[1]
    local paper = PAPERS[p.paper] and p.paper or Config.Papers[1]
    local font = PAGE_FONTS[p.font] and p.font or Config.PageFonts[1]
    local dedication = cleanString(p.dedication, L.maxDedication):gsub('\n', ' ')
    local printLimit = math.floor(clampNum(p.printLimit, 0, L.maxEdition, 0))
    local shared = p.shared == true
    local published = p.published == true
    -- a published book always carries its author
    local anonymous = p.anonymous == true and not published
    local inscription = cleanString(p.inscription, L.maxInscription):gsub('\n', ' ')
    local design, _, coverReason = sanitizeCover(p.coverDesign)
    if coverReason then return nil, coverReason end
    local desc = cleanString(p.description, L.maxDescription):gsub('\n', ' ')

    if type(p.pages) ~= 'table' or #p.pages == 0 then return nil, 'A book needs at least one page' end
    if #p.pages > L.maxPages then return nil, ('Too many pages (max %d)'):format(L.maxPages) end

    local pages, images = {}, 0
    for i, page in ipairs(p.pages) do
        local blocks = {}
        local raw = type(page) == 'table' and page.blocks or nil
        if type(raw) ~= 'table' then raw = {} end
        if #raw > L.maxBlocksPerPage then return nil, ('Page %d has too many blocks (max %d)'):format(i, L.maxBlocksPerPage) end

        for _, b in ipairs(raw) do
            if type(b) ~= 'table' then goto continue end
            if b.type == 'text' then
                local text = cleanString(b.text, L.maxTextLength)
                if text ~= '' then
                    blocks[#blocks + 1] = {
                        type = 'text',
                        text = text,
                        style = STYLES[b.style] and b.style or 'body',
                        align = ALIGNS[b.align] and b.align or 'left',
                    }
                end
            elseif b.type == 'image' then
                if not validImageSrc(b.src) then return nil, ('Page %d has an image that is invalid, too large or from a site that is not allowed'):format(i) end
                images += 1
                if images > L.maxImages then return nil, ('Too many images (max %d)'):format(L.maxImages) end
                blocks[#blocks + 1] = {
                    type = 'image',
                    src = b.src,
                    caption = cleanString(b.caption, L.maxCaption):gsub('\n', ' '),
                }
            end
            ::continue::
        end
        pages[#pages + 1] = { blocks = blocks }
    end

    local encoded = json.encode(pages)
    local encodedDesign = design and json.encode(design) or nil
    -- (with uploads on, embedded pictures become short links when the book is saved: the size is checked then)
    if not Uploads.enabled() and #encoded + (encodedDesign and #encodedDesign or 0) > L.maxBookBytes then return nil, 'Book is too large' end

    return {
        design = design,
        title = title, description = desc, cover = cover, paper = paper, font = font, dedication = dedication, printLimit = printLimit,
        shared = shared and not published, published = published, anonymous = anonymous, signed = p.signed == true and not anonymous, inscription = inscription, pages = pages, encoded = encoded,
        imageCount = images, coverDesign = encodedDesign,
    }
end

---Move every embedded picture of a sanitized book to the picture host and keep only its link. A no-op when uploads
---are off. Yields while the pictures are sent.
---@param clean table the result of sanitize
---@return boolean ok, string|nil reason
local function hostPictures(clean)
    if not Uploads.enabled() then return true end

    local links = {}
    ---@param holder table a block or cover element with an image `src`
    local function host(holder, label)
        local src = holder.src
        if type(src) ~= 'string' or src:sub(1, 11) ~= 'data:image/' then return true end
        if not links[src] then
            local url, reason = Uploads.store(src, ('ghm-books-%d-%d.%s'):format(os.time(), math.random(100000, 999999), src:match('^data:image/(%w+);') or 'jpg'))
            if not url then
                print(('^1[ghm-books] Picture upload failed (%s): %s^7'):format(label, tostring(reason)))
                return false
            end
            links[src] = url
        end
        holder.src = links[src]
        return true
    end

    for i, page in ipairs(clean.pages) do
        for _, block in ipairs(page.blocks) do
            if block.type == 'image' and not host(block, 'page ' .. i) then return false, 'A picture could not be uploaded. Try again.' end
        end
    end
    if clean.design then
        for _, element in ipairs(clean.design.elements) do
            if element.type == 'image' and not host(element, 'cover') then return false, 'A picture could not be uploaded. Try again.' end
        end
        clean.coverDesign = json.encode(clean.design)
    end
    clean.encoded = json.encode(clean.pages)

    if #clean.encoded + (clean.coverDesign and #clean.coverDesign or 0) > L.maxBookBytes then return false, 'Book is too large' end
    return true
end

---What the editor is told about the limits: while pictures are uploaded, they may be larger.
---@return table
local function clientLimits()
    local limits = {}
    for k, v in pairs(Config.Limits) do limits[k] = v end
    limits.maxImageBytes = Uploads.maxImageBytes()
    limits.uploads = Uploads.enabled()
    limits.imageHosts = type(Config.ImageHosts) == 'table' and Config.ImageHosts or nil
    return limits
end

---Who is this player? (framework bridge)
---@param src number
---@return { citizenid: string, name: string }|nil
local function identity(src)
    Bridge.waitReady()
    local who = Bridge.fw and Bridge.fw.identity(src)
    if not who then return nil end
    -- (the name goes into VARCHAR(80) columns)
    return { citizenid = who.citizenid, name = cleanString(who.name, 80):gsub('\n', ' ') }
end

---The selected inventory adapter (inventory bridge).
---@return table
local function inv()
    Bridge.waitReady()
    return Bridge.inv or error('ghm-books: no supported inventory is running')
end

---Metadata stored on the book item. (Global: the printer queue in server/computers.lua builds items from it too.) Pages stay in the database; the item only carries what is
---needed to label it and look it up, so a copy handed to someone else opens the same book.
---`copy` carries what belongs to this one copy: its number in the print run, and whether and how it was signed.
---@param row table
---@param copy? { copy?: integer, signed?: boolean, inscription?: string }
---@return table
function ItemMetadata(row, copy)
    copy = copy or {}
    local limit = tonumber(row.print_limit) or 0
    -- (the item shows its metadata to whoever holds it: no citizen id, and no author name on an anonymous book)
    local anonymous = (tonumber(row.anonymous) or 0) == 1
    return {
        bookId = row.id,
        title = row.title,
        label = row.title, -- (ox_inventory names the item by this)
        description = row.description,
        author = (not anonymous) and row.author_name or nil,
        cover = row.cover,
        pageCount = row.page_count,
        copy = copy.copy,
        edition = limit > 0 and limit or nil,
        signed = copy.signed or nil,
        inscription = (copy.inscription and copy.inscription ~= '') and copy.inscription or nil,
    }
end

---@param row table
---@return table
local function summary(row)
    return {
        id = row.id,
        title = row.title,
        description = row.description,
        authorName = row.author_name,
        authorCitizenId = row.author_citizenid,
        cover = row.cover,
        paper = row.paper or 'blank',
        font = row.font or 'serif',
        copies = tonumber(row.copies) or 0,
        printLimit = tonumber(row.print_limit) or 0,
        shared = (tonumber(row.shared) or 0) == 1,
        published = (tonumber(row.published) or 0) == 1,
        anonymous = (tonumber(row.anonymous) or 0) == 1,
        lastEditor = row.last_editor or '',
        hasBackup = row.backup_pages ~= nil and row.backup_pages ~= '' and row.backup_pages ~= 0 and row.backup_pages ~= false,
        revision = tonumber(row.revision) or 1,
        pageCount = row.page_count,
        imageCount = row.image_count,
        createdAt = row.created_at and tostring(row.created_at) or '',
        updatedAt = row.updated_at and tostring(row.updated_at) or '',
    }
end

---Summary plus the content needed to display the book.
---@param row table
---@return table
local function fullBook(row)
    local book = summary(row)
    book.pages = json.decode(row.pages) or {}
    -- (an empty string means the automatic cover; nil is never stored, since a hole in a parameter list is not safe)
    book.coverDesign = (row.cover_design and row.cover_design ~= '') and json.decode(row.cover_design) or nil
    book.dedication = row.dedication or ''
    return book
end

---Does this player hold a book item pointing at bookId?
---@param src number
---@param bookId integer
---@return table|nil slot
local function findHeldBook(src, bookId)
    for _, slot in ipairs(inv().getItems(src, Config.BookItem)) do
        if slot.metadata and tonumber(slot.metadata.bookId) == bookId then return slot end
    end
end

-- ── Admin books menu (/adminbooks) ──────────────────────────────────────────
-- Standalone: gated by the ace that lib.addCommand registers for the command,
-- so whoever may run /adminbooks (group.admin by default) may use it.

local ADMIN_ACE <const> = 'command.adminbooks'

---@param src number
---@return boolean
local function isAdmin(src)
    return IsPlayerAceAllowed(tostring(src), ADMIN_ACE)
end

lib.addCommand('adminbooks', {
    help = 'Open the admin books menu (review and delete player-written books)',
    restricted = Config.AdminGroup,
}, function(source)
    TriggerClientEvent('ghm-books:client:openAdmin', source)
end)

lib.callback.register('ghm-books:admin:list', function(src)
    if not isAdmin(src) then return { success = false, error = 'No permission' } end
    local rows = MySQL.query.await('SELECT id, title, description, author_name, author_citizenid, cover, paper, font, copies, print_limit, shared, published, anonymous, last_editor, revision, (backup_pages IS NOT NULL AND LENGTH(backup_pages) > 0) AS backup_pages, page_count, image_count, created_at, updated_at FROM ghm_books ORDER BY id DESC LIMIT 1000')
    local books = {}
    for i, row in ipairs(rows or {}) do books[i] = summary(row) end
    return { success = true, books = books }
end)

lib.callback.register('ghm-books:admin:get', function(src, bookId)
    if not isAdmin(src) then return { success = false, error = 'No permission' } end
    local row = MySQL.single.await('SELECT * FROM ghm_books WHERE id = ?', { tonumber(bookId) })
    if not row then return { success = false, error = 'Book not found' } end
    return { success = true, book = fullBook(row) }
end)

lib.callback.register('ghm-books:admin:delete', function(src, bookId)
    if not isAdmin(src) then return { success = false, error = 'No permission' } end
    bookId = tonumber(bookId)
    if not bookId then return { success = false, error = 'Invalid book' } end

    local row = MySQL.single.await('SELECT title, author_name, author_citizenid FROM ghm_books WHERE id = ?', { bookId })
    if not row then return { success = false, error = 'Book not found' } end

    MySQL.update.await('DELETE FROM ghm_books WHERE id = ?', { bookId })
    print(('[ghm-books] %s (id %d) deleted book #%d "%s" by %s (%s)'):format(
        GetPlayerName(src) or 'unknown', src, bookId, row.title, row.author_name, row.author_citizenid))
    return { success = true }
end)

-- ── Player callbacks ────────────────────────────────────────────────────────
-- Each is registered twice: as an ox_lib callback for the in-game NUI, and in `Handlers` so the SD Computers app
-- (server/computers.lua) can call the very same code. `via` is 'computer' when the caller is that app.

---@type table<string, fun(src: number, data: any, via?: string): any>
Handlers = {}

---@param name string
---@param fn fun(src: number, data: any, via?: string): any
local function handler(name, fn)
    Handlers[name] = fn
    lib.callback.register('ghm-books:' .. name, function(src, data) return fn(src, data) end)
end

---True when books are written at SD Computers instead of with the blank book item.
---@return boolean
local function computersOnly()
    local c = Config.Computers
    return c.enabled == true and c.itemCreator ~= true and GetResourceState('sd-computers') == 'started'
end

---Take one copy of a print run, or nil when the edition is sold out.
---@param bookId integer
---@return integer|nil copyNumber
local function claimCopy(bookId)
    local affected = MySQL.update.await(
        'UPDATE ghm_books SET copies = copies + 1, updated_at = updated_at WHERE id = ? AND (print_limit = 0 OR copies < print_limit)', { bookId })
    if (affected or 0) == 0 then return nil end
    return MySQL.scalar.await('SELECT copies FROM ghm_books WHERE id = ?', { bookId })
end

---Give a copy back (a print that failed after its number was taken).
---@param bookId integer
local function releaseCopy(bookId)
    MySQL.update.await('UPDATE ghm_books SET copies = GREATEST(copies - 1, 0), updated_at = updated_at WHERE id = ?', { bookId })
end

---Refresh the inventory label of every online player's copy of a book (title, cover, page count, edition).
---A copy keeps its own number, signature and inscription.
---@param bookId integer
---@param row table
function RefreshHolders(bookId, row)
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        local held = findHeldBook(src, bookId)
        if held then
            local meta = held.metadata or {}
            inv().setMetadata(src, held.slot, ItemMetadata(row, { copy = meta.copy, signed = meta.signed, inscription = meta.inscription }))
        end
    end
end

---Read a book the player is holding.
handler('read', function(src, bookId)
    bookId = tonumber(bookId)
    if not bookId or not findHeldBook(src, bookId) then return nil end

    local row = MySQL.single.await('SELECT * FROM ghm_books WHERE id = ?', { bookId })
    if not row then return { removed = true } end

    local held = findHeldBook(src, bookId)
    local meta = held and held.metadata or {}
    local copy = { copy = meta.copy, signed = meta.signed, inscription = meta.inscription }
    local limit = tonumber(row.print_limit) or 0
    if held and (meta.title ~= row.title or meta.cover ~= row.cover or meta.pageCount ~= row.page_count
        or meta.description ~= row.description or meta.edition ~= (limit > 0 and limit or nil)
        -- a copy made before the book was anonymous, or before the citizen id was dropped from the item
        or meta.authorId ~= nil or (meta.author ~= nil) == ((tonumber(row.anonymous) or 0) == 1)) then
        inv().setMetadata(src, held.slot, ItemMetadata(row, copy))
    end

    local who = identity(src)
    local book = fullBook(row)
    book.isAuthor = who ~= nil and who.citizenid == row.author_citizenid
    -- Anyone holding a copy may edit a shared book; only the author may edit a locked one.
    -- A published book can no longer be edited by anyone.
    book.canEdit = not book.published and (book.isAuthor or book.shared)
    -- What belongs to this copy: shown on the inside cover.
    book.copy, book.edition, book.signed, book.inscription = meta.copy, limit > 0 and limit or nil, meta.signed, meta.inscription
    -- Readers do not get the author's citizen id or who edited last; an anonymous book hides the author's name too.
    if not book.isAuthor then
        book.authorCitizenId, book.lastEditor = nil, ''
        if book.anonymous then book.authorName, book.signed = 'Anonymous', nil end
    end
    return book
end)

---Publish a new book (from a blank book, or from a computer) or save an edit to a book the player wrote.
---@param payload table { bookId?, slot?, title, description, cover, paper, font, dedication, printLimit, signed, inscription, coverDesign, pages }
local lastSave = {}

handler('save', function(src, payload, via)
    local now = GetGameTimer()
    if lastSave[src] and now - lastSave[src] < 1000 then return { ok = false, error = 'Slow down' } end
    lastSave[src] = now

    local who = identity(src)
    if not who then return { ok = false, error = 'No character loaded' } end
    if type(payload) ~= 'table' then return { ok = false, error = 'Invalid request' } end

    local editing = tonumber(payload.bookId)
    knownLinks = {}
    if editing then
        local stored = MySQL.single.await('SELECT pages, cover_design FROM ghm_books WHERE id = ?', { editing })
        if stored then knownLinks = linksIn(stored.pages, stored.cover_design) end
    end
    local clean, reason = sanitize(payload)
    knownLinks = {}
    if not clean then return { ok = false, error = reason } end

    local citizenid = who.citizenid
    local slotId = Bridge.coerceSlot(payload.slot)
    local bookId = tonumber(payload.bookId)

    if bookId then
        local row = MySQL.single.await(
            'SELECT author_citizenid, author_name, copies, shared, published, anonymous, revision, pages, dedication, print_limit FROM ghm_books WHERE id = ?', { bookId })
        if not row then return { ok = false, error = 'This book no longer exists' } end

        -- Publishing is final: nobody edits a published book again, the author included.
        if (tonumber(row.published) or 0) == 1 then return { ok = false, error = 'This book is published and can no longer be edited' } end

        -- A locked book (the default) is edited only by its author. A shared book can be edited by anyone who holds a copy.
        local isAuthor = row.author_citizenid == citizenid
        if not isAuthor then
            if (tonumber(row.shared) or 0) ~= 1 then return { ok = false, error = 'This book is locked: only its author can edit it' } end
            if not findHeldBook(src, bookId) then return { ok = false, error = 'You need a copy of this book to edit it' } end
        end

        -- Someone else saved since this editor was opened: refuse rather than overwrite their work.
        if payload.revision ~= nil and tonumber(payload.revision) ~= (tonumber(row.revision) or 1) then
            return { ok = false, conflict = true, error = 'This book was changed by someone else while you were editing. Close it and open it again.' }
        end

        -- (after the permission checks: only people allowed to save a book get pictures uploaded)
        local hosted, hostReason = hostPictures(clean)
        if not hosted then return { ok = false, error = hostReason } end

        -- The author alone decides who may edit, the dedication and the size of the print run. A limited edition
        -- cannot be cut below the copies already printed.
        local printLimit, dedication, shared, published, anonymous = row.print_limit, row.dedication, 1, 0, row.anonymous
        if isAuthor then
            printLimit, dedication, shared = clean.printLimit, clean.dedication, clean.shared and 1 or 0
            anonymous = clean.anonymous and 1 or 0
            if printLimit > 0 and printLimit < (row.copies or 0) then printLimit = row.copies end
            -- Only the author, at a computer, can publish.
            if clean.published then
                if via ~= 'computer' then return { ok = false, error = 'Books are published from a computer' } end
                published = 1
            end
        elseif clean.published then
            return { ok = false, error = 'Only the author can publish a book' }
        end

        local sql = 'UPDATE ghm_books SET title = ?, description = ?, cover = ?, paper = ?, font = ?, dedication = ?, print_limit = ?, shared = ?, published = ?, anonymous = ?, cover_design = ?, page_count = ?, image_count = ?, pages = ?, last_editor = ?, revision = revision + 1'
        local params = {
            clean.title, clean.description, clean.cover, clean.paper, clean.font, dedication, printLimit, shared, published, anonymous,
            clean.coverDesign or '', #clean.pages, clean.imageCount, clean.encoded, who.name,
        }
        -- When someone other than the author edits, keep what the book said before so the author can restore it.
        if not isAuthor then
            sql = sql .. ', backup_pages = ?'
            params[#params + 1] = row.pages
        end
        params[#params + 1] = bookId
        params[#params + 1] = tonumber(row.revision) or 1
        -- (only if nobody saved while the pictures were being uploaded)
        local changed = MySQL.update.await(sql .. ' WHERE id = ? AND revision = ?', params)
        if (changed or 0) == 0 then
            return { ok = false, conflict = true, error = 'This book was changed by someone else while you were editing. Close it and open it again.' }
        end

        RefreshHolders(bookId, {
            id = bookId, title = clean.title, description = clean.description, author_name = row.author_name,
            author_citizenid = row.author_citizenid, cover = clean.cover, page_count = #clean.pages, print_limit = printLimit,
            anonymous = anonymous,
        })
        return { ok = true, bookId = bookId }
    end

    -- A new book. At a computer it is saved to the author's library (copies are printed from there);
    -- with the item flow it must consume a blank book from the slot the editor was opened from.
    if via ~= 'computer' and computersOnly() then return { ok = false, error = 'Books are written at a computer' } end
    if clean.published and via ~= 'computer' then return { ok = false, error = 'Books are published from a computer' } end

    if (MySQL.scalar.await('SELECT COUNT(*) FROM ghm_books WHERE author_citizenid = ?', { citizenid }) or 0) >= L.maxBooksPerAuthor then
        return { ok = false, error = ('You have already written %d books'):format(L.maxBooksPerAuthor) }
    end

    local slot
    if via ~= 'computer' then
        slot = slotId and inv().getSlot(src, slotId)
        if not slot or slot.name ~= Config.BlankItem then return { ok = false, error = 'You need a blank book' } end
    end

    local hosted, hostReason = hostPictures(clean)
    if not hosted then return { ok = false, error = hostReason } end

    local firstCopy = via ~= 'computer' and 1 or 0
    local id = MySQL.insert.await(
        'INSERT INTO ghm_books (title, description, author_name, author_citizenid, cover, paper, font, dedication, print_limit, copies, cover_design, page_count, image_count, pages, shared, published, anonymous, last_editor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { clean.title, clean.description, who.name, citizenid, clean.cover, clean.paper, clean.font, clean.dedication, clean.printLimit, firstCopy, clean.coverDesign or '', #clean.pages, clean.imageCount, clean.encoded, clean.shared and 1 or 0, clean.published and 1 or 0, clean.anonymous and 1 or 0, who.name }
    )
    if not id then return { ok = false, error = 'Could not save the book' } end
    if via == 'computer' then return { ok = true, bookId = id } end

    if not inv().remove(src, Config.BlankItem, 1, slotId) then
        MySQL.update.await('DELETE FROM ghm_books WHERE id = ?', { id })
        return { ok = false, error = 'You need a blank book' }
    end

    inv().add(src, Config.BookItem, 1, ItemMetadata({
        id = id, title = clean.title, description = clean.description, author_name = who.name,
        author_citizenid = citizenid, cover = clean.cover, page_count = #clean.pages, print_limit = clean.printLimit,
        anonymous = clean.anonymous and 1 or 0,
    }, { copy = 1, signed = clean.signed, inscription = clean.inscription }))

    return { ok = true, bookId = id }
end)

handler('limits', function()
    return { limits = clientLimits(), covers = Config.Covers, papers = Config.Papers, computersOnly = computersOnly() }
end)

-- ── /mybooks: authors manage their own books without needing a copy in hand ──

lib.addCommand('mybooks', { help = 'Open the books you have written' }, function(source)
    if not identity(source) then return end
    if computersOnly() then
        return lib.notify(source, { description = 'Use the Books app on a computer to manage your books.', type = 'inform', icon = 'fa-solid fa-computer' })
    end
    TriggerClientEvent('ghm-books:client:openMine', source)
end)

---@param src number
---@param bookId any
---@return table|nil row, string|nil citizenid
local function ownedRow(src, bookId)
    local who = identity(src)
    bookId = tonumber(bookId)
    if not who or not bookId then return nil end
    local citizenid = who.citizenid
    return MySQL.single.await('SELECT * FROM ghm_books WHERE id = ? AND author_citizenid = ?', { bookId, citizenid }), citizenid
end

handler('mine:list', function(src)
    local who = identity(src)
    if not who then return { success = false, error = 'No character loaded' } end
    local rows = MySQL.query.await(
        'SELECT id, title, description, author_name, author_citizenid, cover, paper, font, copies, print_limit, shared, published, anonymous, last_editor, revision, (backup_pages IS NOT NULL AND LENGTH(backup_pages) > 0) AS backup_pages, page_count, image_count, created_at, updated_at FROM ghm_books WHERE author_citizenid = ? ORDER BY updated_at DESC LIMIT 200',
        { who.citizenid })
    local books = {}
    for i, row in ipairs(rows or {}) do books[i] = summary(row) end
    local cost = Config.PrintCostItem
    return {
        success = true, books = books,
        -- how many of the print cost item the player holds, and whether printing costs one at all
        blankBooks = cost and inv().count(src, cost) or 0, freePrint = cost == nil,
    }
end)

handler('mine:get', function(src, bookId)
    local row = ownedRow(src, bookId)
    if not row then return { success = false, error = 'Book not found' } end
    local book = fullBook(row)
    book.canEdit = not book.published
    return { success = true, book = book }
end)

local lastPrint = {}

---Hand the author another copy of their book: numbered in its print run, optionally signed and inscribed, and
---paid for with Config.PrintCostItem.
---@param data number|{ id: integer, inscription?: string, signed?: boolean }
handler('mine:print', function(src, data, via)
    local now = GetGameTimer()
    if lastPrint[src] and now - lastPrint[src] < 1500 then return { success = false, error = 'Slow down' } end
    lastPrint[src] = now

    if type(data) ~= 'table' then data = { id = data } end
    local row = ownedRow(src, data.id)
    if not row then return { success = false, error = 'Book not found' } end

    -- At a computer, copies come out of an sd-computers printer and are collected there.
    local toPrinter = via == 'computer' and Computers and Computers.usesPrinters()
    local who = identity(src)
    local printer
    if toPrinter then
        if not who then return { success = false, error = 'No character loaded' } end
        local err
        printer, err = Computers.checkPrinter(src, who.citizenid, data.printer)
        if not printer then return { success = false, error = err } end
    end

    local cost = Config.PrintCostItem
    if cost and inv().count(src, cost) < 1 then
        return { success = false, error = 'You need a blank book to print a copy' }
    end
    if not toPrinter and not inv().canCarry(src, Config.BookItem, 1) then
        return { success = false, error = 'You cannot carry another book' }
    end
    if cost and not inv().remove(src, cost, 1) then
        return { success = false, error = 'You need a blank book to print a copy' }
    end

    local number = claimCopy(row.id)
    if not number then
        if cost then inv().add(src, cost, 1) end
        return { success = false, error = 'This edition is sold out' }
    end

    local inscription = cleanString(data.inscription, L.maxInscription):gsub('\n', ' ')
    if toPrinter then
        local seconds = Computers.queue(who.citizenid, printer, row.id, number, { signed = data.signed == true and (tonumber(row.anonymous) or 0) == 0, inscription = inscription })
        TriggerClientEvent('ghm-books:client:printersChanged', src)
        lib.notify(src, {
            description = ('Your book is printing at %s. Wait at the printer: it is handed to you in about %d seconds.'):format(printer.label, seconds),
            type = 'inform', icon = 'fa-solid fa-print',
        })
        return { success = true, copy = number, queued = true, printer = printer.label, seconds = seconds }
    end

    if not inv().add(src, Config.BookItem, 1, ItemMetadata(row, { copy = number, signed = data.signed == true and (tonumber(row.anonymous) or 0) == 0, inscription = inscription })) then
        releaseCopy(row.id)
        if cost then inv().add(src, cost, 1) end
        return { success = false, error = 'Could not print a copy' }
    end
    return { success = true, copy = number }
end)

---Put back what a book said before someone else's last edit. The two versions swap, so a restore can be undone.
handler('mine:restore', function(src, bookId)
    local row = ownedRow(src, bookId)
    if not row then return { success = false, error = 'Book not found' } end
    if (tonumber(row.published) or 0) == 1 then return { success = false, error = 'A published book can no longer be changed' } end
    if not row.backup_pages or row.backup_pages == '' then return { success = false, error = 'There is no earlier version to restore' } end
    local who = identity(src)

    local restored = json.decode(row.backup_pages) or {}
    local images = 0
    for _, page in ipairs(restored) do
        for _, block in ipairs(page.blocks or {}) do if block.type == 'image' then images = images + 1 end end
    end
    MySQL.update.await(
        'UPDATE ghm_books SET pages = ?, backup_pages = ?, page_count = ?, image_count = ?, last_editor = ?, revision = revision + 1 WHERE id = ?',
        { row.backup_pages, row.pages, #restored, images, who and who.name or row.author_name, row.id })

    RefreshHolders(row.id, {
        id = row.id, title = row.title, description = row.description, author_name = row.author_name,
        author_citizenid = row.author_citizenid, cover = row.cover, page_count = #restored, print_limit = row.print_limit,
        anonymous = row.anonymous,
    })
    return { success = true }
end)

handler('mine:delete', function(src, bookId)
    local row, citizenid = ownedRow(src, bookId)
    if not row then return { success = false, error = 'Book not found' } end
    MySQL.update.await('DELETE FROM ghm_books WHERE id = ? AND author_citizenid = ?', { row.id, citizenid })
    return { success = true }
end)

AddEventHandler('playerDropped', function()
    lastPrint[source] = nil
    lastSave[source] = nil
end)
