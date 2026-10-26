local QBCore

Bridge.registerFramework('qb', {
    resources = { 'qb-core' },

    init = function(resource)
        QBCore = exports[resource]:GetCoreObject()
    end,

    ---@param src number
    ---@return { citizenid: string, name: string }|nil
    identity = function(src)
        local player = QBCore.Functions.GetPlayer(src)
        if not player then return nil end
        local ci = player.PlayerData.charinfo or {}
        return {
            citizenid = player.PlayerData.citizenid,
            name = ('%s %s'):format(ci.firstname or 'Unknown', ci.lastname or ''):match('^%s*(.-)%s*$'),
        }
    end,

    player = function(src) return QBCore.Functions.GetPlayer(src) end,

    registerUsable = function(itemName, handler)
        QBCore.Functions.CreateUseableItem(itemName, handler)
    end,
})
