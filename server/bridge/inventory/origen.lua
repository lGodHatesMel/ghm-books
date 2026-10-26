--[[
    origen_inventory. Has its own usable-item hook. The player snapshot's envelope shape varies between builds,
    so the item scan accepts {inventory = {...}}, {items = {...}} and flat tables.
]]

local R = 'origen_inventory'
local entry = Bridge.slotEntry

Bridge.registerInventory('origen', {
    resources = { R },

    getItems = function(src, itemName)
        local snapshot = Bridge.call(R, 'GetPlayerInventory', src)
        if type(snapshot) ~= 'table' then return {} end
        return Bridge.scan(snapshot.inventory or snapshot.items or snapshot, itemName)
    end,

    getSlot = function(src, slot)
        local item = Bridge.call(R, 'getSlot', src, slot) or Bridge.call(R, 'GetItemBySlot', src, slot)
        return type(item) == 'table' and entry(item.slot or slot, item.name, item.amount or item.count, item.info or item.metadata) or nil
    end,

    count = function(src, itemName) return Bridge.call(R, 'getItemCount', src, itemName, false, false) or 0 end,
    canCarry = function(src, itemName, count) return Bridge.call(R, 'canCarryItem', src, itemName, count) and true or false end,
    remove = function(src, itemName, count, slot) return Bridge.call(R, 'removeItem', src, itemName, count, slot) and true or false end,
    add = function(src, itemName, count, metadata) return Bridge.call(R, 'addItem', src, itemName, count, metadata) and true or false end,
    setMetadata = function(src, slot, metadata) return Bridge.call(R, 'setMetadata', src, slot, metadata) ~= false end,

    registerUsable = function(itemName, handler) exports[R]:CreateUseableItem(itemName, handler) end,
})
