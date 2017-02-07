var mojang = require('mojang');
var moment = require('moment');
var log = require('npmlog');

class UuidCache {
    constructor() {
        this._cache = {};
    }

    lookupFromUuid(uuid) {
        uuid = uuid.replace(/-/g, '');

        var generate = true;
        if (this._cache.hasOwnProperty(uuid)) {
            if (moment().isBefore(this._cache[uuid].expires)) {
                generate = false;
            }
        }

        if (generate) {
            return new Promise((resolve, reject) => {
                mojang.profile(uuid).then(profile => {
                    if (profile.error) {
                        reject(new Error(profile.error + ": " + profile.errorMessage));
                        return;
                    }

                    this._cache[uuid] = {
                        profile: new PlayerInfo(profile.id, profile.name),
                        expires: moment().add(4, 'hours')
                    };

                    resolve(this._cache[uuid].profile);
                }, error => {
                    log.error("UuidCache", "Could not lookup profile for '" + uuid + "'");
                    log.error("UuidCache", error);
                    reject(error);
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                var profile = this._cache[uuid];
                if (profile)resolve(profile.profile);
                else reject(new Error("Profile not found: " + uuid));
            });
        }
    }
}

class PlayerInfo {
    constructor(uuid, displayName) {
        this.uuid = uuid.replace(/-/g, '');
        this.uuidExpanded = this.uuid.substring(0, 7) + '-' + this.uuid.substring(8, 12) + '-' + this.uuid.substring(13, 17) + '-' + this.uuid.substring(18);
        this.displayName = displayName;
    }
}

var cache = new UuidCache();
module.exports = cache;
