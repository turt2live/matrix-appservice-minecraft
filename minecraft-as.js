var yaml = require("js-yaml");
var fs = require("fs");
var log = require("npmlog");

var Cli = require("matrix-appservice-bridge").Cli;
var Bridge = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;
var ClientFactory = require("matrix-appservice-bridge").ClientFactory;

var bridge;

new Cli({
    registrationPath: "minecraft-registration.yaml",
    bridgeConfig: {
        schema: "config.yaml",
        defaults: {
            test: "ABC"
        }
    },
    generateRegistration: function(reg, callback) {
        reg.setId(AppServiceRegistration.generateToken());
        reg.setHomeserverToken(AppServiceRegistration.generateToken());
        reg.setAppServiceToken(AppServiceRegistration.generateToken());
        reg.setSenderLocalpart("minecraft");
        reg.addRegexPattern("users", "@minecraft_.*", true);
        reg.addRegexPattern("aliases", "#minecraft_.*", true);

        callback(reg);
    },
    run: function(port, config) {
        var rejObj = yaml.safeLoad(fs.readFileSync("minecraft-registration.yaml", "utf8"));
        regObj = AppServiceRegistration.fromObject(rejObj);
        if (regObj == null) {
            throw new Error("Failed to parse registration file");
        }

        var clientFactory = new ClientFactory({
            sdk: require("matrix-js-sdk"),
            url: config.bridge.homeserverUrl,
            token: rejObj.as_token,
            appServiceUserId: "@" + rejObj.sender_localpart+":"+config.bridge.domain
        });

        bridge = new Bridge({
            homeserverUrl: config.bridge.homeserverUrl,
            domain: config.bridge.domain,
            registration: rejObj,
            controller: {
                onUserQuery: onUserQuery,
                onEvent: onEvent,
                onAliasQuery: onAliasQuery,
                onAliasQueried: onAliasQueried,
                onLog: function(line, isError){
                    if(!isError)return;
                    if(line.indexOf("M_USER_IN_USE") !== -1) return; // quiet
                    log.error("matrix-appservice-bridge", line);
                }
            },
            clientFactory: clientFactory
        });
        log.info("AppServ", "Matrix portion listening on port %s", port);

        // TODO: Setup minecraft
    }
}).run();

function onUserQuery(queriedUser){
    // TODO: Pass to handler (try to create user)
}

function onEvent(request, context) {
    // TODO: Pass to handler (process generic event)
}

function onAliasQuery(alias, aliasLocalpart){
    // TODO: Pass to handler (create room)
}

function onAliasQueried(alias, roomId){
    // TODO: Pass to handler (room created)
}