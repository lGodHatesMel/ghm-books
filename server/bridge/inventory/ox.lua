-- ox_inventory runs item use on the client through the `client.export` in items.lua
-- (see install/ox_inventory_items.lua), so it sets `clientUse` and has no server hook.

local entry = Bridge.slotEntry

Bridge.registerInventory('ox', {
    resources = { 'ox_inventory' },
    clientUse = true,

    getItems = function(src, itemName)
        local out = {}
        for _, s in pairs(exports.ox_inventory:Search(src, 'slots', itemName) or {}) do
            out[#out + 1] = entry(s.slot, s.name or itemName, s.count, s.metadata)
        end
        return out
    end,

    getSlot = function(src, slot)
        local s = exports.ox_inventory:GetSlot(src, slot)
        return s and entry(s.slot or slot, s.name, s.count, s.metadata) or nil
    end,

    count = function(src, itemName)
        return exports.ox_inventory:GetItem(src, itemName, nil, true) or 0
    end,

    canCarry = function(src, itemName, count)
        return exports.ox_inventory:CanCarryItem(src, itemName, count) and true or false
    end,

    remove = function(src, itemName, count, slot)
        return exports.ox_inventory:RemoveItem(src, itemName, count, nil, slot) and true or false
    end,

    add = function(src, itemName, count, metadata)
        return exports.ox_inventory:AddItem(src, itemName, count, metadata) and true or false
    end,

    setMetadata = function(src, slot, metadata)
        return pcall(function() exports.ox_inventory:SetMetadata(src, slot, metadata) end)
    end,
})
