-- qs-inventory: add to qs-inventory/shared/items.lua
-- Copy install/images/book.png and blank_book.png into qs-inventory/html/images.

['blank_book'] = {
    ['name'] = 'blank_book',
    ['label'] = 'Blank Book',
    ['weight'] = 300,
    ['type'] = 'item',
    ['image'] = 'blank_book.png',
    ['unique'] = false,
    ['useable'] = true,
    ['shouldClose'] = true,
    ['combinable'] = nil,
    ['description'] = 'Empty pages waiting to be written in.',
},

['book'] = {
    ['name'] = 'book',
    ['label'] = 'Book',
    ['weight'] = 350,
    ['type'] = 'item',
    ['image'] = 'book.png',
    ['unique'] = true, -- every copy carries its own metadata
    ['useable'] = true,
    ['shouldClose'] = true,
    ['combinable'] = nil,
    ['description'] = 'A book written by a player.',
},
