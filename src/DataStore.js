var log = require("npmlog");

/**
 * Abstracts some data storage actions away from the implementation
 */
class DataStore {

    /**
     * Creates a new DataStore
     * @param {UserBridgeStore} userStore the user database
     * @param {RoomBridgeStore} roomStore the room database
     */
    constructor(userStore, roomStore) {
        this._roomStore = roomStore;
        this._userStore = userStore;

        var logErr = function (field) {
            return function (err) {
                if (err) {
                    log.error("DataStore", "Failed to ensure '" + field + "' index on store: " + err);
                }
                log.info("DataStore", "Index '" + field + "' for store");
            };
        };

        this._roomStore.db.ensureIndex({
            fieldName: "id",
            unique: true,
            sparse: false
        }, logErr("roomStore.id"));
        this._roomStore.db.ensureIndex({
            fieldName: "matrix_id",
            unique: false,
            sparse: true
        }, logErr("roomStore.matrix_id"));
        this._roomStore.db.ensureIndex({
            fieldName: "mc_server",
            unique: false,
            sparse: true
        }, logErr("roomStore.mc_server"));

        this._userStore.db.ensureIndex({
            fieldName: "data.localpart",
            unique: false,
            sparse: true
        }, logErr("userStore.localpart"));
        this._userStore.db.ensureIndex({
            fieldName: "id",
            unique: true,
            sparse: false
        }, logErr("userStore.id"));
    }

    /**
     * Creates a room mapping ID for a Matrix room and a Minecraft Server
     * @param {string} roomId the Matrix room ID
     * @param {MinecraftServer} mcServer the minecraft server
     * @private
     * @return {string} The mapping ID
     */
    _getRoomMappingId(roomId, mcServer) {
        // Spaces aren't allowed in any of the IDs, so use that to delimit the parts
        return roomId + " " + mcServer.getHostname() + " " + mcServer.getPort();
    }

    /**
     * Persists a Minecraft <--> Matrix room mapping in the database
     * @param {MatrixRoom} mtxRoom the matrix room
     * @param {MinecraftServer} mcServer the Minecraft server information
     * @param {string} origin the origin of the mapping (provision, alias, or join)
     * @return {Promise}
     */
    storeRoom(mtxRoom, mcServer, origin) {
        if (typeof origin !== 'string') {
            throw new Error('Origin must be a string = "provision"|"alias"|"join"');
        }

        var mappingId = this._getRoomMappingId(mtxRoom.getId(), mcServer);
        return this._roomStore.linkRooms(mtxRoom, mcServer, {
            origin: origin
        }, mappingId);
    }

    /**
     * Gets a Minecraft <--> Matrix room mapping from the database
     * @param {string} roomId the Matrix room ID
     * @param {MinecraftServer} mcServer the Minecraft server container information
     * @param {string} origin the optional origin for the mapping (provision, alias, join, or undefined)
     * @return {Promise} A promise that resolves to a room entry, or null if none found
     */
    getRoom(roomId, mcServer, origin) {
        if (typeof origin !== 'undefined' && typeof origin !== 'string') {
            throw new Error('Origin must be undefined or a string = "provision"|"alias"|"join"');
        }

        var mappingId = this._getRoomMappingId(roomId, mcServer);
        return this._roomStore.getEntryById(mappingId).then((entry) => {
            if (origin && entry && origin !== entry.data.origin) {
                return null;
            }

            return entry;
        });
    }

    /**
     * Removes a Minecraft <--> Matrix room mapping from the database
     * @param {string} roomId the Matrix room ID
     * @param {MinecraftServer} mcServer the Minecraft server container information
     * @param {string} origin the origin for the mapping ( provision, alias, or join)
     * @return {Promise}
     */
    removeRoom(roomId, mcServer, origin) {
        if (typeof origin !== 'undefined' && typeof origin !== 'string') {
            throw new Error('Origin must be undefined or a string = "provision"|"alias"|"join"');
        }

        return this._roomStore.delete({
            id: this._getRoomMappingId(roomId, mcServer),
            'data.origin': origin
        });
    }
}

module.exports = DataStore;