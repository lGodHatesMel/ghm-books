--[[
    one_inventory (One Studios). It provides the ox_inventory resource name, so it is detected first.
    Item use goes through the framework's usable-item registry.
]]

local R = 'one_inventory'
local entry = Bridge.slotEntry

Bridge.registerInventory('one', {
    resources = { R },

    getItems = function(src, itemName)
        local out = {}
        for _, s in pairs(Bridge.call(R, 'SearchInventory', src, itemName) or {}) do
            out[#out + 1] = entry(s.slot, s.name or itemName, s.count, s.metadata)
        end
        return out
    end,

    getSlot = function(src, slot)
        local s = Bridge.call(R, 'GetSlot', src, slot)
        return type(s) == 'table' and entry(s.slot or slot, s.name, s.count, s.metadata) or nil
    end,

    count = function(src, itemName) return Bridge.call(R, 'GetItemCount', src, itemName) or 0 end,
    canCarry = function(src, itemName, count) return Bridge.call(R, 'CanCarryItem', src, itemName, count) and true or false end,
    remove = function(src, itemName, count, slot) return Bridge.call(R, 'RemoveItem', src, itemName, count, nil, slot) == true end,
    -- AddItem answers with a boolean plus a failure reason; keep only the boolean.
    add = function(src, itemName, count, metadata) return Bridge.call(R, 'AddItem', src, itemName, count, metadata) == true end,
    setMetadata = function(src, slot, metadata) return Bridge.call(R, 'SetItemMetadata', src, slot, metadata) ~= false end,
})
