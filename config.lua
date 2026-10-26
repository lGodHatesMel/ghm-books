Config = {}

-- Framework and inventory. 'auto' picks whatever is running.
--   Config.Framework: 'auto' | 'qbx' (qbx_core) | 'qb' (qb-core) | 'esx' (es_extended)
--   Config.Inventory: 'auto' | 'ox' (ox_inventory) | 'one' (one_inventory) | 'tgiann' (tgiann-inventory) | 'jaksam' (jaksam_inventory)
--                     | 'qs' (qs-inventory, qs-inventory-pro) | 'origen' (origen_inventory) | 'qb' (qb-inventory, ps-inventory, lj-inventory)
--                     | 'codem' (codem-inventory)
Config.Framework = 'auto'
Config.Inventory = 'auto'

-- Item names (must exist in ox_inventory/data/items.lua)
Config.BlankItem = 'blank_book'
Config.BookItem  = 'book'

-- Content limits. Enforced on the server; the NUI reads them from the open payload
-- so the editor can show counters. Images are stored inline as compressed data URLs,
-- so maxImages * maxImageBytes is the worst-case image weight of one book.
Config.Limits = {
    maxTitle         = 60,
    maxDescription   = 140,
    maxPages         = 40,
    maxBlocksPerPage = 8,
    maxTextLength    = 2500,
    maxCaption       = 120,
    maxImages        = 10,
    maxImageBytes    = 140 * 1024, -- per uploaded (data URL) image, after client-side compression
    maxUrlLength     = 500,
    maxBookBytes     = 1536 * 1024,
    -- Custom cover designer
    maxCoverElements = 12,
    maxCoverImages   = 3,
    maxCoverText     = 80,
    -- Dedication, signed copies and limited editions
    maxDedication    = 200,
    maxInscription   = 120,
    maxEdition       = 500,
    maxBooksPerAuthor = 50, -- how many books one character may have written
}

-- Quick-start cover colours (the designer also accepts any hex colour)
Config.Covers = { 'oxblood', 'forest', 'navy', 'slate', 'ochre', 'black' }

-- Paper types a book can be printed on. Ids are matched by the NUI (web/src/utils/book.ts).
Config.Papers = { 'blank', 'lined', 'grid', 'dotted', 'old', 'black' }

-- Page text fonts a book can use (matched by the NUI): serif, hand (handwriting), old (old print), mono (typewriter)
Config.PageFonts = { 'serif', 'hand', 'old', 'mono' }

-- What printing another copy of a book costs (one of this item per copy). nil makes printing free.
Config.PrintCostItem = Config.BlankItem

-- (Not used by the editor, which adds pictures by link: FiveM cannot open a file picker. Kept for pictures sent to the
-- server as image data, e.g. by another resource.) Where such pictures are kept. The server uploads each picture when the book is saved and the book keeps
-- only the link. Tokens go in server.cfg, never in this file (it is sent to players).
--   'fivemanage': Fivemanage Media.            set fivemanage_key_media "your-token"   (sd-phone's key works)
--   'qbox':       Qbox CDN.                    set sd_qbox_cdn_key "your-token"         (sd-phone's key works)
--   'r2':         Cloudflare R2 (or any S3-compatible bucket). Fill in `r2` below and set
--                     set ghm_books_r2_key_id "access-key-id"
--                     set ghm_books_r2_secret "secret-access-key"
--   'database':   pictures are stored inside the book, so Limits.maxImageBytes and Limits.maxBookBytes apply.
-- A host without its token falls back to 'database', and the console says so.
Config.Upload = {
    provider = 'database',
    -- Largest picture the editor may send to be uploaded, after it compresses it (replaces Limits.maxImageBytes
    -- while uploads are on). Everything is sent in one request when the book is saved: lower this if saving a book
    -- with many pictures fails.
    maxImageBytes = 300 * 1024,
    -- Only for provider = 'r2'.
    r2 = {
        accountId = '',   -- Cloudflare account id: the upload address is <accountId>.r2.cloudflarestorage.com
        bucket = '',      -- bucket name
        publicUrl = '',   -- where the bucket is served publicly, e.g. 'https://pub-xxxx.r2.dev' or 'https://cdn.example.com'
        endpoint = nil,   -- another S3-compatible address instead of Cloudflare's (host name only)
        region = 'auto',
    },
}

-- Pictures are added to a book by link, since FiveM cannot open a file picker. This is the list of websites a link may
-- come from (subdomains included): everyone who opens the book loads the picture from that site, so keep it to hosts you
-- trust. Add your own CDN here. nil allows any http(s) address. Players are shown this list in the editor.
Config.ImageHosts = {
    'imgur.com',            -- i.imgur.com
    'ibb.co',               -- i.ibb.co (ImgBB)
    'gyazo.com',
    'discordapp.com',       -- cdn.discordapp.com
    'discordapp.net',       -- media.discordapp.net
    'fivemanage.com',       -- r2.fivemanage.com
    'fmfile.com',
    'qbox.re',              -- the Qbox CDN
    'r2.dev',               -- Cloudflare R2 public buckets (pub-xxxx.r2.dev)
    'githubusercontent.com',
    'wikimedia.org',        -- upload.wikimedia.org
    'giphy.com',            -- media.giphy.com
    'tenor.com',            -- media.tenor.com
}

-- SD Computers (sd-computers) integration. When enabled and sd-computers is running, a "Books" app is added to
-- its desktop: write, edit, print and delete books from a computer instead of with the blank book item.
Config.Computers = {
    enabled = true,
    appId = 'books',
    label = 'Books',
    color = '#6e2430',
    -- Limit the app to jobs, e.g. { author = 0 } (job name = minimum grade), or to players carrying an item. nil = everyone.
    groups = nil,
    items = nil,
    -- Limit the app to certain computers. Every computer shows the app unless you set one of these (see
    -- "Choosing which computers get the app" in the README).
    --   computers: a list of computer ids, e.g. { 'public_pc', 'placed_3' }. The ids are the `id` of an entry in
    --              sd-computers' configs/shared/computers.lua, or 'placed_<n>' for a computer made in /computeradmin.
    --   styles:    a list of computer looks, e.g. { 'modern' } (the keys of Desktop.Styles in sd-computers).
    -- nil for both = every computer. (These are lists, not { id = true } tables.)
    computers = nil,
    styles = nil,
    -- sd-computers 1.2.0 and later show a custom app's page on the live screen of the computer's prop, so players
    -- standing nearby see what is being written, like the built-in apps. false hides the Books window from them (it
    -- shows the app's icon and name instead). Pictures linked from other sites are not drawn on the prop either way.
    mirror = true,
    -- false: using a blank book no longer opens the creator (books are written at a computer; a blank book is
    -- only what a printed copy costs). true: both ways work.
    itemCreator = false,
    -- Copies are printed at one of sd-computers' printers: you pick a printer from the computer, the copy is numbered
    -- and paid for at once, and the book item is collected standing at that printer. false hands the item over at
    -- once. (If a server has no sd-computers printers at all, the item is handed over at once whatever this says.)
    printToPrinter = true,
    printerRange = 30.0,   -- metres from the player that a printer may stand
    secondsPerCopy = 4,    -- how long each copy takes to come out
    trayLimit = 20,        -- most uncollected copies one player may have waiting at a printer
    reach = 3.0,           -- metres from a printer its tray can be reached
}

-- Who may run /adminbooks (the admin books menu) and the /books_seed test commands
Config.AdminGroup = 'group.admin'
Config.SeedCommandGroup = Config.AdminGroup
