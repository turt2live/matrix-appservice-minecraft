var yaml = require("js-yaml");
var fs = require("fs");
var log = require("npmlog");

const AppService = require("matrix-appservice-bridge");

var MatrixMinecraft = require('./src/MatrixMinecraft');

var bridge;
var mtxMc;

new AppService.Cli({
    registrationPath: "minecraft-registration.yaml",
    bridgeConfig: {
        schema: "config.yaml",
        defaults: {
            test: "ABC"
        }
    },
    generateRegistration: function (reg, callback) {
        reg.setId(AppService.AppServiceRegistration.generateToken());
        reg.setHomeserverToken(AppService.AppServiceRegistration.generateToken());
        reg.setAppServiceToken(AppService.AppServiceRegistration.generateToken());
        reg.setSenderLocalpart("_minecraft");
        reg.addRegexPattern("users", "@_minecraft_.*", true);
        reg.addRegexPattern("aliases", "#_minecraft_.*", true);

        callback(reg);
    },
    run: function (port, config) {
        var regObj = yaml.safeLoad(fs.readFileSync("minecraft-registration.yaml", "utf8"));
        regObj = AppService.AppServiceRegistration.fromObject(regObj);
        if (regObj == null) {
            throw new Error("Failed to parse registration file");
        }

        var clientFactory = new AppService.ClientFactory({
            sdk: require("matrix-js-sdk"),
            url: config.bridge.homeserverUrl,
            token: regObj.as_token,
            appServiceUserId: "@" + regObj.sender_localpart + ":" + config.bridge.domain
        });

        bridge = new AppService.Bridge({
            homeserverUrl: config.bridge.homeserverUrl,
            domain: config.bridge.domain,
            registration: regObj,
            controller: {
                onUserQuery: onUserQuery,
                onEvent: onEvent,
                onAliasQuery: onAliasQuery,
                onAliasQueried: onAliasQueried,
                onLog: function (line, isError) {
                    if (!isError)return;
                    if (line.indexOf("M_USER_IN_USE") !== -1) return; // quiet
                    log.error("matrix-appservice-bridge", line);
                }
            },
            clientFactory: clientFactory
        });
        log.info("AppServ", "Matrix portion listening on port %s", port);

        mtxMc = new MatrixMinecraft(bridge, config.minecraft);

        mtxMc.start().then(()=> {
            bridge.run(port, config);

            // Register the bot
            bridge.getClientFactory().getClientAs().register(regObj.sender_localpart).then(() => {
                log.info("Init", "Created user: " + regObj.sender_localpart);
            }).catch((err)=> {
                if (err.errcode !== 'M_USER_IN_USE') {
                    log.error("Init", "Failed to create bot user: " + regObj.sender_localpart + " (err: " + err.errcode + ")");
                }
            });

            return bridge.loadDatabases();
        }).then(() => {
            var roomStore = bridge.getRoomStore();
            // TODO: At this point it would be a good idea to load any 1:1 conversations and treat them as bridge status rooms
            return roomStore.getEntriesByMatrixRoomData({});
        }).then((entries) => {
            entries.forEach((entry)=> {
                // TODO: Rooms shouldn't be bound by room alias only - should be able to do something like the twitter bridge
                //       eg: send a message to a 1:1 with the bot: `room.bridge <room id> <server> [port]`
                mtxMc.bindRoom(entry.remote.roomId);
            });
        }).catch((err)=> {
            log.error("Init", "Failed to start appservice");
            log.error("Init", err);
        });
    }
}).run();

function onUserQuery(queriedUser) {
    return mtxMc.useryQuery(queriedUser);
}

function onEvent(request, context) {
    // TODO: Pass to handler (process generic event)
}

function onAliasQuery(alias, aliasLocalpart) {
    // TODO: Pass to handler (create room)
}

function onAliasQueried(alias, roomId) {
    // TODO: Pass to handler (room created)
}