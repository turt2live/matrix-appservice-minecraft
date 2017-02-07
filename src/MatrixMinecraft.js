var uuidCache = require('./UuidCache');
var util = require('./utils');
var RemoteUser = require('matrix-appservice-bridge').RemoteUser;

/**
 * The core of the bridge - binds Minecraft servers to rooms, creating the required components to be able to
 * perform the appropriate bridging actions (messages, emotes, etc).
 */
class MatrixMinecraft {

    constructor(bridge){
        this._bridge = bridge;
    }

    sendMessage(fromUser, roomId, messageContent) {
        // TODO: Implementation
    }

    useryQuery(userId) {
        // Format: @minecraft_uuid_serverinfo:domain.com
        // Example: @minecraft_c465b154-3c29-4dbf-a7e3-e0869504b8d8_localhost_64423:t2bot.io
        // Example: @minecraft_c465b154-3c29-4dbf-a7e3-e0869504b8d8_localhost:t2bot.io

        var uuid = userId.substring(11, 47); // take only the uuid (take off `@minecraft_` and the server info)

        return new Promise((resolve, reject) => {
            uuidCache.lookupFromUuid(uuid).then(profile => {
                return util.uploadContentFromUrl(this._bridge, 'https://crafatar.com/renders/head/' + uuid, uuid).then(mxcUrl => {
                    return {
                        name: profile.displayName + ' (Minecraft)',
                        url: mxcUrl,
                        remote: new RemoteUser(userId)
                    };
                }, error=>{
                    reject(error);
                })
            }, error => {
                reject(error);
            });
        });
    }

}

module.exports = MatrixMinecraft;
