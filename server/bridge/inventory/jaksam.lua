--[[
    jaksam_inventory. Slot ids are strings ("SLOT-n"). Item use goes through the framework's usable-item
    registry.
]]

local R = 'jaksam_inventory'
local entry = Bridge.slotEntry

Bridge.registerInventory('jaksam', {
    resources = { R },

    getItems = function(src, itemName)
        local out = {}
        for _, item in pairs(Bridge.call(R, 'getItemsByName', src, itemName) or {}) do
            if type(item) == 'table' then
                out[#out + 1] = entry(item.slot, item.name or itemName, item.amount or item.count, item.metadata or item.info)
            end
        end
        return out
    end,

    getSlot = function(src, slot)
        local item = Bridge.call(R, 'getItemFromSlot', src, slot)
        return type(item) == 'table' and entry(slot, item.name, item.amount or item.count, item.metadata) or nil
    end,

    count = function(src, itemName) return Bridge.call(R, 'getTotalItemAmount', src, itemName) or 0 end,
    canCarry = function(src, itemName, count) return Bridge.call(R, 'canCarryItem', src, itemName, count) and true or false end,
    remove = function(src, itemName, count, slot) return Bridge.call(R, 'removeItem', src, itemName, count, nil, slot) and true or false end,
    add = function(src, itemName, count, metadata) return Bridge.call(R, 'addItem', src, itemName, count, metadata) and true or false end,
    setMetadata = function(src, slot, metadata) return Bridge.call(R, 'setItemMetadataInSlot', src, slot, metadata) ~= false end,
})
