var Bridge = require("matrix-appservice-bridge").Bridge;
var DataStore = require("./DataStore");
var log = require("npmlog");
var UuidCache = require("./UuidCache");
var util = require("./utils");
var _ = require('lodash');
var MinecraftServer = require("./MinecraftServer");

/**
 * The main entry point for the application - bootstraps the bridge on both sides
 */
class MinecraftBridge {

    /**
     * Creates a new Minecraft Bridge
     * @param {Object} config the configuration file to use
     * @param {AppServiceRegistration} registration the app service registration file
     */
    constructor(config, registration) {
        this._config = config;
        this._registration = registration;
        this._domain = null; // string
        this._dataStore = null; // DataStore
        this._appServiceUserId = null; // string
        this._started = false;

        this._bridge = new Bridge({
            registration: this._registration,
            homeserverUrl: this._config.homeserver.url,
            domain: this._config.homeserver.domain,
            controller: {
                onEvent: this.onEvent.bind(this),
                onUserQuery: this.onUserQuery.bind(this),
                onAliasQuery: this.onAliasQuery.bind(this),
                onLog: this.onLog.bind(this)

                // TODO: thirdPartyLookup support?
            },
            roomStore: "rooms.db",
            userStore: "users.db",
            disableContext: true,
            suppressEcho: true,
            queue: {
                type: "none",
                perRequest: false
            },
            intentOptions: {
                clients: {
                    dontCheckPowerLevel: true
                },
                bot: {
                    dontCheckPowerLevel: true
                }
            }
        });

        this._adminRooms = {}; // { userId: [roomIds] }
    }

    /**
     * Gets an Intent for the bot user
     * @returns {Intent}
     * @private
     */
    _getIntent() {
        return this._bridge.getIntent(this._appServiceUserId);
    }

    /**
     * Gets all of the admin rooms for the user ID
     * @param {String} userId the user ID to lookup
     * @returns {Array<string>} the admin rooms for the user, may be empty but never null
     * @private
     */
    _getAdminRooms(userId) {
        var rooms = this._adminRooms[userId];
        if (!rooms)return [];
        return rooms;
    }

    /**
     * Adds a new admin room for the user ID
     * @param {String} userId the user ID to add the room under
     * @param {String} roomId the room ID for the user
     * @private
     */
    _addAdminRoom(userId, roomId) {
        var currentRooms = this._getAdminRooms(userId);
        if (currentRooms.indexOf(roomId) !== -1) return; // no-op: already added room

        currentRooms.push(roomId);
        this._adminRooms[userId] = currentRooms;

        log.info("MinecraftBridge", "User '" + userId + "' now has " + currentRooms.length + " admin rooms");
    }

    /**
     * Gets all applicable admin rooms for a user. This will create a room if no rooms are associated
     * with the user id
     * @param {String} userId the user ID to lookup
     * @returns {Promise<Array<string>>} resolves to the admin room IDs for the user
     * @private
     */
    _getOrCreateAdminRoom(userId) {
        var currentRooms = this._getAdminRooms(userId);
        if (currentRooms.length > 0) return new Promise((resolve, reject) => resolve(currentRooms));

        return this._getIntent().createRoom({
            createAsClient: true,
            options: {
                name: "Minecraft Bridge",
                topic: "Shows status about your connection to Miencraft servers. Type !help for help.",
                invite: [userId],
                preset: "trusted_private_chat"
            }
        }).then(response => {
            this._addAdminRoom(userId, response.room_id);
            return this._getAdminRooms(userId);
        });
    }

    run(port) {
        return this._bridge.loadDatabases().then(() => {
            this._dataStore = new DataStore(this._bridge.getUserStore(), this._bridge.getRoomStore());
            return this._bridge.run(port, this._config);
        }).then(() => {
            if (!this._registration.getSenderLocalpart() || !this._registration.getAppServiceToken())
                throw new Error("FATAL: Registration file is missing sender_localpart and/or AS token");

            this._domain = this._config.homeserver.domain;
            this._appServiceUserId = "@" + this._registration.getSenderLocalpart() + ":" + this._domain;

            log.info("MinecraftBridge", "Started up!");
            this._started = true;

            // Check to see if we need an updated profile or not (avatar, display name)
            var desiredDisplayName = this._config.mcBridge.appearance.displayName || "Minecraft Bridge";
            var desiredAvatarUrl = this._config.mcBridge.appearance.avatarUrl || "http://i.imgur.com/ELbV0Af.png"; // grass block default

            var botIntent = this._getIntent();

            var avatarUrl = global.localStorage.getItem("avatar_url");
            if (!avatarUrl || avatarUrl !== desiredAvatarUrl) {
                util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, botIntent).then(mxcUrl=> {
                    log.info("MinecraftBridge", "Avatar MXC URL = " + mxcUrl);
                    botIntent.setAvatarUrl(mxcUrl);
                    global.localStorage.setItem("avatar_url", desiredAvatarUrl);
                });
            }
            botIntent.getProfileInfo(this._appServiceUserId, 'displayname').then(profile=> {
                if (profile.displayname != desiredDisplayName) {
                    log.info("MinecraftBridge", "Updating display name from '" + profile.displayname + "' to '" + desiredDisplayName + "'");
                    botIntent.setDisplayName(desiredDisplayName);
                }
            });

            // Process invites for any rooms we got while offline
            // TODO

            // Read in all the admin rooms we know about (and sync membership lists)
            this._bridge.getBot().getJoinedRooms().then(rooms => {
                for (var roomId of rooms) {
                    this._processRoom(roomId);
                }
            });
        });
    }

    /**
     * Processes a room from the startup routine to correctly bind it to the correct source
     * @param {String} roomId the room ID
     * @private
     */
    _processRoom(roomId) {
        this._bridge.getBot().getJoinedMembers(roomId).then(roomMembers => {
            var roomMemberIds = _.keys(roomMembers);
            if (roomMemberIds.length == 1) {
                log.info("MinecraftBridge", "Leaving room '" + roomId + "': No more members. Not bridging room");
                // TODO: Also delete from store (if required)
                this._getIntent().leave(roomId);
            } else {
                // There's more than 1 member - we probably need to bridge this room
                this._dataStore.getServersForRoom(roomId).then(servers=> {
                    // TODO: Remove dangerous hack and figure out why servers is empty
                    if (roomId == "!FjHRlFicGIXDQfZpQU:dev.t2bot.io")
                        servers.push(new MinecraftServer("mc.hypixel.net", 25565));
                    for (var server of servers) {
                        this._bridgeRoom(roomId, server);
                    }

                    if (servers.length == 0) {
                        if (roomMemberIds.length != 2) {
                            log.warn("MinecraftBridge - _processRoom", "Room " + roomId + " does not appear to map to any rooms");
                        } else {
                            var ownIdx = roomMemberIds.indexOf(this._appServiceUserId);
                            var otherUserId = roomMemberIds[ownIdx == 1 ? 0 : 1]; // If we're index 1, then the user is the 0 index
                            this._addAdminRoom(otherUserId, roomId);
                        }
                    }
                });
            }
        });
    }

    /**
     * Bridge a room to a Minecraft server
     * @param {String} roomId the room ID to bind
     * @param {MinecraftServer} mcServer the server to bind to
     * @private
     */
    _bridgeRoom(roomId, mcServer) {
        log.info("MinecraftBridge - _bridgeRoom", "Starting bridge to " + mcServer.getHostname() + ":" + mcServer.getPort() + " to room " + roomId);
        this._updateRoomAspects(roomId, mcServer); // don't care about return value - we're just going to try and update the room state

        // TODO: Actually bridge room
    }

    /**
     * Updates components of the room to be more in line with the current Minecraft server's status, such as the room's
     * avatar.
     * @param {String} roomId the room ID to update to
     * @param {MinecraftServer} mcServer the server to update from
     * @returns {Promise<*>} resolves when the update has completed
     * @private
     */
    _updateRoomAspects(roomId, mcServer){
        return mcServer.ping().then(pingInfo => {
            var item = JSON.parse(localStorage.getItem("server." + mcServer.getHostname() + "." + mcServer.getPort()) || "{}");
            if (item.motd != pingInfo.motd || item.favicon_b64 != pingInfo.favicon_b64) {
                this._getIntent().setRoomTopic(roomId, pingInfo.motd); // TODO: Should probably strip color codes and newlines from this to make it legible
                util.uploadContentFromDataUri(this._bridge, this._appServiceUserId, pingInfo.favicon_b64, "server-icon.png").then(mxcUrl => {
                    this._getIntent().setRoomAvatar(roomId, mxcUrl, '');
                });
                localStorage.setItem("server." + mcServer.getHostname() + "." + mcServer.getPort(), JSON.stringify(pingInfo));
            }
        });
    }

    _requestHandler(request, promise) {
        return promise.then(res => {
            request.resolve(res);
            return res;
        }, err => {
            request.reject(err);
            log.error("MinecraftBridge", err);
            throw err;
        });
    }

    onEvent(request, context) {
        return this._requestHandler(request, this._onEvent(request, context));
    }

    _onEvent(request, context) {
        var event = request.getData();
        //console.log(event);

        if (event.type === "m.room.message") {
            // TODO: Process message event
        } else if (event.type === "m.room.member") {
            if (event.state_key == this._appServiceUserId) {
                if (event.content.membership === "invite") {
                    log.info("MinecraftBridge", "Received invite to " + event.room_id);
                    this._getIntent().join(event.room_id).then(() => {
                        this._processRoom(event.room_id);
                    });
                }
            }
        }

        // Default
        return new Promise((resolve, reject) => resolve());
    }

    onAliasQuery(request, alias) {
        return this._requestHandler(request, this._onAliasQuery(request, alias));
    }

    _onAliasQuery(request, alias) {
        // Format: #_minecraft_serverinfo:domain.com
        // Example: #_minecraft_localhost:t2bot.io
        // Example: #_minecraft_localhost_25566:t2bot.io

        // Alias comes in as "_minecraft_localhost_25566" (no # or :homeserver.com)

        if (typeof(alias) !== 'string') return null;

        var parts = alias.split("_");
        if (parts.length < 2) throw new Error("Invalid alias (too short): " + alias);
        if (parts[0] != '' || parts[1] != "minecraft") throw new Error("Invalid alias (wrong format): " + alias);

        var serverName = "";
        var portStr = "";
        for (var i = 0; i < (parts.length - 2); i++) {
            if (i != 0 && i == (parts.length - 3))
                portStr = parts[i + 2];
            else serverName += parts[i + 2] + "_";
        }
        serverName = serverName.substring(0, serverName.length - 1); // trim off the last underscore
        if (portStr == "") portStr = "25565"; // use default port if none given

        // Theory says that we should now have a server name and a possible port. Let's validate that information
        if (portStr !== parseInt(portStr).toString()) throw new Error("Invalid alias (invalid port): " + alias);
        if (serverName.length == 0) throw new Error("Invalid alias (invalid domain): " + alias);

        var server = new MinecraftServer(serverName.toLowerCase(), parseInt(portStr));

        // we ping to make sure the server is online
        return server.ping().then(pingInfo => {
            return this._getIntent().createRoom({
                createAsClient: true,
                options: {
                    room_alias_name: alias.split(":")[0], // localpart
                    name: "[Minecraft] " + server.friendlyName(),
                    preset: "public_chat",
                    visibility: "public"
                    // avatar and topic set when we bridge to the room
                }
            });
        }).then(roomInfo => {
            return this._dataStore.storeRoom(new MatrixRoom(roomInfo.room_id), server, "alias").then(db=> roomInfo);
        }).then(roomInfo => {
            this._bridgeRoom(roomInfo.room_id, server);
            return roomInfo;
        });
    }

    onUserQuery(matrixUser) {
        var userId = matrixUser.getId();

        // Format: @minecraft_uuid_serverinfo:domain.com
        // Example: @minecraft_c465b154-3c29-4dbf-a7e3-e0869504b8d8_localhost_64423:t2bot.io
        // Example: @minecraft_c465b154-3c29-4dbf-a7e3-e0869504b8d8_localhost:t2bot.io

        var uuid = userId.substring(11, 47); // take only the uuid (take off `@minecraft_` and the server info)

        return new Promise((resolve, reject) => {
            UuidCache.lookupFromUuid(uuid).then(profile => {
                return util.uploadContentFromUrl(this._bridge, 'https://crafatar.com/renders/head/' + uuid, uuid).then(mxcUrl => {
                    return {
                        name: profile.displayName + ' (Minecraft)',
                        url: mxcUrl,
                        remote: new RemoteUser(userId)
                    };
                }, error=> {
                    reject(error);
                })
            }, error => {
                reject(error);
            });
        });
    }

    onLog(line, isError) {
        var fn = log.info;
        if (isError) fn = log.error;

        fn("MinecraftBridge - onLog", line);
    }
}

module.exports = MinecraftBridge;