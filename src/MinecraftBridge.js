var Bridge = require("matrix-appservice-bridge").Bridge;
var DataStore = require("./DataStore");
var log = require("npmlog");
var UuidCache = require("./UuidCache");
var util = require("./utils");

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
                //onAliasQuery: this.onAliasQuery.bind(this),
                //onAliasQuried: this.onAliasQueried.bind(this),
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

            var botIntent = this._bridge.getIntent(this._appServiceUserId);

            var avatarUrl = global.localStorage.getItem("avatar_url");
            if(!avatarUrl || avatarUrl !== desiredAvatarUrl){
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
        });
    }

    _requestHandler(request, promise) {
        return promise.then(res => {
            request.resolve(res);
            return res;
        }, err => {
            request.reject(err);
            throw err;
        });
    }

    onEvent(request, context) {
        return this._requestHandler(request, this._onEvent(request, context));
    }

    _onEvent(request, context) {
        //console.log(request);
        var event = request.getData();

        if (event.type === "m.room.message") {
            // TODO: Process message event
        } else if (event.type === "m.room.member") {
            //console.log(event.content);
        }

        // Default
        return new Promise((resolve, reject) => resolve());
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

    onAliasQuery(alias, aliasLocalpart) {
        // TODO: Implement
    }

    onLog(line, isError) {
        var fn = log.info;
        if (isError) fn = log.error;

        fn("MinecraftBridge - onLog", line);
    }
}

module.exports = MinecraftBridge;