--[[
    qb-inventory, ps-inventory and lj-inventory. Items are read from the framework player's `PlayerData.items`
    (metadata is `info`), which every qb-style inventory keeps authoritative. Adding, removing and the carry
    check go through the framework player object (`Player.Functions.*`), which qb-core routes to whichever
    inventory is installed; on Qbox, which has no such functions, the inventory's own exports are used.
    Item use goes through the framework's usable-item registry.

    Metadata updates: current qb-inventory has a slot-aware SetItemData; ps-inventory and lj-inventory do not, so
    their metadata is written to the player object instead.
]]

local resource
local entry = Bridge.slotEntry

---@param src number
---@return table|nil player
local function player(src) return Bridge.fw.player and Bridge.fw.player(src) or nil end

---@param src number
---@return table items
local function items(src)
    local p = player(src)
    local list = p and p.PlayerData and p.PlayerData.items
    return type(list) == 'table' and list or {}
end

Bridge.registerInventory('qb', {
    resources = { 'qb-inventory', 'ps-inventory', 'lj-inventory' },

    init = function(name) resource = name end,

    getItems = function(src, itemName) return Bridge.scan(items(src), itemName) end,

    getSlot = function(src, slot)
        local row = items(src)[slot]
        return type(row) == 'table' and entry(row.slot or slot, row.name, row.amount or row.count, row.info or row.metadata) or nil
    end,

    count = function(src, itemName) return Bridge.total(Bridge.scan(items(src), itemName)) end,

    canCarry = function(src, itemName, count)
        local p = player(src)
        if p and p.Functions and p.Functions.CanAddItem then return p.Functions.CanAddItem(itemName, count) and true or false end
        local result = Bridge.call(resource, 'CanAddItem', src, itemName, count)
        if result == nil then return true end
        return result and true or false
    end,

    remove = function(src, itemName, count, slot)
        local p = player(src)
        if p and p.Functions and p.Functions.RemoveItem then
            return p.Functions.RemoveItem(itemName, count, slot or false) ~= false
        end
        return Bridge.call(resource, 'RemoveItem', src, itemName, count, slot or false, 'ghm-books') and true or false
    end,

    add = function(src, itemName, count, metadata)
        local p = player(src)
        if p and p.Functions and p.Functions.AddItem then
            return p.Functions.AddItem(itemName, count, false, metadata) and true or false
        end
        return Bridge.call(resource, 'AddItem', src, itemName, count, false, metadata, 'ghm-books') and true or false
    end,

    setMetadata = function(src, slot, metadata)
        if resource == 'qb-inventory' then
            local row = items(src)[slot]
            if type(row) ~= 'table' or not row.name then return false end
            return pcall(function() exports[resource]:SetItemData(src, row.name, 'info', metadata, slot) end)
        end
        local p = player(src)
        local list = p and p.PlayerData and p.PlayerData.items
        local row = list and list[slot]
        if not row then return false end
        row.info = metadata
        return pcall(function()
            if p.Functions.SetInventory then p.Functions.SetInventory(list) else p.Functions.SetPlayerData('items', list) end
        end)
    end,
})
