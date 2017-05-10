var Bridge = require("matrix-appservice-bridge").Bridge;
var RemoteRoom = require("matrix-appservice-bridge").RemoteRoom;
var RemoteUser = require("matrix-appservice-bridge").RemoteUser;
var log = require("./util/LogService");
var UuidCache = require("./minecraft/UuidCache");
var util = require("./utils");
var _ = require('lodash');
var MinecraftServer = require("./minecraft/MinecraftServer");
var MinecraftBot = require("./minecraft/MinecraftBot");
var ProfileService = require("./minecraft/ProfileService");
var PubSub = require("pubsub-js");

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
        log.info("MinecraftBridge", "Constructing bridge");
        this._config = config;
        this._registration = registration;
        this._roomsToBots = {}; // {roomId: [bot]}
        this._retryRooms = []; // room IDs that failed to bridge

        this._bridge = new Bridge({
            registration: this._registration,
            homeserverUrl: this._config.homeserver.url,
            domain: this._config.homeserver.domain,
            controller: {
                onEvent: this._onEvent.bind(this),
                onUserQuery: this._onUserQuery.bind(this),
                onAliasQuery: this._onAliasQuery.bind(this),
                onAliasQueried: this._onAliasQueried.bind(this),
                onLog: (line, isError) => {
                    var method = isError ? log.error : log.verbose;
                    method("matrix-appservice-bridge", line);
                }

                // TODO: thirdPartyLookup support?
            },
            suppressEcho: false,
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

        PubSub.subscribe('profileUpdate', this._onProfileUpdate.bind(this));

        setTimeout(this._retryBridging.bind(this), 60 * 1000); // once a minute
    }

    run(port) {
        log.info("MinecraftBridge", "Starting bridge");
        return this._bridge.run(port, this._config)
            .then(() => this._updateBotProfile())
            .then(() => this._bridgeKnownRooms());
    }

    getBotIntent() {
        return this._bridge.getIntent(this._bridge.getBot().getUserId());
    }

    getMcUserIntent(uuid) {
        var intent = this._bridge.getIntentFromLocalpart("_minecraft_" + uuid);
        ProfileService.queueProfileCheck(uuid); // to make sure their profile is updated
        return intent;
    }

    _updateBotProfile() {
        log.info("MinecraftBridge", "Updating appearance of bridge bot");

        var desiredDisplayName = this._config.mcBridge.appearance.displayName || "Minecraft Bridge";
        var desiredAvatarUrl = this._config.mcBridge.appearance.avatarUrl || "http://i.imgur.com/ELbV0Af.png"; // grass block default

        var botIntent = this.getBotIntent();

        // TODO: Use datastore to save avatar because this doesn't work
        var botProfile = botIntent.getClient().getAccountData('io.t2l.minecraft.profile') || {};

        var avatarUrl = botProfile.avatarUrl;
        if (!avatarUrl || avatarUrl !== desiredAvatarUrl) {
            util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, botIntent).then(mxcUrl => {
                log.verbose("MinecraftBridge", "Avatar MXC URL = " + mxcUrl);
                log.info("MinecraftBridge", "Updating avatar for bridge bot");
                botIntent.setAvatarUrl(mxcUrl);
                botProfile.avatarUrl = desiredAvatarUrl;
                botIntent.getClient().setAccountData('io.t2l.minecraft.profile', botProfile);
            });
        }
        botIntent.getProfileInfo(botIntent.getClient().credentials.userId, 'displayname').then(profile => {
            if (profile.displayname != desiredDisplayName) {
                log.info("MinecraftBridge", "Updating display name from '" + profile.displayname + "' to '" + desiredDisplayName + "'");
                botIntent.setDisplayName(desiredDisplayName);
            }
        });
    }

    _onProfileUpdate(topic, changes) {
        var intent = this.getMcUserIntent(changes.uuid);
        if (changes.changed == 'displayName') {
            intent.setDisplayName(changes.profile.displayName + " (Minecraft)");
        } else if (changes.changed == 'avatar') {
            intent.getClient().uploadContent({
                rawResponse: false,
                stream: changes.newAvatar,
                name: changes.uuid,
                type: 'image/png' // assumed - probably a bad idea
            }).then(response => intent.setAvatarUrl(response.content_uri));
        } else log.warn("MinecraftBridge", "Unrecongized profile update: " + changes.changed);
    }

    _bridgeKnownRooms() {
        this._bridge.getBot().getJoinedRooms().then(rooms => {
            for (var roomId of rooms) {
                this._processRoom(roomId);
            }
        });
    }

    _processRoom(roomId) {
        log.info("MinecraftBridge", "Request to bridge room " + roomId);
        return this._bridge.getRoomStore().getLinkedRemoteRooms(roomId).then(remoteRooms => {
            if (remoteRooms.length == 0) {
                log.warn("MinecraftBridge", "No remote rooms for room " + roomId + ": Skipping bridge");
                return;
            }

            for (var room of remoteRooms) {
                var server = MinecraftServer.createServerFromRemote(room);
                this._processBot(server, roomId);
            }
        });
    }

    _processBot(server, roomId) {
        try {
            log.info("MinecraftBridge", "Bridging room " + roomId + " to " + server.fullName());
            var bot = new MinecraftBot(server, this, roomId);
            bot.start(this._config.mcBridge.mojangAccount.username, this._config.mcBridge.mojangAccount.password).then(() => {
                log.info("MinecraftBridge", "Bot connected OK to " + server.fullName() + " (bridged to room " + roomId + ")");

                if (!this._roomsToBots[roomId])
                    this._roomsToBots[roomId] = [];
                this._roomsToBots[roomId].push(bot);

                bot.on('disconnect', () => {
                    log.warn("MinecraftBridge", "Lost connection to server " + server.fullName() + " - queuing retry to room " + roomId);
                    this._retryRooms.push(roomId);
                });
            }, _ => {
                log.warn("MinecraftBridge", "Error bridging room " + roomId + " to " + server.fullName());
                log.warn("MinecraftBridge", "Queuing retry to room " + roomId);
                this._retryRooms.push(roomId);
            });
        } catch (e) {
            log.error("MinecraftBridge", "Error bridging room " + roomId + " to " + server.fullName());
            log.error("MinecraftBridge", e);
            log.warn("MinecraftBridge", "Queuing retry to room " + roomId);
            this._retryRooms.push(roomId);
        }
    }

    _retryBridging() {
        var rooms = [];
        while(this._retryRooms.length > 0){
            var roomId = this._retryRooms[0];
            if(rooms.indexOf(roomId) === -1)
                rooms.push(roomId);
            this._retryRooms.splice(0, 1);
        }

        this._retryRooms = [];

        log.info("MinecraftBridge", "Retrying bridge to " + rooms.length + " rooms");
        for (var roomId of rooms) {
            this._processRoom(roomId);
        }
    }

    _onEvent(request, context) {
        var event = request.getData();
        if (event.type === "m.room.member" && event.content.membership === "invite") {
            if (event.state_key == this._bridge.getBot().getUserId()) {
                // TODO: Determine if room should be an admin room or not
                log.info("MinecraftBridge", "Bridge received invite to room " + event.room_id);
                return this.getBotIntent().join(event.room_id);
            }
        } else if (event.type == "m.room.message") {
            // Ignore messages from the bridge
            if (event.sender.indexOf("@_minecraft_") === 0) return Promise.resolve();

            var bots = this._roomsToBots[event.room_id];
            if (!bots || bots.length <= 0) return Promise.resolve(); // early return: no bots

            return this.getBotIntent().getProfileInfo(event.sender, '').then(profile => {
                profile.user_id = event.sender;

                for (var bot of bots) {
                    // TODO: Process HTML colors and convert to minecraft
                    bot.sendMessage(profile, event.content.body); // only allow plaintext for now
                }
            });
        }

        // Default
        return Promise.resolve();
    }

    _onAliasQueried(alias, roomId) {
        return this._processRoom(roomId); // start the bridge to the room
    }

    _onAliasQuery(alias, aliasLocalpart) {
        log.info("MinecraftBridge", "Got request for alias #" + aliasLocalpart);

        if (aliasLocalpart.indexOf("_minecraft_") !== 0) throw new Error("Invalid alias (" + aliasLocalpart + "): Missing prefix");

        // The server name could contain underscores, but the port won't. We'll try to create a room based on
        // the last argument being a port, or a string if not a number.

        var parts = aliasLocalpart.substring("_minecraft_".length).split("_");
        var portStr = "";
        var serverName = "";

        for (var i = 0; i < parts.length; i++) {
            if (i != 0 && i == (parts.length - 1))
                portStr = parts[i];
            else serverName += parts[i] + "_";
        }

        serverName = serverName.substring(0, serverName.length - 1); // trim off last underscore
        if (portStr !== parseInt(portStr).toString()) {
            serverName += "_" + portStr;
            portStr = "25565";
        }

        var server = new MinecraftServer(serverName.toLowerCase(), parseInt(portStr));
        var remoteRoom = new RemoteRoom(aliasLocalpart);
        remoteRoom.set("minecraft_hostname", server.getHostname());
        remoteRoom.set("minecraft_port", server.getPort());

        return server.ping().then(pingInfo => {
            remoteRoom.set("minecraft_favicon_b64", pingInfo.favicon_b64);
            return util.uploadContentFromDataUri(this._bridge, this._bridge.getBot().getUserId(), pingInfo.favicon_b64, "server-icon.png");
        }).then(avatarMxc => {
            var userMap = {};
            userMap[this._bridge.getBot().getUserId()] = 100;
            return {
                remote: remoteRoom,
                creationOpts: {
                    room_alias_name: aliasLocalpart,
                    name: "[Minecraft] " + server.friendlyName(),
                    visibility: "public",
                    topic: "",
                    initial_state: [{
                        type: "m.room.join_rules",
                        content: {join_rule: "public"},
                        state_key: ""
                    }, {
                        type: "m.room.avatar",
                        content: {url: avatarMxc},
                        state_key: ""
                    }, {
                        type: "m.room.power_levels",
                        content: {
                            events_default: 0,
                            invite: 0, // anyone can invite
                            kick: 50,
                            ban: 50,
                            redact: 50,
                            state_default: 50,
                            events: {
                                "m.room.name": 100,
                                "m.room.avatar": 100,
                                "m.room.topic": 100,
                                "m.room.power_levels": 100,
                                "io.t2l.minecraft.server_info": 100
                            },
                            users_default: 0,
                            users: userMap
                        },
                        state_key: ""
                    }, {
                        // Add server_info for interested clients
                        type: "io.t2l.minecraft.server_info",
                        content: {hostname: server.getHostname(), port: server.getPort()},
                        state_key: ""
                    }]
                }
            };
        }).catch(err => {
            log.error("MinecraftBridge", "Failed to create room for alias #" + aliasLocalpart);
            log.error("MinecraftBridge", err);
        });
    }

    _onUserQuery(matrixUser) {
        // Avatar and name will eventually make it back to us from the profile service.
        var uuid = matrixUser.localpart.substring('_minecraft_'.length); // no dashes in uuid
        ProfileService.queueProfileCheck(uuid);
        return Promise.resolve({
            remote: new RemoteUser(matrixUser.localpart)
        });
    }
}

module.exports = MinecraftBridge;