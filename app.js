var Cli = require("matrix-appservice-bridge").Cli;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;
var log = require("npmlog");
var path = require("path");
var MinecraftBridge = require("./src/MinecraftBridge");

new Cli({
    registrationPath: "appservice-registration-minecraft.yaml",
    enableRegistration: true,
    enableLocalpart: true,
    bridgeConfig: {
        affectsRegistration: true,
        schema: path.join(__dirname, "src/config-schema.yml"),
        defaults: {
            homeserver: {
                url: "http://localhost:8008",
                mediaUrl: "http://localhost:8008",
                domain: "localhost"
            },
            mcBridge: {
                mojangAccount: {
                    username: "myemail@example.com",
                    password: "MySecretPassw0rd"
                }
            }
        }
    },
    generateRegistration: function (registration, callback) {
        registration.setId(AppServiceRegistration.generateToken());
        registration.setHomeserverToken(AppServiceRegistration.generateToken());
        registration.setAppServiceToken(AppServiceRegistration.generateToken());
        registration.setRateLimited(false); // disabled for the high-traffic nature of Minecraft

        if (!registration.getSenderLocalpart()) {
            registration.setSenderLocalpart("_minecraft");
        }

        registration.addRegexPattern("users", "_minecraft.*");
        registration.addRegexPattern("aliases", "_minecraft.*");

        callback(registration);
    },
    run: function (port, config, registration) {
        var bridge = new MinecraftBridge(config, registration);
        bridge.run(port).catch(err => {
            log.error("Init", "Failed to start bridge");
            throw err;
        });
    }
}).run();