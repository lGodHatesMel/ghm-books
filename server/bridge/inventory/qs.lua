--[[
    qs-inventory and qs-inventory-pro (Quasar). Item metadata lives in `info`. qs-inventory-pro has its own
    usable-item hook; plain qs-inventory reads the framework's usable-item registry.
]]

local resource
local entry = Bridge.slotEntry

local function call(fn, ...) return Bridge.call(resource, fn, ...) end

Bridge.registerInventory('qs', {
    resources = { 'qs-inventory-pro', 'qs-inventory' },

    init = function(name)
        resource = name
        -- Only the pro build exposes CreateUsableItem; the plain build falls back to the framework registry.
        if name == 'qs-inventory-pro' then
            Bridge.inventories.qs.registerUsable = function(itemName, handler) exports[resource]:CreateUsableItem(itemName, handler) end
        end
    end,

    getItems = function(src, itemName) return Bridge.scan(call('GetInventory', src), itemName) end,

    getSlot = function(src, slot)
        local items = call('GetInventory', src)
        local item = type(items) == 'table' and items[slot] or nil
        return type(item) == 'table' and entry(item.slot or slot, item.name, item.amount or item.count, item.info or item.metadata) or nil
    end,

    count = function(src, itemName) return call('GetItemTotalAmount', src, itemName) or 0 end,
    canCarry = function(src, itemName, count) return call('CanCarryItem', src, itemName, count) and true or false end,
    remove = function(src, itemName, count, slot) return call('RemoveItem', src, itemName, count, slot) and true or false end,
    add = function(src, itemName, count, metadata) return call('AddItem', src, itemName, count, nil, metadata) and true or false end,
    setMetadata = function(src, slot, metadata) return pcall(function() exports[resource]:SetItemMetadata(src, slot, metadata) end) end,
})
