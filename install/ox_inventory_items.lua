-- Add these two entries to ox_inventory/data/items.lua

['blank_book'] = {
    label = 'Blank Book',
    weight = 300,
    stack = true,
    close = true,
    description = 'Empty pages waiting to be written in.',
    client = { export = 'ghm-books.useBlankBook' },
},

['book'] = {
    label = 'Book',
    weight = 350,
    stack = false, -- every copy carries its own metadata
    close = true,
    description = 'A book written by a player.',
    client = { export = 'ghm-books.useBook' },
},
