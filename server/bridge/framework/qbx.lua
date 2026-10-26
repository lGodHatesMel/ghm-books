Bridge.registerFramework('qbx', {
    resources = { 'qbx_core' },

    ---@param src number
    ---@return { citizenid: string, name: string }|nil
    identity = function(src)
        local player = exports.qbx_core:GetPlayer(src)
        if not player then return nil end
        local ci = player.PlayerData.charinfo or {}
        return {
            citizenid = player.PlayerData.citizenid,
            name = ('%s %s'):format(ci.firstname or 'Unknown', ci.lastname or ''):match('^%s*(.-)%s*$'),
        }
    end,

    ---The framework's own player object (used by qb-style inventories).
    player = function(src) return exports.qbx_core:GetPlayer(src) end,

    registerUsable = function(itemName, handler)
        exports.qbx_core:CreateUseableItem(itemName, handler)
    end,
})
