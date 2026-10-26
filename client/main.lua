local open = false
local refreshPrinters

-- The page starts hidden and only the open* messages below show anything, but make sure a
-- resource (re)start or a freshly loaded player never inherits focus or a visible panel.
CreateThread(function()
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end)

---@param show boolean
local function setFocus(show)
    open = show
    SetNuiFocus(show, show)
end

local function closeUi()
    if not open then return end
    setFocus(false)
    SendNUIMessage({ action = 'close' })
end

---@param slotNumber number
local function openEditor(slotNumber)
    if open then return end
    local cfg = lib.callback.await('ghm-books:limits', false)
    if cfg.computersOnly then
        return lib.notify({ description = 'Books are written at a computer. Open the Books app.', type = 'inform', icon = 'fa-solid fa-computer' })
    end
    setFocus(true)
    SendNUIMessage({ action = 'openEditor', slot = slotNumber, limits = cfg.limits, covers = cfg.covers, papers = cfg.papers })
end

---@param slot table
local function openReader(slot)
    if open then return end
    local bookId = slot.metadata and tonumber(slot.metadata.bookId)
    if not bookId then
        return lib.notify({ description = 'This book is blank and damaged.', type = 'error', icon = 'fa-solid fa-book' })
    end

    local book = lib.callback.await('ghm-books:read', false, bookId)
    if not book then return lib.notify({ description = 'You cannot read this.', type = 'error', icon = 'fa-solid fa-book' }) end
    if book.removed then
        return lib.notify({ description = 'The pages of this book have been torn out.', type = 'error', icon = 'fa-solid fa-book-skull' })
    end

    local cfg = lib.callback.await('ghm-books:limits', false)
    setFocus(true)
    SendNUIMessage({ action = 'openReader', book = book, slot = slot.slot, limits = cfg.limits, covers = cfg.covers, papers = cfg.papers })
end

-- ox_inventory runs item use through the `client.export` in items.lua (see install/ox_inventory_items.lua).
exports('useBlankBook', function(data, slot)
    openEditor((slot and slot.slot) or data.slot)
end)

exports('useBook', function(data, slot)
    openReader({ slot = (slot and slot.slot) or data.slot, metadata = (slot and slot.metadata) or data.metadata })
end)

-- Every other inventory calls the server on use (see server/bridge), which sends us here.
RegisterNetEvent('ghm-books:client:use', function(kind, slot, metadata)
    if kind == 'blank' then
        openEditor(slot)
    else
        openReader({ slot = slot, metadata = metadata })
    end
end)

RegisterNetEvent('ghm-books:client:openAdmin', function()
    if open then return end
    setFocus(true)
    SendNUIMessage({ action = 'openAdmin' })
end)

RegisterNUICallback('adminList', function(_, cb)
    cb(lib.callback.await('ghm-books:admin:list', false))
end)

RegisterNUICallback('adminGet', function(data, cb)
    cb(lib.callback.await('ghm-books:admin:get', false, data.id))
end)

RegisterNUICallback('adminDelete', function(data, cb)
    cb(lib.callback.await('ghm-books:admin:delete', false, data.id))
end)

RegisterNetEvent('ghm-books:client:openMine', function()
    if open then return end
    setFocus(true)
    SendNUIMessage({ action = 'openMine' })
end)

RegisterNUICallback('mineList', function(_, cb)
    cb(lib.callback.await('ghm-books:mine:list', false))
end)

RegisterNUICallback('mineGet', function(data, cb)
    local res = lib.callback.await('ghm-books:mine:get', false, data.id)
    if res and res.success then
        local cfg = lib.callback.await('ghm-books:limits', false)
        res.limits, res.covers, res.papers = cfg.limits, cfg.covers, cfg.papers
    end
    cb(res)
end)

RegisterNUICallback('minePrint', function(data, cb)
    cb(lib.callback.await('ghm-books:mine:print', false, { id = data.id, inscription = data.inscription, signed = data.signed }))
end)

RegisterNUICallback('mineRestore', function(data, cb)
    cb(lib.callback.await('ghm-books:mine:restore', false, data.id))
end)

RegisterNUICallback('mineDelete', function(data, cb)
    cb(lib.callback.await('ghm-books:mine:delete', false, data.id))
end)

-- A character swap must not leave a book (and the NUI focus) open. These are the load/unload events of
-- every supported framework; the ones a server does not use simply never fire.
for _, event in ipairs({
    'qbx_core:client:playerLoaded', 'qbx_core:client:onPlayerUnload',
    'QBCore:Client:OnPlayerLoaded', 'QBCore:Client:OnPlayerUnload',
    'esx:playerLoaded', 'esx:onPlayerLogout',
}) do
    RegisterNetEvent(event, closeUi)
end

RegisterNUICallback('close', function(_, cb)
    setFocus(false)
    cb('ok')
end)

RegisterNUICallback('save', function(data, cb)
    cb(lib.callback.await('ghm-books:save', false, data) or { ok = false, error = 'No response from server' })
end)

AddEventHandler('onResourceStop', function(res)
    if res == cache.resource and open then SetNuiFocus(false, false) end
end)

-- ── Collecting books printed at an sd-computers printer ────────────────────────────────────────────────────
-- sd-computers' printer already has an option of its own ("Take printouts") and gives no way to add to it, so books
-- have none: standing at the printer while copies are waiting hands them over once they are out. The server knows
-- which printers hold books for this player; only those get a zone.

---@type table<integer, table> lib.points by printer id
local printerPoints = {}
---@type table<integer, boolean> printers the player is standing at
local standing = {}

local function clearPrinterPoints()
    for _, point in pairs(printerPoints) do point:remove() end
    printerPoints = {}
    standing = {}
end

---While the player stands at a printer, take what has come out of it.
---@param printerId integer
local function collectWhileStanding(printerId)
    while standing[printerId] do
        local reply = lib.callback.await('ghm-books:printer:collect', false, printerId)
        if type(reply) == 'table' then
            if reply.ok then
                lib.notify({ description = reply.message, type = 'success', icon = 'fa-solid fa-book' })
                return refreshPrinters()
            elseif not reply.pending then
                -- nothing for them, no room to carry it, or not close enough: say so and wait until they come back
                if reply.message then lib.notify({ description = reply.message, type = 'inform', icon = 'fa-solid fa-book' }) end
                return
            end
        end
        Wait(2000)
    end
end

refreshPrinters = function()
    local list = lib.callback.await('ghm-books:printer:mine', false)
    clearPrinterPoints()
    for _, printer in ipairs(list or {}) do
        printerPoints[printer.id] = lib.points.new({
            coords = vec3(printer.coords.x, printer.coords.y, printer.coords.z),
            distance = 2.0,
            printerId = printer.id,
            onEnter = function(self)
                standing[self.printerId] = true
                CreateThread(function() collectWhileStanding(self.printerId) end)
            end,
            onExit = function(self)
                standing[self.printerId] = nil
            end,
        })
    end
end

RegisterNetEvent('ghm-books:client:printersChanged', refreshPrinters)

for _, event in ipairs({ 'qbx_core:client:playerLoaded', 'QBCore:Client:OnPlayerLoaded', 'esx:playerLoaded' }) do
    AddEventHandler(event, function() SetTimeout(3000, refreshPrinters) end)
end
RegisterNetEvent('qbx_core:client:onPlayerUnload', clearPrinterPoints)
RegisterNetEvent('QBCore:Client:OnPlayerUnload', clearPrinterPoints)
RegisterNetEvent('esx:onPlayerLogout', clearPrinterPoints)

-- (a resource restart while players are already in the world)
CreateThread(function()
    Wait(3000)
    refreshPrinters()
end)

AddEventHandler('onResourceStop', function(res)
    if res == cache.resource then clearPrinterPoints() end
end)
