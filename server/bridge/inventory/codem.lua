--[[
    codem-inventory. The full inventory getter wants the stored identifier, which is the framework identity's
    citizen id. Item use goes through the framework's usable-item registry.
]]

local R = 'codem-inventory'
local entry = Bridge.slotEntry

Bridge.registerInventory('codem', {
    resources = { R },

    getItems = function(src, itemName)
        local who = Bridge.fw.identity(src)
        if not who then return {} end
        return Bridge.scan(Bridge.call(R, 'GetInventory', who.citizenid, src), itemName)
    end,

    getSlot = function(src, slot)
        local item = Bridge.call(R, 'GetItemBySlot', src, slot)
        return type(item) == 'table' and entry(item.slot or slot, item.name, item.amount or item.count, item.info or item.metadata) or nil
    end,

    count = function(src, itemName) return Bridge.call(R, 'GetItemsTotalAmount', src, itemName) or 0 end,
    canCarry = function() return true end, -- codem has no carry check
    remove = function(src, itemName, count, slot) return Bridge.call(R, 'RemoveItem', src, itemName, count, slot) and true or false end,
    add = function(src, itemName, count, metadata) return Bridge.call(R, 'AddItem', src, itemName, count, metadata) and true or false end,
    setMetadata = function(src, slot, metadata) return pcall(function() exports[R]:SetItemMetadata(src, slot, metadata) end) end,
})
