fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'GHM'
description 'Player-written books: blank book item, text + image editor, readable book items carrying metadata'
version '1.0.0'

dependencies {
    'oxmysql',
    'ox_lib',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/bridge/init.lua',
    'server/bridge/framework/qbx.lua',
    'server/bridge/framework/qb.lua',
    'server/bridge/framework/esx.lua',
    'server/bridge/inventory/one.lua',
    'server/bridge/inventory/ox.lua',
    'server/bridge/inventory/tgiann.lua',
    'server/bridge/inventory/jaksam.lua',
    'server/bridge/inventory/qs.lua',
    'server/bridge/inventory/origen.lua',
    'server/bridge/inventory/qb.lua',
    'server/bridge/inventory/codem.lua',
    'server/upload.js',
    'server/uploads.lua',
    'server/main.lua',
    'server/computers.lua',
    'server/seed.lua',
}

client_scripts {
    'client/main.lua',
}

ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/**/*',
    'web/dist/icon.svg',
}
