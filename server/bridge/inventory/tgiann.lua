--[[
    tgiann-inventory. A qb-inventory drop-in: metadata is `info`. Item use goes through the framework's
    usable-item registry.
]]

local R = 'tgiann-inventory'
local entry = Bridge.slotEntry

local function row(item, slot)
    return type(item) == 'table' and entry(item.slot or slot, item.name, item.amount or item.count, item.info or item.metadata) or nil
end

Bridge.registerInventory('tgiann', {
    resources = { R },

    getItems = function(src, itemName)
        local out = {}
        for _, item in pairs(Bridge.call(R, 'GetItemsByName', src, itemName) or {}) do
            out[#out + 1] = entry(item.slot, item.name or itemName, item.amount or item.count, item.info or item.metadata)
        end
        return out
    end,

    getSlot = function(src, slot) return row(Bridge.call(R, 'GetItemBySlot', src, slot), slot) end,
    count = function(src, itemName) return Bridge.call(R, 'GetItemCount', src, itemName) or 0 end,
    canCarry = function(src, itemName, count) return Bridge.call(R, 'CanCarryItem', src, itemName, count) and true or false end,
    remove = function(src, itemName, count, slot) return Bridge.call(R, 'RemoveItem', src, itemName, count, slot) and true or false end,
    add = function(src, itemName, count, metadata) return Bridge.call(R, 'AddItem', src, itemName, count, metadata) and true or false end,

    setMetadata = function(src, slot, metadata)
        local item = Bridge.call(R, 'GetItemBySlot', src, slot)
        if type(item) ~= 'table' or not item.name then return false end
        return pcall(function() exports[R]:UpdateItemMetadata(src, item.name, slot, metadata) end)
    end,
})
