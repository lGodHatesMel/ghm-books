-- /books_seed: inserts sample books so the admin Books tab and the reader have data to test.
-- Rows are tagged with author_citizenid = 'SEED' so /books_unseed removes exactly these.

local SEED_AUTHOR = 'SEED'

local function text(t, style, align) return { type = 'text', text = t, style = style or 'body', align = align or 'left' } end

-- 1x1-ish placeholder PNG, small enough to keep seed rows tiny; real books carry compressed JPEGs.
local PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

local SAMPLES = {
    {
        title = 'Los Santos Field Guide', description = 'Notes on neighbourhoods, shortcuts and who to avoid.',
        author = 'Marcus Reed', cover = 'forest', paper = 'old', font = 'old', dedication = 'For everyone who has ever asked me for directions.', printLimit = 50, copies = 12,
        design = { bg = '#24473a', frameColor = '#d8c58a', texture = 'cloth', frame = 'double', elements = {
            { type = 'text', text = 'LOS SANTOS', font = 'display', size = 11, color = '#e7d9a8', bold = true, italic = false, x = 50, y = 30 },
            { type = 'text', text = 'Field Guide', font = 'old', size = 8, color = '#f1e9d6', bold = false, italic = true, x = 50, y = 42 },
            { type = 'text', text = 'Marcus Reed', font = 'sans', size = 4, color = '#d8c58a', bold = false, italic = false, x = 50, y = 86 },
        } },
        pages = {
            { blocks = { text('Los Santos Field Guide', 'heading', 'center'), text('Compiled over three years of walking, driving and getting lost.', 'quote', 'center') } },
            { blocks = { text('Vinewood', 'heading'), text('Parking is a nightmare after 9pm. Use the garage off Vine Street and walk. The tourists tip well; the promoters do not.') } },
            { blocks = { text('Docks', 'heading'), text('Shift change is at six. After that the yard is empty except for the cats.'), { type = 'image', src = PIXEL, caption = 'Gate 4, looking east' } } },
        },
    },
    {
        title = 'Letters I Never Sent', description = 'Short, private, mostly unfinished.',
        author = 'Elena Voss', cover = 'oxblood', paper = 'lined', font = 'hand', dedication = 'For M., wherever you are.',
        pages = {
            { blocks = { text('To whoever finds this,', 'heading'), text('I kept writing these and never found the nerve to post them.') } },
            { blocks = { text('The second one was about the summer we spent on the pier. I still smell salt when it rains.', 'body') } },
        },
    },
    {
        title = 'Mechanic Handbook Vol. 1', description = 'Torque specs, bolt patterns, and bad habits to avoid.',
        author = 'Danny Okafor', cover = 'slate', paper = 'grid', font = 'mono',
        pages = {
            { blocks = { text('Mechanic Handbook', 'heading', 'center'), text('Volume 1: Brakes and Suspension', 'quote', 'center') } },
            { blocks = { text('Always bleed from the wheel furthest from the master cylinder. Check pad thickness before blaming the rotor.') } },
            { blocks = { text('Torque wheel nuts in a star pattern, twice. Re-check after the first fifty miles.') } },
            { blocks = { text('Reference chart', 'heading'), { type = 'image', src = PIXEL, caption = 'Bolt pattern chart' } } },
        },
    },
    {
        title = 'The Long Way Home', description = 'A short story in four pages.',
        author = 'Priya Nair', cover = 'navy', paper = 'black',
        pages = {
            { blocks = { text('The Long Way Home', 'heading', 'center') } },
            { blocks = { text('The bus had been gone for twenty minutes before Tom admitted he was not going to catch it.') } },
            { blocks = { text('He took the long way, past the closed laundromat and the shop with the broken sign that only ever said OPEN.') } },
            { blocks = { text('When he got home the porch light was on. It had never once been on before.', 'body'), text('The End', 'quote', 'center') } },
        },
    },
}

lib.addCommand('books_seed', {
    help = 'Insert sample books for testing the book creator',
    restricted = Config.SeedCommandGroup,
}, function(source)
    local inserted = 0
    for _, b in ipairs(SAMPLES) do
        local encoded = json.encode(b.pages)
        local images = 0
        for _, p in ipairs(b.pages) do
            for _, blk in ipairs(p.blocks) do if blk.type == 'image' then images += 1 end end
        end
        MySQL.insert.await(
            'INSERT INTO ghm_books (title, description, author_name, author_citizenid, cover, paper, font, dedication, print_limit, copies, cover_design, page_count, image_count, pages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            { b.title, b.description, b.author, SEED_AUTHOR, b.cover, b.paper or 'blank', b.font or 'serif', b.dedication or '', b.printLimit or 0, b.copies or 0,
              b.design and json.encode(b.design) or '', #b.pages, images, encoded }
        )
        inserted += 1
    end
    if source > 0 then
        lib.notify(source, { description = ('Inserted %d sample books'):format(inserted), type = 'success', icon = 'fa-solid fa-book' })
    end
    print(('[ghm-books] inserted %d sample books'):format(inserted))
end)

lib.addCommand('books_unseed', {
    help = 'Delete the sample books inserted by /books_seed',
    restricted = Config.SeedCommandGroup,
}, function(source)
    local removed = MySQL.update.await('DELETE FROM ghm_books WHERE author_citizenid = ?', { SEED_AUTHOR }) or 0
    if source > 0 then
        lib.notify(source, { description = ('Removed %d sample books'):format(removed), type = 'success', icon = 'fa-solid fa-trash' })
    end
    print(('[ghm-books] removed %d sample books'):format(removed))
end)

-- /books_give <id>: hands the caller a book item for any existing book, to test the reader.
lib.addCommand('books_give', {
    help = 'Give yourself a book item for an existing book id',
    params = { { name = 'id', type = 'number', help = 'Book id' } },
    restricted = Config.SeedCommandGroup,
}, function(source, args)
    local row = MySQL.single.await('SELECT * FROM ghm_books WHERE id = ?', { args.id })
    if not row then return lib.notify(source, { description = 'No such book', type = 'error', icon = 'fa-solid fa-book' }) end
    Bridge.waitReady()
    Bridge.inv.add(source, Config.BookItem, 1, {
        bookId = row.id, title = row.title, description = row.description, author = row.author_name,
        authorId = row.author_citizenid, cover = row.cover, pageCount = row.page_count,
    })
end)

-- /books_bridgetest: checks that the detected framework and inventory adapters work on this server.
-- It briefly adds a test book item to the caller, reads it back, updates its metadata and removes it again.
lib.addCommand('books_bridgetest', {
    help = 'Test the framework and inventory bridge (adds and removes a test book on you)',
    restricted = Config.SeedCommandGroup,
}, function(source)
    Bridge.waitReady()
    local report, failed = {}, 0
    local function step(label, ok, detail)
        report[#report + 1] = ('%s %s%s'):format(ok and '[ok]  ' or '[FAIL]', label, detail and (' (' .. detail .. ')') or '')
        if not ok then failed = failed + 1 end
        return ok
    end

    if not (Bridge.fw and Bridge.inv) then
        print('^1[ghm-books] bridge test: no framework or inventory was detected^7')
        return
    end

    local inv, src = Bridge.inv, source
    local who = Bridge.fw.identity(src)
    step('identity', who ~= nil and who.citizenid ~= nil, who and ('%s / %s'):format(who.citizenid, who.name) or 'no character')
    step('canCarry', inv.canCarry(src, Config.BookItem, 1) == true)

    local meta = { bookId = -1, title = 'Bridge test', description = '', author = 'test', authorId = 'test', cover = 'oxblood', pageCount = 1 }
    local before = inv.count(src, Config.BookItem)
    if step('add book with metadata', inv.add(src, Config.BookItem, 1, meta)) then
        Wait(300)
        local found
        for _, s in ipairs(inv.getItems(src, Config.BookItem)) do
            if tonumber(s.metadata.bookId) == -1 then found = s end
        end
        if step('read metadata back', found ~= nil, found and ('slot ' .. tostring(found.slot)) or 'the item has no metadata: this inventory ignored it') and found then
            local slot = inv.getSlot(src, found.slot)
            step('getSlot', slot ~= nil and slot.name == Config.BookItem)
            step('count', inv.count(src, Config.BookItem) == before + 1)
            local updated = inv.setMetadata(src, found.slot, { bookId = -1, title = 'Bridge test 2', pageCount = 1, cover = 'oxblood' })
            -- Not every inventory can do this; a failure only means labels will not refresh after edits.
            report[#report + 1] = updated and '[ok]   setMetadata' or '[info] setMetadata unsupported: edited books keep their old inventory label'
            step('remove by slot', inv.remove(src, Config.BookItem, 1, found.slot))
            Wait(300)
            step('count after remove', inv.count(src, Config.BookItem) == before)
        end
    end

    print(('^5[ghm-books] bridge test (%s + %s)^7\n  %s'):format(Bridge.fw.resource, Bridge.inv.resource, table.concat(report, '\n  ')))
    if source > 0 then
        lib.notify(source, {
            title = 'Books bridge test',
            description = failed == 0 and 'All checks passed. See the server console for details.' or ('%d check(s) failed. See the server console.'):format(failed),
            type = failed == 0 and 'success' or 'error', icon = 'fa-solid fa-plug',
        })
    end
end)
