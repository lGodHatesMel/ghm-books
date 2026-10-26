--[[
    Bridge: lets ghm-books run on different frameworks and inventories.

    A framework adapter answers one question: who is this player? (citizen id + character name).
    An inventory adapter answers: what does this player hold, can they carry a book, add/remove items,
    update item metadata, and (for inventories without ox-style client exports) call us when an item is used.

    Adapters live in server/bridge/framework and server/bridge/inventory and register themselves into
    Bridge.frameworks / Bridge.inventories. Selection is automatic unless Config.Framework / Config.Inventory
    name one. To add support for another resource, copy an adapter and fill in the same functions.

    Normalised inventory slot: { slot = number|string, name = string, count = number, metadata = table }
]]

Bridge = {
    frameworks = {},
    inventories = {},
    ---@type table|nil selected framework adapter
    fw = nil,
    ---@type table|nil selected inventory adapter
    inv = nil,
    ready = false,
}

local FRAMEWORK_ORDER <const> = { 'qbx', 'qb', 'esx' }
-- one_inventory provides the ox_inventory resource name, so it has to be checked first.
local INVENTORY_ORDER <const> = { 'one', 'ox', 'tgiann', 'jaksam', 'qs', 'origen', 'qb', 'codem' }

---Normalises one inventory row. Slot ids stay strings on inventories that use them (jaksam's "SLOT-n").
---@param slot any
---@param name any
---@param count any
---@param metadata any
---@return table|nil
function Bridge.slotEntry(slot, name, count, metadata)
    slot = tonumber(slot) or slot
    if slot == nil or type(name) ~= 'string' then return nil end
    return { slot = slot, name = name, count = tonumber(count) or 1, metadata = type(metadata) == 'table' and metadata or {} }
end

---Calls an export without letting a missing function or a bad signature break the caller.
---@param resource string
---@param fn string
---@return any result nil on error
function Bridge.call(resource, fn, ...)
    local ok, result = pcall(function(...) return exports[resource][fn](exports[resource], ...) end, ...)
    if ok then return result end
end

---Collects the rows of an items table (slot-keyed or list) that hold `name`, as normalised entries.
---@param items table|nil
---@param name string
---@return table[]
function Bridge.scan(items, name)
    local out = {}
    if type(items) ~= 'table' then return out end
    for key, row in pairs(items) do
        if type(row) == 'table' and row.name == name then
            local entry = Bridge.slotEntry(row.slot or key, row.name, row.amount or row.count, row.info or row.metadata)
            if entry then out[#out + 1] = entry end
        end
    end
    return out
end

---Sums the counts of a list of entries.
---@param entries table[]
---@return number
function Bridge.total(entries)
    local total = 0
    for _, e in ipairs(entries) do total = total + e.count end
    return total
end

---Coerces a client-supplied slot id: numeric where possible, non-empty strings passed through.
---@param slot any
---@return number|string|nil
function Bridge.coerceSlot(slot)
    return tonumber(slot) or (type(slot) == 'string' and slot ~= '' and slot or nil)
end

---@param name string
---@param adapter table
function Bridge.registerFramework(name, adapter)
    Bridge.frameworks[name] = adapter
end

---@param name string
---@param adapter table
function Bridge.registerInventory(name, adapter)
    Bridge.inventories[name] = adapter
end

---@param adapter table
---@return boolean
local function running(adapter)
    for _, resource in ipairs(adapter.resources) do
        if GetResourceState(resource) == 'started' then
            adapter.resource = resource
            return true
        end
    end
    return false
end

---@param registry table<string, table>
---@param order string[]
---@param configured string
---@return string|nil name
local function pick(registry, order, configured)
    if configured ~= 'auto' then
        local adapter = registry[configured]
        return adapter and running(adapter) and configured or nil
    end
    for _, name in ipairs(order) do
        if registry[name] and running(registry[name]) then return name end
    end
end

---Blocks until the bridge has chosen adapters (or gave up). Safe to call from any callback.
function Bridge.waitReady()
    while not Bridge.ready do Wait(50) end
end

---Called by the selected inventory's use hook (non-ox inventories) to open the right screen on the client.
---@param kind 'blank'|'book'
local function onUse(kind)
    return function(src, slot, metadata)
        TriggerClientEvent('ghm-books:client:use', src, kind, slot, metadata or {})
    end
end

CreateThread(function()
    -- Dependencies may still be starting when this resource loads; give them time.
    local deadline = GetGameTimer() + 30000
    local fwName, invName
    repeat
        fwName = fwName or pick(Bridge.frameworks, FRAMEWORK_ORDER, Config.Framework)
        invName = invName or pick(Bridge.inventories, INVENTORY_ORDER, Config.Inventory)
        if fwName and invName then break end
        Wait(500)
    until GetGameTimer() > deadline

    if not fwName then
        print(('^1[ghm-books] No supported framework found (Config.Framework = "%s"). Books will not work.^7'):format(Config.Framework))
    end
    if not invName then
        print(('^1[ghm-books] No supported inventory found (Config.Inventory = "%s"). Books will not work.^7'):format(Config.Inventory))
    end
    if not (fwName and invName) then
        Bridge.ready = true
        return
    end

    Bridge.fw = Bridge.frameworks[fwName]
    Bridge.inv = Bridge.inventories[invName]
    if Bridge.fw.init then Bridge.fw.init(Bridge.fw.resource) end
    if Bridge.inv.init then Bridge.inv.init(Bridge.inv.resource) end

    -- Inventories that cannot call a client export on use (everything except ox_inventory) call us instead.
    -- Most read the framework's usable-item registry; the rest provide their own hook.
    local register = Bridge.inv.registerUsable
    if not register and not Bridge.inv.clientUse then register = Bridge.fw.registerUsable end
    if register then
        local function hook(kind)
            local handler = onUse(kind)
            -- qb/qbx hand over the item table, ESX hands over the item name plus a data table.
            return function(src, item, data)
                local row = type(item) == 'table' and item or {}
                local extra = type(data) == 'table' and data or {}
                handler(src, row.slot or extra.slot, row.info or row.metadata or extra.metadata or extra.info)
            end
        end
        register(Config.BlankItem, hook('blank'))
        register(Config.BookItem, hook('book'))
    end

    print(('^2[ghm-books] framework: %s (%s), inventory: %s (%s)^7'):format(fwName, Bridge.fw.resource, invName, Bridge.inv.resource))
    Bridge.ready = true
end)
