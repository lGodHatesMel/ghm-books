local ESX

Bridge.registerFramework('esx', {
    resources = { 'es_extended' },

    init = function(resource)
        ESX = exports[resource]:getSharedObject()
    end,

    ---@param src number
    ---@return { citizenid: string, name: string }|nil
    identity = function(src)
        local xPlayer = ESX.GetPlayerFromId(src)
        if not xPlayer then return nil end
        local name = xPlayer.getName and xPlayer.getName()
        if not name or name == '' then
            name = ('%s %s'):format(xPlayer.get and xPlayer.get('firstName') or 'Unknown', xPlayer.get and xPlayer.get('lastName') or ''):match('^%s*(.-)%s*$')
        end
        -- ESX identifies a character by its identifier; it plays the role of the citizen id.
        return { citizenid = xPlayer.identifier, name = name }
    end,

    player = function(src) return ESX.GetPlayerFromId(src) end,

    registerUsable = function(itemName, handler)
        ESX.RegisterUsableItem(itemName, handler)
    end,
})
